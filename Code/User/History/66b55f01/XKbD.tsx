// src/pages/SalesReturns/SalesReturns.tsx
// ✅ FULLY THEMED: Passes theme + colorScheme to all config functions

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Container,
  Alert,
  useMantineTheme,
  useMantineColorScheme,
} from '@mantine/core'
import { useDebouncedCallback } from '@mantine/hooks'
import { useNavigate } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import { useScopeFilter } from '@shared/hooks/useScopeFilter'
import { RootState, AppDispatch } from '@app/core/store/store'
import { IconAlertCircle } from '@tabler/icons-react'
import PageHeader from '@shared/components/tableHeader/TableHeader'
import ContentTable from '@shared/components/tableContent/TableContent'
import StatisticsCard from '@shared/components/statistics/StatisticsCard'

import {
  selectCompanySettings,
  selectDefaultCurrency,
} from '@features/authentication/authSlice'
import { selectIsUnlocked } from '@core/restrictedMode/Restrictedmode.slice'
import { SalesReturn, SalesReturnStats } from './types/salesReturn.types'
import {
  fetchSalesReturnsData,
  fetchSalesReturnStats,
  getDateRange,
} from './utils/salesReturn.utils'
import {
  handleExportPDF,
  handleExportExcel,
  handleViewDetails,
  handleApprove,
  handleReject,
  handleDelete,
  handleStatusChange,
  handlePaymentStatusChange,
  handleCustomerChange,
  handleSortChange,
  handleRowClick,
} from './handlers/salesReturn.handlers'
import {
  getSalesReturnColumns,
  getSalesReturnHeaderActions,
  getSalesReturnRowActions,
  getSalesReturnFilters,
  getStatisticsCardsData,
} from './SalesReturn.config'
import { LayoutSkeleton } from '@shared/components/skeletons/Layout.skeleton'
import { PageWrapper } from '@shared/styles/PageWrapper'
import { getActiveCustomers } from './data/salesReturn.queries'

