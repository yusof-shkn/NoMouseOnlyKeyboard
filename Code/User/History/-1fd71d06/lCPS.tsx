// src/pages/UserManagement/config/UserManagement.config.tsx - WITH THEME INTEGRATION
import {
  Text,
  Badge,
  Group,
  Avatar,
  Tooltip,
  Box,
  ThemeIcon,
} from '@mantine/core'
import {
  IconEye,
  IconEdit,
  IconTrash,
  IconFileText,
  IconFileSpreadsheet,
  IconRefresh,
  IconUserPlus,
  IconUsers,
  IconUserCheck,
  IconUserX,
  IconUserShield,
  IconClock,
  IconMail,
  IconPhone,
  IconCalendar,
  IconBuildingStore,
  IconMapPin,
} from '@tabler/icons-react'
import { EnrichedUser } from './utils/userManagement.utils'
import { ReactNode } from 'react'
import { Area } from '@shared/types/area'
import { Store } from '@shared/types/Store'
import { AppDispatch } from '@app/core/store/store'
import { roleOptions } from '@shared/constants/roles'
import { MantineTheme } from '@mantine/core'

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
  onClick?: (row: EnrichedUser, index: number) => void
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
  currentValue?: string
}

interface StatCard {
  icon: ReactNode
  number: string
  label: string
  color: string
}

/**
 * Helper function to get user initials
 */
