// src/features/sales/handlers/SalesPOS.handlers.ts
// UPDATED VERSION - Matching New Database Schema (January 2026)
// Changes: Removed backorders, updated credit handling, fixed sale creation

import { notifications } from '@mantine/notifications'
import {
  createSaleWithItems,
  updateSaleWithItems,
  validateStockAvailability,
  createDraftSale,
} from '../data/SalesPOS.queries'
import {
  generateReceiptHTML,
  generateInvoiceHTML,
  printDocument,
  downloadDocumentAsPDF,
} from '../utils/DocumentGeneration.utils'
import { supabase } from '@app/core/supabase/Supabase.utils'
import type { SupabaseClient } from '@supabase/supabase-js'

// Credit utilities
import {
  validateCustomerCredit,
  getCustomerCreditSummary,
  reverseCreditTransaction,
} from '../utils/Credit.utils'
import { createCreditSaleTransaction } from './Credit.handlers'
import type {
  CustomerCreditSummary,
  CreditValidationResult,
} from '../types/Credit.types'

/**
 * Normalize order item field names
 */
function normalizeOrderItem(item: any): any {
  return {
    id: item.id,
    productName: item.productName || item.name || '',
    productCode: item.productCode || item.code || '',
    unit: item.unit || '',
    batchNumber: item.batchNumber || item.batch || '',
    batchId: item.batchId ?? null,
    qty: item.qty || 0,
    price: item.price || 0,
    costPrice: item.costPrice || item.cost || 0,
    expiryDate: item.expiryDate || item.exp || null,
    subtotal: item.subtotal || 0,
    availableStock: item.availableStock || item.stock || 0,
    discountAmount: item.discountAmount || item.discount || 0,
    taxAmount: item.taxAmount || 0,
    taxRate: item.taxRate || 0,
  }
}

/**
 * Fetch company details for documents
 */
async function fetchCompanyDetails(companyId: number) {
  try {
    const { data, error } = await supabase
      .from('companies')
      .select('company_name, address, phone, email')
      .eq('id', companyId)
      .single()

    if (error) {
      console.error('Error fetching company details:', error)
      return {
        name: 'Your Company Name',
        address: 'Your Company Address',
        phone: 'N/A',
        email: 'N/A',
      }
    }

    return {
      name: data.company_name || 'Your Company Name',
      address: data.address || 'Your Company Address',
      phone: data.phone || 'N/A',
      email: data.email || 'N/A',
    }
  } catch (error) {
    console.error('Error in fetchCompanyDetails:', error)
    return {
      name: 'Your Company Name',
      address: 'Your Company Address',
      phone: 'N/A',
      email: 'N/A',
    }
  }
}

// ============================================================================
// CREDIT FUNCTIONS
// ============================================================================

/**
 * Fetch customer credit information
 */
export async function fetchCustomerCreditInfo(
  supabaseClient: SupabaseClient,
  customerId: number,
  companyId: number,
): Promise<CustomerCreditSummary | null> {
  try {
    return await getCustomerCreditSummary(supabaseClient, customerId, companyId)
  } catch (error) {
    console.error('Error fetching customer credit info:', error)
    return null
  }
}

/**
 * Validate credit for UI
 */
export async function validateCreditForUI(
  supabaseClient: SupabaseClient,
  customerId: number,
  companyId: number,
  purchaseAmount: number,
): Promise<CreditValidationResult> {
  try {
    return await validateCustomerCredit(supabaseClient, {
      customer_id: customerId,
      company_id: companyId,
      purchase_amount: purchaseAmount,
    })
  } catch (error) {
    console.error('Credit validation error:', error)
    return {
      isValid: false,
      canPurchaseOnCredit: false,
      availableCredit: 0,
      creditLimit: 0,
      currentBalance: 0,
      creditStatus: 'active',
      requiresApproval: false,
      errors: ['Failed to validate credit'],
      warnings: [],
    }
  }
}

// ============================================================================
// MODAL HANDLERS
// ============================================================================

/**
 * Open complete sale modal
 */
