// src/pages/Income/types/income.types.ts

/**
 * Income record type matching vw_income_with_details view
 */
export interface Income {
  id: number
  company_id: number
  store_id?: number | null
  income_number: string
  income_date: string
  category_id?: number | null
  account_id?: number | null
  description?: string
  amount: number
  discount_percentage?: number
  discount_amount?: number
  tax_rate?: number
  tax_amount: number
  total_amount: number
  currency?: string | null
  customer_id?: number | null
  sale_id?: number | null
  payment_method: PaymentMethod
  payment_reference?: string | null
  payment_date?: string | null
  payment_status?: PaymentStatus
  is_recurring?: boolean
  recurrence_frequency?: ExpenseFrequency | null
  recurrence_start_date?: string | null
  recurrence_end_date?: string | null
  parent_income_id?: number | null
  invoice_number?: string | null
  invoice_date?: string | null
  status?: FinancialTransactionStatus
  submitted_by?: number | null
  submitted_at?: string | null
  approved_by?: number | null
  approved_at?: string | null
  receipt_url?: string | null
  attachments?: any | null
  department?: string | null
  project_code?: string | null
  notes?: string | null
  tags?: string[] | null
  is_posted: boolean
  posted_at?: string | null
  journal_entry_id?: number | null
  is_system: boolean
  reference_type?: string | null
  reference_id?: number | null
  created_at: string
  updated_at: string
  deleted_at?: string | null

  // Joined fields from vw_income_with_details
  category_name?: string | null
  store_name?: string | null
  customer_name?: string | null
  resolved_customer_name?: string | null

  // Legacy computed fields (kept for compatibility)
  submitted_by_name?: string
  approved_by_name?: string
}

/**
 * Income category type matching the database schema
 */
export interface IncomeCategory {
  id: number
  company_id: number
  category_name: string
  category_code?: string
  parent_category_id?: number | null
  account_id?: number | null
  description?: string | null
  monthly_target?: number | null
  annual_target?: number | null
  icon_name?: string | null
  color_code?: string | null
  is_default: boolean
  is_active: boolean
  created_at: string
  updated_at: string
  deleted_at?: string | null
}

/**
 * Enums matching the database
 */
export type PaymentMethod =
  | 'cash'
  | 'card'
  | 'mobile_money'
  | 'bank_transfer'
  | 'insurance'
  | 'credit'
  | 'check'
  | 'credit_card'
  | 'debit_card'

export type PaymentStatus =
  | 'unpaid'
  | 'partially_paid'
  | 'partial'
  | 'paid'
  | 'overdue'
  | 'cancelled'

export type ExpenseFrequency =
  | 'one_time'
  | 'daily'
  | 'weekly'
  | 'biweekly'
  | 'monthly'
  | 'quarterly'
  | 'semi_annually'
  | 'annually'

export type FinancialTransactionStatus =
  | 'draft'
  | 'pending'
  | 'approved'
  | 'posted'
  | 'cancelled'
  | 'void'

/**
 * Income statistics
 */
export interface IncomeStats {
  total: number
  pending: number
  approved: number
  posted: number
  totalAmount: number
  currentMonthAmount: number
  systemGenerated?: number
  manualEntries?: number
}

/**
 * Filter options for fetching income
 */
export interface IncomeFilters {
  page?: number
  pageSize?: number
  searchQuery?: string
  status?: string
  categoryId?: number | null
  startDate?: string | null
  endDate?: string | null
  storeId?: number | null
  companyId?: number | null
  isSystem?: boolean | null
  referenceType?: string | null
}

/**
 * Result from fetching income data
 */
export interface FetchIncomeResult {
  incomeData: Income[]
  categories: IncomeCategory[]
  totalCount: number
}

