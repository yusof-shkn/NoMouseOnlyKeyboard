// src/pages/SalesHistory/SalesHistory.tsx
// ✅ FULLY THEMED: Passes theme + colorScheme to all config functions

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Container,
  Alert,
  useMantineTheme,
  useMantineColorScheme,
} from '@mantine/core'
import { useDispatch, useSelector } from 'react-redux'
import { useScopeFilter } from '@shared/hooks/useScopeFilter'
import { AppDispatch, RootState } from '@app/core/store/store'
import { useDebouncedCallback } from '@mantine/hooks'
import { IconAlertCircle } from '@tabler/icons-react'
import PageHeader from '@shared/components/tableHeader/TableHeader'
import ContentTable from '@shared/components/tableContent/TableContent'
import { Sale } from './types/salesHistory.types'
import { PageWrapper } from '@shared/styles/PageWrapper'
import { LayoutSkeleton } from '@shared/components/skeletons/Layout.skeleton'
import { openModal } from '@shared/components/genericModal'

import {
  fetchSalesData,
  calculateStats,
  getDateRangeFilter,
  fetchGlobalSalesStats,
} from './utils/salesHistory.utils'

import {
  handleExportPDF,
  handleExportExcel,
  handleRefresh,
  handleEdit,
  handleDelete,
  handleReturn,
  handleApproveReturn,
  handleRejectReturn,
  handleDownloadInvoice,
  fetchSaleDetails,
} from './handlers/salesHistory.handlers'

import {
  getSalesColumns,
  getSalesHeaderActions,
  getSalesRowActions,
  getSalesFilters,
  getStatisticsCardsData,
} from './SalesHistory.config'

import { selectCompanySettings } from '@features/authentication/authSlice'
import { selectIsUnlocked } from '@core/restrictedMode/Restrictedmode.slice'
import { notifications } from '@mantine/notifications'
import { useNavigate } from 'react-router-dom'

