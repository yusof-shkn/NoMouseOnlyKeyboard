// src/features/sales/data/SalesPOS.queries.ts
// UPDATED VERSION - Matching New Database Schema (January 2026)
// FIXED: Better error handling and enum type handling

import { supabase } from '@app/core/supabase/Supabase.utils'

/**
 * Fetch units
 */
export async function fetchUnits(companyId: number) {
  const { data, error } = await supabase
    .from('units')
    .select('id, name, short_code')
    .eq('company_id', companyId) // FIX-03: filter by company (multi-tenancy fix)
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('name', { ascending: true })

  if (error) {
    console.error('Error fetching units:', error)
    throw error
  }

  return data
}

/**
 * Fetch products with inventory
 */
export async function fetchProductsWithInventoryPaginated(
  companyId: number,
  storeId: number,
  options: {
    page?: number
    pageSize?: number
    searchQuery?: string
    categoryId?: number | null
  } = {},
) {
  const {
    page = 1,
    pageSize = 20,
    searchQuery = '',
    categoryId = null,
  } = options

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 1: Get true total count first (avoids Supabase 1000-row default cap)
  // ─────────────────────────────────────────────────────────────────────────
  let countQuery = supabase
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', true)
    .is('deleted_at', null)

  if (searchQuery.trim()) {
    countQuery = countQuery.or(
      `product_name.ilike.%${searchQuery}%,product_code.ilike.%${searchQuery}%,barcode.ilike.%${searchQuery}%,generic_name.ilike.%${searchQuery}%`,
    )
  }
  if (categoryId !== null) {
    countQuery = countQuery.eq('category_id', categoryId)
  }
  const { count: trueTotal } = await countQuery

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 2: Fetch ALL matching products in batches to overcome 1000-row limit
  // (sort must come after inventory enrichment so in-stock products always
  // appear before out-of-stock products across page boundaries).
  // ─────────────────────────────────────────────────────────────────────────
  const BATCH = 1000
  let allProducts: any[] = []
  let offset = 0
  while (true) {
    let query = supabase
      .from('products')
      .select(
        `
      id,
      product_name,
      product_code,
      generic_name,
      barcode,
      category_id,
      unit_id,
      standard_price,
      standard_cost,
      reorder_level,
      image_url,
      requires_prescription,
      category:categories(id, category_name),
      unit:units(id, name, short_code)
    `,
      )
      .eq('is_active', true)
      .is('deleted_at', null)

    if (searchQuery.trim()) {
      query = query.or(
        `product_name.ilike.%${searchQuery}%,product_code.ilike.%${searchQuery}%,barcode.ilike.%${searchQuery}%,generic_name.ilike.%${searchQuery}%`,
      )
    }
    if (categoryId !== null) {
      query = query.eq('category_id', categoryId)
    }

    const { data: batch, error: productsError } = await query
      .order('product_name', { ascending: true })
      .range(offset, offset + BATCH - 1)

    if (productsError) {
      console.error('Error fetching products:', productsError)
      throw productsError
    }

    if (!batch || batch.length === 0) break
    allProducts = allProducts.concat(batch)
    if (batch.length < BATCH) break
    offset += BATCH
  }

  if (allProducts.length === 0) {
    return { products: [], totalCount: trueTotal ?? 0, hasMore: false }
  }

  const allProductIds = allProducts.map((p: any) => p.id)

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 3: Fetch inventory in chunks of 200 IDs to avoid Supabase URL length
  // limit (400 Bad Request when sending 2000+ IDs in a single IN() query)
  // ─────────────────────────────────────────────────────────────────────────
  const CHUNK_SIZE = 200
  let allInventory: any[] = []
  for (let i = 0; i < allProductIds.length; i += CHUNK_SIZE) {
    const chunk = allProductIds.slice(i, i + CHUNK_SIZE)
    const { data: batchChunk } = await supabase
      .from('product_batches')
      .select(
        `product_id, quantity_available, selling_price, unit_cost, expiry_date, is_expired`,
      )
      .eq('store_id', storeId)
      .in('product_id', chunk)
      .eq('is_active', true)
      .eq('is_expired', false)
      .gt('quantity_available', 0)
      .is('deleted_at', null)
    if (batchChunk) allInventory = allInventory.concat(batchChunk)
  }
  const inventory = allInventory

  const inventoryMap = new Map<number, any>()
  const today = new Date()
  const thirtyDaysFromNow = new Date(today)
  thirtyDaysFromNow.setDate(today.getDate() + 30)

  if (inventory) {
    inventory.forEach((batch: any) => {
      const current = inventoryMap.get(batch.product_id) || {
        total_quantity: 0,
        available_quantity: 0,
        expiring_soon_count: 0,
        total_batches: 0,
        total_value: 0,
        average_price: 0,
      }
      current.total_quantity += batch.quantity_available
      current.available_quantity += batch.quantity_available
      current.total_batches += 1
      const price = batch.selling_price || batch.unit_cost || 0
      current.total_value += batch.quantity_available * price
      if (batch.expiry_date) {
        const expiryDate = new Date(batch.expiry_date)
        if (expiryDate <= thirtyDaysFromNow) current.expiring_soon_count += 1
      }
      inventoryMap.set(batch.product_id, current)
    })
    inventoryMap.forEach((inv) => {
      if (inv.total_quantity > 0)
        inv.average_price = inv.total_value / inv.total_quantity
    })
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 3: Enrich + assign sort priority for ALL products
  // ─────────────────────────────────────────────────────────────────────────
  const enriched = allProducts.map((product: any) => {
    const inv = inventoryMap.get(product.id) || {
      total_quantity: 0,
      available_quantity: 0,
      expiring_soon_count: 0,
      total_batches: 0,
      average_price: product.standard_price || 0,
    }
    const hasBatch = (inv.total_batches || 0) > 0 || inv.total_quantity > 0
    let stock_status = 'IN_STOCK'
    let sort_priority = 1 // 1=in-stock, 2=low stock, 3=out of stock, 4=no batch
    if (!hasBatch) {
      stock_status = 'NO_BATCH'
      sort_priority = 4
    } else if (inv.total_quantity === 0) {
      stock_status = 'OUT_OF_STOCK'
      sort_priority = 3
    } else if (inv.total_quantity <= (product.reorder_level || 0)) {
      stock_status = 'LOW_STOCK'
      sort_priority = 2
    }
    return {
      ...product,
      ...inv,
      can_sell: inv.total_quantity > 0,
      stock_status,
      sort_priority,
    }
  })

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 4: Sort ALL products by priority THEN alphabetically — BEFORE paging.
  // This ensures in-stock products always come first regardless of page.
  // ─────────────────────────────────────────────────────────────────────────
  enriched.sort((a: any, b: any) => {
    if (a.sort_priority !== b.sort_priority)
      return a.sort_priority - b.sort_priority
    return (a.product_name || '').localeCompare(b.product_name || '')
  })

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 5: Paginate the already-sorted list
  // ─────────────────────────────────────────────────────────────────────────
  const totalCount = trueTotal ?? enriched.length
  const from = (page - 1) * pageSize
  const pageProducts = enriched.slice(from, from + pageSize)

  return {
    products: pageProducts,
    totalCount,
    hasMore: from + pageSize < enriched.length,
  }
}
/**
 * Fetch categories with product count
 */
export async function fetchCategoriesWithCount(companyId: number) {
  const { data: categories, error } = await supabase
    .from('categories')
    .select('id, category_name, category_code')
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('category_name', { ascending: true })

  if (error) {
    console.error('Error fetching categories:', error)
    throw error
  }

  const { data: productCounts } = await supabase
    .from('products')
    .select('category_id')
    .eq('is_active', true)
    .is('deleted_at', null)

  const countMap = new Map()
  if (productCounts) {
    productCounts.forEach((p) => {
      countMap.set(p.category_id, (countMap.get(p.category_id) || 0) + 1)
    })
  }

  return categories.map((cat) => ({
    ...cat,
    product_count: countMap.get(cat.id) || 0,
  }))
}

/**
 * Fetch customers WITH credit information
 */
export async function fetchCustomers(companyId: number) {
  const { data, error } = await supabase
    .from('customers')
    .select(
      `
      id,
      customer_type,
      first_name,
      last_name,
      business_name,
      contact_person,
      phone,
      email,
      address,
      credit_limit,
      current_credit_balance,
      available_credit,
      credit_days,
      credit_status
    `,
    )
    .eq('company_id', companyId)
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('first_name', { ascending: true })

  if (error) {
    console.error('Error fetching customers:', error)
    throw error
  }

  return data
}

/**
 * Find available batches by product (FEFO - First Expiry First Out)
 */
export async function findAvailableBatchesByProduct(
  companyId: number,
  storeId: number,
  productId: number,
) {
  const { data, error } = await supabase
    .from('product_batches')
    .select(
      `
      *,
      product:products(
        id,
        product_name,
        product_code,
        generic_name,
        barcode,
        standard_price,
        unit:units(id, name, short_code)
      )
    `,
    )
    .eq('store_id', storeId)
    .eq('product_id', productId)
    .eq('is_active', true)
    .eq('is_expired', false)
    .gt('quantity_available', 0)
    .is('deleted_at', null)
    .order('expiry_date', { ascending: true })

  if (error) {
    console.error('Error finding batches:', error)
    throw error
  }

  return data
}

/**
 * Find batch by barcode
 */
export async function findBatchByBarcode(
  companyId: number,
  storeId: number,
  barcode: string,
) {
  // First try to find product by barcode
  const { data: product, error: productError } = await supabase
    .from('products')
    .select('id')
    .eq('barcode', barcode)
    .eq('is_active', true)
    .is('deleted_at', null)
    .single()

  if (productError && productError.code !== 'PGRST116') {
    console.error('Error finding product by barcode:', productError)
    throw productError
  }

  if (product) {
    const batches = await findAvailableBatchesByProduct(
      companyId,
      storeId,
      product.id,
    )
    return batches.length > 0 ? batches[0] : null
  }

  // Try to find batch by batch number
  const { data: batch, error: batchError } = await supabase
    .from('product_batches')
    .select(
      `
      *,
      product:products(
        id,
        product_name,
        product_code,
        generic_name,
        barcode,
        standard_price,
        unit:units(id, name, short_code)
      )
    `,
    )
    .eq('store_id', storeId)
    .ilike('batch_number', barcode)
    .eq('is_active', true)
    .eq('is_expired', false)
    .is('deleted_at', null)
    .single()

  if (batchError && batchError.code !== 'PGRST116') {
    console.error('Error finding batch:', batchError)
    throw batchError
  }

  return batch
}

/**
 * Validate stock availability
 */
export async function validateStockAvailability(
  companyId: number,
  storeId: number,
  items: Array<{
    product_id: number
    batch_id: number
    quantity: number
  }>,
) {
  const validations = []

  for (const item of items) {
    const { data: batch, error } = await supabase
      .from('product_batches')
      .select(
        `
        id,
        batch_number,
        quantity_available,
        expiry_date,
        is_expired,
        product:products(product_name)
      `,
      )
      .eq('id', item.batch_id)
      .single()

    if (error || !batch) {
      validations.push({
        product_id: item.product_id,
        batch_id: item.batch_id,
        is_valid: false,
        message: 'Batch not found',
      })
      continue
    }

    // Check expiry
    if (batch.is_expired) {
      validations.push({
        product_id: item.product_id,
        batch_id: item.batch_id,
        batch_number: batch.batch_number,
        product_name: batch.product?.[0]?.product_name,
        is_valid: false,
        message: 'Batch has expired',
      })
      continue
    }

    const hasStock = batch.quantity_available >= item.quantity

    validations.push({
      product_id: item.product_id,
      batch_id: item.batch_id,
      batch_number: batch.batch_number,
      product_name: batch.product?.[0]?.product_name,
      requested: item.quantity,
      available: batch.quantity_available,
      shortfall: Math.max(0, item.quantity - batch.quantity_available),
      is_valid: hasStock,
      message: hasStock
        ? 'Stock available'
        : `Insufficient stock. Short by ${item.quantity - batch.quantity_available} units`,
    })
  }

  return {
    all_valid: validations.every((v) => v.is_valid),
    validations,
  }
}

/**
/**
 * Save current POS order as a draft sale in the DB.
 * Does NOT deduct inventory — draft sales are stored as-is until completed.
 */
export async function createDraftSale(request: {
  company_id: number
  store_id: number
  sale_type: string
  subtotal: number
  discount_amount: number
  tax_amount: number
  total_amount: number
  payment_method?: string
  customer_id?: number | null
  notes?: string | null
  processed_by?: number | null
  sale_date?: string | null
  existing_draft_id?: number | null
  items: Array<{
    product_id: number
    batch_id: number
    batch_number: string
    quantity: number
    unit_price: number
    cost_price: number
    discount_amount: number
    tax_amount?: number
    tax_rate?: number
  }>
}): Promise<{ sale_number: string; sale_id: number }> {
  const { data, error } = await supabase.rpc('fn_create_draft_sale', {
    p_company_id: request.company_id,
    p_store_id: request.store_id,
    p_sale_type: request.sale_type,
    p_subtotal: request.subtotal,
    p_discount_amount: request.discount_amount,
    p_tax_amount: request.tax_amount,
    p_total_amount: request.total_amount,
    p_payment_method: request.payment_method || 'cash',
    p_customer_id: request.customer_id || null,
    p_notes: request.notes || null,
    p_processed_by: request.processed_by || null,
    p_sale_date: request.sale_date || null,
    p_existing_draft_id: request.existing_draft_id || null,
    p_items: request.items,
  })

  if (error) throw new Error(`Database error: ${error.message}`)
  if (data && !data.success)
    throw new Error(data.message || 'Failed to save draft')

  return { sale_number: data.sale_number, sale_id: data.sale_id }
}

/**
 * Create sale with items using RPC function
 * UPDATED: Uses fn_create_sale_with_items from documentation
 */
export async function createSaleWithItems(request: {
  company_id: number
  store_id: number
  sale_type: string
  customer_id?: number
  prescription_id?: number
  sale_date?: string // ✅ NEW: pass the cashier-selected date
  subtotal: number
  discount_amount: number
  tax_amount: number
  total_amount: number
  amount_paid: number
  payment_method: string
  payment_status: string
  notes?: string
  processed_by?: number
  items: Array<{
    product_id: number
    batch_id: number
    batch_number: string
    quantity: number
    unit_price: number
    cost_price: number
    discount_amount: number
    tax_amount?: number
    tax_rate?: number
  }>
}) {
  console.log('🚀 Creating sale with RPC function')
  console.log('📋 Request data:', {
    sale_type: request.sale_type,
    items_count: request.items.length,
    total_amount: request.total_amount,
    payment_method: request.payment_method,
    sale_date: request.sale_date,
  })

  const { data, error } = await supabase.rpc('fn_create_sale_with_items', {
    p_company_id: request.company_id,
    p_store_id: request.store_id,
    p_sale_type: request.sale_type,
    p_subtotal: request.subtotal,
    p_discount_amount: request.discount_amount,
    p_tax_amount: request.tax_amount,
    p_total_amount: request.total_amount,
    p_amount_paid: request.amount_paid,
    p_payment_method: request.payment_method,
    p_customer_id: request.customer_id || null,
    p_prescription_id: request.prescription_id || null,
    p_notes: request.notes || null,
    p_processed_by: request.processed_by || null,
    p_sale_date: request.sale_date || null, // ✅ NEW
    p_items: request.items.map((item) => ({
      product_id: item.product_id,
      batch_id: item.batch_id,
      batch_number: item.batch_number,
      quantity: item.quantity,
      unit_price: item.unit_price,
      cost_price: item.cost_price,
      discount_amount: item.discount_amount || 0,
      tax_amount: item.tax_amount || 0,
      tax_rate: item.tax_rate || 0,
    })),
  })

  if (error) {
    console.error('❌ Supabase RPC error:', error)
    throw new Error(`Database error: ${error.message}`)
  }

  // Check if the function returned an error response
  if (data && typeof data === 'object' && 'success' in data && !data.success) {
    console.error('❌ Sale creation failed:', data)
    const errorMessage = data.message || 'Failed to create sale'
    throw new Error(errorMessage)
  }

  console.log('✅ Sale created successfully:', data)

  return {
    sale: data.sale,
    items: data.items,
    saleNumber: data.sale_number,
  }
}

/**
 * Update existing sale with items using RPC function
 * UPDATED: Uses fn_update_sale_with_items from documentation
 */
export async function updateSaleWithItems(request: {
  sale_id: number
  company_id: number
  store_id: number
  sale_type: string
  customer_id?: number
  prescription_id?: number
  subtotal: number
  discount_amount: number
  tax_amount: number
  total_amount: number
  amount_paid: number
  payment_method: string
  payment_status: string
  notes?: string
  processed_by?: number
  items: Array<{
    product_id: number
    batch_id: number
    batch_number: string
    quantity: number
    unit_price: number
    cost_price: number
    discount_amount: number
    tax_amount?: number
    tax_rate?: number
  }>
}) {
  console.log('🔄 Updating sale with RPC function')
  console.log('📋 Request data:', {
    sale_id: request.sale_id,
    sale_type: request.sale_type,
    items_count: request.items.length,
    total_amount: request.total_amount,
    payment_method: request.payment_method,
  })

  try {
    const { data, error } = await supabase.rpc('fn_update_sale_with_items', {
      p_sale_id: request.sale_id,
      p_company_id: request.company_id,
      p_store_id: request.store_id,
      p_sale_type: request.sale_type, // Pass as-is, let DB function handle casting
      p_subtotal: request.subtotal,
      p_discount_amount: request.discount_amount,
      p_tax_amount: request.tax_amount,
      p_total_amount: request.total_amount,
      p_amount_paid: request.amount_paid,
      p_payment_method: request.payment_method,
      p_customer_id: request.customer_id || null,
      p_prescription_id: request.prescription_id || null,
      p_notes: request.notes || null,
      p_processed_by: request.processed_by || null,
      p_items: request.items.map((item) => ({
        product_id: item.product_id,
        batch_id: item.batch_id,
        batch_number: item.batch_number,
        quantity: item.quantity,
        unit_price: item.unit_price,
        cost_price: item.cost_price,
        discount_amount: item.discount_amount || 0,
        tax_amount: item.tax_amount || 0,
        tax_rate: item.tax_rate || 0,
      })),
    })

    if (error) {
      console.error('❌ Supabase RPC error:', error)
      throw new Error(`Database error: ${error.message}`)
    }

    // Check if the function returned an error response
    if (
      data &&
      typeof data === 'object' &&
      'success' in data &&
      !data.success
    ) {
      console.error('❌ Sale update failed:', data)
      const errorMessage = data.message || 'Failed to update sale'
      throw new Error(errorMessage)
    }

    console.log('✅ Sale updated successfully:', data)

    return {
      sale: data.sale,
      items: data.items,
      saleNumber: data.sale_number,
    }
  } catch (error) {
    console.error('❌ Error in updateSaleWithItems:', error)
    throw error
  }
}

