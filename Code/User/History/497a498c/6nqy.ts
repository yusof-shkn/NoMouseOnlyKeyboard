// src/features/purchases/handlers/PurchasePOP.handlers.ts

import supabase from '@app/core/supabase/Supabase.utils'
import { notifications } from '@mantine/notifications'
import { openModal } from '@shared/components/genericModal/SliceGenericModal'
import { receiveAllGoodsFromPO } from '../data/PurchasePOP.queries'
import { getCurrentUserId } from '@shared/utils/authUtils'
import { AppDispatch } from '@app/core/store/store'
import type { OrderItem } from '../types'

export interface InvoiceMeta {
  invoiceNumber?: string
  invoiceDate?: string
  deliveryNotes?: string
}

export const handleAddProduct = (
  product: any,
  batchNumber: string | null,
  orderItems: OrderItem[],
  companyId: number,
  storeId: number,
  onItemCreated: (item: OrderItem) => void,
) => {
  const newItem: OrderItem = {
    id: product.id,
    productName: product.product_name,
    productCode: product.product_code || product.sku || '',
    unit: product.unit?.short_code || product.unit_code || 'Unit',
    batchNumber: batchNumber || '',
    batchId: null,
    qty: 1,
    price:
      product.unit_cost || product.standard_cost || product.standard_price || 0,
    costPrice:
      product.unit_cost || product.standard_cost || product.standard_price || 0,
    expiryDate: null,
    subtotal:
      product.unit_cost || product.standard_cost || product.standard_price || 0,
    availableStock: product.current_stock || 0,
    discountAmount: 0,
  }

  onItemCreated(newItem)
}

export const handleEditOrderItem = (
  item: OrderItem,
  onEditItem: (item: OrderItem) => void,
) => {
  onEditItem(item)
}

export const handleRemoveOrderItem = (
  index: number,
  orderItems: OrderItem[],
  setOrderItems: (items: OrderItem[]) => void,
  companyId: number,
  storeId: number,
) => {
  const newItems = orderItems.filter((_, i) => i !== index)
  setOrderItems(newItems)
  localStorage.setItem(
    `purchase_order_${companyId}_${storeId}`,
    JSON.stringify(newItems),
  )
}

export const handleSaveBatchDetails = (
  updatedItem: OrderItem,
  orderItems: OrderItem[],
  setOrderItems: (items: OrderItem[]) => void,
  onSuccess: () => void,
  companyId: number,
  storeId: number,
) => {
  if (!updatedItem.batchNumber) {
    throw new Error('Batch number is required')
  }

  const itemIndex = orderItems.findIndex(
    (item) =>
      item.id === updatedItem.id &&
      (!item.batchNumber || item.batchNumber === updatedItem.batchNumber),
  )

  if (itemIndex === -1) {
    setOrderItems([...orderItems, updatedItem])
  } else {
    const newItems = [...orderItems]
    newItems[itemIndex] = updatedItem
    setOrderItems(newItems)
  }

  const itemsToSave =
    itemIndex === -1 ? [...orderItems, updatedItem] : orderItems
  localStorage.setItem(
    `purchase_order_${companyId}_${storeId}`,
    JSON.stringify(itemsToSave),
  )

  onSuccess()
}

export const handleInlineItemChange = (
  index: number,
  field: 'qty' | 'price',
  value: number,
  orderItems: OrderItem[],
  setOrderItems: (items: OrderItem[]) => void,
  companyId: number,
  storeId: number,
) => {
  const newItems = [...orderItems]
  const currentItem = newItems[index]

  if (field === 'price') {
    newItems[index] = {
      ...currentItem,
      price: value,
      costPrice: value,
      subtotal: currentItem.qty * value,
    }
  } else {
    newItems[index] = {
      ...currentItem,
      qty: value,
      subtotal: value * currentItem.price,
    }
  }

  setOrderItems(newItems)
  localStorage.setItem(
    `purchase_order_${companyId}_${storeId}`,
    JSON.stringify(newItems),
  )
}

export const handleApplyAdditionalCosts = (
  taxPercentage: number,
  shipping: number,
  coupon: number,
  discount: number,
  subtotal: number,
  onApply: () => void,
) => {
  const errors: string[] = []

  if (taxPercentage < 0 || taxPercentage > 100)
    errors.push('Tax percentage must be between 0 and 100')
  if (shipping < 0) errors.push('Shipping cost cannot be negative')
  if (coupon < 0) errors.push('Coupon amount cannot be negative')
  if (discount < 0) errors.push('Discount amount cannot be negative')
  if (coupon + discount > subtotal)
    errors.push('Total discounts cannot exceed subtotal')

  if (errors.length > 0) return { isValid: false, errors }

  onApply()
  return { isValid: true, errors: [] }
}

export const handleResetOrder = (
  setOrderItems: (items: OrderItem[]) => void,
  setSelectedPayment: (value: string) => void,
  companyId: number,
  storeId: number,
) => {
  setOrderItems([])
  setSelectedPayment('cash')
  localStorage.removeItem(`purchase_order_${companyId}_${storeId}`)
}

