// src/pages/IncomeCategories/config/incomeCategoryManagement.config.tsx
import { Text, Badge, Group, Box, Tooltip } from '@mantine/core'
import {
  IconEdit,
  IconTrash,
  IconFileText,
  IconFileSpreadsheet,
  IconRefresh,
  IconCoin,
  IconTarget,
  IconTrendingUp,
  IconToggleRight,
  IconCategory,
  IconEye,
  IconLock,
  IconShield,
} from '@tabler/icons-react'
import {
  IncomeCategory,
  IncomeCategoryStats,
} from './types/incomeCategory.types'
import { ReactNode } from 'react'

import {
  TextCell,
  BadgeCell,
  CurrencyCell,
  DateCell,
  StatusDotCell,
  TruncatedTextCell,
  AvatarNameCell,
  ActiveStatusCell,
  type StatusDotConfig,
} from '@shared/components/tableCell'
import {
  formatCurrency,
  formatPercentage,
  getAchievementColor,
  getAchievementLabel,
} from './utils/incomeCategory.utils'

// ---------------------------------------------------------------------------
// SHARED INTERFACES
// ---------------------------------------------------------------------------

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
  onClick?: (row: IncomeCategory, index: number) => void
  tooltip?: string
  disabled?: boolean
  disabledTooltip?: string
}

interface StatCard {
  icon: ReactNode
  number: string
  label: string
  color: string
}

// ---------------------------------------------------------------------------
// COLUMNS
// ---------------------------------------------------------------------------

/**
 * Column definitions for Income Categories.
 */
