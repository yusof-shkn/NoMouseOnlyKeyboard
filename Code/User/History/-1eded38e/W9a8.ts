// src/features/sales/types/index.ts

// Database-aligned types based on the schema
export type SaleType = 'retail' | 'wholesale'
export type SaleStatus = 'completed' | 'pending' | 'cancelled' | 'refunded'
export type PaymentStatus = 'unpaid' | 'partially_paid' | 'paid' | 'overdue'
export type PaymentMethod =
  | 'cash'
  | 'card'
  | 'mobile_money'
  | 'bank_transfer'
  | 'insurance'
  | 'credit'

// Backorder types
export type BackorderStatus =
  | 'pending'
  | 'partially_fulfilled'
  | 'fulfilled'
  | 'cancelled'

export type StockStatus =
  | 'IN_STOCK'
  | 'LOW_STOCK'
  | 'OUT_OF_STOCK'
  | 'BACKORDER_AVAILABLE'

// Sale types enum
export enum SaleTypeEnum {
  RETAIL = 'retail',
  WHOLESALE = 'wholesale',
}
// Add this near the other component props definitions
export interface PurchaseSummaryProps {
  totals: PurchaseTotals
  shipping: number
  coupon: number
  discount: number
  onEditCosts: () => void
}
// Updated Customer interface with credit fields
// Add these fields to your Customer interface in: src/features/sales/types/index.ts

export interface Customer {
  id: number
  company_id: number
  customer_code: string
  first_name: string
  last_name: string
  phone: string
  email: string | null
  date_of_birth: string | null
  gender: string | null
  address: string | null
  city: string | null
  district: string | null
  insurance_provider: string | null
  insurance_number: string | null
  insurance_expiry_date: string | null
  allergies: string | null
  medical_conditions: string | null
  blood_group: string | null
  total_purchases: number
  last_purchase_date: string | null
  loyalty_points: number
  is_active: boolean
  // ✅ ADD THESE CREDIT FIELDS
  credit_limit?: number
  current_credit_balance?: number
  available_credit?: number
  credit_days?: number
  credit_status?: string
}

export interface Sale {
  id: number
  company_id: number
  store_id: number
  sale_number: string
  sale_type: SaleType
  sale_date: string
  customer_id: number | null
  prescription_number: string | null
  prescription_date: string | null
  prescriber_name: string | null
  subtotal: number
  discount_amount: number
  tax_amount: number
  total_amount: number
  amount_paid: number
  change_amount: number
  payment_method: PaymentMethod
  payment_status: PaymentStatus
  sale_status: SaleStatus
  notes: string | null
  processed_by: number | null
  created_at: string
  updated_at: string
}

export interface SaleItem {
  id: number
  sale_id: number
  product_id: number
  batch_id: number | null
  batch_number: string | null
  quantity: number
  unit_price: number
  cost_price: number | null
  discount_amount: number
  total_price: number
  profit_amount: number
  is_backordered?: boolean // Enhanced: backorder flag
  backorder_quantity?: number // Enhanced: backorder quantity
  created_at: string
  updated_at: string
}

