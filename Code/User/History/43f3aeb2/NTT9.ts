// src/pages/SalesReturns/utils/salesReturn.utils.ts

import { notifications } from '@mantine/notifications'
import { CompanySettings } from '@shared/types/companySettings'
import {
  SalesReturn,
  SalesReturnItem,
  SalesReturnFilters,
  SalesReturnStats,
  FetchSalesReturnsResult,
  ReturnEligibilityResult,
} from '../types/salesReturn.types'
import {
  getSalesReturns,
  getSalesReturnStats,
} from '../data/salesReturn.queries'

// ============================================================================
// ELIGIBILITY HELPERS
// ============================================================================

export const requiresApproval = (
  amount: number,
  settings: CompanySettings,
): boolean => {
  if (!settings.require_return_approval) {
    return false
  }
  return amount >= (settings.return_approval_threshold || 0)
}

export const isWithinReturnWindow = (
  saleDate: string,
  daysLimit: number,
): boolean => {
  const saleDateObj = new Date(saleDate)
  const today = new Date()
  const diffTime = today.getTime() - saleDateObj.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return diffDays <= daysLimit
}

export const getReturnDaysRemaining = (
  saleDate: string,
  daysLimit: number,
): number => {
  const saleDateObj = new Date(saleDate)
  const today = new Date()
  const diffTime = today.getTime() - saleDateObj.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return Math.max(0, daysLimit - diffDays)
}

export const validateReturnEligibility = (
  saleDate: string,
  returnAmount: number,
  settings: CompanySettings,
): ReturnEligibilityResult => {
  try {
    if (!settings.allow_sales_returns) {
      return {
        eligible: false,
        reason: 'Sales returns are currently disabled',
        requiresApproval: true,
      }
    }

    const daysLimit = settings.sales_return_days_limit || 30

    if (!isWithinReturnWindow(saleDate, daysLimit)) {
      return {
        eligible: false,
        reason: `Return window expired. Returns are allowed within ${daysLimit} days of purchase`,
        daysRemaining: 0,
        requiresApproval: true,
      }
    }

    const daysRemaining = getReturnDaysRemaining(saleDate, daysLimit)
    const needsApproval = requiresApproval(returnAmount, settings)

    return {
      eligible: true,
      daysRemaining,
      requiresApproval: needsApproval,
    }
  } catch (error: any) {
    console.error('Error validating return eligibility:', error)
    return {
      eligible: false,
      reason: error.message || 'Error validating return eligibility',
      requiresApproval: true,
    }
  }
}

// ============================================================================
// ENRICH — list rows (sales_return_items only has IDs here, used for count)
// ============================================================================

export const enrichSalesReturns = (salesReturnsData: any[]): SalesReturn[] => {
  return salesReturnsData.map((returnData): SalesReturn => {
    const sale = returnData.sales
    const customer = sale?.customers
    const store = returnData.stores
    const processor = returnData.processor // aliased join

    const customerName = customer
      ? `${customer.first_name || ''} ${customer.last_name || ''}`.trim() ||
        'Walk-in Customer'
      : 'Walk-in Customer'

    const paymentStatus = sale?.payment_status || 'pending'
    const amountPaid = sale?.amount_paid || 0
    const totalAmount = returnData.total_refund_amount || 0
    const amountDue = Math.max(0, totalAmount - amountPaid)

    const rawItems = returnData.sales_return_items
    if (!rawItems || !Array.isArray(rawItems)) {
      console.warn(
        `⚠️ [enrichSalesReturns] No items array for return ${returnData.return_number} (id: ${returnData.id}). Raw value:`,
        rawItems,
      )
    }
    const itemsCount = Array.isArray(rawItems) ? rawItems.length : 0

    return {
      id: returnData.id,
      company_id: returnData.company_id,
      store_id: returnData.store_id,
      sale_id: returnData.sale_id,
      return_number: returnData.return_number,
      return_date: returnData.return_date,
      return_reason: returnData.return_reason,
      total_refund_amount: returnData.total_refund_amount,
      refund_method: returnData.refund_method,
      status: returnData.status,
      notes: returnData.notes,
      processed_by: returnData.processed_by,
      approved_by: returnData.approved_by,
      approved_at: returnData.approved_at,
      created_at: returnData.created_at,
      updated_at: returnData.updated_at,
      deleted_at: returnData.deleted_at,
      customer_name: customerName,
      customer_phone: customer?.phone || undefined,
      store_name: store?.store_name || 'Unknown Store',
      processed_by_name: processor
        ? `${processor.first_name || ''} ${processor.last_name || ''}`.trim() ||
          undefined
        : undefined,
      items_count: itemsCount,
      payment_status: paymentStatus,
      amount_paid: amountPaid,
      amount_due: amountDue,
      sale_date: sale?.sale_date,
      sale_number: sale?.sale_number,
    }
  })
}

