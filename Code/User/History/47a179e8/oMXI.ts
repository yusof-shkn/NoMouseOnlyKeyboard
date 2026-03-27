// data/stockListQueries.ts - UPDATED TO USE NEW DATABASE VIEWS

import { supabase } from '@app/core/supabase/Supabase.utils'
import { applyStoreFilter } from '@shared/utils/selectionFilter.utils'
import { CompanySettings } from '@shared/types/companySettings'
import { applyRestrictedFilter } from '@shared/utils/restrictedFilter.utils'

export interface StockListQueryParams {
  page?: number
  pageSize?: number
  searchQuery?: string
  status?: string
  stockLevel?: string
  expiryStatus?: string
  companyId?: number
  storeId?: number
  storeIds?: number[] | null
  categoryId?: number
  isUnlocked?: boolean
}

/**
 * Main stock list fetch using view_inventory from database
 * This replaces the old batch-based query with the optimized inventory view
 */
export const fetchStockList = async (
  params: StockListQueryParams = {},
  companySettings: CompanySettings | null,
) => {
  const {
    page = 1,
    pageSize = 10,
    searchQuery = '',
    status = 'all',
    stockLevel = 'all',
    expiryStatus = 'all',
    companyId,
    storeId,
    storeIds,
    categoryId,
    isUnlocked = false,
  } = params

  try {
    // Build query on view_inventory (comprehensive inventory summary)
    let query = supabase.from('view_inventory').select('*', { count: 'exact' })

    // Apply restricted filter
    query = applyRestrictedFilter(query, isUnlocked)

    // Apply company filter
    if (companyId) {
      query = query.eq('company_id', companyId)
    }

    // Apply store filter — storeIds drives area/store selection; storeId is fallback
    if (storeIds !== undefined) {
      query = applyStoreFilter(query, storeIds)
    } else if (storeId) {
      query = query.eq('store_id', storeId)
    }

    // Apply category filter
    if (categoryId) {
      query = query.eq('category_id', categoryId)
    }

    // Apply search filter
    if (searchQuery) {
      query = query.or(
        `product_name.ilike.%${searchQuery}%,` +
          `product_code.ilike.%${searchQuery}%,` +
          `barcode.ilike.%${searchQuery}%,` +
          `generic_name.ilike.%${searchQuery}%`,
      )
    }

    // Apply status filter
    if (status !== 'all') {
      query = query.eq('stock_status', status.toUpperCase())
    }

    // Apply stock level filter
    if (stockLevel !== 'all') {
      if (stockLevel === 'out_of_stock') {
        query = query.eq('total_quantity_available', 0)
      } else if (stockLevel === 'in_stock') {
        query = query.gt('total_quantity_available', 0)
      } else if (stockLevel === 'low_stock') {
        query = query.eq('stock_status', 'LOW_STOCK')
      }
    }

    // Apply expiry status filter
    if (expiryStatus !== 'all') {
      if (expiryStatus === 'expired') {
        query = query.gt('expired_batches', 0)
      } else if (expiryStatus === 'critical' && companySettings) {
        query = query
          .lte(
            'days_to_earliest_expiry',
            companySettings.near_expiry_critical_days,
          )
          .gt('days_to_earliest_expiry', 0)
      } else if (expiryStatus === 'expiring_soon' && companySettings) {
        query = query
          .lte(
            'days_to_earliest_expiry',
            companySettings.near_expiry_warning_days,
          )
          .gt(
            'days_to_earliest_expiry',
            companySettings.near_expiry_critical_days,
          )
      } else if (expiryStatus === 'valid' && companySettings) {
        query = query.gt(
          'days_to_earliest_expiry',
          companySettings.near_expiry_warning_days,
        )
      }
    }

    // Get total count — must apply the same filters as the data query
    // (especially restricted filter) so pagination is accurate
    let countQuery = supabase
      .from('view_inventory')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId || 0)

    countQuery = applyRestrictedFilter(countQuery, isUnlocked)

    if (storeIds !== undefined) {
      countQuery = applyStoreFilter(countQuery, storeIds)
    } else if (storeId) {
      countQuery = countQuery.eq('store_id', storeId)
    }

    if (categoryId) {
      countQuery = countQuery.eq('category_id', categoryId)
    }

    if (searchQuery) {
      countQuery = countQuery.or(
        `product_name.ilike.%${searchQuery}%,` +
          `product_code.ilike.%${searchQuery}%,` +
          `barcode.ilike.%${searchQuery}%,` +
          `generic_name.ilike.%${searchQuery}%`,
      )
    }

    if (status !== 'all') {
      countQuery = countQuery.eq('stock_status', status.toUpperCase())
    }

    if (stockLevel !== 'all') {
      if (stockLevel === 'out_of_stock') {
        countQuery = countQuery.eq('total_quantity_available', 0)
      } else if (stockLevel === 'in_stock') {
        countQuery = countQuery.gt('total_quantity_available', 0)
      } else if (stockLevel === 'low_stock') {
        countQuery = countQuery.eq('stock_status', 'LOW_STOCK')
      }
    }

    const { count: totalCount } = await countQuery

    // Apply pagination
    const startIndex = (page - 1) * pageSize
    query = query.range(startIndex, startIndex + pageSize - 1)

    // Order by stock status priority and expiry
    query = query
      .order('stock_status', { ascending: true })
      .order('days_to_earliest_expiry', { ascending: true, nullsFirst: false })

    // Execute query
    const { data: inventoryData, error } = await query

    if (error) {
      console.error('Error fetching stock list from view_inventory:', error)
      throw error
    }

    // Transform view_inventory data to StockListItem format
    const stockList = (inventoryData || []).map((item: any) => {
      // Determine expiry status
      let expiryStatus: 'valid' | 'expiring_soon' | 'critical' | 'expired' =
        'valid'
      let isNearExpiry = false
      let isBlocked = false

      if (item.days_to_earliest_expiry !== null && companySettings) {
        if (item.days_to_earliest_expiry <= 0 || item.expired_batches > 0) {
          expiryStatus = 'expired'
          isBlocked = companySettings.block_expired_sales
        } else if (
          item.days_to_earliest_expiry <=
          companySettings.near_expiry_critical_days
        ) {
          expiryStatus = 'critical'
          isNearExpiry = true
        } else if (
          item.days_to_earliest_expiry <=
          companySettings.near_expiry_warning_days
        ) {
          expiryStatus = 'expiring_soon'
          isNearExpiry = true
        }
      }

      // Calculate discount if applicable
      let discountPercentage = 0
      let discountedPrice = item.weighted_avg_cost
      let originalSellingPrice = item.weighted_avg_cost

      if (
        companySettings?.allow_near_expiry_discount &&
        isNearExpiry &&
        !isBlocked
      ) {
        discountPercentage = companySettings.near_expiry_discount_percentage
        originalSellingPrice = item.weighted_avg_cost
        discountedPrice = originalSellingPrice * (1 - discountPercentage / 100)
      }

      // Determine if low stock
      const lowStockThreshold =
        (item.reorder_level || 0) *
        (companySettings?.low_stock_multiplier || 1.0)
      const isLowStock =
        item.total_quantity_available > 0 &&
        item.total_quantity_available <= lowStockThreshold

      return {
        // IDs
        id: item.product_id,
        batch_id: 0, // View aggregates batches
        product_id: item.product_id,
        store_id: item.store_id,
        company_id: item.company_id,

        // Product details
        product_name: item.product_name,
        product_code: item.product_code,
        barcode: item.barcode,
        generic_name: item.generic_name,
        category_name: item.category_name,
        category_id: item.category_id,
        unit_name: item.unit_name,
        unit_short_code: item.unit_short_code,
        unit_id: item.unit_id,

        // Store details
        store_name: item.store_name,
        store_code: '', // Not in view

        // Batch details
        batch_number: '', // Aggregated across batches
        manufacturing_date: undefined,
        expiry_date: item.earliest_expiry_date,

        // Quantity tracking
        quantity_in_stock: item.total_quantity_available,
        quantity_reserved: 0, // Not in view
        quantity_available: item.total_quantity_available,
        quantity_sold: item.total_quantity_sold,
        reorder_level: item.reorder_level,

        // Pricing
        unit_cost: item.weighted_avg_cost,
        selling_price: discountedPrice,
        original_selling_price: originalSellingPrice,
        discount_percentage: discountPercentage,
        discounted_price: discountPercentage > 0 ? discountedPrice : undefined,

        // Aggregated data
        total_batches: item.total_batches,
        batches: [], // Batches not included in view, would need separate query

        // Financial data
        stock_value: item.total_selling_value,
        total_stock_value: item.total_selling_value,
        total_cost_value: item.total_cost_value,
        avg_unit_cost: item.weighted_avg_cost,
        avg_selling_price: discountedPrice,
        earliest_expiry_date: item.earliest_expiry_date,

        // Status
        status: item.stock_status.toLowerCase().replace('_', '_') as any,
        expiry_status: expiryStatus,
        is_expired: item.expired_batches > 0,
        is_low_stock: isLowStock,
        is_blocked: isBlocked,
        is_near_expiry: isNearExpiry,
        days_to_expiry: item.days_to_earliest_expiry,

        // Metadata
        supplier_id: undefined,
        storage_location: item.storage_conditions,
        created_at: item.last_stock_received_date || new Date().toISOString(),
        updated_at: item.last_updated,
      }
    })

    return {
      data: stockList,
      totalCount: totalCount || 0,
      page,
      pageSize,
    }
  } catch (error) {
    console.error('Error in fetchStockList:', error)
    throw error
  }
}

