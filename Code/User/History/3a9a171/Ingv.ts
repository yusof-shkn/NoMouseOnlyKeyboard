// src/pages/Income/data/income.queries.ts

import { supabase } from '@app/core/supabase/Supabase.utils'
import { PostgrestError } from '@supabase/supabase-js'
import { Income, IncomeCategory, IncomeFilters } from '../types/income.types'
import { applyRestrictedFilter } from '@shared/utils/restrictedFilter.utils'

export interface GetIncomeOptions extends IncomeFilters {}

export interface GetIncomeResponse {
  data: Income[] | null
  error: PostgrestError | null
  count: number | null
}

/**
 * Calculate tax and total based on tax rate
 */
export const calculateIncomeAmounts = (
  amount: number,
  discountPercentage: number = 0,
  taxRate: number = 18,
): {
  discountAmount: number
  amountAfterDiscount: number
  taxAmount: number
  totalAmount: number
} => {
  const discountAmount = (amount * discountPercentage) / 100
  const amountAfterDiscount = amount - discountAmount
  const taxAmount = (amountAfterDiscount * taxRate) / 100
  const totalAmount = amountAfterDiscount + taxAmount

  return {
    discountAmount,
    amountAfterDiscount,
    taxAmount,
    totalAmount,
  }
}

/**
 * Get income statistics
 */
export const getIncomeStats = async (
  companyId?: number,
): Promise<{
  data: {
    total: number
    pending: number
    approved: number
    posted: number
    totalAmount: number
    currentMonthAmount: number
    systemGenerated: number
    manualEntries: number
  } | null
  error: any
}> => {
  try {
    const buildQuery = (extraFilters?: (q: any) => any) => {
      let q = supabase
        .from('income')
        .select('*', { count: 'exact', head: true })
        .is('deleted_at', null)
      if (companyId) q = q.eq('company_id', companyId)
      if (extraFilters) q = extraFilters(q)
      return q
    }

    const [
      { count: totalCount },
      { count: pendingCount },
      { count: approvedCount },
      { count: postedCount },
      { count: systemCount },
      { count: manualCount },
    ] = await Promise.all([
      buildQuery(),
      buildQuery((q) => q.eq('status', 'pending')),
      buildQuery((q) => q.eq('status', 'approved')),
      buildQuery((q) => q.eq('is_posted', true)),
      buildQuery((q) => q.eq('is_system', true)),
      buildQuery((q) => q.eq('is_system', false)),
    ])

    // Total amount (approved + posted)
    let totalAmountQuery = supabase
      .from('income')
      .select('total_amount')
      .is('deleted_at', null)
      .in('status', ['approved', 'posted'])
    if (companyId)
      totalAmountQuery = totalAmountQuery.eq('company_id', companyId)
    const { data: totalAmountData } = await totalAmountQuery

    // Current month amount
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    let currentMonthQuery = supabase
      .from('income')
      .select('total_amount')
      .is('deleted_at', null)
      .in('status', ['approved', 'posted'])
      .gte('income_date', startOfMonth.toISOString().split('T')[0])
    if (companyId)
      currentMonthQuery = currentMonthQuery.eq('company_id', companyId)
    const { data: currentMonthData } = await currentMonthQuery

    const totalAmount =
      totalAmountData?.reduce(
        (sum, item) => sum + (item.total_amount || 0),
        0,
      ) || 0
    const currentMonthAmount =
      currentMonthData?.reduce(
        (sum, item) => sum + (item.total_amount || 0),
        0,
      ) || 0

    return {
      data: {
        total: totalCount || 0,
        pending: pendingCount || 0,
        approved: approvedCount || 0,
        posted: postedCount || 0,
        totalAmount,
        currentMonthAmount,
        systemGenerated: systemCount || 0,
        manualEntries: manualCount || 0,
      },
      error: null,
    }
  } catch (error) {
    console.error('Error fetching income stats:', error)
    return {
      data: {
        total: 0,
        pending: 0,
        approved: 0,
        posted: 0,
        totalAmount: 0,
        currentMonthAmount: 0,
        systemGenerated: 0,
        manualEntries: 0,
      },
      error,
    }
  }
}

/**
 * Get income with filtering, pagination, and search
 * Uses vw_income_with_details for joined category, store, customer names
 */
