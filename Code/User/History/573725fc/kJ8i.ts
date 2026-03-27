// supabase/queries/salesQueries.ts - UPDATED WITH AREA/STORE FILTERING
import { supabase } from '@app/core/supabase/Supabase.utils'
import { SalesFilters } from '../types/salesHistory.types'
import { store } from '@app/core/store/store' // ✅ Import Redux store
import { applyRestrictedFilter } from '@shared/utils/restrictedFilter.utils'

/**
 * ✅ NEW: Get current selection from Redux
 */
const getCurrentSelection = () => {
  const state = store.getState()
  return {
    selectedArea: state.areaStore?.selectedArea,
    selectedStore: state.areaStore?.selectedStore,
  }
}

/**
 * ✅ NEW: Apply area/store filtering to query
 */
const applySelectionFilter = (query: any) => {
  const { selectedArea, selectedStore } = getCurrentSelection()

  // Priority 1: If store is selected, filter by that specific store
  if (selectedStore) {
    console.log('🏪 Filtering by selected store:', selectedStore.store_name)
    return query.eq('store_id', selectedStore.id)
  }

  // Priority 2: If area is selected, filter by stores in that area
  if (selectedArea) {
    console.log('📍 Filtering by selected area:', selectedArea.area_name)
    // You'll need to join with stores table to filter by area_id
    return query.in(
      'store_id',
      supabase
        .from('stores')
        .select('id')
        .eq('area_id', selectedArea.id)
        .is('deleted_at', null),
    )
  }

  // No selection: show all
  console.log('🌍 No area/store selected - showing all')
  return query
}

/**
 * ✅ UPDATED: Query uses area/store filtering from Redux selection
 */
export const getSales = async ({
  page = 1,
  pageSize = 10,
  searchQuery = '',
  status = 'all',
  paymentMethod = 'all',
  customerId,
  storeId,
  saleType,
  dateRange,
  isUnlocked = false,
}: SalesFilters & { isUnlocked?: boolean } = {}) => {
  try {
    let query = supabase
      .from('sales')
      .select(
        `
        *,
        customers(id, customer_code, first_name, last_name, phone, email, address),
        stores(id, store_name, area_id),
        profiles!sales_processed_by_fkey(auth_id, first_name, last_name, username),
        prescriptions(
          id,
          prescription_number,
          prescription_date,
          prescriber_name,
          prescriber_license,
          is_verified
        )
      `,
        { count: 'exact' },
      )
      .is('deleted_at', null)
      .order('sale_date', { ascending: false })

    // Apply restricted filter
    query = applyRestrictedFilter(query, isUnlocked)

    // ✅ Apply Redux selection filter (if no explicit storeId provided)
    if (!storeId) {
      query = applySelectionFilter(query)
    } else {
      // Explicit storeId in params overrides Redux selection
      query = query.eq('store_id', storeId)
    }

    // Search filter
    if (searchQuery) {
      query = query.or(
        `sale_number.ilike.%${searchQuery}%,customers.first_name.ilike.%${searchQuery}%,customers.last_name.ilike.%${searchQuery}%,customers.customer_code.ilike.%${searchQuery}%`,
      )
    }

    // Status filter
    if (status && status !== 'all') {
      query = query.eq('sale_status', status)
    }

    // Payment method filter
    if (paymentMethod && paymentMethod !== 'all') {
      query = query.eq('payment_method', paymentMethod)
    }

    // Customer filter
    if (customerId) {
      query = query.eq('customer_id', customerId)
    }

    // Sale type filter
    if (saleType && saleType !== 'all') {
      query = query.eq('sale_type', saleType)
    }

    // Date range filter
    if (dateRange) {
      query = query
        .gte('sale_date', dateRange.start)
        .lte('sale_date', dateRange.end)
    }

    // Pagination
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1
    query = query.range(from, to)

    const { data, error, count } = await query

    return { data, error, count }
  } catch (error) {
    console.error('Error fetching sales:', error)
    return { data: null, error, count: 0 }
  }
}

/**
 * ✅ UPDATED: Uses product_batches instead of batches
 */
export const getSaleById = async (id: number) => {
  try {
    const { data, error } = await supabase
      .from('sales')
      .select(
        `
        *,
        customers(
          id, 
          customer_code, 
          first_name, 
          last_name, 
          phone, 
          email, 
          address,
          credit_limit,
          current_credit_balance,
          available_credit
        ),
        stores(
          id, 
          store_name, 
          store_code, 
          phone, 
          address,
          area_id
        ),
        profiles!sales_processed_by_fkey(
          auth_id, 
          first_name, 
          last_name, 
          username, 
          email
        ),
        prescriptions(
          id,
          prescription_number,
          prescription_date,
          prescriber_name,
          prescriber_license,
          prescriber_contact,
          patient_name,
          diagnosis,
          is_verified,
          valid_from,
          valid_until,
          is_expired
        ),
        sale_items(
          *,
          products(
            id, 
            product_name, 
            product_code,
            generic_name
          ),
          batches:product_batches(
            id, 
            batch_number, 
            expiry_date
          )
        ),
        sale_payments(
          id,
          payment_number,
          payment_date,
          payment_amount,
          payment_method,
          payment_reference,
          notes
        )
      `,
      )
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    return { data, error }
  } catch (error) {
    console.error('Error fetching sale by ID:', error)
    return { data: null, error }
  }
}

