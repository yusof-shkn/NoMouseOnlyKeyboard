// utils/salesHistory.utils.ts - UPDATED WITH PENDING_RETURN STATUS
import { notifications } from '@mantine/notifications'
import { Sale, SalesStats, CompanySettings } from '../types/salesHistory.types'
import { supabase } from '@app/core/supabase/Supabase.utils'

import {
  getSales,
  getCustomers,
  getSalesStores,
  getUsers,
} from '../data/salesHistory.queries'

// ============== VALIDATION UTILITIES ==============

/**
 * Check if a sale can be returned based on company settings
 * ✅ UPDATED: Now checks for 'pending_return' status
 */
export const canReturnSale = (
  sale: Sale,
  settings: CompanySettings | null,
): {
  allowed: boolean
  reason?: string
} => {
  if (!settings) {
    return {
      allowed: false,
      reason: 'Company settings not loaded',
    }
  }

  // Check if returns are allowed
  if (!settings.allow_sales_returns) {
    return {
      allowed: false,
      reason: 'Sales returns are not allowed by company policy',
    }
  }

  // ✅ NEW: Check if sale has a pending return
  if (sale.sale_status === 'pending_return') {
    return {
      allowed: false,
      reason: 'This sale already has a pending return request',
    }
  }

  // Check if sale is already returned
  if (sale.sale_status === 'returned') {
    return {
      allowed: false,
      reason: 'This sale has already been returned',
    }
  }

  // Check if sale is cancelled
  if (sale.sale_status === 'cancelled') {
    return {
      allowed: false,
      reason: 'Cancelled sales cannot be returned',
    }
  }

  // Only completed sales can be returned
  if (sale.sale_status !== 'completed') {
    return {
      allowed: false,
      reason: 'Only completed sales can be returned',
    }
  }

  // Check return days limit
  if (settings.sales_return_days_limit) {
    const saleDate = new Date(sale.sale_date)
    const today = new Date()
    const daysDifference = Math.floor(
      (today.getTime() - saleDate.getTime()) / (1000 * 60 * 60 * 24),
    )

    if (daysDifference > settings.sales_return_days_limit) {
      return {
        allowed: false,
        reason: `Return period expired. Returns allowed within ${settings.sales_return_days_limit} days`,
      }
    }
  }

  // Check if approval is required for amount
  if (settings.require_return_approval && settings.return_approval_threshold) {
    if (sale.total_amount > settings.return_approval_threshold) {
      return {
        allowed: true,
        reason: `Approval required for returns over ${settings.return_approval_threshold}`,
      }
    }
  }

  return { allowed: true }
}

/**
 * Validate discount on a sale
 */
export const validateDiscount = (
  sale: Sale,
  settings: CompanySettings | null,
): {
  valid: boolean
  warning?: string
} => {
  if (!settings || !sale.discount_percentage) {
    return { valid: true }
  }

  const maxDiscount = settings.max_discount_percentage || 100

  if (sale.discount_percentage > maxDiscount) {
    return {
      valid: false,
      warning: `Discount exceeds maximum allowed (${maxDiscount}%)`,
    }
  }

  if (settings.require_discount_approval) {
    return {
      valid: true,
      warning: 'This discount requires approval',
    }
  }

  return { valid: true }
}

/**
 * Check if a sale can be deleted
 * ✅ UPDATED: Now handles 'pending_return' status
 */
export const canDeleteSale = (
  sale: Sale,
  settings: CompanySettings | null,
): {
  allowed: boolean
  reason?: string
} => {
  if (!settings) {
    return {
      allowed: false,
      reason: 'Company settings not loaded',
    }
  }

  // ✅ NEW: Cannot delete sales with pending returns
  if (sale.sale_status === 'pending_return') {
    return {
      allowed: false,
      reason:
        'Cannot delete sales with pending return requests. Please approve or reject the return first.',
    }
  }

  // Completed sales cannot be deleted without return process
  if (sale.sale_status === 'completed') {
    if (!settings.allow_sales_returns) {
      return {
        allowed: false,
        reason: 'Cannot delete completed sales. Returns are not allowed.',
      }
    }
    return {
      allowed: false,
      reason: 'Cannot delete completed sales. Please process a return instead.',
    }
  }

  // Already returned sales can be deleted for cleanup
  if (sale.sale_status === 'returned') {
    return { allowed: true }
  }

  // Pending and cancelled sales can be deleted
  return { allowed: true }
}

