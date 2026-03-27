// src/features/main/UnitsManagement/UnitsManagement.tsx - FIXED with theme integration
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Container, Alert, useMantineTheme } from '@mantine/core'
import { useDispatch } from 'react-redux'
import { AppDispatch } from '@app/core/store/store'
import { useDebouncedCallback } from '@mantine/hooks'
import { IconAlertCircle } from '@tabler/icons-react'
import PageHeader from '@shared/components/tableHeader/TableHeader'
import ContentTable from '@shared/components/tableContent/TableContent'
import StatisticsCard from '../../../../shared/components/statistics/StatisticsCard'
import { UnitWithRelations } from '@shared/types/units'
import { fetchUnitsData, fetchUnitStats } from './utils/unitsManagement.utils'
import {
  handleAddUnit,
  handleExportPDF,
  handleExportExcel,
  handleView,
  handleEdit,
} from './handlers/unitsManagement.handlers'
import {
  getUnitColumns,
  getUnitHeaderActions,
  getUnitPrimaryAction,
  getUnitRowActions,
  getUnitFilters,
  getStatisticsCardsData,
} from './UnitsManagement.config'
import { notifications } from '@mantine/notifications'
import { LayoutSkeleton } from '@shared/components/skeletons/Layout.skeleton'
import { PageWrapper } from '@shared/styles/PageWrapper'
import { useNavigate } from 'react-router-dom'
import {
  getCurrentUserProfile,
  getCurrentUserRoleId,
} from '@shared/utils/authUtils'
import { deleteUnit } from './data/units.queries'
import { Role } from '@shared/constants/roles'

