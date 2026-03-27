// src/features/main/SuppliersManagement/data/suppliers.queries.ts
// ✅ NOTE: Supplier data doesn't have direct store_id relationship
// Suppliers are company-level entities, not store-specific
// Area/store filtering would only apply to purchase orders related to suppliers

import { supabase } from '@app/core/supabase/Supabase.utils'
import { PostgrestError } from '@supabase/supabase-js'
import { Supplier, SupplierWithRelations } from '@shared/types/suppliers'

/**
 * Fetch paginated and filtered suppliers
 * ✅ NOTE: Suppliers don't have store_id, they are company-level entities
 */
export interface GetSuppliersProps {
  page?: number
  pageSize?: number
  searchQuery?: string
  status?: 'all' | 'active' | 'inactive'
  balanceFilter?: 'all' | 'with_balance' | 'no_balance'
  companyId?: number
}

export interface GetSuppliersResponse {
  data: SupplierWithRelations[] | null
  error: PostgrestError | null
  count: number | null
}

export const getSuppliers = async ({
  page = 1,
  pageSize = 10,
  searchQuery = '',
  status = 'all',
  companyId,
}: GetSuppliersProps = {}): Promise<GetSuppliersResponse> => {
  let query = supabase.from('suppliers').select('*', { count: 'exact' })

  // Company filter (critical for multi-tenancy)
  if (companyId) {
    query = query.eq('company_id', companyId)
  }

  // Soft delete filter
  query = query.is('deleted_at', null)

  // Search across multiple fields
  if (searchQuery.trim()) {
    query = query.or(
      `supplier_name.ilike.%${searchQuery}%,supplier_code.ilike.%${searchQuery}%,contact_person.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`,
    )
  }

  // Active status filter
  if (status === 'active') {
    query = query.eq('is_active', true)
  } else if (status === 'inactive') {
    query = query.eq('is_active', false)
  }

  // Order and paginate
  query = query
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1)

  const result = await query

  return {
    data: result.data,
    error: result.error,
    count: result.count,
  }
}

/**
 * Get comprehensive supplier statistics
 */
export const getSupplierStats = async (
  companyId?: number,
): Promise<{
  data: {
    total: number
    active: number
    withBalance: number
  } | null
  error: any
}> => {
  try {
    let baseQuery = supabase
      .from('suppliers')
      .select('id', { count: 'exact', head: true })

    if (companyId) {
      baseQuery = baseQuery.eq('company_id', companyId)
    }

    baseQuery = baseQuery.is('deleted_at', null)

    const [totalResult, activeResult, balanceResult] = await Promise.all([
      baseQuery,
      supabase
        .from('suppliers')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('is_active', true)
        .is('deleted_at', null),
      supabase
        .from('suppliers')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .gt('current_balance', 0)
        .is('deleted_at', null),
    ])

    return {
      data: {
        total: totalResult.count || 0,
        active: activeResult.count || 0,
        withBalance: balanceResult.count || 0,
      },
      error: null,
    }
  } catch (error) {
    console.error('Error fetching supplier stats:', error)
    return { data: null, error }
  }
}

/**
 * Create a new supplier with validation
 */
export const createSupplier = async (
  supplierData: Partial<Supplier>,
): Promise<{ data: Supplier | null; error: PostgrestError | null }> => {
  // Validate required fields
  if (!supplierData.supplier_name?.trim()) {
    return {
      data: null,
      error: {
        message: 'Supplier name is required',
        details: '',
        hint: '',
        code: 'VALIDATION_ERROR',
      } as PostgrestError,
    }
  }

  if (!supplierData.phone?.trim()) {
    return {
      data: null,
      error: {
        message: 'Phone number is required',
        details: '',
        hint: '',
        code: 'VALIDATION_ERROR',
      } as PostgrestError,
    }
  }

  return await supabase
    .from('suppliers')
    .insert([supplierData])
    .select('*')
    .single()
}

/**
 * Update a supplier
 */
export const updateSupplier = async (
  id: number,
  updates: Partial<Supplier>,
): Promise<{ error: PostgrestError | null }> => {
  return await supabase
    .from('suppliers')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
}

/**
 * Soft delete a supplier
 */
export const deleteSupplier = async (
  id: number,
): Promise<{ error: PostgrestError | null }> => {
  return await supabase
    .from('suppliers')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
}

/**
 * Check supplier usage across purchase orders and invoices
 */
export const checkSupplierUsage = async (
  supplierId: number,
): Promise<{
  data: { purchaseOrderCount: number; invoiceCount: number } | null
  error: any
}> => {
  try {
    const [poResult, invoiceResult] = await Promise.all([
      supabase
        .from('purchase_orders')
        .select('id', { count: 'exact', head: true })
        .eq('supplier_id', supplierId)
        .is('deleted_at', null),
      supabase
        .from('purchase_invoices')
        .select('id', { count: 'exact', head: true })
        .eq('supplier_id', supplierId)
        .is('deleted_at', null),
    ])

    return {
      data: {
        purchaseOrderCount: poResult.count || 0,
        invoiceCount: invoiceResult.count || 0,
      },
      error: null,
    }
  } catch (error) {
    return { data: null, error }
  }
}

