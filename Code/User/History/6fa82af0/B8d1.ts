// handlers/salesHistory.handlers.ts - CORRECTED APPROVAL LOGIC
// ✅ Proper logic: Check require_return_approval FIRST, then set status accordingly

import { notifications } from '@mantine/notifications'
import { AppDispatch } from '@app/core/store/store'
import { supabase } from '@app/core/supabase/Supabase.utils'
import { openModal, closeModal } from '@shared/components/genericModal'

import {
  fetchSalesData,
  calculateStats,
  canReturnSale,
  canDeleteSale,
  validateDiscount,
} from '../utils/salesHistory.utils'

import { Sale, CompanySettings } from '../types/salesHistory.types'
import { exportToPDF } from '@app/core/exports/PdfExporter'
import { exportToExcel } from '@app/core/exports/CsvExporter'
import { deleteSale } from '../data/salesHistory.queries'
import { Role } from '@shared/constants/roles'
import { getCurrentUserRoleId } from '@shared/utils/authUtils'

// ============== REFUND METHOD MAPPING ==============

const mapPaymentMethodToRefundMethod = (paymentMethod: string): string => {
  const mapping: Record<string, string> = {
    cash: 'cash',
    card: 'card',
    mobile: 'mobile',
    credit: 'cash', // Credit sales are refunded as cash
    bank_transfer: 'bank_transfer',
  }
  return mapping[paymentMethod] || 'cash'
}

// ============== FETCH SALE DETAILS ==============

