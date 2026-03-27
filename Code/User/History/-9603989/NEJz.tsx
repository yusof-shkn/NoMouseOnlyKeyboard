// src/pages/StockHistory/StockHistory.tsx - UPDATED WITH THEMING & DARK MODE
import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Container,
  Alert,
  useMantineTheme,
  useMantineColorScheme,
} from '@mantine/core'
import { useSelector } from 'react-redux'
import { RootState } from '@app/core/store/store'
import { useDebouncedCallback } from '@mantine/hooks'
import { IconInfoCircle, IconAlertCircle } from '@tabler/icons-react'
import PageHeader from '@shared/components/tableHeader/TableHeader'
import ContentTable from '@shared/components/tableContent/TableContent'
import { StockHistoryItem, StockHistoryStats } from './types/stockHistory.types'
import { Store } from '@shared/types/Store'
import {
  fetchStockHistoryData,
  fetchStoresForFilter,
  formatNumber,
} from './utils/stockHistory.utils'
import {
  handleExportPDF,
  handleExportExcel,
  handleRefresh,
  handleStoreChange,
  handleTransactionTypeChange,
  handleRowClick,
} from './handlers/stockHistory.handlers'
import {
  getStockHistoryColumns,
  getStockHistoryHeaderActions,
  getStockHistoryFilters,
  getStatisticsCardsData,
} from './StockHistory.config'
import LayoutSkeleton from '@shared/components/skeletons/Layout.skeleton'
import { PageWrapper } from '@shared/styles/PageWrapper'
import StatsCards from '@shared/components/statistics/StatisticsCard'
import { selectIsUnlocked } from '@core/restrictedMode/Restrictedmode.slice'

