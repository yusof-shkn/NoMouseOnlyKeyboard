// types/salesHistory.types.ts - UPDATED WITH CREDIT PROPERTIES

// ✅ FIXED: Import CompanySettings from shared types instead of duplicating
import type { CompanySettings } from '@shared/types/companySettings'

// ============== PROFILE JOIN TYPE (Bug 4.2 fix) ==============
// Proper type for Supabase join: profiles!sales_processed_by_fkey(...)
export interface ProfileJoin {
  auth_id?: string
  first_name: string
  last_name: string
  username?: string
}

// ============== SALE STATUS TYPES ==============

/**
 * ✅ UPDATED: Added 'pending_return' status
 *
 * Sale status flow:
 * 1. pending → Initial sale creation
 * 2. completed → Sale finalized and paid
 * 3. pending_return → Return requested but awaiting approval
 * 4. returned → Return approved and processed
 * 5. cancelled → Sale cancelled before completion
 */
export type SaleStatus =
  | 'pending'
  | 'completed'
  | 'pending_return' // ✅ NEW STATUS
  | 'returned'
  | 'cancelled'

export type PaymentStatus =
  | 'pending'
  | 'partial'
  | 'paid'
  | 'overdue'
  | 'on_credit'

export type PaymentMethod =
  | 'cash'
  | 'card'
  | 'mobile'
  | 'bank_transfer'
  | 'credit'

export type SaleType = 'retail' | 'wholesale' | 'online'

export type ReturnStatus = 'pending' | 'approved' | 'rejected' | 'completed'

// ============== RE-EXPORT COMPANYSETTINGS ==============

// ✅ Re-export CompanySettings so other files can import from this file
export type { CompanySettings }

// ============== SALE INTERFACE ==============

export interface Sale {
  id: number
  company_id: number
  store_id: number
  sale_number: string
  sale_date: string
  sale_type: SaleType
  customer_id?: number
  prescription_id?: number
  payment_method: PaymentMethod
  payment_status: PaymentStatus
  sale_status: SaleStatus
  subtotal_amount: number // maps to DB column 'subtotal'
  subtotal?: number // alternate DB column name
  discount_percentage?: number
  discount_amount?: number
  tax_percentage?: number
  tax_amount?: number
  total_amount: number
  amount_paid?: number
  credit_transaction_id?: number

  // ✅ ADDED: Credit sale properties
  credit_amount?: number // Amount on credit
  credit_due_date?: string // When credit payment is due

  notes?: string
  processed_by: number
  created_at: string
  updated_at: string
  deleted_at?: string

  // Enriched fields
  customer_name?: string
  store_name?: string

  // ✅ Pending return tracking
  has_pending_return?: boolean
  pending_return_id?: number
  pending_return_number?: string

  // Validation flags
  can_return?: boolean
  return_reason?: string
  discount_warning?: string

  // Relations
  customers?: any
  stores?: any
  profiles?: ProfileJoin | null // Joined via profiles!sales_processed_by_fkey
  prescriptions?: any
  sale_items?: SaleItem[]
  sale_payments?: SalePayment[]
}

// ============== SALE ITEM INTERFACE ==============

export interface SaleItem {
  id: number
  sale_id: number
  product_id: number
  batch_id?: number
  batch_number?: string
  quantity: number
  unit_price: number
  discount_percentage?: number
  discount_amount?: number
  tax_percentage?: number
  tax_amount?: number
  total_price: number
  notes?: string
  created_at: string
  updated_at: string

  // Relations
  products?: any
  batches?: any
}

// ============== SALE PAYMENT INTERFACE ==============

export interface SalePayment {
  id: number
  sale_id: number
  payment_number: string
  payment_date: string
  payment_amount: number
  payment_method: PaymentMethod
  payment_reference?: string
  notes?: string
  created_at: string
  updated_at: string
}

// ============== SALES RETURN INTERFACE ==============

export interface SalesReturn {
  id: number
  company_id: number
  store_id: number
  sale_id: number
  return_number: string
  return_date: string
  return_reason: string
  total_refund_amount: number
  refund_method: Exclude<PaymentMethod, 'credit'> // ✅ Credit not allowed as refund method
  status: ReturnStatus
  processed_by: number
  approved_by?: number
  approved_at?: string
  notes?: string
  created_at: string
  updated_at: string
  deleted_at?: string

  // Relations
  sales?: Sale
  sales_return_items?: SalesReturnItem[]
}

// ============== SALES RETURN ITEM INTERFACE ==============

export interface SalesReturnItem {
  id: number
  sales_return_id: number
  sale_item_id: number
  product_id: number
  batch_id?: number
  batch_number?: string
  quantity_returned: number
  unit_price: number
  refund_amount: number
  created_at: string
  updated_at: string

  // Relations
  products?: any
  batches?: any
}

// ============== STATISTICS INTERFACE ==============

/**
 * ✅ UPDATED: Added pendingReturn count
 */
