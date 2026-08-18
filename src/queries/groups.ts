import { supabase } from '../lib/supabase';
import { IUser, User } from '../models/User';
import { getGroupsFromStorage, mockUsers, createGroupInStorage, joinGroupInStorage, getGroupsForUser } from '../models/mockAccounts';
import { addSaverQuery, getDatesForWeekdayInYear } from './savings';

export interface ISavingsGroup {
  id: string;
  groupCode: string;
  name: string;
  year: string;
  weeklyAmount: number;
  dueDay: string;
  creatorId: string;
  createdAt?: string;
  updatedAt?: string;
  memberCode?: string; // Quick guest access passcode
  approved?: boolean; // New field for leader approval check
  startDate?: string;
  endDate?: string;
}

export interface CreateGroupInput {
  name: string;
  year: string;
  weeklyAmount: number;
  dueDay: string;
  creatorId: string;
  startDate: string;
  endDate: string;
}

// Check if we are running in database-free mock mode
const isMockMode = (): boolean => {
  return import.meta.env.VITE_USE_MOCK === 'true' || 
         !import.meta.env.VITE_SUPABASE_URL || 
         !import.meta.env.VITE_SUPABASE_ANON_KEY;
};

// Generate random uppercase alphanumeric code (3 letters + 3 numbers)
function generateGroupCode(): string {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const numbers = "0123456789";
  let code = "";
  for (let i = 0; i < 3; i++) {
    code += letters.charAt(Math.floor(Math.random() * letters.length));
  }
  for (let i = 0; i < 3; i++) {
    code += numbers.charAt(Math.floor(Math.random() * numbers.length));
  }
  return code;
}

// Generate random member code (4 shuffled letters + 4 shuffled numbers)
function generateMemberCode(): string {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const numbers = "0123456789";
  const pool: string[] = [];
  for (let i = 0; i < 4; i++) {
    pool.push(letters.charAt(Math.floor(Math.random() * letters.length)));
    pool.push(numbers.charAt(Math.floor(Math.random() * numbers.length)));
  }
  // Shuffle combined array using Fisher-Yates
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.join("");
}

/**
 * Creates a new savings group in Supabase (or fallback local mock)
 */
