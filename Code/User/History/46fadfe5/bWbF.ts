// src/features/sales/utils/Credit.utils.ts

import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  CustomerCreditSummary,
  CreditValidationResult,
} from '../types/Credit.types'

/**
 * Get customer credit summary directly from customers table
 */
export async function getCustomerCreditSummary(
  supabaseClient: SupabaseClient,
  customerId: number,
  companyId: number,
): Promise<CustomerCreditSummary | null> {
  try {
    const { data, error } = await supabaseClient
      .from('customers')
      .select(
        `
        id,
        company_id,
        first_name,
        last_name,
        credit_limit,
        current_credit_balance,
        available_credit,
        credit_days,
        credit_status
      `,
      )
      .eq('id', customerId)
      .eq('company_id', companyId)
      .eq('is_active', true)
      .is('deleted_at', null)
      .single()

    if (error || !data) {
      console.error('Error fetching customer credit summary:', error)
      return null
    }

    return {
      customer_id: data.id,
      company_id: data.company_id,
      first_name: data.first_name,
      last_name: data.last_name,
      credit_limit: parseFloat(String(data.credit_limit || 0)),
      current_credit_balance: parseFloat(
        String(data.current_credit_balance || 0),
      ),
      available_credit: parseFloat(String(data.available_credit || 0)),
      credit_days: data.credit_days || 30,
      credit_status: data.credit_status || 'good',
    }
  } catch (error) {
    console.error('Error in getCustomerCreditSummary:', error)
    return null
  }
}

/**
 * Validate if customer can make a credit purchase
 */
export async function validateCustomerCredit(
  supabaseClient: SupabaseClient,
  request: {
    customer_id: number
    company_id: number
    purchase_amount: number
  },
): Promise<CreditValidationResult> {
  const errors: string[] = []
  const warnings: string[] = []

  try {
    const summary = await getCustomerCreditSummary(
      supabaseClient,
      request.customer_id,
      request.company_id,
    )

    if (!summary) {
      return {
        isValid: false,
        canPurchaseOnCredit: false,
        availableCredit: 0,
        creditLimit: 0,
        currentBalance: 0,
        creditStatus: 'unknown',
        requiresApproval: false,
        errors: ['Customer not found or inactive'],
        warnings: [],
      }
    }

    const {
      credit_limit,
      current_credit_balance,
      available_credit,
      credit_days,
    } = summary

    // No credit limit set
    if (!credit_limit || credit_limit <= 0) {
      errors.push('This customer has no credit limit assigned')
      return {
        isValid: false,
        canPurchaseOnCredit: false,
        availableCredit: 0,
        creditLimit: 0,
        currentBalance: current_credit_balance,
        creditStatus: summary.credit_status || 'none',
        requiresApproval: false,
        errors,
        warnings,
      }
    }

    // Check if purchase exceeds available credit
    if (request.purchase_amount > available_credit) {
      errors.push(
        `Purchase amount (${request.purchase_amount.toLocaleString()}) exceeds available credit (${available_credit.toLocaleString()})`,
      )
    }

    // Warn if utilization will be high after purchase
    const newBalance = current_credit_balance + request.purchase_amount
    const newUtilization =
      credit_limit > 0 ? (newBalance / credit_limit) * 100 : 0

    if (newUtilization >= 90 && errors.length === 0) {
      warnings.push(
        `Credit utilization will reach ${newUtilization.toFixed(0)}% after this purchase`,
      )
    }

    if (credit_days && credit_days > 0) {
      warnings.push(`Payment due within ${credit_days} days`)
    }

    const isValid = errors.length === 0

    return {
      isValid,
      canPurchaseOnCredit: isValid,
      availableCredit: available_credit,
      creditLimit: credit_limit,
      currentBalance: current_credit_balance,
      creditStatus: summary.credit_status || 'good',
      requiresApproval: false,
      errors,
      warnings,
    }
  } catch (error: any) {
    console.error('Error in validateCustomerCredit:', error)
    return {
      isValid: false,
      canPurchaseOnCredit: false,
      availableCredit: 0,
      creditLimit: 0,
      currentBalance: 0,
      creditStatus: 'unknown',
      requiresApproval: false,
      errors: [error.message || 'Failed to validate credit'],
      warnings: [],
    }
  }
}

/**
 * Reverse a credit transaction when a sale is edited/cancelled
 */
export async function reverseCreditTransaction(
  supabaseClient: SupabaseClient,
  saleId: number,
  customerId: number,
  companyId: number,
  amount: number,
  reason: string,
): Promise<{ success: boolean; errors?: string[] }> {
  try {
    // Get current customer balances
    const { data: customer, error: fetchError } = await supabaseClient
      .from('customers')
      .select('current_credit_balance, available_credit, credit_limit')
      .eq('id', customerId)
      .single()

    if (fetchError || !customer) {
      return { success: false, errors: ['Customer not found'] }
    }

    const currentBalance = parseFloat(
      String(customer.current_credit_balance || 0),
    )
    const creditLimit = parseFloat(String(customer.credit_limit || 0))
    const newBalance = Math.max(0, currentBalance - amount)
    const newAvailable = creditLimit - newBalance

    // Update customer balances
    const { error: updateError } = await supabaseClient
      .from('customers')
      .update({
        current_credit_balance: newBalance,
        available_credit: newAvailable,
        credit_status:
          newBalance <= 0
            ? 'good'
            : newBalance >= creditLimit * 0.9
              ? 'overlimit'
              : 'good',
        updated_at: new Date().toISOString(),
      })
      .eq('id', customerId)

    if (updateError) {
      return { success: false, errors: [updateError.message] }
    }

    // Log reversal in credit_transactions
    await supabaseClient.from('credit_transactions').insert({
      company_id: companyId,
      entity_type: 'customer',
      entity_id: customerId,
      transaction_type: 'reversal',
      reference_type: 'sale',
      reference_id: saleId,
      transaction_amount: amount,
      balance_before: currentBalance,
      balance_after: newBalance,
      status: 'completed',
      description: reason,
      created_at: new Date().toISOString(),
    })

    return { success: true }
  } catch (error: any) {
    console.error('Error reversing credit transaction:', error)
    return {
      success: false,
      errors: [error.message || 'Failed to reverse credit'],
    }
  }
}

