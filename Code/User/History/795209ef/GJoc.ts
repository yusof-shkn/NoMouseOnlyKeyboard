// data/purchaseReturnQueries.ts - UPDATED WITH AREA/STORE FILTERING

import { supabase } from '@app/core/supabase/Supabase.utils'
import { applyStoreFilter } from '@shared/utils/selectionFilter.utils'
import { PostgrestError } from '@supabase/supabase-js'
import {
  FetchPurchaseReturnsParams,
  PurchaseReturn,
  PurchaseReturnDetail,
  CreatePurchaseReturnData,
  UpdatePurchaseReturnData,
} from '../types/purchaseReturn.types'
import { applyRestrictedFilter } from '@shared/utils/restrictedFilter.utils'

/**
 * Get purchase returns with filtering, pagination, and search
 * ✅ UPDATED: Apply area/store filtering
 */
export const getPurchaseReturns = async ({
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
}: FetchPurchaseReturnsParams & { isUnlocked?: boolean } = {}): Promise<{
  data: PurchaseReturn[] | null
  error: PostgrestError | null
  count: number | null
}> => {
  try {
    console.log('📊 [getPurchaseReturns] Starting query with params:', {
      page,
      pageSize,
      companyId,
      status,
      sortBy,
    })

    let query = supabase
      .from('purchase_returns')
      .select(
        `
        *,
        suppliers!inner(
          id,
          supplier_name,
          contact_person,
          phone,
          email,
          current_balance,
          available_credit,
          credit_limit
        ),
        stores!inner(
          id,
          store_name,
          store_code
        ),
        purchase_orders(
          id,
          po_number,
          po_date,
          total_amount,
          payment_status
        ),
        processed_by_profile:profiles!purchase_returns_processed_by_fkey(
          id,
          first_name,
          last_name,
          email
        ),
        approved_by_profile:profiles!purchase_returns_approved_by_fkey(
          id,
          first_name,
          last_name,
          email
        ),
        purchase_return_items(
          id,
          product_id,
          quantity_returned,
          unit_cost,
          refund_amount,
          products(
            id,
            product_name,
            product_code,
            generic_name
          )
        )
      `,
        { count: 'exact' },
      )
      .is('deleted_at', null)

    if (companyId) {
      query = query.eq('company_id', companyId)
    }

    // Apply restricted filter
    query = applyRestrictedFilter(query, isUnlocked)

    if (searchQuery && searchQuery.trim()) {
      const searchTerm = searchQuery.trim()
      query = query.or(
        `return_number.ilike.%${searchTerm}%,` +
          `return_reason.ilike.%${searchTerm}%,` +
          `notes.ilike.%${searchTerm}%,` +
          `suppliers.supplier_name.ilike.%${searchTerm}%`,
      )
    }

    if (status !== 'all') {
      query = query.eq('status', status)
    }

    if (dateFrom) {
      query = query.gte('return_date', dateFrom)
    }
    if (dateTo) {
      query = query.lte('return_date', dateTo)
    }

    switch (sortBy) {
      case 'last_7_days':
        const sevenDaysAgo = new Date()
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
        query = query.gte(
          'return_date',
          sevenDaysAgo.toISOString().split('T')[0],
        )
        query = query.order('return_date', { ascending: false })
        break
      case 'last_month':
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
        query = query.gte(
          'return_date',
          thirtyDaysAgo.toISOString().split('T')[0],
        )
        query = query.order('return_date', { ascending: false })
        break
      case 'descending':
        query = query.order('return_date', { ascending: false })
        break
      case 'ascending':
        query = query.order('return_date', { ascending: true })
        break
      case 'recently_added':
      default:
        query = query.order('created_at', { ascending: false })
        break
    }

    query = query.range((page - 1) * pageSize, page * pageSize - 1)

    const result = await query

    if (result.error) {
      console.error('❌ [getPurchaseReturns] Query error:', result.error)
      throw result.error
    }

    console.log('✅ [getPurchaseReturns] Query successful:', {
      count: result.data?.length || 0,
      totalCount: result.count,
    })

    if (result.data) {
      result.data = result.data.map((item: any) => {
        const totalRefund = parseFloat(item.total_refund_amount || 0)
        const paidAmount = 0 // TODO: Implement payment tracking

        let paymentStatus: 'unpaid' | 'partially_paid' | 'paid' = 'unpaid'
        if (paidAmount === 0) {
          paymentStatus = 'unpaid'
        } else if (paidAmount >= totalRefund) {
          paymentStatus = 'paid'
        } else {
          paymentStatus = 'partially_paid'
        }

        return {
          ...item,
          supplier_name: item.suppliers?.supplier_name,
          supplier: item.suppliers,
          store_name: item.stores?.store_name,
          store: item.stores,
          po_number: item.purchase_orders?.po_number,
          po_date: item.purchase_orders?.po_date,
          po_payment_status: item.purchase_orders?.payment_status,
          processed_by_name: item.processed_by_profile
            ? `${item.processed_by_profile.first_name} ${item.processed_by_profile.last_name}`
            : null,
          approved_by_name: item.approved_by_profile
            ? `${item.approved_by_profile.first_name} ${item.approved_by_profile.last_name}`
            : null,
          items_count: item.purchase_return_items?.length || 0,
          total_items_returned:
            item.purchase_return_items?.reduce(
              (sum: number, i: any) => sum + (i.quantity_returned || 0),
              0,
            ) || 0,
          payment_status: paymentStatus,
          paid_amount: paidAmount,
          due_amount: totalRefund - paidAmount,
        }
      })
    }

    if (paymentStatus !== 'all' && result.data) {
      result.data = result.data.filter(
        (item: any) => item.payment_status === paymentStatus,
      )
    }

    return result
  } catch (error) {
    console.error('❌ Error in getPurchaseReturns query:', error)
    return {
      data: null,
      error: error as PostgrestError,
      count: null,
    }
  }
}

