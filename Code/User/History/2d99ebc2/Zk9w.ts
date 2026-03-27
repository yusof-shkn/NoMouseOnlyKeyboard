// shared/types/stockList.ts - UPDATED WITH DATABASE VIEW MAPPINGS

/**
 * Company Settings Interface
 */
export interface CompanySettings {
  id: number
  company_id: number
  near_expiry_warning_days: number
  near_expiry_critical_days: number
  auto_expire_batches: boolean
  low_stock_multiplier: number
  allow_negative_stock: boolean
  stock_valuation_method: 'FIFO' | 'LIFO' | 'AVERAGE' | 'WEIGHTED_AVERAGE'
  default_currency: string
  enable_batch_tracking: boolean
  enable_serial_numbers: boolean
  tax_rate: number
  block_expired_sales: boolean
  allow_near_expiry_discount: boolean
  near_expiry_discount_percentage: number
  enable_low_stock_notifications: boolean
  enable_expiry_notifications: boolean
  low_stock_multiplier_enabled?: boolean
}

/**
 * Stock/Batch Status - Updated to match view_inventory.stock_status
 */
export type StockStatus =
  | 'IN_STOCK' // Maps to view_inventory.stock_status = 'IN_STOCK'
  | 'OUT_OF_STOCK' // Maps to view_inventory.stock_status = 'OUT_OF_STOCK'
  | 'LOW_STOCK' // Maps to view_inventory.stock_status = 'LOW_STOCK'
  | 'OVERSTOCK' // Maps to view_inventory.stock_status = 'OVERSTOCK'
  | 'available' // Legacy support
  | 'reserved' // Legacy support
  | 'expired' // Legacy support
  | 'damaged' // Legacy support
  | 'blocked' // When is_blocked = true

/**
 * Expiry Status - Updated to match view_expiring_stock.expiry_status
 */
export type ExpiryStatus =
  | 'NORMAL' // Maps to view_expiring_stock.expiry_status = 'NORMAL'
  | 'ATTENTION' // Maps to view_expiring_stock.expiry_status = 'ATTENTION' (≤180 days)
  | 'WARNING' // Maps to view_expiring_stock.expiry_status = 'WARNING' (≤90 days)
  | 'URGENT' // Maps to view_expiring_stock.expiry_status = 'URGENT' (≤60 days)
  | 'CRITICAL' // Maps to view_expiring_stock.expiry_status = 'CRITICAL' (≤30 days)
  | 'EXPIRED' // Maps to view_expiring_stock.expiry_status = 'EXPIRED'
  | 'valid' // Legacy support
  | 'expiring_soon' // Legacy support
  | 'critical' // Legacy support
  | 'expired' // Legacy support

/**
 * Stock List Item Interface - Maps to view_inventory
 * This represents aggregated product inventory at store level
 */
export interface StockListItem {
  // Primary keys (from view_inventory)
  id: number // product_id
  batch_id: number // Not in view (aggregated)
  product_id: number // view_inventory.product_id
  store_id: number // view_inventory.store_id
  company_id: number // view_inventory.company_id

  // Product details (from view_inventory)
  product_name: string // view_inventory.product_name
  product_code: string // view_inventory.product_code
  barcode?: string // view_inventory.barcode
  generic_name?: string // view_inventory.generic_name
  manufacturer?: string // view_inventory.manufacturer
  dosage_form?: string // view_inventory.dosage_form
  strength?: string // view_inventory.strength

  // Category details (from view_inventory)
  category_name?: string // view_inventory.category_name
  category_id?: number // view_inventory.category_id

  // Unit details (from view_inventory)
  unit_name?: string // view_inventory.unit_name
  unit_short_code?: string // view_inventory.unit_short_code
  unit_id?: number // view_inventory.unit_id

  // Store details (from view_inventory)
  store_name: string // view_inventory.store_name
  store_code?: string // Not in view

  // Batch details (aggregated in view_inventory)
  batch_number?: string // Not in view (multiple batches)
  manufacturing_date?: string // Not in view (varies by batch)
  expiry_date?: string // view_inventory.earliest_expiry_date

  // Quantity tracking (from view_inventory)
  quantity_in_stock: number // view_inventory.total_quantity_available
  quantity_reserved: number // Not in view
  quantity_available: number // view_inventory.total_quantity_available
  quantity_sold?: number // view_inventory.total_quantity_sold
  reorder_level?: number // view_inventory.reorder_level

  // Pricing (from view_inventory)
  unit_cost: number // view_inventory.weighted_avg_cost
  selling_price: number // Calculated with discount applied
  original_selling_price?: number // Original price before discount
  discount_percentage?: number // Applied discount %
  discounted_price?: number // Price after discount
  mrp?: number // Not in view

  // Aggregated batch data (from view_inventory)
  total_batches?: number // view_inventory.total_batches
  active_batches?: number // view_inventory.active_batches
  expired_batches?: number // view_inventory.expired_batches
  batches_expiring_soon_count?: number // view_inventory.batches_expiring_soon_count
  batches?: Array<{
    // Not in view (would need separate query)
    batch_id: number
    batch_number: string
    quantity_available: number
    unit_cost: number
    selling_price: number
    expiry_date?: string
    is_expired: boolean
  }>

