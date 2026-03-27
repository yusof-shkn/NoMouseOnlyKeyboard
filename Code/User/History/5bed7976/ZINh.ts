// @shared/types/purchaseOrders.ts

/**
 * Purchase Order Status Enum
 * Matches database po_status type
 */
export type POStatus =
  | 'draft'
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'received'
  | 'partially_received'
  | 'cancelled'

/**
 * Payment Status Enum
 * Matches database payment_status type
 */
export type PaymentStatus = 'unpaid' | 'partially_paid' | 'paid' | 'overdue'

/**
 * Backorder Priority
 */
export type BackorderPriority = 'high' | 'medium' | 'low'

/**
 * Stock Valuation Method
 */
export type StockValuationMethod = 'FIFO' | 'LIFO' | 'Weighted Average'

/**
 * Purchase Order Interface
 * Matches purchase_orders table schema with enriched fields
 */
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

  // Financial fields
  subtotal: number
  tax_amount?: number
  discount_amount?: number
  shipping_cost?: number
  other_charges?: number
  total_amount: number

  // Additional info
  payment_terms?: string
  shipping_address?: string
  billing_address?: string
  terms_conditions?: string
  internal_notes?: string
  notes?: string

  // Approval tracking
  approved_by?: number
  approved_at?: string

  // Receipt tracking
  received_by?: number
  received_at?: string

  // Cancellation tracking
  cancelled_by?: number
  cancelled_at?: string
  cancellation_reason?: string

  // Metadata
  created_at: string
  updated_at: string
  deleted_at?: string

  // Enriched fields (from view or joins)
  supplier_name?: string
  store_name?: string
  paid_amount?: number
  due_amount?: number
  payment_status?: PaymentStatus
  items_count?: number
  total_items_ordered?: number
  total_items_received?: number

  // Settings-based enriched fields
  backorder_priority?: BackorderPriority
  backorder_notification_pending?: boolean
  requires_approval?: boolean
  can_be_returned?: boolean
  return_days_remaining?: number
}

/**
 * Purchase Order Item Interface
 * Matches purchase_order_items table schema
 */
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

  // Enriched fields (from joins)
  product_name?: string
  product_code?: string
  generic_name?: string
  unit_name?: string
  unit_short_code?: string
}

/**
 * Purchase Order Form Data
 * Used for creating/editing purchase orders
 */
export interface PurchaseOrderFormData {
  id?: number
  company_id: number
  store_id: number
  supplier_id: number
  po_number?: string // Optional if auto-generated
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

/**
 * Purchase Order Item Form Data
 */
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

/**
 * Purchase Order with Full Details
 * Used when viewing/editing a single PO
 */
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

/**
 * Purchase Order Filters
 */
export interface PurchaseOrderFilters {
  status?: POStatus | 'all'
  paymentStatus?: PaymentStatus | 'all'
  supplierId?: number
  storeId?: number
  dateFrom?: string
  dateTo?: string
  searchQuery?: string
}

/**
 * Purchase Order Statistics
 */
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

/**
 * Fetch Purchase Orders Parameters
 */
export type FetchPurchaseOrdersParams = {
  page?: number
  pageSize?: number
  searchQuery?: string
  status?: string
  paymentStatus?: string
  paymentMethod?: string
  companyId?: number
  storeId?: number
  storeIds?: number[] | null
  isUnlocked?: boolean
}

/**
 * Purchase Order Validation Result
 */
export interface POValidationResult {
  isValid: boolean
  errors: string[]
  warnings?: string[]
}

/**
 * Purchase Order Approval Request
 */
export interface POApprovalRequest {
  purchase_order_id: number
  approved_by: number
  approval_notes?: string
}

/**
 * Purchase Order Cancellation Request
 */
export interface POCancellationRequest {
  purchase_order_id: number
  cancelled_by: number
  cancellation_reason: string
}

/**
 * Purchase Return Request
 */
export interface PurchaseReturnRequest {
  purchase_order_id: number
  items: Array<{
    purchase_order_item_id: number
    quantity_to_return: number
    return_reason: string
  }>
  return_date: string
  return_notes?: string
}

/**
 * Backorder Information
 */
export interface BackorderInfo {
  purchase_order_id: number
  product_id: number
  quantity_backordered: number
  expected_date?: string
  priority: BackorderPriority
  notification_sent: boolean
  created_at: string
}

