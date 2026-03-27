// src/features/sales/components/ProductCard.enhanced.tsx
import React from 'react'
import {
  Card,
  Text,
  Badge,
  Group,
  Tooltip,
  Box,
  Stack,
  useMantineTheme,
  useMantineColorScheme,
} from '@mantine/core'
import {
  IconPackage,
  IconPill,
  IconBottle,
  IconDroplet,
  IconVaccine,
  IconAlertCircle,
  IconHeart,
  IconBandage,
  IconFirstAidKit,
  IconStethoscope,
  IconMedicineSyrup,
  IconCapsule,
  IconTestPipe,
  IconTemperature,
  IconEyeglass,
  IconDental,
  IconBrain,
  IconLungs,
  IconHeartbeat,
  IconBone,
} from '@tabler/icons-react'

interface ProductCardProps {
  product: {
    id: number
    product_name: string
    product_code: string
    generic_name?: string
    barcode?: string
    image_url?: string
    category?: {
      id: number
      category_name: string
    } | null
    unit?: {
      id: number
      name: string
      short_code: string
    } | null
    standard_price?: number
    standard_cost?: number
    reorder_level?: number
    total_quantity?: number
    available_quantity?: number
    expiring_soon_count?: number
    stock_status?: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'NO_BATCH'
    can_sell?: boolean
    sort_priority?: number
  }
  onAddProduct: (product: any) => void
  mode?: 'sales' | 'purchase' // ✅ NEW: 'purchase' allows all products regardless of stock
}

// Unique icon pool - each category gets a different icon based on its ID
const uniqueIconPool = [
  IconPill, // 0
  IconBottle, // 1
  IconVaccine, // 2
  IconDroplet, // 3
  IconFirstAidKit, // 4
  IconBandage, // 5
  IconStethoscope, // 6
  IconHeart, // 7
  IconCapsule, // 8
  IconTestPipe, // 9
  IconTemperature, // 10
  IconEyeglass, // 11
  IconDental, // 12
  IconBrain, // 13
  IconLungs, // 14
  IconHeartbeat, // 15
  IconBone, // 16
  IconMedicineSyrup, // 17
  IconPackage, // 18
]

// Category keyword mapping for better UX
const categoryKeywordIconMap: Record<string, number> = {
  tablet: 0,
  pill: 0,
  capsule: 8,
  syrup: 17,
  liquid: 1,
  suspension: 1,
  injection: 2,
  vaccine: 2,
  injectable: 2,
  drop: 3,
  solution: 3,
  'first aid': 4,
  bandage: 5,
  dressing: 5,
  'medical device': 6,
  equipment: 6,
  supplement: 7,
  vitamin: 7,
  test: 9,
  diagnostic: 9,
  thermometer: 10,
  temperature: 10,
  eye: 11,
  vision: 11,
  optical: 11,
  dental: 12,
  tooth: 12,
  neuro: 13,
  brain: 13,
  respiratory: 14,
  lung: 14,
  cardiac: 15,
  heart: 15,
  orthopedic: 16,
  bone: 16,
}