export const getIncomeCategoryColumns = (currency: string = 'UGX') => [
  {
    header: 'Category Details',
    accessor: 'category_name',
    maxWidth: 220,
    render: (row: IncomeCategory) => {
      const CategoryCell = () => {
        return (
          <Group
            gap="sm"
            wrap="nowrap"
            style={{ minWidth: 0 }}
          >
            <Box style={{ minWidth: 0, flex: 1 }}>
              <Group
                gap="xs"
                wrap="nowrap"
                align="center"
              >
                <Tooltip
                  label={
                    row.category_code
                      ? `${row.category_name} · ${row.category_code}`
                      : row.category_name
                  }
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
                    {row.category_name}
                  </Text>
                </Tooltip>

                {row.is_system && (
                  <Tooltip
                    label="System category – read only"
                    withinPortal
                  >
                    <IconLock
                      size={13}
                      color="#e67700"
                      style={{ flexShrink: 0 }}
                    />
                  </Tooltip>
                )}
              </Group>
            </Box>
          </Group>
        )
      }
      return <CategoryCell />
    },
  },

  {
    header: 'Source',
    accessor: 'category_source',
    maxWidth: 140,
    render: (row: IncomeCategory) => (
      <Badge
        color={row.is_system ? 'orange' : 'teal'}
        variant="light"
        size="sm"
        style={{ flexShrink: 0 }}
        leftSection={row.is_system ? <IconShield size={12} /> : undefined}
      >
        {row.is_system ? 'System' : 'Custom'}
      </Badge>
    ),
  },

  {
    header: 'Account',
    accessor: 'account_name',
    render: (row: IncomeCategory) => {
      const AccountCell = () => {
        return (
          <Box style={{ minWidth: 0 }}>
            <Tooltip
              label={
                row.account_code
                  ? `${row.account_name || 'N/A'} · ${row.account_code}`
                  : row.account_name || 'N/A'
              }
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
                {row.account_name || 'N/A'}
              </Text>
            </Tooltip>
          </Box>
        )
      }
      return <AccountCell />
    },
  },
  {
    header: 'Total Income',
    accessor: 'total_income',
    render: (row: IncomeCategory) => {
      const IncomeCell = () => {
        return (
          <Tooltip
            label={`Monthly: ${formatCurrency(row.monthly_income || 0, currency)}`}
            withinPortal
          >
            <Text
              size="sm"
              fw={600}
              c="green"
              style={{ whiteSpace: 'nowrap' }}
            >
              {formatCurrency(row.total_income || 0, currency)}
            </Text>
          </Tooltip>
        )
      }
      return <IncomeCell />
    },
  },
  {
    header: 'Target',
    accessor: 'annual_target',
    render: (row: IncomeCategory) => {
      const TargetCell = () => {
        return (
          <Tooltip
            label={`Monthly: ${formatCurrency(row.monthly_target || 0, currency)}`}
            withinPortal
          >
            <Text
              size="sm"
              fw={500}
              c={textColor}
              style={{ whiteSpace: 'nowrap' }}
            >
              {formatCurrency(row.annual_target || 0, currency)}
            </Text>
          </Tooltip>
        )
      }
      return <TargetCell />
    },
  },
  {
    header: 'Achievement',
    accessor: 'target_achievement',
    render: (row: IncomeCategory) => {
      const achievement = row.target_achievement || 0
      const color = getAchievementColor(achievement)
      const label = getAchievementLabel(achievement)

      const AchievementCell = () => {
        return (
          <Tooltip
            label={`${formatPercentage(achievement)} achievement · ${label}`}
            withinPortal
          >
            <Group
              gap="xs"
              wrap="nowrap"
            >
              <Text
                size="sm"
                fw={500}
                c={color}
                style={{ whiteSpace: 'nowrap' }}
              >
                {formatPercentage(achievement)}
              </Text>
              <Badge
                size="sm"
                color={color}
                variant="light"
              >
                {label}
              </Badge>
            </Group>
          </Tooltip>
        )
      }
      return <AchievementCell />
    },
  },
  {
    header: 'Parent Category',
    accessor: 'parent_category_name',
    render: (row: IncomeCategory) => {
      const ParentCell = () => {
        return (
          <Text
            size="sm"
            c={row.parent_category_name ? textColor : dimmedColor}
          >
            {row.parent_category_name || 'None'}
          </Text>
        )
      }
      return <ParentCell />
    },
  },
  {
    header: 'Status',
    accessor: 'is_active',
    render: (row: IncomeCategory) => (
      <Badge
        color={row.is_active ? 'green' : 'red'}
        variant="dot"
        size="sm"
        style={{ flexShrink: 0 }}
      >
        {row.is_active ? 'Active' : 'Inactive'}
      </Badge>
    ),
  },
]

// ---------------------------------------------------------------------------
// HEADER ACTIONS
// ---------------------------------------------------------------------------

interface HeaderActionHandlers {
  onExportPDF: () => void
  onExportExcel: () => void
  onRefresh: () => void
}

