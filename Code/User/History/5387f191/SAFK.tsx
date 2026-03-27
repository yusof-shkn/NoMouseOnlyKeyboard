// src/features/purchases/components/CompletePurchaseModal.tsx

import React, { useEffect, useState } from 'react'
import {
  Modal,
  Stack,
  Group,
  Text,
  Button,
  Checkbox,
  Paper,
  Divider,
  Badge,
  Box,
  UnstyledButton,
  TextInput,
  useMantineTheme,
  useMantineColorScheme,
} from '@mantine/core'
import {
  IconShoppingCart,
  IconCheck,
  IconCash,
  IconCreditCard,
  IconBuildingBank,
  IconWallet,
  IconDeviceMobile,
  IconFileInvoice,
  IconAlertCircle,
} from '@tabler/icons-react'
import type { PaymentMethodOption, PurchaseTotals } from '../types'

// ─── Icon Map ────────────────────────────────────────────────────────────────
const PAYMENT_ICONS: Record<string, React.ReactNode> = {
  cash: <IconCash size={20} />,
  card: <IconCreditCard size={20} />,
  bank_transfer: <IconBuildingBank size={20} />,
  credit: <IconWallet size={20} />,
  mobile_money: <IconDeviceMobile size={20} />,
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface CompletePurchaseModalProps {
  opened: boolean
  onClose: () => void
  onConfirm: (receiveInvoiceNumber?: string) => void

  // order context
  totals: PurchaseTotals
  currency: string
  isAdmin: boolean
  isSubmitting: boolean
  editMode: boolean
  invoiceNumber: string // the POP-level invoice # (may be empty)
  orderItemsCount: number

  // payment
  paymentMethods: PaymentMethodOption[]
  selectedPayment: string
  onSelectPayment: (value: string) => void

  // receive immediately
  receiveImmediately: boolean
  onToggleReceiveImmediately: (value: boolean) => void
}

// ─── Payment Method Button ────────────────────────────────────────────────────
const PaymentMethodButton: React.FC<{
  method: PaymentMethodOption
  isSelected: boolean
  onSelect: () => void
  isDark: boolean
  primaryColor: string
}> = ({ method, isSelected, onSelect, isDark, primaryColor }) => {
  const theme = useMantineTheme()

  return (
    <UnstyledButton
      onClick={onSelect}
      style={{
        flex: 1,
        padding: '10px 8px',
        borderRadius: theme.radius.md,
        border: `2px solid ${
          isSelected
            ? (theme.colors[primaryColor]?.[6] ?? theme.colors.blue[6])
            : isDark
              ? theme.colors.dark[4]
              : theme.colors.gray[3]
        }`,
        backgroundColor: isSelected
          ? isDark
            ? (theme.colors[primaryColor]?.[9] ?? theme.colors.blue[9])
            : (theme.colors[primaryColor]?.[0] ?? theme.colors.blue[0])
          : isDark
            ? theme.colors.dark[6]
            : theme.white,
        transition: 'all 0.15s ease',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        cursor: 'pointer',
      }}
    >
      <Box
        style={{
          color: isSelected
            ? (theme.colors[primaryColor]?.[6] ?? theme.colors.blue[6])
            : isDark
              ? theme.colors.dark[2]
              : theme.colors.gray[6],
        }}
      >
        {PAYMENT_ICONS[method.value] ?? (
          <span style={{ fontSize: 18 }}>{method.icon}</span>
        )}
      </Box>
      <Text
        size="xs"
        fw={isSelected ? 700 : 400}
        c={
          isSelected
            ? isDark
              ? (theme.colors[primaryColor]?.[3] ?? 'blue.3')
              : `${primaryColor}.7`
            : 'dimmed'
        }
        ta="center"
        style={{ lineHeight: 1.2 }}
      >
        {method.label}
      </Text>
    </UnstyledButton>
  )
}

// ─── Modal ────────────────────────────────────────────────────────────────────
export const CompletePurchaseModal: React.FC<CompletePurchaseModalProps> = ({
  opened,
  onClose,
  onConfirm,
  totals,
  currency,
  isAdmin,
  isSubmitting,
  editMode,
  invoiceNumber,
  orderItemsCount,
  paymentMethods,
  selectedPayment,
  onSelectPayment,
  receiveImmediately,
  onToggleReceiveImmediately,
}) => {
  const theme = useMantineTheme()
  const { colorScheme } = useMantineColorScheme()
  const isDark = colorScheme === 'dark'
  const primary = theme.primaryColor

  // ── Invoice number state (only required when receiveImmediately = true) ──
  const [receiveInvoiceNumber, setReceiveInvoiceNumber] =
    useState(invoiceNumber)
  const [invoiceError, setInvoiceError] = useState('')

  // Sync with the POP-level invoice when modal opens or invoiceNumber changes
  useEffect(() => {
    if (opened) {
      setReceiveInvoiceNumber(invoiceNumber)
      setInvoiceError('')
    }
  }, [opened, invoiceNumber])

  // Clear error when user types
  useEffect(() => {
    if (receiveInvoiceNumber.trim()) {
      setInvoiceError('')
    }
  }, [receiveInvoiceNumber])

  // When receiveImmediately is toggled off, clear the error
  useEffect(() => {
    if (!receiveImmediately) {
      setInvoiceError('')
    }
  }, [receiveImmediately])

  const handleConfirm = () => {
    if (receiveImmediately) {
      if (!receiveInvoiceNumber.trim()) {
        setInvoiceError('Supplier invoice number is required to receive goods')
        return
      }
    }
    onConfirm(receiveImmediately ? receiveInvoiceNumber.trim() : undefined)
  }

  const submitLabel = editMode
    ? receiveImmediately
      ? 'Update & Receive'
      : 'Update Order'
    : receiveImmediately
      ? 'Create & Receive'
      : 'Create Order'

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <IconShoppingCart
            size={20}
            color={theme.colors[primary]?.[6] ?? theme.colors.blue[6]}
          />
          <Text
            fw={600}
            size="md"
          >
            Complete Purchase
          </Text>
          {invoiceNumber && (
            <Badge
              size="sm"
              variant="light"
              color={primary}
            >
              {invoiceNumber}
            </Badge>
          )}
        </Group>
      }
      centered
      size="lg"
      radius="lg"
      padding="lg"
      styles={{
        content: {
          backgroundColor: isDark ? theme.colors.dark[7] : theme.white,
        },
        header: {
          backgroundColor: isDark ? theme.colors.dark[7] : theme.white,
          borderBottom: `1px solid ${isDark ? theme.colors.dark[5] : theme.colors.gray[2]}`,
          paddingBottom: 12,
          marginBottom: 0,
        },
      }}
    >
      <Stack
        gap="md"
        pt="xs"
      >
        {/* ── Order Summary ─────────────────────────────────────────── */}
        <Paper
          p="sm"
          radius="md"
          style={{
            backgroundColor: isDark
              ? theme.colors.dark[6]
              : theme.colors.gray[0],
            border: `1px solid ${isDark ? theme.colors.dark[4] : theme.colors.gray[2]}`,
          }}
        >
          <Stack gap={6}>
            <Group justify="space-between">
              <Text
                size="xs"
                c="dimmed"
              >
                Items
              </Text>
              <Text
                size="xs"
                fw={500}
              >
                {orderItemsCount}
              </Text>
            </Group>
            <Group justify="space-between">
              <Text
                size="xs"
                c="dimmed"
              >
                Subtotal
              </Text>
              <Text
                size="xs"
                fw={500}
              >
                {currency}{' '}
                {totals.subTotal.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                })}
              </Text>
            </Group>
            {totals.tax > 0 && (
              <Group justify="space-between">
                <Text
                  size="xs"
                  c="dimmed"
                >
                  Tax ({totals.taxPercentage}%)
                </Text>
                <Text
                  size="xs"
                  fw={500}
                >
                  {currency}{' '}
                  {totals.tax.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                  })}
                </Text>
              </Group>
            )}
            {totals.discount > 0 && (
              <Group justify="space-between">
                <Text
                  size="xs"
                  c="dimmed"
                >
                  Discount
                </Text>
                <Text
                  size="xs"
                  fw={500}
                  c="green"
                >
                  − {currency}{' '}
                  {totals.discount.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                  })}
                </Text>
              </Group>
            )}
            {totals.shipping > 0 && (
              <Group justify="space-between">
                <Text
                  size="xs"
                  c="dimmed"
                >
                  Shipping
                </Text>
                <Text
                  size="xs"
                  fw={500}
                >
                  {currency}{' '}
                  {totals.shipping.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                  })}
                </Text>
              </Group>
            )}
            <Divider my={4} />
            <Group justify="space-between">
              <Text
                size="sm"
                fw={700}
              >
                Total
              </Text>
              <Text
                size="sm"
                fw={700}
                c={theme.colors[primary]?.[6] ?? 'blue'}
              >
                {currency}{' '}
                {totals.grandTotal.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                })}
              </Text>
            </Group>
          </Stack>
        </Paper>

        {/* ── Payment Method ────────────────────────────────────────── */}
        <Stack gap={8}>
          <Text
            size="xs"
            fw={600}
            c="dimmed"
            tt="uppercase"
            style={{ letterSpacing: '0.05em' }}
          >
            Payment Method
          </Text>
          <Group
            gap={6}
            grow
          >
            {paymentMethods.map((method) => (
              <PaymentMethodButton
                key={method.value}
                method={method}
                isSelected={selectedPayment === method.value}
                onSelect={() => onSelectPayment(method.value)}
                isDark={isDark}
                primaryColor={primary}
              />
            ))}
          </Group>
        </Stack>

        {/* ── Receive Immediately ───────────────────────────────────── */}
        <Paper
          p="sm"
          radius="md"
          style={{
            border: `1px solid ${
              receiveImmediately
                ? theme.colors.green[isDark ? 8 : 4]
                : isDark
                  ? theme.colors.dark[4]
                  : theme.colors.gray[3]
            }`,
            backgroundColor: receiveImmediately
              ? isDark
                ? theme.colors.green[9]
                : theme.colors.green[0]
              : isDark
                ? theme.colors.dark[6]
                : theme.white,
            transition: 'all 0.2s ease',
            opacity: isAdmin ? 1 : 0.5,
          }}
        >
          <Stack gap="sm">
            <Checkbox
              label={
                <Stack gap={2}>
                  <Text
                    size="sm"
                    fw={500}
                  >
                    Receive goods immediately
                  </Text>
                  <Text
                    size="xs"
                    c="dimmed"
                  >
                    {isAdmin
                      ? 'Inventory will be updated instantly — skips approval flow'
                      : 'Only administrators can receive goods immediately'}
                  </Text>
                </Stack>
              }
              checked={receiveImmediately}
              onChange={(e) =>
                onToggleReceiveImmediately(e.currentTarget.checked)
              }
              disabled={!isAdmin}
              size="sm"
              color="green"
            />

            {/* ── Invoice input — only shown when receiveImmediately is on ── */}
            {receiveImmediately && isAdmin && (
              <TextInput
                placeholder="e.g. INV-2024-00123"
                label="Supplier Invoice Number"
                description="Required to record receipt of goods"
                value={receiveInvoiceNumber}
                onChange={(e) => setReceiveInvoiceNumber(e.currentTarget.value)}
                leftSection={<IconFileInvoice size={16} />}
                error={invoiceError}
                required
                styles={{
                  label: { fontWeight: 600, marginBottom: 4 },
                  input: {
                    fontFamily: theme.fontFamilyMonospace,
                    fontWeight: 500,
                    backgroundColor: isDark
                      ? theme.colors.dark[7]
                      : theme.white,
                  },
                }}
              />
            )}
          </Stack>
        </Paper>

        {/* ── Actions ───────────────────────────────────────────────── */}
        <Group
          gap="sm"
          mt={4}
        >
          <Button
            variant="light"
            color="gray"
            flex={1}
            onClick={onClose}
            disabled={isSubmitting}
            radius="md"
          >
            Back
          </Button>
          <Button
            flex={2}
            color={receiveImmediately ? 'green' : primary}
            loading={isSubmitting}
            onClick={handleConfirm}
            radius="md"
            leftSection={
              receiveImmediately ? (
                <IconShoppingCart size={16} />
              ) : (
                <IconCheck size={16} />
              )
            }
          >
            {submitLabel}
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}

export default CompletePurchaseModal

