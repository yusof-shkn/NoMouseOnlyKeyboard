// components/ReceiveGoodsForm.tsx

import { useState } from 'react'
import { useDispatch } from 'react-redux'
import {
  Stack,
  Text,
  TextInput,
  Textarea,
  Button,
  Group,
  Paper,
  Grid,
  Divider,
  Alert,
  Box,
  useMantineTheme,
  useMantineColorScheme,
  ThemeIcon,
  Badge,
} from '@mantine/core'
import {
  IconPackage,
  IconAlertCircle,
  IconCheck,
  IconFileInvoice,
  IconBuildingWarehouse,
} from '@tabler/icons-react'
import { DateInput } from '@mantine/dates'
import { formatCurrency } from '@shared/utils/formatters'
import { closeModal } from '@shared/components/genericModal/SliceGenericModal'
import { AppDispatch } from '@app/core/store/store'
import { notifications } from '@mantine/notifications'
import { receiveAllGoodsFromPO } from '../data/purchaseOrderHIstory.Queries'
import { getCurrentUserId } from '@shared/utils/authUtils'
import supabase from '@app/core/supabase/Supabase.utils'
import { openModal } from '@shared/components/genericModal/SliceGenericModal'

interface ReceiveGoodsFormProps {
  purchaseOrderId: number
  poNumber: string
  supplierName: string
  supplierId: number
  storeId: number
  storeName: string
  companyId: number
  totalAmount: number
  currency: string
  itemCount?: number
}

