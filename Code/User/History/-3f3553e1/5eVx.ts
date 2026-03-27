// src/pages/Finance/Expenses/utils/expense.utils.ts
import { notifications } from '@mantine/notifications'
import { CompanySettings } from '@shared/types/companySettings'
import {
  Expense,
  ExpenseFilters,
  ExpenseStats,
  FetchExpensesResult,
  ExpenseCategory,
} from '../types/expense.types'
import {
  getExpenses,
  getExpenseStats,
  getExpenseCategories,
} from '../data/expense.queries'

/**
 * Fetch expense statistics
 */
export const fetchExpenseStats = async (
  companyId?: number,
): Promise<ExpenseStats> => {
  try {
    const { data, error } = await getExpenseStats(companyId)

    if (error) throw error

    return (
      data || {
        total: 0,
        pending: 0,
        approved: 0,
        totalAmount: 0,
        monthlyAmount: 0,
      }
    )
  } catch (error: any) {
    console.error('Error fetching expense stats:', error)
    notifications.show({
      title: 'Error',
      message: error.message || 'Failed to fetch expense statistics',
      color: 'red',
    })
    throw error
  }
}

/**
 * Fetch expenses data with filters
 */
export const fetchExpensesData = async (
  filters: ExpenseFilters = {},
): Promise<FetchExpensesResult> => {
  const {
    page = 1,
    pageSize = 10,
    searchQuery = '',
    status = 'all',
    categoryId = null,
    companyId = null,
    storeId = null,
    startDate = null,
    endDate = null,
    paymentMethod = 'all',
    paymentStatus = 'all',
  } = filters

  try {
    const {
      data: expensesData,
      error: expensesError,
      count: totalCount,
    } = await getExpenses({
      page,
      pageSize,
      searchQuery,
      status,
      categoryId,
      companyId,
      storeId,
      startDate,
      endDate,
      paymentMethod,
      paymentStatus,
    })

    if (expensesError) throw expensesError

    const { data: categoriesData, error: categoriesError } =
      await getExpenseCategories(companyId ? Number(companyId) : undefined)
    if (categoriesError) {
      console.warn('Could not fetch categories data:', categoriesError)
    }

    return {
      expensesData: (expensesData || []) as Expense[],
      categoriesData: (categoriesData || []) as ExpenseCategory[],
      totalCount: totalCount || 0,
    }
  } catch (error: any) {
    console.error('Error fetching expenses data:', error)
    notifications.show({
      title: 'Error',
      message: error.message || 'Failed to fetch expenses data',
      color: 'red',
    })
    throw error
  }
}

/**
 * Generate expense number based on company settings from Redux
 * Uses expense_category_prefix from settings, falls back to 'EXP' if not available
 */
export const generateExpenseNumber = (
  settings?: CompanySettings | null,
  padding: number = 3,
): string => {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  // Get expense prefix from settings, fallback to 'EXP'
  const prefix = settings?.expense_category_prefix || 'EXP'

  // Get padding from settings, fallback to parameter
  const numberPadding =
    settings?.expense_category_number_padding ||
    settings?.document_number_padding ||
    padding

  const random = Math.floor(Math.random() * Math.pow(10, numberPadding))
    .toString()
    .padStart(numberPadding, '0')

  return `${prefix}-${year}${month}${day}-${random}`
}

/**
 * Calculate total amount (amount + tax)
 */
export const calculateTotalAmount = (
  amount: number | string,
  taxAmount: number | string,
): number => {
  const numAmount =
    typeof amount === 'string' ? parseFloat(amount) || 0 : amount
  const numTax =
    typeof taxAmount === 'string' ? parseFloat(taxAmount) || 0 : taxAmount
  return numAmount + numTax
}

/**
 * Calculate tax amount from rate and amount
 */
export const calculateTaxAmount = (
  amount: number | string,
  taxRate: number,
): number => {
  const numAmount =
    typeof amount === 'string' ? parseFloat(amount) || 0 : amount
  return (numAmount * taxRate) / 100
}

/**
 * Validate expense data before submission
 */
export const validateExpenseData = (data: Partial<Expense>): string[] => {
  const errors: string[] = []

  if (!data.expense_date) {
    errors.push('Expense date is required')
  }

  if (!data.category_id) {
    errors.push('Category is required')
  }

  if (!data.description?.trim()) {
    errors.push('Description is required')
  }

  if (!data.amount || data.amount <= 0) {
    errors.push('Amount must be greater than 0')
  }

  if (!data.payment_method) {
    errors.push('Payment method is required')
  }

  if (data.is_recurring) {
    if (!data.recurrence_frequency) {
      errors.push('Recurrence frequency is required for recurring expenses')
    }
    if (!data.recurrence_start_date) {
      errors.push('Recurrence start date is required for recurring expenses')
    }
  }

  return errors
}

/**
 * Format currency based on company settings from Redux
 */
