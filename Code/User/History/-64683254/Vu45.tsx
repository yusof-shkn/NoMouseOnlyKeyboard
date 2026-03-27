// PurchaseReturnManagement.tsx - ENHANCED with Theme & Dark Mode

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
import TableHeader from '@shared/components/tableHeader/TableHeader'
import ContentTable from '@shared/components/tableContent/TableContent'
import StatisticsCard from '@shared/components/statistics/StatisticsCard'
import {
  PurchaseReturn,
  PurchaseReturnStats,
} from './types/purchaseReturn.types'

import {
  fetchPurchaseReturnsData,
  fetchPurchaseReturnStats,
} from './utils/purchaseReturn.utils'

import {
  handleExportPDF,
  handleExportExcel,
  handleView,
  handleEdit,
  handleDelete,
  handleApprove,
  handleReject,
  handleCreate,
} from './handlers/purchaseReturn.handlers'

import {
  getPurchaseReturnColumns,
  getPurchaseReturnHeaderActions,
  getPurchaseReturnRowActions,
  getPurchaseReturnFilters,
  getStatisticsCardsData,
} from './PurchaseReturn.config'
import { LayoutSkeleton } from '@shared/components/skeletons/Layout.skeleton'
import { PageWrapper } from '@shared/styles/PageWrapper'

import {
  selectCompanySettings,
  selectDefaultCurrency,
  selectCompanyId,
} from '@features/authentication/authSlice'
import { selectIsUnlocked } from '@core/restrictedMode/Restrictedmode.slice'

