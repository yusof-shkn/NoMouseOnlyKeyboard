// src/features/main/SuppliersManagement/SuppliersManagement.tsx - ENHANCED with Theme & Dark Mode
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
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
import StatisticsCard from '../../../../shared/components/statistics/StatisticsCard'
import { SupplierWithRelations } from '@shared/types/suppliers'
import {
  fetchSuppliersData,
  fetchSupplierStats,
} from './utils/suppliersManagement.utils'
import {
  handleAddSupplier,
  handleExportPDF,
  handleExportExcel,
  handleView,
  handleEdit,
} from './handlers/suppliersManagement.handlers'
import {
  getSupplierColumns,
  getSupplierHeaderActions,
  getSupplierPrimaryAction,
  getSupplierRowActions,
  getSupplierFilters,
  getStatisticsCardsData,
} from './SuppliersManagement.config'
import { notifications } from '@mantine/notifications'
import { LayoutSkeleton } from '@shared/components/skeletons/Layout.skeleton'
import { PageWrapper } from '@shared/styles/PageWrapper'
import { useNavigate } from 'react-router-dom'
import { getCurrentUserProfile } from '@shared/utils/authUtils'
import { deleteSupplier } from './data/suppliers.queries'
import { getCurrentUserRoleId } from '@shared/utils/authUtils'
import { Role } from '@shared/constants/roles'
import { selectDefaultCurrency } from '@features/authentication/authSlice'