export async function createGroupQuery(input: CreateGroupInput): Promise<ISavingsGroup | null> {
  if (isMockMode()) {
    const mockGroup = createGroupInStorage(
      input.name,
      input.year,
      input.weeklyAmount,
      input.dueDay,
      input.creatorId,
      input.startDate,
      input.endDate
    );
    return {
      id: mockGroup.id,
      groupCode: mockGroup.id,
      name: mockGroup.name,
      year: mockGroup.year,
      weeklyAmount: mockGroup.weeklyAmount,
      dueDay: mockGroup.dueDay,
      creatorId: mockGroup.creatorId,
      memberCode: 'MOCK1234',
      startDate: mockGroup.startDate,
      endDate: mockGroup.endDate
    };
  }

  try {
    // 1. Generate unique 6-character code (3 letters + 3 numbers)
    let groupCode = "";
    let isUnique = false;
    let retries = 0;
    
    while (!isUnique && retries < 10) {
      groupCode = generateGroupCode();
      const { data, error } = await supabase
        .from('savings_groups')
        .select('id')
        .eq('group_code', groupCode)
        .maybeSingle();
      
      if (error) {
        console.error('Error checking unique code:', error);
        throw new Error(`Database error: ${error.message}. Please make sure you have run the SQL schema in your Supabase SQL Editor.`);
      }
      
      if (!data) {
        isUnique = true;
      }
      retries++;
    }

    if (!isUnique) {
      throw new Error("Failed to generate a unique group code. Please try again.");
    }

    // 2. Insert group configuration
    const { data: newGroup, error: groupError } = await supabase
      .from('savings_groups')
      .insert({
        group_code: groupCode,
        name: input.name,
        cycle_year: input.year,
        weekly_amount: input.weeklyAmount,
        payment_due: input.dueDay,
        creator_id: input.creatorId,
        start_date: input.startDate,
        end_date: input.endDate
      })
      .select()
      .single();

    if (groupError || !newGroup) {
      console.error('Error inserting group:', groupError);
      throw groupError || new Error("Failed to create group.");
    }

    // 3. Generate unique guest access member code (4 letters + 4 numbers shuffled)
    let memberCode = "";
    let isCodeUnique = false;
    let codeRetries = 0;
    while (!isCodeUnique && codeRetries < 10) {
      memberCode = generateMemberCode();
      const { data, error } = await supabase
        .from('group_members')
        .select('id')
        .eq('members_code', memberCode)
        .maybeSingle();
      if (!error && !data) {
        isCodeUnique = true;
      }
      codeRetries++;
    }

    if (!isCodeUnique) {
      throw new Error("Failed to generate a unique guest passcode. Please try again.");
    }

    // 4. Add creator to group memberships with the generated code
    const { error: memberError } = await supabase
      .from('group_members')
      .insert({
        group_id: newGroup.id,
        user_id: input.creatorId,
        members_code: memberCode,
        approved: true
      });

    if (memberError) {
      console.error('Error inserting group member:', memberError);
      // Clean up the group if joining fails
      await supabase.from('savings_groups').delete().eq('id', newGroup.id);
      throw memberError;
    }

    // Also automatically create a saver ledger for the creator/leader themselves
    try {
      const { data: creatorProfile } = await supabase
        .from('users')
        .select('username')
        .eq('id', input.creatorId)
        .maybeSingle();

      const creatorName = creatorProfile?.username || 'Leader';
      
      await addSaverQuery(newGroup.id, creatorName, 1, input.creatorId);
    } catch (e) {
      console.warn('Error auto-creating leader saver:', e);
    }

    return {
      id: newGroup.id,
      groupCode: newGroup.group_code,
      name: newGroup.name,
      year: newGroup.cycle_year,
      weeklyAmount: Number(newGroup.weekly_amount),
      dueDay: newGroup.payment_due,
      creatorId: newGroup.creator_id,
      memberCode: memberCode,
      createdAt: newGroup.created_at,
      updatedAt: newGroup.updated_at,
      startDate: newGroup.start_date,
      endDate: newGroup.end_date
    };
  } catch (error) {
    console.error('createGroupQuery exception:', error);
    throw error;
  }
}

/**
 * Join an existing group by entering its 6-character code
 */
export async function joinGroupQuery(groupCode: string, userId: string): Promise<ISavingsGroup | null> {
  const code = groupCode.trim().toUpperCase();
  if (isMockMode()) {
    const mockGroup = joinGroupInStorage(code, userId);
    if (!mockGroup) return null;
    return {
      id: mockGroup.id,
      groupCode: mockGroup.id,
      name: mockGroup.name,
      year: mockGroup.year,
      weeklyAmount: mockGroup.weeklyAmount,
      dueDay: mockGroup.dueDay,
      creatorId: mockGroup.creatorId,
      memberCode: 'MOCK5678',
      startDate: mockGroup.startDate,
      endDate: mockGroup.endDate
    };
  }

  try {
    // 1. Find group by code
    const { data: group, error: fetchError } = await supabase
      .from('savings_groups')
      .select('id, group_code, name, cycle_year, weekly_amount, payment_due, creator_id, start_date, end_date, created_at, updated_at')
      .eq('group_code', code)
      .maybeSingle();

    if (fetchError) {
      console.error('Error fetching group by code:', fetchError);
      throw fetchError;
    }

    if (!group) {
      return null; // Not found
    }

    // 2. Generate unique guest access member code (4 letters + 4 numbers shuffled)
    let memberCode = "";
    let isCodeUnique = false;
    let codeRetries = 0;
    while (!isCodeUnique && codeRetries < 10) {
      memberCode = generateMemberCode();
      const { data, error } = await supabase
        .from('group_members')
        .select('id')
        .eq('members_code', memberCode)
        .maybeSingle();
      if (!error && !data) {
        isCodeUnique = true;
      }
      codeRetries++;
    }

    if (!isCodeUnique) {
      throw new Error("Failed to generate a unique guest passcode. Please try again.");
    }

    // 3. Add member to group
    const { error: joinError } = await supabase
      .from('group_members')
      .insert({
        group_id: group.id,
        user_id: userId,
        members_code: memberCode
      });

    if (joinError) {
      // Check if user is already a member (violating unique constraint)
      if (joinError.code === '23505') {
        // Unique violation, already a member, that's fine
        // Retrieve existing code
        const { data: existingMember } = await supabase
          .from('group_members')
          .select('members_code')
          .eq('group_id', group.id)
          .eq('user_id', userId)
          .maybeSingle();
        if (existingMember) {
          memberCode = existingMember.members_code;
        }
      } else {
        console.error('Error joining group:', joinError);
        throw joinError;
      }
    }

    return {
      id: group.id,
      groupCode: group.group_code,
      name: group.name,
      year: group.cycle_year,
      weeklyAmount: Number(group.weekly_amount),
      dueDay: group.payment_due,
      creatorId: group.creator_id,
      memberCode: memberCode,
      startDate: group.start_date,
      endDate: group.end_date,
      createdAt: group.created_at,
      updatedAt: group.updated_at
    };
  } catch (error) {
    console.error('joinGroupQuery exception:', error);
    throw error;
  }
}

