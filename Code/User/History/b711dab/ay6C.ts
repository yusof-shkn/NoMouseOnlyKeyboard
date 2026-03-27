// utils/purchaseReturnUtils.ts - UPDATED WITH REDUX

import { notifications } from '@mantine/notifications'
import {
  FetchPurchaseReturnsParams,
  PurchaseReturn,
  PurchaseReturnStats,
  PurchaseReturnSettings,
  ReturnValidationResult,
} from '../types/purchaseReturn.types'

import {
  getPurchaseReturns,
  getSuppliers,
  getStoresPurchaseReturn,
  getReturnablePurchaseOrders,
  getPurchaseReturnStats,
} from '../data/purchaseReturn.queries'

/**
 * Fetch purchase returns data (paginated)
 */
export const fetchPurchaseReturnsData = async ({
  page = 1,
  pageSize = 10,
  searchQuery = '',
  status = 'all',
  paymentStatus = 'all',
  companyId,
  storeId,
  sortBy = 'recently_added',
  dateFrom,
  dateTo,
  isUnlocked = false,
}: FetchPurchaseReturnsParams = {}) => {
  try {
    const {
      data: purchaseReturnsData,
      error: purchaseReturnsError,
      count: totalCount,
    } = await getPurchaseReturns({
      page,
      pageSize,
      searchQuery,
      status,
      paymentStatus,
      companyId,
      storeId,
      sortBy,
      dateFrom,
      dateTo,
      isUnlocked,
    })

    if (purchaseReturnsError) throw purchaseReturnsError

    const { data: suppliersData, error: suppliersError } =
      await getSuppliers(companyId)
    if (suppliersError) throw suppliersError

    const { data: storesData, error: storesError } =
      await getStoresPurchaseReturn(companyId)
    if (storesError) throw storesError

    return {
      purchaseReturnsData: purchaseReturnsData || [],
      suppliersData: suppliersData || [],
      storesData: storesData || [],
      totalCount: totalCount || 0,
    }
  } catch (error: any) {
    console.error('Error fetching purchase returns data:', error)
    notifications.show({
      title: 'Error',
      message: error.message || 'Failed to fetch purchase returns data',
      color: 'red',
    })
    throw error
  }
}

/**
 * Fetch purchase return statistics from database view
 */
export const fetchPurchaseReturnStats = async (companyId: number) => {
  console.log('📊 Fetching stats from database view for company:', companyId)

  const { stats, error } = await getPurchaseReturnStats(companyId)

  if (error) {
    console.error('❌ Error fetching stats:', error)
    throw error
  }

  console.log('✅ Stats fetched successfully:', stats)

  return stats
}

/**
 * ❌ DEPRECATED: Calculate statistics from returns array
 */
export const calculateStats = (
  purchaseReturnsData: PurchaseReturn[],
): PurchaseReturnStats => {
  console.warn(
    '⚠️ DEPRECATED: calculateStats() calculates from paginated data only.',
    'Use fetchPurchaseReturnStats() instead for accurate company-wide statistics.',
  )

  const pending =
    purchaseReturnsData.filter((pr) => pr.status === 'pending').length || 0
  const approved =
    purchaseReturnsData.filter((pr) => pr.status === 'approved').length || 0
  const rejected =
    purchaseReturnsData.filter((pr) => pr.status === 'rejected').length || 0
  const completed =
    purchaseReturnsData.filter((pr) => pr.status === 'completed').length || 0

  const totalRefundAmount = purchaseReturnsData.reduce(
    (sum, pr) => sum + parseFloat(String(pr.total_refund_amount || 0)),
    0,
  )

  const totalPaid = purchaseReturnsData.reduce(
    (sum, pr) => sum + parseFloat(String(pr.paid_amount || 0)),
    0,
  )

  const totalDue = purchaseReturnsData.reduce(
    (sum, pr) => sum + parseFloat(String(pr.due_amount || 0)),
    0,
  )

  const unpaid =
    purchaseReturnsData.filter((pr) => pr.payment_status === 'unpaid').length ||
    0
  const partiallyPaid =
    purchaseReturnsData.filter((pr) => pr.payment_status === 'partially_paid')
      .length || 0
  const paid =
    purchaseReturnsData.filter((pr) => pr.payment_status === 'paid').length || 0
  const overdue =
    purchaseReturnsData.filter((pr) => pr.payment_status === 'overdue')
      .length || 0

  return {
    total: purchaseReturnsData.length || 0,
    pending,
    approved,
    rejected,
    completed,
    totalRefundAmount,
    totalPaid,
    totalDue,
    unpaid,
    partiallyPaid,
    paid,
    overdue,
  }
}

export const validateReturnDateLimit = (
  purchaseDate: string,
  settings: PurchaseReturnSettings,
): ReturnValidationResult => {
  if (!settings.purchase_return_days_limit) {
    return { isValid: true }
  }

  const poDate = new Date(purchaseDate)
  const today = new Date()
  const daysDifference = Math.floor(
    (today.getTime() - poDate.getTime()) / (1000 * 60 * 60 * 24),
  )

  const daysRemaining = settings.purchase_return_days_limit - daysDifference

  if (daysDifference > settings.purchase_return_days_limit) {
    return {
      isValid: false,
      errorMessage: `Cannot create return. Return period of ${settings.purchase_return_days_limit} days has expired. Purchase was made ${daysDifference} days ago.`,
      daysRemaining: 0,
      purchaseDate,
    }
  }

  return {
    isValid: true,
    daysRemaining: Math.max(0, daysRemaining),
    purchaseDate,
  }
}