export function handleOpenCompleteSaleModal(
  orderItems: any[],
  totals: any,
  saleType: string,
  customerName: string | undefined,
  openModalFn: (config: any) => void,
) {
  console.log('🔵 Opening Complete Sale Modal')

  openModalFn({
    type: 'complete-sale-confirmation',
    size: 'lg',
    props: {
      saleType: saleType === 'retail' ? 'retail' : 'wholesale',
      orderItems: orderItems,
      totals: totals,
      customerName: customerName,
    },
  })
}

// ============================================================================
// MAIN SALE SUBMISSION HANDLER
// ============================================================================

/**
 * Submit sale order - UPDATED for new schema
 */
export async function handleSubmitSale(
  orderItems: any[],
  totals: any,
  companyId: number,
  storeId: number,
  customerId: number | null,
  saleType: string,
  taxPercentage: number,
  discount: number,
  totalAmount: number,
  amountPaid: number,
  paymentMethod: string,
  prescriptionDetails: any | null,
  notes: string | null,
  onSuccess: (saleNumber: string, saleId: number) => void,
  onError: (error: string) => void,
  documentOptions?: {
    generateReceipt: boolean
    generateInvoice: boolean
    printImmediately: boolean
    downloadPdf: boolean
  },
  companySettings?: any,
  customerDetails?: {
    name: string
    phone: string
    address: string
  },
  isEditMode: boolean = false,
  editingSaleId: number | null = null,
  originalSaleType: string | null = null,
  originalPaymentMethod: string | null = null,
  saleDate?: string, // ✅ NEW: cashier-selected date (YYYY-MM-DD)
  processedBy?: number | null, // ✅ FIX A-02: who processed this sale
) {
  try {
    console.log('🚀 Starting sale submission...', {
      isEditMode,
      editingSaleId,
      saleType,
      paymentMethod,
      originalSaleType,
      originalPaymentMethod,
    })

    // Normalize all items
    const normalizedItems = orderItems.map(normalizeOrderItem)

    // Validation: Required data
    if (!companyId || !storeId) {
      throw new Error('Company ID and Store ID are required')
    }

    if (normalizedItems.length === 0) {
      throw new Error('No items in the order')
    }

    // CREDIT HANDLING FOR EDIT MODE
    if (isEditMode && editingSaleId) {
      console.log('🔄 Edit mode detected - checking for credit changes...')

      // Handle credit reversal if changing FROM credit
      if (originalPaymentMethod === 'credit' && paymentMethod !== 'credit') {
        if (!customerId) {
          throw new Error('Customer ID required to reverse credit transaction')
        }

        console.log('💳 Reversing original credit transaction...')
        const reverseResult = await reverseCreditTransaction(
          supabase,
          editingSaleId,
          customerId,
          companyId,
          totalAmount,
          'Payment method changed during sale update',
        )

        if (!reverseResult.success) {
          throw new Error(
            reverseResult.errors?.join('\n') ||
              'Failed to reverse credit transaction',
          )
        }

        notifications.show({
          title: 'Credit Reversed',
          message: 'Original credit transaction has been reversed',
          color: 'blue',
        })
      }

      // Validate new credit if changing TO credit
      if (originalPaymentMethod !== 'credit' && paymentMethod === 'credit') {
        if (!customerId) {
          throw new Error('Customer required for credit payment')
        }

        console.log('💳 Validating new credit transaction...')
        const creditValidation = await validateCustomerCredit(supabase, {
          customer_id: customerId,
          company_id: companyId,
          purchase_amount: totalAmount,
        })

        if (
          !creditValidation.isValid ||
          !creditValidation.canPurchaseOnCredit
        ) {
          throw new Error(
            creditValidation.errors.join('\n') || 'Credit validation failed',
          )
        }
      }
    } else {
      // NEW SALE — credit already validated in UI before reaching here, skip re-validation
      console.log('✅ Credit pre-validated in UI, skipping duplicate check')
    }

    // Validate each item
    console.log('🔍 Validating order items...')
    const invalidItems: string[] = []

    normalizedItems.forEach((item, index) => {
      if (!item.batchId || item.batchId === '' || item.batchId === null) {
        invalidItems.push(
          `${item.productName || `Item ${index + 1}`}: Missing batch selection`,
        )
      }
      if (!item.qty || item.qty <= 0) {
        invalidItems.push(
          `${item.productName || `Item ${index + 1}`}: Invalid quantity`,
        )
      }
      if (item.price === undefined || item.price < 0) {
        invalidItems.push(
          `${item.productName || `Item ${index + 1}`}: Invalid price`,
        )
      }
    })

    if (invalidItems.length > 0) {
      throw new Error(`Invalid order items:\n${invalidItems.join('\n')}`)
    }

    // Stock validation — skip in edit mode because the DB function
    // restores the original sale's stock FIRST before checking availability.
    // Running validateStockAvailability here in edit mode would see stale
    // (pre-restore) quantities and incorrectly report insufficient stock.
    if (!isEditMode) {
      const itemsForValidation = normalizedItems.map((item) => ({
        product_id: item.id,
        batch_id: item.batchId,
        quantity: item.qty,
      }))

      console.log('🔍 Validating stock availability...')
      const stockValidation = await validateStockAvailability(
        companyId,
        storeId,
        itemsForValidation,
      )

      if (!stockValidation.all_valid) {
        const invalidItems = stockValidation.validations
          .filter((v: any) => !v.is_valid)
          .map((v: any) => `${v.product_name}: ${v.message}`)
          .join('\n')

        throw new Error(`Stock validation failed:\n${invalidItems}`)
      }
    } else {
      console.log(
        '🔄 Edit mode — skipping frontend stock validation (DB handles it after restoring original stock)',
      )
    }

    // Prepare sale request - UPDATED for new schema
    const saleRequest = {
      company_id: companyId,
      store_id: storeId,
      sale_type: saleType,
      customer_id: customerId || undefined,
      prescription_id: prescriptionDetails?.prescription_id || undefined,
      sale_date: saleDate || undefined, // ✅ pass cashier-selected date
      subtotal: totals.subTotal,
      discount_amount: discount,
      tax_amount: totals.tax,
      total_amount: totals.grandTotal,
      // Credit = paid via credit facility; amount_paid = total (DB also tracks credit balance separately)
      amount_paid: paymentMethod === 'credit' ? totals.grandTotal : amountPaid,
      payment_method: paymentMethod,
      notes: notes || undefined,
      processed_by: processedBy ?? undefined,
      items: normalizedItems.map((item) => ({
        product_id: item.id,
        batch_id: item.batchId,
        batch_number: item.batchNumber,
        quantity: item.qty,
        unit_price: item.price,
        cost_price: item.costPrice || 0,
        discount_amount: item.discountAmount || 0,
        tax_amount: item.taxAmount || 0,
        tax_rate: item.taxRate || 0,
      })),
    }

    // CREATE OR UPDATE SALE
    let result: any

    if (isEditMode && editingSaleId) {
      console.log('🔄 Updating existing sale...')
      result = await updateSaleWithItems({
        sale_id: editingSaleId,
        ...saleRequest,
      })
    } else {
      console.log('✨ Creating new sale...')
      result = await createSaleWithItems(saleRequest)
    }

    console.log('✅ Sale operation completed:', result)

    // ✅ FIX: Credit transaction is handled inside fn_create_sale_with_items on the DB.
    // The frontend no longer needs to call createCreditSaleTransaction separately.
    // Doing so was creating duplicate credit records.

    // Success notification
    let successMessage = isEditMode
      ? `Sale ${result.saleNumber} updated successfully`
      : `Sale ${result.saleNumber} completed successfully`

    notifications.show({
      title: isEditMode ? 'Sale Updated' : 'Sale Completed',
      message: successMessage,
      color: 'green',
    })

    // Generate documents if requested
    if (
      documentOptions &&
      (documentOptions.generateReceipt || documentOptions.generateInvoice)
    ) {
      try {
        const fetchedCompanyDetails = await fetchCompanyDetails(companyId)

        const documentData = {
          saleNumber: result.saleNumber,
          saleDate: saleDate
            ? new Date(saleDate).toISOString()
            : new Date().toISOString(),
          saleType:
            saleType === 'retail'
              ? ('retail' as const)
              : ('wholesale' as const),
          customerName: customerDetails?.name,
          customerPhone: customerDetails?.phone,
          customerAddress: customerDetails?.address,
          items: normalizedItems.map((item) => ({
            productName: item.productName,
            quantity: item.qty,
            unitPrice: item.price,
            discount: item.discountAmount || 0,
            subtotal: item.subtotal,
          })),
          subtotal: totals.subTotal,
          discount: discount,
          tax: totals.tax,
          grandTotal: totals.grandTotal,
          amountPaid: amountPaid,
          changeAmount: Math.max(0, amountPaid - totals.grandTotal),
          paymentMethod: paymentMethod,
          prescriptionNumber: prescriptionDetails?.prescription_number,
          companyName: fetchedCompanyDetails.name,
          companyAddress: fetchedCompanyDetails.address,
          companyPhone: fetchedCompanyDetails.phone,
          companyEmail: fetchedCompanyDetails.email,
        }

        if (documentOptions.generateReceipt) {
          const receiptHTML = generateReceiptHTML(documentData)

          if (documentOptions.printImmediately) {
            printDocument(receiptHTML)
          } else if (documentOptions.downloadPdf) {
            downloadDocumentAsPDF(
              receiptHTML,
              `Receipt-${result.saleNumber}.pdf`,
            )
          }
        }

        if (documentOptions.generateInvoice) {
          const invoiceHTML = generateInvoiceHTML(documentData)

          if (documentOptions.printImmediately) {
            printDocument(invoiceHTML)
          } else if (documentOptions.downloadPdf) {
            downloadDocumentAsPDF(
              invoiceHTML,
              `Invoice-${result.saleNumber}.pdf`,
            )
          }
        }
      } catch (docError) {
        console.error('Error generating documents:', docError)
        notifications.show({
          title: 'Document Generation Warning',
          message: 'Sale completed but documents could not be generated',
          color: 'yellow',
        })
      }
    }

    onSuccess(result.saleNumber, result.sale.id)
  } catch (error: any) {
    console.error('❌ Error in handleSubmitSale:', error)

    const errorMessage = error.message || 'An unknown error occurred'

    notifications.show({
      title: isEditMode ? 'Update Failed' : 'Sale Failed',
      message: errorMessage,
      color: 'red',
    })

    onError(errorMessage)
  }
}

