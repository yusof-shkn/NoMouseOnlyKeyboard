// src/pages/Finance/Expenses/data/expense.queries.ts
import { supabase } from '@app/core/supabase/Supabase.utils'
import { PostgrestError } from '@supabase/supabase-js'
import { Expense } from '../types/expense.types'
import { applyRestrictedFilter } from '@shared/utils/restrictedFilter.utils'

export interface GetExpensesOptions {
  page?: number
  pageSize?: number
  searchQuery?: string
  status?: string
  categoryId?: string | number | null
  companyId?: string | number | null
  storeId?: string | number | null
  startDate?: string | null
  endDate?: string | null
  paymentMethod?: string
  paymentStatus?: string
}

export interface GetExpensesResponse {
  data: Expense[] | null
  error: PostgrestError | null
  count: number | null
}

/**
 * Get expense statistics
 */
export const getExpenseStats = async (
  companyId?: number,
): Promise<{
  data: {
    total: number
    pending: number
    approved: number
    totalAmount: number
    monthlyAmount: number
  } | null
  error: any
}> => {
  try {
    let totalQuery = supabase
      .from('expenses')
      .select('*', { count: 'exact', head: true })
      .is('deleted_at', null)

    let pendingQuery = supabase
      .from('expenses')
      .select('*', { count: 'exact', head: true })
      .is('deleted_at', null)
      .eq('status', 'pending')

    let approvedQuery = supabase
      .from('expenses')
      .select('*', { count: 'exact', head: true })
      .is('deleted_at', null)
      .eq('status', 'approved')

    let totalAmountQuery = supabase
      .from('expenses')
      .select('total_amount')
      .is('deleted_at', null)
      .eq('status', 'posted')

    // Monthly amount - current month
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    let monthlyAmountQuery = supabase
      .from('expenses')
      .select('total_amount')
      .is('deleted_at', null)
      .eq('status', 'posted')
      .gte('expense_date', startOfMonth.toISOString().split('T')[0])

    if (companyId) {
      totalQuery = totalQuery.eq('company_id', companyId)
      pendingQuery = pendingQuery.eq('company_id', companyId)
      approvedQuery = approvedQuery.eq('company_id', companyId)
      totalAmountQuery = totalAmountQuery.eq('company_id', companyId)
      monthlyAmountQuery = monthlyAmountQuery.eq('company_id', companyId)
    }

    const [
      totalResult,
      pendingResult,
      approvedResult,
      totalAmountResult,
      monthlyAmountResult,
    ] = await Promise.all([
      totalQuery,
      pendingQuery,
      approvedQuery,
      totalAmountQuery,
      monthlyAmountQuery,
    ])

    if (totalResult.error || pendingResult.error || approvedResult.error) {
      throw totalResult.error || pendingResult.error || approvedResult.error
    }

    const totalAmount =
      totalAmountResult.data?.reduce(
        (sum, exp: any) => sum + (exp.total_amount || 0),
        0,
      ) || 0
    const monthlyAmount =
      monthlyAmountResult.data?.reduce(
        (sum, exp: any) => sum + (exp.total_amount || 0),
        0,
      ) || 0

    return {
      data: {
        total: totalResult.count || 0,
        pending: pendingResult.count || 0,
        approved: approvedResult.count || 0,
        totalAmount,
        monthlyAmount,
      },
      error: null,
    }
  } catch (error) {
    console.error('Error fetching expense stats:', error)
    return {
      data: {
        total: 0,
        pending: 0,
        approved: 0,
        totalAmount: 0,
        monthlyAmount: 0,
      },
      error,
    }
  }
}

/**
 * Get expenses with filtering, pagination, and search
 */