export const fetchSaleDetails = async (saleId: number) => {
  try {
    const { data, error } = await supabase
      .from('sales')
      .select(
        `
        *,
        customers(
          id, customer_code, first_name, last_name, phone, email, address,
          credit_limit, current_credit_balance, available_credit
        ),
        stores(id, store_name, store_code, phone, address),
        profiles!sales_processed_by_fkey(auth_id, first_name, last_name, username, email),
        prescriptions(
          id, prescription_number, prescription_date, prescriber_name, prescriber_license,
          prescriber_contact, patient_name, diagnosis, is_verified, valid_from, valid_until
        ),
        sale_items(
          *,
          products(id, product_name, product_code, generic_name),
          batches:product_batches(id, batch_number, expiry_date)
        ),
        sale_payments(
          id, payment_number, payment_date, payment_amount,
          payment_method, payment_reference, notes
        )
      `,
      )
      .eq('id', saleId)
      .is('deleted_at', null)
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (error: any) {
    console.error('Error fetching sale details:', error)
    return { data: null, error }
  }
}

// ============== EXPORT HANDLERS ==============

export const handleExportPDF = (columns: any[], data: Sale[]) => {
  try {
    if (!data || data.length === 0) {
      notifications.show({
        title: 'No Data Available',
        message: 'There is no data to export to PDF',
        color: 'yellow',
      })
      return
    }

    exportToPDF({
      columns,
      data,
      fileName: 'sales_history',
      title: 'Sales History Report',
      orientation: 'landscape',
      includeDate: true,
    })

    notifications.show({
      title: 'Export Successful',
      message: 'PDF has been exported successfully',
      color: 'green',
    })
  } catch (error) {
    console.error('Failed to export PDF:', error)
    notifications.show({
      title: 'Export Failed',
      message: 'Failed to export PDF. Please try again.',
      color: 'red',
    })
  }
}

export const handleExportExcel = (columns: any[], data: Sale[]) => {
  try {
    if (!data || data.length === 0) {
      notifications.show({
        title: 'No Data Available',
        message: 'There is no data to export to Excel',
        color: 'yellow',
      })
      return
    }

    exportToExcel({
      columns,
      data,
      fileName: 'sales_history',
      sheetName: 'Sales',
      title: 'Sales History Report',
      includeMetadata: true,
    })

    notifications.show({
      title: 'Export Successful',
      message: 'Excel file has been exported successfully',
      color: 'green',
    })
  } catch (error) {
    console.error('Failed to export Excel:', error)
    notifications.show({
      title: 'Export Failed',
      message: 'Failed to export Excel. Please try again.',
      color: 'red',
    })
  }
}

// ============== REFRESH HANDLER ==============

export const handleRefresh = async (
  setSales: React.Dispatch<React.SetStateAction<Sale[]>>,
  setCustomers: React.Dispatch<React.SetStateAction<any[]>>,
  setStores: React.Dispatch<React.SetStateAction<any[]>>,
  setUsers: React.Dispatch<React.SetStateAction<any[]>>,
  setStats: React.Dispatch<React.SetStateAction<any>>,
  setLoading: React.Dispatch<React.SetStateAction<boolean>>,
  setTotalCount: React.Dispatch<React.SetStateAction<number>>,
  settings: CompanySettings | null,
) => {
  try {
    setLoading(true)
    const { salesData, customersData, storesData, usersData, totalCount } =
      await fetchSalesData({ settings })

    setSales(salesData)
    setCustomers(customersData)
    setStores(storesData)
    setUsers(usersData)
    setStats(calculateStats(salesData))
    setTotalCount(totalCount)

    notifications.show({
      title: 'Refreshed',
      message: 'Sales list updated',
      color: 'blue',
    })
  } catch {
    // Error handled in fetchSalesData
  } finally {
    setLoading(false)
  }
}

// ============== VIEW/INVOICE HANDLERS ==============

export const handleView = (row: any) => {
  console.log('View sale:', row)
}

export const handleDownloadInvoice = async (row: any) => {
  try {
    notifications.show({
      id: 'invoice-download',
      title: 'Generating Invoice',
      message: `Generating invoice for ${row.sale_number}...`,
      color: 'blue',
      loading: true,
      autoClose: false,
    })

    setTimeout(() => {
      notifications.update({
        id: 'invoice-download',
        title: 'Invoice Downloaded',
        message: `Invoice for ${row.sale_number} has been downloaded`,
        color: 'green',
        loading: false,
        autoClose: 3000,
      })
    }, 1000)
  } catch (error) {
    notifications.update({
      id: 'invoice-download',
      title: 'Download Failed',
      message: 'Failed to download invoice. Please try again.',
      color: 'red',
      loading: false,
      autoClose: 3000,
    })
  }
}

// ============== DELETE HANDLER ==============

export const handleDelete = async (
  row: any,
  fetchSales: () => void,
  settings: CompanySettings | null,
  dispatch: AppDispatch,
) => {
  try {
    const userRoleId = await getCurrentUserRoleId()
    if (userRoleId !== Role.company_admin) {
      notifications.show({
        title: 'Permission Denied',
        message: 'You do not have permission to delete sales.',
        color: 'red',
      })
      return
    }

    const deleteValidation = canDeleteSale(row, settings)
    if (!deleteValidation.allowed) {
      notifications.show({
        title: 'Delete Not Allowed',
        message: deleteValidation.reason || 'Cannot delete this sale',
        color: 'red',
      })
      return
    }

    // Get current user profile id for deleted_by
    const {
      data: { user },
    } = await supabase.auth.getUser()

    let profileId: number | null = null
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('auth_id', user.id)
        .single()
      profileId = profile?.id ?? null
    }

    // Use proper modal — pass paymentMethod so modal can show credit warning
    ;(window as any).__deleteHandlers = {
      onConfirm: async (deleteReason: string) => {
        dispatch(closeModal())
        delete (window as any).__deleteHandlers
        try {
          const { error } = await deleteSale(row.id, {
            deletedBy: profileId,
            deleteReason,
          })
          if (error) throw error
          fetchSales()
          notifications.show({
            title: 'Deleted',
            message: `Sale ${row.sale_number} deleted and all effects reversed`,
            color: 'green',
          })
        } catch (err: any) {
          console.error('Error deleting sale:', err)
          notifications.show({
            title: 'Error',
            message: err.message || 'Failed to delete sale',
            color: 'red',
          })
        }
      },
      onCancel: () => {
        dispatch(closeModal())
        delete (window as any).__deleteHandlers
      },
    }

    dispatch(
      openModal({
        type: 'confirm-delete-sale',
        size: 'sm',
        props: {
          saleNumber: row.sale_number,
          saleDate: row.sale_date,
          totalAmount: row.total_amount,
          paymentMethod: row.payment_method,
        },
      }),
    )
  } catch (error: any) {
    console.error('Error initiating delete:', error)
    notifications.show({
      title: 'Error',
      message: error.message || 'Failed to initiate delete',
      color: 'red',
    })
  }
}

// ============== RETURN HANDLER - CORRECTED LOGIC ==============

/**
 * ✅ CORRECTED: Check require_return_approval setting FIRST
 *
 * Logic Flow:
 * 1. Check if require_return_approval is ON
 * 2. If ON:
 *    - Create return with status='pending'
 *    - Set sale status to 'pending_return'
 * 3. If OFF:
 *    - Create return with status='completed'
 *    - Set sale status to 'returned'
 *    - Process refund immediately
 */
