// src/pages/CashFlow/CashFlowManagement.tsx
import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Container,
  Alert,
  useMantineColorScheme,
  useMantineTheme,
} from '@mantine/core'
import { useDebouncedCallback } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { IconAlertCircle } from '@tabler/icons-react'
import { useSelector } from 'react-redux'
import { RootState } from '@app/core/store/store'
import PageHeader from '@shared/components/tableHeader/TableHeader'
import ContentTable from '@shared/components/tableContent/TableContent'
import StatisticsCard from '@shared/components/statistics/StatisticsCard'
import { CashFlowTransaction, CashFlowStats } from './types/cashFlow.types'
import { fetchCashFlowData } from './utils/cashFlow.utils'

import {
  handleExportPDF,
  handleExportExcel,
  handleDelete,
  handleRowClick,
  handlePaymentMethodChange,
  handleViewDetails,
  handleDateRangeChange,
} from './handlers/cashFlow.handlers'

import {
  getCashFlowColumns,
  getCashFlowHeaderActions,
  getCashFlowRowActions,
  getCashFlowFilters,
  getStatisticsCardsData,
} from './CashFlow.config'
import { LayoutSkeleton } from '@shared/components/skeletons/Layout.skeleton'
import { PageWrapper } from '@shared/styles/PageWrapper'
import {
  getPaperBackground,
  getBorderColor,
  getThemeShadow,
} from '@app/core/theme/theme.utils'

