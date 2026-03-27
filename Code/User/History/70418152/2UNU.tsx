// src/features/main/UnitsManagement/UnitsManagement.config.tsx - WITH THEME INTEGRATION
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
  IconRuler,
  IconLayersLinked,
  IconBoxMultiple,
  IconDatabase,
  IconWorld,
  IconBuilding,
} from '@tabler/icons-react'
import { UnitWithRelations, UNIT_TYPES } from '@shared/types/units'
import { ReactNode } from 'react'
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
  onClick?: (row: UnitWithRelations, index: number) => void
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
 * Helper to get unit type icon
 */
const getUnitTypeIcon = (type: string, size = 16) => {
  const iconMap: Record<string, ReactNode> = {
    base: <IconDatabase size={size} />,
    derived: <IconLayersLinked size={size} />,
    compound: <IconBoxMultiple size={size} />,
  }
  return iconMap[type] || <IconRuler size={size} />
}

/**
 * Column definitions for units with theme integration
 */
export const getUnitColumns = (theme?: MantineTheme): any[] => [
  {
    header: 'Unit Name',
    accessor: 'name',
    maxWidth: 300,
    render: (row: UnitWithRelations) => (
      <Group
        gap="sm"
        wrap="nowrap"
        style={{ minWidth: 0 }}
      >
        <Avatar
          color={theme?.primaryColor || 'cyan'}
          radius="xl"
          size="sm"
          style={{ flexShrink: 0 }}
        >
          <IconRuler size={16} />
        </Avatar>
        <Box style={{ minWidth: 0, flex: 1 }}>
          <Tooltip
            label={row.name}
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
              {row.name}
            </Text>
          </Tooltip>
          <Group
            gap={4}
            wrap="nowrap"
          >
            <ThemeIcon
              color="gray"
              variant="light"
              size="xs"
            >
              <IconRuler size={10} />
            </ThemeIcon>
            <Text
              c="dimmed"
              size="xs"
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {row.short_code || 'No code'}
            </Text>
          </Group>
        </Box>
      </Group>
    ),
  },
  {
    header: 'Code',
    accessor: 'short_code',
    maxWidth: 120,
    render: (row: UnitWithRelations) => (
      <Tooltip
        label={row.short_code || 'No code'}
        withinPortal
      >
        <Badge
          variant="light"
          color={row.short_code ? theme?.primaryColor || 'blue' : 'gray'}
          size="sm"
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: '120px',
          }}
        >
          {row.short_code || 'N/A'}
        </Badge>
      </Tooltip>
    ),
  },
  {
    header: 'Scope',
    accessor: 'is_global',
    maxWidth: 130,
    render: (row: UnitWithRelations) => {
      const isSystem = (row as any).is_global === true
      return (
        <Tooltip
          label={
            isSystem
              ? 'System unit — shared across all companies'
              : 'Company unit — specific to your company'
          }
          withinPortal
        >
          <Badge
            variant="light"
            color={isSystem ? 'violet' : 'teal'}
            size="lg"
            leftSection={
              isSystem ? <IconWorld size={12} /> : <IconBuilding size={12} />
            }
            style={{ whiteSpace: 'nowrap' }}
          >
            {isSystem ? 'System' : 'Company'}
          </Badge>
        </Tooltip>
      )
    },
  },
  {
    header: 'Type',
    accessor: 'type',
    render: (row: UnitWithRelations) => {
      const typeConfig = UNIT_TYPES[row.type as keyof typeof UNIT_TYPES]

      return (
        <Box style={{ minWidth: 'max-content' }}>
          <Tooltip
            label={typeConfig?.description || ''}
            withinPortal
          >
            <Badge
              variant="light"
              color={typeConfig?.color || 'gray'}
              size="lg"
              leftSection={getUnitTypeIcon(row.type, 12)}
              style={{ whiteSpace: 'nowrap' }}
            >
              {typeConfig?.label || row.type}
            </Badge>
          </Tooltip>
        </Box>
      )
    },
  },
  {
    header: 'Base Unit',
    accessor: 'base_unit',
    maxWidth: 200,
    render: (row: UnitWithRelations) => {
      if (!row.base_unit_id || !row.base_unit) {
        return (
          <Text
            size="xs"
            c="dimmed"
          >
            —
          </Text>
        )
      }

      return (
        <Box style={{ minWidth: 0 }}>
          <Group
            gap="xs"
            wrap="nowrap"
          >
            <ThemeIcon
              color={theme?.primaryColor || 'cyan'}
              variant="light"
              size="sm"
            >
              <IconLayersLinked size={12} />
            </ThemeIcon>
            <Tooltip
              label={`Base: ${row.base_unit.name}`}
              withinPortal
            >
              <Text
                size="sm"
                fw={500}
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {row.base_unit.name}
              </Text>
            </Tooltip>
          </Group>
          {row.conversion_factor && row.conversion_factor !== 1 && (
            <Tooltip
              label={`1 ${row.short_code} = ${row.conversion_factor} ${row.base_unit.short_code}`}
              withinPortal
            >
              <Badge
                size="xs"
                variant="outline"
                color="gray"
                mt={4}
              >
                ×{row.conversion_factor}
              </Badge>
            </Tooltip>
          )}
        </Box>
      )
    },
  },
  {
    header: 'Status',
    accessor: 'is_active',
    maxWidth: 120,
    render: (row: UnitWithRelations) => (
      <Box style={{ minWidth: 'max-content' }}>
        <Badge
          variant="dot"
          color={row.is_active ? 'green' : 'red'}
          size="lg"
          style={{ whiteSpace: 'nowrap' }}
        >
          {row.is_active ? 'Active' : 'Inactive'}
        </Badge>
      </Box>
    ),
  },
]

