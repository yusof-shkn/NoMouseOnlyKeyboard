// src/pages/Income/config/Income.config.tsx

import {
  Text,
  Badge,
  Group,
  Box,
  Tooltip,
  Stack,
  useMantineTheme,
  useMantineColorScheme,
} from '@mantine/core'
import {
  IconEdit,
  IconTrash,
  IconEye,
  IconFileText,
  IconFileSpreadsheet,
  IconRefresh,
  IconCheck,
  IconSend,
  IconCash,
  IconAlertCircle,
  IconRobot,
  IconUser,
  IconBuilding,
  IconUsers,
  IconClock,
  IconCalendar,
} from '@tabler/icons-react'
import { Income, IncomeCategory, IncomeStats } from './types/income.types'
import { CompanySettings } from '@shared/types/companySettings'
import { ReactNode } from 'react'

import {
  formatCurrency,
  formatDate,
  getStatusColor,
  getPaymentMethodLabel,
  getPaymentStatusColor,
  getDaysUntilDue,
  isIncomeOverdue,
  canPerformAction,
} from './utils/income.utils'

import { getTextColor } from '@app/core/theme/theme.utils'

interface HeaderAction {
  title: string
  icon: ReactNode
  color: string
  onClick: () => void
}

interface RowAction {
  label: string
  icon: ReactNode
  color?: string
  onClick?: (row: Income, index: number) => void
  tooltip?: string | ((row: Income) => string)
  condition?: (row: Income) => boolean
}

/**
 * Column definitions for income table
 * Uses fields from vw_income_with_details view
 */
