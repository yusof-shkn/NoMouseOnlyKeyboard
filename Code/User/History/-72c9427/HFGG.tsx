// SalesReturnView.tsx — Detail view modal for a Sales Return
import {
  Text,
  Badge,
  Group,
  Stack,
  Paper,
  Divider,
  useMantineTheme,
  useMantineColorScheme,
  SimpleGrid,
  ThemeIcon,
  Table,
  Box,
} from '@mantine/core'
import {
  IconArrowBackUp,
  IconUser,
  IconCurrencyDollar,
  IconCalendar,
  IconNotes,
  IconCircleCheck,
  IconClock,
  IconPackage,
  IconReceipt,
} from '@tabler/icons-react'
import { formatDate } from '@shared/utils/formatters'
import { SalesReturn, SalesReturnItem } from '../types/salesReturn.types'

interface SalesReturnViewProps {
  salesReturn: SalesReturn & {
    items?: SalesReturnItem[]
    sales_return_items?: SalesReturnItem[]
  }
  settings?: any
}

const formatCurrency = (amount: number, currency = 'UGX'): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount || 0)

const InfoRow = ({
  label,
  value,
  color,
}: {
  label: string
  value: React.ReactNode
  color?: string
}) => (
  <Stack gap={2}>
    <Text
      size="xs"
      c="dimmed"
      tt="uppercase"
      fw={500}
    >
      {label}
    </Text>
    {typeof value === 'string' || typeof value === 'number' ? (
      <Text
        size="sm"
        fw={500}
        c={color}
      >
        {value || '—'}
      </Text>
    ) : (
      value || (
        <Text
          size="sm"
          c="dimmed"
        >
          —
        </Text>
      )
    )}
  </Stack>
)

const statusColors: Record<string, string> = {
  pending: 'yellow',
  approved: 'blue',
  completed: 'green',
  cancelled: 'red',
  partially_returned: 'orange',
  returned: 'grape',
}

const paymentStatusColors: Record<string, string> = {
  paid: 'green',
  partial: 'yellow',
  pending: 'orange',
}

