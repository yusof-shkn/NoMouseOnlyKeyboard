// src/pages/BalanceSheet/BalanceSheetManagement.tsx
import { useState, useEffect, useCallback } from 'react'
import {
  Container,
  Paper,
  Text,
  Box,
  Group,
  Badge,
  useMantineColorScheme,
  useMantineTheme,
  Stack,
} from '@mantine/core'
import { useDebouncedCallback } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { DatePickerInput } from '@mantine/dates'
import PageHeader from '@shared/components/tableHeader/TableHeader'
import ContentTable from '@shared/components/tableContent/TableContent'
import StatisticsCard from '@shared/components/statistics/StatisticsCard'
import { useAuth } from '@shared/contexts'
import {
  BalanceSheetEntry,
  BalanceSheetStats,
} from './types/balanceSheet.types'
import {
  fetchBalanceSheetData,
  fetchBalanceSheetStatistics,
  formatCurrency,
  validateBalanceSheetEquation,
} from './utils/balanceSheet.utils'
import {
  handleExportPDF,
  handleExportExcel,
  handleAccountTypeChange,
  handleDateChange,
} from './handlers/balanceSheet.handlers'
import {
  getBalanceSheetColumns,
  getBalanceSheetHeaderActions,
  getBalanceSheetFilters,
  getStatisticsCardsData,
} from './BalanceSheet.config'
import { LayoutSkeleton } from '@shared/components/skeletons/Layout.skeleton'
import { PageWrapper } from '@shared/styles/PageWrapper'
import {
  getPaperBackground,
  getBorderColor,
  getTextColor,
  getThemeShadow,
} from '@app/core/theme/theme.utils'

