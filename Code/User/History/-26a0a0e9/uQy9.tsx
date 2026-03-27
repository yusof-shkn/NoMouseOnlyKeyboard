// src/pages/ExpiringSoon/ExpiringSoon.tsx - UPDATED WITH THEMING & DARK MODE
import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Container,
  Alert,
  useMantineTheme,
  useMantineColorScheme,
} from '@mantine/core'
import { useSelector } from 'react-redux'
import { useDebouncedCallback } from '@mantine/hooks'
import { IconAlertCircle } from '@tabler/icons-react'
import PageHeader from '@shared/components/tableHeader/TableHeader'
import ContentTable from '@shared/components/tableContent/TableContent'
import { ExpiringSoonItem, ExpiringSoonStats } from './types/expiringSoon.types'
import { Store } from '@shared/types/Store'
import {
  fetchExpiringSoonData,
  fetchStoresForFilter,
} from './utils/expiringSoon.utils'
import {
  handleExportPDF,
  handleExportExcel,
  handleRefresh,
  handleStoreChange,
  handleDaysThresholdChange,
  handleRowClick,
} from './handlers/expiringSoon.handlers'
import {
  getExpiringSoonColumns,
  getExpiringSoonHeaderActions,
  getExpiringSoonFilters,
  getStatisticsCardsData,
} from './ExpiringSoon.config'
import LayoutSkeleton from '@shared/components/skeletons/Layout.skeleton'
import { PageWrapper } from '@shared/styles/PageWrapper'
import {
  selectCompanySettings,
  selectCompanyId,
} from '@features/authentication/authSlice'
import { selectIsUnlocked } from '@core/restrictedMode/Restrictedmode.slice'
import StatsCards from '@shared/components/statistics/StatisticsCard'