const SalesReturns = () => {
  const theme = useMantineTheme()
  const { colorScheme } = useMantineColorScheme()
  const resolvedScheme = colorScheme === 'auto' ? 'light' : colorScheme

  const [salesReturns, setSalesReturns] = useState<SalesReturn[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [initializing, setInitializing] = useState(true)
  const [isFetching, setIsFetching] = useState(false)
  const isFirstRender = useRef(true)

  const [error, setError] = useState<string | null>(null)

  const [stats, setStats] = useState<SalesReturnStats>({
    total: 0,
    pending: 0,
    approved: 0,
    completed: 0,
    cancelled: 0,
    totalRefundAmount: 0,
    pendingRefundAmount: 0,
  })

  const [currentPage, setCurrentPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(10)
  const [totalCount, setTotalCount] = useState<number>(0)
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>('all')
  const [customerFilter, setCustomerFilter] = useState<number | null>(null)
  const [sortBy, setSortBy] = useState<string>('recent')

  const navigate = useNavigate()
  const dispatch = useDispatch<AppDispatch>()
  const companySettings = useSelector(selectCompanySettings)
  const isUnlocked = useSelector(selectIsUnlocked)
  const { storeIds } = useScopeFilter()
  const selectedStore = useSelector(
    (state: RootState) => state.areaStore?.selectedStore,
  )
  const selectedArea = useSelector(
    (state: RootState) => state.areaStore?.selectedArea,
  )
  const currency = useSelector(selectDefaultCurrency)

  // ============================================================================
  // FETCH FUNCTIONS
  // ============================================================================

  const fetchSalesReturns = useCallback(async () => {
    if (!companySettings || isFetching) return

    try {
      setIsFetching(true)
      setLoading(true)
      setError(null)

      let dateRange
      if (sortBy === 'last_7_days' || sortBy === 'last_month') {
        dateRange = getDateRange(sortBy as 'last_7_days' | 'last_month' | 'all')
      }

      let apiSortBy = sortBy
      if (sortBy === 'last_7_days' || sortBy === 'last_month') {
        apiSortBy = 'date_desc'
      }

      const salesReturnsResult = await fetchSalesReturnsData({
        page: currentPage,
        pageSize,
        searchQuery,
        status: statusFilter,
        paymentStatus: paymentStatusFilter,
        customerId: customerFilter,
        dateRange,
        sortBy: apiSortBy as any,
        isUnlocked,
        storeIds,
      })

      setSalesReturns(salesReturnsResult.salesReturnsData)
      setTotalCount(salesReturnsResult.totalCount)
    } catch (err) {
      console.error('❌ Error fetching sales returns:', err)
      setError('Failed to load sales returns. Please try again.')
      setSalesReturns([])
      setTotalCount(0)
    } finally {
      setLoading(false)
      setIsFetching(false)
    }
  }, [
    currentPage,
    pageSize,
    searchQuery,
    statusFilter,
    paymentStatusFilter,
    customerFilter,
    sortBy,
    companySettings,
    isFetching,
    isUnlocked,
    storeIds,
  ])

  const fetchAllData = useCallback(async () => {
    if (!companySettings || isFetching) return

    try {
      setIsFetching(true)
      setLoading(true)
      setError(null)

      let dateRange
      if (sortBy === 'last_7_days' || sortBy === 'last_month') {
        dateRange = getDateRange(sortBy as 'last_7_days' | 'last_month' | 'all')
      }

      let apiSortBy = sortBy
      if (sortBy === 'last_7_days' || sortBy === 'last_month') {
        apiSortBy = 'date_desc'
      }

      const [statsData, salesReturnsResult, customersResult] =
        await Promise.all([
          fetchSalesReturnStats(),
          fetchSalesReturnsData({
            page: currentPage,
            pageSize,
            searchQuery,
            status: statusFilter,
            paymentStatus: paymentStatusFilter,
            customerId: customerFilter,
            dateRange,
            sortBy: apiSortBy as any,
            isUnlocked,
            storeIds,
          }),
          getActiveCustomers(),
        ])

      setStats(statsData)
      setSalesReturns(salesReturnsResult.salesReturnsData)
      setTotalCount(salesReturnsResult.totalCount)

      if (customersResult.data) {
        setCustomers(customersResult.data)
      }
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
    statusFilter,
    paymentStatusFilter,
    customerFilter,
    sortBy,
    companySettings,
    isFetching,
    isUnlocked,
  ])

  useEffect(() => {
    if (companySettings && initializing) {
      fetchAllData().then(() => {
        setInitializing(false)
        isFirstRender.current = false
      })
    }
  }, [companySettings, initializing])

  useEffect(() => {
    let timeoutId: NodeJS.Timeout

    const handleSalesReturnUpdate = () => {
      if (!initializing && !isFetching && companySettings) {
        clearTimeout(timeoutId)
        timeoutId = setTimeout(() => {
          fetchAllData()
        }, 300)
      }
    }

    window.addEventListener('salesReturnUpdated', handleSalesReturnUpdate)
    return () => {
      clearTimeout(timeoutId)
      window.removeEventListener('salesReturnUpdated', handleSalesReturnUpdate)
    }
  }, [initializing, isFetching, companySettings, fetchAllData])

  useEffect(() => {
    if (isFirstRender.current) return
    if (!initializing && !isFetching && companySettings) {
      const timeoutId = setTimeout(() => {
        fetchSalesReturns()
      }, 300)
      return () => clearTimeout(timeoutId)
    }
  }, [
    currentPage,
    pageSize,
    searchQuery,
    statusFilter,
    paymentStatusFilter,
    customerFilter,
    sortBy,
  ])

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const debouncedSearch = useDebouncedCallback((query: string) => {
    setSearchQuery(query)
    setCurrentPage(1)
  }, 400)

  const handleRefreshClick = useCallback(async () => {
    await fetchAllData()
  }, [fetchAllData])

  const localHandleDelete = useCallback(
    async (row: SalesReturn) => {
      await handleDelete(row, fetchAllData, dispatch)
    },
    [fetchAllData, dispatch],
  )

  const localHandleApprove = useCallback(
    async (row: SalesReturn) => {
      await handleApprove(
        row,
        fetchAllData,
        companySettings || undefined,
        dispatch,
      )
    },
    [fetchAllData, companySettings, dispatch],
  )

  const localHandleReject = useCallback(
    async (row: SalesReturn) => {
      await handleReject(row, fetchAllData, dispatch)
    },
    [fetchAllData, dispatch],
  )

  // ============================================================================
  // CONFIG — pass theme + colorScheme
  // ============================================================================

  const columns = getSalesReturnColumns(
    theme,
    resolvedScheme,
    companySettings || undefined,
    currency,
  )

  const headerActions = getSalesReturnHeaderActions({
    onExportPDF: () => handleExportPDF(columns, salesReturns),
    onExportExcel: () => handleExportExcel(columns, salesReturns),
    onRefresh: handleRefreshClick,
  })

  const rowActions = getSalesReturnRowActions(
    {
      onViewDetails: (row) => handleViewDetails(row, navigate, dispatch),
      onApprove: localHandleApprove,
      onReject: localHandleReject,
      onDelete: localHandleDelete,
    },
    companySettings || undefined,
  )

  const filters = getSalesReturnFilters({
    onStatusChange: (value) =>
      handleStatusChange(value, setStatusFilter, setCurrentPage),
    onPaymentStatusChange: (value) =>
      handlePaymentStatusChange(value, setPaymentStatusFilter, setCurrentPage),
    onCustomerChange: (value) =>
      handleCustomerChange(value, setCustomerFilter, setCurrentPage),
    onSortChange: (value) => handleSortChange(value, setSortBy, setCurrentPage),
    customers,
    currentCustomerFilter: customerFilter,
    currentPaymentStatusFilter: paymentStatusFilter,
    currentSortBy: sortBy,
  })

  const statisticsData = getStatisticsCardsData(stats, theme, currency)

  // ============================================================================
  // RENDER
  // ============================================================================

  // Re-fetch when store/area selection changes
  useEffect(() => {
    if (!initializing) {
      fetchAllData()
    }
  }, [storeIds]) // eslint-disable-line react-hooks/exhaustive-deps

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

  if (error && !companySettings) {
    return (
      <PageWrapper>
        <Container
          size="xxl"
          px={0}
        >
          <PageHeader
            title="Sales Returns Management"
            description="Manage sales returns"
            actions={headerActions}
          />
          <Alert
            icon={<IconAlertCircle size={16} />}
            title="Error Loading Data"
            color="red"
            mt="md"
          >
            {error}
          </Alert>
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
          title="Sales Returns Management"
          description={`Manage ${stats.total} sales returns with ${stats.pending} pending approvals`}
          actions={headerActions}
        />

        <StatisticsCard stats={statisticsData} />

        <ContentTable
          columns={columns}
          data={salesReturns}
          loading={loading}
          searchPlaceholder="Search by return number, reason..."
          filters={filters}
          rowActions={rowActions}
          onSearch={debouncedSearch}
          pagination={true}
          totalCount={totalCount}
          currentPage={currentPage}
          pageSize={pageSize}
          onPageChange={(page) => setCurrentPage(page)}
          onPageSizeChange={(size) => {
            setPageSize(size)
            setCurrentPage(1)
          }}
          onRowClick={(row) => handleViewDetails(row, navigate, dispatch)}
          selectable={true}
        />
      </Container>
    </PageWrapper>
  )
}

export { SalesReturns }

