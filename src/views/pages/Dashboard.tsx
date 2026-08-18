import React, { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { PiggyBank, Banknote, ChevronRight, ArrowLeft, Settings, AlertCircle } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { 
  getAccountsMapFromStorage, 
  getBorrowersFromStorage, 
  calculateLoanInterest,
  Account,
  Borrower,
  Loan
} from "../../models/mockAccounts";
import { getSaversQuery } from "../../queries/savings";
import { getBorrowersQuery } from "../../queries/hiram";
import { supabase } from "../../lib/supabase";

import Header from "../components/Header";

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const groupId = localStorage.getItem('ipon_selected_group_id') || '';
  const creatorId = useMemo(() => localStorage.getItem('ipon_selected_group_creator_id') || '', [groupId]);
  const isLeader = useMemo(() => {
    if (!user) return false;
    return user.userId === creatorId;
  }, [user, creatorId]);
  
  // Find group settings
  const group = useMemo(() => {
    try {
      const name = localStorage.getItem('ipon_selected_group_name');
      if (name) {
        return {
          id: groupId,
          name,
          year: localStorage.getItem('ipon_selected_group_year') || '',
          weeklyAmount: Number(localStorage.getItem('ipon_selected_group_weekly_amount') || 1000),
          dueDay: localStorage.getItem('ipon_selected_group_due_day') || 'Sunday',
        };
      }
    } catch (e) {}
    return null;
  }, [groupId]);

  const [userAccounts, setUserAccounts] = useState<Account[]>([]);
  const [borrowers, setBorrowers] = useState<Borrower[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [memberCode, setMemberCode] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const isMockMode = (): boolean => {
    return import.meta.env.VITE_USE_MOCK === 'true' || 
           !import.meta.env.VITE_SUPABASE_URL || 
           !import.meta.env.VITE_SUPABASE_ANON_KEY;
  };

  const loadDashboardData = async () => {
    if (!groupId) return;
    try {
      const list = await getSaversQuery(groupId);
      setUserAccounts(list);

      // Load live hiram loan portfolios
      const hiramList = await getBorrowersQuery(groupId);
      setBorrowers(hiramList);

      if (user && !isMockMode()) {
        // Load the universal member code for this user in this group
        const { data: memberRow } = await supabase
          .from('group_members')
          .select('members_code')
          .eq('group_id', groupId)
          .eq('user_id', user.userId)
          .maybeSingle();

        if (memberRow) {
          setMemberCode(memberRow.members_code);
        }
      }

      if (isLeader && !isMockMode()) {
        const { count, error } = await supabase
          .from('group_members')
          .select('*', { count: 'exact', head: true })
          .eq('group_id', groupId)
          .eq('approved', false)
          .neq('user_id', creatorId);

        if (!error && count !== null) {
          setPendingCount(count);
        }
      }
    } catch (e) {
      console.error('Error loading dashboard stats:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [groupId, isLeader, user]);

  // Find matching account in the group savers
  const memberAccount = useMemo(() => {
    if (!user) return null;
    return userAccounts.find(
      acc => acc.userId === user.userId ||
             acc.name.toLowerCase().includes(user.name.toLowerCase()) || 
             user.name.toLowerCase().includes(acc.name.toLowerCase())
    ) || null;
  }, [user, userAccounts]);

  // Find matching borrower in the hiram records
  const memberBorrower = useMemo(() => {
    if (!user) return null;
    return borrowers.find(
      b => b.name.toLowerCase().includes(user.name.toLowerCase()) || 
           user.name.toLowerCase().includes(b.name.toLowerCase()) ||
           (memberAccount && b.uniqueId === memberAccount.uniqueId)
    ) || null;
  }, [user, memberAccount, borrowers]);

  // Mapped stats for leader dashboard
  const stats = useMemo(() => {
    if (!isLeader) return null;
    
    // 1. Savings Stats
    const membersCount = userAccounts.length;
    const totalSavingsSum = userAccounts.reduce((sum, acc) => sum + (acc.totalSavings || 0), 0);

    // 2. Hiram/Interest Stats
    let totalInterestSum = 0;
    let netCashOut = 0;
    borrowers.forEach(b => {
      (b.loans || []).forEach((l: Loan) => {
        const { interest } = calculateLoanInterest(l);
        totalInterestSum += interest;
        
        // Sum the net cash outflow for each loan (amount borrowed - amount returned to leader)
        netCashOut += (l.borrowedAmount - l.totalPaid);
      });
    });

    // Vault Cash is total savings collected minus cash currently out on loan
    const remainingCash = Math.max(0, totalSavingsSum - netCashOut);

    return {
      membersCount,
      totalSavings: totalSavingsSum,
      totalInterest: totalInterestSum,
      remainingCash
    };
  }, [isLeader, userAccounts, borrowers]);

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col">
      <Header />
      
      {/* Navigation & Settings Row */}
      <div className="px-6 pt-5 flex items-center justify-between">
        <button
          onClick={() => navigate('/group-selection')}
          className="text-slate-400 hover:text-slate-800 active:scale-90 transition-all duration-200 cursor-pointer p-1"
          title="Back to Groups"
        >
          <ArrowLeft className="w-5.5 h-5.5" />
        </button>

        <button
          onClick={() => navigate('/group-settings')}
          className="text-slate-400 hover:text-slate-800 active:scale-90 transition-all duration-200 cursor-pointer p-1"
          title="Group Settings"
        >
          <Settings className="w-5.5 h-5.5" />
        </button>
      </div>

      <div className="flex-1 p-6 animate-in fade-in duration-300">
        {/* Welcome card banner */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-950 to-primary/45 rounded-3xl p-6 mb-6 text-white shadow-xl relative overflow-hidden border border-slate-800">
          <div className="absolute right-0 bottom-0 translate-x-4 translate-y-4 w-32 h-32 bg-primary/10 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute left-1/3 top-0 -translate-y-4 w-24 h-24 bg-tertiary/10 rounded-full blur-xl pointer-events-none" />
          
          <div className="text-tertiary text-xs font-semibold uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>{group ? group.name : "Financial Portal"}</span>
            {memberCode && (
              <span className="bg-white/10 px-2 py-0.5 rounded text-[9px] font-bold normal-case tracking-normal">
                Universal Code: {memberCode}
              </span>
            )}
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white mb-2">
            Hello, {user && user.name ? user.name.split(" ")[0] : "User"}!
          </h1>
          <p className="text-slate-350 text-xs font-light leading-relaxed">
            {isLeader 
              ? "Manage savings groups and track loan portfolios with accumulated interests."
              : "Track your personal ipon savings, borrow balances, and loan interest rates."}
          </p>
        </div>

        {/* Pending Join Requests Notification Banner */}
        {isLeader && pendingCount > 0 && (
          <div className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-3xl p-5 mb-6 text-white shadow-lg animate-in slide-in-from-top-2 duration-300 flex items-center justify-between">
            <div className="min-w-0 pr-2">
              <h3 className="font-bold text-xs mb-0.5 uppercase tracking-wider flex items-center">
                <AlertCircle className="w-3.5 h-3.5 mr-1" />
                <span>Pending Approvals</span>
              </h3>
              <p className="text-[10px] text-white/90 font-light leading-relaxed">
                There {pendingCount === 1 ? 'is 1 member' : `are ${pendingCount} members`} waiting for approval to join this group.
              </p>
            </div>
            <button
              onClick={() => navigate('/pending-approvals')}
              className="bg-white text-orange-600 hover:bg-slate-50 px-3.5 py-2 rounded-xl text-[9px] font-bold shadow-md transition active:scale-95 flex-shrink-0 cursor-pointer uppercase tracking-wider"
            >
              Approve
            </button>
          </div>
        )}

        {/* Cash Handled Vault Card for Leader */}
        {isLeader && stats && (
          <div className="bg-white rounded-3xl p-5 border border-slate-150/80 shadow-sm mb-6 relative overflow-hidden flex justify-between items-center animate-in slide-in-from-top-2 duration-300">
            <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl pointer-events-none" />
            <div>
              <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-1">Vault / Handled Cash (Remaining)</p>
              <p className="text-2xl font-bold text-emerald-600 font-sans">
                ₱{stats.remainingCash.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-[10px] text-slate-400 mt-1 font-light">
                Total Savings Collected: ₱{stats.totalSavings.toLocaleString('en-PH', { maximumFractionDigits: 0 })} • Net Loan Outflow: ₱{(stats.totalSavings - stats.remainingCash).toLocaleString('en-PH', { maximumFractionDigits: 0 })}
              </p>
            </div>
            <div className="bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-xl border border-emerald-100 flex items-center space-x-1">
              <span className="text-[9px] font-bold uppercase tracking-wider">In Hand</span>
            </div>
          </div>
        )}

        {/* Leader Summary Stats Dashboard Row */}
        {isLeader && stats && (
          <div className="grid grid-cols-3 gap-3 mb-6 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="bg-white rounded-2xl p-3.5 border border-slate-150/80 shadow-sm text-center">
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-1">Members</p>
              <p className="text-base font-bold text-slate-800 font-sans">{stats.membersCount}</p>
            </div>
            <div className="bg-white rounded-2xl p-3.5 border border-slate-150/80 shadow-sm text-center">
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-1">Total Money</p>
              <p className="text-sm font-bold text-primary font-sans">
                ₱{stats.totalSavings.toLocaleString('en-PH', { maximumFractionDigits: 0 })}
              </p>
            </div>
            <div className="bg-white rounded-2xl p-3.5 border border-slate-150/80 shadow-sm text-center">
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-1">Total Interest</p>
              <p className="text-sm font-bold text-amber-600 font-sans">
                ₱{stats.totalInterest.toLocaleString('en-PH', { maximumFractionDigits: 0 })}
              </p>
            </div>
          </div>
        )}

        {isLeader ? (
          <div className="space-y-4">
            <button
              onClick={() => navigate("/ipon-ipon")}
              className="w-full bg-white rounded-2xl shadow-sm shadow-slate-100 p-6 border border-slate-150/80 hover:border-secondary hover:shadow-md hover:shadow-primary/5 hover:-translate-y-0.5 transition-all duration-300 active:scale-[0.98] text-left group flex items-center justify-between cursor-pointer"
            >
              <div className="flex items-center space-x-4">
                <div className="w-14 h-14 bg-gradient-to-br from-primary to-tertiary rounded-2xl flex items-center justify-center flex-shrink-0 shadow-md shadow-primary/10">
                  <PiggyBank className="w-6.5 h-6.5 text-white" />
                </div>
                <div>
                  <h2 className="text-slate-800 text-base font-bold mb-0.5">Ipon-Ipon</h2>
                  <p className="text-slate-400 text-xs font-light">Manage savings groups & savings entries</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
            </button>

            <button
              onClick={() => navigate("/hiram")}
              className="w-full bg-white rounded-2xl shadow-sm shadow-slate-100 p-6 border border-slate-150/80 hover:border-secondary hover:shadow-md hover:shadow-primary/5 hover:-translate-y-0.5 transition-all duration-300 active:scale-[0.98] text-left group flex items-center justify-between cursor-pointer"
            >
              <div className="flex items-center space-x-4">
                <div className="w-14 h-14 bg-gradient-to-br from-primary to-primary/80 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-md shadow-primary/10">
                  <Banknote className="w-6.5 h-6.5 text-white" />
                </div>
                <div>
                  <h2 className="text-slate-800 text-base font-bold mb-0.5">Hiram</h2>
                  <p className="text-slate-400 text-xs font-light">
                    Track user loans & monthly interest rates
                  </p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* My Savings Summary Card */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-150/80 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center">
                    <PiggyBank className="w-5.5 h-5.5" />
                  </div>
                  <div>
                    <h3 className="text-slate-800 text-sm font-bold">My Savings</h3>
                    <p className="text-[10px] text-slate-400 font-light">ID: {memberAccount ? memberAccount.uniqueId : 'N/A'}</p>
                  </div>
                </div>
                {memberAccount && (
                  <button
                    onClick={() => navigate(`/ipon-ipon/${memberAccount.id}`)}
                    className="text-primary hover:text-primary/80 text-xs font-bold flex items-center space-x-0.5 cursor-pointer"
                  >
                    <span>Full Ledger</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {memberAccount ? (
                <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Total Savings</p>
                    <p className="text-2xl font-bold text-slate-800 font-sans">
                      ₱{memberAccount.totalSavings.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="text-right text-xs font-light text-slate-400">
                    <p>Accounts: <span className="font-semibold text-slate-700">{memberAccount.accountsCount}</span></p>
                    <p>Cycle due: <span className="font-semibold text-slate-700">{group?.dueDay}s</span></p>
                  </div>
                </div>
              ) : (
                <div className="pt-2 border-t border-slate-100 text-center py-4">
                  <p className="text-slate-800 text-xs font-bold mb-1">Savings Record Pending</p>
                  <p className="text-slate-400 text-[10px] font-light max-w-[280px] mx-auto leading-relaxed">
                    You are not registered in the saver roster. Ask the leader to register you as **{user?.name}**.
                  </p>
                </div>
              )}
            </div>

            {/* My Hiram Summary Card */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-150/80 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center">
                    <Banknote className="w-5.5 h-5.5" />
                  </div>
                  <div>
                    <h3 className="text-slate-800 text-sm font-bold">My Hiram Loans</h3>
                    <p className="text-[10px] text-slate-400 font-light">Outstanding balance summary</p>
                  </div>
                </div>
                {memberBorrower && (
                  <button
                    onClick={() => navigate(`/hiram/${memberBorrower.id}`)}
                    className="text-primary hover:text-primary/80 text-xs font-bold flex items-center space-x-0.5 cursor-pointer"
                  >
                    <span>Loan Details</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {memberBorrower && memberBorrower.loans && memberBorrower.loans.filter((l: Loan) => l.status === 'active').length > 0 ? (
                <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Outstanding Balance</p>
                    <p className="text-2xl font-bold text-slate-800 font-sans">
                      ₱{memberBorrower.loans
                        .filter((l: Loan) => l.status === 'active')
                        .reduce((sum: number, l: Loan) => {
                          const { interest } = calculateLoanInterest(l);
                          const remainingPrincipal = Math.max(0, l.borrowedAmount - (l.principalPaid || 0));
                          const remainingInterest = Math.max(0, interest - (l.interestPaid || 0));
                          return sum + remainingPrincipal + remainingInterest;
                        }, 0)
                        .toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="text-right text-xs font-light text-slate-400">
                    <p>Active Loans: <span className="font-semibold text-slate-700">
                      {memberBorrower.loans.filter((l: Loan) => l.status === 'active').length}
                    </span></p>
                  </div>
                </div>
              ) : (
                <div className="pt-2 border-t border-slate-100 text-center py-4">
                  <p className="text-slate-500 text-xs font-light">
                    You have no active loans or hiram liabilities with this group.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
