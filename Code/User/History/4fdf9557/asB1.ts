// src/features/auth/authSlice.ts

import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { Company } from '@shared/types/company'
import { Profile } from '@shared/types/profile'
import { User } from '@shared/types/user'
import { CompanySettings } from '@shared/types/companySettings'

/**
 * Auth state interface
 */
interface AuthState {
  user: User | null
  company: Company | null
  companySettings: CompanySettings | null // 🔥 NEW: Company settings state
  isInitialized: boolean
  // 🔥 NEW: Permissions state
  permissions: {
    list: string[]
    isLoading: boolean
    isLoaded: boolean
    error: string | null
  }
}

/**
 * Initial state
 */
const initialState: AuthState = {
  user: null,
  company: null,
  companySettings: null, // 🔥 NEW: Initialize company settings
  isInitialized: false,
  // 🔥 NEW: Initialize permissions
  permissions: {
    list: [],
    isLoading: false,
    isLoaded: false,
    error: null,
  },
}

/**
 * Auth slice with all authentication state management
 */
const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    /**
     * Set user credentials and company data
     */
    setCredentials: (
      state,
      action: PayloadAction<{
        userId: string
        email: string
        profile: Profile
        company?: Company | null
        companySettings?: CompanySettings | null // 🔥 NEW: Add company settings
        last_sign_in_at?: string | null
      }>,
    ) => {
      const {
        userId,
        email,
        profile,
        company,
        companySettings,
        last_sign_in_at,
      } = action.payload

      state.user = {
        id: userId,
        email,
        profile,
        last_sign_in_at: last_sign_in_at ?? null,
      }
      state.company = company ?? null
      state.companySettings = companySettings ?? null // 🔥 NEW: Set company settings
      state.isInitialized = true
    },

    /**
     * Update company information
     */
    setCompany: (state, action: PayloadAction<Company | null>) => {
      state.company = action.payload
    },

    /**
     * 🔥 NEW: Set company settings
     */
    setCompanySettings: (
      state,
      action: PayloadAction<CompanySettings | null>,
    ) => {
      state.companySettings = action.payload
    },

    /**
     * Update user profile (partial update)
     */
    updateUserProfile: (state, action: PayloadAction<Partial<Profile>>) => {
      if (state.user?.profile) {
        state.user.profile = {
          ...state.user.profile,
          ...action.payload,
          updated_at: new Date().toISOString(),
        }
      }
    },

    /**
     * Update last login timestamp
     */
    updateLastLogin: (state, action: PayloadAction<string>) => {
      if (state.user?.profile) {
        state.user.profile.last_login = action.payload
      }
    },

    /**
     * Update company information (partial update)
     */
    updateCompany: (state, action: PayloadAction<Partial<Company>>) => {
      if (state.company) {
        state.company = {
          ...state.company,
          ...action.payload,
          updated_at: new Date().toISOString(),
        }
      }
    },

    /**
     * 🔥 NEW: Update company settings (partial update)
     */
    updateCompanySettings: (
      state,
      action: PayloadAction<Partial<CompanySettings>>,
    ) => {
      if (state.companySettings) {
        state.companySettings = {
          ...state.companySettings,
          ...action.payload,
          updated_at: new Date().toISOString(),
        }
      }
    },

    /**
     * Clear all auth state (logout)
     */
    clearAuth: (state) => {
      state.user = null
      state.company = null
      state.companySettings = null // 🔥 NEW: Clear company settings on logout
      state.isInitialized = false
      // 🔥 NEW: Clear permissions on logout
      state.permissions = {
        list: [],
        isLoading: false,
        isLoaded: false,
        error: null,
      }
    },

    // ========================================================================
    // 🔥 NEW: PERMISSION ACTIONS
    // ========================================================================

    /**
     * Set permissions loading state
     */
    setPermissionsLoading: (state, action: PayloadAction<boolean>) => {
      state.permissions.isLoading = action.payload
      if (action.payload) {
        // Clear error when starting new load
        state.permissions.error = null
      }
    },

    /**
     * Set loaded permissions
     */
    setPermissions: (state, action: PayloadAction<string[]>) => {
      state.permissions.list = action.payload
      state.permissions.isLoading = false
      state.permissions.isLoaded = true
      state.permissions.error = null
    },

    /**
     * Set permissions error
     */
    setPermissionsError: (state, action: PayloadAction<string>) => {
      state.permissions.error = action.payload
      state.permissions.isLoading = false
      state.permissions.isLoaded = true
    },

    /**
     * Clear permissions (for role changes or manual refresh)
     */
    clearPermissions: (state) => {
      state.permissions = {
        list: [],
        isLoading: false,
        isLoaded: false,
        error: null,
      }
    },
  },
})

// Export actions
export const {
  setCredentials,
  setCompany,
  setCompanySettings, // 🔥 NEW: Export company settings action
  updateUserProfile,
  updateLastLogin,
  updateCompany,
  updateCompanySettings, // 🔥 NEW: Export update company settings action
  clearAuth,
  // 🔥 NEW: Export permission actions
  setPermissionsLoading,
  setPermissions,
  setPermissionsError,
  clearPermissions,
} = authSlice.actions

// Export reducer
export default authSlice.reducer

// ============================================================================
// SELECTORS
// ============================================================================

/**
 * Select current user
 */
export const selectCurrentUser = (state: { auth: AuthState }) => state.auth.user

/**
 * Select current company
 */
export const selectCurrentCompany = (state: { auth: AuthState }) =>
  state.auth.company

/**
 * 🔥 NEW: Select current company settings
 */
