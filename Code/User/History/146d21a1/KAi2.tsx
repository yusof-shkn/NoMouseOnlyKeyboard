// src/pages/Finance/TrialBalance/TrialBalance.config.tsx
import { Text, Group, Box, Tooltip } from '@mantine/core'
import {
  IconFileText,
  IconFileSpreadsheet,
  IconRefresh,
  IconScale,
  IconCoin,
  IconBuildingBank,
  IconChartBar,
} from '@tabler/icons-react'
import {
  TrialBalanceEntry,
  TrialBalanceStats,
  TrialBalanceSection,
} from './types/trialBalance.types'
import { ReactNode } from 'react'
import { formatCurrency, getBalanceDisplay } from './utils/trialBalance.utils'
import { getTextColor, getThemeColors } from '@app/core/theme/theme.utils'

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
  badge?: { text: string; color: string }
}

/**
 * Column definitions for trial balance table.
 * NOTE: hooks cannot be called inside render functions — pass theme/colorScheme
 * from the parent component instead.
 */
export const getTrialBalanceColumns = (
  currency?: string,
  theme?: any,
  colorScheme?: 'light' | 'dark',
): any[] => {
  const cs = colorScheme ?? 'light'

  return [
    {
      header: 'Account Name',
      accessor: 'account_name',
      maxWidth: 300,
      render: (row: TrialBalanceEntry) => (
        <Group
          gap="sm"
          wrap="nowrap"
          style={{ minWidth: 0 }}
        >
          <Box style={{ minWidth: 0, flex: 1 }}>
            <Tooltip
              label={row.account_name}
              withinPortal
            >
              <Text
                fw={600}
                size="sm"
                c={theme ? getTextColor(theme, cs, 'primary') : undefined}
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {row.account_name}
              </Text>
            </Tooltip>
            <Text
              c="dimmed"
              size="xs"
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {row.account_code}
            </Text>
          </Box>
        </Group>
      ),
    },
    {
      header: 'Credit',
      accessor: 'credit',
      align: 'right' as const,
      render: (row: TrialBalanceEntry) => {
        const { credit } = getBalanceDisplay(row)
        return credit > 0 ? (
          <Text
            size="sm"
            fw={500}
            c={theme?.colors.blue[6]}
          >
            {formatCurrency(credit, currency)}
          </Text>
        ) : (
          <Text
            size="sm"
            c="dimmed"
          >
            -
          </Text>
        )
      },
    },
    {
      header: 'Debit',
      accessor: 'debit',
      align: 'right' as const,
      render: (row: TrialBalanceEntry) => {
        const { debit } = getBalanceDisplay(row)
        return debit > 0 ? (
          <Text
            size="sm"
            fw={500}
            c={theme?.colors.green[6]}
          >
            {formatCurrency(debit, currency)}
          </Text>
        ) : (
          <Text
            size="sm"
            c="dimmed"
          >
            -
          </Text>
        )
      },
    },
  ]
}

/**
 * Build a section header row for the table.
 */
export const getSectionRow = (section: TrialBalanceSection) => ({
  account_code: '',
  account_name: section.title,
  account_type: section.accountType,
  account_subtype: null,
  normal_balance: 'debit' as const,
  total_debits: 0,
  total_credits: 0,
  net_balance: 0,
  balance: 0,
  account_id: 0,
  company_id: 0,
  _isSection: true,
  _sectionData: section,
})

/**
 * Build a section total row for the table.
 */
export const getTotalRow = (section: TrialBalanceSection) => ({
  account_code: '',
  account_name: `Total ${section.title}`,
  account_type: section.accountType,
  account_subtype: null,
  normal_balance: 'debit' as const,
  total_debits: section.totalDebits,
  total_credits: section.totalCredits,
  net_balance: 0,
  balance: 0,
  account_id: 0,
  company_id: 0,
  _isTotal: true,
  _totalDebits: section.totalDebits,
  _totalCredits: section.totalCredits,
})

/**
 * Build the grand total row for the table.
 */
export const getGrandTotalRow = (stats: TrialBalanceStats) => ({
  account_code: '',
  account_name: 'TOTAL',
  account_type: '',
  account_subtype: null,
  normal_balance: 'debit' as const,
  total_debits: stats.totalDebits,
  total_credits: stats.totalCredits,
  net_balance: 0,
  balance: 0,
  account_id: 0,
  company_id: 0,
  _isGrandTotal: true,
  _totalDebits: stats.totalDebits,
  _totalCredits: stats.totalCredits,
})

/**
 * Flatten sections + totals into a single array for the table renderer.
 */