interface HeaderActionHandlers {
  onExportPDF?: () => void
  onExportExcel?: () => void
  onRefresh: () => void
}

/**
 * Header actions configuration
 */
export const getUnitHeaderActions = (
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
export const getUnitPrimaryAction = (onAddUnit: () => void): PrimaryAction => ({
  icon: <IconRuler size={18} />,
  label: 'Add Unit',
  onClick: onAddUnit,
})

interface RowActionHandlers {
  onView?: (row: UnitWithRelations) => void
  onEdit?: (row: UnitWithRelations) => void
  onDelete?: (row: UnitWithRelations) => void
}

/**
 * Row actions with tooltips — system units cannot be edited/deleted
 */
export const getUnitRowActions = (handlers: RowActionHandlers): RowAction[] => {
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
      label: 'Edit Unit',
      icon: <IconEdit size={16} />,
      onClick: (row: UnitWithRelations) => {
        if ((row as any).is_global) return // guard: system units are read-only
        handlers.onEdit!(row)
      },
      tooltip: 'Edit Unit',
    })
  }

  if (handlers.onDelete) {
    actions.push({
      label: 'Delete Unit',
      icon: <IconTrash size={16} />,
      onClick: (row: UnitWithRelations) => {
        if ((row as any).is_global) return // guard: system units cannot be deleted
        handlers.onDelete!(row)
      },
      color: 'red',
      tooltip: 'Delete Unit',
    })
  }

  return actions
}

/**
 * Enhanced filter configuration with current values
 */
interface FilterHandlers {
  onStatusChange: (value: string) => void
  onTypeChange: (value: string) => void
  onScopeChange: (value: string) => void
  currentStatusFilter?: string
  currentTypeFilter?: string
  currentScopeFilter?: string
}

export const getUnitFilters = (handlers: FilterHandlers): Filter[] => [
  {
    label: 'Scope',
    options: [
      { label: 'All Units', value: 'all' },
      { label: 'System Units', value: 'system' },
      { label: 'Company Units', value: 'company' },
    ],
    onChange: handlers.onScopeChange,
    currentValue: handlers.currentScopeFilter || 'all',
  },
  {
    label: 'Status',
    options: [
      { label: 'All Units', value: 'all' },
      { label: 'Active Only', value: 'active' },
      { label: 'Inactive Only', value: 'inactive' },
    ],
    onChange: handlers.onStatusChange,
    currentValue: handlers.currentStatusFilter || 'all',
  },
  {
    label: 'Type',
    options: [
      { label: 'All Types', value: 'all' },
      { label: 'Base Units', value: 'base' },
      { label: 'Derived Units', value: 'derived' },
      { label: 'Compound Units', value: 'compound' },
    ],
    onChange: handlers.onTypeChange,
    currentValue: handlers.currentTypeFilter || 'all',
  },
]