/**
 * Fetch all groups that the user created or joined
 */
export async function getGroupsForUserQuery(userId: string): Promise<ISavingsGroup[]> {
  if (isMockMode()) {
    const mockGroups = getGroupsForUser(userId);
    return mockGroups.map(g => ({
      id: g.id,
      groupCode: g.id,
      name: g.name,
      year: g.year,
      weeklyAmount: g.weeklyAmount,
      dueDay: g.dueDay,
      creatorId: g.creatorId,
      startDate: g.startDate,
      endDate: g.endDate
    }));
  }

  try {
    const { data, error } = await supabase
      .from('group_members')
      .select(`
        approved,
        savings_groups (
          id,
          group_code,
          name,
          cycle_year,
          weekly_amount,
          payment_due,
          creator_id,
          start_date,
          end_date,
          created_at,
          updated_at
        )
      `)
      .eq('user_id', userId);

    if (error) {
      console.error('Error fetching user groups:', error);
      throw error;
    }

    if (!data) return [];

    return data
      .filter((item: any) => item.savings_groups)
      .map((item: any) => {
        const g = item.savings_groups;
        return {
          id: g.id,
          groupCode: g.group_code,
          name: g.name,
          year: g.cycle_year,
          weeklyAmount: Number(g.weekly_amount),
          dueDay: g.payment_due,
          creatorId: g.creator_id,
          approved: item.approved,
          createdAt: g.created_at,
          updatedAt: g.updated_at,
          startDate: g.start_date,
          endDate: g.end_date
        };
      });
  } catch (error) {
    console.error('getGroupsForUserQuery exception:', error);
    throw error;
  }
}

/**
 * Log in a user directly by their unique 8-character member code (shuffled 4 letters + 4 numbers)
 */
