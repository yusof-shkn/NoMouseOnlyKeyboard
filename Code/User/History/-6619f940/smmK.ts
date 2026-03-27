// src/pages/LowStock/utils/lowStock.utils.ts - UPDATED WITH REDUX CURRENCY SUPPORT
import { notifications } from '@mantine/notifications'
import {
  LowStockItem,
  LowStockStats,
  LowStockFilters,
  FetchLowStockResult,
} from '../types/lowStock.types'
import { getLowStockItems, getLowStockStats } from '../data/lowStock.queries'

/**
 * Fetch low stock statistics from view_low_stock
 */
export const fetchLowStockStats = async (
  companyId: number | undefined,
): Promise<LowStockStats> => {
  try {
    const { data, error } = await getLowStockStats(companyId)

    if (error) throw error

    return (
      data || {
        total: 0,
        critical: 0,
        high: 0,
        medium: 0,
        totalValue: 0,
      }
    )
  } catch (error: any) {
    console.error('Error fetching low stock stats:', error)
    notifications.show({
      title: 'Error',
      message: error.message || 'Failed to fetch low stock statistics',
      color: 'red',
    })
    throw error
  }
}

/**
 * Fetch low stock data with filters using view_low_stock
 */
export const fetchLowStockData = async (
  filters: LowStockFilters = {},
): Promise<FetchLowStockResult> => {
  const {
    page = 1,
    pageSize = 10,
    searchQuery = '',
    urgencyLevel = 'all',
    storeId = null,
    categoryId = null,
    companyId = null,
    isUnlocked = false,
  } = filters

  try {
    const {
      data: lowStockData,
      error: lowStockError,
      count: totalCount,
    } = await getLowStockItems({
      page,
      pageSize,
      searchQuery,
      urgencyLevel,
      storeId,
      categoryId,
      companyId,
      isUnlocked,
    })

    if (lowStockError) throw lowStockError

    return {
      lowStockData: lowStockData || [],
      totalCount: totalCount || 0,
    }
  } catch (error: any) {
    console.error('Error fetching low stock data:', error)
    notifications.show({
      title: 'Error',
      message: error.message || 'Failed to fetch low stock data',
      color: 'red',
    })
    throw error
  }
}

/**
 * Get urgency badge color
 */
export const getUrgencyColor = (urgency: string): string => {
  switch (urgency) {
    case 'critical':
      return 'red'
    case 'high':
      return 'orange'
    case 'medium':
      return 'yellow'
    case 'low':
      return 'blue'
    default:
      return 'gray'
  }
}

/**
 * Get urgency display text
 */
export const getUrgencyText = (urgency: string): string => {
  switch (urgency) {
    case 'critical':
      return 'Critical (Out of Stock)'
    case 'high':
      return 'High (Very Low)'
    case 'medium':
      return 'Medium (Low Stock)'
    case 'low':
      return 'Low (Near Reorder)'
    default:
      return 'Unknown'
  }
}

/**
 * Calculate stock percentage against reorder level
 */
export const calculateStockPercentage = (
  currentQty: number,
  reorderLevel: number,
): number => {
  if (reorderLevel === 0) return 0
  return Math.round((currentQty / reorderLevel) * 100)
}

/**
 * Format currency value using currency from Redux settings
 * @param value - Amount to format
 * @param currency - Currency code from Redux settings (default: UGX)
 */
export const formatCurrency = (
  value: number,
  currency: string = 'UGX',
): string => {
  // Currency configuration map
  const currencyConfig: Record<string, { locale: string; decimals: number }> = {
    UGX: { locale: 'en-UG', decimals: 0 },
    USD: { locale: 'en-US', decimals: 2 },
    EUR: { locale: 'de-DE', decimals: 2 },
    GBP: { locale: 'en-GB', decimals: 2 },
    KES: { locale: 'en-KE', decimals: 2 },
    TZS: { locale: 'en-TZ', decimals: 0 },
    RWF: { locale: 'en-RW', decimals: 0 },
  }

  const config = currencyConfig[currency] || { locale: 'en-UG', decimals: 0 }

  return new Intl.NumberFormat(config.locale, {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: config.decimals,
    maximumFractionDigits: config.decimals,
  }).format(value)
}

/**
 * Format date
 */
export const formatDate = (dateString?: string): string => {
  if (!dateString) return 'N/A'
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/**
 * Get expiry status color using days from Redux settings
 * @param daysToExpiry - Days until expiry
 * @param criticalDays - Critical threshold from Redux (default: 7)
 * @param warningDays - Warning threshold from Redux (default: 30)
 */
export const getExpiryStatusColor = (
  daysToExpiry: number | undefined,
  criticalDays: number = 7,
  warningDays: number = 30,
): string => {
  if (!daysToExpiry) return 'gray'

  if (daysToExpiry < 0) return 'red'
  if (daysToExpiry <= criticalDays) return 'red'
  if (daysToExpiry <= warningDays) return 'orange'
  if (daysToExpiry <= 90) return 'yellow'
  return 'green'
}

/**
 * Get expiry status text using days from Redux settings
 * @param daysToExpiry - Days until expiry
 * @param criticalDays - Critical threshold from Redux (default: 7)
 * @param warningDays - Warning threshold from Redux (default: 30)
 */
export const getExpiryStatusText = (
  daysToExpiry: number | undefined,
  criticalDays: number = 7,
  warningDays: number = 30,
): string => {
  if (!daysToExpiry) return 'No expiry data'

  if (daysToExpiry < 0) return `Expired ${Math.abs(daysToExpiry)} days ago`
  if (daysToExpiry === 0) return 'Expires today'
  if (daysToExpiry === 1) return 'Expires tomorrow'
  if (daysToExpiry <= criticalDays) return `${daysToExpiry} days (Critical)`
  if (daysToExpiry <= warningDays) return `${daysToExpiry} days (Warning)`
  return `${daysToExpiry} days to expiry`
}

/**
 * Validate filters
 */
export const validateFilters = (filters: LowStockFilters): string[] => {
  const errors: string[] = []

  if (filters.page && filters.page < 1) {
    errors.push('Page number must be greater than 0')
  }

  if (filters.pageSize && (filters.pageSize < 1 || filters.pageSize > 100)) {
    errors.push('Page size must be between 1 and 100')
  }

  return errors
}