/**
 * Fetch low stock items using view_low_stock
 */
export const fetchLowStock = async (
  companyId?: number,
  storeId?: number,
  storeIds?: number[] | null,
) => {
  let query = supabase
    .from('view_low_stock')
    .select('*')
    .order('priority_level', { ascending: true })

  if (companyId) {
    query = query.eq('company_id', companyId)
  }

  if (storeIds !== undefined) {
    query = applyStoreFilter(query, storeIds)
  } else if (storeId) {
    query = query.eq('store_id', storeId)
  }

  const { data, error } = await query

  if (error) throw error
  return data || []
}

/**
 * Fetch expiring stock using view_expiring_stock
 */
export const fetchExpiringStock = async (
  companyId?: number,
  storeId?: number,
  urgencyLevels?: string[],
  storeIds?: number[] | null,
) => {
  let query = supabase
    .from('view_expiring_stock')
    .select('*')
    .order('urgency_priority', { ascending: true })

  if (companyId) {
    query = query.eq('company_id', companyId)
  }

  if (storeIds !== undefined) {
    query = applyStoreFilter(query, storeIds)
  } else if (storeId) {
    query = query.eq('store_id', storeId)
  }

  if (urgencyLevels && urgencyLevels.length > 0) {
    query = query.in('expiry_status', urgencyLevels)
  }

  const { data, error } = await query

  if (error) throw error
  return data || []
}