const SalesPOSHistory = () => {
  const theme = useMantineTheme()
  const { colorScheme } = useMantineColorScheme()
  const resolvedScheme = colorScheme === 'auto' ? 'light' : colorScheme

  const [sales, setSales] = useState<Sale[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [stores, setStores] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [initializing, setInitializing] = useState(true)
  const [isFetching, setIsFetching] = useState(false)
  const isFirstRender = useRef(true)
  const navigate = useNavigate()

  const companySettings = useSelector((state: RootState) =>
    selectCompanySettings(state),
  )
  const companyId = useSelector((state: RootState) =>
    Number(state.auth?.companyId || 0),
  )
  const isUnlocked = useSelector(selectIsUnlocked)
  const { storeIds } = useScopeFilter()
  // Keep these for display/label purposes only - filtering driven by storeIds
  const selectedStore = useSelector(
    (state: RootState) => state.areaStore?.selectedStore,
  )
  const selectedArea = useSelector(
    (state: RootState) => state.areaStore?.selectedArea,
  )
  const [error, setError] = useState<string | null>(null)

  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    completed: 0,
    cancelled: 0,
    returned: 0,
    pendingReturn: 0,
    totalAmount: 0,
    totalDiscount: 0,
    totalTax: 0,
  })

  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [totalCount, setTotalCount] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [customerFilter, setCustomerFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('all')
  const [saleTypeFilter, setSaleTypeFilter] = useState('all')
  const [dateRangeFilter, setDateRangeFilter] = useState('all')
  const dispatch = useDispatch<AppDispatch>()

  const fetchSalesOnly = useCallback(async () => {
    if (!companySettings || isFetching) return
    try {
      setIsFetching(true)
      setLoading(true)
      setError(null)
      const {
        salesData,
        customersData,
        storesData,
        usersData,
        totalCount: count,
      } = await fetchSalesData({
        page: currentPage,
        pageSize,
        searchQuery,
        status: statusFilter,
        paymentMethod: paymentMethodFilter,
        saleType: saleTypeFilter,
        customerId:
          customerFilter === 'all' ? undefined : parseInt(customerFilter),
        dateRange: getDateRangeFilter(dateRangeFilter),
        settings: companySettings,
        isUnlocked,
        storeIds,
      })
      setSales(salesData)
      setCustomers(customersData)
      setStores(storesData)
      setUsers(usersData)
      // ✅ FIX: Don't recalculate stats from page data — stats come from fetchAllData's global RPC
      setTotalCount(count)
    } catch (err) {
      setError('Failed to load sales. Please try again.')
      setSales([])
      setCustomers([])
      setStores([])
      setUsers([])
      setStats({
        total: 0,
        pending: 0,
        completed: 0,
        cancelled: 0,
        returned: 0,
        pendingReturn: 0,
        totalAmount: 0,
        totalDiscount: 0,
        totalTax: 0,
      })
      setTotalCount(0)
    } finally {
      setLoading(false)
      setIsFetching(false)
    }
  }, [
    currentPage,
    pageSize,
    searchQuery,
    customerFilter,
    statusFilter,
    paymentMethodFilter,
    saleTypeFilter,
    dateRangeFilter,
    companySettings,
    isFetching,
    isUnlocked,
  ])

  const fetchAllData = useCallback(async () => {
    if (isFetching || !companySettings) return
    try {
      setIsFetching(true)
      setLoading(true)
      setError(null)
      const salesResponse = await fetchSalesData({
        page: currentPage,
        pageSize,
        searchQuery,
        status: statusFilter,
        paymentMethod: paymentMethodFilter,
        saleType: saleTypeFilter,
        customerId:
          customerFilter === 'all' ? undefined : parseInt(customerFilter),
        dateRange: getDateRangeFilter(dateRangeFilter),
        settings: companySettings,
        isUnlocked,
        storeIds,
      })
      setSales(salesResponse.salesData)
      setCustomers(salesResponse.customersData)
      setStores(salesResponse.storesData)
      setUsers(salesResponse.usersData)
      setTotalCount(salesResponse.totalCount)

      // ✅ Fetch global stats separately so they reflect ALL sales, not just current page
      if (companyId) {
        const globalStats = await fetchGlobalSalesStats(
          companyId,
          storeIds, // ← area-aware scope filter
        )
        setStats(globalStats)
      } else {
        setStats(calculateStats(salesResponse.salesData))
      }
    } catch (err) {
      setError('Failed to load data. Please try again.')
    } finally {
      setLoading(false)
      setIsFetching(false)
    }
  }, [
    currentPage,
    pageSize,
    searchQuery,
    customerFilter,
    statusFilter,
    paymentMethodFilter,
    saleTypeFilter,
    dateRangeFilter,
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
    const handleSaleUpdate = () => {
      if (!initializing && !isFetching && companySettings) {
        clearTimeout(timeoutId)
        timeoutId = setTimeout(() => {
          fetchAllData()
        }, 300)
      }
    }
    window.addEventListener('saleUpdated', handleSaleUpdate)
    return () => {
      clearTimeout(timeoutId)
      window.removeEventListener('saleUpdated', handleSaleUpdate)
    }
  }, [initializing, isFetching, companySettings, fetchAllData])

  useEffect(() => {
    if (isFirstRender.current) return
    if (!initializing && !isFetching && companySettings) {
      const timeoutId = setTimeout(() => {
        fetchSalesOnly()
      }, 300)
      return () => clearTimeout(timeoutId)
    }
  }, [
    currentPage,
    pageSize,
    searchQuery,
    customerFilter,
    statusFilter,
    paymentMethodFilter,
    saleTypeFilter,
    dateRangeFilter,
    isUnlocked,
  ])

  const handleViewSale = useCallback(
    async (row: any) => {
      try {
        const { data, error } = await fetchSaleDetails(row.id)
        if (error) {
          notifications.show({
            title: 'Error',
            message: 'Failed to load sale details',
            color: 'red',
          })
          return
        }
        dispatch(
          openModal({
            type: 'view-sale',
            size: 'xl',
            props: { sale: data, settings: companySettings },
          }),
        )
      } catch (error) {
        notifications.show({
          title: 'Error',
          message: 'An unexpected error occurred',
          color: 'red',
        })
      }
    },
    [dispatch, companySettings],
  )

  const handleApproveReturnClick = useCallback(
    async (row: any) => {
      if (!row.pending_return_id) {
        notifications.show({
          title: 'Error',
          message: 'No pending return found for this sale',
          color: 'red',
        })
        return
      }
      await handleApproveReturn(row.pending_return_id, fetchAllData)
    },
    [fetchAllData],
  )

  const handleRejectReturnClick = useCallback(
    async (row: any) => {
      if (!row.pending_return_id) {
        notifications.show({
          title: 'Error',
          message: 'No pending return found for this sale',
          color: 'red',
        })
        return
      }
      await handleRejectReturn(row.pending_return_id, fetchAllData)
    },
    [fetchAllData],
  )

  const debouncedSearch = useDebouncedCallback((query: string) => {
    setSearchQuery(query)
    setCurrentPage(1)
  }, 400)

  const handleRefreshClick = useCallback(async () => {
    try {
      await handleRefresh(
        setSales,
        setCustomers,
        setStores,
        setUsers,
        setStats,
        setLoading,
        setTotalCount,
        companySettings,
      )
    } catch (error: any) {
      console.error('❌ [Refresh] Error:', error)
    }
  }, [companySettings])

  // ============================================================================
  // CONFIG — pass theme + colorScheme
  // ============================================================================

  const columns = getSalesColumns(companySettings, theme, resolvedScheme)

  const headerActions = getSalesHeaderActions({
    onExportPDF: () => handleExportPDF(columns, sales),
    onExportExcel: () => handleExportExcel(columns, sales),
    onRefresh: handleRefreshClick,
  })

  const rowActions = getSalesRowActions(
    {
      onView: handleViewSale,
      onEdit: (row) => handleEdit(row, dispatch, companySettings, navigate),
      onDelete: (row) =>
        handleDelete(row, fetchAllData, companySettings, dispatch),
      onReturn: (row) =>
        handleReturn(row, fetchAllData, companySettings, dispatch),
      onApproveReturn: handleApproveReturnClick,
      onRejectReturn: handleRejectReturnClick,
      onDownloadInvoice: (row) => handleDownloadInvoice(row),
    },
    companySettings,
  )

  const filters = getSalesFilters(
    (value) => {
      setCustomerFilter(value)
      setCurrentPage(1)
    },
    (value) => {
      setStatusFilter(value)
      setCurrentPage(1)
    },
    (value) => {
      setPaymentMethodFilter(value)
      setCurrentPage(1)
    },
    (value) => {
      setSaleTypeFilter(value)
      setCurrentPage(1)
    },
    (value) => {
      setDateRangeFilter(value)
      setCurrentPage(1)
    },
    customers,
    stores,
    companySettings,
  )

  const statisticsData = getStatisticsCardsData(stats, companySettings, theme)

  // Re-fetch when store/area selection changes
  useEffect(() => {
    if (!initializing) {
      fetchAllData()
    }
  }, [storeIds]) // eslint-disable-line react-hooks/exhaustive-deps

  if (initializing || !companySettings) {
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
            title="Sales History"
            description="View and manage all sales transactions"
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
          title="Sales History"
          description="View and manage all sales transactions"
          actions={headerActions}
          {...(statisticsData ? { statistics: statisticsData } : {})}
        />
        <ContentTable
          columns={columns}
          data={sales}
          loading={loading}
          searchPlaceholder="Search by invoice #, customer name, business..."
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
          selectable={true}
          onRowClick={handleViewSale}
        />
      </Container>
    </PageWrapper>
  )
}

export { SalesPOSHistory }