/**
 * Get supplier with purchase history
 */
export const getSupplierWithHistory = async (
  supplierId: number,
): Promise<{
  data: SupplierWithRelations | null
  error: PostgrestError | null
}> => {
  const { data, error } = await supabase
    .from('suppliers')
    .select(
      `
      *,
      purchase_orders:purchase_orders(
        id,
        po_number,
        po_date,
        total_amount,
        status
      )
    `,
    )
    .eq('id', supplierId)
    .single()

  return { data, error }
}

/**
 * Get active suppliers for dropdown
 */
export const getActiveSuppliersForDropdown = async (
  companyId: number,
): Promise<{
  data: Pick<Supplier, 'id' | 'supplier_name' | 'supplier_code'>[] | null
  error: PostgrestError | null
}> => {
  return await supabase
    .from('suppliers')
    .select('id, supplier_name, supplier_code')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('supplier_name', { ascending: true })
}

/**
 * Update supplier balance
 */
export const updateSupplierBalance = async (
  supplierId: number,
  amount: number,
  operation: 'add' | 'subtract',
): Promise<{ error: PostgrestError | null }> => {
  const { data: supplier, error: fetchError } = await supabase
    .from('suppliers')
    .select('current_balance')
    .eq('id', supplierId)
    .single()

  if (fetchError) return { error: fetchError }

  const currentBalance = supplier.current_balance || 0
  const newBalance =
    operation === 'add' ? currentBalance + amount : currentBalance - amount

  return await supabase
    .from('suppliers')
    .update({
      current_balance: Math.max(0, newBalance),
      updated_at: new Date().toISOString(),
    })
    .eq('id', supplierId)
}

/**
 * Get supplier payment history
 */
export const getSupplierPaymentHistory = async (
  supplierId: number,
  limit: number = 10,
): Promise<{
  data: any[] | null
  error: PostgrestError | null
}> => {
  return await supabase
    .from('payment_transactions')
    .select(
      `
      *,
      store:stores(store_name)
    `,
    )
    .eq('reference_type', 'purchase_order')
    .eq('transaction_type', 'purchase')
    .is('deleted_at', null)
    .order('transaction_date', { ascending: false })
    .limit(limit)
}

/**
 * Get suppliers with calculated balances from view
 */
export const getSuppliersWithBalances = async ({
  page = 1,
  pageSize = 10,
  searchQuery = '',
  status = 'all',
  balanceFilter = 'all',
  companyId,
}: GetSuppliersProps = {}): Promise<GetSuppliersResponse> => {
  // Use the view that calculates balances correctly
  let query = supabase
    .from('vw_supplier_balances')
    .select('*', { count: 'exact' })

  if (companyId) {
    query = query.eq('company_id', companyId)
  }

  if (searchQuery.trim()) {
    query = query.or(
      `supplier_name.ilike.%${searchQuery}%,supplier_code.ilike.%${searchQuery}%,contact_person.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`,
    )
  }

  if (status === 'active') {
    query = query.eq('is_active', true)
  } else if (status === 'inactive') {
    query = query.eq('is_active', false)
  }

  if (balanceFilter === 'with_balance') {
    query = query.gt('amount_owed_to_supplier', 0)
  } else if (balanceFilter === 'no_balance') {
    query = query.or(
      'amount_owed_to_supplier.is.null,amount_owed_to_supplier.lte.0',
    )
  }

  query = query
    .order('supplier_name', { ascending: true })
    .range((page - 1) * pageSize, page * pageSize - 1)

  const result = await query

  if (result.error) {
    return {
      data: null,
      error: result.error,
      count: result.count,
    }
  }

  // ✅ FIXED: Map ALL columns from view to expected format
  const suppliersWithBalances = result.data?.map((row: any) => ({
    // Basic supplier info
    id: row.id,
    company_id: row.company_id,
    supplier_name: row.supplier_name,
    supplier_code: row.supplier_code,

    // ✅ Contact information (NOW IN VIEW)
    contact_person: row.contact_person || null,
    phone: row.phone || null,
    email: row.email || null,

    // ✅ Location information (NOW IN VIEW)
    address: row.address || null,
    city: row.city || null,
    country: row.country || null,

    // Credit & financial info
    credit_limit: row.credit_limit,
    current_balance: row.calculated_balance, // From view calculation
    available_credit: row.available_credit,
    credit_days: row.credit_days,

    // ✅ Purchase order financial data
    total_purchases: row.total_purchases,
    total_paid_to_supplier: row.total_paid,
    amount_owed_to_supplier: row.calculated_balance, // Amount YOU owe TO supplier
    total_purchase_amount: row.total_purchases, // Add this for config

    // PO tracking
    open_pos_count: row.open_pos_count,
    last_payment_date: row.last_payment_date,
    last_order_date: row.last_order_date,

    // Supplier details (NOW IN VIEW)
    is_active: row.is_active,
    tax_id: row.tax_id || null,
    payment_terms: row.payment_terms || null,
    notes: row.notes || null,

    // Timestamps (NOW IN VIEW)
    created_at: row.created_at,
    updated_at: row.updated_at,
  }))

  return {
    data: suppliersWithBalances as any,
    error: null,
    count: result.count,
  }
}

