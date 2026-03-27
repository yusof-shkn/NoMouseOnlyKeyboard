// @features/settings/companySettings/utils/companySettings.utils.ts

import {
  CompanySettings,
  CompanySettingsValidation,
  SettingField,
  UpdateCompanySettingsDto,
} from '@shared/types/companySettings'

/**
 * Validate company settings
 */
export const validateCompanySettings = (
  settings: Partial<CompanySettings>,
): CompanySettingsValidation => {
  const errors: { field: string; message: string }[] = []

  // Expiry days validation
  if (settings.near_expiry_warning_days !== undefined) {
    if (settings.near_expiry_warning_days < 1) {
      errors.push({
        field: 'near_expiry_warning_days',
        message: 'Warning days must be at least 1',
      })
    }
    if (settings.near_expiry_warning_days > 365) {
      errors.push({
        field: 'near_expiry_warning_days',
        message: 'Warning days cannot exceed 365',
      })
    }
  }

  if (settings.near_expiry_critical_days !== undefined) {
    if (settings.near_expiry_critical_days < 1) {
      errors.push({
        field: 'near_expiry_critical_days',
        message: 'Critical days must be at least 1',
      })
    }
    if (settings.near_expiry_critical_days > 365) {
      errors.push({
        field: 'near_expiry_critical_days',
        message: 'Critical days cannot exceed 365',
      })
    }
  }

  if (
    settings.near_expiry_critical_days !== undefined &&
    settings.near_expiry_warning_days !== undefined &&
    settings.near_expiry_critical_days >= settings.near_expiry_warning_days
  ) {
    errors.push({
      field: 'near_expiry_critical_days',
      message: 'Critical days must be less than warning days',
    })
  }

  // Low stock multiplier validation
  if (settings.low_stock_multiplier !== undefined) {
    if (settings.low_stock_multiplier < 0.1) {
      errors.push({
        field: 'low_stock_multiplier',
        message: 'Multiplier must be at least 0.1',
      })
    }
    if (settings.low_stock_multiplier > 10) {
      errors.push({
        field: 'low_stock_multiplier',
        message: 'Multiplier cannot exceed 10',
      })
    }
  }

  // Tax rate validation
  if (settings.tax_rate !== undefined) {
    if (settings.tax_rate < 0) {
      errors.push({
        field: 'tax_rate',
        message: 'Tax rate cannot be negative',
      })
    }
    if (settings.tax_rate > 100) {
      errors.push({
        field: 'tax_rate',
        message: 'Tax rate cannot exceed 100%',
      })
    }
  }

  // Backorder priority days validation
  if (settings.backorder_priority_days !== undefined) {
    if (settings.backorder_priority_days < 1) {
      errors.push({
        field: 'backorder_priority_days',
        message: 'Priority days must be at least 1',
      })
    }
    if (settings.backorder_priority_days > 90) {
      errors.push({
        field: 'backorder_priority_days',
        message: 'Priority days cannot exceed 90',
      })
    }
  }

  // Currency validation
  if (settings.default_currency !== undefined) {
    const validCurrencies = ['UGX', 'USD', 'EUR', 'GBP', 'KES', 'TZS']
    if (!validCurrencies.includes(settings.default_currency)) {
      errors.push({
        field: 'default_currency',
        message: 'Invalid currency code',
      })
    }
  }

  // Discount percentage validations
  if (settings.default_discount_percentage !== undefined) {
    if (
      settings.default_discount_percentage < 0 ||
      settings.default_discount_percentage > 100
    ) {
      errors.push({
        field: 'default_discount_percentage',
        message: 'Default discount must be between 0 and 100%',
      })
    }
  }

  if (settings.max_discount_percentage !== undefined) {
    if (
      settings.max_discount_percentage < 0 ||
      settings.max_discount_percentage > 100
    ) {
      errors.push({
        field: 'max_discount_percentage',
        message: 'Max discount must be between 0 and 100%',
      })
    }
  }

  if (
    settings.default_discount_percentage !== undefined &&
    settings.max_discount_percentage !== undefined &&
    settings.max_discount_percentage < settings.default_discount_percentage
  ) {
    errors.push({
      field: 'max_discount_percentage',
      message: 'Max discount must be greater than or equal to default discount',
    })
  }

  // Credit days validation
  if (settings.default_credit_days !== undefined) {
    if (
      settings.default_credit_days < 1 ||
      settings.default_credit_days > 365
    ) {
      errors.push({
        field: 'default_credit_days',
        message: 'Credit days must be between 1 and 365',
      })
    }
  }

  // Sales return days validation
  if (settings.sales_return_days_limit !== undefined) {
    if (
      settings.sales_return_days_limit < 0 ||
      settings.sales_return_days_limit > 365
    ) {
      errors.push({
        field: 'sales_return_days_limit',
        message: 'Return days limit must be between 0 and 365',
      })
    }
  }

  // Return approval threshold validation
  if (settings.return_approval_threshold !== undefined) {
    if (settings.return_approval_threshold < 0) {
      errors.push({
        field: 'return_approval_threshold',
        message: 'Return approval threshold cannot be negative',
      })
    }
  }

  // Purchase return days validation
  if (settings.purchase_return_days_limit !== undefined) {
    if (
      settings.purchase_return_days_limit < 0 ||
      settings.purchase_return_days_limit > 365
    ) {
      errors.push({
        field: 'purchase_return_days_limit',
        message: 'Purchase return days must be between 0 and 365',
      })
    }
  }

  // Document number padding validation
  if (settings.document_number_padding !== undefined) {
    if (
      settings.document_number_padding < 4 ||
      settings.document_number_padding > 10
    ) {
      errors.push({
        field: 'document_number_padding',
        message: 'Document padding must be between 4 and 10 digits',
      })
    }
  }

  // Near expiry discount percentage validation
  if (settings.near_expiry_discount_percentage !== undefined) {
    if (
      settings.near_expiry_discount_percentage < 0 ||
      settings.near_expiry_discount_percentage > 100
    ) {
      errors.push({
        field: 'near_expiry_discount_percentage',
        message: 'Near expiry discount must be between 0 and 100%',
      })
    }
  }

  // Receipt paper size validation
  if (settings.receipt_paper_size !== undefined) {
    const validSizes = ['A4', 'thermal', 'letter']
    if (!validSizes.includes(settings.receipt_paper_size)) {
      errors.push({
        field: 'receipt_paper_size',
        message: 'Invalid receipt paper size',
      })
    }
  }

  // Base currency validation
  if (settings.base_currency !== undefined) {
    const validCurrencies = ['UGX', 'USD', 'EUR', 'GBP', 'KES', 'TZS']
    if (!validCurrencies.includes(settings.base_currency)) {
      errors.push({
        field: 'base_currency',
        message: 'Invalid base currency code',
      })
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
}

/**
 * Get settings field configuration
 */
export const getSettingsFields = (): SettingField[] => {
  return [
    // Inventory Settings
    {
      key: 'near_expiry_warning_days',
      label: 'Near Expiry Warning (Days)',
      description: 'Number of days before expiry to show warning alerts',
      type: 'number',
      category: 'inventory',
      min: 1,
      max: 365,
      step: 1,
      suffix: 'days',
      validation: (value) => {
        if (value < 1) return 'Must be at least 1 day'
        if (value > 365) return 'Cannot exceed 365 days'
        return null
      },
    },
    {
      key: 'near_expiry_critical_days',
      label: 'Near Expiry Critical (Days)',
      description: 'Number of days before expiry to show critical alerts',
      type: 'number',
      category: 'inventory',
      min: 1,
      max: 365,
      step: 1,
      suffix: 'days',
    },
    {
      key: 'auto_expire_batches',
      label: 'Auto-Expire Batches',
      description:
        'Automatically mark batches as expired when expiry date passes',
      type: 'boolean',
      category: 'inventory',
    },
    {
      key: 'low_stock_multiplier',
      label: 'Low Stock Multiplier',
      description: 'Multiplier for low stock threshold calculations',
      type: 'number',
      category: 'inventory',
      min: 0.1,
      max: 10,
      step: 0.1,
    },
    {
      key: 'allow_negative_stock',
      label: 'Allow Negative Stock',
      description: 'Allow sales even when stock quantity goes below zero',
      type: 'boolean',
      category: 'inventory',
    },
    {
      key: 'stock_valuation_method',
      label: 'Stock Valuation Method',
      description: 'Method used for stock valuation and cost calculation',
      type: 'select',
      category: 'inventory',
      options: [
        { value: 'FIFO', label: 'FIFO (First In, First Out)' },
        { value: 'LIFO', label: 'LIFO (Last In, First Out)' },
        { value: 'AVERAGE', label: 'Weighted Average' },
      ],
    },
    {
      key: 'enable_batch_tracking',
      label: 'Enable Batch Tracking',
      description: 'Track products by batch numbers and expiry dates',
      type: 'boolean',
      category: 'inventory',
    },
    {
      key: 'enable_serial_numbers',
      label: 'Enable Serial Numbers',
      description: 'Track individual items by serial numbers',
      type: 'boolean',
      category: 'inventory',
    },

    // Financial Settings
    {
      key: 'default_currency',
      label: 'Default Currency',
      description: 'Default currency for all transactions',
      type: 'select',
      category: 'financial',
      options: [
        { value: 'UGX', label: 'UGX - Ugandan Shilling' },
        { value: 'USD', label: 'USD - US Dollar' },
        { value: 'EUR', label: 'EUR - Euro' },
        { value: 'GBP', label: 'GBP - British Pound' },
        { value: 'KES', label: 'KES - Kenyan Shilling' },
        { value: 'TZS', label: 'TZS - Tanzanian Shilling' },
      ],
    },
    {
      key: 'tax_rate',
      label: 'Tax Rate (%)',
      description: 'Default tax rate for sales',
      type: 'number',
      category: 'financial',
      min: 0,
      max: 100,
      step: 0.01,
      suffix: '%',
    },

    // Purchase Settings
    {
      key: 'require_purchase_approval',
      label: 'Require Purchase Approval',
      description: 'Purchase orders must be approved before processing',
      type: 'boolean',
      category: 'purchases',
    },

    // Backorder Settings
    {
      key: 'enable_backorders',
      label: 'Enable Backorders',
      description: 'Allow customers to order out-of-stock items',
      type: 'boolean',
      category: 'backorders',
    },
    {
      key: 'auto_fulfill_backorders',
      label: 'Auto-Fulfill Backorders',
      description: 'Automatically fulfill backorders when stock arrives',
      type: 'boolean',
      category: 'backorders',
    },
    {
      key: 'allow_backorder_negative_stock',
      label: 'Allow Negative Stock for Backorders',
      description: 'Allow backorder fulfillment even with negative stock',
      type: 'boolean',
      category: 'backorders',
    },
    {
      key: 'backorder_priority_days',
      label: 'Backorder Priority Days',
      description:
        'Days after which backorder priority increases automatically',
      type: 'number',
      category: 'backorders',
      min: 1,
      max: 90,
      step: 1,
      suffix: 'days',
    },
    {
      key: 'backorder_notification_enabled',
      label: 'Backorder Notifications',
      description: 'Send notifications for backorder events',
      type: 'boolean',
      category: 'backorders',
    },
    {
      key: 'notify_on_backorder',
      label: 'Notify on Backorder Creation',
      description: 'Send notification when a backorder is created',
      type: 'boolean',
      category: 'backorders',
    },
  ]
}

/**
 * Get fields by category
 */
export const getFieldsByCategory = (category: string): SettingField[] => {
  return getSettingsFields().filter((field) => field.category === category)
}

/**
 * Format currency value
 */
export const formatCurrency = (value: number, currency: string): string => {
  const currencySymbols: Record<string, string> = {
    UGX: 'UGX',
    USD: '$',
    EUR: '€',
    GBP: '£',
    KES: 'KES',
    TZS: 'TZS',
  }

  const symbol = currencySymbols[currency] || currency
  return `${symbol} ${value.toLocaleString()}`
}

/**
 * Format percentage
 */
export const formatPercentage = (value: number): string => {
  return `${value.toFixed(2)}%`
}

/**
 * Get default settings - MATCHES EXACT DATABASE SCHEMA
 */
export const getDefaultSettings = (): Omit<
  CompanySettings,
  'id' | 'company_id' | 'created_at' | 'updated_at'
> => {
  return {
    // ==================== CORE INVENTORY SETTINGS ====================
    near_expiry_warning_days: 60,
    near_expiry_critical_days: 30,
    auto_expire_batches: true,
    low_stock_multiplier: 1.0,
    allow_negative_stock: false,
    stock_valuation_method: 'FIFO',
    enable_batch_tracking: true,
    enable_serial_numbers: false,

    // ==================== FINANCIAL SETTINGS ====================
    default_currency: 'UGX',
    base_currency: 'UGX',
    tax_rate: 0,

    // ==================== PURCHASE SETTINGS ====================
    require_purchase_approval: false,
    allow_purchase_returns: true,
    purchase_return_days_limit: 14,
    require_purchase_return_approval: false,

    // ==================== BACKORDER SETTINGS ====================
    enable_backorders: true,
    auto_fulfill_backorders: false,
    backorder_notification_enabled: true,
    allow_backorder_negative_stock: false,
    backorder_priority_days: 7,
    notify_on_backorder: true,

    // ==================== CREDIT SETTINGS (JSONB) ====================
    credit_settings: {
      default_credit_limit: 1000000,
      credit_check_enabled: true,
      overdue_interest_rate: 0,
      payment_reminder_days: [7, 3, 1],
    },
    default_credit_days: 30,

    // ==================== SALES & PRICING ====================
    default_discount_percentage: 0,
    max_discount_percentage: 20,
    require_discount_approval: true,
    allow_negative_sales: false,
    auto_generate_sale_numbers: true,
    sale_number_prefix: 'SAL',

    // ==================== RETURNS & REFUNDS ====================
    allow_sales_returns: true,
    sales_return_days_limit: 30,
    require_return_approval: true,
    return_approval_threshold: 5000,
    auto_restock_on_return: true,

    // ==================== NOTIFICATIONS ====================
    enable_low_stock_notifications: true,
    enable_expiry_notifications: true,
    enable_payment_notifications: true,
    enable_order_notifications: true,

    // ==================== INVENTORY MANAGEMENT ====================
    enable_auto_reorder: false,
    allow_inter_store_transfers: true,
    require_transfer_approval: false,

    // ==================== DOCUMENTS & RECEIPTS ====================
    receipt_header_text: 'Thank you for your business!',
    receipt_footer_text:
      'All sales are final unless otherwise stated. Please keep your receipt for returns.',
    show_company_logo_on_receipt: true,
    receipt_paper_size: 'A4',
    invoice_prefix: 'INV',
    po_prefix: 'PO',
    auto_increment_documents: true,
    document_number_padding: 6,

    // ==================== EXPIRY MANAGEMENT ====================
    block_expired_sales: true,
    allow_near_expiry_discount: true,
    near_expiry_discount_percentage: 10,

    // ==================== SUPPLIER CODE SETTINGS ====================
    supplier_code_prefix: 'SUP',
    auto_generate_supplier_codes: true,
    supplier_code_counter: 1,

    // ==================== QUOTATION SETTINGS ====================
    quotation_prefix: 'QT',
    default_quotation_validity_days: 30,
    require_quotation_approval: false,
    auto_generate_quotation_numbers: true,

    // ==================== EXPENSE CATEGORY SETTINGS ====================
    expense_category_prefix: 'EXP',
    auto_increment_expense_categories: true,
    expense_category_number_padding: 4,
  }
}

/**
 * Compare settings to detect changes
 */
export const getChangedSettings = (
  original: CompanySettings,
  updated: Partial<CompanySettings>,
): Partial<CompanySettings> => {
  return (Object.keys(updated) as Array<keyof CompanySettings>).reduce(
    (acc, key) => {
      if (original[key] !== updated[key]) {
        ;(acc as any)[key] = updated[key]
      }
      return acc
    },
    {} as Partial<CompanySettings>,
  )
}

/**
 * Create settings change log message
 */
export const createChangeLogMessage = (
  changes: Partial<CompanySettings>,
): string[] => {
  const fields = getSettingsFields()
  const messages: string[] = []

  Object.keys(changes).forEach((key) => {
    const field = fields.find((f) => f.key === key)
    if (field) {
      messages.push(
        `${field.label} changed to ${changes[key as keyof CompanySettings]}`,
      )
    }
  })

  return messages
}

