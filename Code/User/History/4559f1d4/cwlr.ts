// src/pages/BalanceSheet/data/balanceSheet.queries.ts
import { supabase } from '@app/core/supabase/Supabase.utils'
import { PostgrestError } from '@supabase/supabase-js'

import {
  BalanceSheetEntry,
  GetBalanceSheetResponse,
  BalanceSheetFilters,
  CompanySettings,
  Company,
} from '../types/balanceSheet.types'

/**
 * Get all active companies
 */
export const getCompanies = async (): Promise<{
  data: Company[] | null
  error: any
}> => {
  try {
    const { data, error } = await supabase
      .from('companies')
      .select('id, company_name, company_code, is_active')
      .eq('is_active', true)
      .order('company_name', { ascending: true })

    if (error) throw error

    return { data, error: null }
  } catch (error) {
    console.error('Error fetching companies:', error)
    return { data: null, error }
  }
}

/**
 * Get company settings by company ID
 */
export const getCompanySettings = async (
  companyId: number,
): Promise<{
  data: CompanySettings | null
  error: any
}> => {
  try {
    const { data, error } = await supabase
      .from('company_settings')
      .select('*')
      .eq('company_id', companyId)
      .single()

    if (error) throw error

    return { data, error: null }
  } catch (error) {
    console.error('Error fetching company settings:', error)
    return { data: null, error }
  }
}

/**
 * Get balance sheet data using the v_balance_sheet database view
 * This view automatically calculates proper balances based on journal entries
 */
export const getBalanceSheet = async ({
  page = 1,
  pageSize = 10,
  searchQuery = '',
  asOfDate = new Date().toISOString().split('T')[0],
  accountType = 'all',
  companyId = null,
}: BalanceSheetFilters = {}): Promise<GetBalanceSheetResponse> => {
  try {
    // If no company selected, return empty result
    if (companyId === null || companyId === undefined || companyId === '') {
      return {
        data: [],
        error: null,
        count: 0,
        totals: {
          totalAssets: 0,
          totalLiabilities: 0,
          totalEquity: 0,
        },
      }
    }

    const parsedCompanyId =
      typeof companyId === 'string' ? parseInt(companyId, 10) : companyId

    if (isNaN(parsedCompanyId)) {
      return {
        data: [],
        error: null,
        count: 0,
        totals: {
          totalAssets: 0,
          totalLiabilities: 0,
          totalEquity: 0,
        },
      }
    }

    // Query the v_balance_sheet view — fetch ALL rows first (no server pagination)
    // because we need accurate totals before slicing
    let query = supabase
      .from('v_balance_sheet')
      .select('*')
      .eq('company_id', parsedCompanyId)

    // Account type filter
    if (accountType && accountType !== 'all') {
      query = query.eq('account_type', accountType)
    }

    // Search filter
    if (searchQuery && searchQuery.trim()) {
      const searchTerm = searchQuery.trim()
      query = query.or(
        `account_name.ilike.%${searchTerm}%,account_code.ilike.%${searchTerm}%`,
      )
    }

    // v_balance_sheet does not have type_order/subtype_order columns.
    // Sort by account_code from DB; entries are re-sorted by type client-side below.
    query = query.order('account_code', { ascending: true })

    const result = await query

    if (result.error) throw result.error

    // Sort client-side: Assets first, then Liabilities, then Equity.
    // v_balance_sheet has no type_order column so we impose the order here.
    const TYPE_ORDER: Record<string, number> = {
      asset: 1,
      liability: 2,
      equity: 3,
    }
    const sortedData = (result.data || []).sort((a: any, b: any) => {
      const typeSort =
        (TYPE_ORDER[a.account_type] ?? 9) - (TYPE_ORDER[b.account_type] ?? 9)
      if (typeSort !== 0) return typeSort
      return (a.account_code || '').localeCompare(b.account_code || '')
    })

    // Transform view data into balance sheet entries.
    //
    // FIX: The view returns SIGNED balances that already satisfy the accounting
    // equation (Assets = Liabilities + Equity). We MUST preserve the raw signed
    // value on `balance` so that totals calculated by summing entries remain
    // correct. Using Math.abs() here was the root cause of the "Unbalanced"
    // warning — contra/abnormal-balance accounts would inflate one side.
    //
    // The debit/credit split is purely cosmetic for display and still uses
    // Math.abs(). The `balance` field stores the raw signed value; the UI
    // renders Math.abs(balance) for the Balance column.
    //
    // IMPORTANT: Supabase returns numeric columns as strings — always parseFloat.
    const entries: BalanceSheetEntry[] = sortedData.map((row: any) => {
      // Parse balance — Supabase returns numeric as string
      const rawBalance = parseFloat(row.balance || 0)
      const absBalance = Math.abs(rawBalance)

      let debit = 0
      let credit = 0

      if (row.account_type === 'asset') {
        // Assets normally carry debit balances (positive from view = debits > credits)
        // Negative from view = credits exceeded debits (abnormal credit balance)
        if (rawBalance >= 0) {
          debit = absBalance
        } else {
          credit = absBalance // abnormal — more cash went out than came in
        }
      } else if (
        row.account_type === 'liability' ||
        row.account_type === 'equity'
      ) {
        // Liabilities/equity normally carry credit balances (positive from view = credits > debits)
        // Negative from view = debits exceeded credits (abnormal debit balance)
        if (rawBalance >= 0) {
          credit = absBalance
        } else {
          debit = absBalance // abnormal debit balance
        }
      }

      return {
        account_code: row.account_code,
        account_name: row.account_name,
        account_type: row.account_type,
        account_subtype: row.account_subtype || '',
        debit,
        credit,
        // FIXED: store rawBalance (signed) so totals stay correct.
        // The Balance column in the UI should display Math.abs(balance).
        balance: rawBalance,
        normal_balance: row.account_type === 'asset' ? 'debit' : 'credit',
      }
    })

    // Calculate totals from ALL entries (before pagination).
    // Because `balance` is now signed, summing directly matches the view's
    // own arithmetic — no Math.abs() needed here.
    const totalAssets = entries
      .filter((e) => e.account_type === 'asset')
      .reduce((sum, e) => sum + e.balance, 0)

    const totalLiabilities = entries
      .filter((e) => e.account_type === 'liability')
      .reduce((sum, e) => sum + e.balance, 0)

    const totalEquity = entries
      .filter((e) => e.account_type === 'equity')
      .reduce((sum, e) => sum + e.balance, 0)

    // Apply pagination AFTER calculating totals
    const startIndex = (page - 1) * pageSize
    const endIndex = startIndex + pageSize
    const paginatedEntries = entries.slice(startIndex, endIndex)

    return {
      data: paginatedEntries,
      error: null,
      count: entries.length,
      totals: {
        totalAssets,
        totalLiabilities,
        totalEquity,
      },
    }
  } catch (error) {
    console.error('Error in getBalanceSheet query:', error)
    return {
      data: null,
      error: error as PostgrestError,
      count: null,
      totals: null,
    }
  }
}

