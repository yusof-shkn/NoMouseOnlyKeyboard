// data/purchaseOrderHistory.Queries.ts - CLEANED: Removed partial_received/partial_paid
import { supabase } from '@app/core/supabase/Supabase.utils'
import { PostgrestError } from '@supabase/supabase-js'
import { CompanySettings } from '@shared/types/companySettings'
import {
  generatePONumber,
  canCancelPurchaseOrder,
} from '../utils/companySettingsUtils'
import { store } from '@app/core/store/store'

/**
 * Get current selection from Redux
 */
const getCurrentSelection = () => {
  const state = store.getState()
  return {
    selectedArea: state.areaStore?.selectedArea,
    selectedStore: state.areaStore?.selectedStore,
  }
}

/**
 * Apply area/store filtering to query
 */
const applySelectionFilter = (query: any) => {
  const { selectedArea, selectedStore } = getCurrentSelection()

  if (selectedStore) {
    console.log('🏪 Filtering by selected store:', selectedStore.store_name)
    return query.eq('store_id', selectedStore.id)
  }

  if (selectedArea) {
    console.log('📍 Filtering by selected area:', selectedArea.area_name)
    return query.in(
      'store_id',
      supabase
        .from('stores')
        .select('id')
        .eq('area_id', selectedArea.id)
        .is('deleted_at', null),
    )
  }

  console.log('🌍 No area/store selected - showing all')
  return query
}

interface PurchaseOrderParams {
  page?: number
  pageSize?: number
  searchQuery?: string
  status?: string
  companyId?: number
  storeId?: number
}

interface QueryResult<T> {
  data: T | null
  error: PostgrestError | null
  count?: number | null
}

// ============================================================
// NEW: Invoice metadata passed from ReceiveGoodsForm
// ============================================================
interface InvoiceMeta {
  invoiceNumber: string
  invoiceDate: string // ISO string
  deliveryNotes?: string
}

/**
 * Get purchase orders with pagination and filters
 */
export const getPurchaseOrders = async ({
  page = 1,
  pageSize = 10,
  searchQuery = '',
  status = 'all',
  companyId,
  storeId,
}: PurchaseOrderParams): Promise<QueryResult<any[]> & { count: number }> => {
  try {
    let query = supabase
      .from('vw_purchase_orders_summary')
      .select('*', { count: 'exact' })
      .is('deleted_at', null)

    if (companyId) {
      query = query.eq('company_id', companyId)
    }

    if (!storeId) {
      query = applySelectionFilter(query)
    } else {
      query = query.eq('store_id', storeId)
    }

    if (status !== 'all') {
      query = query.eq('status', status)
    }

    if (searchQuery) {
      query = query.or(
        `po_number.ilike.%${searchQuery}%,supplier_name.ilike.%${searchQuery}%,store_name.ilike.%${searchQuery}%`,
      )
    }

    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    query = query.order('created_at', { ascending: false }).range(from, to)

    const { data, error, count } = await query

    if (error) throw error

    return { data, error: null, count: count || 0 }
  } catch (error: any) {
    console.error('Error fetching purchase orders:', error)
    return { data: null, error, count: 0 }
  }
}

/**
 * Get suppliers
 */
export const getSuppliers = async (
  companyId?: number,
): Promise<QueryResult<any[]>> => {
  try {
    let query = supabase
      .from('suppliers')
      .select('*')
      .is('deleted_at', null)
      .eq('is_active', true)
      .order('supplier_name', { ascending: true })

    if (companyId) {
      query = query.eq('company_id', companyId)
    }

    const { data, error } = await query

    if (error) throw error

    return { data, error: null }
  } catch (error: any) {
    console.error('Error fetching suppliers:', error)
    return { data: null, error }
  }
}

/**
 * Get stores - Filter by selected area from Redux
 */
export const getStoresPurchase = async (
  companyId?: number,
): Promise<QueryResult<any[]>> => {
  try {
    const { selectedArea } = getCurrentSelection()

    let query = supabase
      .from('stores')
      .select('*')
      .is('deleted_at', null)
      .eq('is_active', true)
      .order('store_name', { ascending: true })

    if (companyId) {
      query = query.eq('company_id', companyId)
    }

    if (selectedArea) {
      console.log('📍 Filtering stores by area:', selectedArea.area_name)
      query = query.eq('area_id', selectedArea.id)
    }

    const { data, error } = await query

    if (error) throw error

    return { data, error: null }
  } catch (error: any) {
    console.error('Error fetching stores:', error)
    return { data: null, error }
  }
}

