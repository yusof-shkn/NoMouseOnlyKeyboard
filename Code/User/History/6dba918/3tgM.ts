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
 * Get cash flow transactions from the v_cash_flow_statement view.
 *
 * The view derives company_id from journal_entries and joins to
 * chart_of_accounts (including company 1 template accounts), so it
 * correctly returns data for all companies regardless of which company
 * owns the COA rows.
 *
 * View columns:
 *   company_id, entry_date, description, reference_type, reference_id,
 *   account_name, activity_type, cash_in, cash_out, net_cash_flow,
 *   running_balance_by_activity
 */
export const getCashFlowTransactions = async ({
  page = 1,
  pageSize = 10,
  searchQuery = '',
  startDate = null,
  endDate = null,
  transactionType = 'all',
  activityType = 'all',
  paymentMethod = 'all', // not available in view — kept for API compatibility
  storeId = null, // not available in view — kept for API compatibility
  companyId = null,
  accountId = null,
}: CashFlowFilters = {}): Promise<GetCashFlowResponse> => {
  try {
    if (!companyId) {
      return { data: [], error: null, count: 0 }
    }

    let query = supabase
      .from('v_cash_flow_statement')
      .select('*', { count: 'exact' })
      .eq('company_id', companyId)

    // Search filter — description and account_name are available in the view
    if (searchQuery && searchQuery.trim()) {
      const searchTerm = searchQuery.trim()
      query = query.or(
        `description.ilike.%${searchTerm}%,account_name.ilike.%${searchTerm}%`,
      )
    }

    // Date range filter
    if (startDate) {
      query = query.gte('entry_date', startDate)
    }
    if (endDate) {
      query = query.lte('entry_date', endDate)
    }

    // Transaction type filter (cash_in > 0 = inflow, cash_out > 0 = outflow)
    // The view doesn't have a transaction_type column — filter via net_cash_flow sign
    if (transactionType === 'inflow') {
      query = query.gt('cash_in', 0)
    } else if (transactionType === 'outflow') {
      query = query.gt('cash_out', 0)
    }

    // Activity type filter
    if (activityType && activityType !== 'all') {
      query = query.eq('activity_type', activityType)
    }

    // Pagination and ordering
    query = query
      .order('entry_date', { ascending: false })
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
 * Get cash flow statistics from v_cash_flow_summary view.
 *
 * View columns: company_id, activity_type, total_cash_in,
 *               total_cash_out, net_cash_flow, activity_order
 */
export const getCashFlowStats = async (
  companyId: number,
  startDate?: string | null,
  endDate?: string | null,
): Promise<{
  data: CashFlowStats | null
  error: any
}> => {
  try {
    // v_cash_flow_summary doesn't support date filtering (it's a summary view)
    // For date-filtered stats we fall back to querying the statement view directly
    let query = supabase
      .from('v_cash_flow_summary')
      .select('*')
      .eq('company_id', companyId)

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
 * Delete a cash flow transaction (soft delete on cash_flow_transactions table).
 * Note: The view is read-only. Deletes must target the underlying table.
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
 * Get transaction details by ID from underlying table
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
 * Get chart of accounts — checks company first, falls back to template (company 1)
 */
export const getChartOfAccounts = async (
  companyId: number,
): Promise<{ data: any[] | null; error: PostgrestError | null }> => {
  // Try company-specific accounts first
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

  // Fall back to template company (1)
  const { data: templateAccounts, error: templateError } = await supabase
    .from('chart_of_accounts')
    .select('*')
    .eq('company_id', 1)
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('account_code', { ascending: true })

  return { data: templateAccounts, error: templateError }
}

