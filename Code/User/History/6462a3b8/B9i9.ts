// src/pages/SalesReturns/data/salesReturn.queries.ts - UPDATED WITH AREA/STORE FILTERING

import { supabase } from '@app/core/supabase/Supabase.utils'
import { PostgrestError } from '@supabase/supabase-js'
import { SalesReturn, SalesReturnFilters } from '../types/salesReturn.types'
import { store } from '@app/core/store/store' // ✅ Import Redux store
import { applyRestrictedFilter } from '@shared/utils/restrictedFilter.utils'

/**
 * ✅ NEW: Get current selection from Redux
 */
const getCurrentSelection = () => {
  const state = store.getState()
  return {
    selectedArea: state.areaStore?.selectedArea,
    selectedStore: state.areaStore?.selectedStore,
  }
}

/**
 * ✅ NEW: Apply area/store filtering to query
 */
const applySelectionFilter = (query: any) => {
  const { selectedArea, selectedStore } = getCurrentSelection()

  // Priority 1: If store is selected, filter by that specific store
  if (selectedStore) {
    console.log('🏪 Filtering by selected store:', selectedStore.store_name)
    return query.eq('store_id', selectedStore.id)
  }

  // Priority 2: If area is selected, filter by stores in that area
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

  // No selection: show all
  console.log('🌍 No area/store selected - showing all')
  return query
}

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
  applyFilter: boolean = true,
): Promise<number> => {
  try {
    let query = supabase
      .from('sales_returns')
      .select('*', { count: 'exact', head: true })
      .is('deleted_at', null)
      .eq('status', status)

    // ✅ Apply area/store filter if requested
    if (applyFilter) {
      query = applySelectionFilter(query)
    }

    const { count, error } = await query

    if (error) {
      console.warn(
        `⚠️ [safeCount] Failed to count status="${status}":`,
        error.message || error,
      )
      return 0
    }
    return count || 0
  } catch (err) {
    console.warn(`⚠️ [safeCount] Exception counting status="${status}":`, err)
    return 0
  }
}

export const getSalesReturnStats = async (): Promise<{
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

    // ✅ Apply area/store filter
    totalQuery = applySelectionFilter(totalQuery)

    const { count: totalCount, error: totalError } = await totalQuery

    if (totalError) {
      console.error('❌ [getSalesReturnStats] totalCount failed:', totalError)
      throw totalError
    }

    // Each status counted individually — if one fails it returns 0, not crash
    const [pendingCount, approvedCount, completedCount, cancelledCount] =
      await Promise.all([
        safeCount('pending'),
        safeCount('approved'),
        safeCount('completed'),
        safeCount('cancelled'),
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

    totalRefundQuery = applySelectionFilter(totalRefundQuery)

    const { data: totalRefundData, error: totalRefundError } =
      await totalRefundQuery

    let pendingRefundQuery = supabase
      .from('sales_returns')
      .select('total_refund_amount')
      .is('deleted_at', null)
      .eq('status', 'pending')

    pendingRefundQuery = applySelectionFilter(pendingRefundQuery)

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
        profiles!sales_returns_processed_by_fkey(first_name, last_name),
        sales_return_items!sales_return_items_sales_return_id_fkey(id)
      `,
        { count: 'exact' },
      )
      .is('deleted_at', null)

    // Apply restricted filter
    query = applyRestrictedFilter(query, isUnlocked)

    // ✅ Apply Redux selection if no explicit storeId provided
    if (!storeId) {
      query = applySelectionFilter(query)
    } else {
      // Explicit storeId in params overrides Redux selection
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
    if (paymentStatus !== 'all') {
      query = query.eq('sales.payment_status', paymentStatus)
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
  return await supabase
    .from('customers')
    .select('id, first_name, last_name, phone')
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('first_name', { ascending: true })
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

