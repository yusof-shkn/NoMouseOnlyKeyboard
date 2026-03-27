// src/pages/StockHistory/utils/stockHistory.utils.ts
import { notifications } from '@mantine/notifications'
import { CompanySettings } from '@shared/types/companySettings'
import {
  StockHistoryItem,
  StockHistoryFilters,
  StockHistoryStats,
  FetchStockHistoryResult,
  ExpiryStatus,
} from '../types/stockHistory.types'

import {
  getStockHistory,
  getStockHistoryStats,
} from '../data/stockHistory.queries'

import { getStores } from '@features/main/components/storesManagement/data/store.queries'
import { Store } from '@shared/types/Store'

/**
 * Fetch stock history with filters
 */
export const fetchStockHistoryData = async (
  filters: StockHistoryFilters = {},
  companyId: number,
): Promise<FetchStockHistoryResult> => {
  const {
    page = 1,
    pageSize = 10,
    searchQuery = '',
    storeId = null,
    productId = null,
    transactionType = null,
    startDate = null,
    endDate = null,
    isUnlocked = false,
  } = filters

  try {
    const {
      data: historyData,
      error: historyError,
      count: totalCount,
    } = await getStockHistory({
      page,
      pageSize,
      searchQuery,
      storeId,
      productId,
      transactionType,
      startDate,
      endDate,
      companyId,
      isUnlocked,
    })

    if (historyError) throw historyError

    const { data: statsData, error: statsError } = await getStockHistoryStats(
      companyId,
      startDate || undefined,
      endDate || undefined,
    )

    if (statsError) {
      console.warn('Could not fetch stats:', statsError)
    }

    return {
      items: historyData || [],
      totalCount: totalCount || 0,
      stats: statsData || {
        totalTransactions: 0,
        totalQuantityIn: 0,
        totalQuantityOut: 0,
        netQuantityChange: 0,
        totalValue: 0,
        uniqueProducts: 0,
      },
    }
  } catch (error: any) {
    console.error('Error fetching stock history data:', error)
    notifications.show({
      title: 'Error',
      message: error.message || 'Failed to fetch stock history data',
      color: 'red',
    })
    throw error
  }
}

/**
 * Format currency based on company settings from Redux
 */
export const formatCurrency = (
  amount: number,
  settings?: CompanySettings | null,
): string => {
  const currency =
    settings?.default_currency || settings?.base_currency || 'UGX'

  const currencyConfig: Record<string, { locale: string; decimals: number }> = {
    UGX: { locale: 'en-UG', decimals: 0 },
    USD: { locale: 'en-US', decimals: 2 },
    EUR: { locale: 'en-EU', decimals: 2 },
    GBP: { locale: 'en-GB', decimals: 2 },
    KES: { locale: 'en-KE', decimals: 2 },
    TZS: { locale: 'en-TZ', decimals: 0 },
    RWF: { locale: 'en-RW', decimals: 0 },
    ZAR: { locale: 'en-ZA', decimals: 2 },
  }

  const config = currencyConfig[currency] || { locale: 'en-US', decimals: 2 }

  try {
    return new Intl.NumberFormat(config.locale, {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: config.decimals,
      maximumFractionDigits: config.decimals,
    }).format(amount)
  } catch (error) {
    console.warn(`Currency ${currency} not supported, using default formatting`)
    return `${currency} ${amount.toLocaleString('en-US', {
      minimumFractionDigits: config.decimals,
      maximumFractionDigits: config.decimals,
    })}`
  }
}

/**
 * Format number with commas
 */
export const formatNumber = (num: number): string => {
  if (num === null || num === undefined) return '0'
  return new Intl.NumberFormat('en-US').format(num)
}

/**
 * Format date for display
 */