// ============================================================================
// EXISTING HANDLERS (UNCHANGED)
// ============================================================================

export function handleCustomerSelect(
  value: string | null,
  setSelectedCustomer: (value: string | null) => void,
) {
  setSelectedCustomer(value)
}

export function handleToggleSalePanel(
  isSalePanelHidden: boolean,
  setIsSalePanelHidden: (value: boolean) => void,
) {
  setIsSalePanelHidden(!isSalePanelHidden)
}

export function handleAddProduct(
  product: any,
  batch: any | null,
  orderItems: any[],
  companyId: number,
  storeId: number,
  onBatchSelect: (item: any) => void,
) {
  console.log('➕ Adding product:', product)

  const existingItemIndex = orderItems.findIndex(
    (item) => item.id === product.id,
  )

  if (existingItemIndex >= 0) {
    onBatchSelect(orderItems[existingItemIndex])
  } else {
    const newItem = {
      id: product.id,
      productName: product.product_name,
      productCode: product.product_code,
      qty: 0,
      price: product.standard_price || 0,
      costPrice: product.standard_cost || 0,
      discountAmount: 0,
      taxAmount: 0,
      taxRate: 0,
      batchId: null,
      batchNumber: '',
      expiryDate: null,
      availableStock: product.available_quantity || 0,
      unit: product.unit?.short_code || '',
      subtotal: 0,
    }

    onBatchSelect(newItem)
  }
}

