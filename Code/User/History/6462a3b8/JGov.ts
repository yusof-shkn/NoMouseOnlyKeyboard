/**
 * salesReturn.queries.ts
 *
 * FIXES:
 * ✅ All .eq() on boolean/null columns replaced with .is()
 *    - .is('deleted_at', null)     — PostgREST null check
 *    - .is('is_restricted', false) — PostgREST boolean check (via applyRestrictedFilter)
 *    Using .eq() on these types sends eq.false / eq.null (string literals) → 400 Bad Request
 *
 * ✅ Added missing export: getSalesReturnById
 *    - Required by SalesReturnView.tsx
 *    - Fetches single return with full relational data (items, products, batches)
 */

import { supabase } from '@app/core/supabase/Supabase.utils'
import { applyRestrictedFilter } from '@shared/utils/restrictedFilter.utils'
import { applyStoreFilter } from '@shared/utils/selectionFilter.utils'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SalesReturnStats {
  total: number
  pending: number
  approved: number
  completed: number
  cancelled: number
}

// ─── Full select string (reused across queries) ───────────────────────────────

const SALES_RETURN_SELECT = `
  *,
  sale:sale_id (
    id,
    sale_number,
    sale_date,
    total_amount,
    payment_method,
    customer:customer_id (
      id,
      first_name,
      last_name,
      phone,
      customer_type,
      business_name
    )
  ),
  store:store_id (
    id,
    store_name,
    store_code
  ),
  processor:processed_by (
    id,
    first_name,
    last_name
  ),
  approver:approved_by (
    id,
    first_name,
    last_name
  ),
  items:sales_return_items (
    id,
    sale_item_id,
    product_id,
    batch_id,
    batch_number,
    quantity_returned,
    unit_price,
    refund_amount,
    created_at,
    updated_at,
    product:product_id (
      id,
      product_name,
      product_code,
      generic_name,
      dosage_form,
      strength
    ),
    batch:batch_id (
      id,
      batch_number,
      expiry_date,
      manufacturing_date
    )
  )
`

// ─── getSalesReturnById ───────────────────────────────────────────────────────

/**
 * Fetch a single sales return by ID with all related data.
 * Used by SalesReturnView.tsx.
 *
 * @param id         - sales_returns.id
 * @param companyId  - for RLS scoping
 * @param isUnlocked - restricted mode state
 */
export const getSalesReturnById = async (
  id: number,
  companyId: number,
  isUnlocked: boolean,
) => {
  let query = supabase
    .from('sales_returns')
    .select(SALES_RETURN_SELECT)
    .eq('id', id)
    .eq('company_id', companyId)
    .is('deleted_at', null) // ✅ .is() not .eq()
    .single()

  query = applyRestrictedFilter(query, isUnlocked) // ✅ uses .is() internally

  const { data, error } = await query
  return { data, error }
}

// ─── getSalesReturnStats ──────────────────────────────────────────────────────

/**
 * Aggregated status counts for the stats bar.
 *
 * ✅ FIX: .is('deleted_at', null) — was .eq() → 400 Bad Request
 */
export const getSalesReturnStats = async (
  companyId: number,
  storeIds: number[] | null,
  isUnlocked: boolean,
): Promise<SalesReturnStats> => {
  const statuses = ['pending', 'approved', 'completed', 'cancelled'] as const

  const counts = await Promise.all(
    statuses.map(async (status) => {
      let query = supabase
        .from('sales_returns')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .is('deleted_at', null) // ✅ FIXED
        .eq('status', status)

      query = applyStoreFilter(query, storeIds)
      query = applyRestrictedFilter(query, isUnlocked)

      const { count, error } = await query
      if (error) {
        console.error(`[getSalesReturnStats] error fetching ${status}:`, error)
        return 0
      }
      return count ?? 0
    }),
  )

  // Total (no status filter)
  let totalQuery = supabase
    .from('sales_returns')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .is('deleted_at', null) // ✅ FIXED

  totalQuery = applyStoreFilter(totalQuery, storeIds)
  totalQuery = applyRestrictedFilter(totalQuery, isUnlocked)

  const { count: totalCount, error: totalError } = await totalQuery
  if (totalError) {
    console.error('[getSalesReturnStats] error fetching total:', totalError)
  }

  const result: SalesReturnStats = {
    total: totalCount ?? 0,
    pending: counts[0],
    approved: counts[1],
    completed: counts[2],
    cancelled: counts[3],
  }

  console.log('📊 [getSalesReturnStats] counts:', result)
  return result
}

// ─── getSalesReturns (paginated list) ─────────────────────────────────────────

/**
 * Paginated list of sales returns with filters.
 *
 * ✅ FIX: .is('deleted_at', null) — was .eq() → 400 Bad Request
 */
export const getSalesReturns = async ({
  companyId,
  storeIds,
  isUnlocked,
  status,
  page = 1,
  pageSize = 20,
  search,
  dateFrom,
  dateTo,
}: {
  companyId: number
  storeIds: number[] | null
  isUnlocked: boolean
  status?: string
  page?: number
  pageSize?: number
  search?: string
  dateFrom?: string
  dateTo?: string
}) => {
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = supabase
    .from('sales_returns')
    .select(SALES_RETURN_SELECT, { count: 'exact' })
    .eq('company_id', companyId)
    .is('deleted_at', null) // ✅ FIXED

  if (status) query = query.eq('status', status)
  if (dateFrom) query = query.gte('return_date', dateFrom)
  if (dateTo) query = query.lte('return_date', dateTo)
  if (search) query = query.ilike('return_number', `%${search}%`)

  query = applyStoreFilter(query, storeIds)
  query = applyRestrictedFilter(query, isUnlocked)

  query = query.order('created_at', { ascending: false }).range(from, to)

  const { data, count, error } = await query
  return { data: data ?? [], count: count ?? 0, error }
}

// ─── updateSalesReturnStatus ──────────────────────────────────────────────────

/**
 * Update status on a sales return (approve / reject / complete).
 */
export const updateSalesReturnStatus = async (
  id: number,
  status: 'pending' | 'approved' | 'rejected' | 'completed',
  approvedBy?: number,
) => {
  const payload: Record<string, any> = {
    status,
    updated_at: new Date().toISOString(),
  }
  if (status === 'approved' && approvedBy) {
    payload.approved_by = approvedBy
    payload.approved_at = new Date().toISOString()
  }

  const { data, error } = await supabase
    .from('sales_returns')
    .update(payload)
    .eq('id', id)
    .select()
    .single()

  return { data, error }
}
// ─── deleteSalesReturn ────────────────────────────────────────────────────────

/**
 * Soft-delete a sales return by setting deleted_at and status to 'cancelled'.
 */
export const deleteSalesReturn = async (id: number) => {
  const { data, error } = await supabase
    .from('sales_returns')
    .update({
      deleted_at: new Date().toISOString(),
      status: 'cancelled',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  return { data, error }
}