  // Financial data (from view_inventory)
  stock_value: number // view_inventory.total_selling_value
  total_stock_value?: number // view_inventory.total_selling_value
  total_cost_value?: number // view_inventory.total_cost_value
  avg_unit_cost?: number // view_inventory.weighted_avg_cost
  avg_selling_price?: number // Calculated with discount
  potential_profit?: number // view_inventory.potential_profit
  profit_margin_percentage?: number // view_inventory.profit_margin_percentage
  earliest_expiry_date?: string // view_inventory.earliest_expiry_date

  // Status fields (from view_inventory)
  status: StockStatus // view_inventory.stock_status
  expiry_status?: ExpiryStatus // Calculated from days_to_earliest_expiry
  is_expired: boolean // view_inventory.expired_batches > 0
  is_low_stock?: boolean // Calculated from reorder_level
  is_blocked?: boolean // Applied from company settings
  is_near_expiry?: boolean // Calculated from days_to_expiry
  days_to_expiry?: number // view_inventory.days_to_earliest_expiry

  // Sales velocity (from view_inventory)
  qty_sold_last_30_days?: number // view_inventory.qty_sold_last_30_days
  revenue_last_30_days?: number // view_inventory.revenue_last_30_days
  avg_daily_sales?: number // view_inventory.avg_daily_sales
  days_of_stock_remaining?: number // view_inventory.days_of_stock_remaining

  // Supplier info (from view_inventory)
  suppliers?: string // view_inventory.suppliers (comma-separated)
  supplier_id?: number // Not in view (multiple suppliers)

  // Additional fields (from view_inventory)
  storage_location?: string // Not directly in view
  storage_conditions?: string // view_inventory.storage_conditions
  shelf_life_days?: number // view_inventory.shelf_life_days
  requires_prescription?: boolean // view_inventory.requires_prescription
  is_controlled_substance?: boolean // view_inventory.is_controlled_substance

  // Metadata (from view_inventory)
  created_at: string // Not in view (use last_stock_received_date)
  updated_at?: string // view_inventory.last_updated
  last_stock_received_date?: string // view_inventory.last_stock_received_date
  last_sale_date?: string // view_inventory.last_sale_date
}

/**
 * Low Stock Item - Maps to view_low_stock
 */
export interface LowStockItem {
  product_id: number
  product_name: string
  product_code: string
  store_id: number
  store_name: string
  current_stock: number
  reorder_level: number
  stock_status: 'OUT_OF_STOCK' | 'LOW_STOCK' | 'NEAR_REORDER' | 'ADEQUATE'
  suggested_order_quantity: number
  estimated_order_cost: number
  priority_level: 1 | 2 | 3 | 4 // 1=highest
  days_out_of_stock?: number
  last_purchase_date?: string
}

/**
 * Expiring Stock Item - Maps to view_expiring_stock
 */
export interface ExpiringStockItem {
  batch_id: number
  batch_number: string
  product_id: number
  product_name: string
  store_id: number
  store_name: string
  quantity_available: number
  expiry_date: string
  days_to_expiry: number
  expiry_status:
    | 'EXPIRED'
    | 'CRITICAL'
    | 'URGENT'
    | 'WARNING'
    | 'ATTENTION'
    | 'NORMAL'
  urgency_priority: 1 | 2 | 3 | 4 | 5 | 6 // 1=highest
  suggested_action: string
  total_cost_value: number
  avg_daily_sales?: number
  estimated_days_to_sellout?: number
  likely_to_expire: boolean
}

/**
 * Fast Moving Stock Item - Maps to view_fast_moving_stock
 */
export interface FastMovingStockItem {
  product_id: number
  product_name: string
  store_id: number
  store_name: string
  current_stock: number
  qty_sold_30d: number
  revenue_30d: number
  avg_daily_sales_30d: number
  velocity_category: 'VERY_FAST' | 'FAST' | 'MODERATE' | 'SLOW' | 'VERY_SLOW'
  days_of_stock_remaining?: number
  reorder_urgency: 'URGENT' | 'SOON' | 'NORMAL' | 'NOT_NEEDED'
  abc_classification: 'A' | 'B' | 'C'
  sales_trend: 'INCREASING' | 'DECREASING' | 'STABLE'
  monthly_turnover_rate?: number
}

/**
 * Stock History Item - Maps to view_stock_history
 */
export interface StockHistoryItem {
  transaction_type: 'RECEIPT' | 'SALE' | 'RETURN' | 'ADJUSTMENT'
  transaction_id: number
  reference_number: string
  product_id: number
  product_name: string
  store_id: number
  store_name: string
  batch_number?: string
  quantity: number // Negative for sales
  unit_price: number
  total_amount: number
  customer_id?: number
  customer_name?: string
  supplier_id?: number
  supplier_name?: string
  transaction_date: string
  created_at: string
}

/**
 * Stock List Filters
 */
