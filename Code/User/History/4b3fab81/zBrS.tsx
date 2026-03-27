// src/pages/Income/IncomeManagement.tsx

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Container,
  Alert,
  useMantineTheme,
  useMantineColorScheme,
} from '@mantine/core'
import { useSelector } from 'react-redux'
import { useDebouncedCallback } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import {
  IconInfoCircle,
  IconAlertTriangle,
  IconAlertCircle,
} from '@tabler/icons-react'
import PageHeader from '@shared/components/tableHeader/TableHeader'
import ContentTable from '@shared/components/tableContent/TableContent'
import StatisticsCard from '@shared/components/statistics/StatisticsCard'
import { Income, IncomeCategory, IncomeStats } from './types/income.types'
import {
  fetchIncomeData,
  fetchIncomeStats,
  formatCurrency,
} from './utils/income.utils'

import {
  selectCompanySettings,
  selectCompanyId,
  selectTaxRate,
  selectDefaultCurrency,
} from '@features/authentication/authSlice'
import { selectIsUnlocked } from '@core/restrictedMode/Restrictedmode.slice'

import {
  handleExportPDF,
  handleExportExcel,
  handleDelete,
  handleApprove,
  handlePost,
  handleRowClick,
  handleStatusChange,
  handleCategoryChange,
  handleDateRangeChange,
} from './handlers/income.handlers'

import {
  getIncomeColumns,
  getIncomeHeaderActions,
  getIncomeRowActions,
  getIncomeFilters,
  getStatisticsCardsData,
} from './Income.config'
import { LayoutSkeleton } from '@shared/components/skeletons/Layout.skeleton'
import { PageWrapper } from '@shared/styles/PageWrapper'

import { getPaperBackground, getTextColor } from '@app/core/theme/theme.utils'

