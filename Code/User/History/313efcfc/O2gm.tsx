// Config.tsx — Purchase Orders History
// ✅ REFACTORED: Uses shared TableCell components

import {
  Group,
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
  IconCircleCheck,
  IconUser,
} from '@tabler/icons-react'
import { formatCurrency, formatDate } from '@shared/utils/formatters'
import { isPurchaseApprovalRequired } from './utils/companySettingsUtils'
import type { CompanySettings } from '@shared/types/companySettings'
import {
  PrimaryIdCell,
  TextCell,
  DateCell,
  CurrencyCell,
  BadgeCell,
  PaymentMethodCell,
  StatusDotCell,
  type StatusDotConfig,
} from '@shared/components/tableCell'
import { PurchaseOrder } from '@shared/types/purchaseOrders'

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

// ─── Purchase-order-specific status maps ───────────────────────────────────
// NOTE: These are DIFFERENT from sales payment statuses. Purchase orders use
// supplier-side terminology: "unpaid" / "partial" / "paid" / "overdue".
// Sales uses buyer-side: "pending" / "partially_paid" / "paid" / "refunded".
// They must NOT share a map.

const PO_STATUS_MAP: Record<string, StatusDotConfig> = {
  draft:               { dot: 'var(--mantine-color-gray-5)',   text: 'var(--mantine-color-gray-7)',   label: 'Draft' },
  pending:             { dot: 'var(--mantine-color-yellow-6)', text: 'var(--mantine-color-yellow-8)', label: 'Pending Approval' },
  approved:            { dot: 'var(--mantine-color-cyan-5)',   text: 'var(--mantine-color-cyan-7)',   label: 'Approved' },
  partially_received:  { dot: 'var(--mantine-color-teal-5)',   text: 'var(--mantine-color-teal-7)',   label: 'Partially Received' },
  received:            { dot: 'var(--mantine-color-green-6)',  text: 'var(--mantine-color-green-8)',  label: 'Received' },
  rejected:            { dot: 'var(--mantine-color-red-5)',    text: 'var(--mantine-color-red-7)',    label: 'Rejected' },
  cancelled:           { dot: 'var(--mantine-color-gray-4)',   text: 'var(--mantine-color-gray-6)',   label: 'Cancelled' },
  returned:            { dot: 'var(--mantine-color-grape-5)',  text: 'var(--mantine-color-grape-7)',  label: 'Returned' },
}

/**
 * Purchase-order payment status.
 * Intentionally separate from SALES payment status:
 *  - PO is supplier-facing; key statuses are unpaid/partial/paid/overdue
 *  - Sales is customer-facing; uses pending/partially_paid/paid/refunded
 */
const PO_PAYMENT_STATUS_MAP: Record<string, StatusDotConfig> = {
  unpaid:   { dot: 'var(--mantine-color-red-5)',    text: 'var(--mantine-color-red-7)',    label: 'Unpaid' },
  partial:  { dot: 'var(--mantine-color-orange-5)', text: 'var(--mantine-color-orange-7)', label: 'Partial' },
  paid:     { dot: 'var(--mantine-color-green-6)',  text: 'var(--mantine-color-green-8)',  label: 'Paid' },
  overdue:  { dot: 'var(--mantine-color-red-7)',    text: 'var(--mantine-color-red-9)',    label: 'Overdue' },
}

// ============================================================
// COLUMN DEFINITIONS
// ============================================================

