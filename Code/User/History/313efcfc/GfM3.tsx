// File: PurchaseOrdersHistory.config.tsx - ENHANCED: Better theming, dark mode, primary colors

import {
  Text,
  Badge,
  Tooltip,
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
} from '@tabler/icons-react'
import { formatCurrency, formatDate } from '@shared/utils/formatters'
import {
  getStatusColor,
  getPaymentStatusColor,
  formatPOStatus,
  formatPaymentStatus,
  getBackorderPriorityColor,
} from './utils/purchaseOrdersHistoryUtils'
import { isPurchaseApprovalRequired } from './utils/companySettingsUtils'
import type { CompanySettings } from '@shared/types/companySettings'

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
}: any) => {
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

// ─────────────────────────────────────────────────────────────────────────────
// PATCH: PurchaseOrdersHistory.config.tsx
// Replace the existing getPurchaseOrdersColumns function with this version.
// The only change is adding the 'Invoice #' column as the second entry.
// ─────────────────────────────────────────────────────────────────────────────

export const getPurchaseOrdersColumns = (currency: string) => {
  const theme = useMantineTheme()
  const { colorScheme } = useMantineColorScheme()

  return [
    {
      header: 'PO Number',
      accessor: 'po_number',
      render: (row: any) => (
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

    // ── NEW: Invoice Number column ─────────────────────────────────────────
    {
      header: 'Invoice #',
      accessor: 'invoice_number',
      render: (row: any) =>
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
    // ─────────────────────────────────────────────────────────────────────────

    {
      header: 'Supplier',
      accessor: 'supplier_name',
      render: (row: any) => (
        <Text
          size="sm"
          fw={500}
          c={colorScheme === 'dark' ? 'gray.3' : 'gray.9'}
        >
          {row.supplier_name || 'Unknown Supplier'}
        </Text>
      ),
    },
    {
      header: 'Store',
      accessor: 'store_name',
      render: (row: any) => (
        <Text
          c="dimmed"
          size="sm"
          fs="italic"
        >
          {row.store_name || 'No Store Assigned'}
        </Text>
      ),
    },
    {
      header: 'PO Date',
      accessor: 'po_date',
      render: (row: any) => (
        <Text
          c="dimmed"
          size="sm"
        >
          {row.po_date ? formatDate(row.po_date) : 'N/A'}
        </Text>
      ),
    },
    {
      header: 'Expected Delivery',
      accessor: 'expected_delivery_date',
      render: (row: any) => (
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
    {
      header: 'Status',
      accessor: 'status',
      render: (row: any) => (
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
          {row.backorder_priority && (
            <Tooltip
              label={`${row.backorder_priority.toUpperCase()} priority backorder`}
              withArrow
            >
              <ThemedBadge
                color={getBackorderPriorityColor(row.backorder_priority)}
                variant="light"
                size="xs"
              >
                {row.backorder_priority}
              </ThemedBadge>
            </Tooltip>
          )}
        </div>
      ),
    },
    {
      header: 'Total',
      accessor: 'total_amount',
      render: (row: any) => (
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
    {
      header: 'Paid',
      accessor: 'paid_amount',
      render: (row: any) => (
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
    {
      header: 'Due',
      accessor: 'due_amount',
      render: (row: any) => (
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
    {
      header: 'Payment Status',
      accessor: 'payment_status',
      render: (row: any) => (
        <ThemedBadge
          color={getPaymentStatusColor(row.payment_status || 'unpaid')}
          variant="light"
        >
          {formatPaymentStatus(row.payment_status || 'unpaid')}
        </ThemedBadge>
      ),
    },
  ]
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
    onView: (row: any) => void
    onEdit: (row: any) => void
    onDelete: (row: any) => void
    onSubmit?: (row: any) => void
    onApprove: (row: any) => void
    onReject?: (row: any) => void
    onReceive?: (row: any) => void
    onMarkPaid?: (row: any) => void
    onCancel: (row: any) => void
    onReturn: (row: any) => void
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
      condition: (row: any) =>
        row.status === 'draft' || row.status === 'pending',
    },
    {
      label: requiresApproval ? 'Submit for Approval' : 'Finalize Order',
      onClick: requiresApproval
        ? handlers.onSubmit || handlers.onApprove
        : handlers.onApprove,
      icon: requiresApproval ? <IconSend size={16} /> : <IconCheck size={16} />,
      color: 'teal',
      condition: (row: any) => row.status === 'draft',
    },
    {
      label: 'Approve',
      onClick: handlers.onApprove,
      icon: <IconCheck size={16} />,
      color: 'teal',
      condition: (row: any) => requiresApproval && row.status === 'pending',
    },
    {
      label: 'Receive Goods',
      onClick: handlers.onReceive || (() => {}),
      icon: <IconPackage size={16} />,
      color: theme.primaryColor,
      condition: (row: any) => row.status === 'approved',
    },
    {
      label: 'Mark as Paid',
      onClick: handlers.onMarkPaid || (() => {}),
      icon: <IconCurrencyDollar size={16} />,
      color: 'teal',
      condition: (row: any) =>
        row.status === 'received' && row.payment_status !== 'paid',
    },
    {
      label: 'Return',
      onClick: handlers.onReturn,
      icon: <IconArrowBack size={16} />,
      color: 'orange',
      condition: (row: any) =>
        companySettings?.allow_purchase_returns === true &&
        row.status === 'received',
    },
    {
      label: 'Reject',
      onClick: handlers.onReject || (() => {}),
      icon: <IconCircleX size={16} />,
      color: 'red',
      condition: (row: any) => requiresApproval && row.status === 'pending',
    },
    {
      label: 'Cancel',
      onClick: handlers.onCancel,
      icon: <IconX size={16} />,
      color: 'red',
      condition: (row: any) =>
        row.status !== 'cancelled' && row.status !== 'received',
    },
    {
      label: 'Delete',
      onClick: handlers.onDelete,
      icon: <IconTrash size={16} />,
      color: 'red',
      condition: (row: any) => row.status === 'draft',
    },
  ]

  return (row: any) =>
    allActions.filter((action) =>
      action.condition ? action.condition(row) : true,
    )
}

// ============================================================
// FILTERS
// ============================================================

export const getPurchaseOrdersFilters = (
  onStatusChange: (value: string) => void,
) => [
  {
    label: 'Status',
    options: [
      { label: 'All Statuses', value: 'all' },
      { label: 'Draft', value: 'draft' },
      { label: 'Pending', value: 'pending' },
      { label: 'Approved', value: 'approved' },
      { label: 'Rejected', value: 'rejected' },
      { label: 'Received', value: 'received' },
      { label: 'Cancelled', value: 'cancelled' },
    ],
    onChange: onStatusChange,
  },
]

// ============================================================
// STATISTICS CARDS
// ============================================================

export const getStatisticsCardsData = (
  stats: POStats,
  settings: CompanySettings | null,
  currency: string,
  theme: any,
) => {
  const cards = [
    {
      icon: <IconShoppingCart />,
      number: stats.total.toString(),
      label: 'Total Orders',
      color: theme.primaryColor,
    },
    {
      icon: <IconFileOff />,
      number: stats.draft.toString(),
      label: 'Draft',
      color: 'gray',
    },
  ]

  if (isPurchaseApprovalRequired(settings)) {
    cards.push({
      icon: <IconClock />,
      number: stats.pending.toString(),
      label: 'Awaiting Approval',
      color: 'yellow',
    })
  } else {
    cards.push({
      icon: <IconClock />,
      number: stats.pending.toString(),
      label: 'Pending',
      color: 'yellow',
    })
  }

  cards.push(
    {
      icon: <IconCircleCheck />,
      number: stats.approved.toString(),
      label: 'Approved',
      color: theme.primaryColor,
    },
    {
      icon: <IconCircleCheck />,
      number: stats.received.toString(),
      label: 'Received',
      color: 'teal',
    },
    {
      icon: <IconCircleX />,
      number: stats.rejected.toString(),
      label: 'Rejected',
      color: 'red',
    },
    {
      icon: <IconX />,
      number: stats.cancelled.toString(),
      label: 'Cancelled',
      color: 'red',
    },
    {
      icon: <IconCurrencyDollar />,
      number: formatCurrency(stats.totalAmount || 0, currency),
      label: 'Total Value',
      color: theme.primaryColor,
    },
    {
      icon: <IconCurrencyDollar />,
      number: formatCurrency(stats.totalPaid || 0, currency),
      label: 'Total Paid',
      color: 'teal',
    },
    {
      icon: <IconCurrencyDollar />,
      number: formatCurrency(stats.totalDue || 0, currency),
      label: 'Amount Due',
      color: 'orange',
    },
  )

  return cards
}

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
    approved: ['received', 'cancelled'],
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
    approved: 'received',
  }

  return nextStatusMap[currentStatus] || null
}

export const getStatusLabel = (status: string): string => {
  const labelMap: Record<string, string> = {
    draft: 'Draft',
    pending: 'Pending Approval',
    approved: 'Approved',
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
      actions.push('Edit', 'Approve', 'Reject', 'Cancel')
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

