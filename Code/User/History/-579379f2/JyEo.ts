// src/pages/ExpiringSoon/data/expiringSoon.queries.ts - UPDATED TO USE view_expiring_stock
import { supabase } from '@app/core/supabase/Supabase.utils'
import { PostgrestError } from '@supabase/supabase-js'
import { CompanySettings } from '@shared/types/companySettings'
import {
  ExpiringSoonItem,
  ExpiringSoonStats,
} from '../types/expiringSoon.types'
import { applyRestrictedFilter } from '@shared/utils/restrictedFilter.utils'

export interface GetExpiringSoonItemsOptions {
  page?: number
  pageSize?: number
  searchQuery?: string
  storeId?: string | number | null
  categoryId?: string | number | null
  daysThreshold?: number
  minValue?: number
  companyId?: string | number | null
  settings?: CompanySettings | null
}

export interface GetExpiringSoonItemsResponse {
  data: ExpiringSoonItem[] | null
  error: PostgrestError | null
  count: number | null
}

/**
 * Get expiring soon items statistics using view_expiring_stock
 */
export const getExpiringSoonStats = async (
  companyId: number,
  daysThreshold: number,
  storeId?: string | number | null,
  companySettings?: CompanySettings | null,
): Promise<{
  data: ExpiringSoonStats | null
  error: any
}> => {
  try {
    const criticalDaysThreshold =
      companySettings?.near_expiry_critical_days || 30

    // Build query using the view_expiring_stock view
    let query = supabase
      .from('view_expiring_stock')
      .select('*', { count: 'exact' })
      .eq('company_id', companyId)
      .lte('days_to_expiry', daysThreshold)

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

    if (error) throw error

    // Calculate statistics from the view data
    const totalBatches = count || 0
    const totalQuantity =
      data?.reduce((sum, item) => sum + (item.quantity_available || 0), 0) || 0
    const totalValue =
      data?.reduce((sum, item) => sum + (item.total_cost_value || 0), 0) || 0

    // Count critical items using urgency_priority from view
    // urgency_priority: 1=EXPIRED, 2=CRITICAL (<=30 days), 3=URGENT (<=60 days)
    const criticalItems =
      data?.filter(
        (item) => item.urgency_priority <= 2, // EXPIRED or CRITICAL
      ).length || 0

    return {
      data: {
        totalBatches,
        totalQuantity,
        totalValue,
        criticalItems,
      },
      error: null,
    }
  } catch (error) {
    console.error('Error fetching expiring soon stats:', error)
    return {
      data: {
        totalBatches: 0,
        totalQuantity: 0,
        totalValue: 0,
        criticalItems: 0,
      },
      error,
    }
  }
}

/**
 * Get expiring soon items with filtering, pagination, and search using view_expiring_stock
 */
export const getExpiringSoonItems = async ({
  page = 1,
  pageSize = 10,
  searchQuery = '',
  storeId = null,
  categoryId = null,
  daysThreshold = 90,
  minValue = 0,
  companyId = null,
  settings = null,
  isUnlocked = false,
}: GetExpiringSoonItemsOptions & {
  isUnlocked?: boolean
} = {}): Promise<GetExpiringSoonItemsResponse> => {
  try {
    // Build query using the view_expiring_stock view
    let query = supabase
      .from('view_expiring_stock')
      .select('*', { count: 'exact' })
      .lte('days_to_expiry', daysThreshold)

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
        `batch_number.ilike.%${searchTerm}%,product_name.ilike.%${searchTerm}%,product_code.ilike.%${searchTerm}%`,
      )
    }

    // Filter by minimum value
    if (minValue > 0) {
      query = query.gte('total_cost_value', minValue)
    }

    // Filter out expired batches if auto_expire_batches is enabled
    if (settings?.auto_expire_batches) {
      query = query.eq('is_expired', false)
    }

    // Pagination
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1
    query = query.range(from, to)

    // Order by urgency (most urgent first)
    query = query
      .order('urgency_priority', { ascending: true })
      .order('days_to_expiry', { ascending: true })

    const { data, error, count } = await query

    if (error) throw error

    // Transform view data to ExpiringSoonItem format
    const transformedData: ExpiringSoonItem[] = (data || []).map(
      (item: any) => ({
        id: item.batch_id,
        batch_id: item.batch_id,
        batch_number: item.batch_number,
        product_id: item.product_id,
        product_name: item.product_name || 'Unknown',
        product_code: item.product_code || 'N/A',
        category_id: item.category_id,
        category_name: item.category_name || 'Uncategorized',
        unit_id: item.unit_id,
        unit_name: item.unit_name || 'Unit',
        store_id: item.store_id,
        store_name: item.store_name || 'Unknown Store',
        expiry_date: item.expiry_date,
        days_until_expiry: item.days_to_expiry || 0,
        remaining_quantity: item.quantity_available || 0,
        original_quantity: item.quantity_received || 0,
        cost_price: item.unit_cost || 0,
        selling_price: item.selling_price || 0,
        total_value: item.total_cost_value || 0,
        supplier_id: item.supplier_id,
        supplier_name: item.supplier_name,
        received_date: item.batch_created_at,
        manufacturing_date: item.manufacturing_date,
        created_at: item.batch_created_at,
        updated_at: item.batch_updated_at,
        // Additional fields from view
        expiry_status: item.expiry_status,
        urgency_priority: item.urgency_priority,
        suggested_action: item.suggested_action,
        avg_daily_sales: item.avg_daily_sales,
        estimated_days_to_sellout: item.estimated_days_to_sellout,
        likely_to_expire: item.likely_to_expire,
        potential_profit: item.potential_profit,
      }),
    )

    return {
      data: transformedData,
      error: null,
      count: count || 0,
    }
  } catch (error) {
    console.error('Error in getExpiringSoonItems query:', error)
    return {
      data: null,
      error: error as PostgrestError,
      count: null,
    }
  }
}

