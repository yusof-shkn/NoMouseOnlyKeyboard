// src/features/main/CustomersManagement/utils/customersManagement.utils.ts

import { notifications } from '@mantine/notifications'
import { Customer, CustomerWithRelations } from '@shared/types/customer'
import {
  getCustomers,
  getCustomerStats,
  checkCustomerUsage,
} from '../data/customers.queries'

export interface CustomerStatsResponse {
  total: number
  active: number
  withCredit: number
  totalCreditLimit?: number
  outstandingCredit?: number
}

export const fetchCustomerStats = async (
  companyId: number,
): Promise<CustomerStatsResponse> => {
  try {
    const { data, error } = await getCustomerStats(companyId)
    if (error) throw error
    if (data) return data
    return { total: 0, active: 0, withCredit: 0 }
  } catch (error: any) {
    console.error('Error fetching customer stats:', error)
    notifications.show({
      title: 'Error',
      message: error.message || 'Failed to fetch customer statistics',
      color: 'red',
    })
    throw error
  }
}

export const fetchCustomersData = async ({
  page = 1,
  pageSize = 10,
  searchQuery = '',
  status = 'all',
  creditStatus = 'all',
  companyId,
}: {
  page?: number
  pageSize?: number
  searchQuery?: string
  status?: 'all' | 'active' | 'inactive'
  creditStatus?: 'all' | 'with_credit' | 'no_credit' | 'has_balance'
  companyId: number
}) => {
  try {
    const customersResult = await getCustomers({
      page,
      pageSize,
      searchQuery,
      status,
      creditStatus,
      companyId,
    })
    if (customersResult.error) throw customersResult.error
    return {
      customersData: customersResult.data || [],
      totalCount: customersResult.count || 0,
    }
  } catch (error: any) {
    console.error('Error fetching customers data:', error)
    notifications.show({
      title: 'Error',
      message: error.message || 'Failed to fetch customers data',
      color: 'red',
    })
    throw error
  }
}

export const canDeleteCustomer = async (
  customerId: number,
): Promise<{
  canDelete: boolean
  salesCount: number
  creditTransactionCount: number
  message?: string
}> => {
  try {
    const { data, error } = await checkCustomerUsage(customerId)
    if (error) throw new Error('Error checking customer usage')
    const salesCount = data?.salesCount || 0
    const creditTransactionCount = data?.creditTransactionCount || 0
    const totalBlockers = salesCount + creditTransactionCount
    let message: string | undefined
    if (totalBlockers > 0) {
      const parts: string[] = []
      if (salesCount > 0) parts.push(`${salesCount} sale(s)`)
      if (creditTransactionCount > 0)
        parts.push(`${creditTransactionCount} credit transaction(s)`)
      message = `Cannot delete: ${parts.join(' and ')} depend on this customer`
    }
    return {
      canDelete: totalBlockers === 0,
      salesCount,
      creditTransactionCount,
      message,
    }
  } catch (error: any) {
    console.error('Error checking customer usage:', error)
    return {
      canDelete: false,
      salesCount: 0,
      creditTransactionCount: 0,
      message: 'Error checking customer usage',
    }
  }
}

export const getStatusColor = (isActive: boolean): string =>
  isActive ? 'green' : 'red'

export const formatAddress = (customer: Customer): string =>
  customer.address || 'No address'

export const formatPhoneNumber = (phone: string): string => {
  if (!phone) return 'N/A'
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`
  } else if (cleaned.length === 12 && cleaned.startsWith('256')) {
    return `+${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6, 9)} ${cleaned.slice(9)}`
  }
  return phone
}

export const formatCurrency = (
  amount: number,
  currency: string = 'UGX',
): string => `${currency} ${amount.toLocaleString()}`

export const calculateCreditUtilization = (
  currentBalance: number,
  creditLimit: number,
): number => {
  if (creditLimit === 0) return 0
  return Math.round((currentBalance / creditLimit) * 100)
}

export const getCreditUtilizationColor = (utilizationPct: number): string => {
  if (utilizationPct >= 90) return 'red'
  if (utilizationPct >= 75) return 'orange'
  if (utilizationPct >= 50) return 'yellow'
  return 'green'
}

export const getDaysSinceLastPurchase = (
  lastPurchaseDate: string | null,
): number | null => {
  if (!lastPurchaseDate) return null
  const lastDate = new Date(lastPurchaseDate)
  const today = new Date()
  const diffTime = Math.abs(today.getTime() - lastDate.getTime())
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

export const isCustomerCreditOverdue = (
  customer: CustomerWithRelations,
): boolean => {
  if (!customer.current_credit_balance || customer.current_credit_balance === 0)
    return false
  if (!customer.last_purchase_date) return false
  const creditDays = customer.credit_days || 30
  const lastPurchase = new Date(customer.last_purchase_date)
  const today = new Date()
  const daysSincePurchase = Math.floor(
    (today.getTime() - lastPurchase.getTime()) / (1000 * 60 * 60 * 24),
  )
  return daysSincePurchase > creditDays
}

