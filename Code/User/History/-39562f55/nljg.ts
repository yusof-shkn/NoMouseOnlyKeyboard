// types/purchaseReturn.types.ts - COMPLETE FIXED VERSION

import { PostgrestError } from '@supabase/supabase-js'

// ============================================================
// SETTINGS TYPES - ✅ FIXED
// ============================================================

export interface PurchaseReturnSettings {
  allow_purchase_returns: boolean
  purchase_return_days_limit?: number
  require_purchase_return_approval?: boolean // ✅ FIXED: Correct DB column name
  return_approval_threshold?: number
  auto_restock_on_return?: boolean
}

// ============================================================
// MAIN TYPES
// ============================================================

export interface PurchaseReturn {
  id: number
  company_id: number
  store_id?: number
  supplier_id: number
  purchase_order_id?: number // ✅ Column exists in DB
  return_number: string
  return_date: string
  return_reason: string
  total_refund_amount: number
  refund_method: string
  status: 'pending' | 'approved' | 'rejected' | 'completed'
  notes?: string
  processed_by: number
  approved_by?: number
  approved_at?: string
  created_at: string
  updated_at: string
  deleted_at?: string

  // Computed/joined fields
  supplier_name?: string
  store_name?: string
  po_number?: string
  po_date?: string
  po_payment_status?: string
  processed_by_name?: string
  approved_by_name?: string
  items_count?: number
  total_items_returned?: number
  payment_status?: 'unpaid' | 'partially_paid' | 'paid' | 'overdue'
  paid_amount?: number
  due_amount?: number
}

export interface PurchaseReturnDetail extends PurchaseReturn {
  supplier?: any
  store?: any
  purchase_orders?: any
  processed_by_profile?: any
  approved_by_profile?: any
  purchase_return_items?: any[]
  items?: any[]
}

// ============================================================
// CREATE/UPDATE TYPES
// ============================================================

export interface CreatePurchaseReturnData {
  company_id: number
  store_id?: number
  supplier_id: number
  purchase_order_id?: number // ✅ Column exists in DB
  return_number?: string
  return_date: string
  return_reason: string
  refund_method: string
  notes?: string
  processed_by: number
  items: Array<{
    purchase_order_item_id: number
    product_id: number
    batch_id: number
    batch_number: string
    quantity_returned: number
    unit_cost: number
    reason: string
  }>
}

export interface UpdatePurchaseReturnData {
  return_reason?: string
  notes?: string
  status?: 'pending' | 'approved' | 'rejected' | 'completed'
  refund_method?: string
  approved_by?: number
  approved_at?: string
}

// ============================================================
// QUERY PARAMS
// ============================================================

export interface FetchPurchaseReturnsParams {
  page?: number
  pageSize?: number
  searchQuery?: string
  status?: string
  paymentStatus?: string
  companyId?: number
  storeId?: number
  sortBy?: string
  dateFrom?: string
  dateTo?: string
  isUnlocked?: boolean
}

// ============================================================
// STATS
// ============================================================

export interface PurchaseReturnStats {
  total: number
  pending: number
  approved: number
  rejected: number
  completed: number
  totalRefundAmount: number
  totalPaid: number
  totalDue: number
  unpaid: number
  partiallyPaid: number
  paid: number
  overdue: number
}

// ============================================================
// VALIDATION
// ============================================================

export interface ReturnValidationResult {
  isValid: boolean
  errorMessage?: string
  daysRemaining?: number
  purchaseDate?: string
}

// ============================================================
// SUPPLIER CREDIT
// ============================================================

export interface SupplierCreditImpact {
  currentBalance: number
  newBalance: number
  newAvailableCredit: number
  balanceReduction: number
}