export interface StockListFilters {
  status?: StockStatus | 'all'
  stockLevel?: 'all' | 'in_stock' | 'low_stock' | 'out_of_stock'
  expiryStatus?: 'all' | 'expired' | 'expiring_soon' | 'critical' | 'valid'
  storeId?: number
  categoryId?: number
  searchQuery?: string
}

/**
 * Stock List Statistics
 */
export interface StockListStats {
  total: number
  available: number
  reserved: number
  expired: number
  damaged: number
  lowStock: number
  outOfStock: number
  expiringThisMonth: number
  expiringSoon: number
  expiryCritical: number
  blocked: number
  totalValue: number
  totalCostValue: number
  discountedItems?: number
  totalDiscountValue?: number
}

/**
 * Fetch Stock List Parameters
 */
export interface FetchStockListParams {
  page?: number
  pageSize?: number
  searchQuery?: string
  status?: string
  stockLevel?: string
  expiryStatus?: string
  companyId?: number
  storeId?: number
  categoryId?: number
  isUnlocked?: boolean
}

/**
 * Inventory Statistics - From getInventoryStatistics query
 */
export interface InventoryStatistics {
  total_products: number
  total_inventory_value: number
  total_selling_value: number
  total_potential_profit: number
  out_of_stock: number
  low_stock: number
  overstock: number
  in_stock: number
  expired_batches: number
  expiring_soon: number
}

// Purchase Order types remain unchanged
export type POStatus =
  | 'draft'
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'received'
  | 'partially_received'
  | 'cancelled'

export type PaymentStatus = 'unpaid' | 'partially_paid' | 'paid' | 'overdue'

export interface PurchaseOrder {
  id: number
  company_id: number
  store_id: number
  supplier_id: number
  po_number: string
  po_date: string
  expected_delivery_date?: string
  actual_delivery_date?: string
  status: POStatus
  subtotal: number
  tax_amount?: number
  discount_amount?: number
  shipping_cost?: number
  other_charges?: number
  total_amount: number
  payment_terms?: string
  shipping_address?: string
  billing_address?: string
  terms_conditions?: string
  internal_notes?: string
  notes?: string
  approved_by?: number
  approved_at?: string
  received_by?: number
  received_at?: string
  cancelled_by?: number
  cancelled_at?: string
  cancellation_reason?: string
  created_at: string
  updated_at: string
  deleted_at?: string
  supplier_name?: string
  store_name?: string
  paid_amount?: number
  due_amount?: number
  payment_status?: PaymentStatus
  items_count?: number
  total_items_ordered?: number
  total_items_received?: number
}

export interface PurchaseOrderItem {
  id: number
  purchase_order_id: number
  product_id: number
  quantity_ordered: number
  quantity_received?: number
  unit_cost: number
  tax_rate?: number
  tax_amount?: number
  discount_rate?: number
  discount_amount?: number
  total_cost: number
  batch_number?: string
  manufacture_date?: string
  expiry_date?: string
  notes?: string
  created_at: string
  updated_at: string
  deleted_at?: string
  product_name?: string
  product_code?: string
  generic_name?: string
  unit_name?: string
  unit_short_code?: string
}

export interface PurchaseOrderFormData {
  id?: number
  company_id: number
  store_id: number
  supplier_id: number
  po_number?: string
  po_date: string
  expected_delivery_date?: string
  status?: POStatus
  subtotal: number
  tax_amount?: number
  discount_amount?: number
  shipping_cost?: number
  other_charges?: number
  total_amount: number
  payment_terms?: string
  shipping_address?: string
  billing_address?: string
  terms_conditions?: string
  internal_notes?: string
  notes?: string
  items: PurchaseOrderItemFormData[]
}

export interface PurchaseOrderItemFormData {
  id?: number
  product_id: number
  quantity_ordered: number
  unit_cost: number
  tax_rate?: number
  discount_rate?: number
  batch_number?: string
  manufacture_date?: string
  expiry_date?: string
  notes?: string
}

export interface PurchaseOrderDetail extends PurchaseOrder {
  items: PurchaseOrderItem[]
  supplier?: {
    id: number
    supplier_name: string
    contact_person?: string
    phone?: string
    email?: string
  }
  store?: {
    id: number
    store_name: string
    store_code: string
  }
  approved_by_profile?: {
    id: number
    first_name: string
    last_name: string
  }
  received_by_profile?: {
    id: number
    first_name: string
    last_name: string
  }
}

export interface PurchaseOrderFilters {
  status?: POStatus | 'all'
  paymentStatus?: PaymentStatus | 'all'
  supplierId?: number
  storeId?: number
  dateFrom?: string
  dateTo?: string
  searchQuery?: string
}

export interface PurchaseOrderStats {
  total: number
  draft: number
  pending: number
  approved: number
  rejected: number
  received: number
  partiallyReceived: number
  cancelled: number
  completed: number
  totalAmount: number
  totalPaid: number
  totalDue: number
  unpaid: number
  partiallyPaid: number
  paid: number
  overdue: number
}

export type FetchPurchaseOrderParams = {
  page?: number
  pageSize?: number
  searchQuery?: string
  status?: string
  paymentStatus?: string
  companyId?: number
  storeId?: number
}

