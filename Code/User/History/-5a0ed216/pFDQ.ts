// Dashboard.queries.financial.ts - Financial Data Queries (RLS-Compatible)
// FULLY CORRECTED VERSION - Fixed budget_year column name

import { supabase } from '@app/core/supabase/Supabase.utils'
import type {
  DataScope,
  FinancialData,
  CategoryBreakdown,
  ExpenseItem,
  AccountBalance,
  BudgetCategoryComparison,
  CashFlowChartData,
  ChartDataPoint,
} from '../types/dashboard.types'
import {
  getToday,
  getMonthStart,
  getLastMonthStart,
  getLastMonthEnd,
  getLast7Days,
  getDayName,
  parseNumeric,
  calculatePercentage,
} from '../utils/dashboard.utils'

/**
 * CRITICAL FIX:
 * - budgets table uses `budget_year` (NOT fiscal_year)
 * - sale_items uses `total_price` (NOT line_total)
 * - sale_items has `cost_price` directly
 */

/**
 * Build store filter for queries
 */
const buildStoreFilter = (query: any, scope: DataScope) => {
  if (scope.storeId) {
    return query.eq('store_id', scope.storeId)
  }
  if (scope.storeIds && scope.storeIds.length > 0) {
    return query.in('store_id', scope.storeIds)
  }
  return query
}

/**
 * Fetch complete financial data
 */
export const fetchFinancialData = async (
  scope: DataScope,
): Promise<FinancialData> => {
  const today = getToday()
  const monthStart = getMonthStart()
  const lastMonthStart = getLastMonthStart()
  const lastMonthEnd = getLastMonthEnd()
  const last7Days = getLast7Days()
  const currentYear = new Date().getFullYear()

  // Fetch all financial data in parallel
  const [
    revenueData,
    expensesData,
    profitData,
    cashFlowData,
    accountsData,
    budgetData,
  ] = await Promise.all([
    fetchRevenueData(
      scope,
      today,
      monthStart,
      lastMonthStart,
      lastMonthEnd,
      last7Days,
    ),
    fetchExpensesData(
      scope,
      today,
      monthStart,
      lastMonthStart,
      lastMonthEnd,
      last7Days,
    ),
    fetchProfitData(scope, monthStart, lastMonthStart, lastMonthEnd),
    fetchCashFlowData(scope, monthStart),
    fetchAccountsData(scope),
    fetchBudgetData(scope, currentYear, monthStart),
  ])

  return {
    revenue: revenueData,
    expenses: expensesData,
    profit: profitData,
    cashFlow: cashFlowData,
    accounts: accountsData,
    budgetComparison: budgetData,
  }
}

/**
 * Fetch Revenue Data
 */
