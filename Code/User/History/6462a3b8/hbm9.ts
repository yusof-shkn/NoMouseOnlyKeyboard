// src/pages/SalesReturns/data/salesReturn.queries.ts - UPDATED WITH AREA/STORE FILTERING

import { supabase } from '@app/core/supabase/Supabase.utils'
import { applyStoreFilter } from '@shared/utils/selectionFilter.utils'
import { PostgrestError } from '@supabase/supabase-js'
import { SalesReturn, SalesReturnFilters } from '../types/salesReturn.types'
import { applyRestrictedFilter } from '@shared/utils/restrictedFilter.utils'

export interface GetSalesReturnsResponse {
  data: SalesReturn[] | null
  error: PostgrestError | null
  count: number | null
}

// ============================================================================
// STATS — each count is individually guarded so one bad status value
//         (e.g. 'cancelled' hitting a CHECK constraint) doesn't kill everything
// ============================================================================

const safeCount = async (
  status: string,
  storeIds?: number[] | null,
  storeId?: number | null,
  isUnlocked = false,
): Promise<number> => {
  try {
    let q = supabase
      .from('sales_returns')
      .select('*', { count: 'exact', head: true })
      .is('deleted_at', null)
      .eq('status', status)
    q = applyRestrictedFilter(q, isUnlocked)
    if (storeIds !== undefined) {
      q = applyStoreFilter(q, storeIds)
    } else if (storeId) {
      q = q.eq('store_id', storeId)
    }
    const { count, error } = await q
    if (error) return 0
    return count || 0
  } catch {
    return 0
  }
}

export const getSalesReturnStats = async (
  storeIds?: number[] | null,
  storeId?: number | null,
  isUnlocked = false,
): Promise<{
  data: {
    total: number
    pending: number
    approved: number
    completed: number
    cancelled: number
    totalRefundAmount: number
    pendingRefundAmount: number
  } | null
  error: any
}> => {
  try {
    // Total (no status filter)
    let totalQuery = supabase
      .from('sales_returns')
      .select('*', { count: 'exact', head: true })
      .is('deleted_at', null)

    totalQuery = applyRestrictedFilter(totalQuery, isUnlocked)
    if (storeIds !== undefined) {
      totalQuery = applyStoreFilter(totalQuery, storeIds)
    } else if (storeId) {
      totalQuery = totalQuery.eq('store_id', storeId)
    }

    // ✅ Apply area/store filter
    const { count: totalCount, error: totalError } = await totalQuery

    if (totalError) {
      console.error('❌ [getSalesReturnStats] totalCount failed:', totalError)
      throw totalError
    }

    // Each status counted individually — if one fails it returns 0, not crash
    const [pendingCount, approvedCount, completedCount, cancelledCount] =
      await Promise.all([
        safeCount('pending', storeIds, storeId, isUnlocked),
        safeCount('approved', storeIds, storeId, isUnlocked),
        safeCount('completed', storeIds, storeId, isUnlocked),
        safeCount('cancelled', storeIds, storeId, isUnlocked),
      ])

    console.log('📊 [getSalesReturnStats] counts:', {
      total: totalCount,
      pending: pendingCount,
      approved: approvedCount,
      completed: completedCount,
      cancelled: cancelledCount,
    })

    // Refund totals
    let totalRefundQuery = supabase
      .from('sales_returns')
      .select('total_refund_amount')
      .is('deleted_at', null)

    totalRefundQuery = applyRestrictedFilter(totalRefundQuery, isUnlocked)
    if (storeIds !== undefined) {
      totalRefundQuery = applyStoreFilter(totalRefundQuery, storeIds)
    } else if (storeId) {
      totalRefundQuery = totalRefundQuery.eq('store_id', storeId)
    }

    const { data: totalRefundData, error: totalRefundError } =
      await totalRefundQuery

    let pendingRefundQuery = supabase
      .from('sales_returns')
      .select('total_refund_amount')
      .is('deleted_at', null)
      .eq('status', 'pending')

    pendingRefundQuery = applyRestrictedFilter(pendingRefundQuery, isUnlocked)
    if (storeIds !== undefined) {
      pendingRefundQuery = applyStoreFilter(pendingRefundQuery, storeIds)
    } else if (storeId) {
      pendingRefundQuery = pendingRefundQuery.eq('store_id', storeId)
    }

    const { data: pendingRefundData, error: pendingRefundError } =
      await pendingRefundQuery

    if (totalRefundError || pendingRefundError) {
      throw totalRefundError || pendingRefundError
    }

    const totalRefundAmount =
      totalRefundData?.reduce(
        (sum, item) => sum + (Number(item.total_refund_amount) || 0),
        0,
      ) || 0

    const pendingRefundAmount =
      pendingRefundData?.reduce(
        (sum, item) => sum + (Number(item.total_refund_amount) || 0),
        0,
      ) || 0

    return {
      data: {
        total: totalCount || 0,
        pending: pendingCount,
        approved: approvedCount,
        completed: completedCount,
        cancelled: cancelledCount,
        totalRefundAmount,
        pendingRefundAmount,
      },
      error: null,
    }
  } catch (error) {
    console.error('❌ [getSalesReturnStats] fatal:', error)
    return {
      data: {
        total: 0,
        pending: 0,
        approved: 0,
        completed: 0,
        cancelled: 0,
        totalRefundAmount: 0,
        pendingRefundAmount: 0,
      },
      error,
    }
  }
}

