/**
 * Menu to Permissions Mapping with Role-Based Access
 * ✅ FIXED: Aligned with role documentation
 */

import { Permission } from '@shared/constants/permissions'
import { Role } from '@shared/constants/roles'

export interface MenuPermissionConfig {
  path: string
  permissions: string[]
  requireAll?: boolean
  allowedRoles?: number[] // Roles that can access this route
  blockedRoles?: number[] // Roles explicitly blocked from this route
  accessLevel?: 'company' | 'area' | 'store' // Required access level
}

/**
 * Route-based permission configuration with role restrictions
 */
export const routePermissions: Record<string, MenuPermissionConfig> = {
  // ============================================================================
  // MAIN MODULE
  // ============================================================================
  '/': {
    path: '/',
    permissions: [Permission.DASHBOARD_VIEW],
    // ✅ FIXED: All roles except Cashier can access dashboard
    blockedRoles: [Role.cashier],
  },

  '/user-management': {
    path: '/user-management',
    permissions: [Permission.USERS_READ],
    // ✅ FIXED: Only Company Admin (per docs: "Pages ONLY Company Admin Can Access")
    allowedRoles: [Role.company_admin],
    accessLevel: 'company',
  },

  '/areas-management': {
    path: '/areas-management',
    permissions: [Permission.AREAS_READ],
    // ✅ FIXED: Only Company Admin
    allowedRoles: [Role.company_admin],
    accessLevel: 'company',
  },

  '/stores-management': {
    path: '/stores-management',
    permissions: [Permission.STORES_READ],
    // ✅ FIXED: Company Admin + Area Admin (per docs: "Pages Company Admin + Area Admin Can Access")
    allowedRoles: [Role.company_admin, Role.area_admin],
  },

  '/roles-permissions': {
    path: '/roles-permissions',
    permissions: [Permission.ROLES_READ, Permission.PERMISSIONS_READ],
    // ✅ FIXED: Only Company Admin
    allowedRoles: [Role.company_admin],
    accessLevel: 'company',
  },

  // ============================================================================
  // ITEMS MASTER MODULE
  // ============================================================================
  '/items-master/products': {
    path: '/items-master/products',
    permissions: [Permission.PRODUCTS_READ],
    // ✅ FIXED: Everyone except Accounting Manager and Cashier (Cashier has read-only)
    blockedRoles: [Role.accounting_manager],
  },

  '/items-master/products/categories': {
    path: '/items-master/products/categories',
    permissions: [Permission.CATEGORIES_READ],
    blockedRoles: [Role.accounting_manager],
  },

  '/items-master/products/units': {
    path: '/items-master/products/units',
    permissions: [Permission.UNITS_READ],
    blockedRoles: [Role.accounting_manager],
  },

  '/items-master/bar-codes': {
    path: '/items-master/bar-codes',
    permissions: [Permission.BARCODES_READ],
    blockedRoles: [Role.accounting_manager],
  },

  // ============================================================================
  // INVENTORY MODULE
  // ============================================================================
  '/inventory/stock-list': {
    path: '/inventory/stock-list',
    permissions: [Permission.INVENTORY_READ],
    // ✅ FIXED: All except Sales Manager (read-only), Cashier (read-only), and Accounting Manager (read-only)
    // For management pages, we allow those with FULL access
    allowedRoles: [
      Role.company_admin,
      Role.area_admin,
      Role.store_admin,
      Role.inventory_manager,
    ],
  },

  '/inventory/low-stock': {
    path: '/inventory/low-stock',
    permissions: [Permission.LOW_STOCK_READ],
    allowedRoles: [
      Role.company_admin,
      Role.area_admin,
      Role.store_admin,
      Role.inventory_manager,
    ],
  },

  '/inventory/fast-moving-items': {
    path: '/inventory/fast-moving-items',
    permissions: [Permission.FAST_MOVING_READ],
    allowedRoles: [
      Role.company_admin,
      Role.area_admin,
      Role.store_admin,
      Role.inventory_manager,
    ],
  },

  '/inventory/expiring-soon': {
    path: '/inventory/expiring-soon',
    permissions: [Permission.EXPIRING_READ],
    allowedRoles: [
      Role.company_admin,
      Role.area_admin,
      Role.store_admin,
      Role.inventory_manager,
    ],
  },

  '/inventory/stock-adjustment': {
    path: '/inventory/stock-adjustment',
    permissions: [Permission.STOCK_ADJUST],
    allowedRoles: [
      Role.company_admin,
      Role.area_admin,
      Role.store_admin,
      Role.inventory_manager,
    ],
  },

  '/inventory/stock-history': {
    path: '/inventory/stock-history',
    permissions: [Permission.STOCK_HISTORY_READ],
    allowedRoles: [
      Role.company_admin,
      Role.area_admin,
      Role.store_admin,
      Role.inventory_manager,
    ],
  },

  // BUG FIX: New transfer stock feature - route was missing entirely from routePermissions
  '/inventory/stock-transfer': {
    path: '/inventory/stock-transfer',
    permissions: [Permission.TRANSFERS_READ],
    allowedRoles: [
      Role.company_admin,
      Role.area_admin,
      Role.store_admin,
      Role.inventory_manager,
    ],
  },

  // ============================================================================
  // SALES MODULE
  // ============================================================================
  '/sales/pos': {
    path: '/sales/pos',
    permissions: [Permission.SALES_POS_ACCESS],
    // ✅ FIXED: All except Inventory Manager and Accounting Manager
    allowedRoles: [
      Role.company_admin,
      Role.area_admin,
      Role.store_admin,
      Role.sale_manager,
      Role.cashier,
    ],
  },

  '/sales/orders': {
    path: '/sales/orders',
    permissions: [Permission.SALES_ORDERS_READ],
    // ✅ FIXED: Cashier can view own sales (POS History only)
    allowedRoles: [
      Role.company_admin,
      Role.area_admin,
      Role.store_admin,
      Role.sale_manager,
      Role.cashier,
    ],
  },

  '/sales/customers': {
    path: '/sales/customers',
    permissions: [Permission.CUSTOMERS_READ],
    // ✅ FIXED: All except Inventory Manager, Accounting Manager, and Cashier
    allowedRoles: [
      Role.company_admin,
      Role.area_admin,
      Role.store_admin,
      Role.sale_manager,
    ],
  },

  '/sales/invoice': {
    path: '/sales/invoice',
    permissions: [Permission.INVOICES_READ],
    // ✅ FIXED: Cashier has read + print only
    allowedRoles: [
      Role.company_admin,
      Role.area_admin,
      Role.store_admin,
      Role.sale_manager,
      Role.cashier,
    ],
  },

  '/sales/sales-return': {
    path: '/sales/sales-return',
    permissions: [Permission.SALES_RETURNS_READ],
    allowedRoles: [
      Role.company_admin,
      Role.area_admin,
      Role.store_admin,
      Role.sale_manager,
    ],
  },

  '/sales/quotation': {
    path: '/sales/quotation',
    permissions: [Permission.QUOTATIONS_READ],
    allowedRoles: [
      Role.company_admin,
      Role.area_admin,
      Role.store_admin,
      Role.sale_manager,
    ],
  },

  // ============================================================================
  // PURCHASES MODULE
  // ============================================================================
  '/purchases/pop': {
    path: '/purchases/pop',
    permissions: [Permission.PURCHASES_POP_ACCESS],
    // ✅ FIXED: All except Sales Manager, Cashier, and Accounting Manager (read-only)
    allowedRoles: [
      Role.company_admin,
      Role.area_admin,
      Role.store_admin,
      Role.inventory_manager,
    ],
  },

  '/purchases/suppliers': {
    path: '/purchases/suppliers',
    permissions: [Permission.SUPPLIERS_READ],
    allowedRoles: [
      Role.company_admin,
      Role.area_admin,
      Role.store_admin,
      Role.inventory_manager,
    ],
  },

  '/purchases/order-history': {
    path: '/purchases/order-history',
    permissions: [Permission.PURCHASE_ORDERS_READ],
    allowedRoles: [
      Role.company_admin,
      Role.area_admin,
      Role.store_admin,
      Role.inventory_manager,
    ],
  },

  '/purchases/order-items': {
    path: '/purchases/order-items',
    permissions: [Permission.PURCHASE_ORDER_ITEMS_READ],
    allowedRoles: [
      Role.company_admin,
      Role.area_admin,
      Role.store_admin,
      Role.inventory_manager,
    ],
  },

  '/purchases/purchase-return': {
    path: '/purchases/purchase-return',
    permissions: [Permission.PURCHASE_RETURNS_READ],
    allowedRoles: [
      Role.company_admin,
      Role.area_admin,
      Role.store_admin,
      Role.inventory_manager,
    ],
  },

  // ============================================================================
  // FINANCE & ACCOUNTS MODULE
  // ============================================================================
  '/accounting/credits': {
    path: '/accounting/credits',
    permissions: [Permission.CREDITS_READ],
    // ✅ FIXED: Company Admin, Area Admin, Store Admin, and Accounting Manager
    allowedRoles: [
      Role.company_admin,
      Role.area_admin,
      Role.store_admin,
      Role.accounting_manager,
    ],
  },

  '/expense': {
    path: '/expense',
    permissions: [Permission.EXPENSES_READ],
    // ✅ FIXED: Company Admin, Area Admin, Store Admin, and Accounting Manager
    allowedRoles: [
      Role.company_admin,
      Role.area_admin,
      Role.store_admin,
      Role.accounting_manager,
    ],
  },

  '/expense-category': {
    path: '/expense-category',
    permissions: [Permission.EXPENSE_CATEGORIES_READ],
    allowedRoles: [
      Role.company_admin,
      Role.area_admin,
      Role.store_admin,
      Role.accounting_manager,
    ],
  },

  '/income': {
    path: '/income',
    permissions: [Permission.INCOME_READ],
    allowedRoles: [
      Role.company_admin,
      Role.area_admin,
      Role.store_admin,
      Role.accounting_manager,
    ],
  },

  '/income-category': {
    path: '/income-category',
    permissions: [Permission.INCOME_CATEGORIES_READ],
    allowedRoles: [
      Role.company_admin,
      Role.area_admin,
      Role.store_admin,
      Role.accounting_manager,
    ],
  },

  // BUG FIX: Was '/balance-sheet' but actual route path is '/accounting/balance-sheet'
  // This meant balance sheet had NO permission check - anyone could navigate directly to it
  '/accounting/balance-sheet': {
    path: '/accounting/balance-sheet',
    permissions: [Permission.FINANCIAL_REPORTS_BALANCE_SHEET],
    allowedRoles: [Role.company_admin, Role.accounting_manager],
  },

  '/trial-balance': {
    path: '/trial-balance',
    permissions: [Permission.FINANCIAL_REPORTS_TRIAL_BALANCE],
    allowedRoles: [Role.company_admin, Role.accounting_manager],
  },

  '/cash-flow': {
    path: '/cash-flow',
    permissions: [Permission.CASH_FLOW_READ],
    allowedRoles: [Role.company_admin, Role.accounting_manager],
  },

  // ============================================================================
  // SETTINGS & PROFILE
  // ============================================================================
  '/company-settings': {
    path: '/company-settings',
    permissions: [Permission.COMPANY_SETTINGS_READ],
    allowedRoles: [Role.company_admin], // Only Company Admin
    accessLevel: 'company',
  },

  '/profile': {
    path: '/profile',
    permissions: [Permission.PROFILE_VIEW],
    // All authenticated users
  },

  '/notifications': {
    path: '/notifications',
    permissions: [Permission.NOTIFICATIONS_READ],
    // All authenticated users
  },
}