const StockHistory = () => {
  const theme = useMantineTheme()
  const { colorScheme } = useMantineColorScheme()

  const [items, setItems] = useState<StockHistoryItem[]>([])
  const [stores, setStores] = useState<Store[]>([])
  const [loading, setLoading] = useState(false)
  const [initializing, setInitializing] = useState(true)
  const [isFetching, setIsFetching] = useState(false)
  const isFirstRender = useRef(true)

  const [error, setError] = useState<string | null>(null)

  const [stats, setStats] = useState<StockHistoryStats>({
    totalTransactions: 0,
    totalQuantityIn: 0,
    totalQuantityOut: 0,
    netQuantityChange: 0,
    totalValue: 0,
    uniqueProducts: 0,
  })

  const [currentPage, setCurrentPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(10)
  const [totalCount, setTotalCount] = useState<number>(0)
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [storeFilter, setStoreFilter] = useState<string | null>(null)
  const [transactionTypeFilter, setTransactionTypeFilter] = useState<
    'RECEIPT' | 'SALE' | 'RETURN' | 'ADJUSTMENT' | null
  >(null)
  const [startDate, setStartDate] = useState<string | null>(null)
  const [endDate, setEndDate] = useState<string | null>(null)

  const currentUser = useSelector((state: RootState) => state.auth?.user)
  const companySettings = useSelector(
    (state: RootState) => state.auth?.companySettings,
  )
  const isUnlocked = useSelector(selectIsUnlocked)
  const selectedStore = useSelector((state: RootState) => state.areaStore?.selectedStore)
  const selectedArea = useSelector((state: RootState) => state.areaStore?.selectedArea)
  const companyId = (currentUser as any)?.company_id || 1

  const fetchStats = useCallback(async () => {
    if (isFetching) {
      return
    }

    try {
      setIsFetching(true)

      const { stats: statsData } = await fetchStockHistoryData(
        {
          page: 1,
          pageSize: 10000,
          storeId: storeFilter,
          transactionType: transactionTypeFilter,
          startDate,
          endDate,
          isUnlocked,
        },
        companyId,
      )

      setStats(statsData)
    } catch (err: any) {
      console.error('Error fetching stats:', err)
    } finally {
      setIsFetching(false)
    }
  }, [
    storeFilter,
    transactionTypeFilter,
    startDate,
    endDate,
    companyId,
    isFetching,
    isUnlocked,
  ])

  const fetchItems = useCallback(async () => {
    if (isFetching) {
      return
    }

    try {
      setIsFetching(true)
      setLoading(true)
      setError(null)

      const { items: itemsData, totalCount: count } =
        await fetchStockHistoryData(
          {
            page: currentPage,
            pageSize,
            searchQuery,
            storeId: storeFilter,
            transactionType: transactionTypeFilter,
            startDate,
            endDate,
          },
          companyId,
        )

      setItems(itemsData)
      setTotalCount(count)
    } catch (err: any) {
      console.error('Error fetching items:', err)
      setError(err.message || 'Failed to load items')
      setItems([])
      setTotalCount(0)
    } finally {
      setLoading(false)
      setIsFetching(false)
    }
  }, [
    currentPage,
    pageSize,
    searchQuery,
    storeFilter,
    transactionTypeFilter,
    startDate,
    endDate,
    companyId,
    isFetching,
    isUnlocked,
  ])

  useEffect(() => {
    const initializeData = async () => {
      try {
        setInitializing(true)
        setError(null)

        const storesData = await fetchStoresForFilter(companyId)
        setStores(storesData)

        setInitializing(false)
        isFirstRender.current = false
      } catch (err: any) {
        console.error('Error loading initial data:', err)
        setError('Failed to load initial data')
        setInitializing(false)
      }
    }

    initializeData()
  }, [companyId])

  useEffect(() => {
    if (!initializing && !isFetching) {
      fetchStats()
    }
  }, [storeFilter, transactionTypeFilter, startDate, endDate])

  useEffect(() => {
    if (!initializing && !isFetching) {
      fetchItems()
    }
  }, [
    currentPage,
    pageSize,
    searchQuery,
    storeFilter,
    transactionTypeFilter,
    startDate,
    endDate,
  ])

  const debouncedSearch = useDebouncedCallback((query: string) => {
    setSearchQuery(query)
    setCurrentPage(1)
  }, 400)

  const handleRefreshClick = useCallback(() => {
    handleRefresh(
      setItems,
      setLoading,
      setTotalCount,
      fetchStats,
      {
        page: currentPage,
        pageSize,
        searchQuery,
        storeId: storeFilter,
        transactionType: transactionTypeFilter,
        startDate,
        endDate,
      },
      companyId,
    )
  }, [
    fetchStats,
    currentPage,
    pageSize,
    searchQuery,
    storeFilter,
    transactionTypeFilter,
    startDate,
    endDate,
    companyId,
  ])

  const columns = getStockHistoryColumns(
    companySettings,
    theme,
    colorScheme === 'auto' ? 'light' : colorScheme,
  )

  const headerActions = getStockHistoryHeaderActions({
    onExportPDF: () => handleExportPDF(columns, items, companySettings),
    onExportExcel: () => handleExportExcel(columns, items, companySettings),
    onRefresh: handleRefreshClick,
  })

  const filters = getStockHistoryFilters({
    onStoreChange: (value) => {
      handleStoreChange(value, setStoreFilter, setCurrentPage)
    },
    onTransactionTypeChange: (value) => {
      handleTransactionTypeChange(
        value,
        setTransactionTypeFilter,
        setCurrentPage,
      )
    },
    stores,
    currentStoreFilter: storeFilter,
    currentTransactionTypeFilter: transactionTypeFilter,
  })

  const statisticsData = getStatisticsCardsData(stats, companySettings, theme)

  const currency =
    companySettings?.default_currency || companySettings?.base_currency || 'UGX'

  // Sync storeFilter with Redux selection
  useEffect(() => {
    const newStoreId = selectedStore ? String(selectedStore.id) : null
    setStoreFilter(newStoreId)
  }, [selectedStore, selectedArea])

  // Re-fetch when store/area selection changes
  useEffect(() => {
    if (!initializing) {
      fetchAllDate()
    }
  }, [selectedStore, selectedArea]) // eslint-disable-line react-hooks/exhaustive-deps

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

  return (
    <PageWrapper>
      <Container
        size="xxl"
        px={0}
      >
        {!companySettings && (
          <Alert
            icon={<IconAlertCircle size={16} />}
            title="Using Default Settings"
            color="yellow"
            mb="md"
            variant="light"
          >
            Company settings not found in Redux. Please ensure company settings
            are loaded during authentication.
          </Alert>
        )}

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

        <PageHeader
          title="Stock History"
          description={`Track stock movements • Currency: ${currency}`}
          actions={headerActions}
        />

        {/* Statistics Cards using StatsCards component */}
        <StatsCards
          stats={statisticsData}
          variant="elevated"
        />

        <ContentTable
          columns={columns}
          data={items}
          loading={loading}
          searchPlaceholder="Search by product, batch, customer, supplier, or reference..."
          filters={filters}
          onSearch={debouncedSearch}
          pagination={true}
          totalCount={totalCount}
          currentPage={currentPage}
          pageSize={pageSize}
          onPageChange={(page) => {
            setCurrentPage(page)
          }}
          onPageSizeChange={(size) => {
            setPageSize(size)
            setCurrentPage(1)
          }}
          onRowClick={(row) => handleRowClick(row, companySettings)}
          selectable={false}
        />
      </Container>
    </PageWrapper>
  )
}

export { StockHistory }

