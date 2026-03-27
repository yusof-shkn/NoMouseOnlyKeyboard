// src/features/main/CustomerForm/types/customerForm.types.ts
// ✅ COMPLETELY UPDATED: Aligned with new customers table schema

import { Customer } from '@shared/types/customer'

/**
 * Credit Tier interface
 * ✅ UPDATED: Uses max_credit_days
 */

/**
 * Customer form values interface
 * ✅ COMPLETELY UPDATED: Only fields that exist in customers table + insurance fields
 */
export interface CustomerFormValues {
  // Required fields
  company_id: string
  first_name: string
  last_name: string
  phone: string

  // Optional basic fields
  email: string
  address: string // ✅ Single address field (replaces city + district)

  // Insurance fields (saved to customer_insurance table)
  insurance_provider: string
  insurance_number: string
  insurance_expiry_date: string
  insurance_policy_type: string
  insurance_coverage_limit: number

  // Credit fields
  credit_limit: number
  credit_days: number

  // Additional fields
  notes: string
  is_active: boolean

  // ✅ REMOVED FIELDS (no longer in schema):
  // - date_of_birth
  // - gender
  // - city (use address instead)
  // - district (use address instead)
  // - blood_group
  // - allergies
  // - medical_conditions
  // - emergency_contact_name
  // - emergency_contact_phone
  // - customer_code (auto-generated)
  // - loyalty_points
  // - payment_score
  // - on_time_payments
  // - late_payments
  // - credit_status (calculated from balance)
  // - last_credit_review_date
  // - next_credit_review_date
}

/**
 * Customer form props interface
 */
export interface CustomerFormProps {
  customer?: Customer
  mode: 'create' | 'edit'
}

/**
 * Customer validation result interface
 */
export interface CustomerValidationResult {
  valid: boolean
  errors: string[]
}

/**
 * Credit eligibility check result
 */
export interface CreditEligibilityResult {
  eligible: boolean
  reason?: string
}

/**
 * Credit validation result
 */
export interface CreditValidationResult {
  valid: boolean
  warning?: string
  requiresApproval?: boolean
}

/**
 * Insurance expiry check result
 */
export interface InsuranceExpiryCheck {
  expired: boolean
  expiresInDays: number | null
  warning: string | null
}

