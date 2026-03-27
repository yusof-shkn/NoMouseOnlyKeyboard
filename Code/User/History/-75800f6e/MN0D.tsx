// src/features/sales/components/PurchaseSummary.tsx
import { useSelector } from 'react-redux'
import { selectDefaultCurrency } from '@features/authentication/authSlice'
import React from 'react'
import {
  Paper,
  Stack,
  Group,
  Text,
  Divider,
  ActionIcon,
  Box,
  useMantineTheme,
  useMantineColorScheme,
} from '@mantine/core'
import { IconPencil } from '@tabler/icons-react'
import { formatCurrency } from './PointOfSalePurchase.utils'
import type { PurchaseSummaryProps } from './types'

export const PurchaseSummary: React.FC<PurchaseSummaryProps> = ({
  totals,
  shipping,
  coupon,
  discount,
  onEditCosts,
}) => {
  const theme = useMantineTheme()
  const currency = useSelector(selectDefaultCurrency)

  const { colorScheme } = useMantineColorScheme()
  const isDark = colorScheme === 'dark'

  const primaryColor = theme.colors[theme.primaryColor][6]
  const primaryLight = theme.colors[theme.primaryColor][1]

  return (
    <Paper
      p="xs"
      withBorder
      style={{
        borderColor: isDark ? theme.colors.dark[4] : theme.colors.gray[3],
        backgroundColor: isDark ? theme.colors.dark[6] : theme.white,
      }}
    >
      <Stack gap={4}>
        {/* Subtotal */}
        <Group justify="space-between">
          <Text
            size="xs"
            c="dimmed"
          >
            Sub Total
          </Text>
          <Text
            size="xs"
            fw={500}
          >
            {formatCurrency(totals.subTotal, currency)}
          </Text>
        </Group>

        {/* Tax & Adjustments */}
        <Group justify="space-between">
          <Group gap={4}>
            <Text
              size="xs"
              c="dimmed"
            >
              Tax & Adjustments
            </Text>
            <ActionIcon
              size="xs"
              variant="subtle"
              color={theme.primaryColor}
              onClick={onEditCosts}
            >
              <IconPencil size={11} />
            </ActionIcon>
          </Group>
          <Text
            size="xs"
            fw={500}
          >
            {formatCurrency(totals.tax + coupon - discount, currency)}
          </Text>
        </Group>

        {/* Breakdown */}
        {(totals.tax > 0 || discount > 0 || coupon > 0) && (
          <Box
            style={{
              padding: '6px 8px',
              backgroundColor: isDark ? theme.colors.dark[5] : primaryLight,
              borderRadius: theme.radius.sm,
              borderLeft: `3px solid ${primaryColor}`,
            }}
          >
            <Stack gap={3}>
              {totals.tax > 0 && (
                <Group justify="space-between">
                  <Text
                    size="xs"
                    c="dimmed"
                  >
                    • Tax ({totals.taxPercentage}%)
                  </Text>
                  <Text
                    size="xs"
                    c={theme.primaryColor}
                    fw={500}
                  >
                    +{formatCurrency(totals.tax, currency)}
                  </Text>
                </Group>
              )}
              {coupon > 0 && (
                <Group justify="space-between">
                  <Text
                    size="xs"
                    c="dimmed"
                  >
                    • Coupon
                  </Text>
                  <Text
                    size="xs"
                    c={theme.primaryColor}
                    fw={500}
                  >
                    +{formatCurrency(coupon, currency)}
                  </Text>
                </Group>
              )}
              {discount > 0 && (
                <Group justify="space-between">
                  <Text
                    size="xs"
                    c="dimmed"
                  >
                    • Discount
                  </Text>
                  <Text
                    size="xs"
                    c="red"
                    fw={500}
                  >
                    -{formatCurrency(discount, currency)}
                  </Text>
                </Group>
              )}
            </Stack>
          </Box>
        )}

        <Divider color={isDark ? theme.colors.dark[4] : theme.colors.gray[3]} />

        {/* Grand Total */}
        <Group justify="space-between">
          <Text
            size="sm"
            fw={600}
          >
            Grand Total
          </Text>
          <Text
            size="lg"
            fw={700}
            c={theme.primaryColor}
          >
            {formatCurrency(totals.grandTotal, currency)}
          </Text>
        </Group>
      </Stack>
    </Paper>
  )
}

export default PurchaseSummary

