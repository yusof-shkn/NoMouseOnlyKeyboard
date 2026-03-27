// src/pages/SalesHistory/SalesHistory.config.tsx
// ✅ FULLY THEMED: Uses MantineTheme + dark mode + primary colors + dot-status pattern

import { Text, Group, Tooltip, MantineTheme } from '@mantine/core'
import {
  IconEye,
  IconEdit,
  IconTrash,
  IconFileText,
  IconFileSpreadsheet,
  IconRefresh,
  IconShoppingCart,
  IconCurrencyDollar,
  IconAlertCircle,
  IconCircleCheck,
  IconReceipt,
  IconDiscount,
  IconArrowBackUp,
  IconDownload,
  IconCircleCheckFilled,
  IconCircleX,
  IconClock,
  IconUser,
} from '@tabler/icons-react'
import { formatDate } from '@shared/utils/formatters'
import { CompanySettings } from './types/salesHistory.types'

// ============================================================================
// HELPERS
// ============================================================================

const formatCurrency = (
  amount: number,
  settings: CompanySettings | null,
): string => {
  const currency = settings?.default_currency || 'UGX'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)
}

// ============================================================================
// STATUS DOT MAPS
// ============================================================================

const saleStatusDots: Record<
  string,
  { dot: string; text: string; label: string }
> = {
  draft: {
    dot: 'var(--mantine-color-yellow-6)',
    text: 'var(--mantine-color-yellow-8)',
    label: 'Draft',
  },
  completed: {
    dot: 'var(--mantine-color-green-6)',
    text: 'var(--mantine-color-green-8)',
    label: 'Completed',
  },
  pending_return: {
    dot: 'var(--mantine-color-orange-5)',
    text: 'var(--mantine-color-orange-7)',
    label: 'Pending Return',
  },
  cancelled: {
    dot: 'var(--mantine-color-red-5)',
    text: 'var(--mantine-color-red-7)',
    label: 'Cancelled',
  },
  returned: {
    dot: 'var(--mantine-color-grape-5)',
    text: 'var(--mantine-color-grape-7)',
    label: 'Returned',
  },
}

const paymentStatusDots: Record<
  string,
  { dot: string; text: string; label: string }
> = {
  paid: {
    dot: 'var(--mantine-color-green-6)',
    text: 'var(--mantine-color-green-8)',
    label: 'Paid',
  },
  partial: {
    dot: 'var(--mantine-color-yellow-6)',
    text: 'var(--mantine-color-yellow-8)',
    label: 'Partial',
  },
  pending: {
    dot: 'var(--mantine-color-orange-5)',
    text: 'var(--mantine-color-orange-7)',
    label: 'Pending',
  },
}

// ============================================================================
// COLUMNS
// ============================================================================

