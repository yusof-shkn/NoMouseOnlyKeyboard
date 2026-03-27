// src/features/sales/components/modals/AdditionalCostsModal.tsx
import { useSelector } from 'react-redux'
import { selectDefaultCurrency } from '@features/authentication/authSlice'
import React, { useState } from 'react'
import {
  Stack,
  Group,
  NumberInput,
  Paper,
  Divider,
  Text,
  Button,
  useMantineTheme,
  useMantineColorScheme,
} from '@mantine/core'
import { IconCheck, IconX } from '@tabler/icons-react'
import type { PurchaseTotals } from './types'
import { formatCurrency } from './PointOfSalePurchase.utils'

interface AdditionalCostsModalProps {
  taxPercentage?: number
  shipping?: number
  coupon?: number
  discount?: number
  totals?: PurchaseTotals
}

export const AdditionalCostsModalContent: React.FC<
  AdditionalCostsModalProps
> = ({
  taxPercentage: initialTax = 0,
  shipping: initialShipping = 0,
  coupon: initialCoupon = 0,
  discount: initialDiscount = 0,
  totals,
}) => {
  const currency = useSelector(selectDefaultCurrency)

  const theme = useMantineTheme()
  const { colorScheme } = useMantineColorScheme()
  const isDark = colorScheme === 'dark'

  const [taxPercentage, setTaxPercentage] = useState(initialTax)
  const [shipping, setShipping] = useState(initialShipping)
  const [coupon, setCoupon] = useState(initialCoupon)
  const [discount, setDiscount] = useState(initialDiscount)

  const handlers = (window as any).__purchaseModalHandlers || {}

  const taxAmount = totals ? (totals.subTotal * taxPercentage) / 100 : 0
  const calculatedGrandTotal = totals
    ? totals.subTotal + shipping + taxAmount + coupon - discount
    : 0

  const handleApply = () => {
    if (handlers.onApplyAdditionalCosts) {
      handlers.onApplyAdditionalCosts({
        taxPercentage,
        shipping,
        coupon,
        discount,
      })
    }
  }

  const handleCancel = () => {
    if (handlers.onCancelAdditionalCosts) {
      handlers.onCancelAdditionalCosts()
    }
  }

  return (
    <Stack gap="md">
      <NumberInput
        label="Shipping Cost"
        value={shipping}
        onChange={(value) => setShipping(Number(value) || 0)}
        min={0}
        placeholder="Enter shipping cost"
        prefix="UGX "
        decimalScale={2}
        description="Delivery or freight charges"
      />

      <NumberInput
        label="Tax Percentage (%)"
        value={taxPercentage}
        onChange={(value) => setTaxPercentage(Number(value) || 0)}
        min={0}
        max={100}
        placeholder="Enter tax percentage"
        suffix="%"
        decimalScale={2}
        description={`Tax amount: ${formatCurrency(taxAmount, currency)}`}
      />

      <NumberInput
        label="Coupon (Added to total)"
        value={coupon}
        onChange={(value) => setCoupon(Number(value) || 0)}
        min={0}
        placeholder="e.g., bonus from supplier"
        prefix="UGX "
        decimalScale={2}
        description="This amount will be added"
      />

      <NumberInput
        label="Discount"
        value={discount}
        onChange={(value) => setDiscount(Number(value) || 0)}
        min={0}
        placeholder="Enter discount amount"
        prefix="UGX "
        decimalScale={2}
        description="This amount will be deducted"
        color="red"
      />

      <Paper
        p="md"
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
        <Stack gap="xs">
          <Group justify="space-between">
            <Text size="sm">Subtotal</Text>
            <Text
              size="sm"
              fw={600}
            >
              {totals ? formatCurrency(totals.subTotal, currency) : 'UGX 0.00'}
            </Text>
          </Group>

          <Group justify="space-between">
            <Text
              size="sm"
              c={theme.primaryColor}
            >
              + Shipping
            </Text>
            <Text
              size="sm"
              c={theme.primaryColor}
              fw={600}
            >
              {formatCurrency(shipping, currency)}
            </Text>
          </Group>

          <Group justify="space-between">
            <Text
              size="sm"
              c="dimmed"
            >
              + Tax ({taxPercentage}%)
            </Text>
            <Text size="sm">{formatCurrency(taxAmount, currency)}</Text>
          </Group>

          <Group justify="space-between">
            <Text
              size="sm"
              c={theme.primaryColor}
            >
              + Coupon
            </Text>
            <Text
              size="sm"
              c={theme.primaryColor}
            >
              {formatCurrency(coupon, currency)}
            </Text>
          </Group>

          <Group justify="space-between">
            <Text
              size="sm"
              c="red"
            >
              - Discount
            </Text>
            <Text
              size="sm"
              c="red"
            >
              -{formatCurrency(discount, currency)}
            </Text>
          </Group>

          <Divider
            my="sm"
            color={isDark ? theme.colors.dark[4] : theme.colors.gray[3]}
          />

          <Group justify="space-between">
            <Text
              size="lg"
              fw={700}
            >
              Grand Total
            </Text>
            <Text
              size="xl"
              fw={700}
              c={theme.primaryColor}
            >
              {formatCurrency(calculatedGrandTotal, currency)}
            </Text>
          </Group>
        </Stack>
      </Paper>

      <Group
        justify="flex-end"
        gap="sm"
      >
        <Button
          variant="default"
          onClick={handleCancel}
          leftSection={<IconX size={16} />}
        >
          Cancel
        </Button>
        <Button
          onClick={handleApply}
          color={theme.primaryColor}
          leftSection={<IconCheck size={16} />}
        >
          Apply Changes
        </Button>
      </Group>
    </Stack>
  )
}

export default AdditionalCostsModalContent