/**
 * Get a single purchase return with full details
 */
export const getPurchaseReturnById = async (
  id: number,
): Promise<{
  data: PurchaseReturnDetail | null
  error: PostgrestError | null
}> => {
  try {
    console.log('📊 [getPurchaseReturnById] Fetching return:', id)

    const { data, error } = await supabase
      .from('purchase_returns')
      .select(
        `
        *,
        suppliers(
          id, 
          supplier_name, 
          supplier_code,
          contact_person, 
          phone, 
          email,
          current_balance,
          available_credit,
          credit_limit,
          credit_status
        ),
        stores(
          id, 
          store_name, 
          store_code,
          address,
          city,
          phone
        ),
        purchase_orders(
          id, 
          po_number, 
          po_date,
          total_amount,
          paid_amount,
          payment_status,
          status
        ),
        processed_by_profile:profiles!purchase_returns_processed_by_fkey(
          id, 
          first_name, 
          last_name,
          email,
          phone
        ),
        approved_by_profile:profiles!purchase_returns_approved_by_fkey(
          id, 
          first_name, 
          last_name,
          email,
          phone
        ),
        purchase_return_items(
          *,
          products(
            id,
            product_name, 
            product_code, 
            generic_name,
            dosage_form,
            strength,
            manufacturer
          ),
          product_batches(
            id,
            batch_number,
            expiry_date,
            manufacturing_date,
            quantity_available
          ),
          purchase_order_items(
            id,
            quantity_ordered,
            quantity_received,
            unit_cost
          )
        )
      `,
      )
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (error) throw error

    if (!data) {
      throw new Error('Purchase return not found')
    }

    if (!data.suppliers) {
      console.error('⚠️ Warning: No supplier data found for return', id)
      const { data: supplierData } = await supabase
        .from('suppliers')
        .select('*')
        .eq('id', data.supplier_id)
        .single()

      if (supplierData) {
        data.supplier = supplierData
        data.suppliers = supplierData
      }
    } else {
      data.supplier = data.suppliers
    }

    console.log('✅ [getPurchaseReturnById] Fetched successfully')
    return { data, error: null }
  } catch (error: any) {
    console.error('❌ Error fetching purchase return:', error)
    return { data: null, error }
  }
}

/**
 * Get purchase orders available for return
 * ✅ UPDATED: Apply area/store filtering and receives settings as parameter from Redux
 */
