// src/pages/SalesReturns/types/salesReturn.types.ts

/**
 * Main SalesReturn type matching the documentation
 */
export interface SalesReturn {
  id: number
  company_id: number
  store_id: number
  sale_id: number
  return_number: string
  return_date: string
  return_reason: string
  total_refund_amount: number
  refund_method: 'cash' | 'card' | 'mobile_money' | 'bank_transfer'
  status: 'pending' | 'approved' | 'completed' | 'cancelled'
  notes?: string
  processed_by?: number
  approved_by?: number
  approved_at?: string
  created_at: string
  updated_at: string
  deleted_at?: string

  // ========== ENRICHED FIELDS (from joins) ==========
  customer_name?: string
  customer_phone?: string
  store_name?: string
  processed_by_name?: string
  approved_by_name?: string
  items_count?: number
  payment_status?: 'paid' | 'pending' | 'partial'
  amount_paid?: number
  amount_due?: number
  sale_date?: string
  sale_number?: string
}

/**
 * SalesReturnItem type matching the sales_return_items table
 */
export interface SalesReturnItem {
  id: number
  sales_return_id: number
  sale_item_id?: number
  product_id: number
  batch_id?: number
  batch_number?: string
  quantity_returned: number
  unit_price: number
  refund_amount: number
  created_at: string
  updated_at: string
  deleted_at?: string

  // ========== JOINED DATA ==========
  product_name?: string
  product_code?: string
  generic_name?: string
  expiry_date?: string
}

/**
 * Statistics for sales returns dashboard
 */
export interface SalesReturnStats {
  total: number
  pending: number
  approved: number
  completed: number
  cancelled: number
  totalRefundAmount: number
  pendingRefundAmount: number
}

/**
 * Filters for querying sales returns
 */
export interface SalesReturnFilters {
  page?: number
  pageSize?: number
  searchQuery?: string
  status?: string
  paymentStatus?: string
  customerId?: number | null
  storeId?: number | null
  dateRange?: {
    start: string
    end: string
  }
  sortBy?: 'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc' | 'recent'
  isUnlocked?: boolean
}

/**
 * Result from fetching sales returns
 */
export interface FetchSalesReturnsResult {
  salesReturnsData: SalesReturn[]
  totalCount: number
}

/**
 * Result from checking return eligibility
 */
export interface ReturnEligibilityResult {
  eligible: boolean
  reason?: string
  daysRemaining?: number
  requiresApproval: boolean
}

/**
 * Sale type for reference (from sales table)
 */
export interface Sale {
  id: number
  company_id: number
  store_id: number
  sale_number: string
  sale_type: 'retail' | 'wholesale' | 'online'
  sale_date: string
  sale_status: 'completed' | 'pending' | 'cancelled' | 'returned'
  customer_id: number | null
  prescription_id: number | null
  subtotal: number
  discount_amount: number
  tax_amount: number
  total_amount: number
  amount_paid: number
  payment_method: 'cash' | 'card' | 'mobile' | 'credit'
  payment_status: 'paid' | 'pending' | 'partial'
  credit_transaction_id: number | null
  credit_amount: number
  credit_due_date: string | null
  notes?: string
  processed_by: number
  created_at: string
  updated_at: string
  deleted_at?: string
}

/**
 * Customer type for reference
 */
export interface Customer {
  id: number
  customer_code: string
  first_name: string
  last_name: string
  phone?: string
  email?: string
  address?: string
  credit_limit: number
  current_credit_balance: number
  available_credit: number
  is_active: boolean
}

