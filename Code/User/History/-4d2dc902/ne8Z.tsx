// src/features/sales/components/modals/SaleBatchDetailsModal.tsx
import React, { useState, useEffect } from 'react'
import {
  Stack,
  Group,
  NumberInput,
  Paper,
  Divider,
  Text,
  Button,
  Select,
  Badge,
  Alert,
  Loader,
  Box,
  useMantineTheme,
  useMantineColorScheme,
} from '@mantine/core'
import {
  IconAlertCircle,
  IconCheck,
  IconX,
  IconPackage,
  IconCalendar,
  IconCube,
  IconTag,
} from '@tabler/icons-react'
import { formatCurrency } from '../utils/SalesPOS.utils'

interface BatchOption {
  id: number
  batch_number: string
  quantity_available: number
  selling_price: number
  unit_cost: number
  manufacturing_date?: string
  expiry_date?: string
  is_expired: boolean
}

interface SaleBatchDetailsModalProps {
  itemData?: any
  units?: any[]
  companyId?: number
  storeId?: number
}

export const SaleBatchDetailsModalContent: React.FC<
  SaleBatchDetailsModalProps
> = ({ itemData, units = [], companyId, storeId }) => {
  const theme = useMantineTheme()
  const { colorScheme } = useMantineColorScheme()
  const isDark = colorScheme === 'dark'

  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [unitPrice, setUnitPrice] = useState(0)
  const [discount, setDiscount] = useState(0)
  const [batches, setBatches] = useState<BatchOption[]>([])
  const [isLoadingBatches, setIsLoadingBatches] = useState(false)

  const handlers = (window as any).__saleModalHandlers || {}

  useEffect(() => {
    const loadBatches = async () => {
      if (!itemData?.id || !companyId || !storeId) return
      try {
        setIsLoadingBatches(true)
        const { findAvailableBatchesByProduct } = await import(
          '../data/SalesPOS.queries'
        )
        const batchesData = await findAvailableBatchesByProduct(
          companyId,
          storeId,
          itemData.id,
        )
        setBatches(batchesData)
        if (itemData.batchId) {
          setSelectedBatchId(String(itemData.batchId))
        } else if (batchesData.length > 0) {
          setSelectedBatchId(String(batchesData[0].id))
        }
      } catch (error) {
        console.error('Error loading batches:', error)
      } finally {
        setIsLoadingBatches(false)
      }
    }
    loadBatches()
  }, [itemData?.id, itemData?.batchId, companyId, storeId])

  useEffect(() => {
    if (itemData) {
      setQuantity(itemData.qty || 1)
      setUnitPrice(itemData.price || 0)
      setDiscount(itemData.discount || 0)
    }
  }, [itemData])

  useEffect(() => {
    if (selectedBatchId) {
      const batch = batches.find((b) => String(b.id) === selectedBatchId)
      if (batch) {
        setUnitPrice(batch.selling_price || batch.unit_cost || 0)
      }
    }
  }, [selectedBatchId, batches])

  const selectedBatch = batches.find((b) => String(b.id) === selectedBatchId)
  const subtotal = quantity * unitPrice - discount
  const hasStockError =
    selectedBatch && quantity > selectedBatch.quantity_available

  const getDaysToExpiry = () => {
    if (!selectedBatch?.expiry_date) return null
    const today = new Date()
    const expiry = new Date(selectedBatch.expiry_date)
    return Math.ceil(
      (expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
    )
  }

  const daysToExpiry = getDaysToExpiry()
  const isExpiringSoon =
    daysToExpiry !== null && daysToExpiry > 0 && daysToExpiry <= 60
  const isExpired = daysToExpiry !== null && daysToExpiry <= 0

  const getExpiryStatus = () => {
    if (isExpired) return { color: 'red', label: 'Expired' }
    if (isExpiringSoon)
      return { color: 'orange', label: `${daysToExpiry}d left` }
    return { color: 'green', label: 'Valid' }
  }

  const expiryStatus = selectedBatch?.expiry_date ? getExpiryStatus() : null

  const handleSave = () => {
    if (!selectedBatch || hasStockError) return
    const updatedItem = {
      ...itemData,
      batchId: selectedBatch.id,
      batch: selectedBatch.batch_number,
      qty: quantity,
      price: unitPrice,
      discount: discount,
      subtotal: subtotal,
      cost: selectedBatch.unit_cost || 0,
      mfd: selectedBatch.manufacturing_date || '',
      exp: selectedBatch.expiry_date || '',
      stock: selectedBatch.quantity_available,
    }
    if (handlers.onSaveBatchDetails) handlers.onSaveBatchDetails(updatedItem)
  }

  const handleCancel = () => {
    if (handlers.onCancelBatchDetails) handlers.onCancelBatchDetails()
  }

  const primary = theme.colors[theme.primaryColor]
  const cardBg = isDark ? theme.colors.dark[6] : '#fff'
  const borderColor = isDark ? theme.colors.dark[4] : theme.colors.gray[2]
  const subtleBg = isDark ? theme.colors.dark[7] : theme.colors.gray[0]

  return (
    <Stack gap="sm">
      {/* ── Product Header ── */}
      <Paper
        p="sm"
        radius="md"
        withBorder
        style={{
          background: isDark
            ? `linear-gradient(135deg, ${theme.colors.dark[6]}, ${theme.colors.dark[5]})`
            : `linear-gradient(135deg, ${primary[0]}, ${primary[1]})`,
          borderColor: isDark ? theme.colors.dark[4] : primary[2],
        }}
      >
        <Group
          justify="space-between"
          wrap="nowrap"
          gap="xs"
        >
          <Group
            gap="sm"
            wrap="nowrap"
            style={{ minWidth: 0 }}
          >
            <Box
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: isDark ? theme.colors.dark[4] : primary[1],
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                border: `1px solid ${isDark ? theme.colors.dark[3] : primary[3]}`,
              }}
            >
              <IconPackage
                size={18}
                color={primary[6]}
              />
            </Box>
            <Box style={{ minWidth: 0 }}>
              <Text
                size="sm"
                fw={700}
                lineClamp={1}
                style={{ lineHeight: 1.2 }}
              >
                {itemData?.name || 'Product'}
              </Text>
              {itemData?.genericName && (
                <Text
                  size="xs"
                  c="dimmed"
                  lineClamp={1}
                  mt={1}
                >
                  {itemData.genericName}
                </Text>
              )}
            </Box>
          </Group>
          <Group
            gap={6}
            wrap="nowrap"
            style={{ flexShrink: 0 }}
          >
            {itemData?.unit && (
              <Badge
                size="xs"
                variant="outline"
                color={theme.primaryColor}
              >
                {itemData.unit}
              </Badge>
            )}
            <Badge
              size="sm"
              variant="filled"
              color={theme.primaryColor}
            >
              {itemData?.code || 'N/A'}
            </Badge>
          </Group>
        </Group>
      </Paper>

      {/* ── Batch Selection ── */}
      {isLoadingBatches ? (
        <Group
          justify="center"
          py="xl"
        >
          <Loader
            size="sm"
            color={theme.primaryColor}
          />
          <Text
            size="sm"
            c="dimmed"
          >
            Loading batches…
          </Text>
        </Group>
      ) : batches.length === 0 ? (
        <Alert
          icon={<IconAlertCircle size={16} />}
          color="red"
          title="No Stock Available"
          radius="md"
        >
          No available batches found for this product.
        </Alert>
      ) : (
        <>
          <Select
            label="Batch"
            description="FEFO — First Expired, First Out"
            placeholder="Choose a batch"
            value={selectedBatchId}
            onChange={setSelectedBatchId}
            data={batches.map((batch) => ({
              value: String(batch.id),
              label: `${batch.batch_number}  ·  Qty: ${batch.quantity_available}  ·  ${formatCurrency(batch.selling_price || batch.unit_cost)}`,
            }))}
            required
            searchable
            size="sm"
            radius="md"
            styles={{
              label: { fontWeight: 600 },
              description: { fontSize: 11 },
            }}
          />

          {selectedBatch && (
            <>
              {/* ── Batch Details + Inputs side by side ── */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 10,
                }}
              >
                {/* LEFT — Batch Info Card */}
                <Paper
                  p="sm"
                  radius="md"
                  withBorder
                  style={{ backgroundColor: subtleBg, borderColor }}
                >
                  <Stack gap={6}>
                    {/* Header row */}
                    <Group
                      justify="space-between"
                      align="center"
                    >
                      <Text
                        size="xs"
                        fw={700}
                        tt="uppercase"
                        c="dimmed"
                        style={{ letterSpacing: '0.05em' }}
                      >
                        Batch Info
                      </Text>
                      {expiryStatus && (
                        <Badge
                          size="xs"
                          color={expiryStatus.color}
                          variant="filled"
                          radius="sm"
                        >
                          {expiryStatus.label}
                        </Badge>
                      )}
                    </Group>

                    <Divider color={borderColor} />

                    {/* Info rows */}
                    {[
                      {
                        icon: <IconCube size={12} />,
                        label: 'Batch #',
                        value: selectedBatch.batch_number,
                        valueColor: undefined,
                        valueFw: 600,
                      },
                      {
                        icon: <IconTag size={12} />,
                        label: 'Available',
                        value: `${selectedBatch.quantity_available} ${itemData?.unit || 'units'}`,
                        valueColor:
                          selectedBatch.quantity_available <= 10
                            ? 'red'
                            : theme.primaryColor,
                        valueFw: 700,
                      },
                      ...(selectedBatch.manufacturing_date
                        ? [
                            {
                              icon: <IconCalendar size={12} />,
                              label: 'Mfg. Date',
                              value: new Date(
                                selectedBatch.manufacturing_date,
                              ).toLocaleDateString(),
                              valueColor: undefined,
                              valueFw: 400,
                            },
                          ]
                        : []),
                      ...(selectedBatch.expiry_date
                        ? [
                            {
                              icon: <IconCalendar size={12} />,
                              label: 'Expiry',
                              value: new Date(
                                selectedBatch.expiry_date,
                              ).toLocaleDateString(),
                              valueColor: isExpiringSoon
                                ? 'orange'
                                : isExpired
                                  ? 'red'
                                  : undefined,
                              valueFw: isExpiringSoon || isExpired ? 600 : 400,
                            },
                          ]
                        : []),
                    ].map((row, i) => (
                      <Group
                        key={i}
                        justify="space-between"
                        wrap="nowrap"
                        gap={4}
                      >
                        <Group
                          gap={4}
                          wrap="nowrap"
                        >
                          <Box c="dimmed">{row.icon}</Box>
                          <Text
                            size="xs"
                            c="dimmed"
                          >
                            {row.label}
                          </Text>
                        </Group>
                        <Text
                          size="xs"
                          fw={row.valueFw}
                          c={row.valueColor}
                          style={{ textAlign: 'right' }}
                        >
                          {row.value}
                        </Text>
                      </Group>
                    ))}

                    <Divider color={borderColor} />

                    {/* Unit Price highlighted */}
                    <Group
                      justify="space-between"
                      align="center"
                    >
                      <Text
                        size="xs"
                        c="dimmed"
                      >
                        Unit Price
                      </Text>
                      <Text
                        size="sm"
                        fw={800}
                        c={theme.primaryColor}
                      >
                        {formatCurrency(
                          selectedBatch.selling_price ||
                            selectedBatch.unit_cost,
                        )}
                      </Text>
                    </Group>
                  </Stack>
                </Paper>

                {/* RIGHT — Inputs */}
                <Stack gap={8}>
                  <NumberInput
                    label="Quantity"
                    description={`Stock: ${selectedBatch.quantity_available} ${itemData?.unit || ''}`}
                    value={quantity}
                    onChange={(value) => setQuantity(Number(value) || 0)}
                    min={1}
                    max={selectedBatch.quantity_available}
                    required
                    size="sm"
                    radius="md"
                    error={
                      hasStockError
                        ? `Max: ${selectedBatch.quantity_available}`
                        : undefined
                    }
                    styles={{
                      label: { fontWeight: 600 },
                      description: { fontSize: 11 },
                    }}
                  />
                  <NumberInput
                    label="Unit Price"
                    value={unitPrice}
                    onChange={(value) => setUnitPrice(Number(value) || 0)}
                    min={0}
                    prefix="UGX "
                    decimalScale={2}
                    required
                    size="sm"
                    radius="md"
                    styles={{ label: { fontWeight: 600 } }}
                  />
                  <NumberInput
                    label="Discount"
                    value={discount}
                    onChange={(value) => setDiscount(Number(value) || 0)}
                    min={0}
                    max={quantity * unitPrice}
                    prefix="UGX "
                    decimalScale={2}
                    size="sm"
                    radius="md"
                    placeholder="0"
                    styles={{ label: { fontWeight: 600 } }}
                  />
                </Stack>
              </div>

              {/* ── Expiry Warning ── */}
              {(isExpiringSoon || isExpired) && (
                <Alert
                  icon={<IconAlertCircle size={14} />}
                  color={isExpired ? 'red' : 'orange'}
                  py={8}
                  px="sm"
                  radius="md"
                  styles={{
                    title: { fontSize: 12, fontWeight: 700 },
                    message: { fontSize: 12 },
                  }}
                  title={isExpired ? 'Batch Expired' : 'Expiring Soon'}
                >
                  {isExpired
                    ? 'This batch has expired. Select a different batch.'
                    : `This batch expires in ${daysToExpiry} days. Ensure proper stock rotation.`}
                </Alert>
              )}

              {/* ── Subtotal Bar ── */}
              <Paper
                p="sm"
                radius="md"
                withBorder
                style={{
                  background: isDark
                    ? `linear-gradient(135deg, ${theme.colors.dark[6]}, ${theme.colors.dark[5]})`
                    : `linear-gradient(135deg, ${primary[0]}, ${primary[1]})`,
                  borderColor: isDark ? theme.colors.dark[4] : primary[3],
                }}
              >
                <Group
                  justify="space-between"
                  align="center"
                  wrap="nowrap"
                >
                  <Stack gap={2}>
                    <Text
                      size="xs"
                      c="dimmed"
                      fw={500}
                    >
                      Order Total
                    </Text>
                    <Group
                      gap={6}
                      wrap="nowrap"
                    >
                      <Text
                        size="xs"
                        c="dimmed"
                      >
                        {quantity} × {formatCurrency(unitPrice)}
                      </Text>
                      {discount > 0 && (
                        <Text
                          size="xs"
                          c="red"
                          fw={600}
                        >
                          − {formatCurrency(discount)}
                        </Text>
                      )}
                    </Group>
                  </Stack>
                  <Text
                    size="xl"
                    fw={800}
                    c={theme.primaryColor}
                    style={{ letterSpacing: '-0.02em' }}
                  >
                    {formatCurrency(subtotal)}
                  </Text>
                </Group>
              </Paper>

              {/* ── Action Buttons ── */}
              <Group
                justify="flex-end"
                gap="sm"
                pt={2}
              >
                <Button
                  variant="default"
                  onClick={handleCancel}
                  leftSection={<IconX size={15} />}
                  size="sm"
                  radius="md"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  color={theme.primaryColor}
                  disabled={
                    !selectedBatchId ||
                    !!hasStockError ||
                    quantity <= 0 ||
                    isExpired
                  }
                  leftSection={<IconCheck size={15} />}
                  size="sm"
                  radius="md"
                >
                  Add to Cart
                </Button>
              </Group>
            </>
          )}
        </>
      )}
    </Stack>
  )
}

export default SaleBatchDetailsModalContent

