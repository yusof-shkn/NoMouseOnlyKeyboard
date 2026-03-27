// routes/index.ts - CORRECTED RBAC BASED ON UPDATED DOCUMENTATION

import { Dashboard, ROUTE as dashboardRoute } from './main/dashboard'
import { Login, ROUTE as loginRoute } from './authentication/login'
import { Register, ROUTE as registerRoute } from './authentication/register'
import {
  UserManagement,
  ROUTE as userManagementRoute,
} from './main/userManagement'
import { AreasManagement, ROUTE as areasRoute } from './main/areasManagement'
import { StoresManagement, ROUTE as storesRoute } from './main/storesManagement'
import {
  forgotPasswordPage,
  ROUTE as forgotPasswordRoute,
} from './authentication/forgotPassword'
import {
  EmailOTP,
  ROUTE as emailOtpRoute,
} from './authentication/forgotPassword/components/indexOTp'
import {
  ResetPassword,
  ROUTE as resetPasswordRoute,
} from './authentication/forgotPassword/components/indexResetPassword'

import {
  PurchaseOrdersHistory,
  ROUTE as purchaseOrdersHistory,
} from './purchases/purchasesOrdersHistory/PurchaseOrdersHistory'

import {
  PurchaseOrdersItemsHistory,
  ROUTE as purchaseOrdersItemsHistory,
} from './purchases/purchasesOrdersItemsHistory'

import {
  SalesPosHistory,
  ROUTE as salesPosHistory,
} from './sales/salesPosHistory'
import {
  MedicinesManagement,
  ROUTE as medicinesManagementRoute,
} from './items-master/productsManagement'
import {
  CategoriesManagement,
  ROUTE as categoriesManagementRoute,
} from './items-master/categoriesManagement'
import {
  UnitsManagement,
  ROUTE as unitsManagementRoute,
} from './items-master/unitsManagement'

import { SalesPOS, ROUTE as salesPOS } from './sales/salesPOS'
import { PurchasePOP, ROUTE as purchasePOP } from './purchases/purchasesPOP'

import {
  BarCodeManagement,
  ROUTE as barCodeManagementRoute,
} from './items-master/barCodeManagement'

import { StockList, ROUTE as stockListRoute } from './inventory/stockList'

import { LowStock, ROUTE as lowStockRoute } from './inventory/lowStock'
import {
  FastMovingItems,
  ROUTE as fastMovingItemsRoute,
} from './inventory/FastMovingItems'

import {
  SuppliersManagement,
  ROUTE as suppliersManagementRoute,
} from './purchases/suppliersManagement'

import {
  ExpiringSoon,
  ROUTE as expiringSoonRoute,
} from './inventory/expiringSoon'

import {
  StockHistory,
  ROUTE as stockHistoryRoute,
} from './inventory/stockHistory'

import {
  CustomersManagement,
  ROUTE as CustumersManagementRoute,
} from './sales/customersManagement'
import {
  CompanySettings,
  ROUTE as CompanySettingsRoute,
} from './settings/companySettings/CompanySettings'
import {
  Preferences as Preferences,
  ROUTE as PreferencesRoute,
} from './settings/preferences/Preferences'
import { Profile, ROUTE as ProfileRoute } from './authentication/profile'
import {
  NotificationPage,
  ROUTE as NotificationPageRoute,
} from './others/notification/Notification.page'

import {
  ExpenseManagement,
  ROUTE as expenseManagementRoute,
} from './AccountingAndFinance/expense'

import {
  ExpenseCategoryManagement,
  ROUTE as expenseCategoryManagementRoute,
} from './AccountingAndFinance/expenseCategory'

import {
  IncomeManagement,
  ROUTE as incomeManagementRoute,
} from './AccountingAndFinance/incoms'

import {
  IncomeCategoryManagement,
  ROUTE as incomeCategoryManagementRoute,
} from './AccountingAndFinance/incomeCategory'

import {
  BalanceSheetManagement,
  ROUTE as balanceSheetManagementRoute,
} from './AccountingAndFinance/BalanceSheet'

import {
  CashFlowManagement,
  ROUTE as cashFlowManagementRoute,
} from './AccountingAndFinance/cashFlow'

