// src/features/main/CustomersManagement/handlers/customersManagement.handlers.ts
// ✅ COMPLETELY UPDATED: Added Pay Credit handler

import { notifications } from '@mantine/notifications'
import { CustomerWithRelations } from '@shared/types/customer'
import { AppDispatch } from '@app/core/store/store'
import { deleteCustomer } from '../data/customers.queries'
import {
  canDeleteCustomer,
  fetchCustomersData,
} from '../utils/customersManagement.utils'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import { openModal } from '@shared/components/genericModal'

/**
 * Handle adding a new customer
 */
export const handleAddCustomer = (dispatch: AppDispatch) => {
  dispatch(
    openModal({
      type: 'add-customer',
      size: 'lg',
      props: {
        mode: 'create',
      },
    }),
  )
  notifications.show({
    title: 'Add Customer',
    message: 'Opening add customer form...',
    color: 'blue',
  })
}

/**
 * Handle viewing customer details
 */
export const handleView = (
  row: CustomerWithRelations,
  dispatch: AppDispatch,
  navigate: any,
) => {
  notifications.show({
    title: 'View Customer',
    message: `Viewing details for: ${row.first_name} ${row.last_name}`,
    color: 'blue',
  })
  // navigate(`/customers/${row.id}`)
}

/**
 * Handle editing a customer
 */
export const handleEdit = (
  row: CustomerWithRelations,
  dispatch: AppDispatch,
) => {
  dispatch(
    openModal({
      type: 'add-customer',
      size: 'lg',
      props: {
        mode: 'edit',
        customer: row,
      },
    }),
  )
  notifications.show({
    title: 'Edit Customer',
    message: `Editing: ${row.first_name} ${row.last_name}`,
    color: 'blue',
  })
}

/**
 * Handle deleting a customer
 */
export const handleDelete = async (
  row: CustomerWithRelations,
  fetchCustomers: () => void,
  fetchStats: () => void,
) => {
  try {
    const fullName = `${row.first_name} ${row.last_name}`

    // Check if customer can be deleted
    const { canDelete, salesCount, creditTransactionCount, message } =
      await canDeleteCustomer(row.id)

    if (!canDelete) {
      notifications.show({
        title: 'Cannot Delete',
        message:
          message ||
          `This customer has associated records and cannot be deleted.`,
        color: 'orange',
        autoClose: 7000,
      })
      return
    }

    if (!confirm(`Are you sure you want to delete "${fullName}"?`)) {
      return
    }

    const { error } = await deleteCustomer(row.id)

    if (error) throw error

    notifications.show({
      title: 'Success',
      message: `Customer "${fullName}" deleted successfully`,
      color: 'green',
    })

    // Refresh data
    fetchCustomers()
    fetchStats()

    // Dispatch event
    window.dispatchEvent(new Event('customerUpdated'))
  } catch (error: any) {
    console.error('Error deleting customer:', error)
    notifications.show({
      title: 'Error',
      message: error.message || 'Failed to delete customer',
      color: 'red',
    })
  }
}

/**
 * Handle navigating to credit management page for recording payment
 */
export const handleRecordPayment = (
  row: CustomerWithRelations,
  navigate: any,
) => {
  navigate(`/credit-management?customer_id=${row.id}&action=record_payment`)

  notifications.show({
    title: 'Record Payment',
    message: `Opening credit management for ${row.first_name} ${row.last_name}`,
    color: 'blue',
  })
}

/**
 * Handle navigating to credit management page for adjusting credit
 */
export const handleAdjustCredit = (
  row: CustomerWithRelations,
  navigate: any,
) => {
  navigate(`/credit-management?customer_id=${row.id}&action=adjust_credit`)

  notifications.show({
    title: 'Adjust Credit',
    message: `Opening credit management for ${row.first_name} ${row.last_name}`,
    color: 'blue',
  })
}

/**
 * Handle viewing customer credit details
 */
export const handleViewCreditDetails = (
  row: CustomerWithRelations,
  navigate: any,
) => {
  navigate(`/credit-management?customer_id=${row.id}`)

  notifications.show({
    title: 'Credit Details',
    message: `Viewing credit details for ${row.first_name} ${row.last_name}`,
    color: 'blue',
  })
}

/**
 * ✅ NEW: Handle paying customer credit
 * Opens a modal to record a payment from the customer
 */
export const handlePayCredit = (
  row: CustomerWithRelations,
  dispatch: AppDispatch,
) => {
  // Check if customer has any outstanding credit balance
  if (!row.current_credit_balance || row.current_credit_balance <= 0) {
    notifications.show({
      title: 'No Outstanding Balance',
      message: `${row.first_name} ${row.last_name} has no outstanding credit balance to pay.`,
      color: 'orange',
    })
    return
  }

  dispatch(
    openModal({
      type: 'pay-customer-credit',
      size: 'md',
      props: {
        customer: row,
      },
    }),
  )

  notifications.show({
    title: 'Pay Credit',
    message: `Recording payment for ${row.first_name} ${row.last_name}`,
    color: 'blue',
  })
}