/**
 * Check if credit payment is allowed
 */
export const canUseCreditPayment = (
  settings: CompanySettings | null,
): {
  allowed: boolean
  reason?: string
} => {
  if (!settings) {
    return {
      allowed: false,
      reason: 'Company settings not loaded',
    }
  }

  return { allowed: true }
}

// ============== ENRICHMENT UTILITIES ==============

/**
 * ✅ UPDATED: Check if sale has pending returns
 */
const checkPendingReturns = async (saleIds: number[]) => {
  try {
    const { data, error } = await supabase
      .from('sales_returns')
      .select('sale_id, status, id, return_number')
      .in('sale_id', saleIds)
      .eq('status', 'pending')
      .is('deleted_at', null)

    if (error) {
      console.error('Error checking pending returns:', error)
      return new Map()
    }

    // Create map of sale_id -> return info
    const pendingReturnsMap = new Map()
    data?.forEach((returnRecord) => {
      pendingReturnsMap.set(returnRecord.sale_id, {
        returnId: returnRecord.id,
        returnNumber: returnRecord.return_number,
      })
    })

    return pendingReturnsMap
  } catch (error) {
    console.error('Error in checkPendingReturns:', error)
    return new Map()
  }
}

/**
 * ✅ UPDATED: Enrich sales with pending return status
 */
export const enrichSales = async (
  salesData: any[],
  customersData: any[],
  storesData: any[],
  usersData: any[],
  settings?: CompanySettings | null,
): Promise<Sale[]> => {
  // ✅ Check for pending returns for all sales
  const saleIds = salesData.map((sale) => sale.id)
  const pendingReturnsMap = await checkPendingReturns(saleIds)

  return salesData.map((sale) => {
    // Build customer name
    let customerName = 'Walk-in Customer'
    if (sale.customers) {
      const firstName = sale.customers.first_name || ''
      const lastName = sale.customers.last_name || ''
      customerName =
        `${firstName} ${lastName}`.trim() ||
        sale.customers.customer_code ||
        'Walk-in Customer'
    } else if (sale.customer_id) {
      const customer = customersData.find((c) => c.id === sale.customer_id)
      if (customer) {
        const firstName = customer.first_name || ''
        const lastName = customer.last_name || ''
        customerName =
          `${firstName} ${lastName}`.trim() ||
          customer.customer_code ||
          'Walk-in Customer'
      }
    }

    // Extract store name
    const storeName =
      sale.stores?.store_name ||
      storesData.find((s) => s.id === sale.store_id)?.store_name ||
      'Unknown Store'

    const totalAmount = parseFloat(sale.total_amount || 0)

    // Normalize payment status for credit sales
    let paymentStatus = sale.payment_status
    if (sale.payment_method === 'credit') {
      paymentStatus = 'on_credit'
    }

    // ✅ Check if this sale has a pending return
    const pendingReturn = pendingReturnsMap.get(sale.id)

    const enrichedSale: Sale = {
      ...sale,
      customer_name: customerName,
      store_name: storeName,
      total_amount: totalAmount,
      payment_status: paymentStatus,
      // ✅ Add pending return flag
      has_pending_return: !!pendingReturn,
      pending_return_id: pendingReturn?.returnId,
      pending_return_number: pendingReturn?.returnNumber,
    }

    // Add validation flags if settings provided
    if (settings) {
      const returnCheck = canReturnSale(enrichedSale, settings)
      const discountCheck = validateDiscount(enrichedSale, settings)

      // Store validation results for UI to use
      ;(enrichedSale as any).can_return = returnCheck.allowed
      ;(enrichedSale as any).return_reason = returnCheck.reason
      ;(enrichedSale as any).discount_warning = discountCheck.warning
    }

    return enrichedSale
  })
}

// ============== DATA FETCHING ==============

type FetchSalesParams = {
  page?: number
  pageSize?: number
  searchQuery?: string
  status?: string
  paymentMethod?: string
  customerId?: number
  storeId?: number
  saleType?: string
  dateRange?: any
  settings: CompanySettings | null
  isUnlocked?: boolean
}