export function handleEditOrderItem(item: any, onEdit: (item: any) => void) {
  onEdit(item)
}

export function handleRemoveOrderItem(
  index: number,
  orderItems: any[],
  setOrderItems: (items: any[]) => void,
  companyId: number,
  storeId: number,
) {
  const newItems = [...orderItems]
  newItems.splice(index, 1)
  setOrderItems(newItems)
}

export function handleSaveBatchDetails(
  updatedItem: any,
  orderItems: any[],
  setOrderItems: (items: any[]) => void,
  onClose: () => void,
  companyId: number,
  storeId: number,
) {
  console.log('💾 Saving batch details (RAW):', updatedItem)

  const normalizedItem = normalizeOrderItem(updatedItem)

  console.log('💾 Saving batch details (NORMALIZED):', normalizedItem)

  const existingIndex = orderItems.findIndex(
    (item) =>
      item.id === normalizedItem.id && item.batchId === normalizedItem.batchId,
  )

  let newItems: any[]
  if (existingIndex >= 0) {
    newItems = [...orderItems]
    newItems[existingIndex] = normalizedItem
  } else {
    newItems = [...orderItems, normalizedItem]
  }

  setOrderItems(newItems)

  onClose()
}

export function handleInlineItemChange(
  index: number,
  field: 'qty' | 'price',
  value: number,
  orderItems: any[],
  setOrderItems: (items: any[]) => void,
  companyId: number,
  storeId: number,
) {
  const newItems = [...orderItems]
  const item = newItems[index]

  item[field] = value
  item.subtotal = item.qty * item.price - (item.discountAmount || 0)

  setOrderItems(newItems)
}

