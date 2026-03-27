// src/pages/CashFlow/handlers/cashFlowManagement.handlers.ts
import { notifications } from '@mantine/notifications'
import { AppDispatch } from '@app/core/store/store'
import { fetchCashFlowData } from '../utils/cashFlow.utils'
import { CashFlowTransaction, CashFlowStats } from '../types/cashFlow.types'
import { exportToPDF } from '@app/core/exports/PdfExporter'
import { exportToExcel } from '@app/core/exports/CsvExporter'
import { deleteCashFlowTransaction } from '../data/cashFlow.queries'
import { getCurrentUserRoleId } from '@shared/utils/authUtils'
import { Role } from '@shared/constants/roles'

const getCurrencyLocale = (currency: string): string => {
  const localeMap: Record<string, string> = {
    UGX: 'en-UG',
    USD: 'en-US',
    EUR: 'en-EU',
    GBP: 'en-GB',
    KES: 'en-KE',
    TZS: 'en-TZ',
    RWF: 'en-RW',
  }
  return localeMap[currency] || 'en-US'
}

export const handleExportPDF = (
  columns: any[],
  data: CashFlowTransaction[],
  currency: string = 'UGX',
): void => {
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
      fileName: `cash_flow_export_${new Date().toISOString().split('T')[0]}`,
      title: `Cash Flow Report (${currency})`,
      orientation: 'landscape',
      includeDate: true,
    })

    notifications.show({
      title: 'Export Successful',
      message: `PDF exported with ${data.length} transactions`,
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

export const handleExportExcel = (
  columns: any[],
  data: CashFlowTransaction[],
  currency: string = 'UGX',
): void => {
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
      fileName: `cash_flow_export_${new Date().toISOString().split('T')[0]}`,
      sheetName: 'Cash Flow',
      title: `Cash Flow Report (${currency})`,
      includeMetadata: true,
    })

    notifications.show({
      title: 'Export Successful',
      message: `Excel exported with ${data.length} transactions`,
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

export const handleRefresh = async (
  setTransactions: React.Dispatch<React.SetStateAction<CashFlowTransaction[]>>,
  setStats: React.Dispatch<React.SetStateAction<CashFlowStats>>,
  setLoading: React.Dispatch<React.SetStateAction<boolean>>,
  setTotalCount: React.Dispatch<React.SetStateAction<number>>,
  filters: any,
): Promise<void> => {
  try {
    setLoading(true)
    const { transactionsData, totalCount, stats } =
      await fetchCashFlowData(filters)
    setTransactions(transactionsData)
    setStats(stats)
    setTotalCount(totalCount)
    notifications.show({
      title: 'Refreshed',
      message: `Updated ${transactionsData.length} transactions with current data`,
      color: 'blue',
    })
  } catch (error: any) {
    notifications.show({
      title: 'Refresh Failed',
      message: error.message || 'Failed to refresh cash flow data',
      color: 'red',
    })
  } finally {
    setLoading(false)
  }
}

export const handleDelete = async (
  row: CashFlowTransaction,
  fetchCashFlow: () => void,
): Promise<void> => {
  const userRoleId = await getCurrentUserRoleId()
  if (userRoleId !== Role.company_admin) {
    notifications.show({
      title: 'Permission Denied',
      message: 'You do not have permission to delete transactions.',
      color: 'red',
    })
    return
  }

  // reference_number is the canonical ref field from the view
  const refLabel =
    (row.reference_number ?? row.receipt_number)
      ? `Ref #${row.reference_number ?? row.receipt_number}`
      : `Entry: ${row.description || 'N/A'}`

  const confirmDelete = window.confirm(
    `Are you sure you want to delete this transaction? ${refLabel}`,
  )
  if (!confirmDelete) return

  try {
    const { error } = await deleteCashFlowTransaction(row.id)
    if (error) throw error

    fetchCashFlow()

    notifications.show({
      title: 'Success',
      message: 'Transaction deleted successfully',
      color: 'green',
    })
  } catch (error: any) {
    console.error('Error deleting transaction:', error)
    notifications.show({
      title: 'Error',
      message: error.message || 'Failed to delete transaction',
      color: 'red',
    })
  }
}

export const handleRowClick = (
  row: CashFlowTransaction,
  selectedTransaction: CashFlowTransaction | null,
  setSelectedTransaction: React.Dispatch<
    React.SetStateAction<CashFlowTransaction | null>
  >,
  currency: string = 'UGX',
): void => {
  const locale = getCurrencyLocale(currency)
  const formattedAmount = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(row.amount ?? 0)

  if (selectedTransaction && selectedTransaction.id === row.id) {
    setSelectedTransaction(null)
    notifications.show({
      title: 'Transaction Deselected',
      message: 'Transaction has been deselected',
      color: 'gray',
      autoClose: 2000,
    })
  } else {
    setSelectedTransaction(row)
    notifications.show({
      title: 'Transaction Selected',
      // transaction_type is a real column in v_cash_flow
      message: `${row.transaction_type === 'inflow' ? 'Cash In' : 'Cash Out'} — ${formattedAmount}`,
      color: 'blue',
      autoClose: 2000,
    })
  }
}

export const handleDateRangeChange = (
  dates: [Date | null, Date | null],
  setStartDate: React.Dispatch<React.SetStateAction<string | null>>,
  setEndDate: React.Dispatch<React.SetStateAction<string | null>>,
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>,
): void => {
  const [start, end] = dates
  setStartDate(start ? start.toISOString().split('T')[0] : null)
  setEndDate(end ? end.toISOString().split('T')[0] : null)
  setCurrentPage(1)
}

export const handleTransactionTypeChange = (
  value: string,
  setTransactionTypeFilter: React.Dispatch<React.SetStateAction<string>>,
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>,
): void => {
  setTransactionTypeFilter(value)
  setCurrentPage(1)
}

export const handleActivityTypeChange = (
  value: string,
  setActivityTypeFilter: React.Dispatch<React.SetStateAction<string>>,
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>,
): void => {
  setActivityTypeFilter(value)
  setCurrentPage(1)
}

export const handlePaymentMethodChange = (
  value: string,
  setPaymentMethodFilter: React.Dispatch<React.SetStateAction<string>>,
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>,
): void => {
  setPaymentMethodFilter(value)
  setCurrentPage(1)
}

export const handleViewDetails = (
  row: CashFlowTransaction,
  dispatch: AppDispatch,
): void => {
  notifications.show({
    title: 'Transaction Details',
    // account_name comes from enrichment (not the view directly)
    message: `${row.description}${row.creator_name ? ` — ${row.account_name}` : ''}`,
    color: 'blue',
  })
}

