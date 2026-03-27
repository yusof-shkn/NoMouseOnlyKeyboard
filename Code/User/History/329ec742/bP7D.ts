// src/pages/CashFlow/types/cashFlow.types.ts

/**
 * v_cash_flow view columns (UNION of all cash sources):
 *   id, company_id, store_id, transaction_date, transaction_type,
 *   activity_type, description, amount, reference_type, reference_id,
 *   reference_number, journal_entry_id, category, payment_method,
 *   notes, created_by, created_at, updated_at
 *
 * Sources: cash_flow_transactions, sales, purchase_orders,
 *          expenses, income, payment_transactions
 */
export interface CashFlowTransaction {
  // ── Real view columns ────────────────────────────────────────────────────
  id: number
  company_id: number
  store_id: number | null
  transaction_date: string
  transaction_type: 'inflow' | 'outflow'
  activity_type: 'operating' | 'investing' | 'financing'
  description: string
  amount: number
  reference_type: string | null
  reference_id: number | null
  reference_number: string | null
  journal_entry_id: number | null
  category: string | null
  payment_method:
    | 'cash'
    | 'mobile_money'
    | 'bank_transfer'
    | 'check'
    | 'credit_card'
    | 'debit_card'
    | null
  notes: string | null
  created_by: number | null
  created_at: string
  updated_at: string

  // ── Client-side derived fields ───────────────────────────────────────────
  /** amount when transaction_type === 'inflow', else 0 */
  cash_in?: number
  /** amount when transaction_type === 'outflow', else 0 */
  cash_out?: number
  /** cash_in - cash_out for this row */
  net_cash_flow?: number
  /** running balance accumulated across the current page slice */
  running_balance?: number

  // ── Enrichment fields (joined client-side) ───────────────────────────────
  store_name?: string
  creator_name?: string

  // ── Legacy compat aliases ────────────────────────────────────────────────
  /** @deprecated use transaction_date */
  entry_date?: string
  /** @deprecated use reference_number */
  receipt_number?: string | null
}

export interface CashFlowStats {
  totalInflow: number
  totalOutflow: number
  netCashFlow: number
  operatingCashFlow: number
  investingCashFlow: number
  financingCashFlow: number
  currentBalance: number
}

export interface CashFlowFilters {
  page?: number
  pageSize?: number
  searchQuery?: string
  startDate?: string | null
  endDate?: string | null
  transactionType?: string
  activityType?: string
  paymentMethod?: string
  storeId?: number | null
  companyId?: number | null
  accountId?: number | null
}

export interface FetchCashFlowResult {
  transactionsData: CashFlowTransaction[]
  totalCount: number
  stats: CashFlowStats
}

export interface ChartOfAccount {
  id: number
  company_id: number
  account_code: string
  account_name: string
  account_type:
    | 'asset'
    | 'liability'
    | 'equity'
    | 'revenue'
    | 'expense'
    | 'cost_of_goods_sold'
  account_subtype: string
  parent_account_id: number | null
  normal_balance: 'debit' | 'credit'
  current_balance: number
  is_system_account: boolean
  allow_manual_entries: boolean
  is_active: boolean
  created_at: string
  updated_at: string
  deleted_at: string | null
}

