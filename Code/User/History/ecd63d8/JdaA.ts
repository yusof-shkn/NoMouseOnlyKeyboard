// src/features/main/CustomersManagement/data/customers.queries.ts

import { supabase } from '@app/core/supabase/Supabase.utils'
import { Customer, CustomerWithRelations } from '@shared/types/customer'

export const getCustomers = async ({
  page = 1,
  pageSize = 10,
  searchQuery = '',
  status = 'all',
  creditStatus = 'all',
  companyId,
}: {
  page?: number
  pageSize?: number
  searchQuery?: string
  status?: 'all' | 'active' | 'inactive'
  creditStatus?: 'all' | 'with_credit' | 'no_credit' | 'has_balance'
  companyId: number
}) => {
  try {
    let query = supabase
      .from('customers')
      .select('*', { count: 'exact' })
      .eq('company_id', companyId)
      .is('deleted_at', null)

    if (status === 'active') query = query.eq('is_active', true)
    else if (status === 'inactive') query = query.eq('is_active', false)

    if (creditStatus === 'with_credit') query = query.gt('credit_limit', 0)
    else if (creditStatus === 'no_credit')
      query = query.or('credit_limit.is.null,credit_limit.eq.0')
    else if (creditStatus === 'has_balance')
      query = query.gt('current_credit_balance', 0)

    if (searchQuery) {
      query = query.or(
        `first_name.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%,address.ilike.%${searchQuery}%`,
      )
    }

    const from = (page - 1) * pageSize
    const to = from + pageSize - 1
    query = query.range(from, to).order('created_at', { ascending: false })

    const { data, error, count } = await query
    if (error) throw error

    return {
      data: data as CustomerWithRelations[],
      count: count || 0,
      error: null,
    }
  } catch (error: any) {
    console.error('Error fetching customers:', error)
    return {
      data: null,
      count: 0,
      error: error.message || 'Failed to fetch customers',
    }
  }
}

export const getCustomerStats = async (companyId: number) => {
  try {
    const { data, error } = await supabase.rpc('get_customer_stats', {
      p_company_id: companyId,
    })
    if (error) throw error
    return { data, error: null }
  } catch (error: any) {
    try {
      const { data: customers, error: fetchError } = await supabase
        .from('customers')
        .select('id, is_active, credit_limit, current_credit_balance')
        .eq('company_id', companyId)
        .is('deleted_at', null)

      if (fetchError) throw fetchError

      const stats = {
        total: customers?.length || 0,
        active: customers?.filter((c) => c.is_active).length || 0,
        withCredit:
          customers?.filter((c) => c.credit_limit && c.credit_limit > 0)
            .length || 0,
        totalCreditLimit: customers?.reduce(
          (sum, c) => sum + (c.credit_limit || 0),
          0,
        ),
        outstandingCredit: customers?.reduce(
          (sum, c) => sum + (c.current_credit_balance || 0),
          0,
        ),
      }
      return { data: stats, error: null }
    } catch (fallbackError: any) {
      return {
        data: {
          total: 0,
          active: 0,
          withCredit: 0,
          totalCreditLimit: 0,
          outstandingCredit: 0,
        },
        error: fallbackError.message,
      }
    }
  }
}

export const getCustomerById = async (id: number) => {
  try {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('id', id)
      .single()
    if (error) throw error
    return { data: data as CustomerWithRelations, error: null }
  } catch (error: any) {
    return { data: null, error: error.message || 'Failed to fetch customer' }
  }
}

export const createCustomer = async (customerData: Partial<Customer>) => {
  try {
    const {
      insurance_provider,
      insurance_number,
      insurance_expiry_date,
      insurance_policy_type,
      insurance_coverage_limit,
      ...cleanedData
    } = customerData as any

    const { data, error } = await supabase
      .from('customers')
      .insert([cleanedData])
      .select()
      .single()

    if (error) throw error

    if (insurance_provider && insurance_number && data) {
      const { data: insuranceData, error: insuranceError } = await supabase
        .from('customer_insurance')
        .insert([
          {
            customer_id: data.id,
            insurance_provider,
            insurance_number,
            insurance_expiry_date: insurance_expiry_date || null,
            policy_type: insurance_policy_type || null,
            coverage_limit: insurance_coverage_limit || null,
            is_active: true,
          },
        ])
        .select()
        .single()

      if (!insuranceError && insuranceData) {
        await supabase
          .from('customers')
          .update({ customer_insurance_id: insuranceData.id })
          .eq('id', data.id)
      }
    }

    return { data, error: null }
  } catch (error: any) {
    console.error('Error creating customer:', error)
    return { data: null, error: error.message || 'Failed to create customer' }
  }
}