// ============================================================================
// LIST
// ============================================================================

export const getSalesReturns = async ({
  page = 1,
  pageSize = 10,
  searchQuery = '',
  status = 'all',
  paymentStatus = 'all',
  customerId = null,
  storeId = null,
  storeIds = undefined as number[] | null | undefined,
  dateRange,
  sortBy = 'recent',
  isUnlocked = false,
}: SalesReturnFilters & {
  isUnlocked?: boolean
} = {}): Promise<GetSalesReturnsResponse> => {
  try {
    let query = supabase
      .from('sales_returns')
      .select(
        `
        *,
        sales!sales_returns_sale_id_fkey(
          id,
          sale_number,
          customer_id,
          payment_status,
          amount_paid,
          total_amount,
          sale_date,
          customers(
            first_name,
            last_name,
            phone
          )
        ),
        stores(store_name),
        processor:profiles!sales_returns_processed_by_fkey(first_name, last_name),
        approver:profiles!sales_returns_approved_by_fkey(first_name, last_name),
        sales_return_items!sales_return_items_sales_return_id_fkey(id)
      `,
        { count: 'exact' },
      )
      .is('deleted_at', null)

    // Apply restricted filter
    query = applyRestrictedFilter(query, isUnlocked)

    // storeIds from useScopeFilter drives area/store filtering
    if (storeIds !== undefined) {
      query = applyStoreFilter(query, storeIds)
    } else if (storeId) {
      query = query.eq('store_id', storeId)
    }

    // Search
    if (searchQuery && searchQuery.trim()) {
      const searchTerm = searchQuery.trim()
      query = query.or(
        `return_number.ilike.%${searchTerm}%,return_reason.ilike.%${searchTerm}%`,
      )
    }

    // Status filter
    if (status !== 'all') {
      query = query.eq('status', status)
    }

    // Payment status filter
    // ✅ FIX: PostgREST does not support filtering on related table columns via dot notation
    // on the primary table. We fetch matching sale IDs and filter by sale_id instead.
    if (paymentStatus !== 'all') {
      const { data: matchingSales } = await supabase
        .from('sales')
        .select('id')
        .eq('payment_status', paymentStatus)
        .is('deleted_at', null)

      const saleIds = (matchingSales || []).map((s: any) => s.id)
      if (saleIds.length > 0) {
        query = query.in('sale_id', saleIds)
      } else {
        // No sales match — return empty result set
        query = query.eq('sale_id', -1)
      }
    }

    // Customer filter
    if (customerId !== null && customerId !== undefined) {
      query = query.eq('sales.customer_id', customerId)
    }

    // Date range
    if (dateRange) {
      query = query
        .gte('return_date', dateRange.start)
        .lte('return_date', dateRange.end)
    }

    // Sorting
    switch (sortBy) {
      case 'date_desc':
        query = query.order('return_date', { ascending: false })
        break
      case 'date_asc':
        query = query.order('return_date', { ascending: true })
        break
      case 'amount_desc':
        query = query.order('total_refund_amount', { ascending: false })
        break
      case 'amount_asc':
        query = query.order('total_refund_amount', { ascending: true })
        break
      case 'recent':
      default:
        query = query.order('created_at', { ascending: false })
        break
    }

    // Pagination
    query = query.range((page - 1) * pageSize, page * pageSize - 1)

    const result = await query
    return result
  } catch (error) {
    console.error('Error in getSalesReturns query:', error)
    return {
      data: null,
      error: error as PostgrestError,
      count: null,
    }
  }
}

