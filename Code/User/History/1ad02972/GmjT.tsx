// src/pages/Products/config/ProductsManagement.config.tsx
import { Text, Badge, Group, Box, Tooltip, MantineTheme } from '@mantine/core'
import {
  IconEye,
  IconEdit,
  IconTrash,
  IconFileText,
  IconFileSpreadsheet,
  IconRefresh,
  IconPill,
  IconCategory,
  IconPackage,
  IconAlertTriangle,
  IconWorld,
} from '@tabler/icons-react'
import { Product, ProductCategory } from '@shared/types/products'
import { ReactNode } from 'react'
import {
  getPrimaryColor,
  getStatusColor,
  getIconColor,
  getBadgeColor,
} from '@app/core/theme/theme.utils'

export interface ExtendedProduct extends Product {
  is_system?: boolean
  category_name?: string
  is_medicine?: boolean
  unit_name?: string
  unit_short_code?: string
}

export interface ExtendedProductCategory extends ProductCategory {
  is_system?: boolean
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
  onClick?: (row: ExtendedProduct, index: number) => void
  tooltip?: string
  disabled?: (row: ExtendedProduct) => boolean
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

interface FilterHandlers {
  onStatusChange: (value: string) => void
  onCategoryChange?: (value: string) => void
  onPrescriptionChange?: (value: string) => void
  onScopeChange?: (value: string) => void
  onProductTypeChange?: (value: string) => void
  currentStatusFilter?: string
  currentCategoryFilter?: string
  currentPrescriptionFilter?: string
  currentScopeFilter?: string
  currentProductTypeFilter?: string
  categories?: ExtendedProductCategory[]
}

/**
 * Format currency with dynamic currency code
 */
const formatCurrency = (
  amount?: number | null,
  currency: string = 'UGX',
): string => {
  if (!amount && amount !== 0) return 'N/A'
  return `${currency} ${amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

/**
 * Get product table columns configuration with theme support
 */
export const getProductColumns = (
  currency: string = 'UGX',
  theme: MantineTheme,
  colorScheme: 'light' | 'dark' = 'light',
): any[] => {
  const allCols: any[] = [
    {
      header: 'Product Info',
      accessor: 'product_name',
      render: (row: ExtendedProduct) => (
        <Group
          gap="sm"
          wrap="nowrap"
          style={{ minWidth: 0 }}
        >
          <Box style={{ minWidth: 0, flex: 1 }}>
            <Tooltip
              label={row.product_name}
              withinPortal
            >
              <Text
                fw={600}
                size="sm"
                c={colorScheme === 'dark' ? theme.white : theme.black}
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {row.product_name}
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
              {row.product_code || 'No code'}
              {row.nda_registration_number &&
                ` • ${row.nda_registration_number}`}
            </Text>
          </Box>
        </Group>
      ),
    },
    {
      header: 'Generic Name',
      accessor: 'generic_name',
      render: (row: ExtendedProduct) => (
        <Tooltip
          label={row.generic_name || 'No generic name'}
          withinPortal
        >
          <Text
            size="sm"
            c={
              row.generic_name
                ? colorScheme === 'dark'
                  ? theme.white
                  : theme.black
                : 'dimmed'
            }
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: '180px',
            }}
          >
            {row.generic_name || 'N/A'}
          </Text>
        </Tooltip>
      ),
    },
    {
      header: 'Strength & Form',
      accessor: 'strength',
      render: (row: ExtendedProduct) => (
        <Box>
          <Text
            size="sm"
            fw={500}
            c={
              row.strength
                ? colorScheme === 'dark'
                  ? theme.white
                  : theme.black
                : 'dimmed'
            }
          >
            {row.strength || 'N/A'}
          </Text>
          {row.dosage_form && (
            <Text
              size="xs"
              c="dimmed"
            >
              {row.dosage_form}
            </Text>
          )}
        </Box>
      ),
    },
    {
      header: 'Manufacturer',
      accessor: 'manufacturer',
      render: (row: ExtendedProduct) => {
        const manufacturerText = row.manufacturer || 'Unknown'
        const fullText = row.country_of_manufacture
          ? `${manufacturerText} (${row.country_of_manufacture})`
          : manufacturerText

        return (
          <Tooltip
            label={fullText}
            withinPortal
          >
            <Text
              size="sm"
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: '150px',
              }}
            >
              {manufacturerText}
            </Text>
          </Tooltip>
        )
      },
    },
    {
      header: 'Category',
      accessor: 'category_name',
      render: (row: ExtendedProduct) => (
        <Group
          gap="xs"
          wrap="nowrap"
        >
          {row.is_system ? (
            <Badge
              variant="light"
              color="blue"
              leftSection={<IconWorld size={12} />}
              size="md"
              radius="sm"
            >
              {row.category_name || 'Uncategorized'}
            </Badge>
          ) : (
            <Badge
              variant="light"
              color={theme.primaryColor}
              leftSection={<IconCategory size={12} />}
              size="md"
              radius="sm"
            >
              {row.category_name || 'Uncategorized'}
            </Badge>
          )}
        </Group>
      ),
    },
    {
      header: 'Unit',
      accessor: 'unit_name',
      render: (row: ExtendedProduct) => {
        const unitText = row.unit_short_code || row.unit_name || 'N/A'
        return (
          <Tooltip
            label={
              row.unit_name
                ? `${row.unit_name} (${row.unit_short_code})`
                : 'No unit specified'
            }
            withinPortal
          >
            <Badge
              variant="light"
              color="cyan"
              size="md"
              radius="sm"
              style={{
                textTransform: 'uppercase',
                fontWeight: 600,
                letterSpacing: '0.5px',
              }}
            >
              {unitText}
            </Badge>
          </Tooltip>
        )
      },
    },
    {
      header: 'Pricing',
      accessor: 'standard_price',
      render: (row: ExtendedProduct) => (
        <Box>
          {row.standard_price ? (
            <Text
              size="sm"
              fw={600}
              c={theme.colors.green[7]}
            >
              {formatCurrency(row.standard_price, currency)}
            </Text>
          ) : (
            <Text
              size="sm"
              c="dimmed"
            >
              N/A
            </Text>
          )}
          {row.standard_cost && (
            <Text
              size="xs"
              c="dimmed"
            >
              Cost: {formatCurrency(row.standard_cost, currency)}
            </Text>
          )}
        </Box>
      ),
    },
    {
      header: 'Inventory',
      accessor: 'reorder_level',
      render: (row: ExtendedProduct) => (
        <Box>
          <Text
            size="sm"
            c={colorScheme === 'dark' ? theme.white : theme.black}
          >
            Min:{' '}
            <Text
              component="span"
              fw={500}
            >
              {row.reorder_level || 0}
            </Text>
          </Text>
          {row.max_stock_level && (
            <Text
              size="xs"
              c="dimmed"
            >
              Max: {row.max_stock_level}
            </Text>
          )}
          {row.requires_prescription ? (
            <Tooltip
              label="Requires Prescription"
              withinPortal
            >
              <Badge
                color="orange"
                variant="outline"
                size="xs"
                radius="xs"
              >
                Rx
              </Badge>
            </Tooltip>
          ) : (
            <Tooltip
              label="No Prescription"
              withinPortal
            >
              <Badge
                color={theme.primaryColor}
                variant="outline"
                size="xs"
                radius="xs"
              >
                NRx
              </Badge>
            </Tooltip>
          )}
        </Box>
      ),
    },
    {
      header: 'Status',
      accessor: 'is_active',
      render: (row: ExtendedProduct) => (
        <Group
          gap="xs"
          wrap="nowrap"
        >
          <Badge
            color={row.is_active ? 'green' : 'gray'}
            variant="light"
            size="md"
            radius="sm"
          >
            {row.is_active ? 'Active' : 'Inactive'}
          </Badge>
          {row.is_controlled_substance && (
            <Tooltip
              label="Controlled Substance"
              withinPortal
            >
              <Badge
                color="red"
                variant="filled"
                size="sm"
                radius="sm"
                leftSection={<IconAlertTriangle size={12} />}
              >
                CS
              </Badge>
            </Tooltip>
          )}
        </Group>
      ),
    },
    {
      header: 'Product Type',
      accessor: 'is_medicine',
      maxWidth: 140,
      render: (row: ExtendedProduct) => {
        const isMed = row.is_medicine !== false
        return (
          <Badge
            variant="light"
            color={isMed ? 'teal' : 'grape'}
            size="md"
            leftSection={
              isMed ? <IconPill size={12} /> : <IconPackage size={12} />
            }
            style={{ whiteSpace: 'nowrap' }}
          >
            {isMed ? 'Medicine' : 'Non-Medicine'}
          </Badge>
        )
      },
    },
  ]
  // Reduce to recommended cols
  const TABLE_COLS = [
    'product_name',
    'generic_name',
    'strength',
    'category_name',
    'reorder_level',
    'is_medicine',
    'is_active',
  ]
  return allCols.filter((col) => TABLE_COLS.includes(col.accessor))
}

export const getProductHeaderActions = (handlers: {
  onExportPDF?: () => void
  onExportExcel?: () => void
  onRefresh: () => void
}): HeaderAction[] => {
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

export const getProductPrimaryAction = (
  onAddProduct: () => void,
): PrimaryAction => ({
  icon: <IconPill size={18} />,
  label: 'Add Product',
  onClick: onAddProduct,
})

export const getProductRowActions = (handlers: {
  onView?: (row: ExtendedProduct) => void
  onEdit?: (row: ExtendedProduct) => void
  onDelete?: (row: ExtendedProduct) => void
}) => {
  return (row: ExtendedProduct): RowAction[] => {
    const actions: RowAction[] = []

    if (handlers.onView) {
      actions.push({
        label: 'View Details',
        icon: <IconEye size={16} />,
        onClick: handlers.onView,
        tooltip: 'View Details',
      })
    }

    if (!row.is_system) {
      if (handlers.onEdit) {
        actions.push({
          label: 'Edit Product',
          icon: <IconEdit size={16} />,
          onClick: handlers.onEdit,
          tooltip: 'Edit Product',
        })
      }

      if (handlers.onDelete) {
        actions.push({
          label: 'Delete Product',
          icon: <IconTrash size={16} />,
          color: 'red',
          onClick: handlers.onDelete,
          tooltip: 'Delete Product',
        })
      }
    }

    return actions
  }
}

export const getProductFilters = (handlers: FilterHandlers): Filter[] => {
  const safeHandlers = {
    onStatusChange: handlers.onStatusChange || (() => {}),
    onCategoryChange: handlers.onCategoryChange || undefined,
    onPrescriptionChange: handlers.onPrescriptionChange || undefined,
    onScopeChange: handlers.onScopeChange || undefined,
    currentStatusFilter: handlers.currentStatusFilter || 'all',
    currentCategoryFilter: handlers.currentCategoryFilter || 'all',
    currentPrescriptionFilter: handlers.currentPrescriptionFilter || 'all',
    currentScopeFilter: handlers.currentScopeFilter || 'all',
    categories: handlers.categories || [],
  }

  const filters: Filter[] = [
    {
      label: 'Status',
      options: [
        { label: 'All Products', value: 'all' },
        { label: 'Active Only', value: 'active' },
        { label: 'Inactive Only', value: 'inactive' },
      ],
      onChange: safeHandlers.onStatusChange,
      currentValue: safeHandlers.currentStatusFilter,
    },
  ]

  if (safeHandlers.onScopeChange) {
    filters.push({
      label: 'Scope',
      options: [
        { label: 'All Products', value: 'all' },
        { label: 'System Only', value: 'system' },
        { label: 'Company Only', value: 'company' },
      ],
      onChange: safeHandlers.onScopeChange,
      currentValue: safeHandlers.currentScopeFilter,
    })
  }

  if (safeHandlers.onCategoryChange) {
    const categoryOptions: FilterOption[] = [
      { label: 'All Categories', value: 'all' },
    ]

    if (safeHandlers.categories && safeHandlers.categories.length > 0) {
      safeHandlers.categories.forEach((category) => {
        const label = category.is_system
          ? `🌍 ${category.category_name}`
          : `${category.category_name}`

        categoryOptions.push({
          label: label,
          value: category.id.toString(),
        })
      })
    }

    filters.push({
      label: 'Category',
      options: categoryOptions,
      onChange: safeHandlers.onCategoryChange,
      currentValue: safeHandlers.currentCategoryFilter,
    })
  }

  if (safeHandlers.onPrescriptionChange) {
    filters.push({
      label: 'Prescription',
      options: [
        { label: 'All', value: 'all' },
        { label: 'Prescription Required', value: 'rx' },
        { label: 'Over The Counter', value: 'otc' },
        { label: 'Controlled Substance', value: 'controlled' },
      ],
      onChange: safeHandlers.onPrescriptionChange,
      currentValue: safeHandlers.currentPrescriptionFilter,
    })
  }

  return filters
}

/**
 * Get statistics cards data with theme support
 */
export const getStatisticsCardsData = (
  stats: {
    total: number
    systemProducts: number
    companyProducts: number
    totalCategories: number
    prescriptionRequired: number
    controlledSubstances: number
  },
  theme: MantineTheme,
): StatCard[] => {
  const safeStats = {
    total: stats?.total ?? 0,
    systemProducts: stats?.systemProducts ?? 0,
    companyProducts: stats?.companyProducts ?? 0,
    totalCategories: stats?.totalCategories ?? 0,
    prescriptionRequired: stats?.prescriptionRequired ?? 0,
    controlledSubstances: stats?.controlledSubstances ?? 0,
  }

  const cards: StatCard[] = [
    {
      icon: <IconPill />,
      number: safeStats.total.toString(),
      label: 'Total Products',
      color: 'teal',
    },
    {
      icon: <IconCategory />,
      number: safeStats.companyProducts.toString(),
      label: 'Company Products',
      color: theme.primaryColor,
    },
    {
      icon: <IconPackage />,
      number: safeStats.prescriptionRequired.toString(),
      label: 'Requires Prescription',
      color: 'orange',
    },
    {
      icon: <IconAlertTriangle />,
      number: safeStats.controlledSubstances.toString(),
      label: 'Controlled Substances',
      color: safeStats.controlledSubstances > 0 ? 'red' : 'gray',
    },
  ]

  return cards
}

