import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, MoreVertical, X, Plus } from 'lucide-react';

export default function YearSelection() {
  const navigate = useNavigate();
  const currentYear = new Date().getFullYear();
  const [years, setYears] = useState(Array.from({ length: 5 }, (_, i) => currentYear - i));
  const [activeMenu, setActiveMenu] = useState<number | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [yearToDelete, setYearToDelete] = useState<number | null>(null);

  const [showAddYearModal, setShowAddYearModal] = useState(false);
  const [newYear, setNewYear] = useState('');

  const handleDeleteYear = (year: number) => {
    setYearToDelete(year);
    setShowDeleteModal(true);
    setActiveMenu(null);
  };

  const addYear = () => {
    const year = parseInt(newYear);
    if (year && !years.includes(year)) {
      setYears([...years, year].sort((a, b) => b - a));
    }
    setShowAddYearModal(false);
    setNewYear('');
  };

  const confirmDelete = () => {
    if (yearToDelete) {
      setYears(years.filter(year => year !== yearToDelete));
    }
    setShowDeleteModal(false);
    setYearToDelete(null);
  };

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col pb-6">
      {/* Top Banner Header */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-950 to-primary/45 px-6 pt-6 pb-8 text-white relative overflow-hidden rounded-b-3xl border-b border-primary/20 shadow-md">
        <div className="absolute right-0 bottom-0 translate-x-4 translate-y-4 w-32 h-32 bg-primary/10 rounded-full blur-2xl pointer-events-none" />
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate('/dashboard')}
            className="w-10 h-10 bg-white/10 hover:bg-white/15 border border-white/10 rounded-2xl flex items-center justify-center active:scale-95 transition"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div className="text-center">
            <h2 className="text-white text-base font-bold tracking-tight">Select Year</h2>
            <p className="text-slate-400 text-xs font-light">Choose a savings cycle</p>
          </div>
          <button 
            onClick={() => setShowAddYearModal(true)}
            className="w-10 h-10 bg-primary/20 hover:bg-primary/30 border border-primary/30 rounded-2xl flex items-center justify-center transition active:scale-95"
            title="Add Year"
          >
            <Plus className="w-5 h-5 text-tertiary" />
          </button>
        </div>
      </div>

      <div className="flex-1 px-6 mt-6">
        <div className="space-y-3">
          {years.map((year) => (
            <div
              key={year}
              className="w-full bg-white rounded-2xl border border-slate-150/80 hover:border-secondary hover:shadow-md hover:shadow-primary/2 transition-all duration-300 relative group overflow-visible"
            >
              {/* Colored status strip */}
              <div className="absolute left-0 top-3 bottom-3 w-1 bg-gradient-to-b from-primary to-tertiary rounded-r-lg opacity-80 group-hover:w-1.5 transition-all duration-300" />
              
              <div className="flex items-center justify-between p-5">
                <button
                  onClick={() => navigate(`/ipon-ipon?year=${year}`)}
                  className="flex-1 text-left active:scale-[0.99] transition-transform"
                >
                  <h3 className="text-slate-800 text-base font-bold mb-0.5">{year}</h3>
                  <p className="text-slate-400 text-xs font-light">
                    {year === currentYear ? 'Current Cycle' : 'Previous Cycle'}
                  </p>
                </button>
                
                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveMenu(activeMenu === year ? null : year);
                    }}
                    className="w-8 h-8 rounded-lg hover:bg-slate-50 flex items-center justify-center text-slate-400 hover:text-slate-600 transition active:scale-90"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>

                  {activeMenu === year && (
                    <>
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setActiveMenu(null)}
                      />
                      <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-xl border border-slate-100 py-1 min-w-[120px] z-30 animate-in fade-in slide-in-from-top-1 duration-150">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteYear(year);
                          }}
                          className="w-full px-4 py-2 text-left text-xs font-semibold text-red-650 hover:bg-red-50 transition"
                        >
                          Delete Cycle
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add Year Modal */}
      {showAddYearModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-6 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-50 transform transition-all duration-300 scale-95 animate-in zoom-in-95">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-slate-800 text-lg font-bold">Add Savings Year</h3>
              <button
                onClick={() => setShowAddYearModal(false)}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <label htmlFor="modalNewYear" className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5 ml-1">
              Select Year
            </label>
            <input
              id="modalNewYear"
              type="number"
              placeholder="e.g., 2025"
              value={newYear}
              onChange={(e) => setNewYear(e.target.value)}
              className="w-full px-4 py-3 border border-slate-200 rounded-xl mb-6 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition duration-200 text-sm text-slate-800 placeholder-slate-400"
              autoFocus
            />
            
            <div className="flex space-x-3">
              <button
                onClick={() => setShowAddYearModal(false)}
                className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition active:scale-98"
              >
                Cancel
              </button>
              <button
                onClick={addYear}
                className="flex-1 py-3 rounded-xl bg-primary hover:bg-primary/95 text-white text-sm font-semibold hover:shadow-lg hover:shadow-primary/10 transition active:scale-98"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Year Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-6 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-50 transform transition-all duration-300 scale-95 animate-in zoom-in-95">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-slate-800 text-lg font-bold text-red-650">Delete Savings Year</h3>
              <button
                onClick={() => setShowDeleteModal(false)}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-slate-500 text-sm mb-6 leading-relaxed">
              Are you sure you want to delete <span className="font-semibold text-slate-800">{yearToDelete}</span>? All savings group transactions for this cycle will be lost. This action is permanent.
            </p>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition active:scale-98"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 py-3 rounded-xl bg-primary hover:bg-primary/95 text-white text-sm font-semibold hover:shadow-lg hover:shadow-primary/10 transition active:scale-98"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}