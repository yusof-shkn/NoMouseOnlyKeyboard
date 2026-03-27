// src/pages/FastMovingItems/utils/fastMovingItems.utils.ts - UPDATED TO USE view_fast_moving_stock
import { notifications } from '@mantine/notifications'
import {
  FastMovingItem,
  FastMovingItemFilters,
  FastMovingItemStats,
  FetchFastMovingItemsResult,
} from '../types/fastMovingItems.types'
import { CompanySettings } from '@shared/types/companySettings'
import {
  getFastMovingItems,
  getFastMovingItemsStats,
} from '../data/fastMovingItems.queries'
import { getStores } from '@features/main/components/storesManagement/data/store.queries'
import { Store } from '@shared/types/Store'

/**
 * Fetch fast moving items with filters using view_fast_moving_stock
 */
export const fetchFastMovingItemsData = async (
  filters: FastMovingItemFilters = {},
  companyId: number,
  companySettings: CompanySettings | null,
): Promise<FetchFastMovingItemsResult> => {
  const {
    page = 1,
    pageSize = 10,
    searchQuery = '',
    storeId = null,
    categoryId = null,
    periodDays = 30,
    minVelocity = 0,
    isUnlocked = false,
  } = filters

  try {
    // Fetch data from view_fast_moving_stock
    const {
      data: itemsData,
      error: itemsError,
      count: totalCount,
    } = await getFastMovingItems({
      page,
      pageSize,
      searchQuery,
      storeId,
      categoryId,
      periodDays,
      minVelocity,
      companyId,
      settings: companySettings,
      isUnlocked,
    })

    if (itemsError) throw itemsError

    // The view already includes current stock levels, so no need to enrich
    const enrichedItems = itemsData || []

    // Get stats using the same view
    const { data: statsData, error: statsError } =
      await getFastMovingItemsStats(companyId, periodDays, storeId)

    if (statsError) {
      console.warn('Could not fetch stats:', statsError)
    }

    return {
      items: enrichedItems,
      totalCount: totalCount || 0,
      stats: statsData || {
        totalProducts: 0,
        totalQuantitySold: 0,
        totalRevenue: 0,
        avgVelocity: 0,
      },
    }
  } catch (error: any) {
    console.error('Error fetching fast moving items data:', error)
    notifications.show({
      title: 'Error',
      message: error.message || 'Failed to fetch fast moving items data',
      color: 'red',
    })
    throw error
  }
}

/**
 * Format currency using company settings from Redux
 */
