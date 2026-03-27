import { supabase } from '@app/core/supabase/Supabase.utils'

// ✅ Type for RPC function response
interface InsertPOResponse {
  id: number
  po_number: string
  status: string
  company_id: number
  store_id: number
  supplier_id: number | null
  created_at: string
  updated_at: string
}

// ============================================================
// Invoice metadata (shared with purchaseOrderHistory.Queries)
// ============================================================
interface InvoiceMeta {
  invoiceNumber?: string
  invoiceDate?: string // ISO string — defaults to now if omitted
  deliveryNotes?: string
}

/**
 * Generate unique PO number with retry logic
 */
async function generateUniquePONumber(
  companyId: number,
  settings: {
    prefix: string
    padding: number
    autoIncrement: boolean
  },
  maxRetries: number = 5,
): Promise<string> {
  const { prefix, padding, autoIncrement } = settings

  if (!autoIncrement) {
    const timestamp = Date.now().toString().slice(-padding)
    return `${prefix}${timestamp.padStart(padding, '0')}`
  }

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const { data: lastPO, error } = await supabase
      .from('purchase_orders')
      .select('po_number')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(1)

    if (error) {
      console.error('Error fetching last PO:', error)
      throw error
    }

    let nextNum = 1
    if (lastPO && lastPO.length > 0) {
      const regex = new RegExp(
        `${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\d+)`,
      )
      const match = lastPO[0].po_number.match(regex)
      nextNum = match ? parseInt(match[1]) + 1 : 1
    }

    if (attempt > 0) {
      nextNum += Math.floor(Math.random() * 100) + attempt * 10
    }

    const poNumber = `${prefix}${String(nextNum).padStart(padding, '0')}`

    const { data: existing, error: checkError } = await supabase
      .from('purchase_orders')
      .select('id')
      .eq('company_id', companyId)
      .eq('po_number', poNumber)
      .maybeSingle()

    if (!checkError && !existing) {
      return poNumber
    }

    console.log(`PO number ${poNumber} exists, retrying...`)
  }

  const timestamp = Date.now().toString().slice(-padding)
  return `${prefix}${timestamp.padStart(padding, '0')}`
}

function validateStatusTransition(
  currentStatus: string | null,
  newStatus: string,
): { valid: boolean; error?: string } {
  if (!currentStatus) {
    return { valid: true }
  }

  const validTransitions: Record<string, string[]> = {
    draft: ['draft', 'pending', 'approved', 'received', 'cancelled'],
    pending: ['pending', 'approved', 'rejected', 'cancelled'],
    approved: ['approved', 'received', 'cancelled'],
    received: ['received'],
    rejected: ['rejected'],
    cancelled: ['cancelled'],
  }

  const allowed = validTransitions[currentStatus] || []

  if (!allowed.includes(newStatus)) {
    return {
      valid: false,
      error: `Cannot change status from '${currentStatus}' to '${newStatus}'`,
    }
  }

  return { valid: true }
}

/**
 * Check supplier credit limit
 */
async function validateSupplierCredit(
  supplierId: number,
  orderAmount: number,
  skipForDraft: boolean = false,
): Promise<{ valid: boolean; error?: string; details?: any }> {
  if (skipForDraft) {
    return { valid: true }
  }

  const { data: supplier, error } = await supabase
    .from('suppliers')
    .select(
      'supplier_name, credit_limit, current_balance, available_credit, credit_status',
    )
    .eq('id', supplierId)
    .single()

  if (error || !supplier) {
    return {
      valid: false,
      error: 'Supplier not found or error fetching supplier data',
    }
  }

  if (supplier.credit_status !== 'active') {
    return {
      valid: false,
      error: `Supplier credit is ${supplier.credit_status}. Cannot create purchase order.`,
    }
  }

  const availableCredit =
    supplier.available_credit ||
    supplier.credit_limit - supplier.current_balance

  if (availableCredit < orderAmount) {
    return {
      valid: false,
      error: `Insufficient supplier credit. Available: ${availableCredit.toLocaleString()}, Required: ${orderAmount.toLocaleString()}`,
      details: {
        supplier_name: supplier.supplier_name,
        credit_limit: supplier.credit_limit,
        current_balance: supplier.current_balance,
        available_credit: availableCredit,
        required: orderAmount,
        shortage: orderAmount - availableCredit,
      },
    }
  }

  return {
    valid: true,
    details: {
      supplier_name: supplier.supplier_name,
      available_credit: availableCredit,
      after_order: availableCredit - orderAmount,
    },
  }
}

