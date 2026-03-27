// src/pages/Finance/TrialBalance/types/trialBalance.types.ts

/**
 * Confirmed v_trial_balance view columns:
 *   company_id, account_code, account_name, account_type,
 *   account_subtype, normal_balance, total_debits, total_credits, net_balance
 *
 * NOTE: account_id is NOT in the view (grouped by coa.id but not selected).
 * For date-filtered queries we use journal_entry_lines directly.
 */
export interface TrialBalanceEntry {
  // ── Real view columns ────────────────────────────────────────────────────
  company_id: number
  account_code: string
  account_name: string
  account_type: string
  account_subtype: string | null
  normal_balance: 'debit' | 'credit'
  total_debits: number
  total_credits: number
  net_balance: number // ✅ real column name (was: balance)

  // ── Legacy compat alias ──────────────────────────────────────────────────
  /** @deprecated use net_balance — kept for backwards compat with renders */
  balance?: number

  // ── Only available when queried from journal_entry_lines directly ────────
  account_id?: number
}

export interface TrialBalanceStats {
  totalDebits: number
  totalCredits: number
  totalAccounts: number
  isBalanced: boolean
  currency?: string
}

export interface TrialBalanceFilters {
  startDate?: string
  endDate?: string
  companyId?: number
}

export interface TrialBalanceGrouped {
  asset: TrialBalanceEntry[]
  liability: TrialBalanceEntry[]
  equity: TrialBalanceEntry[]
  revenue: TrialBalanceEntry[]
  expense: TrialBalanceEntry[]
  cost_of_goods_sold: TrialBalanceEntry[]
}

export interface TrialBalanceSection {
  title: string
  entries: TrialBalanceEntry[]
  totalDebits: number
  totalCredits: number
  accountType: string
}

