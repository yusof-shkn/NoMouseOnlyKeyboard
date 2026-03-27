// src/pages/Finance/Expenses/config/Expense.config.tsx
import {
  Text,
  Badge,
  Group,
  Tooltip,
  Box,
  Stack,
  useMantineTheme,
  useMantineColorScheme,
} from '@mantine/core'
import {
  IconEdit,
  IconTrash,
  IconFileText,
  IconFileSpreadsheet,
  IconRefresh,
  IconEye,
  IconCheck,
  IconSend,
  IconReceipt,
  IconCreditCard,
  IconCash,
  IconBuildingBank,
  IconDeviceMobile,
  IconRobot,
  IconAlertCircle,
} from '@tabler/icons-react'
import { Expense } from './types/expense.types'
import { CompanySettings } from '@shared/types/companySettings'
import { ReactNode } from 'react'
import {
  getCurrencyCode,
  isSystemExpense,
  getExpenseSourceLabel,
} from './utils/expense.utils'
import { getTextColor, getPrimaryColor } from '@app/core/theme/theme.utils'

interface HeaderAction {
  title: string
  icon: ReactNode
  color: string
  onClick: () => void
}

interface PrimaryAction {
  icon: ReactNode
  label: string
  onClick: () => void
}

interface RowAction {
  label: string
  icon: ReactNode
  color?: string
  onClick?: (row: Expense, index: number) => void
  tooltip?: string
  condition?: (row: Expense) => boolean
}

/**
 * Get payment method icon
 */
const getPaymentMethodIcon = (method?: string) => {
  switch (method) {
    case 'cash':
      return <IconCash size={16} />
    case 'mobile_money':
      return <IconDeviceMobile size={16} />
    case 'bank_transfer':
      return <IconBuildingBank size={16} />
    case 'card':
    case 'credit':
      return <IconCreditCard size={16} />
    case 'insurance':
      return <IconReceipt size={16} />
    default:
      return <IconReceipt size={16} />
  }
}

/**
 * Get status badge color
 */
const getStatusBadgeColor = (status?: string) => {
  switch (status) {
    case 'draft':
      return 'gray'
    case 'pending':
      return 'yellow'
    case 'approved':
      return 'blue'
    case 'posted':
      return 'green'
    case 'cancelled':
    case 'void':
      return 'red'
    default:
      return 'gray'
  }
}

/**
 * Get payment status badge color
 */
const getPaymentStatusBadgeColor = (status?: string) => {
  switch (status) {
    case 'paid':
      return 'green'
    case 'unpaid':
      return 'red'
    case 'partially_paid':
      return 'yellow'
    case 'overdue':
      return 'orange'
    default:
      return 'gray'
  }
}

/**
 * Format currency with company settings from Redux
 */
