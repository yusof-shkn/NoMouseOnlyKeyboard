// handlers/purchaseOrdersHistoryHandlers.ts - CLEANED: Removed partial_received/partial_paid

import { notifications } from '@mantine/notifications'
import { AppDispatch } from '@app/core/store/store'
import { fetchPurchaseOrdersData } from '../utils/purchaseOrdersHistoryUtils'
import { PurchaseOrder } from '@shared/types/purchaseOrders'
import type { CompanySettings } from '@shared/types/companySettings'
import { exportToPDF } from '@app/core/exports/PdfExporter'
import { exportToExcel } from '@app/core/exports/CsvExporter'
import { Role } from '@shared/constants/roles'

import {
  deletePurchaseOrder,
  approvePurchaseOrder,
  cancelPurchaseOrder,
  checkPurchaseReturnEligibility,
  submitPurchaseOrder,
  rejectPurchaseOrder,
  receiveAllGoodsFromPO,
  markPurchaseOrderAsPaid,
  getPOPaymentHistory,
  getSupplierCreditInfo,
} from '../data/purchaseOrderHIstory.Queries'

import { getCurrentUserRoleId, getCurrentUserId } from '@shared/utils/authUtils'
import {
  isPurchaseApprovalRequired,
  canDeletePurchaseOrder,
  canCancelPurchaseOrder,
  canApprovePurchaseOrder,
  arePurchaseReturnsAllowed,
} from '../utils/companySettingsUtils'
import { selectStore } from '@features/main/main.slice'
import supabase from '@app/core/supabase/Supabase.utils'
import { openModal } from '@shared/components/genericModal/SliceGenericModal'

export interface PurchaseOrdersStats {
  total: number
  draft: number
  pending: number
  approved: number
  rejected: number
  received: number
  cancelled: number
  completed: number
  totalAmount: number
  totalPaid: number
  totalDue: number
  unpaid: number
  paid: number
  overdue: number
}

export interface PaymentData {
  amount: number
  paymentMethod: string
  notes: string
}

// ========== EXPORT HANDLERS ==========

export const handleExportPDF = (columns: any[], data: PurchaseOrder[]) => {
  try {
    if (!data || data.length === 0) {
      notifications.show({
        title: 'No Data Available',
        message: 'There is no data to export to PDF',
        color: 'yellow',
      })
      return
    }

    exportToPDF({
      columns,
      data,
      fileName: 'purchase_orders_history',
      title: 'Purchase Orders History Report',
      orientation: 'landscape',
      includeDate: true,
    })

    notifications.show({
      title: 'Export Successful',
      message: 'PDF has been exported successfully',
      color: 'green',
    })
  } catch (error) {
    console.error('Failed to export PDF:', error)
    notifications.show({
      title: 'Export Failed',
      message: 'Failed to export PDF. Please try again.',
      color: 'red',
    })
  }
}

export const handleExportExcel = (columns: any[], data: PurchaseOrder[]) => {
  try {
    if (!data || data.length === 0) {
      notifications.show({
        title: 'No Data Available',
        message: 'There is no data to export to Excel',
        color: 'yellow',
      })
      return
    }

    exportToExcel({
      columns,
      data,
      fileName: 'purchase_orders_history',
      sheetName: 'Purchase Orders',
      title: 'Purchase Orders History Report',
      includeMetadata: true,
    })

    notifications.show({
      title: 'Export Successful',
      message: 'Excel file has been exported successfully',
      color: 'green',
    })
  } catch (error) {
    console.error('Failed to export Excel:', error)
    notifications.show({
      title: 'Export Failed',
      message: 'Failed to export Excel. Please try again.',
      color: 'red',
    })
  }
}

// ========== REFRESH HANDLER ==========