const IncomeManagement = () => {
  const theme = useMantineTheme()
  const { colorScheme } = useMantineColorScheme()
  const resolvedColorScheme: 'light' | 'dark' =
    colorScheme === 'dark' ? 'dark' : 'light'

  const [income, setIncome] = useState<Income[]>([])
  const [categories, setCategories] = useState<IncomeCategory[]>([])
  const [loading, setLoading] = useState(false)
  const [initializing, setInitializing] = useState(true)
  const [isFetching, setIsFetching] = useState(false)
  const isFirstRender = useRef(true)

  const [error, setError] = useState<string | null>(null)

  const [stats, setStats] = useState<IncomeStats>({
    total: 0,
    pending: 0,
    approved: 0,
    posted: 0,
    totalAmount: 0,
    currentMonthAmount: 0,
    systemGenerated: 0,
    manualEntries: 0,
  })

  const [currentPage, setCurrentPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(10)
  const [totalCount, setTotalCount] = useState<number>(0)
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<number | null>(null)
  const [startDate, setStartDate] = useState<string | null>(null)
  const [endDate, setEndDate] = useState<string | null>(null)
  const [selectedIncome, setSelectedIncome] = useState<Income | null>(null)

  const settings = useSelector(selectCompanySettings)
  const companyId = useSelector(selectCompanyId)
  const taxRate = useSelector(selectTaxRate)
  const currency = useSelector(selectDefaultCurrency)
  const isUnlocked = useSelector(selectIsUnlocked)
  // Theme colors
  const paperBg = getPaperBackground(theme, resolvedColorScheme, false)
  const textColor = getTextColor(theme, resolvedColorScheme, 'primary')

  // ============================================================================
  // STEP 1: Initialize (runs once on mount)
  // ============================================================================
  useEffect(() => {
    const initialize = async () => {
      try {
        console.log('🎬 [Initial Load] Starting initialization...')
        setInitializing(true)
        setError(null)

        if (settings) {
          console.log('✅ Settings loaded from authSlice:', {
            taxRate: settings.tax_rate,
            currency: settings.default_currency,
          })
        } else {
          console.warn('⚠️ No company settings found in authSlice')
        }
      } catch (error) {
        console.error('❌ Error during initialization:', error)
        setError('Failed to initialize. Please refresh the page.')
        setInitializing(false)
      }
    }

    initialize()
  }, [settings])

  // ============================================================================
  // FETCH FUNCTIONS
  // ============================================================================

  const getCurrentFilters = useCallback(
    () => ({
      page: currentPage,
      pageSize,
      searchQuery,
      status: statusFilter,
      categoryId: categoryFilter,
      startDate,
      endDate,
      companyId: companyId || undefined,
      isUnlocked,
    }),
    [
      currentPage,
      pageSize,
      searchQuery,
      statusFilter,
      categoryFilter,
      startDate,
      endDate,
      companyId,
      isUnlocked,
    ],
  )

  const fetchIncome = useCallback(async () => {
    if (isFetching) {
      console.log('⏭️ [fetchIncome] Skipping - already fetching')
      return
    }

    try {
      setIsFetching(true)
      setLoading(true)
      setError(null)

      console.log('🔄 [fetchIncome] Fetching with params:', getCurrentFilters())

      const incomeResult = await fetchIncomeData(getCurrentFilters())

      console.log('✅ [fetchIncome] Fetched:', {
        count: incomeResult.incomeData.length,
        totalCount: incomeResult.totalCount,
      })

      setIncome(incomeResult.incomeData)
      setCategories(incomeResult.categories)
      setTotalCount(incomeResult.totalCount)
    } catch (err) {
      console.error('❌ Error fetching income:', err)
      setError('Failed to load income. Please try again.')
      setIncome([])
      setCategories([])
      setTotalCount(0)
    } finally {
      setLoading(false)
      setIsFetching(false)
    }
  }, [isFetching, getCurrentFilters])

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

      const [statsData, incomeResult] = await Promise.all([
        fetchIncomeStats(companyId || undefined),
        fetchIncomeData(getCurrentFilters()),
      ])

      console.log('✅ [fetchAllData] All data fetched successfully')

      setStats(statsData)
      setIncome(incomeResult.incomeData)
      setCategories(incomeResult.categories)
      setTotalCount(incomeResult.totalCount)
    } catch (err) {
      console.error('❌ Error fetching all data:', err)
      setError('Failed to load data. Please try again.')
    } finally {
      setLoading(false)
      setIsFetching(false)
    }
  }, [isFetching, getCurrentFilters, companyId])

  // ============================================================================
  // STEP 2: Initial data fetch
  // ============================================================================
  useEffect(() => {
    if (initializing) {
      console.log('🎬 [Initial Load] Loading income...')
      fetchAllData().then(() => {
        setInitializing(false)
        isFirstRender.current = false
        console.log('✅ [Initial Load] Complete')
      })
    }
  }, [initializing])

  // ============================================================================
  // STEP 3: Listen for income updates
  // ============================================================================
  useEffect(() => {
    let timeoutId: NodeJS.Timeout

    const handleIncomeUpdate = () => {
      if (!initializing && !isFetching) {
        console.log('🔔 [Event] incomeUpdated received')
        clearTimeout(timeoutId)
        timeoutId = setTimeout(() => {
          console.log('🔄 [Event] Refreshing data...')
          fetchAllData()
        }, 300)
      }
    }

    window.addEventListener('incomeUpdated', handleIncomeUpdate)
    return () => {
      clearTimeout(timeoutId)
      window.removeEventListener('incomeUpdated', handleIncomeUpdate)
    }
  }, [initializing, isFetching, fetchAllData])

  // ============================================================================
  // STEP 4: Handle filter/pagination changes
  // ============================================================================
  useEffect(() => {
    if (isFirstRender.current) {
      return
    }

    if (!initializing && !isFetching) {
      console.log('🔍 [Filters] Change detected, fetching income...')
      const timeoutId = setTimeout(() => {
        fetchIncome()
      }, 300)
      return () => clearTimeout(timeoutId)
    }
  }, [
    currentPage,
    pageSize,
    searchQuery,
    statusFilter,
    categoryFilter,
    startDate,
    endDate,
    isUnlocked,
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
        message: 'Income data refreshed successfully',
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

  const localHandleDelete = useCallback(
    async (row: Income) => {
      await handleDelete(
        row,
        fetchAllData,
        async () => {
          const statsData = await fetchIncomeStats(companyId || undefined)
          setStats(statsData)
        },
        settings || undefined,
      )
    },
    [fetchAllData, companyId, settings],
  )

  const localHandleApprove = useCallback(
    async (row: Income) => {
      await handleApprove(
        row,
        fetchAllData,
        async () => {
          const statsData = await fetchIncomeStats(companyId || undefined)
          setStats(statsData)
        },
        settings || undefined,
      )
    },
    [fetchAllData, companyId, settings],
  )

  const localHandlePost = useCallback(
    async (row: Income) => {
      await handlePost(
        row,
        fetchAllData,
        async () => {
          const statsData = await fetchIncomeStats(companyId || undefined)
          setStats(statsData)
        },
        settings || undefined,
      )
    },
    [fetchAllData, companyId, settings],
  )

  // ============================================================================
  // CONFIG
  // ============================================================================
  const columns = getIncomeColumns(settings || undefined)

  const headerActions = getIncomeHeaderActions({
    onExportPDF: () => handleExportPDF(columns, income, settings || undefined),
    onExportExcel: () =>
      handleExportExcel(columns, income, settings || undefined),
    onRefresh: handleRefreshClick,
  })

  const rowActions = getIncomeRowActions(
    {
      onApprove: localHandleApprove,
      onPost: localHandlePost,
      onEdit: (row) => {
        if (row.is_system) {
          notifications.show({
            title: 'Cannot Edit',
            message: `This income was auto-generated from ${row.reference_type}. Edit the source transaction instead.`,
            color: 'yellow',
          })
          return
        }
        notifications.show({
          title: 'Edit Income',
          message: 'Edit functionality coming soon',
          color: 'blue',
        })
      },
      onDelete: localHandleDelete,
    },
    settings || undefined,
  )

  const filters = getIncomeFilters({
    onStatusChange: (value) =>
      handleStatusChange(value, setStatusFilter, setCurrentPage),
    onCategoryChange: (value) =>
      handleCategoryChange(value, setCategoryFilter, setCurrentPage),
    onDateRangeChange: (dates: [Date | null, Date | null]) => {
      const [start, end] = dates
      handleDateRangeChange(
        start ? start.toISOString().split('T')[0] : null,
        end ? end.toISOString().split('T')[0] : null,
        setStartDate,
        setEndDate,
        setCurrentPage,
      )
    },
    categories,
    currentStatusFilter: statusFilter,
    currentCategoryFilter: categoryFilter,
    currentDateRange: [
      startDate ? new Date(startDate) : null,
      endDate ? new Date(endDate) : null,
    ] as [Date | null, Date | null],
  })

  const pageDescription = `Manage your income records - Tax Rate: ${taxRate || 18}% | Currency: ${currency || 'UGX'}`
  const statisticsData = getStatisticsCardsData(stats, settings || undefined)

  // ============================================================================
  // RENDER: Show full skeleton ONLY during initial load
  // ============================================================================
  if (initializing) {
    return (
      <PageWrapper style={{ backgroundColor: paperBg }}>
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
  // RENDER: Show error if initialization failed
  // ============================================================================
  if (error && income.length === 0) {
    return (
      <PageWrapper style={{ backgroundColor: paperBg }}>
        <Container
          size="xxl"
          px={0}
        >
          <PageHeader
            title="Income Management"
            description="Manage your income records"
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

  // ============================================================================
  // RENDER: Normal view with table
  // ============================================================================
  return (
    <PageWrapper style={{ backgroundColor: paperBg }}>
      <Container
        size="xxl"
        px={0}
      >
        {/* Settings Warning */}
        {!settings && (
          <Alert
            icon={<IconAlertTriangle size={16} />}
            title="Settings Notice"
            color="yellow"
            mb="md"
          >
            Company settings not found. Using default values. Please configure
            your company settings.
          </Alert>
        )}

        {/* System-Generated Income Info */}
        {stats.systemGenerated && stats.systemGenerated > 0 && (
          <Alert
            icon={<IconInfoCircle size={16} />}
            title="Auto-Generated Income"
            color="violet"
            mb="md"
          >
            {stats.systemGenerated} income record(s) were automatically created
            from completed sales. These cannot be edited or deleted directly -
            modify the source sale instead.
          </Alert>
        )}

        <PageHeader
          title="Income Management"
          description={pageDescription}
          actions={headerActions}
        />

        <StatisticsCard stats={statisticsData} />

        <ContentTable
          columns={columns}
          data={income}
          loading={loading}
          searchPlaceholder="Search by income number, description, or reference..."
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
              selectedIncome,
              setSelectedIncome,
              settings || undefined,
            )
          }
          selectedRowId={selectedIncome?.id}
          selectable={true}
        />
      </Container>
    </PageWrapper>
  )
}

export { IncomeManagement }

