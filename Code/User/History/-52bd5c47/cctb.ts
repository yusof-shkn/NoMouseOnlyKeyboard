// src/pages/Income/utils/income.utils.ts

import {
  Income,
  IncomeStats,
  FetchIncomeResult,
  IncomeFilters,
} from '../types/income.types'
import { CompanySettings } from '@shared/types/companySettings'
import {
  getIncome,
  getIncomeCategories,
  getIncomeStats,
} from '../data/income.queries'

/**
 * Format currency based on company settings
 */
export const formatCurrency = (
  amount: number | null | undefined,
  settings?: CompanySettings,
): string => {
  if (amount === null || amount === undefined) return '—'
  const currency = settings?.default_currency || 'UGX'
  return new Intl.NumberFormat('en-UG', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

/**
 * Format date string to readable format
 */
export const formatDate = (dateStr: string | null | undefined): string => {
  if (!dateStr) return '—'
  try {
    return new Date(dateStr).toLocaleDateString('en-UG', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

/**
 * Get badge color for income status
 */
export const getStatusColor = (status: string): string => {
  switch (status) {
    case 'draft':
      return 'gray'
    case 'pending':
      return 'orange'
    case 'approved':
      return 'cyan'
    case 'posted':
      return 'green'
    case 'cancelled':
      return 'red'
    case 'void':
      return 'dark'
    default:
      return 'gray'
  }
}

/**
 * Get badge color for payment status
 */
export const getPaymentStatusColor = (status: string): string => {
  switch (status) {
    case 'paid':
      return 'green'
    case 'partially_paid':
    case 'partial':
      return 'yellow'
    case 'unpaid':
      return 'orange'
    case 'overdue':
      return 'red'
    case 'cancelled':
      return 'gray'
    default:
      return 'gray'
  }
}

/**
 * Get human-readable label for payment method
 */
export const getPaymentMethodLabel = (
  method: string | null | undefined,
): string => {
  if (!method) return '—'
  switch (method) {
    case 'cash':
      return 'Cash'
    case 'card':
    case 'credit_card':
    case 'debit_card':
      return 'Card'
    case 'mobile_money':
      return 'Mobile Money'
    case 'bank_transfer':
      return 'Bank Transfer'
    case 'insurance':
      return 'Insurance'
    case 'credit':
      return 'Credit'
    case 'check':
      return 'Cheque'
    default:
      return method.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  }
}

/**
 * Calculate days until payment due
 */
export const getDaysUntilDue = (income: Income): number | null => {
  if (!income.payment_date) return null
  const dueDate = new Date(income.payment_date)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = Math.ceil(
    (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  )
  return diff
}

/**
 * Check if income is overdue
 */
export const isIncomeOverdue = (income: Income): boolean => {
  if (!income.payment_date || income.payment_status === 'paid') return false
  const days = getDaysUntilDue(income)
  return days !== null && days < 0
}

/**
 * Check if an action can be performed on an income record
 */
export const canPerformAction = (
  income: Income,
  action: 'edit' | 'delete' | 'approve' | 'post',
): { allowed: boolean; reason?: string } => {
  // System-generated income cannot be edited or deleted
  if (action === 'edit' && income.is_system) {
    return {
      allowed: false,
      reason: `Auto-generated from ${income.reference_type || 'sale'}. Edit the source transaction instead.`,
    }
  }

  if (action === 'delete' && income.is_system) {
    return {
      allowed: false,
      reason: `Auto-generated from ${income.reference_type || 'sale'}. Cannot be deleted directly.`,
    }
  }

  if (action === 'approve') {
    if (income.status === 'approved' || income.status === 'posted') {
      return { allowed: false, reason: 'Already approved or posted' }
    }
    if (income.status === 'cancelled' || income.status === 'void') {
      return { allowed: false, reason: 'Cannot approve a cancelled record' }
    }
  }

  if (action === 'post') {
    if (income.is_posted) {
      return { allowed: false, reason: 'Already posted to journal' }
    }
    if (income.status !== 'approved') {
      return { allowed: false, reason: 'Must be approved before posting' }
    }
  }

  return { allowed: true }
}

/**
 * Calculate income totals from array
 */
export const calculateIncomeTotals = (
  data: Income[],
): {
  totalAmount: number
  totalTax: number
  grandTotal: number
  count: number
} => {
  return data.reduce(
    (acc, item) => ({
      totalAmount: acc.totalAmount + (item.amount || 0),
      totalTax: acc.totalTax + (item.tax_amount || 0),
      grandTotal: acc.grandTotal + (item.total_amount || 0),
      count: acc.count + 1,
    }),
    { totalAmount: 0, totalTax: 0, grandTotal: 0, count: 0 },
  )
}

/**
 * Fetch income data with categories
 */
export const fetchIncomeData = async (
  filters: IncomeFilters = {},
): Promise<FetchIncomeResult> => {
  const [incomeResult, categoriesResult] = await Promise.all([
    getIncome(filters),
    getIncomeCategories(filters.companyId || undefined),
  ])

  if (incomeResult.error) {
    console.error('Error fetching income:', incomeResult.error)
    throw incomeResult.error
  }

  return {
    incomeData: (incomeResult.data as Income[]) || [],
    categories: categoriesResult.data || [],
    totalCount: incomeResult.count || 0,
  }
}

/**
 * Fetch income statistics
 */
export const fetchIncomeStats = async (
  companyId?: number,
): Promise<IncomeStats> => {
  const { data, error } = await getIncomeStats(companyId)

  if (error) {
    console.error('Error fetching income stats:', error)
    return {
      total: 0,
      pending: 0,
      approved: 0,
      posted: 0,
      totalAmount: 0,
      currentMonthAmount: 0,
      systemGenerated: 0,
      manualEntries: 0,
    }
  }

  return {
    total: data?.total || 0,
    pending: data?.pending || 0,
    approved: data?.approved || 0,
    posted: data?.posted || 0,
    totalAmount: data?.totalAmount || 0,
    currentMonthAmount: data?.currentMonthAmount || 0,
    systemGenerated: data?.systemGenerated || 0,
    manualEntries: data?.manualEntries || 0,
  }
}

/**
 * Get primary text color for a given income source type
 */
export const getReferenceTypeColor = (
  referenceType: string | null | undefined,
): string => {
  switch (referenceType) {
    case 'sale':
      return 'violet'
    case 'manual':
      return 'blue'
    case 'adjustment':
      return 'orange'
    default:
      return 'gray'
  }
}

