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

const getAllStores = async (): Promise<{ data: Store[] | null; error: any }> => {
  const { supabase } = await import('@app/core/supabase/Supabase.utils')
  return await supabase
    .from('stores')
    .select('*')
    .is('deleted_at', null)
    .order('store_name', { ascending: true })
}

/**
 * Derive convenience cash_in / cash_out / net_cash_flow fields from the
 * view's transaction_type + amount columns, and add a running balance.
 *
 * v_cash_flow already provides transaction_type and amount directly, so
 * we just split them out for components that render separate Cash In / Out columns.
 */
export const enrichCashFlowTransactions = (
  transactions: CashFlowTransaction[],
  profiles: Profile[],
  stores: Store[],
  accounts: ChartOfAccount[],
): CashFlowTransaction[] => {
  let runningBalance = 0

  return transactions.map((tx): CashFlowTransaction => {
    const amount = parseFloat(String(tx.amount ?? 0))
    const isInflow = tx.transaction_type === 'inflow'

    // Derive convenience split columns
    const cash_in = isInflow ? amount : 0
    const cash_out = isInflow ? 0 : amount
    const net_cash_flow = cash_in - cash_out
    runningBalance += net_cash_flow

    // account_name — not in view, look up by account_id if present
    const account = tx.account_id
      ? accounts.find((a) => a.id === tx.account_id)
      : null

    // store_name — store_id IS in the view
    const store = tx.store_id
      ? stores.find((s) => s.id === tx.store_id)
      : null

    // creator / approver — only present on underlying table rows
    const creator = tx.created_by
      ? profiles.find((p) => p.auth_id === tx.created_by)
      : null
    const approver = tx.approved_by
      ? profiles.find((p) => p.auth_id === tx.approved_by)
      : null

    return {
      ...tx,
      // Convenience fields derived from view data
      cash_in,
      cash_out,
      net_cash_flow,
      running_balance: runningBalance,
      // Backward-compat alias
      entry_date: tx.transaction_date,
      // Enrichment
      account_name: account?.account_name ?? tx.account_name ?? 'N/A',
      account_code: account?.account_code ?? tx.account_code ?? 'N/A',
      store_name: store?.store_name ?? tx.store_name ?? 'N/A',
      creator_name: creator
        ? `${creator.first_name || ''} ${creator.last_name || ''}`.trim()
        : (tx.creator_name ?? 'N/A'),
      approver_name: approver
        ? `${approver.first_name || ''} ${approver.last_name || ''}`.trim()
        : (tx.approver_name ?? 'N/A'),
      // reference_number is the canonical receipt/ref field in the view
      receipt_number: tx.reference_number ?? tx.receipt_number ?? null,
    }
  })
}

/**
 * Fetch cash flow data with filters and enrich for display.
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

export const formatCurrency = (amount: number, currency: string = 'UGX'): string => {
  const locale = getCurrencyLocale(currency)
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export const formatDate = (dateString: string, currency: string = 'UGX'): string => {
  const locale = getCurrencyLocale(currency)
  return new Date(dateString).toLocaleDateString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export const formatDateTime = (dateString: string, currency: string = 'UGX'): string => {
  const locale = getCurrencyLocale(currency)
  return new Date(dateString).toLocaleString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export const getTransactionTypeLabel = (type: string): string =>
  ({ inflow: 'Cash In', outflow: 'Cash Out' }[type] || type)

export const getActivityTypeLabel = (type: string): string =>
  ({ operating: 'Operating', investing: 'Investing', financing: 'Financing' }[type] || type)

export const getPaymentMethodLabel = (method: string): string =>
  ({
    cash: 'Cash',
    mobile_money: 'Mobile Money',
    bank_transfer: 'Bank Transfer',
    check: 'Check',
    credit_card: 'Credit Card',
    debit_card: 'Debit Card',
  }[method] || method)

export const validateTransactionData = (data: Partial<CashFlowTransaction>): string[] => {
  const errors: string[] = []
  if (!data.transaction_date) errors.push('Transaction date is required')
  if (!data.amount || data.amount <= 0) errors.push('Amount must be greater than zero')
  if (!data.description?.trim()) errors.push('Description is required')
  if (!data.transaction_type) errors.push('Transaction type is required')
  if (!data.activity_type) errors.push('Activity type is required')
  if (!data.payment_method) errors.push('Payment method is required')
  if (!data.account_id) errors.push('Account is required')
  return errors
}

export const calculatePercentageChange = (current: number, previous: number): number => {
  if (previous === 0) return current > 0 ? 100 : 0
  return ((current - previous) / previous) * 100
}

export const groupTransactionsByDate = (
  transactions: CashFlowTransaction[],
): Record<string, CashFlowTransaction[]> => {
  return transactions.reduce(
    (groups, tx) => {
      const date = tx.transaction_date.split('T')[0]
      if (!groups[date]) groups[date] = []
      groups[date].push(tx)
      return groups
    },
    {} as Record<string, CashFlowTransaction[]>,
  )
}

export const calculateDailyTotals = (
  transactions: CashFlowTransaction[],
): Record<string, { inflow: number; outflow: number; net: number }> => {
  const grouped = groupTransactionsByDate(transactions)
  const dailyTotals: Record<string, { inflow: number; outflow: number; net: number }> = {}

  Object.entries(grouped).forEach(([date, txs]) => {
    const inflow = txs
      .filter((t) => t.transaction_type === 'inflow')
      .reduce((sum, t) => sum + parseFloat(String(t.amount ?? 0)), 0)
    const outflow = txs
      .filter((t) => t.transaction_type === 'outflow')
      .reduce((sum, t) => sum + parseFloat(String(t.amount ?? 0)), 0)
    dailyTotals[date] = { inflow, outflow, net: inflow - outflow }
  })

  return dailyTotals
}
