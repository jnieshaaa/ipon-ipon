import { supabase } from '../lib/supabase';

export interface IBudgetPlan {
  id: string;
  userId: string;
  incomeAmount: number;
  payPeriod: string;
  categories: IBudgetCategory[];
  createdAt?: string;
}

export interface IBudgetCategory {
  id: string;
  planId: string;
  name: string;
  percentage: number;
  allocatedAmount: number;
  spentAmount: number;
  transactions?: IBudgetTransaction[];
}

export interface IBudgetTransaction {
  id: string;
  categoryId: string;
  amount: number;
  description: string;
  transactionDate: string;
  createdAt?: string;
}

export interface IIncomeRecord {
  id: string;
  userId: string;
  amount: number;
  payPeriod: string;
  receivedDate: string;
  createdAt?: string;
}

const isMockMode = (): boolean => {
  return import.meta.env.VITE_USE_MOCK === 'true' || 
         !import.meta.env.VITE_SUPABASE_URL || 
         !import.meta.env.VITE_SUPABASE_ANON_KEY;
};

// Helper mock storage access
function getMockPlans(): IBudgetPlan[] {
  try {
    const data = localStorage.getItem('ipon_mock_budget_plans');
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
}

function saveMockPlans(plans: IBudgetPlan[]) {
  localStorage.setItem('ipon_mock_budget_plans', JSON.stringify(plans));
}

function getMockCategories(): IBudgetCategory[] {
  try {
    const data = localStorage.getItem('ipon_mock_budget_categories');
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
}

function saveMockCategories(categories: IBudgetCategory[]) {
  localStorage.setItem('ipon_mock_budget_categories', JSON.stringify(categories));
}

function getMockTransactions(): IBudgetTransaction[] {
  try {
    const data = localStorage.getItem('ipon_mock_budget_transactions');
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
}

function saveMockTransactions(transactions: IBudgetTransaction[]) {
  localStorage.setItem('ipon_mock_budget_transactions', JSON.stringify(transactions));
}

function getMockIncomeHistory(): IIncomeRecord[] {
  try {
    const data = localStorage.getItem('ipon_mock_income_history');
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
}

function saveMockIncomeHistory(history: IIncomeRecord[]) {
  localStorage.setItem('ipon_mock_income_history', JSON.stringify(history));
}

// Fetch the active budget plan for a user
export async function getBudgetPlanQuery(userId: string): Promise<IBudgetPlan | null> {
  if (isMockMode()) {
    const plans = getMockPlans().filter(p => p.userId === userId);
    if (plans.length === 0) return null;
    
    const activePlan = plans[plans.length - 1];
    const categories = getMockCategories().filter(c => c.planId === activePlan.id);
    const transactions = getMockTransactions();

    const categoriesWithTx = categories.map(cat => {
      const catTx = transactions.filter(t => t.categoryId === cat.id);
      const spentAmount = catTx.reduce((sum, t) => sum + t.amount, 0);
      return {
        ...cat,
        spentAmount,
        transactions: catTx
      };
    });

    return {
      ...activePlan,
      categories: categoriesWithTx
    };
  }

  try {
    const { data: plans, error: planError } = await supabase
      .from('budget_plans')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (planError) throw planError;
    if (!plans || plans.length === 0) return null;

    const plan = plans[0];
    const { data: categories, error: catError } = await supabase
      .from('budget_categories')
      .select('*')
      .eq('plan_id', plan.id);

    if (catError) throw catError;

    const categoryIds = (categories || []).map(c => c.id);
    let transactions: any[] = [];
    if (categoryIds.length > 0) {
      const { data: txs, error: txError } = await supabase
        .from('budget_transactions')
        .select('*')
        .in('category_id', categoryIds)
        .order('transaction_date', { ascending: false });
      if (!txError && txs) {
        transactions = txs;
      }
    }

    const parsedCategories: IBudgetCategory[] = (categories || []).map(c => {
      const catTx = transactions
        .filter(t => t.category_id === c.id)
        .map(t => ({
          id: t.id,
          categoryId: t.category_id,
          amount: Number(t.amount),
          description: t.description,
          transactionDate: t.transaction_date,
          createdAt: t.created_at
        }));
      
      const spentAmount = catTx.reduce((sum, t) => sum + t.amount, 0);

      return {
        id: c.id,
        planId: c.plan_id,
        name: c.name,
        percentage: Number(c.percentage),
        allocatedAmount: Number(c.allocated_amount),
        spentAmount,
        transactions: catTx
      };
    });

    return {
      id: plan.id,
      userId: plan.user_id,
      incomeAmount: Number(plan.income_amount),
      payPeriod: plan.pay_period,
      categories: parsedCategories,
      createdAt: plan.created_at
    };
  } catch (error) {
    console.warn('Supabase fetch failed for budget plan. Falling back to LocalStorage.', error);
    const plans = getMockPlans().filter(p => p.userId === userId);
    if (plans.length === 0) return null;
    const activePlan = plans[plans.length - 1];
    const categories = getMockCategories().filter(c => c.planId === activePlan.id);
    const transactions = getMockTransactions();

    const categoriesWithTx = categories.map(cat => {
      const catTx = transactions.filter(t => t.categoryId === cat.id);
      const spentAmount = catTx.reduce((sum, t) => sum + t.amount, 0);
      return {
        ...cat,
        spentAmount,
        transactions: catTx
      };
    });

    return {
      ...activePlan,
      categories: categoriesWithTx
    };
  }
}

// Fetch income records history
export async function getIncomeHistoryQuery(userId: string): Promise<IIncomeRecord[]> {
  if (isMockMode()) {
    return getMockIncomeHistory()
      .filter(h => h.userId === userId)
      .sort((a, b) => b.receivedDate.localeCompare(a.receivedDate));
  }

  try {
    const { data, error } = await supabase
      .from('budget_income_history')
      .select('*')
      .eq('user_id', userId)
      .order('received_date', { ascending: false });

    if (error) throw error;

    return (data || []).map(d => ({
      id: d.id,
      userId: d.user_id,
      amount: Number(d.amount),
      payPeriod: d.pay_period,
      receivedDate: d.received_date,
      createdAt: d.created_at
    }));
  } catch (error) {
    console.warn('Supabase fetch failed for income history. Falling back to LocalStorage.', error);
    return getMockIncomeHistory()
      .filter(h => h.userId === userId)
      .sort((a, b) => b.receivedDate.localeCompare(a.receivedDate));
  }
}

// Log a paycheck deposit
export async function recordIncomeQuery(input: {
  userId: string;
  amount: number;
  payPeriod: string;
  receivedDate: string;
}): Promise<IIncomeRecord> {
  const newRecord: IIncomeRecord = {
    id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15),
    userId: input.userId,
    amount: input.amount,
    payPeriod: input.payPeriod,
    receivedDate: input.receivedDate,
    createdAt: new Date().toISOString()
  };

  if (isMockMode()) {
    const history = getMockIncomeHistory();
    history.push(newRecord);
    saveMockIncomeHistory(history);
    return newRecord;
  }

  try {
    const { data, error } = await supabase
      .from('budget_income_history')
      .insert({
        user_id: input.userId,
        amount: input.amount,
        pay_period: input.payPeriod,
        received_date: input.receivedDate
      })
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      userId: data.user_id,
      amount: Number(data.amount),
      payPeriod: data.pay_period,
      receivedDate: data.received_date,
      createdAt: data.created_at
    };
  } catch (error) {
    console.warn('Supabase record income failed. Falling back to LocalStorage.', error);
    const history = getMockIncomeHistory();
    history.push(newRecord);
    saveMockIncomeHistory(history);
    return newRecord;
  }
}

// Create a new budget plan (and clear prior plan)
export async function createBudgetPlanQuery(
  userId: string,
  incomeAmount: number,
  payPeriod: string,
  categoriesInput: { name: string; percentage: number }[]
): Promise<IBudgetPlan> {
  const planId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15);
  
  const parsedCategories: IBudgetCategory[] = categoriesInput.map(c => {
    const catId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15);
    return {
      id: catId,
      planId,
      name: c.name,
      percentage: c.percentage,
      allocatedAmount: (incomeAmount * c.percentage) / 100,
      spentAmount: 0,
      transactions: []
    };
  });

  const newPlan: IBudgetPlan = {
    id: planId,
    userId,
    incomeAmount,
    payPeriod,
    categories: parsedCategories,
    createdAt: new Date().toISOString()
  };

  if (isMockMode()) {
    const plans = getMockPlans().filter(p => p.userId !== userId);
    plans.push(newPlan);
    saveMockPlans(plans);

    const categories = getMockCategories().filter(c => c.planId !== planId);
    categories.push(...parsedCategories);
    saveMockCategories(categories);

    // Record initial income history
    recordIncomeQuery({
      userId,
      amount: incomeAmount,
      payPeriod,
      receivedDate: new Date().toISOString().split('T')[0]
    }).catch(console.error);

    return newPlan;
  }

  try {
    const { data: oldPlans } = await supabase
      .from('budget_plans')
      .select('id')
      .eq('user_id', userId);

    if (oldPlans && oldPlans.length > 0) {
      const oldPlanIds = oldPlans.map(op => op.id);
      await supabase.from('budget_plans').delete().in('id', oldPlanIds);
    }

    const { data: planData, error: planError } = await supabase
      .from('budget_plans')
      .insert({
        user_id: userId,
        income_amount: incomeAmount,
        pay_period: payPeriod
      })
      .select()
      .single();

    if (planError) throw planError;

    const categoriesToInsert = categoriesInput.map(c => ({
      plan_id: planData.id,
      name: c.name,
      percentage: c.percentage,
      allocated_amount: (incomeAmount * c.percentage) / 100,
      spent_amount: 0
    }));

    const { data: catData, error: catError } = await supabase
      .from('budget_categories')
      .insert(categoriesToInsert)
      .select();

    if (catError) throw catError;

    const finalCategories: IBudgetCategory[] = (catData || []).map(c => ({
      id: c.id,
      planId: c.plan_id,
      name: c.name,
      percentage: Number(c.percentage),
      allocatedAmount: Number(c.allocated_amount),
      spentAmount: 0,
      transactions: []
    }));

    // Record income history paycheck
    await recordIncomeQuery({
      userId,
      amount: incomeAmount,
      payPeriod,
      receivedDate: new Date().toISOString().split('T')[0]
    });

    return {
      id: planData.id,
      userId: planData.user_id,
      incomeAmount: Number(planData.income_amount),
      payPeriod: planData.pay_period,
      categories: finalCategories,
      createdAt: planData.created_at
    };
  } catch (error) {
    console.warn('Supabase create plan failed. Falling back to LocalStorage.', error);
    const plans = getMockPlans().filter(p => p.userId !== userId);
    plans.push(newPlan);
    saveMockPlans(plans);

    const categories = getMockCategories().filter(c => c.planId !== planId);
    categories.push(...parsedCategories);
    saveMockCategories(categories);

    recordIncomeQuery({
      userId,
      amount: incomeAmount,
      payPeriod,
      receivedDate: new Date().toISOString().split('T')[0]
    }).catch(console.error);
    
    return newPlan;
  }
}