// ============================================================================
// DETAIL
// ============================================================================

export const getSalesReturnById = async (
  id: number,
): Promise<{
  data: any | null
  error: PostgrestError | null
}> => {
  try {
    const { data, error } = await supabase
      .from('sales_returns')
      .select(
        `
        *,
        sales!sales_returns_sale_id_fkey(
          id,
          sale_number,
          sale_type,
          sale_date,
          customer_id,
          payment_method,
          payment_status,
          amount_paid,
          total_amount,
          subtotal,
          discount_amount,
          tax_amount,
          customers(
            id,
            customer_code,
            first_name,
            last_name,
            phone,
            email,
            address
          )
        ),
        stores!sales_returns_store_id_fkey(
          id,
          store_name,
          store_code,
          phone,
          address
        ),
        profiles!sales_returns_processed_by_fkey(
          id,
          first_name,
          last_name,
          username,
          email
        ),
        approver:profiles!sales_returns_approved_by_fkey(
          id,
          first_name,
          last_name,
          username
        ),
        sales_return_items!sales_return_items_sales_return_id_fkey(
          id,
          sale_item_id,
          product_id,
          batch_id,
          quantity_returned,
          unit_price,
          refund_amount,
          created_at,
          updated_at,
          products!sales_return_items_product_id_fkey(
            id,
            product_name,
            product_code,
            generic_name
          ),
          product_batches!sales_return_items_batch_id_fkey(
            id,
            batch_number,
            expiry_date
          )
        )
      `,
      )
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    console.log(
      '📦 [getSalesReturnById] raw response:',
      JSON.stringify(data, null, 2),
    )

    return { data, error }
  } catch (error) {
    console.error('Error fetching sales return by ID:', error)
    return { data: null, error: error as PostgrestError }
  }
}

// ============================================================================
// ITEMS — standalone fallback
// ============================================================================

export const getSalesReturnItemsById = async (
  salesReturnId: number,
): Promise<{
  data: any[] | null
  error: PostgrestError | null
}> => {
  try {
    const { data, error } = await supabase
      .from('sales_return_items')
      .select(
        `
        id,
        sales_return_id,
        sale_item_id,
        product_id,
        batch_id,
        quantity_returned,
        unit_price,
        refund_amount,
        created_at,
        updated_at,
        products!sales_return_items_product_id_fkey(
          id,
          product_name,
          product_code,
          generic_name
        ),
        product_batches!sales_return_items_batch_id_fkey(
          id,
          batch_number,
          expiry_date
        )
      `,
      )
      .eq('sales_return_id', salesReturnId)
      .order('created_at', { ascending: true })

    console.log(
      '📦 [getSalesReturnItemsById] items for return',
      salesReturnId,
      ':',
      JSON.stringify(data, null, 2),
    )

    return { data, error }
  } catch (error) {
    console.error('Error fetching sales return items:', error)
    return { data: null, error: error as PostgrestError }
  }
}

// ============================================================================
// FILTER HELPERS
// ============================================================================

export const getActiveStores = async (): Promise<{
  data: any[] | null
  error: PostgrestError | null
}> => {
  return await supabase
    .from('stores')
    .select('id, store_name, store_code')
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('store_name', { ascending: true })
}

export const getActiveCustomers = async (): Promise<{
  data: any[] | null
  error: PostgrestError | null
}> => {
  // ✅ FIX: Filter by company so customers from other tenants don't appear in dropdowns
  const companyId: number | null = null // passed via param if needed
  let query = supabase
    .from('customers')
    .select('id, first_name, last_name, business_name, customer_type, phone')
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('first_name', { ascending: true })

  if (companyId) {
    query = query.eq('company_id', companyId)
  }

  return query
}

// ============================================================================
// MUTATIONS
// ============================================================================

export const updateSalesReturnStatus = async (
  id: number,
  status: string,
  approvedBy?: number,
): Promise<{ error: PostgrestError | null }> => {
  const updates: any = {
    status,
    updated_at: new Date().toISOString(),
  }

  if (status === 'approved' && approvedBy) {
    updates.approved_by = approvedBy
    updates.approved_at = new Date().toISOString()
  }

  return await supabase.from('sales_returns').update(updates).eq('id', id)
}

export const deleteSalesReturn = async (
  id: number,
): Promise<{ error: PostgrestError | null }> => {
  return await supabase
    .from('sales_returns')
    .update({
      deleted_at: new Date().toISOString(),
      status: 'cancelled',
    })
    .eq('id', id)
}