const fetchRevenueData = async (
  scope: DataScope,
  today: string,
  monthStart: string,
  lastMonthStart: string,
  lastMonthEnd: string,
  last7Days: string[],
) => {
  // Today's revenue
  let todayQuery = supabase
    .from('sales')
    .select('total_amount')
    .gte('sale_date', today)
    .eq('sale_status', 'completed')

  todayQuery = buildStoreFilter(todayQuery, scope)
  const { data: todaySales } = await todayQuery

  const todayRevenue =
    todaySales?.reduce((sum, s) => sum + parseNumeric(s.total_amount), 0) || 0

  // This month's revenue
  let thisMonthQuery = supabase
    .from('sales')
    .select('total_amount')
    .gte('sale_date', monthStart)
    .eq('sale_status', 'completed')

  thisMonthQuery = buildStoreFilter(thisMonthQuery, scope)
  const { data: thisMonthSales } = await thisMonthQuery

  const thisMonthRevenue =
    thisMonthSales?.reduce((sum, s) => sum + parseNumeric(s.total_amount), 0) ||
    0

  // Last month's revenue
  let lastMonthQuery = supabase
    .from('sales')
    .select('total_amount')
    .gte('sale_date', lastMonthStart)
    .lte('sale_date', lastMonthEnd)
    .eq('sale_status', 'completed')

  lastMonthQuery = buildStoreFilter(lastMonthQuery, scope)
  const { data: lastMonthSales } = await lastMonthQuery

  const lastMonthRevenue =
    lastMonthSales?.reduce((sum, s) => sum + parseNumeric(s.total_amount), 0) ||
    0

  // Calculate trend
  const trend =
    lastMonthRevenue > 0
      ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
      : 0

  // Revenue by category (this month)
  const { data: saleItems } = await supabase
    .from('sale_items')
    .select('total_price, products(categories(category_name))')
    .gte('created_at', monthStart)
    .lte('created_at', today)

  const categoryMap: { [key: string]: number } = {}
  saleItems?.forEach((item: any) => {
    const category = item.products?.categories?.category_name || 'Uncategorized'
    const amount = parseNumeric(item.total_price)
    categoryMap[category] = (categoryMap[category] || 0) + amount
  })

  const totalCategoryRevenue = Object.values(categoryMap).reduce(
    (sum, val) => sum + val,
    0,
  )

  const byCategory: CategoryBreakdown[] = Object.entries(categoryMap)
    .map(([category, amount]) => ({
      category,
      amount,
      percentage:
        totalCategoryRevenue > 0 ? (amount / totalCategoryRevenue) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount)

  // Chart data for last 7 days
  const chartData: ChartDataPoint[] = await Promise.all(
    last7Days.map(async (date) => {
      let dayQuery = supabase
        .from('sales')
        .select('total_amount')
        .gte('sale_date', date)
        .lt('sale_date', getNextDay(date))
        .eq('sale_status', 'completed')

      dayQuery = buildStoreFilter(dayQuery, scope)
      const { data } = await dayQuery

      const sales =
        data?.reduce((sum, s) => sum + parseNumeric(s.total_amount), 0) || 0

      return {
        date: getDayName(date),
        sales,
      }
    }),
  )

  return {
    total: thisMonthRevenue,
    today: todayRevenue,
    thisMonth: thisMonthRevenue,
    lastMonth: lastMonthRevenue,
    trend: Math.round(trend),
    byCategory,
    chartData,
  }
}

/**
 * Fetch Expenses Data
 */
const fetchExpensesData = async (
  scope: DataScope,
  today: string,
  monthStart: string,
  lastMonthStart: string,
  lastMonthEnd: string,
  last7Days: string[],
) => {
  // Today's expenses
  let todayQuery = supabase
    .from('expenses')
    .select('total_amount')
    .gte('expense_date', today)

  todayQuery = buildStoreFilter(todayQuery, scope)
  const { data: todayExpenses } = await todayQuery

  const todayTotal =
    todayExpenses?.reduce((sum, e) => sum + parseNumeric(e.total_amount), 0) ||
    0

  // This month's expenses
  let thisMonthQuery = supabase
    .from('expenses')
    .select('total_amount')
    .gte('expense_date', monthStart)

  thisMonthQuery = buildStoreFilter(thisMonthQuery, scope)
  const { data: thisMonthExpenses } = await thisMonthQuery

  const thisMonthTotal =
    thisMonthExpenses?.reduce(
      (sum, e) => sum + parseNumeric(e.total_amount),
      0,
    ) || 0

  // Last month's expenses
  let lastMonthQuery = supabase
    .from('expenses')
    .select('total_amount')
    .gte('expense_date', lastMonthStart)
    .lte('expense_date', lastMonthEnd)

  lastMonthQuery = buildStoreFilter(lastMonthQuery, scope)
  const { data: lastMonthExpenses } = await lastMonthQuery

  const lastMonthTotal =
    lastMonthExpenses?.reduce(
      (sum, e) => sum + parseNumeric(e.total_amount),
      0,
    ) || 0

  // Calculate trend
  const trend =
    lastMonthTotal > 0
      ? ((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100
      : 0

  // Expenses by category (this month)
  let categoryQuery = supabase
    .from('expenses')
    .select('total_amount, expense_categories(category_name)')
    .gte('expense_date', monthStart)

  categoryQuery = buildStoreFilter(categoryQuery, scope)
  const { data: expensesByCategory } = await categoryQuery

  const categoryMap: { [key: string]: number } = {}
  expensesByCategory?.forEach((expense: any) => {
    const category =
      expense.expense_categories?.category_name || 'Uncategorized'
    const amount = parseNumeric(expense.total_amount)
    categoryMap[category] = (categoryMap[category] || 0) + amount
  })

  const totalCategoryExpenses = Object.values(categoryMap).reduce(
    (sum, val) => sum + val,
    0,
  )

  const byCategory: CategoryBreakdown[] = Object.entries(categoryMap)
    .map(([category, amount]) => ({
      category,
      amount,
      percentage:
        totalCategoryExpenses > 0 ? (amount / totalCategoryExpenses) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount)

  // Top expenses (last 10)
  let topQuery = supabase
    .from('expenses')
    .select(
      'id, expense_date, amount, description, expense_categories(category_name)',
    )
    .gte('expense_date', monthStart)
    .order('amount', { ascending: false })
    .limit(10)

  topQuery = buildStoreFilter(topQuery, scope)
  const { data: topExpensesData } = await topQuery

  const topExpenses: ExpenseItem[] =
    topExpensesData?.map((expense: any) => ({
      id: expense.id,
      expense_date: expense.expense_date,
      category_name:
        expense.expense_categories?.category_name || 'Uncategorized',
      amount: parseNumeric(expense.amount),
      description: expense.description || '',
    })) || []

  // Chart data for last 7 days
  const chartData: ChartDataPoint[] = await Promise.all(
    last7Days.map(async (date) => {
      let dayQuery = supabase
        .from('expenses')
        .select('total_amount')
        .gte('expense_date', date)
        .lt('expense_date', getNextDay(date))

      dayQuery = buildStoreFilter(dayQuery, scope)
      const { data } = await dayQuery

      const expenses =
        data?.reduce((sum, e) => sum + parseNumeric(e.total_amount), 0) || 0

      return {
        date: getDayName(date),
        sales: 0,
        expenses,
      }
    }),
  )

  return {
    total: thisMonthTotal,
    today: todayTotal,
    thisMonth: thisMonthTotal,
    lastMonth: lastMonthTotal,
    trend: Math.round(trend),
    byCategory,
    chartData,
    topExpenses,
  }
}

/**
 * Fetch Profit Data
 */
const fetchProfitData = async (
  scope: DataScope,
  monthStart: string,
  lastMonthStart: string,
  lastMonthEnd: string,
) => {
  // This month's sales and COGS
  let thisMonthSalesQuery = supabase
    .from('sales')
    .select('total_amount')
    .gte('sale_date', monthStart)
    .eq('sale_status', 'completed')

  thisMonthSalesQuery = buildStoreFilter(thisMonthSalesQuery, scope)
  const { data: thisMonthSales } = await thisMonthSalesQuery

  const thisMonthRevenue =
    thisMonthSales?.reduce((sum, s) => sum + parseNumeric(s.total_amount), 0) ||
    0

  // This month's expenses
  let thisMonthExpensesQuery = supabase
    .from('expenses')
    .select('total_amount')
    .gte('expense_date', monthStart)

  thisMonthExpensesQuery = buildStoreFilter(thisMonthExpensesQuery, scope)
  const { data: thisMonthExpenses } = await thisMonthExpensesQuery

  const thisMonthExpensesTotal =
    thisMonthExpenses?.reduce(
      (sum, e) => sum + parseNumeric(e.total_amount),
      0,
    ) || 0

  // Calculate COGS (Cost of Goods Sold) from sale_items
  const { data: thisMonthSaleItems } = await supabase
    .from('sale_items')
    .select('quantity, cost_price')
    .gte('created_at', monthStart)

  const thisMonthCOGS =
    thisMonthSaleItems?.reduce((sum, item: any) => {
      const costPrice = parseNumeric(item.cost_price || 0)
      return sum + item.quantity * costPrice
    }, 0) || 0

  // Last month's data
  let lastMonthSalesQuery = supabase
    .from('sales')
    .select('total_amount')
    .gte('sale_date', lastMonthStart)
    .lte('sale_date', lastMonthEnd)
    .eq('sale_status', 'completed')

  lastMonthSalesQuery = buildStoreFilter(lastMonthSalesQuery, scope)
  const { data: lastMonthSales } = await lastMonthSalesQuery

  const lastMonthRevenue =
    lastMonthSales?.reduce((sum, s) => sum + parseNumeric(s.total_amount), 0) ||
    0

  let lastMonthExpensesQuery = supabase
    .from('expenses')
    .select('total_amount')
    .gte('expense_date', lastMonthStart)
    .lte('expense_date', lastMonthEnd)

  lastMonthExpensesQuery = buildStoreFilter(lastMonthExpensesQuery, scope)
  const { data: lastMonthExpenses } = await lastMonthExpensesQuery

  const lastMonthExpensesTotal =
    lastMonthExpenses?.reduce(
      (sum, e) => sum + parseNumeric(e.total_amount),
      0,
    ) || 0

  const { data: lastMonthSaleItems } = await supabase
    .from('sale_items')
    .select('quantity, cost_price')
    .gte('created_at', lastMonthStart)
    .lte('created_at', lastMonthEnd)

  const lastMonthCOGS =
    lastMonthSaleItems?.reduce((sum, item: any) => {
      const costPrice = parseNumeric(item.cost_price || 0)
      return sum + item.quantity * costPrice
    }, 0) || 0

  // Calculate profits
  const grossProfit = thisMonthRevenue - thisMonthCOGS
  const netProfit = grossProfit - thisMonthExpensesTotal
  const margin = thisMonthRevenue > 0 ? (netProfit / thisMonthRevenue) * 100 : 0

  const lastMonthGrossProfit = lastMonthRevenue - lastMonthCOGS
  const lastMonthNetProfit = lastMonthGrossProfit - lastMonthExpensesTotal

  const trend =
    lastMonthNetProfit > 0
      ? ((netProfit - lastMonthNetProfit) / Math.abs(lastMonthNetProfit)) * 100
      : 0

  return {
    gross: grossProfit,
    net: netProfit,
    margin: margin,
    thisMonth: netProfit,
    lastMonth: lastMonthNetProfit,
    trend: Math.round(trend),
  }
}

/**
 * Fetch Cash Flow Data
 */
const fetchCashFlowData = async (scope: DataScope, monthStart: string) => {
  const { data: cashFlowData } = await supabase
    .from('cash_flow_transactions')
    .select('activity_type, amount')
    .gte('transaction_date', monthStart)

  const operating =
    cashFlowData
      ?.filter((cf) => cf.activity_type === 'operating')
      .reduce((sum, cf) => sum + parseNumeric(cf.amount), 0) || 0

  const investing =
    cashFlowData
      ?.filter((cf) => cf.activity_type === 'investing')
      .reduce((sum, cf) => sum + parseNumeric(cf.amount), 0) || 0

  const financing =
    cashFlowData
      ?.filter((cf) => cf.activity_type === 'financing')
      .reduce((sum, cf) => sum + parseNumeric(cf.amount), 0) || 0

  const total = operating + investing + financing

  return {
    operating,
    investing,
    financing,
    total,
    trend: 0,
    chartData: [],
  }
}

/**
 * Fetch Accounts Data
 */
const fetchAccountsData = async (scope: DataScope) => {
  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1

  // Get latest account balances
  const { data: balances } = await supabase
    .from('account_balances')
    .select(
      'closing_balance, chart_of_accounts(account_code, account_name, account_type)',
    )
    .eq('fiscal_year', currentYear)
    .eq('fiscal_period', currentMonth)

  const accountBalances: AccountBalance[] =
    balances?.map((balance: any) => ({
      account_code: balance.chart_of_accounts?.account_code || '',
      account_name: balance.chart_of_accounts?.account_name || '',
      account_type: balance.chart_of_accounts?.account_type || '',
      balance: parseNumeric(balance.closing_balance),
    })) || []

  // Calculate totals
  const totalAssets = accountBalances
    .filter((acc) => acc.account_type === 'asset')
    .reduce((sum, acc) => sum + acc.balance, 0)

  const totalLiabilities = accountBalances
    .filter((acc) => acc.account_type === 'liability')
    .reduce((sum, acc) => sum + acc.balance, 0)

  const totalEquity = accountBalances
    .filter((acc) => acc.account_type === 'equity')
    .reduce((sum, acc) => sum + acc.balance, 0)

  // Calculate ratios
  const currentAssets = accountBalances
    .filter((acc) => acc.account_code.startsWith('1'))
    .reduce((sum, acc) => sum + acc.balance, 0)

  const currentLiabilities = accountBalances
    .filter((acc) => acc.account_code.startsWith('2'))
    .reduce((sum, acc) => sum + acc.balance, 0)

  const currentRatio =
    currentLiabilities > 0 ? currentAssets / currentLiabilities : 0

  const quickRatio = currentRatio

  const debtToEquity = totalEquity > 0 ? totalLiabilities / totalEquity : 0

  return {
    totalAssets,
    totalLiabilities,
    totalEquity,
    currentRatio,
    quickRatio,
    debtToEquity,
    accountBalances,
  }
}

/**
 * Fetch Budget Comparison Data
 * FIXED: Uses budget_year (NOT fiscal_year)
 */
const fetchBudgetData = async (
  scope: DataScope,
  currentYear: number,
  monthStart: string,
) => {
  const currentMonth = new Date(monthStart).getMonth() + 1
  const monthNames = [
    'january',
    'february',
    'march',
    'april',
    'may',
    'june',
    'july',
    'august',
    'september',
    'october',
    'november',
    'december',
  ]
  const currentMonthName = monthNames[currentMonth - 1]

  // Step 1: Get approved budget for current year
  // FIXED: Using budget_year instead of fiscal_year
  const { data: budget, error: budgetError } = await supabase
    .from('budgets')
    .select('id')
    .eq('budget_year', currentYear) // ✅ FIXED: was fiscal_year
    .eq('status', 'approved')
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle()

  if (budgetError) {
    console.error('Error fetching budget:', budgetError)
    return getEmptyBudgetData()
  }

  if (!budget) {
    console.log('No approved budget found for year:', currentYear)
    return getEmptyBudgetData()
  }

  // Step 2: Get budget lines for this budget
  const { data: budgetLines, error: budgetLinesError } = await supabase
    .from('budget_lines')
    .select(
      'account_id, annual_budget, january, february, march, april, may, june, july, august, september, october, november, december',
    )
    .eq('budget_id', budget.id)

  if (budgetLinesError) {
    console.error('Error fetching budget lines:', budgetLinesError)
    return getEmptyBudgetData()
  }

  if (!budgetLines || budgetLines.length === 0) {
    console.log('No budget lines found for budget:', budget.id)
    return getEmptyBudgetData()
  }

  // Step 3: Get unique account IDs
  const accountIds = budgetLines
    .map((line: any) => line.account_id)
    .filter(Boolean)

  if (accountIds.length === 0) {
    return getEmptyBudgetData()
  }

  // Step 4: Fetch chart of accounts
  const { data: accounts, error: accountsError } = await supabase
    .from('chart_of_accounts')
    .select('id, account_name, account_type')
    .in('id', accountIds)

  if (accountsError) {
    console.error('Error fetching chart of accounts:', accountsError)
  }

  // Create account lookup map
  const accountMap = new Map(accounts?.map((acc) => [acc.id, acc]) || [])

  // Calculate budgeted amounts for current month
  let budgetedRevenue = 0
  let budgetedExpenses = 0

  budgetLines.forEach((line: any) => {
    const account = accountMap.get(line.account_id)
    if (!account) return

    // Get budgeted amount for current month
    const monthBudget = parseNumeric(line[currentMonthName] || 0)

    if (account.account_type === 'revenue') {
      budgetedRevenue += monthBudget
    } else if (account.account_type === 'expense') {
      budgetedExpenses += monthBudget
    }
  })

  // Get actual revenue (from sales)
  let revenueQuery = supabase
    .from('sales')
    .select('total_amount')
    .gte('sale_date', monthStart)
    .eq('sale_status', 'completed')

  revenueQuery = buildStoreFilter(revenueQuery, scope)
  const { data: sales } = await revenueQuery

  const actualRevenue =
    sales?.reduce((sum, s) => sum + parseNumeric(s.total_amount), 0) || 0

  // Get actual expenses
  let expensesQuery = supabase
    .from('expenses')
    .select('total_amount')
    .gte('expense_date', monthStart)

  expensesQuery = buildStoreFilter(expensesQuery, scope)
  const { data: expenses } = await expensesQuery

  const actualExpenses =
    expenses?.reduce((sum, e) => sum + parseNumeric(e.total_amount), 0) || 0

  // Calculate variances
  const revenueVariance = actualRevenue - budgetedRevenue
  const expenseVariance = actualExpenses - budgetedExpenses

  const totalBudget = budgetedRevenue + budgetedExpenses
  const totalVariance = revenueVariance - expenseVariance
  const variancePercentage =
    totalBudget > 0 ? (totalVariance / totalBudget) * 100 : 0

  return {
    budgetedRevenue,
    actualRevenue,
    budgetedExpenses,
    actualExpenses,
    revenueVariance,
    expenseVariance,
    variancePercentage,
    byCategory: [],
  }
}

/**
 * Helper: Return empty budget data
 */
const getEmptyBudgetData = () => ({
  budgetedRevenue: 0,
  actualRevenue: 0,
  budgetedExpenses: 0,
  actualExpenses: 0,
  revenueVariance: 0,
  expenseVariance: 0,
  variancePercentage: 0,
  byCategory: [],
})

/**
 * Helper Functions
 */
const getNextDay = (date: string): string => {
  const d = new Date(date)
  d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]
}

