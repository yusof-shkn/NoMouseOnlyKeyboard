// src/pages/FastMovingItems/FastMovingItems.tsx - UPDATED WITH THEMING & DARK MODE
import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Container,
  useMantineTheme,
  useMantineColorScheme,
} from '@mantine/core'
import { useSelector } from 'react-redux'
import { useDebouncedCallback } from '@mantine/hooks'
import PageHeader from '@shared/components/tableHeader/TableHeader'
import ContentTable from '@shared/components/tableContent/TableContent'
import {
  FastMovingItem,
  FastMovingItemStats,
} from './types/fastMovingItems.types'
import { Store } from '@shared/types/Store'
import {
  fetchFastMovingItemsData,
  fetchStoresForFilter,
} from './utils/fastMovingItems.utils'
import {
  handleExportPDF,
  handleExportExcel,
  handleRefresh,
  handleStoreChange,
  handlePeriodChange,
  handleVelocityChange,
  handleRowClick,
} from './handlers/fastMovingItems.handlers'
import {
  getFastMovingColumns,
  getFastMovingHeaderActions,
  getFastMovingFilters,
  getStatisticsCardsData,
} from './FastMovingItems.config'
import LayoutSkeleton from '@shared/components/skeletons/Layout.skeleton'
import { PageWrapper } from '@shared/styles/PageWrapper'
import {
  selectCompanySettings,
  selectCompanyId,
} from '@features/authentication/authSlice'
import { selectIsUnlocked } from '@core/restrictedMode/Restrictedmode.slice'
import StatsCards from '@shared/components/statistics/StatisticsCard'

