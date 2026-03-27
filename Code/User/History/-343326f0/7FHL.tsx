// src/features/main/CustomersManagement/CustomersManagement.config.tsx

import {
  Text,
  Badge,
  Group,
  Avatar,
  Tooltip,
  Box,
  Progress,
  ActionIcon,
  MantineTheme,
} from '@mantine/core'
import {
  IconEye,
  IconEdit,
  IconTrash,
  IconFileText,
  IconFileSpreadsheet,
  IconRefresh,
  IconUsers,
  IconCircleDashedCheck,
  IconCreditCard,
  IconCash,
  IconAlertTriangle,
  IconExternalLink,
  IconCurrencyDollar,
} from '@tabler/icons-react'
import { CustomerWithRelations } from '@shared/types/customer'
import { ReactNode } from 'react'
import { CustomerStatsResponse } from './utils/customersManagement.utils'
import { formatCompactCurrency } from '@shared/utils/formatters'
import { useSelector } from 'react-redux'
import { selectDefaultCurrency } from '@features/authentication/authSlice'

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
  onClick?: (row: CustomerWithRelations, index: number) => void
  tooltip?: string
  condition?: (row: CustomerWithRelations) => boolean
}

interface FilterOption {
  label: string
  value: string
}

interface Filter {
  label: string
  options: FilterOption[]
  onChange: (value: string) => void
}

interface StatCard {
  icon: ReactNode
  number: string
  label: string
  color: string
  subtitle?: string
}

// ============================================================================
// COLUMNS
// ============================================================================

