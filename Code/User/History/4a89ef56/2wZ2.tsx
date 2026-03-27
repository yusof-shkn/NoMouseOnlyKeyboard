// CustomersManagement.tsx
// ✅ FULLY THEMED: Passes theme + colorScheme to all config functions

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
  Container,
  Alert,
  useMantineTheme,
  useMantineColorScheme,
} from '@mantine/core'
import { AppDispatch } from '@app/core/store/store'
import { useDebouncedCallback } from '@mantine/hooks'
import { IconAlertCircle } from '@tabler/icons-react'
import PageHeader from '@shared/components/tableHeader/TableHeader'
import ContentTable from '@shared/components/tableContent/TableContent'
import StatisticsCard from '../../../../shared/components/statistics/StatisticsCard'
import { CustomerWithRelations } from '@shared/types/customer'
import {
  fetchCustomersData,
  fetchCustomerStats,
  CustomerStatsResponse,
} from './utils/customersManagement.utils'
import {
  handleAddCustomer,
  handleExportPDF,
  handleExportExcel,
  handleView,
  handleEdit,
  handlePayCredit,
} from './handlers/customersManagement.handlers'
import {
  getCustomerColumns,
  getCustomerHeaderActions,
  getCustomerPrimaryAction,
  getCustomerRowActions,
  getCustomerFilters,
  getStatisticsCardsData,
} from './CustomersManagement.config'
import { notifications } from '@mantine/notifications'
import { LayoutSkeleton } from '@shared/components/skeletons/Layout.skeleton'
import { PageWrapper } from '@shared/styles/PageWrapper'
import { useNavigate } from 'react-router-dom'
import { getCurrentUserRoleId } from '@shared/utils/authUtils'
import { deleteCustomer } from './data/customers.queries'
import { Role } from '@shared/constants/roles'
import {
  selectCompanySettings,
  selectCompanyId,
  selectDefaultCurrency,
} from '@features/authentication/authSlice'

