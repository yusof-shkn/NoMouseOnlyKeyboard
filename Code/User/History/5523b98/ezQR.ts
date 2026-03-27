// src/pages/BalanceSheet/handlers/balanceSheet.handlers.ts
import { notifications } from '@mantine/notifications'
import { exportToPDF } from '@app/core/exports/PdfExporter'
import { exportToExcel } from '@app/core/exports/CsvExporter'
import { BalanceSheetEntry } from '../types/balanceSheet.types'
import { fetchBalanceSheetData } from '../utils/balanceSheet.utils'
import { getAllBalanceSheetData } from '../data/balanceSheet.queries'

/**
 * Handle PDF export
 */
export const handleExportPDF = async (
  columns: any[],
  currentFilters: any,
  companyName: string = '',
): Promise<void> => {
  try {
    // Fetch all data for export
    const { data, error } = await getAllBalanceSheetData(currentFilters)

    if (error || !data || data.length === 0) {
      notifications.show({
        title: 'No Data Available',
        message: 'There is no data to export to PDF',
        color: 'yellow',
      })
      return
    }

    const exportColumns = columns.filter((col) => col.accessor !== 'actions')

    const title = companyName
      ? `Balance Sheet Report - ${companyName}`
      : 'Balance Sheet Report'

    exportToPDF({
      columns: exportColumns,
      data,
      fileName: `balance_sheet_${new Date().toISOString().split('T')[0]}`,
      title,
      orientation: 'landscape',
      includeDate: true,
    })

    notifications.show({
      title: 'Export Successful',
      message: `PDF exported with ${data.length} accounts`,
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

/**
 * Handle Excel export
 */
export const handleExportExcel = async (
  columns: any[],
  currentFilters: any,
  companyName: string = '',
): Promise<void> => {
  try {
    // Fetch all data for export
    const { data, error } = await getAllBalanceSheetData(currentFilters)

    if (error || !data || data.length === 0) {
      notifications.show({
        title: 'No Data Available',
        message: 'There is no data to export to Excel',
        color: 'yellow',
      })
      return
    }

    const exportColumns = columns.filter((col) => col.accessor !== 'actions')

    const title = companyName
      ? `Balance Sheet Report - ${companyName}`
      : 'Balance Sheet Report'

    exportToExcel({
      columns: exportColumns,
      data,
      fileName: `balance_sheet_${new Date().toISOString().split('T')[0]}`,
      sheetName: 'Balance Sheet',
      title,
      includeMetadata: true,
    })

    notifications.show({
      title: 'Export Successful',
      message: `Excel exported with ${data.length} accounts`,
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

/**
 * Handle account type filter change
 */
export const handleAccountTypeChange = (
  value: string,
  setAccountTypeFilter: React.Dispatch<React.SetStateAction<string>>,
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>,
): void => {
  setAccountTypeFilter(value)
  setCurrentPage(1)
}

/**
 * Handle date filter change
 */
export const handleDateChange = (
  value: Date | null,
  setAsOfDate: React.Dispatch<React.SetStateAction<string>>,
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>,
): void => {
  if (value) {
    setAsOfDate(value.toISOString().split('T')[0])
    setCurrentPage(1)
  }
}

/**
 * Handle row click (if needed for future expansion)
 */
export const handleRowClick = (
  row: BalanceSheetEntry,
  currency: string,
): void => {
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
  })

  notifications.show({
    title: 'Account Selected',
    message: `${row.account_name} - Balance: ${formatter.format(row.balance)}`,
    color: 'blue',
    autoClose: 2000,
  })
}