export const handleRefresh = async (
  setPurchaseOrders: React.Dispatch<React.SetStateAction<PurchaseOrder[]>>,
  setSuppliers: React.Dispatch<React.SetStateAction<any[]>>,
  setStores: React.Dispatch<React.SetStateAction<any[]>>,
  setStats: React.Dispatch<React.SetStateAction<PurchaseOrdersStats>>,
  setLoading: React.Dispatch<React.SetStateAction<boolean>>,
  setTotalCount: React.Dispatch<React.SetStateAction<number>>,
  companyId: number,
  settings: CompanySettings | null,
) => {
  try {
    setLoading(true)
    const { purchaseOrdersData, suppliersData, storesData, totalCount } =
      await fetchPurchaseOrdersData({ companyId }, settings)

    setPurchaseOrders(purchaseOrdersData)
    setSuppliers(suppliersData)
    setStores(storesData)
    setTotalCount(totalCount)

    notifications.show({
      title: 'Refreshed',
      message: 'Purchase orders list updated',
      color: 'blue',
    })
  } catch {
    // Error handled in fetchPurchaseOrdersData
  } finally {
    setLoading(false)
  }
}

// ========== VIEW HANDLER ==========

export const handleView = (row: any) => {
  console.log('View purchase order:', row)
  notifications.show({
    title: 'View Details',
    message: `Viewing PO: ${row.po_number}`,
    color: 'blue',
  })
}

// ========== SUBMIT HANDLER ==========

export const handleSubmit = async (
  row: any,
  fetchPurchaseOrders: () => Promise<void>,
  settings: CompanySettings | null,
) => {
  try {
    if (row.status !== 'draft') {
      notifications.show({
        title: 'Cannot Submit',
        message: 'Only draft purchase orders can be submitted',
        color: 'orange',
      })
      return
    }

    if (!settings?.require_purchase_approval) {
      notifications.show({
        title: 'No Approval Required',
        message: 'Purchase orders are auto-approved for your company',
        color: 'blue',
      })
      return
    }

    if (!confirm(`Submit purchase order ${row.po_number} for approval?`)) {
      return
    }

    notifications.show({
      id: 'submitting-po',
      title: 'Submitting...',
      message: 'Please wait',
      loading: true,
      autoClose: false,
    })

    const { error } = await submitPurchaseOrder(row.id)

    notifications.hide('submitting-po')

    if (error) {
      throw error
    }

    await fetchPurchaseOrders()

    notifications.show({
      title: 'Success',
      message: `Purchase order ${row.po_number} submitted for approval`,
      color: 'green',
    })
  } catch (error: any) {
    console.error('Error submitting purchase order:', error)
    notifications.hide('submitting-po')
    notifications.show({
      title: 'Submission Failed',
      message: error.message || 'Failed to submit purchase order',
      color: 'red',
    })
  }
}

// ========== REJECT HANDLER ==========

export const handleReject = async (
  row: any,
  fetchPurchaseOrders: () => Promise<void>,
  settings: CompanySettings | null,
) => {
  try {
    if (row.status !== 'pending') {
      notifications.show({
        title: 'Cannot Reject',
        message: 'Only pending purchase orders can be rejected',
        color: 'orange',
      })
      return
    }

    const userId = await getCurrentUserId()
    if (!userId) {
      notifications.show({
        title: 'Authentication Error',
        message: 'User not authenticated',
        color: 'red',
      })
      return
    }

    const reason = prompt('Please enter rejection reason:')
    if (!reason || reason.trim() === '') {
      notifications.show({
        title: 'Rejection Aborted',
        message: 'Rejection reason is required',
        color: 'yellow',
      })
      return
    }

    notifications.show({
      id: 'rejecting-po',
      title: 'Rejecting...',
      message: 'Please wait',
      loading: true,
      autoClose: false,
    })

    const { error } = await rejectPurchaseOrder(row.id, userId, reason.trim())

    notifications.hide('rejecting-po')

    if (error) {
      throw error
    }

    await fetchPurchaseOrders()

    notifications.show({
      title: 'Success',
      message: `Purchase order ${row.po_number} rejected`,
      color: 'orange',
    })
  } catch (error: any) {
    console.error('Error rejecting purchase order:', error)
    notifications.hide('rejecting-po')
    notifications.show({
      title: 'Rejection Failed',
      message: error.message || 'Failed to reject purchase order',
      color: 'red',
    })
  }
}