/**
 * Verify supplier balance using view
 */
export async function verifySupplierBalance(supplierId: number) {
  const { data: balance, error } = await supabase
    .from('vw_supplier_balances')
    .select('*')
    .eq('id', supplierId)
    .single()

  if (error) {
    console.error('Error fetching supplier balance view:', error)
    return null
  }

  if (balance) {
    const mismatch =
      Math.abs(balance.stored_balance - balance.calculated_balance) > 0.01

    return {
      supplier_name: balance.supplier_name,
      stored_balance: balance.stored_balance,
      calculated_balance: balance.calculated_balance,
      available_credit: balance.available_credit,
      total_purchases: balance.total_purchases,
      total_paid: balance.total_paid,
      open_pos_count: balance.open_pos_count,
      has_mismatch: mismatch,
      difference: balance.stored_balance - balance.calculated_balance,
    }
  }

  return null
}

/**
 * Fetch categories
 */
export async function fetchCategoriesWithCount(
  companyId: number,
  storeId?: number,
) {
  console.log('📁 Fetching categories for company:', companyId)

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

  console.log(`✅ Fetched ${categories?.length || 0} categories`)

  return (categories || []).map((cat) => ({
    ...cat,
    product_count: 0,
  }))
}

/**
 * Fetch company settings
 */
export async function fetchCompanySettings(companyId: number) {
  const { data, error } = await supabase
    .from('company_settings')
    .select('*')
    .eq('company_id', companyId)
    .single()

  if (error) {
    console.error('Error fetching company settings:', error)
    throw error
  }

  return data
}

/**
 * Calculate selling price from cost price with margin
 */
function calculateSellingPrice(
  unitCost: number,
  profitMarginPercentage: number = 40,
): number {
  return unitCost * (1 + profitMarginPercentage / 100)
}

/**
 * Get product's standard selling price if available
 */
async function getProductSellingPrice(
  productId: number,
  unitCost: number,
): Promise<number> {
  const { data: product } = await supabase
    .from('products')
    .select('standard_price')
    .eq('id', productId)
    .single()

  if (product?.standard_price && product.standard_price > 0) {
    return product.standard_price
  }

  return calculateSellingPrice(unitCost)
}