export const formatDate = (dateString?: string | null): string => {
  if (!dateString) return 'N/A'
  try {
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return 'N/A'
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch (error) {
    return 'N/A'
  }
}

/**
 * Format datetime for display
 */
export const formatDateTime = (dateString?: string | null): string => {
  if (!dateString) return 'N/A'
  try {
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return 'N/A'
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch (error) {
    return 'N/A'
  }
}

/**
 * Get transaction type badge color
 */
export const getTransactionTypeBadgeColor = (type: string): string => {
  const colorMap: Record<string, string> = {
    RECEIPT: 'green',
    SALE: 'blue',
    RETURN: 'violet',
    ADJUSTMENT: 'orange',
  }
  return colorMap[type] || 'gray'
}

/**
 * Get quantity change display color
 */
export const getQuantityChangeColor = (type: string): string => {
  if (type === 'RECEIPT' || type === 'RETURN') return 'green'
  if (type === 'SALE') return 'red'
  return 'orange'
}

/**
 * Format transaction type label
 */
export const formatTransactionType = (type: string): string => {
  if (!type) return 'Unknown'
  return type
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

/**
 * Get quantity change prefix
 */
export const getQuantityChangePrefix = (type: string): string => {
  if (type === 'RECEIPT' || type === 'RETURN') return '+'
  return '-'
}

/**
 * Get expiry status based on company settings
 */
export const getExpiryStatus = (
  expiryDate: string | null | undefined,
  settings?: CompanySettings | null,
): ExpiryStatus => {
  if (!expiryDate || !settings) {
    return {
      isExpired: false,
      isNearExpiry: false,
      isCriticalExpiry: false,
      daysUntilExpiry: 0,
    }
  }

  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const expiry = new Date(expiryDate)
    expiry.setHours(0, 0, 0, 0)

    if (isNaN(expiry.getTime())) {
      return {
        isExpired: false,
        isNearExpiry: false,
        isCriticalExpiry: false,
        daysUntilExpiry: 0,
      }
    }

    const daysUntilExpiry = Math.ceil(
      (expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
    )

    return {
      isExpired: daysUntilExpiry < 0,
      isNearExpiry:
        daysUntilExpiry >= 0 &&
        daysUntilExpiry <= (settings.near_expiry_warning_days || 30),
      isCriticalExpiry:
        daysUntilExpiry >= 0 &&
        daysUntilExpiry <= (settings.near_expiry_critical_days || 7),
      daysUntilExpiry,
    }
  } catch (error) {
    console.error('Error calculating expiry status:', error)
    return {
      isExpired: false,
      isNearExpiry: false,
      isCriticalExpiry: false,
      daysUntilExpiry: 0,
    }
  }
}

/**
 * Get currency symbol
 */
export const getCurrencySymbol = (
  settings?: CompanySettings | null,
): string => {
  const currency =
    settings?.default_currency || settings?.base_currency || 'UGX'

  const symbolMap: Record<string, string> = {
    UGX: 'UGX',
    USD: '$',
    EUR: '€',
    GBP: '£',
    KES: 'KES',
    TZS: 'TZS',
    RWF: 'RWF',
    ZAR: 'R',
  }

  return symbolMap[currency] || currency
}

/**
 * Fetch stores for filter
 */
export const fetchStoresForFilter = async (
  companyId: number,
): Promise<Store[]> => {
  try {
    const { data, error } = await getStores({ companyId, status: 'active' })
    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error fetching stores:', error)
    return []
  }
}

/**
 * Calculate statistics from items (client-side backup)
 */
export const calculateStatsFromItems = (
  items: StockHistoryItem[],
): StockHistoryStats => {
  if (!items || items.length === 0) {
    return {
      totalTransactions: 0,
      totalQuantityIn: 0,
      totalQuantityOut: 0,
      netQuantityChange: 0,
      totalValue: 0,
      uniqueProducts: 0,
    }
  }

  const totalTransactions = items.length

  const totalQuantityIn = items.reduce((sum, item) => {
    if (
      item.transaction_type === 'RECEIPT' ||
      item.transaction_type === 'RETURN'
    ) {
      return sum + Math.abs(item.quantity)
    }
    return sum
  }, 0)

  const totalQuantityOut = items.reduce((sum, item) => {
    if (item.transaction_type === 'SALE') {
      return sum + Math.abs(item.quantity)
    }
    return sum
  }, 0)

  const netQuantityChange = totalQuantityIn - totalQuantityOut

  const totalValue = items.reduce(
    (sum, item) => sum + (item.total_amount || 0),
    0,
  )

  const uniqueProducts = new Set(items.map((item) => item.product_id)).size

  return {
    totalTransactions,
    totalQuantityIn,
    totalQuantityOut,
    netQuantityChange,
    totalValue,
    uniqueProducts,
  }
}

/**
 * Format time ago (e.g., "2 hours ago")
 */
export const formatTimeAgo = (dateString?: string | null): string => {
  if (!dateString) return 'N/A'

  try {
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return 'N/A'

    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`
    if (diffHours < 24)
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`

    return formatDate(dateString)
  } catch (error) {
    return 'N/A'
  }
}

/**
 * Export utility to get filter summary text
 */
export const getFilterSummary = (filters: StockHistoryFilters): string => {
  const parts: string[] = []

  if (filters.storeId && filters.storeId !== 'all') parts.push('Store filtered')
  if (filters.transactionType) parts.push('Transaction type filtered')
  if (filters.productId && filters.productId !== 'all')
    parts.push('Product filtered')
  if (filters.startDate || filters.endDate) parts.push('Date range filtered')
  if (filters.searchQuery) parts.push('Search applied')

  if (parts.length === 0) return 'All records'
  return parts.join(', ')
}