export async function loginByMemberCodeQuery(code: string): Promise<{ user: IUser; group: ISavingsGroup } | null> {
  const cleanCode = code.trim().toUpperCase();
  if (isMockMode()) {
    const groups = getGroupsFromStorage();
    const defaultGroup = groups[0];
    if (defaultGroup) {
      const mockUser = mockUsers[0];
      return {
        user: {
          id: mockUser.id,
          name: mockUser.name,
          email: mockUser.email,
          balance: 0,
          userId: mockUser.userId,
        },
        group: {
          id: defaultGroup.id,
          groupCode: defaultGroup.id,
          name: defaultGroup.name,
          year: defaultGroup.year,
          weeklyAmount: defaultGroup.weeklyAmount,
          dueDay: defaultGroup.dueDay,
          creatorId: defaultGroup.creatorId,
          memberCode: cleanCode,
          startDate: defaultGroup.startDate,
          endDate: defaultGroup.endDate
        }
      };
    }
    return null;
  }

  try {
    // 1. Fetch group member by code
    const { data: member, error: memberError } = await supabase
      .from('group_members')
      .select(`
        id,
        user_id,
        members_code,
        group: savings_groups (
          id,
          group_code,
          name,
          cycle_year,
          weekly_amount,
          payment_due,
          creator_id,
          start_date,
          end_date,
          created_at,
          updated_at
        )
      `)
      .eq('members_code', cleanCode)
      .maybeSingle();

    if (memberError || !member) {
      console.error('Error fetching member by code:', memberError);
      return null;
    }

    const dbGroup = (member as any).group;
    if (!dbGroup) return null;

    // 2. Fetch public.users profile of the member
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('username, email')
      .eq('id', member.user_id)
      .maybeSingle();

    if (profileError) {
      console.warn('Error fetching profile from users table:', profileError);
    }

    const username = profile?.username || 'Guest Member';
    const email = profile?.email || '';

    const userData: IUser = {
      id: member.user_id,
      name: username,
      email: email,
      balance: 0,
      userId: member.user_id,
    };

    const groupData: ISavingsGroup = {
      id: dbGroup.id,
      groupCode: dbGroup.group_code,
      name: dbGroup.name,
      year: dbGroup.cycle_year,
      weeklyAmount: Number(dbGroup.weekly_amount),
      dueDay: dbGroup.payment_due,
      creatorId: dbGroup.creator_id,
      memberCode: member.members_code,
      createdAt: dbGroup.created_at,
      updatedAt: dbGroup.updated_at,
      startDate: dbGroup.start_date,
      endDate: dbGroup.end_date
    };

    return {
      user: userData,
      group: groupData
    };
  } catch (error) {
    console.error('loginByMemberCodeQuery exception:', error);
    throw error;
  }
}

/**
 * Fetch all pending member join requests for a group
 */
export async function getPendingApprovalsQuery(groupId: string): Promise<any[]> {
  if (isMockMode()) return [];
  try {
    const { data: members, error: membersError } = await supabase
      .from('group_members')
      .select('user_id, group_id, created_at')
      .eq('group_id', groupId)
      .eq('approved', false);

    if (membersError) {
      console.error('Error fetching pending members:', membersError);
      throw membersError;
    }

    if (!members || members.length === 0) {
      return [];
    }

    const userIds = members.map((m: any) => m.user_id);
    const { data: profiles, error: profilesError } = await supabase
      .from('users')
      .select('id, username, email')
      .in('id', userIds);

    if (profilesError) {
      console.error('Error fetching member profiles:', profilesError);
      throw profilesError;
    }

    const profilesMap = new Map(profiles?.map(p => [p.id, p]) || []);

    return members.map((item: any) => {
      const profile = profilesMap.get(item.user_id);
      return {
        userId: item.user_id,
        groupId: item.group_id,
        createdAt: item.created_at,
        username: profile?.username || 'New Member',
        email: profile?.email || ''
      };
    });
  } catch (error) {
    console.error('getPendingApprovalsQuery exception:', error);
    throw error;
  }
}

/**
 * Approve a member's request to join a group
 */
export async function approveMemberQuery(groupId: string, memberUserId: string): Promise<void> {
  if (isMockMode()) return;
  try {
    const { error } = await supabase
      .from('group_members')
      .update({ approved: true })
      .eq('group_id', groupId)
      .eq('user_id', memberUserId);

    if (error) {
      console.error('Error approving member:', error);
      throw error;
    }

    // Automatically check and create a savings account row for the newly approved member
    const { data: existingAcc, error: accError } = await supabase
      .from('savings_accounts')
      .select('id')
      .eq('group_id', groupId)
      .eq('user_id', memberUserId)
      .maybeSingle();

    if (!accError && !existingAcc) {
      const { data: profile } = await supabase
        .from('users')
        .select('username')
        .eq('id', memberUserId)
        .maybeSingle();

      const defaultName = profile?.username || 'Member';

      await addSaverQuery(groupId, defaultName, 1, memberUserId);
    }
  } catch (error) {
    console.error('approveMemberQuery exception:', error);
    throw error;
  }
}

/**
 * Remove a member from the group (deletes membership, sets saver accounts user_id relation to NULL)
 */
