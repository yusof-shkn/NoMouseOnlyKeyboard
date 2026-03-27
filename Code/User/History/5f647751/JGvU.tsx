// src/pages/BalanceSheet/config/balanceSheet.config.tsx
import { Text, Badge, Box, Tooltip, MantineTheme } from '@mantine/core'
import {
  IconFileText,
  IconFileSpreadsheet,
  IconRefresh,
  IconWallet,
  IconCreditCard,
  IconCoins,
  IconChartBar,
} from '@tabler/icons-react'
import {
  BalanceSheetEntry,
  BalanceSheetStats,
} from './types/balanceSheet.types'
import { ReactNode } from 'react'
import { formatCurrency } from './utils/balanceSheet.utils'
import { getTextColor } from '@app/core/theme/theme.utils'

interface HeaderAction {
  title: string
  icon: ReactNode
  color: string
  onClick: () => void
}

interface StatCard {
  icon: ReactNode
  number: string
  label: string
  color: string
}

/**
 * Get badge color for account type
 */
const getAccountTypeBadgeColor = (type: string) => {
  switch (type) {
    case 'asset':
      return 'blue'
    case 'liability':
      return 'red'
    case 'equity':
      return 'green'
    default:
      return 'gray'
  }
}

/**
 * Format account type for display
 */
const formatAccountType = (type: string) => {
  const typeMap: Record<string, string> = {
    asset: 'Asset',
    liability: 'Liability',
    equity: 'Equity',
  }
  return typeMap[type] || type
}

/**
 * Format account subtype for display
 * Safely handles null/undefined values
 */