export const selectCompanySettings = (state: { auth: AuthState }) =>
  state.auth.companySettings

/**
 * Select user profile
 */
export const selectUserProfile = (state: { auth: AuthState }) =>
  state.auth.user?.profile ?? null

/**
 * Select authentication status
 */
export const selectIsAuthenticated = (state: { auth: AuthState }) =>
  !!state.auth.user && state.auth.isInitialized

/**
 * Select user ID
 */
export const selectUserId = (state: { auth: AuthState }) =>
  state.auth.user?.id ?? null

/**
 * Select user email
 */
export const selectUserEmail = (state: { auth: AuthState }) =>
  state.auth.user?.email ?? null

/**
 * Select company ID
 */
export const selectCompanyId = (state: { auth: AuthState }) =>
  state.auth.company?.id ?? null

/**
 * Select user role ID
 */
export const selectUserRoleId = (state: { auth: AuthState }) =>
  state.auth.user?.profile?.role_id ?? null

/**
 * Select user's default store ID
 */
export const selectDefaultStoreId = (state: { auth: AuthState }) =>
  state.auth.user?.profile?.default_store_id ?? null

/**
 * Select user's default area ID
 */
export const selectDefaultAreaId = (state: { auth: AuthState }) =>
  state.auth.user?.profile?.default_area_id ?? null

/**
 * Select if user is active
 */
export const selectIsUserActive = (state: { auth: AuthState }) =>
  state.auth.user?.profile?.is_active ?? false

/**
 * Select if company is active
 */
export const selectIsCompanyActive = (state: { auth: AuthState }) =>
  state.auth.company?.is_active ?? false

/**
 * Select user full name
 */
export const selectUserFullName = (state: { auth: AuthState }) => {
  const profile = state.auth.user?.profile
  if (!profile) return null
  return `${profile.first_name} ${profile.last_name}`.trim()
}

/**
 * Select company name
 */
export const selectCompanyName = (state: { auth: AuthState }) =>
  state.auth.company?.company_name ?? null

/**
 * Select if auth is initialized
 */
export const selectIsAuthInitialized = (state: { auth: AuthState }) =>
  state.auth.isInitialized

/**
 * Select user initials for avatar
 */
export const selectUserInitials = (state: { auth: AuthState }) => {
  const profile = state.auth.user?.profile
  if (!profile) return ''
  const firstInitial = profile.first_name?.charAt(0).toUpperCase() || ''
  const lastInitial = profile.last_name?.charAt(0).toUpperCase() || ''
  return `${firstInitial}${lastInitial}`
}

/**
 * Select complete auth state (for debugging)
 */
export const selectAuthState = (state: { auth: AuthState }) => state.auth

// ========================================================================
// 🔥 NEW: PERMISSION SELECTORS
// ========================================================================

/**
 * Select permissions list
 */
export const selectPermissions = (state: { auth: AuthState }) =>
  state.auth.permissions.list

/**
 * Select permissions loading state
 */
export const selectPermissionsLoading = (state: { auth: AuthState }) =>
  state.auth.permissions.isLoading

/**
 * Select permissions loaded state
 */
export const selectPermissionsLoaded = (state: { auth: AuthState }) =>
  state.auth.permissions.isLoaded

/**
 * Select permissions error
 */
export const selectPermissionsError = (state: { auth: AuthState }) =>
  state.auth.permissions.error

/**
 * Select complete permissions state (for debugging)
 */
export const selectPermissionsState = (state: { auth: AuthState }) =>
  state.auth.permissions

// ========================================================================
// 🔥 NEW: COMPANY SETTINGS SELECTORS
// ========================================================================

/**
 * Select specific company setting by key
 */
export const selectCompanySetting = <K extends keyof CompanySettings>(
  state: { auth: AuthState },
  key: K,
): CompanySettings[K] | null => {
  return state.auth.companySettings?.[key] ?? null
}

/**
 * Select near expiry warning days
 */
export const selectNearExpiryWarningDays = (state: { auth: AuthState }) =>
  state.auth.companySettings?.near_expiry_warning_days ?? 30

/**
 * Select near expiry critical days
 */
export const selectNearExpiryCriticalDays = (state: { auth: AuthState }) =>
  state.auth.companySettings?.near_expiry_critical_days ?? 7

/**
 * Select if batch tracking is enabled
 */
export const selectBatchTrackingEnabled = (state: { auth: AuthState }) =>
  state.auth.companySettings?.enable_batch_tracking ?? false

/**
 * Select if credit system is enabled
 */

/**
 * Select default currency
 */
export const selectDefaultCurrency = (state: { auth: AuthState }) =>
  state.auth.companySettings?.default_currency ?? 'UGX'

/**
 * Select tax rate
 */
export const selectTaxRate = (state: { auth: AuthState }) =>
  state.auth.companySettings?.tax_rate ?? 0

/**
 * Select if negative stock is allowed
 */
export const selectAllowNegativeStock = (state: { auth: AuthState }) =>
  state.auth.companySettings?.allow_negative_stock ?? false

/**
 * Select low stock multiplier
 */
export const selectLowStockMultiplier = (state: { auth: AuthState }) =>
  state.auth.companySettings?.low_stock_multiplier ?? 1.5

/**
 * Select if auto-generate supplier codes is enabled
 */
export const selectAutoGenerateSupplierCodes = (state: { auth: AuthState }) =>
  state.auth.companySettings?.auto_generate_supplier_codes ?? true

/**
 * Select supplier code prefix
 */
export const selectSupplierCodePrefix = (state: { auth: AuthState }) =>
  state.auth.companySettings?.supplier_code_prefix ?? 'SUP'

