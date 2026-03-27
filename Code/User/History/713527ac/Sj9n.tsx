// src/features/sales/components/TableHeader.tsx
import React from 'react'
import {
  Group,
  Text,
  Box,
  useMantineTheme,
  useMantineColorScheme,
} from '@mantine/core'

export const TableHeader: React.FC = () => {
  const theme = useMantineTheme()
  const { colorScheme } = useMantineColorScheme()
  const isDark = colorScheme === 'dark'

  const col = {
    size: 'xs' as const,
    fw: 600 as const,
    c: (isDark ? 'dimmed' : 'gray.7') as string,
    tt: 'uppercase' as const,
  }

  return (
    <Box
      style={{
        padding: '8px 12px',
        paddingLeft: 15, // matches OrderItemCard left border 3px + 12px padding
        backgroundColor: isDark ? theme.colors.dark[6] : theme.colors.gray[0],
        borderBottom: `1px solid ${isDark ? theme.colors.dark[4] : theme.colors.gray[3]}`,
        borderRadius: `${theme.radius.sm} ${theme.radius.sm} 0 0`,
      }}
    >
      {/* Row 1 header: Product name + subtotal + delete placeholder */}
      <Group
        gap={8}
        wrap="nowrap"
        align="center"
        mb={4}
      >
        <Box style={{ flex: 1 }}>
          <Text {...col}>Product</Text>
        </Box>
        <Box style={{ flexShrink: 0, minWidth: 60, textAlign: 'right' }}>
          <Text {...col}>Subtotal</Text>
        </Box>
        {/* space for stock badge + delete icon */}
        <Box style={{ width: 24 }} />
      </Group>
      {/* Row 2 header: Qty + Unit Cost + Unit — matches OrderItemCard Row 2 with pl={18} */}
      <Group
        gap={8}
        wrap="nowrap"
        align="center"
        pl={18}
      >
        <Box style={{ flex: '0 0 72px' }}>
          <Text {...col}>Qty</Text>
        </Box>
        <Box style={{ flex: '0 0 108px' }}>
          <Text {...col}>Unit Cost</Text>
        </Box>
        <Box style={{ flex: '0 0 108px' }}>
          <Text {...col}>Unit</Text>
        </Box>
        <Box style={{ flex: 1 }} />
      </Group>
    </Box>
  )
}

export default TableHeader

