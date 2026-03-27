// src/pages/Areas/config/AreasManagement.config.tsx - Enhanced with Mantine Theme
import {
  Text,
  Badge,
  Group,
  Avatar,
  Tooltip,
  Box,
  MantineTheme,
} from '@mantine/core'
import {
  IconEye,
  IconEdit,
  IconTrash,
  IconFileText,
  IconFileSpreadsheet,
  IconRefresh,
  IconMap,
  IconCircleDashedCheck,
  IconUserShield,
  IconBuildingStore,
  IconPhone,
  IconUsers,
} from '@tabler/icons-react'
import { Area } from '@shared/types/area'
import { ReactNode } from 'react'

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
  onClick?: (row: Area, index: number) => void
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

export const getAreaColumns = (theme: MantineTheme): any[] => [
  {
    header: 'Area Information',
    accessor: 'area_name',
    maxWidth: 310,
    render: (row: Area) => (
      <Group
        gap="sm"
        wrap="nowrap"
        style={{ minWidth: 0 }}
      >
        <Avatar
          color={theme.primaryColor}
          radius="xl"
          size="md"
          variant="light"
          style={{ flexShrink: 0 }}
        >
          <IconMap size={18} />
        </Avatar>
        <Box style={{ minWidth: 0, flex: 1 }}>
          <Tooltip
            label={row.area_name}
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
              {row.area_name}
            </Text>
          </Tooltip>
          <Group
            gap={4}
            wrap="nowrap"
          >
            <Text
              c="dimmed"
              size="xs"
            >
              {row.area_code}
            </Text>
            {row.region && (
              <>
                <Text
                  c="dimmed"
                  size="xs"
                >
                  •
                </Text>
                <Text
                  c="dimmed"
                  size="xs"
                  style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}
                >
                  {row.region}
                </Text>
              </>
            )}
          </Group>
        </Box>
      </Group>
    ),
  },
  {
    header: 'Description',
    accessor: 'description',
    render: (row: Area) => (
      <Tooltip
        label={row.description || 'No description'}
        withinPortal
      >
        <Text
          size="sm"
          c={row.description ? 'dimmed' : 'red'}
          fs={!row.description ? 'italic' : undefined}
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: '200px',
          }}
        >
          {row.description || 'No description'}
        </Text>
      </Tooltip>
    ),
  },
  {
    header: 'Area Admin',
    accessor: 'assigned_admin',
    render: (row: Area) => {
      if (!row.assigned_admin || row.assigned_admin === 'None') {
        return (
          <Text
            c="dimmed"
            size="sm"
            fs="italic"
          >
            No Admin Assigned
          </Text>
        )
      }

      const adminCount = row.assigned_admin_ids?.length || 0

      return (
        <Box style={{ minWidth: 0 }}>
          <Tooltip
            label={row.assigned_admin}
            withinPortal
          >
            <Text
              size="sm"
              fw={500}
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: '150px',
              }}
            >
              {row.assigned_admin}
              {adminCount > 1 && ` (+${adminCount - 1} more)`}
            </Text>
          </Tooltip>
          {row.admin_phone && row.admin_phone !== 'N/A' && (
            <Group
              gap={4}
              wrap="nowrap"
            >
              <IconPhone
                size={12}
                style={{ color: theme.colors.gray[6], flexShrink: 0 }}
              />
              <Text
                c="dimmed"
                size="xs"
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {row.admin_phone}
              </Text>
            </Group>
          )}
        </Box>
      )
    },
  },
  {
    header: 'Stores',
    accessor: 'store_count',
    maxWidth: 130,
    render: (row: Area) => (
      <Badge
        variant="light"
        color="indigo"
        leftSection={<IconBuildingStore size={14} />}
        size="lg"
        radius="md"
        style={{ flexShrink: 0, cursor: 'pointer' }}
        title="Click to view stores"
      >
        {row.store_count || 0} Store{(row.store_count || 0) !== 1 ? 's' : ''}
      </Badge>
    ),
  },
  {
    header: 'Status',
    accessor: 'is_active',
    maxWith: 110,
    render: (row: Area) => (
      <Badge
        color={row.is_active ? 'green' : 'red'}
        variant="dot"
        size="lg"
        radius="md"
        style={{ flexShrink: 0 }}
      >
        {row.is_active ? 'Active' : 'Inactive'}
      </Badge>
    ),
  },
]

interface HeaderActionHandlers {
  onExportPDF?: () => void
  onExportExcel?: () => void
  onRefresh: () => void
}