export const getCustomerColumns = (
  theme: MantineTheme,
  colorScheme: 'light' | 'dark',
  onCreditLinkClick?: (customerId: number) => void,
): any[] => {
  const currency = useSelector(selectDefaultCurrency)

  const isDark = colorScheme === 'dark'
  const textColor = isDark ? theme.white : theme.black

  const allCols = [
    {
      header: 'Customer',
      accessor: 'first_name',
      maxWidth: 220,
      render: (row: CustomerWithRelations) => {
        const isPatient = (row as any).customer_type !== 'business'
        const displayName =
          (row as any).customer_type === 'business' &&
          (row as any).business_name
            ? (row as any).business_name
            : `${row.first_name} ${row.last_name}`
        const subName =
          (row as any).customer_type === 'business'
            ? `${row.first_name} ${row.last_name}`
            : null
        return (
          <Group
            gap="sm"
            wrap="nowrap"
            style={{ minWidth: 0 }}
          >
            <Avatar
              color={isPatient ? theme.primaryColor : 'grape'}
              radius="xl"
              size="sm"
              style={{ flexShrink: 0 }}
            >
              {row.first_name[0]}
              {row.last_name[0]}
            </Avatar>
            <Box style={{ minWidth: 0, flex: 1 }}>
              <Text
                fw={600}
                size="sm"
                c={isPatient ? theme.primaryColor : 'grape'}
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {displayName}
              </Text>
              {subName && (
                <Text
                  size="xs"
                  c="dimmed"
                  style={{ whiteSpace: 'nowrap' }}
                >
                  {subName}
                </Text>
              )}
              <Badge
                size="xs"
                variant="dot"
                color={isPatient ? 'blue' : 'grape'}
                mt={2}
              >
                {isPatient ? 'Patient' : 'Business'}
              </Badge>
            </Box>
          </Group>
        )
      },
    },
    {
      header: 'Contact',
      accessor: 'phone',
      maxWidth: 160,
      render: (row: CustomerWithRelations) => (
        <Box>
          <Text
            size="sm"
            fw={500}
            c={textColor}
          >
            {row.phone || 'N/A'}
          </Text>
          {row.email && (
            <Text
              size="xs"
              c="dimmed"
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: '200px',
              }}
            >
              {row.email}
            </Text>
          )}
        </Box>
      ),
    },
    {
      header: 'Address',
      accessor: 'address',
      maxWidth: 180,
      render: (row: CustomerWithRelations) => (
        <Tooltip
          label={row.address || 'No address'}
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
            {row.address || 'N/A'}
          </Text>
        </Tooltip>
      ),
    },
    {
      header: 'Credit',
      accessor: 'credit_limit',
      maxWidth: 200,
      render: (row: CustomerWithRelations) => {
        const hasCredit = row.credit_limit && row.credit_limit > 0
        if (!hasCredit) {
          return (
            <Text
              size="xs"
              c="dimmed"
            >
              No credit
            </Text>
          )
        }

        const creditLimit = row.credit_limit || 0
        const currentBalance = row.current_credit_balance || 0
        const availableCredit = row.available_credit || 0
        const utilization =
          creditLimit > 0 ? (currentBalance / creditLimit) * 100 : 0

        const utilizationColor =
          utilization >= 90
            ? 'red'
            : utilization >= 75
              ? 'orange'
              : utilization >= 50
                ? 'yellow'
                : theme.primaryColor

        return (
          <Box>
            <Group
              gap={4}
              mb={4}
            >
              <Text
                size="xs"
                fw={600}
                c={textColor}
              >
                {formatCompactCurrency(currentBalance, currency)}/{formatCompactCurrency(creditLimit, currency)}
              </Text>
              {onCreditLinkClick && (
                <Tooltip label="Manage Credit">
                  <ActionIcon
                    size="xs"
                    variant="subtle"
                    color={theme.primaryColor}
                    onClick={(e) => {
                      e.stopPropagation()
                      onCreditLinkClick(row.id)
                    }}
                  >
                    <IconExternalLink size={12} />
                  </ActionIcon>
                </Tooltip>
              )}
            </Group>
            <Tooltip
              label={
                <Box>
                  <Text size="xs">
                    Balance: {formatCompactCurrency(currentBalance, currency)}
                  </Text>
                  <Text size="xs">
                    Available: {formatCompactCurrency(availableCredit, currency)}
                  </Text>
                  <Text size="xs">Utilization: {utilization.toFixed(1)}%</Text>
                  <Text size="xs">Days: {row.credit_days || 30}</Text>
                </Box>
              }
              withinPortal
            >
              <Progress
                value={utilization}
                color={utilizationColor}
                size="sm"
                radius="xl"
              />
            </Tooltip>
          </Box>
        )
      },
    },
    {
      header: 'Purchases',
      accessor: 'total_purchases',
      maxWidth: 140,
      render: (row: CustomerWithRelations) => {
        const totalPurchases = row.total_purchases || 0
        const lastPurchase = row.last_purchase_date

        return (
          <Box>
            <Text
              size="sm"
              fw={600}
              c={theme.primaryColor}
            >
              {totalPurchases.toLocaleString('en-US')}
            </Text>
            {lastPurchase && (
              <Text
                size="xs"
                c="dimmed"
              >
                {new Date(lastPurchase).toLocaleDateString()}
              </Text>
            )}
          </Box>
        )
      },
    },
    {
      header: 'Status',
      accessor: 'is_active',
      maxWidth: 100,
      render: (row: CustomerWithRelations) => (
        <Group
          gap={6}
          wrap="nowrap"
        >
          <div
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              backgroundColor: row.is_active
                ? 'var(--mantine-color-green-6)'
                : 'var(--mantine-color-red-5)',
              flexShrink: 0,
            }}
          />
          <Text
            size="xs"
            fw={600}
            c={
              row.is_active
                ? 'var(--mantine-color-green-8)'
                : 'var(--mantine-color-red-7)'
            }
          >
            {row.is_active ? 'Active' : 'Inactive'}
          </Text>
        </Group>
      ),
    },
  ]

  return allCols
}

// ============================================================================
// HEADER ACTIONS
// ============================================================================

interface HeaderActionHandlers {
  onExportPDF?: () => void
  onExportExcel?: () => void
  onRefresh: () => void
}

export const getCustomerHeaderActions = (
  handlers: HeaderActionHandlers,
): HeaderAction[] => {
  const actions: HeaderAction[] = []

  if (handlers.onExportPDF) {
    actions.push({
      title: 'Export PDF',
      icon: <IconFileText size={20} />,
      color: 'red',
      onClick: handlers.onExportPDF,
    })
  }

  if (handlers.onExportExcel) {
    actions.push({
      title: 'Export Excel',
      icon: <IconFileSpreadsheet size={20} />,
      color: 'green',
      onClick: handlers.onExportExcel,
    })
  }

  actions.push({
    title: 'Refresh',
    icon: <IconRefresh size={20} />,
    color: 'gray',
    onClick: handlers.onRefresh,
  })

  return actions
}

