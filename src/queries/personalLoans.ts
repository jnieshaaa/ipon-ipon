import { supabase } from '../lib/supabase';

export interface IPersonalLoan {
  id: string;
  userId: string;
  borrowerName: string;
  amount: number;
  interestRate: number;
  borrowDate: string;
  notes?: string;
  status: 'active' | 'paid';
  type: 'lent' | 'borrowed';
  createdAt?: string;
  updatedAt?: string;
  totalPaid?: number; // Calculated field
  payments?: IPersonalLoanPayment[];
}

export interface IPersonalLoanPayment {
  id: string;
  personalLoanId: string;
  amount: number;
  paymentDate: string;
  notes?: string;
  createdAt?: string;
}

const isMockMode = (): boolean => {
  return import.meta.env.VITE_USE_MOCK === 'true' || 
         !import.meta.env.VITE_SUPABASE_URL || 
         !import.meta.env.VITE_SUPABASE_ANON_KEY;
};

// Helper to get/set mock storage
function getMockLoans(): IPersonalLoan[] {
  try {
    const data = localStorage.getItem('ipon_mock_personal_loans');
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
}

function saveMockLoans(loans: IPersonalLoan[]) {
  localStorage.setItem('ipon_mock_personal_loans', JSON.stringify(loans));
}

function getMockPayments(): IPersonalLoanPayment[] {
  try {
    const data = localStorage.getItem('ipon_mock_personal_loan_payments');
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
}

function saveMockPayments(payments: IPersonalLoanPayment[]) {
  localStorage.setItem('ipon_mock_personal_loan_payments', JSON.stringify(payments));
}

// Fetch all personal loans for the user
export async function getPersonalLoansQuery(userId: string): Promise<IPersonalLoan[]> {
  if (isMockMode()) {
    const loans = getMockLoans().filter(l => l.userId === userId);
    const payments = getMockPayments();
    
    return loans.map(loan => {
      const loanPayments = payments.filter(p => p.personalLoanId === loan.id);
      const totalPaid = loanPayments.reduce((sum, p) => sum + p.amount, 0);
      return {
        ...loan,
        type: loan.type || 'lent',
        totalPaid,
        payments: loanPayments
      };
    });
  }

  try {
    // Try to query Supabase
    const { data: loans, error: loansError } = await supabase
      .from('personal_loans')
      .select('*')
      .eq('user_id', userId)
      .order('borrow_date', { ascending: false });

    if (loansError) throw loansError;

    const { data: payments, error: paymentsError } = await supabase
      .from('personal_loan_payments')
      .select('*');

    if (paymentsError) throw paymentsError;

    return (loans || []).map(l => {
      const loanPayments = (payments || [])
        .filter(p => p.personal_loan_id === l.id)
        .map(p => ({
          id: p.id,
          personalLoanId: p.personal_loan_id,
          amount: Number(p.amount),
          paymentDate: p.payment_date,
          notes: p.notes,
          createdAt: p.created_at
        }));
      
      const totalPaid = loanPayments.reduce((sum, p) => sum + p.amount, 0);
      const amount = Number(l.amount);

      return {
        id: l.id,
        userId: l.user_id,
        borrowerName: l.borrower_name,
        amount,
        interestRate: Number(l.interest_rate || 0),
        borrowDate: l.borrow_date,
        notes: l.notes,
        status: l.status,
        type: l.type || 'lent',
        createdAt: l.created_at,
        updatedAt: l.updated_at,
        totalPaid,
        payments: loanPayments
      };
    });
  } catch (error) {
    console.warn('Supabase query failed for personal loans. Falling back to LocalStorage.', error);
    const loans = getMockLoans().filter(l => l.userId === userId);
    const payments = getMockPayments();
    
    return loans.map(loan => {
      const loanPayments = payments.filter(p => p.personalLoanId === loan.id);
      const totalPaid = loanPayments.reduce((sum, p) => sum + p.amount, 0);
      return {
        ...loan,
        type: loan.type || 'lent',
        totalPaid,
        payments: loanPayments
      };
    });
  }
}

export async function createPersonalLoanQuery(input: {
  userId: string;
  borrowerName: string;
  amount: number;
  interestRate: number;
  borrowDate: string;
  notes?: string;
  type: 'lent' | 'borrowed';
}): Promise<IPersonalLoan> {
  const newLoan: IPersonalLoan = {
    id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15),
    userId: input.userId,
    borrowerName: input.borrowerName,
    amount: input.amount,
    interestRate: input.interestRate,
    borrowDate: input.borrowDate,
    notes: input.notes,
    status: 'active',
    type: input.type,
    totalPaid: 0,
    payments: []
  };

  if (isMockMode()) {
    const loans = getMockLoans();
    loans.push(newLoan);
    saveMockLoans(loans);
    return newLoan;
  }

  try {
    const { data, error } = await supabase
      .from('personal_loans')
      .insert({
        user_id: input.userId,
        borrower_name: input.borrowerName,
        amount: input.amount,
        interest_rate: input.interestRate,
        borrow_date: input.borrowDate,
        notes: input.notes,
        status: 'active',
        type: input.type
      })
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      userId: data.user_id,
      borrowerName: data.borrower_name,
      amount: Number(data.amount),
      interestRate: Number(data.interest_rate || 0),
      borrowDate: data.borrow_date,
      notes: data.notes,
      status: data.status,
      type: data.type || 'lent',
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      totalPaid: 0,
      payments: []
    };
  } catch (error) {
    console.warn('Supabase insert failed. Falling back to LocalStorage.', error);
    const loans = getMockLoans();
    loans.push(newLoan);
    saveMockLoans(loans);
    return newLoan;
  }
}

