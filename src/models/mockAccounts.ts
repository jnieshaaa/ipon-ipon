export interface SavingsEntry {
  id: string;
  weekRange: string;
  amountPaid: number;
  date: string;
}

export interface Account {
  id: string;
  name: string;
  uniqueId: string;
  totalSavings: number;
  entries: SavingsEntry[];
  accountsCount?: number;
  userId?: string;
}

export interface UserAccount {
  id: string;
  email: string;
  password: string;
  name: string;
  userId: string; // Links to which set of accounts this user manages
}

// Different sets of accounts for different users
const STORAGE_KEY = 'ipon_user_accounts';

export function generateUniqueCode(existingIds: Set<string>): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  do {
    code = "";
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  } while (existingIds.has(code));
  return code;
}

export function generateGroupCode(existingIds: Set<string>): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  do {
    code = "";
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  } while (existingIds.has(code));
  return code;
}

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

export function getAccountsMapFromStorage(): Record<string, Account[]> {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      // Force regeneration if cache is using old 10-week mock timelines or hyphenated IDs
      const keys = Object.keys(parsed);
      const isStale = keys.some(key => parsed[key].some((acc: any) => 
        !acc.entries || 
        acc.entries.length < 15 ||
        (acc.uniqueId && (acc.uniqueId.includes('-') || acc.uniqueId.length !== 8))
      ));
      if (!isStale) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Error parsing user accounts map from storage:', e);
  }

  // Generate dynamically based on active group settings
  let dueDay = "Sunday";
  let year = "2026";
  let weeklyAmount = 1000;
  try {
    const storedDueDay = localStorage.getItem('ipon_selected_group_due_day');
    if (storedDueDay) dueDay = storedDueDay;
    const storedYear = localStorage.getItem('ipon_selected_group_year');
    if (storedYear) year = storedYear;
    const storedAmount = localStorage.getItem('ipon_selected_group_weekly_amount');
    if (storedAmount) weeklyAmount = parseFloat(storedAmount);
  } catch (e) {}

  const dates = getDatesForWeekdayInYear(year, dueDay);

  const u1: Account[] = [
    {
      id: "1",
      name: "Maria Santos",
      uniqueId: "MS92K4B7",
      totalSavings: weeklyAmount * 1 * 5,
      accountsCount: 1,
      entries: dates.map((dateStr, idx) => ({
        id: `week_1_${idx + 1}_${Math.random().toString(36).substr(2, 4)}`,
        weekRange: `W${idx + 1}`,
        amountPaid: idx < 5 ? (weeklyAmount * 1) : 0,
        date: dateStr
      }))
    },
    {
      id: "2",
      name: "Juan dela Cruz",
      uniqueId: "JC3H9F1Z",
      totalSavings: weeklyAmount * 2 * 9,
      accountsCount: 2,
      entries: dates.map((dateStr, idx) => ({
        id: `week_2_${idx + 1}_${Math.random().toString(36).substr(2, 4)}`,
        weekRange: `W${idx + 1}`,
        amountPaid: idx < 9 ? (weeklyAmount * 2) : 0,
        date: dateStr
      }))
    },
    {
      id: "3",
      name: "Ana Reyes",
      uniqueId: "AR8X2P5D",
      totalSavings: weeklyAmount * 1 * 9,
      accountsCount: 1,
      entries: dates.map((dateStr, idx) => ({
        id: `week_3_${idx + 1}_${Math.random().toString(36).substr(2, 4)}`,
        weekRange: `W${idx + 1}`,
        amountPaid: idx < 9 ? (weeklyAmount * 1) : 0,
        date: dateStr
      }))
    }
  ];

  const u2: Account[] = [
    {
      id: "1",
      name: "Pedro Garcia",
      uniqueId: "PG7M3L9Y",
      totalSavings: weeklyAmount * 1 * 9,
      accountsCount: 1,
      entries: dates.map((dateStr, idx) => ({
        id: `week_p1_${idx + 1}_${Math.random().toString(36).substr(2, 4)}`,
        weekRange: `W${idx + 1}`,
        amountPaid: idx < 9 ? (weeklyAmount * 1) : 0,
        date: dateStr
      }))
    },
    {
      id: "2",
      name: "Rosa Martinez",
      uniqueId: "RM4N8Q2W",
      totalSavings: weeklyAmount * 1 * 8,
      accountsCount: 1,
      entries: dates.map((dateStr, idx) => ({
        id: `week_p2_${idx + 1}_${Math.random().toString(36).substr(2, 4)}`,
        weekRange: `W${idx + 1}`,
        amountPaid: idx < 8 ? (weeklyAmount * 1) : 0,
        date: dateStr
      }))
    }
  ];

  const u3: Account[] = [
    {
      id: "1",
      name: "Carlos Lopez",
      uniqueId: "CL5T9K3X",
      totalSavings: weeklyAmount * 1 * 10,
      accountsCount: 1,
      entries: dates.map((dateStr, idx) => ({
        id: `week_c1_${idx + 1}_${Math.random().toString(36).substr(2, 4)}`,
        weekRange: `W${idx + 1}`,
        amountPaid: idx < 10 ? (weeklyAmount * 1) : 0,
        date: dateStr
      }))
    }
  ];

  const seededMap = {
    "user-1": u1,
    "user-2": u2,
    "user-3": u3
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seededMap));
  } catch (e) {
    console.error('Error seeding user accounts:', e);
  }
  return seededMap;
}

