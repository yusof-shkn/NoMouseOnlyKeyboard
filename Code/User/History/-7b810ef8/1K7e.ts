// src/features/inventory/components/stockTransfer/data/stockTransfer.queries.ts
import { supabase } from '@app/core/supabase/Supabase.utils'
import { PostgrestError } from '@supabase/supabase-js'
import { StockTransfer, StockTransferItem } from '../types/stockTransfer.types'

export interface GetStockTransfersOptions {
  page?: number
  pageSize?: number
  searchQuery?: string
  fromStoreId?: number | null
  toStoreId?: number | null
  status?: string
  dateRange?: string
  sort?: string
  /** Scope filter: show transfers where from_store or to_store is in these stores */
  storeIds?: number[] | null
}

const getDateRangeFilter = (dateRange: string): Date | null => {
  const now = new Date()
  switch (dateRange) {
    case 'last_7_days':
      return new Date(now.setDate(now.getDate() - 7))
    case 'last_month':
      return new Date(now.setMonth(now.getMonth() - 1))
    case 'last_3_months':
      return new Date(now.setMonth(now.getMonth() - 3))
    default:
      return null
  }
}

export const getStockTransfers = async ({
  page = 1,
  pageSize = 10,
  searchQuery = '',
  fromStoreId = null,
  toStoreId = null,
  status = 'all',
  dateRange = 'all',
  sort = 'desc',
  storeIds = undefined,
}: GetStockTransfersOptions = {}): Promise<{
  data: StockTransfer[] | null
  error: PostgrestError | null
  count: number | null
}> => {
  try {
    let query = supabase
      .from('stock_transfers')
      .select(
        `*,
        from_store:stores!stock_transfers_from_store_id_fkey(id, store_name, store_code, area_id),
        to_store:stores!stock_transfers_to_store_id_fkey(id, store_name, store_code, area_id),
        items:stock_transfer_items(
          id, product_id, batch_id, quantity_requested, quantity_sent, unit_id,
          product:products(id, product_name, product_code),
          batch:product_batches(id, batch_number, quantity_available, expiry_date),
          unit:units(id, name, short_code)
        )`,
        { count: 'exact' },
      )
      .is('deleted_at', null)

    if (searchQuery?.trim()) {
      query = query.ilike('transfer_number', `%${searchQuery.trim()}%`)
    }

    if (fromStoreId) query = query.eq('from_store_id', fromStoreId)
    if (toStoreId) query = query.eq('to_store_id', toStoreId)

    // Scope filter: only show if the explicit per-store filters aren't already set
    if (!fromStoreId && !toStoreId && storeIds !== undefined && storeIds !== null) {
      if (storeIds.length === 0) {
        // Empty scope — return nothing
        return { data: [], error: null, count: 0 }
      }
      // Show transfers where from_store OR to_store is in the user's scope
      const idList = storeIds.join(',')
      query = query.or(`from_store_id.in.(${idList}),to_store_id.in.(${idList})`)
    }

    if (status && status !== 'all') query = query.eq('status', status)

    if (dateRange && dateRange !== 'all') {
      const startDate = getDateRangeFilter(dateRange)
      if (startDate) query = query.gte('created_at', startDate.toISOString())
    }

    const ascending = sort === 'asc'
    query = query.order('created_at', { ascending })
    query = query.range((page - 1) * pageSize, page * pageSize - 1)

    const { data, error, count } = await query

    if (error) return { data: null, error, count: null }

    // Enrich with profiles
    if (data && data.length > 0) {
      const userIds = new Set<number>()
      data.forEach((t: any) => {
        if (t.created_by) userIds.add(t.created_by)
        if (t.approved_by) userIds.add(t.approved_by)
        if (t.dispatched_by) userIds.add(t.dispatched_by)
        if (t.received_by) userIds.add(t.received_by)
      })

      if (userIds.size > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, role_id, role:roles(id, role_name)')
          .in('id', Array.from(userIds))

        const profileMap = new Map(profiles?.map((p) => [p.id, p]) || [])
        const enriched = data.map((t: any) => ({
          ...t,
          items_count: t.items?.length || 0,
          created_by_profile: t.created_by ? profileMap.get(t.created_by) : null,
          approved_by_profile: t.approved_by ? profileMap.get(t.approved_by) : null,
          dispatched_by_profile: t.dispatched_by ? profileMap.get(t.dispatched_by) : null,
          received_by_profile: t.received_by ? profileMap.get(t.received_by) : null,
        }))
        return { data: enriched as StockTransfer[], error: null, count }
      }
    }

    return {
      data: (data || []).map((t: any) => ({ ...t, items_count: t.items?.length || 0 })) as StockTransfer[],
      error: null,
      count,
    }
  } catch (error) {
    return { data: null, error: error as PostgrestError, count: null }
  }
}

