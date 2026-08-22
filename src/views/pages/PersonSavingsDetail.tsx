import React, { useState, useMemo, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, MoreVertical, X } from "lucide-react";
import { SavingsEntry } from "../../models/mockAccounts";
import { useAuth } from "../../hooks/useAuth";
import { getSaversQuery, recordPaymentQuery } from "../../queries/savings";

export default function PersonSavingsDetail() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { personId } = useParams();
  const [showPayModal, setShowPayModal] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<SavingsEntry | null>(null);
  const [customAmount, setCustomAmount] = useState("");

  const creatorId = useMemo(() => localStorage.getItem('ipon_selected_group_creator_id') || '', []);
  const groupId = useMemo(() => localStorage.getItem('ipon_selected_group_id') || '', []);

  const isLeader = useMemo(() => {
    if (!user) return false;
    return user.userId === creatorId;
  }, [user, creatorId]);

  // Get accounts in local state
  const [userAccounts, setUserAccounts] = useState<any[]>([]);

  // Function to reload data from Supabase
  const reloadData = async () => {
    if (groupId) {
      try {
        const list = await getSaversQuery(groupId);
        setUserAccounts(list);
      } catch (err) {
        console.error('Error fetching savings list:', err);
      }
    }
  };

  useEffect(() => {
    reloadData();
  }, [groupId]);

  // Find matching account in the group savers
  const memberAccount = useMemo(() => {
    if (!user) return null;
    return userAccounts.find(
      acc => acc.userId === user.userId ||
             acc.name.toLowerCase().includes(user.name.toLowerCase()) || 
             user.name.toLowerCase().includes(acc.name.toLowerCase())
    ) || null;
  }, [user, userAccounts]);

  // Use current user's accounts data
  const person = useMemo(() => {
    return (
      userAccounts.find((acc) => String(acc.id) === String(personId)) || null
    );
  }, [userAccounts, personId]);

  // Access check
  const hasAccess = useMemo(() => {
    if (isLeader) return true;
    if (!user || !person) return false;
    return person.name.toLowerCase().includes(user.name.toLowerCase()) ||
           user.name.toLowerCase().includes(person.name.toLowerCase()) ||
           (memberAccount && person.uniqueId === memberAccount.uniqueId);
  }, [isLeader, user, person, memberAccount]);

  const entries = useMemo<SavingsEntry[]>(() => {
    return person?.entries || [];
  }, [person]);

  const expectedAmount = useMemo(() => {
    try {
      const storedAmount = localStorage.getItem('ipon_selected_group_weekly_amount');
      if (storedAmount) return parseFloat(storedAmount);
    } catch (e) {}
    return 1000;
  }, []);

  const confirmAddAmount = async () => {
    const amountVal = parseFloat(customAmount);
    if (person && selectedEntry && !isNaN(amountVal)) {
      try {
        await recordPaymentQuery(person.id, selectedEntry.id, amountVal);
        await reloadData();
      } catch (err) {
        alert("Failed to record savings payment.");
      }
    }
    setShowPayModal(false);
    setSelectedEntry(null);
    setCustomAmount("");
  };

  if (!person) {
    return (
      <div className="min-h-screen bg-slate-50 pb-6 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-600">No account found</p>
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-slate-50/50 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 bg-red-50 border border-red-150 rounded-2xl flex items-center justify-center mb-4 text-red-500 shadow-sm mx-auto">
          <X className="w-8 h-8" />
        </div>
        <h2 className="text-slate-800 text-base font-bold mb-1">Access Denied</h2>
        <p className="text-slate-400 text-xs font-light max-w-xs mb-6 leading-relaxed">
          You do not have permission to view other group members' savings ledgers.
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
      {/* Top Banner Header (Clean, thin) */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-950 to-primary/45 px-6 pt-6 pb-20 text-white relative overflow-hidden rounded-b-3xl border-b border-primary/20 shadow-md">
        <div className="absolute right-0 bottom-0 translate-x-4 translate-y-4 w-32 h-32 bg-primary/10 rounded-full blur-2xl pointer-events-none" />
        
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate(isLeader ? "/ipon-ipon" : "/dashboard")}
            className="w-10 h-10 bg-white/10 hover:bg-white/15 border border-white/10 rounded-2xl flex items-center justify-center active:scale-95 transition cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div className="text-center">
            <h2 className="text-white text-base font-bold tracking-tight">{person.name}</h2>
            <p className="text-slate-400 text-xs font-light">{person.uniqueId}</p>
          </div>
          <div className="w-10" />
        </div>
      </div>

      {/* Main Content Area */}
      <div className="px-6 -mt-8 relative z-10 space-y-6 flex-1 flex flex-col">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-2xl p-4 border border-slate-150/80 shadow-md">
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-1">Total Savings</p>
            <p className="text-slate-800 text-base font-extrabold">
              ₱{person.totalSavings.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-slate-150/80 shadow-md">
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-1">Accounts</p>
            <p className="text-slate-800 text-base font-extrabold">
              {person.accountsCount || 1} account{ (person.accountsCount || 1) !== 1 ? 's' : '' }
            </p>
          </div>
        </div>

        {/* Transaction Feed Table Section */}
        <div className="flex-1">
        <h3 className="text-slate-800 text-xs font-bold mb-3.5 uppercase tracking-wider pl-1.5">Payment Timeline</h3>
        
        {entries.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center shadow-sm">
            <p className="text-slate-500 text-sm">No savings entries recorded yet.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-150/80 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-150/80 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="px-4 py-3 font-semibold">Date</th>
                    <th className="px-4 py-3 font-semibold">Status / Amount</th>
                    {isLeader && <th className="px-4 py-3 text-right font-semibold">Action</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 text-xs">
                  {(() => {
                    const todayStr = new Date().toISOString().split('T')[0];
                    const personExpectedWeekly = expectedAmount * (person.accountsCount || 1);
                    
                    let lastMonth = "";
                    
                    return entries.map((entry) => {
                      const entryDateObj = new Date(entry.date);
                      const currentMonth = entryDateObj.toLocaleDateString("en-US", { month: "long" });
                      const dateFormatted = entryDateObj.toLocaleDateString("en-US", {
                        month: "short",
                        day: "2-digit",
                      });
                      
                      const showMonthSeparator = currentMonth !== lastMonth;
                      lastMonth = currentMonth;
                      
                      // Status logic
                      let statusBadge = null;
                      if (entry.amountPaid === 0) {
                        if (entry.date < todayStr) {
                          statusBadge = (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-red-50 text-red-700 text-[9px] font-bold border border-red-100 uppercase tracking-wide">
                              Delayed
                            </span>
                          );
                        } else {
                          statusBadge = (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-50 text-slate-500 text-[9px] font-bold border border-slate-200 uppercase tracking-wide">
                              Pending
                            </span>
                          );
                        }
                      } else if (entry.amountPaid < personExpectedWeekly) {
                        const balance = personExpectedWeekly - entry.amountPaid;
                        statusBadge = (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 text-[9px] font-bold border border-amber-100 uppercase tracking-wide font-mono">
                            Bal: ₱{balance.toLocaleString("en-PH")}
                          </span>
                        );
                      } else {
                        statusBadge = (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[9px] font-bold border border-emerald-100 uppercase tracking-wide">
                            Paid
                          </span>
                        );
                      }
                      
                      return (
                        <React.Fragment key={entry.id}>
                          {showMonthSeparator && (
                            <tr className="bg-slate-100/60 border-t border-slate-200">
                              <td colSpan={3} className="px-4 py-2 text-[10px] font-bold text-slate-800 uppercase tracking-wider border-b border-slate-200/80">
                                {currentMonth} {entryDateObj.getFullYear()}
                              </td>
                            </tr>
                          )}
                          <tr className="hover:bg-slate-50/50 transition">
                            <td className="px-4 py-3 font-semibold text-slate-700">
                              {dateFormatted}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center space-x-1.5">
                                {statusBadge}
                                {person.accountsCount && person.accountsCount > 1 && (
                                  <span className="text-[9px] text-slate-400 font-light lowercase italic">
                                    (2 accounts)
                                  </span>
                                )}
                              </div>
                            </td>
                            {isLeader && (
                              <td className="px-4 py-3 text-right">
                                <button
                                  onClick={() => {
                                    setSelectedEntry(entry);
                                    setCustomAmount(entry.amountPaid > 0 ? String(entry.amountPaid) : String(personExpectedWeekly));
                                    setShowPayModal(true);
                                  }}
                                  className="px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary text-primary hover:text-white text-[10px] font-bold transition active:scale-95 cursor-pointer"
                                >
                                  Record
                                </button>
                              </td>
                            )}
                          </tr>
                        </React.Fragment>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>

    {/* Unified Record Payment Modal */}
    {showPayModal && selectedEntry && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-6 z-50 animate-in fade-in duration-200">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              confirmAddAmount();
            }}
            className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-50 transform transition-all duration-300 scale-95 animate-in zoom-in-95"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-slate-800 text-lg font-bold">Record Payment</h3>
              <button
                type="button"
                onClick={() => {
                  setShowPayModal(false);
                  setSelectedEntry(null);
                }}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <p className="text-slate-500 text-xs mb-4 leading-relaxed">
              Enter savings deposit for week date <span className="font-semibold text-slate-700">
                {new Date(selectedEntry.date).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>.
            </p>

            <div className="mb-5">
              <label htmlFor="paymentInput" className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2 ml-1">
                Amount Paid (₱)
              </label>
              <input
                id="paymentInput"
                type="number"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition duration-200 text-base font-bold text-slate-850"
                autoFocus
                required
              />
              <p className="text-[10px] text-slate-400 font-light mt-1.5">
                Expected: ₱{(expectedAmount * (person.accountsCount || 1)).toLocaleString("en-PH")} {person.accountsCount && person.accountsCount > 1 ? `(${person.accountsCount} accounts)` : ''}
              </p>
            </div>

            <div className="flex space-x-3">
              <button
                type="button"
                onClick={() => {
                  setShowPayModal(false);
                  setSelectedEntry(null);
                }}
                className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition active:scale-98"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-3 rounded-xl bg-primary hover:bg-primary/95 text-white text-sm font-semibold hover:shadow-lg hover:shadow-primary/10 transition active:scale-98"
              >
                Confirm Deposit
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
