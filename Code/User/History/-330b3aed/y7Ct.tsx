import { Box, Table } from '@mantine/core'
import {
  IconPackage,
  IconBuilding,
  IconCurrencyDollar,
  IconCalendar,
  IconNotes,
} from '@tabler/icons-react'
import { formatDate, formatCompactCurrency } from '@shared/utils/formatters'
import {
  DrawerHero,
  HeroBadge,
  DrawerSection,
  Field,
  FieldGrid,
  SummaryRow,
  DrawerTable,
  StatusPill,
  MetaFooter,
  EmptyState,
} from '@shared/components/drawerView/DrawerViewComponents'
import { Stack, Text } from '@mantine/core'

const fmt = (v: number, currency = 'UGX') =>
  formatCompactCurrency(v || 0, currency)

const orderStatusColors: Record<string, string> = {
  draft: 'gray',
  pending: 'yellow',
  approved: 'blue',
  ordered: 'indigo',
  received: 'green',
  partial: 'orange',
  cancelled: 'red',
}
const payStatusColors: Record<string, string> = {
  paid: 'green',
  unpaid: 'orange',
  partial: 'yellow',
  overdue: 'red',
}

// Accepts { po, currency } (from dispatch) OR { purchaseOrder, settings } (legacy)
export const PurchaseOrderView = ({
  po,
  purchaseOrder,
  currency,
  settings,
}: {
  po?: any
  purchaseOrder?: any
  currency?: string
  settings?: any
}) => {
  const order = po ?? purchaseOrder
  if (!order)
    return (
      <EmptyState
        message="No purchase order data available"
        icon={<IconPackage size={32} />}
      />
    )

  const curr = currency ?? settings?.default_currency ?? order.currency ?? 'UGX'
  const items = order.purchase_order_items ?? order.items ?? []
  const supplier = order.suppliers ?? order.supplier
  const store = order.stores?.store_name ?? order.store_name

  return (
    <Box>
      <DrawerHero
        icon={<IconPackage size={26} />}
        title={order.order_number ?? order.po_number ?? 'Purchase Order'}
        subtitle={order.order_date ? formatDate(order.order_date) : undefined}
        color="indigo"
        badges={
          <>
            <HeroBadge color={orderStatusColors[order.status] || 'gray'}>
              {order.status?.toUpperCase()}
            </HeroBadge>
            {order.payment_status && (
              <HeroBadge color={payStatusColors[order.payment_status]}>
                {order.payment_status?.toUpperCase()}
              </HeroBadge>
            )}
          </>
        }
      />

      {supplier && (
        <DrawerSection
          icon={<IconBuilding size={14} />}
          title="Supplier"
          accent="indigo"
        >
          <FieldGrid>
            <Field
              label="Supplier Name"
              value={supplier.supplier_name}
            />
            {supplier.contact_person && (
              <Field
                label="Contact"
                value={supplier.contact_person}
              />
            )}
            {supplier.phone && (
              <Field
                label="Phone"
                value={supplier.phone}
              />
            )}
            {supplier.email && (
              <Field
                label="Email"
                value={supplier.email}
              />
            )}
            {supplier.address && (
              <Field
                label="Address"
                value={supplier.address}
                span="full"
              />
            )}
          </FieldGrid>
        </DrawerSection>
      )}

      <DrawerSection
        icon={<IconCalendar size={14} />}
        title="Order Details"
        accent="blue"
      >
        <FieldGrid>
          <Field
            label="Order Date"
            value={order.order_date ? formatDate(order.order_date) : undefined}
          />
          {order.expected_delivery_date && (
            <Field
              label="Expected Delivery"
              value={formatDate(order.expected_delivery_date)}
            />
          )}
          {order.received_date && (
            <Field
              label="Received Date"
              value={formatDate(order.received_date)}
            />
          )}
          {order.payment_terms && (
            <Field
              label="Payment Terms"
              value={order.payment_terms}
            />
          )}
          {store && (
            <Field
              label="Store"
              value={store}
            />
          )}
          {order.reference_number && (
            <Field
              label="Reference #"
              value={order.reference_number}
              mono
            />
          )}
        </FieldGrid>
      </DrawerSection>

      <DrawerSection
        icon={<IconPackage size={14} />}
        title={`Items (${items.length})`}
        accent="cyan"
        noPadding
      >
        {items.length === 0 ? (
          <Box p="md">
            <EmptyState message="No items" />
          </Box>
        ) : (
          <DrawerTable
            headers={['Product', 'Qty', 'Unit Cost', 'Disc.', 'Total']}
            align={['left', 'right', 'right', 'right', 'right']}
            rows={items.map((item: any, i: number) => (
              <Table.Tr key={item.id ?? i}>
                <Table.Td style={{ maxWidth: 180 }}>
                  <Text
                    size="sm"
                    fw={500}
                    lineClamp={1}
                  >
                    {item.product_name ||
                      item.products?.product_name ||
                      'Unknown'}
                  </Text>
                  <Text
                    size="xs"
                    c="dimmed"
                    style={{ fontFamily: 'monospace' }}
                  >
                    {item.batch_number
                      ? `Batch: ${item.batch_number}`
                      : 'No batch'}
                    {item.generic_name || item.products?.generic_name
                      ? ` · ${item.generic_name || item.products?.generic_name}`
                      : ''}
                  </Text>
                </Table.Td>
                <Table.Td ta="right">
                  <Text
                    size="sm"
                    fw={500}
                  >
                    {item.quantity_ordered} {item.unit_short_code || ''}
                  </Text>
                  {item.quantity_received != null && (
                    <Text
                      size="xs"
                      c="green"
                    >
                      Rcvd: {item.quantity_received}
                    </Text>
                  )}
                </Table.Td>
                <Table.Td ta="right">
                  <Text size="sm">{fmt(item.unit_cost, curr)}</Text>
                </Table.Td>
                <Table.Td ta="right">
                  <Text
                    size="sm"
                    c="orange"
                  >
                    {(item.discount_amount ?? 0) > 0
                      ? fmt(item.discount_amount, curr)
                      : '—'}
                  </Text>
                </Table.Td>
                <Table.Td ta="right">
                  <Text
                    size="sm"
                    fw={600}
                  >
                    {fmt(item.total_cost, curr)}
                  </Text>
                </Table.Td>
              </Table.Tr>
            ))}
          />
        )}
      </DrawerSection>

      <DrawerSection
        icon={<IconCurrencyDollar size={14} />}
        title="Summary"
        accent="green"
      >
        <Stack gap="xs">
          <SummaryRow
            label="Subtotal"
            value={fmt(order.subtotal_amount ?? order.subtotal ?? 0, curr)}
          />
          {(order.discount_amount ?? 0) > 0 && (
            <SummaryRow
              label="Discount"
              value={`− ${fmt(order.discount_amount, curr)}`}
              color="orange"
            />
          )}
          {(order.tax_amount ?? 0) > 0 && (
            <SummaryRow
              label="Tax"
              value={fmt(order.tax_amount, curr)}
            />
          )}
          <SummaryRow
            label="Total"
            value={fmt(order.total_amount ?? 0, curr)}
            bold
            dividerAbove
            size="md"
          />
          {order.amount_paid != null && (
            <SummaryRow
              label="Amount Paid"
              value={fmt(order.amount_paid, curr)}
              color="green"
            />
          )}
          {order.amount_due != null && order.amount_due > 0 && (
            <SummaryRow
              label="Balance Due"
              value={fmt(order.amount_due, curr)}
              color="red"
            />
          )}
        </Stack>
      </DrawerSection>

      {order.notes && (
        <DrawerSection
          icon={<IconNotes size={14} />}
          title="Notes"
          accent="gray"
        >
          <Text
            size="sm"
            style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}
          >
            {order.notes}
          </Text>
        </DrawerSection>
      )}

      <MetaFooter
        storeName={store}
        createdBy={
          order.created_by_profile
            ? `${order.created_by_profile.first_name || ''} ${order.created_by_profile.last_name || ''}`.trim()
            : undefined
        }
        createdAt={order.created_at}
        updatedAt={order.updated_at}
        formatDate={formatDate}
      />
    </Box>
  )
}

export default PurchaseOrderView

