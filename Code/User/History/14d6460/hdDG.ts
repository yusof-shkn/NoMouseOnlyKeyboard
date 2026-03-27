// src/pages/ExpiringSoon/types/expiringSoon.types.ts - UPDATED TO USE view_expiring_stock

export interface ExpiringSoonItem {
  id: number
  batch_id: number
  batch_number: string
  product_id: number
  product_name: string
  product_code: string
  category_id?: number
  category_name?: string
  unit_id?: number
  unit_name?: string
  store_id?: number
  store_name?: string
  expiry_date: string
  days_until_expiry: number
  remaining_quantity: number
  original_quantity: number
  cost_price: number
  selling_price: number
  total_value: number
  supplier_id?: number
  supplier_name?: string
  received_date?: string
  manufacturing_date?: string
  created_at?: string
  updated_at?: string
  // Additional fields from view_expiring_stock
  expiry_status?: string // EXPIRED, CRITICAL, URGENT, WARNING, ATTENTION, NORMAL
  urgency_priority?: number // 1-6 (1=highest urgency)
  suggested_action?: string // Recommended action from view
  avg_daily_sales?: number // Average daily sales from view
  estimated_days_to_sellout?: number // Estimated days to sell out
  likely_to_expire?: boolean // Will likely expire before selling out
  potential_profit?: number // Potential profit if sold
}

export interface ExpiringSoonFilters {
  page?: number
  pageSize?: number
  searchQuery?: string
  storeId?: string | number | null
  categoryId?: string | number | null
  daysThreshold?: number // Days until expiry threshold (default from settings)
  minValue?: number
  companyId?: string | number | null
  isUnlocked?: boolean
}

export interface ExpiringSoonStats {
  totalBatches: number
  totalQuantity: number
  totalValue: number
  criticalItems: number // Items expiring in < near_expiry_critical_days
}

export interface FetchExpiringSoonResult {
  items: ExpiringSoonItem[]
  totalCount: number
  stats: ExpiringSoonStats
}

// 🔥 CompanySettings is now imported from @shared/types/companySettings
// No need to define it here

