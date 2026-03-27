import React, { ReactNode } from 'react'
import { AppShell, useMantineTheme, useMantineColorScheme } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { useNavigate, useLocation } from 'react-router-dom'
import { ThemeProvider } from 'styled-components'
import Navbar from './components/navbar/navbar'
import Sidebar from './components/sidebar/Sidebar'
import { GenericModal } from '@shared/components/genericModal'
import GenericDrawer from '@shared/components/genericDrawer/GenericDrawer'
import ErorrFalbackk from '@shared/components/ErrorFallback'
import { ErrorBoundary } from 'react-error-boundary'

interface DashboardProps {
  children: ReactNode
}

// Map FULL route paths to human-readable labels (sourced from real page ROUTE definitions)
const ROUTE_LABEL_MAP: Record<string, string> = {
  // Main
  '/': 'Dashboard',
  '/user-management': 'Users',
  '/areas-management': 'Areas',
  '/stores-management': 'Stores',
  '/roles-permissions': 'Roles & Permissions',

  // Items Master
  '/items-master/products': 'Products',
  '/items-master/products/categories': 'Categories',
  '/items-master/products/units': 'Units',
  '/items-master/bar-codes': 'Barcode Manager',

  // Inventory
  '/inventory/stock-list': 'Stock List',
  '/inventory/low-stock': 'Low Stock',
  '/inventory/fast-moving-items': 'Fast Moving Items',
  '/inventory/expiring-soon': 'Expiring Soon',
  '/inventory/stock-adjustment': 'Stock Adjustment',
  '/inventory/stock-history': 'Stock History',
  '/inventory/stock-transfer': 'Stock Transfer',

  // Sales
  '/sales/pos': 'Point of Sale',
  '/sales/customers': 'Customers',
  '/sales/orders': 'Sales Orders',
  '/sales/sales-return': 'Sales Returns',

  // Purchases
  '/purchases/pop': 'Purchase Order',
  '/purchases/suppliers': 'Suppliers',
  '/purchases/order-history': 'Purchase Orders',
  '/purchases/order-items': 'Ordered Products',
  '/purchases/purchase-return': 'Purchase Return',
  '/purchases/retun-history': 'Purchase Return History',

  // Finance & Accounts
  '/expense': 'Expenses',
  '/expense-category': 'Expense Category',
  '/income': 'Income',
  '/income-category': 'Income Category',
  '/accounting/balance-sheet': 'Balance Sheet',
  '/trial-balance': 'Trial Balance',
  '/cash-flow': 'Cash Flow',
  '/profit-and-loss': 'Profit & Loss',
  '/journal-entries': 'Journal Entries',
  '/ar-ap-aging': 'AR/AP Aging',
  '/budget-management': 'Budget Management',

  // Settings & Profile
  '/settings/company': 'Company Settings',
  '/settings/preferences': 'Preferences',
  '/profile': 'Profile',
  '/others/notifications': 'Notifications',
}

// Parent group labels for top-level segments
const SEGMENT_GROUP_LABELS: Record<string, string> = {
  'items-master': 'Items Master',
  inventory: 'Inventory',
  sales: 'Sales',
  purchases: 'Purchases',
  accounting: 'Finance & Accounts',
  settings: 'Settings',
}

function buildBreadcrumbs(
  pathname: string,
  navigate: (path: string | number) => void,
) {
  if (pathname === '/') return undefined

  // Exact match — single crumb page (e.g. /expense, /trial-balance)
  const exactLabel = ROUTE_LABEL_MAP[pathname]

  // Check if this path has a parent segment
  const segments = pathname.split('/').filter(Boolean)

  if (segments.length === 0) return undefined

  const crumbs: { label: string; onClick?: () => void }[] = []

  // If multi-segment, add the group crumb (non-clickable parent)
  if (segments.length >= 2) {
    const topSegment = segments[0]
    const groupLabel = SEGMENT_GROUP_LABELS[topSegment]
    if (groupLabel) {
      crumbs.push({ label: groupLabel })
    }
  }

  // Add the leaf page crumb
  const leafLabel =
    exactLabel ??
    ROUTE_LABEL_MAP[pathname] ??
    segments[segments.length - 1]
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())

  crumbs.push({ label: leafLabel })

  if (crumbs.length === 0) return undefined
  return crumbs
}

const Dashboard = ({ children }: DashboardProps) => {
  const theme = useMantineTheme()
  const { colorScheme } = useMantineColorScheme()
  const navigate = useNavigate()
  const location = useLocation()

  const [mobileOpened, { toggle: toggleMobile }] = useDisclosure()
  const [desktopOpened, { toggle: toggleDesktop }] = useDisclosure(true)

  const HEADER_HEIGHT = 56
  const NAVBAR_WIDTH = 260

  const breadcrumbs = buildBreadcrumbs(location.pathname, navigate)

  const handleError = (error: Error, errorInfo: React.ErrorInfo) => {
    console.error('Error caught by boundary:', error, errorInfo)
  }

  const handleReset = () => {
    window.location.reload()
  }

  const styledTheme = {
    ...theme,
    colorScheme,
  }

  return (
    <ThemeProvider theme={styledTheme}>
      <AppShell
        header={{ height: HEADER_HEIGHT }}
        navbar={{
          width: NAVBAR_WIDTH,
          breakpoint: 'sm',
          collapsed: { mobile: !mobileOpened, desktop: !desktopOpened },
        }}
      >
        <GenericModal />
        <GenericDrawer />
        <Navbar
          onBack={() => navigate(-1)}
          backLabel="Go back"
          breadcrumbs={breadcrumbs}
        />
        <Sidebar />
        <AppShell.Main
          style={{
            background:
              colorScheme === 'dark'
                ? `linear-gradient(135deg, ${theme.colors.dark[7]} 0%, ${theme.colors.dark[6]} 100%)`
                : `linear-gradient(135deg, ${theme.colors.gray[0]} 0%, ${theme.colors.gray[1]} 100%)`,
          }}
        >
          <ErrorBoundary
            FallbackComponent={ErorrFalbackk}
            onError={handleError}
            onReset={handleReset}
          >
            {children}
          </ErrorBoundary>
        </AppShell.Main>
      </AppShell>
    </ThemeProvider>
  )
}

export default Dashboard