// ============================================================================
// ENRICH — detail items (full product + batch data from getSalesReturnItemsById)
// ============================================================================

export const enrichSalesReturnItems = (rawItems: any[]): SalesReturnItem[] => {
  return rawItems.map((item): SalesReturnItem => {
    const product = item.products
    const batch = item.product_batches

    console.log('📦 [enrichSalesReturnItems] processing item:', {
      id: item.id,
      product_id: item.product_id,
      product,
      batch_id: item.batch_id,
      batch,
    })

    return {
      id: item.id,
      sales_return_id: item.sales_return_id,
      sale_item_id: item.sale_item_id,
      product_id: item.product_id,
      batch_id: item.batch_id,
      batch_number: batch?.batch_number || null,
      quantity_returned: item.quantity_returned,
      unit_price: Number(item.unit_price) || 0,
      refund_amount: Number(item.refund_amount) || 0,
      created_at: item.created_at,
      updated_at: item.updated_at,
      // joined
      product_name: product?.product_name || 'Unknown Product',
      product_code: product?.product_code || 'N/A',
      generic_name: product?.generic_name || undefined,
      expiry_date: batch?.expiry_date || undefined,
    }
  })
}

// ============================================================================
// FETCH WRAPPERS
// ============================================================================

export const fetchSalesReturnStats = async (): Promise<SalesReturnStats> => {
  try {
    const { data, error } = await getSalesReturnStats()
    if (error) throw error

    return (
      data || {
        total: 0,
        pending: 0,
        approved: 0,
        completed: 0,
        cancelled: 0,
        totalRefundAmount: 0,
        pendingRefundAmount: 0,
      }
    )
  } catch (error: any) {
    console.error('Error fetching sales return stats:', error)
    notifications.show({
      title: 'Error',
      message: error.message || 'Failed to fetch sales return statistics',
      color: 'red',
    })
    throw error
  }
}

export const fetchSalesReturnsData = async (
  filters: SalesReturnFilters = {},
): Promise<FetchSalesReturnsResult> => {
  const {
    page = 1,
    pageSize = 10,
    searchQuery = '',
    status = 'all',
    paymentStatus = 'all',
    customerId = null,
    storeId = null,
    dateRange,
    sortBy = 'recent',
    isUnlocked = false,
  } = filters

  try {
    const {
      data: salesReturnsData,
      error: salesReturnsError,
      count: totalCount,
    } = await getSalesReturns({
      page,
      pageSize,
      searchQuery,
      status,
      paymentStatus,
      customerId,
      storeId,
      dateRange,
      sortBy,
      isUnlocked,
    })

    if (salesReturnsError) throw salesReturnsError

    const enrichedSalesReturns = enrichSalesReturns(salesReturnsData || [])

    return {
      salesReturnsData: enrichedSalesReturns,
      totalCount: totalCount || 0,
    }
  } catch (error: any) {
    console.error('Error fetching sales returns data:', error)
    notifications.show({
      title: 'Error',
      message: error.message || 'Failed to fetch sales returns data',
      color: 'red',
    })
    throw error
  }
}

// ============================================================================
// FORMATTING HELPERS
// ============================================================================

export const formatCurrency = (
  amount: number,
  currency: string = 'UGX',
): string => {
  return new Intl.NumberFormat('en-UG', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export const getDateRange = (
  filter: 'last_7_days' | 'last_month' | 'all',
): { start: string; end: string } | undefined => {
  const today = new Date()
  const end = today.toISOString().split('T')[0]

  switch (filter) {
    case 'last_7_days': {
      const start = new Date(today)
      start.setDate(today.getDate() - 7)
      return { start: start.toISOString().split('T')[0], end }
    }
    case 'last_month': {
      const start = new Date(today)
      start.setMonth(today.getMonth() - 1)
      return { start: start.toISOString().split('T')[0], end }
    }
    case 'all':
    default:
      return undefined
  }
}

export const getStatusColor = (
  status: string,
): 'blue' | 'green' | 'red' | 'yellow' | 'gray' => {
  switch (status) {
    case 'pending':
      return 'yellow'
    case 'approved':
      return 'blue'
    case 'completed':
      return 'green'
    case 'cancelled':
      return 'red'
    default:
      return 'gray'
  }
}

export const getPaymentStatusColor = (
  status: string,
): 'green' | 'yellow' | 'red' | 'gray' | 'orange' => {
  switch (status) {
    case 'paid':
      return 'green'
    case 'partial':
      return 'yellow'
    case 'pending':
      return 'orange'
    default:
      return 'gray'
  }
}

export const formatStatus = (status: string): string => {
  return status
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

