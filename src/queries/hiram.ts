import { supabase } from '../lib/supabase';
import { Borrower, Loan, getBorrowersFromStorage, addBorrowerToStorage, recordStructuredLoanPayment, calculateLoanInterest, addLoanToBorrowerInStorage } from '../models/mockAccounts';

// Check if we are running in database-free mock mode
const isMockMode = (): boolean => {
  return import.meta.env.VITE_USE_MOCK === 'true' || 
         !import.meta.env.VITE_SUPABASE_URL || 
         !import.meta.env.VITE_SUPABASE_ANON_KEY;
};

/**
 * Fetch all borrowers and their loan details for a group
 */
export async function getBorrowersQuery(groupId: string): Promise<Borrower[]> {
  if (isMockMode()) {
    return getBorrowersFromStorage();
  }

  try {
    const { data: borrowersList, error: fetchError } = await supabase
      .from('borrowers')
      .select(`
        id,
        name,
        unique_id,
        user_id,
        borrowed_amount,
        borrow_date,
        interest_rate,
        interest_type,
        interest_frequency,
        total_paid,
        status,
        payments:loan_payments (
          id,
          amount,
          payment_date,
          notes
        )
      `)
      .eq('group_id', groupId);

    if (fetchError) {
      console.error('Error fetching borrowers:', fetchError);
      throw fetchError;
    }

    if (!borrowersList) return [];

    // Group borrowers by unique_id (or name) to compile all loans for the same borrower
    const borrowersMap = new Map<string, Borrower>();

    for (const b of borrowersList) {
      const uniqueKey = b.unique_id || b.name;
      
      const paymentsMapped = (b.payments || []).map((p: any) => ({
        id: p.id,
        amount: Number(p.amount),
        date: p.payment_date,
        notes: p.notes || '',
        type: (p.notes && p.notes.includes('interest')) ? 'interest' as const : 'principal' as const
      }));

      const loan: Loan = {
        id: b.id, // Use borrower record ID as loan ID
        borrowedAmount: Number(b.borrowed_amount),
        borrowDate: b.borrow_date,
        interestType: (b.interest_type as 'percentage' | 'fixed') || 'percentage',
        interestRate: Number(b.interest_rate || 5),
        interestFrequency: (b.interest_frequency as 'weekly' | 'monthly') || 'monthly',
        totalPaid: Number(b.total_paid || 0),
        status: b.status as 'active' | 'paid',
        paymentHistory: paymentsMapped
      };

      if (borrowersMap.has(uniqueKey)) {
        const existing = borrowersMap.get(uniqueKey)!;
        existing.loans.push(loan);
      } else {
        borrowersMap.set(uniqueKey, {
          id: b.id,
          name: b.name,
          uniqueId: b.unique_id,
          loans: [loan]
        });
      }
    }

    return Array.from(borrowersMap.values());
  } catch (error) {
    console.error('getBorrowersQuery exception:', error);
    throw error;
  }
}

/**
 * Add a new loan borrower to the group ledger
 */
export async function addBorrowerQuery(
  groupId: string,
  name: string,
  uniqueId: string,
  borrowedAmount: number,
  interestRate: number = 5,
  userId: string | null = null
): Promise<void> {
  if (isMockMode()) {
    addBorrowerToStorage(name, borrowedAmount, interestRate, new Date().toISOString().split('T')[0], userId !== null, uniqueId);
    return;
  }

  try {
    const { error } = await supabase
      .from('borrowers')
      .insert({
        group_id: groupId,
        name: name.trim(),
        unique_id: uniqueId,
        borrowed_amount: borrowedAmount,
        interest_rate: interestRate,
        borrow_date: new Date().toISOString().split('T')[0],
        total_paid: 0,
        status: 'active',
        user_id: userId || null
      });

    if (error) {
      console.error('Error inserting borrower:', error);
      throw error;
    }
  } catch (error) {
    console.error('addBorrowerQuery exception:', error);
    throw error;
  }
}

/**
 * Record a payment on an active loan borrower record
 */