/**
 * Get balance sheet statistics using the v_balance_sheet view
 */
export const getBalanceSheetStats = async (
  companyId?: number,
): Promise<{
  data: {
    totalAssets: number
    totalLiabilities: number
    totalEquity: number
    accountsCount: number
  } | null
  error: any
}> => {
  try {
    if (!companyId) {
      return {
        data: {
          totalAssets: 0,
          totalLiabilities: 0,
          totalEquity: 0,
          accountsCount: 0,
        },
        error: null,
      }
    }

    // Query the v_balance_sheet view for statistics
    const { data, error } = await supabase
      .from('v_balance_sheet')
      .select('*')
      .eq('company_id', companyId)

    if (error) throw error

    const entries = data || []

    // FIXED: Use signed parseFloat (no Math.abs) so that contra-accounts and
    // abnormal balances are handled correctly and the equation stays balanced.
    const totalAssets = entries
      .filter((e: any) => e.account_type === 'asset')
      .reduce((sum: number, e: any) => sum + parseFloat(e.balance || '0'), 0)

    const totalLiabilities = entries
      .filter((e: any) => e.account_type === 'liability')
      .reduce((sum: number, e: any) => sum + parseFloat(e.balance || '0'), 0)

    const totalEquity = entries
      .filter((e: any) => e.account_type === 'equity')
      .reduce((sum: number, e: any) => sum + parseFloat(e.balance || '0'), 0)

    return {
      data: {
        totalAssets,
        totalLiabilities,
        totalEquity,
        accountsCount: entries.length,
      },
      error: null,
    }
  } catch (error) {
    console.error('Error fetching balance sheet stats:', error)
    return {
      data: {
        totalAssets: 0,
        totalLiabilities: 0,
        totalEquity: 0,
        accountsCount: 0,
      },
      error,
    }
  }
}

/**
 * Export balance sheet data (all records for export)
 */
export const getAllBalanceSheetData = async (
  filters: BalanceSheetFilters = {},
): Promise<{ data: BalanceSheetEntry[] | null; error: any }> => {
  try {
    const { data, error } = await getBalanceSheet({
      ...filters,
      page: 1,
      pageSize: 10000, // Get all records
    })

    if (error) throw error

    return {
      data: data || [],
      error: null,
    }
  } catch (error) {
    console.error('Error fetching all balance sheet data:', error)
    return {
      data: null,
      error,
    }
  }
}

