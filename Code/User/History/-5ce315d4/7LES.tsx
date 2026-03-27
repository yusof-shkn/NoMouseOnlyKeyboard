// components/ReceiveGoodsForm.tsx
// Supports BOTH first delivery and subsequent partial deliveries.
//
// KEY RULES:
//  1. quantityToReceive = amount arriving TODAY (not a running total).
//  2. product_batches.quantity_received = new cumulative total (existing + today's delta).
//     DB trigger reads OLD vs NEW → gets delta → corrects quantity_available
//     → updates purchase_order_items → flips PO status automatically.
//  3. purchase_orders.status is NEVER set by frontend — trigger decides:
//       all items done  → 'received'
//       some items done → 'partially_received'
//  4. purchase_order_items.quantity_received is NEVER written by frontend —
//     the DB trigger owns it (writes the SUM of all batches).
//  5. Only items with remaining qty > 0 are shown.

import { useState, useEffect } from 'react'
import { useDispatch } from 'react-redux'
import {
  Stack,
  Text,
  TextInput,
  NumberInput,
  Textarea,
  Button,
  Group,
  Paper,
  Grid,
  Alert,
  Box,
  Select,
  useMantineTheme,
  useMantineColorScheme,
  ThemeIcon,
  Badge,
  ScrollArea,
  Accordion,
  Tooltip,
  Progress,
} from '@mantine/core'
import {
  IconPackage,
  IconAlertCircle,
  IconCheck,
  IconFileInvoice,
  IconBuildingWarehouse,
  IconHash,
  IconInfoCircle,
} from '@tabler/icons-react'
import { DateInput } from '@mantine/dates'
import { formatCurrency } from '@shared/utils/formatters'
import { closeModal } from '@shared/components/genericModal/SliceGenericModal'
import { AppDispatch } from '@app/core/store/store'
import { notifications } from '@mantine/notifications'
import { getCurrentUserId } from '@shared/utils/authUtils'
import supabase from '@app/core/supabase/Supabase.utils'

interface ItemBatchEntry {
  poItemId: number
  productId: number
  productName: string
  productCode?: string
  quantityOrdered: number
  /** Received in ALL prior deliveries */
  quantityPreviouslyReceived: number
  /** ordered − previously received */
  quantityRemaining: number
  /** What arrives TODAY — user edits this. Default = full remaining. */
  quantityToReceive: number
  batchNumber: string
  existingBatchId: string | null
  /** Cumulative qty_received already stored in the batch row */
  existingBatchQtyReceived: number
  unitCost: number
  sellingPrice: number
  expiryDate: string
  manufacturingDate: string
  unitId: string | null
}

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
  grossMargin?: number
}

const defaultExpiry = () => {
  const d = new Date()
  d.setFullYear(d.getFullYear() + 2)
  return d.toISOString().split('T')[0]
}
const todayStr = () => new Date().toISOString().split('T')[0]
const isSentinelBatch = (bn: string | null | undefined) =>
  !bn || bn.startsWith('PENDING-') || bn === 'DRAFT-BATCH'