const BalanceSheetManagement = () => {
  // ✅ Hooks called at the TOP LEVEL of the component — never inside render callbacks
  const { colorScheme } = useMantineColorScheme()
  const theme = useMantineTheme()
  const resolvedColorScheme: 'light' | 'dark' =
    colorScheme === 'dark' ? 'dark' : 'light'
  const isDark = colorScheme === 'dark'

  // Get company and settings from AuthProvider
  const {
    company,
    companySettings,
    isLoading: authLoading,
    isAuthInitialized,
  } = useAuth()

  const [balanceSheetData, setBalanceSheetData] = useState<BalanceSheetEntry[]>(
    [],
  )
  const [loading, setLoading] = useState<boolean>(true)
  const [stats, setStats] = useState<BalanceSheetStats>({
    totalAssets: 0,
    totalLiabilities: 0,
    totalEquity: 0,
    accountsCount: 0,
  })
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(10)
  const [totalCount, setTotalCount] = useState<number>(0)
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [accountTypeFilter, setAccountTypeFilter] = useState<
    'all' | 'asset' | 'liability' | 'equity'
  >('all')
  const [asOfDate, setAsOfDate] = useState<string>(
    new Date().toISOString().split('T')[0],
  )
  const [totals, setTotals] = useState({
    totalAssets: 0,
    totalLiabilities: 0,
    totalEquity: 0,
  })

  // Get currency from company settings
  const currency =
    companySettings?.base_currency || companySettings?.default_currency || 'UGX'

  // Fetch all data
  const fetchAllData = useCallback(async () => {
    if (!company?.id) {
      setLoading(false)
      setBalanceSheetData([])
      setTotalCount(0)
      return
    }

    try {
      setLoading(true)

      const currentFilters = {
        page: currentPage,
        pageSize,
        searchQuery,
        asOfDate,
        accountType: accountTypeFilter,
        companyId: company.id,
        currency,
      }

      const [statsData, balanceSheetResult] = await Promise.all([
        fetchBalanceSheetStatistics(company.id),
        fetchBalanceSheetData(currentFilters),
      ])

      setStats(statsData)
      setBalanceSheetData(balanceSheetResult.balanceSheetData)
      setTotalCount(balanceSheetResult.totalCount)
      setTotals(balanceSheetResult.totals)
    } catch (error) {
      console.error('Error fetching data:', error)
      notifications.show({
        title: 'Error',
        message: 'Failed to load balance sheet data',
        color: 'red',
      })
    } finally {
      setLoading(false)
    }
  }, [
    currentPage,
    pageSize,
    searchQuery,
    asOfDate,
    accountTypeFilter,
    company?.id,
    currency,
  ])

  // Local refresh handler
  const handleRefresh = useCallback(async () => {
    try {
      setLoading(true)
      await fetchAllData()
      notifications.show({
        title: 'Refreshed',
        message: 'Balance sheet data refreshed successfully',
        color: 'blue',
      })
    } catch (error: any) {
      notifications.show({
        title: 'Refresh Failed',
        message: error.message || 'Failed to refresh data',
        color: 'red',
      })
    }
  }, [fetchAllData])

  // Initial load when auth is ready and company is available
  useEffect(() => {
    if (isAuthInitialized && company?.id) {
      fetchAllData()
    }
  }, [isAuthInitialized, company?.id, fetchAllData])

  // Debounced search
  const debouncedSearch = useDebouncedCallback((query: string) => {
    setSearchQuery(query)
    setCurrentPage(1)
  }, 400)

  // Current filters for export
  const currentFilters = {
    page: currentPage,
    pageSize,
    searchQuery,
    asOfDate,
    accountType: accountTypeFilter,
    companyId: company?.id || null,
    currency,
  }

  // ✅ Pass theme and colorScheme here — NOT inside render functions
  const columns = getBalanceSheetColumns(currency, theme, resolvedColorScheme)

  const headerActions = getBalanceSheetHeaderActions({
    onExportPDF: () =>
      handleExportPDF(columns, currentFilters, company?.company_name || ''),
    onExportExcel: () =>
      handleExportExcel(columns, currentFilters, company?.company_name || ''),
    onRefresh: handleRefresh,
  })

  const filters = getBalanceSheetFilters({
    onAccountTypeChange: (value) =>
      handleAccountTypeChange(
        value,
        setAccountTypeFilter as unknown as React.Dispatch<
          React.SetStateAction<string>
        >,
        setCurrentPage,
      ),
    currentAccountTypeFilter: accountTypeFilter,
  })

  const statisticsData = getStatisticsCardsData(stats, currency)

  // Validate balance sheet equation
  const { isValid, difference } = validateBalanceSheetEquation(
    totals.totalAssets,
    totals.totalLiabilities,
    totals.totalEquity,
  )

  // Show skeleton while auth is loading
  if (!isAuthInitialized || authLoading) {
    return (
      <PageWrapper>
        <Container
          size="xxl"
          px={0}
        >
          <LayoutSkeleton />
        </Container>
      </PageWrapper>
    )
  }

  // Show error if no company found
  if (!company) {
    return (
      <PageWrapper>
        <Container
          size="xxl"
          px={0}
        >
          <Paper
            p="xl"
            withBorder
            bg={getPaperBackground(theme, resolvedColorScheme)}
            style={{
              borderColor: getBorderColor(theme, 'default'),
              boxShadow: getThemeShadow(theme, 'sm'),
              transition: 'all 0.2s ease',
            }}
          >
            <Text
              size="lg"
              fw={600}
              c="red"
              mb="md"
            >
              No Company Found
            </Text>
            <Text c="dimmed">
              You are not associated with any company. Please contact your
              administrator.
            </Text>
          </Paper>
        </Container>
      </PageWrapper>
    )
  }

  return (
    <PageWrapper>
      <Container
        size="xxl"
        px={0}
      >
        <PageHeader
          title="Balance Sheet"
          description={`Financial position as of ${new Date(asOfDate).toLocaleDateString()}`}
          actions={headerActions}
        />

        <StatisticsCard stats={statisticsData} />

        {/* Company Info and Filters */}
        <Paper
          p="md"
          mb="md"
          withBorder
          bg={getPaperBackground(theme, resolvedColorScheme, true)}
          style={{
            borderColor: getBorderColor(theme, 'default'),
            boxShadow: getThemeShadow(theme, 'sm'),
            transition: 'all 0.2s ease',
          }}
        >
          <Group
            justify="space-between"
            align="flex-end"
          >
            <Stack gap="xs">
              <Text
                fw={600}
                size="sm"
                c="dimmed"
              >
                Company
              </Text>
              <Text
                fw={700}
                size="lg"
                c={getTextColor(theme, resolvedColorScheme)}
              >
                {company.company_name}
              </Text>
              {company.company_code && (
                <Text
                  size="xs"
                  c="dimmed"
                >
                  Code: {company.company_code}
                </Text>
              )}
            </Stack>

            <Stack gap="xs">
              <Text
                fw={600}
                size="sm"
              >
                Report Date
              </Text>
              <DatePickerInput
                value={new Date(asOfDate)}
                onChange={(value) =>
                  handleDateChange(value, setAsOfDate, setCurrentPage)
                }
                placeholder="Select date"
                maxDate={new Date()}
                w={200}
                clearable={false}
              />
            </Stack>

            <Stack gap="xs">
              <Text
                fw={600}
                size="sm"
              >
                Currency
              </Text>
              <Badge
                size="lg"
                variant="light"
                color="blue"
                style={{ fontWeight: 600, fontSize: '0.875rem' }}
              >
                {currency}
              </Badge>
            </Stack>
          </Group>
        </Paper>

        {/* Balance Sheet Equation Validation */}
        <Paper
          p="md"
          mb="md"
          bg={
            isValid
              ? isDark
                ? 'rgba(46, 125, 50, 0.15)'
                : 'green.0'
              : isDark
                ? 'rgba(237, 108, 2, 0.15)'
                : 'yellow.0'
          }
          withBorder
          style={{
            borderColor: isValid
              ? theme.colors.green[isDark ? 7 : 5]
              : theme.colors.orange[isDark ? 7 : 5],
            borderWidth: 2,
            boxShadow: getThemeShadow(theme, 'sm'),
            transition: 'all 0.2s ease',
          }}
        >
          <Group justify="space-between">
            <Group>
              <Badge
                color={isValid ? 'green' : 'orange'}
                size="lg"
                variant={isDark ? 'filled' : 'light'}
                style={{ fontWeight: 600 }}
              >
                {isValid ? '✓ Balanced' : '⚠ Warning'}
              </Badge>
              <Text
                size="sm"
                c={isValid ? 'green' : 'orange'}
                fw={500}
              >
                {isValid
                  ? 'Assets = Liabilities + Equity'
                  : `Balance Sheet equation is not balanced. Difference: ${formatCurrency(Math.abs(difference), currency)}`}
              </Text>
            </Group>

            {isValid && (
              <Group gap="md">
                <Text
                  size="sm"
                  c="dimmed"
                >
                  Assets:{' '}
                  <Text
                    span
                    fw={600}
                    c={getTextColor(theme, resolvedColorScheme)}
                  >
                    {formatCurrency(totals.totalAssets, currency)}
                  </Text>
                </Text>
                <Text
                  size="sm"
                  c="dimmed"
                >
                  =
                </Text>
                <Text
                  size="sm"
                  c="dimmed"
                >
                  Liabilities + Equity:{' '}
                  <Text
                    span
                    fw={600}
                    c={getTextColor(theme, resolvedColorScheme)}
                  >
                    {formatCurrency(
                      totals.totalLiabilities + totals.totalEquity,
                      currency,
                    )}
                  </Text>
                </Text>
              </Group>
            )}
          </Group>
        </Paper>

        <ContentTable
          columns={columns}
          data={balanceSheetData}
          loading={loading}
          searchPlaceholder="Search by account name or code..."
          filters={filters}
          onSearch={debouncedSearch}
          pagination={true}
          totalCount={totalCount}
          currentPage={currentPage}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
          selectable={false}
        />

        {/* Footer Information */}
        {balanceSheetData.length > 0 && (
          <Paper
            p="md"
            mt="md"
            bg={getPaperBackground(theme, resolvedColorScheme, true)}
            withBorder
            style={{
              borderColor: getBorderColor(theme, 'light'),
              boxShadow: getThemeShadow(theme, 'sm'),
            }}
          >
            <Stack gap="xs">
              <Group
                justify="space-between"
                mb="xs"
              >
                <Text
                  size="sm"
                  fw={600}
                  c={getTextColor(theme, resolvedColorScheme)}
                >
                  Balance Sheet Information
                </Text>
                <Text
                  size="xs"
                  c="dimmed"
                >
                  Generated: {new Date().toLocaleString()}
                </Text>
              </Group>

              <Text
                size="xs"
                c="dimmed"
                mb="xs"
              >
                This balance sheet is generated from the double-entry accounting
                system and reflects all posted journal entries. The data is
                sourced from the
                <Text
                  span
                  fw={600}
                  c={getTextColor(theme, resolvedColorScheme, 'secondary')}
                >
                  {' '}
                  vw_balance_sheet
                </Text>{' '}
                database view which automatically calculates balances based on
                journal entry lines.
              </Text>

              <Text
                size="xs"
                c="dimmed"
              >
                <Text
                  span
                  fw={600}
                  c={getTextColor(theme, resolvedColorScheme, 'secondary')}
                >
                  Note:
                </Text>{' '}
                Only accounts with non-zero balances are displayed. Assets =
                Liabilities + Equity must always balance in a properly
                maintained accounting system.
              </Text>
            </Stack>
          </Paper>
        )}
      </Container>
    </PageWrapper>
  )
}

export { BalanceSheetManagement }

