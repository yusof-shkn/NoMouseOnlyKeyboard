// ConfirmDeleteSaleModal.tsx
// Replaces the browser confirm() dialog with a proper Mantine modal
import React, { useState } from 'react'
import {
  Stack,
  Text,
  Group,
  Button,
  Alert,
  Paper,
  ThemeIcon,
  Textarea,
  useMantineTheme,
  useMantineColorScheme,
} from '@mantine/core'
import {
  IconTrash,
  IconAlertTriangle,
  IconX,
  IconCreditCard,
} from '@tabler/icons-react'
import { formatCompactCurrency } from '@shared/utils/formatters'
import { useSelector } from 'react-redux'
import { selectDefaultCurrency } from '@features/authentication/authSlice'

interface ConfirmDeleteSaleModalProps {
  saleNumber?: string
  saleDate?: string
  totalAmount?: number
  paymentMethod?: string
}

export const ConfirmDeleteSaleModalContent: React.FC<
  ConfirmDeleteSaleModalProps
> = ({ saleNumber, saleDate, totalAmount, paymentMethod }) => {
  const currency = useSelector(selectDefaultCurrency)

  const theme = useMantineTheme()
  const { colorScheme } = useMantineColorScheme()
  const isDark = colorScheme === 'dark'
  const [deleteReason, setDeleteReason] = useState('')

  const handlers = (window as any).__deleteHandlers || {}
  const isCredit = paymentMethod === 'credit'

  const handleConfirm = () => {
    if (!deleteReason.trim()) return
    if (handlers.onConfirm) handlers.onConfirm(deleteReason.trim())
  }

  const handleCancel = () => {
    if (handlers.onCancel) handlers.onCancel()
  }

  const formattedDate = saleDate
    ? new Date(saleDate).toLocaleDateString('en-UG', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : '—'

  return (
    <Stack gap="lg">
      {/* Warning icon + message */}
      <Group
        gap="md"
        align="flex-start"
      >
        <ThemeIcon
          color="red"
          size={48}
          radius="xl"
          variant="light"
        >
          <IconTrash size={24} />
        </ThemeIcon>
        <Stack
          gap={4}
          style={{ flex: 1 }}
        >
          <Text
            fw={700}
            size="lg"
          >
            Delete Sale?
          </Text>
          <Text
            size="sm"
            c="dimmed"
          >
            This will permanently remove the sale record, restore all stock
            quantities, and void the linked accounting income record. This
            action cannot be undone.
          </Text>
        </Stack>
      </Group>

      {/* Sale details summary */}
      <Paper
        p="md"
        withBorder
        style={{
          backgroundColor: isDark ? theme.colors.dark[6] : theme.colors.gray[0],
          borderColor: isDark ? theme.colors.dark[4] : theme.colors.gray[3],
        }}
      >
        <Stack gap={8}>
          <Group justify="space-between">
            <Text
              size="sm"
              c="dimmed"
            >
              Sale Number
            </Text>
            <Text
              size="sm"
              fw={600}
            >
              {saleNumber || '—'}
            </Text>
          </Group>
          <Group justify="space-between">
            <Text
              size="sm"
              c="dimmed"
            >
              Sale Date
            </Text>
            <Text
              size="sm"
              fw={600}
            >
              {formattedDate}
            </Text>
          </Group>
          {totalAmount !== undefined && (
            <Group justify="space-between">
              <Text
                size="sm"
                c="dimmed"
              >
                Total Amount
              </Text>
              <Text
                size="sm"
                fw={600}
                c="red"
              >
                {formatCompactCurrency(totalAmount, currency)}
              </Text>
            </Group>
          )}
          {paymentMethod && (
            <Group justify="space-between">
              <Text
                size="sm"
                c="dimmed"
              >
                Payment Method
              </Text>
              <Text
                size="sm"
                fw={600}
                tt="capitalize"
              >
                {paymentMethod}
              </Text>
            </Group>
          )}
        </Stack>
      </Paper>

      {/* Credit warning */}
      {isCredit && (
        <Alert
          icon={<IconCreditCard size={16} />}
          color="orange"
          variant="light"
          title="Credit sale — balance will be reversed"
        >
          This is a credit sale. Deleting it will reverse the customer's credit
          balance and cancel the linked credit transaction.
        </Alert>
      )}

      {/* Stock/accounting warning */}
      <Alert
        icon={<IconAlertTriangle size={16} />}
        color="red"
        variant="light"
        title="The following will be reversed"
      >
        <Stack gap={4}>
          <Text size="xs">• Inventory quantities restored to all batches</Text>
          <Text size="xs">• Linked income record voided in accounting</Text>
          {isCredit && (
            <Text size="xs">
              • Customer credit balance reduced by sale amount
            </Text>
          )}
        </Stack>
      </Alert>

      {/* Delete reason — required */}
      <Textarea
        label="Reason for deletion"
        placeholder="Enter a reason why this sale is being deleted…"
        required
        minRows={2}
        value={deleteReason}
        onChange={(e) => setDeleteReason(e.currentTarget.value)}
      />

      {/* Action buttons */}
      <Group
        justify="flex-end"
        gap="sm"
      >
        <Button
          variant="default"
          leftSection={<IconX size={16} />}
          onClick={handleCancel}
        >
          Cancel
        </Button>
        <Button
          color="red"
          leftSection={<IconTrash size={16} />}
          onClick={handleConfirm}
          disabled={!deleteReason.trim()}
        >
          Yes, Delete Sale
        </Button>
      </Group>
    </Stack>
  )
}

export default ConfirmDeleteSaleModalContent

