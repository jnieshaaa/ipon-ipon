import React, { useState, useMemo, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Search, Plus, Users, ChevronRight, Check, X, Trash2, Link as LinkIcon, AlertCircle, Edit3, MoreVertical } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { Account } from "../../models/mockAccounts";
import { getSaversQuery, deleteSaverQuery, transferSaverAccountQuery, updateSaverAccountsCountQuery } from "../../queries/savings";
import { getPendingApprovalsQuery, approveMemberQuery, removeMemberQuery } from "../../queries/groups";
import { supabase } from "../../lib/supabase";

interface SavingsPerson {
  id: string;
  name: string;
  totalSavings: number;
  delayedWeeks: string[];
  userId?: string;
  uniqueId: string;
  accountsCount: number;
}

export default function IponIponOverview() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  
  const selectedYear = searchParams.get("year") || new Date().getFullYear().toString();
  const [searchQuery, setSearchQuery] = useState("");
  const [savers, setSavers] = useState<Account[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);
  const [approvedMembers, setApprovedMembers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showLinkModal, setShowLinkModal] = useState<string | null>(null); // holds accountId to link
  const [selectedMemberToLink, setSelectedMemberToLink] = useState("");
  const [showEditAccountsModal, setShowEditAccountsModal] = useState<SavingsPerson | null>(null);
  const [editAccountsVal, setEditAccountsVal] = useState("1");
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  const creatorId = useMemo(() => localStorage.getItem('ipon_selected_group_creator_id') || '', []);
  const groupId = useMemo(() => localStorage.getItem('ipon_selected_group_id') || '', []);
  const groupCode = useMemo(() => localStorage.getItem('ipon_selected_group_code') || '', []);
  
  const isLeader = useMemo(() => {
    if (!user) return false;
    return user.userId === creatorId;
  }, [user, creatorId]);

  // Find matching account in the group savers
  const memberAccount = useMemo(() => {
    if (!user) return null;
    return savers.find(
      acc => acc.userId === user.userId ||
             acc.name.toLowerCase().includes(user.name.toLowerCase()) || 
             user.name.toLowerCase().includes(acc.name.toLowerCase())
    ) || null;
  }, [user, savers]);

  const loadData = async () => {
    if (!groupId) return;
    try {
      // 1. Fetch savers
      const saversList = await getSaversQuery(groupId);
      setSavers(saversList);

      // 2. Fetch pending approvals (only if leader)
      if (isLeader) {
        const pending = await getPendingApprovalsQuery(groupId);
        setPendingApprovals(pending);

        // Fetch approved group members to allow linking
        const { data: members, error: membersError } = await supabase
          .from('group_members')
          .select('user_id')
          .eq('group_id', groupId)
          .eq('approved', true);

        if (!membersError && members && members.length > 0) {
          const userIds = members.map((m: any) => m.user_id);
          const { data: profiles, error: profilesError } = await supabase
            .from('users')
            .select('id, username, email')
            .in('id', userIds);

          if (!profilesError && profiles) {
            const profilesMap = new Map(profiles.map(p => [p.id, p]));
            setApprovedMembers(members.map((m: any) => {
              const p = profilesMap.get(m.user_id);
              return {
                userId: m.user_id,
                username: p?.username || 'Member',
                email: p?.email || ''
              };
            }));
          }
        } else if (members && members.length === 0) {
          setApprovedMembers([]);
        }
      }
    } catch (err) {
      console.error('Error loading savers:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [groupId, isLeader]);

  // Redirect if regular member (after initial load completes)
  useEffect(() => {
    if (!isLoading && user && !isLeader) {
      if (memberAccount) {
        navigate(`/ipon-ipon/${memberAccount.id}`, { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    }
  }, [user, isLeader, memberAccount, navigate, isLoading]);

  const dueDay = useMemo(() => {
    return localStorage.getItem('ipon_selected_group_due_day') || 'Sunday';
  }, []);

  // Convert accounts to people list, checking for delayed weeks
  const people = useMemo<SavingsPerson[]>(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    return savers.map((acc) => {
      // A week is delayed if its scheduled date has passed and amountPaid is 0
      const delayedList = acc.entries
        .filter(entry => entry.date < todayStr && (entry.amountPaid || 0) === 0)
        .map((entry, idx) => entry.weekRange || `W${idx + 1}`);

      return {
        id: acc.id,
        name: acc.name,
        totalSavings: acc.totalSavings,
        delayedWeeks: delayedList,
        userId: acc.userId,
        uniqueId: acc.uniqueId,
        accountsCount: acc.accountsCount || 1
      };
    });
  }, [savers]);

  const totalSavings = people.reduce(
    (sum, person) => sum + person.totalSavings,
    0,
  );

  const filteredPeople = people.filter((person) =>
    person.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  // Approval actions
  const handleApproveMember = async (memberUserId: string) => {
    if (confirm("Are you sure you want to approve this member's join request?")) {
      try {
        await approveMemberQuery(groupId, memberUserId);
        await loadData();
      } catch (err) {
        alert("Failed to approve member.");
      }
    }
  };

  const handleDenyMember = async (memberUserId: string) => {
    if (confirm("Are you sure you want to deny this member's join request?")) {
      try {
        await removeMemberQuery(groupId, memberUserId);
        await loadData();
      } catch (err) {
        alert("Failed to remove member.");
      }
    }
  };

  // Remove saver account
  const handleDeleteSaver = async (accountId: string, name: string) => {
    if (confirm(`Are you sure you want to delete "${name}"? All their savings data and ledger history will be permanently erased.`)) {
      try {
        await deleteSaverQuery(accountId);
        await loadData();
      } catch (err) {
        alert("Failed to delete saver account.");
      }
    }
  };

  // Link guest to member account
  const handleLinkAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showLinkModal || !selectedMemberToLink) return;
    try {
      await transferSaverAccountQuery(showLinkModal, selectedMemberToLink);
      setShowLinkModal(null);
      setSelectedMemberToLink("");
      await loadData();
      alert("Saver ledger successfully linked to member account!");
    } catch (err) {
      alert("Failed to link account.");
    }
  };

  const handleEditAccountsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showEditAccountsModal) return;
    const countVal = parseInt(editAccountsVal);
    if (isNaN(countVal) || countVal < 1) {
      alert("Please enter a valid count of accounts.");
      return;
    }
    try {
      await updateSaverAccountsCountQuery(showEditAccountsModal.id, countVal);
      setShowEditAccountsModal(null);
      await loadData();
      alert("Accounts count updated successfully!");
    } catch (err) {
      alert("Failed to update accounts count.");
    }
  };


  // Find members that aren't already linked to a saver account
  const unlinkedMembers = useMemo(() => {
    const linkedUserIds = new Set(savers.map(s => s.userId).filter(Boolean));
    return approvedMembers.filter(m => !linkedUserIds.has(m.userId));
  }, [approvedMembers, savers]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50/50 flex flex-col justify-center items-center">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Loading Savings Pool...</p>
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
            onClick={() => navigate("/dashboard")}
            className="w-10 h-10 bg-white/10 hover:bg-white/15 border border-white/10 rounded-2xl flex items-center justify-center active:scale-95 transition"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div className="text-center">
            <h1 className="text-white text-base font-bold tracking-tight">Ipon-Ipon</h1>
            <p className="text-tertiary text-xs font-light">Savings Cycle {selectedYear} • Due {dueDay}s</p>
          </div>
          <div className="w-10" />
        </div>
      </div>

      {/* Main Content Area */}
      <div className="px-6 -mt-8 relative z-10 space-y-5 flex-1 flex flex-col">
        {/* Digital Wallet Total Savings Card */}
        <div className="bg-white rounded-2xl p-5 border border-slate-150/80 shadow-md relative overflow-hidden">
          <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-20 h-20 bg-primary/5 rounded-full blur-xl pointer-events-none" />
          
          <div className="flex justify-between items-start mb-2">
            <div>
              <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-0.5">Total Savings Pool</p>
              <p className="text-slate-800 text-2xl font-bold tracking-tight">
                ₱{totalSavings.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="bg-slate-55 py-1 px-2.5 rounded-lg border border-slate-150 text-[9px] font-bold text-slate-650 uppercase tracking-wider">
              {selectedYear} Growth
            </div>
          </div>

          {/* Premium Sparkline SVG Chart */}
          <div className="mt-4 h-16 w-full relative">
            <svg className="w-full h-full overflow-visible" viewBox="0 0 100 20" preserveAspectRatio="none">
              <defs>
                <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#7b1114" stopOpacity="0.12"/>
                  <stop offset="100%" stopColor="#7b1114" stopOpacity="0.0"/>
                </linearGradient>
              </defs>
              <line x1="0" y1="6" x2="100" y2="6" stroke="rgba(0,0,0,0.03)" strokeWidth="0.2" />
              <line x1="0" y1="13" x2="100" y2="13" stroke="rgba(0,0,0,0.03)" strokeWidth="0.2" />
              <path
                d="M 0 18 C 15 17, 25 14, 38 11 C 55 8, 68 7, 80 4 C 90 2, 95 1, 100 1"
                fill="none"
                stroke="#7b1114"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
              <path
                d="M 0 18 C 15 17, 25 14, 38 11 C 55 8, 68 7, 80 4 C 90 2, 95 1, 100 1 L 100 20 L 0 20 Z"
                fill="url(#chartGrad)"
              />
              <circle cx="100" cy="1" r="1.2" fill="#7b1114" className="animate-ping" />
              <circle cx="100" cy="1" r="0.8" fill="#7b1114" />
            </svg>
            <div className="flex justify-between text-[8px] text-slate-400 font-bold uppercase mt-1.5 px-0.5">
              <span>W1</span>
              <span>W13</span>
              <span>W26</span>
              <span>W39</span>
              <span>W52</span>
            </div>
          </div>
        </div>



        {/* Search and Action Bar */}
        <div className="flex items-center space-x-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search savers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition duration-200 text-sm text-slate-800 placeholder-slate-400 shadow-sm"
            />
          </div>
          {isLeader && (
            <button
              onClick={() => navigate("/ipon-ipon/add")}
              className="w-11 h-11 bg-primary hover:bg-primary/95 text-white rounded-xl flex items-center justify-center active:scale-95 transition shadow-md shadow-primary/10 cursor-pointer"
              title="Add Person"
            >
              <Plus className="w-5 h-5 text-white" />
            </button>
          )}
        </div>

        {/* Savers Listing */}
        <div className="flex-1">
          {savers.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center shadow-sm">
              <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-100">
                <Users className="w-6 h-6 text-slate-400" />
              </div>
              <p className="text-slate-700 font-bold text-sm mb-1">No Savers Registered</p>
              <p className="text-xs text-slate-400 mb-5 max-w-[200px] mx-auto leading-relaxed">
                {isLeader ? "Start building your group by adding your first saver." : "The group leader hasn't registered any savers yet."}
              </p>
              <div className="bg-slate-50 border border-slate-100 rounded-xl py-2 px-4 inline-block">
                <p className="text-[10px] text-slate-400 uppercase font-semibold tracking-wider mb-0.5">Group Code</p>
                <p className="text-xs font-mono text-slate-600 font-semibold">{groupCode}</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredPeople.map((person, index) => {
                const isLastOrNearLast = index >= filteredPeople.length - 2 && filteredPeople.length > 2;
                return (
                  <div
                    key={person.id}
                    className={`relative w-full bg-white rounded-2xl p-4 border border-slate-150/80 hover:border-secondary hover:shadow-md hover:shadow-primary/5 transition-all duration-300 flex items-center justify-between group shadow-sm animate-in fade-in ${
                      activeMenuId === person.id ? 'z-30' : 'z-0'
                    }`}
                  >
                  <button
                    onClick={() => navigate(`/ipon-ipon/${person.id}`)}
                    className="flex items-center space-x-4 flex-1 min-w-0 text-left bg-transparent border-none p-0 cursor-pointer"
                  >
                    <div className="w-10 h-10 bg-gradient-to-tr from-primary to-tertiary rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm flex-shrink-0">
                      {person.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-0.5">
                        <h3 className="text-slate-800 text-sm font-bold truncate">{person.name}</h3>
                        {person.userId ? (
                          <span className="inline-block px-1.5 py-0.5 rounded text-[8px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-100">
                            Linked
                          </span>
                        ) : (
                          <span className="inline-block px-1.5 py-0.5 rounded text-[8px] font-bold bg-slate-100 text-slate-500">
                            Guest / Offline
                          </span>
                        )}
                        <span className="inline-block px-1.5 py-0.5 rounded text-[8px] font-mono font-bold bg-primary/5 text-primary border border-primary/10">
                          {person.uniqueId}
                        </span>
                      </div>
                      <div className="flex items-center space-x-3 text-xs font-light text-slate-400">
                        <p>
                          Total: <span className="font-semibold text-slate-600">₱{person.totalSavings.toLocaleString("en-PH")}</span>
                        </p>
                        {person.delayedWeeks.length > 0 && (
                          <>
                            <p>•</p>
                            <p className="text-tertiary font-medium">
                              Delayed: <span className="font-bold">{person.delayedWeeks.length} wk{person.delayedWeeks.length !== 1 ? 's' : ''}</span>
                            </p>
                          </>
                        )}
                      </div>
                    </div>
                  </button>

                  {/* Leader Controls (Dropdown Options Menu) */}
                  {isLeader && (
                    <div className="relative pl-3 border-l border-slate-100 flex-shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuId(activeMenuId === person.id ? null : person.id);
                        }}
                        className="w-8 h-8 hover:bg-slate-50 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 transition cursor-pointer"
                        title="Options"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {/* Context Dropdown Menu */}
                      {activeMenuId === person.id && (
                        <>
                          <div 
                            className="fixed inset-0 z-10" 
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenuId(null);
                            }}
                          />
                          <div className={`absolute right-0 w-44 bg-white border border-slate-150 rounded-xl shadow-lg py-1.5 z-20 animate-in fade-in duration-150 ${
                            isLastOrNearLast ? 'bottom-full mb-2 slide-in-from-bottom-2' : 'mt-1 slide-in-from-top-2'
                          }`}>
                            {!person.userId && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowLinkModal(person.id);
                                  setActiveMenuId(null);
                                }}
                                className="w-full px-4 py-2.5 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-primary transition flex items-center space-x-2 cursor-pointer border-none"
                              >
                                <LinkIcon className="w-3.5 h-3.5 text-slate-400" />
                                <span>Link Member</span>
                              </button>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowEditAccountsModal(person);
                                setEditAccountsVal(String(person.accountsCount));
                                setActiveMenuId(null);
                              }}
                              className="w-full px-4 py-2.5 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition flex items-center space-x-2 cursor-pointer border-none"
                            >
                              <Edit3 className="w-3.5 h-3.5 text-slate-400" />
                              <span>Edit Accounts ({person.accountsCount})</span>
                            </button>
                            <div className="h-px bg-slate-100 my-1" />
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveMenuId(null);
                                handleDeleteSaver(person.id, person.name);
                              }}
                              className="w-full px-4 py-2.5 text-left text-xs font-semibold text-red-650 hover:bg-red-50 hover:text-red-750 transition flex items-center space-x-2 cursor-pointer border-none"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-red-400" />
                              <span>Remove Saver</span>
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Link Account Modal */}
      {showLinkModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-6 z-50 animate-in fade-in duration-200">
          <form onSubmit={handleLinkAccountSubmit} className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-50 transform transition-all duration-300 scale-95 animate-in zoom-in-95">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-slate-800 text-base font-bold flex items-center space-x-2">
                <LinkIcon className="w-5 h-5 text-primary" />
                <span>Link Saver to Member</span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowLinkModal(null);
                  setSelectedMemberToLink("");
                }}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-650 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400 font-light leading-relaxed mb-4">
              Select an approved registered member of this group to link their app account to this ledger row. This will allow them to log in and view their personal records.
            </p>

            {unlinkedMembers.length === 0 ? (
              <div className="bg-slate-50 border border-slate-150 rounded-2xl p-4 text-center text-xs font-light text-slate-500 mb-6">
                No unlinked approved members available. Make sure members have joined the group and been approved first.
              </div>
            ) : (
              <div className="space-y-3 mb-6">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Select Approved Member:</label>
                <select
                  value={selectedMemberToLink}
                  onChange={(e) => setSelectedMemberToLink(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm text-slate-700 bg-slate-50"
                  required
                >
                  <option value="">-- Choose Member --</option>
                  {unlinkedMembers.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.username} ({m.email})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex space-x-3">
              <button
                type="button"
                onClick={() => {
                  setShowLinkModal(null);
                  setSelectedMemberToLink("");
                }}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold active:scale-95 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!selectedMemberToLink}
                className="flex-1 py-3 bg-primary hover:bg-primary/95 text-white rounded-xl text-xs font-bold active:scale-95 transition disabled:opacity-50 cursor-pointer"
              >
                Confirm Link
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Accounts Modal */}
      {showEditAccountsModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-6 z-50 animate-in fade-in duration-200">
          <form onSubmit={handleEditAccountsSubmit} className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-50 transform transition-all duration-300 scale-95 animate-in zoom-in-95">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-slate-800 text-base font-bold flex items-center space-x-2">
                <Edit3 className="w-5 h-5 text-primary" />
                <span>Edit Accounts Count</span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowEditAccountsModal(null);
                  setEditAccountsVal("1");
                }}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-650 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400 font-light leading-relaxed mb-4">
              Update the active number of savings accounts for <span className="font-semibold text-slate-700">{showEditAccountsModal.name}</span>.
            </p>

            <div className="space-y-3 mb-6">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Number of Accounts:</label>
              <input
                type="number"
                min="1"
                value={editAccountsVal}
                onChange={(e) => setEditAccountsVal(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition duration-200 text-sm text-slate-800"
                required
              />
            </div>

            <div className="flex space-x-3">
              <button
                type="button"
                onClick={() => {
                  setShowEditAccountsModal(null);
                  setEditAccountsVal("1");
                }}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold active:scale-95 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-3 bg-primary hover:bg-primary/95 text-white rounded-xl text-xs font-bold active:scale-95 transition cursor-pointer"
              >
                Save Changes
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