const CashFlowManagement = () => {
  const { colorScheme } = useMantineColorScheme()
  const theme = useMantineTheme()
  const isDark = colorScheme === 'dark'
  const resolvedColorScheme: 'light' | 'dark' =
    colorScheme === 'dark' ? 'dark' : 'light'
  const [transactions, setTransactions] = useState<CashFlowTransaction[]>([])
  const [loading, setLoading] = useState(false)
  const [initializing, setInitializing] = useState(true)
  const [isFetching, setIsFetching] = useState(false)
  const isFirstRender = useRef(true)

  const [error, setError] = useState<string | null>(null)

  const [stats, setStats] = useState<CashFlowStats>({
    totalInflow: 0,
    totalOutflow: 0,
    netCashFlow: 0,
    operatingCashFlow: 0,
    investingCashFlow: 0,
    financingCashFlow: 0,
    currentBalance: 0,
  })

  const [currentPage, setCurrentPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(10)
  const [totalCount, setTotalCount] = useState<number>(0)
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>('all')
  const [startDate, setStartDate] = useState<string | null>(null)
  const [endDate, setEndDate] = useState<string | null>(null)
  const [selectedTransaction, setSelectedTransaction] =
    useState<CashFlowTransaction | null>(null)

  // Get company ID and currency from Redux auth slice
  const { user, company, companySettings } = useSelector(
    (state: RootState) => state.auth,
  )
  const companyId = company?.id || user?.profile?.company_id || 1
  const currency = companySettings?.default_currency || 'UGX'

  // ============================================================================
  // STEP 1: Initialize (runs once on mount)
  // ============================================================================
  useEffect(() => {
    const initialize = async () => {
      try {
        console.log('🎬 [Initial Load] Starting initialization...')
        console.log('✅ Company ID:', companyId)
        console.log('✅ Currency:', currency)
        setInitializing(true)
        setError(null)
      } catch (error) {
        console.error('❌ Error during initialization:', error)
        setError('Failed to initialize. Please refresh the page.')
        setInitializing(false)
      }
    }

    initialize()
  }, [companyId, currency])

  // ============================================================================
  // FETCH FUNCTIONS
  // ============================================================================

  // Fetch only cash flow transactions (for filters/pagination changes)
  const fetchTransactions = useCallback(async () => {
    if (isFetching) {
      console.log('⏭️ [fetchTransactions] Skipping - already fetching')
      return
    }

    try {
      setIsFetching(true)
      setLoading(true)
      setError(null)

      console.log('🔄 [fetchTransactions] Fetching with params:', {
        page: currentPage,
        pageSize,
        searchQuery,
        startDate,
        endDate,
        paymentMethod: paymentMethodFilter,
        companyId,
      })

      const result = await fetchCashFlowData({
        page: currentPage,
        pageSize,
        searchQuery,
        startDate,
        endDate,
        transactionType: 'all',
        activityType: 'all',
        paymentMethod: paymentMethodFilter,
        companyId,
      })

      console.log('✅ [fetchTransactions] Fetched:', {
        count: result.transactionsData.length,
        totalCount: result.totalCount,
      })

      setTransactions(result.transactionsData)
      setTotalCount(result.totalCount)
    } catch (err) {
      console.error('❌ Error fetching cash flow transactions:', err)
      setError('Failed to load transactions. Please try again.')
      setTransactions([])
      setTotalCount(0)
    } finally {
      setLoading(false)
      setIsFetching(false)
    }
  }, [
    currentPage,
    pageSize,
    searchQuery,
    startDate,
    endDate,
    paymentMethodFilter,
    companyId,
    isFetching,
  ])

  // Fetch all data (for refresh and initial load)
  const fetchAllData = useCallback(async () => {
    if (isFetching) {
      console.log('⏭️ [fetchAllData] Skipping - already fetching')
      return
    }

    try {
      setIsFetching(true)
      setLoading(true)
      setError(null)

      console.log('🔄 [fetchAllData] Fetching ALL data...')

      const result = await fetchCashFlowData({
        page: currentPage,
        pageSize,
        searchQuery,
        startDate,
        endDate,
        transactionType: 'all',
        activityType: 'all',
        paymentMethod: paymentMethodFilter,
        companyId,
      })

      console.log('✅ [fetchAllData] All data fetched successfully')

      setTransactions(result.transactionsData)
      setStats(result.stats)
      setTotalCount(result.totalCount)
    } catch (err) {
      console.error('❌ Error fetching all data:', err)
      setError('Failed to load data. Please try again.')
    } finally {
      setLoading(false)
      setIsFetching(false)
    }
  }, [
    currentPage,
    pageSize,
    searchQuery,
    startDate,
    endDate,
    paymentMethodFilter,
    companyId,
    isFetching,
  ])

  // ============================================================================
  // STEP 2: Initial data fetch (runs once after company ID is available)
  // ============================================================================
  useEffect(() => {
    if (companyId && initializing) {
      console.log('🎬 [Initial Load] Loading cash flow data...')
      fetchAllData().then(() => {
        setInitializing(false)
        isFirstRender.current = false
        console.log('✅ [Initial Load] Complete')
      })
    }
  }, [companyId, initializing])

  // ============================================================================
  // STEP 3: Listen for cash flow updates
  // ============================================================================
  useEffect(() => {
    let timeoutId: NodeJS.Timeout

    const handleCashFlowUpdate = () => {
      if (!initializing && !isFetching) {
        console.log('🔔 [Event] cashFlowUpdated received')
        clearTimeout(timeoutId)
        timeoutId = setTimeout(() => {
          console.log('🔄 [Event] Refreshing data...')
          fetchAllData()
        }, 300)
      }
    }

    window.addEventListener('cashFlowUpdated', handleCashFlowUpdate)
    return () => {
      clearTimeout(timeoutId)
      window.removeEventListener('cashFlowUpdated', handleCashFlowUpdate)
    }
  }, [initializing, isFetching, fetchAllData])

  // ============================================================================
  // STEP 4: Handle filter/pagination changes
  // ============================================================================
  useEffect(() => {
    // Skip on first render
    if (isFirstRender.current) {
      return
    }

    // Only fetch if not initializing and not already fetching
    if (!initializing && !isFetching) {
      console.log('🔍 [Filters] Change detected, fetching transactions...')
      const timeoutId = setTimeout(() => {
        fetchTransactions()
      }, 300)
      return () => clearTimeout(timeoutId)
    }
  }, [
    currentPage,
    pageSize,
    searchQuery,
    startDate,
    endDate,
    paymentMethodFilter,
  ])

  // ============================================================================
  // HANDLERS
  // ============================================================================
  const debouncedSearch = useDebouncedCallback((query: string) => {
    console.log('🔍 Debounced search:', query)
    setSearchQuery(query)
    setCurrentPage(1)
  }, 400)

  const handleRefreshClick = useCallback(async () => {
    try {
      console.log('🔄 [Refresh] Manual refresh triggered')
      await fetchAllData()
      notifications.show({
        title: 'Refreshed',
        message: 'Data refreshed successfully',
        color: 'blue',
      })
    } catch (error: any) {
      console.error('❌ [Refresh] Error:', error)
      notifications.show({
        title: 'Refresh Failed',
        message: error.message || 'Failed to refresh data',
        color: 'red',
      })
    }
  }, [fetchAllData])

  const handleDeleteLocal = useCallback(
    async (row: CashFlowTransaction): Promise<void> => {
      await handleDelete(row, fetchAllData)
    },
    [fetchAllData],
  )

  // ============================================================================
  // CONFIG
  // ============================================================================
  const columns = getCashFlowColumns(currency, theme, resolvedColorScheme)
  const headerActions = getCashFlowHeaderActions({
    onExportPDF: () => handleExportPDF(columns, transactions, currency),
    onExportExcel: () => handleExportExcel(columns, transactions, currency),
    onRefresh: handleRefreshClick,
  })

  const rowActions = getCashFlowRowActions({
    onViewDetails: (row) => handleViewDetails(row, null as any),
    onDelete: handleDeleteLocal,
  })

  const filters = getCashFlowFilters({
    onPaymentMethodChange: (value) =>
      handlePaymentMethodChange(value, setPaymentMethodFilter, setCurrentPage),
    onDateRangeChange: (dates) =>
      handleDateRangeChange(dates, setStartDate, setEndDate, setCurrentPage),
    currentPaymentMethodFilter: paymentMethodFilter,
    dateRange: [
      startDate ? new Date(startDate) : null,
      endDate ? new Date(endDate) : null,
    ],
  })

  const statisticsData = getStatisticsCardsData(stats, currency)

  // ============================================================================
  // RENDER: Show full skeleton ONLY during initial load
  // ============================================================================
  if (initializing) {
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

  // ============================================================================
  // RENDER: Show error if data failed
  // ============================================================================
  if (error && transactions.length === 0) {
    return (
      <PageWrapper>
        <Container
          size="xxl"
          px={0}
        >
          <PageHeader
            title="Cash Flow Management"
            description="Monitor cash inflows and outflows"
            actions={headerActions}
          />
          <Alert
            icon={<IconAlertCircle size={16} />}
            title="Error Loading Data"
            color="red"
            mt="md"
            bg={getPaperBackground(theme, resolvedColorScheme, true)}
            style={{
              borderColor: getBorderColor(theme),
              transition: 'all 0.2s ease',
            }}
          >
            {error}
          </Alert>
        </Container>
      </PageWrapper>
    )
  }

  // ============================================================================
  // RENDER: Normal view with table
  // ============================================================================
  return (
    <PageWrapper>
      <Container
        size="xxl"
        px={0}
      >
        <PageHeader
          title="Cash Flow Management"
          description={`Monitor cash inflows and outflows across ${totalCount} transactions (${currency})`}
          actions={headerActions}
        />

        <StatisticsCard stats={statisticsData} />

        <ContentTable
          columns={columns}
          data={transactions}
          loading={loading}
          searchPlaceholder="Search by description, receipt, account..."
          filters={filters}
          rowActions={rowActions}
          onSearch={debouncedSearch}
          pagination={true}
          totalCount={totalCount}
          currentPage={currentPage}
          pageSize={pageSize}
          onPageChange={(page) => {
            console.log('📄 Page changed to:', page)
            setCurrentPage(page)
          }}
          onPageSizeChange={(size) => {
            console.log('📏 Page size changed to:', size)
            setPageSize(size)
            setCurrentPage(1)
          }}
          onRowClick={(row) =>
            handleRowClick(
              row,
              selectedTransaction,
              setSelectedTransaction,
              currency,
            )
          }
          selectedRowId={selectedTransaction?.id}
          selectable={true}
        />
      </Container>
    </PageWrapper>
  )
}

export { CashFlowManagement }

