// GenericDrawer.tsx — renders all "view-*" detail panels in a right-side drawer
// Uses the same Redux modal slice as GenericModal; view-* types are routed here
// instead of the modal so the user keeps context of the table behind them.

import React, { useMemo } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import {
  Drawer,
  Loader,
  Center,
  ScrollArea,
  useMantineColorScheme,
  useMantineTheme,
  Box,
  rem,
} from '@mantine/core'
import { RootState, AppDispatch } from '@app/core/store/store'
import { closeModal } from '@shared/components/genericModal/SliceGenericModal'

// ── View imports ─────────────────────────────────────────────────────────────
import AreaView from '@features/main/components/areasManagement/components/AreaView'
import UserView from '@features/main/components/usersManagement/components/UsersView'
import ViewRoleModal from '@features/main/components/roles&permissionManagement/components/ViewRoleModal'
import ViewRoleUsersModal from '@features/main/components/roles&permissionManagement/components/ViewRoleUsersModal'
import CategoryView from '@features/itemsMaster/components/categories/components/CategoryView'
import UnitView from '@features/itemsMaster/components/units/components/UnitView'
import ProductView from '@features/itemsMaster/components/products/components/ProductView'
import StockItemView from '@features/inventory/components/stockList/components/StockItemView'
import StockAdjustmentView from '@features/inventory/components/stockAdjustment/components/StockAdjustmentView'
import StockHistoryView from '@features/inventory/components/stockHistory/components/StockHistoryView'
import StockTransferViewModal from '@features/inventory/components/stockTransfer/components/StockTransferViewModal'
import LowStockView from '@features/inventory/components/lowStock/components/LowStockView'
import ExpiringSoonView from '@features/inventory/components/expiringSoon/components/ExpiringSoonView'
import FastMovingItemView from '@features/inventory/components/fastMovingItems/components/FastMovingItemView'
import SaleView from '@features/sales/components/salesHistory/components/SaleHistoryView'
import CustomerView from '@features/sales/components/customers/components/CustomerView'
import PurchaseOrderView from '@features/purchase/components/purchaseOrdersHistory/components/PurchaseOrderView'
import SupplierView from '@features/purchase/components/suppliers/components/SupplierView'
import PurchaseReturnView from '@features/purchase/components/purchaseReturn/components/PurchaseReturnView'
import SalesReturnView from '@features/sales/components/salesReturn/components/SalesReturnView'
import ExpenseView from '@features/AccountingAndFinance/components/expenses/components/ExpenseView'
import ExpenseCategoryView from '@features/AccountingAndFinance/components/expenseCategory/components/ExpenseCategoryView'
import IncomeView from '@features/AccountingAndFinance/components/Incomes/components/IncomeView'
import IncomeCategoryView from '@features/AccountingAndFinance/components/incomeCategory/components/IncomeCategoryView'
import CashFlowView from '@features/AccountingAndFinance/components/cashFlow/components/CashFlowView'

// ── Drawer content map ────────────────────────────────────────────────────────
const drawerContentMap: Partial<
  Record<NonNullable<RootState['modal']['type']>, React.ComponentType<any>>
> = {
  // Main
  'view-area': AreaView,
  'view-user': UserView,
  'view-role': ViewRoleModal,
  'view-role-users': ViewRoleUsersModal,

  // Items Master
  'view-category': CategoryView,
  'view-unit': UnitView,
  'view-product': ProductView,

  // Inventory
  'view-stock-item': StockItemView,
  'view-stock-adjustment': StockAdjustmentView,
  'view-stock-history': StockHistoryView,
  'view-stock-transfer': StockTransferViewModal,
  'view-low-stock': LowStockView,
  'view-expiring-soon': ExpiringSoonView,
  'view-fast-moving': FastMovingItemView,

  // Sales
  'view-sale': SaleView,
  'view-customer': CustomerView,
  'view-sales-return': SalesReturnView,

  // Purchases
  'view-purchase-order': PurchaseOrderView,
  'view-supplier': SupplierView,
  'view-purchase-return': PurchaseReturnView,

  // Finance
  'expense-details': ExpenseView,
  'view-expense-category': ExpenseCategoryView,
  'view-income': IncomeView,
  'view-income-category': IncomeCategoryView,
  'view-cash-flow': CashFlowView,
}