// ========== RECEIVE GOODS HANDLER ==========
export const handleReceiveGoods = async (
  row: any,
  fetchPurchaseOrders: () => Promise<void>,
  dispatch: AppDispatch,
  currency: string = 'UGX',
) => {
  if (row.status !== 'approved') {
    notifications.show({
      title: 'Cannot Receive',
      message: 'Only approved purchase orders can be received',
      color: 'orange',
    })
    return
  }

  const userId = await getCurrentUserId()
  if (!userId) {
    notifications.show({
      title: 'Authentication Error',
      message: 'User not authenticated',
      color: 'red',
    })
    return
  }

  dispatch(
    openModal({
      type: 'receive-goods',
      size: 'lg',
      props: {
        purchaseOrderId: row.id,
        poNumber: row.po_number,
        supplierName: row.supplier_name,
        supplierId: row.supplier_id,
        storeId: row.store_id,
        storeName: row.store_name,
        companyId: row.company_id,
        totalAmount: parseFloat(row.total_amount || 0),
        currency,
        itemCount: row.items_count ?? undefined,
      },
    }),
  )
}

// ========== MARK AS PAID CONFIRM (called from RecordPurchasePaymentForm) ==========

export const handleMarkAsPaidConfirm = async (
  purchaseOrderData: any,
  paymentData: PaymentData,
  fetchPurchaseOrders: () => void,
) => {
  try {
    const userId = await getCurrentUserId()
    if (!userId) {
      notifications.show({
        title: 'Authentication Error',
        message: 'User not authenticated',
        color: 'red',
      })
      return
    }

    notifications.show({
      id: 'marking-paid',
      title: 'Processing Payment...',
      message: 'Please wait while we record your payment',
      loading: true,
      autoClose: false,
    })

    const { error } = await markPurchaseOrderAsPaid(
      purchaseOrderData.id,
      paymentData.amount,
      userId,
      purchaseOrderData.supplier_id,
      paymentData.paymentMethod,
      paymentData.notes || undefined,
    )

    notifications.hide('marking-paid')

    if (error) {
      throw error
    }

    await fetchPurchaseOrders()

    const newPaidAmount = purchaseOrderData.paid_amount + paymentData.amount
    const newDueAmount = purchaseOrderData.total_amount - newPaidAmount
    const newStatus = newDueAmount <= 0.01 ? 'fully paid' : 'unpaid'

    notifications.show({
      title: 'Payment Recorded',
      message: `Payment of UGX ${paymentData.amount.toLocaleString()} recorded successfully. PO ${purchaseOrderData.po_number} is now ${newStatus}.`,
      color: 'green',
      autoClose: 6000,
    })
  } catch (error: any) {
    console.error('❌ Error marking as paid:', error)
    notifications.hide('marking-paid')
    notifications.show({
      title: 'Payment Failed',
      message: error.message || 'Failed to record payment. Please try again.',
      color: 'red',
      autoClose: 5000,
    })
  }
}

// ========== CANCEL HANDLER ==========