export interface SalesStats {
  total: number
  pending: number
  completed: number
  cancelled: number
  returned: number
  pendingReturn: number // ✅ NEW: Count of sales with pending returns
  totalAmount: number
  totalDiscount: number
  totalTax: number
}

// ============== FILTERS INTERFACE ==============

export interface SalesFilters {
  page?: number
  pageSize?: number
  searchQuery?: string
  status?: string | 'all'
  paymentMethod?: string | 'all'
  customerId?: number
  storeId?: number
  saleType?: string | 'all'
  dateRange?: {
    start: string
    end: string
  }
}

// ============== PRESCRIPTION INTERFACE ==============

export interface Prescription {
  id: number
  company_id: number
  customer_id: number
  prescription_number: string
  prescription_date: string
  prescriber_name: string
  prescriber_license?: string
  prescriber_contact?: string
  patient_name: string
  diagnosis?: string
  is_verified: boolean
  valid_from: string
  valid_until: string
  is_expired: boolean
  notes?: string
  created_at: string
  updated_at: string
  deleted_at?: string
}

// ============== CUSTOMER INSURANCE INTERFACE ==============

export interface CustomerInsurance {
  id: number
  customer_id: number
  insurance_provider: string
  policy_number: string
  group_number?: string
  coverage_type: string
  coverage_percentage?: number
  copay_amount?: number
  is_active: boolean
  valid_from: string
  valid_until: string
  notes?: string
  created_at: string
  updated_at: string
  deleted_at?: string
}

// ============== EXPORT TYPES ==============

export interface ExportColumn {
  header: string
  accessor: string
  width?: number
}

export interface ExportOptions {
  columns: ExportColumn[]
  data: any[]
  fileName: string
  title?: string
  includeDate?: boolean
  includeMetadata?: boolean
  orientation?: 'portrait' | 'landscape'
  sheetName?: string
}

// ============== ACTION TYPES ==============

export type SaleAction =
  | 'view'
  | 'edit'
  | 'delete'
  | 'return'
  | 'approve_return'
  | 'reject_return' // ✅ NEW ACTION
  | 'download_invoice'
  | 'export_pdf'
  | 'export_excel'

// ============== STATUS BADGE COLORS ==============

/**
 * ✅ UPDATED: Added color for pending_return status
 */
export const SALE_STATUS_COLORS: Record<SaleStatus, string> = {
  pending: 'blue',
  completed: 'green',
  pending_return: 'orange', // ✅ NEW COLOR
  returned: 'gray',
  cancelled: 'red',
}

export const PAYMENT_STATUS_COLORS: Record<PaymentStatus, string> = {
  pending: 'yellow',
  partial: 'orange',
  paid: 'green',
  overdue: 'red',
  on_credit: 'purple',
}

export const RETURN_STATUS_COLORS: Record<ReturnStatus, string> = {
  pending: 'orange',
  approved: 'blue',
  rejected: 'red',
  completed: 'green',
}

// ============== STATUS LABELS ==============

/**
 * ✅ UPDATED: Added label for pending_return status
 */
export const SALE_STATUS_LABELS: Record<SaleStatus, string> = {
  pending: 'Pending',
  completed: 'Completed',
  pending_return: 'Pending Return', // ✅ NEW LABEL
  returned: 'Returned',
  cancelled: 'Cancelled',
}

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: 'Pending',
  partial: 'Partial',
  paid: 'Paid',
  overdue: 'Overdue',
  on_credit: 'On Credit',
}

export const RETURN_STATUS_LABELS: Record<ReturnStatus, string> = {
  pending: 'Pending Approval',
  approved: 'Approved',
  rejected: 'Rejected',
  completed: 'Completed',
}

// ============== FILTER OPTIONS ==============

/**
 * ✅ UPDATED: Added pending_return to filter options
 */
export const SALE_STATUS_OPTIONS = [
  { value: 'all', label: 'All Status' },
  { value: 'pending', label: 'Pending' },
  { value: 'completed', label: 'Completed' },
  { value: 'pending_return', label: 'Pending Return' }, // ✅ NEW OPTION
  { value: 'returned', label: 'Returned' },
  { value: 'cancelled', label: 'Cancelled' },
]

export const PAYMENT_METHOD_OPTIONS = [
  { value: 'all', label: 'All Methods' },
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'mobile', label: 'Mobile Money' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'credit', label: 'Credit' },
]

export const SALE_TYPE_OPTIONS = [
  { value: 'all', label: 'All Types' },
  { value: 'retail', label: 'Retail' },
  { value: 'wholesale', label: 'Wholesale' },
  { value: 'online', label: 'Online' },
]

export const DATE_RANGE_OPTIONS = [
  { value: 'all', label: 'All Time' },
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'last_7_days', label: 'Last 7 Days' },
  { value: 'last_30_days', label: 'Last 30 Days' },
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'this_year', label: 'This Year' },
  { value: 'custom', label: 'Custom Range' },
]

