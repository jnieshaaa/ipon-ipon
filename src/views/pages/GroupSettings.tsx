import React, { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Settings, Shield, Check, Landmark } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { updateGroupQuery, deleteGroupQuery } from "../../queries/groups";
import { getDatesForWeekdayInYear } from "../../queries/savings";

export default function GroupSettings() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const groupId = localStorage.getItem('ipon_selected_group_id') || '';
  const groupCode = localStorage.getItem('ipon_selected_group_code') || '';
  
  // Find group settings
  const group = useMemo(() => {
    try {
      const name = localStorage.getItem('ipon_selected_group_name');
      if (name) {
        return {
          id: groupId,
          code: groupCode,
          name,
          year: localStorage.getItem('ipon_selected_group_year') || '',
          weeklyAmount: Number(localStorage.getItem('ipon_selected_group_weekly_amount') || 1000),
          dueDay: localStorage.getItem('ipon_selected_group_due_day') || 'Sunday',
          creatorId: localStorage.getItem('ipon_selected_group_creator_id') || '',
          startDate: localStorage.getItem('ipon_selected_group_start_date') || '',
          endDate: localStorage.getItem('ipon_selected_group_end_date') || '',
        };
      }
    } catch (e) {}
    return null;
  }, [groupId, groupCode]);

  const isLeader = group ? group.creatorId === user?.userId : false;

  const [groupName, setGroupName] = useState('');
  const [groupYear, setGroupYear] = useState('');
  const [weeklyAmount, setWeeklyAmount] = useState('');
  const [dueDay, setDueDay] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (group) {
      setGroupName(group.name || '');
      setGroupYear(group.year || '');
      setWeeklyAmount(String(group.weeklyAmount || '1000'));
      setDueDay(group.dueDay || 'Sunday');
      setStartDate(group.startDate || '');
      setEndDate(group.endDate || '');
    }
  }, [group]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!groupName.trim() || !groupYear.trim() || !weeklyAmount.trim() || !startDate || !endDate) {
      setError('All fields are required.');
      return;
    }

    try {
      const amountVal = parseFloat(weeklyAmount) || 1000;
      
      // Update in Supabase (will do nothing if in mock mode)
      await updateGroupQuery(groupId, {
        name: groupName.trim(),
        year: groupYear.trim(),
        weeklyAmount: amountVal,
        dueDay: dueDay,
        startDate: startDate,
        endDate: endDate,
      });

      // Update in LocalStorage for mocks and cache
      const groupsStr = localStorage.getItem('ipon_savings_groups');
      if (groupsStr && groupId) {
        const groups = JSON.parse(groupsStr);
        const updated = groups.map((g: any) => {
          if (g.id === groupId) {
            return {
              ...g,
              name: groupName.trim(),
              year: groupYear.trim(),
              weeklyAmount: amountVal,
              dueDay: dueDay,
              startDate: startDate,
              endDate: endDate,
            };
          }
          return g;
        });
        localStorage.setItem('ipon_savings_groups', JSON.stringify(updated));
      }

      // Sync mock user accounts' timeline
      const accountsStr = localStorage.getItem('ipon_user_accounts');
      if (accountsStr) {
        const accountsMap = JSON.parse(accountsStr);
        Object.keys(accountsMap).forEach(usrId => {
          accountsMap[usrId].forEach((acc: any) => {
            const newDates = getDatesForWeekdayInYear(groupYear.trim(), dueDay, startDate, endDate);
            const existingEntries = acc.entries || [];
            const minLen = Math.min(existingEntries.length, newDates.length);
            
            const updatedEntries = [];
            for (let i = 0; i < minLen; i++) {
              updatedEntries.push({
                ...existingEntries[i],
                date: newDates[i],
                weekRange: `W${i + 1} (${newDates[i]})`
              });
            }
            if (newDates.length > existingEntries.length) {
              for (let i = existingEntries.length; i < newDates.length; i++) {
                updatedEntries.push({
                  id: `week_${i + 1}_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
                  weekRange: `W${i + 1} (${newDates[i]})`,
                  amountPaid: 0,
                  date: newDates[i]
                });
              }
            }
            acc.entries = updatedEntries;
          });
        });
        localStorage.setItem('ipon_user_accounts', JSON.stringify(accountsMap));
      }
      
      // Also update individual select settings in localStorage
      localStorage.setItem('ipon_selected_group_name', groupName.trim());
      localStorage.setItem('ipon_selected_group_year', groupYear.trim());
      localStorage.setItem('ipon_selected_group_weekly_amount', weeklyAmount);
      localStorage.setItem('ipon_selected_group_due_day', dueDay);
      localStorage.setItem('ipon_selected_group_start_date', startDate);
      localStorage.setItem('ipon_selected_group_end_date', endDate);

      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        navigate('/dashboard');
      }, 1500);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'An error occurred while saving.');
    }
  };

  const handleDeleteGroup = async () => {
    const confirmDelete = window.confirm(
      "Are you absolutely sure you want to delete this group? This will permanently delete all records of savings, payments, and loans. This action is irreversible."
    );
    if (!confirmDelete) return;

    setError('');
    try {
      await deleteGroupQuery(groupId);

      const groupsStr = localStorage.getItem('ipon_savings_groups');
      if (groupsStr) {
        const groups = JSON.parse(groupsStr);
        const filtered = groups.filter((g: any) => g.id !== groupId);
        localStorage.setItem('ipon_savings_groups', JSON.stringify(filtered));
      }

      localStorage.removeItem('ipon_selected_group_id');
      localStorage.removeItem('ipon_selected_group_code');
      localStorage.removeItem('ipon_selected_group_name');
      localStorage.removeItem('ipon_selected_group_year');
      localStorage.removeItem('ipon_selected_group_weekly_amount');
      localStorage.removeItem('ipon_selected_group_due_day');
      localStorage.removeItem('ipon_selected_group_creator_id');
      localStorage.removeItem('ipon_selected_group_start_date');
      localStorage.removeItem('ipon_selected_group_end_date');

      navigate('/group-selection');
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Failed to delete the group.');
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
            className="w-10 h-10 bg-white/10 hover:bg-white/15 border border-white/10 rounded-2xl flex items-center justify-center active:scale-95 transition animate-in fade-in cursor-pointer"
            title="Back to Dashboard"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div className="text-center">
            <h1 className="text-white text-base font-bold tracking-tight">Group Settings</h1>
            <p className="text-tertiary text-xs font-light">Configure savings and hiram rates</p>
          </div>
          <div className="w-10" />
        </div>
      </div>

      {/* Main Form Content */}
      <div className="px-6 -mt-8 relative z-10 flex-1 flex flex-col max-w-md mx-auto w-full">
        <form onSubmit={handleSaveSettings} className="bg-white rounded-3xl p-6 border border-slate-150/80 shadow-md flex-1 flex flex-col justify-between">
          {saveSuccess ? (
            <div className="py-20 text-center animate-in zoom-in-95 flex-1 flex flex-col justify-center items-center">
              <div className="w-16 h-16 bg-green-50 border border-green-150 rounded-full flex items-center justify-center mb-4">
                <Check className="w-8 h-8 text-green-500 animate-bounce" />
              </div>
              <h4 className="text-slate-850 font-bold text-base mb-1">Settings Saved!</h4>
              <p className="text-slate-450 text-xs font-light">Group settings have been updated successfully.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {error && (
                <div className="bg-red-55/10 border border-red-200 text-red-600 text-xs font-semibold px-4 py-3 rounded-xl text-center animate-shake">
                  {error}
                </div>
              )}

              {/* Group Core Info Section */}
              <div>
                <h3 className="text-slate-800 text-xs font-bold uppercase tracking-wider mb-3 flex items-center space-x-1.5">
                  <Landmark className="w-4 h-4 text-primary" />
                  <span>Savings settings</span>
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Group Code</label>
                    <input
                      type="text"
                      disabled
                      value={groupCode}
                      className="w-full bg-slate-50 border border-slate-150 rounded-xl px-3 py-2.5 text-xs text-slate-500 font-semibold focus:outline-none cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Group Name</label>
                    <input
                      type="text"
                      disabled={!isLeader}
                      value={groupName}
                      onChange={(e) => setGroupName(e.target.value)}
                      className={`w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-700 font-medium focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none transition ${!isLeader && 'bg-slate-50/50 cursor-not-allowed text-slate-500'}`}
                      placeholder="Enter Group Name"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Cycle Year</label>
                      <input
                        type="text"
                        disabled={!isLeader}
                        value={groupYear}
                        onChange={(e) => setGroupYear(e.target.value)}
                        className={`w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-700 font-medium focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none transition ${!isLeader && 'bg-slate-50/50 cursor-not-allowed text-slate-500'}`}
                        placeholder="e.g. 2026"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Weekly Amount</label>
                      <input
                        type="number"
                        disabled={!isLeader}
                        value={weeklyAmount}
                        onChange={(e) => setWeeklyAmount(e.target.value)}
                        className={`w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-700 font-medium focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none transition ${!isLeader && 'bg-slate-50/50 cursor-not-allowed text-slate-500'}`}
                        placeholder="Weekly Target"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Weekly Due Day</label>
                    <select
                      disabled={!isLeader}
                      value={dueDay}
                      onChange={(e) => setDueDay(e.target.value)}
                      className={`w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-700 font-medium focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none transition ${!isLeader && 'bg-slate-50/50 cursor-not-allowed text-slate-500'}`}
                    >
                      {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map(day => (
                        <option key={day} value={day}>{day}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Start Date</label>
                      <input
                        type="date"
                        disabled={!isLeader}
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className={`w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-700 font-medium focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none transition ${!isLeader && 'bg-slate-50/50 cursor-not-allowed text-slate-500'}`}
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">End Date</label>
                      <input
                        type="date"
                        disabled={!isLeader}
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className={`w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-700 font-medium focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none transition ${!isLeader && 'bg-slate-50/50 cursor-not-allowed text-slate-500'}`}
                      />
                    </div>
                  </div>
                </div>
              </div>



              {!isLeader && (
                <div className="bg-slate-50 border border-slate-150 rounded-2xl p-3.5 flex items-start space-x-3 mt-4">
                  <Shield className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
                  <p className="text-slate-500 text-[10px] font-light leading-normal">
                    Only the group leader who created this association can modify these settings.
                  </p>
                </div>
              )}
            </div>
          )}

          {!saveSuccess && (
            <div className="space-y-6 mt-6 pt-6 border-t border-slate-100">
              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={() => navigate('/dashboard')}
                  className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50 transition active:scale-98 cursor-pointer"
                >
                  {isLeader ? 'Cancel' : 'Back'}
                </button>
                {isLeader && (
                  <button
                    type="submit"
                    className="flex-1 py-3 rounded-xl bg-primary hover:bg-primary/95 text-white text-xs font-semibold hover:shadow-lg hover:shadow-primary/10 transition active:scale-98 cursor-pointer"
                  >
                    Save Settings
                  </button>
                )}
              </div>

              {isLeader && (
                <div className="pt-6 border-t border-red-105">
                  <h4 className="text-red-600 text-xs font-bold uppercase tracking-wider mb-2">Danger Zone</h4>
                  <p className="text-[10px] text-slate-400 font-light leading-relaxed mb-4">
                    Deleting this group will permanently remove all member savings history, timelines, approvals, and loan settings. This action cannot be undone.
                  </p>
                  <button
                    type="button"
                    onClick={handleDeleteGroup}
                    className="w-full py-3 rounded-xl border border-red-200 text-red-600 text-xs font-bold hover:bg-red-50/30 transition active:scale-98 cursor-pointer text-center"
                  >
                    Delete Group Permanently
                  </button>
                </div>
              )}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}