import {
  Text,
  Badge,
  Group,
  Box,
  useMantineTheme,
  useMantineColorScheme,
} from '@mantine/core'
import {
  IconEye,
  IconEdit,
  IconTrash,
  IconSend,
  IconCheck,
  IconCircleX,
  IconPackage,
  IconCurrencyDollar,
  IconX,
  IconArrowBack,
  IconFileText,
  IconFileSpreadsheet,
  IconRefresh,
  IconShoppingCart,
  IconAlertCircle,
  IconCircleCheck,
  IconClock,
  IconFileOff,
  IconAlertTriangle,
  IconUser,
} from '@tabler/icons-react'
import { formatCurrency, formatDate } from '@shared/utils/formatters'
import {
  getStatusColor,
  getPaymentStatusColor,
  formatPOStatus,
  formatPaymentStatus,
} from './utils/purchaseOrdersHistoryUtils'
import { isPurchaseApprovalRequired } from './utils/companySettingsUtils'
import type { CompanySettings } from '@shared/types/companySettings'
import { PurchaseOrder } from '../POP/types'

// ============================================================
// TYPES
// ============================================================

interface POStats {
  total: number
  draft: number
  pending: number
  approved: number
  rejected: number
  received: number
  cancelled: number
  completed: number
  totalAmount: number
  totalPaid: number
  totalDue: number
  unpaid: number
  paid: number
  overdue: number
}

// ============================================================
// THEME-AWARE BADGE COMPONENT
// ============================================================

const ThemedBadge = ({
  color,
  variant = 'filled',
  children,
  ...props
}: {
  color: string
  variant?: string
  children: React.ReactNode
  [key: string]: unknown
}) => {
  const theme = useMantineTheme()
  const { colorScheme } = useMantineColorScheme()

  return (
    <Badge
      color={color}
      variant={variant}
      radius="sm"
      size="sm"
      styles={(theme) => ({
        root: {
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          fontSize: '0.7rem',
          boxShadow:
            colorScheme === 'light'
              ? '0 1px 3px rgba(0, 0, 0, 0.08)'
              : '0 1px 3px rgba(0, 0, 0, 0.3)',
        },
      })}
      {...props}
    >
      {children}
    </Badge>
  )
}

// ============================================================
// COLUMN DEFINITIONS
// ============================================================

