// PurchaseReturn.config.tsx - ENHANCED WITH THEME SUPPORT
import React from 'react'
import {
  Text,
  Badge,
  Group,
  useMantineTheme,
  useMantineColorScheme,
} from '@mantine/core'
import {
  IconEye,
  IconEdit,
  IconTrash,
  IconFileText,
  IconFileSpreadsheet,
  IconRefresh,
  IconCheck,
  IconX,
  IconPlus,
  IconShoppingCart,
  IconClock,
  IconCircleCheck,
  IconCurrencyDollar,
  IconAlertCircle,
  IconUser,
} from '@tabler/icons-react'
import { formatCurrency, formatDate } from '@shared/utils/formatters'

import {
  getStatusColor,
  getPaymentStatusColor,
  formatReturnStatus,
  formatPaymentStatus,
  formatRefundMethod,
} from './utils/purchaseReturn.utils'
import { getThemeColors } from '@app/core/theme/theme.utils'
import { resolve } from 'path'

/**
 * Column definitions for Purchase Returns with theme support
 */
export const getPurchaseReturnColumns = (currency: string = 'UGX') => {
  const columns =
  {
    header: 'Return Number',
    accessor: 'return_number',
    render: (row: any) => {
      const ReturnNumberCell = () => {
        const { colorScheme } = useMantineColorScheme()
        const resolvedColorScheme: 'light' | 'dark' =
          colorScheme === 'dark' ? 'dark' : 'light'
        const isDark = resolvedColorScheme === 'dark'
        const themeColors = getThemeColors(
          useMantineTheme(),
          resolvedColorScheme,
        )
        return (
          <Text
            fw={500}
            c={themeColors.text}
          >
            {row.return_number}
          </Text>
        )
      }
      return <ReturnNumberCell />
    },
  },
  {
    header: 'Date',
    accessor: 'return_date',
    render: (row: any) => (
      <Text
        c="dimmed"
        size="sm"
      >
        {formatDate(row.return_date)}
      </Text>
    ),
  },
  {
    header: 'Supplier Name',
    accessor: 'supplier_name',
    render: (row: any) => {
      const SupplierCell = () => {
        const { colorScheme } = useMantineColorScheme()
        const resolvedColorScheme: 'light' | 'dark' =
          colorScheme === 'dark' ? 'dark' : 'light'
        const themeColors = getThemeColors(
          useMantineTheme(),
          resolvedColorScheme,
        )
        return (
          <Text
            size="sm"
            c={themeColors.text}
          >
            {row.supplier_name || 'Unknown Supplier'}
          </Text>
        )
      }
      return <SupplierCell />
    },
  },
  {
    header: 'Status',
    accessor: 'status',
    render: (row: any) => (
      <Badge
        color={getStatusColor(row.status)}
        variant="filled"
        radius="md"
        size="md"
      >
        {formatReturnStatus(row.status)}
      </Badge>
    ),
  },
  {
    header: 'Total',
    accessor: 'total_refund_amount',
    render: (row: any) => {
      const TotalCell = () => {
        const { colorScheme } = useMantineColorScheme()
        const resolvedColorScheme: 'light' | 'dark' =
          colorScheme === 'dark' ? 'dark' : 'light'
        const themeColors = getThemeColors(
          useMantineTheme(),
          resolvedColorScheme,
        )
        return (
          <Text
            fw={500}
            size="sm"
            c={themeColors.text}
          >
            {formatCurrency(row.total_refund_amount || 0, currency)}
          </Text>
        )
      }
      return <TotalCell />
    },
  },
  {
    header: 'Due',
    accessor: 'due_amount',
    render: (row: any) => (
      <Text
        c="red"
        size="sm"
        fw={500}
      >
        {formatCurrency(row.due_amount || 0, currency)}
      </Text>
    ),
  },
  {
    header: 'Payment Status',
    accessor: 'payment_status',
    render: (row: any) => (
      <Badge
        color={getPaymentStatusColor(row.payment_status)}
        variant="light"
        radius="md"
        size="md"
      >
        {formatPaymentStatus(row.payment_status)}
      </Badge>
    ),
  },
  // Processed By - keep
  {
    header: 'Processed By',
    accessor: 'processed_by_profile',
    render: (row: any) => {
      const ActorCell = () => {
        const { colorScheme } = useMantineColorScheme()
        const resolvedColorScheme: 'light' | 'dark' = colorScheme === 'dark' ? 'dark' : 'light'
        const themeColors = getThemeColors(useMantineTheme(), resolvedColorScheme)
        const p = row.processed_by_profile
        const name = p ? `${p.first_name} ${p.last_name}`.trim() : null
        return name ? (
          <Group gap={6} wrap="nowrap">
            <IconUser size={14} color={themeColors.textSecondary} style={{ flexShrink: 0 }} />
            <Text size="sm" c={themeColors.text}>{name}</Text>
          </Group>
        ) : <Text size="sm" c="dimmed">—</Text>
      }
      return <ActorCell />
    },
  },
]
  // AUDIT: Only show 6 recommended columns in table
  const TABLE_COLS = ['return_number', 'return_date', 'supplier_name', 'status', 'total_refund_amount', 'processed_by_profile']
  return columns.filter((c: any) => TABLE_COLS.includes(c.accessor))
}

