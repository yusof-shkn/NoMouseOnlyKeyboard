// components/PartialReturnModal.tsx
// Allows cashiers/admins to return a partial quantity of one or more items.
// The DB already has `quantity_returned` in `sales_return_items` — this UI
// makes that field usable.

import React, { useState } from 'react'
import {
  Stack,
  Group,
  Text,
  Badge,
  NumberInput,
  Button,
  Divider,
  Paper,
  Alert,
  Textarea,
  useMantineTheme,
  useMantineColorScheme,
  ScrollArea,
} from '@mantine/core'
import {
  IconAlertCircle,
  IconCheck,
  IconX,
  IconArrowBackUp,
} from '@tabler/icons-react'
import { supabase } from '@app/core/supabase/Supabase.utils'
import { notifications } from '@mantine/notifications'
import { getCurrentUserRoleId } from '@shared/utils/authUtils'
import { formatCompactCurrency } from '@shared/utils/formatters'
import { Role } from '@shared/constants/roles'
import { useSelector } from 'react-redux'
import { selectDefaultCurrency } from '@features/authentication/authSlice'

interface ReturnItem {
  id: number // sale_item_id
  product_id: number
  batch_id: number
  batch_number: string
  product_name: string
  quantity: number // original qty sold
  quantity_already_returned: number
  unit_price: number
  total_price: number
}

interface PartialReturnModalProps {
  sale: {
    id: number
    sale_number: string
    company_id: number
    store_id: number
    payment_method: string
    customer_id?: number
    customers?: {
      current_credit_balance?: number
      available_credit?: number
    }
    credit_transaction_id?: number
    total_amount: number
  }
  saleItems: ReturnItem[]
  requiresApproval: boolean
  // onSuccess and onCancel are read from window.__returnHandlers
  // to avoid Redux serialization errors (cannot store functions in Redux state)
}