export const getSalesColumns = (
  settings: CompanySettings | null,
  theme: MantineTheme,
  colorScheme: 'light' | 'dark',
) => {
  const isDark = colorScheme === 'dark'
  const textColor = isDark ? theme.white : theme.black

  const allCols = [
    {
      header: 'Invoice',
      accessor: 'sale_number',
      render: (row: any) => (
        <Text
          size="sm"
          fw={600}
          c={theme.primaryColor}
        >
          {row.sale_number || 'N/A'}
        </Text>
      ),
    },
    {
      header: 'Customer',
      accessor: 'customer_name',
      render: (row: any) => (
        <Text
          size="sm"
          c={textColor}
        >
          {row.customer_name || 'Walk-in Customer'}
        </Text>
      ),
    },
    {
      header: 'Date',
      accessor: 'sale_date',
      render: (row: any) => (
        <Text
          c="dimmed"
          size="sm"
        >
          {formatDate(row.sale_date)}
        </Text>
      ),
    },
    {
      header: 'Store',
      accessor: 'store_name',
      render: (row: any) => (
        <Text
          size="xs"
          c="dimmed"
          style={{ whiteSpace: 'nowrap' }}
        >
          {row.store_name || '—'}
        </Text>
      ),
    },
    {
      header: 'Type',
      accessor: 'sale_type',
      render: (row: any) => {
        // Sale type uses primary color for all — it's not a status alert
        const typeLabels: Record<string, string> = {
          retail: 'Retail',
          wholesale: 'Wholesale',
          online: 'Online',
        }
        return (
          <Text
            size="xs"
            fw={600}
            c={theme.primaryColor}
          >
            {typeLabels[row.sale_type] || row.sale_type?.toUpperCase()}
          </Text>
        )
      },
    },
    {
      header: 'Status',
      accessor: 'sale_status',
      render: (row: any) => {
        const key = row.sale_status || 'draft'
        const config = saleStatusDots[key] ?? {
          dot: theme.colors[theme.primaryColor][5],
          text: theme.colors[theme.primaryColor][7],
          label: key.toUpperCase(),
        }

        const dotEl = (
          <Group
            gap={6}
            wrap="nowrap"
          >
            <div
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                backgroundColor: config.dot,
                flexShrink: 0,
              }}
            />
            <Text
              size="xs"
              fw={600}
              c={config.text}
              style={{ whiteSpace: 'nowrap' }}
            >
              {config.label}
            </Text>
          </Group>
        )

        if (row.sale_status === 'pending_return' && row.pending_return_number) {
          return (
            <Tooltip
              label={`Return #${row.pending_return_number} awaiting approval`}
              color="orange"
            >
              {dotEl}
            </Tooltip>
          )
        }

        if (row.discount_warning) {
          return (
            <Tooltip
              label={row.discount_warning}
              color="orange"
            >
              {dotEl}
            </Tooltip>
          )
        }

        return dotEl
      },
    },
    {
      header: 'Payment',
      accessor: 'payment_method',
      render: (row: any) => {
        const methodLabels: Record<string, string> = {
          cash: 'Cash',
          card: 'Card',
          mobile: 'Mobile Money',
          credit: 'Credit',
        }
        return (
          <Text
            size="xs"
            fw={500}
            c="dimmed"
          >
            {methodLabels[row.payment_method] ||
              row.payment_method?.toUpperCase()}
          </Text>
        )
      },
    },
    {
      header: 'Total',
      accessor: 'total_amount',
      render: (row: any) => (
        <Text
          fw={600}
          size="sm"
          c={theme.primaryColor}
        >
          {formatCurrency(row.total_amount || 0, settings)}
        </Text>
      ),
    },
    {
      header: 'Pay Status',
      accessor: 'payment_status',
      render: (row: any) => {
        const key = row.payment_status || 'pending'
        const config = paymentStatusDots[key] ?? paymentStatusDots.pending
        return (
          <Group
            gap={6}
            wrap="nowrap"
          >
            <div
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                backgroundColor: config.dot,
                flexShrink: 0,
              }}
            />
            <Text
              size="xs"
              fw={600}
              c={config.text}
              style={{ whiteSpace: 'nowrap' }}
            >
              {config.label}
            </Text>
          </Group>
        )
      },
    },
    {
      header: 'Processed By',
      accessor: 'profiles',
      render: (row: any) => {
        // Bug 4.2 fix: use proper type guard instead of unsafe any cast
        const profile = row.profiles as {
          first_name?: string
          last_name?: string
          username?: string
        } | null
        const name =
          profile?.first_name && profile?.last_name
            ? `${profile.first_name} ${profile.last_name}`.trim()
            : profile?.username || null
        return name ? (
          <Group
            gap={6}
            wrap="nowrap"
          >
            <IconUser
              size={14}
              color={isDark ? theme.colors.gray[5] : theme.colors.gray[6]}
              style={{ flexShrink: 0 }}
            />
            <Text
              size="sm"
              c={isDark ? 'gray.3' : 'gray.8'}
            >
              {name}
            </Text>
          </Group>
        ) : (
          <Text
            size="sm"
            c="dimmed"
          >
            System
          </Text>
        )
      },
    },
  ]
  // AUDIT: Remove 'Type' column from table; keep Invoice,Customer,Date,Store,Status,Payment,Total,Pay Status,Processed By
  const TABLE_COLS = [
    'sale_number',
    'customer_name',
    'sale_date',
    'store_name',
    'sale_status',
    'payment_method',
    'total_amount',
    'payment_status',
    'profiles',
  ]
  return allCols.filter((col) => TABLE_COLS.includes(col.accessor))
}