// User accounts with login credentials
export const mockUsers: UserAccount[] = [
  {
    id: "user-1",
    email: "junie@gmail.com",
    password: "123123",
    name: "Junie Antopina",
    userId: "user-1",
  },
  {
    id: "user-2",
    email: "junessa@gmail.com",
    password: "123123",
    name: "Junessa Antopina",
    userId: "user-2",
  },
  {
    id: "user-3",
    email: "jenelyn@gmail.com",
    password: "123123",
    name: "Jenelyn Antopina",
    userId: "user-3",
  },
];


// Helper function to get accounts for a user
export function getAccountsForUser(userId: string): Account[] {
  const map = getAccountsMapFromStorage();
  if (!map[userId]) {
    map[userId] = [];
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    } catch (e) {}
  }
  return map[userId];
}

/**
 * Add a new person/saver to storage for a specific user
 */
export function addPersonToStorage(userId: string, name: string, accountsCount: number): Account {
  const map = getAccountsMapFromStorage();
  if (!map[userId]) {
    map[userId] = [];
  }

  // Get selected group settings
  let dueDay = "Sunday";
  let year = "2026";
  let startDate = "";
  let endDate = "";
  try {
    const storedDueDay = localStorage.getItem('ipon_selected_group_due_day');
    if (storedDueDay) dueDay = storedDueDay;
    const storedYear = localStorage.getItem('ipon_selected_group_year');
    if (storedYear) year = storedYear;
    const storedStart = localStorage.getItem('ipon_selected_group_start_date');
    if (storedStart) startDate = storedStart;
    const storedEnd = localStorage.getItem('ipon_selected_group_end_date');
    if (storedEnd) endDate = storedEnd;
  } catch (e) {}

  // Generate all weekly dates for this dueDay in this year
  const dates = getDatesForWeekdayInYear(year, dueDay, startDate, endDate);

  const entries: SavingsEntry[] = dates.map((dateStr, idx) => {
    return {
      id: `week_${idx + 1}_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      weekRange: `W${idx + 1}`,
      amountPaid: 0,
      date: dateStr
    };
  });

  // Gather all existing uniqueIds to avoid collisions
  const existingIds = new Set<string>();
  Object.keys(map).forEach(uId => {
    map[uId].forEach(acc => {
      if (acc.uniqueId) existingIds.add(acc.uniqueId);
    });
  });

  const uniqueCode = generateUniqueCode(existingIds);
  
  const newAccount: Account = {
    id: `acc_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    name: name.trim(),
    uniqueId: uniqueCode,
    totalSavings: 0,
    entries: entries,
    accountsCount: accountsCount
  };

  map[userId].push(newAccount);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch (e) {
    console.error('Failed to save user accounts map after addition:', e);
  }
  return newAccount;
}

/**
 * Record savings payment for a specific week entry
 */
export function recordSavingsPayment(userId: string, personId: string, entryId: string, amount: number): void {
  const map = getAccountsMapFromStorage();
  const userAccs = map[userId] || [];
  const account = userAccs.find(acc => acc.id === personId);

  if (account) {
    const entry = account.entries.find(e => e.id === entryId);
    if (entry) {
      const oldAmount = entry.amountPaid || 0;
      entry.amountPaid = amount;
      account.totalSavings = account.totalSavings - oldAmount + amount;
      
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
      } catch (e) {
        console.error('Failed to save savings payment record:', e);
      }
    }
  }
}

// Legacy export for backwards compatibility
export const mockAccounts: Account[] = getAccountsForUser("user-1");

export interface PaymentHistoryEntry {
  id: string;
  amount: number;
  date: string;
  type: 'principal' | 'interest';
}

export interface Loan {
  id: string;
  borrowedAmount: number;
  borrowDate: string;
  interestType: 'percentage' | 'fixed';
  interestRate: number;
  interestFrequency: 'weekly' | 'monthly';
  totalPaid: number;
  status: 'active' | 'paid';
  principalPaid?: number;
  interestPaid?: number;
  paymentHistory?: PaymentHistoryEntry[];
}

export interface Borrower {
  id: string;
  name: string;
  uniqueId: string;
  loans: Loan[];
}

const defaultBorrowersData = [
  {
    id: '1',
    name: 'Pedro Garcia',
    uniqueId: 'PG7M3L9Y',
    borrowedAmount: 10000,
    borrowDate: '2025-10-15',
    interestType: 'percentage' as const,
    interestRate: 5,
    interestFrequency: 'monthly' as const,
    totalPaid: 2000,
    status: 'active' as const,
  },
  {
    id: '2',
    name: 'Rosa Martinez',
    uniqueId: 'RM4N8Q2W',
    borrowedAmount: 5000,
    borrowDate: '2025-11-01',
    interestType: 'percentage' as const,
    interestRate: 5,
    interestFrequency: 'monthly' as const,
    totalPaid: 5000,
    status: 'paid' as const,
  },
  {
    id: '3',
    name: 'Carlos Lopez',
    uniqueId: 'CL5T9K3X',
    borrowedAmount: 15000,
    borrowDate: '2025-11-20',
    interestType: 'percentage' as const,
    interestRate: 5,
    interestFrequency: 'monthly' as const,
    totalPaid: 0,
    status: 'active' as const,
  }
];

const LOANS_STORAGE_KEY = 'ipon_borrowers';

export function calculateLoanInterest(loan: Loan) {
  if (loan.borrowedAmount === 0) {
    return { periodsPassed: 0, interest: 0 };
  }
  const start = new Date(loan.borrowDate);
  const now = new Date();
  
  // Diff in milliseconds
  const diffTime = Math.max(0, now.getTime() - start.getTime());
  
  // Choose time constants
  const isWeekly = loan.interestFrequency === 'weekly';
  const msPerPeriod = isWeekly ? (1000 * 60 * 60 * 24 * 7) : (1000 * 60 * 60 * 24 * 30.44);
  
  let periodsPassed = Math.floor(diffTime / msPerPeriod);
  if (periodsPassed === 0 && diffTime > 0) {
    periodsPassed = 1;
  }
  
  let interest = 0;
  const isFixed = loan.interestType === 'fixed';
  
  if (isFixed) {
    interest = Math.round(loan.interestRate * periodsPassed);
  } else {
    interest = Math.round(loan.borrowedAmount * (loan.interestRate / 100) * periodsPassed);
  }
  
  return { periodsPassed, interest };
}

export function calculateBorrowerInterest(borrower: Borrower) {
  let totalInterest = 0;
  if (!borrower.loans || borrower.loans.length === 0) {
    return { periodsPassed: 0, interest: 0 };
  }
  
  borrower.loans.forEach(loan => {
    const { interest } = calculateLoanInterest(loan);
    totalInterest += interest;
  });
  
  return { periodsPassed: 1, interest: totalInterest };
}

export function getBorrowersFromStorage(): Borrower[] {
  try {
    const data = localStorage.getItem(LOANS_STORAGE_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      let migrated = false;
      const updated = parsed.map((b: any) => {
        if (!b.loans) {
          migrated = true;
          const defaultLoan: Loan = {
            id: `loan_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            borrowedAmount: b.borrowedAmount || 0,
            borrowDate: b.borrowDate || new Date().toISOString().split('T')[0],
            interestType: b.interestType || 'percentage',
            interestRate: b.interestRate || 5,
            interestFrequency: b.interestFrequency || 'monthly',
            totalPaid: b.totalPaid || 0,
            status: b.status || 'active'
          };
          return {
            id: b.id,
            name: b.name,
            uniqueId: b.uniqueId,
            loans: [defaultLoan]
          };
        }
        return b;
      });
      if (migrated) {
        localStorage.setItem(LOANS_STORAGE_KEY, JSON.stringify(updated));
      }
      return updated;
    }
  } catch (e) {
    console.error('Error reading borrowers from storage:', e);
  }
  
  // Seed default data wrapped in loans arrays
  const seeded: Borrower[] = defaultBorrowersData.map(b => {
    const defaultLoan: Loan = {
      id: `loan_${b.id}_1`,
      borrowedAmount: b.borrowedAmount,
      borrowDate: b.borrowDate,
      interestType: b.interestType,
      interestRate: b.interestRate,
      interestFrequency: b.interestFrequency,
      totalPaid: b.totalPaid,
      status: b.status
    };
    return {
      id: b.id,
      name: b.name,
      uniqueId: b.uniqueId,
      loans: [defaultLoan]
    };
  });

  try {
    localStorage.setItem(LOANS_STORAGE_KEY, JSON.stringify(seeded));
  } catch (e) {}
  return seeded;
}

export function saveBorrowersToStorage(borrowers: Borrower[]): void {
  try {
    localStorage.setItem(LOANS_STORAGE_KEY, JSON.stringify(borrowers));
  } catch (e) {
    console.error('Error writing borrowers to storage:', e);
  }
}

export function recordStructuredLoanPayment(
  borrowerId: string,
  loanId: string,
  amount: number,
  type: 'principal' | 'interest',
  paymentDate?: string
): Borrower | null {
  const borrowers = getBorrowersFromStorage();
  const borrower = borrowers.find(b => b.id === borrowerId);
  if (borrower) {
    const loan = borrower.loans.find(l => l.id === loanId);
    if (loan) {
      // Migrate if needed
      if (loan.principalPaid === undefined || loan.interestPaid === undefined) {
        const principal = Math.min(loan.totalPaid, loan.borrowedAmount);
        loan.principalPaid = principal;
        loan.interestPaid = Math.max(0, loan.totalPaid - principal);
      }
      if (!loan.paymentHistory) {
        loan.paymentHistory = [];
        if (loan.totalPaid > 0) {
          loan.paymentHistory.push({
            id: `pay_init_${loan.id}`,
            amount: loan.totalPaid,
            date: loan.borrowDate,
            type: 'principal'
          });
        }
      }

      // Record new payment
      if (type === 'principal') {
        loan.principalPaid = (loan.principalPaid || 0) + amount;
      } else {
        loan.interestPaid = (loan.interestPaid || 0) + amount;
      }
      
      loan.totalPaid = (loan.principalPaid || 0) + (loan.interestPaid || 0);

      // Record to history
      const actualDate = paymentDate || new Date().toISOString().split('T')[0];
      loan.paymentHistory.push({
        id: `pay_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        amount: amount,
        date: actualDate,
        type: type
      });

      // Calculate if paid off
      const { interest } = calculateLoanInterest(loan);
      const remainingPrincipal = Math.max(0, loan.borrowedAmount - (loan.principalPaid || 0));
      const remainingInterest = Math.max(0, interest - (loan.interestPaid || 0));
      
      if (remainingPrincipal <= 0 && remainingInterest <= 0) {
        loan.status = 'paid';
      } else {
        loan.status = 'active';
      }

      saveBorrowersToStorage(borrowers);
      return borrower;
    }
  }
  return null;
}

export function addLoanToBorrowerInStorage(
  borrowerId: string,
  amount: number,
  interestType: 'percentage' | 'fixed',
  interestRate: number,
  interestFrequency: 'weekly' | 'monthly',
  borrowDate: string
): Borrower | null {
  const borrowers = getBorrowersFromStorage();
  const borrower = borrowers.find(b => b.id === borrowerId);
  if (borrower) {
    const newLoan: Loan = {
      id: `loan_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      borrowedAmount: amount,
      borrowDate: borrowDate,
      interestType: interestType,
      interestRate: interestRate,
      interestFrequency: interestFrequency,
      totalPaid: 0,
      status: 'active'
    };
    if (!borrower.loans) borrower.loans = [];
    borrower.loans.push(newLoan);
    saveBorrowersToStorage(borrowers);
    return borrower;
  }
  return null;
}

export function addBorrowerToStorage(
  name: string,
  amount: number,
  interestRate: number,
  borrowDate: string,
  isMember: boolean,
  memberUniqueId?: string
): Borrower {
  const borrowers = getBorrowersFromStorage();
  
  let uniqueId = "";
  if (isMember && memberUniqueId) {
    uniqueId = memberUniqueId;
  } else {
    // Generate new unique 8-character alphanumeric code for outsider
    const existingIds = new Set<string>();
    borrowers.forEach(b => existingIds.add(b.uniqueId));
    
    // Also gather from savers map to avoid conflicts
    const saversMap = getAccountsMapFromStorage();
    Object.keys(saversMap).forEach(uId => {
      saversMap[uId].forEach(acc => {
        if (acc.uniqueId) existingIds.add(acc.uniqueId);
      });
    });
    
    uniqueId = generateUniqueCode(existingIds);
  }

  const newBorrower: Borrower = {
    id: `bor_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    name: name.trim(),
    uniqueId: uniqueId,
    loans: [] // Initialize with empty loans ledger
  };

  borrowers.push(newBorrower);
  saveBorrowersToStorage(borrowers);
  return newBorrower;
}
export interface SavingsGroup {
  id: string;
  name: string;
  year: string;
  weeklyAmount: number;
  dueDay: string;
  creatorId: string;
  members: string[]; // User IDs (emails or account IDs) of joined members
  memberInterestRate?: number;
  nonMemberInterestRate?: number;
  startDate?: string;
  endDate?: string;
}

const defaultGroups: SavingsGroup[] = [
  {
    id: 'MGH92K',
    name: 'Manggahan Savings Association',
    year: '2026',
    weeklyAmount: 1000,
    dueDay: 'Sunday',
    creatorId: 'user-1', // Junie Antopina
    members: ['user-1', 'user-2', 'user-3', 'junie@gmail.com', 'junessa@gmail.com', 'jenelyn@gmail.com'],
    memberInterestRate: 5,
    nonMemberInterestRate: 10
  }
];

const GROUPS_STORAGE_KEY = 'ipon_savings_groups';

export function getGroupsFromStorage(): SavingsGroup[] {
  try {
    const data = localStorage.getItem(GROUPS_STORAGE_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      // Force regeneration if cache uses old hyphenated IDs
      const isStale = parsed.some((g: any) => g.id && (g.id.includes('-') || g.id.length !== 6));
      if (!isStale) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Error reading savings groups from storage:', e);
  }
  
  try {
    localStorage.setItem(GROUPS_STORAGE_KEY, JSON.stringify(defaultGroups));
  } catch (e) {}
  return defaultGroups;
}

export function createGroupInStorage(
  name: string,
  year: string,
  weeklyAmount: number,
  dueDay: string,
  creatorId: string,
  startDate?: string,
  endDate?: string
): SavingsGroup {
  const groups = getGroupsFromStorage();
  
  // Gather all existing group IDs to avoid collisions
  const existingIds = new Set<string>();
  groups.forEach(g => {
    if (g.id) existingIds.add(g.id);
  });

  const newId = generateGroupCode(existingIds);
 
  const newGroup: SavingsGroup = {
    id: newId,
    name: name.trim(),
    year: year,
    weeklyAmount: weeklyAmount,
    dueDay: dueDay,
    creatorId: creatorId,
    members: [creatorId],
    memberInterestRate: 5,
    nonMemberInterestRate: 10,
    startDate: startDate,
    endDate: endDate
  };

  groups.push(newGroup);
  try {
    localStorage.setItem(GROUPS_STORAGE_KEY, JSON.stringify(groups));
  } catch (e) {
    console.error('Error saving created group:', e);
  }
  return newGroup;
}

export function joinGroupInStorage(groupId: string, userId: string): SavingsGroup | null {
  const groups = getGroupsFromStorage();
  const group = groups.find(g => g.id.toLowerCase() === groupId.trim().toLowerCase());
  
  if (group) {
    if (!group.members.includes(userId)) {
      group.members.push(userId);
      try {
        localStorage.setItem(GROUPS_STORAGE_KEY, JSON.stringify(groups));
      } catch (e) {
        console.error('Error saving joined group:', e);
      }
    }
    return group;
  }
  return null;
}

export function getGroupsForUser(userId: string): SavingsGroup[] {
  const groups = getGroupsFromStorage();
  return groups.filter(g => g.creatorId === userId || g.members.includes(userId));
}