export const handleCancel = async (
  row: any,
  fetchPurchaseOrders: () => Promise<void>,
) => {
  try {
    const validation = canCancelPurchaseOrder(row.status)

    if (!validation.canCancel) {
      notifications.show({
        title: 'Cannot Cancel',
        message: validation.reason || 'Purchase order cannot be cancelled',
        color: 'orange',
      })
      return
    }

    const userId = await getCurrentUserId()
    if (!userId) {
      notifications.show({
        title: 'Authentication Error',
        message: 'User not authenticated',
        color: 'red',
      })
      return
    }

    const reason = prompt('Please enter cancellation reason:')
    if (!reason || reason.trim() === '') {
      notifications.show({
        title: 'Cancellation Aborted',
        message: 'Cancellation reason is required',
        color: 'yellow',
      })
      return
    }

    notifications.show({
      id: 'cancelling-po',
      title: 'Cancelling...',
      message: 'Please wait',
      loading: true,
      autoClose: false,
    })

    const { error } = await cancelPurchaseOrder(
      row.id,
      userId,
      reason.trim(),
      row.status,
    )

    notifications.hide('cancelling-po')

    if (error) {
      throw error
    }

    await fetchPurchaseOrders()

    notifications.show({
      title: 'Success',
      message: `Purchase order ${row.po_number} cancelled`,
      color: 'green',
    })
  } catch (error: any) {
    console.error('Error cancelling purchase order:', error)
    notifications.hide('cancelling-po')
    notifications.show({
      title: 'Cancellation Failed',
      message: error.message || 'Failed to cancel purchase order',
      color: 'red',
    })
  }
}

// ========== DELETE HANDLER ==========

export const handleDelete = async (
  row: any,
  fetchPurchaseOrders: () => Promise<void>,
  settings: CompanySettings | null,
) => {
  try {
    const userRoleId = await getCurrentUserRoleId()
    if (userRoleId !== Role.company_admin) {
      notifications.show({
        title: 'Permission Denied',
        message: 'You do not have permission to delete purchase orders.',
        color: 'red',
      })
      return
    }

    const validation = canDeletePurchaseOrder(row.status, settings)

    if (!validation.canDelete) {
      notifications.show({
        title: 'Cannot Delete',
        message: validation.reason || 'Purchase order cannot be deleted',
        color: 'orange',
      })
      return
    }

    if (
      !confirm(
        `Are you sure you want to delete purchase order ${row.po_number}? This action cannot be undone.`,
      )
    ) {
      return
    }

    notifications.show({
      id: 'deleting-po',
      title: 'Deleting...',
      message: 'Please wait',
      loading: true,
      autoClose: false,
    })

    const { error } = await deletePurchaseOrder(row.id, row.status)

    notifications.hide('deleting-po')

    if (error) {
      throw error
    }

    await fetchPurchaseOrders()

    notifications.show({
      title: 'Success',
      message: `Purchase order ${row.po_number} deleted`,
      color: 'green',
    })
  } catch (error: any) {
    console.error('Error deleting purchase order:', error)
    notifications.hide('deleting-po')
    notifications.show({
      title: 'Deletion Failed',
      message: error.message || 'Failed to delete purchase order',
      color: 'red',
    })
  }
}

// ========== VIEW PAYMENT HISTORY ==========

export const handleViewPaymentHistory = async (row: any, currency: string) => {
  try {
    notifications.show({
      id: 'loading-payments',
      title: 'Loading...',
      message: 'Fetching payment history',
      loading: true,
      autoClose: false,
    })

    const { data: payments, error } = await getPOPaymentHistory(row.id)

    notifications.hide('loading-payments')

    if (error) {
      throw error
    }

    if (!payments || payments.length === 0) {
      notifications.show({
        title: 'No Payments',
        message: `No payment records found for PO ${row.po_number}`,
        color: 'blue',
      })
      return
    }

    const paymentList = payments
      .map((p: any, i: number) => {
        const date = new Date(p.transaction_date).toLocaleDateString()
        const amount = parseFloat(p.amount).toLocaleString()
        return `${i + 1}. ${date} - ${currency} ${amount} (${p.payment_method})`
      })
      .join('\n')

    alert(
      `Payment History for PO ${row.po_number}\n` +
        `Supplier: ${row.supplier_name}\n\n` +
        `Total: ${currency} ${parseFloat(String(row.total_amount)).toLocaleString()}\n` +
        `Paid: ${currency} ${parseFloat(String(row.paid_amount || 0)).toLocaleString()}\n` +
        `Due: ${currency} ${parseFloat(String(row.total_amount - (row.paid_amount || 0))).toLocaleString()}\n\n` +
        `Payments:\n${paymentList}`,
    )
  } catch (error: any) {
    console.error('Error loading payment history:', error)
    notifications.hide('loading-payments')
    notifications.show({
      title: 'Error',
      message: error.message || 'Failed to load payment history',
      color: 'red',
    })
  }
}