export const handleReturn = async (
  row: any,
  fetchSales: () => void,
  settings: CompanySettings | null,
  dispatch: AppDispatch,
) => {
  try {
    // Check if returns are allowed
    if (!settings?.allow_sales_returns) {
      notifications.show({
        title: 'Returns Disabled',
        message: 'Sales returns are not allowed by company policy',
        color: 'red',
      })
      return
    }

    const userRoleId = await getCurrentUserRoleId()
    if (userRoleId !== Role.company_admin && userRoleId !== Role.store_admin) {
      notifications.show({
        title: 'Permission Denied',
        message: 'You do not have permission to process returns.',
        color: 'red',
      })
      return
    }

    const returnValidation = canReturnSale(row, settings)
    if (!returnValidation.allowed) {
      notifications.show({
        title: 'Return Not Allowed',
        message: returnValidation.reason || 'Cannot return this sale',
        color: 'red',
      })
      return
    }

    // Load full sale details with items for the partial-return modal
    const { data: saleDetails, error: saleError } = await fetchSaleDetails(
      row.id,
    )
    if (saleError || !saleDetails) {
      notifications.show({
        title: 'Error',
        message: 'Could not load sale details',
        color: 'red',
      })
      return
    }

    const requiresApproval = settings?.require_return_approval === true

    // Fetch already-returned quantities per sale_item from completed/approved returns
    const { data: existingReturnItems } = await supabase
      .from('sales_return_items')
      .select(
        'sale_item_id, quantity_returned, sales_returns!inner(status, deleted_at, sale_id)',
      )
      .eq('sales_returns.sale_id', row.id)
      .in('sales_returns.status', ['completed', 'approved'])
      .is('sales_returns.deleted_at', null)

    // Build a map of sale_item_id → total qty already returned
    const returnedQtyMap: Record<number, number> = {}
    if (existingReturnItems) {
      for (const ri of existingReturnItems as any[]) {
        const saleItemId = ri.sale_item_id
        returnedQtyMap[saleItemId] =
          (returnedQtyMap[saleItemId] || 0) + ri.quantity_returned
      }
    }

    // Map sale items — only include items that still have returnable qty
    const saleItems = (saleDetails.sale_items || []).map((item: any) => ({
      id: item.id,
      product_id: item.product_id,
      batch_id: item.batch_id,
      batch_number: item.batch_number || '',
      product_name: item.products?.product_name || 'Unknown product',
      quantity: item.quantity,
      quantity_already_returned: returnedQtyMap[item.id] || 0,
      unit_price: item.unit_price,
      total_price: item.total_price,
    }))

    // Store callbacks on window — Redux cannot serialize functions in action payloads
    ;(window as any).__returnHandlers = {
      onSuccess: () => {
        dispatch(closeModal())
        fetchSales()
        delete (window as any).__returnHandlers
      },
      onCancel: () => {
        dispatch(closeModal())
        delete (window as any).__returnHandlers
      },
    }

    // Open modal — only serializable data in Redux payload
    dispatch(
      openModal({
        type: 'partial-return',
        size: 'lg',
        props: {
          sale: saleDetails,
          saleItems,
          requiresApproval,
        },
      }),
    )
  } catch (error: any) {
    console.error('❌ [handleReturn] Error:', error)
    notifications.show({
      title: 'Error',
      message: error.message || 'Failed to process return',
      color: 'red',
    })
  }
}

