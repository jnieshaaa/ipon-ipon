import { supabase } from '../lib/supabase';
import { Account, SavingsEntry, getAccountsForUser, addPersonToStorage, recordSavingsPayment, getAccountsMapFromStorage } from '../models/mockAccounts';

// Check if we are running in database-free mock mode
const isMockMode = (): boolean => {
  return import.meta.env.VITE_USE_MOCK === 'true' || 
         !import.meta.env.VITE_SUPABASE_URL || 
         !import.meta.env.VITE_SUPABASE_ANON_KEY;
};

// Generates an 8-character uppercase alphanumeric code
function generateUniqueSaverCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Generate calendar dates for due days in a cycle year
export function getDatesForWeekdayInYear(
  yearStr: string,
  dueDay: string,
  startDateStr?: string,
  endDateStr?: string
): string[] {
  const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const targetDayIndex = weekdays.indexOf(dueDay);
  if (targetDayIndex === -1) return [];

  const dates: string[] = [];
  
  // Determine bounds
  let startDate: Date;
  let endDate: Date;
  
  if (startDateStr && endDateStr) {
    startDate = new Date(startDateStr + "T00:00:00Z");
    endDate = new Date(endDateStr + "T23:59:59Z");
  } else {
    const year = parseInt(yearStr) || 2026;
    startDate = new Date(Date.UTC(year, 0, 1));
    endDate = new Date(Date.UTC(year, 11, 31, 23, 59, 59));
  }
  
  const date = new Date(startDate.getTime());
  // Find first target weekday after or equal to startDate in UTC
  while (date.getUTCDay() !== targetDayIndex) {
    date.setUTCDate(date.getUTCDate() + 1);
  }
  
  // Collect all occurrences up to endDate
  while (date <= endDate) {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    dates.push(`${y}-${m}-${d}`);
    
    date.setUTCDate(date.getUTCDate() + 7);
  }
  return dates;
}

/**
 * Fetch all savers (savings accounts) and their entries for a group
 */
export async function getSaversQuery(groupId: string): Promise<Account[]> {
  if (isMockMode()) {
    const creatorId = localStorage.getItem('ipon_selected_group_creator_id') || 'default';
    return getAccountsForUser(creatorId);
  }

  try {
    const { data: accounts, error: accountsError } = await supabase
      .from('savings_accounts')
      .select(`
        id,
        name,
        unique_id,
        total_savings,
        accounts_count,
        user_id,
        entries:savings_entries (
          id,
          week_range,
          amount_paid,
          entry_date
        )
      `)
      .eq('group_id', groupId);

    if (accountsError) {
      console.error('Error fetching savers:', accountsError);
      throw accountsError;
    }

    if (!accounts) return [];

    return accounts.map((acc: any) => {
      // Sort entries chronologically by date or W# index
      const sortedEntries = (acc.entries || []).sort((a: any, b: any) => {
        return a.entry_date.localeCompare(b.entry_date);
      });

      return {
        id: acc.id,
        name: acc.name,
        uniqueId: acc.unique_id,
        totalSavings: Number(acc.total_savings || 0),
        accountsCount: Number(acc.accounts_count || 1),
        userId: acc.user_id || undefined,
        entries: sortedEntries.map((e: any) => ({
          id: e.id,
          weekRange: e.week_range,
          amountPaid: Number(e.amount_paid || 0),
          date: e.entry_date
        }))
      };
    });
  } catch (error) {
    console.error('getSaversQuery exception:', error);
    throw error;
  }
}

/**
 * Register a new saver account in a group and pre-populate W1..W52 weekly entries
 */
export async function addSaverQuery(
  groupId: string,
  name: string,
  accountsCount: number,
  userId: string | null = null
): Promise<Account | null> {
  if (isMockMode()) {
    const creatorId = localStorage.getItem('ipon_selected_group_creator_id') || 'default';
    addPersonToStorage(creatorId, name, accountsCount);
    // Fetch newly created account
    const accounts = getSaversQuery(groupId);
    return (await accounts).find(acc => acc.name.toLowerCase() === name.toLowerCase()) || null;
  }

  try {
    // 1. Fetch group cycle details
    const { data: group, error: groupError } = await supabase
      .from('savings_groups')
      .select('cycle_year, payment_due, start_date, end_date')
      .eq('id', groupId)
      .single();

    if (groupError || !group) {
      console.error('Error fetching group configuration for timeline:', groupError);
      throw groupError || new Error("Selected group not found.");
    }

    // 2. Fetch universal member code from group_members if user is registered, otherwise generate a new unique ID
    let uniqueId = "";
    if (userId) {
      const { data: memberRow } = await supabase
        .from('group_members')
        .select('members_code')
        .eq('group_id', groupId)
        .eq('user_id', userId)
        .maybeSingle();
      if (memberRow) {
        uniqueId = memberRow.members_code;
      }
    }

    if (!uniqueId) {
      let isUnique = false;
      let retries = 0;
      while (!isUnique && retries < 10) {
        uniqueId = generateUniqueSaverCode();
        const { data, error } = await supabase
          .from('savings_accounts')
          .select('id')
          .eq('unique_id', uniqueId)
          .maybeSingle();
        if (!error && !data) {
          isUnique = true;
        }
        retries++;
      }

      if (!isUnique) {
        throw new Error("Failed to generate a unique ID for saver. Please try again.");
      }
    }

    // 3. Insert savings account
    const { data: newAccount, error: accError } = await supabase
      .from('savings_accounts')
      .insert({
        name,
        group_id: groupId,
        user_id: userId || null,
        unique_id: uniqueId,
        total_savings: 0,
        accounts_count: accountsCount
      })
      .select()
      .single();

    if (accError || !newAccount) {
      console.error('Error inserting savings account:', accError);
      throw accError || new Error("Failed to register saver account.");
    }

    // 4. Generate due dates for the year's timeline (W1..W52)
    const dates = getDatesForWeekdayInYear(group.cycle_year, group.payment_due, group.start_date, group.end_date);
    if (dates.length > 0) {
      const entriesToInsert = dates.map((dateStr, idx) => ({
        savings_account_id: newAccount.id,
        week_range: `W${idx + 1} (${dateStr})`,
        amount_paid: 0,
        entry_date: dateStr
      }));

      const { error: entriesError } = await supabase
        .from('savings_entries')
        .insert(entriesToInsert);

      if (entriesError) {
        console.error('Error pre-populating savings timeline entries:', entriesError);
        // Clean up account
        await supabase.from('savings_accounts').delete().eq('id', newAccount.id);
        throw entriesError;
      }
    }

    // 5. Query complete account to return
    const fullAccounts = await getSaversQuery(groupId);
    return fullAccounts.find(acc => acc.id === newAccount.id) || null;
  } catch (error) {
    console.error('addSaverQuery exception:', error);
    throw error;
  }
}