export const handleCancelOrder = (onReset: () => void) => {
  if (window.confirm('Are you sure you want to cancel this order?')) {
    onReset()
  }
}

export const handleBarcodeScan = async (
  barcode: string,
  companyId: number,
  onBatchFound: (item: OrderItem) => void,
  onError: (message: string) => void,
) => {
  try {
    const { findBatchByNumber } = await import('../data/PurchasePOP.queries')

    const result = await findBatchByNumber(companyId, barcode)

    if (result) {
      const item: OrderItem = {
        id: result.product.id,
        productName: result.product.product_name,
        productCode: result.product.product_code,
        unit: result.product.unit?.short_code || 'Unit',
        qty: 1,
        price: result.unit_cost || result.product.standard_price || 0,
        costPrice: result.unit_cost || result.product.standard_price || 0,
        subtotal: result.unit_cost || result.product.standard_price || 0,
        batchNumber: result.batch_number,
        batchId: result.id,
        expiryDate: result.expiry_date || null,
        availableStock: 0,
        discountAmount: 0,
      }
      onBatchFound(item)
    } else {
      onError(`No batch found with number: ${barcode}`)
    }
  } catch (error) {
    console.error('Error scanning barcode:', error)
    onError('Failed to process barcode')
  }
}

export const handleSupplierSelect = (
  supplierId: string | null,
  setSelectedSupplier: (value: string | null) => void,
) => {
  setSelectedSupplier(supplierId)
}

export const handleTogglePurchasePanel = (
  isPanelHidden: boolean,
  setIsPurchasePanelHidden: (value: boolean) => void,
) => {
  setIsPurchasePanelHidden(!isPanelHidden)
}

/**
 * ✅ FIXED: handleSubmitPurchaseOrder
 *
 * The old code called receiveAllGoodsFromPO AFTER createPurchaseOrderWithBatches
 * even when receiveImmediately=true. Since createPurchaseOrderWithBatches now
 * sets status='received' and populates quantities via shouldReceiveNow, the
 * second call is not only redundant but caused the status-check guard to throw,
 * leaving inventory at 0.
 *
 * Fix: remove the second receiveAllGoodsFromPO call entirely for the
 * receiveImmediately path. createPurchaseOrderWithBatches handles everything.
 */
export const handleSubmitPurchaseOrder = async (
  orderItems: OrderItem[],
  totals: any,
  companyId: number,
  storeId: number,
  supplierId: number | null,
  taxPercentage: number,
  shipping: number,
  coupon: number,
  discount: number,
  createdBy: number | null,
  invoiceNumber: string,
  orderDate: string,
  receiveImmediately: boolean,
  paymentMethod: string,
  isAdmin: boolean,
  invoiceMeta: InvoiceMeta | undefined,
  onSuccess: (
    poNumber: string,
    poId: number,
    status: string,
    requiresApproval: boolean,
  ) => void,
  onError: (error: string) => void,
  companySettings?: {
    po_prefix: string
    document_number_padding: number
    auto_increment_documents: boolean
    require_purchase_approval: boolean
    default_credit_days: number
  },
) => {
  try {
    if (orderItems.length === 0)
      throw new Error('Please add items to the order')
    if (!supplierId) throw new Error('Please select a supplier')
    if (receiveImmediately && !invoiceNumber)
      throw new Error('Please enter supplier invoice number to receive goods')

    const itemsWithoutBatch = orderItems.filter((item) => !item.batchNumber)
    if (itemsWithoutBatch.length > 0)
      throw new Error('All items must have batch numbers')
    if (receiveImmediately && !isAdmin)
      throw new Error('Only administrators can receive goods immediately')

    const { createPurchaseOrderWithBatches } = await import(
      '../data/PurchasePOP.queries'
    )

    const result = await createPurchaseOrderWithBatches({
      company_id: companyId,
      store_id: storeId,
      supplier_id: supplierId,
      po_date: orderDate,
      subtotal: totals.subTotal,
      tax_amount: totals.tax,
      discount_amount: discount,
      total_amount: totals.grandTotal,
      payment_terms: companySettings
        ? `Net ${companySettings.default_credit_days}`
        : 'Net 30',
      payment_method: paymentMethod,
      notes: `Supplier Invoice: ${invoiceNumber}`,
      created_by: createdBy,
      receiveImmediately,
      isAdmin,
      invoiceMeta,
      items: orderItems.map((item) => ({
        product_id: item.id,
        batch_number: item.batchNumber,
        quantity_ordered: item.qty,
        unit_cost: item.costPrice,
        discount_amount: item.discountAmount || 0,
        manufacture_date: null,
        expiry_date: item.expiryDate,
      })),
      companySettings,
    })

    // ✅ REMOVED: the old `if (receiveImmediately && isAdmin) receiveAllGoodsFromPO(...)`
    // call that was here. createPurchaseOrderWithBatches now handles stock
    // population for both receiveImmediately=true AND requiresApproval=false.
    // Calling receiveAllGoodsFromPO here caused it to run on an already-received
    // PO which threw the status-check error and silently left inventory at 0.

    onSuccess(
      result.poNumber,
      result.purchaseOrder?.id || 0,
      result.status,
      result.requiresApproval,
    )
  } catch (error) {
    console.error('Error creating purchase order:', error)
    onError(
      error instanceof Error
        ? error.message
        : 'Failed to create purchase order',
    )
  }
}