export async function fetchUnits(companyId: number) {
  const { data, error } = await supabase
    .from('units')
    .select('id, name, short_code')
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('name', { ascending: true })

  if (error) {
    console.error('Error fetching units:', error)
    throw error
  }

  return data || []
}

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
    pageSize = 50,
    searchQuery = '',
    categoryId = null,
  } = options

  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = supabase
    .from('products')
    .select(
      `
      id, product_name, product_code, generic_name, barcode,
      category_id, unit_id, standard_price, standard_cost,
      reorder_level, image_url,
      category:categories(id, category_name),
      unit:units(id, name, short_code)
    `,
      { count: 'exact' },
    )
    .eq('is_active', true)
    .is('deleted_at', null)

  if (searchQuery.trim()) {
    const searchTerm = searchQuery.trim().toLowerCase()
    query = query.or(
      `product_name.ilike.%${searchTerm}%,` +
        `product_code.ilike.%${searchTerm}%,` +
        `barcode.ilike.%${searchTerm}%,` +
        `generic_name.ilike.%${searchTerm}%`,
    )
  }

  if (categoryId !== null) {
    query = query.eq('category_id', categoryId)
  }

  const {
    data: products,
    error: productsError,
    count,
  } = await query.order('product_name', { ascending: true }).range(from, to)

  if (productsError) {
    console.error('Error fetching products:', productsError)
    throw productsError
  }

  if (!products || products.length === 0) {
    return { products: [], totalCount: count || 0, hasMore: false }
  }

  const productIds = products.map((p) => p.id)

  const { data: inventory, error: inventoryError } = await supabase
    .from('product_batches')
    .select(
      'product_id, quantity_available, expiry_date, is_expired, batch_number, unit_cost',
    )
    .eq('store_id', storeId)
    .in('product_id', productIds)
    .eq('is_active', true)
    .is('deleted_at', null)

  if (inventoryError) {
    console.error('Error fetching inventory:', inventoryError)
  }

  const inventoryMap = new Map()
  const today = new Date()
  const thirtyDaysFromNow = new Date(today)
  thirtyDaysFromNow.setDate(today.getDate() + 30)

  if (inventory) {
    inventory.forEach((batch) => {
      const current = inventoryMap.get(batch.product_id) || {
        total_quantity: 0,
        available_quantity: 0,
        expiring_soon_count: 0,
        total_batches: 0,
        total_value: 0,
        average_cost: 0,
      }

      current.total_quantity += batch.quantity_available
      current.available_quantity += batch.quantity_available
      current.total_batches += 1
      current.total_value += batch.quantity_available * (batch.unit_cost || 0)

      if (batch.expiry_date && !batch.is_expired) {
        const expiryDate = new Date(batch.expiry_date)
        if (expiryDate <= thirtyDaysFromNow) {
          current.expiring_soon_count += 1
        }
      }

      inventoryMap.set(batch.product_id, current)
    })

    inventoryMap.forEach((inv, productId) => {
      if (inv.total_quantity > 0) {
        inv.average_cost = inv.total_value / inv.total_quantity
      }
    })
  }

  const productsWithInventory = products.map((product) => {
    const inv = inventoryMap.get(product.id) || {
      total_quantity: 0,
      available_quantity: 0,
      expiring_soon_count: 0,
      total_batches: 0,
      total_value: 0,
      average_cost: 0,
    }

    let stock_status = 'IN_STOCK'
    if (inv.total_quantity === 0) {
      stock_status = 'OUT_OF_STOCK'
    } else if (inv.total_quantity <= (product.reorder_level || 0)) {
      stock_status = 'LOW_STOCK'
    }

    return { ...product, ...inv, stock_status }
  })

  return {
    products: productsWithInventory,
    totalCount: count || 0,
    hasMore: to < (count || 0) - 1,
  }
}

export async function fetchSuppliers(companyId: number) {
  const { data, error } = await supabase
    .from('suppliers')
    .select('id, supplier_name, supplier_code, phone, email')
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('supplier_name', { ascending: true })

  if (error) {
    console.error('Error fetching suppliers:', error)
    throw error
  }

  return data || []
}

export async function findBatchByNumber(
  companyId: number,
  batchNumber: string,
) {
  const { data, error } = await supabase
    .from('product_batches')
    .select(
      `
      *, product:products(
        id, product_name, product_code, generic_name, barcode, standard_price,
        unit:units(id, name, short_code)
      )
    `,
    )
    .ilike('batch_number', batchNumber)
    .eq('is_active', true)
    .is('deleted_at', null)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    console.error('Error finding batch:', error)
    throw error
  }

  return data
}

export async function findProductByBarcode(companyId: number, barcode: string) {
  const { data, error } = await supabase
    .from('products')
    .select(
      `
      id, product_name, product_code, generic_name, barcode, standard_price,
      unit:units(id, name, short_code)
    `,
    )
    .eq('barcode', barcode)
    .eq('is_active', true)
    .is('deleted_at', null)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    console.error('Error finding product by barcode:', error)
    throw error
  }

  return data
}

export async function fetchStoreWithId(storeId: Number | null) {
  const { data, error } = await supabase
    .from('stores')
    .select('*')
    .eq('id', storeId)
    .single()

  if (error) {
    console.error('Error fetching store:', error)
    return null
  }

  return data
}

/**
 * ✅ UPDATED: Receive all goods from PO (used in PurchasePOP "receive immediately" flow)
 * Accepts optional invoiceMeta to persist invoice_number / invoice_date / delivery_notes.
 * Invoice fields are written in a separate, non-fatal update so a missing DB column
 * never blocks the receipt operation.
 */