export const getIncomeCategoryHeaderActions = (
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

// ---------------------------------------------------------------------------
// ROW ACTIONS
// ---------------------------------------------------------------------------

interface RowActionHandlers {
  onView?: (row: IncomeCategory) => void
  onEdit: (row: IncomeCategory) => void
  onDelete: (row: IncomeCategory) => void
  onToggleStatus: (row: IncomeCategory) => void
}

export const getIncomeCategoryRowActions = (
  handlers: RowActionHandlers,
): RowAction[] => {
  const actions: RowAction[] = []

  if (handlers.onView) {
    actions.push({
      label: 'View Details',
      icon: <IconEye size={16} />,
      onClick: (row) => handlers.onView!(row),
      tooltip: 'View Category Details',
    })
  }

  actions.push(
    {
      label: 'Toggle Status',
      icon: <IconToggleRight size={16} />,
      onClick: (row) => handlers.onToggleStatus(row),
      tooltip: 'Toggle Active / Inactive',
      color: 'blue',
    },
    {
      label: 'Edit Category',
      icon: <IconEdit size={16} />,
      onClick: (row) => handlers.onEdit(row),
      tooltip: 'Edit Category',
      color: 'yellow',
    },
    {
      label: 'Delete Category',
      icon: <IconTrash size={16} />,
      onClick: (row) => handlers.onDelete(row),
      tooltip: 'Delete Category',
      color: 'red',
    },
  )

  return actions
}

export const getRowActionsForRow = (
  baseActions: RowAction[],
  row: IncomeCategory,
): RowAction[] =>
  baseActions.map((action) => {
    if (action.label === 'View Details') return action

    if (row.is_system) {
      return {
        ...action,
        disabled: true,
        disabledTooltip: 'System category – read only',
        icon: (
          <Group
            gap={2}
            wrap="nowrap"
            align="center"
          >
            {action.icon}
            <IconLock
              size={10}
              color="#e67700"
            />
          </Group>
        ),
      }
    }

    return action
  })

// ---------------------------------------------------------------------------
// FILTERS
// ---------------------------------------------------------------------------

interface FilterHandlers {
  onStatusChange: (value: string) => void
  onCategoryTypeChange: (value: string) => void
  onDateFromChange: (value: string) => void
  onDateToChange: (value: string) => void
  currentStatusFilter?: string
  currentCategoryTypeFilter?: string
  currentDateFromFilter?: string
  currentDateToFilter?: string
}

export const getIncomeCategoryFilters = (handlers: FilterHandlers) => [
  {
    label: 'Status',
    type: 'select',
    options: [
      { label: 'All Categories', value: 'all' },
      { label: 'Active Only', value: 'active' },
      { label: 'Inactive Only', value: 'inactive' },
    ],
    onChange: handlers.onStatusChange,
    value: handlers.currentStatusFilter || 'all',
    placeholder: 'Filter by status',
  },
  {
    label: 'Category Type',
    type: 'select',
    options: [
      { label: 'All Types', value: 'all' },
      { label: 'System Only', value: 'system' },
      { label: 'Custom Only', value: 'custom' },
    ],
    onChange: handlers.onCategoryTypeChange,
    value: handlers.currentCategoryTypeFilter || 'all',
    placeholder: 'Filter by type',
  },
  {
    label: 'Date From',
    type: 'date',
    onChange: handlers.onDateFromChange,
    value: handlers.currentDateFromFilter || '',
    placeholder: 'Start date',
    clearable: true,
  },
  {
    label: 'Date To',
    type: 'date',
    onChange: handlers.onDateToChange,
    value: handlers.currentDateToFilter || '',
    placeholder: 'End date',
    clearable: true,
  },
]

// ---------------------------------------------------------------------------
// STAT CARDS
// ---------------------------------------------------------------------------

export const getStatisticsCardsData = (
  stats: IncomeCategoryStats,
  currency: string = 'UGX',
): StatCard[] => [
  {
    icon: <IconCategory size={24} />,
    number: stats.total.toString(),
    label: 'Total Categories',
    color: 'blue',
  },
  {
    icon: <IconCoin size={24} />,
    number: formatCurrency(stats.totalIncome, currency),
    label: 'Total Income',
    color: 'green',
  },
  {
    icon: <IconTarget size={24} />,
    number: formatCurrency(stats.totalAnnualTarget, currency),
    label: 'Annual Target',
    color: 'violet',
  },
  {
    icon: <IconTrendingUp size={24} />,
    number: `${stats.averageAchievement.toFixed(1)}%`,
    label: 'Avg Achievement',
    color: getAchievementColor(stats.averageAchievement),
  },
]

// ---------------------------------------------------------------------------
// MISC HELPERS
// ---------------------------------------------------------------------------

export const getStatusBadgeColor = (status: boolean): string =>
  status ? 'green' : 'red'

export const getStatusBadgeLabel = (status: boolean): string =>
  status ? 'Active' : 'Inactive'

export const formatDate = (dateString: string): string => {
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return 'Invalid Date'
  }
}

export const formatDateTime = (dateString: string): string => {
  try {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return 'Invalid Date'
  }
}

