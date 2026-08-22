import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, History, DollarSign, X, Check, Calculator, AlertCircle, Coins, Settings } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { getBudgetPlanQuery, createBudgetPlanQuery, recordExpenseQuery, deleteBudgetPlanQuery, updateBudgetPlanIncomeQuery, updateBudgetCategoriesQuery, getIncomeHistoryQuery, IBudgetPlan, IBudgetCategory, IIncomeRecord } from '../../queries/budget';

export default function BudgetPlanner() {
  const navigate = useNavigate();
  const { user } = userAuthWorkaround();

  // Budget states
  const [activePlan, setActivePlan] = useState<IBudgetPlan | null>(null);
  const [incomeHistory, setIncomeHistory] = useState<IIncomeRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Setup Form States
  const [incomeAmount, setIncomeAmount] = useState('20000');
  const [payPeriod, setPayPeriod] = useState('monthly');
  const [presetType, setPresetType] = useState<'503020' | '702010' | 'custom'>('503020');
  
  // Custom Category configurations
  const [customCategories, setCustomCategories] = useState<{ name: string; percentage: number }[]>([
    { name: 'Needs (Rent, Bills, Food)', percentage: 50 },
    { name: 'Wants (Travel, Entertainment)', percentage: 30 },
    { name: 'Savings & Investments', percentage: 20 }
  ]);
  const [newCatName, setNewCatName] = useState('');
  const [newCatPercentage, setNewCatPercentage] = useState('10');
  const [setupError, setSetupError] = useState('');

  // Log Expense States
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<IBudgetCategory | null>(null);
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [expenseError, setExpenseError] = useState('');

  // Distribute New Paycheck States
  const [showDistributeModal, setShowDistributeModal] = useState(false);
  const [newPaycheckAmount, setNewPaycheckAmount] = useState('');
  const [resetSpentAmounts, setResetSpentAmounts] = useState(true);
  const [distributeError, setDistributeError] = useState('');

  // Edit Envelope Setup Configuration States
  const [showEditSetupModal, setShowEditSetupModal] = useState(false);
  const [editPayPeriod, setEditPayPeriod] = useState('monthly');
  const [editCategories, setEditCategories] = useState<{ id?: string; name: string; percentage: number }[]>([]);
  const [editNewCatName, setEditNewCatName] = useState('');
  const [editNewCatPercentage, setEditNewCatPercentage] = useState('10');
  const [editError, setEditError] = useState('');

  // Transactions History Collapsible State
  const [openHistoryId, setOpenHistoryId] = useState<string | null>(null);

  // Workaround for useAuth hook safety
  function userAuthWorkaround() {
    const auth = useAuth();
    return auth;
  }

  const loadBudgetPlan = async () => {
    if (user) {
      try {
        const plan = await getBudgetPlanQuery(user.userId);
        setActivePlan(plan);
        const history = await getIncomeHistoryQuery(user.userId);
        setIncomeHistory(history);
      } catch (err) {
        console.error('Error fetching budget plan:', err);
      } finally {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    if (user) {
      loadBudgetPlan();
    }
  }, [user]);

  // Adjust categories when preset changes
  useEffect(() => {
    if (presetType === '503020') {
      setCustomCategories([
        { name: 'Needs (Rent, Bills, Food)', percentage: 50 },
        { name: 'Wants (Dining, Shopping)', percentage: 30 },
        { name: 'Savings & Ipon', percentage: 20 }
      ]);
    } else if (presetType === '702010') {
      setCustomCategories([
        { name: 'Needs & Living Expenses', percentage: 70 },
        { name: 'Wants & Lifestyle', percentage: 20 },
        { name: 'Savings & Emergency Fund', percentage: 10 }
      ]);
    }
  }, [presetType]);

  const totalPercentage = customCategories.reduce((sum, cat) => sum + cat.percentage, 0);

  const handleAddCustomCategory = () => {
    setSetupError('');
    if (!newCatName.trim()) {
      setSetupError('Category name cannot be empty.');
      return;
    }
    const percent = parseFloat(newCatPercentage);
    if (isNaN(percent) || percent <= 0 || percent > 100) {
      setSetupError('Please enter a valid percentage (1-100).');
      return;
    }
    if (totalPercentage + percent > 100) {
      setSetupError('Total percentage cannot exceed 100%.');
      return;
    }

    setCustomCategories([
      ...customCategories,
      { name: newCatName.trim(), percentage: percent }
    ]);
    setNewCatName('');
    setNewCatPercentage('10');
  };

  const handleRemoveCategory = (index: number) => {
    const list = [...customCategories];
    list.splice(index, 1);
    setCustomCategories(list);
  };

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setSetupError('');
    const income = parseFloat(incomeAmount);
    if (isNaN(income) || income <= 0) {
      setSetupError('Please enter a valid income amount.');
      return;
    }
    if (totalPercentage !== 100) {
      setSetupError(`The total percentage must equal exactly 100% (Current: ${totalPercentage}%).`);
      return;
    }

    if (user) {
      setIsLoading(true);
      try {
        const plan = await createBudgetPlanQuery(
          user.userId,
          income,
          payPeriod,
          customCategories
        );
        setActivePlan(plan);
        const history = await getIncomeHistoryQuery(user.userId);
        setIncomeHistory(history);
      } catch (err: any) {
        setSetupError(err?.message || 'Failed to create budget plan.');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleRecordExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setExpenseError('');
    if (!selectedCategory || !expenseAmount.trim() || !expenseDesc.trim() || !expenseDate) {
      setExpenseError('Please fill in all required fields.');
      return;
    }
    const amt = parseFloat(expenseAmount);
    if (isNaN(amt) || amt <= 0) {
      setExpenseError('Please enter a valid expense amount.');
      return;
    }

    try {
      await recordExpenseQuery({
        categoryId: selectedCategory.id,
        amount: amt,
        description: expenseDesc.trim(),
        transactionDate: expenseDate
      });
      await loadBudgetPlan();
      setShowExpenseModal(false);
      setExpenseAmount('');
      setExpenseDesc('');
    } catch (err: any) {
      setExpenseError(err?.message || 'Failed to record expense.');
    }
  };

  const handleDistributePaycheck = async (e: React.FormEvent) => {
    e.preventDefault();
    setDistributeError('');
    const amt = parseFloat(newPaycheckAmount);
    if (isNaN(amt) || amt <= 0) {
      setDistributeError('Please enter a valid paycheck amount.');
      return;
    }
    if (activePlan) {
      setIsLoading(true);
      try {
        await updateBudgetPlanIncomeQuery(activePlan.id, amt, resetSpentAmounts);
        await loadBudgetPlan();
        setShowDistributeModal(false);
        setNewPaycheckAmount('');
      } catch (err: any) {
        setDistributeError(err?.message || 'Failed to distribute new paycheck.');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleSaveEditSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditError('');
    const sum = editCategories.reduce((acc, cat) => acc + cat.percentage, 0);
    if (sum !== 100) {
      setEditError(`The total percentage must equal exactly 100% (Current: ${sum}%).`);
      return;
    }
    if (activePlan) {
      setIsLoading(true);
      try {
        await updateBudgetCategoriesQuery(activePlan.id, activePlan.incomeAmount, editPayPeriod, editCategories);
        await loadBudgetPlan();
        setShowEditSetupModal(false);
      } catch (err: any) {
        setEditError(err?.message || 'Failed to update setup.');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleResetPlan = async () => {
    if (!activePlan) return;
    if (confirm('Are you sure you want to reset your budget plan? All category allocations and logged expenses will be deleted.')) {
      setIsLoading(true);
      try {
        await deleteBudgetPlanQuery(activePlan.id);
        setActivePlan(null);
        setPresetType('503020');
        setIncomeHistory([]);
        setShowEditSetupModal(false);
      } catch (err) {
        console.error('Error deleting plan:', err);
      } finally {
        setIsLoading(false);
      }
    }
  };

  // Color arrays for category graphics
  const categoryColors = [
    '#6366f1', // Indigo
    '#f59e0b', // Amber
    '#10b981', // Emerald
    '#ec4899', // Pink
    '#06b6d4', // Cyan
    '#8b5cf6', // Violet
  ];

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col pb-8">
      {/* Top Header */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-950 to-primary/45 px-6 pt-12 pb-6 text-white relative overflow-hidden rounded-b-3xl border-b border-primary/20 shadow-lg flex items-center justify-between">
        <button
          onClick={() => navigate('/group-selection')}
          className="w-10 h-10 bg-white/10 hover:bg-white/15 border border-white/10 rounded-2xl flex items-center justify-center active:scale-95 transition cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <h1 className="text-white text-lg font-bold tracking-tight">Smart Budget Envelope</h1>
        <div className="w-10 h-10 flex items-center justify-center">
          {activePlan && (
            <button
              onClick={() => {
                setEditCategories(
                  activePlan.categories.map(c => ({
                    id: c.id,
                    name: c.name,
                    percentage: c.percentage
                  }))
                );
                setEditPayPeriod(activePlan.payPeriod);
                setEditError('');
                setShowEditSetupModal(true);
              }}
              className="w-10 h-10 bg-white/10 hover:bg-white/15 border border-white/10 rounded-2xl flex items-center justify-center active:scale-95 transition cursor-pointer"
              title="Edit Envelopes Configuration"
            >
              <Settings className="w-4 h-4 text-white" />
            </button>
          )}
        </div>
      </div>

      <div className="px-6 mt-6 flex-1 flex flex-col">
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center py-20">
            <div className="w-10 h-10 border-4 border-slate-200 border-t-primary rounded-full animate-spin"></div>
          </div>
        ) : !activePlan ? (
          /* STEP 1: CREATE PLAN WIZARD */
          <div className="bg-white rounded-3xl p-6 border border-slate-150/80 shadow-sm animate-in fade-in duration-300">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center shadow-inner">
                <Calculator className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-slate-800 text-sm font-bold">Personal Budget Setup</h3>
                <p className="text-slate-400 text-[10px] font-light">Divide your income into separate envelopes</p>
              </div>
            </div>

            {setupError && (
              <div className="bg-red-50 text-red-650 text-xs font-semibold px-3.5 py-2.5 rounded-xl text-center mb-4 flex items-center justify-center space-x-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{setupError}</span>
              </div>
            )}

            <form onSubmit={handleCreatePlan} className="space-y-4">
              {/* Income Amount */}
              <div>
                <label htmlFor="incomeAmount" className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5 ml-1">
                  Salary / Income Amount (₱)
                </label>
                <input
                  id="incomeAmount"
                  type="number"
                  value={incomeAmount}
                  onChange={(e) => setIncomeAmount(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition duration-200 text-sm text-slate-800 font-bold placeholder-slate-400"
                  required
                />
              </div>

              {/* Pay Period */}
              <div>
                <label htmlFor="payPeriod" className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5 ml-1">
                  Pay Cycle
                </label>
                <select
                  id="payPeriod"
                  value={payPeriod}
                  onChange={(e) => setPayPeriod(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition duration-200 text-sm text-slate-800 bg-white"
                >
                  <option value="monthly">Monthly Paycheck</option>
                  <option value="semi-monthly">Semi-Monthly (Cut-off)</option>
                  <option value="weekly">Weekly Wages</option>
                </select>
              </div>

              {/* Budget Allocation Presets */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5 ml-1">
                  Budget Allocator Presets
                </label>
                <div className="flex bg-slate-100 p-1 rounded-xl mb-4">
                  <button
                    type="button"
                    onClick={() => setPresetType('503020')}
                    className="flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer bg-white text-primary shadow-sm"
                  >
                    50/30/20 Rule
                  </button>
                  <button
                    type="button"
                    onClick={() => setPresetType('702010')}
                    className="flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer bg-slate-100 text-slate-500 hover:text-slate-700"
                  >
                    70/20/10 Rule
                  </button>
                  <button
                    type="button"
                    onClick={() => setPresetType('custom')}
                    className="flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer bg-slate-100 text-slate-500 hover:text-slate-700"
                  >
                    Custom Setup
                  </button>
                </div>
              </div>

              {/* Category Matrix */}
              <div className="space-y-3">
                <h4 className="text-slate-800 text-xs font-bold uppercase tracking-wider pl-1 mb-1">Envelope Allocations</h4>
                {customCategories.map((cat, index) => {
                  const val = parseFloat(incomeAmount) || 0;
                  const share = (val * cat.percentage) / 100;
                  return (
                    <div key={index} className="bg-slate-50 border border-slate-100 p-3 rounded-2xl flex items-center justify-between shadow-sm">
                      <div className="flex-1 min-w-0 pr-2">
                        <p className="text-xs font-bold text-slate-800 truncate">{cat.name}</p>
                        <p className="text-[10px] text-slate-400 font-medium leading-relaxed">
                          Allocated: ₱{share.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      </div>

                      <div className="flex items-center space-x-2">
                        {presetType === 'custom' ? (
                          <div className="flex items-center space-x-1">
                            <input
                              type="number"
                              value={cat.percentage}
                              onChange={(e) => {
                                const list = [...customCategories];
                                list[index].percentage = parseFloat(e.target.value) || 0;
                                setCustomCategories(list);
                              }}
                              className="w-14 px-1.5 py-1 border border-slate-200 rounded-lg text-center text-xs font-bold text-slate-800 focus:outline-none"
                              min={1}
                              max={100}
                            />
                            <span className="text-slate-500 text-xs font-bold">%</span>
                          </div>
                        ) : (
                          <span className="text-slate-700 text-xs font-extrabold">{cat.percentage}%</span>
                        )}

                        {presetType === 'custom' && (
                          <button
                            type="button"
                            onClick={() => handleRemoveCategory(index)}
                            className="p-1 hover:bg-red-50 text-red-500 rounded-lg active:scale-95 animate-in fade-in"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Add Custom Category form (if custom selected) */}
                {presetType === 'custom' && (
                  <div className="bg-slate-50 border border-dashed border-slate-200 p-3.5 rounded-2xl space-y-3 animate-in slide-in-from-bottom-2 duration-200">
                    <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Add Custom Envelope</p>
                    <div className="grid grid-cols-3 gap-2">
                      <input
                        type="text"
                        placeholder="Envelope Name (e.g. Travel)"
                        value={newCatName}
                        onChange={(e) => setNewCatName(e.target.value)}
                        className="col-span-2 px-2 py-2 border border-slate-200 rounded-lg text-xs"
                      />
                      <input
                        type="number"
                        placeholder="%"
                        value={newCatPercentage}
                        onChange={(e) => setNewCatPercentage(e.target.value)}
                        className="px-2.5 py-2 border border-slate-200 rounded-lg text-xs text-center font-bold"
                        min={1}
                        max={100}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleAddCustomCategory}
                      className="w-full bg-slate-200 hover:bg-slate-250 text-slate-755 py-2 rounded-xl text-xs font-bold transition active:scale-[0.98]"
                    >
                      + Add Category
                    </button>
                  </div>
                )}
              </div>

              {/* Total Percent Tracker */}
              <div className="pt-3 border-t border-slate-100 flex justify-between items-center text-xs font-bold">
                <span className="text-slate-500">Total Allocated:</span>
                <span className={totalPercentage === 100 ? 'text-emerald-500' : 'text-red-500'}>
                  {totalPercentage}% / 100%
                </span>
              </div>

              <button
                type="submit"
                disabled={totalPercentage !== 100}
                className="w-full bg-primary hover:bg-primary/95 text-white py-3.5 rounded-2xl font-bold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 active:scale-[0.98] text-sm cursor-pointer mt-4"
              >
                Activate Budget Plan
              </button>
            </form>
          </div>
        ) : (
          /* STEP 2: BUDGET RUNNING TRACKER VIEW */
          <div className="space-y-5 animate-in fade-in duration-300">
            {/* Total Budget Card Info */}
            <div className="bg-gradient-to-tr from-slate-900 via-slate-950 to-primary/45 rounded-3xl p-5 border border-primary/25 text-white relative overflow-hidden shadow-md">
              <div className="absolute right-0 bottom-0 translate-x-2 translate-y-2 w-24 h-24 bg-primary/10 rounded-full blur-2xl pointer-events-none" />
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-[10px] text-primary font-bold uppercase tracking-wider">Salary Envelope Budget</p>
                  <h3 className="text-xl font-black mt-0.5">
                    ₱{activePlan.incomeAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </h3>
                </div>
                <div className="flex flex-col items-end space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest bg-white/10 px-2.5 py-1 rounded-lg border border-white/10">
                    {activePlan.payPeriod}
                  </span>
                  
                  {/* Repetitive paycheck topup action button */}
                  <button
                    onClick={() => {
                      setNewPaycheckAmount('');
                      setResetSpentAmounts(true);
                      setDistributeError('');
                      setShowDistributeModal(true);
                    }}
                    className="px-2.5 py-1.5 bg-white/20 hover:bg-white/25 border border-white/25 rounded-xl text-[9px] font-bold transition active:scale-95 flex items-center space-x-1 cursor-pointer"
                  >
                    <Coins className="w-3 h-3" />
                    <span>New Paycheck</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 border-t border-white/10 pt-4 mt-2">
                <div>
                  <span className="text-[9px] text-white/60 font-semibold uppercase tracking-wider">Total Spent</span>
                  <p className="text-slate-200 text-sm font-bold mt-0.5">
                    ₱{activePlan.categories
                      .reduce((sum, c) => sum + c.spentAmount, 0)
                      .toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div>
                  <span className="text-[9px] text-white/60 font-semibold uppercase tracking-wider">Overall Remaining</span>
                  <p className="text-emerald-400 text-sm font-extrabold mt-0.5">
                    ₱{Math.max(0, activePlan.incomeAmount - activePlan.categories.reduce((sum, c) => sum + c.spentAmount, 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            </div>

            {/* Nav button to paycheck history screen (MOVED TO TOP PER USER REQUEST) */}
            <div>
              <button
                onClick={() => navigate('/budget-history')}
                className="w-full bg-white rounded-3xl p-4 border border-slate-150/80 shadow-sm flex items-center justify-between hover:border-primary/20 hover:shadow-md transition active:scale-[0.99] group cursor-pointer"
              >
                <div className="flex items-center space-x-3.5">
                  <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary shadow-inner">
                    <History className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <p className="text-slate-850 text-xs font-bold">Paycheck History Logs</p>
                    <p className="text-slate-400 text-[10px] font-light">View all previous paycheck distributions</p>
                  </div>
                </div>
                <div className="flex items-center space-x-1.5">
                  <span className="text-[10px] text-slate-550 font-bold bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-lg">
                    {incomeHistory.length} records
                  </span>
                </div>
              </button>
            </div>

            {/* Interactive Donut Graphic representation of Categories Allocation */}
            <div className="bg-white rounded-3xl p-5 border border-slate-150/80 shadow-sm flex items-center">
              <div className="w-24 h-24 mr-4 flex-shrink-0 flex items-center justify-center relative">
                <svg className="w-full h-full transform -rotate-90">
                  <circle cx="48" cy="48" r="40" stroke="#f1f5f9" strokeWidth="8" fill="transparent" />
                  {(() => {
                    let accumulatedPercent = 0;
                    return activePlan.categories.map((cat, idx) => {
                      const color = categoryColors[idx % categoryColors.length];
                      const strokeDasharray = `${(cat.percentage / 100) * 251.2} 251.2`;
                      const strokeDashoffset = -((accumulatedPercent / 100) * 251.2);
                      accumulatedPercent += cat.percentage;
                      return (
                        <circle
                          key={cat.id}
                          cx="48"
                          cy="48"
                          r="40"
                          stroke={color}
                          strokeWidth="8"
                          strokeDasharray={strokeDasharray}
                          strokeDashoffset={strokeDashoffset}
                          fill="transparent"
                          className="transition-all duration-500"
                        />
                      );
                    });
                  })()}
                </svg>
                <div className="absolute text-slate-800 font-extrabold text-[10px] text-center uppercase tracking-wider">
                  Budgets
                </div>
              </div>

              <div className="flex-1 min-w-0 grid grid-cols-2 gap-x-2 gap-y-1.5">
                {activePlan.categories.map((cat, idx) => (
                  <div key={cat.id} className="flex items-center space-x-2 text-[10px]">
                    <div
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: categoryColors[idx % categoryColors.length] }}
                    />
                    <span className="text-slate-655 font-bold truncate flex-1">{cat.name.split(' ')[0]}</span>
                    <span className="text-slate-800 font-extrabold">{cat.percentage}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Categories Envelope Listings */}
            <div className="space-y-4">
              <h4 className="text-slate-800 text-xs font-bold uppercase tracking-wider pl-1">Envelope Budgets</h4>
              
              {activePlan.categories.map((cat, idx) => {
                const remaining = Math.max(0, cat.allocatedAmount - cat.spentAmount);
                const pctUsed = cat.allocatedAmount > 0 ? (cat.spentAmount / cat.allocatedAmount) * 100 : 0;
                const isOverBudget = cat.spentAmount > cat.allocatedAmount;
                const isWarning = pctUsed >= 85 && !isOverBudget;
                const color = categoryColors[idx % categoryColors.length];
                const isOpen = openHistoryId === cat.id;

                return (
                  <div key={cat.id} className="bg-white rounded-3xl p-5 border border-slate-150/80 shadow-sm flex flex-col transition-all">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1 min-w-0 pr-3">
                        <div className="flex items-center space-x-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                          <h4 className="text-slate-800 text-sm font-bold truncate">{cat.name}</h4>
                        </div>
                        <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                          Allocated: ₱{cat.allocatedAmount.toLocaleString()} ({cat.percentage}%)
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Remaining</p>
                        <p className={`text-sm font-black ${
                          isOverBudget ? 'text-red-500 animate-pulse' : isWarning ? 'text-amber-500' : 'text-slate-800'
                        }`}>
                          ₱{remaining.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mb-3 relative">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(100, pctUsed)}%`,
                          backgroundColor: isOverBudget ? '#ef4444' : isWarning ? '#f59e0b' : color
                        }}
                      />
                    </div>

                    {/* Meta info & actions panel */}
                    <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => setOpenHistoryId(isOpen ? null : cat.id)}
                          className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200/80 text-slate-650 text-[10px] font-bold rounded-lg flex items-center space-x-1 transition active:scale-95 cursor-pointer"
                        >
                          <History className="w-3 h-3" />
                          <span>History ({cat.transactions?.length || 0})</span>
                        </button>
                      </div>

                      <button
                        onClick={() => {
                          setSelectedCategory(cat);
                          setExpenseAmount('');
                          setExpenseDesc('');
                          setExpenseDate(new Date().toISOString().split('T')[0]);
                          setExpenseError('');
                          setShowExpenseModal(true);
                        }}
                        className="px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white text-[10px] font-bold rounded-lg flex items-center space-x-1 transition active:scale-95 shadow-sm shadow-indigo-500/10 cursor-pointer"
                      >
                        <DollarSign className="w-3 h-3" />
                        <span>Log Expense</span>
                      </button>
                    </div>

                    {/* Transactions Dropdown */}
                    {isOpen && (
                      <div className="mt-4 border-t border-dashed border-slate-100 pt-3 space-y-2.5 animate-in slide-in-from-top-2 duration-200">
                        <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mb-2">Logged Expenses</p>
                        {!cat.transactions || cat.transactions.length === 0 ? (
                          <p className="text-center text-slate-450 text-[10px] font-light py-2">No expenses logged in this envelope.</p>
                        ) : (
                          cat.transactions.map((tx) => (
                            <div key={tx.id} className="flex justify-between items-center p-2.5 border border-slate-100 rounded-xl bg-slate-50/50">
                              <div>
                                <p className="text-slate-800 text-xs font-bold">{tx.description}</p>
                                <p className="text-slate-400 text-[9px] font-medium">{tx.transactionDate}</p>
                              </div>
                              <span className="text-xs font-extrabold text-red-500">
                                -₱{tx.amount.toLocaleString()}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Log Expense Modal */}
      {showExpenseModal && selectedCategory && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-6 z-50 animate-in fade-in duration-200">
          <form onSubmit={handleRecordExpense} className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-55 transform transition-all duration-300 scale-95 animate-in zoom-in-95">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-slate-800 text-lg font-bold flex items-center space-x-2">
                <DollarSign className="w-5 h-5 text-indigo-500" />
                <span>Log Expense: {selectedCategory.name.split(' ')[0]}</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowExpenseModal(false)}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {expenseError && (
              <div className="bg-red-50 text-red-650 text-xs font-semibold px-3.5 py-2.5 rounded-xl text-center mb-4">
                {expenseError}
              </div>
            )}

            <div className="space-y-4 mb-6">
              <div>
                <label htmlFor="expenseAmount" className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5 ml-1">
                  Expense Amount (₱)
                </label>
                <input
                  id="expenseAmount"
                  type="number"
                  placeholder="e.g. 250"
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition duration-200 text-sm text-slate-800 placeholder-slate-400 font-bold"
                  required
                />
              </div>

              <div>
                <label htmlFor="expenseDesc" className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5 ml-1">
                  Description / Payee
                </label>
                <input
                  id="expenseDesc"
                  type="text"
                  placeholder="e.g. Grocery shopping"
                  value={expenseDesc}
                  onChange={(e) => setExpenseDesc(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition duration-200 text-sm text-slate-800 placeholder-slate-400"
                  required
                />
              </div>

              <div>
                <label htmlFor="expenseDate" className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5 ml-1">
                  Transaction Date
                </label>
                <input
                  id="expenseDate"
                  type="date"
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition duration-200 text-sm text-slate-800 bg-white"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-indigo-500 hover:bg-indigo-650 text-white py-3.5 rounded-2xl font-bold shadow-lg hover:shadow-xl transition-all duration-200 active:scale-[0.98] text-sm cursor-pointer"
            >
              Log Expense
            </button>
          </form>
        </div>
      )}

      {/* Distribute New Paycheck Modal */}
      {showDistributeModal && activePlan && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-6 z-50 animate-in fade-in duration-200">
          <form onSubmit={handleDistributePaycheck} className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-55 transform transition-all duration-300 scale-95 animate-in zoom-in-95">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-slate-800 text-lg font-bold flex items-center space-x-2">
                <Coins className="w-5 h-5 text-primary" />
                <span>New Paycheck</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowDistributeModal(false)}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {distributeError && (
              <div className="bg-red-50 text-red-650 text-xs font-semibold px-3.5 py-2.5 rounded-xl text-center mb-4">
                {distributeError}
              </div>
            )}

            <div className="space-y-4 mb-6">
              <div>
                <label htmlFor="newPaycheckAmount" className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5 ml-1">
                  Paycheck Amount (₱)
                </label>
                <input
                  id="newPaycheckAmount"
                  type="number"
                  placeholder="e.g. 25000"
                  value={newPaycheckAmount}
                  onChange={(e) => setNewPaycheckAmount(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition duration-200 text-sm text-slate-800 placeholder-slate-400 font-bold"
                  required
                />
              </div>

              {/* Dynamic Division of Money Live Preview */}
              {newPaycheckAmount && !isNaN(parseFloat(newPaycheckAmount)) && parseFloat(newPaycheckAmount) > 0 && (
                <div className="bg-slate-50 border border-slate-150 p-3.5 rounded-2xl space-y-2.5 animate-in fade-in duration-200">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider pl-0.5">Envelope Allocation Division</p>
                  <div className="space-y-1.5">
                    {activePlan.categories.map((cat, idx) => {
                      const share = (parseFloat(newPaycheckAmount) * cat.percentage) / 100;
                      const leftover = resetSpentAmounts ? Math.max(0, cat.allocatedAmount - cat.spentAmount) : 0;
                      return (
                        <div key={cat.id} className="flex justify-between items-center text-xs">
                          <span className="text-slate-550 truncate pr-2 flex items-center space-x-1.5">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: categoryColors[idx % categoryColors.length] }} />
                            <span>{cat.name.split(' ')[0]} ({cat.percentage}%)</span>
                          </span>
                          <span className="text-slate-800 font-extrabold flex flex-col items-end">
                            <span>₱{share.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            {leftover > 0 && (
                              <span className="text-[8px] text-emerald-600 font-normal">
                                +₱{leftover.toLocaleString()} carryover
                              </span>
                            )}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Start new cycle / Rollover options */}
              <div className="flex items-start space-x-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                <input
                  id="resetSpent"
                  type="checkbox"
                  checked={resetSpentAmounts}
                  onChange={(e) => setResetSpentAmounts(e.target.checked)}
                  className="mt-1 w-4 h-4 rounded text-primary focus:ring-primary/30 border-slate-200"
                />
                <label htmlFor="resetSpent" className="text-xs text-slate-600 leading-normal select-none">
                  <span className="font-bold text-slate-850 block">Start Fresh Budget Cycle</span>
                  Check this to reset all current category spent amounts to ₱0 and carry over leftover money. Uncheck to keep spent balances.
                </label>
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-primary hover:bg-primary/95 text-white py-3.5 rounded-2xl font-bold shadow-lg hover:shadow-xl transition-all duration-200 active:scale-[0.98] text-sm cursor-pointer"
            >
              Distribute Income
            </button>
          </form>
        </div>
      )}

      {/* Edit Envelope Setup Configuration Modal */}
      {showEditSetupModal && activePlan && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-6 z-50 animate-in fade-in duration-200">
          <form onSubmit={handleSaveEditSetup} className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-55 transform transition-all duration-300 scale-95 animate-in zoom-in-95">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-slate-800 text-base font-bold flex items-center space-x-2">
                <Settings className="w-5 h-5 text-slate-650" />
                <span>Configure Envelopes</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowEditSetupModal(false)}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {editError && (
              <div className="bg-red-50 text-red-655 text-xs font-semibold px-3.5 py-2.5 rounded-xl text-center mb-4">
                {editError}
              </div>
            )}

            <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1 mb-5">
              {/* Pay Cycle Change option */}
              <div>
                <label htmlFor="editPayPeriod" className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5 ml-1">
                  Pay Cycle (Frequency)
                </label>
                <select
                  id="editPayPeriod"
                  value={editPayPeriod}
                  onChange={(e) => setEditPayPeriod(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition duration-200 text-sm text-slate-800 bg-white"
                >
                  <option value="monthly">Monthly Paycheck</option>
                  <option value="semi-monthly">Semi-Monthly (Cut-off)</option>
                  <option value="weekly">Weekly Wages</option>
                </select>
              </div>

              <p className="text-[10px] text-slate-450 font-semibold uppercase tracking-wider pl-1 pt-2">Renames & Percentages</p>
              
              {editCategories.map((cat, index) => (
                <div key={index} className="bg-slate-50 border border-slate-100 p-3 rounded-2xl flex items-center justify-between space-x-2">
                  <div className="flex-1 space-y-1.5">
                    <input
                      type="text"
                      value={cat.name}
                      onChange={(e) => {
                        const list = [...editCategories];
                        list[index].name = e.target.value;
                        setEditCategories(list);
                      }}
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-800 bg-white"
                      placeholder="Category Name"
                      required
                    />
                    <div className="flex items-center space-x-1.5">
                      <span className="text-[10px] text-slate-400">Share:</span>
                      <input
                        type="number"
                        value={cat.percentage}
                        onChange={(e) => {
                          const list = [...editCategories];
                          list[index].percentage = parseFloat(e.target.value) || 0;
                          setEditCategories(list);
                        }}
                        className="w-16 px-1.5 py-0.5 border border-slate-200 rounded-lg text-center text-xs font-bold text-slate-800"
                        min={1}
                        max={100}
                        required
                      />
                      <span className="text-slate-550 text-xs font-bold">%</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const list = editCategories.filter((_, i) => i !== index);
                      setEditCategories(list);
                    }}
                    disabled={editCategories.length <= 1}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-xl disabled:opacity-40"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}

              {/* Add category inline in editing */}
              <div className="bg-slate-50 border border-dashed border-slate-200 p-3 rounded-2xl space-y-2">
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider pl-0.5">Add Envelope</p>
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="text"
                    placeholder="e.g. Health"
                    value={editNewCatName}
                    onChange={(e) => setEditNewCatName(e.target.value)}
                    className="col-span-2 px-2 py-1.5 border border-slate-200 rounded-lg text-xs"
                  />
                  <input
                    type="number"
                    placeholder="%"
                    value={editNewCatPercentage}
                    onChange={(e) => setEditNewCatPercentage(e.target.value)}
                    className="px-2 py-1.5 border border-slate-200 rounded-lg text-xs text-center font-bold"
                    min={1}
                    max={100}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!editNewCatName.trim()) return;
                    const pct = parseFloat(editNewCatPercentage) || 10;
                    setEditCategories([
                      ...editCategories,
                      { name: editNewCatName.trim(), percentage: pct }
                    ]);
                    setEditNewCatName('');
                    setEditNewCatPercentage('10');
                  }}
                  className="w-full bg-slate-200 hover:bg-slate-250 text-slate-755 py-1.5 rounded-lg text-xs font-bold"
                >
                  + Add Envelope
                </button>
              </div>
            </div>

            {/* Total percent tracker */}
            <div className="flex justify-between items-center text-xs font-bold pt-3 border-t border-slate-100 mb-4">
              <span className="text-slate-500">Total Shares:</span>
              <span className={editCategories.reduce((acc, cat) => acc + cat.percentage, 0) === 100 ? 'text-emerald-500' : 'text-red-500'}>
                {editCategories.reduce((acc, cat) => acc + cat.percentage, 0)}% / 100%
              </span>
            </div>

            <div className="space-y-2">
              <button
                type="submit"
                disabled={editCategories.reduce((acc, cat) => acc + cat.percentage, 0) !== 100}
                className="w-full bg-slate-800 hover:bg-slate-900 text-white py-3 rounded-xl font-bold text-xs disabled:opacity-50"
              >
                Save Configurations
              </button>
              <button
                type="button"
                onClick={handleResetPlan}
                className="w-full border border-red-200 hover:bg-red-50 text-red-500 py-3 rounded-xl font-bold text-xs"
              >
                Delete Budget Plan
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