const Customers = () => {
  const theme = useMantineTheme()
  const { colorScheme } = useMantineColorScheme()
  const resolvedScheme = colorScheme === 'auto' ? 'light' : colorScheme

  const [customers, setCustomers] = useState<CustomerWithRelations[]>([])
  const [loading, setLoading] = useState(false)
  const [initializing, setInitializing] = useState(true)
  const [isFetching, setIsFetching] = useState(false)
  const isFirstRender = useRef(true)

  const [error, setError] = useState<string | null>(null)

  const [stats, setStats] = useState<CustomerStatsResponse>({
    total: 0,
    active: 0,
    withCredit: 0,
  })

  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [totalCount, setTotalCount] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'active' | 'inactive'
  >('all')
  const [creditFilter, setCreditFilter] = useState<
    'all' | 'with_credit' | 'no_credit' | 'has_balance'
  >('all')
  const [typeFilter, setTypeFilter] = useState<'all' | 'patient' | 'business'>(
    'all',
  )

  const dispatch = useDispatch<AppDispatch>()
  const navigate = useNavigate()
  const companySettings = useSelector(selectCompanySettings)
  const currency = useSelector(selectDefaultCurrency)
  // where setCompanyId + setInitializing(false) fire together making initializing=false
  // before the fetchAllData effect ever sees companyId && initializing both true.
  const reduxCompanyId = useSelector(selectCompanyId)
  const companyId = reduxCompanyId ? Number(reduxCompanyId) : null

  const fetchCustomersOnly = useCallback(async () => {
    if (!companyId || isFetching) return
    try {
      setIsFetching(true)
      setLoading(true)
      setError(null)
      const customersResult = await fetchCustomersData({
        page: currentPage,
        pageSize,
        searchQuery,
        status: statusFilter,
        creditStatus: creditFilter,
        customerType: typeFilter,
        companyId,
      })
      setCustomers(customersResult.customersData)
      setTotalCount(customersResult.totalCount)
    } catch (err: any) {
      setError('Failed to load customers. Please try again.')
      setCustomers([])
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
    creditFilter,
    typeFilter,
    companyId,
    isFetching,
  ])

  const fetchAllData = useCallback(async () => {
    if (!companyId || isFetching) return
    try {
      setIsFetching(true)
      setLoading(true)
      setError(null)
      const [statsData, customersResult] = await Promise.all([
        fetchCustomerStats(companyId),
        fetchCustomersData({
          page: currentPage,
          pageSize,
          searchQuery,
          status: statusFilter,
          creditStatus: creditFilter,
          customerType: typeFilter,
          companyId,
        }),
      ])
      setStats(statsData)
      setCustomers(customersResult.customersData)
      setTotalCount(customersResult.totalCount)
    } catch (err: any) {
      setError(err.message || 'Failed to load data. Please try again.')
      setStats({ total: 0, active: 0, withCredit: 0 })
      setCustomers([])
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
    creditFilter,
    typeFilter,
    companyId,
    isFetching,
  ])

  // Trigger initial load when companyId first becomes available from Redux
  const hasLoadedRef = useRef(false)
  useEffect(() => {
    if (companyId && !hasLoadedRef.current) {
      hasLoadedRef.current = true
      fetchAllData().then(() => {
        setInitializing(false)
        isFirstRender.current = false
      })
    } else if (!companyId && !hasLoadedRef.current) {
      // Redux not ready yet — keep showing skeleton
    }
  }, [companyId, fetchAllData])

  useEffect(() => {
    let timeoutId: NodeJS.Timeout
    const handleCustomerUpdate = () => {
      if (!initializing && !isFetching && companyId) {
        clearTimeout(timeoutId)
        timeoutId = setTimeout(() => {
          fetchAllData()
        }, 300)
      }
    }
    window.addEventListener('customerUpdated', handleCustomerUpdate)
    return () => {
      clearTimeout(timeoutId)
      window.removeEventListener('customerUpdated', handleCustomerUpdate)
    }
  }, [initializing, isFetching, companyId, fetchAllData])

  useEffect(() => {
    if (isFirstRender.current) return
    if (!initializing && !isFetching && companyId) {
      const timeoutId = setTimeout(() => {
        fetchCustomersOnly()
      }, 300)
      return () => clearTimeout(timeoutId)
    }
  }, [
    currentPage,
    pageSize,
    searchQuery,
    statusFilter,
    creditFilter,
    typeFilter,
  ])

  const debouncedSearch = useDebouncedCallback((query: string) => {
    setSearchQuery(query)
    setCurrentPage(1)
  }, 400)

  const handleFilterChange = useCallback((value: string) => {
    setStatusFilter(value as 'all' | 'active' | 'inactive')
    setCurrentPage(1)
  }, [])

  const handleCreditFilterChange = useCallback((value: string) => {
    setCreditFilter(
      value as 'all' | 'with_credit' | 'no_credit' | 'has_balance',
    )
    setCurrentPage(1)
  }, [])

  const handleTypeFilterChange = useCallback((value: string) => {
    setTypeFilter(value as 'all' | 'patient' | 'business')
    setCurrentPage(1)
  }, [])

  const handleRefreshClick = useCallback(async () => {
    try {
      await fetchAllData()
      notifications.show({
        title: 'Refreshed',
        message: 'Data refreshed successfully',
        color: theme.primaryColor,
      })
    } catch (error: any) {
      notifications.show({
        title: 'Refresh Failed',
        message: error.message || 'Failed to refresh data',
        color: 'red',
      })
    }
  }, [fetchAllData, theme.primaryColor])

  const handleDeleteCustomer = useCallback(
    async (row: CustomerWithRelations): Promise<void> => {
      const userRoleId = await getCurrentUserRoleId()
      if (userRoleId !== Role.company_admin) {
        notifications.show({
          title: 'Permission Denied',
          message: 'You do not have permission to delete customers.',
          color: 'red',
        })
        return
      }
      const fullName = `${row.first_name} ${row.last_name}`
      const confirmDelete = window.confirm(
        `Are you sure you want to delete "${fullName}"?`,
      )
      if (!confirmDelete) return
      try {
        setLoading(true)
        const { error: deleteError } = await deleteCustomer(row.id)
        if (deleteError) throw deleteError
        await fetchAllData()
        notifications.show({
          title: 'Success',
          message: `Customer "${fullName}" deleted successfully`,
          color: 'green',
        })
      } catch (error: any) {
        notifications.show({
          title: 'Error',
          message: error.message || 'Failed to delete customer',
          color: 'red',
        })
        setLoading(false)
      }
    },
    [fetchAllData],
  )

  // ============================================================================
  // CONFIG — pass theme + colorScheme
  // ============================================================================

  const columns = useMemo(
    () => getCustomerColumns(theme, resolvedScheme),
    [theme, resolvedScheme],
  )

  const filters = useMemo(
    () =>
      getCustomerFilters(
        handleFilterChange,
        handleCreditFilterChange,
        handleTypeFilterChange,
      ),
    [handleFilterChange, handleCreditFilterChange, handleTypeFilterChange],
  )

  const statisticsData = useMemo(
    () => getStatisticsCardsData(stats, theme, currency),
    [stats, theme],
  )

  const headerActions = useMemo(
    () =>
      getCustomerHeaderActions({
        onExportPDF: () => handleExportPDF(columns, customers, companySettings),
        onExportExcel: () =>
          handleExportExcel(columns, customers, companySettings),
        onRefresh: handleRefreshClick,
      }),
    [columns, customers, companySettings, handleRefreshClick],
  )

  const primaryAction = useMemo(
    () => getCustomerPrimaryAction(() => handleAddCustomer(dispatch)),
    [dispatch],
  )

  const rowActions = useMemo(
    () =>
      getCustomerRowActions({
        onView: (row) => handleView(row, dispatch, navigate),
        onEdit: (row) => handleEdit(row, dispatch),
        onPayCredit: (row) => handlePayCredit(row, dispatch),
        onDelete: handleDeleteCustomer,
      }),
    [dispatch, navigate, handleDeleteCustomer, companySettings],
  )

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
            title="Customer Management"
            description="Manage your customers and their credit accounts"
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

  return (
    <PageWrapper>
      <Container
        size="xxl"
        px={0}
      >
        <PageHeader
          title="Customer Management"
          description="Manage your customers and their credit accounts"
          actions={headerActions}
          primaryAction={primaryAction}
        />

        {error && (
          <Alert
            icon={<IconAlertCircle size={16} />}
            title="Error Loading Customers"
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
          data={customers}
          loading={loading}
          searchPlaceholder="Search by name, phone, email, or address..."
          filters={filters}
          rowActions={rowActions}
          onSearch={debouncedSearch}
          pagination={true}
          totalCount={totalCount}
          currentPage={currentPage}
          pageSize={pageSize}
          onPageChange={(page) => {
            setCurrentPage(page)
          }}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize)
            setCurrentPage(1)
          }}
          selectable={true}
          onRowClick={(row) => handleView(row, dispatch, navigate)}
        />
      </Container>
    </PageWrapper>
  )
}

export default Customers

