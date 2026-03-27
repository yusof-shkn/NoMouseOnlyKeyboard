// src/shared/types/cashFlow.types.ts

/**
 * Represents a row returned by the v_cash_flow view.
 *
 * Actual view columns (confirmed via information_schema):
 *   company_id, store_id, transaction_date, activity_type, transaction_type,
 *   description, amount, reference_type, reference_id, reference_number,
 *   payment_method, created_at
 *
 * Fields NOT in the view (derived client-side):
 *   - cash_in / cash_out  → derived from transaction_type + amount
 *   - net_cash_flow        → derived client-side
 *   - running_balance      → accumulated client-side per page slice
 *   - account_name         → not in view; looked up via getChartOfAccounts
 */
export interface CashFlowTransaction {
  // ── Columns present in v_cash_flow ─────────────────────────────────────
  company_id: number
  store_id: number | null
  transaction_date: string          // DATE — use instead of entry_date
  activity_type: 'operating' | 'investing' | 'financing'
  transaction_type: 'inflow' | 'outflow'
  description: string
  amount: number
  reference_type: string | null
  reference_id: number | null
  reference_number: string | null   // receipt / invoice / PO number
  payment_method:
    | 'cash'
    | 'mobile_money'
    | 'bank_transfer'
    | 'check'
    | 'credit_card'
    | 'debit_card'
    | null
  created_at: string

  // ── Present on underlying table, not the view ───────────────────────────
  id: number                        // required for delete / row key
  account_id?: number
  bank_name?: string | null
  account_number?: string | null
  /** @deprecated use reference_number — kept for backwards compat */
  receipt_number?: string | null
  created_by?: string
  approved_by?: string | null
  is_approved?: boolean
  notes?: string | null
  updated_at?: string
  deleted_at?: string | null

  // ── Client-side derived / enrichment fields ─────────────────────────────
  /** cash_in convenience: amount when transaction_type === 'inflow', else 0 */
  cash_in?: number
  /** cash_out convenience: amount when transaction_type === 'outflow', else 0 */
  cash_out?: number
  /** net: cash_in - cash_out for this row */
  net_cash_flow?: number
  /** running balance accumulated across the current page slice */
  running_balance?: number
  /** @deprecated use transaction_date */
  entry_date?: string

  // Enrichment lookups
  account_name?: string
  account_code?: string
  store_name?: string
  creator_name?: string
  approver_name?: string
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