const PurchaseReturnManagement = () => {
  const theme = useMantineTheme()
  const { colorScheme } = useMantineColorScheme()
  const isDark = colorScheme === 'dark'

  const companySettings = useSelector(selectCompanySettings)
  const defaultCurrency = useSelector(selectDefaultCurrency)
  const companyId = useSelector(selectCompanyId)
  const isUnlocked = useSelector(selectIsUnlocked)

  const [purchaseReturns, setPurchaseReturns] = useState<PurchaseReturn[]>([])
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [stores, setStores] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [initializing, setInitializing] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [stats, setStats] = useState<PurchaseReturnStats>({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    completed: 0,
    totalRefundAmount: 0,
    totalPaid: 0,
    totalDue: 0,
    unpaid: 0,
    partiallyPaid: 0,
    paid: 0,
    overdue: 0,
  })

  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [totalCount, setTotalCount] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('all')
  const [sortByFilter, setSortByFilter] = useState('recently_added')

  const dispatch = useDispatch<AppDispatch>()
  const isFirstRender = useRef(true)
  const fetchInProgress = useRef(false)

  const fetchPurchaseReturns = useCallback(async () => {
    if (!companyId) {
      console.log('⏭️ [fetchPurchaseReturns] Skipping - no companyId')
      return
    }

    if (fetchInProgress.current) {
      console.log('⏭️ [fetchPurchaseReturns] Already fetching, skipping...')
      return
    }

    try {
      fetchInProgress.current = true
      setLoading(true)
      setError(null)

      console.log('🔄 [fetchPurchaseReturns] Fetching with params:', {
        page: currentPage,
        pageSize,
        searchQuery,
        status: statusFilter,
        paymentStatus: paymentStatusFilter,
        sortBy: sortByFilter,
        companyId,
        isUnlocked,
      })

      const {
        purchaseReturnsData,
        suppliersData,
        storesData,
        totalCount: count,
      } = await fetchPurchaseReturnsData({
        page: currentPage,
        pageSize,
        searchQuery,
        status: statusFilter,
        paymentStatus: paymentStatusFilter,
        sortBy: sortByFilter,
        companyId,
        isUnlocked,
      })

      console.log('✅ [fetchPurchaseReturns] Fetched:', {
        count: purchaseReturnsData.length,
        totalCount: count,
      })

      setPurchaseReturns(purchaseReturnsData)
      setSuppliers(suppliersData)
      setStores(storesData)
      setTotalCount(count)
    } catch (err) {
      console.error('❌ Error fetching purchase returns:', err)
      setError('Failed to load purchase returns. Please try again.')
      setPurchaseReturns([])
      setSuppliers([])
      setStores([])
      setTotalCount(0)
    } finally {
      setLoading(false)
      fetchInProgress.current = false
    }
  }, [
    currentPage,
    pageSize,
    searchQuery,
    statusFilter,
    paymentStatusFilter,
    sortByFilter,
    companyId,
    isUnlocked,
  ])

  const fetchAllData = useCallback(async () => {
    if (!companyId) {
      console.log('⏭️ [fetchAllData] Skipping - no companyId')
      return
    }

    if (fetchInProgress.current) {
      console.log('⏭️ [fetchAllData] Already fetching, skipping...')
      return
    }

    try {
      fetchInProgress.current = true
      setLoading(true)
      setError(null)

      console.log('🔄 [fetchAllData] Fetching ALL data...')

      const [returnsData, statsData] = await Promise.all([
        fetchPurchaseReturnsData({
          page: currentPage,
          pageSize,
          searchQuery,
          status: statusFilter,
          paymentStatus: paymentStatusFilter,
          sortBy: sortByFilter,
          companyId,
        }),
        fetchPurchaseReturnStats(companyId),
      ])

      console.log('✅ [fetchAllData] All data fetched successfully', {
        stats: statsData,
        returns: returnsData.purchaseReturnsData.length,
        totalCount: returnsData.totalCount,
      })

      setPurchaseReturns(returnsData.purchaseReturnsData)
      setSuppliers(returnsData.suppliersData)
      setStores(returnsData.storesData)
      setStats(statsData)
      setTotalCount(returnsData.totalCount)
    } catch (err) {
      console.error('❌ Error fetching all data:', err)
      setError('Failed to load data. Please try again.')
    } finally {
      setLoading(false)
      fetchInProgress.current = false
    }
  }, [
    currentPage,
    pageSize,
    searchQuery,
    statusFilter,
    paymentStatusFilter,
    sortByFilter,
    companyId,
    isUnlocked,
  ])

  useEffect(() => {
    if (companyId && initializing) {
      console.log('🎬 [Initial Load] Loading purchase returns...')
      fetchAllData().finally(() => {
        setInitializing(false)
        isFirstRender.current = false
        console.log('✅ [Initial Load] Complete')
      })
    }
  }, [companyId])

  useEffect(() => {
    const pendingReturn = sessionStorage.getItem('pendingReturn')

    if (pendingReturn && !initializing && companyId && companySettings) {
      console.log('🔔 [Pending Return] Found pending return from PO module')
      handleCreate(companyId, companySettings, dispatch, stores[0]?.id)
    }
  }, [initializing, companyId, companySettings, stores, dispatch])

  useEffect(() => {
    let timeoutId: NodeJS.Timeout

    const handlePurchaseReturnUpdate = () => {
      if (!initializing && companyId && !fetchInProgress.current) {
        console.log('🔔 [Event] purchaseReturnUpdated received')
        clearTimeout(timeoutId)
        timeoutId = setTimeout(() => {
          console.log('🔄 [Event] Refreshing data...')
          fetchAllData()
        }, 300)
      }
    }

    window.addEventListener('purchaseReturnUpdated', handlePurchaseReturnUpdate)
    return () => {
      clearTimeout(timeoutId)
      window.removeEventListener(
        'purchaseReturnUpdated',
        handlePurchaseReturnUpdate,
      )
    }
  }, [initializing, companyId, fetchAllData])

  useEffect(() => {
    if (isFirstRender.current || initializing) {
      return
    }

    if (companyId && !fetchInProgress.current) {
      console.log('🔍 [Filters] Change detected, fetching purchase returns...')
      const timeoutId = setTimeout(() => {
        fetchPurchaseReturns()
      }, 300)
      return () => clearTimeout(timeoutId)
    }
  }, [
    currentPage,
    pageSize,
    searchQuery,
    statusFilter,
    paymentStatusFilter,
    sortByFilter,
    companyId,
    fetchPurchaseReturns,
  ])

  const debouncedSearch = useDebouncedCallback((query: string) => {
    console.log('🔍 Debounced search:', query)
    setSearchQuery(query)
    setCurrentPage(1)
  }, 400)

  const handleRefreshClick = useCallback(async () => {
    if (fetchInProgress.current) {
      console.log('⏭️ Already refreshing...')
      return
    }

    try {
      console.log('🔄 [Refresh] Manual refresh triggered')
      await fetchAllData()
    } catch (error: any) {
      console.error('❌ [Refresh] Error:', error)
    }
  }, [fetchAllData])

  const columns = getPurchaseReturnColumns(defaultCurrency)

  const headerActions = getPurchaseReturnHeaderActions({
    onExportPDF: () => handleExportPDF(columns, purchaseReturns),
    onExportExcel: () => handleExportExcel(columns, purchaseReturns),
    onRefresh: handleRefreshClick,
    onCreate: companySettings?.allow_purchase_returns
      ? () => handleCreate(companyId!, companySettings, dispatch, stores[0]?.id)
      : undefined,
  })

  const getRowActionsForRow = useCallback(
    (row: any) => {
      const baseHandlers = {
        onView: handleView,
        onEdit: (rowData: any) =>
          handleEdit(rowData, dispatch, companyId!, companySettings),
        onDelete: (rowData: any) =>
          handleDelete(rowData, fetchAllData, companyId!, companySettings),
      }

      if (row.status === 'pending' && companySettings?.allow_purchase_returns) {
        return getPurchaseReturnRowActions({
          ...baseHandlers,
          onApprove: (rowData: any) =>
            handleApprove(
              rowData,
              fetchAllData,
              companyId!,
              companySettings,
              defaultCurrency,
            ),
          onReject: (rowData: any) =>
            handleReject(rowData, fetchAllData, companyId!, companySettings),
        })
      }

      return getPurchaseReturnRowActions(baseHandlers)
    },
    [dispatch, companyId, companySettings, defaultCurrency, fetchAllData],
  )

  const filters = getPurchaseReturnFilters(
    (value) => {
      console.log('🔍 Status filter changed:', value)
      setStatusFilter(value)
      setCurrentPage(1)
    },
    (value) => {
      console.log('🔍 Payment status filter changed:', value)
      setPaymentStatusFilter(value)
      setCurrentPage(1)
    },
    (value) => {
      console.log('🔍 Sort by filter changed:', value)
      setSortByFilter(value)
      setCurrentPage(1)
    },
  )

  const statisticsData = getStatisticsCardsData(stats, defaultCurrency)

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
          <TableHeader
            title="Purchase Returns Management"
            description="View and manage purchase returns"
            actions={headerActions}
          />
          <Alert
            icon={<IconAlertCircle size={16} />}
            title="Error Loading Data"
            color="red"
            mt="md"
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
        <TableHeader
          title="Purchase Returns Management"
          description="View and manage purchase returns to suppliers"
          actions={headerActions}
        />

        <StatisticsCard stats={statisticsData} />

        <ContentTable
          columns={columns}
          data={purchaseReturns}
          loading={loading}
          searchPlaceholder="Search by return number, supplier, reason..."
          filters={filters}
          rowActions={(row) => getRowActionsForRow(row)}
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

export { PurchaseReturnManagement }