export const getIncomeColumns = (settings?: CompanySettings): any[] => [
  {
    header: 'Income #',
    accessor: 'income_number',
    width: 150,
    render: (row: Income) => {
      const IncomeCell = () => {
        const theme = useMantineTheme()
        const { colorScheme } = useMantineColorScheme()
        const resolvedColorScheme: 'light' | 'dark' =
          colorScheme === 'dark' ? 'dark' : 'light'
        const textColor = getTextColor(theme, resolvedColorScheme, 'primary')

        return (
          <Box>
            <Tooltip
              label={row.income_number}
              withinPortal
            >
              <Text
                fw={600}
                size="sm"
                c={textColor}
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {row.income_number}
              </Text>
            </Tooltip>
            {/* Show reference if system-generated */}
            {row.is_system && row.invoice_number && (
              <Text
                size="xs"
                c="dimmed"
              >
                Ref: {row.invoice_number}
              </Text>
            )}
          </Box>
        )
      }
      return <IncomeCell />
    },
  },
  {
    header: 'Date',
    accessor: 'income_date',
    width: 120,
    render: (row: Income) => {
      const DateCell = () => {
        const theme = useMantineTheme()
        const { colorScheme } = useMantineColorScheme()
        const resolvedColorScheme: 'light' | 'dark' =
          colorScheme === 'dark' ? 'dark' : 'light'
        const textColor = getTextColor(theme, resolvedColorScheme, 'primary')
        return (
          <Text
            size="sm"
            c={textColor}
          >
            {formatDate(row.income_date)}
          </Text>
        )
      }
      return <DateCell />
    },
  },
  {
    header: 'Description',
    accessor: 'description',
    width: 250,
    render: (row: Income) => {
      const DescriptionCell = () => {
        const theme = useMantineTheme()
        const { colorScheme } = useMantineColorScheme()
        const resolvedColorScheme: 'light' | 'dark' =
          colorScheme === 'dark' ? 'dark' : 'light'
        const textColor = getTextColor(theme, resolvedColorScheme, 'primary')

        return (
          <Box style={{ maxWidth: 250 }}>
            <Tooltip
              label={row.description || '—'}
              withinPortal
            >
              <Text
                size="sm"
                c={textColor}
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {row.description || '—'}
              </Text>
            </Tooltip>
          </Box>
        )
      }
      return <DescriptionCell />
    },
  },
  {
    header: 'Category',
    accessor: 'category_name', // ✅ comes from view join
    width: 160,
    render: (row: Income) => {
      const CategoryCell = () => {
        const theme = useMantineTheme()
        const { colorScheme } = useMantineColorScheme()
        const resolvedColorScheme: 'light' | 'dark' =
          colorScheme === 'dark' ? 'dark' : 'light'
        const dimmedColor = getTextColor(theme, resolvedColorScheme, 'dimmed')

        return (
          <Box>
            {row.category_name ? (
              <Badge
                variant="light"
                size="sm"
                color="cyan"
              >
                {row.category_name}
              </Badge>
            ) : (
              <Text
                size="sm"
                c={dimmedColor}
              >
                N/A
              </Text>
            )}
          </Box>
        )
      }
      return <CategoryCell />
    },
  },
  {
    header: 'Customer',
    accessor: 'resolved_customer_name', // ✅ comes from view join (COALESCE)
    width: 180,
    render: (row: Income) => {
      const CustomerCell = () => {
        const theme = useMantineTheme()
        const { colorScheme } = useMantineColorScheme()
        const resolvedColorScheme: 'light' | 'dark' =
          colorScheme === 'dark' ? 'dark' : 'light'
        const textColor = getTextColor(theme, resolvedColorScheme, 'primary')
        const dimmedColor = getTextColor(theme, resolvedColorScheme, 'dimmed')

        // Use resolved_customer_name from view (already has COALESCE logic)
        const displayName = row.resolved_customer_name || row.customer_name

        return (
          <Box>
            {displayName && displayName !== 'Walk-in Customer' ? (
              <Group
                gap="xs"
                wrap="nowrap"
              >
                <IconUsers
                  size={16}
                  color={theme.colors.blue[6]}
                />
                <Text
                  size="sm"
                  c={textColor}
                  style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {displayName}
                </Text>
              </Group>
            ) : (
              <Text
                size="sm"
                c={dimmedColor}
              >
                Walk-in
              </Text>
            )}
          </Box>
        )
      }
      return <CustomerCell />
    },
  },
  {
    header: 'Store',
    accessor: 'store_name', // ✅ comes from view join
    width: 150,
    render: (row: Income) => {
      const StoreCell = () => {
        const theme = useMantineTheme()
        const { colorScheme } = useMantineColorScheme()
        const resolvedColorScheme: 'light' | 'dark' =
          colorScheme === 'dark' ? 'dark' : 'light'
        const textColor = getTextColor(theme, resolvedColorScheme, 'primary')
        const dimmedColor = getTextColor(theme, resolvedColorScheme, 'dimmed')

        return (
          <Box>
            {row.store_name ? (
              <Group
                gap="xs"
                wrap="nowrap"
              >
                <IconBuilding
                  size={16}
                  color={theme.colors.teal[6]}
                />
                <Text
                  size="sm"
                  c={textColor}
                  style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {row.store_name}
                </Text>
              </Group>
            ) : (
              <Text
                size="sm"
                c={dimmedColor}
              >
                N/A
              </Text>
            )}
          </Box>
        )
      }
      return <StoreCell />
    },
  },
  {
    header: 'Amount',
    accessor: 'total_amount',
    width: 140,
    align: 'right' as const,
    render: (row: Income) => {
      const AmountCell = () => {
        const theme = useMantineTheme()
        const { colorScheme } = useMantineColorScheme()
        const resolvedColorScheme: 'light' | 'dark' =
          colorScheme === 'dark' ? 'dark' : 'light'
        const textColor = getTextColor(theme, resolvedColorScheme, 'primary')

        return (
          <Box>
            <Text
              fw={700}
              size="sm"
              c={textColor}
            >
              {formatCurrency(row.total_amount, settings)}
            </Text>
            {row.tax_amount && row.tax_amount > 0 ? (
              <Text
                size="xs"
                c="dimmed"
              >
                Tax: {formatCurrency(row.tax_amount, settings)}
              </Text>
            ) : null}
          </Box>
        )
      }
      return <AmountCell />
    },
  },
  {
    header: 'Payment',
    accessor: 'payment_method',
    width: 140,
    render: (row: Income) => {
      const PaymentCell = () => {
        const overdue = isIncomeOverdue(row)
        const daysUntilDue = getDaysUntilDue(row)
        const theme = useMantineTheme()
        const { colorScheme } = useMantineColorScheme()
        const resolvedColorScheme: 'light' | 'dark' =
          colorScheme === 'dark' ? 'dark' : 'light'
        const dimmedColor = getTextColor(theme, resolvedColorScheme, 'dimmed')

        return (
          <Stack gap={4}>
            <Badge
              variant="light"
              color="blue"
              size="sm"
              leftSection={<IconCash size={12} />}
            >
              {getPaymentMethodLabel(row.payment_method)}
            </Badge>
            {row.payment_status && (
              <Badge
                variant="dot"
                size="xs"
                color={getPaymentStatusColor(row.payment_status)}
              >
                {row.payment_status}
              </Badge>
            )}
            {overdue && (
              <Badge
                variant="filled"
                size="xs"
                color="red"
                leftSection={<IconAlertCircle size={10} />}
              >
                Overdue
              </Badge>
            )}
            {daysUntilDue !== null &&
              !overdue &&
              row.payment_status !== 'paid' && (
                <Text
                  c={dimmedColor}
                  size="xs"
                >
                  Due: {daysUntilDue}d
                </Text>
              )}
          </Stack>
        )
      }
      return <PaymentCell />
    },
  },
  {
    header: 'Status',
    accessor: 'status',
    width: 120,
    render: (row: Income) => (
      <Badge
        color={getStatusColor(row.status || 'draft')}
        variant={row.is_posted ? 'filled' : 'light'}
        size="md"
      >
        {row.is_posted ? 'Posted' : row.status || 'Draft'}
      </Badge>
    ),
  },
  {
    header: 'Source',
    accessor: 'is_system',
    width: 110,
    render: (row: Income) => (
      <Box>
        {row.is_system ? (
          <Tooltip
            label={`Auto-generated from ${row.reference_type || 'sale'}`}
            withinPortal
          >
            <Badge
              size="sm"
              color="violet"
              variant="light"
              leftSection={<IconRobot size={12} />}
            >
              Auto
            </Badge>
          </Tooltip>
        ) : (
          <Badge
            size="sm"
            color="blue"
            variant="light"
            leftSection={<IconUser size={12} />}
          >
            Manual
          </Badge>
        )}
      </Box>
    ),
  },
]