// ========== RETURN HANDLER ==========

export const handleCheckReturnEligibility = async (
  row: any,
  settings: CompanySettings | null,
  dispatch: AppDispatch,
) => {
  try {
    if (!row.company_id) {
      notifications.show({
        title: 'Invalid Purchase Order',
        message:
          'This purchase order has no company assigned. Please contact support.',
        color: 'red',
      })
      return
    }

    if (!settings?.allow_purchase_returns) {
      notifications.show({
        title: 'Returns Not Allowed',
        message: 'Purchase returns are not enabled for your company.',
        color: 'orange',
      })
      return
    }

    if (row.status !== 'received') {
      notifications.show({
        title: 'Cannot Return',
        message: `Only received purchase orders can be returned. Current status: ${row.status}`,
        color: 'orange',
      })
      return
    }

    if (!row.received_at) {
      notifications.show({
        title: 'Invalid Purchase Order',
        message:
          'This purchase order has no receipt date. Cannot process return.',
        color: 'red',
      })
      return
    }

    if (!row.supplier_id) {
      notifications.show({
        title: 'Invalid Purchase Order',
        message: 'This purchase order has no supplier assigned.',
        color: 'red',
      })
      return
    }

    if (!row.store_id) {
      notifications.show({
        title: 'Invalid Purchase Order',
        message: 'This purchase order has no store assigned.',
        color: 'red',
      })
      return
    }

    const result = await checkPurchaseReturnEligibility(
      row.id,
      row.company_id,
      settings,
    )

    if (!result.eligible) {
      notifications.show({
        title: '❌ Not Eligible for Return',
        message: result.reason || 'This purchase order cannot be returned',
        color: 'red',
      })
      return
    }

    dispatch(
      openModal({
        type: 'create-purchase-return',
        size: 'xl',
        props: {
          companyId: row.company_id,
          storeId: row.store_id,
          settings: settings,
          prefilledData: {
            purchaseOrderId: row.id,
            poNumber: row.po_number,
            supplierId: row.supplier_id,
            supplierName: row.supplier_name,
            storeId: row.store_id,
            storeName: row.store_name,
            receivedDate: row.received_at,
          },
        },
      }),
    )
  } catch (error: any) {
    console.error('❌ Error checking return eligibility:', error)
    notifications.show({
      title: 'Error',
      message: error.message || 'Failed to check return eligibility',
      color: 'red',
    })
  }
}

export const handleCreateReturn = async (row: any, navigate: any) => {
  try {
    if (!row.received_at) {
      notifications.show({
        title: 'Cannot Create Return',
        message: 'This purchase order has no receipt date',
        color: 'red',
      })
      return
    }

    if (row.status !== 'received') {
      notifications.show({
        title: 'Cannot Create Return',
        message: 'Only received purchase orders can be returned',
        color: 'orange',
      })
      return
    }

    navigate('/purchases/returns/create', {
      state: {
        purchaseOrder: {
          id: row.id,
          po_number: row.po_number,
          supplier_id: row.supplier_id,
          supplier_name: row.supplier_name,
          store_id: row.store_id,
          store_name: row.store_name,
          received_at: row.received_at,
          total_amount: row.total_amount,
        },
      },
    })

    notifications.show({
      title: 'Opening Return Form',
      message: `Creating return for PO ${row.po_number}`,
      color: 'blue',
    })
  } catch (error: any) {
    console.error('Error creating return:', error)
    notifications.show({
      title: 'Error',
      message: error.message || 'Failed to open return form',
      color: 'red',
    })
  }
}

