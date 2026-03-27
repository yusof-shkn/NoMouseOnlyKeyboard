// src/features/sales/components/EmptyOrderState.tsx
import React from 'react'
import {
  Paper,
  Text,
  Stack,
  useMantineTheme,
  useMantineColorScheme,
} from '@mantine/core'
import { IconShoppingCartOff } from '@tabler/icons-react'

export const EmptyOrderState: React.FC = () => {
  const theme = useMantineTheme()
  const { colorScheme } = useMantineColorScheme()
  const isDark = colorScheme === 'dark'

  return (
    <Paper
      p="xl"
      h={'100%'}
      withBorder
      style={{
        textAlign: 'center',
        borderColor: isDark ? theme.colors.dark[4] : theme.colors.gray[3],
        backgroundColor: isDark ? theme.colors.dark[6] : theme.white,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Stack
        gap="md"
        align="center"
      >
        <IconShoppingCartOff
          size={48}
          color={isDark ? theme.colors.dark[3] : theme.colors.gray[4]}
          opacity={0.5}
        />
        <div>
          <Text
            size="sm"
            fw={500}
            c="dimmed"
            mb={4}
          >
            No items in cart
          </Text>
          <Text
            size="xs"
            c="dimmed"
          >
            Click products to add or scan barcode
          </Text>
        </div>
      </Stack>
    </Paper>
  )
}

export default EmptyOrderState