export const getReturnablePurchaseOrders = async (
  companyId: number,
  purchaseReturnDaysLimit: number | null,
  storeId?: number,
  supplierId?: number,
  storeIds?: number[] | null,
): Promise<{
  data: any[] | null
  error: PostgrestError | null
}> => {
  try {
    let query = supabase
      .from('purchase_orders')
      .select(
        `
        id,
        po_number,
        po_date,
        supplier_id,
        total_amount,
        status,
        suppliers(
          id,
          supplier_name
        ),
        purchase_order_items(
          id,
          product_id,
          batch_number,
          quantity_ordered,
          quantity_received,
          unit_cost,
          products(
            id,
            product_name,
            product_code,
            generic_name
          )
        )
      `,
      )
      .eq('company_id', companyId)
      .in('status', ['approved', 'received', 'partially_received'])
      .is('deleted_at', null)

    // storeIds from useScopeFilter drives area/store filtering
    if (storeIds !== undefined) {
      query = applyStoreFilter(query, storeIds)
    } else if (storeId) {
      query = query.eq('store_id', storeId)
    }

    if (supplierId) {
      query = query.eq('supplier_id', supplierId)
    }

    if (purchaseReturnDaysLimit) {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - purchaseReturnDaysLimit)
      query = query.gte('po_date', cutoffDate.toISOString().split('T')[0])
    }

    query = query.order('po_date', { ascending: false })

    const { data, error } = await query

    if (error) throw error

    return { data, error: null }
  } catch (error: any) {
    console.error('❌ Error fetching returnable POs:', error)
    return { data: null, error }
  }
}

/**
 * Create a new purchase return
 * ✅ UPDATED: Receives settings as parameter from Redux
 */
