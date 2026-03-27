// SuppliersManagement.config.tsx - ENHANCED with Theme Support
import {
  Text,
  Badge,
  Group,
  Avatar,
  Tooltip,
  Box,
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
  IconTruck,
  IconCircleDashedCheck,
  IconCurrencyDollar,
} from '@tabler/icons-react'
import { SupplierWithRelations } from '@shared/types/suppliers'
import { ReactNode } from 'react'
import { getPrimaryColor, getThemeColors } from '@app/core/theme/theme.utils'

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
  onClick?: (row: SupplierWithRelations, index: number) => void
  tooltip?: string
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
}

/**
 * Column definitions for suppliers with theme support
 */
export const getSupplierColumns = (currency: string = 'UGX'): any[] => {
  const allCols = [
    {
      header: 'Supplier Name',
      accessor: 'supplier_name',
      maxWidth: 200,
      render: (row: SupplierWithRelations) => {
        const SupplierNameCell = () => {
          const theme = useMantineTheme()
          const { colorScheme } = useMantineColorScheme()
          const resolvedColorScheme: 'light' | 'dark' =
            colorScheme === 'dark' ? 'dark' : 'light'
          const primaryColor = getPrimaryColor(theme)
          const themeColors = getThemeColors(theme, resolvedColorScheme)

          return (
            <Group
              gap="sm"
              wrap="nowrap"
              style={{ minWidth: 0 }}
            >
              <Avatar
                color={theme.primaryColor}
                radius="xl"
                size="sm"
                style={{ flexShrink: 0 }}
              >
                <IconTruck size={16} />
              </Avatar>
              <Box style={{ minWidth: 0, flex: 1 }}>
                <Tooltip
                  label={row.supplier_name}
                  withinPortal
                >
                  <Text
                    fw={600}
                    size="sm"
                    c={themeColors.text}
                    style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {row.supplier_name}
                  </Text>
                </Tooltip>
                <Text
                  c="dimmed"
                  size="xs"
                  style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {row.contact_person || 'No contact'}
                </Text>
              </Box>
            </Group>
          )
        }
        return <SupplierNameCell />
      },
    },
    {
      header: 'Contact',
      accessor: 'contact_person',
      maxWidth: 160,
      render: (row: SupplierWithRelations) => {
        const ContactCell = () => {
          const { colorScheme } = useMantineColorScheme()
          const resolvedColorScheme: 'light' | 'dark' =
            colorScheme === 'dark' ? 'dark' : 'light'
          const themeColors = getThemeColors(
            useMantineTheme(),
            resolvedColorScheme,
          )

          return (
            <Box>
              <Text
                size="sm"
                fw={500}
                c={themeColors.text}
              >
                {row.phone || 'N/A'}
              </Text>
              {row.email && (
                <Tooltip
                  label={row.email}
                  withinPortal
                >
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
                </Tooltip>
              )}
            </Box>
          )
        }
        return <ContactCell />
      },
    },
    {
      header: 'Location',
      accessor: 'city',
      maxWidth: 150,
      render: (row: SupplierWithRelations) => {
        const LocationCell = () => {
          const { colorScheme } = useMantineColorScheme()
          const resolvedColorScheme: 'light' | 'dark' =
            colorScheme === 'dark' ? 'dark' : 'light'
          const themeColors = getThemeColors(
            useMantineTheme(),
            resolvedColorScheme,
          )

          return (
            <Box>
              <Text
                size="sm"
                c={themeColors.text}
              >
                {row.city || 'N/A'}
              </Text>
              {row.country && (
                <Text
                  size="xs"
                  c="dimmed"
                >
                  {row.country}
                </Text>
              )}
            </Box>
          )
        }
        return <LocationCell />
      },
    },
    {
      header: 'Amount Owed',
      accessor: 'current_balance',
      maxWidth: 150,
      render: (row: SupplierWithRelations) => {
        const AmountOwedCell = () => {
          const { colorScheme } = useMantineColorScheme()
          const resolvedColorScheme: 'light' | 'dark' =
            colorScheme === 'dark' ? 'dark' : 'light'
          const themeColors = getThemeColors(
            useMantineTheme(),
            resolvedColorScheme,
          )

          const amountOwed = Number(row.amount_owed_to_supplier || 0)
          const totalAmount = Number(
            row.total_purchase_amount || row.total_purchases || 0,
          )
          const totalPaid = Number(row.total_paid_to_supplier || 0)
          const hasDebt = amountOwed > 0

          let paymentStatus = 'No orders'
          let statusColor = 'gray'

          if (totalAmount > 0) {
            if (amountOwed === 0 || amountOwed < 0.01) {
              paymentStatus = 'Fully Paid'
              statusColor = 'green'
            } else if (totalPaid > 0) {
              paymentStatus = 'Partial'
              statusColor = 'orange'
            } else {
              paymentStatus = 'Unpaid'
              statusColor = 'red'
            }
          }

          return (
            <Box>
              <Tooltip
                label={
                  totalAmount > 0
                    ? `Total Orders: ${currency} ${totalAmount.toLocaleString()}\n` +
                      `Total Paid: ${currency} ${totalPaid.toLocaleString()}\n` +
                      `Amount Due: ${currency} ${amountOwed.toLocaleString()}`
                    : 'No purchase orders yet'
                }
                withinPortal
                multiline
                w={220}
              >
                <Badge
                  variant="light"
                  color={statusColor}
                  size="lg"
                  style={{ cursor: 'pointer' }}
                >
                  {totalAmount > 0
                    ? hasDebt
                      ? `${currency} ${amountOwed.toLocaleString()}`
                      : paymentStatus
                    : 'No Orders'}
                </Badge>
              </Tooltip>

              {totalAmount > 0 && (
                <Group
                  gap={4}
                  mt={4}
                >
                  <Text
                    size="xs"
                    c="dimmed"
                  >
                    {totalPaid > 0
                      ? `${Math.round((totalPaid / totalAmount) * 100)}% paid`
                      : '0% paid'}
                  </Text>
                </Group>
              )}
            </Box>
          )
        }
        return <AmountOwedCell />
      },
    },
    {
      header: 'Status',
      accessor: 'is_active',
      maxWidth: 120,
      render: (row: SupplierWithRelations) => (
        <Badge
          variant="dot"
          color={row.is_active ? 'green' : 'red'}
          size="lg"
          radius="sm"
        >
          {row.is_active ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
  ]

  // AUDIT: Keep Supplier Name, Contact, Amount Owed, Status
  const TABLE_COLS = [
    'supplier_name',
    'contact_person',
    'current_balance',
    'is_active',
  ]
  return allCols.filter((col: any) => TABLE_COLS.includes(col.accessor))
}

interface HeaderActionHandlers {
  onExportPDF?: () => void
  onExportExcel?: () => void
  onRefresh: () => void
}

/**
 * Header actions configuration
 */
export const getSupplierHeaderActions = (
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

/**
 * Primary action configuration
 */
export const getSupplierPrimaryAction = (
  onAddSupplier: () => void,
): PrimaryAction => ({
  icon: <IconTruck size={18} />,
  label: 'Add Supplier',
  onClick: onAddSupplier,
})

interface RowActionHandlers {
  onView?: (row: SupplierWithRelations) => void
  onEdit?: (row: SupplierWithRelations) => void
  onDelete?: (row: SupplierWithRelations) => void
}

/**
 * Row actions with tooltips
 */
export const getSupplierRowActions = (
  handlers: RowActionHandlers,
): RowAction[] => {
  const actions: RowAction[] = []

  if (handlers.onView) {
    actions.push({
      label: 'View Details',
      icon: <IconEye size={16} />,
      onClick: handlers.onView,
      tooltip: 'View Details',
    })
  }

  if (handlers.onEdit) {
    actions.push({
      label: 'Edit Supplier',
      icon: <IconEdit size={16} />,
      onClick: handlers.onEdit,
      tooltip: 'Edit Supplier',
    })
  }

  if (handlers.onDelete) {
    actions.push({
      label: 'Delete Supplier',
      icon: <IconTrash size={16} />,
      onClick: handlers.onDelete,
      tooltip: 'Delete Supplier',
    })
  }

  return actions
}

/**
 * Enhanced filter configuration
 */
export const getSupplierFilters = (
  onStatusChange: (value: string) => void,
): Filter[] => [
  {
    label: 'Status',
    options: [
      { label: 'All Suppliers', value: 'all' },
      { label: 'Active Only', value: 'active' },
      { label: 'Inactive Only', value: 'inactive' },
    ],
    onChange: onStatusChange,
  },
]

/**
 * Statistics cards with theme-aware colors
 */
export const getStatisticsCardsData = (
  stats: {
    total: number
    active: number
    withBalance: number
    totalOwed?: number
  },
  currency: string = 'UGX',
): StatCard[] => [
  {
    icon: <IconTruck />,
    number: stats.total.toString(),
    label: 'Total Suppliers',
    color: 'blue',
  },
  {
    icon: <IconCircleDashedCheck />,
    number: stats.active.toString(),
    label: 'Active Suppliers',
    color: 'green',
  },
  {
    icon: <IconCurrencyDollar />,
    number: stats.totalOwed
      ? `${currency} ${stats.totalOwed.toLocaleString()}`
      : stats.withBalance.toString(),
    label: stats.totalOwed
      ? 'Total Owed to Suppliers'
      : 'Suppliers with Balance',
    color: 'red',
  },
]
