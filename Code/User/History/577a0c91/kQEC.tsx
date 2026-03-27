// src/pages/CashFlow/config/cashFlowManagement.config.tsx
import { Text, Badge, Tooltip, Box, MantineTheme } from '@mantine/core'
import {
  IconFileText,
  IconFileSpreadsheet,
  IconRefresh,
  IconTrash,
  IconEye,
  IconArrowUpRight,
  IconArrowDownLeft,
  IconCash,
  IconBuildingBank,
  IconCreditCard,
  IconDeviceMobile,
  IconReceipt,
} from '@tabler/icons-react'
import { CashFlowTransaction, CashFlowStats } from './types/cashFlow.types'
import { ReactNode } from 'react'
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
  onClick?: (row: CashFlowTransaction, index: number) => void
  tooltip?: string
}

interface StatCard {
  icon: ReactNode
  number: string
  label: string
  color: string
  subtitle?: string
}

/**
 * Currency locale mapping
 */
const getCurrencyLocale = (currency: string): string => {
  const localeMap: Record<string, string> = {
    UGX: 'en-UG',
    USD: 'en-US',
    EUR: 'en-EU',
    GBP: 'en-GB',
    KES: 'en-KE',
    TZS: 'en-TZ',
    RWF: 'en-RW',
  }
  return localeMap[currency] || 'en-US'
}

/**
 * Get icon for payment method
 */
const getPaymentMethodIcon = (method?: string) => {
  switch (method) {
    case 'cash':
      return <IconCash size={16} />
    case 'bank_transfer':
      return <IconBuildingBank size={16} />
    case 'credit_card':
    case 'debit_card':
      return <IconCreditCard size={16} />
    case 'mobile_money':
      return <IconDeviceMobile size={16} />
    case 'check':
      return <IconReceipt size={16} />
    default:
      return <IconCash size={16} />
  }
}

/**
 * Format currency with dynamic currency support
 */
