// StockAdjustment.config.tsx
// ✅ REFACTORED: Uses shared TableCell components
import { Group, MantineTheme } from '@mantine/core'
import {
  IconEdit,
  IconTrash,
  IconEye,
  IconFileText,
  IconFileSpreadsheet,
  IconRefresh,
  IconAdjustments,
  IconCalendar,
  IconUser,
  IconCheck,
} from '@tabler/icons-react'
import { StockAdjustment } from './types/stockAdjustmentTypes'
import { ReactNode } from 'react'
import {
  TextCell,
  DateCell,
  BadgeCell,
  StatusDotCell,
  AvatarNameCell,
  TruncatedTextCell,
  type StatusDotConfig,
} from '@shared/components/tableCell'

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
  onClick?: (row: StockAdjustment, index: number) => void
  tooltip?: string
}

const ADJUSTMENT_TYPE_COLORS: Record<string, string> = {
  damage: 'red',
  expiry: 'orange',
  loss: 'pink',
  found: 'green',
  correction: 'blue',
  transfer_in: 'cyan',
  transfer_out: 'grape',
}

const formatAdjustmentType = (type: string): string =>
  type
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')

const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return 'N/A'
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

const APPROVAL_STATUS_MAP: Record<string, StatusDotConfig> = {
  approved: {
    dot: 'var(--mantine-color-green-6)',
    text: 'var(--mantine-color-green-8)',
    label: 'Approved',
  },
  pending: {
    dot: 'var(--mantine-color-yellow-5)',
    text: 'var(--mantine-color-yellow-7)',
    label: 'Pending',
  },
}

export const getStockAdjustmentColumns = (
  theme: MantineTheme,
  colorScheme: 'light' | 'dark',
) => {
  const allCols = [
    {
      header: 'Adjustment #',
      accessor: 'adjustment_number',
      maxWidth: 150,
      render: (row: StockAdjustment) => (
        <Group
          gap={4}
          direction="column"
          wrap="nowrap"
        >
          <TextCell
            value={row.adjustment_number}
            fw={600}
            color="body"
            truncate
            tooltip={row.adjustment_number}
          />
          <Group
            gap={4}
            wrap="nowrap"
          >
            <IconCalendar size={12} />
            <TextCell
              value={formatDate(row.adjustment_date)}
              size="xs"
              color="dimmed"
            />
          </Group>
        </Group>
      ),
    },
    {
      header: 'Store',
      accessor: 'store',
      render: (row: StockAdjustment) => (
        <TruncatedTextCell
          value={row.store?.store_name}
          fallback="N/A"
          tooltip={row.store?.store_name || 'N/A'}
        />
      ),
    },
    {
      header: 'Product',
      accessor: 'product',
      maxWidth: 200,
      render: (row: StockAdjustment) => (
        <TextCell
          value={row.product?.product_name}
          fallback="N/A"
          fw={500}
          color="body"
          truncate
          tooltip={row.product?.product_name || 'N/A'}
        />
      ),
    },
    {
      header: 'Batch',
      accessor: 'batch',
      render: (row: StockAdjustment) => (
        <BadgeCell
          value={row.batch?.batch_number || 'No Batch'}
          usePrimary
          variant="light"
        />
      ),
    },
    {
      header: 'Type',
      accessor: 'adjustment_type',
      render: (row: StockAdjustment) => (
        <BadgeCell
          value={formatAdjustmentType(row.adjustment_type)}
          color={ADJUSTMENT_TYPE_COLORS[row.adjustment_type] ?? 'gray'}
          variant="light"
        />
      ),
    },
    {
      header: 'Quantity',
      accessor: 'quantity_adjusted',
      render: (row: StockAdjustment) => (
        <TextCell
          value={`${row.quantity_adjusted >= 0 ? '+' : ''}${row.quantity_adjusted}`}
          fw={600}
          color={row.quantity_adjusted >= 0 ? 'success' : 'danger'}
          tooltip={`${row.quantity_before} → ${row.quantity_after}`}
          nowrap
        />
      ),
    },
    {
      header: 'Adjusted By',
      accessor: 'adjusted_by_profile',
      render: (row: StockAdjustment) => {
        const adjuster = row.adjusted_by_profile
        if (!adjuster)
          return (
            <TextCell
              value="Unknown"
              color="dimmed"
            />
          )
        const name = `${adjuster.first_name} ${adjuster.last_name}`
        return (
          <Group
            gap={6}
            wrap="nowrap"
          >
            <IconUser
              size={14}
              style={{ flexShrink: 0 }}
            />
            <TextCell
              value={name}
              color="body"
            />
          </Group>
        )
      },
    },
    {
      header: 'Status',
      accessor: 'is_approved',
      render: (row: StockAdjustment) => (
        <StatusDotCell
          statusKey={row.is_approved ? 'approved' : 'pending'}
          statusMap={APPROVAL_STATUS_MAP}
        />
      ),
    },
  ]
  return allCols
}

