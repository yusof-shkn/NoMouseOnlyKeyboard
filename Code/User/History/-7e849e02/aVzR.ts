// ===================================================================
// @shared/types/companySettings.ts
// ===================================================================

export type StockValuationMethod = 'FIFO' | 'LIFO' | 'AVERAGE'
export type Currency = 'UGX' | 'USD' | 'EUR' | 'GBP' | 'KES' | 'TZS'
export type ReceiptPaperSize = 'A4' | 'thermal' | 'letter'

export type SettingsCategory =
  | 'inventory'
  | 'financial'
  | 'purchases'
  | 'sales'
  | 'pricing'
  | 'returns'
  | 'notifications'
  | 'documents'
  | 'credit'
  | 'backorders'

/**
 * Company Settings interface
 * Matches the company_settings database table structure exactly
 */
export interface CompanySettings {
  id: number
  company_id: number

  // Expiry Settings
  near_expiry_warning_days: number
  near_expiry_critical_days: number
  auto_expire_batches: boolean
  block_expired_sales: boolean
  allow_near_expiry_discount: boolean
  near_expiry_discount_percentage: number | null

  // Stock Settings
  low_stock_multiplier: number
  allow_negative_stock: boolean
  stock_valuation_method: string
  enable_batch_tracking: boolean
  enable_serial_numbers: boolean
  enable_low_stock_notifications: boolean
  enable_expiry_notifications: boolean
  enable_auto_reorder: boolean

  // Currency & Tax
  default_currency: string
  base_currency: string
  tax_rate: number

  // Purchase Settings
  require_purchase_approval: boolean
  allow_purchase_returns: boolean
  purchase_return_days_limit: number
  auto_restock_on_return: boolean
  require_purchase_return_approval: boolean

  // Backorder Settings
  enable_backorders: boolean
  auto_fulfill_backorders: boolean
  backorder_notification_enabled: boolean
  allow_backorder_negative_stock: boolean
  backorder_priority_days: number
  notify_on_backorder: boolean

  // Credit & Payment Settings
  credit_settings: any // JSONB field
  default_credit_days: number
  enable_payment_notifications: boolean

  // Sales Settings
  default_discount_percentage: number
  max_discount_percentage: number
  require_discount_approval: boolean
  allow_negative_sales: boolean
  auto_generate_sale_numbers: boolean
  sale_number_prefix: string
  allow_sales_returns: boolean
  sales_return_days_limit: number
  require_return_approval: boolean
  return_approval_threshold: number

  // Transfer Settings
  allow_inter_store_transfers: boolean
  require_transfer_approval: boolean

  // Notification Settings
  enable_order_notifications: boolean

  // Receipt Settings
  receipt_header_text: string | null
  receipt_footer_text: string | null
  show_company_logo_on_receipt: boolean
  receipt_paper_size: string

  // Document Numbering
  invoice_prefix: string
  po_prefix: string
  auto_increment_documents: boolean
  document_number_padding: number

  // Supplier Settings
  supplier_code_prefix: string
  auto_generate_supplier_codes: boolean
  supplier_code_counter: number

  // Quotation Settings
  quotation_prefix: string
  default_quotation_validity_days: number
  require_quotation_approval: boolean
  auto_generate_quotation_numbers: boolean

  // Expense Settings
  expense_category_prefix: string
  auto_increment_expense_categories: boolean
  expense_category_number_padding: number

  // Restricted Mode
  restricted_mode_password: string | null

  // Timestamps
  created_at: string
  updated_at: string
}

/**
 * Partial company settings for updates
 */
export type PartialCompanySettings = Partial<CompanySettings>

/**
 * Company settings creation (without id, created_at, updated_at)
 */
export type CompanySettingsCreate = Omit<
  CompanySettings,
  'id' | 'created_at' | 'updated_at'
>
export type UpdateCompanySettingsDto = Omit<
  Partial<CompanySettings>,
  'id' | 'company_id' | 'created_at' | 'updated_at'
>

export interface SettingField {
  key: keyof CompanySettings
  label: string
  description: string
  type: 'number' | 'boolean' | 'select' | 'text' | 'textarea'
  category: SettingsCategory
  min?: number
  max?: number
  step?: number
  suffix?: string
  options?: Array<{ value: string; label: string }>
  validation?: (value: any) => string | null
}

export interface CompanySettingsValidation {
  isValid: boolean
  errors: Array<{
    field: string
    message: string
  }>
}

export interface CreditSettings {
  default_credit_days: number
}