export const prepareTableData = (
  sections: TrialBalanceSection[],
  stats: TrialBalanceStats,
): any[] => {
  const tableData: any[] = []

  sections.forEach((section, index) => {
    tableData.push(getSectionRow(section))
    section.entries.forEach((entry) => tableData.push(entry))
    tableData.push(getTotalRow(section))

    // Spacer between sections (not after last)
    if (index < sections.length - 1) {
      tableData.push({
        account_code: '',
        account_name: '',
        account_type: '',
        account_subtype: null,
        normal_balance: 'debit' as const,
        total_debits: 0,
        total_credits: 0,
        net_balance: 0,
        balance: 0,
        account_id: 0,
        company_id: 0,
        _isSpacer: true,
      })
    }
  })

  tableData.push(getGrandTotalRow(stats))
  return tableData
}

/**
 * Custom row renderer for section/total/spacer rows.
 * Regular entry rows are rendered by the parent component.
 */
export const renderCustomRow = (
  row: any,
  currency?: string,
  theme?: any,
  colorScheme?: 'light' | 'dark',
): JSX.Element | null => {
  const isDark = colorScheme === 'dark'
  const colors = theme ? getThemeColors(theme, colorScheme ?? 'light') : null

  if (row._isSection) {
    return (
      <tr
        style={{
          backgroundColor: isDark
            ? theme?.colors.dark[6]
            : theme?.colors.gray[0],
        }}
      >
        <td colSpan={3}>
          <Text
            fw={700}
            size="md"
            c={colors?.text ?? 'dark'}
            tt="uppercase"
          >
            {row.account_name}
          </Text>
        </td>
      </tr>
    )
  }

  if (row._isTotal) {
    return (
      <tr
        style={{
          backgroundColor: isDark
            ? theme?.colors.dark[5]
            : theme?.colors.gray[1],
          fontWeight: 600,
        }}
      >
        <td>
          <Text
            fw={700}
            size="sm"
            c={colors?.text ?? 'dark'}
          >
            {row.account_name}
          </Text>
        </td>
        <td style={{ textAlign: 'right' }}>
          <Text
            fw={700}
            size="sm"
            c={theme?.colors.blue[6]}
          >
            {formatCurrency(row._totalCredits, currency)}
          </Text>
        </td>
        <td style={{ textAlign: 'right' }}>
          <Text
            fw={700}
            size="sm"
            c={theme?.colors.green[6]}
          >
            {formatCurrency(row._totalDebits, currency)}
          </Text>
        </td>
      </tr>
    )
  }

  if (row._isGrandTotal) {
    return (
      <tr
        style={{
          backgroundColor: isDark
            ? theme?.colors.dark[4]
            : theme?.colors.gray[2],
          fontWeight: 700,
        }}
      >
        <td>
          <Text
            fw={900}
            size="lg"
            c={colors?.text ?? 'dark'}
          >
            {row.account_name}
          </Text>
        </td>
        <td style={{ textAlign: 'right' }}>
          <Text
            fw={900}
            size="lg"
            c={theme?.colors.blue[6]}
          >
            {formatCurrency(row._totalCredits, currency)}
          </Text>
        </td>
        <td style={{ textAlign: 'right' }}>
          <Text
            fw={900}
            size="lg"
            c={theme?.colors.green[6]}
          >
            {formatCurrency(row._totalDebits, currency)}
          </Text>
        </td>
      </tr>
    )
  }

  if (row._isSpacer) {
    return (
      <tr style={{ height: '10px' }}>
        <td
          colSpan={3}
          style={{ padding: 0 }}
        />
      </tr>
    )
  }

  return null
}

interface HeaderActionHandlers {
  onExportPDF: () => void
  onExportExcel: () => void
  onRefresh: () => void
}

export const getTrialBalanceHeaderActions = (
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

export const getStatisticsCardsData = (
  stats: TrialBalanceStats,
  currency?: string,
): StatCard[] => [
  {
    icon: <IconChartBar />,
    number: stats.totalAccounts.toString(),
    label: 'Total Accounts',
    color: 'blue',
  },
  {
    icon: <IconCoin />,
    number: formatCurrency(stats.totalDebits, currency),
    label: `Total Debits${currency ? ` (${currency})` : ''}`,
    color: 'green',
  },
  {
    icon: <IconBuildingBank />,
    number: formatCurrency(stats.totalCredits, currency),
    label: `Total Credits${currency ? ` (${currency})` : ''}`,
    color: 'cyan',
  },
  {
    icon: <IconScale />,
    number: stats.isBalanced ? 'Balanced' : 'Unbalanced',
    label: 'Balance Status',
    color: stats.isBalanced ? 'green' : 'red',
    badge: stats.isBalanced
      ? { text: '✓ Books Balanced', color: 'green' }
      : { text: '⚠ Not Balanced', color: 'red' },
  },
]