/**
 * Fetch fast moving stock using view_fast_moving_stock
 */
export const fetchFastMovingStock = async (
  companyId?: number,
  storeId?: number,
  velocityCategories?: string[],
  storeIds?: number[] | null,
) => {
  let query = supabase
    .from('view_fast_moving_stock')
    .select('*')
    .order('revenue_30d', { ascending: false })

  if (companyId) {
    query = query.eq('company_id', companyId)
  }

  if (storeIds !== undefined) {
    query = applyStoreFilter(query, storeIds)
  } else if (storeId) {
    query = query.eq('store_id', storeId)
  }

  if (velocityCategories && velocityCategories.length > 0) {
    query = query.in('velocity_category', velocityCategories)
  }

  const { data, error } = await query

  if (error) throw error
  return data || []
}

/**
 * Fetch stock history using view_stock_history
 */
export const fetchStockHistory = async (
  productId?: number,
  storeId?: number,
  batchNumber?: string,
  transactionType?: string,
  dateFrom?: string,
  dateTo?: string,
  storeIds?: number[] | null,
) => {
  let query = supabase
    .from('view_stock_history')
    .select('*')
    .order('transaction_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (productId) {
    query = query.eq('product_id', productId)
  }

  if (storeIds !== undefined) {
    query = applyStoreFilter(query, storeIds)
  } else if (storeId) {
    query = query.eq('store_id', storeId)
  }

  if (batchNumber) {
    query = query.eq('batch_number', batchNumber)
  }

  if (transactionType) {
    query = query.eq('transaction_type', transactionType)
  }

  if (dateFrom) {
    query = query.gte('transaction_date', dateFrom)
  }

  if (dateTo) {
    query = query.lte('transaction_date', dateTo)
  }

  const { data, error } = await query

  if (error) throw error
  return data || []
}

