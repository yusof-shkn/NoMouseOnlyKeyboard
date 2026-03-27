// components/RecordPurchasePaymentForm.tsx - UPDATED: uses PaymentMethodButton grid for payment selection

import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
  Stack,
  Text,
  NumberInput,
  Textarea,
  Button,
  Group,
  Paper,
  Grid,
  Divider,
  Badge,
  Alert,
  Box,
  UnstyledButton,
  useMantineTheme,
  useMantineColorScheme,
} from '@mantine/core'
import {
  IconCurrencyDollar,
  IconAlertCircle,
  IconCheck,
  IconReceipt,
  IconCash,
  IconCreditCard,
  IconBuildingBank,
  IconDeviceMobile,
  IconWallet,
} from '@tabler/icons-react'
import { formatCurrency } from '@shared/utils/formatters'
import { closeModal } from '@shared/components/genericModal/SliceGenericModal'
import { AppDispatch } from '@app/core/store/store'
import { selectCompanySettings } from '@features/authentication/authSlice'

// ─── Payment method options — must match values stored in purchase_orders.payment_method
const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash', icon: <IconCash size={20} /> },
  { value: 'card', label: 'Card', icon: <IconCreditCard size={20} /> },
  {
    value: 'bank_transfer',
    label: 'Bank Transfer',
    icon: <IconBuildingBank size={20} />,
  },
  {
    value: 'mobile_money',
    label: 'Mobile Money',
    icon: <IconDeviceMobile size={20} />,
  },
  { value: 'credit', label: 'Credit', icon: <IconWallet size={20} /> },
]

