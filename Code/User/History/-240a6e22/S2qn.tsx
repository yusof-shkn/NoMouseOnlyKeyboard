// src/features/sales/components/OrderItemCard.tsx
import React from 'react'
import {
  Group,
  Text,
  ActionIcon,
  NumberInput,
  Badge,
  Box,
  Select,
  Tooltip,
  useMantineTheme,
  useMantineColorScheme,
} from '@mantine/core'
import { IconTrash, IconPackage } from '@tabler/icons-react'
import type { OrderItem } from './types'
import { formatCurrency } from './PointOfSalePurchase.utils'

interface UnitOption {
  id: number
  name: string
  short_code: string
}

interface OrderItemCardProps {
  item: OrderItem
  index: number
  onEdit: (item: OrderItem) => void
  onRemove: (index: number) => void
  onInlineChange: (index: number, field: 'qty' | 'price', value: number) => void
  onUnitChange?: (index: number, unitId: number | null) => void
  units?: UnitOption[]
}

export const OrderItemCard: React.FC<OrderItemCardProps> = ({
  item,
  index,
  onEdit,
  onRemove,
  onInlineChange,
  onUnitChange,
  units = [],
}) => {
  const theme = useMantineTheme()
  const { colorScheme } = useMantineColorScheme()
  const isDark = colorScheme === 'dark'

  const isBatchMissing = !item.batchNumber || item.batchNumber.trim() === ''
  const isBatchPending = item.batchNumber?.startsWith('PENDING-') || false
  const isBackordered = item.isBackordered || false
  const availableQty = item.availableStock || 0

  // Resolve unit display name: prefer item.unit string, then exact id match,
  // then any unit (cross-company catalogs have same short_codes but different ids)
  const resolvedUnit = (() => {
    if (item.unit && typeof item.unit === 'string' && item.unit.trim())
      return item.unit
    if (units.length > 0) {
      // Try exact unit_id match first
      if (item.unit_id != null) {
        const byId = units.find((u) => u.id === item.unit_id)
        if (byId) return byId.short_code
      }
    }
    return ''
  })()

  // For the Select, resolve the unit_id that belongs to the units array
  // (may need to remap from master-catalog id to user-company id via short_code)
  const selectValue = (() => {
    if (item.unit_id == null) return null
    const exact = units.find((u) => u.id === item.unit_id)
    if (exact) return String(exact.id)
    // Cross-company: find by short_code
    if (resolvedUnit) {
      const byCode = units.find((u) => u.short_code === resolvedUnit)
      if (byCode) return String(byCode.id)
    }
    return null
  })()

  const accentColor = isBackordered
    ? theme.colors.orange[6]
    : theme.colors[theme.primaryColor][6]

  const getStockBadgeColor = () => {
    if (availableQty === 0) return 'red'
    if (availableQty < item.qty) return 'yellow'
    return theme.primaryColor
  }

  const inputStyles = {
    input: {
      fontSize: '12px' as const,
      fontWeight: 500 as const,
      backgroundColor: isDark ? theme.colors.dark[5] : theme.white,
      borderColor: isDark ? theme.colors.dark[3] : theme.colors.gray[3],
      borderRadius: theme.radius.sm as string,
      height: '28px',
      minHeight: '28px',
      padding: '0 8px',
    },
  }

  return (
    <Box
      style={{
        padding: '10px 12px',
        borderBottom: `1px solid ${isDark ? theme.colors.dark[4] : theme.colors.gray[2]}`,
        backgroundColor: isDark
          ? index % 2 === 0
            ? theme.colors.dark[6]
            : theme.colors.dark[7]
          : index % 2 === 0
            ? theme.white
            : theme.colors.gray[0],
        borderLeft: `3px solid ${accentColor}`,
      }}
    >
      {/* Row 1: product name + stock + subtotal + delete */}
      <Group
        gap={8}
        wrap="nowrap"
        align="center"
        mb={7}
      >
        <Box style={{ flex: 1, minWidth: 0 }}>
          <Group
            gap={5}
            wrap="nowrap"
            align="center"
          >
            <IconPackage
              size={13}
              color={accentColor}
              style={{ flexShrink: 0 }}
            />
            <Text
              size="sm"
              fw={600}
              lineClamp={1}
              style={{ color: isDark ? theme.white : theme.colors.gray[8] }}
            >
              {item.productName}
            </Text>
            {item.productCode && (
              <Text
                size="xs"
                c="dimmed"
                style={{ flexShrink: 0 }}
              >
                #{item.productCode}
              </Text>
            )}
          </Group>
          {item.batchNumber && !isBatchMissing && !isBatchPending ? (
            <Text
              size="xs"
              c="dimmed"
              lineClamp={1}
              ml={18}
            >
              Batch: {item.batchNumber}
            </Text>
          ) : (
            <Text
              size="xs"
              c="orange.5"
              fs="italic"
              ml={18}
            >
              Batch set on receive
            </Text>
          )}
        </Box>

        <Tooltip
          label="Current stock level"
          withArrow
        >
          <Badge
            size="xs"
            color={getStockBadgeColor()}
            variant="light"
            style={{ flexShrink: 0 }}
          >
            {availableQty} stk
          </Badge>
        </Tooltip>

        <Text
          size="sm"
          fw={700}
          c={isBackordered ? 'orange' : theme.primaryColor}
          style={{ flexShrink: 0, minWidth: 72, textAlign: 'right' }}
        >
          {formatCurrency(item.subtotal)}
        </Text>

        <ActionIcon
          size="sm"
          variant="subtle"
          color="red"
          onClick={() => onRemove(index)}
          style={{ flexShrink: 0 }}
        >
          <IconTrash size={14} />
        </ActionIcon>
      </Group>

      {/* Row 2: Qty + Cost + Unit */}
      <Group
        gap={8}
        wrap="nowrap"
        align="flex-end"
        pl={18}
      >
        <Box style={{ flex: '0 0 72px' }}>
          <Text
            size="xs"
            c="dimmed"
            mb={2}
            fw={500}
          >
            Qty
          </Text>
          <NumberInput
            size="xs"
            value={item.qty}
            onChange={(value) => onInlineChange(index, 'qty', value as number)}
            min={1}
            hideControls
            styles={{
              input: {
                ...inputStyles.input,
                textAlign: 'center',
                borderColor: isBackordered
                  ? theme.colors.orange[5]
                  : isDark
                    ? theme.colors.dark[3]
                    : theme.colors.gray[3],
              },
            }}
          />
        </Box>

        <Box style={{ flex: '0 0 108px' }}>
          <Text
            size="xs"
            c="dimmed"
            mb={2}
            fw={500}
          >
            Unit Cost
          </Text>
          <NumberInput
            size="xs"
            value={item.price}
            onChange={(value) =>
              onInlineChange(index, 'price', value as number)
            }
            min={0}
            hideControls
            thousandSeparator=","
            decimalScale={2}
            styles={{ input: inputStyles.input }}
          />
        </Box>

        {units.length > 0 && onUnitChange ? (
          <Box style={{ flex: '0 0 108px' }}>
            <Text
              size="xs"
              c="dimmed"
              mb={2}
              fw={500}
            >
              Unit
            </Text>
            <Select
              size="xs"
              placeholder={resolvedUnit || 'Search unit...'}
              data={units.map((u) => ({
                value: String(u.id),
                label: u.short_code,
              }))}
              value={selectValue}
              onChange={(v) => onUnitChange(index, v ? parseInt(v) : null)}
              clearable
              searchable
              nothingFoundMessage="No unit found"
              styles={{ input: inputStyles.input }}
            />
          </Box>
        ) : (
          <Box style={{ flex: '0 0 80px' }}>
            <Text
              size="xs"
              c="dimmed"
              mb={2}
              fw={500}
            >
              Unit
            </Text>
            <Box
              style={{
                height: '28px',
                display: 'flex',
                alignItems: 'center',
                paddingInline: 8,
                border: `1px solid ${isDark ? theme.colors.dark[3] : theme.colors.gray[3]}`,
                borderRadius: theme.radius.sm as string,
                backgroundColor: isDark
                  ? theme.colors.dark[6]
                  : theme.colors.gray[0],
              }}
            >
              <Text
                size="xs"
                c={theme.primaryColor}
                fw={600}
              >
                {item.unit || '—'}
              </Text>
            </Box>
          </Box>
        )}

        <Box style={{ flex: 1 }} />
      </Group>
    </Box>
  )
}

export default OrderItemCard

