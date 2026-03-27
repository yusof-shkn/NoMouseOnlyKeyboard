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
 * Get cash flow statistics from v_cash_flow view.
 * Aggregates all sources: sales, purchase_orders, expenses, income,
 * payment_transactions, and manual cash_flow_transactions.
 */
export const getCashFlowStats = async (
  companyId: number,
  startDate?: string | null,
  endDate?: string | null,
  storeId?: number | null,
): Promise<{ data: CashFlowStats | null; error: any }> => {
  try {
    let query = supabase
      .from('v_cash_flow')
      .select('transaction_type, activity_type, amount')
      .eq('company_id', companyId)

    if (storeId) query = query.eq('store_id', storeId)
    if (startDate) query = query.gte('transaction_date', startDate)
    if (endDate) query = query.lte('transaction_date', endDate)

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

    data?.forEach((tx) => {
      const amount = parseFloat(String(tx.amount || 0))
      const isInflow = tx.transaction_type === 'inflow'

      if (isInflow) {
        stats.totalInflow += amount
      } else {
        stats.totalOutflow += amount
      }

      const net = isInflow ? amount : -amount
      if (tx.activity_type === 'operating') stats.operatingCashFlow += net
      else if (tx.activity_type === 'investing') stats.investingCashFlow += net
      else if (tx.activity_type === 'financing') stats.financingCashFlow += net
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
 * Get cash flow transactions from v_cash_flow view with filtering,
 * pagination, and search.
 *
 * The view UNIONs: cash_flow_transactions + sales + purchase_orders
 *                + expenses + income + payment_transactions
 *
 * View columns:
 *   id, company_id, store_id, transaction_date, transaction_type,
 *   activity_type, description, amount, reference_type, reference_id,
 *   reference_number, journal_entry_id, category, payment_method,
 *   notes, created_by, created_at, updated_at
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
  accountId = null, // not in view — kept for API compat
}: CashFlowFilters = {}): Promise<GetCashFlowResponse> => {
  try {
    if (!companyId) {
      return { data: [], error: null, count: 0 }
    }

    let query = supabase
      .from('v_cash_flow')
      .select('*', { count: 'exact' })
      .eq('company_id', companyId)

    if (storeId) {
      query = query.eq('store_id', storeId)
    }

    if (searchQuery && searchQuery.trim()) {
      const term = searchQuery.trim()
      query = query.or(
        `description.ilike.%${term}%,reference_number.ilike.%${term}%`,
      )
    }

    if (startDate) query = query.gte('transaction_date', startDate)
    if (endDate) query = query.lte('transaction_date', endDate)

    if (transactionType && transactionType !== 'all') {
      query = query.eq('transaction_type', transactionType)
    }

    if (activityType && activityType !== 'all') {
      query = query.eq('activity_type', activityType)
    }

    if (paymentMethod && paymentMethod !== 'all') {
      query = query.eq('payment_method', paymentMethod)
    }

    query = query
      .order('transaction_date', { ascending: false })
      .order('created_at', { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1)

    const { data, error, count } = await query
    if (error) throw error

    return { data: data || [], error: null, count: count || 0 }
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
 * Soft delete — only works for manual cash_flow_transactions rows.
 * Sales, expenses etc. should be deleted from their own pages.
 */
export const deleteCashFlowTransaction = async (
  id: number,
): Promise<{ error: PostgrestError | null }> => {
  const { error } = await supabase
    .from('cash_flow_transactions')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
  return { error }
}

/**
 * Get full row details by ID from underlying cash_flow_transactions table.
 */
export const getCashFlowTransactionById = async (
  id: number,
): Promise<{
  data: CashFlowTransaction | null
  error: PostgrestError | null
}> => {
  const { data, error } = await supabase
    .from('cash_flow_transactions')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single()
  return { data, error }
}

/**
 * Get chart of accounts — company-specific first, falls back to template (company 1).
 */
export const getChartOfAccounts = async (
  companyId: number,
): Promise<{ data: any[] | null; error: PostgrestError | null }> => {
  const { data: companyAccounts, error: companyError } = await supabase
    .from('chart_of_accounts')
    .select('*')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('account_code', { ascending: true })

  if (!companyError && companyAccounts && companyAccounts.length > 0) {
    return { data: companyAccounts, error: null }
  }

  const { data: templateAccounts, error: templateError } = await supabase
    .from('chart_of_accounts')
    .select('*')
    .eq('company_id', 1)
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('account_code', { ascending: true })

  return { data: templateAccounts, error: templateError }
}

