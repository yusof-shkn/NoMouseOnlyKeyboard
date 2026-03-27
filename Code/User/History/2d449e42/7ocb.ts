// src/pages/CashFlow/utils/cashFlowManagement.utils.ts
import { notifications } from '@mantine/notifications'
import {
  CashFlowTransaction,
  CashFlowFilters,
  CashFlowStats,
  FetchCashFlowResult,
  ChartOfAccount,
} from '../types/cashFlow.types'
import {
  getCashFlowTransactions,
  getCashFlowStats,
  getChartOfAccounts,
} from '../data/cashFlow.queries'
import { getAllProfiles } from '@shared/data/profileQueries'
import { Profile } from '@shared/types/profile'
import { Store } from '@shared/types/Store'

/**
 * Currency locale mapping
 */
const getCurrencyLocale = (currency: string): string => {
  const localeMap: Record<string, string> = {
    UGX: 'en-UG',
    USD: 'en-US',
    EUR: 'en-EU',
    GBP: 'en-GB',
    KES: 'en-KE',
    TZS: 'en-TZ',
    RWF: 'en-RW',
  }
  return localeMap[currency] || 'en-US'
}

// Get all stores function
const getAllStores = async (): Promise<{
  data: Store[] | null
  error: any
}> => {
  const { supabase } = await import('@app/core/supabase/Supabase.utils')
  return await supabase
    .from('stores')
    .select('*')
    .is('deleted_at', null)
    .order('store_name', { ascending: true })
}

/**
 * Derive a display-friendly transaction_type and amount from v_cash_flow columns.
 *
 * v_cash_flow does NOT expose transaction_type or amount directly — the view
 * exposes cash_in and cash_out instead.  This helper normalises rows so the
 * rest of the UI can still use `transaction_type` and `amount` without change.
 */
const deriveTransactionFields = (
  row: CashFlowTransaction,
): CashFlowTransaction => ({
  ...row,
  transaction_type: (row.cash_in ?? 0) > 0 ? 'inflow' : 'outflow',
  amount: (row.cash_in ?? 0) > 0 ? row.cash_in : row.cash_out,
})

/**
 * Enrich cash flow transactions with related data.
 *
 * IMPORTANT: v_cash_flow already joins account_name from chart_of_accounts,
 * so account/store/profile lookups are best-effort fallbacks only.  The view
 * data takes precedence; we only fill in fields the view doesn't provide
 * (store_name, creator_name, approver_name) if the underlying IDs are present
 * on the row (which they are NOT in view rows — those come from the table only).
 *
 * Running balance is re-computed client-side for the current page slice.
 */
export const enrichCashFlowTransactions = (
  transactions: CashFlowTransaction[],
  profiles: Profile[],
  stores: Store[],
  accounts: ChartOfAccount[],
): CashFlowTransaction[] => {
  let runningBalance = 0

  return transactions.map((transaction): CashFlowTransaction => {
    // Re-derive convenience fields from view columns
    const derived = deriveTransactionFields(transaction)

    // Update running balance using net_cash_flow from the view
    runningBalance += parseFloat(String(transaction.net_cash_flow ?? 0))

    // v_cash_flow already provides account_name — only override if the view
    // returned an empty value AND we have account_id to look up (table rows).
    const accountFromLookup =
      !transaction.account_name && transaction.account_id
        ? accounts.find((acc) => acc.id === transaction.account_id)
        : null

    // store_id and created_by are only present on raw table rows, not view rows.
    const store = transaction.store_id
      ? stores.find((s) => s.id === transaction.store_id)
      : null
    const creator = transaction.created_by
      ? profiles.find((p) => p.auth_id === transaction.created_by)
      : null
    const approver = transaction.approved_by
      ? profiles.find((p) => p.auth_id === transaction.approved_by)
      : null

    return {
      ...derived,
      // Prefer the view's account_name; fall back to lookup only when blank
      account_name:
        transaction.account_name ||
        accountFromLookup?.account_name ||
        'Unknown Account',
      account_code:
        accountFromLookup?.account_code ?? transaction.account_code ?? 'N/A',
      store_name: store?.store_name ?? transaction.store_name ?? 'N/A',
      creator_name: creator
        ? `${creator.first_name || ''} ${creator.last_name || ''}`.trim()
        : (transaction.creator_name ?? 'N/A'),
      approver_name: approver
        ? `${approver.first_name || ''} ${approver.last_name || ''}`.trim()
        : (transaction.approver_name ?? 'N/A'),
      running_balance: runningBalance,
    }
  })
}

/**
 * Fetch cash flow data with filters.
 *
 * Profile, store, and account lookups are still performed so that any
 * table-sourced rows (e.g. from getCashFlowTransactionById) are also enriched.
 * For view rows the extra fetches are lightweight and mostly serve as fallbacks.
 */
