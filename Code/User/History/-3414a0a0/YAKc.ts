// src/pages/ExpiringSoon/utils/expiringSoon.utils.ts - UPDATED TO USE view_expiring_stock
import { notifications } from '@mantine/notifications'
import {
  ExpiringSoonItem,
  ExpiringSoonFilters,
  ExpiringSoonStats,
  FetchExpiringSoonResult,
} from '../types/expiringSoon.types'
import { CompanySettings } from '@shared/types/companySettings'
import {
  getExpiringSoonItems,
  getExpiringSoonStats,
} from '../data/expiringSoon.queries'
import { getStores } from '@features/main/components/storesManagement/data/store.queries'
import { Store } from '@shared/types/Store'

/**
 * Fetch expiring soon items with filters using view_expiring_stock
 */
export const fetchExpiringSoonData = async (
  filters: ExpiringSoonFilters = {},
  companyId: number,
  companySettings: CompanySettings | null,
): Promise<FetchExpiringSoonResult> => {
  const {
    page = 1,
    pageSize = 10,
    searchQuery = '',
    storeId = null,
    categoryId = null,
    daysThreshold = 90,
    minValue = 0,
    isUnlocked = false,
  } = filters

  try {
    // Fetch data from view_expiring_stock
    const {
      data: itemsData,
      error: itemsError,
      count: totalCount,
    } = await getExpiringSoonItems({
      page,
      pageSize,
      searchQuery,
      storeId,
      categoryId,
      daysThreshold,
      minValue,
      companyId,
      settings: companySettings,
      isUnlocked,
    })

    if (itemsError) throw itemsError

    // The view already includes all necessary data
    const enrichedItems = itemsData || []

    // Get stats using the same view
    const { data: statsData, error: statsError } = await getExpiringSoonStats(
      companyId,
      daysThreshold,
      storeId,
      companySettings,
    )

    if (statsError) {
      console.warn('Could not fetch stats:', statsError)
    }

    return {
      items: enrichedItems,
      totalCount: totalCount || 0,
      stats: statsData || {
        totalBatches: 0,
        totalQuantity: 0,
        totalValue: 0,
        criticalItems: 0,
      },
    }
  } catch (error: any) {
    console.error('Error fetching expiring soon data:', error)
    notifications.show({
      title: 'Error',
      message: error.message || 'Failed to fetch expiring soon data',
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
 * Get expiry urgency badge color using view's expiry_status
 */
export const getExpiryUrgencyColor = (expiryStatus: string): string => {
  const colors: { [key: string]: string } = {
    EXPIRED: 'dark',
    CRITICAL: 'red',
    URGENT: 'orange',
    WARNING: 'yellow',
    ATTENTION: 'blue',
    NORMAL: 'green',
  }
  return colors[expiryStatus] || 'gray'
}

/**
 * Get expiry urgency color by days (fallback)
 */
export const getExpiryUrgencyColorByDays = (
  daysUntilExpiry: number,
  companySettings: CompanySettings | null,
): string => {
  const criticalDays = companySettings?.near_expiry_critical_days || 30
  const warningDays = companySettings?.near_expiry_warning_days || 90

  if (daysUntilExpiry < 0) return 'dark' // Expired
  if (daysUntilExpiry <= 7) return 'red' // Ultra critical: 1 week
  if (daysUntilExpiry <= criticalDays) return 'red' // Critical
  if (daysUntilExpiry <= 60) return 'orange' // Urgent
  if (daysUntilExpiry <= warningDays) return 'yellow' // Warning
  return 'blue' // Attention
}

/**
 * Get expiry status text from view
 */
export const getExpiryStatus = (expiryStatus: string): string => {
  const statusMap: { [key: string]: string } = {
    EXPIRED: 'Expired',
    CRITICAL: 'Critical',
    URGENT: 'Urgent',
    WARNING: 'Warning',
    ATTENTION: 'Attention',
    NORMAL: 'Normal',
  }
  return statusMap[expiryStatus] || expiryStatus
}

/**
 * Get expiry status text by days (fallback)
 */
export const getExpiryStatusByDays = (
  daysUntilExpiry: number,
  companySettings: CompanySettings | null,
): string => {
  const criticalDays = companySettings?.near_expiry_critical_days || 30
  const warningDays = companySettings?.near_expiry_warning_days || 90

  if (daysUntilExpiry < 0) return 'Expired'
  if (daysUntilExpiry === 0) return 'Expires Today'
  if (daysUntilExpiry === 1) return 'Expires Tomorrow'
  if (daysUntilExpiry <= 7) return 'Critical'
  if (daysUntilExpiry <= criticalDays) return 'Urgent'
  if (daysUntilExpiry <= 60) return 'Urgent'
  if (daysUntilExpiry <= warningDays) return 'Warning'
  return 'Attention'
}

/**
 * Get urgency priority color from view
 */
export const getUrgencyPriorityColor = (priority: number): string => {
  // urgency_priority from view: 1-6 (1=highest urgency)
  if (priority === 1) return 'dark' // Expired
  if (priority === 2) return 'red' // Critical
  if (priority === 3) return 'orange' // Urgent
  if (priority === 4) return 'yellow' // Warning
  if (priority === 5) return 'blue' // Attention
  return 'green' // Normal
}

/**
 * Get stock percentage remaining
 */
export const getStockPercentage = (
  remainingQuantity: number,
  originalQuantity: number,
): number => {
  if (originalQuantity === 0) return 0
  return Math.round((remainingQuantity / originalQuantity) * 100)
}

/**
 * Calculate potential loss value (items within critical threshold) using view data
 */
export const calculatePotentialLoss = (items: ExpiringSoonItem[]): number => {
  // Use urgency_priority from view (1=EXPIRED, 2=CRITICAL)
  return items
    .filter((item) => (item as any).urgency_priority <= 2)
    .reduce((sum, item) => sum + item.total_value, 0)
}

/**
 * Check if item is eligible for near-expiry discount using view data
 */
export const isEligibleForDiscount = (
  item: ExpiringSoonItem,
  companySettings: CompanySettings | null,
): boolean => {
  const criticalDays = companySettings?.near_expiry_critical_days || 30

  return (
    (companySettings?.allow_near_expiry_discount || false) &&
    item.days_until_expiry <= criticalDays &&
    item.days_until_expiry > 0
  )
}

/**
 * Check if item is likely to expire before selling out from view
 */
export const isLikelyToExpire = (item: ExpiringSoonItem): boolean => {
  return (item as any).likely_to_expire === true
}

/**
 * Get suggested action from view
 */
export const getSuggestedAction = (item: ExpiringSoonItem): string => {
  return (item as any).suggested_action || 'No action needed'
}

/**
 * Format suggested action for display
 */
export const formatSuggestedAction = (action: string): string => {
  // Clean up the action text for better display
  return action.replace(/^(URGENT:|REMOVE FROM STOCK -)/i, '').trim()
}

/**
 * Get discount percentage from settings
 */
export const getDiscountPercentage = (
  companySettings: CompanySettings | null,
): number => {
  return companySettings?.near_expiry_discount_percentage || 0
}

/**
 * Calculate discounted price
 */
export const calculateDiscountedPrice = (
  originalPrice: number,
  companySettings: CompanySettings | null,
): number => {
  const discountPercentage = getDiscountPercentage(companySettings)
  return originalPrice * (1 - discountPercentage / 100)
}

/**
 * Format days until expiry display
 */
export const formatDaysUntilExpiry = (days: number): string => {
  if (days < 0) return 'Expired'
  if (days === 0) return 'Today'
  if (days === 1) return '1 day'
  if (days <= 7) return `${days} days`
  if (days <= 30) return `${Math.ceil(days / 7)} weeks`
  if (days <= 90) return `${Math.ceil(days / 30)} months`
  return `${days} days`
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
 * Get expiry status badge variant
 */
export const getExpiryStatusBadgeVariant = (
  status: string,
): 'filled' | 'light' | 'dot' => {
  if (status === 'EXPIRED' || status === 'CRITICAL') return 'filled'
  return 'dot'
}