export const getAreaHeaderActions = (
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

export const getAreaPrimaryAction = (onAddArea: () => void): PrimaryAction => ({
  icon: <IconMap size={18} />,
  label: 'Add Area',
  onClick: onAddArea,
})

interface RowActionHandlers {
  onView?: (row: Area) => void
  onViewStaff: (row: Area) => void
  onViewStores?: (row: Area) => void
  onEdit?: (row: Area) => void
  onDelete?: (row: Area) => void
}

export const getAreaRowActions = (handlers: RowActionHandlers): RowAction[] => {
  const actions: RowAction[] = []

  if (handlers.onView) {
    actions.push({
      label: 'View Details',
      icon: <IconEye size={16} />,
      onClick: handlers.onView,
      tooltip: 'View full area details',
    })
  }

  actions.push({
    label: 'View Staff',
    icon: <IconUsers size={16} />,
    onClick: handlers.onViewStaff,
    tooltip: 'View assigned staff members',
  })

  if (handlers.onViewStores) {
    actions.push({
      label: 'View Stores',
      icon: <IconBuildingStore size={16} />,
      onClick: handlers.onViewStores,
      tooltip: 'View stores in this area',
    })
  }

  if (handlers.onEdit) {
    actions.push({
      label: 'Edit Area',
      icon: <IconEdit size={16} />,
      onClick: handlers.onEdit,
      tooltip: 'Edit area details',
    })
  }

  if (handlers.onDelete) {
    actions.push({
      label: 'Delete Area',
      icon: <IconTrash size={16} />,
      color: 'red',
      onClick: handlers.onDelete,
      tooltip: 'Delete area (soft delete)',
    })
  }

  return actions
}

interface FilterHandlers {
  onStatusChange: (value: string) => void
  onRegionChange?: (value: string) => void
  onParentAreaChange?: (value: string) => void
  onAdminAssignmentChange?: (value: string) => void
  onStoreCountChange?: (value: string) => void
  currentStatusFilter?: string
  currentRegionFilter?: string
  currentParentAreaFilter?: string
  currentAdminAssignmentFilter?: string
  currentStoreCountFilter?: string
  regions?: string[]
  parentAreas?: Area[]
}

export const getAreaFilters = (handlers: FilterHandlers): Filter[] => {
  const filters: Filter[] = [
    {
      label: 'Status',
      options: [
        { label: 'All Status', value: 'all' },
        { label: 'Active', value: 'active' },
        { label: 'Inactive', value: 'inactive' },
      ],
      onChange: handlers.onStatusChange,
      currentValue: handlers.currentStatusFilter || 'all',
    },
  ]

  // Region filter
  if (handlers.onRegionChange) {
    const regionOptions =
      Array.isArray(handlers.regions) && handlers.regions.length > 0
        ? handlers.regions.map((region) => ({
            label: region,
            value: region,
          }))
        : []

    filters.push({
      label: 'Region',
      options: [{ label: 'All Regions', value: 'all' }, ...regionOptions],
      onChange: handlers.onRegionChange,
      currentValue: handlers.currentRegionFilter || 'all',
    })
  }

  // Admin Assignment filter
  if (handlers.onAdminAssignmentChange) {
    filters.push({
      label: 'Admin Assignment',
      options: [
        { label: 'All Areas', value: 'all' },
        { label: 'With Admin', value: 'with_admin' },
        { label: 'Without Admin', value: 'without_admin' },
      ],
      onChange: handlers.onAdminAssignmentChange,
      currentValue: handlers.currentAdminAssignmentFilter || 'all',
    })
  }

  // Store Count filter
  if (handlers.onStoreCountChange) {
    filters.push({
      label: 'Store Count',
      options: [
        { label: 'All Areas', value: 'all' },
        { label: 'No Stores', value: 'zero' },
        { label: '1-5 Stores', value: '1-5' },
        { label: '6-10 Stores', value: '6-10' },
        { label: '11+ Stores', value: '11+' },
      ],
      onChange: handlers.onStoreCountChange,
      currentValue: handlers.currentStoreCountFilter || 'all',
    })
  }

  return filters
}

export const getStatisticsCardsData = (
  stats: {
    total: number
    active: number
    inactive?: number
    totalAdmins: number
    totalStores: number
  },
  theme: MantineTheme,
): StatCard[] => [
  {
    icon: <IconMap />,
    number: stats.total.toString(),
    label: 'Total Areas',
    color: theme.primaryColor,
  },
  {
    icon: <IconCircleDashedCheck />,
    number: stats.active.toString(),
    label: 'Active Areas',
    color: 'green',
  },
  {
    icon: <IconUserShield />,
    number: stats.totalAdmins.toString(),
    label: 'Area Admins',
    color: 'violet',
  },
  {
    icon: <IconBuildingStore />,
    number: stats.totalStores.toString(),
    label: 'Total Stores',
    color: 'indigo',
  },
]

