// src/shared/types/CashFlow.ts

/**
 * Represents a row returned by the v_cash_flow view.
 *
 * View columns (source of truth):
 *   company_id, entry_date, description, reference_type, reference_id,
 *   account_name, activity_type, cash_in, cash_out, net_cash_flow,
 *   running_balance_by_activity
 *
 * NOTE: The view does NOT expose transaction_type, amount, account_id,
 * store_id, payment_method, receipt_number, created_by, approved_by, etc.
 * Those fields only exist on the underlying cash_flow_transactions table and
 * are fetched via getCashFlowTransactionById when a detail view is needed.
 *
 * Derived helpers (computed client-side):
 *   - transactionType: derived from cash_in > 0 ? 'inflow' : 'outflow'
 *   - amount:          derived from cash_in || cash_out
 */
export interface CashFlowTransaction {
  // ── Fields present in v_cash_flow view ──────────────────────────────────
  company_id: number
  entry_date: string
  description: string
  reference_type: string | null
  reference_id: number | null
  account_name: string
  activity_type: 'operating' | 'investing' | 'financing'
  cash_in: number
  cash_out: number
  net_cash_flow: number
  running_balance_by_activity: number

  // ── Fields only on the underlying table (available via getCashFlowTransactionById) ──
  id: number
  store_id?: number | null
  account_id?: number
  payment_method?:
    | 'cash'
    | 'mobile_money'
    | 'bank_transfer'
    | 'check'
    | 'credit_card'
    | 'debit_card'
  bank_name?: string | null
  account_number?: string | null
  receipt_number?: string | null
  created_by?: string
  approved_by?: string | null
  is_approved?: boolean
  notes?: string | null
  created_at?: string
  updated_at?: string
  deleted_at?: string | null

  // ── Client-side derived helpers ──────────────────────────────────────────
  /**
   * Derived from cash_in / cash_out. Use this instead of a raw transaction_type
   * column (which does not exist in v_cash_flow).
   */
  transaction_type?: 'inflow' | 'outflow'
  /**
   * Convenience total: cash_in || cash_out. Prefer cash_in / cash_out directly.
   */
  amount?: number

  // ── Computed enrichment fields (set by enrichCashFlowTransactions) ───────
  account_code?: string
  store_name?: string
  creator_name?: string
  approver_name?: string
  running_balance?: number
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