// ============================================================================
// HEADER ACTIONS
// ============================================================================

export const getSalesHeaderActions = (handlers: {
  onExportPDF: () => void
  onExportExcel: () => void
  onRefresh: () => void
}) => [
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
]

// ============================================================================
// ROW ACTIONS
// ============================================================================

interface RowActionHandlers {
  onView: (row: any) => void
  onEdit: (row: any) => void
  onDelete: (row: any) => void
  onReturn: (row: any) => void
  onApproveReturn: (row: any) => void
  onRejectReturn: (row: any) => void
  onDownloadInvoice: (row: any) => void
}

export const getSalesRowActions = (
  handlers: RowActionHandlers,
  settings: CompanySettings | null,
): ((row: any, rowIndex: number) => any[]) => {
  return (row: any): any[] => {
    const actions: any[] = [
      {
        label: 'View',
        icon: <IconEye size={16} />,
        color: 'gray',
        onClick: (r: any) => handlers.onView(r),
      },
    ]

    // Invoice only makes sense for wholesale orders, not retail walk-ins
    if (row.sale_type === 'wholesale') {
      actions.push({
        label: 'Invoice',
        icon: <IconDownload size={16} />,
        color: 'gray',
        onClick: (r: any) => handlers.onDownloadInvoice(r),
      })
    }

    switch (row.sale_status) {
      case 'draft':
        actions.push(
          {
            label: 'Resume',
            icon: <IconEdit size={16} />,
            color: 'yellow',
            onClick: (r: any) => handlers.onEdit(r),
          },
          {
            label: 'Delete',
            icon: <IconTrash size={16} />,
            color: 'red',
            onClick: (r: any) => handlers.onDelete(r),
          },
        )
        break

      case 'completed':
        actions.push({
          label: 'Edit',
          icon: <IconEdit size={16} />,
          color: 'blue',
          onClick: (r: any) => handlers.onEdit(r),
        })
        if (settings?.allow_sales_returns) {
          actions.push({
            label: 'Return',
            icon: <IconArrowBackUp size={16} />,
            color: 'grape',
            onClick: (r: any) => handlers.onReturn(r),
          })
        }
        actions.push({
          label: 'Delete',
          icon: <IconTrash size={16} />,
          color: 'red',
          onClick: (r: any) => handlers.onDelete(r),
        })
        break

      case 'pending_return':
        actions.push(
          {
            label: 'Approve',
            icon: <IconCircleCheckFilled size={16} />,
            color: 'green',
            onClick: (r: any) => {
              if (r.pending_return_id) handlers.onApproveReturn(r)
            },
          },
          {
            label: 'Reject',
            icon: <IconCircleX size={16} />,
            color: 'red',
            onClick: (r: any) => {
              if (r.pending_return_id) handlers.onRejectReturn(r)
            },
          },
        )
        break

      case 'returned':
        actions.push({
          label: 'Delete',
          icon: <IconTrash size={16} />,
          color: 'red',
          onClick: (r: any) => handlers.onDelete(r),
        })
        break

      case 'cancelled':
        actions.push({
          label: 'Delete',
          icon: <IconTrash size={16} />,
          color: 'red',
          onClick: (r: any) => handlers.onDelete(r),
        })
        break
    }

    return actions
  }
}

// ============================================================================
// FILTERS
// ============================================================================