export function handleApplyAdditionalCosts(
  taxPercentage: number,
  discount: number,
  subTotal: number,
  onApply: () => void,
) {
  const errors: string[] = []

  if (taxPercentage < 0 || taxPercentage > 100) {
    errors.push('Tax percentage must be between 0 and 100')
  }

  if (discount < 0) {
    errors.push('Discount cannot be negative')
  }

  if (discount > subTotal) {
    errors.push('Discount cannot exceed subtotal')
  }

  if (errors.length > 0) {
    return { isValid: false, errors }
  }

  onApply()
  return { isValid: true, errors: [] }
}

export function handleResetOrder(onReset: () => void) {
  onReset()
}

export function handleCancelOrder(onCancel: () => void) {
  // ✅ FIX: Don't use blocking browser confirm() — caller is responsible
  // for showing any confirmation UI before calling this function
  onCancel()
}

export function handleSaleTypeToggle(
  type: string,
  setSaleType: (type: string) => void,
) {
  setSaleType(type)
}

/**
 * Save the current POS order as a draft in the database.
 * Draft sales do NOT deduct inventory and are NOT posted to accounting.
 * They appear in Sales History with status "Draft" and can be resumed.
 */
export async function handleSaveDraft(
  orderItems: any[],
  totals: any,
  companyId: number,
  storeId: number,
  customerId: number | null,
  saleType: string,
  discount: number,
  paymentMethod: string,
  saleDate: string | undefined,
  existingDraftId: number | null,
  onSuccess: (saleNumber: string, saleId: number) => void,
  onError: (error: string) => void,
  processedBy?: number | null, // ✅ FIX A-03: who created the draft
) {
  try {
    if (!companyId || !storeId)
      throw new Error('Company and store are required')
    if (orderItems.length === 0) throw new Error('No items to save as draft')

    const normalizedItems = orderItems.map(normalizeOrderItem)

    const items = normalizedItems.map((item) => ({
      product_id: item.id,
      batch_id: item.batchId,
      batch_number: item.batchNumber,
      quantity: item.qty,
      unit_price: item.price,
      cost_price: item.costPrice || 0,
      discount_amount: item.discountAmount || 0,
      tax_amount: item.taxAmount || 0,
      tax_rate: item.taxRate || 0,
    }))

    const result = await createDraftSale({
      company_id: companyId,
      store_id: storeId,
      sale_type: saleType,
      subtotal: totals.subTotal,
      discount_amount: discount,
      tax_amount: totals.tax,
      total_amount: totals.grandTotal,
      payment_method: paymentMethod || 'cash',
      customer_id: customerId || null,
      sale_date: saleDate || null,
      existing_draft_id: existingDraftId || null,
      processed_by: processedBy ?? null, // ✅ FIX A-03: track draft creator
      items,
    })

    notifications.show({
      title: 'Draft Saved',
      message: `Order saved as draft ${result.sale_number}`,
      color: 'yellow',
    })

    onSuccess(result.sale_number, result.sale_id)
  } catch (error: any) {
    const msg = error?.message || 'Failed to save draft'
    notifications.show({
      title: 'Save Draft Failed',
      message: msg,
      color: 'red',
    })
    onError(msg)
  }
}