export const getPurchaseOrdersColumns = (currency: string) => {
  const theme = useMantineTheme()
  const { colorScheme } = useMantineColorScheme()

  const allColumns = [
    // ── PO Number ─────────────────────────────────────────────────────────
    {
      header: 'PO Number',
      accessor: 'po_number',
      render: (row: PurchaseOrder) => (
        <Text
          fw={600}
          size="sm"
          c={
            colorScheme === 'dark'
              ? theme.colors[theme.primaryColor][3]
              : theme.colors[theme.primaryColor][7]
          }
          style={{
            fontFamily: theme.fontFamilyMonospace,
            letterSpacing: '0.5px',
          }}
        >
          {row.po_number || 'N/A'}
        </Text>
      ),
    },

    // ── Invoice Number ────────────────────────────────────────────────────
    {
      header: 'Invoice #',
      accessor: 'invoice_number',
      render: (row: PurchaseOrder) =>
        row.invoice_number ? (
          <Text
            fw={500}
            size="sm"
            style={{
              fontFamily: theme.fontFamilyMonospace,
              color:
                colorScheme === 'dark'
                  ? theme.colors.gray[4]
                  : theme.colors.gray[7],
            }}
          >
            {row.invoice_number}
          </Text>
        ) : (
          <Text
            size="sm"
            c="dimmed"
            fs="italic"
          >
            —
          </Text>
        ),
    },

    // ── Supplier ──────────────────────────────────────────────────────────
    {
      header: 'Supplier',
      accessor: 'supplier_name',
      render: (row: PurchaseOrder) => (
        <Text
          size="sm"
          fw={500}
          c={colorScheme === 'dark' ? 'gray.3' : 'gray.9'}
        >
          {row.supplier_name || 'Unknown Supplier'}
        </Text>
      ),
    },

    // ── Store ─────────────────────────────────────────────────────────────
    {
      header: 'Store',
      accessor: 'store_name',
      render: (row: PurchaseOrder) => (
        <Text
          c="dimmed"
          size="sm"
          fs="italic"
        >
          {row.store_name || 'No Store Assigned'}
        </Text>
      ),
    },

    // ── PO Date ───────────────────────────────────────────────────────────
    {
      header: 'PO Date',
      accessor: 'po_date',
      render: (row: PurchaseOrder) => (
        <Text
          c="dimmed"
          size="sm"
        >
          {row.po_date ? formatDate(row.po_date) : 'N/A'}
        </Text>
      ),
    },

    // ── Expected Delivery ─────────────────────────────────────────────────
    {
      header: 'Expected Delivery',
      accessor: 'expected_delivery_date',
      render: (row: PurchaseOrder) => (
        <Text
          c="dimmed"
          size="sm"
        >
          {row.expected_delivery_date
            ? formatDate(row.expected_delivery_date)
            : 'Not Set'}
        </Text>
      ),
    },

    // ── Status ────────────────────────────────────────────────────────────
    {
      header: 'Status',
      accessor: 'status',
      render: (row: PurchaseOrder) => (
        <div
          style={{
            display: 'flex',
            gap: '6px',
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <ThemedBadge
            color={getStatusColor(row.status || 'draft')}
            variant="filled"
          >
            {formatPOStatus(row.status || 'draft')}
          </ThemedBadge>
        </div>
      ),
    },

    // ── Total ─────────────────────────────────────────────────────────────
    {
      header: 'Total',
      accessor: 'total_amount',
      render: (row: PurchaseOrder) => (
        <Text
          fw={700}
          size="sm"
          c={
            colorScheme === 'dark'
              ? theme.colors[theme.primaryColor][4]
              : theme.colors[theme.primaryColor][8]
          }
          style={{ fontFamily: theme.fontFamilyMonospace }}
        >
          {formatCurrency(parseFloat(row.total_amount) || 0, currency)}
        </Text>
      ),
    },

    // ── Paid ──────────────────────────────────────────────────────────────
    {
      header: 'Paid',
      accessor: 'paid_amount',
      render: (row: PurchaseOrder) => (
        <Text
          c="teal.6"
          size="sm"
          fw={600}
          style={{ fontFamily: theme.fontFamilyMonospace }}
        >
          {formatCurrency(parseFloat(row.paid_amount) || 0, currency)}
        </Text>
      ),
    },

    // ── Due ───────────────────────────────────────────────────────────────
    {
      header: 'Due',
      accessor: 'due_amount',
      render: (row: PurchaseOrder) => (
        <Text
          c="red.6"
          size="sm"
          fw={600}
          style={{ fontFamily: theme.fontFamilyMonospace }}
        >
          {formatCurrency(parseFloat(row.due_amount) || 0, currency)}
        </Text>
      ),
    },

    // ── Payment Status ────────────────────────────────────────────────────
    {
      header: 'Payment Status',
      accessor: 'payment_status',
      render: (row: PurchaseOrder) => (
        <ThemedBadge
          color={getPaymentStatusColor(row.payment_status || 'unpaid')}
          variant="light"
        >
          {formatPaymentStatus(row.payment_status || 'unpaid')}
        </ThemedBadge>
      ),
    },

    // ── Payment Method ────────────────────────────────────────────────────
    {
      header: 'Payment Method',
      accessor: 'payment_method',
      render: (row: PurchaseOrder) => {
        const method = (row.payment_method as string | null) ?? 'cash'
        const LABELS: Record<string, string> = {
          cash: 'Cash',
          card: 'Card',
          bank_transfer: 'Bank Transfer',
          credit: 'Credit',
          mobile_money: 'Mobile Money',
        }
        const COLORS: Record<string, string> = {
          cash: 'green',
          card: 'blue',
          bank_transfer: 'indigo',
          credit: 'orange',
          mobile_money: 'violet',
        }
        const label = LABELS[method] ?? method
        const color = COLORS[method] ?? 'gray'
        return (
          <ThemedBadge
            color={color}
            variant="light"
          >
            {label}
          </ThemedBadge>
        )
      },
    },

    // ── Created By ────────────────────────────────────────────────────────
    {
      header: 'Created By',
      accessor: 'created_by_name',
      render: (row: PurchaseOrder) =>
        row.created_by_name ? (
          <Group
            gap={6}
            wrap="nowrap"
          >
            <IconUser
              size={14}
              color={
                colorScheme === 'dark'
                  ? theme.colors.gray[5]
                  : theme.colors.gray[6]
              }
              style={{ flexShrink: 0 }}
            />
            <Text
              size="sm"
              c={colorScheme === 'dark' ? 'gray.3' : 'gray.8'}
            >
              {row.created_by_name}
            </Text>
          </Group>
        ) : (
          <Text
            size="sm"
            c="dimmed"
          >
            —
          </Text>
        ),
    },

    // ── Approved By ───────────────────────────────────────────────────────
    {
      header: 'Approved By',
      accessor: 'approved_by_name',
      render: (row: PurchaseOrder) =>
        row.approved_by_name ? (
          <Group
            gap={6}
            wrap="nowrap"
          >
            <IconUser
              size={14}
              color={
                colorScheme === 'dark'
                  ? theme.colors.teal[4]
                  : theme.colors.teal[7]
              }
              style={{ flexShrink: 0 }}
            />
            <Text
              size="sm"
              c={colorScheme === 'dark' ? 'teal.3' : 'teal.8'}
            >
              {row.approved_by_name}
            </Text>
          </Group>
        ) : (
          <Text
            size="sm"
            c="dimmed"
          >
            —
          </Text>
        ),
    },

    // ── Received By (modal only) ──────────────────────────────────────────
    // AUDIT: received_by moved to modal
    {
      header: 'Received By',
      accessor: 'received_by_name',
      render: (row: PurchaseOrder) =>
        row.received_by_name ? (
          <Group
            gap={6}
            wrap="nowrap"
          >
            <IconUser
              size={14}
              color={
                colorScheme === 'dark'
                  ? theme.colors.blue[4]
                  : theme.colors.blue[7]
              }
              style={{ flexShrink: 0 }}
            />
            <Text
              size="sm"
              c={colorScheme === 'dark' ? 'blue.3' : 'blue.8'}
            >
              {row.received_by_name}
            </Text>
          </Group>
        ) : (
          <Text
            size="sm"
            c="dimmed"
          >
            —
          </Text>
        ),
    },
  ]

  // AUDIT: Only show recommended 8 columns in table; move extras to modal
  const TABLE_COLUMNS = [
    'po_number',
    'supplier_name',
    'store_name',
    'po_date',
    'status',
    'total_amount',
    'payment_status',
    'created_by_name',
  ]
  return allColumns.filter((col) => TABLE_COLUMNS.includes(col.accessor))
}

// ============================================================
// HEADER ACTIONS
// ============================================================

export const getPurchaseOrdersHeaderActions = (handlers: {
  onExportPDF: () => void
  onExportExcel: () => void
  onRefresh: () => void
}) => {
  const theme = useMantineTheme()

  return [
    {
      title: 'Export PDF',
      icon: <IconFileText size={20} />,
      color: theme.primaryColor,
      onClick: handlers.onExportPDF,
    },
    {
      title: 'Export Excel',
      icon: <IconFileSpreadsheet size={20} />,
      color: 'teal',
      onClick: handlers.onExportExcel,
    },
    {
      title: 'Refresh',
      icon: <IconRefresh size={20} />,
      color: 'gray',
      onClick: handlers.onRefresh,
    },
  ]
}

// ============================================================
// ROW ACTIONS
// ============================================================

export const getPurchaseOrdersRowActions = (
  handlers: {
    onView: (row: PurchaseOrder) => void
    onEdit: (row: PurchaseOrder) => void
    onDelete: (row: PurchaseOrder) => void
    onSubmit?: (row: PurchaseOrder) => void
    onApprove: (row: PurchaseOrder) => void
    onReject?: (row: PurchaseOrder) => void
    onReceive?: (row: PurchaseOrder) => void
    onMarkPaid?: (row: PurchaseOrder) => void
    onCancel: (row: PurchaseOrder) => void
    onReturn: (row: PurchaseOrder) => void
  },
  companySettings: CompanySettings | null,
) => {
  const requiresApproval = companySettings?.require_purchase_approval === true
  const theme = useMantineTheme()

  const allActions = [
    {
      label: 'View',
      onClick: handlers.onView,
      icon: <IconEye size={16} />,
      color: theme.primaryColor,
      condition: () => true,
    },
    {
      label: 'Edit',
      onClick: handlers.onEdit,
      icon: <IconEdit size={16} />,
      color: theme.primaryColor,
      condition: (row: PurchaseOrder) =>
        row.status === 'draft' || row.status === 'pending',
    },
    {
      label: requiresApproval ? 'Submit for Approval' : 'Finalize Order',
      onClick: requiresApproval
        ? handlers.onSubmit || handlers.onApprove
        : handlers.onApprove,
      icon: requiresApproval ? <IconSend size={16} /> : <IconCheck size={16} />,
      color: 'teal',
      condition: (row: PurchaseOrder) => row.status === 'draft',
    },
    {
      label: 'Approve',
      onClick: handlers.onApprove,
      icon: <IconCheck size={16} />,
      color: 'teal',
      condition: (row: PurchaseOrder) =>
        requiresApproval && row.status === 'pending',
    },
    {
      label: 'Receive Goods',
      onClick: handlers.onReceive || (() => {}),
      icon: <IconPackage size={16} />,
      color: theme.primaryColor,
      condition: (row: PurchaseOrder) =>
        ['pending', 'approved', 'partially_received'].includes(row.status),
    },
    {
      label: 'Mark as Paid',
      onClick: handlers.onMarkPaid || (() => {}),
      icon: <IconCurrencyDollar size={16} />,
      color: 'teal',
      condition: (row: PurchaseOrder) =>
        row.status === 'received' && row.payment_status !== 'paid',
    },
    {
      label: 'Return',
      onClick: handlers.onReturn,
      icon: <IconArrowBack size={16} />,
      color: 'orange',
      condition: (row: PurchaseOrder) =>
        companySettings?.allow_purchase_returns === true &&
        row.status === 'received',
    },
    {
      label: 'Reject',
      onClick: handlers.onReject || (() => {}),
      icon: <IconCircleX size={16} />,
      color: 'red',
      condition: (row: PurchaseOrder) =>
        requiresApproval && row.status === 'pending',
    },
    {
      label: 'Cancel',
      onClick: handlers.onCancel,
      icon: <IconX size={16} />,
      color: 'red',
      condition: (row: PurchaseOrder) =>
        row.status !== 'cancelled' &&
        row.status !== 'received' &&
        row.status !== 'returned',
    },
    {
      label: 'Delete',
      onClick: handlers.onDelete,
      icon: <IconTrash size={16} />,
      color: 'red',
      condition: (row: PurchaseOrder) => row.status === 'draft',
    },
  ]

  return (row: PurchaseOrder) =>
    allActions.filter((action) =>
      action.condition ? action.condition(row) : true,
    )
}

// ============================================================
// FILTERS
// ============================================================

export const getPurchaseOrdersFilters = (
  onStatusChange: (value: string) => void,
  onPaymentStatusChange?: (value: string) => void,
  onPaymentMethodChange?: (value: string) => void,
) => {
  const filters = [
    {
      label: 'Status',
      options: [
        { label: 'All Statuses', value: 'all' },
        { label: 'Draft', value: 'draft' },
        { label: 'Pending', value: 'pending' },
        { label: 'Approved', value: 'approved' },
        { label: 'Partially Received', value: 'partially_received' },
        { label: 'Rejected', value: 'rejected' },
        { label: 'Received', value: 'received' },
        { label: 'Cancelled', value: 'cancelled' },
        { label: 'Returned', value: 'returned' },
      ],
      onChange: onStatusChange,
    },
  ]

  if (onPaymentStatusChange) {
    filters.push({
      label: 'Payment',
      options: [
        { label: 'All Payments', value: 'all' },
        { label: 'Unpaid', value: 'unpaid' },
        { label: 'Partial', value: 'partial' },
        { label: 'Paid', value: 'paid' },
        { label: 'Overdue', value: 'overdue' },
      ],
      onChange: onPaymentStatusChange,
    })
  }

  if (onPaymentMethodChange) {
    filters.push({
      label: 'Pay Method',
      options: [
        { label: 'All Methods', value: 'all' },
        { label: 'Cash', value: 'cash' },
        { label: 'Card', value: 'card' },
        { label: 'Bank Transfer', value: 'bank_transfer' },
        { label: 'Credit', value: 'credit' },
        { label: 'Mobile Money', value: 'mobile_money' },
      ],
      onChange: onPaymentMethodChange,
    })
  }

  return filters
}

// ============================================================
// STATISTICS CARDS
// ============================================================

export const getStatisticsCardsData = (
  stats: POStats,
  settings: CompanySettings | null,
  currency: string,
  theme: MantineTheme,
) => [
  {
    icon: <IconShoppingCart />,
    number: stats.total.toString(),
    label: 'Total Orders',
    color: theme.primaryColor,
  },
  {
    icon: <IconCircleCheck />,
    number: stats.received.toString(),
    label: 'Received',
    color: 'teal',
  },
  {
    icon: <IconCurrencyDollar />,
    number: formatCurrency(stats.totalAmount || 0, currency),
    label: 'Total Value',
    color: theme.primaryColor,
  },
  {
    icon: <IconCurrencyDollar />,
    number: formatCurrency(stats.totalDue || 0, currency),
    label: 'Amount Due',
    color: 'orange',
  },
]

// ============================================================
// HELPER FUNCTIONS
// ============================================================

export const getAllowedStatusTransitions = (
  currentStatus: string,
  companySettings: CompanySettings | null,
): string[] => {
  const requiresApproval = companySettings?.require_purchase_approval === true

  const transitions: Record<string, string[]> = {
    draft: requiresApproval
      ? ['pending', 'cancelled']
      : ['approved', 'cancelled'],
    pending: ['approved', 'rejected', 'cancelled'],
    approved: ['partially_received', 'received', 'cancelled'],
    partially_received: ['partially_received', 'received'],
    rejected: ['draft'],
    received: [],
    cancelled: [],
  }

  return transitions[currentStatus] || []
}

export const canTransitionToStatus = (
  fromStatus: string,
  toStatus: string,
  companySettings: CompanySettings | null,
): { allowed: boolean; reason?: string } => {
  const allowedTransitions = getAllowedStatusTransitions(
    fromStatus,
    companySettings,
  )

  if (!allowedTransitions.includes(toStatus)) {
    return {
      allowed: false,
      reason: `Cannot transition from '${fromStatus}' to '${toStatus}'. Allowed: ${allowedTransitions.join(', ')}`,
    }
  }

  return { allowed: true }
}

export const getNextStatus = (
  currentStatus: string,
  companySettings: CompanySettings | null,
): string | null => {
  const requiresApproval = companySettings?.require_purchase_approval === true

  const nextStatusMap: Record<string, string> = {
    draft: requiresApproval ? 'pending' : 'approved',
    pending: 'approved',
    approved: 'partially_received',
    partially_received: 'received',
  }

  return nextStatusMap[currentStatus] || null
}

export const getStatusLabel = (status: string): string => {
  const labelMap: Record<string, string> = {
    draft: 'Draft',
    pending: 'Pending Approval',
    approved: 'Approved',
    partially_received: 'Partially Received',
    rejected: 'Rejected',
    received: 'Received',
    cancelled: 'Cancelled',
  }
  return labelMap[status] || status
}

export const getAvailableActionsForStatus = (
  status: string,
  paymentStatus: string | null,
  companySettings: CompanySettings | null,
): string[] => {
  const requiresApproval = companySettings?.require_purchase_approval === true
  const actions: string[] = []

  switch (status) {
    case 'draft':
      actions.push('Edit', 'Delete')
      if (requiresApproval) {
        actions.push('Submit for Approval')
      }
      actions.push('Cancel')
      break

    case 'pending':
      actions.push('Edit', 'Receive Goods', 'Approve', 'Reject', 'Cancel')
      break

    case 'approved':
      actions.push('Receive Goods', 'Cancel')
      break

    case 'received':
      if (paymentStatus !== 'paid') {
        actions.push('Mark as Paid')
      }
      if (companySettings?.allow_purchase_returns) {
        actions.push('Return')
      }
      break

    case 'rejected':
      actions.push('Revise')
      break

    case 'cancelled':
      break
  }

  actions.push('View')
  return actions
}