export const formatCurrencyWithSettings = (
  amount: number,
  companySettings: CompanySettings | null,
): string => {
  const currency =
    companySettings?.base_currency || companySettings?.default_currency || 'UGX'

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

/**
 * Format number with commas
 */
export const formatNumber = (num: number): string => {
  return new Intl.NumberFormat('en-US').format(num)
}

/**
 * Format date for display
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
 * Get velocity badge color based on score
 */
export const getVelocityBadgeColor = (score: number): string => {
  if (score >= 50) return 'red'
  if (score >= 30) return 'orange'
  if (score >= 15) return 'yellow'
  if (score >= 5) return 'blue'
  return 'gray'
}

/**
 * Get velocity category from view data
 */
export const getVelocityCategory = (velocityCategory: string): string => {
  const categories: { [key: string]: string } = {
    VERY_FAST: 'Very Fast',
    FAST: 'Fast',
    MODERATE: 'Moderate',
    SLOW: 'Slow',
    VERY_SLOW: 'Very Slow',
  }
  return categories[velocityCategory] || velocityCategory
}

/**
 * Get stock status color based on company settings from Redux
 */
export const getStockStatusColor = (
  currentStock: number,
  velocity: number,
  companySettings: CompanySettings | null,
): string => {
  // Use low_stock_multiplier from Redux settings
  const multiplier = companySettings?.low_stock_multiplier || 7
  const lowStockThreshold = velocity * multiplier

  if (currentStock <= 0) return 'red'
  if (currentStock < lowStockThreshold) return 'red'
  if (currentStock < lowStockThreshold * 2) return 'orange'
  if (currentStock < lowStockThreshold * 3) return 'yellow'
  return 'green'
}

/**
 * Get reorder urgency color from view data
 */
export const getReorderUrgencyColor = (urgency: string): string => {
  const colors: { [key: string]: string } = {
    URGENT: 'red',
    SOON: 'orange',
    NORMAL: 'yellow',
    NOT_NEEDED: 'green',
  }
  return colors[urgency] || 'gray'
}

/**
 * Calculate days until stockout using company settings
 */
export const calculateDaysUntilStockout = (
  currentStock: number,
  itemsPerDay: number,
  companySettings: CompanySettings | null,
): string => {
  if (itemsPerDay === 0) return 'N/A'

  // Handle negative stock based on settings from Redux
  if (currentStock <= 0) {
    if (companySettings?.allow_negative_stock) {
      return `Backorder: ${Math.abs(currentStock)} units`
    }
    return 'Out of Stock'
  }

  const days = Math.floor(currentStock / itemsPerDay)

  if (days < 1) return '<1 day'
  if (days === 1) return '1 day'
  if (days < 7) return `${days} days`
  if (days < 30) return `${Math.floor(days / 7)} weeks`
  return `${Math.floor(days / 30)} months`
}

/**
 * Format days of stock remaining from view
 */
export const formatDaysOfStockRemaining = (
  daysRemaining: number | null,
  companySettings: CompanySettings | null,
): string => {
  if (daysRemaining === null || daysRemaining === undefined) return 'N/A'

  if (daysRemaining < 0) {
    if (companySettings?.allow_negative_stock) {
      return 'Backorder'
    }
    return 'Out of Stock'
  }

  if (daysRemaining < 1) return '<1 day'
  if (daysRemaining === 1) return '1 day'
  if (daysRemaining < 7) return `${Math.floor(daysRemaining)} days`
  if (daysRemaining < 30) return `${Math.floor(daysRemaining / 7)} weeks`
  return `${Math.floor(daysRemaining / 30)} months`
}

/**
 * Get velocity rank text
 */
export const getVelocityRank = (score: number): string => {
  if (score >= 50) return 'Very High'
  if (score >= 30) return 'High'
  if (score >= 15) return 'Medium'
  if (score >= 5) return 'Low'
  return 'Very Low'
}

/**
 * Get ABC classification color
 */
export const getABCClassificationColor = (classification: string): string => {
  const colors: { [key: string]: string } = {
    A: 'green',
    B: 'blue',
    C: 'gray',
  }
  return colors[classification] || 'gray'
}

/**
 * Get sales trend color
 */
export const getSalesTrendColor = (trend: string): string => {
  const colors: { [key: string]: string } = {
    INCREASING: 'green',
    STABLE: 'blue',
    DECREASING: 'red',
  }
  return colors[trend] || 'gray'
}

/**
 * Format sales trend display text
 */
export const formatSalesTrend = (trend: string): string => {
  const trends: { [key: string]: string } = {
    INCREASING: '↑ Increasing',
    STABLE: '→ Stable',
    DECREASING: '↓ Decreasing',
  }
  return trends[trend] || trend
}

/**
 * Check if item should show low stock warning using Redux settings
 */
export const shouldShowLowStockWarning = (
  currentStock: number,
  itemsPerDay: number,
  companySettings: CompanySettings | null,
): boolean => {
  if (!companySettings?.enable_low_stock_notifications) {
    return false
  }

  const multiplier = companySettings.low_stock_multiplier || 7
  const lowStockThreshold = itemsPerDay * multiplier

  return currentStock < lowStockThreshold
}

/**
 * Check if item should show reorder warning from view data
 */
export const shouldShowReorderWarning = (reorderUrgency: string): boolean => {
  return ['URGENT', 'SOON'].includes(reorderUrgency)
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
 * Calculate profit margin percentage
 */
export const calculateProfitMargin = (
  sellingPrice: number,
  cost: number,
): number => {
  if (sellingPrice === 0) return 0
  return ((sellingPrice - cost) / sellingPrice) * 100
}

/**
 * Format profit margin for display
 */
export const formatProfitMargin = (marginPercentage: number): string => {
  return `${marginPercentage.toFixed(1)}%`
}

