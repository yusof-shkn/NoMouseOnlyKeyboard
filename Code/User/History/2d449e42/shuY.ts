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
 * ✅ UPDATED: Currency locale mapping (removed from queries file)
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
 * Enrich cash flow transactions with related data
 */
export const enrichCashFlowTransactions = (
  transactions: any[],
  profiles: Profile[],
  stores: Store[],
  accounts: ChartOfAccount[],
): CashFlowTransaction[] => {
  let runningBalance = 0

  return transactions.map((transaction): CashFlowTransaction => {
    // Calculate running balance
    if (transaction.transaction_type === 'inflow') {
      runningBalance += transaction.amount || 0
    } else {
      runningBalance -= transaction.amount || 0
    }

    // Find related data
    const account = accounts.find((acc) => acc.id === transaction.account_id)
    const store = stores.find((s) => s.id === transaction.store_id)
    const creator = profiles.find((p) => p.auth_id === transaction.created_by)
    const approver = profiles.find((p) => p.auth_id === transaction.approved_by)

    return {
      ...transaction,
      account_name: account?.account_name || 'Unknown Account',
      account_code: account?.account_code || 'N/A',
      store_name: store?.store_name || 'N/A',
      creator_name: creator
        ? `${creator.first_name || ''} ${creator.last_name || ''}`.trim()
        : 'Unknown',
      approver_name: approver
        ? `${approver.first_name || ''} ${approver.last_name || ''}`.trim()
        : 'N/A',
      running_balance: runningBalance,
    }
  })
}

/**
 * Fetch cash flow data with filters
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
    // Fetch transactions
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

    // Fetch related data
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
 * Format currency for display with dynamic currency
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
 * Format date for display with dynamic locale
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
 * Format date and time for display with dynamic locale
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

/**
 * Get transaction type label
 */
export const getTransactionTypeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    inflow: 'Cash In',
    outflow: 'Cash Out',
  }
  return labels[type] || type
}

/**
 * Get activity type label
 */
export const getActivityTypeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    operating: 'Operating',
    investing: 'Investing',
    financing: 'Financing',
  }
  return labels[type] || type
}

/**
 * Get payment method label
 */
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
 * Validate transaction data
 */
export const validateTransactionData = (
  data: Partial<CashFlowTransaction>,
): string[] => {
  const errors: string[] = []

  if (!data.entry_date) {
    errors.push('Transaction date is required')
  }

  if (!data.amount || data.amount <= 0) {
    errors.push('Amount must be greater than zero')
  }

  if (!data.description?.trim()) {
    errors.push('Description is required')
  }

  if (!data.transaction_type) {
    errors.push('Transaction type is required')
  }

  if (!data.activity_type) {
    errors.push('Activity type is required')
  }

  if (!data.payment_method) {
    errors.push('Payment method is required')
  }

  if (!data.account_id) {
    errors.push('Account is required')
  }

  return errors
}

/**
 * Calculate percentage change
 */
export const calculatePercentageChange = (
  current: number,
  previous: number,
): number => {
  if (previous === 0) return current > 0 ? 100 : 0
  return ((current - previous) / previous) * 100
}

/**
 * Group transactions by date
 */
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

/**
 * Calculate daily totals
 */
export const calculateDailyTotals = (
  transactions: CashFlowTransaction[],
): Record<string, { inflow: number; outflow: number; net: number }> => {
  const grouped = groupTransactionsByDate(transactions)
  const dailyTotals: Record<
    string,
    { inflow: number; outflow: number; net: number }
  > = {}

  Object.entries(grouped).forEach(([date, trans]) => {
    const inflow = trans
      .filter((t) => t.transaction_type === 'inflow')
      .reduce((sum, t) => sum + (t.amount || 0), 0)
    const outflow = trans
      .filter((t) => t.transaction_type === 'outflow')
      .reduce((sum, t) => sum + (t.amount || 0), 0)

    dailyTotals[date] = {
      inflow,
      outflow,
      net: inflow - outflow,
    }
  })

  return dailyTotals
}