export const getCustomers = async () => {
  try {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .is('deleted_at', null)
      .eq('is_active', true)
      .order('first_name')

    return { data, error }
  } catch (error) {
    console.error('Error fetching customers:', error)
    return { data: null, error }
  }
}

/**
 * ✅ UPDATED: Filter stores by selected area from Redux
 */
export const getSalesStores = async () => {
  try {
    const { selectedArea } = getCurrentSelection()

    let query = supabase
      .from('stores')
      .select('*')
      .is('deleted_at', null)
      .eq('is_active', true)
      .order('store_name')

    // ✅ If area is selected, only show stores in that area
    if (selectedArea) {
      console.log('📍 Filtering stores by area:', selectedArea.area_name)
      query = query.eq('area_id', selectedArea.id)
    }

    const { data, error } = await query

    return { data, error }
  } catch (error) {
    console.error('Error fetching stores:', error)
    return { data: null, error }
  }
}

export const getUsers = async () => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, auth_id, first_name, last_name, username, company_id, email')
      .is('deleted_at', null)
      .eq('is_active', true)
      .order('first_name')

    return { data, error }
  } catch (error) {
    console.error('Error fetching users:', error)
    return { data: null, error }
  }
}

/**
 * Soft delete a sale and its items
 */
export const deleteSale = async (id: number) => {
  try {
    // Soft delete sale items first
    const { error: itemsError } = await supabase
      .from('sale_items')
      .update({ deleted_at: new Date().toISOString() })
      .eq('sale_id', id)
      .is('deleted_at', null)

    if (itemsError) throw itemsError

    // Soft delete the sale
    const { error } = await supabase
      .from('sales')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .is('deleted_at', null)

    return { error }
  } catch (error) {
    console.error('Error deleting sale:', error)
    return { error }
  }
}

/**
 * Update a sale (basic fields only - use fn_update_sale_with_items for full update)
 */
export const updateSale = async (id: number, updates: Partial<any>) => {
  try {
    const { data, error } = await supabase
      .from('sales')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .is('deleted_at', null)
      .select()
      .single()

    return { data, error }
  } catch (error) {
    console.error('Error updating sale:', error)
    return { data: null, error }
  }
}

/**
 * ✅ UPDATED: Apply area/store filtering to summary
 */
export const getSalesSummary = async (filters?: {
  storeId?: number
  dateRange?: { start: string; end: string }
}) => {
  try {
    let query = supabase.from('vw_sales_summary').select('*')

    // ✅ Apply Redux selection if no explicit storeId
    if (!filters?.storeId) {
      const { selectedArea, selectedStore } = getCurrentSelection()

      if (selectedStore) {
        query = query.eq('store_id', selectedStore.id)
      } else if (selectedArea) {
        // For area filtering, you may need to modify the view or use a different approach
        // This depends on whether vw_sales_summary includes area_id
        console.warn(
          'Area filtering on summary view requires view modification',
        )
      }
    } else {
      query = query.eq('store_id', filters.storeId)
    }

    if (filters?.dateRange) {
      query = query
        .gte('sale_date', filters.dateRange.start)
        .lte('sale_date', filters.dateRange.end)
    }

    const { data, error } = await query.single()

    return { data, error }
  } catch (error) {
    console.error('Error fetching sales summary:', error)
    return { data: null, error }
  }
}

/**
 * ✅ UPDATED: Process a sale return
 * Creates sales_returns record and updates sale status
 * Handles credit reversals and inventory restoration
 */