export const getPurchaseOrdersColumns = (currency: string) => {
  const allColumns = [
    // ── PO Number ────────────────────────────────────────────
    {
      header: 'PO Number',
      accessor: 'po_number',
      render: (row: PurchaseOrder) => (
        <PrimaryIdCell value={row.po_number} fallback="N/A" />
      ),
    },

    // ── Invoice Number ───────────────────────────────────────
    {
      header: 'Invoice #',
      accessor: 'invoice_number',
      render: (row: PurchaseOrder) => (
        <TextCell value={row.invoice_number} fallback="—" color="dimmed" />
      ),
    },

    // ── Supplier ─────────────────────────────────────────────
    {
      header: 'Supplier',
      accessor: 'supplier_name',
      render: (row: PurchaseOrder) => (
        <TextCell value={row.supplier_name} fallback="Unknown Supplier" fw={500} color="body" />
      ),
    },

    // ── Store ────────────────────────────────────────────────
    {
      header: 'Store',
      accessor: 'store_name',
      render: (row: PurchaseOrder) => (
        <TextCell value={row.store_name} fallback="No Store" color="dimmed" size="xs" />
      ),
    },

    // ── PO Date ──────────────────────────────────────────────
    {
      header: 'PO Date',
      accessor: 'po_date',
      render: (row: PurchaseOrder) => (
        <DateCell
          value={row.po_date}
          formatted={row.po_date ? formatDate(row.po_date) : undefined}
          fallback="N/A"
        />
      ),
    },

    // ── Expected Delivery ────────────────────────────────────
    {
      header: 'Expected Delivery',
      accessor: 'expected_delivery_date',
      render: (row: PurchaseOrder) => (
        <DateCell
          value={row.expected_delivery_date}
          formatted={row.expected_delivery_date ? formatDate(row.expected_delivery_date) : undefined}
          fallback="Not Set"
        />
      ),
    },

    // ── PO Status ────────────────────────────────────────────
    {
      header: 'Status',
      accessor: 'status',
      render: (row: PurchaseOrder) => (
        <StatusDotCell
          statusKey={row.status ?? 'draft'}
          statusMap={PO_STATUS_MAP}
          fallback={PO_STATUS_MAP.draft}
        />
      ),
    },

    // ── Total ────────────────────────────────────────────────
    {
      header: 'Total',
      accessor: 'total_amount',
      render: (row: PurchaseOrder) => (
        <CurrencyCell
          value={parseFloat(row.total_amount) || 0}
          formatted={formatCurrency(parseFloat(row.total_amount) || 0, currency)}
          fw={700}
          color="primary"
        />
      ),
    },

    // ── Paid ─────────────────────────────────────────────────
    {
      header: 'Paid',
      accessor: 'paid_amount',
      render: (row: PurchaseOrder) => (
        <CurrencyCell
          value={parseFloat(row.paid_amount) || 0}
          formatted={formatCurrency(parseFloat(row.paid_amount) || 0, currency)}
          fw={600}
          color="success"
        />
      ),
    },

    // ── Due ──────────────────────────────────────────────────
    {
      header: 'Due',
      accessor: 'due_amount',
      render: (row: PurchaseOrder) => (
        <CurrencyCell
          value={parseFloat(row.due_amount) || 0}
          formatted={formatCurrency(parseFloat(row.due_amount) || 0, currency)}
          fw={600}
          color="danger"
        />
      ),
    },

    // ── Payment Status ───────────────────────────────────────
    // Uses PO-specific map — distinct from Sales payment status
    {
      header: 'Payment Status',
      accessor: 'payment_status',
      render: (row: PurchaseOrder) => (
        <StatusDotCell
          statusKey={row.payment_status ?? 'unpaid'}
          statusMap={PO_PAYMENT_STATUS_MAP}
          fallback={PO_PAYMENT_STATUS_MAP.unpaid}
        />
      ),
    },

    // ── Payment Method ───────────────────────────────────────
    {
      header: 'Payment Method',
      accessor: 'payment_method',
      render: (row: PurchaseOrder) => (
        <PaymentMethodCell method={row.payment_method as string | null} />
      ),
    },

    // ── Created By ───────────────────────────────────────────
    {
      header: 'Created By',
      accessor: 'created_by_name',
      render: (row: PurchaseOrder) => (
        row.created_by_name ? (
          <Group gap={6} wrap="nowrap">
            <IconUser size={14} style={{ flexShrink: 0 }} />
            <TextCell value={row.created_by_name} color="body" />
          </Group>
        ) : (
          <TextCell value={null} fallback="—" color="dimmed" />
        )
      ),
    },

    // ── Approved By ──────────────────────────────────────────
    {
      header: 'Approved By',
      accessor: 'approved_by_name',
      render: (row: PurchaseOrder) => (
        row.approved_by_name ? (
          <Group gap={6} wrap="nowrap">
            <IconUser size={14} color="var(--mantine-color-teal-6)" style={{ flexShrink: 0 }} />
            <TextCell value={row.approved_by_name} color="body" />
          </Group>
        ) : (
          <TextCell value={null} fallback="—" color="dimmed" />
        )
      ),
    },

    // ── Received By ──────────────────────────────────────────
    {
      header: 'Received By',
      accessor: 'received_by_name',
      render: (row: PurchaseOrder) => (
        row.received_by_name ? (
          <Group gap={6} wrap="nowrap">
            <IconUser size={14} color="var(--mantine-color-blue-6)" style={{ flexShrink: 0 }} />
            <TextCell value={row.received_by_name} color="body" />
          </Group>
        ) : (
          <TextCell value={null} fallback="—" color="dimmed" />
        )
      ),
    },
  ]

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
}) => [
  { title: 'Export PDF',   icon: <IconFileText        size={20} />, color: 'red',   onClick: handlers.onExportPDF   },
  { title: 'Export Excel', icon: <IconFileSpreadsheet size={20} />, color: 'green', onClick: handlers.onExportExcel },
  { title: 'Refresh',      icon: <IconRefresh         size={20} />, color: 'gray',  onClick: handlers.onRefresh     },
]

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

  const allActions = [
    {
      label: 'View',
      onClick: handlers.onView,
      icon: <IconEye size={16} />,
      color: 'gray',
      condition: () => true,
    },
    {
      label: 'Edit',
      onClick: handlers.onEdit,
      icon: <IconEdit size={16} />,
      color: 'blue',
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
      condition: (row: PurchaseOrder) => requiresApproval && row.status === 'pending',
    },
    {
      label: 'Receive Goods',
      onClick: handlers.onReceive || (() => {}),
      icon: <IconPackage size={16} />,
      color: 'blue',
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
      condition: (row: PurchaseOrder) => requiresApproval && row.status === 'pending',
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