/**
 * Record payment for a specific weekly timeline entry
 */
export async function recordPaymentQuery(
  accountId: string,
  entryId: string,
  amount: number
): Promise<void> {
  if (isMockMode()) {
    const creatorId = localStorage.getItem('ipon_selected_group_creator_id') || 'default';
    recordSavingsPayment(creatorId, accountId, entryId, amount);
    return;
  }

  try {
    // 1. Update entry amount paid
    const { error: entryError } = await supabase
      .from('savings_entries')
      .update({ amount_paid: amount })
      .eq('id', entryId);

    if (entryError) {
      console.error('Error updating entry payment:', entryError);
      throw entryError;
    }

    // 2. Recalculate total sum for the savings account
    const { data: entries, error: sumError } = await supabase
      .from('savings_entries')
      .select('amount_paid')
      .eq('savings_account_id', accountId);

    if (sumError) {
      console.error('Error calculating new total savings sum:', sumError);
      throw sumError;
    }

    const totalSavingsSum = (entries || []).reduce((sum, e) => sum + Number(e.amount_paid || 0), 0);

    // 3. Update total_savings in savings_accounts table
    const { error: updateAccError } = await supabase
      .from('savings_accounts')
      .update({ total_savings: totalSavingsSum })
      .eq('id', accountId);

    if (updateAccError) {
      console.error('Error updating account total savings sum:', updateAccError);
      throw updateAccError;
    }
  } catch (error) {
    console.error('recordPaymentQuery exception:', error);
    throw error;
  }
}

/**
 * Transfer / Link a guest/offline savings account to a registered member's user ID
 */
export async function transferSaverAccountQuery(accountId: string, memberUserId: string): Promise<void> {
  if (isMockMode()) {
    return; // No-op in mock
  }

  try {
    // 1. Fetch the member's code from group_members
    const { data: memberRow, error: memberError } = await supabase
      .from('group_members')
      .select('members_code')
      .eq('user_id', memberUserId)
      .maybeSingle();

    if (memberError || !memberRow) {
      throw memberError || new Error("Member profile not found in group.");
    }

    // 2. Link account user_id and update unique_id to the universal members_code
    const { error } = await supabase
      .from('savings_accounts')
      .update({ 
        user_id: memberUserId,
        unique_id: memberRow.members_code
      })
      .eq('id', accountId);

    if (error) {
      console.error('Error transferring saver account:', error);
      throw error;
    }
  } catch (error) {
    console.error('transferSaverAccountQuery exception:', error);
    throw error;
  }
}

/**
 * Remove a saver from the group ledger (deletes account and all entries cascade)
 */
export async function deleteSaverQuery(accountId: string): Promise<void> {
  if (isMockMode()) {
    const map = getAccountsMapFromStorage();
    const creatorId = localStorage.getItem('ipon_selected_group_creator_id') || 'default';
    if (map[creatorId]) {
      map[creatorId] = map[creatorId].filter(acc => acc.id !== accountId);
      localStorage.setItem('ipon_user_accounts', JSON.stringify(map));
    }
    return;
  }

  try {
    const { error } = await supabase
      .from('savings_accounts')
      .delete()
      .eq('id', accountId);

    if (error) {
      console.error('Error deleting saver account:', error);
      throw error;
    }
  } catch (error) {
    console.error('deleteSaverQuery exception:', error);
    throw error;
  }
}

/**
 * Update the number of accounts for a saver account
 */
export async function updateSaverAccountsCountQuery(accountId: string, count: number): Promise<void> {
  if (isMockMode()) {
    const map = getAccountsMapFromStorage();
    Object.keys(map).forEach(key => {
      const acc = map[key].find((a: any) => a.id === accountId);
      if (acc) {
        acc.accountsCount = count;
      }
    });
    localStorage.setItem('ipon_user_accounts', JSON.stringify(map));
    return;
  }

  try {
    const { error } = await supabase
      .from('savings_accounts')
      .update({ accounts_count: count })
      .eq('id', accountId);

    if (error) {
      console.error('Error updating accounts count:', error);
      throw error;
    }
  } catch (error) {
    console.error('updateSaverAccountsCountQuery exception:', error);
    throw error;
  }
}