export const getCustomerPrimaryAction = (
  onAddCustomer: () => void,
): PrimaryAction => ({
  icon: <IconUsers size={18} />,
  label: 'Add Customer',
  onClick: onAddCustomer,
})

// ============================================================================
// ROW ACTIONS
// ============================================================================

interface RowActionHandlers {
  onView?: (row: CustomerWithRelations) => void
  onEdit?: (row: CustomerWithRelations) => void
  onDelete?: (row: CustomerWithRelations) => void
  onManageCredit?: (row: CustomerWithRelations) => void
  onPayCredit?: (row: CustomerWithRelations) => void
}

export const getCustomerRowActions = (
  handlers: RowActionHandlers,
): RowAction[] => {
  const actions: RowAction[] = []

  if (handlers.onView) {
    actions.push({
      label: 'View Details',
      icon: <IconEye size={16} />,
      onClick: handlers.onView,
      tooltip: 'View customer details',
      condition: () => true,
    })
  }

  if (handlers.onEdit) {
    actions.push({
      label: 'Edit Customer',
      icon: <IconEdit size={16} />,
      onClick: handlers.onEdit,
      tooltip: 'Edit customer information',
      condition: () => true,
    })
  }

  if (handlers.onPayCredit) {
    actions.push({
      label: 'Pay Credit',
      icon: <IconCurrencyDollar size={16} />,
      color: 'green',
      onClick: handlers.onPayCredit,
      tooltip: 'Record customer payment',
      condition: (row) =>
        !!(
          row.credit_limit &&
          row.credit_limit > 0 &&
          row.current_credit_balance &&
          row.current_credit_balance > 0
        ),
    })
  }

  if (handlers.onManageCredit) {
    actions.push({
      label: 'Manage Credit',
      icon: <IconCreditCard size={16} />,
      color: 'blue',
      onClick: handlers.onManageCredit,
      tooltip: 'Open Credit Management page',
      condition: (row) => !!(row.credit_limit && row.credit_limit > 0),
    })
  }

  if (handlers.onDelete) {
    actions.push({
      label: 'Delete Customer',
      icon: <IconTrash size={16} />,
      color: 'red',
      onClick: handlers.onDelete,
      tooltip: 'Delete customer',
      condition: () => true,
    })
  }

  return actions
}

// ============================================================================
// FILTERS
// ============================================================================

export const getCustomerFilters = (
  onStatusChange: (value: string) => void,
  onCreditChange: (value: string) => void,
  onTypeChange: (value: string) => void,
): Filter[] => [
  {
    label: 'Type',
    options: [
      { label: 'All Types', value: 'all' },
      { label: 'Patients (Retail)', value: 'patient' },
      { label: 'Business (Wholesale)', value: 'business' },
    ],
    onChange: onTypeChange,
  },
  {
    label: 'Status',
    options: [
      { label: 'All Customers', value: 'all' },
      { label: 'Active Only', value: 'active' },
      { label: 'Inactive Only', value: 'inactive' },
    ],
    onChange: onStatusChange,
  },
  {
    label: 'Credit',
    options: [
      { label: 'All', value: 'all' },
      { label: 'With Credit', value: 'with_credit' },
      { label: 'No Credit', value: 'no_credit' },
      { label: 'Has Balance', value: 'has_balance' },
    ],
    onChange: onCreditChange,
  },
]

// ============================================================================
// STATISTICS CARDS
// ============================================================================

export const getStatisticsCardsData = (
  stats: CustomerStatsResponse | null,
  theme: MantineTheme,
  currency: string = 'UGX',
): StatCard[] => [
  {
    icon: <IconUsers />,
    number: stats?.total?.toString() || '0',
    label: 'Total Customers',
    color: theme.primaryColor,
  },
  {
    icon: <IconCircleDashedCheck />,
    number: stats?.withCredit?.toString() || '0',
    label: 'With Credit',
    color: 'green',
  },
  {
    icon: <IconCash />,
    number: formatCompactCurrency(stats?.totalCreditLimit || 0, currency),
    label: 'Total Credit Limit',
    color: theme.primaryColor,
  },
  {
    icon: <IconAlertTriangle />,
    number: formatCompactCurrency(stats?.outstandingCredit || 0, currency),
    label: 'Outstanding Credit',
    color: 'red',
  },
]