import {
  TrialBalance,
  ROUTE as trialBalanceRoute,
} from './AccountingAndFinance/trialBalance'

import {
  RolesPermissions,
  ROUTE as RolesPermissionsRoute,
} from './main/rolesPermissions'

import { Permission } from '@shared/constants/permissions'
import { Role } from '@shared/constants/roles'
import {
  RegisterWithInvitation,
  ROUTE as RegisterWithInvitationRoute,
} from './authentication/invitation/InvitationRegister'
import {
  StockAdjustment,
  ROUTE as stockAdjustmentroute,
} from './inventory/stockAdjustment'

import {
  StockTransferPage,
  ROUTE as stockTransferRoute,
} from './inventory/stockTransfer'

import {
  PurchaseReturnManagement,
  ROUTE as purchaseReturnManagementRoute,
} from './purchases/purchaseReturn/PurchaseReturnPage'

import {
  SalesReturns,
  ROUTE as salesReturnsRoute,
} from './sales/salesReturn/SalesReturnPage'

import { NotFoundPage, ROUTE as NotFoundRoute } from './others/NotFound'
import {
  NoStoreAccessPage,
  ROUTE as NoStoreAccessRoute,
} from './others/NoStoreAccess'

import {
  AuthCallbackPage,
  ROUTE as AuthCallbackPageRoute,
} from './authentication/authCallbackPage/AuthCallbackPage'
import {
  LogoutPage,
  ROUTE as LogoutPageRoute,
} from './authentication/logout/logout'

export type RouteType = {
  path: string
  name?: string
  element: typeof Dashboard
  protected?: boolean
  usePointOfViewSkeleton?: boolean
  requiredPermissions?: string[]
  allowedRoles?: number[] // Explicit role restrictions
  blockedRoles?: number[] // Explicit role blocks
  requireAllPermissions?: boolean
  accessLevel?: 'company' | 'area' | 'store' // Data scope requirement
}

