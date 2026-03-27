// utils/stockListUtils.ts - UPDATED TO USE DATABASE VIEWS

import { notifications } from '@mantine/notifications'
import {
  StockListItem,
  StockListStats,
  ExpiryStatus,
} from '../types/stockList.types'
import { CompanySettings } from '@shared/types/companySettings'
import {
  fetchStockList,
  fetchStores,
  fetchCategories,
  StockListQueryParams,
} from '../data/stockList.queries'

// Re-export StockListQueryParams as FetchStockListParams for backward compatibility
export type FetchStockListParams = StockListQueryParams

/**
 * Fetch stock list data using view_inventory and company settings from Redux
 */
export const fetchStockListData = async (
  params: FetchStockListParams = {},
  companySettings: CompanySettings | null,
) => {
  try {
    // Fetch stock list from view_inventory with settings from Redux
    const { data: stockListData, totalCount } = await fetchStockList(
      params,
      companySettings,
    )

    // Fetch stores and categories for filters
    const storesData = await fetchStores(params.companyId)
    const categoriesData = await fetchCategories()

    return {
      stockListData: stockListData || [],
      storesData: storesData || [],
      categoriesData: categoriesData || [],
      totalCount: totalCount || 0,
    }
  } catch (error) {
    console.error('Error in fetchStockListData:', error)
    notifications.show({
      title: 'Error',
      message: 'Failed to fetch stock list',
      color: 'red',
    })
    throw error
  }
}

/**
 * Calculate statistics from stock list data with company settings
 * Updated to work with view_inventory data structure
 */
export const calculateStats = (
  stockList: StockListItem[],
  companySettings: CompanySettings | null,
): StockListStats => {
  const stats: StockListStats = {
    total: stockList.length,
    available: 0,
    reserved: 0,
    expired: 0,
    damaged: 0,
    lowStock: 0,
    outOfStock: 0,
    expiringSoon: 0,
    expiringThisMonth: 0,
    expiryCritical: 0,
    blocked: 0,
    totalValue: 0,
    totalCostValue: 0,
    discountedItems: 0,
    totalDiscountValue: 0,
  }

  const today = new Date()
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0)

  const warningDays = companySettings?.near_expiry_warning_days || 30
  const criticalDays = companySettings?.near_expiry_critical_days || 7

  const warningDate = new Date(today)
  warningDate.setDate(today.getDate() + warningDays)

  const criticalDate = new Date(today)
  criticalDate.setDate(today.getDate() + criticalDays)

  stockList.forEach((item) => {
    // Count by status - normalize to uppercase for comparison
    const normalizedStatus = item.status?.toUpperCase()

    switch (normalizedStatus) {
      case 'AVAILABLE':
      case 'IN_STOCK':
        stats.available++
        break
      case 'RESERVED':
        stats.reserved++
        break
      case 'EXPIRED':
        stats.expired++
        break
      case 'LOW_STOCK':
        stats.lowStock++
        break
      case 'OUT_OF_STOCK':
        stats.outOfStock++
        break
      case 'DAMAGED':
        stats.damaged++
        break
      case 'BLOCKED':
        stats.blocked++
        break
    }

    // Count expiry status
    if (item.expiry_date && !item.is_expired) {
      const expiryDate = new Date(item.expiry_date)

      if (expiryDate <= criticalDate) {
        stats.expiryCritical++
      } else if (expiryDate <= warningDate) {
        stats.expiringSoon++
      }

      if (expiryDate <= endOfMonth) {
        stats.expiringThisMonth++
      }
    }

    // Count blocked items (expired with block setting enabled)
    if (item.is_blocked) {
      stats.blocked++
    }

    // Count discounted items
    if (item.discount_percentage && item.discount_percentage > 0) {
      stats.discountedItems = (stats.discountedItems || 0) + 1
      const discountValue =
        ((item.original_selling_price || item.selling_price) -
          item.selling_price) *
        item.quantity_available
      stats.totalDiscountValue = (stats.totalDiscountValue || 0) + discountValue
    }

    // Sum financial values
    stats.totalValue += item.total_stock_value || item.stock_value || 0
    stats.totalCostValue +=
      item.total_cost_value || item.quantity_available * item.unit_cost || 0
  })

  return stats
}

