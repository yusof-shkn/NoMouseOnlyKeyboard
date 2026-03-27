// src/pages/CashFlow/config/cashFlowManagement.config.tsx
import {
  Text,
  Badge,
  Group,
  Tooltip,
  Box,
  useMantineColorScheme,
  useMantineTheme,
} from '@mantine/core'
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

interface FilterOption {
  label: string
  value: string
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
 * Get badge color for transaction type
 */
const getTransactionTypeBadgeColor = (type?: string) => {
  return type === 'inflow' ? 'green' : 'red'
}

/**
 * Get badge color for activity type
 */
const getActivityTypeBadgeColor = (type?: string) => {
  switch (type) {
    case 'operating':
      return 'blue'
    case 'investing':
      return 'violet'
    case 'financing':
      return 'orange'
    default:
      return 'gray'
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
 * Format date with dynamic locale support
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
 * Column definitions with currency and dark mode support
 */
export const getCashFlowColumns = (currency: string = 'UGX'): any[] => [
  {
    header: 'Date',
    accessor: 'transaction_date',
    width: '10%',
    minWidth: 100,
    render: (row: CashFlowTransaction) => {
      const { colorScheme } = useMantineColorScheme()
      const theme = useMantineTheme()
      const resolvedColorScheme: 'light' | 'dark' =
        colorScheme === 'dark' ? 'dark' : 'light'
      return (
        <Box>
          <Text
            size="sm"
            fw={500}
            c={getTextColor(theme, resolvedColorScheme)}
            style={{
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {formatDate(row.entry_date, currency)}
          </Text>
          {row.receipt_number && (
            <Text
              c="dimmed"
              size="xs"
            >
              #{row.receipt_number}
            </Text>
          )}
        </Box>
      )
    },
  },
  {
    header: 'Bank & Account Number',
    accessor: 'bank_info',
    width: '15%',
    minWidth: 150,
    render: (row: CashFlowTransaction) => {
      const { colorScheme } = useMantineColorScheme()
      const theme = useMantineTheme()
      const resolvedColorScheme: 'light' | 'dark' =
        colorScheme === 'dark' ? 'dark' : 'light'
      if (!row.bank_name && !row.account_number) {
        return (
          <Text
            c="dimmed"
            size="sm"
          >
            N/A
          </Text>
        )
      }
      return (
        <Box style={{ minWidth: 0 }}>
          {row.bank_name && (
            <Tooltip
              label={row.bank_name}
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
                {row.bank_name}
              </Text>
            </Tooltip>
          )}
          {row.account_number && (
            <Text
              c="dimmed"
              size="xs"
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {row.account_number}
            </Text>
          )}
        </Box>
      )
    },
  },
  {
    header: 'Description',
    accessor: 'description',
    width: '20%',
    minWidth: 200,
    render: (row: CashFlowTransaction) => {
      const { colorScheme } = useMantineColorScheme()
      const theme = useMantineTheme()
      const resolvedColorScheme: 'light' | 'dark' =
        colorScheme === 'dark' ? 'dark' : 'light'
      return (
        <Box style={{ minWidth: 0 }}>
          <Tooltip
            label={row.description}
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
              {row.description}
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
      )
    },
  },
  {
    header: 'Credit',
    accessor: 'credit',
    width: '12%',
    minWidth: 120,
    render: (row: CashFlowTransaction) => (
      <Text
        size="sm"
        fw={600}
        c={row.transaction_type === 'inflow' ? 'green' : 'dimmed'}
        style={{
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {row.transaction_type === 'inflow'
          ? formatCurrency(row.amount, currency)
          : '-'}
      </Text>
    ),
  },
  {
    header: 'Debit',
    accessor: 'debit',
    width: '12%',
    minWidth: 120,
    render: (row: CashFlowTransaction) => (
      <Text
        size="sm"
        fw={600}
        c={row.transaction_type === 'outflow' ? 'red' : 'dimmed'}
        style={{
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {row.transaction_type === 'outflow'
          ? formatCurrency(row.amount, currency)
          : '-'}
      </Text>
    ),
  },
  {
    header: 'Account Balance',
    accessor: 'account_balance',
    width: '12%',
    minWidth: 120,
    render: (row: CashFlowTransaction) => (
      <Text
        size="sm"
        fw={600}
        c={(row.running_balance || 0) >= 0 ? 'green' : 'red'}
        style={{
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {formatCurrency(row.running_balance || 0, currency)}
      </Text>
    ),
  },
  {
    header: 'Total Balance',
    accessor: 'total_balance',
    width: '12%',
    minWidth: 120,
    render: (row: CashFlowTransaction) => (
      <Text
        size="sm"
        fw={700}
        c={(row.running_balance || 0) >= 0 ? 'teal' : 'orange'}
        style={{
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {formatCurrency(row.running_balance || 0, currency)}
      </Text>
    ),
  },
  {
    header: 'Payment Method',
    accessor: 'payment_method',
    width: '12%',
    minWidth: 130,
    render: (row: CashFlowTransaction) => (
      <Badge
        variant="light"
        color="blue"
        leftSection={getPaymentMethodIcon(row.payment_method)}
        size="sm"
        style={{
          textTransform: 'capitalize',
          fontWeight: 600,
        }}
      >
        {row.payment_method?.replace('_', ' ')}
      </Badge>
    ),
  },
]

interface HeaderActionHandlers {
  onExportPDF: () => void
  onExportExcel: () => void
  onRefresh: () => void
}

/**
 * Header actions
 */
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

/**
 * Row actions
 */
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

/**
 * Filter configurations - Payment Method and Date Range
 */
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

/**
 * Statistics cards with dynamic currency
 */
export const getStatisticsCardsData = (
  stats: CashFlowStats,
  currency: string = 'UGX',
): StatCard[] => [
  {
    icon: <IconArrowUpRight />,
    number: formatCurrency(stats.totalInflow, currency),
    label: 'Total Inflow',
    color: 'green',
    subtitle: 'Cash received',
  },
  {
    icon: <IconArrowDownLeft />,
    number: formatCurrency(stats.totalOutflow, currency),
    label: 'Total Outflow',
    color: 'red',
    subtitle: 'Cash paid',
  },
  {
    icon: <IconCash />,
    number: formatCurrency(stats.netCashFlow, currency),
    label: 'Net Cash Flow',
    color: stats.netCashFlow >= 0 ? 'blue' : 'orange',
    subtitle: 'Inflow - Outflow',
  },
  {
    icon: <IconBuildingBank />,
    number: formatCurrency(stats.currentBalance, currency),
    label: 'Current Balance',
    color: stats.currentBalance >= 0 ? 'teal' : 'red',
    subtitle: 'Available cash',
  },
]