/**
 * ✅ NEW: Record a payment against a purchase order
 * The database trigger will automatically update supplier balance
 */
export const recordPurchasePayment = async (
  purchaseOrderId: number,
  paymentAmount: number,
  paymentMethod: string,
  companyId: number,
  storeId: number,
  userId: number,
  paymentReference?: string,
  notes?: string,
): Promise<{
  data: any | null
  error: PostgrestError | null
}> => {
  try {
    // Get PO details for validation
    const { data: po, error: poError } = await supabase
      .from('purchase_orders')
      .select('supplier_id, paid_amount, total_amount')
      .eq('id', purchaseOrderId)
      .single()

    if (poError) return { data: null, error: poError }
    if (!po) {
      return {
        data: null,
        error: {
          message: 'Purchase order not found',
          code: 'NOT_FOUND',
        } as PostgrestError,
      }
    }

    // Validate payment amount
    const remainingAmount = po.total_amount - (po.paid_amount || 0)
    if (paymentAmount > remainingAmount + 0.01) {
      return {
        data: null,
        error: {
          message: `Payment amount ${paymentAmount} exceeds remaining balance of ${remainingAmount}`,
          code: 'VALIDATION_ERROR',
        } as PostgrestError,
      }
    }

    if (paymentAmount <= 0) {
      return {
        data: null,
        error: {
          message: 'Payment amount must be greater than zero',
          code: 'VALIDATION_ERROR',
        } as PostgrestError,
      }
    }

    // Create payment transaction
    const { data: transaction, error: transError } = await supabase
      .from('payment_transactions')
      .insert({
        company_id: companyId,
        store_id: storeId,
        transaction_number: `PAY-${Date.now()}`, // Generate unique number
        transaction_date: new Date().toISOString(),
        transaction_type: 'purchase',
        reference_type: 'purchase_order',
        reference_id: purchaseOrderId,
        amount: paymentAmount,
        payment_method: paymentMethod,
        reference_number: paymentReference,
        notes: notes,
        entity_type: 'supplier',
        entity_id: po.supplier_id,
        supplier_id: po.supplier_id,
        created_by: userId,
      })
      .select()
      .single()

    if (transError) return { data: null, error: transError }

    // Update PO paid_amount
    // The database trigger will automatically update supplier balance!
    const { error: poUpdateError } = await supabase
      .from('purchase_orders')
      .update({
        paid_amount: (po.paid_amount || 0) + paymentAmount,
        updated_at: new Date().toISOString(),
      })
      .eq('id', purchaseOrderId)

    if (poUpdateError) return { data: null, error: poUpdateError }

    return { data: transaction, error: null }
  } catch (error: any) {
    console.error('Error recording payment:', error)
    return {
      data: null,
      error: {
        message: error.message || 'Failed to record payment',
        code: 'INTERNAL_ERROR',
      } as PostgrestError,
    }
  }
}

/**
 * Get supplier statistics with purchase order balances
 */
export const getSupplierStatsWithBalances = async (
  companyId?: number,
): Promise<{
  data: {
    total: number
    active: number
    withBalance: number
    totalOwed: number
  } | null
  error: any
}> => {
  try {
    let baseQuery = supabase
      .from('suppliers')
      .select('id', { count: 'exact', head: true })

    if (companyId) {
      baseQuery = baseQuery.eq('company_id', companyId)
    }

    baseQuery = baseQuery.is('deleted_at', null)

    const [totalResult, activeResult] = await Promise.all([
      baseQuery,
      supabase
        .from('suppliers')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('is_active', true)
        .is('deleted_at', null),
    ])

    // AFTER — remove the .neq() filter and handle in JS, safer approach
    const { data: allPOs, error: posError } = await supabase
      .from('purchase_orders')
      .select('total_amount, paid_amount, supplier_id, payment_status')
      .eq('company_id', companyId)
      .in('status', ['approved', 'received', 'partially_received'])
      .is('deleted_at', null)

    if (posError) console.error('PO query error:', posError)

    let totalOwed = 0
    const suppliersWithBalance = new Set()

    if (allPOs) {
      allPOs
        .filter((po) => po.payment_status !== 'paid') // filter here instead
        .forEach((po) => {
          const amount = parseFloat(po.total_amount || 0)
          const paid = parseFloat(po.paid_amount || 0)
          const owed = amount - paid
          if (owed > 0) {
            totalOwed += owed
            suppliersWithBalance.add(po.supplier_id)
          }
        })
    }

    return {
      data: {
        total: totalResult.count || 0,
        active: activeResult.count || 0,
        withBalance: suppliersWithBalance.size,
        totalOwed,
      },
      error: null,
    }
  } catch (error) {
    console.error('Error fetching supplier stats:', error)
    return { data: null, error }
  }
}

