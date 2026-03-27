// src/pages/FastMovingItems/data/fastMovingItems.queries.ts - UPDATED TO USE view_fast_moving_stock
import { supabase } from '@app/core/supabase/Supabase.utils'
import { PostgrestError } from '@supabase/supabase-js'
import {
  FastMovingItem,
  FastMovingItemStats,
} from '../types/fastMovingItems.types'
import { CompanySettings } from '@shared/types/companySettings'
import { applyRestrictedFilter } from '@shared/utils/restrictedFilter.utils'

export interface GetFastMovingItemsOptions {
  page?: number
  pageSize?: number
  searchQuery?: string
  storeId?: string | number | null
  categoryId?: string | number | null
  periodDays?: number
  minVelocity?: number
  companyId?: string | number | null
  settings?: CompanySettings | null
}

export interface GetFastMovingItemsResponse {
  data: FastMovingItem[] | null
  error: PostgrestError | null
  count: number | null
}

/**
 * Get fast moving items statistics using view_fast_moving_stock
 */
export const getFastMovingItemsStats = async (
  companyId: number,
  periodDays: number = 30,
  storeId?: string | number | null,
): Promise<{
  data: FastMovingItemStats | null
  error: any
}> => {
  try {
    let query = supabase
      .from('view_fast_moving_stock')
      .select('*', { count: 'exact' })
      .eq('company_id', companyId)

    // Filter by store if provided
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

    const { data, error, count } = await query

    if (error) {
      throw error
    }

    // Calculate statistics from the view data
    const totalProducts = count || 0
    const totalQuantitySold =
      data?.reduce((sum, item) => {
        // Use the appropriate period based on periodDays
        if (periodDays <= 30) {
          return sum + (item.qty_sold_30d || 0)
        } else if (periodDays <= 60) {
          return sum + (item.qty_sold_60d || 0)
        } else {
          return sum + (item.qty_sold_90d || 0)
        }
      }, 0) || 0

    const totalRevenue =
      data?.reduce((sum, item) => {
        // Use the appropriate period based on periodDays
        if (periodDays <= 30) {
          return sum + (item.revenue_30d || 0)
        } else if (periodDays <= 60) {
          return sum + (item.revenue_60d || 0)
        } else {
          return sum + (item.revenue_90d || 0)
        }
      }, 0) || 0

    const avgVelocity =
      data?.reduce((sum, item) => {
        // Use the appropriate period based on periodDays
        if (periodDays <= 30) {
          return sum + (item.avg_daily_sales_30d || 0)
        } else if (periodDays <= 60) {
          return sum + (item.avg_daily_sales_60d || 0)
        } else {
          return sum + (item.avg_daily_sales_90d || 0)
        }
      }, 0) / (totalProducts || 1) || 0

    return {
      data: {
        totalProducts,
        totalQuantitySold,
        totalRevenue,
        avgVelocity: parseFloat(avgVelocity.toFixed(2)),
      },
      error: null,
    }
  } catch (error) {
    console.error('Error fetching fast moving items stats:', error)
    return {
      data: {
        totalProducts: 0,
        totalQuantitySold: 0,
        totalRevenue: 0,
        avgVelocity: 0,
      },
      error,
    }
  }
}

/**
 * Get fast moving items with filtering, pagination, and search using view_fast_moving_stock
 */
