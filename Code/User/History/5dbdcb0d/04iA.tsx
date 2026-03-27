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
  Alert,
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
  IconAlertTriangle,
} from '@tabler/icons-react'

interface CompleteSaleModalProps {
  saleType: 'retail' | 'institutional' | 'wholesale'
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
  const { colorScheme } = useMantineColorScheme()
  const isDark = colorScheme === 'dark'

  const [isProcessing, setIsProcessing] = useState(false)
  const [amountTendered, setAmountTendered] = useState<number>(
    totals.grandTotal,
  )
  const [paymentMethod, setPaymentMethod] = useState<string>(initialPayment)
  const [generateReceipt, setGenerateReceipt] = useState(true)
  const [generateInvoice, setGenerateInvoice] = useState(false)
  const [printImmediately, setPrintImmediately] = useState(true)
  const [downloadPdf, setDownloadPdf] = useState(false)

  // Credit info pulled from the window handler (already fetched by POS)
  const [creditInfo, setCreditInfo] = useState<{
    available_credit: number
    current_credit_balance: number
    credit_limit: number
    credit_days: number
  } | null>(null)

  // When credit is selected, pull credit info from the already-loaded summary
  useEffect(() => {
    if (paymentMethod === 'credit') {
      const handlers = (window as any).__saleModalHandlers
      // Credit summary was pre-loaded in POS when customer was selected
      // It's stored on the handlers object for the modal to read
      const summary = handlers?.customerCreditSummary
      if (summary) {
        setCreditInfo({
          available_credit: summary.available_credit,
          current_credit_balance: summary.current_credit_balance,
          credit_limit: summary.credit_limit,
          credit_days: summary.credit_days,
        })
      }
    } else {
      setCreditInfo(null)
    }
  }, [paymentMethod])

  const isCredit = paymentMethod === 'credit'
  // For credit: valid if customer has enough available credit
  const hasSufficientCredit = creditInfo
    ? creditInfo.available_credit >= totals.grandTotal
    : true // if no credit info loaded yet, let backend validate
  const balance = amountTendered - totals.grandTotal
  const isValidPayment = isCredit
    ? hasSufficientCredit
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

  const isWholesale = saleType === 'wholesale' || saleType === 'institutional'

  return (
    <Stack gap="md">
      {/* Sale Summary */}
      <Paper
        p="md"
        withBorder
        style={{
          backgroundColor: isDark ? theme.colors.dark[6] : theme.colors.gray[0],
          borderColor: isDark ? theme.colors.dark[4] : theme.colors.gray[3],
        }}
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
            color={isDark ? theme.colors.dark[4] : theme.colors.gray[3]}
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
              UGX {totals.grandTotal.toLocaleString()}
            </Text>
          </Group>
        </Stack>
      </Paper>

      {/* Payment Method Selection */}
      <Box>
        <Text
          size="sm"
          fw={500}
          mb="xs"
        >
          Payment Method
        </Text>
        <Group gap="xs">
          {paymentMethods.map((method) => (
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

      {/* Credit info — only shown when credit is selected */}
      {isCredit && (
        <Paper
          p="md"
          withBorder
          style={{
            backgroundColor: !hasSufficientCredit
              ? isDark
                ? theme.colors.red[9]
                : theme.colors.red[0]
              : isDark
                ? theme.colors.green[9]
                : theme.colors.green[0],
            borderColor: !hasSufficientCredit
              ? theme.colors.red[6]
              : theme.colors.green[6],
            border: '2px solid',
          }}
        >
          {creditInfo ? (
            <Stack gap={6}>
              <Group justify="space-between">
                <Text
                  size="sm"
                  fw={600}
                >
                  Available Credit:
                </Text>
                <Text
                  size="sm"
                  fw={700}
                  c={!hasSufficientCredit ? 'red' : 'green'}
                >
                  UGX {creditInfo.available_credit.toLocaleString()}
                </Text>
              </Group>
              <Group justify="space-between">
                <Text
                  size="xs"
                  c="dimmed"
                >
                  Outstanding Balance:
                </Text>
                <Text size="xs">
                  UGX {creditInfo.current_credit_balance.toLocaleString()}
                </Text>
              </Group>
              <Group justify="space-between">
                <Text
                  size="xs"
                  c="dimmed"
                >
                  Credit Limit:
                </Text>
                <Text size="xs">
                  UGX {creditInfo.credit_limit.toLocaleString()}
                </Text>
              </Group>
              <Group justify="space-between">
                <Text
                  size="xs"
                  c="dimmed"
                >
                  Payment Due:
                </Text>
                <Text size="xs">Within {creditInfo.credit_days} days</Text>
              </Group>
              {!hasSufficientCredit && (
                <Alert
                  icon={<IconAlertTriangle size={16} />}
                  color="red"
                  mt={4}
                  p="xs"
                >
                  Insufficient credit. Short by UGX{' '}
                  {(
                    totals.grandTotal - creditInfo.available_credit
                  ).toLocaleString()}
                </Alert>
              )}
            </Stack>
          ) : (
            <Text
              size="sm"
              c="dimmed"
            >
              Loading credit info...
            </Text>
          )}
        </Paper>
      )}

      {/* Amount Tendered — hidden for credit */}
      {!isCredit && (
        <Paper
          p="md"
          withBorder
          style={{
            backgroundColor: isDark ? theme.colors.dark[6] : theme.white,
            borderColor: isDark ? theme.colors.dark[4] : theme.colors.gray[3],
          }}
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
              error={!isValidPayment && 'Insufficient amount'}
            />
            <Paper
              p="md"
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
                  balance >= 0 ? theme.colors.green[6] : theme.colors.red[6],
                border: '2px solid',
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
                  UGX {Math.abs(balance).toLocaleString()}
                </Text>
              </Group>
            </Paper>
          </Stack>
        </Paper>
      )}

      <Divider color={isDark ? theme.colors.dark[4] : theme.colors.gray[3]} />

      {/* Document Options */}
      <Paper
        p="sm"
        withBorder
        style={{
          backgroundColor: isDark ? theme.colors.dark[6] : theme.white,
          borderColor: isDark ? theme.colors.dark[4] : theme.colors.gray[3],
        }}
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
          variant="default"
          onClick={onCancel}
          disabled={isProcessing}
          size="md"
        >
          Cancel
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