// Backorder entity
export interface Backorder {
  id: number
  company_id: number
  store_id: number
  sale_id: number
  sale_item_id: number
  product_id: number
  backorder_number: string
  quantity_ordered: number
  quantity_fulfilled: number
  quantity_remaining: number
  status: BackorderStatus
  priority: number
  expected_fulfillment_date: string | null
  created_by: number | null
  cancelled_by: number | null
  cancelled_at: string | null
  cancellation_reason: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

// Backorder fulfillment entity
export interface BackorderFulfillment {
  id: number
  backorder_id: number
  batch_id: number
  quantity_fulfilled: number
  fulfilled_by: number | null
  fulfilled_at: string
  notes: string | null
  created_at: string
}

export interface Supplier {
  id: number
  company_id: number
  supplier_name: string
  supplier_code: string
  contact_person: string | null
  phone: string
  email: string | null
  address: string | null
  city: string | null
  country: string
  is_active: boolean
  payment_terms: string
  credit_limit: number
  current_balance: number
  created_at: string
  updated_at: string
}

// Calculated fields type
export interface PurchaseTotals {
  subTotal: number
  tax: number
  shipping: number
  coupon: number
  discount: number
  grandTotal: number
  taxPercentage: number
}

// ============================================================================
// ✅ FIXED: UI-specific OrderItem type matching handler structure
// ============================================================================
export interface OrderItem {
  id: number // product_id
  productName: string // Product display name (was 'name')
  productCode: string // Product code (was 'code?')
  unit: string
  batchNumber: string // Batch number (was 'batch')
  batchId: number | null // Batch ID (was 'batchId?')
  qty: number
  price: number
  costPrice: number // Cost price (was 'cost')
  expiryDate: string | null // Expiry date (was 'exp')
  subtotal: number
  availableStock: number // Available stock (was 'stock')
  discountAmount: number // Discount amount (was 'discount?')
  // Enhanced: Backorder properties
  allowBackorder?: boolean
  isBackordered?: boolean
  backorderQuantity?: number
  quantityFulfilled?: number
  unit_id?: number
}

export interface BatchDetails {
  batchId: string
  price: number
  cost: number
  stock: number
  mfd: string
  exp: string
}

export interface ProductWithBatches extends Product {
  batches: BatchDetails[]
  category?: Category
  unit?: Unit
  total_quantity: number
  available_quantity: number
  expiring_soon_count: number
  total_batches: number
  stock_status: StockStatus
  // Enhanced: Backorder properties
  allow_backorder?: boolean
  pending_backorders?: number
  can_sell?: boolean
}

export interface PaymentMethodOption {
  value: PaymentMethod
  label: string
  icon: string
}

// Prescription-specific types
export interface PrescriptionDetails {
  prescription_number: string
  prescription_date: string
  prescriber_name: string
  prescriber_license?: string
  prescriber_contact?: string
  patient_name?: string
  patient_age?: number
  diagnosis?: string
  notes?: string
}

// Quotation-specific types (for wholesale)
export interface QuotationDetails {
  quotation_number: string
  quotation_date: string
  valid_until: string
  customer_id?: number
  customer_name?: string
  delivery_address?: string
  delivery_terms?: string
  payment_terms?: string
  notes?: string
}

// Request/Response types
export interface CreateSaleRequest {
  company_id: number
  store_id: number
  sale_type: SaleType
  customer_id?: number
  prescription_number?: string
  prescription_date?: string
  prescriber_name?: string
  quotation_number?: string
  subtotal: number
  discount_amount: number
  tax_amount: number
  total_amount: number
  amount_paid: number
  change_amount: number
  payment_method: PaymentMethod
  payment_status: PaymentStatus
  notes?: string
  processed_by?: number
  items: CreateSaleItemRequest[]
}

export interface CreateSaleItemRequest {
  product_id: number
  batch_id: number
  batch_number: string
  quantity: number
  unit_price: number
  cost_price: number
  discount_amount: number
  available_stock?: number // Enhanced: for backorder calculation
}

// Enhanced: Sale creation response with backorder info
export interface CreateSaleResponse {
  sale: Sale
  items: SaleItem[]
  saleNumber: string
  backordersCreated?: Backorder[]
  backorderCount: number
  hasBackorders: boolean
}

// Stock validation types
export interface StockValidation {
  product_id: number
  batch_id: number
  batch_number?: string
  product_name?: string
  requested: number
  available: number
  shortfall: number
  is_valid: boolean
  requires_backorder: boolean
  can_backorder: boolean
  message: string
}

export interface StockValidationResult {
  all_valid: boolean
  validations: StockValidation[]
  has_backorders: boolean
}

// Calculated fields
export interface SaleTotals {
  subTotal: number
  discount: number
  tax: number
  grandTotal: number
  amountPaid: number
  changeAmount: number
  taxPercentage: number
}

// Component props
export interface OrderItemCardProps {
  item: OrderItem
  index: number
  onEdit: (item: OrderItem) => void
  onRemove: (index: number) => void
  onInlineChange: (index: number, field: 'qty' | 'price', value: number) => void
}

export interface SaleSummaryProps {
  totals: SaleTotals
  discount: number
  onEditCosts: () => void
}

export interface PaymentMethodsProps {
  paymentMethods: PaymentMethodOption[]
  selectedPayment: PaymentMethod | null
  onSelect: (method: string) => void
}

// Additional types from database
export interface Product {
  id: number
  company_id: number
  product_name: string
  generic_name: string | null
  product_code: string
  barcode: string | null
  category_id: number | null
  unit_id: number | null
  dosage_form: string | null
  strength: string | null
  standard_cost: number | null
  standard_price: number | null
  reorder_level: number
  image_url: string | null
  requires_prescription?: boolean
  allow_backorder?: boolean // Enhanced: backorder flag
  is_active: boolean
}

export interface Category {
  id: number
  company_id: number
  category_name: string
  category_code: string | null
  is_active: boolean
  product_count?: number
}

export interface Unit {
  id: number
  company_id: number
  name: string
  short_code: string
  is_active: boolean
}

export interface ProductBatch {
  id: number
  company_id: number
  product_id: number
  store_id: number
  batch_number: string
  manufacturing_date: string | null
  expiry_date: string | null
  quantity_available: number
  unit_cost: number
  selling_price: number | null
  is_active: boolean
  is_expired: boolean
}

// Company settings
export interface CompanySettings {
  id: number
  company_id: number
  enable_backorders: boolean // Enhanced: backorder feature toggle
  auto_fulfill_backorders: boolean // Enhanced: auto-fulfillment toggle
  backorder_priority_days?: number
  notify_on_backorder?: boolean
  low_stock_threshold?: number
  critical_stock_threshold?: number
  created_at: string
  updated_at: string
}

// Backorder summary view (for dashboards/reports)
export interface BackorderSummary {
  id: number
  backorder_number: string
  product_id: number
  product_name: string
  product_code: string
  quantity_ordered: number
  quantity_fulfilled: number
  quantity_remaining: number
  status: BackorderStatus
  priority: number
  created_at: string
  sale_number: string
  customer_name: string | null
  customer_phone: string | null
  days_pending: number
}

// Backorder statistics
export interface BackorderStatistics {
  total: number
  pending: number
  partiallyFulfilled: number
  fulfilled: number
  cancelled: number
  totalQuantityPending: number
  averageFulfillmentTime?: number
  oldestPendingDays?: number
}

// Filter options for backorder queries
export interface BackorderFilters {
  productId?: number
  customerId?: number
  status?: BackorderStatus
  priority?: number
  minDaysPending?: number
  maxDaysPending?: number
  limit?: number
  offset?: number
}

// Receipt/Invoice types
export interface ReceiptData {
  saleNumber: string
  date: string
  time: string
  customerName?: string
  items: ReceiptItem[]
  subtotal: number
  discount: number
  tax: number
  grandTotal: number
  amountPaid: number
  changeAmount: number
  paymentMethod: string
  hasBackorders?: boolean
  backorderCount?: number
}

export interface ReceiptItem {
  name: string
  quantity: number
  price: number
  total: number
  isBackordered?: boolean
  backorderQuantity?: number
}