export const formatCurrency = (
  amount?: number,
  settings?: CompanySettings | null,
): string => {
  if (!amount) return '0'

  return amount.toLocaleString('en-UG', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
}

/**
 * Get currency symbol/code from company settings from Redux
 */
export const getCurrencyCode = (settings?: CompanySettings | null): string => {
  return settings?.default_currency || settings?.base_currency || 'UGX'
}

/**
 * Format date to display format
 */
export const formatDate = (dateString?: string): string => {
  if (!dateString) return 'N/A'
  return new Date(dateString).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

/**
 * Format date to ISO string (for database)
 */
export const formatDateForDB = (date: Date | string): string => {
  if (typeof date === 'string') return date
  return date.toISOString().split('T')[0]
}

/**
 * Get status color
 */
export const getStatusColor = (status: string): string => {
  const colors: Record<string, string> = {
    draft: 'gray',
    pending: 'yellow',
    approved: 'blue',
    posted: 'green',
    cancelled: 'red',
    void: 'red',
  }
  return colors[status] || 'gray'
}

/**
 * Get payment status color
 */
export const getPaymentStatusColor = (status: string): string => {
  const colors: Record<string, string> = {
    unpaid: 'red',
    partial: 'yellow',
    paid: 'green',
    overdue: 'orange',
    cancelled: 'gray',
  }
  return colors[status] || 'gray'
}

/**
 * Format payment method for display
 */
export const formatPaymentMethod = (method?: string): string => {
  if (!method) return 'N/A'
  return method.replace(/_/g, ' ').toUpperCase()
}

/**
 * Check if expense can be edited
 */
export const canEditExpense = (expense: Expense): boolean => {
  // Cannot edit system-generated expenses
  if (expense.is_system) return false

  // Can only edit draft or pending expenses
  return expense.status === 'draft' || expense.status === 'pending'
}

/**
 * Check if expense can be deleted
 */
export const canDeleteExpense = (expense: Expense): boolean => {
  // Cannot delete system-generated expenses
  if (expense.is_system) return false

  // Cannot delete posted expenses
  return expense.status !== 'posted'
}

/**
 * Check if expense can be approved
 */
export const canApproveExpense = (expense: Expense): boolean => {
  return expense.status === 'pending'
}

/**
 * Check if expense can be posted
 */
export const canPostExpense = (expense: Expense): boolean => {
  return expense.status === 'approved'
}

/**
 * Check if expense is system-generated
 */
export const isSystemExpense = (expense: Expense): boolean => {
  return expense.is_system === true
}

/**
 * Get expense source type label
 */
export const getExpenseSourceLabel = (expense: Expense): string => {
  if (!expense.is_system) return 'Manual Entry'

  switch (expense.reference_type) {
    case 'purchase_order':
      return 'Purchase Order'
    case 'manual':
      return 'Manual Entry'
    case 'adjustment':
      return 'Adjustment'
    default:
      return 'Unknown'
  }
}

/**
 * Parse number safely
 */
export const parseNumber = (value: any): number => {
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const parsed = parseFloat(value)
    return isNaN(parsed) ? 0 : parsed
  }
  return 0
}

/**
 * Parse ID safely
 */
export const parseId = (value: any): number | null => {
  if (value == null || value === '') return null
  const parsed = typeof value === 'string' ? parseInt(value, 10) : value
  return isNaN(parsed) ? null : parsed
}

/**
 * Get recurrence frequency label
 */
export const getRecurrenceLabel = (frequency?: string): string => {
  const labels: Record<string, string> = {
    one_time: 'One Time',
    daily: 'Daily',
    weekly: 'Weekly',
    biweekly: 'Bi-Weekly',
    monthly: 'Monthly',
    quarterly: 'Quarterly',
    semi_annually: 'Semi-Annually',
    annually: 'Annually',
  }
  return labels[frequency || 'one_time'] || 'One Time'
}

/**
 * Calculate next recurrence date
 */
export const calculateNextRecurrenceDate = (
  startDate: Date,
  frequency: string,
): Date => {
  const nextDate = new Date(startDate)

  switch (frequency) {
    case 'daily':
      nextDate.setDate(nextDate.getDate() + 1)
      break
    case 'weekly':
      nextDate.setDate(nextDate.getDate() + 7)
      break
    case 'biweekly':
      nextDate.setDate(nextDate.getDate() + 14)
      break
    case 'monthly':
      nextDate.setMonth(nextDate.getMonth() + 1)
      break
    case 'quarterly':
      nextDate.setMonth(nextDate.getMonth() + 3)
      break
    case 'semi_annually':
      nextDate.setMonth(nextDate.getMonth() + 6)
      break
    case 'annually':
      nextDate.setFullYear(nextDate.getFullYear() + 1)
      break
    default:
      break
  }

  return nextDate
}

/**
 * Check if date is in range
 */
export const isDateInRange = (
  date: string,
  startDate?: string | null,
  endDate?: string | null,
): boolean => {
  const checkDate = new Date(date)

  if (startDate && checkDate < new Date(startDate)) {
    return false
  }

  if (endDate && checkDate > new Date(endDate)) {
    return false
  }

  return true
}

/**
 * Get expense summary by category
 */
export const getExpenseSummaryByCategory = (
  expenses: Expense[],
): Record<string, { count: number; total: number }> => {
  return expenses.reduce(
    (acc, expense) => {
      const categoryName =
        expense.expense_categories?.category_name || 'Uncategorized'
      if (!acc[categoryName]) {
        acc[categoryName] = { count: 0, total: 0 }
      }
      acc[categoryName].count++
      acc[categoryName].total += expense.total_amount || 0
      return acc
    },
    {} as Record<string, { count: number; total: number }>,
  )
}

/**
 * Get expense summary by month
 */
export const getExpenseSummaryByMonth = (
  expenses: Expense[],
): Record<string, { count: number; total: number }> => {
  return expenses.reduce(
    (acc, expense) => {
      if (!expense.expense_date) return acc

      const date = new Date(expense.expense_date)
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

      if (!acc[monthKey]) {
        acc[monthKey] = { count: 0, total: 0 }
      }
      acc[monthKey].count++
      acc[monthKey].total += expense.total_amount || 0
      return acc
    },
    {} as Record<string, { count: number; total: number }>,
  )
}

