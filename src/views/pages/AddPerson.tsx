import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, UserPlus, Shield, Globe, User } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { addSaverQuery } from '../../queries/savings';
import { supabase } from '../../lib/supabase';

export default function AddPerson() {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [saverCategory, setSaverCategory] = useState<'offline' | 'online' | 'self'>('offline');
  const [name, setName] = useState('');
  const [accounts, setAccounts] = useState('1');
  
  const [approvedMembers, setApprovedMembers] = useState<any[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const groupId = localStorage.getItem('ipon_selected_group_id') || '';
  const creatorId = useMemo(() => localStorage.getItem('ipon_selected_group_creator_id') || '', []);

  const isMockMode = (): boolean => {
    return import.meta.env.VITE_USE_MOCK === 'true' || 
           !import.meta.env.VITE_SUPABASE_URL || 
           !import.meta.env.VITE_SUPABASE_ANON_KEY;
  };

  // Load approved members of this group
  useEffect(() => {
    const fetchApprovedMembers = async () => {
      if (isMockMode() || !groupId) return;
      try {
        const { data: members, error: membersError } = await supabase
          .from('group_members')
          .select('user_id')
          .eq('group_id', groupId)
          .eq('approved', true);

        if (!membersError && members && members.length > 0) {
          const userIds = members.map((m: any) => m.user_id).filter(id => id !== creatorId);
          if (userIds.length === 0) {
            setApprovedMembers([]);
            return;
          }
          
          const { data: profiles, error: profilesError } = await supabase
            .from('users')
            .select('id, username, email')
            .in('id', userIds);

          if (!profilesError && profiles) {
            setApprovedMembers(profiles);
          }
        }
      } catch (err) {
        console.error('Error fetching approved members for selection:', err);
      }
    };

    fetchApprovedMembers();
  }, [groupId, creatorId]);

  // Adjust name field based on category selection
  useEffect(() => {
    if (saverCategory === 'self' && user) {
      setName(user.name);
      setSelectedMemberId('');
    } else if (saverCategory === 'online') {
      const selected = approvedMembers.find(m => m.id === selectedMemberId);
      setName(selected ? selected.username : '');
    } else {
      setName('');
      setSelectedMemberId('');
    }
  }, [saverCategory, user, selectedMemberId, approvedMembers]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if (!groupId) {
      setError('No active group selected. Please return to group selection.');
      setIsLoading(false);
      return;
    }

    if (saverCategory === 'online' && !selectedMemberId) {
      setError('Please select an approved online member.');
      setIsLoading(false);
      return;
    }

    try {
      const accountsCount = parseInt(accounts) || 1;
      let targetUserId: string | null = null;
      
      if (saverCategory === 'self' && user) {
        targetUserId = user.userId;
      } else if (saverCategory === 'online') {
        targetUserId = selectedMemberId;
      }

      const newSaver = await addSaverQuery(groupId, name, accountsCount, targetUserId);
      if (newSaver) {
        navigate('/ipon-ipon');
      } else {
        setError('Failed to register saver account. Please try again.');
      }
    } catch (err: any) {
      setError(err?.message || 'An error occurred while adding the saver.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col pb-6">
      {/* Top Banner Header */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-950 to-primary/45 px-6 pt-6 pb-8 text-white relative overflow-hidden rounded-b-[2.5rem] border-b border-primary/20 shadow-md">
        <div className="absolute right-0 bottom-0 translate-x-4 translate-y-4 w-32 h-32 bg-primary/10 rounded-full blur-2xl pointer-events-none" />
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate('/ipon-ipon')}
            className="w-10 h-10 bg-white/10 hover:bg-white/15 border border-white/10 rounded-2xl flex items-center justify-center active:scale-95 transition cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div className="text-center">
            <h2 className="text-white text-base font-bold tracking-tight">Add Saver</h2>
            <p className="text-tertiary text-xs font-light">Register a new member</p>
          </div>
          <div className="w-10" />
        </div>
      </div>

      <div className="flex-1 px-6 mt-6">
        <div className="bg-white rounded-2xl border border-slate-150/80 shadow-sm p-6 max-w-md mx-auto">
          <div className="flex justify-center mb-6">
            <div className="w-14 h-14 bg-gradient-to-br from-primary to-tertiary rounded-2xl flex items-center justify-center shadow-md shadow-primary/10">
              <UserPlus className="w-6 h-6 text-white" />
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-100 text-red-605 px-4 py-2.5 rounded-xl text-xs font-semibold text-center mb-5 animate-pulse">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Saver Type Toggle */}
            <div className="space-y-1.5">
              <span className="block text-xs font-semibold uppercase tracking-wider text-slate-500 ml-1">
                Saver Category
              </span>
              <div className="grid grid-cols-3 gap-1 bg-slate-50 p-1 rounded-xl border border-slate-250">
                <button
                  type="button"
                  onClick={() => setSaverCategory('offline')}
                  className={`py-2 text-[10px] font-bold rounded-lg transition cursor-pointer ${
                    saverCategory === 'offline' ? 'bg-white text-primary shadow-sm border border-slate-150' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Offline Member
                </button>
                <button
                  type="button"
                  onClick={() => setSaverCategory('online')}
                  className={`py-2 text-[10px] font-bold rounded-lg transition cursor-pointer ${
                    saverCategory === 'online' ? 'bg-white text-primary shadow-sm border border-slate-150' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Online Member
                </button>
                <button
                  type="button"
                  onClick={() => setSaverCategory('self')}
                  className={`py-2 text-[10px] font-bold rounded-lg transition cursor-pointer ${
                    saverCategory === 'self' ? 'bg-white text-primary shadow-sm border border-slate-150' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Leader (Self)
                </button>
              </div>
            </div>

            {/* Offline Member Name Input */}
            {saverCategory === 'offline' && (
              <div>
                <label htmlFor="name" className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5 ml-1">
                  Full Name
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Maria Santos"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition duration-200 text-sm text-slate-800 placeholder-slate-400"
                  required
                />
              </div>
            )}

            {/* Online Member Selector Dropdown */}
            {saverCategory === 'online' && (
              <div className="space-y-4">
                <div>
                  <label htmlFor="online-member" className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5 ml-1">
                    Select Approved Online Member
                  </label>
                  {approvedMembers.length === 0 ? (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-center text-xs text-slate-400 font-light">
                      No other approved online members found. They must first input the group code and be approved.
                    </div>
                  ) : (
                    <select
                      id="online-member"
                      value={selectedMemberId}
                      onChange={(e) => setSelectedMemberId(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm text-slate-700 bg-slate-50"
                      required
                    >
                      <option value="">-- Choose Member --</option>
                      {approvedMembers.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.username} ({m.email})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                {name && (
                  <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 flex items-center space-x-2.5">
                    <Globe className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <p className="text-[10px] text-emerald-700 font-semibold leading-relaxed">
                      Linking ledger row directly to online user: <span className="font-extrabold">{name}</span>.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Leader Self Information */}
            {saverCategory === 'self' && (
              <div className="space-y-3">
                <div>
                  <label htmlFor="name-self" className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5 ml-1">
                    Leader Name
                  </label>
                  <input
                    id="name-self"
                    type="text"
                    value={name}
                    disabled
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-100/80 text-sm text-slate-550 font-medium"
                  />
                </div>
                <div className="bg-primary/5 border border-primary/10 rounded-xl p-3 flex items-center space-x-2.5">
                  <Shield className="w-4 h-4 text-primary flex-shrink-0" />
                  <p className="text-[10px] text-primary font-semibold leading-relaxed">
                    Registering your own personal savings ledger in this group.
                  </p>
                </div>
              </div>
            )}

            <div>
              <label htmlFor="accounts" className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5 ml-1">
                Number of Accounts
              </label>
              <input
                id="accounts"
                type="number"
                min="1"
                value={accounts}
                onChange={(e) => setAccounts(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition duration-200 text-sm text-slate-800"
                required
              />
              <p className="text-[10px] text-slate-400 font-light mt-2 leading-relaxed">
                Define the count of independent savings accounts designated for this user.
              </p>
            </div>

            <button
              type="submit"
              disabled={isLoading || !name.trim()}
              className="w-full bg-gradient-to-r from-primary to-tertiary text-white py-3.5 rounded-xl font-semibold shadow-lg shadow-primary/10 hover:shadow-xl hover:shadow-primary/20 transition-all duration-200 active:scale-[0.98] disabled:opacity-50 text-sm mt-6 cursor-pointer"
            >
              {isLoading ? 'Registering Saver...' : 'Register Saver'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
