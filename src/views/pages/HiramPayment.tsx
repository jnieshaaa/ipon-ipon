import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Check, Landmark, Calendar, DollarSign, CalendarDays } from 'lucide-react';
import { calculateLoanInterest, Borrower, Loan } from '../../models/mockAccounts';
import { getBorrowersQuery, recordLoanPaymentQuery } from '../../queries/hiram';

export default function HiramPayment() {
  const navigate = useNavigate();
  const { borrowerId, loanId } = useParams();
  
  const groupId = useMemo(() => localStorage.getItem('ipon_selected_group_id') || '', []);
  const [borrowers, setBorrowers] = useState<Borrower[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentType, setPaymentType] = useState<'principal' | 'interest'>('principal');
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [error, setError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  const loadData = async () => {
    if (!groupId) return;
    try {
      const list = await getBorrowersQuery(groupId);
      setBorrowers(list);
    } catch (e) {
      console.error('Error loading borrowers for payment:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [groupId, borrowerId]);

  const borrower = useMemo(() => {
    return borrowers.find(b => b.id === borrowerId);
  }, [borrowers, borrowerId]);

  const loan = useMemo(() => {
    if (!borrower || !borrower.loans) return null;
    return borrower.loans.find(l => l.id === loanId);
  }, [borrower, loanId]);

  const loanDetails = useMemo(() => {
    if (!loan) return null;
    
    const principalPaid = loan.principalPaid !== undefined 
      ? loan.principalPaid 
      : Math.min(loan.totalPaid, loan.borrowedAmount);
      
    const interestPaid = loan.interestPaid !== undefined 
      ? loan.interestPaid 
      : Math.max(0, loan.totalPaid - loan.borrowedAmount);

    const { interest } = calculateLoanInterest(loan);
    const remainingPrincipal = Math.max(0, loan.borrowedAmount - principalPaid);
    const remainingInterest = Math.max(0, interest - interestPaid);
    const totalRemaining = remainingPrincipal + remainingInterest;

    return {
      interest,
      remainingPrincipal,
      remainingInterest,
      totalRemaining,
      principalPaid,
      interestPaid
    };
  }, [loan]);

  const confirmPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const amountVal = parseFloat(paymentAmount);
    if (isNaN(amountVal) || amountVal <= 0) {
      setError('Please enter a valid payment amount.');
      return;
    }

    if (!loanDetails) return;

    if (paymentType === 'principal' && amountVal > loanDetails.remainingPrincipal) {
      setError(`Payment exceeds remaining principal of ₱${loanDetails.remainingPrincipal.toLocaleString('en-PH')}.`);
      return;
    }

    if (paymentType === 'interest' && amountVal > loanDetails.remainingInterest) {
      setError(`Payment exceeds remaining interest of ₱${loanDetails.remainingInterest.toLocaleString('en-PH')}.`);
      return;
    }

    if (borrower && loan) {
      try {
        await recordLoanPaymentQuery(borrower.id, loan.id, amountVal, paymentType, paymentDate);
        setSaveSuccess(true);
        setTimeout(() => {
          setSaveSuccess(false);
          navigate(`/hiram/${borrower.id}`);
        }, 1500);
      } catch (err) {
        setError('Failed to record payment transaction.');
      }
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50/50 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-semibold text-slate-700">Loading loan payment details...</p>
        <p className="text-xs font-light text-slate-400 mt-1">Connecting to live database ledger...</p>
      </div>
    );
  }

  if (!borrower || !loan || !loanDetails) {
    return (
      <div className="min-h-screen bg-slate-50/50 flex flex-col items-center justify-center p-6 text-center">
        <p className="text-slate-500 text-sm">Loan record not found.</p>
        <button onClick={() => navigate('/hiram')} className="mt-4 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold">
          Back to Hiram
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col pb-6">
      {/* Top Banner Header */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-950 to-primary/45 px-6 pt-6 pb-20 text-white relative overflow-hidden rounded-b-3xl border-b border-primary/20 shadow-md">
        <div className="absolute right-0 bottom-0 translate-x-4 translate-y-4 w-32 h-32 bg-primary/10 rounded-full blur-2xl pointer-events-none" />
        
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate(`/hiram/${borrower.id}`)}
            className="w-10 h-10 bg-white/10 hover:bg-white/15 border border-white/10 rounded-2xl flex items-center justify-center active:scale-95 transition cursor-pointer"
            title="Back to Details"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div className="text-center">
            <h1 className="text-white text-base font-bold tracking-tight">Record Payment</h1>
            <p className="text-tertiary text-xs font-light">{borrower.name}</p>
          </div>
          <div className="w-10" />
        </div>
      </div>

      {/* Main Content Area */}
      <div className="px-6 -mt-8 relative z-10 flex-1 flex flex-col max-w-md mx-auto w-full">
        <form onSubmit={confirmPayment} className="bg-white rounded-3xl p-6 border border-slate-150/80 shadow-md flex-1 flex flex-col justify-between">
          {saveSuccess ? (
            <div className="py-20 text-center animate-in zoom-in-95 flex-1 flex flex-col justify-center items-center">
              <div className="w-16 h-16 bg-green-50 border border-green-150 rounded-full flex items-center justify-center mb-4">
                <Check className="w-8 h-8 text-green-500 animate-bounce" />
              </div>
              <h4 className="text-slate-850 font-bold text-base mb-1">Payment Recorded!</h4>
              <p className="text-slate-455 text-xs font-light">Loan ledger has been updated successfully.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {error && (
                <div className="bg-red-55/10 border border-red-200 text-red-600 text-xs font-semibold px-4 py-3 rounded-xl text-center animate-shake">
                  {error}
                </div>
              )}

              {/* Loan Summary Balance Cards */}
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4.5 space-y-3.5">
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Total Remaining Balance</p>
                  <p className="text-slate-800 text-xl font-bold font-sans">
                    ₱{loanDetails.totalRemaining.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                
                <div className="grid grid-cols-2 gap-4 pt-3.5 border-t border-slate-155 text-xs font-light text-slate-500">
                  <div>
                    <p className="text-[9px] uppercase tracking-wider text-slate-400 mb-0.5">Remaining Principal</p>
                    <p className="font-bold text-slate-700 font-sans">₱{loanDetails.remainingPrincipal.toLocaleString('en-PH')}</p>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase tracking-wider text-slate-400 mb-0.5">Remaining Interest</p>
                    <p className="font-bold text-slate-700 font-sans">₱{loanDetails.remainingInterest.toLocaleString('en-PH')}</p>
                  </div>
                </div>
              </div>

              {/* Payment Details Form Fields */}
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">What to pay first?</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setPaymentType('principal')}
                      className={`py-3.5 rounded-xl border text-xs font-bold transition-all duration-200 cursor-pointer text-center ${
                        paymentType === 'principal'
                          ? 'border-primary bg-primary/5 text-primary shadow-sm shadow-primary/5'
                          : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      Pay Principal
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentType('interest')}
                      className={`py-3.5 rounded-xl border text-xs font-bold transition-all duration-200 cursor-pointer text-center ${
                        paymentType === 'interest'
                          ? 'border-primary bg-primary/5 text-primary shadow-sm shadow-primary/5'
                          : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      Pay Interest
                    </button>
                  </div>
                </div>

                <div>
                  <label htmlFor="payAmt" className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Payment Amount (₱)</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-slate-450 text-xs">₱</span>
                    </div>
                    <input
                      id="payAmt"
                      type="number"
                      step="any"
                      required
                      placeholder={paymentType === 'principal' ? `e.g. ${Math.min(2000, loanDetails.remainingPrincipal)}` : `e.g. ${Math.min(500, loanDetails.remainingInterest)}`}
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      className="w-full pl-7 pr-4 py-3 border border-slate-250 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition duration-200 text-sm text-slate-800 placeholder-slate-400 font-sans"
                      autoFocus
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="payDate" className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Payment Date</label>
                  <input
                    id="payDate"
                    type="date"
                    required
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full px-4 py-3 border border-slate-250 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition duration-200 text-sm text-slate-800 font-sans"
                  />
                </div>
              </div>
            </div>
          )}

          {!saveSuccess && (
            <div className="flex space-x-3 pt-6 border-t border-slate-100 mt-6">
              <button
                type="button"
                onClick={() => navigate(`/hiram/${borrower.id}`)}
                className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-655 text-xs font-semibold hover:bg-slate-50 transition active:scale-98 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-3 rounded-xl bg-primary hover:bg-primary/95 text-white text-xs font-semibold hover:shadow-lg hover:shadow-primary/10 transition active:scale-98 cursor-pointer"
              >
                Confirm Pay
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}