export const validateReturnItems = (
  returnItems: any[],
  poItems: any[],
): { valid: boolean; errors: string[] } => {
  const errors: string[] = []

  returnItems.forEach((returnItem, index) => {
    const poItem = poItems.find(
      (poi) =>
        poi.product_id === returnItem.product_id &&
        poi.batch_number === returnItem.batch_number,
    )

    if (!poItem) {
      errors.push(
        `Item ${index + 1}: Product/batch not found in original purchase order`,
      )
      return
    }

    if (returnItem.quantity_returned > poItem.quantity_received) {
      errors.push(
        `Item ${index + 1}: Cannot return ${returnItem.quantity_returned} units. Only ${poItem.quantity_received} were received.`,
      )
    }

    if (returnItem.quantity_returned <= 0) {
      errors.push(`Item ${index + 1}: Return quantity must be greater than 0`)
    }

    const costDifference = Math.abs(returnItem.unit_cost - poItem.unit_cost)
    if (costDifference > 0.01) {
      errors.push(
        `Item ${index + 1}: Unit cost mismatch. Expected ${poItem.unit_cost}, got ${returnItem.unit_cost}`,
      )
    }
  })

  return {
    valid: errors.length === 0,
    errors,
  }
}

export const calculateTotalRefund = (items: any[]): number => {
  return items.reduce((sum, item) => {
    const quantity = parseFloat(item.quantity_returned) || 0
    const cost = parseFloat(item.unit_cost) || 0
    return sum + quantity * cost
  }, 0)
}

export const requiresApproval = (
  totalAmount: number,
  settings: PurchaseReturnSettings,
): boolean => {
  if (!settings.require_purchase_return_approval) {
    return false
  }

  if (!settings.return_approval_threshold) {
    return true
  }

  return totalAmount >= settings.return_approval_threshold
}

export const getReturnableItems = async (
  poId: number,
  companyId: number,
  purchaseReturnDaysLimit: number | null,
): Promise<{
  items: any[]
  error: string | null
}> => {
  try {
    const { data: returnablePOs, error } = await getReturnablePurchaseOrders(
      companyId,
      purchaseReturnDaysLimit,
      undefined,
      undefined,
    )

    if (error) throw error

    const po = returnablePOs?.find((p) => p.id === poId)

    if (!po) {
      return {
        items: [],
        error: 'Purchase order not found or not eligible for return',
      }
    }

    const returnableItems = po.purchase_order_items.filter(
      (item: any) => item.quantity_received > 0,
    )

    return {
      items: returnableItems,
      error: null,
    }
  } catch (error: any) {
    return {
      items: [],
      error: error.message || 'Failed to fetch returnable items',
    }
  }
}

export const formatReturnStatus = (status: string): string => {
  const statusMap: Record<string, string> = {
    pending: 'Pending',
    approved: 'Approved',
    rejected: 'Rejected',
    completed: 'Completed',
  }
  return statusMap[status] || status
}

export const formatPaymentStatus = (status: string): string => {
  const statusMap: Record<string, string> = {
    unpaid: 'Unpaid',
    partially_paid: 'Partially Paid',
    paid: 'Paid',
    overdue: 'Overdue',
  }
  return statusMap[status] || status
}

export const getStatusColor = (status: string): string => {
  const colorMap: Record<string, string> = {
    pending: 'yellow',
    approved: 'blue',
    rejected: 'red',
    completed: 'green',
  }
  return colorMap[status] || 'gray'
}

export const getPaymentStatusColor = (status: string): string => {
  const colorMap: Record<string, string> = {
    unpaid: 'red',
    partially_paid: 'yellow',
    paid: 'green',
    overdue: 'orange',
  }
  return colorMap[status] || 'gray'
}

export const formatRefundMethod = (method: string): string => {
  const methodMap: Record<string, string> = {
    cash: 'Cash',
    card: 'Card',
    mobile_money: 'Mobile Money',
    bank_transfer: 'Bank Transfer',
    credit_note: 'Credit Note',
  }
  return methodMap[method] || method
}

export const calculateCreditImpact = (
  returnAmount: number,
  supplier: any,
): {
  currentBalance: number
  newBalance: number
  newAvailableCredit: number
  balanceReduction: number
} => {
  if (!supplier) {
    console.error('❌ calculateCreditImpact: supplier is undefined')
    return {
      currentBalance: 0,
      newBalance: 0,
      newAvailableCredit: 0,
      balanceReduction: 0,
    }
  }

  const currentBalance = parseFloat(supplier.current_balance || 0)
  const creditLimit = parseFloat(supplier.credit_limit || 0)

  const newBalance = Math.max(0, currentBalance - returnAmount)
  const newAvailableCredit = creditLimit - newBalance
  const balanceReduction = currentBalance - newBalance

  return {
    currentBalance,
    newBalance,
    newAvailableCredit,
    balanceReduction,
  }
}

