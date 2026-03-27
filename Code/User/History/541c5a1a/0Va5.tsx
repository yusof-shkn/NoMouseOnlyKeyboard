// src/features/sales/components/modals/CompleteSaleModal.tsx
import React, { useState } from 'react'
import {
  Stack,
  Button,
  Text,
  Group,
  Paper,
  Divider,
  Checkbox,
  Radio,
  Alert,
  Box,
  useMantineTheme,
  useMantineColorScheme,
} from '@mantine/core'
import {
  IconReceipt,
  IconFileInvoice,
  IconPrinter,
  IconDownload,
  IconAlertCircle,
  IconCash,
  IconCreditCard,
  IconDeviceMobile,
  IconCheck,
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
  onConfirm: (options: {
    generateReceipt: boolean
    generateInvoice: boolean
    printImmediately: boolean
    downloadPdf: boolean
  }) => Promise<void>
  onCancel: () => void
}

const paymentIcons: Record<string, React.ReactNode> = {
  cash: <IconCash size={18} />,
  card: <IconCreditCard size={18} />,
  mobile_money: <IconDeviceMobile size={18} />,
  credit: <IconReceipt size={18} />,
}

export const CompleteSaleModalContent: React.FC<CompleteSaleModalProps> = ({
  saleType,
  orderItems,
  totals,
  customerName,
  onConfirm,
  onCancel,
}) => {
  const theme = useMantineTheme()
  const { colorScheme } = useMantineColorScheme()
  const isDark = colorScheme === 'dark'
  const currency = useSelector(selectDefaultCurrency)

  const [isProcessing, setIsProcessing] = useState(false)
  const [generateReceipt, setGenerateReceipt] = useState(true)
  const [generateInvoice, setGenerateInvoice] = useState(
    saleType === 'wholesale',
  )
  const [outputOption, setOutputOption] = useState<'print' | 'download'>(
    'print',
  )
  const [paymentMethod, setPaymentMethod] = useState<string>('cash')

  const handleConfirm = async () => {
    setIsProcessing(true)
    try {
      const handlers = (window as any).__saleModalHandlers
      if (handlers?.onCompleteSale) {
        await handlers.onCompleteSale({
          generateReceipt,
          generateInvoice,
          printImmediately: outputOption === 'print',
          downloadPdf: outputOption === 'download',
          paymentMethod,
        })
      } else if (onConfirm) {
        await onConfirm({
          generateReceipt,
          generateInvoice,
          printImmediately: outputOption === 'print',
          downloadPdf: outputOption === 'download',
        })
      }
    } catch (error) {
      console.error('Error completing sale:', error)
    } finally {
      setIsProcessing(false)
    }
  }

  const isWholesale = saleType === 'wholesale'

  return (
    <Stack gap="md">
      {/* Sale Summary */}
      <Paper
        p="md"
        withBorder
        style={{
          backgroundColor: isDark ? theme.colors.dark[6] : theme.white,
          borderColor: isDark ? theme.colors.dark[4] : theme.colors.gray[3],
        }}
      >
        <Stack gap="sm">
          <Group justify="space-between">
            <Text
              size="sm"
              c="dimmed"
            >
              Sale Type:
            </Text>
            <Text
              size="sm"
              fw={500}
            >
              {saleType === 'retail' ? 'Retail Sale' : 'Wholesale Sale'}
            </Text>
          </Group>
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
              {orderItems.length} item(s)
            </Text>
          </Group>
          <Divider
            color={isDark ? theme.colors.dark[4] : theme.colors.gray[3]}
          />
          <Group justify="space-between">
            <Text
              size="md"
              fw={600}
            >
              Total Amount:
            </Text>
            <Text
              size="xl"
              fw={700}
              c={theme.primaryColor}
            >
              {formatCompactCurrency(totals.grandTotal, currency)}
            </Text>
          </Group>
        </Stack>
      </Paper>

      {/* Payment Method */}
      {isWholesale && (
        <Box>
          <Text
            size="sm"
            fw={500}
            mb="xs"
          >
            Payment Method
          </Text>
          <Group gap="xs">
            {[
              { value: 'cash', label: 'Cash' },
              { value: 'card', label: 'Card' },
              { value: 'mobile_money', label: 'Mobile Money' },
              { value: 'credit', label: 'Credit' },
            ].map((method) => (
              <Button
                key={method.value}
                size="sm"
                variant={paymentMethod === method.value ? 'filled' : 'light'}
                color={
                  paymentMethod === method.value ? theme.primaryColor : 'gray'
                }
                onClick={() => setPaymentMethod(method.value)}
                leftSection={paymentIcons[method.value]}
                style={{ flex: 1 }}
              >
                {method.label}
              </Button>
            ))}
          </Group>
        </Box>
      )}

      <Divider color={isDark ? theme.colors.dark[4] : theme.colors.gray[3]} />

      {/* Documents */}
      <Box>
        <Text
          size="sm"
          fw={500}
          mb="xs"
        >
          Documents
        </Text>
        <Stack gap="xs">
          <Paper
            p="sm"
            withBorder
            style={{
              borderColor: generateReceipt
                ? theme.colors[theme.primaryColor][6]
                : isDark
                  ? theme.colors.dark[4]
                  : theme.colors.gray[3],
              backgroundColor: generateReceipt
                ? isDark
                  ? theme.colors.dark[5]
                  : theme.colors[theme.primaryColor][0]
                : isDark
                  ? theme.colors.dark[6]
                  : theme.white,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onClick={() => setGenerateReceipt(!generateReceipt)}
          >
            <Group gap="sm">
              <Checkbox
                checked={generateReceipt}
                onChange={(e) => setGenerateReceipt(e.currentTarget.checked)}
                color={theme.primaryColor}
              />
              <IconReceipt
                size={18}
                color={theme.colors[theme.primaryColor][6]}
              />
              <Box style={{ flex: 1 }}>
                <Text
                  size="sm"
                  fw={500}
                >
                  Receipt
                </Text>
                <Text
                  size="xs"
                  c="dimmed"
                >
                  Customer proof of purchase
                </Text>
              </Box>
            </Group>
          </Paper>

          {isWholesale && (
            <Paper
              p="sm"
              withBorder
              style={{
                borderColor: generateInvoice
                  ? theme.colors[theme.primaryColor][6]
                  : isDark
                    ? theme.colors.dark[4]
                    : theme.colors.gray[3],
                backgroundColor: generateInvoice
                  ? isDark
                    ? theme.colors.dark[5]
                    : theme.colors[theme.primaryColor][0]
                  : isDark
                    ? theme.colors.dark[6]
                    : theme.white,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              onClick={() => setGenerateInvoice(!generateInvoice)}
            >
              <Group gap="sm">
                <Checkbox
                  checked={generateInvoice}
                  onChange={(e) => setGenerateInvoice(e.currentTarget.checked)}
                  color={theme.primaryColor}
                />
                <IconFileInvoice
                  size={18}
                  color={theme.colors[theme.primaryColor][6]}
                />
                <Box style={{ flex: 1 }}>
                  <Text
                    size="sm"
                    fw={500}
                  >
                    Invoice
                  </Text>
                  <Text
                    size="xs"
                    c="dimmed"
                  >
                    Detailed billing document
                  </Text>
                </Box>
              </Group>
            </Paper>
          )}
        </Stack>
      </Box>

      {/* Output */}
      {(generateReceipt || generateInvoice) && (
        <Box>
          <Text
            size="sm"
            fw={500}
            mb="xs"
          >
            Output
          </Text>
          <Radio.Group
            value={outputOption}
            onChange={(value) => setOutputOption(value as 'print' | 'download')}
          >
            <Stack gap="xs">
              <Paper
                p="sm"
                withBorder
                style={{
                  borderColor:
                    outputOption === 'print'
                      ? theme.colors[theme.primaryColor][6]
                      : isDark
                        ? theme.colors.dark[4]
                        : theme.colors.gray[3],
                  backgroundColor:
                    outputOption === 'print'
                      ? isDark
                        ? theme.colors.dark[5]
                        : theme.colors[theme.primaryColor][0]
                      : isDark
                        ? theme.colors.dark[6]
                        : theme.white,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                onClick={() => setOutputOption('print')}
              >
                <Group gap="sm">
                  <Radio
                    value="print"
                    color={theme.primaryColor}
                  />
                  <IconPrinter
                    size={18}
                    color={theme.colors[theme.primaryColor][6]}
                  />
                  <Box style={{ flex: 1 }}>
                    <Text
                      size="sm"
                      fw={500}
                    >
                      Print
                    </Text>
                    <Text
                      size="xs"
                      c="dimmed"
                    >
                      Send to printer
                    </Text>
                  </Box>
                </Group>
              </Paper>

              <Paper
                p="sm"
                withBorder
                style={{
                  borderColor:
                    outputOption === 'download'
                      ? theme.colors[theme.primaryColor][6]
                      : isDark
                        ? theme.colors.dark[4]
                        : theme.colors.gray[3],
                  backgroundColor:
                    outputOption === 'download'
                      ? isDark
                        ? theme.colors.dark[5]
                        : theme.colors[theme.primaryColor][0]
                      : isDark
                        ? theme.colors.dark[6]
                        : theme.white,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                onClick={() => setOutputOption('download')}
              >
                <Group gap="sm">
                  <Radio
                    value="download"
                    color={theme.primaryColor}
                  />
                  <IconDownload
                    size={18}
                    color={theme.colors[theme.primaryColor][6]}
                  />
                  <Box style={{ flex: 1 }}>
                    <Text
                      size="sm"
                      fw={500}
                    >
                      Download PDF
                    </Text>
                    <Text
                      size="xs"
                      c="dimmed"
                    >
                      Save to device
                    </Text>
                  </Box>
                </Group>
              </Paper>
            </Stack>
          </Radio.Group>
        </Box>
      )}

      {/* Warning */}
      {!generateReceipt && !generateInvoice && (
        <Alert
          icon={<IconAlertCircle size={16} />}
          color="yellow"
          variant="light"
        >
          <Text size="sm">
            No document selected. Sale will complete without generating
            documents.
          </Text>
        </Alert>
      )}

      {/* Actions */}
      <Group
        justify="flex-end"
        gap="sm"
      >
        <Button
          variant="default"
          onClick={onCancel}
          disabled={isProcessing}
        >
          Cancel
        </Button>
        <Button
          onClick={handleConfirm}
          loading={isProcessing}
          color={theme.primaryColor}
          leftSection={!isProcessing && <IconCheck size={18} />}
        >
          {isProcessing ? 'Processing...' : 'Complete Sale'}
        </Button>
      </Group>
    </Stack>
  )
}

export default CompleteSaleModalContent