export const getSalesFilters = (
  onCustomerChange: (value: string) => void,
  onStatusChange: (value: string) => void,
  onPaymentMethodChange: (value: string) => void,
  onSaleTypeChange: (value: string) => void,
  onDateRangeChange: (value: string) => void,
  customers: any[],
  stores: any[],
  settings: CompanySettings | null,
) => {
  const statusOptions = [
    { label: 'All Statuses', value: 'all' },
    { label: 'Draft', value: 'draft' },
    { label: 'Completed', value: 'completed' },
    { label: 'Pending Return', value: 'pending_return' },
    { label: 'Cancelled', value: 'cancelled' },
  ]

  if (settings?.allow_sales_returns) {
    statusOptions.push({ label: 'Returned', value: 'returned' })
  }

  return [
    {
      label: 'Customer',
      options: [
        { label: 'All Customers', value: 'all' },
        ...customers.map((customer) => ({
          label:
            customer.customer_name ||
            `${customer.first_name} ${customer.last_name}`,
          value: customer.id.toString(),
        })),
      ],
      onChange: onCustomerChange,
    },
    {
      label: 'Type',
      options: [
        { label: 'All Types', value: 'all' },
        { label: 'Retail', value: 'retail' },
        { label: 'Wholesale', value: 'wholesale' },
        { label: 'Online', value: 'online' },
      ],
      onChange: onSaleTypeChange,
    },
    {
      label: 'Status',
      options: statusOptions,
      onChange: onStatusChange,
    },
    {
      label: 'Payment',
      options: [
        { label: 'All Methods', value: 'all' },
        { label: 'Cash', value: 'cash' },
        { label: 'Card', value: 'card' },
        { label: 'Mobile Money', value: 'mobile' },
        { label: 'Credit', value: 'credit' },
      ],
      onChange: onPaymentMethodChange,
    },
    {
      label: 'Date',
      options: [
        { label: 'All Time', value: 'all' },
        { label: 'Today', value: 'today' },
        { label: 'Yesterday', value: 'yesterday' },
        { label: 'Last 7 Days', value: 'last_7_days' },
        { label: 'Last 30 Days', value: 'last_30_days' },
        { label: 'This Month', value: 'this_month' },
        { label: 'Last Month', value: 'last_month' },
        { label: 'This Year', value: 'this_year' },
      ],
      onChange: onDateRangeChange,
    },
  ]
}

// ============================================================================
// STATISTICS CARDS
// ============================================================================

export const getStatisticsCardsData = (
  stats: {
    total: number
    pending: number
    completed: number
    cancelled: number
    returned: number
    pendingReturn: number
    totalAmount: number
    totalDiscount: number
    totalTax: number
  },
  settings: CompanySettings | null,
  theme: MantineTheme,
) => [
  {
    icon: <IconShoppingCart />,
    number: stats.total.toString(),
    label: 'Total Sales',
    color: theme.primaryColor,
  },
  {
    icon: <IconAlertCircle />,
    number: stats.pending.toString(),
    label: 'Pending',
    color: 'yellow',
  },
  {
    icon: <IconCircleCheck />,
    number: stats.completed.toString(),
    label: 'Completed',
    color: 'green',
  },
  {
    icon: <IconClock />,
    number: stats.pendingReturn.toString(),
    label: 'Pending Returns',
    color: 'orange',
  },
  {
    icon: <IconCurrencyDollar />,
    number: formatCurrency(stats.totalAmount, settings),
    label: 'Total Amount',
    color: theme.primaryColor,
  },
  {
    icon: <IconDiscount />,
    number: formatCurrency(stats.totalDiscount, settings),
    label: 'Total Discount',
    color: theme.primaryColor,
  },
  {
    icon: <IconReceipt />,
    number: formatCurrency(stats.totalTax, settings),
    label: 'Total Tax',
    color: theme.primaryColor,
  },
  {
    icon: <IconArrowBackUp />,
    number: stats.returned.toString(),
    label: 'Returns',
    color: theme.primaryColor,
  },
]

