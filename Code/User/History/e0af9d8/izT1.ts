// data/purchaseOrderHistory.Queries.ts - CLEANED: Removed partial_received/partial_paid
import { supabase } from '@app/core/supabase/Supabase.utils'
import { PostgrestError } from '@supabase/supabase-js'
import { CompanySettings } from '@shared/types/companySettings'
import {
  generatePONumber,
  canCancelPurchaseOrder,
} from '../utils/companySettingsUtils'
import { applyRestrictedFilter } from '@shared/utils/restrictedFilter.utils'
import { applyStoreFilter } from '@shared/utils/selectionFilter.utils'

interface PurchaseOrderParams {
  page?: number
  pageSize?: number
  searchQuery?: string
  status?: string
  paymentStatus?: string
  paymentMethod?: string
  dateFrom?: string
  dateTo?: string
  companyId?: number
  storeId?: number
  storeIds?: number[] | null
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
  paymentStatus = 'all',
  paymentMethod = 'all',
  dateFrom,
  dateTo,
  companyId,
  storeId,
  storeIds,
  isUnlocked = false,
}: PurchaseOrderParams & { isUnlocked?: boolean }): Promise<
  QueryResult<any[]> & { count: number }
> => {
  try {
    let query = supabase
      .from('vw_purchase_orders_summary')
      .select('*', { count: 'exact' })
      .is('deleted_at', null)

    // Apply restricted filter
    query = applyRestrictedFilter(query, isUnlocked)

    if (companyId) {
      query = query.eq('company_id', companyId)
    }

    // storeIds from useScopeFilter drives area/store filtering
    if (storeIds !== undefined) {
      query = applyStoreFilter(query, storeIds)
    } else if (storeId) {
      query = query.eq('store_id', storeId)
    }

    if (status !== 'all') {
      query = query.eq('status', status)
    }

    if (paymentStatus && paymentStatus !== 'all') {
      query = query.eq('payment_status', paymentStatus)
    }

    if (paymentMethod && paymentMethod !== 'all') {
      query = query.eq('payment_method', paymentMethod)
    }

    if (dateFrom) {
      query = query.gte('po_date', dateFrom)
    }

    if (dateTo) {
      query = query.lte('po_date', dateTo)
    }

    if (searchQuery) {
      query = query.or(
        `po_number.ilike.%${searchQuery}%,supplier_name.ilike.%${searchQuery}%,store_name.ilike.%${searchQuery}%,invoice_number.ilike.%${searchQuery}%`,
      )
    }

    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    query = query.order('created_at', { ascending: false }).range(from, to)

    const { data, error, count } = await query

    if (error) throw error

    // FIX A-06: Resolve _by fields to human-readable names
    let enrichedData = data || []
    if (enrichedData.length > 0) {
      const userIds = new Set<number>()
      for (const po of enrichedData) {
        if (po.created_by) userIds.add(po.created_by)
        if (po.approved_by) userIds.add(po.approved_by)
        if (po.received_by) userIds.add(po.received_by)
        if (po.rejected_by) userIds.add(po.rejected_by)
        if (po.cancelled_by) userIds.add(po.cancelled_by)
      }
      if (userIds.size > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, username')
          .in('id', [...userIds])
        const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]))
        const getName = (id: number | null) => {
          if (!id) return null
          const p = profileMap.get(id) as any
          if (!p) return null
          return p.first_name && p.last_name
            ? `${p.first_name} ${p.last_name}`
            : p.username || null
        }
        enrichedData = enrichedData.map((po: any) => ({
          ...po,
          created_by_name: getName(po.created_by),
          approved_by_name: getName(po.approved_by),
          received_by_name: getName(po.received_by),
          rejected_by_name: getName(po.rejected_by),
          cancelled_by_name: getName(po.cancelled_by),
        }))
      }
    }

    return { data: enrichedData, error: null, count: count || 0 }
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
    let query = supabase
      .from('stores')
      .select('*')
      .is('deleted_at', null)
      .eq('is_active', true)
      .order('store_name', { ascending: true })

    if (companyId) {
      query = query.eq('company_id', companyId)
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

/**
 * Mark purchase order as paid (full or partial).
 *
 * Flow:
 *  1. INSERT payment_transactions
 *       → trigger fn_create_payment_journal_entry fires automatically:
 *           DR Accounts Payable 2100
 *           CR Cash/Bank (by payment method)
 *         This drives v_trial_balance and v_balance_sheet.
 *
 *  2. INSERT cash_flow_transactions
 *       → drives v_cash_flow
 *       → also removes the PO from v_cash_flow's purchase_orders branch
 *         (which excludes POs that already have a cash_flow_transactions row),
 *         preventing double-counting.
 *
 *  3. UPDATE purchase_orders
 *       paid_amount, payment_status, payment_method
 *
 * NOTE: Do NOT manually create journal_entries here — the trigger handles it.
 * NOTE: payment_status constraint only allows 'unpaid' | 'paid' (no 'partial').
 *       Partial payments stay 'unpaid' until fully paid.
 * NOTE: Supabase returns numeric columns as strings — always parseFloat().
 */
export const markPurchaseOrderAsPaid = async (
  id: number,
  amountPaid: number,
  paidBy: number,
  supplierId: number,
  paymentMethod: string = 'cash',
  paymentNotes?: string,
): Promise<QueryResult<any> & { payment: any }> => {
  try {
    // ─── Fetch PO ──────────────────────────────────────────────────────────
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

    // FIX: Supabase returns numeric as string — parseFloat to avoid
    // string concatenation bugs (e.g. "0" + 300000 = "0300000")
    const currentPaid = parseFloat(String(currentPO.paid_amount || 0))
    const totalAmount = parseFloat(String(currentPO.total_amount || 0))
    const newPaidAmount = currentPaid + amountPaid

    // Constraint only allows 'unpaid' | 'paid' — partial payments stay 'unpaid'
    const paymentStatus = newPaidAmount >= totalAmount ? 'paid' : 'unpaid'

    const timestamp = Date.now()
    const randomSuffix = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, '0')
    const transactionNumber = `PAY-${currentPO.po_number}-${timestamp}-${randomSuffix}`

    console.log('💳 Recording PO payment:', {
      poNumber: currentPO.po_number,
      currentPaid,
      totalAmount,
      amountPaid,
      newPaidAmount,
      paymentStatus,
      paymentMethod,
    })

    // ─── Step 1: INSERT payment_transactions ──────────────────────────────
    // Trigger fn_create_payment_journal_entry fires on INSERT and automatically:
    //   - Creates journal_entries row (DR AP 2100 / CR Cash by method)
    //   - Creates journal_entry_lines rows
    //   - Sets payment_transactions.journal_entry_id
    // DO NOT manually create journal entries — trigger handles it.
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
        payment_method: paymentMethod,
        notes: paymentNotes || `Payment for PO ${currentPO.po_number}`,
        created_by: paidBy,
        // journal_entry_id intentionally omitted — trigger sets it automatically
      })
      .select()
      .single()

    if (paymentError) {
      throw new Error(
        `Failed to create payment record: ${paymentError.message}`,
      )
    }

    console.log(
      '✅ payment_transactions inserted, journal_entry_id:',
      paymentData.journal_entry_id,
    )

    // ─── Step 2: INSERT cash_flow_transactions ────────────────────────────
    // v_cash_flow reads from cash_flow_transactions (NOT payment_transactions).
    // Inserting here:
    //   a) Makes this payment visible in v_cash_flow as an outflow
    //   b) Removes the PO itself from v_cash_flow's purchase_orders UNION branch
    //      (that branch excludes POs with an existing cash_flow_transactions row)
    //      → prevents double-counting the PO amount in cash flow reports
    //
    // transaction_type 'purchase' → view CASE maps it to 'outflow' ✅
    // (view maps ['inflow','sale','receipt','income'] → inflow, everything else → outflow)
    const { error: cftError } = await supabase
      .from('cash_flow_transactions')
      .insert({
        company_id: currentPO.company_id,
        store_id: currentPO.store_id,
        transaction_date: new Date().toISOString().split('T')[0],
        transaction_type: 'purchase',
        activity_type: 'operating',
        description: `Supplier payment - PO ${currentPO.po_number}`,
        amount: amountPaid,
        reference_type: 'purchase_order',
        reference_id: id,
        reference_number: currentPO.po_number,
        journal_entry_id: paymentData.journal_entry_id ?? null,
        category: 'purchase_payment',
        payment_method: paymentMethod,
        notes: paymentNotes || `Payment for PO ${currentPO.po_number}`,
        created_by: paidBy,
      })

    if (cftError) {
      // Rollback payment_transactions
      await supabase
        .from('payment_transactions')
        .delete()
        .eq('transaction_number', transactionNumber)
      throw new Error(`Cash flow transaction failed: ${cftError.message}`)
    }

    console.log('✅ cash_flow_transactions inserted')

    // ─── Step 3: UPDATE purchase_orders ───────────────────────────────────
    const { data, error } = await supabase
      .from('purchase_orders')
      .update({
        paid_amount: newPaidAmount,
        payment_status: paymentStatus, // 'paid' | 'unpaid' only — constraint enforced
        payment_method: paymentMethod,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      // Rollback both inserts
      await supabase
        .from('payment_transactions')
        .delete()
        .eq('transaction_number', transactionNumber)
      await supabase
        .from('cash_flow_transactions')
        .delete()
        .eq('reference_type', 'purchase_order')
        .eq('reference_id', id)
      throw new Error(`Failed to update purchase order: ${error.message}`)
    }

    console.log('✅ PO payment complete:', {
      poNumber: currentPO.po_number,
      amountPaid,
      newPaidAmount,
      remainingDue: Math.max(0, totalAmount - newPaidAmount),
      paymentStatus,
      journalEntryId: paymentData.journal_entry_id,
    })

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

    if (
      currentPO.status !== 'approved' &&
      currentPO.status !== 'partially_received'
    ) {
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

    // Build the PO update payload — do NOT set status manually.
    // The sync_po_item_received_quantity trigger on product_batches decides:
    //   all items received   → status = 'received'
    //   some items received  → status = 'partially_received'
    const poUpdatePayload: Record<string, any> = {
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

    // Update PO metadata (trigger will set the status)
    const { error: poError } = await supabase
      .from('purchase_orders')
      .update(poUpdatePayload)
      .eq('id', purchaseOrderId)

    if (poError) throw poError

    // Update each item as received
    for (const item of poItems) {
      // Do NOT write quantity_received on purchase_order_items directly —
      // the sync_po_item_received_quantity trigger owns that field.
      // It reads SUM(product_batches.quantity_received) and writes it back.
      // Writing it here would make the trigger compute delta=0 and skip accounting.
      const { error: itemError } = await supabase
        .from('purchase_order_items')
        .update({
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
        // Only update quantity_received here — the sync trigger will compute
        // quantity_available as OLD.quantity_available + delta automatically.
        const { error: batchError } = await supabase
          .from('product_batches')
          .update({
            quantity_received: item.quantity_ordered,
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
      .select('received_at, received_by, status, po_number, updated_at')
      .eq('id', id)
      .single()

    if (error) throw error

    if (!['received', 'partially_received'].includes(po.status)) {
      return {
        eligible: false,
        reason:
          'Only received or partially received purchase orders can be returned',
      }
    }

    // Use received_at if set, otherwise fall back to updated_at
    // (POs received before the received_at fix have null received_at)
    const effectiveReceivedAt = po.received_at || po.updated_at
    if (!effectiveReceivedAt) {
      return {
        eligible: false,
        reason:
          'No receipt date found. This purchase order cannot be returned.',
      }
    }

    const returnLimit = settings.purchase_return_days_limit
    if (returnLimit) {
      const daysSinceReceived = Math.floor(
        (Date.now() - new Date(effectiveReceivedAt).getTime()) /
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
        received_at: effectiveReceivedAt,
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

    // storeId param kept for explicit override; navbar scope handled by RLS
    if (storeId) query = query.eq('store_id', storeId)

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

// ─── Fetch a single PO with full detail for the View modal ───────────────────
export const getPurchaseOrderById = async (id: number) => {
  try {
    // 1. Fetch PO header + supplier + items
    const { data: po, error: poError } = await supabase
      .from('vw_purchase_orders_summary')
      .select('*')
      .eq('id', id)
      .single()

    if (poError) throw poError
    if (!po) throw new Error('Purchase order not found')

    // 2. Fetch full supplier contact info
    const { data: supplier } = await supabase
      .from('suppliers')
      .select(
        'id, supplier_name, supplier_code, contact_person, phone, email, address',
      )
      .eq('id', po.supplier_id)
      .single()

    // 3. Fetch items from vw_purchase_order_items_history
    const { data: items } = await supabase
      .from('vw_purchase_order_items_history')
      .select('*')
      .eq('purchase_order_id', id)
      .order('created_at', { ascending: true })

    // 4. Fetch payment transactions
    const { data: payments } = await supabase
      .from('payment_transactions')
      .select(
        'id, transaction_number, transaction_date, payment_method, amount, notes',
      )
      .eq('reference_type', 'purchase_order')
      .eq('reference_id', id)
      .order('transaction_date', { ascending: false })

    // 5. Enrich actor IDs → full names
    const actorIds = new Set<number>()
    ;(
      [
        'created_by',
        'approved_by',
        'received_by',
        'rejected_by',
        'cancelled_by',
      ] as const
    ).forEach((key) => {
      if ((po as any)[key]) actorIds.add((po as any)[key])
    })

    let actorMap = new Map<number, string>()
    if (actorIds.size > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, username')
        .in('id', [...actorIds])
      ;(profiles || []).forEach((p: any) => {
        const name =
          p.first_name && p.last_name
            ? `${p.first_name} ${p.last_name}`
            : p.username || `User #${p.id}`
        actorMap.set(p.id, name)
      })
    }

    const getName = (id: number | null | undefined) =>
      id ? (actorMap.get(id) ?? null) : null

    return {
      data: {
        ...po,
        suppliers: supplier || undefined,
        items: items || [],
        payments: payments || [],
        created_by_name: getName((po as any).created_by),
        approved_by_name: getName((po as any).approved_by),
        received_by_name: getName((po as any).received_by),
        rejected_by_name: getName((po as any).rejected_by),
        cancelled_by_name: getName((po as any).cancelled_by),
      },
      error: null,
    }
  } catch (error: any) {
    console.error('Error fetching purchase order by ID:', error)
    return { data: null, error }
  }
}