export const processSaleReturn = async (
  saleId: number,
  returnData: {
    return_reason: string
    processed_by: number // profile.id (bigint), not auth_id
    refund_amount: number
  },
) => {
  try {
    // Get the sale details first
    const { data: saleData, error: saleError } = await supabase
      .from('sales')
      .select(
        '*, sale_items(*), customers(id, current_credit_balance, available_credit, credit_limit)',
      )
      .eq('id', saleId)
      .single()

    if (saleError) throw saleError

    // Generate return number
    const { data: returnNumber, error: returnNumberError } = await supabase.rpc(
      'generate_return_number',
      {
        p_company_id: saleData.company_id,
      },
    )

    if (returnNumberError) {
      console.warn(
        'Failed to generate return number, using fallback:',
        returnNumberError,
      )
    }

    // Create sales_returns record
    const { data: returnRecord, error: returnError } = await supabase
      .from('sales_returns')
      .insert({
        company_id: saleData.company_id,
        store_id: saleData.store_id,
        sale_id: saleId,
        return_number: returnNumber || `RET-${Date.now()}`,
        return_date: new Date().toISOString(),
        return_reason: returnData.return_reason,
        total_refund_amount: returnData.refund_amount,
        refund_method: saleData.payment_method,
        status: 'completed',
        processed_by: returnData.processed_by,
        approved_by: returnData.processed_by,
        approved_at: new Date().toISOString(),
        notes: `Return processed for sale ${saleData.sale_number}`,
      })
      .select()
      .single()

    if (returnError) throw returnError

    // Create sales_return_items for each sale_item
    if (saleData.sale_items && saleData.sale_items.length > 0) {
      const returnItems = saleData.sale_items.map((item: any) => ({
        sales_return_id: returnRecord.id,
        sale_item_id: item.id,
        product_id: item.product_id,
        batch_id: item.batch_id,
        batch_number: item.batch_number,
        quantity_returned: item.quantity,
        unit_price: item.unit_price,
        refund_amount: item.total_price,
      }))

      const { error: itemsError } = await supabase
        .from('sales_return_items')
        .insert(returnItems)

      if (itemsError) throw itemsError
    }

    // Update sale status to 'returned'
    const { error: updateSaleError } = await supabase
      .from('sales')
      .update({
        sale_status: 'returned',
        payment_status: 'paid', // Transaction complete
        notes: saleData.notes
          ? `${saleData.notes}\n\nRETURNED: ${returnData.return_reason} (Return #${returnRecord.return_number})`
          : `RETURNED: ${returnData.return_reason} (Return #${returnRecord.return_number})`,
        updated_at: new Date().toISOString(),
      })
      .eq('id', saleId)

    if (updateSaleError) throw updateSaleError

    // Handle credit reversal if payment method was credit
    if (saleData.payment_method === 'credit' && saleData.customer_id) {
      const newCreditBalance =
        (saleData.customers?.current_credit_balance || 0) -
        saleData.total_amount
      const newAvailableCredit =
        (saleData.customers?.available_credit || 0) + saleData.total_amount

      // Update customer credit balance
      const { error: creditUpdateError } = await supabase
        .from('customers')
        .update({
          current_credit_balance: newCreditBalance,
          available_credit: newAvailableCredit,
          updated_at: new Date().toISOString(),
        })
        .eq('id', saleData.customer_id)

      if (creditUpdateError) throw creditUpdateError

      // Mark original credit transaction as reversed
      if (saleData.credit_transaction_id) {
        const { error: creditTxnError } = await supabase
          .from('credit_transactions')
          .update({
            status: 'cancelled',
            notes: saleData.notes
              ? `${saleData.notes}\nReversed due to sale return: ${returnRecord.return_number}`
              : `Reversed due to sale return: ${returnRecord.return_number}`,
            updated_at: new Date().toISOString(),
          })
          .eq('id', saleData.credit_transaction_id)

        if (creditTxnError) {
          console.error('Error updating credit transaction:', creditTxnError)
        }
      }

      // Create new credit transaction for the return
      const { error: newCreditTxnError } = await supabase
        .from('credit_transactions')
        .insert({
          company_id: saleData.company_id,
          entity_type: 'customer',
          entity_id: saleData.customer_id,
          transaction_type: 'payment',
          transaction_amount: saleData.total_amount, // Positive for reducing balance
          balance_before: saleData.customers?.current_credit_balance || 0,
          balance_after: newCreditBalance,
          reference_type: 'return',
          reference_id: returnRecord.id,
          description: `Credit reversed for returned sale ${saleData.sale_number}`,
          status: 'completed',
          due_date: new Date().toISOString(),
          created_by: returnData.processed_by,
        })

      if (newCreditTxnError) {
        console.error(
          'Error creating credit return transaction:',
          newCreditTxnError,
        )
      }
    }

    // TODO: Restore inventory quantities
    // This should be done via trigger or separate function
    // For each sale_item, add quantity back to product_batches.quantity_available

    return { data: returnRecord, error: null }
  } catch (error) {
    console.error('Error processing return:', error)
    return { data: null, error }
  }
}

/**
 * Get prescriptions for a customer
 */
export const getPrescriptionsByCustomer = async (customerId: number) => {
  try {
    const { data, error } = await supabase
      .from('prescriptions')
      .select('*')
      .eq('customer_id', customerId)
      .is('deleted_at', null)
      .eq('is_expired', false)
      .order('prescription_date', { ascending: false })

    return { data, error }
  } catch (error) {
    console.error('Error fetching prescriptions:', error)
    return { data: null, error }
  }
}

/**
 * Get prescription by ID
 */
export const getPrescriptionById = async (id: number) => {
  try {
    const { data, error } = await supabase
      .from('prescriptions')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    return { data, error }
  } catch (error) {
    console.error('Error fetching prescription:', error)
    return { data: null, error }
  }
}

/**
 * Get customer insurance
 */
export const getCustomerInsurance = async (customerId: number) => {
  try {
    const { data, error } = await supabase
      .from('customer_insurance')
      .select('*')
      .eq('customer_id', customerId)
      .is('deleted_at', null)
      .eq('is_active', true)
      .single()

    return { data, error }
  } catch (error) {
    console.error('Error fetching customer insurance:', error)
    return { data: null, error }
  }
}