const getUserInitials = (fullName: string): string => {
  if (!fullName) return 'U'
  return fullName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

/**
 * ✅ UPDATED: Get role color using theme primary dark with fallback
 */
export const getRoleColor = (
  roleId: number | null,
  theme?: MantineTheme,
): string => {
  // Use primary color for all roles, with gray for custom
  if (roleId && roleId >= 9) return 'gray' // Custom roles
  return theme?.primaryColor || 'blue' // Fallback to 'blue' if theme is undefined
}

/**
 * Enhanced column definitions - Fully Responsive with Theme
 */
export const getUserColumns = (theme?: MantineTheme): any[] => [
  {
    header: 'User',
    accessor: 'full_name',
    render: (row: EnrichedUser) => (
      <Group
        gap="sm"
        wrap="nowrap"
        style={{ minWidth: 0 }}
      >
        <Avatar
          color={getRoleColor(row.profile.role_id, theme)}
          radius="xl"
          size="sm"
          style={{ flexShrink: 0 }}
        >
          {getUserInitials(row.full_name)}
        </Avatar>
        <Box style={{ minWidth: 0, flex: 1 }}>
          <Tooltip
            label={row.email ? `${row.full_name || 'N/A'} · ${row.email}` : (row.full_name || 'N/A')}
            withinPortal
          >
            <Text
              fw={600}
              size="sm"
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {row.full_name || 'N/A'}
            </Text>
          </Tooltip>
        </Box>
      </Group>
    ),
  },
  {
    header: 'Contact',
    accessor: 'profile.phone',
    render: (row: EnrichedUser) => (
      <Group
        gap={4}
        wrap="nowrap"
        style={{ minWidth: 0 }}
      >
        <ThemeIcon
          color="gray"
          variant="light"
          size="sm"
        >
          <IconPhone size={14} />
        </ThemeIcon>
        <Text
          size="sm"
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {row.profile.phone || 'N/A'}
        </Text>
      </Group>
    ),
  },
  {
    header: 'Role',
    accessor: 'role_name',
    render: (row: EnrichedUser) => (
      <Badge
        color={getRoleColor(row.profile.role_id, theme)}
        variant="light"
        size="sm"
        radius="md"
        leftSection={<IconUserShield size={12} />}
      >
        {row.role_name || 'N/A'}
      </Badge>
    ),
  },
  {
    header: 'Assignment',
    accessor: 'assignment',
    render: (row: EnrichedUser) => {
      const hasStore = row.assignment?.store
      const hasArea = row.assignment?.area

      if (!hasStore && !hasArea) {
        return (
          <Text
            c="dimmed"
            size="sm"
          >
            Not Assigned
          </Text>
        )
      }

      return (
        (() => {
          const primary = hasStore || hasArea
          const icon = hasStore
            ? <IconBuildingStore size={14} style={{ flexShrink: 0 }} />
            : <IconMapPin size={14} style={{ flexShrink: 0 }} />
          const label = hasStore ? hasStore.store_name : hasArea!.area_name
          const tooltipLabel = hasStore && hasArea
            ? `Store: ${hasStore.store_name} · Area: ${hasArea.area_name}`
            : hasStore ? `Store: ${hasStore.store_name}` : `Area: ${hasArea!.area_name}`

          return (
            <Tooltip label={tooltipLabel} withinPortal>
              <Group gap={4} wrap="nowrap" style={{ minWidth: 0 }}>
                <ThemeIcon color={theme?.primaryColor || 'blue'} variant="light" size="sm">
                  {icon}
                </ThemeIcon>
                <Text
                  size="sm"
                  fw={500}
                  style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                  {label}
                </Text>
              </Group>
            </Tooltip>
          )
        })()\
      )
    },
  },
  {
    header: 'Status',
    accessor: 'user_status',
    render: (row: EnrichedUser) => {
      const statusConfig = {
        waiting: { color: 'yellow', label: 'Waiting', icon: IconClock },
        active: { color: 'green', label: 'Active', icon: IconUserCheck },
        inactive: { color: 'red', label: 'Inactive', icon: IconUserX },
      }
      const config =
        statusConfig[row.user_status as keyof typeof statusConfig] ||
        statusConfig.inactive
      const StatusIcon = config.icon
      return (
        <Box style={{ minWidth: 'max-content' }}>
          <Badge
            color={config.color}
            variant="dot"
            size="lg"
            radius="md"
            style={{ whiteSpace: 'nowrap' }}
          >
            {config.label}
          </Badge>
        </Box>
      )
    },
  },
  {
    header: 'Created',
    accessor: 'profile.created_at',
    render: (row: EnrichedUser) => {
      if (!row.profile.created_at) {
        return (
          <Text
            c="dimmed"
            size="sm"
          >
            N/A
          </Text>
        )
      }
      const date = new Date(row.profile.created_at)
      const formattedDate = date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
      return (
        <Group
          gap={4}
          wrap="nowrap"
        >
          <ThemeIcon
            color="gray"
            variant="light"
            size="xs"
          >
            <IconCalendar size={10} />
          </ThemeIcon>
          <Text
            size="xs"
            c="dimmed"
            style={{ whiteSpace: 'nowrap' }}
          >
            {formattedDate}
          </Text>
        </Group>
      )
    },
  },
]

interface HeaderActionHandlers {
  onExportPDF: () => void
  onExportExcel: () => void
  onRefresh: () => void
}

export const getUserHeaderActions = (
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

export const getUserPrimaryAction = (onAddUser: () => void): PrimaryAction => ({
  icon: <IconUserPlus size={18} />,
  label: 'Add User',
  onClick: onAddUser,
})

interface RowActionHandlers {
  onView: (row: EnrichedUser) => void
  onEdit: (row: EnrichedUser) => void
  onDelete: (row: EnrichedUser) => void
}

export const getUserRowActions = (handlers: RowActionHandlers): RowAction[] => [
  {
    label: 'View Details',
    icon: <IconEye size={16} />,
    onClick: handlers?.onView,
    tooltip: 'View User Details',
  },
  {
    label: 'Edit User',
    icon: <IconEdit size={16} />,
    onClick: handlers?.onEdit,
    tooltip: 'Edit User',
  },
  {
    label: 'Delete User',
    icon: <IconTrash size={16} />,
    onClick: handlers.onDelete,
    color: 'red',
    tooltip: 'Delete User',
  },
]

interface FilterHandlers {
  onStatusChange: (value: string) => void
  onRoleChange: (value: string) => void
  onAreaChange?: (value: string) => void
  onStoreChange?: (value: string) => void
  areas?: Area[]
  stores?: Store[]
  currentAreaFilter?: string | null
  currentStoreFilter?: string | null
  currentStatusFilter?: string
  currentRoleFilter?: string
}

export const getUserFilters = (handlers: FilterHandlers): Filter[] => {
  const filters: Filter[] = [
    {
      label: 'Status',
      options: [
        { label: 'All Status', value: 'all' },
        { label: 'Waiting Confirmation', value: 'waiting' },
        { label: 'Active', value: 'active' },
        { label: 'Inactive', value: 'inactive' },
      ],
      onChange: handlers.onStatusChange,
      currentValue: handlers.currentStatusFilter || 'all',
    },
    {
      label: 'Role',
      options: [
        { label: 'All Roles', value: 'all' },
        ...roleOptions,
        { label: 'Custom Roles', value: '9+' },
      ],
      onChange: handlers.onRoleChange,
      currentValue: handlers.currentRoleFilter || 'all',
    },
  ]

  if (handlers.onAreaChange) {
    const areaOptions =
      Array.isArray(handlers.areas) && handlers.areas.length > 0
        ? handlers.areas.map((area) => ({
            label: area.area_name,
            value: String(area.id),
          }))
        : []

    filters.push({
      label: 'Area',
      options: [{ label: 'All Areas', value: 'all' }, ...areaOptions],
      onChange: handlers.onAreaChange,
      currentValue: handlers.currentAreaFilter || 'all',
    })
  }

  if (handlers.onStoreChange) {
    const storeOptions =
      Array.isArray(handlers.stores) && handlers.stores.length > 0
        ? handlers.stores.map((store) => ({
            label: store.store_name,
            value: String(store.id),
          }))
        : []

    filters.push({
      label: 'Store',
      options: [{ label: 'All Stores', value: 'all' }, ...storeOptions],
      onChange: handlers.onStoreChange,
      currentValue: handlers.currentStoreFilter || 'all',
    })
  }

  return filters
}

export const getStatisticsCardsData = (
  stats: {
    total: number
    active: number
    waiting: number
    admins: number
  },
  theme?: MantineTheme,
): StatCard[] => [
  {
    icon: <IconUsers />,
    number: stats.total.toString(),
    label: 'Total Users',
    color: theme?.primaryColor || 'blue',
  },
  {
    icon: <IconUserCheck />,
    number: stats.active.toString(),
    label: 'Active Users',
    color: 'green',
  },
  {
    icon: <IconClock />,
    number: stats.waiting.toString(),
    label: 'Waiting Confirmation',
    color: 'yellow',
  },
  {
    icon: <IconUserShield />,
    number: stats.admins.toString(),
    label: 'Admin Users',
    color: theme?.primaryColor || 'blue',
  },
]