/**
 * Handle exporting to PDF
 * ✅ COMPLETELY UPDATED: Removed all deleted fields
 */
export const handleExportPDF = (
  columns: any[],
  data: CustomerWithRelations[],
  companySettings?: any,
) => {
  try {
    const doc = new jsPDF('landscape')

    doc.setFontSize(18)
    doc.text('Customers List', 14, 22)

    // ✅ UPDATED: Only include fields that exist
    const tableData = data.map((item) => [
      `${item.first_name} ${item.last_name}`,
      item.phone || 'N/A',
      item.email || 'N/A',
      item.address || 'N/A', // ✅ Single address field
      item.credit_limit
        ? `UGX ${item.credit_limit.toLocaleString()}`
        : 'No Credit',
      item.current_credit_balance
        ? `UGX ${item.current_credit_balance.toLocaleString()}`
        : 'UGX 0',
      item.available_credit
        ? `UGX ${item.available_credit.toLocaleString()}`
        : 'UGX 0',
      item.is_active ? 'Active' : 'Inactive',
    ])

    autoTable(doc, {
      head: [
        [
          'Name',
          'Phone',
          'Email',
          'Address',
          'Credit Tier',
          'Credit Limit',
          'Balance',
          'Available',
          'Status',
        ],
      ],
      body: tableData,
      startY: 30,
      styles: { fontSize: 7 },
      headStyles: { fillColor: [41, 128, 185] },
    })

    doc.save('customers-list.pdf')

    notifications.show({
      title: 'Success',
      message: 'PDF exported successfully',
      color: 'green',
    })
  } catch (error: any) {
    console.error('Error exporting PDF:', error)
    notifications.show({
      title: 'Error',
      message: 'Failed to export PDF',
      color: 'red',
    })
  }
}

/**
 * Handle exporting to Excel
 * ✅ COMPLETELY UPDATED: Removed all deleted fields
 */
export const handleExportExcel = (
  columns: any[],
  data: CustomerWithRelations[],
  companySettings?: any,
) => {
  try {
    const worksheet = XLSX.utils.json_to_sheet(
      data.map((item) => ({
        'First Name': item.first_name,
        'Last Name': item.last_name,
        Phone: item.phone || 'N/A',
        Email: item.email || 'N/A',
        Address: item.address || 'N/A', // ✅ Single address field

        // Insurance (from relation)
        'Insurance Provider':
          (item as any).customer_insurance?.insurance_provider || 'N/A',
        'Insurance Number':
          (item as any).customer_insurance?.insurance_number || 'N/A',
        'Insurance Expiry':
          (item as any).customer_insurance?.insurance_expiry_date || 'N/A',
        'Policy Type': (item as any).customer_insurance?.policy_type || 'N/A',
        'Coverage Limit': (item as any).customer_insurance?.coverage_limit || 0,

        // Credit Information
        'Credit Limit': item.credit_limit || 0,
        'Current Credit Balance': item.current_credit_balance || 0,
        'Available Credit': item.available_credit || 0,
        'Credit Days': item.credit_days || 0,

        // Purchase History
        'Total Purchases': item.total_purchases || 0,
        'Last Purchase Date': item.last_purchase_date || 'N/A',

        // Status
        Status: item.is_active ? 'Active' : 'Inactive',
        'Created At': new Date(item.created_at).toLocaleDateString(),
      })),
    )

    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Customers')
    XLSX.writeFile(workbook, 'customers-list.xlsx')

    notifications.show({
      title: 'Success',
      message: 'Excel file exported successfully',
      color: 'green',
    })
  } catch (error: any) {
    console.error('Error exporting Excel:', error)
    notifications.show({
      title: 'Error',
      message: 'Failed to export Excel file',
      color: 'red',
    })
  }
}

/**
 * Handle refresh
 */
export const handleRefresh = async (
  setCustomers: (data: CustomerWithRelations[]) => void,
  setLoading: (loading: boolean) => void,
  setTotalCount: (count: number) => void,
  fetchStats: () => void,
  currentPage: number,
  pageSize: number,
  searchQuery: string,
  statusFilter: 'all' | 'active' | 'inactive',
  creditFilter: 'all' | 'with_credit' | 'no_credit' | 'has_balance',
  companyId: number,
) => {
  try {
    setLoading(true)

    const { customersData, totalCount } = await fetchCustomersData({
      page: currentPage,
      pageSize,
      searchQuery,
      status: statusFilter,
      creditStatus: creditFilter,
      companyId,
    })

    setCustomers(customersData)
    setTotalCount(totalCount)
    fetchStats()

    notifications.show({
      title: 'Refreshed',
      message: 'Customers data has been refreshed',
      color: 'green',
    })
  } catch (error: any) {
    console.error('Error refreshing:', error)
    notifications.show({
      title: 'Error',
      message: 'Failed to refresh data',
      color: 'red',
    })
  } finally {
    setLoading(false)
  }
}

