// src/pages/Finance/TrialBalance/data/trialBalance.queries.ts
import { supabase } from '@app/core/supabase/Supabase.utils'
import { PostgrestError } from '@supabase/supabase-js'
import { TrialBalanceEntry } from '../types/trialBalance.types'

export interface GetTrialBalanceOptions {
  companyId?: number
  startDate?: string
  endDate?: string
}

export interface GetTrialBalanceResponse {
  data: TrialBalanceEntry[] | null
  error: PostgrestError | null
}

/**
 * Get trial balance data.
 *
 * v_trial_balance view columns (confirmed):
 *   company_id, account_code, account_name, account_type, account_subtype,
 *   normal_balance, total_debits, total_credits, net_balance
 *
 * The view has NO date column (it aggregates all posted journal entries).
 * For date-range filtering we query journal_entry_lines directly.
 *
 * NOTE: account_id is NOT in the view — it is only available via the
 * journal_entry_lines path.
 */
export const getTrialBalance = async ({
  companyId,
  startDate,
  endDate,
}: GetTrialBalanceOptions = {}): Promise<GetTrialBalanceResponse> => {
  try {
    // ── Date-filtered path: query journal_entry_lines directly ──────────────
    if (startDate && endDate) {
      const { data: journalData, error: journalError } = await supabase
        .from('journal_entry_lines')
        .select(
          `
          account_id,
          debit_amount,
          credit_amount,
          journal_entries!inner(
            entry_date,
            is_posted,
            company_id
          ),
          chart_of_accounts!inner(
            account_code,
            account_name,
            account_type,
            account_subtype,
            normal_balance
          )
        `,
        )
        .eq('journal_entries.is_posted', true)
        .gte('journal_entries.entry_date', startDate)
        .lte('journal_entries.entry_date', endDate)

      if (journalError) throw journalError

      // Apply company filter
      const filteredData = companyId
        ? journalData?.filter(
            (line: any) => line.journal_entries.company_id === companyId,
          )
        : journalData

      // Group by account and accumulate totals
      const accountMap = new Map<number, TrialBalanceEntry>()

      filteredData?.forEach((line: any) => {
        const accountId = line.account_id
        const coa = line.chart_of_accounts

        if (!accountMap.has(accountId)) {
          accountMap.set(accountId, {
            account_id: accountId,
            account_code: coa.account_code,
            account_name: coa.account_name,
            account_type: coa.account_type,
            account_subtype: coa.account_subtype ?? null,
            normal_balance: coa.normal_balance,
            total_debits: 0,
            total_credits: 0,
            net_balance: 0,
            balance: 0, // compat alias
            company_id: line.journal_entries.company_id || companyId || 0,
          })
        }

        const entry = accountMap.get(accountId)!
        entry.total_debits += Number(line.debit_amount) || 0
        entry.total_credits += Number(line.credit_amount) || 0
      })

      // Calculate net_balance per account
      const data: TrialBalanceEntry[] = Array.from(accountMap.values()).map(
        (entry) => {
          if (entry.normal_balance === 'debit') {
            entry.net_balance = entry.total_debits - entry.total_credits
          } else {
            entry.net_balance = entry.total_credits - entry.total_debits
          }
          entry.balance = entry.net_balance // keep compat alias in sync
          return entry
        },
      )

      data.sort((a, b) => a.account_code.localeCompare(b.account_code))

      return { data, error: null }
    }

    // ── Default path: use v_trial_balance view (all-time totals) ────────────
    let query = supabase
      .from('v_trial_balance') // ✅ Updated from vw_trial_balance
      .select('*')

    if (companyId) {
      query = query.eq('company_id', companyId)
    }

    query = query.order('account_code', { ascending: true })

    const { data, error } = await query
    if (error) throw error

    // Normalise: add balance compat alias and ensure numeric types
    const normalised: TrialBalanceEntry[] = (data || []).map((row: any) => ({
      ...row,
      total_debits: Number(row.total_debits) || 0,
      total_credits: Number(row.total_credits) || 0,
      net_balance: Number(row.net_balance) || 0,
      balance: Number(row.net_balance) || 0, // compat alias
    }))

    return { data: normalised, error: null }
  } catch (error) {
    console.error('Error in getTrialBalance query:', error)
    return {
      data: null,
      error: error as PostgrestError,
    }
  }
}

