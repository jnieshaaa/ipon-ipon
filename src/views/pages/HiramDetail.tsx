import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Calendar, TrendingUp, DollarSign, X, Plus, Edit, Trash2 } from 'lucide-react';
import { calculateLoanInterest, Borrower, Loan } from '../../models/mockAccounts';
import { useAuth } from '../../hooks/useAuth';
import { getBorrowersQuery, addLoanToBorrowerQuery, deleteLoanQuery, updateLoanQuery } from '../../queries/hiram';
import { getSaversQuery } from '../../queries/savings';

export default function HiramDetail() {
  const navigate = useNavigate();
  const { borrowerId } = useParams();
  const { user } = useAuth();

  const groupId = useMemo(() => localStorage.getItem('ipon_selected_group_id') || '', []);
  const [borrowers, setBorrowers] = useState<Borrower[]>([]);
  const [groupSavers, setGroupSavers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null);

  const loadData = async () => {
    if (!groupId) return;
    try {
      const list = await getBorrowersQuery(groupId);
      setBorrowers(list);

      const savers = await getSaversQuery(groupId);
      setGroupSavers(savers);
    } catch (e) {
      console.error('Error loading hiram details:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [groupId, borrowerId]);

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  // Form input states
  const [loanAmount, setLoanAmount] = useState('');
  const [loanType, setLoanType] = useState<'percentage' | 'fixed'>('percentage');
  const [loanInterest, setLoanInterest] = useState('5');
  const [loanFrequency, setLoanFrequency] = useState<'weekly' | 'monthly'>('monthly');
  const [loanDate, setLoanDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [formError, setFormError] = useState('');

  // Find borrower by url id
  const borrower = useMemo(() => {
    return borrowers.find(b => b.id === borrowerId) || borrowers[0];
  }, [borrowers, borrowerId]);

  // Map individual loans with dynamic calculations & migrations
  const mappedLoans = useMemo(() => {
    if (!borrower || !borrower.loans) return [];
    return borrower.loans.map(loan => {
      const principalPaid = loan.principalPaid !== undefined 
        ? loan.principalPaid 
        : Math.min(loan.totalPaid, loan.borrowedAmount);
        
      const interestPaid = loan.interestPaid !== undefined 
        ? loan.interestPaid 
        : Math.max(0, loan.totalPaid - loan.borrowedAmount);

      const paymentHistory = loan.paymentHistory || (loan.totalPaid > 0 ? [{
        id: `pay_init_${loan.id}`,
        amount: loan.totalPaid,
        date: loan.borrowDate,
        type: 'principal' as const
      }] : []);

      const { periodsPassed, interest } = calculateLoanInterest(loan);
      const remainingPrincipal = Math.max(0, loan.borrowedAmount - principalPaid);
      const remainingInterest = Math.max(0, interest - interestPaid);
      const totalDue = loan.borrowedAmount + interest;
      const remainingBalance = remainingPrincipal + remainingInterest;
      
      return {
        ...loan,
        principalPaid,
        interestPaid,
        paymentHistory,
        periodsPassed,
        accumulatedInterest: interest,
        totalDue,
        remainingBalance
      };
    });
  }, [borrower]);

  // Aggregate totals
  const totalBorrowed = useMemo(() => {
    return mappedLoans.reduce((sum, l) => sum + l.borrowedAmount, 0);
  }, [mappedLoans]);

  const totalRemainingBalance = useMemo(() => {
    return mappedLoans.reduce((sum, l) => {
      if (l.status === 'active') {
        return sum + l.remainingBalance;
      }
      return sum;
    }, 0);
  }, [mappedLoans]);

  const activeLoansCount = useMemo(() => {
    return mappedLoans.filter(l => l.status === 'active').length;
  }, [mappedLoans]);

  const selectedLoan = useMemo(() => {
    if (!selectedLoanId || !borrower) return null;
    return mappedLoans.find(l => l.id === selectedLoanId) || null;
  }, [selectedLoanId, mappedLoans]);

  // Payment triggers - Redirect to payment screen
  const handlePayment = (loanId: string) => {
    if (borrower) {
      navigate(`/hiram/${borrower.id}/pay/${loanId}`);
    }
  };

  const creatorId = useMemo(() => localStorage.getItem('ipon_selected_group_creator_id') || '', []);
  const isLeader = useMemo(() => {
    if (!user) return false;
    return user.userId === creatorId;
  }, [user, creatorId]);

  // Find matching account in the group savers
  const memberAccount = useMemo(() => {
    if (!user) return null;
    return groupSavers.find(
      acc => acc.name.toLowerCase().includes(user.name.toLowerCase()) || 
             user.name.toLowerCase().includes(acc.name.toLowerCase())
    ) || null;
  }, [user, groupSavers]);

  const isMember = useMemo(() => {
    if (!borrower) return false;
    return groupSavers.some(s => s.uniqueId === borrower.uniqueId && s.userId);
  }, [borrower, groupSavers]);

  // Access check
  const hasAccess = useMemo(() => {
    if (isLeader) return true;
    if (!user || !borrower) return false;
    return borrower.name.toLowerCase().includes(user.name.toLowerCase()) ||
           user.name.toLowerCase().includes(borrower.name.toLowerCase()) ||
           (memberAccount && borrower.uniqueId === memberAccount.uniqueId);
  }, [isLeader, user, borrower, memberAccount]);

  // Add Loan triggers
  const handleAddLoanClick = () => {
    const storedMemberInterest = localStorage.getItem('ipon_selected_group_member_interest') || '5';
    const storedNonMemberInterest = localStorage.getItem('ipon_selected_group_non_member_interest') || '10';
    const defaultInterest = isMember ? storedMemberInterest : storedNonMemberInterest;

    setLoanAmount('');
    setLoanType('percentage');
    setLoanInterest(defaultInterest);
    setLoanFrequency('monthly');
    setLoanDate(new Date().toISOString().split('T')[0]);
    setFormError('');
    setShowAddModal(true);
  };

  const confirmAddLoan = async () => {
    const amountVal = parseFloat(loanAmount);
    const interestVal = parseFloat(loanInterest);
    if (isNaN(amountVal) || amountVal <= 0) {
      setFormError('Please enter a valid borrowed amount.');
      return;
    }
    if (isNaN(interestVal) || interestVal < 0) {
      setFormError('Please enter a valid interest value.');
      return;
    }
    if (!loanDate) {
      setFormError('Please select a date.');
      return;
    }

    if (borrower) {
      try {
        await addLoanToBorrowerQuery(borrower.id, amountVal, interestVal, loanType, loanFrequency, loanDate);
        await loadData();
        setShowAddModal(false);
      } catch (err) {
        setFormError('Failed to add loan to borrower record.');
      }
    }
  };

  // Edit Loan triggers
  const handleEditLoanClick = (loan: Loan) => {
    setSelectedLoanId(loan.id);
    setLoanAmount(String(loan.borrowedAmount));
    setLoanType(loan.interestType || 'percentage');
    setLoanInterest(String(loan.interestRate));
    setLoanFrequency(loan.interestFrequency || 'monthly');
    setLoanDate(loan.borrowDate);
    setFormError('');
    setShowEditModal(true);
  };

  const confirmEditLoan = async () => {
    const amountVal = parseFloat(loanAmount);
    const interestVal = parseFloat(loanInterest);
    if (isNaN(amountVal) || amountVal <= 0) {
      setFormError('Please enter a valid borrowed amount.');
      return;
    }
    if (isNaN(interestVal) || interestVal < 0) {
      setFormError('Please enter a valid interest value.');
      return;
    }
    if (!loanDate) {
      setFormError('Please select a date.');
      return;
    }
    if (borrower && selectedLoanId) {
      try {
        await updateLoanQuery(selectedLoanId, amountVal, interestVal, loanType, loanFrequency, loanDate);
        await loadData();
        setShowEditModal(false);
        setSelectedLoanId(null);
      } catch (err) {
        setFormError('Failed to update loan details.');
      }
    }
  };

  // Delete Loan record
  const handleDeleteLoan = async (loanId: string) => {
    if (window.confirm("Are you sure you want to delete this loan record?")) {
      try {
        await deleteLoanQuery(loanId);
        await loadData();
      } catch (err) {
        alert("Failed to delete loan record.");
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

  if (!borrower) return null;

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-slate-50/50 flex flex-col items-center justify-center p-6 text-center animate-in fade-in">
        <div className="w-16 h-16 bg-red-50 border border-red-150 rounded-2xl flex items-center justify-center mb-4 text-red-500 shadow-sm mx-auto">
          <X className="w-8 h-8" />
        </div>
        <h2 className="text-slate-800 text-base font-bold mb-1">Access Denied</h2>
        <p className="text-slate-400 text-xs font-light max-w-xs mb-6 leading-relaxed">
          You do not have permission to view other group members' hiram details.
        </p>
        <button
          onClick={() => navigate("/dashboard")}
          className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold shadow transition active:scale-95 cursor-pointer"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col pb-6">
      {/* Top Banner Header */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-950 to-primary/45 px-6 pt-6 pb-20 text-white relative overflow-hidden rounded-b-[2rem] border-b border-primary/20 shadow-md">
        <div className="absolute right-0 bottom-0 translate-x-4 translate-y-4 w-32 h-32 bg-primary/10 rounded-full blur-2xl pointer-events-none" />
        
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate(isLeader ? '/hiram' : '/dashboard')}
            className="w-10 h-10 bg-white/10 hover:bg-white/15 border border-white/10 rounded-2xl flex items-center justify-center active:scale-95 transition cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div className="text-center">
            <h2 className="text-white text-base font-bold tracking-tight">{borrower.name}</h2>
            <p className="text-slate-400 text-xs font-light">{borrower.uniqueId}</p>
          </div>
          <div className="w-10" />
        </div>
      </div>

      <div className="flex-1 px-6 -mt-8 relative z-10 space-y-4 flex flex-col">
        {isLoading ? (
          <div className="flex-1 bg-white rounded-3xl p-8 border border-slate-150 text-center shadow-md flex flex-col items-center justify-center min-h-[300px] animate-in fade-in">
            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-sm font-semibold text-slate-700">Loading loans data...</p>
            <p className="text-xs font-light text-slate-400 mt-1">Connecting to live database ledger...</p>
          </div>
        ) : !borrower ? (
          <div className="flex-1 bg-white rounded-3xl p-8 border border-slate-150 text-center shadow-md flex flex-col items-center justify-center min-h-[300px]">
            <p className="text-sm font-semibold text-slate-700">Borrower profile not found</p>
          </div>
        ) : (
          <>
            {/* Dynamic Summary Cards */}
            <div className="bg-white rounded-2xl p-5 border border-slate-150/80 shadow-md relative overflow-hidden">
              <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-20 h-20 bg-primary/5 rounded-full blur-xl pointer-events-none" />
              <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-1">Total Outstanding Balance</p>
          <p className="text-slate-800 text-2xl font-bold tracking-tight font-sans">
            ₱{totalRemainingBalance.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
          </p>
          <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-slate-100 text-xs text-slate-400 font-light">
            <p>Total Borrowed: <span className="font-semibold text-slate-655 font-sans">₱{totalBorrowed.toLocaleString('en-PH')}</span></p>
            <p>{activeLoansCount} active loan{activeLoansCount !== 1 ? 's' : ''}</p>
          </div>
        </div>

        {/* Action Button & Title */}
        <div className="flex items-center justify-between pt-1">
          <h3 className="text-slate-855 text-sm font-bold">Loans Ledger</h3>
          {isLeader && (
            <button
              onClick={handleAddLoanClick}
              className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-950 text-white rounded-xl text-xs font-bold flex items-center space-x-1 shadow-sm active:scale-95 transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Loan</span>
            </button>
          )}
        </div>

        {/* Loans Table */}
        {mappedLoans.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 border border-slate-150/80 shadow-md text-center">
            <div className="w-12 h-12 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-100 shadow-sm animate-pulse">
              <Calendar className="w-5 h-5" />
            </div>
            <h3 className="text-slate-800 text-sm font-bold mb-1">No loans recorded yet</h3>
            <p className="text-slate-455 text-[10px] font-light max-w-[240px] mx-auto mb-5 leading-normal">
              There are no loan entries tracked for this borrower. {isLeader && 'Click "+ Add Loan" to record their first loan details.'}
            </p>
            {isLeader && (
              <button
                onClick={handleAddLoanClick}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-950 text-white rounded-xl text-xs font-semibold shadow transition active:scale-98 cursor-pointer"
              >
                Configure First Loan
              </button>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-150/80 shadow-sm overflow-hidden flex-1 flex flex-col">
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left border-collapse min-w-[500px]">
                <thead>
                  <tr className="bg-slate-50/70 border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Principal</th>
                    <th className="px-4 py-3">Interest Rate</th>
                    <th className="px-4 py-3">Accum. Interest</th>
                    <th className="px-4 py-3">Remaining</th>
                    {isLeader && <th className="px-4 py-3 text-center">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-light text-slate-600">
                  {mappedLoans.map(loan => {
                    const isPaid = loan.status === 'paid';
                    return (
                      <tr key={loan.id} className="hover:bg-slate-50/30 transition">
                        <td className="px-4 py-3.5 font-semibold text-slate-700 whitespace-nowrap">
                          {formatDate(loan.borrowDate)}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <div className="font-bold text-slate-800 font-sans">
                            ₱{loan.borrowedAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                          </div>
                          <div className="text-[9px] text-slate-400 mt-0.5 font-light">
                            Paid: ₱{(loan.principalPaid || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-slate-500 whitespace-nowrap">
                          {loan.interestType === 'fixed' ? '₱' : ''}
                          {loan.interestRate}
                          {loan.interestType === 'percentage' ? '%' : ''}/{loan.interestFrequency === 'weekly' ? 'wk' : 'mo'}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <div className="font-semibold text-amber-600 font-sans">
                            ₱{loan.accumulatedInterest.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                          </div>
                          <div className="text-[9px] text-slate-400 mt-0.5 font-light">
                            Paid: ₱{(loan.interestPaid || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          {isPaid ? (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold text-[9px] border border-emerald-100">
                              Paid
                            </span>
                          ) : (
                            <span className="font-bold text-slate-850 font-sans">
                              ₱{loan.remainingBalance.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                            </span>
                          )}
                        </td>
                        {isLeader && (
                          <td className="px-4 py-3.5 whitespace-nowrap text-center">
                            <div className="flex items-center justify-center space-x-2">
                              {!isPaid && (
                                <button
                                  onClick={() => handlePayment(loan.id)}
                                  className="px-2.5 py-1 bg-gradient-to-r from-primary to-primary/85 hover:shadow-sm text-white rounded-lg text-[10px] font-bold active:scale-95 transition cursor-pointer"
                                >
                                  Pay
                                </button>
                              )}
                              <button
                                onClick={() => handleEditLoanClick(loan)}
                                className="text-slate-400 hover:text-slate-600 p-1.5 rounded hover:bg-slate-100 transition cursor-pointer"
                                title="Edit Loan"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteLoan(loan.id)}
                                className="text-red-400 hover:text-red-500 p-1.5 rounded hover:bg-red-50 transition cursor-pointer"
                                title="Delete Record"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Payment History Card */}
        {mappedLoans.some(l => l.paymentHistory && l.paymentHistory.length > 0) && (
          <div className="bg-white rounded-2xl border border-slate-150/80 shadow-sm p-5 space-y-4">
            <h3 className="text-slate-800 text-sm font-bold flex items-center space-x-1.5">
              <span>Payment History</span>
            </h3>
            
            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
              {mappedLoans
                .flatMap(l => (l.paymentHistory || []).map(h => ({
                  ...h,
                  loanDate: l.borrowDate,
                  borrowedAmount: l.borrowedAmount
                })))
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime() || b.id.localeCompare(a.id))
                .map((history) => (
                  <div key={history.id} className="flex items-center justify-between p-3 bg-slate-50/50 border border-slate-100 rounded-xl hover:border-slate-150 transition">
                    <div className="flex items-center space-x-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                        history.type === 'principal' ? 'bg-primary/10 text-primary' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {history.type === 'principal' ? 'P' : 'I'}
                      </div>
                      <div>
                        <p className="text-slate-800 text-xs font-bold capitalize">{history.type} Paid</p>
                        <p className="text-[10px] text-slate-400 font-light">Loan: {formatDate(history.loanDate)} (₱{history.borrowedAmount.toLocaleString()})</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-slate-800 text-xs font-bold font-sans">₱{history.amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</p>
                      <p className="text-[10px] text-slate-400 font-light">{formatDate(history.date)}</p>
                    </div>
                  </div>
                ))
              }
            </div>
          </div>
        )}
      </>
    )}
  </div>

      {/* Add Loan Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-6 z-50 animate-in fade-in duration-200">
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              confirmAddLoan();
            }}
            className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-50 transform transition-all duration-300 scale-95 animate-in zoom-in-95"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-slate-800 text-base font-bold">Add Loan Record</h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="bg-red-50 text-red-655 border border-red-100 text-xs px-3.5 py-2.5 rounded-xl mb-4 font-medium">
                {formError}
              </div>
            )}

            {/* Borrowed Amount */}
            <div className="mb-4">
              <label htmlFor="addAmountInput" className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5 ml-1">
                Borrowed Amount (₱)
              </label>
              <input
                id="addAmountInput"
                type="number"
                step="any"
                value={loanAmount}
                onChange={(e) => setLoanAmount(e.target.value)}
                placeholder="e.g. 5000"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition duration-200 text-sm text-slate-800 placeholder-slate-400"
                required
                autoFocus
              />
            </div>

            {/* Interest Type & Frequency Config */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label htmlFor="addTypeSelect" className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5 ml-1">
                  Interest Type
                </label>
                <select
                  id="addTypeSelect"
                  value={loanType}
                  onChange={(e) => setLoanType(e.target.value as any)}
                  className="w-full px-3 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary bg-white text-sm text-slate-805"
                >
                  <option value="percentage">Percentage (%)</option>
                  <option value="fixed">Fixed Cash (₱)</option>
                </select>
              </div>

              <div>
                <label htmlFor="addFrequencySelect" className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5 ml-1">
                  Frequency
                </label>
                <select
                  id="addFrequencySelect"
                  value={loanFrequency}
                  onChange={(e) => setLoanFrequency(e.target.value as any)}
                  className="w-full px-3 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary bg-white text-sm text-slate-805"
                >
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
            </div>

            {/* Interest Rate & Date Grid */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              <div>
                <label htmlFor="addInterestInput" className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5 ml-1">
                  {loanType === 'percentage' ? 'Rate (%)' : 'Amount (₱)'}
                </label>
                <input
                  id="addInterestInput"
                  type="number"
                  step="any"
                  value={loanInterest}
                  onChange={(e) => setLoanInterest(e.target.value)}
                  placeholder={loanType === 'percentage' ? '5' : '500'}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition duration-200 text-sm text-slate-800"
                  required
                />
              </div>
              <div>
                <label htmlFor="addDateInput" className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5 ml-1">
                  Borrow Date
                </label>
                <input
                  id="addDateInput"
                  type="date"
                  value={loanDate}
                  onChange={(e) => setLoanDate(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition duration-200 text-sm text-slate-805"
                  required
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-3">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-655 text-sm font-semibold hover:bg-slate-50 transition active:scale-98"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-primary to-primary/85 text-white text-sm font-semibold hover:shadow-lg hover:shadow-primary/10 transition active:scale-98"
              >
                Save Loan
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Loan Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-6 z-50 animate-in fade-in duration-200">
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              confirmEditLoan();
            }}
            className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-50 transform transition-all duration-300 scale-95 animate-in zoom-in-95"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-slate-800 text-base font-bold">Edit Loan Details</h3>
              <button
                type="button"
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedLoanId(null);
                }}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="bg-red-50 text-red-655 border border-red-100 text-xs px-3.5 py-2.5 rounded-xl mb-4 font-medium">
                {formError}
              </div>
            )}

            {/* Borrowed Amount */}
            <div className="mb-4">
              <label htmlFor="editAmountInput" className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5 ml-1">
                Borrowed Amount (₱)
              </label>
              <input
                id="editAmountInput"
                type="number"
                step="any"
                value={loanAmount}
                onChange={(e) => setLoanAmount(e.target.value)}
                placeholder="e.g. 10000"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition duration-200 text-sm text-slate-800 placeholder-slate-400"
                required
                autoFocus
              />
            </div>

            {/* Interest Type & Frequency Config */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label htmlFor="editTypeSelect" className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5 ml-1">
                  Interest Type
                </label>
                <select
                  id="editTypeSelect"
                  value={loanType}
                  onChange={(e) => setLoanType(e.target.value as any)}
                  className="w-full px-3 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary bg-white text-sm text-slate-805"
                >
                  <option value="percentage">Percentage (%)</option>
                  <option value="fixed">Fixed Cash (₱)</option>
                </select>
              </div>

              <div>
                <label htmlFor="editFrequencySelect" className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5 ml-1">
                  Frequency
                </label>
                <select
                  id="editFrequencySelect"
                  value={loanFrequency}
                  onChange={(e) => setLoanFrequency(e.target.value as any)}
                  className="w-full px-3 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary bg-white text-sm text-slate-805"
                >
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
            </div>

            {/* Interest Rate & Date Grid */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              <div>
                <label htmlFor="editInterestInput" className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5 ml-1">
                  {loanType === 'percentage' ? 'Rate (%)' : 'Amount (₱)'}
                </label>
                <input
                  id="editInterestInput"
                  type="number"
                  step="any"
                  value={loanInterest}
                  onChange={(e) => setLoanInterest(e.target.value)}
                  placeholder={loanType === 'percentage' ? '5' : '500'}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition duration-200 text-sm text-slate-805"
                  required
                />
              </div>
              <div>
                <label htmlFor="editDateInput" className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5 ml-1">
                  Borrow Date
                </label>
                <input
                  id="editDateInput"
                  type="date"
                  value={loanDate}
                  onChange={(e) => setLoanDate(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition duration-200 text-sm text-slate-805"
                  required
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-3">
              <button
                type="button"
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedLoanId(null);
                }}
                className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-655 text-sm font-semibold hover:bg-slate-50 transition active:scale-98"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-primary to-primary/85 text-white text-sm font-semibold hover:shadow-lg hover:shadow-primary/10 transition active:scale-98"
              >
                Save Details
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