/**
 * Enrich stock list with additional calculations
 * No longer needed as view_inventory provides all calculations
 */
export const enrichStockList = (
  stockList: StockListItem[],
  companySettings: CompanySettings | null,
): StockListItem[] => {
  // All enrichment is now done in the database view
  return stockList
}

/**
 * Status color helper - updated for new stock_status values
 */
export const getStatusColor = (status: string): string => {
  const upperStatus = status?.toUpperCase()

  switch (upperStatus) {
    case 'IN_STOCK':
    case 'AVAILABLE':
      return 'green'
    case 'RESERVED':
      return 'blue'
    case 'LOW_STOCK':
      return 'orange'
    case 'OUT_OF_STOCK':
      return 'red'
    case 'EXPIRED':
      return 'red'
    case 'DAMAGED':
      return 'yellow'
    case 'BLOCKED':
      return 'dark'
    case 'OVERSTOCK':
      return 'grape'
    default:
      return 'gray'
  }
}

/**
 * Expiry color helper
 */
export const getExpiryColor = (
  daysToExpiry: number | null,
  companySettings: CompanySettings | null,
): string => {
  if (daysToExpiry === null) return 'gray'

  const criticalDays = companySettings?.near_expiry_critical_days || 7
  const warningDays = companySettings?.near_expiry_warning_days || 30

  if (daysToExpiry <= 0) return 'red'
  if (daysToExpiry <= criticalDays) return 'red'
  if (daysToExpiry <= warningDays) return 'orange'
  if (daysToExpiry <= 60) return 'yellow'
  return 'green'
}

/**
 * Format stock status - updated for new values
 */
export const formatStockStatus = (status: string): string => {
  const upperStatus = status?.toUpperCase()

  switch (upperStatus) {
    case 'IN_STOCK':
      return 'In Stock'
    case 'AVAILABLE':
      return 'Available'
    case 'RESERVED':
      return 'Reserved'
    case 'LOW_STOCK':
      return 'Low Stock'
    case 'OUT_OF_STOCK':
      return 'Out of Stock'
    case 'EXPIRED':
      return 'Expired'
    case 'DAMAGED':
      return 'Damaged'
    case 'BLOCKED':
      return 'Blocked'
    case 'OVERSTOCK':
      return 'Overstock'
    default:
      return status || 'Unknown'
  }
}

/**
 * Format expiry status
 */
export const formatExpiryStatus = (
  daysToExpiry: number | null,
  companySettings: CompanySettings | null,
): string => {
  if (daysToExpiry === null) return 'No expiry'
  if (daysToExpiry <= 0) return 'Expired'

  const criticalDays = companySettings?.near_expiry_critical_days || 7
  const warningDays = companySettings?.near_expiry_warning_days || 30

  if (daysToExpiry === 1) return '1 day left'
  if (daysToExpiry <= criticalDays) return `${daysToExpiry} days (Critical)`
  if (daysToExpiry <= warningDays) return `${daysToExpiry} days left`
  if (daysToExpiry <= 60) return '1-2 months'
  return '2+ months'
}

/**
 * Get expiry badge variant
 */
export const getExpiryBadgeVariant = (expiryStatus?: ExpiryStatus): string => {
  switch (expiryStatus) {
    case 'critical':
      return 'filled'
    case 'expiring_soon':
      return 'light'
    case 'valid':
      return 'outline'
    case 'expired':
      return 'filled'
    default:
      return 'light'
  }
}

/**
 * Check if item can be edited
 */
export const canEditStock = (
  item: StockListItem,
  companySettings: CompanySettings | null,
): { allowed: boolean; reason?: string } => {
  if (!companySettings) {
    return { allowed: true }
  }

  if (item.is_expired && companySettings.block_expired_sales) {
    return {
      allowed: false,
      reason: 'Cannot edit expired batches (company policy)',
    }
  }

  if (item.is_blocked) {
    return {
      allowed: false,
      reason: 'This batch is blocked',
    }
  }

  return { allowed: true }
}