// ─── Payment Method Button (mirrors CompletePurchaseModal) ─────────────────────
const PaymentMethodButton: React.FC<{
  method: { value: string; label: string; icon: React.ReactNode }
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
        {method.icon}
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

// ─── Props ─────────────────────────────────────────────────────────────────────
interface RecordPurchasePaymentFormProps {
  purchaseOrderId: number
  poNumber: string
  supplierName: string
  supplierId: number
  totalAmount: number
  paidAmount: number
  dueAmount: number
  /** Payment method saved on the PO when it was created — pre-selects the button */
  defaultPaymentMethod?: string
}

export const RecordPurchasePaymentForm = ({
  purchaseOrderId,
  poNumber,
  supplierName,
  supplierId,
  totalAmount,
  paidAmount,
  dueAmount,
  defaultPaymentMethod = 'cash',
}: RecordPurchasePaymentFormProps) => {
  const dispatch = useDispatch<AppDispatch>()
  const theme = useMantineTheme()
  const { colorScheme } = useMantineColorScheme()

  const companySettings = useSelector(selectCompanySettings)
  const currency = companySettings?.default_currency || 'UGX'
  const isDark = colorScheme === 'dark'
  const primary = theme.primaryColor

  const [amount, setAmount] = useState<number>(dueAmount)
  const [paymentMethod, setPaymentMethod] = useState<string>(
    PAYMENT_METHODS.some((m) => m.value === defaultPaymentMethod)
      ? defaultPaymentMethod
      : 'cash',
  )
  const [notes, setNotes] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [loading, setLoading] = useState(false)

  const newPaidAmount = paidAmount + amount
  const newDueAmount = totalAmount - newPaidAmount
  const newStatus = newDueAmount <= 0.01 ? 'Fully Paid' : 'Partially Paid'

  const methodChanged = paymentMethod !== defaultPaymentMethod
  const originalMethodLabel =
    PAYMENT_METHODS.find((m) => m.value === defaultPaymentMethod)?.label ??
    defaultPaymentMethod

  const handleSubmit = async () => {
    if (!amount || amount <= 0) {
      setError('Payment amount must be greater than zero')
      return
    }

    if (amount > dueAmount) {
      setError(
        `Payment amount cannot exceed the amount due (${formatCurrency(dueAmount, currency)})`,
      )
      return
    }

    if (!paymentMethod) {
      setError('Please select a payment method')
      return
    }

    setError('')
    setLoading(true)

    try {
      const { handleMarkAsPaidConfirm } = await import(
        '../handlers/purchaseOrdersHistoryHandlers'
      )

      const purchaseOrderData = {
        id: purchaseOrderId,
        po_number: poNumber,
        supplier_id: supplierId,
        supplier_name: supplierName,
        total_amount: totalAmount,
        paid_amount: paidAmount,
        due_amount: dueAmount,
      }

      const paymentData = {
        amount,
        paymentMethod,
        notes,
      }

      const triggerRefresh = () => {
        window.dispatchEvent(new CustomEvent('purchaseOrderPaymentSuccess'))
      }

      await handleMarkAsPaidConfirm(
        purchaseOrderData,
        paymentData,
        triggerRefresh,
      )

      dispatch(closeModal())
    } catch (error: any) {
      console.error('Payment submission error:', error)
      setError(error.message || 'Failed to record payment')
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    dispatch(closeModal())
  }

  return (
    <Stack gap="md">
      {/* ── Order Summary ──────────────────────────────────────────────────── */}
      <Paper
        p="lg"
        withBorder
        style={{
          background: isDark
            ? theme.colors.dark[6]
            : `linear-gradient(135deg, ${theme.colors[theme.primaryColor][0]} 0%, ${theme.colors[theme.primaryColor][1]} 100%)`,
          borderColor: isDark
            ? theme.colors.dark[4]
            : theme.colors[theme.primaryColor][2],
          borderWidth: 2,
        }}
      >
        <Group mb="md">
          <IconReceipt
            size={32}
            style={{
              color: isDark
                ? theme.colors[theme.primaryColor][4]
                : theme.colors[theme.primaryColor][6],
            }}
          />
          <Box>
            <Text
              size="xs"
              c="dimmed"
              tt="uppercase"
              fw={700}
              style={{ letterSpacing: '0.5px' }}
            >
              Recording Payment For
            </Text>
            <Text
              size="lg"
              fw={700}
              style={{
                color: isDark
                  ? theme.colors[theme.primaryColor][4]
                  : theme.colors[theme.primaryColor][8],
              }}
            >
              {supplierName}
            </Text>
          </Box>
        </Group>

        <Divider
          my="md"
          color={
            isDark ? theme.colors.dark[4] : theme.colors[theme.primaryColor][2]
          }
        />

        <Grid>
          <Grid.Col span={6}>
            <Text
              size="xs"
              c="dimmed"
              tt="uppercase"
              fw={700}
              style={{ letterSpacing: '0.5px' }}
            >
              PO Number
            </Text>
            <Text
              size="sm"
              fw={600}
              mt={4}
              style={{
                fontFamily: theme.fontFamilyMonospace,
                color: isDark
                  ? theme.colors[theme.primaryColor][4]
                  : theme.colors[theme.primaryColor][7],
              }}
            >
              {poNumber}
            </Text>
          </Grid.Col>

          <Grid.Col span={6}>
            <Text
              size="xs"
              c="dimmed"
              tt="uppercase"
              fw={700}
              style={{ letterSpacing: '0.5px' }}
            >
              Order Payment Method
            </Text>
            <Badge
              mt={4}
              size="sm"
              variant="light"
              color={theme.primaryColor}
            >
              {originalMethodLabel}
            </Badge>
          </Grid.Col>
        </Grid>

        <Divider my="lg" />

        <Grid>
          <Grid.Col span={4}>
            <Text
              size="xs"
              c="dimmed"
              tt="uppercase"
              fw={600}
            >
              Total Amount
            </Text>
            <Text
              size="xl"
              fw={800}
              mt={4}
              style={{
                fontFamily: theme.fontFamilyMonospace,
                color: isDark ? theme.white : theme.black,
              }}
            >
              {formatCurrency(totalAmount, currency)}
            </Text>
          </Grid.Col>
          <Grid.Col span={4}>
            <Text
              size="xs"
              c="dimmed"
              tt="uppercase"
              fw={600}
            >
              Already Paid
            </Text>
            <Text
              size="xl"
              fw={800}
              c="teal.6"
              mt={4}
              style={{ fontFamily: theme.fontFamilyMonospace }}
            >
              {formatCurrency(paidAmount, currency)}
            </Text>
          </Grid.Col>
          <Grid.Col span={4}>
            <Text
              size="xs"
              c="dimmed"
              tt="uppercase"
              fw={600}
            >
              Amount Due
            </Text>
            <Text
              size="xl"
              fw={800}
              c="red.6"
              mt={4}
              style={{ fontFamily: theme.fontFamilyMonospace }}
            >
              {formatCurrency(dueAmount, currency)}
            </Text>
          </Grid.Col>
        </Grid>
      </Paper>

      {/* ── Payment Fields ─────────────────────────────────────────────────── */}
      <Stack gap="md">
        <NumberInput
          label="Payment Amount"
          placeholder="Enter amount to pay"
          value={amount}
          onChange={(value) => setAmount(Number(value))}
          min={0}
          max={dueAmount}
          step={1000}
          thousandSeparator=","
          prefix={`${currency} `}
          size="lg"
          required
          leftSection={<IconCurrencyDollar size={20} />}
          description={`Maximum: ${formatCurrency(dueAmount, currency)}`}
          styles={{
            label: { fontWeight: 600, marginBottom: 8 },
            input: {
              fontFamily: theme.fontFamilyMonospace,
              fontSize: '1.1rem',
              fontWeight: 600,
            },
          }}
        />

        {/* ── Payment Method — button grid matching CompletePurchaseModal ── */}
        <Stack gap={8}>
          <div>
            <Text
              size="sm"
              fw={600}
              mb={4}
            >
              Payment Method{' '}
              <span style={{ color: theme.colors.red[6] }}>*</span>
            </Text>
            <Text
              size="xs"
              c={methodChanged ? 'orange' : 'dimmed'}
              fs="italic"
              mb={8}
            >
              {methodChanged
                ? `Originally created with: ${originalMethodLabel}`
                : 'Pre-filled from order — change if paying differently'}
            </Text>
          </div>
          <Group
            gap={6}
            grow
          >
            {PAYMENT_METHODS.map((method) => (
              <PaymentMethodButton
                key={method.value}
                method={method}
                isSelected={paymentMethod === method.value}
                onSelect={() => setPaymentMethod(method.value)}
                isDark={isDark}
                primaryColor={primary}
              />
            ))}
          </Group>
        </Stack>

        {/* Subtle warning when method differs from the original PO */}
        {methodChanged && (
          <Alert
            icon={<IconAlertCircle size={16} />}
            color="orange"
            variant="light"
            p="sm"
          >
            You're paying with a different method than the order was created
            with ({originalMethodLabel}). This is fine — the transaction will
            record the method you selected above.
          </Alert>
        )}

        <Textarea
          label="Payment Notes (Optional)"
          placeholder="e.g., Bank Reference Number, Receipt Number, etc."
          value={notes}
          onChange={(e) => setNotes(e.currentTarget.value)}
          minRows={2}
          maxRows={4}
          size="md"
          styles={{
            label: { fontWeight: 600, marginBottom: 8 },
          }}
        />
      </Stack>

      {/* ── Validation error ───────────────────────────────────────────────── */}
      {error && (
        <Alert
          icon={<IconAlertCircle size={16} />}
          color="red"
          title="Validation Error"
        >
          {error}
        </Alert>
      )}

      {/* ── Payment Preview ────────────────────────────────────────────────── */}
      {amount > 0 && amount <= dueAmount && (
        <Paper
          p="lg"
          withBorder
          style={{
            background: isDark
              ? `linear-gradient(135deg, ${theme.colors.dark[5]} 0%, ${theme.colors.dark[6]} 100%)`
              : `linear-gradient(135deg, ${theme.colors.teal[0]} 0%, ${theme.colors.teal[1]} 100%)`,
            borderColor: isDark ? theme.colors.dark[4] : theme.colors.teal[3],
            borderWidth: 2,
          }}
        >
          <Text
            size="sm"
            fw={700}
            mb="md"
            style={{
              color: isDark ? theme.colors.teal[4] : theme.colors.teal[7],
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            Payment Preview
          </Text>
          <Grid>
            <Grid.Col span={6}>
              <Text
                size="xs"
                c="dimmed"
                tt="uppercase"
                fw={600}
              >
                Amount to Pay
              </Text>
              <Text
                size="lg"
                fw={800}
                style={{
                  fontFamily: theme.fontFamilyMonospace,
                  color: isDark ? theme.colors.teal[4] : theme.colors.teal[7],
                }}
              >
                {formatCurrency(amount, currency)}
              </Text>
            </Grid.Col>
            <Grid.Col span={6}>
              <Text
                size="xs"
                c="dimmed"
                tt="uppercase"
                fw={600}
              >
                New Status
              </Text>
              <Badge
                color={newDueAmount <= 0.01 ? 'teal' : 'yellow'}
                variant="filled"
                size="lg"
                mt={4}
                style={{ boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}
              >
                {newStatus}
              </Badge>
            </Grid.Col>
            <Grid.Col span={6}>
              <Text
                size="xs"
                c="dimmed"
                tt="uppercase"
                fw={600}
              >
                New Paid Amount
              </Text>
              <Text
                size="lg"
                fw={800}
                c="teal.6"
                style={{ fontFamily: theme.fontFamilyMonospace }}
              >
                {formatCurrency(newPaidAmount, currency)}
              </Text>
            </Grid.Col>
            <Grid.Col span={6}>
              <Text
                size="xs"
                c="dimmed"
                tt="uppercase"
                fw={600}
              >
                Remaining Balance
              </Text>
              <Text
                size="lg"
                fw={800}
                c={newDueAmount <= 0.01 ? 'teal.6' : 'red.6'}
                style={{ fontFamily: theme.fontFamilyMonospace }}
              >
                {formatCurrency(newDueAmount, currency)}
              </Text>
            </Grid.Col>
          </Grid>
        </Paper>
      )}

      {/* ── Actions ────────────────────────────────────────────────────────── */}
      <Group
        justify="flex-end"
        mt="lg"
      >
        <Button
          variant="subtle"
          color="gray"
          onClick={handleCancel}
          disabled={loading}
          size="md"
        >
          Cancel
        </Button>
        <Button
          leftSection={<IconCheck size={18} />}
          color="teal"
          onClick={handleSubmit}
          loading={loading}
          size="md"
          style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
        >
          Record Payment
        </Button>
      </Group>
    </Stack>
  )
}

export default RecordPurchasePaymentForm

