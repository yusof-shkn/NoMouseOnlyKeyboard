// src/features/main/CustomerForm/utils/customerForm.utils.ts

/**
 * Validates customer data before submission
 */
export const validateCustomerData = (data: {
  first_name: string
  last_name: string
  phone: string
  email?: string
  company_id: number
  credit_limit?: number
}): { valid: boolean; errors: string[] } => {
  const errors: string[] = []

  if (!data.first_name?.trim()) {
    errors.push('First name is required')
  } else if (data.first_name.trim().length < 2) {
    errors.push('First name must be at least 2 characters')
  } else if (data.first_name.trim().length > 100) {
    errors.push('First name must not exceed 100 characters')
  }

  if (!data.last_name?.trim()) {
    errors.push('Last name is required')
  } else if (data.last_name.trim().length < 2) {
    errors.push('Last name must be at least 2 characters')
  } else if (data.last_name.trim().length > 100) {
    errors.push('Last name must not exceed 100 characters')
  }

  if (!data.phone?.trim()) {
    errors.push('Phone number is required')
  } else {
    const cleaned = data.phone.replace(/[\s()-]/g, '')
    if (!/^\+?[0-9]{10,15}$/.test(cleaned)) {
      errors.push('Invalid phone number format (10-15 digits required)')
    }
  }

  if (data.email?.trim()) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(data.email)) {
      errors.push('Invalid email format')
    } else if (data.email.length > 100) {
      errors.push('Email must not exceed 100 characters')
    }
  }

  if (data.credit_limit !== undefined && data.credit_limit < 0) {
    errors.push('Credit limit cannot be negative')
  }

  if (!data.company_id || data.company_id <= 0) {
    errors.push('Valid company is required')
  }

  return { valid: errors.length === 0, errors }
}

/**
 * Format phone number for display
 */
export const formatPhoneNumber = (phone: string): string => {
  if (!phone) return ''
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`
  } else if (cleaned.length === 12 && cleaned.startsWith('256')) {
    return `+${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6, 9)} ${cleaned.slice(9)}`
  }
  return phone
}

/**
 * Sanitize phone number for storage
 */
export const sanitizePhoneNumber = (phone: string): string => {
  if (!phone) return ''
  let cleaned = phone.replace(/[^\d+]/g, '')
  if (cleaned.length > 10 && !cleaned.startsWith('+')) {
    cleaned = '+' + cleaned
  }
  return cleaned
}

/**
 * Format currency for display
 */
export const formatCurrency = (
  amount: number,
  currency: string = 'UGX',
): string => {
  return `${currency} ${amount.toLocaleString()}`
}

/**
 * Calculate credit utilization percentage
 */
export const calculateCreditUtilization = (
  currentBalance: number,
  creditLimit: number,
): number => {
  if (creditLimit === 0) return 0
  return Math.round((currentBalance / creditLimit) * 100)
}

/**
 * Get credit status color
 */
export const getCreditStatusColor = (
  currentBalance: number,
  creditLimit: number,
): string => {
  const utilization = calculateCreditUtilization(currentBalance, creditLimit)
  if (utilization >= 90) return 'red'
  if (utilization >= 70) return 'orange'
  if (utilization >= 50) return 'yellow'
  return 'green'
}

/**
 * Get credit days display text
 */
export const getCreditDaysDisplay = (days: number): string => {
  if (days === 0) return 'Cash only'
  if (days === 7) return '1 week'
  if (days === 14) return '2 weeks'
  if (days === 30) return '1 month'
  if (days === 60) return '2 months'
  if (days === 90) return '3 months'
  return `${days} days`
}

/**
 * Validate insurance expiry date
 */
export const validateInsuranceExpiryDate = (
  expiryDate: string,
): { valid: boolean; message?: string } => {
  if (!expiryDate) return { valid: true }
  const expiry = new Date(expiryDate)
  const today = new Date()
  if (expiry < today) {
    return { valid: false, message: 'Insurance has expired' }
  }
  const thirtyDaysFromNow = new Date()
  thirtyDaysFromNow.setDate(today.getDate() + 30)
  if (expiry <= thirtyDaysFromNow) {
    return { valid: true, message: 'Insurance expiring soon' }
  }
  return { valid: true }
}

/**
 * Check insurance expiry warning
 */
export const checkInsuranceExpiry = (
  expiryDate: string | null,
): {
  expired: boolean
  expiresInDays: number | null
  warning: string | null
} => {
  if (!expiryDate) return { expired: false, expiresInDays: null, warning: null }
  const expiry = new Date(expiryDate)
  const today = new Date()
  const diffTime = expiry.getTime() - today.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  if (diffDays < 0) {
    return {
      expired: true,
      expiresInDays: diffDays,
      warning: 'Insurance has expired',
    }
  } else if (diffDays <= 30) {
    return {
      expired: false,
      expiresInDays: diffDays,
      warning: `Insurance expires in ${diffDays} days`,
    }
  }
  return { expired: false, expiresInDays: diffDays, warning: null }
}