// Record an expense transaction
export async function recordExpenseQuery(input: {
  categoryId: string;
  amount: number;
  description: string;
  transactionDate: string;
}): Promise<IBudgetTransaction> {
  const newTx: IBudgetTransaction = {
    id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15),
    categoryId: input.categoryId,
    amount: input.amount,
    description: input.description,
    transactionDate: input.transactionDate,
    createdAt: new Date().toISOString()
  };

  if (isMockMode()) {
    const transactions = getMockTransactions();
    transactions.push(newTx);
    saveMockTransactions(transactions);
    return newTx;
  }

  try {
    const { data, error } = await supabase
      .from('budget_transactions')
      .insert({
        category_id: input.categoryId,
        amount: input.amount,
        description: input.description,
        transaction_date: input.transactionDate
      })
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      categoryId: data.category_id,
      amount: Number(data.amount),
      description: data.description,
      transactionDate: data.transaction_date,
      createdAt: data.created_at
    };
  } catch (error) {
    console.warn('Supabase record expense failed. Falling back to LocalStorage.', error);
    const transactions = getMockTransactions();
    transactions.push(newTx);
    saveMockTransactions(transactions);
    return newTx;
  }
}

// Reset/Delete budget plan
export async function deleteBudgetPlanQuery(planId: string): Promise<boolean> {
  if (isMockMode()) {
    const plans = getMockPlans().filter(p => p.id !== planId);
    saveMockPlans(plans);
    return true;
  }

  try {
    const { error } = await supabase
      .from('budget_plans')
      .delete()
      .eq('id', planId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.warn('Supabase delete budget plan failed. Falling back to LocalStorage.', error);
    const plans = getMockPlans().filter(p => p.id !== planId);
    saveMockPlans(plans);
    return true;
  }
}

// Update paycheck income amount and recalculate envelope allocations
export async function updateBudgetPlanIncomeQuery(
  planId: string,
  newIncomeAmount: number,
  resetSpentAmounts: boolean
): Promise<boolean> {
  if (isMockMode()) {
    const plans = getMockPlans();
    const planIndex = plans.findIndex(p => p.id === planId);
    if (planIndex !== -1) {
      const plan = plans[planIndex];
      const categories = getMockCategories();
      const planCats = categories.filter(c => c.planId === planId);

      let totalNewAllocated = 0;
      planCats.forEach(cat => {
        const leftover = resetSpentAmounts ? Math.max(0, cat.allocatedAmount - cat.spentAmount) : 0;
        const newAllocation = (newIncomeAmount * cat.percentage) / 100;
        cat.allocatedAmount = leftover + newAllocation;
        if (resetSpentAmounts) {
          cat.spentAmount = 0;
        }
        totalNewAllocated += cat.allocatedAmount;
      });

      plan.incomeAmount = totalNewAllocated;
      saveMockPlans(plans);

      const remainingCats = categories.filter(c => c.planId !== planId);
      saveMockCategories([...remainingCats, ...planCats]);

      if (resetSpentAmounts) {
        const transactions = getMockTransactions();
        const catIds = planCats.map(c => c.id);
        const filteredTxs = transactions.filter(t => !catIds.includes(t.categoryId));
        saveMockTransactions(filteredTxs);
      }

      // Record paycheck income record
      recordIncomeQuery({
        userId: plan.userId,
        amount: newIncomeAmount,
        payPeriod: plan.payPeriod,
        receivedDate: new Date().toISOString().split('T')[0]
      }).catch(console.error);
    }
    return true;
  }

  try {
    const { data: planData, error: planFetchErr } = await supabase
      .from('budget_plans')
      .select('user_id, pay_period')
      .eq('id', planId)
      .single();

    if (planFetchErr) throw planFetchErr;

    const { data: categories, error: catFetchError } = await supabase
      .from('budget_categories')
      .select('*')
      .eq('plan_id', planId);

    if (catFetchError) throw catFetchError;

    let totalNewAllocated = 0;
    if (categories) {
      for (const cat of categories) {
        const leftover = resetSpentAmounts ? Math.max(0, Number(cat.allocated_amount) - Number(cat.spent_amount || 0)) : 0;
        const newAllocation = (newIncomeAmount * Number(cat.percentage)) / 100;
        const newAllocated = leftover + newAllocation;
        totalNewAllocated += newAllocated;
        
        const updatePayload: any = { allocated_amount: newAllocated };
        if (resetSpentAmounts) {
          updatePayload.spent_amount = 0;
        }

        const { error: catUpdateError } = await supabase
          .from('budget_categories')
          .update(updatePayload)
          .eq('id', cat.id);

        if (catUpdateError) throw catUpdateError;

        if (resetSpentAmounts) {
          await supabase
            .from('budget_transactions')
            .delete()
            .eq('category_id', cat.id);
        }
      }
    }

    const { error: planError } = await supabase
      .from('budget_plans')
      .update({ income_amount: totalNewAllocated })
      .eq('id', planId);

    if (planError) throw planError;

    // Record income paycheck record
    if (planData) {
      await recordIncomeQuery({
        userId: planData.user_id,
        amount: newIncomeAmount,
        payPeriod: planData.pay_period,
        receivedDate: new Date().toISOString().split('T')[0]
      });
    }

    return true;
  } catch (error) {
    console.warn('Supabase update income failed. Falling back to LocalStorage.', error);
    const plans = getMockPlans();
    const planIndex = plans.findIndex(p => p.id === planId);
    if (planIndex !== -1) {
      const plan = plans[planIndex];
      const categories = getMockCategories();
      const planCats = categories.filter(c => c.planId === planId);

      let totalNewAllocated = 0;
      planCats.forEach(cat => {
        const leftover = resetSpentAmounts ? Math.max(0, cat.allocatedAmount - cat.spentAmount) : 0;
        const newAllocation = (newIncomeAmount * cat.percentage) / 100;
        cat.allocatedAmount = leftover + newAllocation;
        if (resetSpentAmounts) {
          cat.spentAmount = 0;
        }
        totalNewAllocated += cat.allocatedAmount;
      });

      plan.incomeAmount = totalNewAllocated;
      saveMockPlans(plans);

      const remainingCats = categories.filter(c => c.planId !== planId);
      saveMockCategories([...remainingCats, ...planCats]);

      if (resetSpentAmounts) {
        const transactions = getMockTransactions();
        const catIds = planCats.map(c => c.id);
        const filteredTxs = transactions.filter(t => !catIds.includes(t.categoryId));
        saveMockTransactions(filteredTxs);
      }

      recordIncomeQuery({
        userId: plan.userId,
        amount: newIncomeAmount,
        payPeriod: plan.payPeriod,
        receivedDate: new Date().toISOString().split('T')[0]
      }).catch(console.error);
    }
    return true;
  }
}

// Update, Add, or Delete envelopes (categories) setup configuration template
export async function updateBudgetCategoriesQuery(
  planId: string,
  incomeAmount: number,
  payPeriod: string,
  categoriesInput: { id?: string; name: string; percentage: number }[]
): Promise<boolean> {
  if (isMockMode()) {
    const plans = getMockPlans();
    const planIndex = plans.findIndex(p => p.id === planId);
    if (planIndex !== -1) {
      plans[planIndex].payPeriod = payPeriod;
      saveMockPlans(plans);
    }

    const categories = getMockCategories();
    const planCats = categories.filter(c => c.planId === planId);
    
    const updatedCats = categoriesInput.map(input => {
      const existing = planCats.find(c => c.id === input.id);
      if (existing) {
        return {
          ...existing,
          name: input.name,
          percentage: input.percentage,
          allocatedAmount: (incomeAmount * input.percentage) / 100
        };
      } else {
        return {
          id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15),
          planId,
          name: input.name,
          percentage: input.percentage,
          allocatedAmount: (incomeAmount * input.percentage) / 100,
          spentAmount: 0,
          transactions: []
        };
      }
    });

    const deletedCatIds = planCats
      .filter(pc => !categoriesInput.some(input => input.id === pc.id))
      .map(pc => pc.id);
    
    if (deletedCatIds.length > 0) {
      const transactions = getMockTransactions();
      const remainingTxs = transactions.filter(t => !deletedCatIds.includes(t.categoryId));
      saveMockTransactions(remainingTxs);
    }

    const remainingCats = categories.filter(c => c.planId !== planId);
    saveMockCategories([...remainingCats, ...updatedCats]);
    return true;
  }

  try {
    const { error: planError } = await supabase
      .from('budget_plans')
      .update({ pay_period: payPeriod })
      .eq('id', planId);

    if (planError) throw planError;

    const { data: currentCats, error: catFetchError } = await supabase
      .from('budget_categories')
      .select('id')
      .eq('plan_id', planId);

    if (catFetchError) throw catFetchError;

    const currentCatIds = (currentCats || []).map(c => c.id);
    const inputCatIds = categoriesInput.filter(c => c.id).map(c => c.id as string);

    const toDeleteIds = currentCatIds.filter(id => !inputCatIds.includes(id));
    if (toDeleteIds.length > 0) {
      await supabase.from('budget_categories').delete().in('id', toDeleteIds);
    }

    for (const input of categoriesInput) {
      const allocated = (incomeAmount * input.percentage) / 100;
      if (input.id) {
        const { error: updateError } = await supabase
          .from('budget_categories')
          .update({
            name: input.name,
            percentage: input.percentage,
            allocated_amount: allocated
          })
          .eq('id', input.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('budget_categories')
          .insert({
            plan_id: planId,
            name: input.name,
            percentage: input.percentage,
            allocated_amount: allocated,
            spent_amount: 0
          });

        if (insertError) throw insertError;
      }
    }
    return true;
  } catch (error) {
    console.warn('Supabase update categories failed. Falling back to LocalStorage.', error);
    const plans = getMockPlans();
    const planIndex = plans.findIndex(p => p.id === planId);
    if (planIndex !== -1) {
      plans[planIndex].payPeriod = payPeriod;
      saveMockPlans(plans);
    }

    const categories = getMockCategories();
    const planCats = categories.filter(c => c.planId === planId);
    const updatedCats = categoriesInput.map(input => {
      const existing = planCats.find(c => c.id === input.id);
      if (existing) {
        return {
          ...existing,
          name: input.name,
          percentage: input.percentage,
          allocatedAmount: (incomeAmount * input.percentage) / 100
        };
      } else {
        return {
          id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15),
          planId,
          name: input.name,
          percentage: input.percentage,
          allocatedAmount: (incomeAmount * input.percentage) / 100,
          spentAmount: 0,
          transactions: []
        };
      }
    });

    const deletedCatIds = planCats
      .filter(pc => !categoriesInput.some(input => input.id === pc.id))
      .map(pc => pc.id);
    
    if (deletedCatIds.length > 0) {
      const transactions = getMockTransactions();
      const remainingTxs = transactions.filter(t => !deletedCatIds.includes(t.categoryId));
      saveMockTransactions(remainingTxs);
    }

    const remainingCats = categories.filter(c => c.planId !== planId);
    saveMockCategories([...remainingCats, ...updatedCats]);
    return true;
  }
}
