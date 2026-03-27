import { notifications } from '@mantine/notifications'
import { Supplier, SupplierWithRelations } from '@shared/types/suppliers'
import {
  getSuppliers,
  getSupplierStats,
  checkSupplierUsage,
  getSuppliersWithBalances,
  getSupplierStatsWithBalances,
} from '../data/suppliers.queries'

/**
 * Fetch suppliers with purchase order balance calculations
 */
export const fetchSuppliersData = async (params: {
  page?: number
  pageSize?: number
  searchQuery?: string
  status?: 'all' | 'active' | 'inactive'
  balanceFilter?: 'all' | 'with_balance' | 'no_balance'
  rating?: 'all' | '5' | '4' | '3' | '2' | '1'
  companyId: number
}) => {
  try {
    const { data, error, count } = await getSuppliersWithBalances(params)

    if (error) throw error

    return {
      suppliersData: data || [],
      totalCount: count || 0,
    }
  } catch (error: any) {
    console.error('Error fetching suppliers:', error)
    notifications.show({
      title: 'Error',
      message: error.message || 'Failed to fetch suppliers',
      color: 'red',
    })
    throw error
  }
}

/**
 * Fetch supplier statistics with balance information
 */
export const fetchSupplierStats = async (companyId: number) => {
  try {
    const { data, error } = await getSupplierStatsWithBalances(companyId)

    if (error) throw error

    return {
      total: data?.total || 0,
      active: data?.active || 0,
      withBalance: data?.withBalance || 0,
      totalOwed: data?.totalOwed || 0,
    }
  } catch (error: any) {
    console.error('Error fetching supplier stats:', error)
    notifications.show({
      title: 'Error',
      message: error.message || 'Failed to fetch supplier statistics',
      color: 'red',
    })
    return {
      total: 0,
      active: 0,
      withBalance: 0,
      totalOwed: 0,
    }
  }
}
/**
 * Enhanced validation for supplier data
 */
