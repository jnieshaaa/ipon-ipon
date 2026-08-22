import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Coins, History } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { getIncomeHistoryQuery, IIncomeRecord } from '../../queries/budget';

export default function BudgetHistory() {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [historyList, setHistoryList] = useState<IIncomeRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      if (user) {
        try {
          const list = await getIncomeHistoryQuery(user.userId);
          setHistoryList(list);
        } catch (err) {
          console.error('Error fetching income history:', err);
        } finally {
          setIsLoading(false);
        }
      }
    };
    fetchHistory();
  }, [user]);

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col pb-8">
      {/* Header */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-950 to-primary/45 px-6 pt-12 pb-6 text-white relative overflow-hidden rounded-b-3xl border-b border-primary/20 shadow-lg flex items-center justify-between">
        <button
          onClick={() => navigate('/budget-planner')}
          className="w-10 h-10 bg-white/10 hover:bg-white/15 border border-white/10 rounded-2xl flex items-center justify-center active:scale-95 transition cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <h1 className="text-white text-lg font-bold tracking-tight">Paycheck History</h1>
        <div className="w-10 h-10"></div>
      </div>

      {/* Main Content Area */}
      <div className="px-6 mt-6 flex-1 flex flex-col">
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center py-20">
            <div className="w-10 h-10 border-4 border-slate-200 border-t-primary rounded-full animate-spin"></div>
          </div>
        ) : historyList.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-150/80 p-8 text-center shadow-sm my-auto">
            <Coins className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-slate-800 text-sm font-bold mb-1">No Paychecks Logged</h3>
            <p className="text-slate-400 text-xs font-light leading-relaxed max-w-xs mx-auto">
              Your paycheck deposit history will appear here once you activate your budget plan or distribute a new paycheck.
            </p>
          </div>
        ) : (
          <div className="space-y-3.5 animate-in fade-in duration-200">
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Deposited Paycheck Logs</span>
              <span className="text-[10px] text-slate-500 font-extrabold bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-lg">
                {historyList.length} total
              </span>
            </div>
            
            <div className="space-y-3">
              {historyList.map((log) => (
                <div key={log.id} className="bg-white rounded-2xl p-4 border border-slate-150/80 shadow-sm flex items-center justify-between">
                  <div className="flex items-center space-x-3.5">
                    <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary shadow-inner">
                      <Coins className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-slate-800 text-sm font-bold">₱{log.amount.toLocaleString()}</p>
                      <p className="text-slate-400 text-[10px] font-light">
                        Cycle: {log.payPeriod} • Received: {log.receivedDate}
                      </p>
                    </div>
                  </div>
                  <span className="text-[9px] font-bold text-emerald-500 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-md">
                    Credited
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