export const getAllStoresForTransfer = async (options?: {
  roleId?: number | null
  defaultStoreId?: number | null
  defaultAreaId?: number | null
}): Promise<{ data: any[] | null; error: PostgrestError | null }> => {
  const { roleId, defaultStoreId, defaultAreaId } = options || {}

  let query = supabase
    .from('stores')
    .select('id, store_name, store_code, area_id')
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('store_name', { ascending: true })

  // FROM store scoping by role:
  // Store-level users can only transfer FROM their own store
  if (roleId && roleId >= 4 && defaultStoreId) {
    query = query.eq('id', defaultStoreId)
  }
  // Area admin: only FROM stores in their area
  else if (roleId === 3 && defaultAreaId) {
    query = query.eq('area_id', defaultAreaId)
  }
  // Company admin (2) and accounting manager (8): all stores — no filter

  return await query
}

// TO store is always ALL active stores — no role restriction
export const getAllStoresToTransfer = async (): Promise<{ data: any[] | null; error: PostgrestError | null }> => {
  return await supabase
    .from('stores')
    .select('id, store_name, store_code, area_id')
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('store_name', { ascending: true })
}

export const getProductsForTransfer = async (storeId?: number): Promise<{
  data: any[] | null
  error: PostgrestError | null
}> => {
  if (!storeId) return { data: [], error: null }

  // Only return products that have at least one active batch with available qty in this store
  // FIX-05: include unit info so handleProductChange can auto-fill unit_id
  const { data, error } = await supabase
    .from('product_batches')
    .select('product_id, product:products(id, product_name, product_code, unit_id, unit:units(id, name, short_code))')
    .eq('store_id', storeId)
    .eq('is_active', true)
    .eq('is_expired', false)
    .is('deleted_at', null)
    .gt('quantity_available', 0)

  if (error) return { data: null, error }

  // Deduplicate by product_id
  const seen = new Set<number>()
  const products: any[] = []
  for (const row of data || []) {
    if (row.product && !seen.has(row.product_id)) {
      seen.add(row.product_id)
      products.push(row.product)
    }
  }

  products.sort((a, b) => a.product_name.localeCompare(b.product_name))
  return { data: products, error: null }
}

export const getBatchesForStoreProduct = async (
  productId: number,
  storeId: number,
): Promise<{ data: any[] | null; error: PostgrestError | null }> => {
  return await supabase
    .from('product_batches')
    .select('id, batch_number, quantity_available, expiry_date')
    .eq('product_id', productId)
    .eq('store_id', storeId)
    .eq('is_active', true)
    .is('deleted_at', null)
    .gt('quantity_available', 0)
    .order('expiry_date', { ascending: true })
}

export const generateTransferNumber = async (): Promise<string> => {
  // Use DB sequence — eliminates duplicate key race conditions entirely.
  const { data, error } = await supabase.rpc('fn_generate_transfer_number')
  if (error || !data) {
    // Fallback: timestamp-based unique number if RPC fails
    const ts = Date.now().toString().slice(-7)
    return `TRF-${new Date().getFullYear()}-${ts}`
  }
  return data as string
}

export const createStockTransfer = async (
  transferData: {
    transfer_number: string
    from_store_id: number
    to_store_id: number
    status: string
    notes?: string
    created_by: number
    company_id: number
  },
  items: Array<{
    product_id: number
    batch_id?: number | null
    quantity_requested: number
    quantity_sent: number
    unit_id?: number | null
  }>,
): Promise<{ data: { id: number } | null; error: PostgrestError | null }> => {
  // Insert transfer header
  const { data: transfer, error: transferError } = await supabase
    .from('stock_transfers')
    .insert([transferData])
    .select('id')
    .single()

  if (transferError || !transfer) return { data: null, error: transferError }

  // Insert items
  const itemsToInsert = items.map((item) => ({
    ...item,
    transfer_id: transfer.id,
  }))

  const { error: itemsError } = await supabase
    .from('stock_transfer_items')
    .insert(itemsToInsert)

  if (itemsError) return { data: null, error: itemsError }

  return { data: transfer, error: null }
}

