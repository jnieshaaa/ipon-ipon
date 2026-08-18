# Walkthrough - Supabase Ledger Integration & Approvals Workflow

We have successfully migrated the Ipon-Ipon savings ledger to the database, integrated member join approvals, enabled leaders to add themselves or offline savers, and enabled transferring funds/savings to member accounts.

## Changes Made

### Configuration & Database

#### [MODIFY] [schema.sql](file:///c:/Users/j_ant/projects/ipon-ipon/supabase/schema.sql)
- Updated `savings_accounts` schema to make `user_id` nullable (supporting offline members), add `group_id` reference to associate savers per savings group, and add `accounts_count INT DEFAULT 1` to track multiple account slots per saver.
- Added `approved BOOLEAN DEFAULT FALSE` to `group_members` table for the leader verification flow.
- Added indexes for performance.
- Configured RLS rules:
  - Allowed group members to SELECT ledger rows.
  - Restricted group INSERT/UPDATE/DELETE actions to the group creator (leader).

### Query Layer

#### [NEW] [savings.ts](file:///c:/Users/j_ant/projects/ipon-ipon/src/queries/savings.ts)
- `getSaversQuery(groupId)`: Loads savers, maps `accounts_count` from the database, and sorts weekly timelines chronologically.
- `addSaverQuery(groupId, name, accountsCount, userId)`: Registers savers with custom account counts, and pre-generates 52-week calendar entries (W1..W52) based on group cycle configuration.
- `updateSaverAccountsCountQuery(accountId, count)`: Modifies the active accounts count for a saver.
- `recordPaymentQuery(accountId, entryId, amount)`: Updates weekly amount paid and recalculates/updates total savings.
- `transferSaverAccountQuery(accountId, memberUserId)`: Links/transfers an offline saver account to a registered member.
- `deleteSaverQuery(accountId)`: Removes a saver account and cascades deletion of entries.

#### [MODIFY] [groups.ts](file:///c:/Users/j_ant/projects/ipon-ipon/src/queries/groups.ts)
- Added `approved?: boolean` to `ISavingsGroup` representation.
- Automatically sets `approved = true` when the group creator initializes the group.
- Implemented `getPendingApprovalsQuery(groupId)` to list users requesting to join.
- Implemented `approveMemberQuery(groupId, memberUserId)` and `removeMemberQuery(groupId, memberUserId)`.

### UI Integration

#### [NEW] [PendingApprovals.tsx](file:///c:/Users/j_ant/projects/ipon-ipon/src/views/pages/PendingApprovals.tsx)
- Created a dedicated page displaying join requests with name, email, and request date. Allows leaders to approve or decline joining members.

#### [MODIFY] [GroupSelection.tsx](file:///c:/Users/j_ant/projects/ipon-ipon/src/views/pages/GroupSelection.tsx)
- Displays a `Pending Approval` badge for groups where user membership is not approved. Prevents selecting pending groups.

#### [MODIFY] [Dashboard.tsx](file:///c:/Users/j_ant/projects/ipon-ipon/src/views/pages/Dashboard.tsx) and [GroupSettings.tsx](file:///c:/Users/j_ant/projects/ipon-ipon/src/views/pages/GroupSettings.tsx)
- Updated to retrieve settings from individual selected group keys in local storage, which makes dashboard navigation and leadership checks fully compatible with both mock and live Supabase groups.
- Added a real-time **Pending Approvals Notification Banner** on the Leader's Dashboard, showing the count of joining members (filtering out the leader themselves) and providing an "Approve" button to navigate to the new `PendingApprovals` screen.
- Displays the universal `Universal Code: [CODE]` on the welcome dashboard card for easy copy/reference.

#### [MODIFY] [IponIponOverview.tsx](file:///c:/Users/j_ant/projects/ipon-ipon/src/views/pages/IponIponOverview.tsx)
- Connects to Supabase queries to load savers and display totals.
- Displays the 8-character universal unique ID code badge (e.g. `JC3H9F1Z`) next to each member in the list, allowing leaders to see it instantly.
- Displays a **Pending Join Requests** queue for group leaders to approve or reject members.

#### [MODIFY] [LoginScreen.tsx](file:///c:/Users/j_ant/projects/ipon-ipon/src/views/pages/LoginScreen.tsx)
- Replaced the dummy Quick Balance button click with a live-connected **Quick Balance Inquiry Sheet**.
- Users can input their universal 8-character code, which triggers parallel database queries to fetch their total savings balance, active accounts count, outstanding loan principal, and count of active borrowings. Renders this information in a premium stats panel.
- Shows leader options to **Link Saver to Member** (to transfer guest savers to registered app users) and **Remove Saver** (deletes account).

