// src/shared/types/credit.ts

/**
 * Transaction Status Types
 */
export type CreditTransactionStatus =
  | 'pending'
  | 'paid'
  | 'overdue'
  | 'partial'
  | 'pending_approval'

export type CreditTransactionType =
  | 'charge'
  | 'payment'
  | 'adjustment'
  | 'refund'

export type EntityType = 'customer' | 'supplier'

export type PaymentMethod =
  | 'cash'
  | 'card'
  | 'mobile_money'
  | 'bank_transfer'
  | 'check'

export type AdjustmentType =
  | 'increase_limit'
  | 'decrease_limit'
  | 'write_off'
  | 'correction'
  | 'goodwill'

export type InstallmentFrequency = 'weekly' | 'biweekly' | 'monthly'

/**
 * Credit Tier type definition
 */
export interface CreditTier {
  id: number
  company_id: number
  tier_name: string
  tier_code: string
  tier_level: number
  tier_color: string | null
  tier_icon: string | null
  max_credit_limit: number
  min_credit_limit: number
  max_credit_days: number
  grace_period_days: number | null
  min_purchase_history: number | null
  min_transactions: number | null
  good_payment_ratio: number | null
  discount_percentage: number | null
  interest_rate: number | null
  late_fee: number | null
  requires_approval: boolean
  auto_upgrade: boolean
  is_active: boolean
  description: string | null
  created_at: string
  updated_at: string
}

/**
 * Credit Transaction type definition
 */
export interface CreditTransaction {
  id: number
  company_id: number
  entity_type: EntityType
  entity_id: number
  transaction_type: CreditTransactionType
  reference_type: string | null
  reference_id: number | null
  reference_number: string | null
  transaction_amount: number
  balance_before: number
  balance_after: number
  due_date: string | null
  paid_date: string | null
  days_overdue: number | null
  status: CreditTransactionStatus
  payment_method: string | null
  description: string | null
  notes: string | null
  created_by: number | null
  created_at: string
  updated_at: string
}

/**
 * Credit Transaction with relations
 */
export interface CreditTransactionWithRelations extends CreditTransaction {
  customer?: {
    id: number
    customer_code: string | null
    first_name: string
    last_name: string
    phone: string | null
    email: string | null
    credit_limit: number | null
    current_credit_balance: number | null
    available_credit: number | null
    credit_status: string | null
  }
  supplier?: {
    id: number
    supplier_code: string
    supplier_name: string
    phone: string
    email: string | null
    credit_limit: number | null
    current_balance: number | null
    available_credit: number | null
    credit_status: string | null
  }
  created_by_profile?: {
    id: number
    first_name: string
    last_name: string
  }
  credit_payments?: CreditPayment[]
  payment_schedules?: PaymentSchedule[]
}

/**
 * Credit Payment type definition
 */
export interface CreditPayment {
  id: number
  company_id: number
  credit_transaction_id: number | null
  payment_number: string
  payment_date: string
  payment_amount: number
  payment_method: PaymentMethod
  payment_reference: string | null
  allocated_amount: number | null
  status: string | null
  bank_name: string | null
  account_number: string | null
  notes: string | null
  receipt_url: string | null
  received_by: number | null
  created_at: string
  updated_at: string
}

/**
 * Payment Schedule type definition
 */
export interface PaymentSchedule {
  id: number
  company_id: number
  credit_transaction_id: number
  installment_number: number
  total_installments: number
  installment_amount: number
  amount_paid: number | null
  amount_remaining: number | null
  due_date: string
  paid_date: string | null
  status: string | null
  created_at: string
  updated_at: string
}

/**
 * Credit Adjustment type definition
 */
export interface CreditAdjustment {
  id: number
  company_id: number
  entity_type: EntityType
  entity_id: number
  adjustment_type: string
  adjustment_amount: number
  reason: string
  notes: string | null
  requires_approval: boolean | null
  approved_by: number | null
  approved_at: string | null
  approval_status: string | null
  created_by: number | null
  created_at: string
  updated_at: string
}

/**
 * Credit History type definition
 */
export interface CreditHistory {
  id: number
  company_id: number
  entity_type: EntityType
  entity_id: number
  field_name: string
  old_value: string | null
  new_value: string | null
  change_reason: string | null
  changed_by: number | null
  changed_at: string
}

/**
 * Credit History with relations
 */
export interface CreditHistoryWithRelations extends CreditHistory {
  changed_by_profile?: {
    first_name: string
    last_name: string
  }
}

/**
 * Credit Summary for customer/supplier
 */
export interface CreditSummary {
  entity_id: number
  entity_type: EntityType
  entity_name: string
  credit_limit: number
  current_balance: number
  available_credit: number
  credit_status: string
  total_transactions: number
  pending_transactions: number
  overdue_transactions: number
  total_outstanding: number
  on_time_payments: number
  late_payments: number
  payment_score: number | null
}

/**
 * Payment form data
 */
export interface PaymentFormData {
  credit_transaction_id: number
  payment_date: string
  payment_amount: number
  payment_method: PaymentMethod
  payment_reference?: string
  bank_name?: string
  account_number?: string
  notes?: string
}

/**
 * Transaction form data
 */
export interface TransactionFormData {
  entity_type: EntityType
  entity_id: number
  transaction_type: CreditTransactionType
  transaction_amount: number
  due_date?: string
  payment_method?: string
  description?: string
  notes?: string
  reference_type?: string
  reference_number?: string
}

/**
 * Adjustment form data
 */
export interface AdjustmentFormData {
  entity_type: EntityType
  entity_id: number
  adjustment_type: AdjustmentType
  adjustment_amount: number
  reason: string
  notes?: string
  requires_approval?: boolean
}

/**
 * Credit tier update form data
 */
export interface CreditTierUpdateFormData {
  customer_id: number
  reason: string
}

/**
 * Installment schedule data
 */
export interface InstallmentScheduleData {
  credit_transaction_id: number
  total_installments: number
  installment_amount: number
  start_date: string
  frequency: InstallmentFrequency
}

/**
 * Outstanding balance details
 */
export interface OutstandingBalanceDetails {
  transactions: CreditTransaction[]
  totalOutstanding: number
}

/**
 * Credit statistics
 */
export interface CreditStats {
  total: number
  pending: number
  overdue: number
  totalOutstanding: number
}

/**
 * Filter options for credit transactions
 */
export interface CreditTransactionFilters {
  page?: number
  pageSize?: number
  searchQuery?: string
  status?: 'all' | CreditTransactionStatus
  entityType?: EntityType
  companyId: number
  startDate?: string
  endDate?: string
}