const formatCurrency = (amount?: number, settings?: CompanySettings | null) => {
  if (!amount) return '0'
  return amount.toLocaleString('en-UG', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
}

/**
 * Format date
 */
const formatDate = (dateString?: string) => {
  if (!dateString) return 'N/A'
  return new Date(dateString).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

/**
 * Column definitions with dynamic currency from Redux and system-generated indicator
 */
export const getExpenseColumns = (
  companySettings?: CompanySettings | null,
): any[] => {
  const currencyCode = getCurrencyCode(companySettings)

  return [
    {
      header: 'Expense Details',
      accessor: 'expense_number',
      maxWidth: 200,
      render: (row: Expense) => {
        const ExpenseCell = () => {
          const theme = useMantineTheme()
          const { colorScheme } = useMantineColorScheme()
          const resolvedColorScheme: 'light' | 'dark' =
            colorScheme === 'dark' ? 'dark' : 'light'
          const textColor = getTextColor(theme, resolvedColorScheme, 'primary')
          const dimmedColor = getTextColor(theme, resolvedColorScheme, 'dimmed')

          return (
            <Box style={{ minWidth: 0 }}>
              <Group
                gap={4}
                wrap="nowrap"
              >
                <Tooltip
                  label={row.expense_number}
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
                    {row.expense_number}
                  </Text>
                </Tooltip>
                {isSystemExpense(row) && (
                  <Tooltip
                    label={`Auto-generated from ${getExpenseSourceLabel(row)}`}
                    withinPortal
                  >
                    <IconRobot
                      size={16}
                      color="#667eea"
                    />
                  </Tooltip>
                )}
              </Group>
              <Text
                c={dimmedColor}
                size="xs"
              >
                {formatDate(row.expense_date)}
              </Text>
              {isSystemExpense(row) && (
                <Badge
                  size="xs"
                  variant="light"
                  color="violet"
                  mt={2}
                >
                  Auto-generated
                </Badge>
              )}
            </Box>
          )
        }
        return <ExpenseCell />
      },
    },
    {
      header: 'Description',
      accessor: 'description',
      maxWidth: 250,
      render: (row: Expense) => {
        const DescriptionCell = () => {
          const theme = useMantineTheme()
          const { colorScheme } = useMantineColorScheme()
          const resolvedColorScheme: 'light' | 'dark' =
            colorScheme === 'dark' ? 'dark' : 'light'
          const textColor = getTextColor(theme, resolvedColorScheme, 'primary')

          return (
            <Tooltip
              label={row.description}
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
                {row.description}
              </Text>
            </Tooltip>
          )
        }
        return <DescriptionCell />
      },
    },
    {
      header: 'Category',
      accessor: 'category',
      maxWidth: 180,
      render: (row: Expense) => {
        const CategoryCell = () => {
          const theme = useMantineTheme()
          const { colorScheme } = useMantineColorScheme()
          const resolvedColorScheme: 'light' | 'dark' =
            colorScheme === 'dark' ? 'dark' : 'light'
          const textColor = getTextColor(theme, resolvedColorScheme, 'primary')

          return (
            <Box style={{ minWidth: 0 }}>
              <Text
                size="sm"
                fw={500}
                c={textColor}
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {row.expense_categories?.category_name ||
                  `Category #${row.category_id}`}
              </Text>
            </Box>
          )
        }
        return <CategoryCell />
      },
    },
    {
      header: 'Amount',
      accessor: 'total_amount',
      render: (row: Expense) => {
        const AmountCell = () => {
          const theme = useMantineTheme()
          const { colorScheme } = useMantineColorScheme()
          const resolvedColorScheme: 'light' | 'dark' =
            colorScheme === 'dark' ? 'dark' : 'light'
          const textColor = getTextColor(theme, resolvedColorScheme, 'primary')
          const dimmedColor = getTextColor(theme, resolvedColorScheme, 'dimmed')

          return (
            <Stack gap={2}>
              <Text
                fw={600}
                size="sm"
                c={textColor}
              >
                {formatCurrency(row.total_amount, companySettings)}{' '}
                {currencyCode}
              </Text>
              {row.tax_amount && row.tax_amount > 0 && (
                <Text
                  c={dimmedColor}
                  size="xs"
                >
                  Tax: {formatCurrency(row.tax_amount, companySettings)}
                </Text>
              )}
            </Stack>
          )
        }
        return <AmountCell />
      },
    },
    {
      header: 'Payment',
      accessor: 'payment_method',
      render: (row: Expense) => (
        <Group gap="xs">
          <Badge
            variant="light"
            color="blue"
            leftSection={getPaymentMethodIcon(row.payment_method)}
            size="sm"
          >
            {row.payment_method?.replace('_', ' ').toUpperCase()}
          </Badge>
        </Group>
      ),
    },
    {
      header: 'Payment Status',
      accessor: 'payment_status',
      render: (row: Expense) => (
        <Badge
          color={getPaymentStatusBadgeColor(row.payment_status)}
          variant="dot"
          size="lg"
        >
          {row.payment_status?.replace('_', ' ').toUpperCase()}
        </Badge>
      ),
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (row: Expense) => (
        <Badge
          color={getStatusBadgeColor(row.status)}
          variant="light"
          size="lg"
        >
          {row.status?.toUpperCase()}
        </Badge>
      ),
    },
  ]
}

interface HeaderActionHandlers {
  onExportPDF: () => void
  onExportExcel: () => void
  onRefresh: () => void
}

/**
 * Header actions
 */
export const getExpenseHeaderActions = (
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

/**
 * Primary action configuration
 */
export const getExpensePrimaryAction = (
  onAddExpense: () => void,
): PrimaryAction => ({
  icon: <IconReceipt size={18} />,
  label: 'Add Expense',
  onClick: onAddExpense,
})

interface RowActionHandlers {
  onViewDetails: (row: Expense) => void
  onEdit: (row: Expense) => void
  onDelete: (row: Expense) => void
  onApprove: (row: Expense) => void
  onPost: (row: Expense) => void
}

/**
 * Row actions with conditional display
 * Updated to handle system-generated expenses
 */ export const getExpenseRowActions =
  (handlers: RowActionHandlers) =>
  (row: Expense, _index: number): RowAction[] => {
    const allActions: RowAction[] = [
      {
        label: 'View Details',
        icon: <IconEye size={16} />,
        onClick: handlers.onViewDetails,
        tooltip: 'View Details',
      },
      {
        label: 'Edit',
        icon: <IconEdit size={16} />,
        onClick: handlers.onEdit,
        tooltip: 'Edit Expense',
        condition: (row: Expense) =>
          !isSystemExpense(row) &&
          (row.status === 'draft' || row.status === 'pending'),
      },
      {
        label: 'Approve',
        icon: <IconCheck size={16} />,
        onClick: handlers.onApprove,
        tooltip: 'Approve Expense',
        condition: (row: Expense) =>
          !isSystemExpense(row) && row.status === 'pending',
        color: 'blue',
      },
      {
        label: 'Post to GL',
        icon: <IconSend size={16} />,
        onClick: handlers.onPost,
        tooltip: 'Post to General Ledger',
        condition: (row: Expense) =>
          !isSystemExpense(row) && row.status === 'approved',
        color: 'green',
      },
      {
        label: 'Delete',
        icon: <IconTrash size={16} />,
        onClick: handlers.onDelete,
        tooltip: 'Delete Expense',
        condition: (row: Expense) =>
          !isSystemExpense(row) && row.status !== 'posted',
      },
    ]

    // Filter: keep action if it has no condition, or condition returns true
    return allActions.filter(
      (action) => !action.condition || action.condition(row),
    )
  }

interface FilterHandlers {
  onStatusChange: (value: string) => void
  onCategoryChange?: (value: string) => void
  onDateRangeChange?: (value: [Date | null, Date | null]) => void
  categories?: any[]
  currentCategoryFilter?: string | null
  dateRange?: [Date | null, Date | null]
}

/**
 * Filter configurations
 */
export const getExpenseFilters = (handlers: FilterHandlers): any[] => {
  const filters: any[] = [
    {
      label: 'Status',
      options: [
        { label: 'All Statuses', value: 'all' },
        { label: 'Draft', value: 'draft' },
        { label: 'Pending', value: 'pending' },
        { label: 'Approved', value: 'approved' },
        { label: 'Posted', value: 'posted' },
        { label: 'Cancelled', value: 'cancelled' },
      ],
      onChange: handlers.onStatusChange,
    },
  ]

  if (
    handlers.onCategoryChange &&
    handlers.categories &&
    handlers.categories.length > 0
  ) {
    filters.push({
      label: 'Category',
      options: [
        { label: 'All Categories', value: 'all' },
        ...handlers.categories.map((cat) => ({
          label: cat.category_name,
          value: String(cat.id),
        })),
      ],
      onChange: handlers.onCategoryChange,
      value: handlers.currentCategoryFilter || 'all',
    })
  }

  if (handlers.onDateRangeChange) {
    filters.push({
      type: 'dateRange',
      label: 'Date Range',
      placeholder: 'Select date range',
      value: handlers.dateRange || [null, null],
      onChange: handlers.onDateRangeChange,
      clearable: true,
    })
  }

  return filters
}

