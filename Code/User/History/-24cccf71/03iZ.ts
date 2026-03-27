// src/shared/types/Expense.ts

export interface Expense {
  id: number
  company_id: number
  store_id?: number | null
  expense_number: string
  expense_date: string
  category_id: number
  account_id?: number | null
  description: string
  amount: number
  currency?: string
  tax_amount?: number
  tax_rate?: number
  total_amount: number
  payment_method?: string
  payment_reference?: string
  payment_date?: string
  payment_status?: string
  is_recurring?: boolean
  recurrence_frequency?: string
  recurrence_start_date?: string | null
  recurrence_end_date?: string | null
  parent_expense_id?: number | null
  vendor_name?: string
  supplier_id?: number | null
  invoice_number?: string | null
  invoice_date?: string
  due_date?: string | null
  status: string
  submitted_by?: number | null
  submitted_at?: string | null
  approved_by?: number | null
  approved_at?: string | null
  receipt_url?: string | null
  attachments?: any
  department?: string
  project_code?: string
  notes?: string | null
  tags?: string[]
  is_posted?: boolean
  posted_at?: string | null
  journal_entry_id?: number | null

  // ⭐ NEW: Finance Integration Fields
  is_system?: boolean
  reference_type?: string
  reference_id?: number | null

  created_at?: string
  updated_at?: string
  deleted_at?: string | null

  // Joined data from other tables
  expense_categories?: {
    id: number
    category_name: string
    category_code: string
  }
  chart_of_accounts?: {
    account_name: string
    account_code: string
  }
  stores?: {
    store_name: string
    store_code: string
  }
  suppliers?: {
    supplier_name: string
    contact_person?: string
  }
  submitted_by_profile?: {
    first_name?: string
    last_name?: string
    email?: string
  }
  approved_by_profile?: {
    first_name?: string
    last_name?: string
    email?: string
  }
}

export interface ExpenseFormValues {
  id?: number
  company_id: number | string
  store_id?: number | string
  expense_number: string
  expense_date: string
  category_id: number | string
  account_id?: number | string
  description: string
  amount: number | string
  tax_amount: number | string
  total_amount: number | string
  payment_method: string
  payment_status: string
  supplier_id?: number | string
  invoice_number?: string
  due_date?: string
  receipt_url?: string
  notes?: string
  is_recurring: boolean
  recurrence_frequency?: string
  recurrence_start_date?: string
  recurrence_end_date?: string
  status: string
}

export interface ExpenseFormInitialValues {
  id?: number
  company_id?: number | string
  store_id?: number | string
  expense_number?: string
  expense_date?: string
  category_id?: number | string
  account_id?: number | string
  description?: string
  amount?: number | string
  tax_amount?: number | string
  total_amount?: number | string
  payment_method?: string
  payment_status?: string
  supplier_id?: number | string
  invoice_number?: string
  due_date?: string
  receipt_url?: string
  notes?: string
  is_recurring?: boolean
  recurrence_frequency?: string
  recurrence_start_date?: string
  recurrence_end_date?: string
  status?: string
}

export interface ExpenseFormProps {
  initialValues?: ExpenseFormInitialValues
  mode?: 'create' | 'edit'
}

export interface ExpenseStats {
  total: number
  pending: number
  approved: number
  totalAmount: number
  monthlyAmount: number
}

export interface ExpenseFilters {
  page?: number
  pageSize?: number
  searchQuery?: string
  status?: string
  categoryId?: number | null
  companyId?: number | null
  storeId?: number | null
  startDate?: string | null
  endDate?: string | null
  paymentMethod?: string
  paymentStatus?: string
  isUnlocked?: boolean
}

export interface FetchExpensesResult {
  expensesData: Expense[]
  categoriesData: ExpenseCategory[]
  totalCount: number
}

export interface ExpenseCategory {
  id: number
  company_id: number
  category_name: string
  category_code: string
  description?: string
  parent_category_id?: number | null
  level?: number
  account_id?: number | null
  is_active: boolean
  is_default?: boolean // ⭐ NEW: Default category flag
  icon_name?: string
  color_code?: string
  sort_order?: number
  monthly_budget?: number
  annual_budget?: number
  created_at?: string
  updated_at?: string
  deleted_at?: string | null
}

