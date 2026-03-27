// components/SaleViewModal.tsx - ENHANCED WITH THEMING

import {
  Grid,
  Text,
  Badge,
  Group,
  Stack,
  Paper,
  Divider,
  Table,
  Box,
  Button,
  useMantineTheme,
  useMantineColorScheme,
} from '@mantine/core'
import {
  IconUser,
  IconCalendar,
  IconCurrencyDollar,
  IconReceipt,
  IconMapPin,
  IconPhone,
  IconMail,
  IconNotes,
  IconPill,
  IconDownload,
  IconPrinter,
} from '@tabler/icons-react'
import { formatDate } from '@shared/utils/formatters'
import { Sale, CompanySettings } from '../types/salesHistory.types'
import { notifications } from '@mantine/notifications'

interface SaleViewModalProps {
  sale: Sale
  settings: CompanySettings | null
}

/**
 * Format currency with dynamic currency code from settings
 */
const formatCurrency = (
  amount: number,
  settings: CompanySettings | null,
): string => {
  const currency = settings?.default_currency || 'UGX'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)
}

/**
 * Get status badge color
 */
const getStatusColor = (status: string): string => {
  const colors: Record<string, string> = {
    pending: 'yellow',
    completed: 'green',
    cancelled: 'red',
    returned: 'grape',
  }
  return colors[status] || 'gray'
}

/**
 * Get payment status badge color
 */
const getPaymentStatusColor = (status: string): string => {
  const colors: Record<string, string> = {
    pending: 'orange',
    paid: 'green',
    partial: 'yellow',
  }
  return colors[status] || 'gray'
}

/**
 * Get payment method color
 */
const getPaymentMethodColor = (method: string): string => {
  const colors: Record<string, string> = {
    cash: 'green',
    card: 'blue',
    mobile: 'violet',
    credit: 'orange',
  }
  return colors[method] || 'gray'
}

/**
 * Get sale type color
 */
const getSaleTypeColor = (type: string): string => {
  const colors: Record<string, string> = {
    retail: 'blue',
    wholesale: 'green',
    online: 'violet',
  }
  return colors[type] || 'gray'
}

/**
 * Sale View Modal Content Component
 * Enhanced with Mantine theming and dark mode support
 */