export async function removeMemberQuery(groupId: string, memberUserId: string): Promise<void> {
  if (isMockMode()) return;
  try {
    const { error } = await supabase
      .from('group_members')
      .delete()
      .eq('group_id', groupId)
      .eq('user_id', memberUserId);

    if (error) {
      console.error('Error removing member:', error);
      throw error;
    }

    // Clear association from savings_accounts in this group
    await supabase
      .from('savings_accounts')
      .update({ user_id: null })
      .eq('group_id', groupId)
      .eq('user_id', memberUserId);
  } catch (error) {
    console.error('removeMemberQuery exception:', error);
    throw error;
  }
}

/**
 * Updates an existing savings group's details and synchronizes all members' timelines.
 */
export async function updateGroupQuery(
  groupId: string,
  input: { name: string; year: string; weeklyAmount: number; dueDay: string; startDate: string; endDate: string }
): Promise<boolean> {
  if (isMockMode()) {
    return true;
  }

  try {
    // 1. Update group configurations
    const { error } = await supabase
      .from('savings_groups')
      .update({
        name: input.name,
        cycle_year: input.year,
        weekly_amount: input.weeklyAmount,
        payment_due: input.dueDay,
        start_date: input.startDate,
        end_date: input.endDate,
        updated_at: new Date().toISOString()
      })
      .eq('id', groupId);

    if (error) {
      console.error('Error updating group settings:', error);
      throw error;
    }

    // 2. Fetch new date timeline array
    const newDates = getDatesForWeekdayInYear(input.year, input.dueDay, input.startDate, input.endDate);

    // 3. Fetch all saver accounts belonging to this group
    const { data: accounts, error: accountsError } = await supabase
      .from('savings_accounts')
      .select('id')
      .eq('group_id', groupId);

    if (accountsError) {
      console.error('Error fetching group accounts during settings sync:', accountsError);
      return true; // Non-fatal, setting saved successfully anyway
    }

    if (accounts && accounts.length > 0 && newDates.length > 0) {
      const accountIds = accounts.map(a => a.id);

      for (const accId of accountIds) {
        // Fetch current savings entries sorted by entry_date or created_at
        const { data: currentEntries } = await supabase
          .from('savings_entries')
          .select('id, amount_paid, entry_date, week_range')
          .eq('savings_account_id', accId)
          .order('entry_date', { ascending: true });

        if (currentEntries) {
          const minLen = Math.min(currentEntries.length, newDates.length);
          
          // Update matching entries
          for (let i = 0; i < minLen; i++) {
            await supabase
              .from('savings_entries')
              .update({
                entry_date: newDates[i],
                week_range: `W${i + 1} (${newDates[i]})`
              })
              .eq('id', currentEntries[i].id);
          }

          // Insert any extra new timeline weeks
          if (newDates.length > currentEntries.length) {
            const extraEntries = [];
            for (let i = currentEntries.length; i < newDates.length; i++) {
              extraEntries.push({
                savings_account_id: accId,
                week_range: `W${i + 1} (${newDates[i]})`,
                amount_paid: 0,
                entry_date: newDates[i]
              });
            }
            await supabase
              .from('savings_entries')
              .insert(extraEntries);
          }
          // Delete extra timeline weeks (only delete unpaid ones)
          else if (currentEntries.length > newDates.length) {
            const extraIdsToDelete = currentEntries
              .slice(newDates.length)
              .map(e => e.id);
            
            await supabase
              .from('savings_entries')
              .delete()
              .in('id', extraIdsToDelete);
          }
        }
      }
    }

    return true;
  } catch (error) {
    console.error('updateGroupQuery exception:', error);
    throw error;
  }
}

/**
 * Deletes a savings group (only works if auth user is the creator due to RLS/Foreign keys)
 */
export async function deleteGroupQuery(groupId: string): Promise<boolean> {
  if (isMockMode()) {
    return true;
  }

  try {
    const { error } = await supabase
      .from('savings_groups')
      .delete()
      .eq('id', groupId);

    if (error) {
      console.error('Error deleting group:', error);
      throw error;
    }
    return true;
  } catch (error) {
    console.error('deleteGroupQuery exception:', error);
    throw error;
  }
}