const formatCurrency = (amount: number, currency: string = 'UGX') => {
  const locale = getCurrencyLocale(currency)
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

/**
 * Format date
 */
const formatDate = (dateString: string, currency: string = 'UGX') => {
  const locale = getCurrencyLocale(currency)
  return new Date(dateString).toLocaleDateString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/**
 * Column definitions for Cash Flow
 *
 * IMPORTANT: hooks (useMantineColorScheme, useMantineTheme) CANNOT be called
 * inside render functions — they run inside Array.map() in TableContent,
 * violating Rules of Hooks.
 *
 * Solution: call hooks in CashFlowManagement and pass theme/colorScheme here.
 * Render closures capture them from the outer function scope.
 */
export const getCashFlowColumns = (
  currency: string = 'UGX',
  theme: MantineTheme,
  colorScheme: 'light' | 'dark',
): any[] => {
  const resolvedColorScheme: 'light' | 'dark' =
    colorScheme === 'dark' ? 'dark' : 'light'

  return [
    {
      header: 'Date',
      accessor: 'entry_date',
      width: '10%',
      minWidth: 100,
      render: (row: CashFlowTransaction) => (
        <Box>
          <Text
            size="sm"
            fw={500}
            c={getTextColor(theme, resolvedColorScheme)}
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {row.entry_date ? formatDate(row.entry_date, currency) : '-'}
          </Text>
          {row.reference_type && (
            <Text
              c="dimmed"
              size="xs"
            >
              {row.reference_type}
            </Text>
          )}
        </Box>
      ),
    },
    {
      header: 'Description',
      accessor: 'description',
      width: '25%',
      minWidth: 200,
      render: (row: CashFlowTransaction) => (
        <Box style={{ minWidth: 0 }}>
          <Tooltip
            label={row.description || '-'}
            withinPortal
          >
            <Text
              size="sm"
              fw={500}
              c={getTextColor(theme, resolvedColorScheme)}
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {row.description || '-'}
            </Text>
          </Tooltip>
          {row.account_name && (
            <Text
              c="dimmed"
              size="xs"
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {row.account_name}
            </Text>
          )}
        </Box>
      ),
    },
    {
      header: 'Activity',
      accessor: 'activity_type',
      width: '12%',
      minWidth: 110,
      render: (row: CashFlowTransaction) => {
        const colorMap: Record<string, string> = {
          operating: 'blue',
          investing: 'violet',
          financing: 'orange',
        }
        return (
          <Badge
            variant="light"
            color={colorMap[row.activity_type || ''] || 'gray'}
            size="sm"
            style={{ textTransform: 'capitalize', fontWeight: 600 }}
          >
            {row.activity_type || 'N/A'}
          </Badge>
        )
      },
    },
    {
      header: 'Cash In',
      accessor: 'cash_in',
      width: '13%',
      minWidth: 120,
      render: (row: CashFlowTransaction) => {
        const cashIn = parseFloat(String(row.cash_in || 0))
        return (
          <Text
            size="sm"
            fw={600}
            c={cashIn > 0 ? 'green' : 'dimmed'}
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {cashIn > 0 ? formatCurrency(cashIn, currency) : '-'}
          </Text>
        )
      },
    },
    {
      header: 'Cash Out',
      accessor: 'cash_out',
      width: '13%',
      minWidth: 120,
      render: (row: CashFlowTransaction) => {
        const cashOut = parseFloat(String(row.cash_out || 0))
        return (
          <Text
            size="sm"
            fw={600}
            c={cashOut > 0 ? 'red' : 'dimmed'}
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {cashOut > 0 ? formatCurrency(cashOut, currency) : '-'}
          </Text>
        )
      },
    },
    {
      header: 'Net Flow',
      accessor: 'net_cash_flow',
      width: '13%',
      minWidth: 120,
      render: (row: CashFlowTransaction) => {
        const net = parseFloat(String(row.net_cash_flow || 0))
        return (
          <Text
            size="sm"
            fw={700}
            c={net >= 0 ? 'teal' : 'orange'}
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {formatCurrency(net, currency)}
          </Text>
        )
      },
    },
    {
      header: 'Running Balance',
      accessor: 'running_balance_by_activity',
      width: '14%',
      minWidth: 130,
      render: (row: CashFlowTransaction) => {
        const balance = parseFloat(String(row.running_balance_by_activity || 0))
        return (
          <Text
            size="sm"
            fw={700}
            c={balance >= 0 ? 'green' : 'red'}
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {formatCurrency(balance, currency)}
          </Text>
        )
      },
    },
  ]
}

interface HeaderActionHandlers {
  onExportPDF: () => void
  onExportExcel: () => void
  onRefresh: () => void
}

export const getCashFlowHeaderActions = (
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
  onViewDetails: (row: CashFlowTransaction) => void
  onDelete: (row: CashFlowTransaction) => void
}

export const getCashFlowRowActions = (
  handlers: RowActionHandlers,
): RowAction[] => [
  {
    label: 'View Details',
    icon: <IconEye size={16} />,
    onClick: handlers.onViewDetails,
    tooltip: 'View Details',
  },
  {
    label: 'Delete',
    icon: <IconTrash size={16} />,
    color: 'red',
    onClick: handlers.onDelete,
    tooltip: 'Delete Transaction',
  },
]

interface FilterHandlers {
  onPaymentMethodChange: (value: string) => void
  onDateRangeChange: (dates: [Date | null, Date | null]) => void
  currentPaymentMethodFilter?: string
  dateRange?: [Date | null, Date | null]
}

export const getCashFlowFilters = (handlers: FilterHandlers): any[] => {
  return [
    {
      label: 'Payment Method',
      type: 'select',
      options: [
        { label: 'All Methods', value: 'all' },
        { label: 'Cash', value: 'cash' },
        { label: 'Bank Transfer', value: 'bank_transfer' },
        { label: 'Mobile Money', value: 'mobile_money' },
        { label: 'Credit Card', value: 'credit_card' },
        { label: 'Debit Card', value: 'debit_card' },
        { label: 'Check', value: 'check' },
      ],
      onChange: handlers.onPaymentMethodChange,
      value: handlers.currentPaymentMethodFilter || 'all',
    },
    {
      label: 'Date Range',
      type: 'daterange',
      onChange: handlers.onDateRangeChange,
      value: handlers.dateRange || [null, null],
      placeholder: 'Select date range',
    },
  ]
}

export const getStatisticsCardsData = (
  stats: CashFlowStats,
  currency: string = 'UGX',
): StatCard[] => [
  {
    icon: <IconArrowUpRight />,
    number: formatCurrency(stats.totalInflow, currency),
    label: 'Total Cash In',
    color: 'green',
    subtitle: 'Cash received',
  },
  {
    icon: <IconArrowDownLeft />,
    number: formatCurrency(stats.totalOutflow, currency),
    label: 'Total Cash Out',
    color: 'red',
    subtitle: 'Cash paid out',
  },
  {
    icon: <IconCash />,
    number: formatCurrency(stats.netCashFlow, currency),
    label: 'Net Cash Flow',
    color: stats.netCashFlow >= 0 ? 'blue' : 'orange',
    subtitle: 'In minus Out',
  },
  {
    icon: <IconBuildingBank />,
    number: formatCurrency(stats.operatingCashFlow, currency),
    label: 'Operating',
    color: stats.operatingCashFlow >= 0 ? 'teal' : 'red',
    subtitle: 'Operating activities',
  },
]