export const validateSupplierData = (data: {
  supplier_name: string
  phone: string
  email?: string
  company_id: number
  contact_person?: string
  payment_terms?: string
  credit_limit?: number
}): { valid: boolean; errors: string[] } => {
  const errors: string[] = []

  // Name validation
  if (!data.supplier_name?.trim()) {
    errors.push('Supplier name is required')
  } else if (data.supplier_name.trim().length < 2) {
    errors.push('Supplier name must be at least 2 characters')
  } else if (data.supplier_name.trim().length > 255) {
    errors.push('Supplier name must not exceed 255 characters')
  }

  // Phone validation
  if (!data.phone?.trim()) {
    errors.push('Phone number is required')
  } else if (!/^\+?[0-9]{10,15}$/.test(data.phone.replace(/[\s()-]/g, ''))) {
    errors.push('Invalid phone number format (10-15 digits)')
  }

  // Email validation (if provided)
  if (data.email?.trim()) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(data.email)) {
      errors.push('Invalid email format')
    } else if (data.email.length > 255) {
      errors.push('Email must not exceed 255 characters')
    }
  }

  // Contact person validation (if provided)
  if (data.contact_person && data.contact_person.length > 255) {
    errors.push('Contact person name must not exceed 255 characters')
  }

  // Payment terms validation (if provided)
  if (data.payment_terms && data.payment_terms.length > 100) {
    errors.push('Payment terms must not exceed 100 characters')
  }

  // Credit limit validation (if provided)
  if (data.credit_limit !== undefined && data.credit_limit < 0) {
    errors.push('Credit limit cannot be negative')
  }

  // Company validation
  if (!data.company_id || data.company_id <= 0) {
    errors.push('Valid company is required')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Format supplier data for display
 */
export const formatSupplierForDisplay = (
  supplier: SupplierWithRelations,
): SupplierWithRelations => {
  return {
    ...supplier,
    supplier_code: supplier.supplier_code || 'N/A',
    contact_person: supplier.contact_person || 'No contact',
    email: supplier.email || 'No email',
    city: supplier.city || 'N/A',
    country: supplier.country || 'Uganda',
  }
}

/**
 * Format phone number for display
 */
export const formatPhoneNumber = (phone: string): string => {
  if (!phone) return 'N/A'

  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, '')

  // Format based on length
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`
  } else if (cleaned.length === 12 && cleaned.startsWith('256')) {
    return `+${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6, 9)} ${cleaned.slice(9)}`
  }

  return phone
}

/**
 * Format currency for display - UPDATED to accept currency parameter
 * @param amount - Amount to format
 * @param currency - Currency code (e.g., 'UGX', 'USD', 'EUR')
 */
export const formatCurrency = (amount: number, currency: string): string => {
  return `${currency} ${amount.toLocaleString()}`
}

/**
 * Check if a supplier can be deleted
 */
export const canDeleteSupplier = async (
  supplierId: number,
): Promise<{
  canDelete: boolean
  purchaseOrderCount: number
  invoiceCount: number
  message?: string
}> => {
  try {
    const { data, error } = await checkSupplierUsage(supplierId)

    if (error) {
      throw new Error('Error checking supplier usage')
    }

    const purchaseOrderCount = data?.purchaseOrderCount || 0
    const invoiceCount = data?.invoiceCount || 0
    const totalBlockers = purchaseOrderCount + invoiceCount

    let message: string | undefined
    if (totalBlockers > 0) {
      const parts: string[] = []
      if (purchaseOrderCount > 0) {
        parts.push(`${purchaseOrderCount} purchase order(s)`)
      }
      if (invoiceCount > 0) {
        parts.push(`${invoiceCount} invoice(s)`)
      }
      message = `Cannot delete: ${parts.join(' and ')} depend on this supplier`
    }

    return {
      canDelete: totalBlockers === 0,
      purchaseOrderCount,
      invoiceCount,
      message,
    }
  } catch (error: any) {
    console.error('Error checking supplier usage:', error)
    return {
      canDelete: false,
      purchaseOrderCount: 0,
      invoiceCount: 0,
      message: 'Error checking supplier usage',
    }
  }
}

/**
 * Calculate supplier rating color
 */
export const getRatingColor = (rating: number | null): string => {
  if (!rating) return 'gray'
  if (rating >= 4) return 'green'
  if (rating >= 3) return 'yellow'
  if (rating >= 2) return 'orange'
  return 'red'
}

/**
 * Get supplier status badge color
 */
export const getStatusColor = (isActive: boolean): string => {
  return isActive ? 'green' : 'red'
}

/**
 * Format supplier address
 */
export const formatAddress = (supplier: Supplier): string => {
  const parts: string[] = []

  if (supplier.address) parts.push(supplier.address)
  if (supplier.city) parts.push(supplier.city)
  if (supplier.country) parts.push(supplier.country)

  return parts.join(', ') || 'No address'
}

/**
 * Calculate days since last order
 */
export const getDaysSinceLastOrder = (
  lastOrderDate: string | null,
): number | null => {
  if (!lastOrderDate) return null

  const lastDate = new Date(lastOrderDate)
  const today = new Date()
  const diffTime = Math.abs(today.getTime() - lastDate.getTime())
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

  return diffDays
}

/**
 * Get supplier payment status
 */
export const getPaymentStatus = (
  currentBalance: number,
  creditLimit: number,
): {
  status: 'good' | 'warning' | 'critical'
  message: string
} => {
  if (currentBalance === 0) {
    return { status: 'good', message: 'No outstanding balance' }
  }

  const percentageUsed = (currentBalance / creditLimit) * 100

  if (percentageUsed >= 90) {
    return { status: 'critical', message: 'Near credit limit' }
  } else if (percentageUsed >= 70) {
    return { status: 'warning', message: 'High balance' }
  } else {
    return { status: 'good', message: 'Normal balance' }
  }
}

/**
 * Validate supplier code format
 */
export const validateSupplierCode = (code: string): boolean => {
  // Auto-generated codes follow pattern: SUPXXXXXX
  const codeRegex = /^SUP\d{6}$/
  return codeRegex.test(code)
}

/**
 * Generate supplier summary
 */
export const generateSupplierSummary = (supplier: Supplier): string => {
  const parts: string[] = [supplier.supplier_name]

  if (supplier.contact_person) {
    parts.push(`Contact: ${supplier.contact_person}`)
  }

  if (supplier.phone) {
    parts.push(`Phone: ${formatPhoneNumber(supplier.phone)}`)
  }

  if (supplier.rating) {
    parts.push(`Rating: ${supplier.rating}/5`)
  }

  return parts.join(' | ')
}