export const PartialReturnModalContent: React.FC<PartialReturnModalProps> = ({
  sale,
  saleItems,
  requiresApproval,
}) => {
  const currency = useSelector(selectDefaultCurrency)

  // Read callbacks from window to avoid Redux non-serializable warning
  const onSuccess = () => (window as any).__returnHandlers?.onSuccess?.()
  const onCancel = () => (window as any).__returnHandlers?.onCancel?.()

  const theme = useMantineTheme()
  const { colorScheme } = useMantineColorScheme()
  const isDark = colorScheme === 'dark'

  // qty to return per item (keyed by sale_item_id)
  const [returnQtys, setReturnQtys] = useState<Record<number, number>>(() =>
    Object.fromEntries(saleItems.map((i) => [i.id, 0])),
  )
  const [returnReason, setReturnReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const totalRefund = saleItems.reduce((sum, item) => {
    const qty = returnQtys[item.id] ?? 0
    return sum + qty * item.unit_price
  }, 0)

  const hasAnyQty = Object.values(returnQtys).some((q) => q > 0)

  const handleSubmit = async () => {
    if (!hasAnyQty) return
    if (!returnReason.trim()) {
      notifications.show({
        title: 'Reason Required',
        message: 'Please enter a reason for the return',
        color: 'orange',
      })
      return
    }

    setIsSubmitting(true)
    try {
      const userRoleId = await getCurrentUserRoleId()
      if (
        userRoleId !== Role.company_admin &&
        userRoleId !== Role.store_admin
      ) {
        notifications.show({
          title: 'Permission Denied',
          message: 'You do not have permission to process returns',
          color: 'red',
        })
        return
      }

      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('auth_id', user.id)
        .single()
      if (!profile) throw new Error('Profile not found')

      // Generate return number
      const { data: returnNumber } = await supabase.rpc(
        'generate_return_number',
        { p_company_id: sale.company_id },
      )

      const returnStatus = requiresApproval ? 'pending' : 'completed'

      // Create return record
      const returnPayload: any = {
        company_id: sale.company_id,
        store_id: sale.store_id,
        sale_id: sale.id,
        return_number: returnNumber || `RET-${Date.now()}`,
        return_date: new Date().toISOString().split('T')[0],
        return_reason: returnReason,
        total_refund_amount: totalRefund,
        refund_method:
          sale.payment_method === 'credit' ? 'cash' : sale.payment_method,
        status: returnStatus,
        processed_by: profile.id,
        notes: `Partial return for sale ${sale.sale_number}. ${requiresApproval ? 'Pending approval.' : 'Auto-approved.'}`,
      }
      if (!requiresApproval) {
        returnPayload.approved_by = profile.id
        returnPayload.approved_at = new Date().toISOString()
      }

      const { data: returnRecord, error: returnError } = await supabase
        .from('sales_returns')
        .insert(returnPayload)
        .select()
        .single()
      if (returnError) throw returnError

      // Create return items (only items with qty > 0)
      const returnItemsToInsert = saleItems
        .filter((item) => (returnQtys[item.id] ?? 0) > 0)
        .map((item) => ({
          sales_return_id: returnRecord.id,
          sale_item_id: item.id,
          product_id: item.product_id,
          batch_id: item.batch_id,
          batch_number: item.batch_number,
          quantity_returned: returnQtys[item.id],
          unit_price: item.unit_price,
          refund_amount: returnQtys[item.id] * item.unit_price,
        }))

      const { error: itemsError } = await supabase
        .from('sales_return_items')
        .insert(returnItemsToInsert)
      if (itemsError) throw itemsError

      // Restore inventory for returned items (only when auto-approved / no approval needed)
      if (!requiresApproval) {
        for (const item of returnItemsToInsert) {
          const { data: restoreResult } = await supabase.rpc(
            'fn_restore_partial_inventory',
            {
              p_batch_id: item.batch_id,
              p_quantity: item.quantity_returned,
            },
          )
          if (restoreResult && !restoreResult.success) {
            console.error(
              '⚠️ Partial inventory restore failed for batch',
              item.batch_id,
              restoreResult,
            )
          }
        }

        // Mark inventory_restored = true on the return record so the DB trigger
        // (restore_inventory_on_return) skips it and does NOT double-restore stock.
        await supabase
          .from('sales_returns')
          .update({ inventory_restored: true })
          .eq('id', returnRecord.id)
      }

      // Sale status is now managed by DB trigger fn_set_sale_return_status:
      // - All items returned → 'returned'
      // - Some items returned → 'partially_returned'
      // No frontend update needed.

      notifications.show({
        title: requiresApproval ? 'Return Submitted' : 'Return Processed',
        message: requiresApproval
          ? `Partial return ${returnRecord.return_number} is pending approval`
          : `Partial return ${returnRecord.return_number} processed. Refund: ${formatCompactCurrency(totalRefund, currency)}`,
        color: requiresApproval ? 'orange' : 'green',
        autoClose: 5000,
      })

      onSuccess()
    } catch (error: any) {
      console.error('Partial return error:', error)
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to process return',
        color: 'red',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Stack gap="md">
      {requiresApproval && (
        <Alert
          icon={<IconAlertCircle size={16} />}
          color="orange"
          title="Approval Required"
        >
          This return will be created with status "Pending" and requires manager
          approval.
        </Alert>
      )}

      <ScrollArea.Autosize mah={380}>
        <Stack gap="sm">
          {saleItems.map((item) => {
            const maxReturnable = item.quantity - item.quantity_already_returned
            const qty = returnQtys[item.id] ?? 0
            return (
              <Paper
                key={item.id}
                p="sm"
                withBorder
                style={{
                  backgroundColor: isDark
                    ? theme.colors.dark[6]
                    : theme.colors.gray[0],
                  borderColor:
                    qty > 0
                      ? theme.colors[theme.primaryColor][4]
                      : isDark
                        ? theme.colors.dark[4]
                        : theme.colors.gray[3],
                }}
              >
                <Group
                  justify="space-between"
                  wrap="nowrap"
                >
                  <Stack
                    gap={2}
                    style={{ flex: 1 }}
                  >
                    <Text
                      size="sm"
                      fw={600}
                    >
                      {item.product_name}
                    </Text>
                    <Group gap="xs">
                      <Text
                        size="xs"
                        c="dimmed"
                      >
                        Batch: {item.batch_number}
                      </Text>
                      <Text
                        size="xs"
                        c="dimmed"
                      >
                        ·
                      </Text>
                      <Text
                        size="xs"
                        c="dimmed"
                      >
                        Sold: {item.quantity} units
                      </Text>
                      {item.quantity_already_returned > 0 && (
                        <>
                          <Text
                            size="xs"
                            c="dimmed"
                          >
                            ·
                          </Text>
                          <Badge
                            size="xs"
                            color="orange"
                            variant="light"
                          >
                            {item.quantity_already_returned} already returned
                          </Badge>
                        </>
                      )}
                    </Group>
                    <Text
                      size="xs"
                      c={theme.primaryColor}
                      fw={500}
                    >
                      UGX {formatCompactCurrency(item.unit_price, currency)} /
                      unit
                    </Text>
                  </Stack>

                  <Group
                    gap="xs"
                    wrap="nowrap"
                  >
                    <NumberInput
                      size="sm"
                      w={90}
                      min={0}
                      max={maxReturnable}
                      value={qty}
                      onChange={(v) =>
                        setReturnQtys((prev) => ({
                          ...prev,
                          [item.id]: Math.min(Number(v) || 0, maxReturnable),
                        }))
                      }
                      disabled={maxReturnable === 0}
                      placeholder="0"
                      hideControls={false}
                    />
                    {qty > 0 && (
                      <Text
                        size="xs"
                        fw={600}
                        c="green"
                        w={90}
                        ta="right"
                      >
                        +{' '}
                        {formatCompactCurrency(qty * item.unit_price, currency)}
                      </Text>
                    )}
                  </Group>
                </Group>
              </Paper>
            )
          })}
        </Stack>
      </ScrollArea.Autosize>

      <Divider />

      <Textarea
        label="Return Reason"
        placeholder="Why are these items being returned?"
        required
        minRows={2}
        value={returnReason}
        onChange={(e) => setReturnReason(e.currentTarget.value)}
      />

      <Paper
        p="sm"
        withBorder
        style={{
          backgroundColor: isDark
            ? theme.colors.dark[6]
            : theme.colors[theme.primaryColor][0],
          borderColor: isDark
            ? theme.colors.dark[4]
            : theme.colors[theme.primaryColor][2],
        }}
      >
        <Group justify="space-between">
          <Text
            size="sm"
            fw={600}
          >
            Total Refund Amount
          </Text>
          <Text
            size="lg"
            fw={700}
            c={theme.primaryColor}
          >
            UGX {formatCompactCurrency(totalRefund, currency)}
          </Text>
        </Group>
      </Paper>

      <Group
        justify="flex-end"
        gap="sm"
      >
        <Button
          variant="default"
          leftSection={<IconX size={16} />}
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button
          color={requiresApproval ? 'orange' : theme.primaryColor}
          leftSection={<IconArrowBackUp size={16} />}
          disabled={!hasAnyQty || !returnReason.trim()}
          loading={isSubmitting}
          onClick={handleSubmit}
        >
          {requiresApproval ? 'Submit for Approval' : 'Process Return'}
        </Button>
      </Group>
    </Stack>
  )
}

export default PartialReturnModalContent

