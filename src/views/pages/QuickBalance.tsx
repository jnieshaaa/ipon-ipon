import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Landmark, PiggyBank, Banknote, ShieldAlert, Calendar, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export default function QuickBalance() {
  const navigate = useNavigate();
  const [quickCode, setQuickCode] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [balanceResult, setBalanceResult] = useState<any | null>(null);
  const [balanceError, setBalanceError] = useState('');

  const isMockMode = (): boolean => {
    return import.meta.env.VITE_USE_MOCK === 'true' || 
           !import.meta.env.VITE_SUPABASE_URL || 
           !import.meta.env.VITE_SUPABASE_ANON_KEY;
  };

  const handleCheckBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    setBalanceError('');
    setBalanceResult(null);
    const code = quickCode.trim().toUpperCase();
    if (code.length !== 8) {
      setBalanceError('Universal code must be exactly 8 characters.');
      return;
    }

    setIsChecking(true);

    try {
      let targetUserId: string | null = null;
      let targetGroupId: string | null = null;

      // 1. Search group_members to see if this is an online member's universal code
      const { data: membership } = await supabase
        .from('group_members')
        .select('user_id, group_id')
        .eq('members_code', code)
        .maybeSingle();

      if (membership) {
        targetUserId = membership.user_id;
        targetGroupId = membership.group_id;
      }

      // 2. Query savings account details
      let accountsQuery = supabase.from('savings_accounts').select(`
        id,
        name,
        total_savings,
        accounts_count,
        unique_id,
        group:savings_groups (
          name,
          cycle_year,
          weekly_amount
        ),
        entries:savings_entries (
          id,
          week_range,
          amount_paid,
          entry_date
        )
      `);

      if (targetUserId && targetGroupId) {
        // Search by membership relationship
        accountsQuery = accountsQuery.eq('user_id', targetUserId).eq('group_id', targetGroupId);
      } else {
        // Search by unique_id code directly (offline guest saver)
        accountsQuery = accountsQuery.eq('unique_id', code);
      }

      const { data: accounts, error: savingsError } = await accountsQuery;

      // 3. Query borrowers details
      let loansQuery = supabase.from('borrowers').select('name, borrowed_amount, total_paid, status, borrow_date');
      if (targetUserId) {
        loansQuery = loansQuery.eq('user_id', targetUserId);
      } else {
        loansQuery = loansQuery.eq('unique_id', code);
      }
      const { data: loans, error: loansError } = await loansQuery;

      if (savingsError && loansError) {
        throw new Error("Unable to check balance for this code.");
      }

      const hasSavings = accounts && accounts.length > 0;
      const hasLoans = loans && loans.length > 0;

      if (!hasSavings && !hasLoans) {
        setBalanceError('No records found for this code. Verify your code and try again.');
        setIsChecking(false);
        return;
      }

      const account = accounts?.[0];

      // Self-healing: if the unique_id in savings_account doesn't match the universal code, fix it now!
      if (account && targetUserId && account.unique_id !== code) {
        await supabase
          .from('savings_accounts')
          .update({ unique_id: code })
          .eq('id', account.id);
      }

      const totalSavings = (accounts || []).reduce((sum, a) => sum + Number(a.total_savings || 0), 0);
      const accountsCount = (accounts || []).reduce((sum, a) => sum + Number(a.accounts_count || 1), 0);
      const name = account?.name || loans?.[0]?.name || 'Member';
      const groupName = (account as any)?.group?.name || 'Savings Group';
      const groupYear = (account as any)?.group?.cycle_year || '2026';
      const weeklyAmount = Number((account as any)?.group?.weekly_amount || 1000);

      // Sort weekly entries
      const entries = account?.entries || [];
      const sortedEntries = [...entries].sort((a: any, b: any) => a.entry_date.localeCompare(b.entry_date));

      const activeLoans = (loans || []).filter(l => l.status === 'active');
      const totalLoanAmount = activeLoans.reduce((sum, l) => sum + Number(l.borrowed_amount || 0), 0);
      const totalPaidAmount = (loans || []).reduce((sum, l) => sum + Number(l.total_paid || 0), 0);
      const outstandingLoanPrincipal = Math.max(0, totalLoanAmount - totalPaidAmount);

      setBalanceResult({
        name,
        groupName,
        groupYear,
        totalSavings,
        accountsCount,
        weeklyAmount,
        outstandingLoanPrincipal,
        activeLoansCount: activeLoans.length,
        loans: loans || [],
        entries: sortedEntries
      });
    } catch (err) {
      console.error(err);
      setBalanceError('An error occurred while fetching your balance.');
    } finally {
      setIsChecking(false);
    }
  };

  const getWeekStatusBadge = (entry: any, weeklyAmount: number, accountsCount: number) => {
    const todayStr = new Date().toISOString().split('T')[0];
    const amountPaid = Number(entry.amount_paid || 0);
    const requiredAmount = weeklyAmount * accountsCount;

    if (amountPaid >= requiredAmount) {
      return (
        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-100">
          <CheckCircle2 className="w-3 h-3" />
          <span>Paid</span>
        </span>
      );
    } else if (amountPaid > 0) {
      return (
        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-600 border border-amber-100">
          <span>Partial</span>
        </span>
      );
    } else if (entry.entry_date < todayStr) {
      return (
        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-650 border border-red-100">
          <AlertCircle className="w-3 h-3" />
          <span>Overdue</span>
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500">
          <span>Pending</span>
        </span>
      );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 px-6 py-4 flex items-center space-x-4 shadow-sm flex-shrink-0">
        <button
          onClick={() => {
            if (balanceResult) {
              setBalanceResult(null);
            } else {
              navigate('/login');
            }
          }}
          className="text-slate-500 hover:text-slate-800 transition p-1 cursor-pointer"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div>
          <h2 className="text-slate-800 text-base font-extrabold">Quick Balance Inquiry</h2>
          <p className="text-[10px] text-slate-400 font-light">View live accounts status without logging in</p>
        </div>
      </div>

      <div className="flex-1 p-6 overflow-y-auto">
        {!balanceResult ? (
          <div className="max-w-md mx-auto bg-white rounded-3xl p-6 border border-slate-150 shadow-md space-y-6 mt-4">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 bg-gradient-to-br from-primary/10 to-tertiary/10 rounded-2xl flex items-center justify-center mx-auto border border-primary/10 shadow-sm">
                <Landmark className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-slate-800 text-lg font-extrabold">Check Your Balance</h3>
              <p className="text-xs text-slate-400 font-light leading-relaxed max-w-[280px] mx-auto">
                Enter your 8-character universal member code to query savings deposits and outstanding loans.
              </p>
            </div>

            {balanceError && (
              <div className="bg-red-50 border border-red-100 text-red-650 px-4 py-3 rounded-2xl text-xs font-semibold text-center flex items-center justify-center space-x-1.5 animate-pulse">
                <ShieldAlert className="w-4 h-4" />
                <span>{balanceError}</span>
              </div>
            )}

            <form onSubmit={handleCheckBalance} className="space-y-4">
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 text-center">
                  Universal Member Code
                </label>
                <input
                  type="text"
                  maxLength={8}
                  value={quickCode}
                  onChange={(e) => setQuickCode(e.target.value)}
                  placeholder="E.G. JC3H9F1Z"
                  className="w-full px-4 py-4 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary text-base font-mono font-bold tracking-widest text-center text-slate-800 placeholder-slate-350 bg-slate-50/50"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isChecking || quickCode.trim().length !== 8}
                className="w-full bg-gradient-to-r from-primary to-tertiary text-white py-4 rounded-2xl font-bold shadow-lg shadow-primary/10 hover:shadow-xl hover:shadow-primary/20 transition-all duration-200 active:scale-[0.98] disabled:opacity-50 text-sm cursor-pointer"
              >
                {isChecking ? 'Fetching Records...' : 'Check Balance'}
              </button>
            </form>
          </div>
        ) : (
          <div className="max-w-xl mx-auto space-y-6 animate-in fade-in duration-300">
            {/* Guest Profile Card Banner */}
            <div className="bg-gradient-to-br from-slate-900 via-slate-950 to-primary/40 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden border border-slate-800">
              <div className="absolute right-0 bottom-0 translate-x-4 translate-y-4 w-28 h-28 bg-primary/10 rounded-full blur-2xl pointer-events-none" />
              
              <div className="flex items-center justify-between mb-4">
                <div>
                  <span className="bg-white/10 px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold">
                    Code: {quickCode.toUpperCase()}
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-tertiary font-bold uppercase tracking-wider">{balanceResult.groupName}</p>
                  <p className="text-[9px] text-slate-400 font-light mt-0.5">Cycle {balanceResult.groupYear}</p>
                </div>
              </div>

              <h3 className="text-xl font-bold tracking-tight text-white">{balanceResult.name}</h3>
              <p className="text-xs text-slate-400 font-light mt-1">Universal Member Profile Lookup</p>
            </div>

            {/* Totals Summary grid */}
            <div className="grid grid-cols-2 gap-4">
              {/* Savings Card */}
              <div className="bg-white rounded-3xl border border-slate-150 p-5 shadow-sm space-y-3 flex flex-col justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-9 h-9 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                    <PiggyBank className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Total Savings</span>
                </div>
                <div>
                  <p className="text-2xl font-black text-slate-800">
                    ₱{balanceResult.totalSavings.toLocaleString('en-PH')}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1 font-light">
                    {balanceResult.accountsCount} active saver slot{balanceResult.accountsCount !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>

              {/* Hiram Card */}
              <div className="bg-white rounded-3xl border border-slate-150 p-5 shadow-sm space-y-3 flex flex-col justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-9 h-9 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
                    <Banknote className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Loan Balance</span>
                </div>
                <div>
                  <p className="text-2xl font-black text-slate-800">
                    ₱{balanceResult.outstandingLoanPrincipal.toLocaleString('en-PH')}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1 font-light">
                    {balanceResult.activeLoansCount} active borrowing{balanceResult.activeLoansCount !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
            </div>

            {/* Weekly Deposits Timeline / Ledger */}
            {balanceResult.entries.length > 0 && (
              <div className="bg-white rounded-3xl border border-slate-150 p-5 shadow-sm space-y-4">
                <div className="flex items-center space-x-2.5 pb-2 border-b border-slate-100">
                  <Calendar className="w-5 h-5 text-primary" />
                  <div>
                    <h4 className="text-slate-800 text-sm font-bold">Timeline Ledger (Weeks)</h4>
                    <p className="text-[10px] text-slate-400 font-light">Weekly required savings target: ₱{(balanceResult.weeklyAmount * balanceResult.accountsCount).toLocaleString('en-PH')}</p>
                  </div>
                </div>

                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {balanceResult.entries.map((entry: any, index: number) => {
                    const amountPaid = Number(entry.amount_paid || 0);
                    return (
                      <div
                        key={entry.id}
                        className="flex items-center justify-between p-3 rounded-2xl border border-slate-100 hover:bg-slate-50/50 transition duration-150"
                      >
                        <div>
                          <p className="text-xs font-bold text-slate-700">{entry.week_range.split(" (")[0]}</p>
                          <p className="text-[10px] text-slate-400 font-light mt-0.5">Due: {entry.entry_date}</p>
                        </div>
                        <div className="flex items-center space-x-3 text-right">
                          <div>
                            <p className="text-xs font-bold text-slate-800">₱{amountPaid.toLocaleString('en-PH')}</p>
                            <p className="text-[9px] text-slate-400 font-light">Amount Paid</p>
                          </div>
                          {getWeekStatusBadge(entry, balanceResult.weeklyAmount, balanceResult.accountsCount)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Close Button / Bottom Nav */}
            <div className="flex space-x-3">
              <button
                type="button"
                onClick={() => {
                  setBalanceResult(null);
                  setQuickCode('');
                  setBalanceError('');
                }}
                className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-xs font-bold active:scale-95 transition cursor-pointer"
              >
                Lookup Another Code
              </button>
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="flex-1 py-4 bg-primary hover:bg-primary/95 text-white rounded-2xl text-xs font-bold active:scale-95 transition cursor-pointer"
              >
                Back to Login
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