/**
 * Approve a purchase order
 */
export const approvePurchaseOrder = async (
  id: number,
  approvedBy: number,
  companyId: number,
  settings: CompanySettings | null,
): Promise<QueryResult<any>> => {
  try {
    const requiresApproval = settings?.require_purchase_approval === true

    const { data: currentPO, error: fetchError } = await supabase
      .from('purchase_orders')
      .select('status')
      .eq('id', id)
      .single()

    if (fetchError) throw fetchError

    if (requiresApproval) {
      if (currentPO.status !== 'pending' && currentPO.status !== 'draft') {
        throw new Error(
          `Cannot approve purchase order with status: ${currentPO.status}. Only 'draft' or 'pending' purchase orders can be approved.`,
        )
      }
    } else {
      if (currentPO.status !== 'draft') {
        throw new Error(
          `Cannot finalize purchase order with status: ${currentPO.status}. Only 'draft' purchase orders can be finalized.`,
        )
      }
    }

    const { data, error } = await supabase
      .from('purchase_orders')
      .update({
        status: 'approved',
        approved_by: approvedBy,
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return { data, error: null }
  } catch (error: any) {
    console.error('Error approving purchase order:', error)
    return { data: null, error }
  }
}

/**
 * Create a new purchase order with proper status handling
 */
export const createPurchaseOrder = async (
  purchaseOrderData: any,
  companyId: number,
  settings: CompanySettings | null,
): Promise<QueryResult<any>> => {
  try {
    let poNumber = purchaseOrderData.po_number

    if (!poNumber) {
      if (settings?.auto_increment_documents) {
        const generatedPO = await generatePONumber(companyId, settings)
        if (generatedPO) {
          poNumber = generatedPO
        } else {
          throw new Error('Failed to generate PO number')
        }
      } else {
        throw new Error('PO number is required (auto-increment is disabled)')
      }
    }

    let taxAmount = purchaseOrderData.tax_amount
    if (!taxAmount && settings?.tax_rate) {
      taxAmount = (purchaseOrderData.subtotal * settings.tax_rate) / 100
    }

    let initialStatus = purchaseOrderData.status || 'draft'

    if (settings?.require_purchase_approval) {
      if (initialStatus === 'approved' || initialStatus === 'received') {
        initialStatus = 'pending'
      }
    } else {
      if (initialStatus === 'pending') {
        initialStatus = 'approved'
      }
    }

    const paymentTerms =
      purchaseOrderData.payment_terms ||
      (settings?.default_credit_days
        ? `Net ${settings.default_credit_days}`
        : 'Net 30')

    const { data, error } = await supabase
      .from('purchase_orders')
      .insert({
        ...purchaseOrderData,
        po_number: poNumber,
        tax_amount: taxAmount,
        status: initialStatus,
        payment_terms: paymentTerms,
        company_id: companyId,
      })
      .select()
      .single()

    if (error) throw error

    return { data, error: null }
  } catch (error: any) {
    console.error('Error creating purchase order:', error)
    return { data: null, error }
  }
}

/**
 * Submit a draft purchase order for approval
 */
export const submitPurchaseOrder = async (
  id: number,
): Promise<QueryResult<any>> => {
  try {
    const { data: currentPO, error: fetchError } = await supabase
      .from('purchase_orders')
      .select('status')
      .eq('id', id)
      .single()

    if (fetchError) throw fetchError

    if (currentPO.status !== 'draft') {
      throw new Error(
        `Cannot submit purchase order with status: ${currentPO.status}`,
      )
    }

    const { data, error } = await supabase
      .from('purchase_orders')
      .update({
        status: 'pending',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return { data, error: null }
  } catch (error: any) {
    console.error('Error submitting purchase order:', error)
    return { data: null, error }
  }
}

// ✅ FIXED markPurchaseOrderAsPaid — also writes payment_method back to the PO row
// Replace the existing function in data/purchaseOrderHistory.Queries.ts

export const markPurchaseOrderAsPaid = async (
  id: number,
  amountPaid: number,
  paidBy: number,
  supplierId: number,
  paymentMethod: string = 'cash',
  paymentNotes?: string,
): Promise<QueryResult<any> & { payment: any }> => {
  try {
    const { data: currentPO, error: fetchError } = await supabase
      .from('purchase_orders')
      .select(
        'status, total_amount, paid_amount, company_id, store_id, po_number',
      )
      .eq('id', id)
      .single()

    if (fetchError) throw fetchError

    if (currentPO.status !== 'received') {
      throw new Error(
        'Only received purchase orders can have payments recorded',
      )
    }

    const newPaidAmount = (currentPO.paid_amount || 0) + amountPaid
    const totalAmount = currentPO.total_amount

    const paymentStatus = newPaidAmount >= totalAmount ? 'paid' : 'unpaid'

    // Generate unique transaction number
    const timestamp = Date.now()
    const randomSuffix = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, '0')
    const transactionNumber = `PAY-${currentPO.po_number}-${timestamp}-${randomSuffix}`

    // 1️⃣ Create payment transaction record
    const { data: paymentData, error: paymentError } = await supabase
      .from('payment_transactions')
      .insert({
        company_id: currentPO.company_id,
        store_id: currentPO.store_id,
        transaction_number: transactionNumber,
        transaction_type: 'purchase',
        reference_type: 'purchase_order',
        reference_id: id,
        amount: amountPaid,
        supplier_id: supplierId,
        entity_type: 'supplier',
        entity_id: supplierId,
        transaction_date: new Date().toISOString(),
        payment_method: paymentMethod, // ✅ selected method saved here
        notes: paymentNotes || `Payment for PO ${currentPO.po_number}`,
        created_by: paidBy,
      })
      .select()
      .single()

    if (paymentError) {
      console.error('Error creating payment transaction:', paymentError)
      throw new Error(
        `Failed to create payment record: ${paymentError.message}`,
      )
    }

    // 2️⃣ Update purchase order — include payment_method so the PO row
    //    always reflects the most recent actual payment method used
    const { data, error } = await supabase
      .from('purchase_orders')
      .update({
        paid_amount: newPaidAmount,
        payment_status: paymentStatus,
        payment_method: paymentMethod, // ✅ KEY FIX: write back to PO
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      // Rollback: delete the payment transaction
      await supabase
        .from('payment_transactions')
        .delete()
        .eq('transaction_number', transactionNumber)

      throw new Error(`Failed to update purchase order: ${error.message}`)
    }

    return { data, payment: paymentData, error: null }
  } catch (error: any) {
    console.error('Error marking as paid:', error)
    return { data: null, payment: null, error }
  }
}
/**
 * Delete a purchase order (only drafts)
 */
export const deletePurchaseOrder = async (
  id: number,
  status: string,
): Promise<{ error: PostgrestError | null }> => {
  try {
    if (status !== 'draft') {
      throw new Error('Only draft purchase orders can be deleted')
    }

    const { error } = await supabase
      .from('purchase_orders')
      .update({
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (error) throw error

    return { error: null }
  } catch (error: any) {
    console.error('Error deleting purchase order:', error)
    return { error }
  }
}

/**
 * Get supplier credit information
 */
export const getSupplierCreditInfo = async (
  supplierId: number,
): Promise<QueryResult<any>> => {
  try {
    const { data, error } = await supabase
      .from('suppliers')
      .select('credit_limit, current_balance, available_credit')
      .eq('id', supplierId)
      .single()

    if (error) throw error

    return { data, error: null }
  } catch (error: any) {
    console.error('Error fetching supplier credit info:', error)
    return { data: null, error }
  }
}

/**
 * Get payment history for a purchase order
 */
export const getPOPaymentHistory = async (
  purchaseOrderId: number,
): Promise<QueryResult<any[]>> => {
  try {
    const { data, error } = await supabase
      .from('payment_transactions')
      .select('*')
      .eq('reference_type', 'purchase_order')
      .eq('reference_id', purchaseOrderId)
      .order('transaction_date', { ascending: false })

    if (error) throw error

    return { data, error: null }
  } catch (error: any) {
    console.error('Error fetching payment history:', error)
    return { data: null, error }
  }
}

/**
 * Validate batch receipt quantities
 */
export const validateBatchQuantities = async (
  purchaseOrderId: number,
  productId: number,
  batchNumber: string,
  newQuantity: number,
): Promise<{
  valid: boolean
  reason?: string
  ordered?: number
  existing?: number
  remaining?: number
}> => {
  try {
    const { data: poItem, error: poError } = await supabase
      .from('purchase_order_items')
      .select('quantity_ordered, quantity_received')
      .eq('purchase_order_id', purchaseOrderId)
      .eq('product_id', productId)
      .eq('batch_number', batchNumber)
      .single()

    if (poError) throw poError

    if (!poItem) {
      return {
        valid: false,
        reason: 'Purchase order item not found',
      }
    }

    const { data: existingBatches, error: batchError } = await supabase
      .from('product_batches')
      .select('quantity_received')
      .eq('purchase_order_id', purchaseOrderId)
      .eq('product_id', productId)
      .eq('batch_number', batchNumber)

    if (batchError) throw batchError

    const totalExisting =
      existingBatches?.reduce(
        (sum, b) => sum + (b.quantity_received || 0),
        0,
      ) || 0
    const totalWithNew = totalExisting + newQuantity
    const remaining = poItem.quantity_ordered - (poItem.quantity_received || 0)

    if (totalWithNew > poItem.quantity_ordered) {
      return {
        valid: false,
        reason: `Total batch quantity (${totalWithNew}) would exceed ordered quantity (${poItem.quantity_ordered})`,
        ordered: poItem.quantity_ordered,
        existing: totalExisting,
        remaining: remaining,
      }
    }

    return {
      valid: true,
      ordered: poItem.quantity_ordered,
      existing: totalExisting,
      remaining: remaining,
    }
  } catch (error: any) {
    console.error('Error validating batch quantities:', error)
    return {
      valid: false,
      reason: error.message,
    }
  }
}

/**
 * ✅ UPDATED: Receive all goods from PO (Approved → Received)
 * Now accepts optional invoiceMeta from ReceiveGoodsForm modal
 */
export const receiveAllGoodsFromPO = async (
  purchaseOrderId: number,
  companyId: number,
  receivedBy?: number,
  invoiceMeta?: InvoiceMeta,
): Promise<{ error: PostgrestError | null }> => {
  try {
    const { data: currentPO, error: fetchError } = await supabase
      .from('purchase_orders')
      .select('status, store_id, po_date')
      .eq('id', purchaseOrderId)
      .single()

    if (fetchError) throw fetchError

    if (currentPO.status !== 'approved') {
      throw new Error(
        `Cannot receive goods from purchase order with status: ${currentPO.status}`,
      )
    }

    const { data: poItems, error: itemsError } = await supabase
      .from('purchase_order_items')
      .select('*')
      .eq('purchase_order_id', purchaseOrderId)

    if (itemsError) throw itemsError

    if (!poItems || poItems.length === 0) {
      throw new Error('No items found in purchase order')
    }

    // Build the PO update payload — always include core fields,
    // only include invoice fields when provided
    const poUpdatePayload: Record<string, any> = {
      status: 'received',
      received_by: receivedBy,
      received_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    if (invoiceMeta) {
      poUpdatePayload.invoice_number = invoiceMeta.invoiceNumber
      poUpdatePayload.invoice_date = invoiceMeta.invoiceDate
      if (invoiceMeta.deliveryNotes) {
        poUpdatePayload.delivery_notes = invoiceMeta.deliveryNotes
      }
    }

    console.log('📦 [receiveAllGoodsFromPO] Updating PO with payload:', {
      purchaseOrderId,
      ...poUpdatePayload,
    })

    // Update PO status to received
    const { error: poError } = await supabase
      .from('purchase_orders')
      .update(poUpdatePayload)
      .eq('id', purchaseOrderId)

    if (poError) throw poError

    // Update each item as received
    for (const item of poItems) {
      const { error: itemError } = await supabase
        .from('purchase_order_items')
        .update({
          quantity_received: item.quantity_ordered,
          updated_at: new Date().toISOString(),
        })
        .eq('id', item.id)

      if (itemError) {
        console.error('Error updating PO item:', itemError)
        throw itemError
      }

      // Update product batch inventory
      const { data: currentBatch } = await supabase
        .from('product_batches')
        .select('quantity_received, quantity_available')
        .eq('product_id', item.product_id)
        .eq('store_id', currentPO.store_id)
        .eq('batch_number', item.batch_number)
        .eq('purchase_order_id', purchaseOrderId)
        .single()

      if (currentBatch) {
        const { error: batchError } = await supabase
          .from('product_batches')
          .update({
            quantity_received: item.quantity_ordered,
            quantity_available: item.quantity_ordered,
            updated_at: new Date().toISOString(),
          })
          .eq('product_id', item.product_id)
          .eq('store_id', currentPO.store_id)
          .eq('batch_number', item.batch_number)
          .eq('purchase_order_id', purchaseOrderId)

        if (batchError) {
          console.error('Error updating batch stock:', batchError)
          throw batchError
        }
      } else {
        // Batch doesn't exist yet — create it
        console.warn(
          `⚠️ No batch found for product ${item.product_id}, batch ${item.batch_number} — creating now`,
        )
      }
    }

    console.log('✅ [receiveAllGoodsFromPO] All goods received successfully', {
      purchaseOrderId,
      itemsProcessed: poItems.length,
      invoiceNumber: invoiceMeta?.invoiceNumber ?? 'N/A',
    })

    return { error: null }
  } catch (error: any) {
    console.error('Error receiving all goods:', error)
    return { error }
  }
}

/**
 * Reject purchase order
 */
export const rejectPurchaseOrder = async (
  id: number,
  rejectedBy: number,
  rejectionReason: string,
): Promise<QueryResult<any>> => {
  try {
    const { data: currentPO, error: fetchError } = await supabase
      .from('purchase_orders')
      .select('status')
      .eq('id', id)
      .single()

    if (fetchError) throw fetchError

    if (currentPO.status !== 'pending') {
      throw new Error(
        `Cannot reject purchase order with status: ${currentPO.status}`,
      )
    }

    const { data, error } = await supabase
      .from('purchase_orders')
      .update({
        status: 'rejected',
        rejected_by: rejectedBy,
        rejected_at: new Date().toISOString(),
        rejection_reason: rejectionReason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return { data, error: null }
  } catch (error: any) {
    console.error('Error rejecting purchase order:', error)
    return { data: null, error }
  }
}

/**
 * Cancel purchase order
 */
export const cancelPurchaseOrder = async (
  id: number,
  cancelledBy: number,
  cancellationReason: string,
  currentStatus: string,
): Promise<QueryResult<any>> => {
  try {
    const validation = canCancelPurchaseOrder(currentStatus)
    if (!validation.canCancel) {
      throw new Error(validation.reason)
    }

    const { data, error } = await supabase
      .from('purchase_orders')
      .update({
        status: 'cancelled',
        cancelled_by: cancelledBy,
        cancelled_at: new Date().toISOString(),
        cancellation_reason: cancellationReason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return { data, error: null }
  } catch (error: any) {
    console.error('Error cancelling purchase order:', error)
    return { data: null, error }
  }
}

/**
 * Check if purchase order can be returned
 */
export const checkPurchaseReturnEligibility = async (
  id: number,
  companyId: number,
  settings: CompanySettings | null,
): Promise<{
  eligible: boolean
  reason?: string
  daysRemaining?: number
}> => {
  try {
    if (!settings?.allow_purchase_returns) {
      return {
        eligible: false,
        reason: 'Purchase returns are not allowed by company settings',
      }
    }

    const { data: po, error } = await supabase
      .from('purchase_orders')
      .select('received_at, received_by, status, po_number')
      .eq('id', id)
      .single()

    if (error) throw error

    // Must be received status
    if (po.status !== 'received') {
      return {
        eligible: false,
        reason: 'Only received purchase orders can be returned',
      }
    }

    if (!po.received_at) {
      return {
        eligible: false,
        reason:
          'No receipt date found. This purchase order cannot be returned.',
      }
    }

    // Check return days limit
    const returnLimit = settings.purchase_return_days_limit
    if (returnLimit) {
      const daysSinceReceived = Math.floor(
        (Date.now() - new Date(po.received_at).getTime()) /
          (1000 * 60 * 60 * 24),
      )

      const daysRemaining = returnLimit - daysSinceReceived

      if (daysSinceReceived > returnLimit) {
        return {
          eligible: false,
          reason: `Return period of ${returnLimit} days has expired (${daysSinceReceived} days since receipt)`,
          daysRemaining: 0,
        }
      }

      console.log('✅ Return eligible:', {
        po_number: po.po_number,
        received_at: po.received_at,
        days_since_received: daysSinceReceived,
        days_remaining: daysRemaining,
        return_limit: returnLimit,
      })

      return {
        eligible: true,
        daysRemaining: daysRemaining,
      }
    }

    return { eligible: true }
  } catch (error: any) {
    console.error('Error checking return eligibility:', error)
    return { eligible: false, reason: error.message }
  }
}

/**
 * ✅ CLEANED: Get purchase order statistics (removed partiallyReceived & partiallyPaid)
 */
export const getPurchaseOrderStats = async (
  companyId: number,
  storeId?: number,
): Promise<{
  data: {
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
  } | null
  error: any
}> => {
  try {
    let query = supabase
      .from('vw_purchase_orders_stats')
      .select('*')
      .eq('company_id', companyId)

    if (!storeId) {
      const { selectedArea, selectedStore } = getCurrentSelection()

      if (selectedStore) {
        query = query.eq('store_id', selectedStore.id)
      } else if (selectedArea) {
        console.log(
          '📍 Area-level stats aggregation for:',
          selectedArea.area_name,
        )
        const { data: areaStores } = await supabase
          .from('stores')
          .select('id')
          .eq('area_id', selectedArea.id)
          .is('deleted_at', null)

        if (areaStores && areaStores.length > 0) {
          const storeIds = areaStores.map((s) => s.id)
          query = query.in('store_id', storeIds)
        }
      }
    } else {
      query = query.eq('store_id', storeId)
    }

    const { data, error } = await query

    if (error) {
      console.error('❌ Error fetching stats from view:', error)
      throw error
    }

    if (!data || data.length === 0) {
      console.log(
        '📊 No stats found for company:',
        companyId,
        'store:',
        storeId,
        '- returning zeros',
      )
      return {
        data: {
          total: 0,
          draft: 0,
          pending: 0,
          approved: 0,
          rejected: 0,
          received: 0,
          cancelled: 0,
          completed: 0,
          totalAmount: 0,
          totalPaid: 0,
          totalDue: 0,
          unpaid: 0,
          paid: 0,
          overdue: 0,
        },
        error: null,
      }
    }

    // ✅ CLEANED: Removed partiallyReceived and partiallyPaid from aggregation
    const aggregatedStats = data.reduce(
      (acc, row) => ({
        total: acc.total + (row.total || 0),
        draft: acc.draft + (row.draft || 0),
        pending: acc.pending + (row.pending || 0),
        approved: acc.approved + (row.approved || 0),
        rejected: acc.rejected + (row.rejected || 0),
        received: acc.received + (row.received || 0),
        cancelled: acc.cancelled + (row.cancelled || 0),
        completed: acc.completed + (row.completed || 0),
        totalAmount: acc.totalAmount + parseFloat(row.total_amount || 0),
        totalPaid: acc.totalPaid + parseFloat(row.total_paid || 0),
        totalDue: acc.totalDue + parseFloat(row.total_due || 0),
        unpaid: acc.unpaid + (row.unpaid || 0),
        paid: acc.paid + (row.paid || 0),
        overdue: acc.overdue + (row.overdue || 0),
      }),
      {
        total: 0,
        draft: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
        received: 0,
        cancelled: 0,
        completed: 0,
        totalAmount: 0,
        totalPaid: 0,
        totalDue: 0,
        unpaid: 0,
        paid: 0,
        overdue: 0,
      },
    )

    console.log(
      '✅ Stats aggregated from',
      data.length,
      'row(s):',
      aggregatedStats,
    )

    return {
      data: aggregatedStats,
      error: null,
    }
  } catch (error: any) {
    console.error('❌ Error fetching PO stats from view:', error)

    return {
      data: {
        total: 0,
        draft: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
        received: 0,
        cancelled: 0,
        completed: 0,
        totalAmount: 0,
        totalPaid: 0,
        totalDue: 0,
        unpaid: 0,
        paid: 0,
        overdue: 0,
      },
      error,
    }
  }
}