export const fetchSalesData = async ({
  page = 1,
  pageSize = 10,
  searchQuery = '',
  status = 'all',
  paymentMethod = 'all',
  customerId,
  storeId,
  saleType,
  dateRange,
  settings,
  isUnlocked = false,
}: FetchSalesParams) => {
  try {
    const {
      data: salesData,
      error: salesError,
      count: totalCount,
    } = await getSales({
      page,
      pageSize,
      searchQuery,
      status,
      paymentMethod,
      customerId,
      storeId,
      saleType,
      dateRange,
      isUnlocked,
    })

    if (salesError) throw salesError

    // Fetch additional data
    const { data: customersData, error: customersError } = await getCustomers()
    if (customersError) throw customersError

    const { data: storesData, error: storesError } = await getSalesStores()
    if (storesError) throw storesError

    const { data: usersData, error: usersError } = await getUsers()
    if (usersError) throw usersError

    // ✅ Enrich sales with pending return checks
    const enrichedSales = await enrichSales(
      salesData || [],
      customersData || [],
      storesData || [],
      usersData || [],
      settings,
    )

    return {
      salesData: enrichedSales,
      customersData: customersData || [],
      storesData: storesData || [],
      usersData: usersData || [],
      totalCount: totalCount || 0,
    }
  } catch (error: any) {
    console.error('Error fetching sales data:', error)
    notifications.show({
      title: 'Error',
      message: error?.message || 'Failed to fetch sales data',
      color: 'red',
    })
    return {
      salesData: [],
      customersData: [],
      storesData: [],
      usersData: [],
      totalCount: 0,
    }
  }
}

// ============== STATISTICS ==============

/**
 * ✅ UPDATED: Now includes pending_return count
 */
export const calculateStats = (salesData: any[]): SalesStats => {
  const pending =
    salesData.filter((sale) => sale.sale_status === 'pending').length || 0
  const completed =
    salesData.filter((sale) => sale.sale_status === 'completed').length || 0
  const cancelled =
    salesData.filter((sale) => sale.sale_status === 'cancelled').length || 0
  const returned =
    salesData.filter((sale) => sale.sale_status === 'returned').length || 0

  // ✅ NEW: Count pending returns
  const pendingReturn =
    salesData.filter((sale) => sale.sale_status === 'pending_return').length ||
    0

  const totalAmount = salesData.reduce(
    (sum, sale) => sum + parseFloat(sale.total_amount || 0),
    0,
  )

  const totalDiscount = salesData.reduce(
    (sum, sale) => sum + parseFloat(sale.discount_amount || 0),
    0,
  )

  const totalTax = salesData.reduce(
    (sum, sale) => sum + parseFloat(sale.tax_amount || 0),
    0,
  )

  return {
    total: salesData.length || 0,
    pending,
    completed,
    cancelled,
    returned,
    pendingReturn, // ✅ NEW: Add pending return count
    totalAmount,
    totalDiscount,
    totalTax,
  }
}

export const getDateRangeFilter = (filter: string) => {
  const today = new Date()
  let start = new Date()

  switch (filter) {
    case 'today':
      start = new Date(today.getFullYear(), today.getMonth(), today.getDate())
      break
    case 'yesterday':
      start = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate() - 1,
      )
      break
    case 'last_7_days':
      start.setDate(today.getDate() - 7)
      break
    case 'last_30_days':
      start.setDate(today.getDate() - 30)
      break
    case 'this_month':
      start = new Date(today.getFullYear(), today.getMonth(), 1)
      break
    case 'last_month':
      start = new Date(today.getFullYear(), today.getMonth() - 1, 1)
      const lastMonth = new Date(today.getFullYear(), today.getMonth(), 0)
      return {
        start: start.toISOString().split('T')[0],
        end: lastMonth.toISOString().split('T')[0],
      }
    case 'this_year':
      start = new Date(today.getFullYear(), 0, 1)
      break
    default:
      return undefined
  }

  return {
    start: start.toISOString().split('T')[0],
    end: today.toISOString().split('T')[0],
  }
}

