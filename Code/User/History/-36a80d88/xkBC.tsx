import { Box, Table } from '@mantine/core'
import {
  IconReceipt,
  IconUser,
  IconPill,
  IconCurrencyDollar,
  IconNotes,
  IconDownload,
  IconPrinter,
  IconShoppingCart,
} from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { formatDate, formatCompactCurrency } from '@shared/utils/formatters'
import { Sale, CompanySettings } from '../types/salesHistory.types'
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
import { ActionIcon, Group, Stack, Text } from '@mantine/core'

const fmt = (amount: number, settings: CompanySettings | null) =>
  formatCompactCurrency(amount, settings?.default_currency || 'UGX')

const statusColors: Record<string, string> = {
  pending: 'yellow',
  completed: 'green',
  cancelled: 'red',
  returned: 'grape',
}
const payStatusColors: Record<string, string> = {
  pending: 'orange',
  paid: 'green',
  partial: 'yellow',
}
const payMethodColors: Record<string, string> = {
  cash: 'green',
  card: 'blue',
  mobile: 'violet',
  credit: 'orange',
}
const saleTypeColors: Record<string, string> = {
  retail: 'blue',
  wholesale: 'green',
  online: 'violet',
}

interface Props {
  sale: Sale
  settings: CompanySettings | null
}

