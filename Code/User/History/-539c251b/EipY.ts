// src/features/sales/types/Credit.types.ts

export interface CustomerCreditSummary {
  customer_id: number
  company_id: number
  first_name: string
  last_name: string
  credit_limit: number
  current_credit_balance: number
  available_credit: number
  credit_days: number
  credit_status: string | null
}

export interface CreditValidationResult {
  isValid: boolean
  canPurchaseOnCredit: boolean
  availableCredit: number
  creditLimit: number
  currentBalance: number
  creditStatus: string
  requiresApproval: boolean
  errors: string[]
  warnings: string[]
}

export interface CreateCreditTransactionRequest {
  sale_id: bigint
  customer_id: bigint
  company_id: bigint
  store_id: bigint
  total_amount: number
  notes?: string
  processed_by?: number
}

export interface CreditTransactionResult {
  success: boolean
  transaction_id?: number
  due_date?: Date
  new_balance?: number
  available_credit?: number
  errors?: string[]
}

export interface ReverseCreditResult {
  success: boolean
  errors?: string[]
}

