import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Coins, Plus, Trash2, History, DollarSign, X } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { getPersonalLoansQuery, createPersonalLoanQuery, recordPersonalLoanPaymentQuery, deletePersonalLoanQuery, IPersonalLoan } from '../../queries/personalLoans';

export default function PersonalLoansTracker() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<'lent' | 'borrowed'>('lent');

  // Personal loans state
  const [personalLoans, setPersonalLoans] = useState<IPersonalLoan[]>([]);
  const [showAddLoanModal, setShowAddLoanModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<IPersonalLoan | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Add loan inputs
  const [loanType, setLoanType] = useState<'lent' | 'borrowed'>('lent');
  const [borrowerName, setBorrowerName] = useState('');
  const [loanAmount, setLoanAmount] = useState('');
  const [loanInterest, setLoanInterest] = useState('0');
  const [loanDate, setLoanDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [loanNotes, setLoanNotes] = useState('');
  const [personalError, setPersonalError] = useState('');

  // Payment inputs
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [paymentNotes, setPaymentNotes] = useState('');
  const [paymentError, setPaymentError] = useState('');

  const loadPersonalLoans = async () => {
    if (user) {
      try {
        const list = await getPersonalLoansQuery(user.userId);
        setPersonalLoans(list);
      } catch (err) {
        console.error('Error fetching personal loans:', err);
      } finally {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    if (user) {
      loadPersonalLoans();
    }
  }, [user]);

  const handleAddPersonalLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    setPersonalError('');
    if (!borrowerName.trim() || !loanAmount.trim() || !loanDate) {
      setPersonalError('Please fill in all required fields');
      return;
    }
    const amt = parseFloat(loanAmount);
    if (isNaN(amt) || amt <= 0) {
      setPersonalError('Please enter a valid amount');
      return;
    }
    if (user) {
      try {
        await createPersonalLoanQuery({
          userId: user.userId,
          borrowerName: borrowerName.trim(),
          amount: amt,
          interestRate: parseFloat(loanInterest) || 0,
          borrowDate: loanDate,
          notes: loanNotes.trim(),
          type: loanType
        });
        await loadPersonalLoans();
        setShowAddLoanModal(false);
        setBorrowerName('');
        setLoanAmount('');
        setLoanInterest('0');
        setLoanNotes('');
      } catch (err: any) {
        setPersonalError(err?.message || 'Failed to add personal loan');
      }
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setPaymentError('');
    if (!selectedLoan || !paymentAmount.trim() || !paymentDate) {
      setPaymentError('Please fill in all required fields');
      return;
    }
    const amt = parseFloat(paymentAmount);
    if (isNaN(amt) || amt <= 0) {
      setPaymentError('Please enter a valid payment amount');
      return;
    }
    try {
      await recordPersonalLoanPaymentQuery({
        personalLoanId: selectedLoan.id,
        amount: amt,
        paymentDate,
        notes: paymentNotes.trim()
      });
      const updatedLoans = await getPersonalLoansQuery(user!.userId);
      setPersonalLoans(updatedLoans);
      const match = updatedLoans.find(l => l.id === selectedLoan.id);
      if (match) setSelectedLoan(match);
      setShowPaymentModal(false);
      setPaymentAmount('');
      setPaymentNotes('');
    } catch (err: any) {
      setPaymentError(err?.message || 'Failed to record payment');
    }
  };

  const handleDeleteLoan = async (id: string) => {
    try {
      await deletePersonalLoanQuery(id);
      await loadPersonalLoans();
    } catch (err) {
      console.error('Error deleting loan:', err);
    }
  };

  const filteredLoans = personalLoans.filter(l => l.type === activeTab);

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col pb-8">
      {/* Top Header */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-950 to-primary/45 px-6 pt-12 pb-6 text-white relative overflow-hidden rounded-b-3xl border-b border-primary/20 shadow-lg flex items-center justify-between">
        <button
          onClick={() => navigate('/group-selection')}
          className="w-10 h-10 bg-white/10 hover:bg-white/15 border border-white/10 rounded-2xl flex items-center justify-center active:scale-95 transition cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <h1 className="text-white text-lg font-bold tracking-tight font-mono">Aking Pahiram</h1>
        <button
          onClick={() => {
            setPersonalError('');
            setBorrowerName('');
            setLoanAmount('');
            setLoanInterest('0');
            setLoanDate(new Date().toISOString().split('T')[0]);
            setLoanNotes('');
            setLoanType(activeTab); // Match the active tab default
            setShowAddLoanModal(true);
          }}
          className="w-10 h-10 bg-primary hover:bg-primary/95 rounded-2xl flex items-center justify-center shadow-lg active:scale-95 transition cursor-pointer"
        >
          <Plus className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* Tabs */}
      <div className="px-6 mt-4 flex space-x-2">
        <button
          onClick={() => setActiveTab('lent')}
          className={`flex-1 py-3 text-xs font-bold rounded-2xl border transition-all cursor-pointer ${
            activeTab === 'lent'
              ? 'bg-primary border-primary text-white shadow-md shadow-primary/10'
              : 'bg-white border-slate-150 text-slate-500 hover:text-slate-700'
          }`}
        >
          Pautang (Lent to Others)
        </button>
        <button
          onClick={() => setActiveTab('borrowed')}
          className={`flex-1 py-3 text-xs font-bold rounded-2xl border transition-all cursor-pointer ${
            activeTab === 'borrowed'
              ? 'bg-primary border-primary text-white shadow-md shadow-primary/10'
              : 'bg-white border-slate-150 text-slate-500 hover:text-slate-700'
          }`}
        >
          Hiram (Borrowed)
        </button>
      </div>

      {/* Main Content Area */}
      <div className="px-6 mt-6 flex-1 flex flex-col">
        {/* Metrics Summary Cards */}
        {!isLoading && personalLoans.length > 0 && (
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="bg-white rounded-2xl p-4 border border-slate-150/80 shadow-sm flex flex-col justify-between">
              <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                {activeTab === 'lent' ? 'Total Active Lent' : 'Total Active Owed'}
              </span>
              <span className="text-slate-800 text-lg font-extrabold mt-1">
                ₱{personalLoans
                  .filter(l => l.type === activeTab && l.status === 'active')
                  .reduce((sum, l) => sum + (l.amount - (l.totalPaid || 0)), 0)
                  .toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="bg-white rounded-2xl p-4 border border-slate-150/80 shadow-sm flex flex-col justify-between">
              <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                {activeTab === 'lent' ? 'Total Paid Back' : 'Total Repaid'}
              </span>
              <span className="text-emerald-600 text-lg font-extrabold mt-1">
                ₱{personalLoans
                  .filter(l => l.type === activeTab)
                  .reduce((sum, l) => sum + (l.totalPaid || 0), 0)
                  .toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center py-20">
            <div className="w-10 h-10 border-4 border-slate-200 border-t-primary rounded-full animate-spin"></div>
          </div>
        ) : filteredLoans.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-150/80 p-8 text-center shadow-sm my-auto">
            <Coins className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-slate-800 text-sm font-bold mb-1">
              {activeTab === 'lent' ? 'No Lent Money Recorded' : 'No Borrowed Money Recorded'}
            </h3>
            <p className="text-slate-400 text-xs font-light leading-relaxed max-w-xs mx-auto">
              {activeTab === 'lent' 
                ? 'Tap the "+" icon in the top right corner to track personal money lent to family, friends, or associates.'
                : 'Tap the "+" icon in the top right corner to track money you borrowed from friends or associates.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4 animate-in fade-in duration-200">
            {filteredLoans.map((loan) => {
              const remainingAmount = Math.max(0, loan.amount - (loan.totalPaid || 0));
              const progress = loan.amount > 0 ? ((loan.totalPaid || 0) / loan.amount) * 100 : 0;

              return (
                <div
                  key={loan.id}
                  className="bg-white rounded-3xl p-5 border border-slate-150/80 shadow-sm flex flex-col transition-all duration-300"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-700 font-bold text-sm shadow-inner">
                        {loan.borrowerName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="text-slate-800 text-sm font-bold flex items-center space-x-2">
                          <span>{loan.borrowerName}</span>
                          {loan.status === 'paid' ? (
                            <span className="bg-emerald-50 text-emerald-600 border border-emerald-250 text-[8px] font-bold px-1.5 py-0.5 rounded">
                              Fully Paid
                            </span>
                          ) : (
                            <span className="bg-amber-50 text-amber-600 border border-amber-250 text-[8px] font-bold px-1.5 py-0.5 rounded">
                              Active
                            </span>
                          )}
                        </h3>
                        <p className="text-slate-400 text-[10px] font-light">
                          {loan.type === 'lent' ? 'Lent' : 'Borrowed'}: ₱{loan.amount.toLocaleString()} on {loan.borrowDate}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Remaining</p>
                      <p className="text-slate-800 text-sm font-extrabold">
                        ₱{remainingAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>

                  {loan.notes && (
                    <p className="text-slate-500 text-[10px] font-light italic mb-3 bg-slate-50/50 p-2.5 rounded-xl border border-slate-100 leading-relaxed">
                      Notes: {loan.notes}
                    </p>
                  )}

                  {/* Progress Bar */}
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mb-4">
                    <div
                      className="bg-gradient-to-r from-primary to-tertiary h-full transition-all duration-500"
                      style={{ width: `${Math.min(100, progress)}%` }}
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => {
                          setSelectedLoan(loan);
                          setHistoryModalOpen(true);
                        }}
                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200/80 text-slate-600 text-[10px] font-bold rounded-lg flex items-center space-x-1 transition active:scale-95 cursor-pointer"
                      >
                        <History className="w-3 h-3" />
                        <span>History</span>
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Are you sure you want to delete this record?`)) {
                            handleDeleteLoan(loan.id);
                          }
                        }}
                        className="px-2 py-1.5 text-red-500 hover:bg-red-50 text-[10px] font-bold rounded-lg flex items-center space-x-1 transition active:scale-95 cursor-pointer"
                        title="Delete Record"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Delete</span>
                      </button>
                    </div>

                    {loan.status === 'active' && (
                      <button
                        onClick={() => {
                          setSelectedLoan(loan);
                          setPaymentAmount('');
                          setPaymentDate(new Date().toISOString().split('T')[0]);
                          setPaymentNotes('');
                          setPaymentError('');
                          setShowPaymentModal(true);
                        }}
                        className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-bold rounded-lg flex items-center space-x-1 transition active:scale-95 shadow-sm shadow-emerald-500/10 cursor-pointer"
                      >
                        <DollarSign className="w-3 h-3" />
                        <span>{loan.type === 'lent' ? 'Record Payment' : 'Pay Back'}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Personal Loan Modal */}
      {showAddLoanModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-6 z-50 animate-in fade-in duration-200">
          <form onSubmit={handleAddPersonalLoan} className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-55 transform transition-all duration-300 scale-95 animate-in zoom-in-95">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-slate-800 text-lg font-bold flex items-center space-x-2">
                <Coins className="w-5 h-5 text-primary" />
                <span>Add Record</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAddLoanModal(false)}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {personalError && (
              <div className="bg-red-50 text-red-650 text-xs font-semibold px-3.5 py-2.5 rounded-xl text-center mb-4">
                {personalError}
              </div>
            )}

            <div className="space-y-4 mb-6">
              {/* Type Select */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5 ml-1">
                  Transaction Type
                </label>
                <div className="flex bg-slate-100 p-1 rounded-xl mb-2">
                  <button
                    type="button"
                    onClick={() => setLoanType('lent')}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      loanType === 'lent'
                        ? 'bg-white text-primary shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Lent to Friend (Pautang)
                  </button>
                  <button
                    type="button"
                    onClick={() => setLoanType('borrowed')}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      loanType === 'borrowed'
                        ? 'bg-white text-primary shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Borrowed (Hiram)
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="borrowerName" className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5 ml-1">
                  {loanType === 'lent' ? 'Friend Name (Borrower)' : 'Friend Name (Lender)'}
                </label>
                <input
                  id="borrowerName"
                  type="text"
                  placeholder="e.g. Maria Clara"
                  value={borrowerName}
                  onChange={(e) => setBorrowerName(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition duration-200 text-sm text-slate-800 placeholder-slate-400"
                  required
                />
              </div>

              <div>
                <label htmlFor="loanAmount" className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5 ml-1">
                  {loanType === 'lent' ? 'Amount Lent (₱)' : 'Amount Borrowed (₱)'}
                </label>
                <input
                  id="loanAmount"
                  type="number"
                  placeholder="e.g. 5000"
                  value={loanAmount}
                  onChange={(e) => setLoanAmount(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition duration-200 text-sm text-slate-800 placeholder-slate-400"
                  required
                />
              </div>

              <div>
                <label htmlFor="loanDate" className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5 ml-1">
                  Date
                </label>
                <input
                  id="loanDate"
                  type="date"
                  value={loanDate}
                  onChange={(e) => setLoanDate(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition duration-200 text-sm text-slate-800 bg-white"
                  required
                />
              </div>

              <div>
                <label htmlFor="loanNotes" className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5 ml-1">
                  Notes (Optional)
                </label>
                <textarea
                  id="loanNotes"
                  placeholder="e.g. Needs to pay back next month"
                  value={loanNotes}
                  onChange={(e) => setLoanNotes(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition duration-200 text-sm text-slate-800 placeholder-slate-400 min-h-[60px]"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-primary hover:bg-primary/95 text-white py-3.5 rounded-2xl font-bold shadow-lg hover:shadow-xl transition-all duration-200 active:scale-[0.98] text-sm cursor-pointer"
            >
              Add Record
            </button>
          </form>
        </div>
      )}

      {/* Record Payment Modal */}
      {showPaymentModal && selectedLoan && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-6 z-50 animate-in fade-in duration-200">
          <form onSubmit={handleRecordPayment} className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-50 transform transition-all duration-300 scale-95 animate-in zoom-in-95">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-slate-800 text-lg font-bold flex items-center space-x-2">
                <DollarSign className="w-5 h-5 text-emerald-500" />
                <span>{selectedLoan.type === 'lent' ? 'Record Payment' : 'Pay Back'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowPaymentModal(false)}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {paymentError && (
              <div className="bg-red-50 text-red-650 text-xs font-semibold px-3.5 py-2.5 rounded-xl text-center mb-4">
                {paymentError}
              </div>
            )}

            <div className="space-y-4 mb-6">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 mb-2">
                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Remaining Balance</p>
                <p className="text-slate-800 text-sm font-extrabold">
                  ₱{(selectedLoan.amount - (selectedLoan.totalPaid || 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>

              <div>
                <label htmlFor="paymentAmount" className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5 ml-1">
                  Payment Amount (₱)
                </label>
                <input
                  id="paymentAmount"
                  type="number"
                  placeholder="e.g. 500"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition duration-200 text-sm text-slate-800 placeholder-slate-400"
                  required
                />
              </div>

              <div>
                <label htmlFor="paymentDate" className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5 ml-1">
                  Payment Date
                </label>
                <input
                  id="paymentDate"
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition duration-200 text-sm text-slate-800 bg-white"
                  required
                />
              </div>

              <div>
                <label htmlFor="paymentNotes" className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5 ml-1">
                  Notes (Optional)
                </label>
                <input
                  id="paymentNotes"
                  type="text"
                  placeholder="e.g. Partial payment"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition duration-200 text-sm text-slate-800 placeholder-slate-400"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-3.5 rounded-2xl font-bold shadow-lg hover:shadow-xl transition-all duration-200 active:scale-[0.98] text-sm cursor-pointer"
            >
              Record Payment
            </button>
          </form>
        </div>
      )}

      {/* History Modal */}
      {historyModalOpen && selectedLoan && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-6 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-55 transform transition-all duration-300 scale-95 animate-in zoom-in-95">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-slate-800 text-lg font-bold flex items-center space-x-2">
                <History className="w-5 h-5 text-primary" />
                <span>Payment History</span>
              </h3>
              <button
                type="button"
                onClick={() => setHistoryModalOpen(false)}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center mb-2">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                      {selectedLoan.type === 'lent' ? 'Total Lent' : 'Total Borrowed'}
                    </p>
                    <p className="text-slate-800 text-base font-extrabold">₱{selectedLoan.amount.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                      {selectedLoan.type === 'lent' ? 'Total Paid Back' : 'Total Repaid'}
                    </p>
                    <p className="text-emerald-600 text-base font-extrabold">₱{(selectedLoan.totalPaid || 0).toLocaleString()}</p>
                  </div>
                </div>
                <div className="border-t border-slate-200/60 mt-2.5 pt-2">
                  <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Remaining Balance</p>
                  <p className="text-slate-800 text-base font-extrabold">
                    ₱{Math.max(0, selectedLoan.amount - (selectedLoan.totalPaid || 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
              </div>

              <div className="space-y-2.5">
                <h4 className="text-slate-500 text-[10px] font-bold uppercase tracking-wider pl-1">Payment Transactions</h4>
                {!selectedLoan.payments || selectedLoan.payments.length === 0 ? (
                  <p className="text-center text-slate-400 text-xs font-light py-4">No payments recorded yet.</p>
                ) : (
                  selectedLoan.payments.map((payment) => (
                    <div key={payment.id} className="bg-white border border-slate-100 rounded-xl p-3 shadow-sm flex items-center justify-between">
                      <div>
                        <p className="text-slate-800 text-xs font-bold">₱{payment.amount.toLocaleString()}</p>
                        <p className="text-slate-400 text-[9px] font-medium">{payment.paymentDate}</p>
                        {payment.notes && <p className="text-slate-500 text-[9px] italic mt-0.5">{payment.notes}</p>}
                      </div>
                      <span className="text-[9px] font-bold text-emerald-500 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                        Received
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <button
              onClick={() => setHistoryModalOpen(false)}
              className="w-full bg-slate-100 hover:bg-slate-200/80 text-slate-700 py-3 rounded-xl font-bold transition duration-200 text-xs mt-6"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