interface HeaderActionHandlers {
  onExportPDF?: () => void
  onExportExcel?: () => void
  onRefresh: () => void
}

export const getStockAdjustmentHeaderActions = (
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

export const getStockAdjustmentPrimaryAction = (
  onClick: () => void,
): PrimaryAction => ({
  icon: <IconAdjustments size={18} />,
  label: 'New Adjustment',
  onClick,
})

// ─── Store type used only for filter option generation ───────────────────────
interface StoreOption {
  id: number
  store_name: string
}

interface StockAdjustmentFilterHandlers {
  onStoreChange: (value: string) => void
  onAdjustmentTypeChange: (value: string) => void
  onDateRangeChange: (value: string) => void
  onSortChange: (value: string) => void
  stores: StoreOption[]
  currentStoreFilter?: string
  currentAdjustmentTypeFilter?: string
  currentDateRangeFilter?: string
  currentSortFilter?: string
}

export const getStockAdjustmentFilters = (
  handlers: StockAdjustmentFilterHandlers,
) => {
  const storeOptions = [
    { label: 'All Stores', value: 'all' },
    ...handlers.stores.map((s) => ({
      label: s.store_name,
      value: String(s.id),
    })),
  ]

  return [
    {
      label: 'Store',
      options: storeOptions,
      onChange: handlers.onStoreChange,
      value: handlers.currentStoreFilter ?? 'all',
    },
    {
      label: 'Type',
      options: [
        { label: 'All Types', value: 'all' },
        { label: 'Damage', value: 'damage' },
        { label: 'Expiry', value: 'expiry' },
        { label: 'Loss', value: 'loss' },
        { label: 'Found', value: 'found' },
        { label: 'Correction', value: 'correction' },
        { label: 'Transfer In', value: 'transfer_in' },
        { label: 'Transfer Out', value: 'transfer_out' },
      ],
      onChange: handlers.onAdjustmentTypeChange,
      value: handlers.currentAdjustmentTypeFilter ?? 'all',
    },
    {
      label: 'Date',
      options: [
        { label: 'All Time', value: 'all' },
        { label: 'Today', value: 'today' },
        { label: 'Yesterday', value: 'yesterday' },
        { label: 'Last 7 Days', value: 'last_7_days' },
        { label: 'Last 30 Days', value: 'last_30_days' },
        { label: 'This Month', value: 'this_month' },
        { label: 'Last Month', value: 'last_month' },
        { label: 'This Year', value: 'this_year' },
      ],
      onChange: handlers.onDateRangeChange,
      value: handlers.currentDateRangeFilter ?? 'all',
    },
    {
      label: 'Sort',
      options: [
        { label: 'Newest First', value: 'desc' },
        { label: 'Oldest First', value: 'asc' },
      ],
      onChange: handlers.onSortChange,
      value: handlers.currentSortFilter ?? 'desc',
    },
  ]
}

export const getStockAdjustmentRowActions = (handlers: {
  onView: (row: StockAdjustment) => void
  onEdit: (row: StockAdjustment) => void
  onDelete: (row: StockAdjustment) => void
}): RowAction[] => [
  {
    label: 'View',
    icon: <IconEye size={16} />,
    onClick: handlers.onView,
    tooltip: 'View Details',
  },
  {
    label: 'Edit',
    icon: <IconEdit size={16} />,
    onClick: handlers.onEdit,
    tooltip: 'Edit Adjustment',
  },
  {
    label: 'Delete',
    icon: <IconTrash size={16} />,
    color: 'red',
    onClick: handlers.onDelete,
    tooltip: 'Delete',
  },
]

