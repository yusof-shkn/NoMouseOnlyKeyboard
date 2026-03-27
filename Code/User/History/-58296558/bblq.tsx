// ============================================================================
// Areas.tsx - Enhanced with Mantine Theme
// ============================================================================

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Container, Alert, useMantineTheme } from '@mantine/core'
import { useDispatch, useSelector } from 'react-redux'
import { AppDispatch, RootState } from '@app/core/store/store'
import { useDebouncedCallback } from '@mantine/hooks'
import { IconAlertCircle } from '@tabler/icons-react'
import PageHeader from '@shared/components/tableHeader/TableHeader'
import ContentTable from '@shared/components/tableContent/TableContent'
import StatisticsCard from '@shared/components/statistics/StatisticsCard'
import { Area } from '@shared/types/area'
import {
  selectCurrentUser,
  selectIsAuthenticated,
} from '@features/authentication/authSlice'
import { fetchAreasData, fetchAreaStats } from './utils/areasManagement.utils'
import {
  handleAddArea,
  handleExportPDF,
  handleExportExcel,
  handleView,
  handleEdit,
  handleViewStaff,
  handleViewStores,
} from './handlers/areasManagement.handlers'
import {
  getAreaColumns,
  getAreaHeaderActions,
  getAreaPrimaryAction,
  getAreaRowActions,
  getAreaFilters,
  getStatisticsCardsData,
} from './AreasManagement.config'
import { clearSelection, selectArea } from '@features/main/main.slice'
import { LayoutSkeleton } from '@shared/components/skeletons/Layout.skeleton'
import { PageWrapper } from '@shared/styles/PageWrapper'
import { Profile } from '@shared/types/profile'
import { Store } from '@shared/types/Store'
import { notifications } from '@mantine/notifications'
import { deleteArea } from './data/areas.queries'
import { getCurrentUserRoleId } from '@shared/utils/authUtils'
import { Role } from '@shared/constants/roles'
import { useNavigate } from 'react-router-dom'