export const handleSavePurchaseOrderAsDraft = async (
  orderItems: OrderItem[],
  totals: any,
  companyId: number,
  storeId: number,
  supplierId: number | null,
  taxPercentage: number,
  shipping: number,
  coupon: number,
  discount: number,
  createdBy: number | null,
  invoiceNumber: string,
  orderDate: string,
  paymentMethod: string,
  onSuccess: (poNumber: string) => void,
  onError: (error: string) => void,
  companySettings?: {
    po_prefix: string
    document_number_padding: number
    auto_increment_documents: boolean
    require_purchase_approval: boolean
    default_credit_days: number
  },
) => {
  try {
    if (orderItems.length === 0)
      throw new Error('Please add items to save as draft')

    const { createPurchaseOrderWithBatches } = await import(
      '../data/PurchasePOP.queries'
    )

    const result = await createPurchaseOrderWithBatches({
      company_id: companyId,
      store_id: storeId,
      supplier_id: supplierId || null,
      po_date: orderDate,
      subtotal: totals.subTotal,
      tax_amount: totals.tax,
      discount_amount: discount,
      total_amount: totals.grandTotal,
      payment_terms: companySettings
        ? `Net ${companySettings.default_credit_days}`
        : 'Net 30',
      payment_method: paymentMethod,
      notes: invoiceNumber
        ? `Supplier Invoice: ${invoiceNumber}`
        : 'Draft Order',
      created_by: createdBy,
      status: 'draft',
      items: orderItems.map((item) => ({
        product_id: item.id,
        batch_number: item.batchNumber || 'DRAFT-BATCH',
        quantity_ordered: item.qty,
        unit_cost: item.costPrice,
        discount_amount: item.discountAmount || 0,
        manufacture_date: null,
        expiry_date: item.expiryDate,
      })),
      companySettings,
    })

    onSuccess(result.poNumber)
  } catch (error) {
    console.error('Error saving draft:', error)
    onError(error instanceof Error ? error.message : 'Failed to save draft')
  }
}

/**
 * Receive goods handler (called from PO history table "Receive" button)
 * This is the ONLY place receiveAllGoodsFromPO should be called externally —
 * only for POs that are in 'approved' status and haven't been received yet.
 */
export const handleReceiveGoods = async (
  row: any,
  fetchPurchaseOrders: () => Promise<void>,
  dispatch: AppDispatch,
) => {
  try {
    if (row.status !== 'approved') {
      notifications.show({
        title: 'Cannot Receive',
        message: 'Only approved purchase orders can be received',
        color: 'orange',
      })
      return
    }

    const userId = await getCurrentUserId()
    if (!userId) {
      notifications.show({
        title: 'Authentication Error',
        message: 'User not authenticated',
        color: 'red',
      })
      return
    }

    if (
      !confirm(
        `Receive all goods from purchase order ${row.po_number}?\n\nThis will update inventory.`,
      )
    ) {
      return
    }

    notifications.show({
      id: 'receiving-goods',
      title: 'Receiving Goods...',
      message: 'Updating inventory',
      loading: true,
      autoClose: false,
    })

    const { success, error } = await receiveAllGoodsFromPO(
      row.id,
      row.company_id,
      userId,
    )

    notifications.hide('receiving-goods')

    if (!success) {
      throw error || new Error('Failed to receive goods')
    }

    await fetchPurchaseOrders()

    notifications.show({
      title: 'Success',
      message: `Goods received for PO ${row.po_number}. Inventory updated.`,
      color: 'green',
      autoClose: 3000,
    })

    const { data: existingRating } = await supabase
      .from('supplier_ratings')
      .select('id')
      .eq('purchase_order_id', row.id)
      .maybeSingle()

    if (!existingRating) {
      const { data: supplierData } = await supabase
        .from('suppliers')
        .select('rating')
        .eq('id', row.supplier_id)
        .single()

      dispatch(
        openModal({
          type: 'supplier-rating',
          size: 'lg',
          props: {
            purchaseOrderId: row.id,
            poNumber: row.po_number,
            supplierId: row.supplier_id,
            supplierName: row.supplier_name,
            totalAmount: row.total_amount,
            currentRating: supplierData?.rating || 0,
          },
        }),
      )
    }
  } catch (error: any) {
    console.error('Error receiving goods:', error)
    notifications.hide('receiving-goods')
    notifications.show({
      title: 'Receive Failed',
      message: error.message || 'Failed to receive goods',
      color: 'red',
    })
  }
}

