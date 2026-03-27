// src/pages/LowStock/LowStockManagement.tsx - UPDATED WITH THEMING & DARK MODE
import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Container,
  Alert,
  useMantineTheme,
  useMantineColorScheme,
} from '@mantine/core'
import { IconAlertCircle } from '@tabler/icons-react'
import { useDispatch, useSelector } from 'react-redux'
import { AppDispatch } from '@app/core/store/store'
import { useDebouncedCallback } from '@mantine/hooks'
import PageHeader from '@shared/components/tableHeader/TableHeader'
import ContentTable from '@shared/components/tableContent/TableContent'
import { LowStockItem, LowStockStats } from './types/lowStock.types'
import { fetchLowStockData, fetchLowStockStats } from './utils/lowStock.utils'
import {
  handleExportPDF,
  handleExportExcel,
  handleRefresh,
  handleRowClick,
  handleUrgencyChange,
  handleStoreChange,
  handleCategoryChange,
} from './handlers/lowStock.handlers'
import {
  getLowStockColumns,
  getLowStockHeaderActions,
  getLowStockFilters,
  getStatisticsCardsData,
} from './LowStock.config'
import LayoutSkeleton from '@shared/components/skeletons/Layout.skeleton'
import { PageWrapper } from '@shared/styles/PageWrapper'
import { Store } from '@shared/types/Store'
import { supabase } from '@app/core/supabase/Supabase.utils'
import {
  selectCompanyId,
  selectDefaultCurrency,
  selectNearExpiryWarningDays,
  selectNearExpiryCriticalDays,
  selectLowStockMultiplier,
  selectCompanySettings,
} from '@features/authentication/authSlice'
import { selectIsUnlocked } from '@core/restrictedMode/Restrictedmode.slice'
import StatsCards from '@shared/components/statistics/StatisticsCard'