export const fetchCashFlowData = async (
  filters: CashFlowFilters = {},
): Promise<FetchCashFlowResult> => {
  const {
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
  } = filters

  try {
    // Fetch transactions from v_cash_flow
    const {
      data: transactionsData,
      error: transactionsError,
      count: totalCount,
    } = await getCashFlowTransactions({
      page,
      pageSize,
      searchQuery,
      startDate,
      endDate,
      transactionType,
      activityType,
      paymentMethod,
      storeId,
      companyId,
      accountId,
    })

    if (transactionsError) throw transactionsError

    // Fetch ancillary data in parallel.
    // These are used as enrichment fallbacks; view rows already include
    // account_name so most lookups will resolve to the "no-op" branch.
    const [profilesResult, storesResult, accountsResult, statsResult] =
      await Promise.all([
        getAllProfiles(),
        getAllStores(),
        companyId ? getChartOfAccounts(companyId) : { data: [], error: null },
        companyId
          ? getCashFlowStats(companyId, startDate, endDate)
          : { data: null, error: null },
      ])

    if (profilesResult.error) throw profilesResult.error
    if (storesResult.error) throw storesResult.error
    if (accountsResult.error) throw accountsResult.error
    if (statsResult.error) throw statsResult.error

    const enrichedTransactions = enrichCashFlowTransactions(
      transactionsData || [],
      profilesResult.data || [],
      storesResult.data || [],
      accountsResult.data || [],
    )

    return {
      transactionsData: enrichedTransactions,
      totalCount: totalCount || 0,
      stats: statsResult.data || {
        totalInflow: 0,
        totalOutflow: 0,
        netCashFlow: 0,
        operatingCashFlow: 0,
        investingCashFlow: 0,
        financingCashFlow: 0,
        currentBalance: 0,
      },
    }
  } catch (error: any) {
    console.error('Error fetching cash flow data:', error)
    notifications.show({
      title: 'Error',
      message: error.message || 'Failed to fetch cash flow data',
      color: 'red',
    })
    throw error
  }
}

/**
 * Format currency for display with dynamic currency support.
 */
export const formatCurrency = (
  amount: number,
  currency: string = 'UGX',
): string => {
  const locale = getCurrencyLocale(currency)
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

/**
 * Format date for display with dynamic locale.
 */
export const formatDate = (
  dateString: string,
  currency: string = 'UGX',
): string => {
  const locale = getCurrencyLocale(currency)
  return new Date(dateString).toLocaleDateString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/**
 * Format date and time for display with dynamic locale.
 */
export const formatDateTime = (
  dateString: string,
  currency: string = 'UGX',
): string => {
  const locale = getCurrencyLocale(currency)
  return new Date(dateString).toLocaleString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Get a human-readable label for transaction_type. */
export const getTransactionTypeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    inflow: 'Cash In',
    outflow: 'Cash Out',
  }
  return labels[type] || type
}

/** Get a human-readable label for activity_type. */
export const getActivityTypeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    operating: 'Operating',
    investing: 'Investing',
    financing: 'Financing',
  }
  return labels[type] || type
}

/** Get a human-readable label for payment_method. */
export const getPaymentMethodLabel = (method: string): string => {
  const labels: Record<string, string> = {
    cash: 'Cash',
    mobile_money: 'Mobile Money',
    bank_transfer: 'Bank Transfer',
    check: 'Check',
    credit_card: 'Credit Card',
    debit_card: 'Debit Card',
  }
  return labels[method] || method
}

/**
 * Validate transaction data (used by create/edit forms that target the table,
 * not the view).
 */
export const validateTransactionData = (
  data: Partial<CashFlowTransaction>,
): string[] => {
  const errors: string[] = []

  if (!data.entry_date) errors.push('Transaction date is required')
  if (!data.amount || data.amount <= 0)
    errors.push('Amount must be greater than zero')
  if (!data.description?.trim()) errors.push('Description is required')
  if (!data.transaction_type) errors.push('Transaction type is required')
  if (!data.activity_type) errors.push('Activity type is required')
  if (!data.payment_method) errors.push('Payment method is required')
  if (!data.account_id) errors.push('Account is required')

  return errors
}

/** Calculate percentage change between two values. */
export const calculatePercentageChange = (
  current: number,
  previous: number,
): number => {
  if (previous === 0) return current > 0 ? 100 : 0
  return ((current - previous) / previous) * 100
}

/** Group transactions by ISO date string (YYYY-MM-DD). */
export const groupTransactionsByDate = (
  transactions: CashFlowTransaction[],
): Record<string, CashFlowTransaction[]> => {
  return transactions.reduce(
    (groups, transaction) => {
      const date = transaction.entry_date.split('T')[0]
      if (!groups[date]) {
        groups[date] = []
      }
      groups[date].push(transaction)
      return groups
    },
    {} as Record<string, CashFlowTransaction[]>,
  )
}

/** Calculate inflow/outflow/net totals per day. */
export const calculateDailyTotals = (
  transactions: CashFlowTransaction[],
): Record<string, { inflow: number; outflow: number; net: number }> => {
  const grouped = groupTransactionsByDate(transactions)
  const dailyTotals: Record<
    string,
    { inflow: number; outflow: number; net: number }
  > = {}

  Object.entries(grouped).forEach(([date, trans]) => {
    const inflow = trans.reduce(
      (sum, t) => sum + parseFloat(String(t.cash_in ?? 0)),
      0,
    )
    const outflow = trans.reduce(
      (sum, t) => sum + parseFloat(String(t.cash_out ?? 0)),
      0,
    )
    dailyTotals[date] = { inflow, outflow, net: inflow - outflow }
  })

  return dailyTotals
}