/**
 * Check if item can be sold
 */
export const canSellStock = (
  item: StockListItem,
  quantity: number,
  companySettings: CompanySettings | null,
): { allowed: boolean; reason?: string } => {
  if (!companySettings) {
    return { allowed: true }
  }

  if (item.is_expired && companySettings.block_expired_sales) {
    return {
      allowed: false,
      reason: 'Cannot sell expired products',
    }
  }

  const resultingQty = item.quantity_available - quantity
  if (resultingQty < 0 && !companySettings.allow_negative_stock) {
    return {
      allowed: false,
      reason: 'Insufficient stock available',
    }
  }

  return { allowed: true }
}

/**
 * Calculate low stock threshold
 */
export const getLowStockThreshold = (
  reorderLevel: number,
  companySettings: CompanySettings | null,
): number => {
  const multiplier = companySettings?.low_stock_multiplier || 1.0
  return Math.ceil(reorderLevel * multiplier)
}

/**
 * Format discount
 */
export const formatDiscount = (item: StockListItem): string => {
  if (!item.discount_percentage || item.discount_percentage <= 0) {
    return ''
  }
  return `${item.discount_percentage.toFixed(0)}% off`
}

/**
 * Format currency using company settings
 */
export const formatCurrencyWithSettings = (
  amount: number,
  companySettings: CompanySettings | null,
): string => {
  const currency = companySettings?.default_currency || 'UGX'

  return new Intl.NumberFormat('en-UG', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)
}

/**
 * Get stock level badge based on view_inventory data
 */
export const getStockLevelBadge = (
  item: StockListItem,
  companySettings: CompanySettings | null,
): { color: string; label: string } => {
  if (item.quantity_available <= 0) {
    return { color: 'red', label: 'Out of Stock' }
  }

  const threshold = getLowStockThreshold(
    item.reorder_level || 0,
    companySettings,
  )

  if (item.quantity_available <= threshold) {
    return { color: 'orange', label: 'Low Stock' }
  }

  if (item.reorder_level && item.quantity_available >= item.reorder_level * 3) {
    return { color: 'grape', label: 'Overstock' }
  }

  return { color: 'green', label: 'In Stock' }
}

/**
 * Calculate days of stock remaining based on sales velocity
 * Uses avg_daily_sales from view_inventory
 */
export const calculateDaysOfStock = (
  availableQty: number,
  avgDailySales: number | null,
): number | null => {
  if (!avgDailySales || avgDailySales <= 0) {
    return null
  }

  return Math.floor(availableQty / avgDailySales)
}

/**
 * Get urgency level for reordering
 */
export const getReorderUrgency = (
  daysOfStock: number | null,
  stockStatus: string,
): { level: 'urgent' | 'soon' | 'normal' | 'not_needed'; color: string } => {
  const normalizedStatus = stockStatus?.toUpperCase()

  if (normalizedStatus === 'OUT_OF_STOCK') {
    return { level: 'urgent', color: 'red' }
  }

  if (!daysOfStock) {
    return { level: 'not_needed', color: 'gray' }
  }

  if (daysOfStock <= 7) {
    return { level: 'urgent', color: 'red' }
  }

  if (daysOfStock <= 14) {
    return { level: 'soon', color: 'orange' }
  }

  if (normalizedStatus === 'LOW_STOCK') {
    return { level: 'normal', color: 'yellow' }
  }

  return { level: 'not_needed', color: 'green' }
}

/**
 * Calculate profit margin percentage
 */
export const calculateProfitMargin = (
  sellingPrice: number,
  costPrice: number,
): number => {
  if (sellingPrice <= 0) return 0
  return ((sellingPrice - costPrice) / sellingPrice) * 100
}

/**
 * Format batch information for display
 */
export const formatBatchInfo = (item: StockListItem): string => {
  if (item.total_batches && item.total_batches > 1) {
    return `${item.total_batches} batches`
  }

  if (item.batch_number) {
    return `Batch: ${item.batch_number}`
  }

  return 'No batch info'
}

