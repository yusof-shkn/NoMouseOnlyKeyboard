import {
  IconHome,
  IconFileText,
  IconUsers,
  IconChartBar,
  IconPackage,
  IconShoppingCart,
  IconLayersUnion,
  IconUsersGroup,
  IconBuildingStore,
  IconMap2,
  IconShoppingBagCheck,
  IconCreditCardRefund,
  IconFileUnknown,
  IconShoppingCartCheck,
  IconFileInvoiceFilled,
  IconMessageReply,
  IconFiles,
  IconDeviceLaptop,
  IconBox,
  IconStack,
  IconBuilding,
  IconTags,
  IconLayersSelected,
  IconBarcode,
  IconClipboardCheck,
  IconClockHour3,
  IconTrendingUp,
  IconCalendarDollar,
  IconFilePencil,
  IconReportMoney,
  IconAlertCircle,
  IconZoomMoney,
  IconShield,
  IconCategory,
  IconArrowsRightLeft,
} from '@tabler/icons-react'
import { MenuGroup } from '../types'

export const menuData: MenuGroup[] = [
  {
    groupName: 'Main',
    items: [
      { name: 'Dashboard', icon: IconHome, link: '/' },
      { name: 'Users', icon: IconUsersGroup, link: '/user-management' },

      { name: 'Areas', icon: IconMap2, link: '/areas-management' },
      { name: 'Stores', icon: IconBuildingStore, link: '/stores-management' },
      {
        name: 'Roles and Permissions',
        icon: IconShield,
        link: '/roles-permissions',
      },
    ],
  },
  {
    groupName: 'Items Master',
    items: [
      { name: 'Products', link: '/items-master/products', icon: IconPackage },

      {
        name: 'Categories',
        link: '/items-master/products/categories',
        icon: IconTags,
      },

      {
        name: 'Units',
        link: '/items-master/products/units',
        icon: IconClipboardCheck,
      },

      {
        name: 'Barcode Manager',
        link: '/items-master/bar-codes',
        icon: IconBarcode,
      },
    ],
  },
  {
    groupName: 'Inventory',
    items: [
      {
        name: 'Stock List',
        link: '/inventory/stock-list',
        icon: IconClipboardCheck,
      },
      {
        name: 'Low Stock',
        link: '/inventory/low-stock',
        icon: IconClockHour3,
      },
      {
        name: 'Fast Moving Items',
        link: '/inventory/fast-moving-items',
        icon: IconTrendingUp,
      },
      {
        name: 'Expiring Soon',
        link: '/inventory/expiring-soon',
        icon: IconClockHour3,
      },
      {
        name: 'Stock Adjustment',
        link: '/inventory/stock-adjustment',
        icon: IconClipboardCheck,
      },
      {
        name: 'Stock History',
        link: '/inventory/stock-history',
        icon: IconFileText,
      },
      {
        name: 'Stock Transfer',
        link: '/inventory/stock-transfer',
        icon: IconArrowsRightLeft,
      },
    ],
  },

  {
    groupName: 'Sales',
    items: [
      {
        name: 'POS',
        icon: IconDeviceLaptop,
        link: '/sales/pos',
      },
      {
        name: 'Customers',
        icon: IconUsersGroup,
        link: '/sales/customers',
      },
      {
        name: 'Sales Orders',
        icon: IconShoppingCartCheck,
        link: '/sales/orders',
      },
      {
        name: 'Sales Returns',
        icon: IconMessageReply,
        link: '/sales/sales-return',
      },
      // {
      //   name: 'Credits',
      //   icon: IconCreditCardRefund,
      //   link: '/accounting/credits',
      // },
    ],
  },
  {
    groupName: 'Purchases',
    items: [
      {
        name: 'POP',
        icon: IconDeviceLaptop,
        link: '/purchases/pop',
      },
      {
        name: 'Suppliers',
        link: '/purchases/suppliers',
        icon: IconUsersGroup,
      },
      {
        name: 'Purchase Orders',
        icon: IconShoppingBagCheck,
        link: '/purchases/order-history',
      },
      {
        name: 'Ordered Products',
        icon: IconFileUnknown,
        link: '/purchases/order-items',
      },
      {
        name: 'Purchase Return',
        icon: IconCreditCardRefund,
        link: '/purchases/purchase-return',
      },
    ],
  },

  {
    groupName: 'Finance and Accounts',
    items: [
      // Expenses - flattened
      {
        name: 'Expenses',
        icon: IconCalendarDollar,
        link: '/expense',
      },
      {
        name: 'Expense Category',
        icon: IconTags,
        link: '/expense-category',
      },
      // Income - flattened
      {
        name: 'Income',
        icon: IconFilePencil,
        link: '/income',
      },
      {
        name: 'Income Category',
        icon: IconTags,
        link: '/income-category',
      },
      // Other accounting items
      {
        name: 'Balance Sheet',
        icon: IconReportMoney,
        link: '/balance-sheet',
      },
      {
        name: 'Trial Balance',
        icon: IconAlertCircle,
        link: '/trial-balance',
      },
      {
        name: 'Cash Flow',
        icon: IconZoomMoney,
        link: '/cash-flow',
      },
    ],
  },

  // {
  //   groupName: 'Content',
  //   items: [
  //     { name: 'Pages', icon: IconFileText, link: '#' },

  //     {
  //       name: 'Media',
  //       icon: IconLayersUnion,
  //       subItems: [
  //         { name: 'Images', link: '#', icon: IconFileText },
  //         { name: 'Videos', link: '#', icon: IconFileText },
  //         { name: 'Documents', link: '#', icon: IconFileText },
  //       ],
  //     },
  //   ],
  // },
]