// Credit reversal helper
async function handleCreditReversal(
  saleDetails: any,
  returnRecord: any,
  processedBy: number,
) {
  try {
    const newCreditBalance =
      (saleDetails.customers?.current_credit_balance || 0) -
      saleDetails.total_amount
    const newAvailableCredit =
      (saleDetails.customers?.available_credit || 0) + saleDetails.total_amount

    await supabase
      .from('customers')
      .update({
        current_credit_balance: newCreditBalance,
        available_credit: newAvailableCredit,
        updated_at: new Date().toISOString(),
      })
      .eq('id', saleDetails.customer_id)

    if (saleDetails.credit_transaction_id) {
      await supabase
        .from('credit_transactions')
        .update({
          status: 'cancelled',
          notes: `Reversed due to return: ${returnRecord.return_number}`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', saleDetails.credit_transaction_id)
    }

    await supabase.from('credit_transactions').insert({
      company_id: saleDetails.company_id,
      entity_type: 'customer',
      entity_id: saleDetails.customer_id,
      transaction_type: 'payment',
      transaction_amount: saleDetails.total_amount,
      balance_before: saleDetails.customers?.current_credit_balance || 0,
      balance_after: newCreditBalance,
      reference_type: 'return',
      reference_id: returnRecord.id,
      description: `Credit reversed for returned sale ${saleDetails.sale_number}`,
      status: 'completed',
      due_date: new Date().toISOString(),
      created_by: processedBy,
    })
  } catch (error) {
    console.error('Error in credit reversal:', error)
  }
}

// ============== APPROVE RETURN HANDLER ==============

export const handleApproveReturn = async (
  returnId: number,
  fetchSales: () => void,
) => {
  try {
    console.log('🔵 [handleApproveReturn] START - Return ID:', returnId)

    const userRoleId = await getCurrentUserRoleId()
    if (userRoleId !== Role.company_admin) {
      notifications.show({
        title: 'Permission Denied',
        message: 'Only company admins can approve returns.',
        color: 'red',
      })
      return
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')

    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('auth_id', user.id)
      .single()

    if (!profile) throw new Error('User profile not found')

    // Get return details
    const { data: returnRecord, error: returnError } = await supabase
      .from('sales_returns')
      .select('*, sales(*)')
      .eq('id', returnId)
      .single()

    if (returnError || !returnRecord) throw new Error('Return not found')

    if (returnRecord.status !== 'pending') {
      notifications.show({
        title: 'Invalid Status',
        message: `This return is ${returnRecord.status} and cannot be approved`,
        color: 'orange',
      })
      return
    }

    // Update return to approved
    const { error: updateReturnError } = await supabase
      .from('sales_returns')
      .update({
        status: 'approved',
        approved_by: profile.id,
        approved_at: new Date().toISOString(),
        notes: returnRecord.notes
          ? `${returnRecord.notes}\nApproved by admin`
          : 'Approved by admin',
        updated_at: new Date().toISOString(),
      })
      .eq('id', returnId)

    if (updateReturnError) throw updateReturnError

    // Update sale status from 'pending_return' to 'returned'
    const { error: updateSaleError } = await supabase
      .from('sales')
      .update({
        sale_status: 'returned',
        payment_status: 'paid',
        updated_at: new Date().toISOString(),
      })
      .eq('id', returnRecord.sale_id)

    if (updateSaleError) throw updateSaleError

    console.log('✅ [handleApproveReturn] Sale status updated to returned')

    // ✅ Restore inventory quantities (only if not already restored by PartialReturnModal)
    const { data: returnForFlags } = await supabase
      .from('sales_returns')
      .select('inventory_restored, credit_reversed')
      .eq('id', returnId)
      .single()

    if (!returnForFlags?.inventory_restored) {
      const { error: restoreError } = await supabase.rpc(
        'fn_restore_sale_inventory',
        { p_sale_id: returnRecord.sale_id },
      )
      if (restoreError) {
        console.error(
          'Error restoring inventory on return approval:',
          restoreError,
        )
      } else {
        console.log('✅ [handleApproveReturn] Inventory restored')
        await supabase
          .from('sales_returns')
          .update({ inventory_restored: true })
          .eq('id', returnId)
      }
    } else {
      console.log(
        '⏭️ [handleApproveReturn] Inventory already restored, skipping',
      )
    }

    // Handle credit reversal (only if not already reversed)
    const { data: saleDetails } = await fetchSaleDetails(returnRecord.sale_id)
    if (
      !returnForFlags?.credit_reversed &&
      saleDetails?.payment_method === 'credit' &&
      saleDetails.customer_id
    ) {
      await handleCreditReversal(saleDetails, returnRecord, profile.id)
      await supabase
        .from('sales_returns')
        .update({ credit_reversed: true })
        .eq('id', returnId)
    }

    // Mark return as completed
    await supabase
      .from('sales_returns')
      .update({
        status: 'completed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', returnId)

    fetchSales()

    notifications.show({
      title: 'Return Approved',
      message: `Return ${returnRecord.return_number} approved. Sale status: 'Returned'.`,
      color: 'green',
    })

    console.log('✅ [handleApproveReturn] COMPLETE')
  } catch (error: any) {
    console.error('❌ [handleApproveReturn] Error:', error)
    notifications.show({
      title: 'Error',
      message: error.message || 'Failed to approve return',
      color: 'red',
    })
  }
}

// ============== REJECT RETURN HANDLER ==============

export const handleRejectReturn = async (
  returnId: number,
  fetchSales: () => void,
) => {
  try {
    console.log('🔵 [handleRejectReturn] START - Return ID:', returnId)

    const userRoleId = await getCurrentUserRoleId()
    if (userRoleId !== Role.company_admin) {
      notifications.show({
        title: 'Permission Denied',
        message: 'Only company admins can reject returns.',
        color: 'red',
      })
      return
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')

    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('auth_id', user.id)
      .single()

    if (!profile) throw new Error('User profile not found')

    // Get return details
    const { data: returnRecord, error: returnError } = await supabase
      .from('sales_returns')
      .select('*, sales(*)')
      .eq('id', returnId)
      .single()

    if (returnError || !returnRecord) throw new Error('Return not found')

    if (returnRecord.status !== 'pending') {
      notifications.show({
        title: 'Invalid Status',
        message: `This return is ${returnRecord.status} and cannot be rejected`,
        color: 'orange',
      })
      return
    }

    // Get rejection reason
    const rejectionReason = prompt(
      `Reject return ${returnRecord.return_number}?\n\nEnter rejection reason:`,
      '',
    )

    if (rejectionReason === null) return
    if (!rejectionReason.trim()) {
      notifications.show({
        title: 'Rejection Reason Required',
        message: 'Please provide a reason for rejecting the return',
        color: 'orange',
      })
      return
    }

    // Update return to rejected
    const { error: updateReturnError } = await supabase
      .from('sales_returns')
      .update({
        status: 'rejected',
        notes: returnRecord.notes
          ? `${returnRecord.notes}\nRejected by admin: ${rejectionReason}`
          : `Rejected by admin: ${rejectionReason}`,
        updated_at: new Date().toISOString(),
      })
      .eq('id', returnId)

    if (updateReturnError) throw updateReturnError

    // Restore sale status from 'pending_return' back to 'completed'
    const { error: updateSaleError } = await supabase
      .from('sales')
      .update({
        sale_status: 'completed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', returnRecord.sale_id)

    if (updateSaleError) throw updateSaleError

    console.log('✅ [handleRejectReturn] Sale status restored to completed')

    fetchSales()

    notifications.show({
      title: 'Return Rejected',
      message: `Return ${returnRecord.return_number} rejected. Sale restored to 'Completed'.`,
      color: 'blue',
    })

    console.log('✅ [handleRejectReturn] COMPLETE')
  } catch (error: any) {
    console.error('❌ [handleRejectReturn] Error:', error)
    notifications.show({
      title: 'Error',
      message: error.message || 'Failed to reject return',
      color: 'red',
    })
  }
}

// ============== EDIT HANDLER ==============

export const handleEdit = async (
  row: any,
  dispatch: AppDispatch,
  settings: CompanySettings | null,
  navigate: any,
) => {
  try {
    const { data: saleDetails, error } = await fetchSaleDetails(row.id)

    if (error || !saleDetails) {
      notifications.show({
        title: 'Error',
        message: 'Failed to load sale details',
        color: 'red',
      })
      return
    }

    const isDraft = saleDetails.sale_status === 'draft'

    navigate('/sales/pos', {
      state: {
        editingSale: {
          saleId: saleDetails.id,
          saleNumber: saleDetails.sale_number,
          saleType: saleDetails.sale_type,
          paymentMethod: saleDetails.payment_method,
          customerId: saleDetails.customer_id,
          prescriptionId: saleDetails.prescription_id,
          items: saleDetails.sale_items || [],
          discount: saleDetails.discount_amount || 0,
          taxAmount: saleDetails.tax_amount || 0,
          notes: saleDetails.notes,
          prescriptionDetails: saleDetails.prescriptions || null,
          isDraft, // ← POS uses this to load as draft-resume, not edit mode
        },
      },
      replace: true,
    })

    notifications.show({
      title: isDraft ? 'Draft Loaded' : 'Loading Sale',
      message: isDraft
        ? `Draft ${saleDetails.sale_number} loaded — complete or update it`
        : `Loading sale ${saleDetails.sale_number} for editing...`,
      color: isDraft ? 'yellow' : 'blue',
    })
  } catch (error: any) {
    notifications.show({
      title: 'Error',
      message: 'Failed to load sale',
      color: 'red',
    })
  }
}

// ============== DISCOUNT VALIDATION ==============

export const validateSaleDiscount = (
  row: any,
  settings: CompanySettings | null,
): boolean => {
  const validation = validateDiscount(row, settings)

  if (!validation.valid) {
    notifications.show({
      title: 'Discount Exceeded',
      message: validation.warning || 'Discount exceeds maximum allowed',
      color: 'orange',
    })
    return false
  }

  if (validation.warning) {
    notifications.show({
      title: 'Discount Warning',
      message: validation.warning,
      color: 'yellow',
    })
  }

  return true
}