export const getExpenses = async ({
  page = 1,
  pageSize = 10,
  searchQuery = '',
  status = 'all',
  categoryId = null,
  companyId = null,
  storeId = null,
  startDate = null,
  endDate = null,
  paymentMethod = 'all',
  paymentStatus = 'all',
  isUnlocked = false,
}: GetExpensesOptions & {
  isUnlocked?: boolean
} = {}): Promise<GetExpensesResponse> => {
  try {
    let query = supabase
      .from('expenses')
      .select(
        `
        *,
        expense_categories (
          id,
          category_name,
          category_code
        )
      `,
        { count: 'exact' },
      )
      .is('deleted_at', null)

    // Apply restricted filter
    query = applyRestrictedFilter(query, isUnlocked)

    // Search filter
    if (searchQuery && searchQuery.trim()) {
      const searchTerm = searchQuery.trim()
      query = query.or(
        `expense_number.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%,invoice_number.ilike.%${searchTerm}%`,
      )
    }

    // Status filter
    if (status && status !== 'all') {
      query = query.eq('status', status)
    }

    // Category filter
    if (
      categoryId !== null &&
      categoryId !== undefined &&
      categoryId !== '' &&
      categoryId !== 'all'
    ) {
      const parsedCategoryId =
        typeof categoryId === 'string' ? parseInt(categoryId, 10) : categoryId
      if (!isNaN(parsedCategoryId)) {
        query = query.eq('category_id', parsedCategoryId)
      }
    }

    // Company filter
    if (
      companyId !== null &&
      companyId !== undefined &&
      companyId !== '' &&
      companyId !== 'all'
    ) {
      const parsedCompanyId =
        typeof companyId === 'string' ? parseInt(companyId, 10) : companyId
      if (!isNaN(parsedCompanyId)) {
        query = query.eq('company_id', parsedCompanyId)
      }
    }

    // Store filter
    if (
      storeId !== null &&
      storeId !== undefined &&
      storeId !== '' &&
      storeId !== 'all'
    ) {
      const parsedStoreId =
        typeof storeId === 'string' ? parseInt(storeId, 10) : storeId
      if (!isNaN(parsedStoreId)) {
        query = query.eq('store_id', parsedStoreId)
      }
    }

    // Date range filter
    if (startDate) {
      query = query.gte('expense_date', startDate)
    }
    if (endDate) {
      query = query.lte('expense_date', endDate)
    }

    // Payment method filter
    if (paymentMethod && paymentMethod !== 'all') {
      query = query.eq('payment_method', paymentMethod)
    }

    // Payment status filter
    if (paymentStatus && paymentStatus !== 'all') {
      query = query.eq('payment_status', paymentStatus)
    }

    // Pagination and ordering
    query = query
      .order('expense_date', { ascending: false })
      .order('created_at', { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1)

    const result = await query

    return result
  } catch (error) {
    console.error('Error in getExpenses query:', error)
    return {
      data: null,
      error: error as PostgrestError,
      count: null,
    }
  }
}

/**
 * Get expense categories for dropdown
 */
export const getExpenseCategories = async (
  companyId?: number,
): Promise<{
  data: any[] | null
  error: PostgrestError | null
}> => {
  let query = supabase
    .from('expense_categories')
    .select('*')
    .is('deleted_at', null)
    .eq('is_active', true)
    .order('category_name', { ascending: true })

  if (companyId) {
    query = query.eq('company_id', companyId)
  }

  return await query
}

/**
 * Get single expense by ID
 */
export const getExpenseById = async (
  id: number,
): Promise<{
  data: Expense | null
  error: PostgrestError | null
}> => {
  return await supabase
    .from('expenses')
    .select(
      `
      *,
      expense_categories (
        id,
        category_name,
        category_code
      )
    `,
    )
    .eq('id', id)
    .is('deleted_at', null)
    .single()
}

// Helper function to parse ID to number or null
const parseId = (value: any): number | null => {
  if (value == null || value === '') return null
  const parsed = typeof value === 'string' ? parseInt(value, 10) : value
  return isNaN(parsed) ? null : parsed
}

/**
 * Create expense
 */
export const createExpense = async (
  expenseData: Partial<Expense>,
): Promise<{ data: { id: number } | null; error: PostgrestError | null }> => {
  const {
    expense_categories,
    chart_of_accounts,
    stores,
    suppliers,
    submitted_by_profile,
    approved_by_profile,
    ...dbExpenseData
  } = expenseData as any

  // Parse IDs
  const parsedData = {
    ...dbExpenseData,
    company_id: parseId(dbExpenseData.company_id),
    store_id: parseId(dbExpenseData.store_id),
    category_id: parseId(dbExpenseData.category_id),
    account_id: parseId(dbExpenseData.account_id),
    supplier_id: parseId(dbExpenseData.supplier_id),
    submitted_by: parseId(dbExpenseData.submitted_by),
    approved_by: parseId(dbExpenseData.approved_by),
  }

  return await supabase
    .from('expenses')
    .insert([parsedData])
    .select('id')
    .single()
}

/**
 * Update expense
 * Note: System-generated expenses (is_system = true) cannot be updated due to database triggers
 */
export const updateExpense = async (
  id: number,
  updates: Partial<Expense>,
): Promise<{ error: PostgrestError | null }> => {
  const {
    expense_categories,
    chart_of_accounts,
    stores,
    suppliers,
    submitted_by_profile,
    approved_by_profile,
    ...dbUpdates
  } = updates as any

  // Parse IDs only if present in updates
  const parsedUpdates: any = { updated_at: new Date().toISOString() }
  Object.entries(dbUpdates).forEach(([key, value]) => {
    if (
      [
        'company_id',
        'store_id',
        'category_id',
        'account_id',
        'supplier_id',
        'submitted_by',
        'approved_by',
      ].includes(key)
    ) {
      parsedUpdates[key] = parseId(value)
    } else {
      parsedUpdates[key] = value
    }
  })

  return await supabase.from('expenses').update(parsedUpdates).eq('id', id)
}

/**
 * Soft delete an expense
 * Note: System-generated expenses (is_system = true) cannot be deleted due to database triggers
 */
export const deleteExpense = async (
  id: number,
): Promise<{ error: PostgrestError | null }> => {
  return await supabase
    .from('expenses')
    .update({
      deleted_at: new Date().toISOString(),
      status: 'cancelled',
    })
    .eq('id', id)
}

/**
 * Approve expense
 */
export const approveExpense = async (
  id: number,
  approvedBy: number,
): Promise<{ error: PostgrestError | null }> => {
  return await supabase
    .from('expenses')
    .update({
      status: 'approved',
      approved_by: approvedBy,
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
}

/**
 * Post expense to general ledger
 * Note: This will trigger the fn_create_purchase_journal_entry() function if this expense
 * is linked to a purchase order
 */
export const postExpense = async (
  id: number,
): Promise<{ error: PostgrestError | null }> => {
  return await supabase
    .from('expenses')
    .update({
      status: 'posted',
      is_posted: true,
      posted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
}