export const getPurchaseReturnHeaderActions = (handlers: {
  onExportPDF: () => void
  onExportExcel: () => void
  onRefresh: () => void
  onCreate?: () => void
}) => {
  const actions = []

  if (handlers.onCreate) {
    actions.push({
      title: 'Create Return',
      icon: <IconPlus size={20} />,
      color: 'blue',
      onClick: handlers.onCreate,
    })
  }

  actions.push(
    {
      title: 'Export PDF',
      icon: <IconFileText size={20} />,
      color: 'red',
      onClick: handlers.onExportPDF,
    },
    {
      title: 'Export Excel',
      icon: <IconFileSpreadsheet size={20} />,
      color: 'green',
      onClick: handlers.onExportExcel,
    },
    {
      title: 'Refresh',
      icon: <IconRefresh size={20} />,
      color: 'gray',
      onClick: handlers.onRefresh,
    },
  )

  return actions
}

export const getPurchaseReturnRowActions = (handlers: {
  onView: (row: any) => void
  onEdit: (row: any) => void
  onDelete: (row: any) => void
  onApprove?: (row: any) => void
  onReject?: (row: any) => void
}) => {
  const actions = [
    {
      label: 'View',
      icon: <IconEye size={16} />,
      onClick: handlers.onView,
      tooltip: 'View Details',
    },
    {
      label: 'Edit',
      icon: <IconEdit size={16} />,
      onClick: handlers.onEdit,
      tooltip: 'Edit',
    },
  ]

  if (handlers.onApprove) {
    actions.push({
      label: 'Approve',
      icon: <IconCheck size={16} />,
      onClick: handlers.onApprove,
      tooltip: 'Approve Return',
    })
  }

  if (handlers.onReject) {
    actions.push({
      label: 'Reject',
      icon: <IconX size={16} />,
      onClick: handlers.onReject,
      tooltip: 'Reject Return',
    })
  }

  actions.push({
    label: 'Delete',
    icon: <IconTrash size={16} />,
    onClick: handlers.onDelete,
    tooltip: 'Delete',
  })

  return actions
}

export const getPurchaseReturnFilters = (
  onStatusChange: (value: string) => void,
  onPaymentStatusChange: (value: string) => void,
  onSortByChange: (value: string) => void,
) => [
  {
    label: 'Status',
    options: [
      { label: 'All Statuses', value: 'all' },
      { label: 'Pending', value: 'pending' },
      { label: 'Approved', value: 'approved' },
      { label: 'Rejected', value: 'rejected' },
      { label: 'Completed', value: 'completed' },
    ],
    onChange: onStatusChange,
  },
  {
    label: 'Payment Status',
    options: [
      { label: 'All Payment Statuses', value: 'all' },
      { label: 'Unpaid', value: 'unpaid' },
      { label: 'Partially Paid', value: 'partially_paid' },
      { label: 'Paid', value: 'paid' },
      { label: 'Overdue', value: 'overdue' },
    ],
    onChange: onPaymentStatusChange,
  },
  {
    label: 'Sort By',
    options: [
      { label: 'Recently Added', value: 'recently_added' },
      { label: 'Last 7 Days', value: 'last_7_days' },
      { label: 'Last Month', value: 'last_month' },
      { label: 'Date Descending', value: 'descending' },
      { label: 'Date Ascending', value: 'ascending' },
    ],
    onChange: onSortByChange,
  },
]

/**
 * Statistics cards data with theme-aware formatting
 */
export const getStatisticsCardsData = (
  stats: {
    total: number
    pending: number
    approved: number
    rejected: number
    completed: number
    totalRefundAmount: number
    totalPaid: number
    totalDue: number
    unpaid: number
    partiallyPaid: number
    paid: number
    overdue: number
  },
  currency: string = 'UGX',
) => [
  {
    icon: <IconShoppingCart />,
    number: stats.total.toString(),
    label: 'Total Returns',
    color: 'blue',
  },
  {
    icon: <IconClock />,
    number: stats.pending.toString(),
    label: 'Pending Approval',
    color: 'yellow',
  },
  {
    icon: <IconCircleCheck />,
    number: stats.approved.toString(),
    label: 'Approved',
    color: 'green',
  },
  {
    icon: <IconCurrencyDollar />,
    number: formatCurrency(stats.totalRefundAmount, currency),
    label: 'Total Refunds',
    color: 'indigo',
  },
]

