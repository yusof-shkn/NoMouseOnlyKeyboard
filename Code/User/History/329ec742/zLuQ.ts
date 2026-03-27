// src/shared/types/CashFlow.ts

export interface CashFlowTransaction {
  id: number
  company_id: number
  store_id: number | null
  transaction_date: string
  transaction_type: 'inflow' | 'outflow'
  activity_type: 'operating' | 'investing' | 'financing'
  amount: number
  description: string
  reference_type: string | null
  reference_id: number | null
  account_id: number
  payment_method:
    | 'cash'
    | 'mobile_money'
    | 'bank_transfer'
    | 'check'
    | 'credit_card'
    | 'debit_card'
  bank_name: string | null
  account_number: string | null
  receipt_number: string | null
  created_by: string
  approved_by: string | null
  is_approved: boolean
  notes: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null

  // Computed fields
  account_name?: string
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