/**
 * Get trial balance summary statistics.
 */
export const getTrialBalanceStats = async (
  companyId?: number,
  startDate?: string,
  endDate?: string,
): Promise<{
  data: {
    totalDebits: number
    totalCredits: number
    totalAccounts: number
    isBalanced: boolean
  } | null
  error: any
}> => {
  try {
    const { data, error } = await getTrialBalance({
      companyId,
      startDate,
      endDate,
    })

    if (error) throw error

    if (!data || data.length === 0) {
      return {
        data: {
          totalDebits: 0,
          totalCredits: 0,
          totalAccounts: 0,
          isBalanced: true,
        },
        error: null,
      }
    }

    const totalDebits = data.reduce(
      (sum, entry) => sum + (Number(entry.total_debits) || 0),
      0,
    )
    const totalCredits = data.reduce(
      (sum, entry) => sum + (Number(entry.total_credits) || 0),
      0,
    )

    return {
      data: {
        totalDebits,
        totalCredits,
        totalAccounts: data.length,
        isBalanced: Math.abs(totalDebits - totalCredits) < 0.01,
      },
      error: null,
    }
  } catch (error) {
    console.error('Error fetching trial balance stats:', error)
    return {
      data: {
        totalDebits: 0,
        totalCredits: 0,
        totalAccounts: 0,
        isBalanced: false,
      },
      error,
    }
  }
}

/**
 * Get accounts grouped by type for hierarchical display.
 */
export const getTrialBalanceByAccountType = async (
  companyId?: number,
  startDate?: string,
  endDate?: string,
): Promise<{
  data: { [key: string]: TrialBalanceEntry[] } | null
  error: PostgrestError | null
}> => {
  try {
    const { data, error } = await getTrialBalance({
      companyId,
      startDate,
      endDate,
    })
    if (error) throw error
    if (!data) return { data: null, error: null }

    const grouped: { [key: string]: TrialBalanceEntry[] } = {
      asset: [],
      liability: [],
      equity: [],
      revenue: [],
      expense: [],
      cost_of_goods_sold: [],
    }

    data.forEach((entry) => {
      const type = entry.account_type
      if (grouped[type]) grouped[type].push(entry)
    })

    return { data: grouped, error: null }
  } catch (error) {
    console.error('Error grouping trial balance by type:', error)
    return { data: null, error: error as PostgrestError }
  }
}

/**
 * Export trial balance data formatted for PDF/Excel.
 */
export const exportTrialBalanceData = async (
  companyId?: number,
  startDate?: string,
  endDate?: string,
): Promise<{ data: any[] | null; error: PostgrestError | null }> => {
  try {
    const { data, error } = await getTrialBalance({
      companyId,
      startDate,
      endDate,
    })
    if (error) throw error
    if (!data) return { data: null, error: null }

    const exportData = data.map((entry) => ({
      'Account Code': entry.account_code,
      'Account Name': entry.account_name,
      'Account Type': entry.account_type
        ?.replace(/_/g, ' ')
        .replace(/\b\w/g, (l) => l.toUpperCase()),
      'Total Debits': Number(entry.total_debits || 0).toFixed(2),
      'Total Credits': Number(entry.total_credits || 0).toFixed(2),
      // Use net_balance (real column); balance is just a compat alias
      Balance: Number(entry.net_balance || 0).toFixed(2),
    }))

    return { data: exportData, error: null }
  } catch (error) {
    console.error('Error exporting trial balance:', error)
    return { data: null, error: error as PostgrestError }
  }
}

