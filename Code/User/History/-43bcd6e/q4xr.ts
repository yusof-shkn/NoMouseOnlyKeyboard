// src/pages/Finance/TrialBalance/utils/trialBalance.utils.ts
import { notifications } from '@mantine/notifications'
import {
  formatCurrencyAmount,
  getCurrencySymbol,
} from '../utils/currency.utils'

import {
  TrialBalanceEntry,
  TrialBalanceStats,
  TrialBalanceFilters,
  TrialBalanceSection,
} from '../types/trialBalance.types'
import {
  getTrialBalance,
  getTrialBalanceStats,
  getTrialBalanceByAccountType,
} from '../data/trialBalance.queries'

export interface FetchTrialBalanceResult {
  entries: TrialBalanceEntry[]
  stats: TrialBalanceStats
  sections: TrialBalanceSection[]
  currency: string
}

/**
 * Format currency for display
 * Currency is passed as parameter (from Redux settings in component)
 */
export const formatCurrency = (amount: number, currency?: string): string => {
  return formatCurrencyAmount(amount, currency, false)
}

/**
 * Format currency with symbol
 */
export const formatCurrencyWithSymbol = (
  amount: number,
  currency?: string,
): string => {
  return formatCurrencyAmount(amount, currency, true)
}

/**
 * Format account type for display
 */
