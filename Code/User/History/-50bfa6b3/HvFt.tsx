import React, { useState, useCallback, useRef, useEffect } from 'react'
import {
  Modal,
  TextInput,
  Box,
  Text,
  Group,
  Badge,
  useMantineTheme,
  useMantineColorScheme,
  ScrollArea,
  Kbd,
  Stack,
} from '@mantine/core'
import { useHotkeys } from '@mantine/hooks'
import {
  IconSearch,
  IconHome,
  IconUsersGroup,
  IconMap2,
  IconBuildingStore,
  IconShield,
  IconPackage,
  IconTags,
  IconClipboardCheck,
  IconBarcode,
  IconTrendingUp,
  IconClockHour3,
  IconArrowsRightLeft,
  IconFileText,
  IconDeviceLaptop,
  IconShoppingCartCheck,
  IconMessageReply,
  IconShoppingBagCheck,
  IconCreditCardRefund,
  IconFileUnknown,
  IconCalendarDollar,
  IconFilePencil,
  IconReportMoney,
  IconAlertCircle,
  IconZoomMoney,
  IconChartPie,
  IconBook,
  IconClock,
  IconTarget,
  IconChartBar,
  IconSlideshow,
  IconBuildingSkyscraper,
  IconArrowRight,
} from '@tabler/icons-react'
import { useNavigate } from 'react-router-dom'
import { useFilteredMenu } from '@layout/dashboard/constants/FilteredMenu'
import { menuData } from '@layout/dashboard/constants/menu'

interface SearchItem {
  name: string
  link: string
  group: string
  icon: React.FC<any>
  keywords?: string[]
}

// Full search index built from menu + settings pages
const ALL_ITEMS: SearchItem[] = [
  // Main
  { name: 'Dashboard', link: '/', group: 'Main', icon: IconHome },
  {
    name: 'Users',
    link: '/user-management',
    group: 'Main',
    icon: IconUsersGroup,
  },
  { name: 'Areas', link: '/areas-management', group: 'Main', icon: IconMap2 },
  {
    name: 'Stores',
    link: '/stores-management',
    group: 'Main',
    icon: IconBuildingStore,
  },
  {
    name: 'Roles & Permissions',
    link: '/roles-permissions',
    group: 'Main',
    icon: IconShield,
  },
  // Items Master
  {
    name: 'Products',
    link: '/items-master/products',
    group: 'Items Master',
    icon: IconPackage,
    keywords: ['medicine', 'drugs', 'items'],
  },
  {
    name: 'Categories',
    link: '/items-master/products/categories',
    group: 'Items Master',
    icon: IconTags,
  },
  {
    name: 'Units',
    link: '/items-master/products/units',
    group: 'Items Master',
    icon: IconClipboardCheck,
  },
  {
    name: 'Barcode Manager',
    link: '/items-master/bar-codes',
    group: 'Items Master',
    icon: IconBarcode,
    keywords: ['scan', 'barcode'],
  },
  // Inventory
  {
    name: 'Stock List',
    link: '/inventory/stock-list',
    group: 'Inventory',
    icon: IconClipboardCheck,
    keywords: ['stock', 'inventory'],
  },
  {
    name: 'Low Stock',
    link: '/inventory/low-stock',
    group: 'Inventory',
    icon: IconAlertCircle,
    keywords: ['alert', 'low'],
  },
  {
    name: 'Fast Moving Items',
    link: '/inventory/fast-moving-items',
    group: 'Inventory',
    icon: IconTrendingUp,
  },
  {
    name: 'Expiring Soon',
    link: '/inventory/expiring-soon',
    group: 'Inventory',
    icon: IconClockHour3,
    keywords: ['expire', 'expiry'],
  },
  {
    name: 'Stock Adjustment',
    link: '/inventory/stock-adjustment',
    group: 'Inventory',
    icon: IconClipboardCheck,
  },
  {
    name: 'Stock History',
    link: '/inventory/stock-history',
    group: 'Inventory',
    icon: IconFileText,
  },
  {
    name: 'Stock Transfer',
    link: '/inventory/stock-transfer',
    group: 'Inventory',
    icon: IconArrowsRightLeft,
    keywords: ['transfer', 'move'],
  },
  // Sales
  {
    name: 'Point of Sale (POS)',
    link: '/sales/pos',
    group: 'Sales',
    icon: IconDeviceLaptop,
    keywords: ['pos', 'sale', 'cashier', 'sell'],
  },
  {
    name: 'Customers',
    link: '/sales/customers',
    group: 'Sales',
    icon: IconUsersGroup,
  },
  {
    name: 'Sales Orders',
    link: '/sales/orders',
    group: 'Sales',
    icon: IconShoppingCartCheck,
  },
  {
    name: 'Sales Returns',
    link: '/sales/sales-return',
    group: 'Sales',
    icon: IconMessageReply,
    keywords: ['return', 'refund'],
  },
  // Purchases
  {
    name: 'Purchase Order (POP)',
    link: '/purchases/pop',
    group: 'Purchases',
    icon: IconShoppingBagCheck,
    keywords: ['pop', 'purchase', 'order'],
  },
  {
    name: 'Suppliers',
    link: '/purchases/suppliers',
    group: 'Purchases',
    icon: IconUsersGroup,
  },
  {
    name: 'Purchase Orders History',
    link: '/purchases/order-history',
    group: 'Purchases',
    icon: IconShoppingBagCheck,
  },
  {
    name: 'Ordered Products',
    link: '/purchases/order-items',
    group: 'Purchases',
    icon: IconFileUnknown,
  },
  {
    name: 'Purchase Return',
    link: '/purchases/purchase-return',
    group: 'Purchases',
    icon: IconCreditCardRefund,
  },
  // Finance
  {
    name: 'Expenses',
    link: '/expense',
    group: 'Finance',
    icon: IconCalendarDollar,
  },
  {
    name: 'Expense Category',
    link: '/expense-category',
    group: 'Finance',
    icon: IconTags,
  },
  { name: 'Income', link: '/income', group: 'Finance', icon: IconFilePencil },
  {
    name: 'Income Category',
    link: '/income-category',
    group: 'Finance',
    icon: IconTags,
  },
  {
    name: 'Balance Sheet',
    link: '/accounting/balance-sheet',
    group: 'Finance',
    icon: IconReportMoney,
  },
  {
    name: 'Trial Balance',
    link: '/trial-balance',
    group: 'Finance',
    icon: IconAlertCircle,
  },
  {
    name: 'Cash Flow',
    link: '/cash-flow',
    group: 'Finance',
    icon: IconZoomMoney,
  },
  {
    name: 'Profit & Loss',
    link: '/profit-and-loss',
    group: 'Finance',
    icon: IconChartPie,
  },
  {
    name: 'Journal Entries',
    link: '/journal-entries',
    group: 'Finance',
    icon: IconBook,
  },
  {
    name: 'AR/AP Aging',
    link: '/ar-ap-aging',
    group: 'Finance',
    icon: IconClock,
  },
  {
    name: 'Budget Management',
    link: '/budget-management',
    group: 'Finance',
    icon: IconTarget,
  },
  // Settings
  {
    name: 'Company Settings',
    link: '/settings/company',
    group: 'Settings',
    icon: IconBuildingSkyscraper,
  },
  {
    name: 'Preferences',
    link: '/settings/preferences',
    group: 'Settings',
    icon: IconSlideshow,
  },
]