export const SaleView = ({ sale, settings }: SaleViewModalProps) => {
  const theme = useMantineTheme()
  const { colorScheme } = useMantineColorScheme()

  if (!sale) {
    return (
      <Text
        c="dimmed"
        ta="center"
        py="xl"
      >
        No sale data available
      </Text>
    )
  }

  const handleDownloadInvoice = async () => {
    try {
      notifications.show({
        id: 'invoice-download',
        title: 'Generating Invoice',
        message: `Generating invoice for ${sale.sale_number}...`,
        loading: true,
        autoClose: false,
      })

      // TODO: Implement actual invoice generation
      setTimeout(() => {
        notifications.update({
          id: 'invoice-download',
          title: 'Invoice Downloaded',
          message: `Invoice for ${sale.sale_number} has been downloaded`,
          color: 'green',
          loading: false,
          autoClose: 3000,
        })
      }, 1000)
    } catch (error) {
      console.error('Failed to download invoice:', error)
      notifications.update({
        id: 'invoice-download',
        title: 'Download Failed',
        message: 'Failed to download invoice. Please try again.',
        color: 'red',
        loading: false,
        autoClose: 3000,
      })
    }
  }

  const handlePrintInvoice = () => {
    try {
      console.log('Print invoice for sale:', sale)
      notifications.show({
        title: 'Print',
        message: 'Opening print dialog...',
      })
    } catch (error) {
      console.error('Failed to print invoice:', error)
      notifications.show({
        title: 'Print Failed',
        message: 'Failed to print invoice. Please try again.',
        color: 'red',
      })
    }
  }

  return (
    <Stack gap="md">
      {/* Action Buttons */}
      <Group justify="flex-end">
        <Button
          leftSection={<IconPrinter size={16} />}
          variant="light"
          size="sm"
          onClick={handlePrintInvoice}
        >
          Print Invoice
        </Button>
        <Button
          leftSection={<IconDownload size={16} />}
          variant="filled"
          size="sm"
          onClick={handleDownloadInvoice}
        >
          Download Invoice
        </Button>
      </Group>

      {/* Sale Header Information */}
      <Paper
        p="md"
        withBorder
      >
        <Grid gutter="md">
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <Stack gap="xs">
              <Group gap="xs">
                <IconReceipt
                  size={16}
                  style={{ opacity: 0.6 }}
                />
                <Text
                  size="sm"
                  c="dimmed"
                >
                  Sale Number
                </Text>
              </Group>
              <Text
                size="md"
                fw={600}
              >
                {sale.sale_number}
              </Text>
            </Stack>
          </Grid.Col>

          <Grid.Col span={{ base: 12, sm: 6 }}>
            <Stack gap="xs">
              <Group gap="xs">
                <IconCalendar
                  size={16}
                  style={{ opacity: 0.6 }}
                />
                <Text
                  size="sm"
                  c="dimmed"
                >
                  Sale Date
                </Text>
              </Group>
              <Text
                size="md"
                fw={600}
              >
                {formatDate(sale.sale_date)}
              </Text>
            </Stack>
          </Grid.Col>

          <Grid.Col span={{ base: 12, sm: 6 }}>
            <Stack gap="xs">
              <Text
                size="sm"
                c="dimmed"
              >
                Sale Type
              </Text>
              <Badge
                color={getSaleTypeColor(sale.sale_type)}
                variant="light"
                size="md"
              >
                {sale.sale_type?.toUpperCase()}
              </Badge>
            </Stack>
          </Grid.Col>

          <Grid.Col span={{ base: 12, sm: 6 }}>
            <Stack gap="xs">
              <Text
                size="sm"
                c="dimmed"
              >
                Status
              </Text>
              <Badge
                color={getStatusColor(sale.sale_status)}
                variant="filled"
                size="md"
              >
                {sale.sale_status?.toUpperCase()}
              </Badge>
            </Stack>
          </Grid.Col>

          <Grid.Col span={{ base: 12, sm: 6 }}>
            <Stack gap="xs">
              <Text
                size="sm"
                c="dimmed"
              >
                Payment Method
              </Text>
              <Badge
                color={getPaymentMethodColor(sale.payment_method)}
                variant="light"
                size="md"
              >
                {sale.payment_method?.toUpperCase()}
              </Badge>
            </Stack>
          </Grid.Col>

          <Grid.Col span={{ base: 12, sm: 6 }}>
            <Stack gap="xs">
              <Text
                size="sm"
                c="dimmed"
              >
                Payment Status
              </Text>
              <Badge
                color={getPaymentStatusColor(sale.payment_status)}
                variant="light"
                size="md"
              >
                {sale.payment_status?.toUpperCase()}
              </Badge>
            </Stack>
          </Grid.Col>
        </Grid>
      </Paper>

      {/* Customer Information */}
      {sale.customer_name && sale.customer_name !== 'Walk-in Customer' && (
        <Paper
          p="md"
          withBorder
        >
          <Group
            gap="xs"
            mb="md"
          >
            <IconUser size={18} />
            <Text
              size="md"
              fw={600}
            >
              Customer Information
            </Text>
          </Group>
          <Divider mb="md" />
          <Grid gutter="md">
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <Stack gap="xs">
                <Text
                  size="sm"
                  c="dimmed"
                >
                  Name
                </Text>
                <Text
                  size="md"
                  fw={500}
                >
                  {sale.customer_name}
                </Text>
              </Stack>
            </Grid.Col>
            {(sale as any).customers?.phone && (
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <Stack gap="xs">
                  <Group gap="xs">
                    <IconPhone
                      size={14}
                      style={{ opacity: 0.6 }}
                    />
                    <Text
                      size="sm"
                      c="dimmed"
                    >
                      Phone
                    </Text>
                  </Group>
                  <Text size="md">{(sale as any).customers.phone}</Text>
                </Stack>
              </Grid.Col>
            )}
            {(sale as any).customers?.email && (
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <Stack gap="xs">
                  <Group gap="xs">
                    <IconMail
                      size={14}
                      style={{ opacity: 0.6 }}
                    />
                    <Text
                      size="sm"
                      c="dimmed"
                    >
                      Email
                    </Text>
                  </Group>
                  <Text size="md">{(sale as any).customers.email}</Text>
                </Stack>
              </Grid.Col>
            )}
            {(sale as any).customers?.address && (
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <Stack gap="xs">
                  <Group gap="xs">
                    <IconMapPin
                      size={14}
                      style={{ opacity: 0.6 }}
                    />
                    <Text
                      size="sm"
                      c="dimmed"
                    >
                      Address
                    </Text>
                  </Group>
                  <Text size="md">{(sale as any).customers.address}</Text>
                </Stack>
              </Grid.Col>
            )}
          </Grid>
        </Paper>
      )}

      {/* Prescription Information */}
      {sale.prescriptions && (
        <Paper
          p="md"
          withBorder
        >
          <Group
            gap="xs"
            mb="md"
          >
            <IconPill size={18} />
            <Text
              size="md"
              fw={600}
            >
              Prescription Information
            </Text>
          </Group>
          <Divider mb="md" />
          <Grid gutter="md">
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <Stack gap="xs">
                <Text
                  size="sm"
                  c="dimmed"
                >
                  Prescription Number
                </Text>
                <Text
                  size="md"
                  fw={500}
                >
                  {sale.prescriptions.prescription_number}
                </Text>
              </Stack>
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <Stack gap="xs">
                <Text
                  size="sm"
                  c="dimmed"
                >
                  Prescription Date
                </Text>
                <Text size="md">
                  {formatDate(sale.prescriptions.prescription_date)}
                </Text>
              </Stack>
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <Stack gap="xs">
                <Text
                  size="sm"
                  c="dimmed"
                >
                  Prescriber Name
                </Text>
                <Text size="md">{sale.prescriptions.prescriber_name}</Text>
              </Stack>
            </Grid.Col>
            {sale.prescriptions.prescriber_license && (
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <Stack gap="xs">
                  <Text
                    size="sm"
                    c="dimmed"
                  >
                    License Number
                  </Text>
                  <Text size="md">{sale.prescriptions.prescriber_license}</Text>
                </Stack>
              </Grid.Col>
            )}
            {sale.prescriptions.patient_name && (
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <Stack gap="xs">
                  <Text
                    size="sm"
                    c="dimmed"
                  >
                    Patient Name
                  </Text>
                  <Text size="md">{sale.prescriptions.patient_name}</Text>
                </Stack>
              </Grid.Col>
            )}
            {sale.prescriptions.diagnosis && (
              <Grid.Col span={12}>
                <Stack gap="xs">
                  <Text
                    size="sm"
                    c="dimmed"
                  >
                    Diagnosis
                  </Text>
                  <Text size="md">{sale.prescriptions.diagnosis}</Text>
                </Stack>
              </Grid.Col>
            )}
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <Stack gap="xs">
                <Text
                  size="sm"
                  c="dimmed"
                >
                  Verification Status
                </Text>
                <Badge
                  color={sale.prescriptions.is_verified ? 'green' : 'orange'}
                  variant="light"
                  size="sm"
                >
                  {sale.prescriptions.is_verified ? 'VERIFIED' : 'NOT VERIFIED'}
                </Badge>
              </Stack>
            </Grid.Col>
          </Grid>
        </Paper>
      )}

      {/* Sale Items */}
      <Paper
        p="md"
        withBorder
      >
        <Text
          size="md"
          fw={600}
          mb="md"
        >
          Items
        </Text>
        <Divider mb="md" />
        <Box style={{ overflowX: 'auto' }}>
          <Table
            striped
            highlightOnHover
          >
            <Table.Thead>
              <Table.Tr>
                <Table.Th>#</Table.Th>
                <Table.Th>Product</Table.Th>
                <Table.Th>Batch</Table.Th>
                <Table.Th style={{ textAlign: 'right' }}>Qty</Table.Th>
                <Table.Th style={{ textAlign: 'right' }}>Unit Price</Table.Th>
                <Table.Th style={{ textAlign: 'right' }}>Discount</Table.Th>
                <Table.Th style={{ textAlign: 'right' }}>Total</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {(sale as any).sale_items?.map((item: any, index: number) => (
                <Table.Tr key={item.id}>
                  <Table.Td>{index + 1}</Table.Td>
                  <Table.Td>
                    <Box>
                      <Text
                        size="sm"
                        fw={500}
                      >
                        {item.products?.product_name || 'Unknown Product'}
                      </Text>
                      {item.products?.generic_name && (
                        <Text
                          size="xs"
                          c="dimmed"
                          mt={2}
                        >
                          {item.products.generic_name}
                        </Text>
                      )}
                    </Box>
                  </Table.Td>
                  <Table.Td>
                    <Text
                      size="sm"
                      c="dimmed"
                    >
                      {item.batch_number || 'N/A'}
                    </Text>
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>
                    <Text
                      size="sm"
                      fw={500}
                    >
                      {item.quantity} {item.unit_short_code || ''}
                    </Text>
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>
                    <Text size="sm">
                      {formatCurrency(item.unit_price || 0, settings)}
                    </Text>
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>
                    <Text
                      size="sm"
                      c="orange"
                    >
                      {item.discount_amount > 0
                        ? formatCurrency(item.discount_amount, settings)
                        : '-'}
                    </Text>
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>
                    <Text
                      size="sm"
                      fw={600}
                    >
                      {formatCurrency(item.total_price || 0, settings)}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Box>
      </Paper>

      {/* Payment Summary */}
      <Paper
        p="md"
        withBorder
      >
        <Group
          gap="xs"
          mb="md"
        >
          <IconCurrencyDollar size={18} />
          <Text
            size="md"
            fw={600}
          >
            Payment Summary
          </Text>
        </Group>
        <Divider mb="md" />
        <Stack gap="sm">
          <Group justify="space-between">
            <Text
              size="sm"
              c="dimmed"
            >
              Subtotal
            </Text>
            <Text
              size="md"
              fw={500}
            >
              {formatCurrency(sale.subtotal_amount || (sale as any).subtotal || 0, settings)}
            </Text>
          </Group>

          {sale.discount_amount > 0 && (
            <Group justify="space-between">
              <Text
                size="sm"
                c="dimmed"
              >
                Discount
              </Text>
              <Text
                size="md"
                c="orange"
                fw={500}
              >
                - {formatCurrency(sale.discount_amount, settings)}
              </Text>
            </Group>
          )}

          {sale.tax_amount > 0 && (
            <Group justify="space-between">
              <Text
                size="sm"
                c="dimmed"
              >
                Tax
              </Text>
              <Text
                size="md"
                fw={500}
              >
                {formatCurrency(sale.tax_amount, settings)}
              </Text>
            </Group>
          )}

          <Divider my="xs" />

          <Group justify="space-between">
            <Text
              size="lg"
              fw={700}
            >
              Total Amount
            </Text>
            <Text
              size="lg"
              fw={700}
              c={theme.primaryColor}
            >
              {formatCurrency(sale.total_amount || 0, settings)}
            </Text>
          </Group>

          <Group justify="space-between">
            <Text
              size="sm"
              c="dimmed"
            >
              Amount Paid
            </Text>
            <Text
              size="md"
              fw={600}
              c="green"
            >
              {formatCurrency(sale.amount_paid || 0, settings)}
            </Text>
          </Group>

          {/* Show credit info if credit sale */}
          {sale.payment_method === 'credit' && sale.credit_due_date && (
            <>
              <Group justify="space-between">
                <Text
                  size="sm"
                  c="dimmed"
                >
                  Credit Amount
                </Text>
                <Text
                  size="md"
                  fw={600}
                  c="orange"
                >
                  {formatCurrency(
                    sale.credit_amount || sale.total_amount,
                    settings,
                  )}
                </Text>
              </Group>
              <Group justify="space-between">
                <Text
                  size="sm"
                  c="dimmed"
                >
                  Due Date
                </Text>
                <Text
                  size="md"
                  fw={500}
                  c="orange"
                >
                  {formatDate(sale.credit_due_date)}
                </Text>
              </Group>
            </>
          )}

          {/* Show balance if partial payment */}
          {sale.payment_status === 'partial' && (
            <Group justify="space-between">
              <Text
                size="sm"
                c="dimmed"
              >
                Balance Due
              </Text>
              <Text
                size="md"
                fw={600}
                c="red"
              >
                {formatCurrency(sale.total_amount - sale.amount_paid, settings)}
              </Text>
            </Group>
          )}
        </Stack>
      </Paper>

      {/* Payment History */}
      {(sale as any).sale_payments &&
        (sale as any).sale_payments.length > 0 && (
          <Paper
            p="md"
            withBorder
          >
            <Text
              size="md"
              fw={600}
              mb="md"
            >
              Payment History
            </Text>
            <Divider mb="md" />
            <Box style={{ overflowX: 'auto' }}>
              <Table striped>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Payment #</Table.Th>
                    <Table.Th>Date</Table.Th>
                    <Table.Th>Method</Table.Th>
                    <Table.Th>Reference</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>Amount</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {(sale as any).sale_payments.map((payment: any) => (
                    <Table.Tr key={payment.id}>
                      <Table.Td>
                        <Text
                          size="sm"
                          fw={500}
                        >
                          {payment.payment_number}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">
                          {formatDate(payment.payment_date)}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge
                          color={getPaymentMethodColor(payment.payment_method)}
                          variant="light"
                          size="sm"
                        >
                          {payment.payment_method?.toUpperCase()}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Text
                          size="sm"
                          c="dimmed"
                        >
                          {payment.payment_reference || '-'}
                        </Text>
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'right' }}>
                        <Text
                          size="sm"
                          fw={600}
                          c="green"
                        >
                          {formatCurrency(payment.payment_amount, settings)}
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Box>
          </Paper>
        )}

      {/* Notes */}
      {sale.notes && (
        <Paper
          p="md"
          withBorder
        >
          <Group
            gap="xs"
            mb="md"
          >
            <IconNotes size={18} />
            <Text
              size="md"
              fw={600}
            >
              Notes
            </Text>
          </Group>
          <Divider mb="md" />
          <Text
            size="sm"
            style={{ whiteSpace: 'pre-wrap' }}
          >
            {sale.notes}
          </Text>
        </Paper>
      )}

      {/* Store & Processed By Info */}
      <Paper
        p="md"
        withBorder
        bg={colorScheme === 'dark' ? 'dark.6' : 'gray.0'}
      >
        <Grid gutter="md">
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <Stack gap="xs">
              <Text
                size="xs"
                c="dimmed"
                tt="uppercase"
              >
                Store
              </Text>
              <Text
                size="sm"
                fw={500}
              >
                {sale.store_name ||
                  (sale as any).stores?.store_name ||
                  'Unknown Store'}
              </Text>
            </Stack>
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <Stack gap="xs">
              <Text
                size="xs"
                c="dimmed"
                tt="uppercase"
              >
                Processed By
              </Text>
              <Text
                size="sm"
                fw={500}
              >
                {(sale as any).profiles?.first_name &&
                (sale as any).profiles?.last_name
                  ? `${(sale as any).profiles.first_name} ${(sale as any).profiles.last_name}`
                  : (sale as any).profiles?.username || 'Unknown'}
              </Text>
            </Stack>
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <Stack gap="xs">
              <Text
                size="xs"
                c="dimmed"
                tt="uppercase"
              >
                Created At
              </Text>
              <Text size="sm">
                {sale.created_at ? formatDate(sale.created_at) : '-'}
              </Text>
            </Stack>
          </Grid.Col>
          {sale.updated_at && sale.updated_at !== sale.created_at && (
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <Stack gap="xs">
                <Text
                  size="xs"
                  c="dimmed"
                  tt="uppercase"
                >
                  Last Updated
                </Text>
                <Text size="sm">{formatDate(sale.updated_at)}</Text>
              </Stack>
            </Grid.Col>
          )}
        </Grid>
      </Paper>
    </Stack>
  )
}

export default SaleView