export const ReceiveGoodsForm = ({
  purchaseOrderId,
  poNumber,
  supplierName,
  supplierId,
  storeId,
  storeName,
  companyId,
  totalAmount,
  currency,
  itemCount,
}: ReceiveGoodsFormProps) => {
  const dispatch = useDispatch<AppDispatch>()
  const theme = useMantineTheme()
  const { colorScheme } = useMantineColorScheme()

  const [invoiceNumber, setInvoiceNumber] = useState<string>('')
  const [invoiceDate, setInvoiceDate] = useState<Date | null>(new Date())
  const [deliveryNotes, setDeliveryNotes] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [loading, setLoading] = useState(false)

  const isDark = colorScheme === 'dark'

  const handleSubmit = async () => {
    if (!invoiceNumber.trim()) {
      setError('Invoice number is required')
      return
    }

    setError('')
    setLoading(true)

    try {
      const userId = await getCurrentUserId()
      if (!userId) {
        setError('User not authenticated. Please log in again.')
        setLoading(false)
        return
      }

      notifications.show({
        id: 'receiving-goods',
        title: 'Receiving Goods...',
        message: 'Updating inventory, please wait',
        loading: true,
        autoClose: false,
      })

      // Call the existing receiveAllGoodsFromPO with extended data
      const { error: receiveError } = await receiveAllGoodsFromPO(
        purchaseOrderId,
        companyId,
        userId,
        {
          invoiceNumber: invoiceNumber.trim(),
          invoiceDate: invoiceDate?.toISOString() ?? new Date().toISOString(),
          deliveryNotes: deliveryNotes.trim() || undefined,
        },
      )

      notifications.hide('receiving-goods')

      if (receiveError) {
        throw receiveError
      }

      // Dispatch a refresh event
      window.dispatchEvent(new CustomEvent('purchaseOrderUpdated'))

      notifications.show({
        title: 'Goods Received',
        message: `Goods received for PO ${poNumber}. Inventory has been updated.`,
        color: 'green',
        autoClose: 4000,
      })

      // Close this modal first
      dispatch(closeModal())

      // Check if a supplier rating already exists; if not, open rating modal
      const { data: existingRating } = await supabase
        .from('supplier_ratings')
        .select('id')
        .eq('purchase_order_id', purchaseOrderId)
        .maybeSingle()

      if (!existingRating) {
        const { data: supplierData } = await supabase
          .from('suppliers')
          .select('rating')
          .eq('id', supplierId)
          .single()

        dispatch(
          openModal({
            type: 'supplier-rating',
            size: 'lg',
            props: {
              purchaseOrderId,
              poNumber,
              supplierId,
              supplierName,
              totalAmount,
              currentRating: supplierData?.rating || 0,
            },
          }),
        )
      }
    } catch (err: any) {
      console.error('❌ Error receiving goods:', err)
      notifications.hide('receiving-goods')
      setError(err.message || 'Failed to receive goods. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    dispatch(closeModal())
  }

  return (
    <Stack gap="md">
      {/* Header Info Card */}
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
          <ThemeIcon
            size={48}
            radius="md"
            variant="light"
            color={theme.primaryColor}
          >
            <IconBuildingWarehouse size={28} />
          </ThemeIcon>
          <Box>
            <Text
              size="xs"
              c="dimmed"
              tt="uppercase"
              fw={700}
              style={{ letterSpacing: '0.5px' }}
            >
              Receiving Goods From
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

        <Grid gutter="md">
          <Grid.Col span={4}>
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

          <Grid.Col span={4}>
            <Text
              size="xs"
              c="dimmed"
              tt="uppercase"
              fw={700}
              style={{ letterSpacing: '0.5px' }}
            >
              Store
            </Text>
            <Text
              size="sm"
              fw={600}
              mt={4}
              c="dimmed"
              fs="italic"
            >
              {storeName}
            </Text>
          </Grid.Col>

          <Grid.Col span={4}>
            <Text
              size="xs"
              c="dimmed"
              tt="uppercase"
              fw={700}
              style={{ letterSpacing: '0.5px' }}
            >
              Order Value
            </Text>
            <Text
              size="sm"
              fw={700}
              mt={4}
              style={{
                fontFamily: theme.fontFamilyMonospace,
                color: isDark
                  ? theme.colors[theme.primaryColor][4]
                  : theme.colors[theme.primaryColor][8],
              }}
            >
              {formatCurrency(totalAmount, currency)}
            </Text>
          </Grid.Col>

          {itemCount !== undefined && (
            <Grid.Col span={4}>
              <Text
                size="xs"
                c="dimmed"
                tt="uppercase"
                fw={700}
                style={{ letterSpacing: '0.5px' }}
              >
                Line Items
              </Text>
              <Badge
                color={theme.primaryColor}
                variant="light"
                mt={4}
                size="md"
              >
                {itemCount} item{itemCount !== 1 ? 's' : ''}
              </Badge>
            </Grid.Col>
          )}
        </Grid>
      </Paper>

      {/* Invoice Details Section */}
      <Paper
        p="md"
        withBorder
        radius="md"
      >
        <Group
          mb="md"
          gap="xs"
        >
          <ThemeIcon
            size={28}
            radius="sm"
            variant="light"
            color={theme.primaryColor}
          >
            <IconFileInvoice size={16} />
          </ThemeIcon>
          <Text
            fw={600}
            size="sm"
          >
            Supplier Invoice Details
          </Text>
        </Group>

        <Stack gap="md">
          <Grid>
            <Grid.Col span={7}>
              <TextInput
                label="Invoice Number"
                placeholder="e.g. INV-2024-00123"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.currentTarget.value)}
                required
                leftSection={<IconFileInvoice size={16} />}
                description="Enter the supplier's invoice number from the delivery"
                styles={{
                  label: { fontWeight: 600, marginBottom: 6 },
                  input: {
                    fontFamily: theme.fontFamilyMonospace,
                    fontWeight: 500,
                  },
                }}
              />
            </Grid.Col>

            <Grid.Col span={5}>
              <DateInput
                label="Invoice Date"
                placeholder="Select date"
                value={invoiceDate}
                onChange={setInvoiceDate}
                maxDate={new Date()}
                clearable
                description="Date on the supplier's invoice"
                styles={{
                  label: { fontWeight: 600, marginBottom: 6 },
                }}
              />
            </Grid.Col>
          </Grid>

          <Textarea
            label="Delivery Notes (Optional)"
            placeholder="e.g. Partial delivery, items inspected, damage noted, etc."
            value={deliveryNotes}
            onChange={(e) => setDeliveryNotes(e.currentTarget.value)}
            minRows={2}
            maxRows={4}
            description="Any notes about the delivery condition or discrepancies"
            styles={{
              label: { fontWeight: 600, marginBottom: 6 },
            }}
          />
        </Stack>
      </Paper>

      {/* Warning about inventory update */}
      <Alert
        icon={<IconPackage size={16} />}
        color={theme.primaryColor}
        variant="light"
        title="Inventory will be updated"
      >
        Confirming receipt will mark this PO as <strong>Received</strong> and
        automatically update stock levels for all items in this purchase order.
        This action cannot be undone.
      </Alert>

      {error && (
        <Alert
          icon={<IconAlertCircle size={16} />}
          color="red"
          title="Error"
          withCloseButton
          onClose={() => setError('')}
        >
          {error}
        </Alert>
      )}

      <Group
        justify="flex-end"
        mt="sm"
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
          color={theme.primaryColor}
          onClick={handleSubmit}
          loading={loading}
          size="md"
          style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
        >
          Confirm Receipt
        </Button>
      </Group>
    </Stack>
  )
}

export default ReceiveGoodsForm

