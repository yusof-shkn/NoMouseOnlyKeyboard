// src/features/sales/components/modals/CompleteSaleModal.tsx
import React, { useState, useEffect } from 'react'
import {
  Stack,
  Button,
  Text,
  Group,
  Paper,
  Divider,
  NumberInput,
  Checkbox,
  Box,
  useMantineTheme,
  useMantineColorScheme,
} from '@mantine/core'
import {
  IconPrinter,
  IconDownload,
  IconCheck,
  IconCash,
  IconCreditCard,
  IconDeviceMobile,
  IconBuildingBank,
  IconBookmark,
} from '@tabler/icons-react'
import { formatCompactCurrency } from '@shared/utils/formatters'
import { useSelector } from 'react-redux'
import { selectDefaultCurrency } from '@features/authentication/authSlice'

interface CompleteSaleModalProps {
  saleType: 'retail' | 'wholesale'
  orderItems: any[]
  totals: {
    subTotal: number
    tax: number
    discount: number
    grandTotal: number
  }
  customerName?: string
  selectedPayment?: string
  onConfirm: (options: {
    generateReceipt: boolean
    generateInvoice: boolean
    printImmediately: boolean
    downloadPdf: boolean
    amountTendered: number
    paymentMethod: string
  }) => Promise<void>
  onCancel: () => void
}

const paymentMethods = [
  { value: 'cash', label: 'Cash', icon: <IconCash size={18} /> },
  { value: 'card', label: 'Card', icon: <IconCreditCard size={18} /> },
  {
    value: 'mobile_money',
    label: 'Mobile',
    icon: <IconDeviceMobile size={18} />,
  },
  { value: 'credit', label: 'Credit', icon: <IconBuildingBank size={18} /> },
]

