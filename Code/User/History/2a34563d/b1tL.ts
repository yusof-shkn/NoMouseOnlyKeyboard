// src/features/main/CustomerForm/types/customerForm.types.ts

import { Customer } from '@shared/types/customer'

export interface CustomerFormValues {
  company_id: string
  first_name: string
  last_name: string
  phone: string
  email: string
  address: string
  insurance_provider: string
  insurance_number: string
  insurance_expiry_date: string
  insurance_policy_type: string
  insurance_coverage_limit: number
  credit_limit: number
  credit_days: number
  notes: string
  is_active: boolean
}

export interface CustomerFormProps {
  customer?: Customer
  mode: 'create' | 'edit'
}

export interface CustomerValidationResult {
  valid: boolean
  errors: string[]
}

export interface CreditValidationResult {
  valid: boolean
  warning?: string
}

export interface InsuranceExpiryCheck {
  expired: boolean
  expiresInDays: number | null
  warning: string | null
}