const formatAccountSubtype = (subtype: string | null | undefined): string => {
  if (!subtype) return ''
  return subtype
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/**
 * Column definitions for Balance Sheet
 *
 * IMPORTANT: hooks (useMantineColorScheme, useMantineTheme) CANNOT be called
 * inside render functions — render() is called inside Array.map() in TableContent,
 * not at the top level of a React component, which violates Rules of Hooks.
 *
 * Solution: call hooks in BalanceSheetManagement and pass theme/colorScheme
 * as parameters to this function. The render closures capture them from scope.
 */
export const getBalanceSheetColumns = (
  currency: string = 'UGX',
  theme: MantineTheme,
  colorScheme: 'light' | 'dark',
): any[] => {
  const resolvedColorScheme: 'light' | 'dark' =
    colorScheme === 'dark' ? 'dark' : 'light'

  return [
    {
      header: 'Account Code',
      accessor: 'account_code',
      maxWidth: 120,
      render: (row: BalanceSheetEntry) => (
        <Text
          fw={600}
          size="sm"
          c="dimmed"
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {row.account_code}
        </Text>
      ),
    },
    {
      header: 'Account Name',
      accessor: 'account_name',
      maxWidth: 250,
      render: (row: BalanceSheetEntry) => (
        <Box style={{ minWidth: 0 }}>
          <Tooltip
            label={row.account_name}
            withinPortal
          >
            <Text
              fw={600}
              size="sm"
              c={getTextColor(theme, resolvedColorScheme)}
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {row.account_name}
            </Text>
          </Tooltip>
          {row.account_subtype ? (
            <Text
              c="dimmed"
              size="xs"
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {formatAccountSubtype(row.account_subtype)}
            </Text>
          ) : null}
        </Box>
      ),
    },
    {
      header: 'Type',
      accessor: 'account_type',
      maxWidth: 120,
      render: (row: BalanceSheetEntry) => (
        <Badge
          variant="light"
          color={getAccountTypeBadgeColor(row.account_type)}
          size="lg"
          style={{ fontWeight: 600 }}
        >
          {formatAccountType(row.account_type)}
        </Badge>
      ),
    },
    {
      header: 'Debit',
      accessor: 'debit',
      maxWidth: 150,
      render: (row: BalanceSheetEntry) => (
        <Text
          fw={500}
          size="sm"
          ta="right"
          c={
            row.debit > 0 ? getTextColor(theme, resolvedColorScheme) : 'dimmed'
          }
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {row.debit > 0 ? formatCurrency(row.debit, currency) : '-'}
        </Text>
      ),
    },
    {
      header: 'Credit',
      accessor: 'credit',
      maxWidth: 150,
      render: (row: BalanceSheetEntry) => (
        <Text
          fw={500}
          size="sm"
          ta="right"
          c={
            row.credit > 0 ? getTextColor(theme, resolvedColorScheme) : 'dimmed'
          }
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {row.credit > 0 ? formatCurrency(row.credit, currency) : '-'}
        </Text>
      ),
    },
    {
      header: 'Balance',
      accessor: 'balance',
      maxWidth: 150,
      render: (row: BalanceSheetEntry) => (
        // FIXED: row.balance is now a signed value (raw from the view).
        // Always display the absolute value here — the sign is already
        // communicated by which of the Debit / Credit columns is filled.
        <Text
          fw={700}
          size="sm"
          ta="right"
          c={getAccountTypeBadgeColor(row.account_type)}
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {formatCurrency(Math.abs(row.balance), currency)}
        </Text>
      ),
    },
  ]
}

interface HeaderActionHandlers {
  onExportPDF: () => void
  onExportExcel: () => void
  onRefresh: () => void
}

/**
 * Header actions
 */
export const getBalanceSheetHeaderActions = (
  handlers: HeaderActionHandlers,
): HeaderAction[] => [
  {
    title: 'Export PDF',
    icon: <IconFileText size={20} />,
    color: 'red',
    onClick: handlers.onExportPDF,
  },
  {
    title: 'Export Excel',
    icon: <IconFileSpreadsheet size={20} />,
    color: 'green',
    onClick: handlers.onExportExcel,
  },
  {
    title: 'Refresh',
    icon: <IconRefresh size={20} />,
    color: 'gray',
    onClick: handlers.onRefresh,
  },
]

interface FilterHandlers {
  onAccountTypeChange: (value: string) => void
  currentAccountTypeFilter?: string
}

/**
 * Filter configurations
 */
export const getBalanceSheetFilters = (handlers: FilterHandlers): any[] => {
  return [
    {
      label: 'Account Type',
      options: [
        { label: 'All Accounts', value: 'all' },
        { label: 'Assets', value: 'asset' },
        { label: 'Liabilities', value: 'liability' },
        { label: 'Equity', value: 'equity' },
      ],
      onChange: handlers.onAccountTypeChange,
      value: handlers.currentAccountTypeFilter || 'all',
    },
  ]
}

/**
 * Statistics cards
 */
export const getStatisticsCardsData = (
  stats: BalanceSheetStats,
  currency: string = 'UGX',
): StatCard[] => {
  // FIXED: stats values are now signed (summed directly from the view).
  // Use Math.abs() for display so cards always show positive numbers,
  // while the validation check uses raw signed values for accuracy.
  const validation =
    Math.abs(stats.totalAssets - (stats.totalLiabilities + stats.totalEquity)) <
    0.01

  return [
    {
      icon: <IconWallet />,
      number: formatCurrency(Math.abs(stats.totalAssets), currency),
      label: 'Total Assets',
      color: 'blue',
    },
    {
      icon: <IconCreditCard />,
      number: formatCurrency(Math.abs(stats.totalLiabilities), currency),
      label: 'Total Liabilities',
      color: 'red',
    },
    {
      icon: <IconCoins />,
      number: formatCurrency(Math.abs(stats.totalEquity), currency),
      label: 'Total Equity',
      color: 'green',
    },
    {
      icon: <IconChartBar />,
      number: stats.accountsCount.toString(),
      label: validation ? 'Accounts (Balanced)' : 'Accounts (Unbalanced)',
      color: validation ? 'teal' : 'orange',
    },
  ]
}

/**
 * Get totals row data
 */
export const getTotalsRow = (
  totalAssets: number,
  totalLiabilities: number,
  totalEquity: number,
  currency: string = 'UGX',
): {
  label: string
  debit: string
  credit: string
  balance: string
}[] => {
  // FIXED: totalAssets / totalLiabilities / totalEquity are now signed values.
  // Wrap in Math.abs() for display so the totals row always shows positive figures.
  return [
    {
      label: 'Total Assets',
      debit: formatCurrency(Math.abs(totalAssets), currency),
      credit: '-',
      balance: formatCurrency(Math.abs(totalAssets), currency),
    },
    {
      label: 'Total Liabilities',
      debit: '-',
      credit: formatCurrency(Math.abs(totalLiabilities), currency),
      balance: formatCurrency(Math.abs(totalLiabilities), currency),
    },
    {
      label: 'Total Equity',
      debit: '-',
      credit: formatCurrency(Math.abs(totalEquity), currency),
      balance: formatCurrency(Math.abs(totalEquity), currency),
    },
    {
      label: 'Total Liabilities + Equity',
      debit: '-',
      credit: formatCurrency(
        Math.abs(totalLiabilities + totalEquity),
        currency,
      ),
      balance: formatCurrency(
        Math.abs(totalLiabilities + totalEquity),
        currency,
      ),
    },
  ]
}