// ========== APPROVE HANDLER ==========

export const handleApprove = async (
  row: any,
  fetchPurchaseOrders: () => Promise<void>,
  settings: CompanySettings | null,
) => {
  try {
    const requiresApproval = settings?.require_purchase_approval === true

    if (!requiresApproval) {
      if (row.status !== 'draft') {
        notifications.show({
          title: 'Cannot Finalize',
          message: `Only draft purchase orders can be finalized. Current status: ${row.status}`,
          color: 'orange',
        })
        return
      }
    } else {
      if (row.status !== 'pending' && row.status !== 'draft') {
        notifications.show({
          title: 'Cannot Approve',
          message: `Only pending or draft purchase orders can be approved. Current status: ${row.status}`,
          color: 'orange',
        })
        return
      }
    }

    const userId = await getCurrentUserId()
    if (!userId) {
      notifications.show({
        title: 'Authentication Error',
        message: 'User not authenticated. Please log in again.',
        color: 'red',
      })
      return
    }

    const creditInfo = await getSupplierCreditInfo(row.supplier_id)

    if (
      creditInfo.data &&
      creditInfo.data.available_credit < row.total_amount
    ) {
      const shortage = row.total_amount - creditInfo.data.available_credit
      const confirmApproval = confirm(
        `⚠️ CREDIT LIMIT WARNING\n\n` +
          `Supplier: ${row.supplier_name}\n` +
          `Credit Limit: ${creditInfo.data.credit_limit.toLocaleString()} UGX\n` +
          `Current Balance: ${creditInfo.data.current_balance.toLocaleString()} UGX\n` +
          `Available Credit: ${creditInfo.data.available_credit.toLocaleString()} UGX\n\n` +
          `This PO Amount: ${row.total_amount.toLocaleString()} UGX\n` +
          `Credit Shortage: ${shortage.toLocaleString()} UGX\n\n` +
          `Approving this PO will exceed the supplier's credit limit.\n\n` +
          `Do you want to proceed anyway?`,
      )
      if (!confirmApproval) return
    }

    const confirmMessage = requiresApproval
      ? `Are you sure you want to approve purchase order ${row.po_number}?`
      : `Are you sure you want to finalize purchase order ${row.po_number}?`

    if (!confirm(confirmMessage)) return

    notifications.show({
      id: 'approving-po',
      title: requiresApproval ? 'Approving...' : 'Finalizing...',
      message: 'Please wait',
      loading: true,
      autoClose: false,
    })

    const { data, error } = await approvePurchaseOrder(
      row.id,
      userId,
      row.company_id,
      settings,
    )

    notifications.hide('approving-po')

    if (error) throw error

    await fetchPurchaseOrders()

    notifications.show({
      title: 'Success',
      message: requiresApproval
        ? `Purchase order ${row.po_number} approved successfully`
        : `Purchase order ${row.po_number} finalized successfully`,
      color: 'green',
    })
  } catch (error: any) {
    console.error('Error approving purchase order:', error)
    notifications.hide('approving-po')
    notifications.show({
      title: 'Operation Failed',
      message: error.message || 'Failed to process purchase order',
      color: 'red',
    })
  }
}

// ========== EDIT HANDLER ==========