const Units = () => {
  const theme = useMantineTheme() // ✅ Add theme hook
  const [units, setUnits] = useState<UnitWithRelations[]>([])
  const [loading, setLoading] = useState(false) // ✅ For table operations only
  const [initializing, setInitializing] = useState(true) // ✅ For initial load only
  const [isFetching, setIsFetching] = useState(false) // ✅ Prevent duplicate requests
  const isFirstRender = useRef(true)

  const [companyId, setCompanyId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    base: 0,
    derived: 0,
    compound: 0,
    system: 0,
    company: 0,
  })

  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(8)
  const [totalCount, setTotalCount] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'active' | 'inactive'
  >('all')
  const [typeFilter, setTypeFilter] = useState<
    'base' | 'derived' | 'compound' | 'all'
  >('all')
  const [scopeFilter, setScopeFilter] = useState<'all' | 'system' | 'company'>(
    'all',
  )

  const dispatch = useDispatch<AppDispatch>()
  const navigate = useNavigate()

  // ============================================================================
  // STEP 1: Initialize company data (runs once on mount)
  // ============================================================================
  useEffect(() => {
    const initializeCompanyData = async () => {
      try {
        console.log('🎬 [Initial Load] Starting company initialization...')
        setInitializing(true)
        setError(null)

        const user = await getCurrentUserProfile()

        if (!user?.company_id) {
          setError(
            'User not associated with a company. Please contact support.',
          )
          setInitializing(false)
          return
        }

        console.log('✅ Company ID:', user.company_id)
        setCompanyId(user.company_id)

        // Don't set initializing to false yet - let fetchAllData do it
      } catch (error: any) {
        console.error('❌ Error initializing company data:', error)
        setError('Failed to load company data. Please refresh the page.')
        setInitializing(false)
      }
    }

    initializeCompanyData()
  }, [])

  // ============================================================================
  // FETCH FUNCTIONS
  // ============================================================================

  // ✅ Fetch only units (for filters/pagination changes)
  const fetchUnits = useCallback(async () => {
    if (!companyId || isFetching) {
      console.log(
        '⏭️ [fetchUnits] Skipping - companyId:',
        companyId,
        'isFetching:',
        isFetching,
      )
      return
    }

    try {
      setIsFetching(true)
      setLoading(true) // ✅ Show table loading only
      setError(null)

      console.log('🔄 [fetchUnits] Fetching units with params:', {
        page: currentPage,
        pageSize,
        searchQuery,
        status: statusFilter,
        type: typeFilter,
        companyId,
      })

      const unitsResult = await fetchUnitsData({
        page: currentPage,
        pageSize,
        searchQuery,
        status: statusFilter,
        type: typeFilter,
        scope: scopeFilter,
        companyId,
      })

      console.log('✅ [fetchUnits] Fetched:', {
        count: unitsResult.unitsData.length,
        totalCount: unitsResult.totalCount,
      })

      setUnits(unitsResult.unitsData)
      setTotalCount(unitsResult.totalCount)
    } catch (err: any) {
      console.error('❌ [fetchUnits] Error:', err)
      setError(err.message || 'Failed to load units. Please try again.')
      setUnits([])
      setTotalCount(0)
    } finally {
      setLoading(false) // ✅ Hide table loading
      setIsFetching(false)
    }
  }, [
    companyId,
    currentPage,
    pageSize,
    searchQuery,
    statusFilter,
    typeFilter,
    isFetching,
  ])

  // ✅ Fetch all data (for refresh and initial load)
  const fetchAllData = useCallback(async () => {
    if (!companyId || isFetching) {
      console.log(
        '⏭️ [fetchAllData] Skipping - companyId:',
        companyId,
        'isFetching:',
        isFetching,
      )
      return
    }

    try {
      setIsFetching(true)
      setLoading(true) // ✅ Show table loading
      setError(null)

      console.log('🔄 [fetchAllData] Fetching ALL data...')

      const [statsData, unitsResult] = await Promise.all([
        fetchUnitStats(companyId),
        fetchUnitsData({
          page: currentPage,
          pageSize,
          searchQuery,
          status: statusFilter,
          type: typeFilter,
          scope: scopeFilter,
          companyId,
        }),
      ])

      console.log('✅ [fetchAllData] All data fetched successfully', {
        stats: statsData,
        units: unitsResult.unitsData.length,
        totalCount: unitsResult.totalCount,
      })

      setStats({
        total: statsData.total,
        active: statsData.active,
        base: statsData.base,
        derived: statsData.derived,
        compound: statsData.compound,
        system: statsData.system,
        company: statsData.company,
      })
      setUnits(unitsResult.unitsData)
      setTotalCount(unitsResult.totalCount)
    } catch (err: any) {
      console.error('❌ [fetchAllData] Error:', err)
      setError(err.message || 'Failed to load data. Please try again.')
    } finally {
      setLoading(false) // ✅ Hide table loading
      setIsFetching(false)
    }
  }, [
    companyId,
    currentPage,
    pageSize,
    searchQuery,
    statusFilter,
    typeFilter,
    isFetching,
  ])

  // ============================================================================
  // STEP 2: Initial data fetch (runs once after company ID is set)
  // ============================================================================
  useEffect(() => {
    if (companyId && initializing) {
      console.log('🎬 [Initial Load] Loading units...')
      fetchAllData().then(() => {
        setInitializing(false) // ✅ Hide full skeleton
        isFirstRender.current = false
        console.log('✅ [Initial Load] Complete')
      })
    }
  }, [companyId, initializing])

  // ============================================================================
  // STEP 3: Listen for unit updates
  // ============================================================================
  useEffect(() => {
    let timeoutId: NodeJS.Timeout

    const handleUnitUpdate = () => {
      if (!initializing && !isFetching && companyId) {
        console.log('🔔 [Event] unitUpdated received')
        clearTimeout(timeoutId)
        timeoutId = setTimeout(() => {
          console.log('🔄 [Event] Refreshing data...')
          fetchAllData()
        }, 300)
      }
    }

    window.addEventListener('unitUpdated', handleUnitUpdate)
    return () => {
      clearTimeout(timeoutId)
      window.removeEventListener('unitUpdated', handleUnitUpdate)
    }
  }, [initializing, isFetching, companyId, fetchAllData])

  // ============================================================================
  // STEP 4: Handle filter/pagination changes
  // ============================================================================
  useEffect(() => {
    // Skip on first render
    if (isFirstRender.current) {
      return
    }

    // Only fetch if not initializing and not already fetching
    if (!initializing && !isFetching && companyId) {
      console.log('🔍 [Filters] Change detected, fetching units...')
      const timeoutId = setTimeout(() => {
        fetchUnits()
      }, 300)
      return () => clearTimeout(timeoutId)
    }
  }, [currentPage, pageSize, searchQuery, statusFilter, typeFilter])

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

  const handleDelete = useCallback(
    async (row: UnitWithRelations): Promise<void> => {
      const userRoleId = await getCurrentUserRoleId()
      if (userRoleId !== Role.company_admin) {
        notifications.show({
          title: 'Permission Denied',
          message: 'You do not have permission to delete units.',
          color: 'red',
        })
        return
      }

      const confirmDelete = window.confirm(
        `Are you sure you want to delete "${row.name}"?`,
      )
      if (!confirmDelete) return

      try {
        setLoading(true)
        const { error } = await deleteUnit(row.id)
        if (error) throw error

        await fetchAllData()

        notifications.show({
          title: 'Success',
          message: `Unit "${row.name}" deleted successfully`,
          color: 'green',
        })
      } catch (error: any) {
        console.error('❌ Error deleting unit:', error)
        notifications.show({
          title: 'Error',
          message: error.message || 'Failed to delete unit',
          color: 'red',
        })
        setLoading(false)
      }
    },
    [fetchAllData],
  )

  const handleFilterChange = useCallback((value: string) => {
    console.log('🔍 Status filter changed:', value)
    setStatusFilter(value as 'all' | 'active' | 'inactive')
    setCurrentPage(1)
  }, [])

  const handleTypeFilterChange = useCallback((value: string) => {
    console.log('🔍 Type filter changed:', value)
    setTypeFilter(value as 'base' | 'derived' | 'compound' | 'all')
    setCurrentPage(1)
  }, [])

  const handleScopeFilterChange = useCallback((value: string) => {
    console.log('🔍 Scope filter changed:', value)
    setScopeFilter(value as 'all' | 'system' | 'company')
    setCurrentPage(1)
  }, [])

  // ============================================================================
  // CONFIG - Pass theme to config functions
  // ============================================================================
  const columns = useMemo(() => getUnitColumns(theme), [theme])

  const filters = useMemo(
    () =>
      getUnitFilters({
        onStatusChange: handleFilterChange,
        onTypeChange: handleTypeFilterChange,
        onScopeChange: handleScopeFilterChange,
        currentStatusFilter: statusFilter,
        currentTypeFilter: typeFilter,
        currentScopeFilter: scopeFilter,
      }),
    [
      handleFilterChange,
      handleTypeFilterChange,
      handleScopeFilterChange,
      statusFilter,
      typeFilter,
      scopeFilter,
    ],
  )

  const statisticsData = useMemo(
    () => getStatisticsCardsData(stats, theme),
    [stats, theme],
  )

  const headerActions = useMemo(
    () =>
      getUnitHeaderActions({
        onExportPDF: () => handleExportPDF(columns, units),
        onExportExcel: () => handleExportExcel(columns, units),
        onRefresh: handleRefreshClick,
      }),
    [columns, units, handleRefreshClick],
  )

  const primaryAction = useMemo(
    () => getUnitPrimaryAction(() => handleAddUnit(dispatch)),
    [dispatch],
  )

  const rowActions = useMemo(
    () =>
      getUnitRowActions({
        onView: (row) => handleView(row, dispatch, navigate),
        onEdit: (row) => handleEdit(row, dispatch),
        onDelete: handleDelete,
      }),
    [dispatch, navigate, handleDelete],
  )

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
  // RENDER: Show error if initialization failed
  // ============================================================================
  if (error && !companyId) {
    return (
      <PageWrapper>
        <Container
          size="xxl"
          px={0}
        >
          <PageHeader
            title="Unit Management"
            description="Manage measurement units for your products"
            actions={headerActions}
            primaryAction={primaryAction}
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
  // Table's loading prop controls its internal loading state
  // ============================================================================
  return (
    <PageWrapper>
      <Container
        size="xxl"
        px={0}
      >
        <PageHeader
          title="Unit Management"
          description="Manage measurement units for your products"
          actions={headerActions}
          primaryAction={primaryAction}
        />

        {error && (
          <Alert
            icon={<IconAlertCircle size={16} />}
            title="Error Loading Units"
            color="red"
            mb="lg"
            withCloseButton
            onClose={() => setError(null)}
          >
            {error}
          </Alert>
        )}

        <StatisticsCard stats={statisticsData} />

        <ContentTable
          columns={columns}
          data={units}
          loading={loading} // ✅ This shows TableContentSkeleton on filter changes
          searchPlaceholder="Search by unit name, code, or type..."
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
          selectable={true}
          onRowClick={(row) => handleView(row, dispatch, navigate)}
        />
      </Container>
    </PageWrapper>
  )
}

export default Units