const Areas = () => {
  const theme = useMantineTheme()

  const [areas, setAreas] = useState<Area[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [stores, setStores] = useState<Store[]>([])
  const [loading, setLoading] = useState(false)
  const [initializing, setInitializing] = useState(true)
  const [isFetching, setIsFetching] = useState(false)
  const isFirstRender = useRef(true)

  const [error, setError] = useState<string | null>(null)

  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    totalAdmins: 0,
    totalStores: 0,
  })

  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(8)
  const [totalCount, setTotalCount] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [regionFilter, setRegionFilter] = useState('all')
  const [adminAssignmentFilter, setAdminAssignmentFilter] = useState('all')
  const [storeCountFilter, setStoreCountFilter] = useState('all')

  const [uniqueRegions, setUniqueRegions] = useState<string[]>([])

  const selectedArea = useSelector(
    (state: RootState) => state.areaStore.selectedArea,
  )
  const dispatch = useDispatch<AppDispatch>()
  const navigate = useNavigate()

  const currentUser = useSelector(selectCurrentUser)
  const isAuthenticated = useSelector(selectIsAuthenticated)

  const companyId = currentUser?.profile.company_id

  // ============================================================================
  // STEP 1: Initialize company data (runs once on mount)
  // ============================================================================
  useEffect(() => {
    const initializeCompanyData = async () => {
      try {
        console.log('🎬 [Initial Load] Checking company authentication...')
        setInitializing(true)
        setError(null)

        if (!isAuthenticated) {
          setError('Please log in to access areas management.')
          setInitializing(false)
          return
        }

        if (!companyId) {
          setError('Company ID not found. Please ensure you are logged in.')
          setInitializing(false)
          return
        }

        console.log('✅ Company ID:', companyId)
      } catch (error) {
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

  const fetchAreas = useCallback(async () => {
    if (!companyId || isFetching) {
      console.log(
        '⏭️ [fetchAreas] Skipping - companyId:',
        companyId,
        'isFetching:',
        isFetching,
      )
      return
    }

    try {
      setIsFetching(true)
      setLoading(true)
      setError(null)

      console.log('🔄 [fetchAreas] Fetching with params:', {
        page: currentPage,
        pageSize,
        searchQuery,
        status: statusFilter,
        region: regionFilter,
        adminAssignment: adminAssignmentFilter,
        storeCount: storeCountFilter,
      })

      const areasResult = await fetchAreasData({
        companyId,
        page: currentPage,
        pageSize,
        searchQuery,
        status: statusFilter,
        region: regionFilter !== 'all' ? regionFilter : undefined,

        hasAdmin:
          adminAssignmentFilter === 'with_admin'
            ? true
            : adminAssignmentFilter === 'without_admin'
              ? false
              : undefined,
        storeCountRange:
          storeCountFilter !== 'all' ? storeCountFilter : undefined,
      })

      console.log('✅ [fetchAreas] Fetched:', {
        count: areasResult.areasData.length,
        totalCount: areasResult.totalCount,
      })

      setAreas(areasResult.areasData)
      setProfiles(areasResult.profilesData)
      setStores(areasResult.storesData)
      setTotalCount(areasResult.totalCount)
    } catch (err) {
      console.error('❌ Error fetching areas:', err)
      setError('Failed to load areas. Please try again.')
      setAreas([])
      setProfiles([])
      setStores([])
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
    regionFilter,
    adminAssignmentFilter,
    storeCountFilter,
    companyId,
    isFetching,
  ])

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
      setLoading(true)
      setError(null)

      console.log('🔄 [fetchAllData] Fetching ALL data...')

      const [statsData, areasResult] = await Promise.all([
        fetchAreaStats(companyId),
        fetchAreasData({
          companyId,
          page: currentPage,
          pageSize,
          searchQuery,
          status: statusFilter,
          region: regionFilter !== 'all' ? regionFilter : undefined,
          hasAdmin:
            adminAssignmentFilter === 'with_admin'
              ? true
              : adminAssignmentFilter === 'without_admin'
                ? false
                : undefined,
          storeCountRange:
            storeCountFilter !== 'all' ? storeCountFilter : undefined,
        }),
      ])

      console.log('✅ [fetchAllData] All data fetched successfully')

      setStats(statsData)
      setAreas(areasResult.areasData)
      setProfiles(areasResult.profilesData)
      setStores(areasResult.storesData)
      setTotalCount(areasResult.totalCount)

      const regions = Array.from(
        new Set(
          areasResult.areasData
            .map((a) => a.region)
            .filter((r): r is string => !!r),
        ),
      )
      setUniqueRegions(regions)
    } catch (err) {
      console.error('❌ Error fetching all data:', err)
      setError('Failed to load data. Please try again.')
      setAreas([])
      setProfiles([])
      setStores([])
    } finally {
      setLoading(false)
      setIsFetching(false)
    }
  }, [
    currentPage,
    pageSize,
    searchQuery,
    statusFilter,
    regionFilter,
    adminAssignmentFilter,
    storeCountFilter,
    companyId,
    isFetching,
  ])

  // ============================================================================
  // STEP 2: Initial data fetch (runs once after company ID is set)
  // ============================================================================
  useEffect(() => {
    if (companyId && isAuthenticated && initializing) {
      console.log('🎬 [Initial Load] Loading areas data...')
      fetchAllData().then(() => {
        setInitializing(false)
        isFirstRender.current = false
        console.log('✅ [Initial Load] Complete')
      })
    }
  }, [companyId, isAuthenticated, initializing])

  // ============================================================================
  // STEP 3: Listen for area updates
  // ============================================================================
  useEffect(() => {
    let timeoutId: NodeJS.Timeout

    const handleAreaUpdate = () => {
      if (!initializing && !isFetching && companyId) {
        console.log('🔔 [Event] areaUpdated received')
        clearTimeout(timeoutId)
        timeoutId = setTimeout(() => {
          console.log('🔄 [Event] Refreshing data...')
          fetchAllData()
        }, 300)
      }
    }

    window.addEventListener('areaUpdated', handleAreaUpdate)
    return () => {
      clearTimeout(timeoutId)
      window.removeEventListener('areaUpdated', handleAreaUpdate)
    }
  }, [initializing, isFetching, companyId, fetchAllData])

  // ============================================================================
  // STEP 4: Handle filter/pagination changes
  // ============================================================================
  useEffect(() => {
    if (isFirstRender.current) {
      return
    }

    if (!initializing && !isFetching && companyId) {
      console.log('🔍 [Filters] Change detected, fetching areas...')
      const timeoutId = setTimeout(() => {
        fetchAreas()
      }, 300)
      return () => clearTimeout(timeoutId)
    }
  }, [
    currentPage,
    pageSize,
    searchQuery,
    statusFilter,
    regionFilter,
    adminAssignmentFilter,
    storeCountFilter,
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
        color: theme.colors.blue[6],
        autoClose: 3000,
      })
    } catch (error: any) {
      console.error('❌ [Refresh] Error:', error)
      notifications.show({
        title: 'Refresh Failed',
        message: error.message || 'Failed to refresh data',
        color: theme.colors.red[6],
        autoClose: 4000,
      })
    }
  }, [fetchAllData, theme])

  const handleDelete = useCallback(
    async (row: Area): Promise<void> => {
      const userRoleId = await getCurrentUserRoleId()
      if (userRoleId !== Role.company_admin) {
        notifications.show({
          title: 'Permission Denied',
          message: 'You do not have permission to delete areas.',
          color: theme.colors.red[6],
        })
        return
      }

      const confirmDelete = window.confirm(
        `Are you sure you want to delete "${row.area_name}"?`,
      )
      if (!confirmDelete) return

      try {
        setLoading(true)
        console.log('🗑️ [handleDelete] Deleting area:', row.id)
        const { error } = await deleteArea(row.id)
        if (error) throw new Error(error.message)

        await fetchAllData()

        notifications.show({
          title: 'Success',
          message: `Area "${row.area_name}" deleted successfully`,
          color: theme.colors.green[6],
        })
      } catch (error: any) {
        console.error('❌ [handleDelete] Error deleting area:', error)
        notifications.show({
          title: 'Error',
          message: error.message || 'Failed to delete area',
          color: theme.colors.red[6],
        })
        setLoading(false)
      }
    },
    [fetchAllData, theme],
  )

  const handleRowClick = useCallback(
    (row: Area) => {
      if (selectedArea && selectedArea.id === row.id) {
        dispatch(clearSelection())
        notifications.show({
          title: 'Area Unselected',
          message: `You have unselected: ${row.area_name}`,
          color: theme.colors.gray[6],
          autoClose: 2000,
        })
      } else {
        dispatch(selectArea(row))
        notifications.show({
          title: 'Area Selected',
          message: `You have selected: ${row.area_name}`,
          color: theme.primaryColor,
          autoClose: 2000,
        })
      }
    },
    [selectedArea, dispatch, theme],
  )

  // ============================================================================
  // CONFIG
  // ============================================================================
  const columns = useMemo(() => getAreaColumns(theme), [theme])

  const headerActions = useMemo(
    () =>
      getAreaHeaderActions({
        onExportPDF: () => handleExportPDF(columns, areas),
        onExportExcel: () => handleExportExcel(columns, areas),
        onRefresh: handleRefreshClick,
      }),
    [columns, areas, handleRefreshClick],
  )

  const primaryAction = useMemo(() => {
    return companyId
      ? getAreaPrimaryAction(() => {
          handleAddArea(dispatch, companyId)
        })
      : undefined
  }, [dispatch, companyId])

  const getRowActions = useCallback(
    (row: Area) => {
      return getAreaRowActions({
        onView: (clickedRow: Area) => {
          console.log('👁️ View clicked for:', clickedRow.area_name)
          handleView(clickedRow, dispatch)
        },
        onViewStaff: (clickedRow: Area) => {
          console.log('👥 View staff clicked for:', clickedRow.area_name)
          handleViewStaff(clickedRow, dispatch, navigate)
        },
        onViewStores: (clickedRow: Area) => {
          console.log('🏪 View stores clicked for:', clickedRow.area_name)
          handleViewStores(clickedRow, dispatch, navigate)
        },
        onEdit: (clickedRow: Area) => {
          console.log('✏️ Edit clicked for:', clickedRow.area_name)
          handleEdit(clickedRow, dispatch)
        },
        onDelete: (clickedRow: Area) => {
          console.log('🗑️ Delete clicked for:', clickedRow.area_name)
          handleDelete(clickedRow)
        },
      })
    },
    [dispatch, navigate, handleDelete],
  )

  const filters = useMemo(
    () =>
      getAreaFilters({
        onStatusChange: (value) => {
          console.log('🔍 Status filter changed:', value)
          setStatusFilter(value)
          setCurrentPage(1)
        },
        onRegionChange: (value) => {
          console.log('🔍 Region filter changed:', value)
          setRegionFilter(value)
          setCurrentPage(1)
        },
        onAdminAssignmentChange: (value) => {
          console.log('🔍 Admin assignment filter changed:', value)
          setAdminAssignmentFilter(value)
          setCurrentPage(1)
        },
        onStoreCountChange: (value) => {
          console.log('🔍 Store count filter changed:', value)
          setStoreCountFilter(value)
          setCurrentPage(1)
        },
        currentStatusFilter: statusFilter,
        currentRegionFilter: regionFilter,
        currentAdminAssignmentFilter: adminAssignmentFilter,
        currentStoreCountFilter: storeCountFilter,
        regions: uniqueRegions,
      }),
    [
      statusFilter,
      regionFilter,
      adminAssignmentFilter,
      storeCountFilter,
      uniqueRegions,
    ],
  )

  const statisticsData = useMemo(
    () => getStatisticsCardsData(stats, theme),
    [stats, theme],
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
            title="Areas Management"
            description="Manage geographic areas and their assignments"
            actions={headerActions}
          />
          <Alert
            icon={<IconAlertCircle size={16} />}
            title="Error Loading Data"
            color="red"
            mt="md"
            radius="md"
            variant="light"
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
          title="Areas Management"
          description="Manage geographic areas and their assignments"
          actions={headerActions}
          primaryAction={primaryAction}
        />
        <StatisticsCard stats={statisticsData} />
        <ContentTable
          columns={columns}
          data={areas}
          loading={loading}
          searchPlaceholder="Search areas by name, code, region..."
          filters={filters}
          rowActions={(row) => getRowActions(row)}
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
          onRowClick={handleRowClick}
          selectedRowId={selectedArea?.id}
          selectable={true}
        />
      </Container>
    </PageWrapper>
  )
}

export default Areas