// Fetch stores
export const fetchStores = async (companyId?: number) => {
  let query = supabase
    .from('stores')
    .select('id, store_name, store_code')
    .eq('is_active', true)
    .order('store_name')

  if (companyId) {
    query = query.eq('company_id', companyId)
  }

  const { data, error } = await query

  if (error) throw error
  return data || []
}

// Fetch categories
export const fetchCategories = async () => {
  const { data, error } = await supabase
    .from('categories')
    .select('id, category_name, category_code')
    .eq('is_active', true)
    .order('category_name')

  if (error) throw error
  return data || []
}

// Delete stock batch (soft delete)
export const deleteStockBatch = async (batchId: number) => {
  return await supabase
    .from('product_batches')
    .update({ is_active: false, deleted_at: new Date().toISOString() })
    .eq('id', batchId)
}

// Validate stock operation against company settings
export const validateStockOperation = (
  companySettings: CompanySettings | null,
  operation: {
    type: 'sale' | 'adjustment' | 'transfer'
    batchId: number
    quantity: number
    currentAvailable: number
    isExpired: boolean
  },
): { valid: boolean; error?: string } => {
  if (!companySettings) {
    return { valid: false, error: 'Company settings not available' }
  }

  // Check expired sales block
  if (operation.isExpired && companySettings.block_expired_sales) {
    return {
      valid: false,
      error: 'Cannot perform operations on expired batches',
    }
  }

  // Check negative stock
  const resultingQuantity = operation.currentAvailable - operation.quantity
  if (resultingQuantity < 0 && !companySettings.allow_negative_stock) {
    return { valid: false, error: 'Negative stock not allowed' }
  }

  return { valid: true }
}

/**
 * Get inventory statistics using view_inventory aggregations
 */
export const getInventoryStatistics = async (
  companyId: number,
  storeId?: number,
  storeIds?: number[] | null,
) => {
  let query = supabase
    .from('view_inventory')
    .select('*')
    .eq('company_id', companyId)

  if (storeIds !== undefined) {
    query = applyStoreFilter(query, storeIds)
  } else if (storeId) {
    query = query.eq('store_id', storeId)
  }

  const { data, error } = await query

  if (error) throw error

  const stats = {
    total_products: data?.length || 0,
    total_inventory_value:
      data?.reduce((sum, item) => sum + (item.total_cost_value || 0), 0) || 0,
    total_selling_value:
      data?.reduce((sum, item) => sum + (item.total_selling_value || 0), 0) ||
      0,
    total_potential_profit:
      data?.reduce((sum, item) => sum + (item.potential_profit || 0), 0) || 0,
    out_of_stock:
      data?.filter((item) => item.stock_status === 'OUT_OF_STOCK').length || 0,
    low_stock:
      data?.filter((item) => item.stock_status === 'LOW_STOCK').length || 0,
    overstock:
      data?.filter((item) => item.stock_status === 'OVERSTOCK').length || 0,
    in_stock:
      data?.filter((item) => item.stock_status === 'IN_STOCK').length || 0,
    expired_batches:
      data?.reduce((sum, item) => sum + (item.expired_batches || 0), 0) || 0,
    expiring_soon:
      data?.filter((item) => item.batches_expiring_soon_count > 0).length || 0,
  }

  return stats
}