/**
 * Enhanced statistics cards with theme integration
 */
export const getStatisticsCardsData = (
  stats: {
    total: number
    active: number
    base: number
    derived: number
    compound: number
    system: number
    company: number
  },
  theme?: MantineTheme,
): StatCard[] => [
  {
    icon: <IconRuler />,
    number: stats.total.toString(),
    label: 'Total Units',
    color: theme?.primaryColor || 'cyan',
  },
  {
    icon: <IconWorld />,
    number: stats.system.toString(),
    label: 'System Units',
    color: 'violet',
  },
  {
    icon: <IconBuilding />,
    number: stats.company.toString(),
    label: 'Company Units',
    color: 'teal',
  },
  {
    icon: <IconDatabase />,
    number: stats.base.toString(),
    label: 'Base Units',
    color: 'blue',
  },
]

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
  onClick?: (row: UnitWithRelations, index: number) => void
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
 * Helper to get unit type icon
 */
const getUnitTypeIcon = (type: string, size = 16) => {
  const iconMap: Record<string, ReactNode> = {
    base: <IconDatabase size={size} />,
    derived: <IconLayersLinked size={size} />,
    compound: <IconBoxMultiple size={size} />,
  }
  return iconMap[type] || <IconRuler size={size} />
}

/**
 * Column definitions for units with theme integration
 */
export const getUnitColumns = (theme?: MantineTheme): any[] => [
  {
    header: 'Unit Name',
    accessor: 'name',
    maxWidth: 300,
    render: (row: UnitWithRelations) => (
      <Group
        gap="sm"
        wrap="nowrap"
        style={{ minWidth: 0 }}
      >
        <Avatar
          color={theme?.primaryColor || 'cyan'}
          radius="xl"
          size="sm"
          style={{ flexShrink: 0 }}
        >
          <IconRuler size={16} />
        </Avatar>
        <Box style={{ minWidth: 0, flex: 1 }}>
          <Tooltip
            label={row.name}
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
              {row.name}
            </Text>
          </Tooltip>
          <Group
            gap={4}
            wrap="nowrap"
          >
            <ThemeIcon
              color="gray"
              variant="light"
              size="xs"
            >
              <IconRuler size={10} />
            </ThemeIcon>
            <Text
              c="dimmed"
              size="xs"
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {row.short_code || 'No code'}
            </Text>
          </Group>
        </Box>
      </Group>
    ),
  },
  {
    header: 'Code',
    accessor: 'short_code',
    maxWidth: 120,
    render: (row: UnitWithRelations) => (
      <Tooltip
        label={row.short_code || 'No code'}
        withinPortal
      >
        <Badge
          variant="light"
          color={row.short_code ? theme?.primaryColor || 'blue' : 'gray'}
          size="sm"
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: '120px',
          }}
        >
          {row.short_code || 'N/A'}
        </Badge>
      </Tooltip>
    ),
  },
  {
    header: 'Type',
    accessor: 'type',
    render: (row: UnitWithRelations) => {
      const typeConfig = UNIT_TYPES[row.type as keyof typeof UNIT_TYPES]

      return (
        <Box style={{ minWidth: 'max-content' }}>
          <Tooltip
            label={typeConfig?.description || ''}
            withinPortal
          >
            <Badge
              variant="light"
              color={typeConfig?.color || 'gray'}
              size="lg"
              leftSection={getUnitTypeIcon(row.type, 12)}
              style={{ whiteSpace: 'nowrap' }}
            >
              {typeConfig?.label || row.type}
            </Badge>
          </Tooltip>
        </Box>
      )
    },
  },
  {
    header: 'Base Unit',
    accessor: 'base_unit',
    maxWidth: 200,
    render: (row: UnitWithRelations) => {
      if (!row.base_unit_id || !row.base_unit) {
        return (
          <Text
            size="xs"
            c="dimmed"
          >
            —
          </Text>
        )
      }

      return (
        <Box style={{ minWidth: 0 }}>
          <Group
            gap="xs"
            wrap="nowrap"
          >
            <ThemeIcon
              color={theme?.primaryColor || 'cyan'}
              variant="light"
              size="sm"
            >
              <IconLayersLinked size={12} />
            </ThemeIcon>
            <Tooltip
              label={`Base: ${row.base_unit.name}`}
              withinPortal
            >
              <Text
                size="sm"
                fw={500}
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {row.base_unit.name}
              </Text>
            </Tooltip>
          </Group>
          {row.conversion_factor && row.conversion_factor !== 1 && (
            <Tooltip
              label={`1 ${row.short_code} = ${row.conversion_factor} ${row.base_unit.short_code}`}
              withinPortal
            >
              <Badge
                size="xs"
                variant="outline"
                color="gray"
                mt={4}
              >
                ×{row.conversion_factor}
              </Badge>
            </Tooltip>
          )}
        </Box>
      )
    },
  },
  {
    header: 'Status',
    accessor: 'is_active',
    maxWidth: 120,
    render: (row: UnitWithRelations) => (
      <Box style={{ minWidth: 'max-content' }}>
        <Badge
          variant="dot"
          color={row.is_active ? 'green' : 'red'}
          size="lg"
          style={{ whiteSpace: 'nowrap' }}
        >
          {row.is_active ? 'Active' : 'Inactive'}
        </Badge>
      </Box>
    ),
  },
]