export const updateCustomer = async (
  id: number,
  customerData: Partial<Customer>,
) => {
  try {
    const {
      insurance_provider,
      insurance_number,
      insurance_expiry_date,
      insurance_policy_type,
      insurance_coverage_limit,
      ...cleanedData
    } = customerData as any

    const { data, error } = await supabase
      .from('customers')
      .update(cleanedData)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    if (insurance_provider || insurance_number) {
      const { data: existingInsurance } = await supabase
        .from('customer_insurance')
        .select('id, insurance_provider, insurance_number')
        .eq('customer_id', id)
        .eq('is_active', true)
        .maybeSingle()

      if (existingInsurance) {
        await supabase
          .from('customer_insurance')
          .update({
            insurance_provider:
              insurance_provider || existingInsurance.insurance_provider,
            insurance_number:
              insurance_number || existingInsurance.insurance_number,
            insurance_expiry_date: insurance_expiry_date || null,
            policy_type: insurance_policy_type || null,
            coverage_limit: insurance_coverage_limit || null,
          })
          .eq('id', existingInsurance.id)
      } else if (insurance_provider && insurance_number) {
        const { data: newInsurance } = await supabase
          .from('customer_insurance')
          .insert([
            {
              customer_id: id,
              insurance_provider,
              insurance_number,
              insurance_expiry_date: insurance_expiry_date || null,
              policy_type: insurance_policy_type || null,
              coverage_limit: insurance_coverage_limit || null,
              is_active: true,
            },
          ])
          .select()
          .single()

        if (newInsurance) {
          await supabase
            .from('customers')
            .update({ customer_insurance_id: newInsurance.id })
            .eq('id', id)
        }
      }
    }

    return { data, error: null }
  } catch (error: any) {
    console.error('Error updating customer:', error)
    return { data: null, error: error.message || 'Failed to update customer' }
  }
}

export const deleteCustomer = async (id: number) => {
  try {
    const { data, error } = await supabase
      .from('customers')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return { data, error: null }
  } catch (error: any) {
    return { data: null, error: error.message || 'Failed to delete customer' }
  }
}

export const checkCustomerUsage = async (customerId: number) => {
  try {
    const { data, error } = await supabase.rpc('check_customer_usage', {
      p_customer_id: customerId,
    })
    if (error) throw error
    return { data, error: null }
  } catch (error: any) {
    try {
      const [salesResult, creditResult] = await Promise.all([
        supabase
          .from('sales')
          .select('id', { count: 'exact', head: true })
          .eq('customer_id', customerId),
        supabase
          .from('credit_transactions')
          .select('id', { count: 'exact', head: true })
          .eq('entity_id', customerId)
          .eq('entity_type', 'customer'),
      ])
      return {
        data: {
          salesCount: salesResult.count || 0,
          creditTransactionCount: creditResult.count || 0,
        },
        error: null,
      }
    } catch (fallbackError: any) {
      return {
        data: { salesCount: 0, creditTransactionCount: 0 },
        error: fallbackError.message,
      }
    }
  }
}

export const getCompanySettings = async (companyId: number) => {
  try {
    const { data, error } = await supabase
      .from('company_settings')
      .select('*')
      .eq('company_id', companyId)
      .single()
    if (error) throw error
    return { data, error: null }
  } catch (error: any) {
    return {
      data: null,
      error: error.message || 'Failed to fetch company settings',
    }
  }
}

export const getCustomerCreditSummary = async (customerId: number) => {
  try {
    const { data, error } = await supabase
      .from('customers')
      .select(
        'id, first_name, last_name, credit_limit, current_credit_balance, available_credit, credit_days',
      )
      .eq('id', customerId)
      .single()
    if (error) throw error
    return { data, error: null }
  } catch (error: any) {
    return {
      data: null,
      error: error.message || 'Failed to fetch credit summary',
    }
  }
}

export const updateCustomerCreditLimit = async (
  customerId: number,
  creditLimit: number,
  reason: string,
  approvedBy: number,
) => {
  try {
    const { data: customer, error: fetchError } = await supabase
      .from('customers')
      .select('company_id, current_credit_balance, credit_limit')
      .eq('id', customerId)
      .single()

    if (fetchError) throw fetchError

    const currentBalance = customer.current_credit_balance || 0
    const newAvailableCredit = creditLimit - currentBalance

    const { data: customerData, error: customerError } = await supabase
      .from('customers')
      .update({
        credit_limit: creditLimit,
        available_credit: newAvailableCredit,
      })
      .eq('id', customerId)
      .select()
      .single()

    if (customerError) throw customerError

    await supabase.from('credit_transactions').insert({
      company_id: customer.company_id,
      entity_type: 'customer',
      entity_id: customerId,
      transaction_type: 'adjustment',
      transaction_amount: 0,
      balance_before: currentBalance,
      balance_after: currentBalance,
      reference_type: 'manual',
      status: 'completed',
      description: `Credit limit changed from ${customer.credit_limit} to ${creditLimit}: ${reason}`,
      created_by: approvedBy,
    })

    return { data: customerData, error: null }
  } catch (error: any) {
    return {
      data: null,
      error: error.message || 'Failed to update credit limit',
    }
  }
}

