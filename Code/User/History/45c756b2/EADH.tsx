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
  IconCategory,
  IconCircleDashedCheck,
  IconPackages,
  IconWorldCheck,
  IconBuildingStore,
} from '@tabler/icons-react'
import { ProductCategory } from '@shared/types/medicines'
import { ReactNode } from 'react'

interface ExtendedProductCategory extends ProductCategory {
  product_count?: number
}

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
  onClick?: (row: ExtendedProductCategory, index: number) => void
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

export const getCategoryColumns = (): any[] => [
  {
    header: 'Category Name',
    accessor: 'category_name',
    render: (row: ExtendedProductCategory) => {
      const theme = useMantineTheme()
      const { colorScheme } = useMantineColorScheme()
      const isDark = colorScheme === 'dark'

      return (
        <Group
          gap="sm"
          wrap="nowrap"
          style={{ minWidth: 0 }}
        >
          <Avatar
            color={row.color_code || theme.primaryColor}
            radius="xl"
            size="sm"
            style={{ flexShrink: 0 }}
          >
            <IconCategory size={16} />
          </Avatar>
          <Box style={{ minWidth: 0, flex: 1 }}>
            <Tooltip
              label={row.category_name}
              withinPortal
            >
              <Text
                fw={600}
                size="sm"
                c={isDark ? 'gray.1' : 'dark.9'}
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {row.category_name}
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
              {row.category_code || 'No code'}
            </Text>
          </Box>
        </Group>
      )
    },
  },
  {
    header: 'Type',
    accessor: 'category_type',
    maxWidth: 120,
    render: (row: ExtendedProductCategory) => (
      <Badge
        variant="light"
        color={row.company_id === 1 ? 'blue' : 'grape'}
        leftSection={
          row.company_id === 1 ? (
            <IconWorldCheck size={14} />
          ) : (
            <IconBuildingStore size={14} />
          )
        }
        size="lg"
      >
        {row.company_id === 1 ? 'System' : 'Company'}
      </Badge>
    ),
  },
  {
    header: 'Description',
    accessor: 'description',
    render: (row: ExtendedProductCategory) => {
      const { colorScheme } = useMantineColorScheme()
      const isDark = colorScheme === 'dark'
      return (
        <Tooltip
          label={row.description || 'No description'}
          withinPortal
        >
          <Text
            size="sm"
            c={row.description ? (isDark ? 'gray.2' : 'dark.7') : 'dimmed'}
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
      )
    },
  },
  {
    header: 'Product Count',
    accessor: 'product_count',
    maxWidth: 130,
    render: (row: ExtendedProductCategory) => (
      <Badge
        variant="filled"
        color={(row.product_count ?? 0) > 0 ? 'teal' : 'gray'}
        leftSection={<IconPackages size={14} />}
        size="lg"
      >
        {row.product_count ?? 0}
      </Badge>
    ),
  },
  {
    header: 'Status',
    accessor: 'is_active',
    maxWidth: 120,
    render: (row: ExtendedProductCategory) => (
      <Badge
        variant="dot"
        color={row.is_active ? 'green' : 'red'}
        size="lg"
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

export const getCategoryHeaderActions = (
  handlers: HeaderActionHandlers,
): HeaderAction[] => {
  const actions: HeaderAction[] = []
  if (handlers.onExportPDF)
    actions.push({
      title: 'Export PDF',
      icon: <IconFileText size={20} />,
      color: 'red',
      onClick: handlers.onExportPDF,
    })
  if (handlers.onExportExcel)
    actions.push({
      title: 'Export Excel',
      icon: <IconFileSpreadsheet size={20} />,
      color: 'green',
      onClick: handlers.onExportExcel,
    })
  actions.push({
    title: 'Refresh',
    icon: <IconRefresh size={20} />,
    color: 'gray',
    onClick: handlers.onRefresh,
  })
  return actions
}

export const getCategoryPrimaryAction = (
  onAddCategory: () => void,
): PrimaryAction => ({
  icon: <IconCategory size={18} />,
  label: 'Add Category',
  onClick: onAddCategory,
})

interface RowActionHandlers {
  onView?: (row: ExtendedProductCategory) => void
  onEdit?: (row: ExtendedProductCategory) => void
  onDelete?: (row: ExtendedProductCategory) => void
}

export const getCategoryRowActions = (
  handlers: RowActionHandlers,
): ((row: ExtendedProductCategory) => RowAction[]) => {
  return (row: ExtendedProductCategory) => {
    const actions: RowAction[] = []
    const isSystemCategory = row.company_id === 1

    if (handlers.onView)
      actions.push({
        label: 'View Details',
        icon: <IconEye size={16} />,
        onClick: handlers.onView,
        tooltip: 'View category details',
      })

    if (!isSystemCategory) {
      if (handlers.onEdit)
        actions.push({
          label: 'Edit Category',
          icon: <IconEdit size={16} />,
          onClick: handlers.onEdit,
          tooltip: 'Edit category information',
        })
      if (handlers.onDelete)
        actions.push({
          label: 'Delete Category',
          icon: <IconTrash size={16} />,
          onClick: handlers.onDelete,
          color: 'red',
          tooltip: 'Soft delete category',
        })
    }

    return actions
  }
}

interface FilterHandlers {
  onStatusChange: (value: string) => void
  onProductChange?: (value: string) => void
  onCategoryTypeChange?: (value: string) => void
  currentStatusFilter?: string
  currentProductFilter?: string
  currentCategoryTypeFilter?: string
}

export const getCategoryFilters = (handlers: FilterHandlers): Filter[] => [
  {
    label: 'Type',
    options: [
      { label: 'All Types', value: 'all' },
      { label: 'System Categories', value: 'system' },
      { label: 'Company Categories', value: 'company' },
    ],
    onChange: handlers.onCategoryTypeChange || (() => {}),
    currentValue: handlers.currentCategoryTypeFilter || 'all',
  },
  {
    label: 'Status',
    options: [
      { label: 'All Status', value: 'all' },
      { label: 'Active Only', value: 'active' },
      { label: 'Inactive Only', value: 'inactive' },
    ],
    onChange: handlers.onStatusChange,
    currentValue: handlers.currentStatusFilter || 'all',
  },
  ...(handlers.onProductChange
    ? [
        {
          label: 'Products',
          options: [
            { label: 'All', value: 'all' },
            { label: 'With Products', value: 'with' },
            { label: 'Without Products', value: 'without' },
            { label: '10+ Products', value: '10plus' },
            { label: '50+ Products', value: '50plus' },
          ],
          onChange: handlers.onProductChange,
          currentValue: handlers.currentProductFilter || 'all',
        },
      ]
    : []),
]

export const getStatisticsCardsData = (stats: {
  total: number
  active: number
  withProducts: number
}): StatCard[] => [
  {
    icon: <IconCategory />,
    number: stats.total.toString(),
    label: 'Total Categories',
    color: 'violet',
  },
  {
    icon: <IconCircleDashedCheck />,
    number: stats.active.toString(),
    label: 'Active Categories',
    color: 'green',
  },
  {
    icon: <IconPackages />,
    number: stats.withProducts.toString(),
    label: 'With Products',
    color: 'teal',
  },
]

