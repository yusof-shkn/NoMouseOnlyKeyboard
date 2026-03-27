// utils/purchaseOrdersHistoryUtils.ts - UPDATED TO ACCEPT SETTINGS FROM REDUX
import { notifications } from '@mantine/notifications'
import {
  FetchPurchaseOrdersParams,
  PurchaseOrder,
} from '@shared/types/purchaseOrders'
import { CompanySettings } from '@shared/types/companySettings'

import {
  getPurchaseOrders,
  getSuppliers,
  getStoresPurchase,
  getPurchaseOrderStats,
} from '../data/purchaseOrderHIstory.Queries'
import {
  shouldNotifyBackorder,
  getBackorderPriority,
} from './companySettingsUtils'

/**
 * Enrich purchase orders data with calculated fields and validation
 */
export const enrichPurchaseOrders = (
  purchaseOrdersData: any[],
  settings: CompanySettings | null = null,
): PurchaseOrder[] => {
  return purchaseOrdersData.map((po) => {
    const totalAmount = parseFloat(po.total_amount || 0)
    const paidAmount = parseFloat(po.paid_amount || 0)
    const dueAmount = parseFloat(po.due_amount || 0)

    return {
      ...po,
      total_amount: totalAmount,
      paid_amount: paidAmount,
      due_amount: dueAmount,
    }
  })
}

/**
 * Fetch purchase orders data with pagination, filters, and company settings
 * ✅ NOW ACCEPTS SETTINGS AS PARAMETER
 */
export const fetchPurchaseOrdersData = async (
  {
    page = 1,
    pageSize = 10,
    searchQuery = '',
    status = 'all',
    paymentStatus = 'all',
    paymentMethod = 'all',
    companyId,
    storeId,
    storeIds,
    isUnlocked = false,
  }: FetchPurchaseOrdersParams = {},
  settings: CompanySettings | null,
) => {
  try {
    // Fetch paginated purchase orders
    const {
      data: purchaseOrdersData,
      error: purchaseOrdersError,
      count: totalCount,
    } = await getPurchaseOrders({
      page,
      pageSize,
      searchQuery,
      status,
      paymentStatus,
      paymentMethod,
      companyId,
      storeId,
      storeIds,
      isUnlocked,
    })

    if (purchaseOrdersError) throw purchaseOrdersError

    // Fetch suppliers
    const { data: suppliersData, error: suppliersError } =
      await getSuppliers(companyId)
    if (suppliersError) throw suppliersError

    // Fetch stores
    const { data: storesData, error: storesError } =
      await getStoresPurchase(companyId)
    if (storesError) throw storesError

    // Fetch stats from database view (aggregates ALL data, not just current page)
    const { data: statsData, error: statsError } = await getPurchaseOrderStats(
      companyId!,
      storeId,
    )

    if (statsError) {
      console.error('Error fetching PO stats:', statsError)
      // Don't throw - continue with empty stats
    }

    const enrichedPurchaseOrders = enrichPurchaseOrders(
      purchaseOrdersData || [],
      settings,
    )

    return {
      purchaseOrdersData: enrichedPurchaseOrders,
      suppliersData: suppliersData || [],
      storesData: storesData || [],
      totalCount: totalCount || 0,
      stats: statsData,
      settings,
    }
  } catch (error: any) {
    console.error('Error fetching purchase orders data:', error)
    notifications.show({
      title: 'Error',
      message: error.message || 'Failed to fetch purchase orders data',
      color: 'red',
    })
    throw error
  }
}

/**
 * Fetch only statistics (useful for refresh without fetching all data)
 */
export const fetchPurchaseOrderStats = async (
  companyId: number,
  storeId?: number,
) => {
  const { data: statsData } = await getPurchaseOrderStats(companyId, storeId)
  return statsData
}

/**
 * Format purchase order status for display
 */
export const formatPOStatus = (status: string): string => {
  const statusMap: Record<string, string> = {
    draft: 'Draft',
    pending: 'Pending',
    approved: 'Approved',
    rejected: 'Rejected',
    received: 'Received',
    partially_received: 'Partially Received',
    cancelled: 'Cancelled',
    returned: 'Returned',
  }
  return statusMap[status] || status
}

/**
 * Format payment status for display
 */
export const formatPaymentStatus = (status: string): string => {
  const statusMap: Record<string, string> = {
    unpaid: 'Unpaid',
    partially_paid: 'Partially Paid',
    paid: 'Paid',
    overdue: 'Overdue',
  }
  return statusMap[status] || status
}

/**
 * Get status badge color
 */
export const getStatusColor = (status: string): string => {
  const colorMap: Record<string, string> = {
    draft: 'gray',
    pending: 'yellow',
    approved: 'blue',
    rejected: 'red',
    received: 'green',
    partially_received: 'cyan',
    cancelled: 'red',
    returned: 'orange',
  }
  return colorMap[status] || 'gray'
}

/**
 * Get payment status color for badges
 */
export const getPaymentStatusColor = (status: string): string => {
  const colorMap: Record<string, string> = {
    unpaid: 'red',
    partially_paid: 'yellow',
    paid: 'green',
    overdue: 'orange',
  }
  return colorMap[status] || 'gray'
}

/**
 * Get backorder priority color
 */
export const getBackorderPriorityColor = (
  priority: 'high' | 'medium' | 'low',
): string => {
  const colorMap = {
    high: 'red',
    medium: 'orange',
    low: 'blue',
  }
  return colorMap[priority]
}

/**
 * Validate PO data before submission
 */
export const validatePurchaseOrder = (
  poData: any,
  settings: CompanySettings | null,
): { isValid: boolean; errors: string[] } => {
  const errors: string[] = []

  // Basic validation
  if (!poData.supplier_id) {
    errors.push('Supplier is required')
  }

  if (!poData.store_id) {
    errors.push('Store is required')
  }

  if (!poData.po_date) {
    errors.push('PO date is required')
  }

  if (!poData.items || poData.items.length === 0) {
    errors.push('At least one item is required')
  }

  // Validate PO number if manual entry is required
  if (!settings?.auto_increment_documents && !poData.po_number) {
    errors.push('PO number is required')
  }

  // Validate approval status
  if (
    settings?.require_purchase_approval &&
    poData.status === 'approved' &&
    !poData.approved_by
  ) {
    errors.push('Approval is required before setting status to approved')
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
}