const getIconForCategory = (
  categoryId: number | undefined,
  categoryName: string | undefined,
): any => {
  if (!categoryId) return IconPackage

  if (categoryName) {
    const categoryLower = categoryName.toLowerCase().trim()
    for (const [keyword, iconIndex] of Object.entries(categoryKeywordIconMap)) {
      if (categoryLower.includes(keyword)) {
        return uniqueIconPool[iconIndex]
      }
    }
  }

  const iconIndex = categoryId % uniqueIconPool.length
  return uniqueIconPool[iconIndex]
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onAddProduct,
  mode = 'sales', // default: existing sales behaviour
}) => {
  const theme = useMantineTheme()
  const { colorScheme } = useMantineColorScheme()
  const isDark = colorScheme === 'dark'

  const isPurchaseMode = mode === 'purchase'

  const available = product.available_quantity || 0
  const stockStatus =
    (product as any).stock_status ||
    (available === 0 ? 'OUT_OF_STOCK' : 'IN_STOCK')
  const isNoBatch = stockStatus === 'NO_BATCH'
  const isOutOfStock = !isNoBatch && available === 0
  const isLowStock =
    !isOutOfStock && !isNoBatch && available <= (product.reorder_level || 10)

  // ✅ KEY FIX: in purchase mode every product is always clickable —
  // you're buying stock, not selling it, so NO_BATCH is expected & fine.
  const canInteract = isPurchaseMode
    ? true
    : (product as any).can_sell !== false && !isNoBatch

  const unitName = product.unit?.short_code || product.unit?.name || 'pcs'
  const price = product.standard_cost || product.standard_price || 0

  const categoryId = product.category?.id
  const categoryName = product.category?.category_name
  const IconComponent = getIconForCategory(categoryId, categoryName)

  const getIconColor = () => {
    if (!categoryId) return theme.colors.gray[6]

    const colorOptions = [
      theme.colors.blue[6],
      theme.colors.green[6],
      theme.colors.orange[6],
      theme.colors.violet[6],
      theme.colors[theme.primaryColor][7],
      theme.colors.pink[6],
      theme.colors.cyan[6],
      theme.colors.lime[6],
      theme.colors[theme.primaryColor][6],
      theme.colors.indigo[6],
    ]

    return colorOptions[categoryId % colorOptions.length]
  }

  const iconColor = getIconColor()

  const getStockBadgeColor = () => {
    if (isNoBatch) {
      return {
        bg: isDark ? theme.colors.dark[4] : theme.colors.gray[5],
        color: isDark ? theme.colors.dark[1] : theme.white,
        opacity: 0.8,
      }
    }
    if (isOutOfStock) {
      return {
        bg: isDark ? theme.colors.red[9] : theme.colors.red[6],
        color: theme.white,
        opacity: 0.3,
      }
    }
    if (isLowStock) {
      return {
        bg: isDark ? theme.colors.yellow[7] : theme.colors.yellow[6],
        color: isDark ? theme.colors.dark[9] : theme.colors.gray[9],
        opacity: 0.85,
      }
    }
    return {
      bg: theme.colors.gray[5],
      color: theme.white,
      opacity: 0.85,
    }
  }

  const stockBadgeColors = getStockBadgeColor()

  // ✅ In purchase mode: NO_BATCH badge label changes to "New Item" to
  //    signal to the user this product has never been purchased before.
  const getNoBatchLabel = () => (isPurchaseMode ? 'New Item' : 'No Batch')

  return (
    <Card
      shadow="sm"
      padding={0}
      radius="lg"
      withBorder
      onClick={() => canInteract && onAddProduct(product)}
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: isDark ? theme.colors.dark[6] : theme.white,
        cursor: canInteract ? 'pointer' : 'not-allowed',
        transition: 'all 0.2s ease-in-out',
        position: 'relative',
        overflow: 'hidden',
        borderColor: isDark ? theme.colors.dark[4] : theme.colors.gray[3],
        // ✅ In purchase mode: never dim the card — all products are valid to buy
        opacity: !isPurchaseMode && isNoBatch ? 0.5 : 1,
      }}
      styles={{
        root: {
          '&:hover': {
            boxShadow: isDark
              ? '0 8px 24px rgba(0, 0, 0, 0.4)'
              : '0 8px 24px rgba(0, 0, 0, 0.12)',
            transform: 'translateY(-4px)',
            borderColor: theme.colors[theme.primaryColor][6],
          },
        },
      }}
    >
      {/* Status Badge */}
      {(isNoBatch || isOutOfStock || isLowStock) && (
        <Badge
          size="sm"
          variant="filled"
          leftSection={<IconAlertCircle size={12} />}
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            zIndex: 10,
            fontWeight: 600,
            fontSize: '9px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            boxShadow: isDark
              ? '0 2px 8px rgba(0, 0, 0, 0.5)'
              : '0 2px 8px rgba(0, 0, 0, 0.15)',
            backgroundColor: stockBadgeColors.bg,
            color: stockBadgeColors.color,
          }}
        >
          {isNoBatch
            ? getNoBatchLabel()
            : isOutOfStock
              ? 'Out of Stock'
              : 'Low Stock'}
        </Badge>
      )}

      <Stack
        gap={0}
        style={{ height: '100%' }}
      >
        {/* Image / Icon Section */}
        <Box
          style={{
            width: '100%',
            height: '120px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: product.image_url
              ? isDark
                ? theme.colors.dark[5]
                : theme.colors.gray[0]
              : isDark
                ? theme.colors.dark[5]
                : theme.colors[theme.primaryColor][0],
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {product.image_url ? (
            <Box
              style={{
                width: '100%',
                height: '100%',
                backgroundImage: `url(${product.image_url})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
              }}
            />
          ) : (
            <Box
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '12px',
                width: '100%',
              }}
            >
              <IconComponent
                size={32}
                stroke={1.5}
                color={iconColor}
                style={{ opacity: 0.9 }}
              />
              <Tooltip
                label={product.product_name}
                withArrow
                position="top"
              >
                <Text
                  fw={600}
                  size="xs"
                  lineClamp={2}
                  ta="center"
                  style={{
                    lineHeight: '1.3',
                    maxWidth: '90%',
                  }}
                >
                  {product.product_name}
                </Text>
              </Tooltip>
            </Box>
          )}
        </Box>

        {/* Content Section */}
        <Stack
          gap={6}
          p="xs"
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <Box style={{ flex: 1 }} />

          {/* Stock Information */}
          <Group
            gap={6}
            wrap="nowrap"
          >
            <IconComponent
              size={16}
              stroke={2}
              color={iconColor}
              style={{ opacity: 0.9 }}
            />
            <Text
              size="xs"
              fw={600}
              style={{ flex: 1 }}
            >
              {available.toLocaleString()} {unitName}
            </Text>
          </Group>

          {/* Price */}
          <Box
            style={{
              borderTop: `1px solid ${isDark ? theme.colors.dark[4] : theme.colors.gray[2]}`,
              paddingTop: '6px',
              marginTop: '6px',
            }}
          >
            <Group
              justify="space-between"
              align="center"
              wrap="nowrap"
            >
              <Box>
                <Text
                  size="xs"
                  c="dimmed"
                  fw={500}
                  mb={2}
                  style={{ lineHeight: 1 }}
                >
                  Price
                </Text>
                <Text
                  size="md"
                  fw={700}
                  c={theme.primaryColor}
                  style={{ lineHeight: 1 }}
                >
                  UGX {price.toLocaleString()}
                </Text>
              </Box>
            </Group>
          </Box>
        </Stack>
      </Stack>
    </Card>
  )
}

export default ProductCard