export const ReceiveGoodsForm = ({
  purchaseOrderId,
  poNumber,
  supplierName,
  storeId,
  storeName,
  companyId,
  totalAmount,
  currency,
}: ReceiveGoodsFormProps) => {
  const dispatch = useDispatch<AppDispatch>()
  const theme = useMantineTheme()
  const { colorScheme } = useMantineColorScheme()
  const isDark = colorScheme === 'dark'

  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [invoiceDate, setInvoiceDate] = useState<Date | null>(new Date())
  const [deliveryNotes, setDeliveryNotes] = useState('')
  const [formError, setFormError] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingItems, setLoadingItems] = useState(true)
  const [items, setItems] = useState<ItemBatchEntry[]>([])
  const [itemErrors, setItemErrors] = useState<
    Record<number, Record<string, string>>
  >({})
  const [units, setUnits] = useState<
    Array<{ id: number; name: string; short_code: string }>
  >([])
  const [allRawUnits, setAllRawUnits] = useState<
    Array<{ id: number; name: string; short_code: string; company_id: number }>
  >([])
  const [itemUnitIds, setItemUnitIds] = useState<Record<number, string | null>>(
    {},
  )
  const [userEditedUnits] = useState<Set<number>>(new Set())

  // Fetch units for this company AND master catalog (company 1)
  useEffect(() => {
    if (!companyId) return
    supabase
      .from('units')
      .select('id, name, short_code, company_id')
      .in('company_id', [companyId, 1])
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => {
        if (!data) return
        setAllRawUnits(data)
        // De-duplicate: for same short_code, prefer user's company unit
        const seen = new Map<string, any>()
        for (const u of data) {
          const existing = seen.get(u.short_code)
          if (!existing || u.company_id === companyId) seen.set(u.short_code, u)
        }
        setUnits(
          Array.from(seen.values()).sort((a, b) =>
            a.name.localeCompare(b.name),
          ),
        )
      })
  }, [companyId])

  // Re-resolve unit IDs whenever BOTH units and items are loaded.
  // Handles race condition: items may load before units or vice-versa.
  // Strategy: exact ID match → same short_code lookup (cross-company catalog IDs differ)
  useEffect(() => {
    if (units.length === 0 || items.length === 0) return
    setItemUnitIds((prev) => {
      const next: Record<number, string | null> = { ...prev }
      items.forEach((item, idx) => {
        if (userEditedUnits.has(idx)) return // don't override manual edits
        const rawId = item.unitId
        if (!rawId) return
        // 1. Exact match in deduplicated list
        if (units.some((u) => String(u.id) === rawId)) {
          next[idx] = rawId
          return
        }
        // 2. Cross-company: find the short_code for rawId in ALL raw units, then find matching ID in deduped list
        const rawUnit = allRawUnits.find((u) => String(u.id) === rawId)
        if (rawUnit) {
          const deduped = units.find((u) => u.short_code === rawUnit.short_code)
          if (deduped) {
            next[idx] = String(deduped.id)
            return
          }
        }
        // 3. Fallback: keep original
        next[idx] = rawId
      })
      return next
    })
  }, [units, items])

  useEffect(() => {
    const load = async () => {
      setLoadingItems(true)
      try {
        const { data: poItems, error: poErr } = await supabase
          .from('purchase_order_items')
          .select(
            `
            id, product_id, batch_number, quantity_ordered, quantity_received,
            unit_cost, unit_id, expiry_date, manufacture_date,
            products!inner(product_name, product_code)
          `,
          )
          .eq('purchase_order_id', purchaseOrderId)
        if (poErr) throw poErr

        const { data: existingBatches } = await supabase
          .from('product_batches')
          .select(
            'id, product_id, batch_number, quantity_received, unit_cost, selling_price, unit_id, expiry_date, manufacturing_date',
          )
          .eq('purchase_order_id', purchaseOrderId)
          .eq('store_id', storeId)

        const batchByProduct: Record<number, any> = {}
        for (const b of existingBatches ?? []) {
          batchByProduct[b.product_id] = b
        }

        const entries: ItemBatchEntry[] = []
        for (const item of poItems ?? []) {
          const prevReceived = item.quantity_received ?? 0
          const remaining = item.quantity_ordered - prevReceived
          if (remaining <= 0) continue // fully received — skip

          const eb = batchByProduct[item.product_id] ?? null
          const batchNum =
            eb && !isSentinelBatch(eb.batch_number)
              ? eb.batch_number
              : isSentinelBatch(item.batch_number)
                ? ''
                : (item.batch_number ?? '')

          entries.push({
            poItemId: item.id,
            productId: item.product_id,
            productName: (item.products as any).product_name,
            productCode: (item.products as any).product_code ?? undefined,
            quantityOrdered: item.quantity_ordered,
            quantityPreviouslyReceived: prevReceived,
            quantityRemaining: remaining,
            quantityToReceive: remaining, // default: receive everything remaining
            batchNumber: batchNum,
            existingBatchId: eb?.id ?? null,
            existingBatchQtyReceived: eb?.quantity_received ?? 0,
            unitCost: eb?.unit_cost ?? item.unit_cost ?? 0,
            sellingPrice:
              eb?.selling_price ??
              parseFloat(((item.unit_cost ?? 0) * 1.3).toFixed(2)),
            expiryDate:
              eb?.expiry_date ??
              (item.expiry_date && !isSentinelBatch(item.batch_number)
                ? item.expiry_date
                : defaultExpiry()),
            manufacturingDate:
              eb?.manufacturing_date ??
              (item.manufacture_date && !isSentinelBatch(item.batch_number)
                ? item.manufacture_date
                : todayStr()),
            unitId: eb?.unit_id
              ? String(eb.unit_id)
              : item.unit_id
                ? String(item.unit_id)
                : null,
            grossMargin: (() => {
              const cost = eb?.unit_cost ?? item.unit_cost ?? 0
              const sp =
                eb?.selling_price ?? parseFloat((cost * 1.3).toFixed(2))
              return cost > 0
                ? parseFloat((((sp - cost) / cost) * 100).toFixed(1))
                : 30
            })(),
          })
        }
        setItems(entries)
        // Pre-populate unit selectors from PO item / existing batch unit_id
        const initialUnitIds: Record<number, string | null> = {}
        entries.forEach((e, idx) => {
          if (e.unitId) initialUnitIds[idx] = e.unitId
        })
        setItemUnitIds(initialUnitIds)
      } catch (err: any) {
        setFormError('Failed to load order items: ' + err.message)
      } finally {
        setLoadingItems(false)
      }
    }
    load()
  }, [purchaseOrderId, storeId])

  const updateItem = (
    idx: number,
    field: keyof ItemBatchEntry | 'grossMargin',
    value: any,
  ) => {
    setItems((prev) =>
      prev.map((it, i) => {
        if (i !== idx) return it
        const updated = { ...it, [field]: value }
        // When cost changes: auto-calc selling price at current gross margin (default 30%)
        if (field === 'unitCost' && Number(value) > 0) {
          const margin = (it as any).grossMargin ?? 30
          updated.sellingPrice = parseFloat(
            (Number(value) * (1 + margin / 100)).toFixed(2),
          )
        }
        // When gross margin changes: recalc selling price from cost
        if (field === 'grossMargin' && it.unitCost > 0) {
          updated.sellingPrice = parseFloat(
            (it.unitCost * (1 + Number(value) / 100)).toFixed(2),
          )
        }
        // When selling price changes manually: recalc gross margin display
        // (grossMargin stored separately so it stays in sync)
        if (field === 'sellingPrice' && it.unitCost > 0) {
          const sp = Number(value)
          if (sp > 0) {
            updated.grossMargin = parseFloat(
              (((sp - it.unitCost) / it.unitCost) * 100).toFixed(1),
            )
          }
        }
        return updated
      }),
    )
    setItemErrors((prev) => {
      const copy = { ...prev }
      if (copy[idx]) delete copy[idx][field as string]
      return copy
    })
  }

  const validateAll = (): boolean => {
    if (!invoiceNumber.trim()) {
      setFormError('Invoice number is required')
      return false
    }
    setFormError('')

    const activeItems = items.filter((i) => i.quantityToReceive > 0)
    if (activeItems.length === 0) {
      setFormError('Enter a quantity greater than 0 for at least one item')
      return false
    }

    const newErrors: Record<number, Record<string, string>> = {}
    let hasError = false

    items.forEach((item, idx) => {
      if (item.quantityToReceive === 0) return // skipped — no validation needed
      const errs: Record<string, string> = {}
      if (!item.batchNumber.trim()) {
        errs.batchNumber = 'Required'
        hasError = true
      }
      if (item.quantityToReceive < 0) {
        errs.quantityToReceive = 'Cannot be negative'
        hasError = true
      }
      // Note: quantityToReceive > quantityRemaining is ALLOWED — suppliers may send
      // extra/bonus goods for marketing. The UI shows a warning but doesn't block.
      if (!item.expiryDate) {
        errs.expiryDate = 'Required'
        hasError = true
      }
      if (!item.manufacturingDate) {
        errs.manufacturingDate = 'Required'
        hasError = true
      }
      if (item.sellingPrice <= 0) {
        errs.sellingPrice = 'Required'
        hasError = true
      }
      // No hard block on selling price < cost — user may intentionally sell at a loss
      if (Object.keys(errs).length) newErrors[idx] = errs
    })

    setItemErrors(newErrors)
    return !hasError
  }

  const handleSubmit = async () => {
    setFormError('')
    if (!validateAll()) return
    setLoading(true)

    try {
      const userId = await getCurrentUserId()
      if (!userId) {
        setFormError('Not authenticated')
        setLoading(false)
        return
      }

      notifications.show({
        id: 'receiving-goods',
        title: 'Recording Delivery…',
        message: 'Updating inventory and accounts',
        loading: true,
        autoClose: false,
      })

      const activeItems = items.filter((i) => i.quantityToReceive > 0)

      for (const item of activeItems) {
        // Resolve unit_id: use the per-item unit selector value
        const resolvedUnitId = (() => {
          const originalIdx = items.indexOf(item)
          const uid = itemUnitIds[originalIdx] ?? item.unitId
          return uid ? parseInt(uid) : null
        })()
        // New cumulative total = prior received + today's quantity
        const newCumulative =
          item.existingBatchQtyReceived + item.quantityToReceive

        if (item.existingBatchId) {
          // ── UPDATE: write new cumulative quantity_received.
          // Do NOT write quantity_available — the DB trigger corrects it to:
          //   OLD.quantity_available + delta
          // preserving any stock already sold from this batch.
          const { error: batchErr } = await supabase
            .from('product_batches')
            .update({
              batch_number: item.batchNumber,
              quantity_received: newCumulative,
              // quantity_available intentionally omitted — DB trigger owns it
              unit_cost: item.unitCost,
              selling_price: item.sellingPrice,
              unit_id: resolvedUnitId,
              manufacturing_date: item.manufacturingDate || null,
              expiry_date: item.expiryDate || null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', item.existingBatchId)
          if (batchErr) throw batchErr
        } else {
          // ── INSERT: first delivery for this product.
          // quantity_available = quantity_received = today's qty (no prior stock).
          const { error: insertErr } = await supabase
            .from('product_batches')
            .insert({
              company_id: companyId,
              store_id: storeId,
              product_id: item.productId,
              batch_number: item.batchNumber,
              purchase_order_id: purchaseOrderId,
              quantity_received: item.quantityToReceive,
              quantity_available: item.quantityToReceive,
              unit_cost: item.unitCost,
              selling_price: item.sellingPrice,
              unit_id: resolvedUnitId,
              manufacturing_date: item.manufacturingDate || null,
              expiry_date: item.expiryDate || null,
              created_at: new Date().toISOString(),
            })
          if (insertErr) throw insertErr
        }
        // After the batch INSERT/UPDATE, the DB trigger chain fires:
        //   sync_po_item_received_quantity:
        //     delta = NEW.qty_received - OLD.qty_received
        //     SET quantity_available = OLD.qty_available + delta  (sold stock preserved)
        //     UPDATE purchase_order_items SET quantity_received = SUM(batches)
        //     UPDATE purchase_orders:
        //       all items done → status='received'
        //       some remaining → status='partially_received'
        //     BEFORE trigger: fn_create_purchase_journal_entry
        //       DR Inventory (delta cost) / CR AP (delta cost)  — this delivery only
        //     AFTER trigger: fn_create_expense_from_po
        //       Expense for this delivery's cost only
      }

      // Write PO metadata — the trigger sets status, we set received_at here
      const totalReceived = activeItems.reduce(
        (s, i) => s + i.quantityToReceive,
        0,
      )
      // allDone = every item now has enough received (quantityPreviouslyReceived + today >= ordered)
      const allDone = items.every(
        (i) =>
          i.existingBatchQtyReceived + i.quantityToReceive >= i.quantityOrdered,
      )

      const { error: poErr } = await supabase
        .from('purchase_orders')
        .update({
          received_by: userId,
          invoice_number: invoiceNumber.trim(),
          invoice_date: invoiceDate?.toISOString() ?? new Date().toISOString(),
          delivery_notes: deliveryNotes.trim() || null,
          // Set received_at on full receipt — trigger also sets it but frontend is the source of truth here
          ...(allDone ? { received_at: new Date().toISOString() } : {}),
          updated_at: new Date().toISOString(),
        })
        .eq('id', purchaseOrderId)
      if (poErr) throw poErr

      notifications.hide('receiving-goods')
      window.dispatchEvent(new CustomEvent('purchaseOrderUpdated'))

      notifications.show({
        title: allDone ? 'All Goods Received ✓' : 'Partial Delivery Recorded ✓',
        message: allDone
          ? `PO ${poNumber} fully received. Inventory and accounts updated.`
          : `${totalReceived} unit(s) received for PO ${poNumber}. Remaining items still pending.`,
        color: allDone ? 'green' : 'blue',
        autoClose: 5000,
      })

      dispatch(closeModal())
    } catch (err: any) {
      console.error('❌ Receive goods error:', err)
      notifications.hide('receiving-goods')
      setFormError(err.message || 'Failed to receive goods.')
    } finally {
      setLoading(false)
    }
  }

  const bg = isDark ? theme.colors.dark[6] : theme.white
  const borderColor = isDark ? theme.colors.dark[4] : theme.colors.gray[3]
  const inputStyles = { input: { backgroundColor: bg, borderColor } }
  const totalUnitsNow = items.reduce(
    (s, i) => s + (i.quantityToReceive || 0),
    0,
  )

  return (
    <Stack gap="md">
      {/* PO Header */}
      <Paper
        p="md"
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
        <Group mb="sm">
          <ThemeIcon
            size={44}
            radius="md"
            variant="light"
            color={theme.primaryColor}
          >
            <IconBuildingWarehouse size={26} />
          </ThemeIcon>
          <Box>
            <Text
              size="xs"
              c="dimmed"
              tt="uppercase"
              fw={700}
              style={{ letterSpacing: '0.5px' }}
            >
              Receiving From
            </Text>
            <Text
              size="lg"
              fw={700}
              c={
                isDark
                  ? theme.colors[theme.primaryColor][4]
                  : theme.colors[theme.primaryColor][8]
              }
            >
              {supplierName}
            </Text>
          </Box>
        </Group>
        <Grid gutter="xs">
          {[
            { label: 'PO Number', value: poNumber },
            { label: 'Store', value: storeName },
            {
              label: 'Order Value',
              value: formatCurrency(totalAmount, currency),
            },
            {
              label: 'Pending Items',
              value: loadingItems ? '…' : String(items.length),
            },
          ].map((col) => (
            <Grid.Col
              span={3}
              key={col.label}
            >
              <Text
                size="xs"
                c="dimmed"
                tt="uppercase"
                fw={700}
                style={{ letterSpacing: '0.5px' }}
              >
                {col.label}
              </Text>
              <Text
                size="sm"
                fw={600}
                mt={2}
              >
                {col.value}
              </Text>
            </Grid.Col>
          ))}
        </Grid>
      </Paper>

      {/* Invoice Details */}
      <Paper
        p="md"
        withBorder
        radius="md"
        style={{ backgroundColor: bg, borderColor }}
      >
        <Group
          mb="sm"
          gap="xs"
        >
          <ThemeIcon
            size={26}
            radius="sm"
            variant="light"
            color={theme.primaryColor}
          >
            <IconFileInvoice size={15} />
          </ThemeIcon>
          <Text
            fw={600}
            size="sm"
          >
            Supplier Invoice Details
          </Text>
        </Group>
        <Grid>
          <Grid.Col span={7}>
            <TextInput
              label="Invoice Number"
              placeholder="e.g. INV-2024-00123"
              required
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.currentTarget.value)}
              leftSection={<IconFileInvoice size={15} />}
              styles={inputStyles}
            />
          </Grid.Col>
          <Grid.Col span={5}>
            <DateInput
              label="Invoice Date"
              value={invoiceDate}
              onChange={setInvoiceDate}
              maxDate={new Date()}
              clearable
              styles={inputStyles}
            />
          </Grid.Col>
          <Grid.Col span={12}>
            <Textarea
              label="Delivery Notes (Optional)"
              placeholder="Condition of delivery, damages, partial delivery reason…"
              value={deliveryNotes}
              onChange={(e) => setDeliveryNotes(e.currentTarget.value)}
              minRows={2}
              maxRows={3}
              styles={inputStyles}
            />
          </Grid.Col>
        </Grid>
      </Paper>

      {/* Per-item Batch Entry */}
      <Paper
        p="md"
        withBorder
        radius="md"
        style={{ backgroundColor: bg, borderColor }}
      >
        <Group
          mb="sm"
          gap="xs"
          justify="space-between"
        >
          <Group gap="xs">
            <ThemeIcon
              size={26}
              radius="sm"
              variant="light"
              color="teal"
            >
              <IconPackage size={15} />
            </ThemeIcon>
            <Text
              fw={600}
              size="sm"
            >
              Items — Enter Today's Quantities
            </Text>
          </Group>
          <Tooltip label="Only items with remaining quantities are shown. 'Qty Today' = what physically arrived this delivery. Can be less than the remaining balance.">
            <IconInfoCircle
              size={18}
              color={theme.colors.gray[5]}
              style={{ cursor: 'help' }}
            />
          </Tooltip>
        </Group>

        {loadingItems ? (
          <Text
            c="dimmed"
            ta="center"
            py="md"
            size="sm"
          >
            Loading items…
          </Text>
        ) : items.length === 0 ? (
          <Alert
            color="green"
            icon={<IconCheck size={16} />}
          >
            All items on this PO have been fully received.
          </Alert>
        ) : (
          <ScrollArea.Autosize mah={460}>
            <Accordion
              variant="separated"
              defaultValue={items[0] ? String(items[0].poItemId) : undefined}
            >
              {items.map((item, idx) => {
                const errs = itemErrors[idx] || {}
                const hasErrs = Object.keys(errs).length > 0
                const complete =
                  !!item.batchNumber && !hasErrs && item.quantityToReceive > 0
                const pct = Math.round(
                  (item.quantityPreviouslyReceived / item.quantityOrdered) *
                    100,
                )

                return (
                  <Accordion.Item
                    key={item.poItemId}
                    value={String(item.poItemId)}
                    style={{
                      borderColor: hasErrs
                        ? theme.colors.red[5]
                        : !item.batchNumber
                          ? theme.colors.orange[4]
                          : borderColor,
                      borderWidth: hasErrs || !item.batchNumber ? 2 : 1,
                    }}
                  >
                    <Accordion.Control>
                      <Group
                        gap="sm"
                        justify="space-between"
                        pr="sm"
                        wrap="nowrap"
                      >
                        <Box style={{ flex: 1, minWidth: 0 }}>
                          <Group
                            gap="xs"
                            mb={4}
                          >
                            <Text
                              size="sm"
                              fw={600}
                              lineClamp={1}
                            >
                              {item.productName}
                            </Text>
                            {item.productCode && (
                              <Badge
                                size="xs"
                                variant="light"
                                color="gray"
                              >
                                {item.productCode}
                              </Badge>
                            )}
                          </Group>
                          {item.quantityPreviouslyReceived > 0 && (
                            <Group
                              gap={6}
                              align="center"
                            >
                              <Progress
                                value={pct}
                                size="xs"
                                color="blue"
                                style={{ flex: 1, maxWidth: 120 }}
                              />
                              <Text
                                size="xs"
                                c="dimmed"
                              >
                                {item.quantityPreviouslyReceived}/
                                {item.quantityOrdered} already received
                              </Text>
                            </Group>
                          )}
                        </Box>
                        <Group
                          gap="xs"
                          wrap="nowrap"
                        >
                          <Badge
                            size="sm"
                            variant="light"
                            color="orange"
                          >
                            {item.quantityRemaining} remaining
                          </Badge>
                          {hasErrs ? (
                            <Badge
                              size="sm"
                              color="red"
                            >
                              Fix errors
                            </Badge>
                          ) : complete ? (
                            <Badge
                              size="sm"
                              color="green"
                            >
                              ✓ Ready
                            </Badge>
                          ) : item.quantityToReceive === 0 ? (
                            <Badge
                              size="sm"
                              color="gray"
                            >
                              Skipped
                            </Badge>
                          ) : (
                            <Badge
                              size="sm"
                              color="orange"
                            >
                              Fill in
                            </Badge>
                          )}
                        </Group>
                      </Group>
                    </Accordion.Control>

                    <Accordion.Panel>
                      <Stack
                        gap="sm"
                        pt="xs"
                      >
                        <Grid
                          gutter="sm"
                          align="flex-start"
                        >
                          {/* Row 1: Batch Number (8) + Qty Today (4) */}
                          <Grid.Col span={8}>
                            <TextInput
                              label="Batch Number"
                              required={item.quantityToReceive > 0}
                              placeholder="e.g. BN-2024-001"
                              value={item.batchNumber}
                              onChange={(e) =>
                                updateItem(
                                  idx,
                                  'batchNumber',
                                  e.currentTarget.value,
                                )
                              }
                              leftSection={<IconHash size={14} />}
                              error={errs.batchNumber}
                              styles={inputStyles}
                            />
                          </Grid.Col>
                          <Grid.Col span={4}>
                            <NumberInput
                              label={
                                <Group
                                  gap={4}
                                  wrap="nowrap"
                                >
                                  <span>Qty Today</span>
                                  {item.quantityToReceive >
                                  item.quantityRemaining ? (
                                    <Badge
                                      size="xs"
                                      color="orange"
                                      variant="light"
                                    >
                                      +
                                      {item.quantityToReceive -
                                        item.quantityRemaining}{' '}
                                      bonus
                                    </Badge>
                                  ) : (
                                    <Badge
                                      size="xs"
                                      color="gray"
                                      variant="light"
                                    >
                                      {item.quantityRemaining} left
                                    </Badge>
                                  )}
                                </Group>
                              }
                              value={item.quantityToReceive}
                              onChange={(v) =>
                                updateItem(
                                  idx,
                                  'quantityToReceive',
                                  Number(v) || 0,
                                )
                              }
                              min={0}
                              error={errs.quantityToReceive}
                              styles={inputStyles}
                            />
                          </Grid.Col>
                          {/* Row 2: Cost Price (6) + Unit (6) */}
                          <Grid.Col span={6}>
                            <NumberInput
                              label="Cost Price"
                              value={item.unitCost}
                              onChange={(v) =>
                                updateItem(idx, 'unitCost', Number(v) || 0)
                              }
                              min={0}
                              prefix={`${currency} `}
                              decimalScale={2}
                              thousandSeparator=","
                              error={errs.unitCost}
                              styles={inputStyles}
                            />
                          </Grid.Col>
                          <Grid.Col span={6}>
                            <Select
                              label="Unit"
                              placeholder="Search unit (e.g. Tabs, Syrup)..."
                              data={units.map((u) => ({
                                value: String(u.id),
                                label: `${u.short_code} — ${u.name}`,
                              }))}
                              value={itemUnitIds[idx] ?? null}
                              onChange={(v) => {
                                userEditedUnits.add(idx)
                                setItemUnitIds((prev) => ({
                                  ...prev,
                                  [idx]: v,
                                }))
                              }}
                              clearable
                              searchable
                              nothingFoundMessage="No matching unit"
                              styles={inputStyles}
                            />
                          </Grid.Col>
                          {/* Row 3: Gross Margin (6) + Selling Price (6) */}
                          <Grid.Col span={6}>
                            <NumberInput
                              label={
                                <Group
                                  gap={4}
                                  wrap="nowrap"
                                >
                                  <span>Gross Margin</span>
                                  <Badge
                                    size="xs"
                                    color="blue"
                                    variant="light"
                                  >
                                    %
                                  </Badge>
                                </Group>
                              }
                              value={(item as any).grossMargin ?? 30}
                              onChange={(v) =>
                                updateItem(idx, 'grossMargin', Number(v) || 0)
                              }
                              min={-100}
                              max={10000}
                              decimalScale={1}
                              suffix="%"
                              styles={{
                                input: {
                                  ...inputStyles.input,
                                  color: theme.colors.blue[6],
                                },
                              }}
                            />
                          </Grid.Col>
                          <Grid.Col span={6}>
                            <NumberInput
                              label={
                                <Group
                                  gap={4}
                                  wrap="nowrap"
                                  align="center"
                                  style={{
                                    flexWrap: 'nowrap',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  <span>Selling Price</span>
                                  <span
                                    style={{
                                      color: 'var(--mantine-color-red-6)',
                                    }}
                                  >
                                    *
                                  </span>
                                  {item.unitCost > 0 &&
                                    item.sellingPrice <= item.unitCost && (
                                      <Tooltip
                                        label="Below cost — selling at a loss"
                                        withArrow
                                      >
                                        <Badge
                                          size="xs"
                                          color="orange"
                                          variant="light"
                                          style={{ flexShrink: 0 }}
                                        >
                                          ⚠ below cost
                                        </Badge>
                                      </Tooltip>
                                    )}
                                </Group>
                              }
                              value={item.sellingPrice}
                              onChange={(v) =>
                                updateItem(idx, 'sellingPrice', Number(v) || 0)
                              }
                              min={0}
                              prefix={`${currency} `}
                              decimalScale={2}
                              thousandSeparator=","
                              error={errs.sellingPrice}
                              styles={{
                                input: {
                                  ...inputStyles.input,
                                  fontWeight: 600,
                                  color:
                                    item.unitCost > 0 &&
                                    item.sellingPrice <= item.unitCost
                                      ? theme.colors.orange[6]
                                      : theme.colors.green[6],
                                },
                              }}
                            />
                          </Grid.Col>
                          {/* Row 4: Mfg Date (6) + Expiry Date (6) */}
                          <Grid.Col span={6}>
                            <TextInput
                              label="Mfg Date"
                              type="date"
                              required={item.quantityToReceive > 0}
                              value={item.manufacturingDate}
                              onChange={(e) =>
                                updateItem(
                                  idx,
                                  'manufacturingDate',
                                  e.currentTarget.value,
                                )
                              }
                              error={errs.manufacturingDate}
                              styles={inputStyles}
                            />
                          </Grid.Col>
                          <Grid.Col span={6}>
                            <TextInput
                              label="Expiry Date"
                              type="date"
                              required={item.quantityToReceive > 0}
                              value={item.expiryDate}
                              onChange={(e) =>
                                updateItem(
                                  idx,
                                  'expiryDate',
                                  e.currentTarget.value,
                                )
                              }
                              error={errs.expiryDate}
                              styles={inputStyles}
                            />
                          </Grid.Col>
                          {/* Row 5: Margin summary bar (visible when cost > 0) */}
                          {item.unitCost > 0 && (
                            <Grid.Col span={12}>
                              <Paper
                                p="xs"
                                withBorder
                                radius="sm"
                                style={{
                                  backgroundColor:
                                    item.sellingPrice > item.unitCost
                                      ? isDark
                                        ? theme.colors.green[9]
                                        : theme.colors.green[0]
                                      : isDark
                                        ? theme.colors.orange[9]
                                        : theme.colors.orange[0],
                                  borderColor:
                                    item.sellingPrice > item.unitCost
                                      ? isDark
                                        ? theme.colors.green[7]
                                        : theme.colors.green[3]
                                      : isDark
                                        ? theme.colors.orange[7]
                                        : theme.colors.orange[3],
                                }}
                              >
                                <Group justify="space-between">
                                  <Text
                                    size="xs"
                                    fw={600}
                                    c={
                                      item.sellingPrice > item.unitCost
                                        ? 'green'
                                        : 'orange'
                                    }
                                  >
                                    {item.sellingPrice > item.unitCost
                                      ? `✓ ${(((item.sellingPrice - item.unitCost) / item.unitCost) * 100).toFixed(1)}% margin`
                                      : item.sellingPrice === item.unitCost
                                        ? '⚠ Break-even (0% margin)'
                                        : `⚠ Loss: ${(((item.sellingPrice - item.unitCost) / item.unitCost) * 100).toFixed(1)}%`}
                                  </Text>
                                  <Text
                                    size="xs"
                                    c={
                                      item.sellingPrice > item.unitCost
                                        ? 'green'
                                        : 'orange'
                                    }
                                  >
                                    {formatCurrency(
                                      Math.abs(
                                        item.sellingPrice - item.unitCost,
                                      ),
                                      currency,
                                    )}
                                    /unit
                                    {item.quantityToReceive > 0 && (
                                      <>
                                        {' '}
                                        ·{' '}
                                        {item.sellingPrice > item.unitCost
                                          ? 'profit'
                                          : 'loss'}
                                        :{' '}
                                        {formatCurrency(
                                          Math.abs(
                                            item.sellingPrice - item.unitCost,
                                          ) * item.quantityToReceive,
                                          currency,
                                        )}
                                      </>
                                    )}
                                  </Text>
                                </Group>
                              </Paper>
                            </Grid.Col>
                          )}
                        </Grid>
                      </Stack>
                    </Accordion.Panel>
                  </Accordion.Item>
                )
              })}
            </Accordion>
          </ScrollArea.Autosize>
        )}
      </Paper>

      <Alert
        icon={<IconPackage size={16} />}
        color={theme.primaryColor}
        variant="light"
        title="How partial deliveries work"
      >
        Enter only what arrived <strong>today</strong>. You can receive the rest
        later — PO stays <em>Partially Received</em> until all quantities are
        complete. Each delivery creates its own journal entry and expense
        automatically.
      </Alert>

      {formError && (
        <Alert
          icon={<IconAlertCircle size={16} />}
          color="red"
          title="Error"
          withCloseButton
          onClose={() => setFormError('')}
        >
          {formError}
        </Alert>
      )}

      <Group
        justify="flex-end"
        mt="sm"
      >
        <Button
          variant="subtle"
          color="gray"
          onClick={() => dispatch(closeModal())}
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
          disabled={loadingItems || items.length === 0}
          size="md"
        >
          Confirm Receipt ({totalUnitsNow} unit{totalUnitsNow !== 1 ? 's' : ''})
        </Button>
      </Group>
    </Stack>
  )
}

export default ReceiveGoodsForm

