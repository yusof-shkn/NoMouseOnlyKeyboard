// src/pages/CashFlow/data/cashFlow.queries.ts
import { supabase } from '@app/core/supabase/Supabase.utils'
import { PostgrestError } from '@supabase/supabase-js'
import {
  CashFlowTransaction,
  CashFlowFilters,
  CashFlowStats,
} from '../types/cashFlow.types'

export interface GetCashFlowResponse {
  data: CashFlowTransaction[] | null
  error: PostgrestError | null
  count: number | null
}

/**
 * Get cash flow statistics
 */
export const getCashFlowStats = async (
  companyId: number,
  storeId?: number | null,
  startDate?: string | null,
  endDate?: string | null,
): Promise<{
  data: CashFlowStats | null
  error: any
}> => {
  try {
    let query = supabase
      .from('cash_flow_transactions')
      .select('transaction_type, activity_type, amount')
      .eq('company_id', companyId)
      .is('deleted_at', null)

    if (storeId) {
      query = query.eq('store_id', storeId)
    }

    if (startDate) {
      query = query.gte('transaction_date', startDate)
    }

    if (endDate) {
      query = query.lte('transaction_date', endDate)
    }

    const { data, error } = await query

    if (error) throw error

    const stats: CashFlowStats = {
      totalInflow: 0,
      totalOutflow: 0,
      netCashFlow: 0,
      operatingCashFlow: 0,
      investingCashFlow: 0,
      financingCashFlow: 0,
      currentBalance: 0,
    }

    data?.forEach((transaction) => {
      const amount = transaction.amount || 0

      if (transaction.transaction_type === 'inflow') {
        stats.totalInflow += amount
      } else {
        stats.totalOutflow += amount
      }

      // Calculate by activity type
      if (transaction.activity_type === 'operating') {
        stats.operatingCashFlow +=
          transaction.transaction_type === 'inflow' ? amount : -amount
      } else if (transaction.activity_type === 'investing') {
        stats.investingCashFlow +=
          transaction.transaction_type === 'inflow' ? amount : -amount
      } else if (transaction.activity_type === 'financing') {
        stats.financingCashFlow +=
          transaction.transaction_type === 'inflow' ? amount : -amount
      }
    })

    stats.netCashFlow = stats.totalInflow - stats.totalOutflow
    stats.currentBalance = stats.netCashFlow

    return { data: stats, error: null }
  } catch (error) {
    console.error('Error fetching cash flow stats:', error)
    return {
      data: {
        totalInflow: 0,
        totalOutflow: 0,
        netCashFlow: 0,
        operatingCashFlow: 0,
        investingCashFlow: 0,
        financingCashFlow: 0,
        currentBalance: 0,
      },
      error,
    }
  }
}

/**
 * Get cash flow transactions with filtering, pagination, and search
 */
export const getCashFlowTransactions = async ({
  page = 1,
  pageSize = 10,
  searchQuery = '',
  startDate = null,
  endDate = null,
  transactionType = 'all',
  activityType = 'all',
  paymentMethod = 'all',
  storeId = null,
  companyId = null,
  accountId = null,
}: CashFlowFilters = {}): Promise<GetCashFlowResponse> => {
  try {
    let query = supabase
      .from('cash_flow_transactions')
      .select('*', { count: 'exact' })
      .is('deleted_at', null)

    // Company filter
    if (companyId) {
      query = query.eq('company_id', companyId)
    }

    // Store filter
    if (storeId) {
      query = query.eq('store_id', storeId)
    }

    // Search filter
    if (searchQuery && searchQuery.trim()) {
      const searchTerm = searchQuery.trim()
      query = query.or(
        `description.ilike.%${searchTerm}%,receipt_number.ilike.%${searchTerm}%,account_number.ilike.%${searchTerm}%,bank_name.ilike.%${searchTerm}%`,
      )
    }

    // Date range filter
    if (startDate) {
      query = query.gte('transaction_date', startDate)
    }
    if (endDate) {
      query = query.lte('transaction_date', endDate)
    }

    // Transaction type filter
    if (transactionType && transactionType !== 'all') {
      query = query.eq('transaction_type', transactionType)
    }

    // Activity type filter
    if (activityType && activityType !== 'all') {
      query = query.eq('activity_type', activityType)
    }

    // Payment method filter
    if (paymentMethod && paymentMethod !== 'all') {
      query = query.eq('payment_method', paymentMethod)
    }

    // Account filter
    if (accountId) {
      query = query.eq('account_id', accountId)
    }

    // Pagination and ordering
    query = query
      .order('transaction_date', { ascending: false })
      .order('created_at', { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1)

    const result = await query

    return result
  } catch (error) {
    console.error('Error in getCashFlowTransactions query:', error)
    return {
      data: null,
      error: error as PostgrestError,
      count: null,
    }
  }
}

/**
 * Get chart of accounts
 */
export const getChartOfAccounts = async (
  companyId: number,
): Promise<{ data: any[] | null; error: PostgrestError | null }> => {
  return await supabase
    .from('chart_of_accounts')
    .select('*')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('account_code', { ascending: true })
}

/**
 * Delete a cash flow transaction (soft delete)
 */
export const deleteCashFlowTransaction = async (
  id: number,
): Promise<{ error: PostgrestError | null }> => {
  return await supabase
    .from('cash_flow_transactions')
    .update({
      deleted_at: new Date().toISOString(),
    })
    .eq('id', id)
}

/**
 * Get transaction details by ID
 */
export const getCashFlowTransactionById = async (
  id: number,
): Promise<{
  data: CashFlowTransaction | null
  error: PostgrestError | null
}> => {
  return await supabase
    .from('cash_flow_transactions')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single()
}

