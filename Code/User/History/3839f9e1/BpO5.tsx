// StockList.tsx - UPDATED WITH THEMING & DARK MODE
import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Container,
  Alert,
  useMantineTheme,
  useMantineColorScheme,
} from '@mantine/core'
import { useDispatch, useSelector } from 'react-redux'
import { AppDispatch } from '@app/core/store/store'
import { useDebouncedCallback } from '@mantine/hooks'
import { IconAlertCircle } from '@tabler/icons-react'
import PageHeader from '@shared/components/tableHeader/TableHeader'
import ContentTable from '@shared/components/tableContent/TableContent'
import { StockListItem, StockListStats } from './types/stockList.types'
import { PageWrapper } from '@shared/styles/PageWrapper'
import { LayoutSkeleton } from '@shared/components/skeletons/Layout.skeleton'
import { fetchStockListData, calculateStats } from './utils/stockList.utils'
import {
  handleExportPDF,
  handleExportExcel,
  handleRefresh,
  handleView,
  handleEdit,
  handleDelete,
  showCompanySettingsInfo,
  handleLowStockAlerts,
  handleExpiringStockAlerts,
} from './handlers/stockList.handlers'
import {
  getStockListColumns,
  getStockListHeaderActions,
  getStockListRowActions,
  getStockListFilters,
  getStatisticsCardsData,
} from './StockList.config'
import {
  selectCompanySettings,
  selectCompanyId,
} from '@features/authentication/authSlice'
import { selectIsUnlocked } from '@core/restrictedMode/Restrictedmode.slice'
import StatsCards from '@shared/components/statistics/StatisticsCard'