export const CompleteSaleModalContent: React.FC<CompleteSaleModalProps> = ({
  saleType,
  orderItems,
  totals,
  customerName,
  selectedPayment: initialPayment = 'cash',
  onConfirm,
  onCancel,
}) => {
  const theme = useMantineTheme()
  const currency = useSelector(selectDefaultCurrency)

  const { colorScheme } = useMantineColorScheme()
  const isDark = colorScheme === 'dark'

  const [isProcessing, setIsProcessing] = useState(false)
  const [amountTendered, setAmountTendered] = useState<number>(
    totals.grandTotal,
  )
  // ✅ Filter out credit for retail sales — credit is wholesale-only
  const availablePaymentMethods = paymentMethods.filter(
    (m) => !(m.value === 'credit' && saleType === 'retail'),
  )
  const safeInitialPayment =
    initialPayment === 'credit' && saleType === 'retail'
      ? 'cash'
      : initialPayment
  const [paymentMethod, setPaymentMethod] = useState<string>(safeInitialPayment)
  const [generateReceipt, setGenerateReceipt] = useState(true)
  const [generateInvoice, setGenerateInvoice] = useState(false)
  const [printImmediately, setPrintImmediately] = useState(true)
  const [downloadPdf, setDownloadPdf] = useState(false)

  const isCredit = paymentMethod === 'credit'

  // Read credit summary directly from the window handlers — read on every render
  // so we always get the latest value (not stale from mount)
  const creditSummary =
    (window as any).__saleModalHandlers?.customerCreditSummary ?? null

  const availableCredit = creditSummary?.available_credit ?? 0
  const currentBalance = creditSummary?.current_credit_balance ?? 0
  const creditLimit = creditSummary?.credit_limit ?? 0
  const creditDays = creditSummary?.credit_days ?? 30
  const hasCreditLimit = creditLimit > 0
  const hasSufficientCredit = availableCredit >= totals.grandTotal

  const balance = amountTendered - totals.grandTotal
  const isValidPayment = isCredit
    ? hasCreditLimit && hasSufficientCredit
    : amountTendered >= totals.grandTotal

  const handleConfirm = async () => {
    if (!isValidPayment) return
    setIsProcessing(true)
    try {
      const handlers = (window as any).__saleModalHandlers
      const payload = {
        generateReceipt,
        generateInvoice,
        printImmediately,
        downloadPdf,
        amountTendered: isCredit ? totals.grandTotal : amountTendered,
        paymentMethod,
      }
      if (handlers?.onCompleteSale) {
        await handlers.onCompleteSale(payload)
      } else if (onConfirm) {
        await onConfirm(payload)
      }
    } catch (error) {
      console.error('Error completing sale:', error)
    } finally {
      setIsProcessing(false)
    }
  }

  const isWholesale = saleType === 'wholesale'

  const cardBg = isDark ? theme.colors.dark[6] : theme.white
  const cardBorder = isDark ? theme.colors.dark[4] : theme.colors.gray[3]
  const summaryBg = isDark ? theme.colors.dark[7] : theme.colors.gray[0]

  return (
    <Stack gap="md">
      {/* Sale Summary */}
      <Paper
        p="md"
        withBorder
        style={{ backgroundColor: summaryBg, borderColor: cardBorder }}
      >
        <Stack gap="xs">
          {customerName && (
            <Group justify="space-between">
              <Text
                size="sm"
                c="dimmed"
              >
                Customer:
              </Text>
              <Text
                size="sm"
                fw={500}
              >
                {customerName}
              </Text>
            </Group>
          )}
          <Group justify="space-between">
            <Text
              size="sm"
              c="dimmed"
            >
              Items:
            </Text>
            <Text
              size="sm"
              fw={500}
            >
              {orderItems.length}
            </Text>
          </Group>
          <Divider
            my="xs"
            color={cardBorder}
          />
          <Group justify="space-between">
            <Text
              size="lg"
              fw={700}
            >
              Total:
            </Text>
            <Text
              size="lg"
              fw={700}
              c={theme.primaryColor}
            >
              {formatCompactCurrency(totals.grandTotal, currency)}
            </Text>
          </Group>
        </Stack>
      </Paper>

      <Box>
        <Text
          size="sm"
          fw={500}
          mb="xs"
        >
          Payment Method
        </Text>
        <Group gap="xs">
          {availablePaymentMethods.map((method) => (
            <Button
              key={method.value}
              size="sm"
              variant={paymentMethod === method.value ? 'filled' : 'light'}
              color={
                paymentMethod === method.value ? theme.primaryColor : 'gray'
              }
              onClick={() => setPaymentMethod(method.value)}
              leftSection={method.icon}
              style={{ flex: 1 }}
            >
              {method.label}
            </Button>
          ))}
        </Group>
      </Box>

      {isCredit && (
        <Paper
          p="md"
          withBorder
          style={{ backgroundColor: cardBg, borderColor: cardBorder }}
        >
          <Stack gap="xs">
            <Text
              size="sm"
              fw={600}
              mb={4}
            >
              Credit Details
            </Text>
            <Group justify="space-between">
              <Text
                size="sm"
                c="dimmed"
              >
                Credit Limit:
              </Text>
              <Text
                size="sm"
                fw={500}
              >
                {formatCompactCurrency(creditLimit, currency)}
              </Text>
            </Group>
            <Group justify="space-between">
              <Text
                size="sm"
                c="dimmed"
              >
                Outstanding Balance:
              </Text>
              <Text
                size="sm"
                fw={500}
              >
                {formatCompactCurrency(currentBalance, currency)}
              </Text>
            </Group>
            <Divider color={cardBorder} />
            <Group justify="space-between">
              <Text
                size="sm"
                c="dimmed"
              >
                Available Credit:
              </Text>
              <Text
                size="sm"
                fw={700}
                c={hasSufficientCredit ? theme.primaryColor : 'red'}
              >
                {formatCompactCurrency(availableCredit, currency)}
              </Text>
            </Group>
            <Group justify="space-between">
              <Text
                size="sm"
                c="dimmed"
              >
                This Purchase:
              </Text>
              <Text
                size="sm"
                fw={500}
              >
                {formatCompactCurrency(totals.grandTotal, currency)}
              </Text>
            </Group>
            {!hasCreditLimit && (
              <Text
                size="xs"
                c="red"
                mt={4}
              >
                This customer has no credit limit assigned.
              </Text>
            )}
            {hasCreditLimit && !hasSufficientCredit && (
              <Text
                size="xs"
                c="red"
                mt={4}
              >
                Insufficient credit — short by{' '}
                {formatCompactCurrency(
                  totals.grandTotal - availableCredit,
                  currency,
                )}
              </Text>
            )}
            {hasCreditLimit && hasSufficientCredit && (
              <Text
                size="xs"
                c="dimmed"
                mt={4}
              >
                Payment due within {creditDays} days
              </Text>
            )}
          </Stack>
        </Paper>
      )}

      {/* Amount Tendered — hidden for credit */}
      {!isCredit && (
        <Paper
          p="md"
          withBorder
          style={{ backgroundColor: cardBg, borderColor: cardBorder }}
        >
          <Stack gap="md">
            <NumberInput
              label="Amount Tendered"
              placeholder="Enter amount"
              value={amountTendered}
              onChange={(value) => setAmountTendered(Number(value) || 0)}
              min={0}
              hideControls
              size="lg"
              leftSection={<IconCash size={20} />}
              styles={{
                input: {
                  fontSize: '1.25rem',
                  fontWeight: 600,
                  height: '3.5rem',
                },
              }}
              error={!isValidPayment ? 'Insufficient amount' : undefined}
            />
            <Paper
              p="md"
              withBorder
              style={{
                backgroundColor:
                  balance >= 0
                    ? isDark
                      ? theme.colors.green[9]
                      : theme.colors.green[0]
                    : isDark
                      ? theme.colors.red[9]
                      : theme.colors.red[0],
                borderColor:
                  balance >= 0 ? theme.colors.green[5] : theme.colors.red[5],
              }}
            >
              <Group
                justify="space-between"
                align="center"
              >
                <Text
                  size="md"
                  fw={600}
                >
                  {balance >= 0 ? 'Change:' : 'Shortfall:'}
                </Text>
                <Text
                  size="2rem"
                  fw={700}
                  c={balance >= 0 ? 'green' : 'red'}
                >
                  {formatCompactCurrency(Math.abs(balance), currency)}
                </Text>
              </Group>
            </Paper>
          </Stack>
        </Paper>
      )}

      <Divider color={cardBorder} />

      {/* Document Options */}
      <Paper
        p="sm"
        withBorder
        style={{ backgroundColor: cardBg, borderColor: cardBorder }}
      >
        <Group
          gap="xs"
          justify="space-between"
          wrap="nowrap"
        >
          <Checkbox
            label="Receipt"
            checked={generateReceipt}
            onChange={(e) => setGenerateReceipt(e.currentTarget.checked)}
            size="xs"
          />
          {isWholesale && (
            <Checkbox
              label="Invoice"
              checked={generateInvoice}
              onChange={(e) => setGenerateInvoice(e.currentTarget.checked)}
              size="xs"
            />
          )}
          <Checkbox
            label={
              <Group gap={4}>
                <IconPrinter size={14} />
                <Text size="xs">Print</Text>
              </Group>
            }
            checked={printImmediately}
            onChange={(e) => setPrintImmediately(e.currentTarget.checked)}
            size="xs"
          />
          <Checkbox
            label={
              <Group gap={4}>
                <IconDownload size={14} />
                <Text size="xs">PDF</Text>
              </Group>
            }
            checked={downloadPdf}
            onChange={(e) => setDownloadPdf(e.currentTarget.checked)}
            size="xs"
          />
        </Group>
      </Paper>

      {/* Actions */}
      <Group
        justify="flex-end"
        gap="sm"
        mt="md"
      >
        <Button
          variant="light"
          color="yellow"
          onClick={() => (window as any).__saleModalHandlers?.onSaveDraft?.()}
          disabled={isProcessing}
          size="md"
          leftSection={<IconBookmark size={16} />}
        >
          Save as Draft
        </Button>
        <Button
          onClick={handleConfirm}
          loading={isProcessing}
          disabled={!isValidPayment}
          color={theme.primaryColor}
          leftSection={!isProcessing && <IconCheck size={18} />}
          size="md"
          style={{ minWidth: '150px' }}
        >
          {isProcessing ? 'Processing...' : 'Complete Sale'}
        </Button>
      </Group>
    </Stack>
  )
}

export default CompleteSaleModalContent