const ExpiringSoon = () => {
  const theme = useMantineTheme()
  const { colorScheme } = useMantineColorScheme()

  const [items, setItems] = useState<ExpiringSoonItem[]>([])
  const [stores, setStores] = useState<Store[]>([])
  const [loading, setLoading] = useState(false)
  const [initializing, setInitializing] = useState(true)
  const [isFetching, setIsFetching] = useState(false)
  const isFirstRender = useRef(true)
  const [error, setError] = useState<string | null>(null)

  const [stats, setStats] = useState<ExpiringSoonStats>({
    totalBatches: 0,
    totalQuantity: 0,
    totalValue: 0,
    criticalItems: 0,
  })

  const [currentPage, setCurrentPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(8)
  const [totalCount, setTotalCount] = useState<number>(0)
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [storeFilter, setStoreFilter] = useState<string | null>(null)
  const [daysThreshold, setDaysThreshold] = useState<number>(90)

  const companySettings = useSelector(selectCompanySettings)
  const isUnlocked = useSelector(selectIsUnlocked)
  const companyId = useSelector(selectCompanyId)

  // ============================================================================
  // FETCH FUNCTIONS
  // ============================================================================

  const fetchStats = useCallback(async () => {
    if (!companyId || isFetching) {
      console.log('⏭️ [fetchStats] Skipping')
      return
    }

    try {
      setIsFetching(true)
      console.log('🔄 [fetchStats] Fetching stats from view_expiring_stock...')

      const { stats: statsData } = await fetchExpiringSoonData(
        {
          page: 1,
          pageSize: 1000,
          daysThreshold,
          storeId: storeFilter,
          isUnlocked,
        },
        companyId,
        companySettings,
      )

      console.log('✅ [fetchStats] Stats fetched from view:', statsData)
      setStats(statsData)
    } catch (err: any) {
      console.error('❌ [fetchStats] Error:', err)
    } finally {
      setIsFetching(false)
    }
  }, [daysThreshold, storeFilter, companyId, companySettings, isFetching])

  const fetchItems = useCallback(async () => {
    if (!companyId || isFetching) {
      console.log('⏭️ [fetchItems] Skipping')
      return
    }

    try {
      setIsFetching(true)
      setLoading(true)
      setError(null)

      console.log('🔄 [fetchItems] Fetching items from view_expiring_stock...')

      const { items: itemsData, totalCount: count } =
        await fetchExpiringSoonData(
          {
            page: currentPage,
            pageSize,
            searchQuery,
            storeId: storeFilter,
            daysThreshold,
          },
          companyId,
          companySettings,
        )

      console.log('✅ [fetchItems] Fetched from view:', count, 'items')

      setItems(itemsData)
      setTotalCount(count)
    } catch (err: any) {
      console.error('❌ [fetchItems] Error:', err)
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
    daysThreshold,
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
      setError(null)

      console.log(
        '🔄 [fetchAllData] Fetching ALL data from view_expiring_stock...',
      )

      const [storesData, itemsResult] = await Promise.all([
        fetchStoresForFilter(companyId),
        fetchExpiringSoonData(
          {
            page: currentPage,
            pageSize,
            searchQuery,
            storeId: storeFilter,
            daysThreshold,
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
    } catch (err: any) {
      console.error('❌ [fetchAllData] Error:', err)
      setError(err.message || 'Failed to load data')
    } finally {
      setLoading(false)
      setIsFetching(false)
    }
  }, [
    currentPage,
    pageSize,
    searchQuery,
    storeFilter,
    daysThreshold,
    companyId,
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
        '🎬 [ExpiringSoon] Initial load started (using view_expiring_stock)',
      )

      if (companySettings?.near_expiry_warning_days) {
        setDaysThreshold(companySettings.near_expiry_warning_days)
      }

      fetchAllData().then(() => {
        setInitializing(false)
        isFirstRender.current = false
        console.log('✅ [ExpiringSoon] Initial load complete')
      })
    }
  }, [companyId, initializing, companySettings])

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
  }, [currentPage, pageSize, searchQuery, storeFilter, daysThreshold])

  useEffect(() => {
    if (!isFirstRender.current && !initializing && !isFetching) {
      fetchStats()
    }
  }, [daysThreshold, storeFilter])

  // ============================================================================
  // HANDLERS
  // ============================================================================
  const debouncedSearch = useDebouncedCallback((query: string) => {
    console.log('🔍 Debounced search:', query)
    setSearchQuery(query)
    setCurrentPage(1)
  }, 400)

  const handleRefreshClick = useCallback(() => {
    console.log('🔄 [Refresh] Manual refresh triggered')
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
        daysThreshold,
      },
      companyId!,
      companySettings,
    )
  }, [
    fetchStats,
    currentPage,
    pageSize,
    searchQuery,
    storeFilter,
    daysThreshold,
    companyId,
    companySettings,
  ])

  // ============================================================================
  // CONFIG
  // ============================================================================
  const columns = getExpiringSoonColumns(
    companySettings,
    theme,
    colorScheme === 'dark' ? 'dark' : 'light',
  )

  const headerActions = getExpiringSoonHeaderActions({
    onExportPDF: () => handleExportPDF(columns, items, companySettings),
    onExportExcel: () => handleExportExcel(columns, items, companySettings),
    onRefresh: handleRefreshClick,
  })

  const filters = getExpiringSoonFilters({
    onStoreChange: (value) => {
      console.log('🔍 Store filter:', value)
      handleStoreChange(value, setStoreFilter, setCurrentPage)
    },
    onDaysThresholdChange: (value) => {
      console.log('🔍 Days threshold:', value)
      handleDaysThresholdChange(value, setDaysThreshold, setCurrentPage)
    },
    stores,
    currentStoreFilter: storeFilter,
    currentDaysThreshold: daysThreshold,
    settings: companySettings,
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
          title="Expiring Soon"
          description={`Monitor expiring inventory • Currency: ${companySettings?.default_currency || 'UGX'}`}
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
          data={items}
          loading={loading}
          searchPlaceholder="Search by product name, code, or batch number..."
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
          onRowClick={(row) => handleRowClick(row, companySettings)}
          selectable={false}
        />
      </Container>
    </PageWrapper>
  )
}

export { ExpiringSoon }