export const getIncome = async ({
  page = 1,
  pageSize = 10,
  searchQuery = '',
  status = 'all',
  categoryId = null,
  startDate = null,
  endDate = null,
  storeId = null,
  companyId = null,
  isSystem = null,
  referenceType = null,
  isUnlocked = false,
}: GetIncomeOptions & {
  isUnlocked?: boolean
} = {}): Promise<GetIncomeResponse> => {
  try {
    // ✅ Use the view instead of raw income table
    let query = supabase
      .from('vw_income_with_details')
      .select('*', { count: 'exact' })
      .is('deleted_at', null)

    // Apply restricted filter
    query = applyRestrictedFilter(query, isUnlocked)

    if (searchQuery && searchQuery.trim()) {
      const searchTerm = searchQuery.trim()
      query = query.or(
        `income_number.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%,invoice_number.ilike.%${searchTerm}%`,
      )
    }

    if (status !== 'all') {
      query = query.eq('status', status)
    }

    if (categoryId !== null && categoryId !== undefined) {
      query = query.eq('category_id', categoryId)
    }

    if (startDate) {
      query = query.gte('income_date', startDate)
    }
    if (endDate) {
      query = query.lte('income_date', endDate)
    }

    if (storeId !== null && storeId !== undefined) {
      query = query.eq('store_id', storeId)
    }

    if (companyId !== null && companyId !== undefined) {
      query = query.eq('company_id', companyId)
    }

    if (isSystem !== null && isSystem !== undefined) {
      query = query.eq('is_system', isSystem)
    }

    if (referenceType !== null && referenceType !== undefined) {
      query = query.eq('reference_type', referenceType)
    }

    query = query
      .order('income_date', { ascending: false })
      .order('created_at', { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1)

    const result = await query

    return result
  } catch (error) {
    console.error('Error in getIncome query:', error)
    return {
      data: null,
      error: error as PostgrestError,
      count: null,
    }
  }
}

/**
 * Get all income categories
 */
export const getIncomeCategories = async (
  companyId?: number,
): Promise<{
  data: IncomeCategory[] | null
  error: PostgrestError | null
}> => {
  let query = supabase
    .from('income_categories')
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
 * Create income (manual entries only)
 */
export const createIncome = async (
  incomeData: Partial<Income>,
  taxRate: number = 18,
): Promise<{ data: { id: number } | null; error: PostgrestError | null }> => {
  const {
    category_name,
    customer_name,
    resolved_customer_name,
    store_name,
    submitted_by_name,
    approved_by_name,
    ...dbIncomeData
  } = incomeData as any

  const amounts = calculateIncomeAmounts(
    dbIncomeData.amount || 0,
    dbIncomeData.discount_percentage || 0,
    taxRate,
  )

  const finalData = {
    ...dbIncomeData,
    discount_amount: amounts.discountAmount,
    tax_rate: taxRate,
    tax_amount: amounts.taxAmount,
    total_amount: amounts.totalAmount,
    is_system: false,
    reference_type: 'manual',
    status: dbIncomeData.status || 'draft',
  }

  return await supabase.from('income').insert([finalData]).select('id').single()
}

/**
 * Update income
 * ⚠️ System-generated income (is_system=true) CANNOT be edited — DB trigger will block it
 */
export const updateIncome = async (
  id: number,
  updates: Partial<Income>,
  taxRate: number = 18,
): Promise<{ error: PostgrestError | null }> => {
  const {
    category_name,
    customer_name,
    resolved_customer_name,
    store_name,
    submitted_by_name,
    approved_by_name,
    ...dbUpdates
  } = updates as any

  const parsedUpdates: any = { updated_at: new Date().toISOString() }

  if (dbUpdates.amount || dbUpdates.discount_percentage) {
    const currentIncome = await supabase
      .from('income')
      .select('amount, discount_percentage')
      .eq('id', id)
      .single()

    if (currentIncome.data) {
      const amount = dbUpdates.amount ?? currentIncome.data.amount
      const discountPercentage =
        dbUpdates.discount_percentage ??
        currentIncome.data.discount_percentage ??
        0

      const amounts = calculateIncomeAmounts(
        amount,
        discountPercentage,
        taxRate,
      )
      parsedUpdates.discount_amount = amounts.discountAmount
      parsedUpdates.tax_rate = taxRate
      parsedUpdates.tax_amount = amounts.taxAmount
      parsedUpdates.total_amount = amounts.totalAmount
    }
  }

  Object.entries(dbUpdates).forEach(([key, value]) => {
    parsedUpdates[key] = value
  })

  return await supabase.from('income').update(parsedUpdates).eq('id', id)
}

/**
 * Soft delete income
 * ⚠️ System-generated income CANNOT be deleted — DB trigger will block it
 */
export const deleteIncome = async (
  id: number,
): Promise<{ error: PostgrestError | null }> => {
  return await supabase
    .from('income')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
}

/**
 * Approve income
 */
export const approveIncome = async (
  id: number,
  approvedBy: number,
): Promise<{ error: PostgrestError | null }> => {
  return await supabase
    .from('income')
    .update({
      status: 'approved',
      approved_by: approvedBy,
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
}

/**
 * Post income to journal
 * For system-generated income, this posts the sale which triggers journal creation
 */
export const postIncome = async (
  id: number,
): Promise<{ error: PostgrestError | null }> => {
  return await supabase
    .from('income')
    .update({
      status: 'posted',
      is_posted: true,
      posted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
}