// All types this drawer handles
export const DRAWER_TYPES = new Set(Object.keys(drawerContentMap))

// ── Titles ────────────────────────────────────────────────────────────────────
const drawerTitles: Partial<Record<string, string>> = {
  'view-area': 'Area Details',
  'view-user': 'User Details',
  'view-role': 'Role Details',
  'view-role-users': 'Role Users',
  'view-category': 'Category Details',
  'view-unit': 'Unit Details',
  'view-product': 'Product Details',
  'view-stock-item': 'Stock Item Details',
  'view-stock-adjustment': 'Stock Adjustment Details',
  'view-stock-history': 'Transaction Details',
  'view-stock-transfer': 'Stock Transfer Details',
  'view-low-stock': 'Low Stock Item Details',
  'view-expiring-soon': 'Expiring Batch Details',
  'view-fast-moving': 'Fast Moving Item Details',
  'view-sale': 'Sale Details',
  'view-customer': 'Customer Details',
  'view-sales-return': 'Sales Return Details',
  'view-purchase-order': 'Purchase Order Details',
  'view-supplier': 'Supplier Details',
  'view-purchase-return': 'Purchase Return Details',
  'expense-details': 'Expense Details',
  'view-expense-category': 'Expense Category Details',
  'view-income': 'Income Details',
  'view-income-category': 'Income Category Details',
  'view-cash-flow': 'Cash Flow Transaction Details',
}

// ── Component ─────────────────────────────────────────────────────────────────
export const GenericDrawer: React.FC = () => {
  const {
    isOpen,
    type,
    props = {},
  } = useSelector((state: RootState) => state.modal)
  const dispatch = useDispatch<AppDispatch>()
  const { colorScheme } = useMantineColorScheme()
  const theme = useMantineTheme()
  const isDark = colorScheme === 'dark'

  const isDrawerType = type ? DRAWER_TYPES.has(type) : false
  const opened = isOpen && isDrawerType

  const handleClose = () => {
    dispatch(closeModal())
  }

  const rendered = useMemo(() => {
    if (!type || !isDrawerType) return null
    const Component = drawerContentMap[type as keyof typeof drawerContentMap]
    if (!Component) return null
    return <Component {...props} />
  }, [type, props, isDrawerType])

  const title = useMemo(() => {
    if (!type) return 'Details'
    if (type === 'view-role')
      return `Role Details${props?.roleData?.role_name ? ` — ${props.roleData.role_name}` : ''}`
    if (type === 'view-role-users')
      return `Users with ${props?.roleName || 'Role'}`
    return drawerTitles[type] ?? 'Details'
  }, [type, props])

  return (
    <Drawer
      opened={opened}
      onClose={handleClose}
      title={title}
      position="right"
      size={800}
      padding={0}
      scrollAreaComponent={ScrollArea.Autosize}
      styles={{
        header: {
          background: isDark ? theme.colors.dark[8] : '#fff',
          borderBottom: `1px solid ${isDark ? theme.colors.dark[5] : theme.colors.gray[2]}`,
          padding: `${rem(14)} ${rem(20)}`,
          minHeight: rem(56),
        },
        title: {
          fontWeight: 700,
          fontSize: theme.fontSizes.md,
          letterSpacing: '-0.01em',
          color: isDark ? theme.colors.dark[0] : theme.colors.gray[9],
        },
        close: {
          color: isDark ? theme.colors.dark[2] : theme.colors.gray[6],
          '&:hover': {
            background: isDark ? theme.colors.dark[6] : theme.colors.gray[1],
          },
        },
        body: {
          background: isDark ? theme.colors.dark[8] : theme.colors.gray[0],
          padding: rem(16),
        },
      }}
      overlayProps={{
        backgroundOpacity: 0.4,
        blur: 3,
      }}
      transitionProps={{
        transition: 'slide-left',
        duration: 220,
        timingFunction: 'ease',
      }}
    >
      {rendered ?? (
        <Center h={200}>
          <Loader size="sm" />
        </Center>
      )}
    </Drawer>
  )
}

export default GenericDrawer