interface HeaderActionHandlers {
  onExportPDF: () => void
  onExportExcel: () => void
  onRefresh: () => void
}

export const getIncomeHeaderActions = (
  handlers: HeaderActionHandlers,
): HeaderAction[] => [
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

interface RowActionHandlers {
  onView?: (row: Income) => void
  onApprove: (row: Income) => void
  onPost: (row: Income) => void
  onEdit: (row: Income) => void
  onDelete: (row: Income) => void
}

export const getIncomeRowActions = (
  handlers: RowActionHandlers,
  settings?: CompanySettings,
): RowAction[] => [
  {
    label: 'View Details',
    icon: <IconEye size={16} />,
    onClick: handlers.onView,
    tooltip: 'View Income Details',
  },
  {
    label: 'Approve',
    icon: <IconCheck size={16} />,
    color: 'green',
    onClick: handlers.onApprove,
    tooltip: 'Approve Income',
    condition: (row) => canPerformAction(row, 'approve').allowed,
  },
  {
    label: 'Post to Journal',
    icon: <IconSend size={16} />,
    color: 'blue',
    onClick: handlers.onPost,
    tooltip: 'Post to Journal',
    condition: (row) => canPerformAction(row, 'post').allowed,
  },
  {
    label: 'Edit',
    icon: <IconEdit size={16} />,
    onClick: handlers.onEdit,
    tooltip: (row: Income) => {
      const check = canPerformAction(row, 'edit')
      return check.allowed ? 'Edit Income' : check.reason || 'Cannot edit'
    },
    condition: (row) => canPerformAction(row, 'edit').allowed,
  },
  {
    label: 'Delete',
    icon: <IconTrash size={16} />,
    color: 'red',
    onClick: handlers.onDelete,
    tooltip: (row: Income) => {
      const check = canPerformAction(row, 'delete')
      return check.allowed ? 'Delete Income' : check.reason || 'Cannot delete'
    },
    condition: (row) => canPerformAction(row, 'delete').allowed,
  },
]

interface FilterHandlers {
  onStatusChange: (value: string) => void
  onCategoryChange: (value: string) => void
  onDateRangeChange: (dates: [Date | null, Date | null]) => void
  categories: IncomeCategory[]
  currentStatusFilter: string
  currentCategoryFilter: number | null
  currentDateRange: [Date | null, Date | null]
}

export const getIncomeFilters = (handlers: FilterHandlers): any[] => {
  const filters: any[] = [
    {
      type: 'select',
      label: 'Status',
      placeholder: 'All Status',
      options: [
        { label: 'All Status', value: 'all' },
        { label: 'Draft', value: 'draft' },
        { label: 'Pending', value: 'pending' },
        { label: 'Approved', value: 'approved' },
        { label: 'Posted', value: 'posted' },
        { label: 'Cancelled', value: 'cancelled' },
      ],
      onChange: handlers.onStatusChange,
      value: handlers.currentStatusFilter,
    },
  ]

  if (handlers.categories && handlers.categories.length > 0) {
    filters.push({
      type: 'select',
      label: 'Category',
      placeholder: 'All Categories',
      options: [
        { label: 'All Categories', value: 'all' },
        ...handlers.categories.map((cat) => ({
          label: cat.category_name,
          value: String(cat.id),
        })),
      ],
      onChange: handlers.onCategoryChange,
      value: handlers.currentCategoryFilter
        ? String(handlers.currentCategoryFilter)
        : 'all',
    })
  }

  filters.push({
    type: 'dateRange',
    label: 'Date Range',
    placeholder: 'Select date range',
    value: handlers.currentDateRange,
    onChange: handlers.onDateRangeChange,
    clearable: true,
  })

  return filters
}

export const getStatisticsCardsData = (
  stats: IncomeStats,
  settings?: CompanySettings,
): any[] => {
  const currency = settings?.default_currency || 'UGX'

  return [
    {
      icon: <IconFileText />,
      number: stats.total.toString(),
      label: 'Total Records',
      color: 'blue',
    },
    {
      icon: <IconClock />,
      number: stats.pending.toString(),
      label: 'Pending Approval',
      color: 'orange',
      badge:
        stats.pending > 0
          ? { text: `${stats.pending} Awaiting`, color: 'orange' }
          : undefined,
    },
    {
      icon: <IconCheck />,
      number: stats.approved.toString(),
      label: 'Approved',
      color: 'cyan',
    },
    {
      icon: <IconSend />,
      number: stats.posted.toString(),
      label: 'Posted',
      color: 'green',
    },
    {
      icon: <IconCash />,
      number: formatCurrency(stats.totalAmount, settings),
      label: `Total Income (${currency})`,
      color: 'teal',
    },
    {
      icon: <IconCalendar />,
      number: formatCurrency(stats.currentMonthAmount, settings),
      label: `This Month (${currency})`,
      color: 'violet',
    },
    {
      icon: <IconRobot />,
      number: stats.systemGenerated?.toString() || '0',
      label: 'Auto-Generated',
      color: 'grape',
      badge:
        stats.systemGenerated && stats.systemGenerated > 0
          ? { text: 'From Sales', color: 'grape' }
          : undefined,
    },
    {
      icon: <IconUser />,
      number: stats.manualEntries?.toString() || '0',
      label: 'Manual Entries',
      color: 'indigo',
    },
  ]
}