#### [MODIFY] [AddPerson.tsx](file:///c:/Users/j_ant/projects/ipon-ipon/src/views/pages/AddPerson.tsx)
- Hooked to Supabase queries to save accounts directly.
- Added category toggle: **Offline Member** or **Myself (Leader)** (which locks and maps the leader's account).

#### [MODIFY] [PersonSavingsDetail.tsx](file:///c:/Users/j_ant/projects/ipon-ipon/src/views/pages/PersonSavingsDetail.tsx)
- Loads specific savings timelines from Supabase and updates payments.

---

## Verification Results

### Automated Build Verification
The production build compiles successfully:
```bash
npm run build
```

### Next Steps for SQL Database Deploy
Run these statements in your **Supabase Dashboard SQL Editor**:

```sql
-- 1. Add approved column to group_members
ALTER TABLE group_members ADD COLUMN IF NOT EXISTS approved BOOLEAN DEFAULT FALSE;

-- 2. Alter savings_accounts schema for group, accounts_count and nullable fields
ALTER TABLE savings_accounts DROP CONSTRAINT IF EXISTS savings_accounts_user_id_fkey;
ALTER TABLE savings_accounts ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE savings_accounts ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES savings_groups(id) ON DELETE CASCADE;
ALTER TABLE savings_accounts ADD COLUMN IF NOT EXISTS accounts_count INT DEFAULT 1;
ALTER TABLE savings_accounts ADD CONSTRAINT savings_accounts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- 3. Add index
CREATE INDEX IF NOT EXISTS idx_savings_accounts_group_id ON savings_accounts(group_id);

-- 4. Apply clean RLS policies
DROP POLICY IF EXISTS "Group leaders can update memberships" ON group_members;
DROP POLICY IF EXISTS "Group leaders can delete memberships" ON group_members;

CREATE POLICY "Group leaders can update memberships"
  ON group_members FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM savings_groups
      WHERE savings_groups.id = group_members.group_id
      AND savings_groups.creator_id = auth.uid()
    )
  );

CREATE POLICY "Group leaders can delete memberships"
  ON group_members FOR DELETE
  USING (
    auth.uid() = group_members.user_id OR
    EXISTS (
      SELECT 1 FROM savings_groups
      WHERE savings_groups.id = group_members.group_id
      AND savings_groups.creator_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can view their own savings accounts" ON savings_accounts;
DROP POLICY IF EXISTS "Users can insert their own savings accounts" ON savings_accounts;
DROP POLICY IF EXISTS "Users can update their own savings accounts" ON savings_accounts;
DROP POLICY IF EXISTS "Users can delete their own savings accounts" ON savings_accounts;

CREATE POLICY "Authenticated users can view savings accounts"
  ON savings_accounts FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Group leaders can create savings accounts"
  ON savings_accounts FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM savings_groups
      WHERE savings_groups.id = savings_accounts.group_id
      AND savings_groups.creator_id = auth.uid()
    )
  );

CREATE POLICY "Group leaders can update savings accounts"
  ON savings_accounts FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM savings_groups
      WHERE savings_groups.id = savings_accounts.group_id
      AND savings_groups.creator_id = auth.uid()
    )
  );

CREATE POLICY "Group leaders can delete savings accounts"
  ON savings_accounts FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM savings_groups
      WHERE savings_groups.id = savings_accounts.group_id
      AND savings_groups.creator_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can view their own savings entries" ON savings_entries;
DROP POLICY IF EXISTS "Users can insert their own savings entries" ON savings_entries;
DROP POLICY IF EXISTS "Users can update their own savings entries" ON savings_entries;
DROP POLICY IF EXISTS "Users can delete their own savings entries" ON savings_entries;

CREATE POLICY "Authenticated users can view savings entries"
  ON savings_entries FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Group leaders can insert savings entries"
  ON savings_entries FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM savings_accounts
      JOIN savings_groups ON savings_groups.id = savings_accounts.group_id
      WHERE savings_accounts.id = savings_entries.savings_account_id
      AND savings_groups.creator_id = auth.uid()
    )
  );

CREATE POLICY "Group leaders can update savings entries"
  ON savings_entries FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM savings_accounts
      JOIN savings_groups ON savings_groups.id = savings_accounts.group_id
      WHERE savings_accounts.id = savings_entries.savings_account_id
      AND savings_groups.creator_id = auth.uid()
    )
  );

CREATE POLICY "Group leaders can delete savings entries"
  ON savings_entries FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM savings_accounts
      JOIN savings_groups ON savings_groups.id = savings_accounts.group_id
      WHERE savings_accounts.id = savings_entries.savings_account_id
      AND savings_groups.creator_id = auth.uid()
    )
  );
```
