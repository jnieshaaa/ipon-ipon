import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, TrendingUp, CheckCircle, Clock, ChevronRight, Plus, X } from 'lucide-react';
import { calculateLoanInterest, Borrower } from '../../models/mockAccounts';
import { useAuth } from '../../hooks/useAuth';
import { getBorrowersQuery, addBorrowerQuery } from '../../queries/hiram';
import { getSaversQuery } from '../../queries/savings';

export default function HiramOverview() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const groupId = useMemo(() => localStorage.getItem('ipon_selected_group_id') || '', []);
  const creatorId = useMemo(() => localStorage.getItem('ipon_selected_group_creator_id') || '', []);
  
  const isLeader = useMemo(() => {
    if (!user) return false;
    return user.userId === creatorId;
  }, [user, creatorId]);

  const [borrowers, setBorrowers] = useState<Borrower[]>([]);
  const [groupSavers, setGroupSavers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [borrowerType, setBorrowerType] = useState<'member' | 'outsider'>('member');
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [outsiderName, setOutsiderName] = useState('');
  const [formError, setFormError] = useState('');

  const loadData = async () => {
    if (!groupId) return;
    try {
      const list = await getBorrowersQuery(groupId);
      setBorrowers(list);

      const savers = await getSaversQuery(groupId);
      setGroupSavers(savers);
    } catch (e) {
      console.error('Error loading borrowers overview:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [groupId, isLeader]);

  // Find matching account in the group savers
  const memberAccount = useMemo(() => {
    if (!user) return null;
    return groupSavers.find(
      acc => acc.name.toLowerCase().includes(user.name.toLowerCase()) || 
             user.name.toLowerCase().includes(acc.name.toLowerCase())
    ) || null;
  }, [user, groupSavers]);

  // Find matching borrower in the hiram records
  const memberBorrower = useMemo(() => {
    if (!user) return null;
    return borrowers.find(
      b => b.name.toLowerCase().includes(user.name.toLowerCase()) || 
           user.name.toLowerCase().includes(b.name.toLowerCase()) ||
           (memberAccount && b.uniqueId === memberAccount.uniqueId)
    ) || null;
  }, [user, memberAccount, borrowers]);

  // Redirect if regular member
  useEffect(() => {
    if (!isLoading && user && !isLeader) {
      if (memberBorrower) {
        navigate(`/hiram/${memberBorrower.id}`, { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    }
  }, [isLoading, user, isLeader, memberBorrower, navigate]);

  // Load and map borrowers with dynamic interest calculations aggregated across all loans
  const mappedBorrowers = useMemo(() => {
    return borrowers.map(b => {
      let totalBorrowed = 0;
      let totalInterest = 0;
      let totalPaid = 0;
      const mappedLoans = (b.loans || []).map(l => {
        const { interest } = calculateLoanInterest(l);
        totalBorrowed += l.borrowedAmount;
        totalInterest += interest;
        totalPaid += l.totalPaid;
        return {
          ...l,
          accumulatedInterest: interest
        };
      });

      const hasActiveLoan = mappedLoans.some(l => l.status === 'active');
      const status: 'active' | 'paid' = hasActiveLoan ? 'active' : 'paid';

      // Generate a string of interest rates/amounts for all active loans
      const activeRates = mappedLoans
        .filter(l => l.status === 'active')
        .map(l => {
          const typeStr = l.interestType === 'fixed' ? '₱' : '';
          const suffixStr = l.interestType === 'percentage' ? '%' : '';
          const freqStr = l.interestFrequency === 'weekly' ? 'wk' : 'mo';
          return `${typeStr}${l.interestRate}${suffixStr}/${freqStr}`;
        });
      const interestLabel = activeRates.length > 0 ? `(${activeRates.join(', ')})` : '';

      return {
        ...b,
        loans: mappedLoans,
        borrowedAmount: totalBorrowed,
        accumulatedInterest: totalInterest,
        totalPaid: totalPaid,
        status: status,
        interestLabel
      };
    });
  }, [borrowers]);

  const activeBorrowers = mappedBorrowers.filter(b => b.status === 'active');
  const totalOutstanding = activeBorrowers.reduce(
    (sum, b) => {
      // Sum the outstanding balance (Total Due - Total Paid) for active loans
      const bOutstanding = b.loans
        .filter(l => l.status === 'active')
        .reduce((s, l) => s + (l.borrowedAmount + (l.accumulatedInterest || 0) - l.totalPaid), 0);
      return sum + bOutstanding;
    },
    0
  );

  // Load members of this leader's group (derived from savers ledger)
  const members = useMemo(() => {
    return groupSavers;
  }, [groupSavers]);

  // Determine which members already have an active loan
  const activeBorrowerIdsOrNames = useMemo(() => {
    return new Set(
      borrowers
        .filter(b => b.loans && b.loans.some(l => l.status === 'active'))
        .map(b => b.uniqueId || b.name)
    );
  }, [borrowers]);

  const handleAddBorrower = async (e: React.FormEvent) => {
    e.preventDefault();

    let borrowerName = "";
    let isMemberVal = false;
    let memberUniqueId = "";
    let targetUserId: string | null = null;

    if (borrowerType === 'member') {
      const selectedMember = members.find(m => m.id === selectedMemberId);
      if (!selectedMember) {
        setFormError('Please select a group member.');
        return;
      }
      // Double check active loan constraint
      if (activeBorrowerIdsOrNames.has(selectedMember.uniqueId || selectedMember.name)) {
        setFormError('This member already has an active loan.');
        return;
      }
      borrowerName = selectedMember.name;
      isMemberVal = true;
      memberUniqueId = selectedMember.uniqueId;
      targetUserId = selectedMember.userId || null;
    } else {
      if (!outsiderName.trim()) {
        setFormError('Please enter the outsider\'s name.');
        return;
      }
      borrowerName = outsiderName.trim();
      
      // For outsiders, generate a random 8-character unique ID
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
      for (let i = 0; i < 8; i++) {
        memberUniqueId += chars.charAt(Math.floor(Math.random() * chars.length));
      }
    }

    const storedMemberInterest = localStorage.getItem('ipon_selected_group_member_interest') || '5';
    const storedNonMemberInterest = localStorage.getItem('ipon_selected_group_non_member_interest') || '10';
    const defaultInterest = isMemberVal ? parseFloat(storedMemberInterest) : parseFloat(storedNonMemberInterest);

    try {
      await addBorrowerQuery(
        groupId,
        borrowerName,
        memberUniqueId,
        0, // amount begins at 0, updated when adding a loan row
        defaultInterest,
        targetUserId
      );

      await loadData();
      setShowAddModal(false);
      
      // Reset form states
      setBorrowerType('member');
      setSelectedMemberId('');
      setOutsiderName('');
      setFormError('');
    } catch (err) {
      setFormError('Failed to add borrower.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col pb-6">
      {/* Top Banner Header */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-950 to-primary/45 px-6 pt-6 pb-20 text-white relative overflow-hidden rounded-b-[2rem] border-b border-primary/20 shadow-md">
        <div className="absolute right-0 bottom-0 translate-x-4 translate-y-4 w-32 h-32 bg-primary/10 rounded-full blur-2xl pointer-events-none" />
        
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate('/dashboard')}
            className="w-10 h-10 bg-white/10 hover:bg-white/15 border border-white/10 rounded-2xl flex items-center justify-center active:scale-95 transition"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div className="text-center">
            <h1 className="text-white text-base font-bold tracking-tight">Hiram</h1>
            <p className="text-tertiary text-xs font-light">Outstanding Loans</p>
          </div>
          <button
            onClick={() => {
              setFormError('');
              setShowAddModal(true);
            }}
            className="px-3.5 py-1.5 bg-white/10 hover:bg-white/15 border border-white/10 rounded-xl text-xs font-bold text-white flex items-center space-x-1 active:scale-95 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Borrow</span>
          </button>
        </div>
      </div>

      {/* Content Area with overlapping Card */}
      <div className="flex-1 px-6 -mt-8 relative z-10 space-y-5 flex flex-col">
        {isLoading ? (
          <div className="flex-1 bg-white rounded-3xl p-8 border border-slate-150 text-center shadow-md flex flex-col items-center justify-center min-h-[300px] animate-in fade-in">
            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-sm font-semibold text-slate-700">Loading loans portfolio...</p>
            <p className="text-xs font-light text-slate-400 mt-1">Connecting to live database ledger...</p>
          </div>
        ) : (
          <>
            {/* Digital Wallet Outstanding Loans Card */}
            <div className="bg-white rounded-2xl p-5 border border-slate-150/80 shadow-md relative overflow-hidden animate-in slide-in-from-bottom-5 duration-300">
              <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-20 h-20 bg-primary/5 rounded-full blur-xl pointer-events-none" />
              <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">Total Outstanding Portfolio</p>
              <p className="text-slate-800 text-2xl font-bold tracking-tight">
                ₱{totalOutstanding.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-slate-450 text-[10px] mt-1 font-light">{activeBorrowers.length} active loan portfolio{activeBorrowers.length !== 1 ? 's' : ''}</p>
            </div>

            {/* Borrowers list */}
            <div className="space-y-3 animate-in fade-in">
            {mappedBorrowers.map((borrower) => {
          const totalDue = borrower.borrowedAmount + borrower.accumulatedInterest;
          const initials = borrower.name
            .split(' ')
            .map(n => n[0])
            .join('')
            .slice(0, 2)
            .toUpperCase();
          
          return (
            <button
              key={borrower.id}
              onClick={() => navigate(`/hiram/${borrower.id}`)}
              className="w-full bg-white rounded-2xl p-5 border border-slate-150/80 hover:border-secondary hover:shadow-md hover:shadow-primary/5 hover:-translate-y-0.5 transition-all duration-300 active:scale-[0.98] text-left flex items-center justify-between group shadow-sm"
            >
              <div className="flex items-center space-x-4 flex-1 min-w-0">
                <div className="w-10 h-10 bg-gradient-to-tr from-primary to-tertiary rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm shadow-primary/10">
                  {initials}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1 pr-4">
                    <h3 className="text-slate-800 text-sm font-bold truncate">{borrower.name}</h3>
                    {borrower.status === 'active' ? (
                      <span className="inline-flex items-center space-x-0.5 px-1.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-100 rounded-md text-[9px] font-semibold">
                        <Clock className="w-2.5 h-2.5" />
                        <span>Active</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center space-x-0.5 px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-md text-[9px] font-semibold">
                        <CheckCircle className="w-2.5 h-2.5" />
                        <span>Paid</span>
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center space-x-4 text-xs font-light text-slate-400">
                    <p>
                      Borrowed: <span className="font-semibold text-slate-600 font-sans font-medium">₱{borrower.borrowedAmount.toLocaleString('en-PH')}</span>
                      {borrower.borrowedAmount > 0 && borrower.interestLabel && (
                        <span className="text-[10px] text-slate-400 ml-1 font-sans">
                          {borrower.interestLabel}
                        </span>
                      )}
                    </p>
                    <p>•</p>
                    <p className="flex items-center space-x-0.5">
                      <TrendingUp className="w-3.5 h-3.5 text-amber-500" />
                      <span>Interest: <span className="font-semibold text-amber-600 font-sans">₱{borrower.accumulatedInterest.toLocaleString('en-PH')}</span></span>
                    </p>
                  </div>
                </div>
              </div>
              <ChevronRight className="w-4.5 h-4.5 text-slate-300 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
            </button>
          );
        })}
            </div>
          </>
        )}
      </div>

      {/* Record Loan Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-6 z-50 animate-in fade-in duration-200">
          <form 
            onSubmit={handleAddBorrower}
            className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-50 transform transition-all duration-300 scale-95 animate-in zoom-in-95"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-slate-800 text-base font-bold">Record New Loan</h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="bg-red-50 text-red-600 border border-red-100 text-xs px-3.5 py-2.5 rounded-xl mb-4 font-medium">
                {formError}
              </div>
            )}

            {/* Borrower Type Tabs */}
            <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl mb-5">
              <button
                type="button"
                onClick={() => {
                  setBorrowerType('member');
                  setFormError('');
                }}
                className={`py-2 text-xs font-semibold rounded-lg transition ${
                  borrowerType === 'member'
                    ? 'bg-white text-slate-850 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Group Member
              </button>
              <button
                type="button"
                onClick={() => {
                  setBorrowerType('outsider');
                  setFormError('');
                }}
                className={`py-2 text-xs font-semibold rounded-lg transition ${
                  borrowerType === 'outsider'
                    ? 'bg-white text-slate-850 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Outsider
              </button>
            </div>

            {/* Selector Field */}
            {borrowerType === 'member' ? (
              <div className="mb-5">
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5 ml-1">
                  Select Member
                </label>
                <select
                  value={selectedMemberId}
                  onChange={(e) => setSelectedMemberId(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition duration-200 text-sm text-slate-800"
                  required
                >
                  <option value="">-- Choose Member --</option>
                  {members.map(m => {
                    const hasActive = activeBorrowerIdsOrNames.has(m.uniqueId || m.name);
                    return (
                      <option 
                        key={m.id} 
                        value={m.id} 
                        disabled={hasActive}
                      >
                        {m.name} {hasActive ? ' (Has active loan)' : ''}
                      </option>
                    );
                  })}
                </select>
              </div>
            ) : (
              <div className="mb-5">
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5 ml-1">
                  Outsider Name
                </label>
                <input
                  type="text"
                  value={outsiderName}
                  onChange={(e) => setOutsiderName(e.target.value)}
                  placeholder="e.g. Juan Perez"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition duration-200 text-sm text-slate-800 placeholder-slate-400"
                  required
                />
              </div>
            )}

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
                Add Borrower
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