const LowStockManagement = () => {
  const theme = useMantineTheme()
  const { colorScheme } = useMantineColorScheme()

  const [lowStockItems, setLowStockItems] = useState<LowStockItem[]>([])
  const [stores, setStores] = useState<Store[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [initializing, setInitializing] = useState(true)
  const [isFetching, setIsFetching] = useState(false)
  const isFirstRender = useRef(true)
  const [error, setError] = useState<string | null>(null)

  const dispatch = useDispatch<AppDispatch>()

  const companyId = useSelector(selectCompanyId)
  const currency = useSelector(selectDefaultCurrency)
  const nearExpiryWarningDays = useSelector(selectNearExpiryWarningDays)
  const nearExpiryCriticalDays = useSelector(selectNearExpiryCriticalDays)
  const lowStockMultiplier = useSelector(selectLowStockMultiplier)
  const companySettings = useSelector(selectCompanySettings)
  const isUnlocked = useSelector(selectIsUnlocked)

  const [stats, setStats] = useState<LowStockStats>({
    total: 0,
    critical: 0,
    high: 0,
    medium: 0,
    totalValue: 0,
  })

  const [currentPage, setCurrentPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(8)
  const [totalCount, setTotalCount] = useState<number>(0)
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [urgencyFilter, setUrgencyFilter] = useState<string>('all')
  const [storeFilter, setStoreFilter] = useState<string | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [selectedItem, setSelectedItem] = useState<LowStockItem | null>(null)

  // ============================================================================
  // FETCH FUNCTIONS
  // ============================================================================

  const fetchLowStockOnly = useCallback(async () => {
    if (!companyId || isFetching) {
      console.log('⏭️ [fetchLowStockOnly] Skipping')
      return
    }

    try {
      setIsFetching(true)
      setLoading(true)
      setError(null)

      console.log(
        '🔄 [fetchLowStockOnly] Fetching low stock from view_low_stock...',
      )

      const { lowStockData, totalCount: count } = await fetchLowStockData({
        page: currentPage,
        pageSize,
        searchQuery,
        urgencyLevel: urgencyFilter,
        storeId: storeFilter,
        categoryId: categoryFilter,
        companyId,
        isUnlocked,
      })

      console.log('✅ [fetchLowStockOnly] Fetched:', count, 'items')

      setLowStockItems(lowStockData)
      setTotalCount(count)
    } catch (err: any) {
      console.error('❌ [fetchLowStockOnly] Error:', err)
      setError(err.message || 'Failed to load low stock items')
      setLowStockItems([])
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
    urgencyFilter,
    storeFilter,
    categoryFilter,
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

      console.log('🔄 [fetchAllData] Fetching ALL data from view_low_stock...')

      const [statsData, lowStockResult, storesData, categoriesData] =
        await Promise.all([
          fetchLowStockStats(companyId),
          fetchLowStockData({
            page: currentPage,
            pageSize,
            searchQuery,
            urgencyLevel: urgencyFilter,
            storeId: storeFilter,
            categoryId: categoryFilter,
            companyId,
            isUnlocked,
          }),
          supabase
            .from('stores')
            .select('*')
            .is('deleted_at', null)
            .eq('company_id', companyId)
            .order('store_name'),
          supabase
            .from('categories')
            .select('*')
            .is('deleted_at', null)
            .eq('company_id', companyId)
            .order('category_name'),
        ])

      console.log('✅ [fetchAllData] All data fetched successfully')

      setStats(statsData)
      setLowStockItems(lowStockResult.lowStockData)
      setTotalCount(lowStockResult.totalCount)

      if (storesData.data) setStores(storesData.data)
      if (categoriesData.data) setCategories(categoriesData.data)
    } catch (err: any) {
      console.error('❌ [fetchAllData] Error:', err)
      setError(err.message || 'Failed to load data')
    } finally {
      setLoading(false)
      setIsFetching(false)
    }
  }, [
    companyId,
    currentPage,
    pageSize,
    searchQuery,
    urgencyFilter,
    storeFilter,
    categoryFilter,
    isFetching,
    isUnlocked,
  ])

  // ============================================================================
  // INITIAL LOAD
  // ============================================================================
  useEffect(() => {
    if (companyId && initializing) {
      console.log('🎬 [LowStock] Initial load started (using view_low_stock)')
      fetchAllData().then(() => {
        setInitializing(false)
        isFirstRender.current = false
        console.log('✅ [LowStock] Initial load complete')
      })
    }
  }, [companyId, initializing])

  // ============================================================================
  // LISTEN FOR UPDATES
  // ============================================================================
  useEffect(() => {
    let timeoutId: NodeJS.Timeout

    const handleLowStockUpdate = () => {
      if (!initializing && !isFetching && companyId) {
        console.log('🔔 [Event] lowStockUpdated received')
        clearTimeout(timeoutId)
        timeoutId = setTimeout(() => {
          console.log('🔄 [Event] Refreshing data from view_low_stock...')
          fetchAllData()
        }, 300)
      }
    }

    window.addEventListener('lowStockUpdated', handleLowStockUpdate)
    return () => {
      clearTimeout(timeoutId)
      window.removeEventListener('lowStockUpdated', handleLowStockUpdate)
    }
  }, [initializing, isFetching, companyId, fetchAllData])

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
        fetchLowStockOnly()
      }, 300)
      return () => clearTimeout(timeoutId)
    }
  }, [
    currentPage,
    pageSize,
    searchQuery,
    urgencyFilter,
    storeFilter,
    categoryFilter,
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
      console.log('🔄 [Refresh] Manual refresh triggered (view_low_stock)')
      await fetchAllData()
    } catch (error: any) {
      console.error('❌ [Refresh] Error:', error)
    }
  }, [fetchAllData])

  // ============================================================================
  // CONFIG
  // ============================================================================
  const columns = getLowStockColumns(
    currency,
    nearExpiryCriticalDays,
    nearExpiryWarningDays,
    theme,
    colorScheme === 'dark' ? 'dark' : 'light',
  )

  const headerActions = getLowStockHeaderActions({
    onExportPDF: () => handleExportPDF(columns, lowStockItems),
    onExportExcel: () => handleExportExcel(columns, lowStockItems),
    onRefresh: handleRefreshClick,
  })

  const filters = getLowStockFilters({
    onUrgencyChange: (value) => {
      console.log('🔍 Urgency filter:', value)
      handleUrgencyChange(value, setUrgencyFilter, setCurrentPage)
    },
    onStoreChange: (value) => {
      console.log('🔍 Store filter:', value)
      handleStoreChange(value, setStoreFilter, setCurrentPage, dispatch, stores)
    },
    onCategoryChange: (value) => {
      console.log('🔍 Category filter:', value)
      handleCategoryChange(value, setCategoryFilter, setCurrentPage)
    },
    stores,
    categories,
    currentUrgencyFilter: urgencyFilter,
    currentStoreFilter: storeFilter,
    currentCategoryFilter: categoryFilter,
  })

  const statisticsData = getStatisticsCardsData(stats, currency, theme)

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

  if (error && !companyId) {
    return (
      <PageWrapper>
        <Container
          size="xxl"
          px={0}
        >
          <PageHeader
            title="Low Stock Inventory"
            description="Monitor and manage items below reorder threshold"
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
        {!companySettings && (
          <Alert
            icon={<IconAlertCircle size={16} />}
            title="Company Settings Not Available"
            color="yellow"
            mb="md"
          >
            Company settings not loaded from Redux. Using default values.
          </Alert>
        )}

        {error && (
          <Alert
            icon={<IconAlertCircle size={16} />}
            title="Error"
            color="red"
            mb="md"
            withCloseButton
            onClose={() => setError(null)}
          >
            {error}
          </Alert>
        )}

        <PageHeader
          title="Low Stock Inventory"
          description={`Monitor items below reorder level • Currency: ${currency} • Multiplier: ${lowStockMultiplier}x`}
          actions={headerActions}
        />

        {/* Statistics Cards using StatsCards component */}
        <StatsCards
          stats={statisticsData}
          variant="elevated"
        />

        <ContentTable
          columns={columns}
          data={lowStockItems}
          loading={loading}
          searchPlaceholder="Search by product name, code, generic name, barcode..."
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
          onRowClick={(row) =>
            handleRowClick(row, selectedItem, setSelectedItem)
          }
          selectedRowId={selectedItem?.id}
          selectable={true}
        />
      </Container>
    </PageWrapper>
  )
}

export { LowStockManagement }