function scoreMatch(item: SearchItem, query: string): number {
  const q = query.toLowerCase()
  const name = item.name.toLowerCase()
  const group = item.group.toLowerCase()
  const kw = (item.keywords ?? []).join(' ').toLowerCase()

  if (name === q) return 100
  if (name.startsWith(q)) return 80
  if (name.includes(q)) return 60
  if (kw.includes(q)) return 40
  if (group.includes(q)) return 20
  // fuzzy: all chars appear in order
  let idx = 0
  for (const ch of q) {
    const found = name.indexOf(ch, idx)
    if (found === -1) return 0
    idx = found + 1
  }
  return 10
}

const GROUP_ORDER = [
  'Main',
  'Sales',
  'Purchases',
  'Inventory',
  'Items Master',
  'Finance',
  'Settings',
]

interface GlobalSearchProps {
  opened: boolean
  onClose: () => void
}

export function GlobalSearch({ opened, onClose }: GlobalSearchProps) {
  const theme = useMantineTheme()
  const { colorScheme } = useMantineColorScheme()
  const isDark = colorScheme === 'dark'
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [activeIdx, setActiveIdx] = useState(0)

  const results = React.useMemo(() => {
    if (!query.trim()) return ALL_ITEMS.slice(0, 8)
    return ALL_ITEMS.map((item) => ({ item, score: scoreMatch(item, query) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 12)
      .map((x) => x.item)
  }, [query])

  // Group results when no query (show all sections), flat when searching
  const grouped = React.useMemo(() => {
    if (!query.trim()) {
      const groups: Record<string, SearchItem[]> = {}
      for (const item of results) {
        if (!groups[item.group]) groups[item.group] = []
        groups[item.group].push(item)
      }
      return groups
    }
    return null
  }, [query, results])

  const flatResults = grouped ? Object.values(grouped).flat() : results

  useEffect(() => {
    setActiveIdx(0)
  }, [results])
  useEffect(() => {
    if (opened) {
      setTimeout(() => inputRef.current?.focus(), 50)
    } else {
      setQuery('')
    }
  }, [opened])

  const handleSelect = useCallback(
    (item: SearchItem) => {
      navigate(item.link)
      onClose()
      setQuery('')
    },
    [navigate, onClose],
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIdx((i) => Math.min(i + 1, flatResults.length - 1))
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIdx((i) => Math.max(i - 1, 0))
      }
      if (e.key === 'Enter' && flatResults[activeIdx]) {
        handleSelect(flatResults[activeIdx])
      }
      if (e.key === 'Escape') {
        onClose()
      }
    },
    [flatResults, activeIdx, handleSelect, onClose],
  )

  /* ── tokens via theme ─────────────────────────────── */
  const surface = isDark ? theme.colors.dark[7] : theme.white
  const surfaceHover = isDark ? theme.colors.dark[6] : theme.colors.gray[0]
  const surfaceActive = isDark
    ? theme.colors.dark[5]
    : theme.colors[theme.primaryColor][0]
  const borderCol = isDark ? theme.colors.dark[5] : theme.colors.gray[2]
  const textPrimary = isDark ? theme.colors.dark[0] : theme.colors.gray[9]
  const textMuted = isDark ? theme.colors.dark[3] : theme.colors.gray[5]
  const inputBg = isDark ? theme.colors.dark[8] : theme.colors.gray[0]
  const primaryColor = theme.colors[theme.primaryColor][isDark ? 4 : 6]

  const groupColors: Record<string, string> = {
    Main: theme.colors.blue[isDark ? 4 : 6],
    Sales: theme.colors.violet[isDark ? 4 : 6],
    Purchases: theme.colors.teal[isDark ? 4 : 6],
    Inventory: theme.colors.orange[isDark ? 4 : 6],
    'Items Master': theme.colors.indigo[isDark ? 4 : 6],
    Finance: theme.colors.green[isDark ? 4 : 6],
    Settings: theme.colors.gray[isDark ? 4 : 6],
  }

  const renderItem = (
    item: SearchItem,
    globalIdx: number,
    showGroup = false,
  ) => {
    const isActive = globalIdx === activeIdx
    const Icon = item.icon
    return (
      <Box
        key={item.link}
        onMouseEnter={() => setActiveIdx(globalIdx)}
        onClick={() => handleSelect(item)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '8px 10px',
          borderRadius: 8,
          cursor: 'pointer',
          backgroundColor: isActive ? surfaceActive : 'transparent',
          border: `1px solid ${isActive ? theme.colors[theme.primaryColor][isDark ? 8 : 2] : 'transparent'}`,
          transition: 'background 0.1s',
        }}
      >
        <Box
          style={{
            width: 30,
            height: 30,
            borderRadius: 7,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: isActive
              ? isDark
                ? `${theme.colors[theme.primaryColor][9]}80`
                : `${theme.colors[theme.primaryColor][1]}`
              : isDark
                ? theme.colors.dark[6]
                : theme.colors.gray[1],
            border: `1px solid ${isDark ? theme.colors.dark[4] : theme.colors.gray[2]}`,
          }}
        >
          <Icon
            size={15}
            stroke={1.6}
            style={{ color: isActive ? primaryColor : textMuted }}
          />
        </Box>

        <Box style={{ flex: 1, minWidth: 0 }}>
          <Text
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: textPrimary,
              lineHeight: 1.3,
            }}
          >
            {item.name}
          </Text>
          {showGroup && (
            <Text style={{ fontSize: 11, color: textMuted, lineHeight: 1.2 }}>
              {item.group}
            </Text>
          )}
        </Box>

        {isActive && (
          <Box style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Text style={{ fontSize: 11, color: textMuted }}>Jump to</Text>
            <IconArrowRight
              size={12}
              stroke={2}
              style={{ color: textMuted }}
            />
          </Box>
        )}

        {!isActive && showGroup && (
          <Badge
            size="xs"
            variant="light"
            radius={4}
            style={{
              backgroundColor: isDark
                ? `${groupColors[item.group]}20`
                : `${groupColors[item.group]}15`,
              color: groupColors[item.group],
              border: 'none',
              fontWeight: 500,
              fontSize: 10,
            }}
          >
            {item.group}
          </Badge>
        )}
      </Box>
    )
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      withCloseButton={false}
      padding={0}
      radius={12}
      size={520}
      centered
      overlayProps={{ blur: 4, backgroundOpacity: isDark ? 0.6 : 0.3 }}
      styles={{
        content: {
          backgroundColor: surface,
          border: `1px solid ${borderCol}`,
          overflow: 'hidden',
          boxShadow: isDark
            ? '0 0 0 1px rgba(255,255,255,0.06), 0 24px 48px rgba(0,0,0,0.7)'
            : '0 0 0 1px rgba(0,0,0,0.06), 0 24px 48px rgba(0,0,0,0.15)',
        },
        body: { padding: 0 },
      }}
    >
      {/* Search input */}
      <Box
        style={{
          padding: '12px 12px 8px',
          borderBottom: `1px solid ${borderCol}`,
        }}
      >
        <TextInput
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search pages, features, settings…"
          leftSection={
            <IconSearch
              size={16}
              stroke={1.8}
              style={{ color: textMuted }}
            />
          }
          rightSection={
            <Kbd
              style={{
                fontSize: 10,
                color: textMuted,
                backgroundColor: isDark
                  ? theme.colors.dark[6]
                  : theme.colors.gray[1],
              }}
            >
              ESC
            </Kbd>
          }
          variant="unstyled"
          styles={{
            input: {
              backgroundColor: 'transparent',
              fontSize: 14,
              color: textPrimary,
              height: 40,
              '&::placeholder': { color: textMuted },
            },
          }}
        />
      </Box>

      {/* Results */}
      <ScrollArea
        h={Math.min(
          flatResults.length * 50 +
            (grouped ? Object.keys(grouped).length * 28 : 0) +
            20,
          380,
        )}
      >
        <Box p={8}>
          {flatResults.length === 0 ? (
            <Box
              py={32}
              style={{ textAlign: 'center' }}
            >
              <IconSearch
                size={28}
                stroke={1.2}
                style={{ color: textMuted, margin: '0 auto 8px' }}
              />
              <Text style={{ fontSize: 13, color: textMuted }}>
                No results for "{query}"
              </Text>
            </Box>
          ) : grouped ? (
            // No-query state: show grouped
            Object.entries(grouped)
              .sort(
                ([a], [b]) => GROUP_ORDER.indexOf(a) - GROUP_ORDER.indexOf(b),
              )
              .map(([group, items]) => {
                const startIdx = Object.entries(grouped)
                  .sort(
                    ([a], [b]) =>
                      GROUP_ORDER.indexOf(a) - GROUP_ORDER.indexOf(b),
                  )
                  .slice(
                    0,
                    Object.entries(grouped).findIndex(([g]) => g === group),
                  )
                  .reduce((acc, [, arr]) => acc + arr.length, 0)
                return (
                  <Box
                    key={group}
                    mb={4}
                  >
                    <Text
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: '0.07em',
                        textTransform: 'uppercase',
                        color: textMuted,
                        padding: '6px 10px 4px',
                      }}
                    >
                      {group}
                    </Text>
                    {items.map((item, i) =>
                      renderItem(item, startIdx + i, false),
                    )}
                  </Box>
                )
              })
          ) : (
            // Query state: flat with group badge
            results.map((item, i) => renderItem(item, i, true))
          )}
        </Box>
      </ScrollArea>

      {/* Footer hint */}
      <Box
        style={{
          borderTop: `1px solid ${borderCol}`,
          padding: '7px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <Group
          gap={6}
          wrap="nowrap"
        >
          <Kbd
            style={{
              fontSize: 10,
              color: textMuted,
              backgroundColor: isDark
                ? theme.colors.dark[6]
                : theme.colors.gray[1],
            }}
          >
            ↑↓
          </Kbd>
          <Text style={{ fontSize: 11, color: textMuted }}>navigate</Text>
        </Group>
        <Group
          gap={6}
          wrap="nowrap"
        >
          <Kbd
            style={{
              fontSize: 10,
              color: textMuted,
              backgroundColor: isDark
                ? theme.colors.dark[6]
                : theme.colors.gray[1],
            }}
          >
            ↵
          </Kbd>
          <Text style={{ fontSize: 11, color: textMuted }}>open</Text>
        </Group>
        <Group
          gap={6}
          wrap="nowrap"
        >
          <Kbd
            style={{
              fontSize: 10,
              color: textMuted,
              backgroundColor: isDark
                ? theme.colors.dark[6]
                : theme.colors.gray[1],
            }}
          >
            Ctrl K
          </Kbd>
          <Text style={{ fontSize: 11, color: textMuted }}>toggle</Text>
        </Group>
      </Box>
    </Modal>
  )
}

