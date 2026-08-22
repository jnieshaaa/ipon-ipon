import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, X, Users, Mail, Clock } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { getPendingApprovalsQuery, approveMemberQuery, removeMemberQuery } from '../../queries/groups';

export default function PendingApprovals() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const groupId = useMemo(() => localStorage.getItem('ipon_selected_group_id') || '', []);
  const creatorId = useMemo(() => localStorage.getItem('ipon_selected_group_creator_id') || '', []);
  const groupName = useMemo(() => localStorage.getItem('ipon_selected_group_name') || 'Savings Group', []);

  const isLeader = useMemo(() => {
    if (!user) return false;
    return user.userId === creatorId;
  }, [user, creatorId]);

  const loadPendingList = async () => {
    if (!groupId) return;
    setIsLoading(true);
    try {
      const list = await getPendingApprovalsQuery(groupId);
      // Filter out the leader/creator themselves just in case
      const filtered = list.filter((item: any) => item.userId !== creatorId);
      setPendingApprovals(filtered);
    } catch (err: any) {
      console.error(err);
      setError('Failed to load pending requests.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user && !isLeader) {
      navigate('/dashboard', { replace: true });
    } else {
      loadPendingList();
    }
  }, [groupId, isLeader, user]);

  const handleApprove = async (memberUserId: string) => {
    try {
      await approveMemberQuery(groupId, memberUserId);
      await loadPendingList();
    } catch (err) {
      alert('Failed to approve member.');
    }
  };

  const handleDeny = async (memberUserId: string) => {
    if (confirm('Are you sure you want to decline this request?')) {
      try {
        await removeMemberQuery(groupId, memberUserId);
        await loadPendingList();
      } catch (err) {
        alert('Failed to decline request.');
      }
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50/50 flex flex-col justify-center items-center">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Loading Requests...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col pb-6">
      {/* Top Banner Header */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-950 to-primary/45 px-6 pt-6 pb-8 text-white relative overflow-hidden rounded-b-3xl border-b border-primary/20 shadow-md">
        <div className="absolute right-0 bottom-0 translate-x-4 translate-y-4 w-32 h-32 bg-primary/10 rounded-full blur-2xl pointer-events-none" />
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate('/dashboard')}
            className="w-10 h-10 bg-white/10 hover:bg-white/15 border border-white/10 rounded-2xl flex items-center justify-center active:scale-95 transition cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div className="text-center">
            <h2 className="text-white text-base font-bold tracking-tight">Join Requests</h2>
            <p className="text-tertiary text-xs font-light">{groupName}</p>
          </div>
          <div className="w-10" />
        </div>
      </div>

      <div className="flex-1 px-6 mt-6 max-w-md mx-auto w-full">
        {error && (
          <div className="bg-red-50 border border-red-100 text-red-650 px-4 py-2.5 rounded-xl text-xs font-semibold text-center mb-5">
            {error}
          </div>
        )}

        {pendingApprovals.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-150/80 p-8 text-center shadow-sm animate-in fade-in duration-300">
            <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-100">
              <Users className="w-6 h-6 text-slate-400" />
            </div>
            <p className="text-slate-700 font-bold text-sm mb-1">Queue is Clear</p>
            <p className="text-xs text-slate-400 max-w-[240px] mx-auto leading-relaxed">
              No pending member join requests for this savings group at the moment.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <h3 className="text-slate-500 text-[10px] font-bold uppercase tracking-wider pl-1">
              Waiting for Approval ({pendingApprovals.length})
            </h3>
            {pendingApprovals.map((req) => (
              <div
                key={req.userId}
                className="bg-white rounded-2xl p-4 border border-slate-150/80 shadow-sm flex items-center justify-between animate-in slide-in-from-top-2 duration-300"
              >
                <div className="min-w-0 flex-1 pr-3">
                  <div className="flex items-center space-x-1.5 mb-1">
                    <p className="text-sm font-bold text-slate-800 truncate">{req.username}</p>
                  </div>
                  <div className="flex items-center space-x-3 text-[10px] text-slate-400 font-light">
                    <span className="flex items-center">
                      <Mail className="w-3.5 h-3.5 mr-1 text-slate-350" />
                      {req.email}
                    </span>
                    <span className="flex items-center">
                      <Clock className="w-3.5 h-3.5 mr-1 text-slate-350" />
                      {new Date(req.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2 flex-shrink-0">
                  <button
                    onClick={() => handleApprove(req.userId)}
                    className="w-9 h-9 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl flex items-center justify-center shadow-md shadow-emerald-500/10 active:scale-95 transition cursor-pointer"
                    title="Approve Member"
                  >
                    <Check className="w-4.5 h-4.5" />
                  </button>
                  <button
                    onClick={() => handleDeny(req.userId)}
                    className="w-9 h-9 bg-red-500 hover:bg-red-650 text-white rounded-xl flex items-center justify-center shadow-md shadow-red-500/10 active:scale-95 transition cursor-pointer"
                    title="Decline Member"
                  >
                    <X className="w-4.5 h-4.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
