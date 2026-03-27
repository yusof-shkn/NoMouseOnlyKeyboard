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
import { CashFlowTransaction, CashFlowStats } from '../types/cashFlow.types'
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

const getCurrencyLocale = (currency: string): string => {
  const localeMap: Record<string, string> = {
    UGX: 'en-UG', USD: 'en-US', EUR: 'en-EU',
    GBP: 'en-GB', KES: 'en-KE', TZS: 'en-TZ', RWF: 'en-RW',
  }
  return localeMap[currency] || 'en-US'
}

const getPaymentMethodIcon = (method?: string | null) => {
  switch (method) {
    case 'cash':          return <IconCash size={16} />
    case 'bank_transfer': return <IconBuildingBank size={16} />
    case 'credit_card':
    case 'debit_card':    return <IconCreditCard size={16} />
    case 'mobile_money':  return <IconDeviceMobile size={16} />
    case 'check':         return <IconReceipt size={16} />
    default:              return <IconCash size={16} />
  }
}

const formatCurrency = (amount: number, currency: string = 'UGX') =>
  new Intl.NumberFormat(getCurrencyLocale(currency), {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)

const formatDate = (dateString: string, currency: string = 'UGX') =>
  new Date(dateString).toLocaleDateString(getCurrencyLocale(currency), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })

export const getCashFlowColumns = (
  currency: string = 'UGX',
  theme: MantineTheme,
  colorScheme: 'light' | 'dark',
): any[] => {
  const cs: 'light' | 'dark' = colorScheme === 'dark' ? 'dark' : 'light'

  return [
    {
      header: 'Date',
      accessor: 'transaction_date',
      width: '10%',
      minWidth: 100,
      render: (row: CashFlowTransaction) => (
        <Box>
          <Text
            size="sm"
            fw={500}
            c={getTextColor(theme, cs)}
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {row.transaction_date ? formatDate(row.transaction_date, currency) : '-'}
          </Text>
          {row.reference_type && (
            <Text c="dimmed" size="xs">{row.reference_type}</Text>
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
          <Tooltip label={row.description || '-'} withinPortal>
            <Text
              size="sm"
              fw={500}
              c={getTextColor(theme, cs)}
              style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >
              {row.description || '-'}
            </Text>
          </Tooltip>
          {row.reference_number && (
            <Text
              c="dimmed"
              size="xs"
              style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >
              Ref: {row.reference_number}
            </Text>
          )}
          {row.category && (
            <Text c="dimmed" size="xs">{row.category}</Text>
          )}
        </Box>
      ),
    },
    {
      header: 'Activity',
      accessor: 'activity_type',
      width: '11%',
      minWidth: 100,
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
        // Prefer enriched cash_in; fall back inline
        const cashIn = row.cash_in != null
          ? row.cash_in
          : row.transaction_type === 'inflow' ? parseFloat(String(row.amount ?? 0)) : 0
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
        const cashOut = row.cash_out != null
          ? row.cash_out
          : row.transaction_type === 'outflow' ? parseFloat(String(row.amount ?? 0)) : 0
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
        const net = row.net_cash_flow != null
          ? row.net_cash_flow
          : row.transaction_type === 'inflow'
            ? parseFloat(String(row.amount ?? 0))
            : -parseFloat(String(row.amount ?? 0))
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
      accessor: 'running_balance',
      width: '14%',
      minWidth: 130,
      render: (row: CashFlowTransaction) => {
        const balance = parseFloat(String(row.running_balance ?? 0))
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
    {
      header: 'Payment',
      accessor: 'payment_method',
      width: '10%',
      minWidth: 100,
      render: (row: CashFlowTransaction) => (
        <Box style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {getPaymentMethodIcon(row.payment_method)}
          <Text size="xs" c="dimmed" style={{ textTransform: 'capitalize' }}>
            {row.payment_method?.replace('_', ' ') ?? 'N/A'}
          </Text>
        </Box>
      ),
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

export const getCashFlowRowActions = (handlers: RowActionHandlers): RowAction[] => [
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

export const getCashFlowFilters = (handlers: FilterHandlers): any[] => [
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