export const receiveAllGoodsFromPO = async (
  purchaseOrderId: number,
  companyId: number,
  receivedBy?: number,
  invoiceMeta?: InvoiceMeta,
): Promise<{ success: boolean; error?: any }> => {
  try {
    const { data: currentPO, error: fetchError } = await supabase
      .from('purchase_orders')
      .select('status, store_id, po_date')
      .eq('id', purchaseOrderId)
      .single()

    if (fetchError) throw fetchError

    if (currentPO.status !== 'approved') {
      throw new Error(
        `Cannot receive goods from purchase order with status: ${currentPO.status}. Only 'approved' orders can be received.`,
      )
    }

    const { data: poItems, error: itemsError } = await supabase
      .from('purchase_order_items')
      .select('*')
      .eq('purchase_order_id', purchaseOrderId)

    if (itemsError) throw itemsError

    if (!poItems || poItems.length === 0) {
      throw new Error('No items found in purchase order')
    }

    // Update each item as fully received
    for (const item of poItems) {
      const { error: itemError } = await supabase
        .from('purchase_order_items')
        .update({
          quantity_received: item.quantity_ordered,
          updated_at: new Date().toISOString(),
        })
        .eq('id', item.id)

      if (itemError) throw itemError

      // Update batch quantities
      const { error: batchError } = await supabase
        .from('product_batches')
        .update({
          quantity_received: item.quantity_ordered,
          quantity_available: item.quantity_ordered,
          updated_at: new Date().toISOString(),
        })
        .eq('product_id', item.product_id)
        .eq('store_id', currentPO.store_id)
        .eq('batch_number', item.batch_number)
        .eq('purchase_order_id', purchaseOrderId)

      if (batchError) throw batchError
    }

    // Step 1 — core status update (always safe)
    const { error: poError } = await supabase
      .from('purchase_orders')
      .update({
        status: 'received',
        received_by: receivedBy,
        received_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', purchaseOrderId)

    if (poError) throw poError

    // Step 2 — invoice metadata (non-fatal if columns don't exist yet)
    if (invoiceMeta?.invoiceNumber) {
      const invoicePayload: Record<string, any> = {
        invoice_number: invoiceMeta.invoiceNumber,
        invoice_date: invoiceMeta.invoiceDate ?? new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      if (invoiceMeta.deliveryNotes) {
        invoicePayload.delivery_notes = invoiceMeta.deliveryNotes
      }

      const { error: invoiceError } = await supabase
        .from('purchase_orders')
        .update(invoicePayload)
        .eq('id', purchaseOrderId)

      if (invoiceError) {
        console.warn(
          '⚠️ [receiveAllGoodsFromPO] Could not save invoice metadata.\n' +
            'Run migration: ALTER TABLE purchase_orders\n' +
            '  ADD COLUMN IF NOT EXISTS invoice_number TEXT,\n' +
            '  ADD COLUMN IF NOT EXISTS invoice_date TIMESTAMPTZ,\n' +
            '  ADD COLUMN IF NOT EXISTS delivery_notes TEXT;\n' +
            'Error:',
          invoiceError.message,
        )
      } else {
        console.log('✅ Invoice metadata saved:', invoiceMeta.invoiceNumber)
      }
    }

    console.log('✅ All goods received successfully for PO:', purchaseOrderId)
    return { success: true }
  } catch (error: any) {
    console.error('❌ Error receiving all goods:', error)
    return { success: false, error }
  }
}

export async function receiveGoodsFromPO(
  purchaseOrderId: number,
  companyId: number,
  receivedItems: Array<{
    purchase_order_item_id: number
    product_id: number
    batch_number: string
    quantity_received: number
  }>,
  receivedBy?: number | null,
) {
  const now = new Date().toISOString()

  const updateData: any = {
    received_at: now,
    updated_at: now,
  }

  if (receivedBy) {
    updateData.received_by = receivedBy
  }

  const { error: poError } = await supabase
    .from('purchase_orders')
    .update(updateData)
    .eq('id', purchaseOrderId)

  if (poError) {
    console.error('❌ Error updating PO workflow:', poError)
    throw new Error(`Failed to update PO workflow: ${poError.message}`)
  }

  const { error: statusError } = await supabase.rpc('set_po_status', {
    p_po_id: purchaseOrderId,
    p_status: 'received',
  })

  if (statusError) {
    console.error('❌ Error updating status to received:', statusError)
    throw new Error(`Failed to update status: ${statusError.message}`)
  }

  console.log('✅ PO status updated to received')

  const { data: po } = await supabase
    .from('purchase_orders')
    .select('store_id')
    .eq('id', purchaseOrderId)
    .single()

  if (!po) {
    throw new Error('Purchase order not found')
  }

  for (const item of receivedItems) {
    const { error: itemError } = await supabase
      .from('purchase_order_items')
      .update({
        quantity_received: item.quantity_received,
        updated_at: now,
      })
      .eq('id', item.purchase_order_item_id)

    if (itemError) {
      console.error('❌ Error updating PO item:', itemError)
      throw new Error(`Failed to update PO item: ${itemError.message}`)
    }

    const { data: currentBatch } = await supabase
      .from('product_batches')
      .select('quantity_received, quantity_available, unit_cost, selling_price')
      .eq('product_id', item.product_id)
      .eq('store_id', po.store_id)
      .eq('batch_number', item.batch_number)
      .eq('purchase_order_id', purchaseOrderId)
      .single()

    if (currentBatch) {
      const newQuantityReceived =
        currentBatch.quantity_received + item.quantity_received
      const newQuantityAvailable =
        currentBatch.quantity_available + item.quantity_received

      let batchUpdateData: any = {
        quantity_received: newQuantityReceived,
        quantity_available: newQuantityAvailable,
        updated_at: now,
      }

      if (!currentBatch.selling_price || currentBatch.selling_price === 0) {
        const sellingPrice = await getProductSellingPrice(
          item.product_id,
          currentBatch.unit_cost,
        )
        batchUpdateData.selling_price = sellingPrice
      }

      const { error: batchError } = await supabase
        .from('product_batches')
        .update(batchUpdateData)
        .eq('product_id', item.product_id)
        .eq('store_id', po.store_id)
        .eq('batch_number', item.batch_number)
        .eq('purchase_order_id', purchaseOrderId)

      if (batchError) {
        console.error('❌ Error updating batch stock:', batchError)
        throw new Error(`Failed to update batch: ${batchError.message}`)
      }
    }
  }

  console.log('✅ All goods received successfully')
  return { success: true }
}

/**
 * ✅ FIXED: createPurchaseOrderWithBatches
 *  - `purchaseOrder` is now declared with `let` so the retry block can
 *    reassign it directly (Object.assign on null was a no-op bug).
 *  - invoiceMeta is forwarded to both the insert and the receive step.
 */
export const createPurchaseOrderWithBatches = async (request: {
  company_id: number
  store_id: number
  supplier_id: number | null
  po_date: string
  subtotal: number
  tax_amount: number
  discount_amount: number
  total_amount: number
  payment_terms: string
  payment_method?: string
  notes: string
  created_by: number | null
  status?: string
  receiveImmediately?: boolean
  isAdmin?: boolean
  invoiceMeta?: InvoiceMeta
  items: Array<{
    product_id: number
    batch_number: string
    quantity_ordered: number
    unit_cost: number
    selling_price?: number
    discount_amount: number
    manufacture_date: string | null
    expiry_date: string | null
  }>
  companySettings?: {
    po_prefix: string
    document_number_padding: number
    auto_increment_documents: boolean
    require_purchase_approval: boolean
    default_credit_days: number
  }
}) => {
  try {
    const requiresApproval =
      request.companySettings?.require_purchase_approval === true
    const receiveImmediately = request.receiveImmediately === true
    const isAdmin = request.isAdmin === true

    type POStatus = 'draft' | 'pending' | 'approved' | 'received'

    const initialCreateStatus: POStatus = 'draft' as POStatus
    const finalStatus: POStatus = (
      receiveImmediately && isAdmin
        ? 'received'
        : requiresApproval
          ? 'pending'
          : 'approved'
    ) as POStatus

    // Generate PO number
    let poNumber = ''
    if (request.companySettings?.auto_increment_documents) {
      const { data: lastPO } = await supabase
        .from('purchase_orders')
        .select('po_number')
        .eq('company_id', request.company_id)
        .like('po_number', `${request.companySettings.po_prefix}%`)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (lastPO?.po_number) {
        const lastNumber = parseInt(
          lastPO.po_number.replace(request.companySettings.po_prefix, ''),
        )
        const nextNumber = lastNumber + 1
        poNumber = `${request.companySettings.po_prefix}${nextNumber.toString().padStart(request.companySettings.document_number_padding, '0')}`
      } else {
        poNumber = `${request.companySettings.po_prefix}${'1'.padStart(request.companySettings.document_number_padding, '0')}`
      }
    } else {
      poNumber = `PO-${Date.now()}`
    }

    // Build insert object
    const poInsertData: Record<string, any> = {
      company_id: request.company_id,
      store_id: request.store_id,
      supplier_id: request.supplier_id,
      po_number: poNumber,
      po_date: request.po_date,
      subtotal: request.subtotal,
      tax_amount: request.tax_amount,
      discount_amount: request.discount_amount,
      total_amount: request.total_amount,
      payment_terms: request.payment_terms,
      payment_method: request.payment_method ?? 'cash', // ✅ persist payment method
      notes: request.notes,
      status: initialCreateStatus,
      created_by: request.created_by,
      created_at: new Date().toISOString(),
    }

    // Attach invoice fields at insert time when receiving immediately
    if (receiveImmediately && isAdmin && request.invoiceMeta?.invoiceNumber) {
      poInsertData.invoice_number = request.invoiceMeta.invoiceNumber
      poInsertData.invoice_date =
        request.invoiceMeta.invoiceDate ?? new Date().toISOString()
      if (request.invoiceMeta.deliveryNotes) {
        poInsertData.delivery_notes = request.invoiceMeta.deliveryNotes
      }
    }

    console.log('📝 Inserting PO with data:', poInsertData)

    // ── FIXED: use `let` so we can reassign in the retry block ───────────
    let { data: purchaseOrder, error: poError } = await supabase
      .from('purchase_orders')
      .insert(poInsertData)
      .select()
      .single()
    // ─────────────────────────────────────────────────────────────────────

    if (poError) {
      // If the error is a missing column, retry without invoice fields
      if (
        poError.code === 'PGRST204' ||
        poError.message?.includes('invoice_number') ||
        poError.message?.includes('invoice_date') ||
        poError.message?.includes('delivery_notes')
      ) {
        console.warn(
          '⚠️ Invoice columns missing — inserting without them.\n' +
            'Run: ALTER TABLE purchase_orders\n' +
            '  ADD COLUMN IF NOT EXISTS invoice_number TEXT,\n' +
            '  ADD COLUMN IF NOT EXISTS invoice_date TIMESTAMPTZ,\n' +
            '  ADD COLUMN IF NOT EXISTS delivery_notes TEXT;',
        )
        delete poInsertData.invoice_number
        delete poInsertData.invoice_date
        delete poInsertData.delivery_notes

        const { data: retryPO, error: retryError } = await supabase
          .from('purchase_orders')
          .insert(poInsertData)
          .select()
          .single()

        if (retryError) throw retryError
        if (!retryPO) throw new Error('Failed to create purchase order')

        // ── FIXED: direct reassignment (Object.assign on null was a no-op) ─
        purchaseOrder = retryPO
        // ───────────────────────────────────────────────────────────────────

        // Attempt the invoice update separately (non-fatal)
        if (request.invoiceMeta?.invoiceNumber) {
          const { error: invErr } = await supabase
            .from('purchase_orders')
            .update({
              invoice_number: request.invoiceMeta.invoiceNumber,
              invoice_date:
                request.invoiceMeta.invoiceDate ?? new Date().toISOString(),
            })
            .eq('id', retryPO.id)

          if (invErr) {
            console.warn(
              '⚠️ Could not save invoice metadata after retry:',
              invErr.message,
            )
          } else {
            console.log(
              '✅ Invoice metadata saved after retry:',
              request.invoiceMeta.invoiceNumber,
            )
          }
        }
      } else {
        console.error('❌ Error inserting PO:', poError)
        throw poError
      }
    }

    if (!purchaseOrder) {
      throw new Error('Failed to create purchase order - no data returned')
    }

    console.log('✅ PO created successfully:', purchaseOrder.po_number)

    // Get product unit IDs
    const productIds = request.items.map((item) => item.product_id)
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, unit_id')
      .in('id', productIds)

    if (productsError) throw productsError

    const productUnitMap = new Map(
      products?.map((p) => [p.id, p.unit_id]) || [],
    )

    // Create PO items
    const poItems = request.items.map((item) => {
      const lineTotal = item.quantity_ordered * item.unit_cost
      const quantityReceived =
        receiveImmediately && isAdmin && finalStatus === 'received'
          ? item.quantity_ordered
          : 0

      return {
        purchase_order_id: purchaseOrder!.id,
        product_id: item.product_id,
        unit_id: productUnitMap.get(item.product_id),
        batch_number: item.batch_number,
        quantity_ordered: item.quantity_ordered,
        quantity_received: quantityReceived,
        unit_cost: item.unit_cost,
        discount_amount: item.discount_amount,
        total_cost: lineTotal,
        manufacture_date: item.manufacture_date,
        expiry_date: item.expiry_date,
      }
    })

    const { error: itemsError } = await supabase
      .from('purchase_order_items')
      .insert(poItems)

    if (itemsError) throw itemsError

    console.log('✅ PO items created')

    // Handle batches - check for duplicates
    const batchesToCreate = []

    for (const item of request.items) {
      const { data: existingBatch, error: checkError } = await supabase
        .from('product_batches')
        .select('id, quantity_received, quantity_available')
        .eq('company_id', request.company_id)
        .eq('store_id', request.store_id)
        .eq('product_id', item.product_id)
        .eq('batch_number', item.batch_number)
        .maybeSingle()

      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError
      }

      if (existingBatch) {
        const updateData: any = {
          purchase_order_id: purchaseOrder!.id,
          unit_cost: item.unit_cost,
          selling_price: item.selling_price || item.unit_cost * 1.3,
          manufacturing_date: item.manufacture_date,
          expiry_date: item.expiry_date,
          updated_at: new Date().toISOString(),
        }

        if (receiveImmediately && isAdmin && finalStatus === 'received') {
          updateData.quantity_received =
            existingBatch.quantity_received + item.quantity_ordered
          updateData.quantity_available =
            existingBatch.quantity_available + item.quantity_ordered
        }

        const { error: updateError } = await supabase
          .from('product_batches')
          .update(updateData)
          .eq('id', existingBatch.id)

        if (updateError) throw updateError
      } else {
        const batchQuantities =
          receiveImmediately && isAdmin && finalStatus === 'received'
            ? {
                quantity_received: item.quantity_ordered,
                quantity_available: item.quantity_ordered,
              }
            : {
                quantity_received: 0,
                quantity_available: 0,
              }

        batchesToCreate.push({
          company_id: request.company_id,
          store_id: request.store_id,
          product_id: item.product_id,
          batch_number: item.batch_number,
          purchase_order_id: purchaseOrder!.id,
          ...batchQuantities,
          unit_cost: item.unit_cost,
          selling_price: item.selling_price || item.unit_cost * 1.3,
          manufacturing_date: item.manufacture_date,
          expiry_date: item.expiry_date,
          created_at: new Date().toISOString(),
        })
      }
    }

    if (batchesToCreate.length > 0) {
      const { error: batchesError } = await supabase
        .from('product_batches')
        .insert(batchesToCreate)

      if (batchesError) throw batchesError
    }

    // Update status if needed
    if (finalStatus !== initialCreateStatus) {
      console.log(
        `🔄 Updating status from '${initialCreateStatus}' to '${finalStatus}'`,
      )

      const statusUpdateData: any = {
        updated_at: new Date().toISOString(),
      }

      if (finalStatus === 'received') {
        statusUpdateData.received_at = new Date().toISOString()
        statusUpdateData.received_by = request.created_by
      }

      const { error: statusError } = await supabase.rpc('set_po_status', {
        p_po_id: purchaseOrder!.id,
        p_status: finalStatus,
      })

      if (statusError) {
        console.error('⚠️ RPC status update failed:', statusError)

        const { error: directError } = await supabase
          .from('purchase_orders')
          .update({
            status: finalStatus,
            ...statusUpdateData,
          })
          .eq('id', purchaseOrder!.id)

        if (directError) {
          throw new Error(`Failed to set final status: ${directError.message}`)
        }
      } else if (finalStatus === 'received' && request.created_by) {
        await supabase
          .from('purchase_orders')
          .update(statusUpdateData)
          .eq('id', purchaseOrder!.id)
      }

      console.log(`✅ Status updated to '${finalStatus}'`)
    }

    console.log('✅ PO created successfully:', {
      poNumber,
      finalStatus,
      id: purchaseOrder!.id,
      invoiceNumber: request.invoiceMeta?.invoiceNumber ?? 'N/A',
    })

    return {
      success: true,
      poNumber,
      status: finalStatus,
      requiresApproval,
      purchaseOrder,
      inventoryUpdated:
        receiveImmediately && isAdmin && finalStatus === 'received',
    }
  } catch (error) {
    console.error('❌ Error creating purchase order:', error)
    throw error
  }
}

