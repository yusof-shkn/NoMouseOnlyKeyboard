// src/shared/types/customer.ts
// ✅ COMPLETELY UPDATED: Aligned with Sales Module schema

/**
 * Customer Insurance interface
 * Separate table for customer insurance information
 */
export interface CustomerInsurance {
  id: number
  customer_id: number
  insurance_provider: string
  insurance_number: string
  insurance_expiry_date: string | null
  policy_type: string | null
  coverage_limit: number | null
  is_active: boolean
  notes: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

/**
 * Credit Tier interface
 */
export interface CreditTier {
  id: number
  company_id: number
  tier_name: string
  tier_code: string
  tier_level: number
  tier_color: string | null
  max_credit_limit: number
  min_credit_limit: number
  max_credit_days: number // ✅ From migration
  requires_approval: boolean
  is_active: boolean
  created_at: string
  updated_at: string
  deleted_at: string | null
}

/**
 * Customer base interface
 * ✅ COMPLETELY UPDATED: Only fields from customers table
 */
export interface Customer {
  id: number
  company_id: number

  // Basic Information
  first_name: string
  last_name: string
  phone: string
  email: string | null
  address: string | null // ✅ Single address field

  // Credit Management
  credit_limit: number
  current_credit_balance: number
  available_credit: number
  credit_days: number
  total_credit_used: number

  // Purchase History
  last_purchase_date: string | null
  total_purchases: number

  // Insurance Link
  customer_insurance_id: number | null

  // Status
  is_active: boolean
  notes: string | null

  // Audit
  created_at: string
  updated_at: string
  deleted_at: string | null

  // ✅ REMOVED FIELDS (no longer in schema):
  // - customer_code (if auto-generated, handle separately)
  // - date_of_birth
  // - gender
  // - city (merged into address)
  // - district (merged into address)
  // - blood_group
  // - allergies
  // - medical_conditions
  // - emergency_contact_name
  // - emergency_contact_phone
  // - insurance_provider (moved to customer_insurance)
  // - insurance_number (moved to customer_insurance)
  // - insurance_expiry_date (moved to customer_insurance)
  // - on_time_payments (calculate from credit_payments)
  // - late_payments (calculate from credit_payments)
  // - payment_score (calculate from payments)
  // - credit_status (calculate from balance)
  // - last_credit_review_date
  // - next_credit_review_date
  // - loyalty_points (if not using)
}

/**
 * Customer with relations interface
 * Includes related data from joins
 */
export interface CustomerWithRelations extends Customer {
  // Customer Insurance relation
  customer_insurance?: CustomerInsurance | null

  // Credit Tier relation
}

/**
 * Customer create/update payload
 * ✅ UPDATED: Only editable fields
 */
export interface CustomerPayload {
  company_id: number
  first_name: string
  last_name: string
  phone: string
  email?: string | null
  address?: string | null

  // Credit fields
  credit_limit?: number
  credit_days?: number

  // Insurance fields (handled separately)
  insurance_provider?: string | null
  insurance_number?: string | null
  insurance_expiry_date?: string | null
  insurance_policy_type?: string | null
  insurance_coverage_limit?: number | null

  // Additional
  notes?: string | null
  is_active?: boolean
}

/**
 * Customer filter options
 */
export interface CustomerFilters {
  status: 'all' | 'active' | 'inactive'
  creditStatus: 'all' | 'with_credit' | 'no_credit' | 'has_balance'
  searchQuery: string
}

/**
 * Customer statistics
 */
export interface CustomerStats {
  total: number
  active: number
  withCredit: number
  totalCreditLimit: number
  outstandingCredit: number
}

/**
 * Customer credit summary
 */
export interface CustomerCreditSummary {
  id: number
  first_name: string
  last_name: string
  credit_limit: number
  current_credit_balance: number
  available_credit: number
  credit_days: number
}