const Suppliers = () => {
  const theme = useMantineTheme()
  const { colorScheme } = useMantineColorScheme()
  const isDark = colorScheme === 'dark'

  const [suppliers, setSuppliers] = useState<SupplierWithRelations[]>([])
  const [loading, setLoading] = useState(false)
  const [initializing, setInitializing] = useState(true)
  const [isFetching, setIsFetching] = useState(false)
  const isFirstRender = useRef(true)

  const [error, setError] = useState<string | null>(null)
  const [companyId, setCompanyId] = useState<number | null>(null)

  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    withBalance: 0,
  })

  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(8)
  const [totalCount, setTotalCount] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'active' | 'inactive'
  >('all')

  const dispatch = useDispatch<AppDispatch>()
  const navigate = useNavigate()

  const currency = useSelector(selectDefaultCurrency)

  // Initialize company ID
  useEffect(() => {
    const initializeCompany = async () => {
      try {
        console.log('🎬 [Initial Load] Starting company initialization...')
        setInitializing(true)
        setError(null)

        const user = await getCurrentUserProfile()

        if (!user?.company_id) {
          setError('User not associated with a company')
          setInitializing(false)
          return
        }

        console.log('✅ Company ID:', user.company_id)
        setCompanyId(user.company_id)
      } catch (error: any) {
        console.error('❌ Error getting company:', error)
        setError('Failed to load company information')
        setInitializing(false)
      }
    }

    initializeCompany()
  }, [])

  // Fetch only suppliers
  const fetchSuppliers = useCallback(async () => {
    if (!companyId || isFetching) {
      console.log(
        '⏭️ [fetchSuppliers] Skipping - companyId:',
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

      console.log('🔄 [fetchSuppliers] Fetching with params:', {
        page: currentPage,
        pageSize,
        searchQuery,
        status: statusFilter,
        companyId,
      })

      const suppliersResult = await fetchSuppliersData({
        page: currentPage,
        pageSize,
        searchQuery,
        status: statusFilter,
        companyId,
      })

      console.log('✅ [fetchSuppliers] Fetched:', {
        count: suppliersResult.suppliersData.length,
        totalCount: suppliersResult.totalCount,
      })

      setSuppliers(suppliersResult.suppliersData)
      setTotalCount(suppliersResult.totalCount)
    } catch (err: any) {
      console.error('❌ Error fetching suppliers:', err)
      setError(err.message || 'Failed to load suppliers')
      setSuppliers([])
      setTotalCount(0)
    } finally {
      setLoading(false)
      setIsFetching(false)
    }
  }, [companyId, currentPage, pageSize, searchQuery, statusFilter, isFetching])

  // Fetch all data
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

      const [statsData, suppliersResult] = await Promise.all([
        fetchSupplierStats(companyId),
        fetchSuppliersData({
          page: currentPage,
          pageSize,
          searchQuery,
          status: statusFilter,
          companyId,
        }),
      ])

      console.log('✅ [fetchAllData] All data fetched successfully')

      setStats(statsData)
      setSuppliers(suppliersResult.suppliersData)
      setTotalCount(suppliersResult.totalCount)
    } catch (err: any) {
      console.error('❌ Error fetching all data:', err)
      setError(err.message || 'Failed to load suppliers')
    } finally {
      setLoading(false)
      setIsFetching(false)
    }
  }, [companyId, currentPage, pageSize, searchQuery, statusFilter, isFetching])

  // Initial data fetch
  useEffect(() => {
    if (companyId && initializing) {
      console.log('🎬 [Initial Load] Loading suppliers...')
      fetchAllData().then(() => {
        setInitializing(false)
        isFirstRender.current = false
        console.log('✅ [Initial Load] Complete')
      })
    }
  }, [companyId, initializing])

  // Listen for supplier updates
  useEffect(() => {
    let timeoutId: NodeJS.Timeout

    const handleSupplierUpdate = () => {
      if (!initializing && !isFetching && companyId) {
        console.log('🔔 [Event] supplierUpdated received')
        clearTimeout(timeoutId)
        timeoutId = setTimeout(() => {
          console.log('🔄 [Event] Refreshing data...')
          fetchAllData()
        }, 300)
      }
    }

    window.addEventListener('supplierUpdated', handleSupplierUpdate)
    return () => {
      clearTimeout(timeoutId)
      window.removeEventListener('supplierUpdated', handleSupplierUpdate)
    }
  }, [initializing, isFetching, companyId, fetchAllData])

  // Handle filter/pagination changes
  useEffect(() => {
    if (isFirstRender.current) {
      return
    }

    if (!initializing && !isFetching && companyId) {
      console.log('🔍 [Filters] Change detected, fetching suppliers...')
      const timeoutId = setTimeout(() => {
        fetchSuppliers()
      }, 300)
      return () => clearTimeout(timeoutId)
    }
  }, [currentPage, pageSize, searchQuery, statusFilter])

  // Handlers
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
        color: theme.primaryColor,
      })
    } catch (error: any) {
      console.error('❌ [Refresh] Error:', error)
      notifications.show({
        title: 'Refresh Failed',
        message: error.message || 'Failed to refresh data',
        color: 'red',
      })
    }
  }, [fetchAllData, theme.primaryColor])

  const handleDeleteSupplier = useCallback(
    async (row: SupplierWithRelations): Promise<void> => {
      const userRoleId = await getCurrentUserRoleId()
      if (userRoleId !== Role.company_admin) {
        notifications.show({
          title: 'Permission Denied',
          message: 'You do not have permission to delete suppliers.',
          color: 'red',
        })
        return
      }

      const confirmDelete = window.confirm(
        `Are you sure you want to delete "${row.supplier_name}"?`,
      )
      if (!confirmDelete) return

      try {
        setLoading(true)
        const { error } = await deleteSupplier(row.id)
        if (error) throw error

        await fetchAllData()

        notifications.show({
          title: 'Success',
          message: `Supplier "${row.supplier_name}" deleted successfully`,
          color: 'green',
        })
      } catch (error: any) {
        console.error('Error deleting supplier:', error)
        notifications.show({
          title: 'Error',
          message: error.message || 'Failed to delete supplier',
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

  const headerActions = useMemo(
    () =>
      getSupplierHeaderActions({
        onExportPDF: () => handleExportPDF(columns, suppliers),
        onExportExcel: () => handleExportExcel(columns, suppliers),
        onRefresh: handleRefreshClick,
      }),
    [columns, suppliers, handleRefreshClick],
  )

  const primaryAction = useMemo(
    () => getSupplierPrimaryAction(() => handleAddSupplier(dispatch)),
    [dispatch],
  )

  const rowActions = useMemo(
    () =>
      getSupplierRowActions({
        onView: (row) => handleView(row, dispatch, navigate),
        onEdit: (row) => handleEdit(row, dispatch),
        onDelete: handleDeleteSupplier,
      }),
    [dispatch, navigate, handleDeleteSupplier],
  )

  // Render: Show full skeleton during initial load
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

  // Render: Show error if initialization failed
  if (error && !companyId) {
    return (
      <PageWrapper>
        <Container
          size="xxl"
          px={0}
        >
          <PageHeader
            title="Supplier Management"
            description="Manage your suppliers"
            actions={headerActions}
            primaryAction={primaryAction}
          />
          <Alert
            icon={<IconAlertCircle size={16} />}
            title="Error Loading Data"
            color="red"
            mt="md"
            radius="md"
          >
            {error}
          </Alert>
        </Container>
      </PageWrapper>
    )
  }

  // Render: Normal view
  return (
    <PageWrapper>
      <Container
        size="xxl"
        px={0}
      >
        <PageHeader
          title="Supplier Management"
          description="Manage your suppliers and vendor relationships"
          actions={headerActions}
          primaryAction={primaryAction}
        />

        {error && (
          <Alert
            icon={<IconAlertCircle size={16} />}
            title="Error Loading Suppliers"
            color="red"
            mb="lg"
            withCloseButton
            onClose={() => setError(null)}
            radius="md"
            styles={{
              root: {
                backgroundColor: isDark
                  ? theme.colors.dark[6]
                  : theme.colors.red[0],
              },
            }}
          >
            {error}
          </Alert>
        )}

        <StatisticsCard stats={statisticsData} />

        <ContentTable
          columns={columns}
          data={suppliers}
          loading={loading}
          searchPlaceholder="Search by supplier name, code, contact person, or phone..."
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
        />
      </Container>
    </PageWrapper>
  )
}

export default Suppliers