export const createPurchaseReturn = async (
  returnData: CreatePurchaseReturnData,
  companySettings: {
    allow_purchase_returns: boolean
    require_purchase_return_approval: boolean
    auto_restock_on_return: boolean
  },
): Promise<{
  data: { id: number } | null
  error: PostgrestError | null
}> => {
  try {
    if (!companySettings.allow_purchase_returns) {
      throw new Error('Purchase returns are disabled for this company')
    }

    // Generate return number if not provided
    if (!returnData.return_number) {
      const { data: lastReturn } = await supabase
        .from('purchase_returns')
        .select('return_number')
        .eq('company_id', returnData.company_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (lastReturn?.return_number) {
        const match = lastReturn.return_number.match(/\d+$/)
        const nextNum = match ? parseInt(match[0]) + 1 : 1
        returnData.return_number = `PR${String(nextNum).padStart(6, '0')}`
      } else {
        returnData.return_number = 'PR000001'
      }
    }

    const totalRefund = returnData.items.reduce(
      (sum, item) => sum + item.quantity_returned * item.unit_cost,
      0,
    )

    const requiresApproval =
      companySettings.require_purchase_return_approval === true

    console.log('🔍 Return Creation - Approval Check:', {
      require_purchase_return_approval:
        companySettings.require_purchase_return_approval,
      requiresApproval: requiresApproval,
      totalRefund: totalRefund,
    })

    const returnStatus = requiresApproval ? 'pending' : 'approved'
    const approvedBy = requiresApproval ? null : returnData.processed_by
    const approvedAt = requiresApproval ? null : new Date().toISOString()

    console.log('📝 Creating return with status:', returnStatus)

    const { data: returnRecord, error: returnError } = await supabase
      .from('purchase_returns')
      .insert([
        {
          company_id: returnData.company_id,
          store_id: returnData.store_id,
          supplier_id: returnData.supplier_id,
          purchase_order_id: returnData.purchase_order_id,
          return_number: returnData.return_number,
          return_date: returnData.return_date,
          return_reason: returnData.return_reason,
          total_refund_amount: totalRefund,
          refund_method: returnData.refund_method,
          status: returnStatus,
          notes: returnData.notes,
          processed_by: returnData.processed_by,
          approved_by: approvedBy,
          approved_at: approvedAt,
        },
      ])
      .select('id')
      .single()

    if (returnError) throw returnError

    console.log(
      '✅ Return record created:',
      returnRecord.id,
      'Status:',
      returnStatus,
    )

    const returnItems = returnData.items.map((item) => ({
      purchase_return_id: returnRecord.id,
      purchase_order_item_id: item.purchase_order_item_id,
      product_id: item.product_id,
      batch_id: item.batch_id,
      batch_number: item.batch_number,
      quantity_returned: item.quantity_returned,
      unit_cost: item.unit_cost,
      refund_amount: item.quantity_returned * item.unit_cost,
      reason: item.reason,
    }))

    const { error: itemsError } = await supabase
      .from('purchase_return_items')
      .insert(returnItems)

    if (itemsError) throw itemsError

    console.log('✅ Return items created')

    if (!requiresApproval) {
      // Auto-approved: use centralized DB function to process all side-effects atomically.
      // This handles: inventory reversal, quantity_returned tracking, PO status update,
      // expense credit creation, and supplier balance adjustment — all in one call.
      console.log(
        '🔄 Auto-approved: Processing via fn_process_purchase_return_approval...',
      )
      const { data: approvalResult, error: approvalError } = await supabase.rpc(
        'fn_process_purchase_return_approval',
        {
          p_return_id: returnRecord.id,
          p_approved_by: returnData.processed_by ?? null,
        },
      )

      if (approvalError) {
        console.error('❌ Error processing auto-approval:', approvalError)
        throw new Error(`Failed to process return: ${approvalError.message}`)
      }

      if (approvalResult && !approvalResult.success) {
        throw new Error(approvalResult.message || 'Return processing failed')
      }

      console.log(
        '✅ Return processed successfully (inventory reversed, PO status updated)',
      )
    } else {
      console.log(
        '⏸️ Return pending approval: Inventory/balance changes deferred until approval',
      )
    }

    return { data: returnRecord, error: null }
  } catch (error: any) {
    console.error('❌ Error creating purchase return:', error)
    return { data: null, error }
  }
}

/**
 * Update a purchase return
 */
export const updatePurchaseReturn = async (
  id: number,
  updates: UpdatePurchaseReturnData,
): Promise<{ error: PostgrestError | null }> => {
  try {
    const { error } = await supabase
      .from('purchase_returns')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (error) throw error

    return { error: null }
  } catch (error: any) {
    console.error('❌ Error updating purchase return:', error)
    return { error }
  }
}

/**
 * Reject a purchase return
 */
export const rejectPurchaseReturn = async (
  id: number,
  rejectedBy: number,
  rejectionReason: string,
): Promise<{ error: PostgrestError | null }> => {
  try {
    const { error } = await supabase
      .from('purchase_returns')
      .update({
        status: 'rejected',
        notes: rejectionReason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (error) throw error

    return { error: null }
  } catch (error: any) {
    console.error('❌ Error rejecting purchase return:', error)
    return { error }
  }
}

/**
 * Soft delete a purchase return
 */
export const deletePurchaseReturn = async (
  id: number,
): Promise<{ error: PostgrestError | null }> => {
  try {
    const { error } = await supabase
      .from('purchase_returns')
      .update({
        deleted_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (error) throw error

    return { error: null }
  } catch (error: any) {
    console.error('❌ Error deleting purchase return:', error)
    return { error }
  }
}

/**
 * Get suppliers (for dropdown/lookup)
 */
export const getSuppliers = async (companyId?: number) => {
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
    console.error('❌ Error fetching suppliers:', error)
    return { data: null, error }
  }
}

/**
 * Get stores (for dropdown/lookup)
 * ✅ UPDATED: Filter stores by selected area from Redux
 */
export const getStoresPurchaseReturn = async (companyId?: number) => {
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
    console.error('❌ Error fetching stores:', error)
    return { data: null, error }
  }
}

/**
 * Helper: Restock returned items using database function
 */
const restockReturnedItems = async (
  returnId: number,
  items: any[],
): Promise<void> => {
  for (const item of items) {
    if (item.batch_id) {
      const { error } = await supabase.rpc('increment_batch_quantity', {
        p_batch_id: item.batch_id,
        p_quantity: item.quantity_returned,
      })

      if (error) {
        console.error(`❌ Error restocking batch ${item.batch_id}:`, error)
        throw new Error(`Failed to restock batch: ${error.message}`)
      }
    }
  }
}

/**
 * Helper: Adjust supplier balance using database function
 */
const adjustSupplierBalanceForReturn = async (
  supplierId: number,
  returnAmount: number,
  returnId: number,
  operation: 'approve' | 'reject',
): Promise<void> => {
  const { error } = await supabase.rpc('adjust_supplier_balance_for_return', {
    p_supplier_id: supplierId,
    p_return_amount: returnAmount,
    p_return_id: returnId,
    p_operation: operation as string,
  })

  if (error) {
    console.error('❌ Error adjusting supplier balance:', error)
    throw new Error(`Failed to adjust supplier balance: ${error.message}`)
  }
}

/**
 * Approve purchase return using the centralized DB function.
 * fn_process_purchase_return_approval handles:
 *   - Inventory reversal (batch quantity_available ↑, quantity_received ↓)
 *   - quantity_returned tracking on PO items (idempotent)
 *   - PO status: 'returned' if fully returned, stays 'received' if partial
 *   - Expense credit record creation (negative expense to reverse purchase cost)
 *   - Supplier balance reduction
 */
export const approvePurchaseReturn = async (
  id: number,
  approvedBy: number,
  companyId: number,
): Promise<{ error: PostgrestError | null }> => {
  try {
    console.log('🔄 Starting approval process for return ID:', id)

    const { data, error } = await supabase.rpc(
      'fn_process_purchase_return_approval',
      {
        p_return_id: id,
        p_approved_by: approvedBy,
      },
    )

    if (error) {
      console.error('❌ Error calling approval function:', error)
      throw error
    }

    if (data && !data.success) {
      throw new Error(data.message || 'Approval failed')
    }

    console.log('✅ Return approved successfully:', data)
    return { error: null }
  } catch (error: any) {
    console.error('❌ Error approving purchase return:', error)
    return { error }
  }
}

/**
 * Get purchase return statistics from database view
 * ✅ UPDATED: Apply area/store filtering
 */
export const getPurchaseReturnStats = async (
  companyId: number,
  storeId?: number,
  storeIds?: number[] | null,
) => {
  try {
    console.log(
      '📊 Fetching purchase return stats from view for company:',
      companyId,
    )

    let query = supabase
      .from('vw_purchase_returns_stats')
      .select('*')
      .eq('company_id', companyId)

    // storeIds from useScopeFilter drives area/store filtering
    if (storeIds !== undefined) {
      query = applyStoreFilter(query, storeIds)
    } else if (storeId) {
      query = query.eq('store_id', storeId)
    }

    const { data, error } = await query

    if (error) {
      console.error('❌ Error fetching stats from view:', error)
      throw error
    }

    if (!data || data.length === 0) {
      console.log('📊 No stats found, returning zeros')
      return {
        stats: {
          total: 0,
          pending: 0,
          approved: 0,
          rejected: 0,
          completed: 0,
          totalRefundAmount: 0,
          totalPaid: 0,
          totalDue: 0,
          unpaid: 0,
          partiallyPaid: 0,
          paid: 0,
          overdue: 0,
        },
        error: null,
      }
    }

    // Aggregate stats if multiple rows (from area filtering)
    const aggregatedStats = data.reduce(
      (acc, row) => ({
        total: acc.total + (row.total || 0),
        pending: acc.pending + (row.pending || 0),
        approved: acc.approved + (row.approved || 0),
        rejected: acc.rejected + (row.rejected || 0),
        completed: acc.completed + (row.completed || 0),
        totalRefundAmount:
          acc.totalRefundAmount + parseFloat(row.total_refund_amount || 0),
        totalPaid: acc.totalPaid + parseFloat(row.total_paid || 0),
        totalDue: acc.totalDue + parseFloat(row.total_due || 0),
        unpaid: acc.unpaid + (row.unpaid || 0),
        partiallyPaid: acc.partiallyPaid + (row.partially_paid || 0),
        paid: acc.paid + (row.paid || 0),
        overdue: acc.overdue + (row.overdue || 0),
      }),
      {
        total: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
        completed: 0,
        totalRefundAmount: 0,
        totalPaid: 0,
        totalDue: 0,
        unpaid: 0,
        partiallyPaid: 0,
        paid: 0,
        overdue: 0,
      },
    )

    console.log(
      '✅ Successfully fetched purchase return stats:',
      aggregatedStats,
    )

    return { stats: aggregatedStats, error: null }
  } catch (error: any) {
    console.error('❌ Error in getPurchaseReturnStats:', error)
    return {
      stats: {
        total: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
        completed: 0,
        totalRefundAmount: 0,
        totalPaid: 0,
        totalDue: 0,
        unpaid: 0,
        partiallyPaid: 0,
        paid: 0,
        overdue: 0,
      },
      error,
    }
  }
}