export const updateStockTransfer = async (
  id: number,
  transferData: Partial<{
    status: string
    notes: string
    approved_by: number
    approved_at: string
    completed_at: string
  }>,
  items?: Array<{
    product_id: number
    batch_id?: number | null
    quantity_requested: number
    quantity_sent: number
    unit_id?: number | null
  }>,
): Promise<{ error: PostgrestError | null }> => {
  const { error } = await supabase
    .from('stock_transfers')
    .update({ ...transferData, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { error }

  if (items) {
    // Delete existing items and re-insert
    await supabase.from('stock_transfer_items').delete().eq('transfer_id', id)

    const { error: itemsError } = await supabase.from('stock_transfer_items').insert(
      items.map((item) => ({ ...item, transfer_id: id })),
    )
    if (itemsError) return { error: itemsError }
  }

  return { error: null }
}

// Admin approves pending transfer → in_transit (stock NOT yet moved)
export const dispatchStockTransfer = async (
  transferId: number,
  dispatchedBy: number,
): Promise<{ error: PostgrestError | null }> => {
  const { error } = await supabase
    .from('stock_transfers')
    .update({
      status: 'in_transit',
      approved_by: dispatchedBy,
      approved_at: new Date().toISOString(),
      dispatched_by: dispatchedBy,
      dispatched_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', transferId)
  return { error }
}

// Destination store admin receives → completed (atomic DB function moves stock)
export const receiveStockTransfer = async (
  transferId: number,
  receivedBy: number,
  receiverNotes?: string,
): Promise<{ error: PostgrestError | null }> => {
  // Use server-side atomic function:
  // - Locks source batch row (FOR UPDATE) to prevent race conditions
  // - Deducts quantity_available from source batch
  // - Finds or creates matching batch at destination store
  // - Marks transfer completed with timestamps
  const { data, error } = await supabase.rpc('fn_complete_stock_transfer', {
    p_transfer_id: transferId,
    p_received_by: receivedBy,
    p_receiver_notes: receiverNotes ?? null,
  })

  if (error) return { error }

  if (data && !data.success) {
    return {
      error: {
        message: data.message || 'Transfer completion failed',
        details: '',
        hint: '',
        code: 'TRANSFER_ERROR',
        name: 'PostgrestError',
      } as PostgrestError,
    }
  }

  return { error: null }
} => {
  const { data: items, error: itemsError } = await supabase
    .from('stock_transfer_items')
    .select(`*, batch:product_batches(id, store_id, product_id, batch_number, quantity_available, expiry_date, unit_cost, selling_price)`)
    .eq('transfer_id', transferId)
  if (itemsError) return { error: itemsError }

  const { data: transfer, error: transferFetchError } = await supabase
    .from('stock_transfers')
    .select('from_store_id, to_store_id, company_id')
    .eq('id', transferId)
    .single()
  if (transferFetchError || !transfer) return { error: transferFetchError }

  for (const item of items || []) {
    const qty = item.quantity_sent || item.quantity_requested
    if (item.batch_id) {
      const { error: deductError } = await supabase
        .from('product_batches')
        .update({ quantity_available: Math.max(0, (item.batch?.quantity_available || 0) - qty), updated_at: new Date().toISOString() })
        .eq('id', item.batch_id)
      if (deductError) return { error: deductError }

      const { data: destBatch } = await supabase
        .from('product_batches')
        .select('id, quantity_available')
        .eq('product_id', item.product_id)
        .eq('store_id', transfer.to_store_id)
        .eq('batch_number', item.batch?.batch_number || '')
        .eq('is_active', true)
        .is('deleted_at', null)
        .maybeSingle()

      if (destBatch) {
        await supabase.from('product_batches').update({ quantity_available: destBatch.quantity_available + qty, updated_at: new Date().toISOString() }).eq('id', destBatch.id)
      } else {
        await supabase.from('product_batches').insert([{
          company_id: transfer.company_id,
          product_id: item.product_id,
          store_id: transfer.to_store_id,
          batch_number: item.batch?.batch_number || `TRF-${transferId}`,
          quantity_available: qty,
          quantity_received: qty,
          expiry_date: item.batch?.expiry_date || null,
          unit_cost: item.batch?.unit_cost || 0,
          selling_price: item.batch?.selling_price || 0,
          is_active: true,
        }])
      }
    }
  }

  const { error: completeError } = await supabase
    .from('stock_transfers')
    .update({
      status: 'completed',
      received_by: receivedBy,
      received_at: new Date().toISOString(),
      receiver_notes: receiverNotes || null,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', transferId)
  return { error: completeError }
}



export const cancelStockTransfer = async (
  id: number,
): Promise<{ error: PostgrestError | null }> => {
  return await supabase
    .from('stock_transfers')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', id)
}

export const deleteStockTransfer = async (
  id: number,
): Promise<{ error: PostgrestError | null }> => {
  return await supabase
    .from('stock_transfers')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
}
