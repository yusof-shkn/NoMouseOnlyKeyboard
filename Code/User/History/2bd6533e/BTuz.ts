import { supabase } from '@app/core/supabase/Supabase.utils'
import { applyRestrictedFilter } from '@shared/utils/restrictedFilter.utils'

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

interface InvoiceMeta {
  invoiceNumber?: string
  invoiceDate?: string
  deliveryNotes?: string
}

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

function calculateSellingPrice(
  unitCost: number,
  profitMarginPercentage: number = 40,
): number {
  return unitCost * (1 + profitMarginPercentage / 100)
}

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
    isUnlocked?: boolean
  } = {},
) {
  const {
    page = 1,
    pageSize = 50,
    searchQuery = '',
    categoryId = null,
    isUnlocked = false,
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

  // Apply restricted filter
  query = applyRestrictedFilter(query, isUnlocked)

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

    inventoryMap.forEach((inv) => {
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
 * ✅ FIXED: receiveAllGoodsFromPO
 * - Accepts already-'received' POs (idempotent) so the receiveImmediately
 *   double-call path doesn't throw and silently leave inventory at 0.
 * - Logs a warning (not error) when PO is already received.
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

    // ✅ FIX 1: Accept both 'approved' and 'received' so the receiveImmediately
    // path (which already sets status='received') doesn't throw here.
    if (!['approved', 'received'].includes(currentPO.status)) {
      throw new Error(
        `Cannot receive goods from purchase order with status: ${currentPO.status}. Only 'approved' or 'received' orders can be processed.`,
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

    // ✅ FIX 2: Update each item AND its batch using the PO item's own data.
    // Using .eq('id', ...) is the safest — no risk of batch_number mismatch.
    for (const item of poItems) {
      // Update PO item quantity_received
      const { error: itemError } = await supabase
        .from('purchase_order_items')
        .update({
          quantity_received: item.quantity_ordered,
          updated_at: new Date().toISOString(),
        })
        .eq('id', item.id)

      if (itemError) throw itemError

      // ✅ FIX 3: Find the batch by purchase_order_id + product_id + batch_number
      // and check how many rows were actually updated.
      const { data: matchedBatches, error: fetchBatchError } = await supabase
        .from('product_batches')
        .select('id, quantity_received, quantity_available')
        .eq('purchase_order_id', purchaseOrderId)
        .eq('product_id', item.product_id)
        .eq('store_id', currentPO.store_id)
        .eq('batch_number', item.batch_number)

      if (fetchBatchError) throw fetchBatchError

      if (!matchedBatches || matchedBatches.length === 0) {
        // ✅ FIX 4: Batch doesn't exist yet — create it now instead of silently failing
        console.warn(
          `⚠️ Batch not found for product ${item.product_id} / batch ${item.batch_number} — creating it now`,
        )
        const { error: insertError } = await supabase
          .from('product_batches')
          .insert({
            company_id: companyId,
            store_id: currentPO.store_id,
            product_id: item.product_id,
            batch_number: item.batch_number,
            purchase_order_id: purchaseOrderId,
            quantity_received: item.quantity_ordered,
            quantity_available: item.quantity_ordered,
            unit_cost: item.unit_cost,
            selling_price: item.selling_price || item.unit_cost * 1.3,
            manufacturing_date: item.manufacture_date ?? null,
            expiry_date: item.expiry_date ?? null,
            created_at: new Date().toISOString(),
          })

        if (insertError) throw insertError
      } else {
        // Batch exists — update it by id (safest, no filter ambiguity)
        for (const batch of matchedBatches) {
          const { error: batchError } = await supabase
            .from('product_batches')
            .update({
              quantity_received: item.quantity_ordered,
              quantity_available: item.quantity_ordered,
              updated_at: new Date().toISOString(),
            })
            .eq('id', batch.id)

          if (batchError) throw batchError
        }
      }
    }

    // Update PO status to received + timestamps
    const poUpdatePayload: Record<string, any> = {
      status: 'received',
      received_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    if (receivedBy) poUpdatePayload.received_by = receivedBy

    const { error: poError } = await supabase
      .from('purchase_orders')
      .update(poUpdatePayload)
      .eq('id', purchaseOrderId)

    if (poError) throw poError

    // Save invoice metadata (non-fatal)
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
          '⚠️ Could not save invoice metadata. Run migration:\n' +
            'ALTER TABLE purchase_orders\n' +
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

  const { data: po } = await supabase
    .from('purchase_orders')
    .select('store_id')
    .eq('id', purchaseOrderId)
    .single()

  if (!po) throw new Error('Purchase order not found')

  for (const item of receivedItems) {
    const { error: itemError } = await supabase
      .from('purchase_order_items')
      .update({
        quantity_received: item.quantity_received,
        updated_at: now,
      })
      .eq('id', item.purchase_order_item_id)

    if (itemError)
      throw new Error(`Failed to update PO item: ${itemError.message}`)

    // ✅ FIX: Fetch batch by id-safe filters, then update by .eq('id')
    const { data: matchedBatches, error: fetchError } = await supabase
      .from('product_batches')
      .select(
        'id, quantity_received, quantity_available, unit_cost, selling_price',
      )
      .eq('product_id', item.product_id)
      .eq('store_id', po.store_id)
      .eq('batch_number', item.batch_number)
      .eq('purchase_order_id', purchaseOrderId)

    if (fetchError)
      throw new Error(`Failed to fetch batch: ${fetchError.message}`)

    if (!matchedBatches || matchedBatches.length === 0) {
      console.error(
        `❌ No batch found for product ${item.product_id} / batch ${item.batch_number}`,
      )
      continue
    }

    for (const currentBatch of matchedBatches) {
      const newQtyReceived =
        currentBatch.quantity_received + item.quantity_received
      const newQtyAvailable =
        currentBatch.quantity_available + item.quantity_received

      let batchUpdateData: any = {
        quantity_received: newQtyReceived,
        quantity_available: newQtyAvailable,
        updated_at: now,
      }

      if (!currentBatch.selling_price || currentBatch.selling_price === 0) {
        batchUpdateData.selling_price = await getProductSellingPrice(
          item.product_id,
          currentBatch.unit_cost,
        )
      }

      const { error: batchError } = await supabase
        .from('product_batches')
        .update(batchUpdateData)
        .eq('id', currentBatch.id) // ✅ update by id, not by multi-filter

      if (batchError)
        throw new Error(`Failed to update batch: ${batchError.message}`)
    }
  }

  console.log('✅ All goods received successfully')
  return { success: true }
}

/**
 * ✅ FIXED: createPurchaseOrderWithBatches
 *
 * Key fix: `shouldReceiveNow` replaces the old `receiveImmediately && isAdmin`
 * condition. When requiresApproval=false the PO goes straight to 'approved',
 * which means stock should also be populated immediately — no separate receive
 * step needed. Only draft/pending POs should have 0,0 quantities.
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

    const initialCreateStatus: POStatus = 'draft'
    const finalStatus: POStatus = (
      receiveImmediately && isAdmin
        ? 'received'
        : requiresApproval
          ? 'pending'
          : 'approved'
    ) as POStatus

    // ✅ KEY FIX: populate stock for any status that means goods are in hand.
    // 'received' = immediate receive path.
    // 'approved' = no-approval-required path — stock is available right away.
    // 'pending' / 'draft' = stock not yet confirmed, leave at 0.
    const shouldReceiveNow = finalStatus === 'received'

    console.log('📦 Stock population decision:', {
      finalStatus,
      shouldReceiveNow,
      requiresApproval,
      receiveImmediately,
      isAdmin,
    })

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
        poNumber = `${request.companySettings.po_prefix}${(lastNumber + 1)
          .toString()
          .padStart(request.companySettings.document_number_padding, '0')}`
      } else {
        poNumber = `${request.companySettings.po_prefix}${'1'.padStart(
          request.companySettings.document_number_padding,
          '0',
        )}`
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
      payment_method: request.payment_method ?? 'cash',
      notes: request.notes,
      status: initialCreateStatus,
      created_by: request.created_by,
      created_at: new Date().toISOString(),
    }

    if (shouldReceiveNow && request.invoiceMeta?.invoiceNumber) {
      poInsertData.invoice_number = request.invoiceMeta.invoiceNumber
      poInsertData.invoice_date =
        request.invoiceMeta.invoiceDate ?? new Date().toISOString()
      if (request.invoiceMeta.deliveryNotes) {
        poInsertData.delivery_notes = request.invoiceMeta.deliveryNotes
      }
    }

    console.log('📝 Inserting PO with data:', poInsertData)

    let { data: purchaseOrder, error: poError } = await supabase
      .from('purchase_orders')
      .insert(poInsertData)
      .select()
      .single()

    if (poError) {
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

        purchaseOrder = retryPO

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

    console.log('✅ PO created:', purchaseOrder.po_number)

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

    // Create PO items — quantity_received reflects shouldReceiveNow
    const poItems = request.items.map((item) => ({
      purchase_order_id: purchaseOrder!.id,
      product_id: item.product_id,
      unit_id: productUnitMap.get(item.product_id),
      batch_number: item.batch_number,
      quantity_ordered: item.quantity_ordered,
      quantity_received: shouldReceiveNow ? item.quantity_ordered : 0, // ✅ FIXED
      unit_cost: item.unit_cost,
      discount_amount: item.discount_amount,
      total_cost: item.quantity_ordered * item.unit_cost,
      manufacture_date: item.manufacture_date,
      expiry_date: item.expiry_date,
    }))

    const { error: itemsError } = await supabase
      .from('purchase_order_items')
      .insert(poItems)

    if (itemsError) throw itemsError

    console.log('✅ PO items created')

    // Handle batches
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

      if (checkError && checkError.code !== 'PGRST116') throw checkError

      if (existingBatch) {
        const updateData: any = {
          purchase_order_id: purchaseOrder!.id,
          unit_cost: item.unit_cost,
          selling_price: item.selling_price || item.unit_cost * 1.3,
          manufacturing_date: item.manufacture_date,
          expiry_date: item.expiry_date,
          updated_at: new Date().toISOString(),
        }

        // ✅ FIXED: use shouldReceiveNow instead of receiveImmediately && isAdmin
        if (shouldReceiveNow) {
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
        // ✅ FIXED: use shouldReceiveNow instead of receiveImmediately && isAdmin
        const batchQuantities = shouldReceiveNow
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

    console.log(
      `✅ Batches ${shouldReceiveNow ? 'created with stock' : 'created with 0 qty (pending/draft)'}`,
    )

    // Update status from draft → finalStatus
    if (finalStatus !== initialCreateStatus) {
      console.log(
        `🔄 Updating status: '${initialCreateStatus}' → '${finalStatus}'`,
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
        console.error(
          '⚠️ RPC status update failed, falling back to direct update:',
          statusError,
        )

        const { error: directError } = await supabase
          .from('purchase_orders')
          .update({ status: finalStatus, ...statusUpdateData })
          .eq('id', purchaseOrder!.id)

        if (directError) {
          throw new Error(`Failed to set final status: ${directError.message}`)
        }
      } else if (request.created_by) {
        await supabase
          .from('purchase_orders')
          .update(statusUpdateData)
          .eq('id', purchaseOrder!.id)
      }

      console.log(`✅ Status updated to '${finalStatus}'`)
    }

    console.log('✅ PO flow complete:', {
      poNumber,
      finalStatus,
      id: purchaseOrder!.id,
      stockPopulated: shouldReceiveNow,
      invoiceNumber: request.invoiceMeta?.invoiceNumber ?? 'N/A',
    })

    return {
      success: true,
      poNumber,
      status: finalStatus,
      requiresApproval,
      purchaseOrder,
      inventoryUpdated: shouldReceiveNow,
    }
  } catch (error) {
    console.error('❌ Error creating purchase order:', error)
    throw error
  }
}