export async function recordLoanPaymentQuery(
  borrowerId: string,
  loanId: string, // borrower table primary key
  amount: number,
  paymentType: 'interest' | 'principal',
  paymentDate: string
): Promise<void> {
  if (isMockMode()) {
    recordStructuredLoanPayment(borrowerId, loanId, amount, paymentType === 'interest' ? 'interest' : 'principal', paymentDate);
    return;
  }

  try {
    // 1. Insert payment record into loan_payments
    const { error: paymentError } = await supabase
      .from('loan_payments')
      .insert({
        borrower_id: loanId,
        amount: amount,
        payment_date: paymentDate,
        notes: `Payment type: ${paymentType}`
      });

    if (paymentError) {
      console.error('Error inserting loan payment:', paymentError);
      throw paymentError;
    }

    // 2. Fetch current loan details to calculate new total paid
    const { data: borrowerRow, error: getError } = await supabase
      .from('borrowers')
      .select('borrowed_amount, interest_rate, total_paid, borrow_date')
      .eq('id', loanId)
      .single();

    if (getError || !borrowerRow) {
      throw getError || new Error("Borrower record not found");
    }

    const currentPaid = Number(borrowerRow.total_paid || 0);
    const newPaid = currentPaid + amount;

    // Evaluate new loan status (if newPaid >= principal + accrued interest, it's paid)
    const mockLoan = {
      id: loanId,
      borrowedAmount: Number(borrowerRow.borrowed_amount),
      borrowDate: borrowerRow.borrow_date,
      interestType: 'percentage' as const,
      interestRate: Number(borrowerRow.interest_rate || 5),
      interestFrequency: 'monthly' as const,
      totalPaid: newPaid,
      status: 'active' as const
    };
    const { interest } = calculateLoanInterest(mockLoan);
    const totalDue = mockLoan.borrowedAmount + interest;

    const status = newPaid >= totalDue ? 'paid' : 'active';

    // 3. Update the borrower record total_paid and status
    const { error: updateError } = await supabase
      .from('borrowers')
      .update({ 
        total_paid: newPaid,
        status: status
      })
      .eq('id', loanId);

    if (updateError) {
      console.error('Error updating borrower status:', updateError);
      throw updateError;
    }
  } catch (error) {
    console.error('recordLoanPaymentQuery exception:', error);
    throw error;
  }
}

/**
 * Add a new loan under an existing borrower card profile grouping
 */
export async function addLoanToBorrowerQuery(
  borrowerId: string,
  amount: number,
  interestRate: number,
  interestType: 'percentage' | 'fixed',
  interestFrequency: 'weekly' | 'monthly',
  borrowDate: string
): Promise<void> {
  if (isMockMode()) {
    addLoanToBorrowerInStorage(borrowerId, amount, interestType, interestRate, interestFrequency, borrowDate);
    return;
  }

  try {
    // 1. Fetch the representative borrower record to copy user/group associations
    const { data: rep, error: repError } = await supabase
      .from('borrowers')
      .select('name, unique_id, group_id, user_id')
      .eq('id', borrowerId)
      .single();

    if (repError || !rep) {
      console.error('Error fetching representative borrower info:', repError);
      throw repError || new Error("Borrower record not found.");
    }

    // 2. Insert new borrower loan row with status active
    const { error } = await supabase
      .from('borrowers')
      .insert({
        group_id: rep.group_id,
        name: rep.name,
        unique_id: rep.unique_id,
        user_id: rep.user_id || null,
        borrowed_amount: amount,
        interest_rate: interestRate,
        interest_type: interestType,
        interest_frequency: interestFrequency,
        borrow_date: borrowDate,
        total_paid: 0,
        status: 'active'
      });

    if (error) {
      console.error('Error adding loan to borrower:', error);
      throw error;
    }
  } catch (error) {
    console.error('addLoanToBorrowerQuery exception:', error);
    throw error;
  }
}

/**
 * Delete a specific loan record
 */
export async function deleteLoanQuery(loanId: string): Promise<void> {
  if (isMockMode()) {
    return; // No-op in mock
  }

  try {
    const { error } = await supabase
      .from('borrowers')
      .delete()
      .eq('id', loanId);

    if (error) {
      console.error('Error deleting loan:', error);
      throw error;
    }
  } catch (error) {
    console.error('deleteLoanQuery exception:', error);
    throw error;
  }
}

/**
 * Update details of an existing loan record
 */
export async function updateLoanQuery(
  loanId: string,
  amount: number,
  interestRate: number,
  interestType: 'percentage' | 'fixed',
  interestFrequency: 'weekly' | 'monthly',
  borrowDate: string
): Promise<void> {
  if (isMockMode()) {
    return; // No-op in mock
  }

  try {
    // 1. Fetch current total paid to re-calculate status
    const { data: current, error: fetchErr } = await supabase
      .from('borrowers')
      .select('total_paid')
      .eq('id', loanId)
      .single();

    if (fetchErr || !current) throw fetchErr || new Error("Borrower record not found");

    const totalPaid = Number(current.total_paid || 0);

    // Evaluate status using calculateLoanInterest helper
    const mockLoan = {
      id: loanId,
      borrowedAmount: amount,
      borrowDate: borrowDate,
      interestType: 'percentage' as const,
      interestRate: interestRate,
      interestFrequency: 'monthly' as const,
      totalPaid: totalPaid,
      status: 'active' as const
    };
    const { interest } = calculateLoanInterest(mockLoan);
    const totalDue = amount + interest;

    const status = totalPaid >= totalDue ? 'paid' : 'active';

    // 2. Update the row in borrowers table
    const { error } = await supabase
      .from('borrowers')
      .update({
        borrowed_amount: amount,
        interest_rate: interestRate,
        interest_type: interestType,
        interest_frequency: interestFrequency,
        borrow_date: borrowDate,
        status: status
      })
      .eq('id', loanId);

    if (error) {
      console.error('Error updating loan details:', error);
      throw error;
    }
  } catch (error) {
    console.error('updateLoanQuery exception:', error);
    throw error;
  }
}