/**
 * Menu item permission configuration with role restrictions
 */
export const menuItemPermissions: Record<
  string,
  {
    permissions: string[]
    allowedRoles?: number[]
    blockedRoles?: number[]
  }
> = {
  // ============================================================================
  // MAIN MODULE
  // ============================================================================
  Dashboard: {
    permissions: [Permission.DASHBOARD_VIEW],
    // ✅ FIXED: All roles except Cashier
    blockedRoles: [Role.cashier],
  },
  Users: {
    permissions: [Permission.USERS_READ],
    // ✅ FIXED: Only Company Admin
    allowedRoles: [Role.company_admin],
  },
  Areas: {
    permissions: [Permission.AREAS_READ],
    // ✅ FIXED: Only Company Admin
    allowedRoles: [Role.company_admin],
  },
  Stores: {
    permissions: [Permission.STORES_READ],
    // ✅ FIXED: Company Admin + Area Admin
    allowedRoles: [Role.company_admin, Role.area_admin],
  },
  'Roles and Permissions': {
    permissions: [Permission.ROLES_READ],
    // ✅ FIXED: Only Company Admin
    allowedRoles: [Role.company_admin],
  },

  // ============================================================================
  // ITEMS MASTER MODULE
  // ============================================================================
  Products: {
    permissions: [Permission.PRODUCTS_READ],
    // ✅ FIXED: Everyone except Accounting Manager
    blockedRoles: [Role.accounting_manager],
  },
  Categories: {
    permissions: [Permission.CATEGORIES_READ],
    blockedRoles: [Role.accounting_manager],
  },
  Units: {
    permissions: [Permission.UNITS_READ],
    blockedRoles: [Role.accounting_manager],
  },
  'Barcode Manager': {
    permissions: [Permission.BARCODES_READ],
    blockedRoles: [Role.accounting_manager],
  },

  // ============================================================================
  // INVENTORY MODULE
  // ============================================================================
  'Stock List': {
    permissions: [Permission.INVENTORY_READ],
    allowedRoles: [
      Role.company_admin,
      Role.area_admin,
      Role.store_admin,
      Role.inventory_manager,
    ],
  },
  'Low Stock': {
    permissions: [Permission.LOW_STOCK_READ],
    allowedRoles: [
      Role.company_admin,
      Role.area_admin,
      Role.store_admin,
      Role.inventory_manager,
    ],
  },
  'Fast Moving Items': {
    permissions: [Permission.FAST_MOVING_READ],
    allowedRoles: [
      Role.company_admin,
      Role.area_admin,
      Role.store_admin,
      Role.inventory_manager,
    ],
  },
  'Expiring Soon': {
    permissions: [Permission.EXPIRING_READ],
    allowedRoles: [
      Role.company_admin,
      Role.area_admin,
      Role.store_admin,
      Role.inventory_manager,
    ],
  },
  'Stock Adjustment': {
    permissions: [Permission.STOCK_ADJUST],
    allowedRoles: [
      Role.company_admin,
      Role.area_admin,
      Role.store_admin,
      Role.inventory_manager,
    ],
  },
  'Stock History': {
    permissions: [Permission.STOCK_HISTORY_READ],
    allowedRoles: [
      Role.company_admin,
      Role.area_admin,
      Role.store_admin,
      Role.inventory_manager,
    ],
  },
  // NEW: Transfer Stock feature - requires TRANSFERS_READ permission
  'Stock Transfer': {
    permissions: [Permission.TRANSFERS_READ],
    allowedRoles: [
      Role.company_admin,
      Role.area_admin,
      Role.store_admin,
      Role.inventory_manager,
    ],
  },

  // ============================================================================
  // SALES MODULE
  // ============================================================================
  POS: {
    permissions: [Permission.SALES_POS_ACCESS],
    allowedRoles: [
      Role.company_admin,
      Role.area_admin,
      Role.store_admin,
      Role.sale_manager,
      Role.cashier,
    ],
  },
  'Sales Orders': {
    permissions: [Permission.SALES_ORDERS_READ],
    allowedRoles: [
      Role.company_admin,
      Role.area_admin,
      Role.store_admin,
      Role.sale_manager,
      Role.cashier,
    ],
  },
  Customers: {
    permissions: [Permission.CUSTOMERS_READ],
    allowedRoles: [
      Role.company_admin,
      Role.area_admin,
      Role.store_admin,
      Role.sale_manager,
    ],
  },
  Invoice: {
    permissions: [Permission.INVOICES_READ],
    // ✅ FIXED: Cashier can read + print
    allowedRoles: [
      Role.company_admin,
      Role.area_admin,
      Role.store_admin,
      Role.sale_manager,
      Role.cashier,
    ],
  },
  'Sales Returns': {
    permissions: [Permission.SALES_RETURNS_READ],
    allowedRoles: [
      Role.company_admin,
      Role.area_admin,
      Role.store_admin,
      Role.sale_manager,
    ],
  },
  // BUG FIX: Was 'Qoutation' (typo) - never matched the actual menu item name
  Quotation: {
    permissions: [Permission.QUOTATIONS_READ],
    allowedRoles: [
      Role.company_admin,
      Role.area_admin,
      Role.store_admin,
      Role.sale_manager,
    ],
  },

  // ============================================================================
  // PURCHASES MODULE
  // ============================================================================
  POP: {
    permissions: [Permission.PURCHASES_POP_ACCESS],
    allowedRoles: [
      Role.company_admin,
      Role.area_admin,
      Role.store_admin,
      Role.inventory_manager,
    ],
  },
  Suppliers: {
    permissions: [Permission.SUPPLIERS_READ],
    allowedRoles: [
      Role.company_admin,
      Role.area_admin,
      Role.store_admin,
      Role.inventory_manager,
    ],
  },
  // BUG FIX: Was 'Purchases' but menu.ts uses 'Purchase Orders' - never matched
  'Purchase Orders': {
    permissions: [Permission.PURCHASE_ORDERS_READ],
    allowedRoles: [
      Role.company_admin,
      Role.area_admin,
      Role.store_admin,
      Role.inventory_manager,
    ],
  },
  // BUG FIX: Was 'Purchase Order' but menu.ts uses 'Ordered Products' - never matched
  'Ordered Products': {
    permissions: [Permission.PURCHASE_ORDER_ITEMS_READ],
    allowedRoles: [
      Role.company_admin,
      Role.area_admin,
      Role.store_admin,
      Role.inventory_manager,
    ],
  },
  'Purchase Return': {
    permissions: [Permission.PURCHASE_RETURNS_READ],
    allowedRoles: [
      Role.company_admin,
      Role.area_admin,
      Role.store_admin,
      Role.inventory_manager,
    ],
  },

  // ============================================================================
  // FINANCE & ACCOUNTS MODULE
  // ============================================================================
  Credits: {
    permissions: [Permission.CREDITS_READ],
    // ✅ FIXED: Company Admin, Area Admin, Store Admin, and Accounting Manager
    allowedRoles: [
      Role.company_admin,
      Role.area_admin,
      Role.store_admin,
      Role.accounting_manager,
    ],
  },
  Expenses: {
    permissions: [Permission.EXPENSES_READ],
    allowedRoles: [
      Role.company_admin,
      Role.area_admin,
      Role.store_admin,
      Role.accounting_manager,
    ],
  },
  'Expense Category': {
    permissions: [Permission.EXPENSE_CATEGORIES_READ],
    allowedRoles: [
      Role.company_admin,
      Role.area_admin,
      Role.store_admin,
      Role.accounting_manager,
    ],
  },
  Income: {
    permissions: [Permission.INCOME_READ],
    allowedRoles: [
      Role.company_admin,
      Role.area_admin,
      Role.store_admin,
      Role.accounting_manager,
    ],
  },
  // BUG FIX: 'Income Managment' was a duplicate typo entry - removed, 'Income' above is correct
  'Income Category': {
    permissions: [Permission.INCOME_CATEGORIES_READ],
    allowedRoles: [
      Role.company_admin,
      Role.area_admin,
      Role.store_admin,
      Role.accounting_manager,
    ],
  },
  'Balance Sheet': {
    permissions: [Permission.FINANCIAL_REPORTS_BALANCE_SHEET],
    allowedRoles: [Role.company_admin, Role.accounting_manager],
  },
  'Trial Balance': {
    permissions: [Permission.FINANCIAL_REPORTS_TRIAL_BALANCE],
    allowedRoles: [Role.company_admin, Role.accounting_manager],
  },
  'Cash Flow': {
    permissions: [Permission.CASH_FLOW_READ],
    allowedRoles: [Role.company_admin, Role.accounting_manager],
  },

  // ============================================================================
  // CONTENT - Blocked for limited roles
  // ============================================================================
  Pages: {
    permissions: [Permission.PAGES_READ],
    blockedRoles: [
      Role.cashier,
      Role.sale_manager,
      Role.inventory_manager,
      Role.accounting_manager,
    ],
  },
  Media: {
    permissions: [Permission.MEDIA_READ],
    blockedRoles: [
      Role.cashier,
      Role.sale_manager,
      Role.inventory_manager,
      Role.accounting_manager,
    ],
  },
}

