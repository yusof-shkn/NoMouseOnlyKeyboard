// src/pages/LowStock/data/lowStock.queries.ts - UPDATED TO USE view_low_stock (NO SETTINGS QUERIES)
import { supabase } from '@app/core/supabase/Supabase.utils'
import { PostgrestError } from '@supabase/supabase-js'
import { LowStockItem, LowStockFilters } from '../types/lowStock.types'
import { applyRestrictedFilter } from '@shared/utils/restrictedFilter.utils'

export interface GetLowStockResponse {
  data: LowStockItem[] | null
  error: PostgrestError | null
  count: number | null
}

/**
 * Get low stock statistics from view_low_stock
 * No company settings needed - all logic is in the database view
 */
export const getLowStockStats = async (
  companyId: number | undefined,
): Promise<{
  data: {
    total: number
    critical: number
    high: number
    medium: number
    totalValue: number
  } | null
  error: any
}> => {
  try {
    let query = supabase
      .from('view_low_stock')
      .select('*', { count: 'exact', head: false })

    if (companyId) {
      query = query.eq('company_id', companyId)
    }

    const { data, error, count } = await query

    if (error) throw error

    if (!data || data.length === 0) {
      return {
        data: { total: 0, critical: 0, high: 0, medium: 0, totalValue: 0 },
        error: null,
      }
    }

    // Calculate statistics from view results
    const stats = {
      total: count || 0,
      critical: data.filter((item: any) => item.priority_level === 1).length,
      high: data.filter((item: any) => item.priority_level === 2).length,
      medium: data.filter((item: any) => item.priority_level === 3).length,
      totalValue: data.reduce(
        (sum: number, item: any) =>
          sum + (parseFloat(item.estimated_order_cost) || 0),
        0,
      ),
    }

    return {
      data: stats,
      error: null,
    }
  } catch (error) {
    console.error('Error fetching low stock stats:', error)
    return {
      data: { total: 0, critical: 0, high: 0, medium: 0, totalValue: 0 },
      error,
    }
  }
}

/**
 * Calculate urgency level from priority_level (1-4)
 */
const mapPriorityToUrgency = (
  priority: number,
): 'critical' | 'high' | 'medium' | 'low' => {
  switch (priority) {
    case 1:
      return 'critical'
    case 2:
      return 'high'
    case 3:
      return 'medium'
    case 4:
    default:
      return 'low'
  }
}

/**
 * Get low stock items with filtering and pagination using view_low_stock
 */
export const getLowStockItems = async ({
  page = 1,
  pageSize = 10,
  searchQuery = '',
  urgencyLevel = 'all',
  storeId = null,
  categoryId = null,
  companyId = null,
  isUnlocked = false,
}: LowStockFilters & {
  isUnlocked?: boolean
} = {}): Promise<GetLowStockResponse> => {
  try {
    let query = supabase.from('view_low_stock').select('*', { count: 'exact' })

    // Apply restricted filter
    query = applyRestrictedFilter(query, isUnlocked)

    if (
      companyId !== null &&
      companyId !== undefined &&
      companyId !== '' &&
      companyId !== 'all'
    ) {
      const parsedCompanyId =
        typeof companyId === 'string' ? parseInt(companyId, 10) : companyId
      if (!isNaN(parsedCompanyId)) {
        query = query.eq('company_id', parsedCompanyId)
      }
    }

    if (
      storeId !== null &&
      storeId !== undefined &&
      storeId !== '' &&
      storeId !== 'all'
    ) {
      const parsedStoreId =
        typeof storeId === 'string' ? parseInt(storeId, 10) : storeId
      if (!isNaN(parsedStoreId)) {
        query = query.eq('store_id', parsedStoreId)
      }
    }

    if (
      categoryId !== null &&
      categoryId !== undefined &&
      categoryId !== '' &&
      categoryId !== 'all'
    ) {
      query = query.eq('category_name', categoryId)
    }

    if (urgencyLevel && urgencyLevel !== 'all') {
      let priorityLevel: number
      switch (urgencyLevel) {
        case 'critical':
          priorityLevel = 1
          break
        case 'high':
          priorityLevel = 2
          break
        case 'medium':
          priorityLevel = 3
          break
        case 'low':
          priorityLevel = 4
          break
        default:
          priorityLevel = 0
      }
      if (priorityLevel > 0) {
        query = query.eq('priority_level', priorityLevel)
      }
    }

    if (searchQuery && searchQuery.trim()) {
      const searchTerm = searchQuery.trim()
      query = query.or(
        `product_name.ilike.%${searchTerm}%,product_code.ilike.%${searchTerm}%,generic_name.ilike.%${searchTerm}%,barcode.ilike.%${searchTerm}%`,
      )
    }

    query = query.eq('is_active', true)
    query = query.order('priority_level', { ascending: true })
    query = query.order('current_stock', { ascending: true })

    const { data, error, count } = await query

    if (error) throw error

    const lowStockItems: LowStockItem[] = (data || []).map((item: any) => ({
      id: item.product_id,
      product_id: item.product_id,
      product_name: item.product_name,
      product_code: item.product_code,
      generic_name: item.generic_name,
      category_name: item.category_name,
      store_id: item.store_id,
      store_name: item.store_name,
      store_code: item.store_name,
      batch_number: `${item.active_batches_count || 0} batches`,
      current_quantity: item.current_stock || 0,
      reorder_level: item.reorder_level || 0,
      unit_name: item.unit_name || 'Units',
      unit_short_code: item.unit_short_code || 'U',
      supplier_name: undefined,
      last_purchase_date: item.last_purchase_date,
      last_sale_date: undefined,
      expiry_date: undefined,
      days_to_expiry:
        item.days_out_of_stock > 0 ? undefined : item.days_out_of_stock,
      urgency_level: mapPriorityToUrgency(item.priority_level),
      is_active: item.is_active,
      created_at: item.last_updated || new Date().toISOString(),
      updated_at: item.last_updated || new Date().toISOString(),
      barcode: item.barcode,
      manufacturer: item.manufacturer,
      max_stock_level: item.max_stock_level,
      min_order_quantity: item.min_order_quantity,
      stock_status: item.stock_status,
      suggested_order_quantity: item.suggested_order_quantity,
      standard_cost: item.standard_cost,
      standard_price: item.standard_price,
      estimated_order_cost: item.estimated_order_cost,
      priority_level: item.priority_level,
      active_batches_count: item.active_batches_count,
      days_out_of_stock: item.days_out_of_stock,
      requires_prescription: item.requires_prescription,
      is_controlled_substance: item.is_controlled_substance,
    }))

    const totalCount = count || 0
    const paginatedItems = lowStockItems.slice(
      (page - 1) * pageSize,
      page * pageSize,
    )

    return {
      data: paginatedItems,
      error: null,
      count: totalCount,
    }
  } catch (error) {
    console.error('Error in getLowStockItems query:', error)
    return {
      data: null,
      error: error as PostgrestError,
      count: null,
    }
  }
}