export const formatAccountType = (type: string): string => {
  return type
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/**
 * Fetch trial balance data with statistics
 * Currency is obtained from Redux settings in the calling component
 */
export const fetchTrialBalanceData = async (
  filters: TrialBalanceFilters = {},
  currency: string = 'UGX',
): Promise<FetchTrialBalanceResult> => {
  const { startDate, endDate, companyId } = filters

  try {
    const [entriesResult, statsResult, groupedResult] = await Promise.all([
      getTrialBalance({ companyId, startDate, endDate }),
      getTrialBalanceStats(companyId, startDate, endDate),
      getTrialBalanceByAccountType(companyId, startDate, endDate),
    ])

    if (entriesResult.error) throw entriesResult.error
    if (statsResult.error) throw statsResult.error
    if (groupedResult.error) throw groupedResult.error

    const entries = entriesResult.data || []
    const stats = statsResult.data || {
      totalDebits: 0,
      totalCredits: 0,
      totalAccounts: 0,
      isBalanced: true,
    }
    const grouped = groupedResult.data || {}

    const sections = createSections(grouped)

    return {
      entries,
      stats: { ...stats, currency },
      sections,
      currency,
    }
  } catch (error: any) {
    console.error('Error fetching trial balance data:', error)
    notifications.show({
      title: 'Error',
      message: error.message || 'Failed to fetch trial balance data',
      color: 'red',
    })
    throw error
  }
}

/**
 * Create hierarchical sections from grouped data
 */
export const createSections = (grouped: {
  [key: string]: TrialBalanceEntry[]
}): TrialBalanceSection[] => {
  const sectionConfig = [
    { key: 'asset', title: 'Assets' },
    { key: 'liability', title: 'Liabilities' },
    { key: 'equity', title: 'Equity' },
    { key: 'revenue', title: 'Revenue' },
    { key: 'expense', title: 'Expenses' },
    { key: 'cost_of_goods_sold', title: 'Cost of Goods Sold' },
  ]

  return sectionConfig
    .filter(({ key }) => (grouped[key] || []).length > 0)
    .map(({ key, title }) => {
      const entries = grouped[key] || []
      const totalDebits = entries.reduce(
        (sum, e) => sum + (Number(e.total_debits) || 0),
        0,
      )
      const totalCredits = entries.reduce(
        (sum, e) => sum + (Number(e.total_credits) || 0),
        0,
      )
      return { title, entries, totalDebits, totalCredits, accountType: key }
    })
}

/**
 * Calculate section totals
 */
export const calculateSectionTotals = (
  entries: TrialBalanceEntry[],
): { totalDebits: number; totalCredits: number } => ({
  totalDebits: entries.reduce(
    (sum, e) => sum + (Number(e.total_debits) || 0),
    0,
  ),
  totalCredits: entries.reduce(
    (sum, e) => sum + (Number(e.total_credits) || 0),
    0,
  ),
})

/**
 * Validate date range
 */
export const validateDateRange = (
  startDate?: string,
  endDate?: string,
): string[] => {
  const errors: string[] = []
  if (startDate && endDate) {
    const start = new Date(startDate)
    const end = new Date(endDate)
    if (start > end) errors.push('Start date must be before end date')
    const diffDays = Math.ceil(
      Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
    )
    if (diffDays > 365) errors.push('Date range cannot exceed 365 days')
  }
  return errors
}

/**
 * Format date for display
 */
export const formatDate = (dateString?: string): string => {
  if (!dateString) return 'N/A'
  return new Date(dateString).toLocaleDateString('en-UG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/**
 * Get default date range (current fiscal year)
 */
export const getDefaultDateRange = (): {
  startDate: string
  endDate: string
} => {
  const year = new Date().getFullYear()
  return { startDate: `${year}-01-01`, endDate: `${year}-12-31` }
}

/**
 * Check if trial balance is balanced
 */
export const isBalanced = (
  totalDebits: number,
  totalCredits: number,
): boolean => Math.abs(totalDebits - totalCredits) < 0.01

/**
 * Get debit/credit display values from a TrialBalanceEntry.
 *
 * ✅ Uses net_balance (real v_trial_balance column).
 *    Falls back to balance compat alias for date-filtered rows
 *    built from journal_entry_lines.
 */
export const getBalanceDisplay = (
  entry: TrialBalanceEntry,
): { debit: number; credit: number } => {
  // net_balance is the real column name in v_trial_balance
  // balance is a compat alias populated by the queries layer
  const balance = Number(entry.net_balance ?? entry.balance) || 0

  if (entry.normal_balance === 'debit') {
    return { debit: balance, credit: 0 }
  } else {
    return { debit: 0, credit: balance }
  }
}

/**
 * Prepare data for PDF/Excel export
 */
export const prepareExportData = (
  sections: TrialBalanceSection[],
  stats: TrialBalanceStats,
  currency?: string,
): any[] => {
  const exportData: any[] = []

  sections.forEach((section) => {
    exportData.push({
      'Account Code': '',
      'Account Name': section.title,
      Debit: '',
      Credit: '',
      _isHeader: true,
    })

    section.entries.forEach((entry) => {
      const { debit, credit } = getBalanceDisplay(entry)
      exportData.push({
        'Account Code': entry.account_code,
        'Account Name': entry.account_name,
        Debit: debit > 0 ? formatCurrency(debit, currency) : '',
        Credit: credit > 0 ? formatCurrency(credit, currency) : '',
      })
    })

    exportData.push({
      'Account Code': '',
      'Account Name': `Total ${section.title}`,
      Debit: formatCurrency(section.totalDebits, currency),
      Credit: formatCurrency(section.totalCredits, currency),
      _isTotal: true,
    })

    exportData.push({
      'Account Code': '',
      'Account Name': '',
      Debit: '',
      Credit: '',
    })
  })

  exportData.push({
    'Account Code': '',
    'Account Name': 'TOTAL',
    Debit: formatCurrency(stats.totalDebits, currency),
    Credit: formatCurrency(stats.totalCredits, currency),
    _isGrandTotal: true,
  })

  return exportData
}

/**
 * Get account type badge color
 */
export const getAccountTypeBadgeColor = (type: string): string =>
  ({
    asset: 'blue',
    liability: 'red',
    equity: 'grape',
    revenue: 'green',
    expense: 'orange',
    cost_of_goods_sold: 'yellow',
  })[type] ?? 'gray'

