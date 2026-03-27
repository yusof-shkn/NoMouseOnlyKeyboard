// src/features/sales/handlers/Credit.handlers.ts

import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  CreateCreditTransactionRequest,
  CreditTransactionResult,
} from '../types/Credit.types'

/**
 * Create a credit transaction when a sale is made on credit
 */
export async function createCreditSaleTransaction(
  supabaseClient: SupabaseClient,
  request: CreateCreditTransactionRequest,
): Promise<CreditTransactionResult> {
  try {
    const customerId = Number(request.customer_id)
    const companyId = Number(request.company_id)
    const saleId = Number(request.sale_id)
    const amount = request.total_amount

    // Get current customer balances
    const { data: customer, error: fetchError } = await supabaseClient
      .from('customers')
      .select(
        'current_credit_balance, available_credit, credit_limit, credit_days',
      )
      .eq('id', customerId)
      .single()

    if (fetchError || !customer) {
      return {
        success: false,
        errors: ['Customer not found'],
      }
    }

    const currentBalance = parseFloat(
      String(customer.current_credit_balance || 0),
    )
    const creditLimit = parseFloat(String(customer.credit_limit || 0))
    const creditDays = customer.credit_days || 30
    const newBalance = currentBalance + amount
    const newAvailable = Math.max(0, creditLimit - newBalance)

    // Calculate due date
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + creditDays)

    // Determine new credit status
    const utilization = creditLimit > 0 ? (newBalance / creditLimit) * 100 : 0
    const newCreditStatus =
      utilization >= 100 ? 'overlimit' : utilization >= 90 ? 'warning' : 'good'

    // Insert credit transaction record
    const { data: transaction, error: txError } = await supabaseClient
      .from('credit_transactions')
      .insert({
        company_id: companyId,
        entity_type: 'customer',
        entity_id: customerId,
        transaction_type: 'sale',
        reference_type: 'sale',
        reference_id: saleId,
        transaction_amount: amount,
        balance_before: currentBalance,
        balance_after: newBalance,
        due_date: dueDate.toISOString().split('T')[0],
        status: 'pending',
        description: `Credit sale - Sale ID: ${saleId}`,
        notes: request.notes || null,
        created_by: request.processed_by || null,
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (txError) {
      console.error('Error creating credit transaction:', txError)
      return { success: false, errors: [txError.message] }
    }

    // Update customer balances
    const { error: updateError } = await supabaseClient
      .from('customers')
      .update({
        current_credit_balance: newBalance,
        available_credit: newAvailable,
        credit_status: newCreditStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', customerId)

    if (updateError) {
      console.error('Error updating customer credit balance:', updateError)
      // Don't fail — transaction was recorded, just log the issue
    }

    return {
      success: true,
      transaction_id: transaction?.id,
      due_date: dueDate,
      new_balance: newBalance,
      available_credit: newAvailable,
    }
  } catch (error: any) {
    console.error('Error in createCreditSaleTransaction:', error)
    return {
      success: false,
      errors: [error.message || 'Failed to create credit transaction'],
    }
  }
}