export const getFastMovingItems = async ({
  page = 1,
  pageSize = 10,
  searchQuery = '',
  storeId = null,
  categoryId = null,
  periodDays = 30,
  minVelocity = 0,
  companyId = null,
  settings = null,
  isUnlocked = false,
}: GetFastMovingItemsOptions & {
  isUnlocked?: boolean
} = {}): Promise<GetFastMovingItemsResponse> => {
  try {
    // Build query using the view_fast_moving_stock view
    let query = supabase
      .from('view_fast_moving_stock')
      .select('*', { count: 'exact' })

    // Apply restricted filter
    query = applyRestrictedFilter(query, isUnlocked)

    // Company filter
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

    // Store filter
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

    // Category filter
    if (
      categoryId !== null &&
      categoryId !== undefined &&
      categoryId !== '' &&
      categoryId !== 'all'
    ) {
      const parsedCategoryId =
        typeof categoryId === 'string' ? parseInt(categoryId, 10) : categoryId
      if (!isNaN(parsedCategoryId)) {
        query = query.eq('category_id', parsedCategoryId)
      }
    }

    // Search filter
    if (searchQuery && searchQuery.trim()) {
      const searchTerm = searchQuery.trim()
      query = query.or(
        `product_name.ilike.%${searchTerm}%,product_code.ilike.%${searchTerm}%`,
      )
    }

    // Filter by minimum velocity based on period
    if (minVelocity > 0) {
      if (periodDays <= 30) {
        query = query.gte('avg_daily_sales_30d', minVelocity / 10)
      } else if (periodDays <= 60) {
        query = query.gte('avg_daily_sales_60d', minVelocity / 10)
      } else {
        query = query.gte('avg_daily_sales_90d', minVelocity / 10)
      }
    }

    // Filter by reorder urgency if needed (only show items that need attention)
    // Uncomment if you want to filter out items that don't need reordering
    // query = query.in('reorder_urgency', ['URGENT', 'SOON', 'NORMAL'])

    // Filter out negative stock items if not allowed (using Redux settings)
    if (settings && !settings.allow_negative_stock) {
      query = query.gte('current_stock', 0)
    }

    // Pagination
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1
    query = query.range(from, to)

    // Order by velocity (highest first) based on period
    if (periodDays <= 30) {
      query = query.order('avg_daily_sales_30d', { ascending: false })
    } else if (periodDays <= 60) {
      query = query.order('avg_daily_sales_60d', { ascending: false })
    } else {
      query = query.order('avg_daily_sales_90d', { ascending: false })
    }

    const { data, error, count } = await query

    if (error) throw error

    // Transform view data to FastMovingItem format
    const transformedData: FastMovingItem[] = (data || []).map((item: any) => {
      // Select the appropriate period data
      let qty_sold = 0
      let revenue = 0
      let avg_daily_sales = 0
      let transactions = 0

      if (periodDays <= 30) {
        qty_sold = item.qty_sold_30d || 0
        revenue = item.revenue_30d || 0
        avg_daily_sales = item.avg_daily_sales_30d || 0
        transactions = item.transactions_30d || 0
      } else if (periodDays <= 60) {
        qty_sold = item.qty_sold_60d || 0
        revenue = item.revenue_60d || 0
        avg_daily_sales = item.avg_daily_sales_60d || 0
        transactions = item.transactions_60d || 0
      } else {
        qty_sold = item.qty_sold_90d || 0
        revenue = item.revenue_90d || 0
        avg_daily_sales = item.avg_daily_sales_90d || 0
        transactions = item.transactions_90d || 0
      }

      // Calculate velocity score (normalized)
      const velocity_score = avg_daily_sales * 10

      return {
        id: item.product_id,
        product_id: item.product_id,
        product_name: item.product_name || 'Unknown',
        product_code: item.product_code || 'N/A',
        category_id: item.category_id,
        category_name: item.category_name || 'Uncategorized',
        unit_id: item.unit_id,
        unit_name: item.unit_name || 'Unit',
        store_id: item.store_id,
        store_name: item.store_name || 'Unknown Store',
        total_quantity_sold: qty_sold,
        total_sales_amount: revenue,
        transaction_count: transactions,
        avg_sale_price: qty_sold > 0 ? revenue / qty_sold : 0,
        current_stock_level: item.current_stock || 0,
        reorder_level: item.reorder_level,
        velocity_score: velocity_score,
        period_days: periodDays,
        items_per_day: avg_daily_sales,
        last_sale_date: item.last_updated, // Using last_updated from view as proxy
      }
    })

    return {
      data: transformedData,
      error: null,
      count: count || 0,
    }
  } catch (error) {
    console.error('Error in getFastMovingItems query:', error)
    return {
      data: null,
      error: error as PostgrestError,
      count: null,
    }
  }
}

/**
 * Get product stock level from view (no longer needs separate query)
 * This is now included in the view_fast_moving_stock view
 */
export const getProductStockLevel = async (
  productId: number,
  storeId: number | undefined,
  allowNegative: boolean = false,
): Promise<number> => {
  try {
    let query = supabase
      .from('view_fast_moving_stock')
      .select('current_stock')
      .eq('product_id', productId)

    if (storeId) {
      query = query.eq('store_id', storeId)
    }

    const { data, error } = await query.single()

    if (error) throw error

    const stock = data?.current_stock || 0

    // Return 0 instead of negative if not allowed
    if (!allowNegative && stock < 0) {
      return 0
    }

    return stock
  } catch (error) {
    console.error('Error getting stock level:', error)
    return 0
  }
}