// Record a payment for a personal loan
export async function recordPersonalLoanPaymentQuery(input: {
  personalLoanId: string;
  amount: number;
  paymentDate: string;
  notes?: string;
}): Promise<IPersonalLoanPayment> {
  const newPayment: IPersonalLoanPayment = {
    id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15),
    personalLoanId: input.personalLoanId,
    amount: input.amount,
    paymentDate: input.paymentDate,
    notes: input.notes,
    createdAt: new Date().toISOString()
  };

  if (isMockMode()) {
    const payments = getMockPayments();
    payments.push(newPayment);
    saveMockPayments(payments);

    // Update status if fully paid
    const loans = getMockLoans();
    const loanIndex = loans.findIndex(l => l.id === input.personalLoanId);
    if (loanIndex !== -1) {
      const loan = loans[loanIndex];
      const loanPayments = payments.filter(p => p.personalLoanId === loan.id);
      const totalPaid = loanPayments.reduce((sum, p) => sum + p.amount, 0);
      if (totalPaid >= loan.amount) {
        loan.status = 'paid';
      }
      saveMockLoans(loans);
    }

    return newPayment;
  }

  try {
    const { data, error } = await supabase
      .from('personal_loan_payments')
      .insert({
        personal_loan_id: input.personalLoanId,
        amount: input.amount,
        payment_date: input.paymentDate,
        notes: input.notes
      })
      .select()
      .single();

    if (error) throw error;

    // Check if we need to update the status to paid
    const { data: loanData, error: fetchError } = await supabase
      .from('personal_loans')
      .select('amount')
      .eq('id', input.personalLoanId)
      .single();

    if (!fetchError && loanData) {
      const { data: allPayments } = await supabase
        .from('personal_loan_payments')
        .select('amount')
        .eq('personal_loan_id', input.personalLoanId);

      const totalPaid = (allPayments || []).reduce((sum, p) => sum + Number(p.amount), 0);
      if (totalPaid >= Number(loanData.amount)) {
        await supabase
          .from('personal_loans')
          .update({ status: 'paid' })
          .eq('id', input.personalLoanId);
      }
    }

    return {
      id: data.id,
      personalLoanId: data.personal_loan_id,
      amount: Number(data.amount),
      paymentDate: data.payment_date,
      notes: data.notes,
      createdAt: data.created_at
    };
  } catch (error) {
    console.warn('Supabase payment insert failed. Falling back to LocalStorage.', error);
    const payments = getMockPayments();
    payments.push(newPayment);
    saveMockPayments(payments);

    const loans = getMockLoans();
    const loanIndex = loans.findIndex(l => l.id === input.personalLoanId);
    if (loanIndex !== -1) {
      const loan = loans[loanIndex];
      const loanPayments = payments.filter(p => p.personalLoanId === loan.id);
      const totalPaid = loanPayments.reduce((sum, p) => sum + p.amount, 0);
      if (totalPaid >= loan.amount) {
        loan.status = 'paid';
      }
      saveMockLoans(loans);
    }
    return newPayment;
  }
}

// Delete a personal loan
export async function deletePersonalLoanQuery(id: string): Promise<boolean> {
  if (isMockMode()) {
    const loans = getMockLoans().filter(l => l.id !== id);
    saveMockLoans(loans);
    const payments = getMockPayments().filter(p => p.personalLoanId !== id);
    saveMockPayments(payments);
    return true;
  }

  try {
    const { error } = await supabase
      .from('personal_loans')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  } catch (error) {
    console.warn('Supabase delete failed. Falling back to LocalStorage.', error);
    const loans = getMockLoans().filter(l => l.id !== id);
    saveMockLoans(loans);
    const payments = getMockPayments().filter(p => p.personalLoanId !== id);
    saveMockPayments(payments);
    return true;
  }
}
