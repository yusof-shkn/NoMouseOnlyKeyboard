// src/pages/LowStock/types/lowStock.types.ts - UPDATED TO USE view_low_stock

export interface LowStockItem {
  id: number
  product_id: number
  product_name: string
  product_code: string
  generic_name?: string
  category_name?: string
  store_id: number
  store_name: string
  store_code: string
  batch_number: string
  current_quantity: number
  reorder_level: number
  unit_name: string
  unit_short_code: string
  supplier_name?: string
  last_purchase_date?: string
  last_sale_date?: string
  expiry_date?: string
  days_to_expiry?: number
  urgency_level: 'critical' | 'high' | 'medium' | 'low'
  is_active: boolean
  created_at: string
  updated_at: string

  // Additional fields from view_low_stock
  barcode?: string
  manufacturer?: string
  max_stock_level?: number
  min_order_quantity?: number
  stock_status?: 'OUT_OF_STOCK' | 'LOW_STOCK' | 'NEAR_REORDER' | 'ADEQUATE'
  suggested_order_quantity?: number
  standard_cost?: number
  standard_price?: number
  estimated_order_cost?: number
  priority_level?: number // 1-4 (1=highest priority)
  active_batches_count?: number
  days_out_of_stock?: number
  requires_prescription?: boolean
  is_controlled_substance?: boolean
}

export interface LowStockStats {
  total: number
  critical: number
  high: number
  medium: number
  totalValue: number
}

export interface LowStockFilters {
  page?: number
  pageSize?: number
  searchQuery?: string
  urgencyLevel?: string
  storeId?: string | number | null
  categoryId?: string | number | null
  companyId?: string | number | null
  isUnlocked?: boolean
}

export interface FetchLowStockResult {
  lowStockData: LowStockItem[]
  totalCount: number
}