export const handleEdit = async (
  row: any,
  dispatch: AppDispatch,
  settings: CompanySettings | null,
  navigate: any,
  currentStoreId: number | null,
  isAdmin: boolean,
) => {
  try {
    if (row.status === 'received' || row.status === 'cancelled') {
      notifications.show({
        title: 'Cannot Edit',
        message: `Cannot edit ${row.status} purchase orders`,
        color: 'orange',
      })
      return
    }

    if (row.status === 'approved' && isPurchaseApprovalRequired(settings)) {
      notifications.show({
        title: 'Cannot Edit',
        message:
          'Approved purchase orders cannot be edited. Please cancel and create a new one.',
        color: 'orange',
      })
      return
    }

    const poStoreId = row.store_id
    const poStoreName = row.store_name

    if (!poStoreId) {
      notifications.show({
        title: 'Invalid Purchase Order',
        message: 'This purchase order has no store assigned. Cannot edit.',
        color: 'red',
        autoClose: 6000,
      })
      return
    }

    const { data: storeCheck, error: storeError } = await supabase
      .from('stores')
      .select('*')
      .eq('id', poStoreId)
      .is('deleted_at', null)
      .maybeSingle()

    if (storeError) {
      notifications.show({
        title: 'Database Error',
        message: `Failed to validate store: ${storeError.message}`,
        color: 'red',
        autoClose: 6000,
      })
      return
    }

    if (!storeCheck) {
      notifications.show({
        title: 'Store Not Found',
        message: `The store for this purchase order no longer exists or has been deleted.`,
        color: 'red',
        autoClose: 6000,
      })
      return
    }

    if (!storeCheck.is_active) {
      notifications.show({
        title: 'Store Inactive',
        message: `The store "${poStoreName}" is currently inactive. Cannot edit this purchase order.`,
        color: 'orange',
        autoClose: 6000,
      })
      return
    }

    if (!isAdmin && !currentStoreId) {
      notifications.show({
        title: 'No Store Selected',
        message: 'Please select a store before editing purchase orders',
        color: 'orange',
      })
      return
    }

    if (!isAdmin && currentStoreId !== poStoreId) {
      notifications.show({
        title: 'Access Denied',
        message: `You don't have access to edit purchase orders from ${poStoreName}.`,
        color: 'red',
        autoClose: 6000,
      })
      return
    }

    if (isAdmin && currentStoreId && currentStoreId !== poStoreId) {
      const { data: currentStore } = await supabase
        .from('stores')
        .select('store_name')
        .eq('id', currentStoreId)
        .maybeSingle()

      const confirmSwitch = confirm(
        `This purchase order belongs to "${poStoreName}".\n\n` +
          `You are currently working in "${currentStore?.store_name || 'Unknown Store'}".\n\n` +
          `The store context will be switched to edit this order. Continue?`,
      )

      if (!confirmSwitch) return

      dispatch(selectStore(storeCheck))

      notifications.show({
        title: 'Store Context Switched',
        message: `Now working in: ${poStoreName}`,
        color: 'blue',
        icon: '🏪',
      })
    }

    navigate('/purchases/pop', {
      state: {
        editMode: true,
        purchaseOrderId: row.id,
        purchaseOrderData: {
          id: row.id,
          company_id: row.company_id,
          store_id: row.store_id,
          supplier_id: row.supplier_id,
          po_number: row.po_number,
          po_date: row.po_date,
          expected_delivery_date: row.expected_delivery_date,
          status: row.status,
          subtotal: row.subtotal,
          tax_amount: row.tax_amount,
          discount_amount: row.discount_amount,
          total_amount: row.total_amount,
          payment_terms: row.payment_terms,
          // ✅ FIXED: pass payment_method so PurchasePOP can pre-select it
          payment_method: row.payment_method ?? 'cash',
          notes: row.notes,
          supplier_name: row.supplier_name,
          store_name: row.store_name,
        },
      },
    })

    notifications.show({
      title: 'Loading Purchase Order',
      message: `Opening PO ${row.po_number} for editing...`,
      color: 'blue',
    })
  } catch (error: any) {
    console.error('❌ Error preparing edit:', error)
    notifications.show({
      title: 'Error',
      message: error.message || 'Failed to open purchase order for editing',
      color: 'red',
      autoClose: 6000,
    })
  }
}

// ========== MARK AS PAID HANDLER ==========