export const SalesReturnView = ({
  salesReturn,
  settings,
}: SalesReturnViewProps) => {
  const theme = useMantineTheme()
  const { colorScheme } = useMantineColorScheme()
  const isDark = colorScheme === 'dark'
  const currency = settings?.default_currency || 'UGX'

  if (!salesReturn) {
    return (
      <Text
        c="dimmed"
        ta="center"
        py="xl"
      >
        No return data available
      </Text>
    )
  }

  const items = salesReturn.items || salesReturn.sales_return_items || []

  return (
    <Stack gap="md">
      {/* Header */}
      <Paper
        p="md"
        withBorder
      >
        <Group gap="md">
          <ThemeIcon
            size={48}
            radius="xl"
            variant="light"
            color="grape"
          >
            <IconArrowBackUp size={24} />
          </ThemeIcon>
          <Stack gap={4}>
            <Text
              size="lg"
              fw={700}
            >
              {salesReturn.return_number}
            </Text>
            <Group gap="xs">
              <Badge
                variant="light"
                color={statusColors[salesReturn.status] || 'gray'}
                size="sm"
                leftSection={
                  salesReturn.status === 'completed' ? (
                    <IconCircleCheck size={12} />
                  ) : (
                    <IconClock size={12} />
                  )
                }
              >
                {salesReturn.status?.toUpperCase()}
              </Badge>
              {salesReturn.payment_status && (
                <Badge
                  variant="light"
                  color={
                    paymentStatusColors[salesReturn.payment_status] || 'gray'
                  }
                  size="sm"
                >
                  {salesReturn.payment_status?.toUpperCase()}
                </Badge>
              )}
            </Group>
          </Stack>
        </Group>
      </Paper>

      {/* Return Details */}
      <Paper
        p="md"
        withBorder
      >
        <Group
          gap="xs"
          mb="sm"
        >
          <IconReceipt size={16} />
          <Text
            size="sm"
            fw={600}
          >
            Return Details
          </Text>
        </Group>
        <Divider mb="md" />
        <SimpleGrid
          cols={{ base: 1, sm: 2 }}
          spacing="md"
        >
          <InfoRow
            label="Return Date"
            value={formatDate(salesReturn.return_date)}
          />
          {salesReturn.sale_number && (
            <InfoRow
              label="Original Sale #"
              value={salesReturn.sale_number}
            />
          )}
          {salesReturn.sale_date && (
            <InfoRow
              label="Original Sale Date"
              value={formatDate(salesReturn.sale_date)}
            />
          )}
          <InfoRow
            label="Customer"
            value={salesReturn.customer_name || 'Walk-in Customer'}
          />
          {salesReturn.customer_phone && (
            <InfoRow
              label="Customer Phone"
              value={salesReturn.customer_phone}
            />
          )}
          <InfoRow
            label="Store"
            value={salesReturn.store_name}
          />
          <InfoRow
            label="Return Reason"
            value={salesReturn.return_reason}
          />
          <InfoRow
            label="Refund Method"
            value={salesReturn.refund_method?.replace('_', ' ').toUpperCase()}
          />
        </SimpleGrid>
      </Paper>

      {/* Items Table */}
      {items.length > 0 && (
        <Paper
          p="md"
          withBorder
        >
          <Group
            gap="xs"
            mb="sm"
          >
            <IconPackage size={16} />
            <Text
              size="sm"
              fw={600}
            >
              Returned Items ({items.length})
            </Text>
          </Group>
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
                  <Table.Th style={{ textAlign: 'right' }}>
                    Qty Returned
                  </Table.Th>
                  <Table.Th style={{ textAlign: 'right' }}>Unit Price</Table.Th>
                  <Table.Th style={{ textAlign: 'right' }}>
                    Refund Amount
                  </Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {items.map((item: SalesReturnItem, idx: number) => (
                  <Table.Tr key={item.id || idx}>
                    <Table.Td>{idx + 1}</Table.Td>
                    <Table.Td>
                      <Box>
                        <Text
                          size="sm"
                          fw={500}
                        >
                          {item.product_name || 'Unknown Product'}
                        </Text>
                        {item.generic_name && (
                          <Text
                            size="xs"
                            c="dimmed"
                          >
                            {item.generic_name}
                          </Text>
                        )}
                      </Box>
                    </Table.Td>
                    <Table.Td>
                      <Text
                        size="sm"
                        c="dimmed"
                      >
                        {item.batch_number || '—'}
                      </Text>
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>
                      <Text
                        size="sm"
                        fw={500}
                      >
                        {item.quantity_returned}
                      </Text>
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>
                      <Text size="sm">
                        {formatCurrency(item.unit_price || 0, currency)}
                      </Text>
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>
                      <Text
                        size="sm"
                        fw={600}
                        c={theme.primaryColor}
                      >
                        {formatCurrency(item.refund_amount || 0, currency)}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Box>
        </Paper>
      )}

      {/* Financial Summary */}
      <Paper
        p="md"
        withBorder
      >
        <Group
          gap="xs"
          mb="sm"
        >
          <IconCurrencyDollar size={16} />
          <Text
            size="sm"
            fw={600}
          >
            Financial Summary
          </Text>
        </Group>
        <Divider mb="md" />
        <Stack gap="sm">
          <Group justify="space-between">
            <Text
              size="lg"
              fw={700}
            >
              Total Refund Amount
            </Text>
            <Text
              size="lg"
              fw={700}
              c={theme.primaryColor}
            >
              {formatCurrency(salesReturn.total_refund_amount, currency)}
            </Text>
          </Group>
          {salesReturn.amount_paid != null && (
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
                {formatCurrency(salesReturn.amount_paid, currency)}
              </Text>
            </Group>
          )}
          {salesReturn.amount_due != null && salesReturn.amount_due > 0 && (
            <Group justify="space-between">
              <Text
                size="sm"
                c="dimmed"
              >
                Amount Due
              </Text>
              <Text
                size="md"
                fw={600}
                c="orange"
              >
                {formatCurrency(salesReturn.amount_due, currency)}
              </Text>
            </Group>
          )}
        </Stack>
      </Paper>

      {/* Audit Trail */}
      <Paper
        p="md"
        withBorder
        bg={isDark ? 'dark.6' : 'gray.0'}
      >
        <SimpleGrid
          cols={{ base: 1, sm: 2 }}
          spacing="md"
        >
          {salesReturn.processed_by_name && (
            <InfoRow
              label="Processed By"
              value={salesReturn.processed_by_name}
            />
          )}
          {salesReturn.approved_by_name && (
            <InfoRow
              label="Approved By"
              value={salesReturn.approved_by_name}
            />
          )}
          {salesReturn.approved_at && (
            <InfoRow
              label="Approved At"
              value={formatDate(salesReturn.approved_at)}
            />
          )}
          <InfoRow
            label="Created At"
            value={
              salesReturn.created_at
                ? formatDate(salesReturn.created_at)
                : undefined
            }
          />
        </SimpleGrid>
        {salesReturn.notes && (
          <>
            <Divider my="sm" />
            <Stack gap={4}>
              <Text
                size="xs"
                c="dimmed"
                tt="uppercase"
                fw={500}
              >
                Notes
              </Text>
              <Text
                size="sm"
                style={{ whiteSpace: 'pre-wrap' }}
              >
                {salesReturn.notes}
              </Text>
            </Stack>
          </>
        )}
      </Paper>
    </Stack>
  )
}

export default SalesReturnView