interface HeaderActionHandlers {
  onExportPDF?: () => void
  onExportExcel?: () => void
  onRefresh: () => void
}

/**
 * Header actions configuration
 */
export const getUnitHeaderActions = (
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
export const getUnitPrimaryAction = (onAddUnit: () => void): PrimaryAction => ({
  icon: <IconRuler size={18} />,
  label: 'Add Unit',
  onClick: onAddUnit,
})

interface RowActionHandlers {
  onView?: (row: UnitWithRelations) => void
  onEdit?: (row: UnitWithRelations) => void
  onDelete?: (row: UnitWithRelations) => void
}

/**
 * Row actions with tooltips
 */
export const getUnitRowActions = (handlers: RowActionHandlers): RowAction[] => {
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
      label: 'Edit Unit',
      icon: <IconEdit size={16} />,
      onClick: handlers.onEdit,
      tooltip: 'Edit Unit',
    })
  }

  if (handlers.onDelete) {
    actions.push({
      label: 'Delete Unit',
      icon: <IconTrash size={16} />,
      onClick: handlers.onDelete,
      color: 'red',
      tooltip: 'Delete Unit',
    })
  }

  return actions
}

/**
 * Enhanced filter configuration with current values
 */
interface FilterHandlers {
  onStatusChange: (value: string) => void
  onTypeChange: (value: string) => void
  currentStatusFilter?: string
  currentTypeFilter?: string
}

export const getUnitFilters = (handlers: FilterHandlers): Filter[] => [
  {
    label: 'Status',
    options: [
      { label: 'All Units', value: 'all' },
      { label: 'Active Only', value: 'active' },
      { label: 'Inactive Only', value: 'inactive' },
    ],
    onChange: handlers.onStatusChange,
    currentValue: handlers.currentStatusFilter || 'all',
  },
  {
    label: 'Type',
    options: [
      { label: 'All Types', value: 'all' },
      { label: 'Base Units', value: 'base' },
      { label: 'Derived Units', value: 'derived' },
      { label: 'Compound Units', value: 'compound' },
    ],
    onChange: handlers.onTypeChange,
    currentValue: handlers.currentTypeFilter || 'all',
  },
]

/**
 * Enhanced statistics cards with theme integration
 */
export const getStatisticsCardsData = (
  stats: {
    total: number
    active: number
    base: number
    derived: number
    compound: number
  },
  theme?: MantineTheme,
): StatCard[] => [
  {
    icon: <IconRuler />,
    number: stats.total.toString(),
    label: 'Total Units',
    color: theme?.primaryColor || 'cyan',
  },
  {
    icon: <IconDatabase />,
    number: stats.base.toString(),
    label: 'Base Units',
    color: 'blue',
  },
  {
    icon: <IconLayersLinked />,
    number: stats.derived.toString(),
    label: 'Derived Units',
    color: 'teal',
  },
  {
    icon: <IconBoxMultiple />,
    number: stats.compound.toString(),
    label: 'Compound Units',
    color: 'orange',
  },
]

