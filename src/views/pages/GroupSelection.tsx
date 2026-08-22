import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Coins, Users, X, ChevronRight, Shield, LogOut, Calculator } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { getGroupsForUserQuery, createGroupQuery, joinGroupQuery, ISavingsGroup } from '../../queries/groups';

export default function GroupSelection() {
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  
  const [groups, setGroups] = useState<ISavingsGroup[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupYear, setGroupYear] = useState(new Date().getFullYear().toString());
  const [weeklyAmount, setWeeklyAmount] = useState('1000');
  const [dueDay, setDueDay] = useState('Sunday');
  const [joinGroupId, setJoinGroupId] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().split('T')[0];
  });

  const handleLogout = async () => {
    await logout();
    setShowLogoutModal(false);
    navigate('/login');
  };

  useEffect(() => {
    if (user) {
      getGroupsForUserQuery(user.userId)
        .then(setGroups)
        .catch(err => {
          console.error('Error fetching user groups:', err);
        });
    }
  }, [user]);

  const handleSelectGroup = (group: ISavingsGroup) => {
    localStorage.setItem('ipon_selected_group_id', group.id);
    localStorage.setItem('ipon_selected_group_code', group.groupCode);
    localStorage.setItem('ipon_selected_group_name', group.name);
    localStorage.setItem('ipon_selected_group_year', group.year);
    localStorage.setItem('ipon_selected_group_weekly_amount', String(group.weeklyAmount || 1000));
    localStorage.setItem('ipon_selected_group_due_day', group.dueDay || 'Sunday');
    localStorage.setItem('ipon_selected_group_creator_id', group.creatorId || '');
    localStorage.setItem('ipon_selected_group_start_date', group.startDate || '');
    localStorage.setItem('ipon_selected_group_end_date', group.endDate || '');
    localStorage.setItem('ipon_selected_group_member_interest', '5');
    localStorage.setItem('ipon_selected_group_non_member_interest', '10');
    navigate('/dashboard');
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setError('');
    if (!groupName.trim() || !groupYear.trim() || !weeklyAmount.trim() || !dueDay.trim() || !startDate || !endDate) {
      setError('Please fill in all fields');
      return;
    }
    setIsSubmitting(true);
    const amountVal = parseFloat(weeklyAmount) || 1000;
    if (user) {
      try {
        const newGroup = await createGroupQuery({
          name: groupName,
          year: groupYear,
          weeklyAmount: amountVal,
          dueDay: dueDay,
          creatorId: user.userId,
          startDate: startDate,
          endDate: endDate
        });
        if (newGroup) {
          const list = await getGroupsForUserQuery(user.userId);
          setGroups(list);
          setShowCreateModal(false);
          setGroupName('');
          setWeeklyAmount('1000');
          setDueDay('Sunday');
          // Reset custom dates
          setStartDate(new Date().toISOString().split('T')[0]);
          const d = new Date();
          d.setFullYear(d.getFullYear() + 1);
          setEndDate(d.toISOString().split('T')[0]);
          
          handleSelectGroup(newGroup);
        } else {
          setError('Failed to create group');
        }
      } catch (err: any) {
        setError(err?.message || 'Failed to create group');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleJoinGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isJoining) return;
    setError('');
    if (!joinGroupId.trim()) {
      setError('Please enter a Group Code');
      return;
    }
    setIsJoining(true);
    if (user) {
      try {
        const joinedGroup = await joinGroupQuery(joinGroupId, user.userId);
        if (joinedGroup) {
          const list = await getGroupsForUserQuery(user.userId);
          setGroups(list);
          setShowJoinModal(false);
          setJoinGroupId('');
          handleSelectGroup(joinedGroup);
        } else {
          setError('Failed to join group');
        }
      } catch (err: any) {
        setError(err?.message || 'Failed to join group');
      } finally {
        setIsJoining(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col pb-8 justify-between">
      <div className="flex-1 flex flex-col animate-in fade-in duration-300">
        {/* Top Header Greeting Banner */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-950 to-primary/45 px-6 pt-10 pb-10 text-white relative overflow-hidden rounded-b-3xl border-b border-primary/20 shadow-lg text-center">
          <div className="absolute right-0 bottom-0 translate-x-4 translate-y-4 w-32 h-32 bg-primary/10 rounded-full blur-2xl pointer-events-none" />
          
          {/* Logout Button */}
          <button
            onClick={() => setShowLogoutModal(true)}
            className="absolute top-6 right-6 w-10 h-10 bg-white/10 hover:bg-white/15 border border-white/10 rounded-2xl flex items-center justify-center active:scale-95 transition"
            title="Logout"
          >
            <LogOut className="w-5 h-5 text-white" />
          </button>
          
          <div className="w-16 h-16 bg-white/10 border border-white/20 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
            <span className="text-white font-bold text-lg">
              {user?.name ? user.name.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase() : 'U'}
            </span>
          </div>

          <h1 className="text-white text-2xl font-bold tracking-tight mb-1">
            Hi, {user?.name ? user.name.split(' ')[0] : 'User'}
          </h1>
          <p className="text-tertiary text-xs font-semibold uppercase tracking-wider">
            Choose a Savings Group
          </p>
        </div>

        {/* Action Options Cards */}
        <div className="px-6 mt-8">
          <h2 className="text-slate-800 text-sm font-bold uppercase tracking-wider mb-4 pl-1">Get Started</h2>
          <div className="grid grid-cols-2 gap-4">
            {/* Create Group Action Card */}
            <button
              onClick={() => {
                setError('');
                setStartDate(new Date().toISOString().split('T')[0]);
                const d = new Date();
                d.setFullYear(d.getFullYear() + 1);
                setEndDate(d.toISOString().split('T')[0]);
                setShowCreateModal(true);
              }}
              className="bg-white rounded-3xl p-5 border border-slate-150/80 hover:border-secondary hover:shadow-md hover:shadow-primary/5 active:scale-[0.98] transition-all duration-300 text-left flex flex-col justify-between h-40 shadow-sm group relative"
            >
              <div className="w-11 h-11 bg-primary/10 text-primary rounded-2xl flex items-center justify-center shadow-inner group-hover:bg-primary group-hover:text-white transition-all duration-300 animate-in zoom-in-95">
                <Coins className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-slate-800 text-sm font-bold mb-1">Create Group</h3>
                <p className="text-slate-400 text-[10px] font-light leading-relaxed">
                  For leaders who manage and hold group cash.
                </p>
              </div>
            </button>

            {/* Join Group Action Card */}
            <button
              onClick={() => {
                setError('');
                setShowJoinModal(true);
              }}
              className="bg-white rounded-3xl p-5 border border-slate-150/80 hover:border-secondary hover:shadow-md hover:shadow-primary/5 active:scale-[0.98] transition-all duration-300 text-left flex flex-col justify-between h-40 shadow-sm group"
            >
              <div className="w-11 h-11 bg-primary/10 text-primary rounded-2xl flex items-center justify-center shadow-inner group-hover:bg-primary group-hover:text-white transition-all duration-300 animate-in zoom-in-95">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-slate-800 text-sm font-bold mb-1">Join Group</h3>
                <p className="text-slate-400 text-[10px] font-light leading-relaxed">
                  Join an existing savings group via its ID code.
                </p>
              </div>
            </button>
          </div>
        </div>

        {/* Existing Groups List */}
        <div className="px-6 mt-8 flex-1">
          <h2 className="text-slate-800 text-sm font-bold uppercase tracking-wider mb-4 pl-1">Your Savings Groups</h2>
          
          {groups.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-150/80 p-8 text-center shadow-sm">
              <p className="text-slate-400 text-xs font-light leading-relaxed">
                You are not associated with any savings groups yet. Create or join a group above to start.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {groups.map((group) => {
                const isCreator = group.creatorId === user?.userId;
                const isPending = group.approved === false;
                return (
                  <button
                    key={group.id}
                    onClick={() => {
                      if (isPending && !isCreator) {
                        alert("Your membership to this group is pending leader approval. Please ask the group leader to approve your access.");
                        return;
                      }
                      handleSelectGroup(group);
                    }}
                    className={`w-full bg-white rounded-2xl p-5 border border-slate-150/80 hover:border-secondary hover:shadow-md hover:shadow-primary/5 hover:-translate-y-0.5 transition-all duration-300 active:scale-[0.98] text-left flex items-center justify-between group shadow-sm ${
                      isPending && !isCreator ? 'opacity-70 cursor-not-allowed' : ''
                    }`}
                  >
                    <div className="flex items-center space-x-4 flex-1 min-w-0">
                      <div className="w-10 h-10 bg-gradient-to-tr from-primary to-tertiary rounded-xl flex items-center justify-center text-white font-bold text-xs shadow-sm">
                        ii
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-0.5">
                          <h3 className="text-slate-800 text-sm font-bold truncate">{group.name}</h3>
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[8px] font-bold ${
                            isCreator ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {isCreator ? 'Leader' : 'Member'}
                          </span>
                          {isPending && !isCreator && (
                            <span className="inline-block px-1.5 py-0.5 rounded text-[8px] font-bold bg-amber-50 text-amber-600 border border-amber-250 animate-pulse">
                              Pending Approval
                            </span>
                          )}
                        </div>
                        <p className="text-slate-400 text-[10px] font-light">
                          Code: <span className="font-semibold text-slate-500">{group.groupCode}</span> • Cycle: <span className="font-semibold text-slate-500">{group.year}</span> • Weekly: <span className="font-semibold text-slate-500">₱{group.weeklyAmount || 1000}</span> • Due: <span className="font-semibold text-slate-500">{group.dueDay || 'Sunday'}s</span>
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-4.5 h-4.5 text-slate-300 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Personal Ledger Section */}
        <div className="px-6 mt-8 space-y-4">
          <h2 className="text-slate-800 text-sm font-bold uppercase tracking-wider pl-1">Personal Ledger & Budget</h2>
          
          {/* Aking Pahiram (Personal Loan Tracker) */}
          <button
            onClick={() => navigate('/personal-loans')}
            className="w-full bg-gradient-to-r from-primary/10 via-tertiary/10 to-primary/5 rounded-2xl p-5 border border-primary/10 hover:border-primary/30 hover:shadow-md transition-all duration-300 active:scale-[0.99] text-left flex items-center justify-between group shadow-sm cursor-pointer"
          >
            <div className="flex items-center space-x-4 flex-1 min-w-0">
              <div className="w-12 h-12 bg-gradient-to-tr from-primary to-tertiary rounded-xl flex items-center justify-center text-white shadow-md">
                <Coins className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-slate-800 text-sm font-bold mb-0.5">Aking Pahiram (Personal Loan Tracker)</h3>
                <p className="text-slate-400 text-[10px] font-light leading-relaxed">
                  Track individual loans lent to other people, record payments, and view repayment history.
                </p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
          </button>

          {/* Smart Budget Envelope */}
          <button
            onClick={() => navigate('/budget-planner')}
            className="w-full bg-gradient-to-r from-primary/10 via-tertiary/10 to-primary/5 rounded-2xl p-5 border border-primary/10 hover:border-primary/30 hover:shadow-md transition-all duration-300 active:scale-[0.99] text-left flex items-center justify-between group shadow-sm cursor-pointer"
          >
            <div className="flex items-center space-x-4 flex-1 min-w-0">
              <div className="w-12 h-12 bg-gradient-to-tr from-primary to-tertiary rounded-xl flex items-center justify-center text-white shadow-md">
                <Calculator className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-slate-800 text-sm font-bold mb-0.5">Smart Budget Envelope</h3>
                <p className="text-slate-400 text-[10px] font-light leading-relaxed">
                  Allocate your paycheck into custom percentages (Needs, Wants, Savings) and log expenses.
                </p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
          </button>
        </div>
      </div>

      {/* Footer Branding */}
      <p className="text-center text-[10px] text-slate-400 font-light mt-6">
        Ipon-Ipon Platform • Secure Digital Wallet Prototype
      </p>

      {/* Create Group Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-6 z-50 animate-in fade-in duration-200">
          <form onSubmit={handleCreateGroup} className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-50 transform transition-all duration-300 scale-95 animate-in zoom-in-95">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-slate-800 text-lg font-bold flex items-center space-x-2">
                <Shield className="w-5 h-5 text-primary" />
                <span>Create Group (Leader)</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {error && (
              <div className="bg-red-50 text-red-650 text-xs font-semibold px-3.5 py-2.5 rounded-xl text-center mb-4 animate-shake">
                {error}
              </div>
            )}

            <div className="space-y-4 mb-6">
              <div>
                <label htmlFor="modalGroupName" className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5 ml-1">
                  Group Name
                </label>
                <input
                  id="modalGroupName"
                  type="text"
                  placeholder="e.g. Manggahan Savings Association"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition duration-200 text-sm text-slate-800 placeholder-slate-400"
                  autoFocus
                  required
                />
              </div>

              <div>
                <label htmlFor="modalGroupYear" className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5 ml-1">
                  Cycle Year
                </label>
                <input
                  id="modalGroupYear"
                  type="number"
                  placeholder="e.g. 2026"
                  value={groupYear}
                  onChange={(e) => setGroupYear(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition duration-200 text-sm text-slate-800 placeholder-slate-400"
                  required
                />
              </div>

              <div>
                <label htmlFor="modalWeeklyAmount" className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5 ml-1">
                  Weekly Amount (₱)
                </label>
                <input
                  id="modalWeeklyAmount"
                  type="number"
                  placeholder="e.g. 100"
                  value={weeklyAmount}
                  onChange={(e) => setWeeklyAmount(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition duration-200 text-sm text-slate-800 placeholder-slate-400"
                  required
                />
              </div>

              <div>
                <label htmlFor="modalDueDay" className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5 ml-1">
                  Weekly Payment Due Day
                </label>
                <select
                  id="modalDueDay"
                  value={dueDay}
                  onChange={(e) => setDueDay(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition duration-200 text-sm text-slate-800 bg-white"
                  required
                >
                  <option value="Sunday">Sunday</option>
                  <option value="Monday">Monday</option>
                  <option value="Tuesday">Tuesday</option>
                  <option value="Wednesday">Wednesday</option>
                  <option value="Thursday">Thursday</option>
                  <option value="Friday">Friday</option>
                  <option value="Saturday">Saturday</option>
                </select>
              </div>

              <div>
                <label htmlFor="modalStartDate" className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5 ml-1">
                  Start Date
                </label>
                <input
                  id="modalStartDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition duration-200 text-sm text-slate-800 placeholder-slate-400"
                  required
                />
              </div>

              <div>
                <label htmlFor="modalEndDate" className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5 ml-1">
                  End Date (Last Date)
                </label>
                <input
                  id="modalEndDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition duration-200 text-sm text-slate-800 placeholder-slate-400"
                  required
                />
              </div>
            </div>

            <div className="flex space-x-3">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition active:scale-98"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 py-3 rounded-xl bg-primary hover:bg-primary/95 text-white text-sm font-semibold hover:shadow-lg hover:shadow-primary/10 transition active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Creating...' : 'Create & Enter'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Join Group Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-6 z-50 animate-in fade-in duration-200">
          <form onSubmit={handleJoinGroup} className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-50 transform transition-all duration-300 scale-95 animate-in zoom-in-95">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-slate-800 text-lg font-bold flex items-center space-x-2">
                <Users className="w-5 h-5 text-primary" />
                <span>Join Group (Member)</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowJoinModal(false)}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {error && (
              <div className="bg-red-50 text-red-650 text-xs font-semibold px-3.5 py-2.5 rounded-xl text-center mb-4 animate-shake">
                {error}
              </div>
            )}

            <div className="mb-6">
              <label htmlFor="modalJoinGroupId" className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5 ml-1">
                Enter Group ID Code
              </label>
              <input
                id="modalJoinGroupId"
                type="text"
                placeholder="e.g. SG-2026-001"
                value={joinGroupId}
                onChange={(e) => setJoinGroupId(e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition duration-200 text-sm text-slate-800 placeholder-slate-400 font-mono"
                autoFocus
                required
              />
              <p className="text-[10px] text-slate-400 font-light mt-2 leading-relaxed">
                Enter the exact Group ID code provided by your savings group leader.
              </p>
            </div>

            <div className="flex space-x-3">
              <button
                type="button"
                onClick={() => setShowJoinModal(false)}
                className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-55 transition active:scale-98"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isJoining}
                className="flex-1 py-3 rounded-xl bg-primary hover:bg-primary/95 text-white text-sm font-semibold hover:shadow-lg hover:shadow-primary/10 transition active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isJoining ? 'Joining...' : 'Join & Enter'}
              </button>
            </div>
          </form>
        </div>
      )}

      {showLogoutModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-6 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-55 transform transition-all duration-300 scale-95 animate-in zoom-in-95">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-slate-800 text-lg font-bold">Sign Out</h3>
              <button
                onClick={() => setShowLogoutModal(false)}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-slate-500 text-sm mb-6 leading-relaxed">
              Are you sure you want to sign out? You will need to enter your password again to access your savings and loans.
            </p>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowLogoutModal(false)}
                className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition active:scale-98"
              >
                Cancel
              </button>
              <button
                onClick={handleLogout}
                className="flex-1 py-3 rounded-xl bg-primary hover:bg-primary/95 text-white text-sm font-semibold hover:shadow-lg hover:shadow-primary/10 transition active:scale-98"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