export const SaleView = ({ sale, settings }: Props) => {
  if (!sale)
    return (
      <EmptyState
        message="No sale data available"
        icon={<IconReceipt size={32} />}
      />
    )

  const handlePrint = () =>
    notifications.show({ title: 'Print', message: 'Opening print dialog…' })
  const handleDownload = async () => {
    notifications.show({
      id: 'inv',
      title: 'Generating Invoice',
      message: `Generating ${sale.sale_number}…`,
      loading: true,
      autoClose: false,
    })
    setTimeout(
      () =>
        notifications.update({
          id: 'inv',
          title: 'Downloaded',
          message: 'Invoice downloaded',
          color: 'green',
          loading: false,
          autoClose: 3000,
        }),
      1000,
    )
  }

  const saleItems = (sale as any).sale_items ?? []
  const payments = (sale as any).sale_payments ?? []
  const customer = (sale as any).customers
  const store = sale.store_name || (sale as any).stores?.store_name
  const profile = (sale as any).profiles
  const processedBy = profile?.first_name
    ? `${profile.first_name} ${profile.last_name}`
    : profile?.username

  return (
    <Box>
      <DrawerHero
        icon={<IconReceipt size={26} />}
        title={sale.sale_number}
        subtitle={formatDate(sale.sale_date)}
        color="blue"
        badges={
          <>
            <HeroBadge color={statusColors[sale.sale_status]}>
              {sale.sale_status?.toUpperCase()}
            </HeroBadge>
            <HeroBadge color={payStatusColors[sale.payment_status]}>
              {sale.payment_status?.toUpperCase()}
            </HeroBadge>
            <HeroBadge color={saleTypeColors[sale.sale_type]}>
              {sale.sale_type?.toUpperCase()}
            </HeroBadge>
          </>
        }
        actions={
          <Group gap="xs">
            <ActionIcon
              variant="white"
              size="md"
              radius="sm"
              onClick={handlePrint}
            >
              <IconPrinter size={15} />
            </ActionIcon>
            <ActionIcon
              variant="white"
              size="md"
              radius="sm"
              onClick={handleDownload}
            >
              <IconDownload size={15} />
            </ActionIcon>
          </Group>
        }
      />

      <DrawerSection
        icon={<IconCurrencyDollar size={14} />}
        title="Payment"
        accent="blue"
      >
        <FieldGrid>
          <Field
            label="Method"
            value={
              <StatusPill
                label={sale.payment_method?.toUpperCase() ?? '—'}
                color={payMethodColors[sale.payment_method] || 'gray'}
              />
            }
          />
          <Field
            label="Status"
            value={
              <StatusPill
                label={sale.payment_status?.toUpperCase() ?? '—'}
                color={payStatusColors[sale.payment_status] || 'gray'}
              />
            }
          />
          {sale.credit_due_date && (
            <Field
              label="Credit Due"
              value={formatDate(sale.credit_due_date)}
              color="orange"
            />
          )}
        </FieldGrid>
      </DrawerSection>

      {sale.customer_name && sale.customer_name !== 'Walk-in Customer' && (
        <DrawerSection
          icon={<IconUser size={14} />}
          title="Customer"
          accent="cyan"
        >
          <FieldGrid>
            <Field
              label="Name"
              value={sale.customer_name}
            />
            {customer?.phone && (
              <Field
                label="Phone"
                value={customer.phone}
              />
            )}
            {customer?.email && (
              <Field
                label="Email"
                value={customer.email}
              />
            )}
            {customer?.address && (
              <Field
                label="Address"
                value={customer.address}
                span="full"
              />
            )}
          </FieldGrid>
        </DrawerSection>
      )}

      {sale.prescriptions && (
        <DrawerSection
          icon={<IconPill size={14} />}
          title="Prescription"
          accent="teal"
        >
          <FieldGrid>
            <Field
              label="Prescription #"
              value={sale.prescriptions.prescription_number}
              mono
            />
            <Field
              label="Date"
              value={formatDate(sale.prescriptions.prescription_date)}
            />
            <Field
              label="Prescriber"
              value={sale.prescriptions.prescriber_name}
            />
            {sale.prescriptions.prescriber_license && (
              <Field
                label="License #"
                value={sale.prescriptions.prescriber_license}
                mono
              />
            )}
            {sale.prescriptions.patient_name && (
              <Field
                label="Patient"
                value={sale.prescriptions.patient_name}
              />
            )}
            <Field
              label="Verified"
              value={
                <StatusPill
                  label={
                    sale.prescriptions.is_verified ? 'Verified' : 'Not Verified'
                  }
                  color={sale.prescriptions.is_verified ? 'green' : 'orange'}
                />
              }
            />
            {sale.prescriptions.diagnosis && (
              <Field
                label="Diagnosis"
                value={sale.prescriptions.diagnosis}
                span="full"
              />
            )}
          </FieldGrid>
        </DrawerSection>
      )}

      <DrawerSection
        icon={<IconShoppingCart size={14} />}
        title={`Items (${saleItems.length})`}
        accent="indigo"
        noPadding
      >
        {saleItems.length === 0 ? (
          <Box p="md">
            <EmptyState message="No items" />
          </Box>
        ) : (
          <DrawerTable
            headers={['Product', 'Qty', 'Unit Price', 'Disc.', 'Total']}
            align={['left', 'right', 'right', 'right', 'right']}
            rows={saleItems.map((item: any, i: number) => (
              <Table.Tr key={item.id}>
                <Table.Td style={{ maxWidth: 180 }}>
                  <Text
                    size="sm"
                    fw={500}
                    lineClamp={1}
                  >
                    {item.products?.product_name || 'Unknown'}
                  </Text>
                  <Text
                    size="xs"
                    c="dimmed"
                    style={{ fontFamily: 'monospace' }}
                  >
                    {item.batch_number
                      ? `Batch: ${item.batch_number}`
                      : 'No batch'}
                    {item.products?.generic_name
                      ? ` · ${item.products.generic_name}`
                      : ''}
                  </Text>
                </Table.Td>
                <Table.Td ta="right">
                  <Text
                    size="sm"
                    fw={500}
                  >
                    {item.quantity} {item.unit_short_code || ''}
                  </Text>
                </Table.Td>
                <Table.Td ta="right">
                  <Text size="sm">{fmt(item.unit_price || 0, settings)}</Text>
                </Table.Td>
                <Table.Td ta="right">
                  <Text
                    size="sm"
                    c="orange"
                  >
                    {item.discount_amount > 0
                      ? fmt(item.discount_amount, settings)
                      : '—'}
                  </Text>
                </Table.Td>
                <Table.Td ta="right">
                  <Text
                    size="sm"
                    fw={600}
                  >
                    {fmt(item.total_price || 0, settings)}
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
            value={fmt(
              sale.subtotal_amount || (sale as any).subtotal || 0,
              settings,
            )}
          />
          {sale.discount_amount > 0 && (
            <SummaryRow
              label="Discount"
              value={`− ${fmt(sale.discount_amount, settings)}`}
              color="orange"
            />
          )}
          {sale.tax_amount > 0 && (
            <SummaryRow
              label="Tax"
              value={fmt(sale.tax_amount, settings)}
            />
          )}
          <SummaryRow
            label="Total"
            value={fmt(sale.total_amount || 0, settings)}
            bold
            dividerAbove
            size="md"
          />
          <SummaryRow
            label="Amount Paid"
            value={fmt(sale.amount_paid || 0, settings)}
            color="green"
          />
          {sale.payment_status === 'partial' && (
            <SummaryRow
              label="Balance Due"
              value={fmt(sale.total_amount - sale.amount_paid, settings)}
              color="red"
            />
          )}
        </Stack>
      </DrawerSection>

      {payments.length > 0 && (
        <DrawerSection
          icon={<IconReceipt size={14} />}
          title={`Payment History (${payments.length})`}
          accent="teal"
          noPadding
        >
          <DrawerTable
            headers={['Payment #', 'Date', 'Method', 'Reference', 'Amount']}
            align={['left', 'left', 'left', 'left', 'right']}
            rows={payments.map((p: any) => (
              <Table.Tr key={p.id}>
                <Table.Td>
                  <Text
                    size="sm"
                    fw={500}
                    style={{ fontFamily: 'monospace' }}
                  >
                    {p.payment_number}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{formatDate(p.payment_date)}</Text>
                </Table.Td>
                <Table.Td>
                  <StatusPill
                    label={p.payment_method?.toUpperCase()}
                    color={payMethodColors[p.payment_method] || 'gray'}
                    size="xs"
                  />
                </Table.Td>
                <Table.Td>
                  <Text
                    size="sm"
                    c="dimmed"
                  >
                    {p.payment_reference || '—'}
                  </Text>
                </Table.Td>
                <Table.Td ta="right">
                  <Text
                    size="sm"
                    fw={600}
                    c="green"
                  >
                    {fmt(p.payment_amount, settings)}
                  </Text>
                </Table.Td>
              </Table.Tr>
            ))}
          />
        </DrawerSection>
      )}

      {sale.notes && (
        <DrawerSection
          icon={<IconNotes size={14} />}
          title="Notes"
          accent="gray"
        >
          <Text
            size="sm"
            style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}
          >
            {sale.notes}
          </Text>
        </DrawerSection>
      )}

      <MetaFooter
        storeName={store}
        createdBy={processedBy}
        createdAt={sale.created_at}
        updatedAt={sale.updated_at}
        formatDate={formatDate}
      />
    </Box>
  )
}

export default SaleView