const StockList = () => {
  const theme = useMantineTheme()
  const { colorScheme } = useMantineColorScheme()

  const [stockList, setStockList] = useState<StockListItem[]>([])
  const [stores, setStores] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [initializing, setInitializing] = useState(true)
  const [isFetching, setIsFetching] = useState(false)
  const isFirstRender = useRef(true)
  const [error, setError] = useState<string | null>(null)

  const dispatch = useDispatch<AppDispatch>()

  const companySettings = useSelector(selectCompanySettings)
  const companyId = useSelector(selectCompanyId)
  const isUnlocked = useSelector(selectIsUnlocked)

  const [stats, setStats] = useState<StockListStats>({
    total: 0,
    available: 0,
    reserved: 0,
    expired: 0,
    damaged: 0,
    lowStock: 0,
    outOfStock: 0,
    expiringSoon: 0,
    expiringThisMonth: 0,
    expiryCritical: 0,
    blocked: 0,
    totalValue: 0,
    totalCostValue: 0,
    discountedItems: 0,
    totalDiscountValue: 0,
  })

  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [totalCount, setTotalCount] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [stockLevelFilter, setStockLevelFilter] = useState('all')
  const [expiryStatusFilter, setExpiryStatusFilter] = useState('all')

  const fetchStockListOnly = useCallback(async () => {
    if (!companyId || isFetching) {
      console.log('⏭️ [fetchStockListOnly] Skipping')
      return
    }

    try {
      setIsFetching(true)
      setLoading(true)
      setError(null)

      console.log('🔄 [fetchStockListOnly] Fetching from view_inventory...')

      const {
        stockListData,
        storesData,
        categoriesData,
        totalCount: count,
      } = await fetchStockListData(
        {
          page: currentPage,
          pageSize,
          searchQuery,
          status: statusFilter,
          stockLevel: stockLevelFilter,
          expiryStatus: expiryStatusFilter,
          companyId,
          isUnlocked,
        },
        companySettings,
      )

      console.log(
        '✅ [fetchStockListOnly] Fetched:',
        count,
        'items from view_inventory',
      )

      setStockList(stockListData)
      setStores(storesData)
      setCategories(categoriesData)
      setTotalCount(count)
      setStats(calculateStats(stockListData, companySettings))
    } catch (err: any) {
      console.error('❌ [fetchStockListOnly] Error:', err)
      setError(err.message || 'Failed to load stock list from view_inventory')
      setStockList([])
      setStores([])
      setCategories([])
      setTotalCount(0)
    } finally {
      setLoading(false)
      setIsFetching(false)
    }
  }, [
    companyId,
    currentPage,
    pageSize,
    searchQuery,
    statusFilter,
    stockLevelFilter,
    expiryStatusFilter,
    companySettings,
    isFetching,
    isUnlocked,
  ])

  const fetchAllData = useCallback(async () => {
    if (!companyId || isFetching) {
      console.log('⏭️ [fetchAllData] Skipping')
      return
    }

    try {
      setIsFetching(true)
      setLoading(true)
      setError(null)

      console.log('🔄 [fetchAllData] Fetching ALL data from view_inventory...')

      const {
        stockListData,
        storesData,
        categoriesData,
        totalCount: count,
      } = await fetchStockListData(
        {
          page: currentPage,
          pageSize,
          searchQuery,
          status: statusFilter,
          stockLevel: stockLevelFilter,
          expiryStatus: expiryStatusFilter,
          companyId,
          isUnlocked,
        },
        companySettings,
      )

      console.log(
        '✅ [fetchAllData] All data fetched:',
        count,
        'items from view_inventory',
      )

      setStockList(stockListData)
      setStores(storesData)
      setCategories(categoriesData)
      setTotalCount(count)
      setStats(calculateStats(stockListData, companySettings))
    } catch (err: any) {
      console.error('❌ [fetchAllData] Error:', err)
      setError(err.message || 'Failed to load data from view_inventory')
    } finally {
      setLoading(false)
      setIsFetching(false)
    }
  }, [
    companyId,
    currentPage,
    pageSize,
    searchQuery,
    statusFilter,
    stockLevelFilter,
    expiryStatusFilter,
    companySettings,
    isFetching,
    isUnlocked,
  ])

  useEffect(() => {
    if (companyId && initializing) {
      console.log('🎬 [StockList] Initial load from view_inventory started')
      fetchAllData().then(() => {
        setInitializing(false)
        isFirstRender.current = false
        console.log('✅ [StockList] Initial load from view_inventory complete')
      })
    }
  }, [companyId, initializing])

  useEffect(() => {
    let timeoutId: NodeJS.Timeout

    const handleStockUpdate = () => {
      if (!initializing && !isFetching && companyId) {
        console.log(
          '🔔 [Event] stockUpdated received - refreshing view_inventory',
        )
        clearTimeout(timeoutId)
        timeoutId = setTimeout(() => {
          console.log('🔄 [Event] Refreshing data from view_inventory...')
          fetchAllData()
        }, 300)
      }
    }

    window.addEventListener('stockUpdated', handleStockUpdate)
    return () => {
      clearTimeout(timeoutId)
      window.removeEventListener('stockUpdated', handleStockUpdate)
    }
  }, [initializing, isFetching, companyId, fetchAllData])

  useEffect(() => {
    if (isFirstRender.current) {
      return
    }

    if (!initializing && !isFetching && companyId) {
      console.log('🔍 [Filters] Change detected - querying view_inventory')
      const timeoutId = setTimeout(() => {
        fetchStockListOnly()
      }, 300)
      return () => clearTimeout(timeoutId)
    }
  }, [
    currentPage,
    pageSize,
    searchQuery,
    statusFilter,
    stockLevelFilter,
    expiryStatusFilter,
  ])

  const debouncedSearch = useDebouncedCallback((query: string) => {
    console.log('🔍 Debounced search on view_inventory:', query)
    setSearchQuery(query)
    setCurrentPage(1)
  }, 400)

  const handleRefreshClick = useCallback(async () => {
    try {
      console.log('🔄 [Refresh] Manual refresh from view_inventory triggered')
      await fetchAllData()
    } catch (error: any) {
      console.error('❌ [Refresh] Error:', error)
    }
  }, [fetchAllData])

  const handleDeleteWrapper = useCallback(
    async (row: StockListItem) => {
      await handleDelete(row, fetchAllData, companySettings)
    },
    [fetchAllData, companySettings],
  )

  const handleLowStockAlertsClick = useCallback(async () => {
    if (companyId) {
      await handleLowStockAlerts(companyId)
    }
  }, [companyId])

  const handleExpiringAlertsClick = useCallback(async () => {
    if (companyId) {
      await handleExpiringStockAlerts(companyId)
    }
  }, [companyId])

  const columns = getStockListColumns(
    companySettings,
    theme,
    colorScheme === 'auto' ? 'light' : colorScheme,
  )

  const headerActions = getStockListHeaderActions(
    {
      onExportPDF: () => handleExportPDF(columns, stockList),
      onExportExcel: () => handleExportExcel(columns, stockList),
      onRefresh: handleRefreshClick,
      onShowSettings: () => showCompanySettingsInfo(companySettings),
      onLowStockAlerts: handleLowStockAlertsClick,
      onExpiringAlerts: handleExpiringAlertsClick,
    },
    true,
  )

  const rowActions = getStockListRowActions(
    {
      onView: handleView,
      onEdit: (row) => handleEdit(row, dispatch, companySettings),
      onDelete: handleDeleteWrapper,
    },
    companySettings,
  )

  const filters = getStockListFilters(
    (value) => {
      console.log('🔍 Status filter:', value)
      setStatusFilter(value)
      setCurrentPage(1)
    },
    (value) => {
      console.log('🔍 Stock level filter:', value)
      setStockLevelFilter(value)
      setCurrentPage(1)
    },
    (value) => {
      console.log('🔍 Expiry status filter:', value)
      setExpiryStatusFilter(value)
      setCurrentPage(1)
    },
    companySettings,
  )

  const statisticsData = getStatisticsCardsData(stats, companySettings, theme)

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

  if (error && !companyId) {
    return (
      <PageWrapper>
        <Container
          size="xxl"
          px={0}
        >
          <PageHeader
            title="Stock List"
            description="View and manage product inventory"
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
          title="Stock List"
          description={
            companySettings
              ? `Inventory • Currency: ${companySettings.default_currency} • Low stock: ${companySettings.low_stock_multiplier}x`
              : 'View and manage product inventory'
          }
          actions={headerActions}
        />

        {error && (
          <Alert
            icon={<IconAlertCircle size={16} />}
            title="Error"
            color="red"
            mb="lg"
            withCloseButton
            onClose={() => setError(null)}
          >
            {error}
          </Alert>
        )}

        {/* Statistics Cards using StatsCards component */}
        <StatsCards
          stats={statisticsData}
          variant="elevated"
        />

        <ContentTable
          columns={columns}
          data={stockList}
          loading={loading}
          searchPlaceholder="Search by product name, code, batch number..."
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
        />
      </Container>
    </PageWrapper>
  )
}

export { StockList }