export const routes: RouteType[] = [
  // ============================================================================
  // PUBLIC ROUTES (No authentication required)
  // ============================================================================
  { ...registerRoute, element: Register, protected: false },
  { ...loginRoute, element: Login, protected: false },
  { ...forgotPasswordRoute, element: forgotPasswordPage, protected: false },
  { ...emailOtpRoute, element: EmailOTP, protected: false },
  { ...resetPasswordRoute, element: ResetPassword, protected: false },
  {
    ...RegisterWithInvitationRoute,
    element: RegisterWithInvitation,
    protected: false,
  },
  {
    ...AuthCallbackPageRoute,
    element: AuthCallbackPage,
    protected: false,
  },
  {
    ...NoStoreAccessRoute,
    element: NoStoreAccessPage,
    protected: true,
  },
  { ...LogoutPageRoute, element: LogoutPage, protected: true },

  // ============================================================================
  // PROTECTED ROUTES - MAIN MODULE
  // ============================================================================
  {
    ...dashboardRoute,
    element: Dashboard,
    protected: true,
    requiredPermissions: [Permission.DASHBOARD_VIEW],
    blockedRoles: [Role.cashier], // Cashier has no dashboard access
  },

  {
    ...userManagementRoute,
    element: UserManagement,
    protected: true,
    requiredPermissions: [Permission.USERS_READ],
    allowedRoles: [Role.company_admin], // ONLY Company Admin
    accessLevel: 'company',
  },

  {
    ...areasRoute,
    element: AreasManagement,
    protected: true,
    requiredPermissions: [Permission.AREAS_READ],
    allowedRoles: [Role.company_admin], // ONLY Company Admin
    accessLevel: 'company',
  },

  {
    ...storesRoute,
    element: StoresManagement,
    protected: true,
    requiredPermissions: [Permission.STORES_READ],
    allowedRoles: [Role.company_admin, Role.area_admin], // Company Admin + Area Admin
    // Area Admin sees only their area's stores (enforced by backend)
  },

  {
    ...RolesPermissionsRoute,
    element: RolesPermissions,
    protected: true,
    requiredPermissions: [Permission.ROLES_READ, Permission.PERMISSIONS_READ],
    allowedRoles: [Role.company_admin], // ONLY Company Admin
    accessLevel: 'company',
  },

  // ============================================================================
  // PROTECTED ROUTES - ITEMS MASTER MODULE
  // ============================================================================
  {
    ...medicinesManagementRoute,
    element: MedicinesManagement,
    protected: true,
    requiredPermissions: [Permission.PRODUCTS_READ],
    blockedRoles: [Role.accounting_manager], // Accounting Manager has no access
  },

  {
    ...categoriesManagementRoute,
    element: CategoriesManagement,
    protected: true,
    requiredPermissions: [Permission.CATEGORIES_READ],
    blockedRoles: [Role.accounting_manager],
  },

  {
    ...unitsManagementRoute,
    element: UnitsManagement,
    protected: true,
    requiredPermissions: [Permission.UNITS_READ],
    blockedRoles: [Role.accounting_manager],
  },

  {
    ...barCodeManagementRoute,
    element: BarCodeManagement,
    protected: true,
    requiredPermissions: [Permission.BARCODES_READ],
    blockedRoles: [Role.accounting_manager],
  },

  // ============================================================================
  // PROTECTED ROUTES - INVENTORY MODULE
  // ============================================================================
  {
    ...stockListRoute,
    element: StockList,
    protected: true,
    requiredPermissions: [Permission.INVENTORY_READ],
    // All roles except Accounting Manager have access (read or full)
  },

  {
    ...lowStockRoute,
    element: LowStock,
    protected: true,
    requiredPermissions: [Permission.LOW_STOCK_READ],
  },

  {
    ...fastMovingItemsRoute,
    element: FastMovingItems,
    protected: true,
    requiredPermissions: [Permission.FAST_MOVING_READ],
  },

  {
    ...expiringSoonRoute,
    element: ExpiringSoon,
    protected: true,
    requiredPermissions: [Permission.EXPIRING_READ],
  },

  {
    ...stockHistoryRoute,
    element: StockHistory,
    protected: true,
    requiredPermissions: [Permission.STOCK_HISTORY_READ],
  },

  {
    ...stockAdjustmentroute,
    element: StockAdjustment,
    protected: true,
    requiredPermissions: [Permission.STOCK_ADJUST],
  },

  {
    ...stockTransferRoute,
    element: StockTransferPage,
    protected: true,
    requiredPermissions: [Permission.TRANSFERS_READ],
    allowedRoles: [
      Role.company_admin,
      Role.area_admin,
      Role.store_admin,
      Role.inventory_manager,
      Role.accounting_manager,
    ],
  },

  // ============================================================================
  // PROTECTED ROUTES - SALES MODULE
  // ============================================================================
  {
    ...salesPOS,
    element: SalesPOS,
    protected: true,
    usePointOfViewSkeleton: true,
    requiredPermissions: [Permission.SALES_POS_ACCESS],
    allowedRoles: [
      Role.company_admin,
      Role.area_admin,
      Role.store_admin,
      Role.sale_manager,
      Role.cashier,
    ],
  },

  {
    ...salesPosHistory,
    element: SalesPosHistory,
    protected: true,
    requiredPermissions: [Permission.SALES_ORDERS_READ],
    blockedRoles: [Role.inventory_manager], // Inventory Manager has no sales access
  },

  {
    ...salesReturnsRoute,
    element: SalesReturns,
    protected: true,
    requiredPermissions: [Permission.SALES_RETURNS_READ],
    blockedRoles: [Role.inventory_manager, Role.cashier],
  },

  {
    ...CustumersManagementRoute,
    element: CustomersManagement,
    protected: true,
    requiredPermissions: [Permission.CUSTOMERS_READ],
    blockedRoles: [Role.inventory_manager],
  },

  // ============================================================================
  // PROTECTED ROUTES - PURCHASES MODULE
  // ============================================================================
  {
    ...purchasePOP,
    element: PurchasePOP,
    protected: true,
    usePointOfViewSkeleton: true,
    requiredPermissions: [Permission.PURCHASES_POP_ACCESS],
    allowedRoles: [
      Role.company_admin,
      Role.area_admin,
      Role.store_admin,
      Role.inventory_manager,
    ],
  },

  {
    ...suppliersManagementRoute,
    element: SuppliersManagement,
    protected: true,
    requiredPermissions: [Permission.SUPPLIERS_READ],
    blockedRoles: [Role.sale_manager, Role.cashier],
  },

  {
    ...purchaseOrdersHistory,
    element: PurchaseOrdersHistory,
    protected: true,
    requiredPermissions: [Permission.PURCHASE_ORDERS_READ],
    blockedRoles: [Role.sale_manager, Role.cashier],
  },

  {
    ...purchaseOrdersItemsHistory,
    element: PurchaseOrdersItemsHistory,
    protected: true,
    requiredPermissions: [Permission.PURCHASE_ORDER_ITEMS_READ],
    blockedRoles: [Role.sale_manager, Role.cashier],
  },

  {
    ...purchaseReturnManagementRoute,
    element: PurchaseReturnManagement,
    protected: true,
    requiredPermissions: [Permission.PURCHASE_RETURNS_READ],
    blockedRoles: [Role.sale_manager, Role.cashier],
  },

  // ============================================================================
  // PROTECTED ROUTES - FINANCE & ACCOUNTS MODULE
  // ============================================================================

  {
    ...expenseManagementRoute,
    element: ExpenseManagement,
    protected: true,
    requiredPermissions: [Permission.EXPENSES_READ],
    allowedRoles: [
      Role.company_admin,
      Role.area_admin,
      Role.store_admin,
      Role.accounting_manager,
    ],
  },

  {
    ...expenseCategoryManagementRoute,
    element: ExpenseCategoryManagement,
    protected: true,
    requiredPermissions: [Permission.EXPENSE_CATEGORIES_READ],
    allowedRoles: [
      Role.company_admin,
      Role.area_admin,
      Role.store_admin,
      Role.accounting_manager,
    ],
  },

  {
    ...incomeManagementRoute,
    element: IncomeManagement,
    protected: true,
    requiredPermissions: [Permission.INCOME_READ],
    allowedRoles: [
      Role.company_admin,
      Role.area_admin,
      Role.store_admin,
      Role.accounting_manager,
    ],
  },

  {
    ...incomeCategoryManagementRoute,
    element: IncomeCategoryManagement,
    protected: true,
    requiredPermissions: [Permission.INCOME_CATEGORIES_READ],
    allowedRoles: [
      Role.company_admin,
      Role.area_admin,
      Role.store_admin,
      Role.accounting_manager,
    ],
  },

  {
    ...balanceSheetManagementRoute,
    element: BalanceSheetManagement,
    protected: true,
    requiredPermissions: [Permission.FINANCIAL_REPORTS_BALANCE_SHEET],
    allowedRoles: [
      Role.company_admin,
      Role.area_admin,
      Role.store_admin,
      Role.accounting_manager,
    ],
  },

  {
    ...trialBalanceRoute,
    element: TrialBalance,
    protected: true,
    requiredPermissions: [Permission.FINANCIAL_REPORTS_TRIAL_BALANCE],
    allowedRoles: [
      Role.company_admin,
      Role.area_admin,
      Role.store_admin,
      Role.accounting_manager,
    ],
  },

  {
    ...cashFlowManagementRoute,
    element: CashFlowManagement,
    protected: true,
    requiredPermissions: [Permission.CASH_FLOW_READ],
    allowedRoles: [
      Role.company_admin,
      Role.area_admin,
      Role.store_admin,
      Role.accounting_manager,
    ],
  },

  // ============================================================================
  // PROTECTED ROUTES - SETTINGS & PROFILE
  // ============================================================================
  {
    ...CompanySettingsRoute,
    element: CompanySettings,
    protected: true,
    requiredPermissions: [Permission.COMPANY_SETTINGS_READ],
    allowedRoles: [Role.company_admin], // ONLY Company Admin
    accessLevel: 'company',
  },
  {
    ...PreferencesRoute,
    element: Preferences,
    protected: true,
  },
  {
    ...ProfileRoute,
    element: Profile,
    protected: true,
    requiredPermissions: [Permission.PROFILE_VIEW],
    // All authenticated users can access profile
  },

  {
    ...NotificationPageRoute,
    element: NotificationPage,
    protected: true,
    requiredPermissions: [Permission.NOTIFICATIONS_READ],
    // All authenticated users can view notifications
  },

  // ============================================================================
  // 404 NOT FOUND
  // ============================================================================
  { ...NotFoundRoute, element: NotFoundPage, protected: false },
]

