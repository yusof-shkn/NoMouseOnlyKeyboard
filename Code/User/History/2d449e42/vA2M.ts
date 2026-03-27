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
 * Enrich v_cash_flow rows with derived and joined fields.
 *
 * Derives: cash_in, cash_out, net_cash_flow, running_balance
 * Joins:   store_name (via store_id), creator_name (via created_by)
 */
export const enrichCashFlowTransactions = (
  transactions: CashFlowTransaction[],
  profiles: Profile[],
  stores: Store[],
  _accounts: ChartOfAccount[], // kept for API compat — no account_id in view
): CashFlowTransaction[] => {
  let runningBalance = 0

  return transactions.map((tx): CashFlowTransaction => {
    const amount = parseFloat(String(tx.amount ?? 0))
    const isInflow = tx.transaction_type === 'inflow'

    const cash_in = isInflow ? amount : 0
    const cash_out = isInflow ? 0 : amount
    const net_cash_flow = cash_in - cash_out
    runningBalance += net_cash_flow

    const store = tx.store_id ? stores.find((s) => s.id === tx.store_id) : null

    // created_by is bigint (profile id) in v_cash_flow
    const creator = tx.created_by
      ? profiles.find((p) => (p as any).id === tx.created_by)
      : null

    return {
      ...tx,
      cash_in,
      cash_out,
      net_cash_flow,
      running_balance: runningBalance,
      // compat aliases
      entry_date: tx.transaction_date,
      receipt_number: tx.reference_number ?? null,
      // enrichment
      store_name: store?.store_name ?? 'N/A',
      creator_name: creator
        ? `${(creator as any).first_name || ''} ${(creator as any).last_name || ''}`.trim() ||
          'N/A'
        : 'N/A',
    }
  })
}

/**
 * Fetch and enrich cash flow data from v_cash_flow view.
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
          ? getCashFlowStats(companyId, startDate, endDate, storeId)
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

export const formatCurrency = (
  amount: number,
  currency: string = 'UGX',
): string =>
  new Intl.NumberFormat(getCurrencyLocale(currency), {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)

export const formatDate = (
  dateString: string,
  currency: string = 'UGX',
): string =>
  new Date(dateString).toLocaleDateString(getCurrencyLocale(currency), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })

export const formatDateTime = (
  dateString: string,
  currency: string = 'UGX',
): string =>
  new Date(dateString).toLocaleString(getCurrencyLocale(currency), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

export const getTransactionTypeLabel = (type: string): string =>
  ({ inflow: 'Cash In', outflow: 'Cash Out' })[type] ?? type

export const getActivityTypeLabel = (type: string): string =>
  ({ operating: 'Operating', investing: 'Investing', financing: 'Financing' })[
    type
  ] ?? type

export const getPaymentMethodLabel = (method: string): string =>
  ({
    cash: 'Cash',
    mobile_money: 'Mobile Money',
    bank_transfer: 'Bank Transfer',
    check: 'Check',
    credit_card: 'Credit Card',
    debit_card: 'Debit Card',
  })[method] ?? method

export const validateTransactionData = (
  data: Partial<CashFlowTransaction>,
): string[] => {
  const errors: string[] = []
  if (!data.transaction_date) errors.push('Transaction date is required')
  if (!data.amount || data.amount <= 0)
    errors.push('Amount must be greater than zero')
  if (!data.description?.trim()) errors.push('Description is required')
  if (!data.transaction_type) errors.push('Transaction type is required')
  if (!data.activity_type) errors.push('Activity type is required')
  if (!data.payment_method) errors.push('Payment method is required')
  return errors
}

export const calculatePercentageChange = (
  current: number,
  previous: number,
): number => {
  if (previous === 0) return current > 0 ? 100 : 0
  return ((current - previous) / previous) * 100
}

export const groupTransactionsByDate = (
  transactions: CashFlowTransaction[],
): Record<string, CashFlowTransaction[]> =>
  transactions.reduce(
    (groups, tx) => {
      const date = tx.transaction_date.split('T')[0]
      if (!groups[date]) groups[date] = []
      groups[date].push(tx)
      return groups
    },
    {} as Record<string, CashFlowTransaction[]>,
  )

export const calculateDailyTotals = (
  transactions: CashFlowTransaction[],
): Record<string, { inflow: number; outflow: number; net: number }> => {
  const grouped = groupTransactionsByDate(transactions)
  return Object.fromEntries(
    Object.entries(grouped).map(([date, txs]) => {
      const inflow = txs
        .filter((t) => t.transaction_type === 'inflow')
        .reduce((s, t) => s + parseFloat(String(t.amount ?? 0)), 0)
      const outflow = txs
        .filter((t) => t.transaction_type === 'outflow')
        .reduce((s, t) => s + parseFloat(String(t.amount ?? 0)), 0)
      return [date, { inflow, outflow, net: inflow - outflow }]
    }),
  )
}