const FastMovingItems = () => {
  const theme = useMantineTheme()
  const { colorScheme } = useMantineColorScheme()

  const [items, setItems] = useState<FastMovingItem[]>([])
  const [stores, setStores] = useState<Store[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [initializing, setInitializing] = useState<boolean>(true)
  const [isFetching, setIsFetching] = useState<boolean>(false)
  const isFirstRender = useRef(true)

  const [stats, setStats] = useState<FastMovingItemStats>({
    totalProducts: 0,
    totalQuantitySold: 0,
    totalRevenue: 0,
    avgVelocity: 0,
  })

  const [currentPage, setCurrentPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(8)
  const [totalCount, setTotalCount] = useState<number>(0)
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [storeFilter, setStoreFilter] = useState<string | null>(null)
  const [periodDays, setPeriodDays] = useState<number>(30)
  const [minVelocity, setMinVelocity] = useState<number>(0)

  const companySettings = useSelector(selectCompanySettings)
  const isUnlocked = useSelector(selectIsUnlocked)
  const companyId = useSelector(selectCompanyId)

  // ============================================================================
  // FETCH FUNCTIONS
  // ============================================================================

  const fetchStats = useCallback(async () => {
    if (!companyId || isFetching) return

    try {
      const result = await fetchFastMovingItemsData(
        {
          page: 1,
          pageSize: 1000,
          periodDays,
          storeId: storeFilter,
          isUnlocked,
        },
        companyId,
        companySettings,
      )
      setStats(result.stats)
    } catch (error: any) {
      console.error('Error fetching stats:', error)
    }
  }, [
    periodDays,
    storeFilter,
    companyId,
    companySettings,
    isFetching,
    isUnlocked,
  ])

  const fetchItems = useCallback(async () => {
    if (!companyId || isFetching) {
      console.log('⏭️ [fetchItems] Skipping')
      return
    }

    try {
      setIsFetching(true)
      setLoading(true)

      console.log(
        '🔄 [fetchItems] Fetching fast moving items from view_fast_moving_stock...',
      )

      const result = await fetchFastMovingItemsData(
        {
          page: currentPage,
          pageSize,
          searchQuery,
          storeId: storeFilter,
          periodDays,
          minVelocity,
          isUnlocked,
        },
        companyId,
        companySettings,
      )

      console.log(
        '✅ [fetchItems] Fetched:',
        result.totalCount,
        'items from view',
      )

      setItems(result.items)
      setTotalCount(result.totalCount)
    } catch (error) {
      console.error('❌ [fetchItems] Error:', error)
    } finally {
      setLoading(false)
      setIsFetching(false)
    }
  }, [
    currentPage,
    pageSize,
    searchQuery,
    storeFilter,
    periodDays,
    minVelocity,
    companyId,
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

      console.log(
        '🔄 [fetchAllData] Fetching ALL data from view_fast_moving_stock...',
      )

      const [storesData, itemsResult] = await Promise.all([
        fetchStoresForFilter(companyId),
        fetchFastMovingItemsData(
          {
            page: currentPage,
            pageSize,
            searchQuery,
            storeId: storeFilter,
            periodDays,
            minVelocity,
          },
          companyId,
          companySettings,
        ),
      ])

      console.log('✅ [fetchAllData] All data fetched from view')

      setStores(storesData)
      setItems(itemsResult.items)
      setTotalCount(itemsResult.totalCount)
      setStats(itemsResult.stats)
    } catch (error) {
      console.error('❌ [fetchAllData] Error:', error)
    } finally {
      setLoading(false)
      setIsFetching(false)
    }
  }, [
    companyId,
    currentPage,
    pageSize,
    searchQuery,
    storeFilter,
    periodDays,
    minVelocity,
    companySettings,
    isFetching,
    isUnlocked,
  ])

  // ============================================================================
  // INITIAL LOAD
  // ============================================================================
  useEffect(() => {
    if (companyId && initializing) {
      console.log(
        '🎬 [FastMovingItems] Initial load started (using view_fast_moving_stock)',
      )
      fetchAllData().then(() => {
        setInitializing(false)
        isFirstRender.current = false
        console.log('✅ [FastMovingItems] Initial load complete')
      })
    }
  }, [companyId, initializing])

  // ============================================================================
  // HANDLE FILTER CHANGES
  // ============================================================================
  useEffect(() => {
    if (isFirstRender.current) {
      return
    }

    if (!initializing && !isFetching && companyId) {
      console.log('🔍 [Filters] Change detected')
      const timeoutId = setTimeout(() => {
        fetchItems()
      }, 300)
      return () => clearTimeout(timeoutId)
    }
  }, [currentPage, pageSize, searchQuery, storeFilter, periodDays, minVelocity])

  useEffect(() => {
    if (!isFirstRender.current && !initializing) {
      fetchStats()
    }
  }, [periodDays, storeFilter])

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
    } catch (error: any) {
      console.error('❌ [Refresh] Error:', error)
    }
  }, [fetchAllData])

  // ============================================================================
  // CONFIG
  // ============================================================================
  const columns = getFastMovingColumns(
    companySettings,
    theme,
    colorScheme === 'dark' ? 'dark' : 'light',
  )

  const headerActions = getFastMovingHeaderActions({
    onExportPDF: () => handleExportPDF(columns, items, companySettings),
    onExportExcel: () => handleExportExcel(columns, items, companySettings),
    onRefresh: handleRefreshClick,
  })

  const filters = getFastMovingFilters({
    onStoreChange: (value) =>
      handleStoreChange(value, setStoreFilter, setCurrentPage),
    onPeriodChange: (value) =>
      handlePeriodChange(value, setPeriodDays, setCurrentPage),
    onVelocityChange: (value) =>
      handleVelocityChange(value, setMinVelocity, setCurrentPage),
    stores,
    currentStoreFilter: storeFilter,
    currentPeriod: periodDays,
    currentMinVelocity: minVelocity,
  })

  const statisticsData = getStatisticsCardsData(stats, companySettings, theme)

  // ============================================================================
  // RENDER
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

  return (
    <PageWrapper>
      <Container
        size="xxl"
        px={0}
      >
        <PageHeader
          title="Fast Moving Items"
          description={`Track your most popular products • Currency: ${companySettings?.default_currency || 'UGX'}`}
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
          searchPlaceholder="Search by product name or code..."
          filters={filters}
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
          onRowClick={(row) => handleRowClick(row)}
          selectable={false}
        />
      </Container>
    </PageWrapper>
  )
}

export { FastMovingItems }

