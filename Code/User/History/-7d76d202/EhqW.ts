// src/pages/FastMovingItems/types/fastMovingItems.types.ts - UPDATED TO USE view_fast_moving_stock

export interface FastMovingItem {
  id: number
  product_id: number
  product_name: string
  product_code: string
  category_id?: number
  category_name?: string
  unit_id?: number
  unit_name?: string
  store_id?: number
  store_name?: string
  total_quantity_sold: number
  total_sales_amount: number
  transaction_count: number
  avg_sale_price: number
  current_stock_level: number
  reorder_level?: number
  last_sale_date?: string
  velocity_score: number
  period_days: number
  items_per_day: number
  created_at?: string
  updated_at?: string
}

export interface FastMovingItemFilters {
  page?: number
  pageSize?: number
  searchQuery?: string
  storeId?: string | number | null
  categoryId?: string | number | null
  periodDays?: number
  minVelocity?: number
  companyId?: string | number | null
  isUnlocked?: boolean
}

export interface FastMovingItemStats {
  totalProducts: number
  totalQuantitySold: number
  totalRevenue: number
  avgVelocity: number
}

export interface FetchFastMovingItemsResult {
  items: FastMovingItem[]
  totalCount: number
  stats: FastMovingItemStats
}

// 🔥 CompanySettings is now imported from @shared/types/companySettings
// No need to define it here