export const handleMarkAsPaid = (row: any, dispatch: AppDispatch) => {
  if (row.status !== 'received') {
    notifications.show({
      title: 'Cannot Mark as Paid',
      message: `Only received purchase orders can be marked as paid. Current status: ${row.status}`,
      color: 'orange',
    })
    return
  }

  if (row.payment_status === 'paid') {
    notifications.show({
      title: 'Already Paid',
      message: 'This purchase order is already fully paid',
      color: 'blue',
    })
    return
  }

  if (!row.supplier_id) {
    notifications.show({
      title: 'Invalid Purchase Order',
      message: 'This purchase order has no supplier assigned',
      color: 'red',
    })
    return
  }

  const totalAmount = parseFloat(row.total_amount || 0)
  const currentPaidAmount = parseFloat(row.paid_amount || 0)
  const amountDue = Math.max(0, totalAmount - currentPaidAmount)

  if (totalAmount <= 0) {
    notifications.show({
      title: 'Invalid Total Amount',
      message: 'This purchase order has an invalid total amount',
      color: 'red',
    })
    return
  }

  if (amountDue <= 0) {
    notifications.show({
      title: 'No Amount Due',
      message: 'This purchase order has no outstanding balance',
      color: 'blue',
    })
    return
  }

  dispatch(
    openModal({
      type: 'payment-record',
      size: 'lg',
      props: {
        purchaseOrderId: row.id,
        poNumber: row.po_number,
        supplierName: row.supplier_name,
        supplierId: row.supplier_id,
        totalAmount,
        paidAmount: currentPaidAmount,
        dueAmount: amountDue,
        // ✅ FIXED: pass the payment method used when the PO was created
        //           so the form can pre-select it (user can still change it)
        defaultPaymentMethod: row.payment_method ?? 'cash',
      },
    }),
  )
}

// ========== SUPPLIER RATING ==========

export const submitSupplierRating = async (ratingData: {
  purchaseOrderId: number
  supplierId: number
  overallRating: number
  productQuality: number | null
  deliverySpeed: number | null
  packaging: number | null
  communication: number | null
  comments: string | null
}) => {
  try {
    const userId = await getCurrentUserId()
    if (!userId) throw new Error('User not authenticated')

    const ratingInsertData: any = {
      purchase_order_id: ratingData.purchaseOrderId,
      supplier_id: ratingData.supplierId,
      rated_by: userId,
      overall_rating: ratingData.overallRating,
      rated_at: new Date().toISOString(),
    }

    if (ratingData.productQuality && ratingData.productQuality > 0)
      ratingInsertData.product_quality = ratingData.productQuality
    if (ratingData.deliverySpeed && ratingData.deliverySpeed > 0)
      ratingInsertData.delivery_speed = ratingData.deliverySpeed
    if (ratingData.packaging && ratingData.packaging > 0)
      ratingInsertData.packaging = ratingData.packaging
    if (ratingData.communication && ratingData.communication > 0)
      ratingInsertData.communication = ratingData.communication
    if (ratingData.comments && ratingData.comments.trim())
      ratingInsertData.comments = ratingData.comments.trim()

    const { data: ratingRecord, error: ratingError } = await supabase
      .from('supplier_ratings')
      .insert(ratingInsertData)
      .select()
      .single()

    if (ratingError) throw ratingError

    const { data: supplierRatings, error: fetchError } = await supabase
      .from('supplier_ratings')
      .select('overall_rating')
      .eq('supplier_id', ratingData.supplierId)

    if (fetchError) throw fetchError

    const totalRatings = supplierRatings.length
    const sumRatings = supplierRatings.reduce(
      (sum, r) => sum + r.overall_rating,
      0,
    )
    const newAverageRating = Math.round((sumRatings / totalRatings) * 10) / 10

    const { error: updateError } = await supabase
      .from('suppliers')
      .update({
        rating: newAverageRating,
        total_ratings: totalRatings,
        updated_at: new Date().toISOString(),
      })
      .eq('id', ratingData.supplierId)

    if (updateError) throw updateError

    return { success: true, newRating: newAverageRating }
  } catch (error: any) {
    console.error('❌ Error submitting supplier rating:', error)
    throw error
  }
}

