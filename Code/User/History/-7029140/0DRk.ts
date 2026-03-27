// src/pages/StockHistory/data/stockHistory.queries.ts
import { supabase } from '@app/core/supabase/Supabase.utils'
import { PostgrestError } from '@supabase/supabase-js'
import {
  StockHistoryItem,
  StockHistoryStats,
} from '../types/stockHistory.types'
import { applyRestrictedFilter } from '@shared/utils/restrictedFilter.utils'

export interface GetStockHistoryOptions {
  page?: number
  pageSize?: number
  searchQuery?: string
  storeId?: string | number | null
  productId?: string | number | null
  batchNumber?: string | null
  transactionType?: 'RECEIPT' | 'SALE' | 'RETURN' | 'ADJUSTMENT' | 'all' | null
  startDate?: string | null
  endDate?: string | null
  customerId?: string | number | null
  supplierId?: string | number | null
  companyId?: string | number | null
}

export interface GetStockHistoryResponse {
  data: StockHistoryItem[] | null
  error: PostgrestError | null
  count: number | null
}

/**
 * Get stock history statistics
 */
export const getStockHistoryStats = async (
  companyId: number,
  startDate?: string,
  endDate?: string,
): Promise<{
  data: StockHistoryStats | null
  error: any
}> => {
  try {
    let query = supabase
      .from('view_stock_history')
      .select('quantity, transaction_type, product_id, total_amount')
      .eq('company_id', companyId)

    if (startDate) {
      query = query.gte('transaction_date', startDate)
    }
    if (endDate) {
      query = query.lte('transaction_date', endDate)
    }

    const { data, error } = await query

    if (error) throw error

    const totalTransactions = data?.length || 0

    // Calculate quantity in (RECEIPT and RETURN have positive impact)
    const totalQuantityIn =
      data?.reduce((sum, item) => {
        if (
          item.transaction_type === 'RECEIPT' ||
          item.transaction_type === 'RETURN'
        ) {
          return sum + Math.abs(item.quantity)
        }
        return sum
      }, 0) || 0

    // Calculate quantity out (SALE and ADJUSTMENT can have negative impact)
    const totalQuantityOut =
      data?.reduce((sum, item) => {
        if (item.transaction_type === 'SALE') {
          return sum + Math.abs(item.quantity)
        }
        if (item.transaction_type === 'ADJUSTMENT' && item.quantity < 0) {
          return sum + Math.abs(item.quantity)
        }
        return sum
      }, 0) || 0

    const netQuantityChange = totalQuantityIn - totalQuantityOut

    const uniqueProducts = data
      ? new Set(data.map((item) => item.product_id)).size
      : 0

    const totalValue =
      data?.reduce((sum, item) => sum + (item.total_amount || 0), 0) || 0

    return {
      data: {
        totalTransactions,
        totalQuantityIn,
        totalQuantityOut,
        netQuantityChange,
        totalValue,
        uniqueProducts,
      },
      error: null,
    }
  } catch (error) {
    console.error('Error fetching stock history stats:', error)
    return {
      data: {
        totalTransactions: 0,
        totalQuantityIn: 0,
        totalQuantityOut: 0,
        netQuantityChange: 0,
        totalValue: 0,
        uniqueProducts: 0,
      },
      error,
    }
  }
}

/**
 * Get stock history with filtering, pagination, and search
 * Uses view_stock_history view for comprehensive stock history
 */
export const getStockHistory = async ({
  page = 1,
  pageSize = 10,
  searchQuery = '',
  storeId = null,
  productId = null,
  batchNumber = null,
  transactionType = null,
  startDate = null,
  endDate = null,
  customerId = null,
  supplierId = null,
  companyId = null,
  isUnlocked = false,
}: GetStockHistoryOptions & {
  isUnlocked?: boolean
} = {}): Promise<GetStockHistoryResponse> => {
  try {
    let query = supabase
      .from('view_stock_history')
      .select('*', { count: 'exact' })
      .order('transaction_date', { ascending: false })
      .order('created_at', { ascending: false })

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

    // Product filter
    if (
      productId !== null &&
      productId !== undefined &&
      productId !== '' &&
      productId !== 'all'
    ) {
      const parsedProductId =
        typeof productId === 'string' ? parseInt(productId, 10) : productId
      if (!isNaN(parsedProductId)) {
        query = query.eq('product_id', parsedProductId)
      }
    }

    // Batch number filter
    if (batchNumber && batchNumber !== 'all') {
      query = query.eq('batch_number', batchNumber)
    }

    // Transaction type filter
    if (
      transactionType &&
      transactionType !== 'all' &&
      transactionType !== null
    ) {
      query = query.eq('transaction_type', transactionType)
    }

    // Customer filter
    if (
      customerId !== null &&
      customerId !== undefined &&
      customerId !== '' &&
      customerId !== 'all'
    ) {
      const parsedCustomerId =
        typeof customerId === 'string' ? parseInt(customerId, 10) : customerId
      if (!isNaN(parsedCustomerId)) {
        query = query.eq('customer_id', parsedCustomerId)
      }
    }

    // Supplier filter
    if (
      supplierId !== null &&
      supplierId !== undefined &&
      supplierId !== '' &&
      supplierId !== 'all'
    ) {
      const parsedSupplierId =
        typeof supplierId === 'string' ? parseInt(supplierId, 10) : supplierId
      if (!isNaN(parsedSupplierId)) {
        query = query.eq('supplier_id', parsedSupplierId)
      }
    }

    // Date range filters
    if (startDate) {
      query = query.gte('transaction_date', startDate)
    }
    if (endDate) {
      query = query.lte('transaction_date', endDate)
    }

    // Search filter
    if (searchQuery && searchQuery.trim()) {
      const searchTerm = searchQuery.trim()
      query = query.or(
        `product_name.ilike.%${searchTerm}%,product_code.ilike.%${searchTerm}%,reference_number.ilike.%${searchTerm}%,batch_number.ilike.%${searchTerm}%,customer_name.ilike.%${searchTerm}%,supplier_name.ilike.%${searchTerm}%`,
      )
    }

    // Pagination
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1
    query = query.range(from, to)

    const { data, error, count } = await query

    if (error) throw error

    // The view already has the correct structure, just cast it
    const transformedData: StockHistoryItem[] = (data ||
      []) as StockHistoryItem[]

    return {
      data: transformedData,
      error: null,
      count: count || 0,
    }
  } catch (error) {
    console.error('Error in getStockHistory query:', error)
    return {
      data: null,
      error: error as PostgrestError,
      count: null,
    }
  }
}

