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
 * Get cash flow transactions from the v_cash_flow view.
 *
 * Confirmed view columns (information_schema):
 *   company_id, store_id, transaction_date, activity_type, transaction_type,
 *   description, amount, reference_type, reference_id, reference_number,
 *   payment_method, created_at
 *
 * NOTE: There is no entry_date, cash_in, cash_out, net_cash_flow,
 * running_balance_by_activity, or account_name column in this view.
 * Those are derived client-side after fetching.
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
  accountId = null, // not in view — kept for API compatibility
}: CashFlowFilters = {}): Promise<GetCashFlowResponse> => {
  try {
    if (!companyId) {
      return { data: [], error: null, count: 0 }
    }

    let query = supabase
      .from('v_cash_flow')
      .select('*', { count: 'exact' })
      .eq('company_id', companyId)

    // Search — description and reference_number are available in the view
    if (searchQuery && searchQuery.trim()) {
      const term = searchQuery.trim()
      query = query.or(
        `description.ilike.%${term}%,reference_number.ilike.%${term}%`,
      )
    }

    // Date range — column is transaction_date (not entry_date)
    if (startDate) {
      query = query.gte('transaction_date', startDate)
    }
    if (endDate) {
      query = query.lte('transaction_date', endDate)
    }

    // Transaction type — view has a real transaction_type column ('inflow'/'outflow')
    if (transactionType && transactionType !== 'all') {
      query = query.eq('transaction_type', transactionType)
    }

    // Activity type
    if (activityType && activityType !== 'all') {
      query = query.eq('activity_type', activityType)
    }

    // Payment method — view has a real payment_method column
    if (paymentMethod && paymentMethod !== 'all') {
      query = query.eq('payment_method', paymentMethod)
    }

    // Store filter
    if (storeId) {
      query = query.eq('store_id', storeId)
    }

    // Pagination — order by transaction_date (not entry_date)
    query = query
      .order('transaction_date', { ascending: false })
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
 * Get cash flow statistics from vw_cash_flow_summary view.
 * No v_ equivalent exists — vw_cash_flow_summary is correct.
 *
 * View columns: company_id, activity_type, total_cash_in,
 *               total_cash_out, net_cash_flow, activity_order
 */
export const getCashFlowStats = async (
  companyId: number,
  startDate?: string | null,
  endDate?: string | null,
): Promise<{ data: CashFlowStats | null; error: any }> => {
  try {
    const { data, error } = await supabase
      .from('vw_cash_flow_summary') // ✅ Kept — no v_ equivalent exists
      .select('*')
      .eq('company_id', companyId)

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

    data?.forEach((row: any) => {
      const cashIn = parseFloat(row.total_cash_in || 0)
      const cashOut = parseFloat(row.total_cash_out || 0)
      const net = parseFloat(row.net_cash_flow || 0)

      stats.totalInflow += cashIn
      stats.totalOutflow += cashOut

      if (row.activity_type === 'operating') {
        stats.operatingCashFlow += net
      } else if (row.activity_type === 'investing') {
        stats.investingCashFlow += net
      } else if (row.activity_type === 'financing') {
        stats.financingCashFlow += net
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
 * Delete a cash flow transaction (soft delete on underlying table).
 * The view is read-only — deletes must target cash_flow_transactions.
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
 * Get full transaction details by ID from the underlying table.
 * Use when you need fields the view doesn't expose (account_id, notes, etc.).
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