// Helper functions
export const hasRoutePermission = (
  route: string,
  userPermissions: string[],
  userRoleId?: number,
): boolean => {
  const config = routePermissions[route]
  if (!config) return true

  // Admin bypass
  if (userRoleId === Role.company_admin) return true

  // Check role restrictions
  if (userRoleId) {
    if (config.blockedRoles?.includes(userRoleId)) return false
    if (config.allowedRoles && !config.allowedRoles.includes(userRoleId))
      return false
  }

  // Check permissions
  if (config.requireAll) {
    return config.permissions.every((p) => userPermissions.includes(p))
  } else {
    return config.permissions.some((p) => userPermissions.includes(p))
  }
}

export const hasMenuItemPermission = (
  menuItemName: string,
  userPermissions: string[],
  userRoleId?: number,
): boolean => {
  const config = menuItemPermissions[menuItemName]
  if (!config) return true

  // Admin bypass
  if (userRoleId === Role.company_admin) return true

  // Check role restrictions
  if (userRoleId) {
    if (config.blockedRoles?.includes(userRoleId)) return false
    if (config.allowedRoles && !config.allowedRoles.includes(userRoleId))
      return false
  }

  // Check permissions
  return config.permissions.some((p) => userPermissions.includes(p))
}

export const getAccessibleRoutes = (
  userPermissions: string[],
  userRoleId?: number,
): string[] => {
  return Object.keys(routePermissions).filter((route) =>
    hasRoutePermission(route, userPermissions, userRoleId),
  )
}

export const getAccessibleMenuItems = (
  userPermissions: string[],
  userRoleId?: number,
): string[] => {
  return Object.keys(menuItemPermissions).filter((menuItem) =>
    hasMenuItemPermission(menuItem, userPermissions, userRoleId),
  )
}

export default {
  routePermissions,
  menuItemPermissions,
  hasRoutePermission,
  hasMenuItemPermission,
  getAccessibleRoutes,
  getAccessibleMenuItems,
}

