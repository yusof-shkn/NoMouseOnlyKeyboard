// PurchaseOrdersHistory.tsx - ENHANCED VERSION

import { useState, useEffect, useCallback, useRef } from 'react'
import { Container, Alert, useMantineTheme } from '@mantine/core'
import { useDispatch, useSelector } from 'react-redux'
import { useScopeFilter } from '@shared/hooks/useScopeFilter'
import { AppDispatch, RootState } from '@app/core/store/store'
import { useDebouncedCallback } from '@mantine/hooks'
import { IconAlertCircle } from '@tabler/icons-react'
import TableHeader from '@shared/components/tableHeader/TableHeader'
import ContentTable from '@shared/components/tableContent/TableContent'
import StatisticsCard from '@shared/components/statistics/StatisticsCard'
import { PurchaseOrder } from '@shared/types/purchaseOrders'
import { selectCompanySettings } from '@features/authentication/authSlice'
import { selectIsUnlocked } from '@core/restrictedMode/Restrictedmode.slice'
import {
  handleExportPDF,
  handleExportExcel,
  handleView,
  handleEdit,
  handleDelete,
  handleSubmit,
  handleApprove,
  handleReject,
  handleReceiveGoods,
  handleMarkAsPaid,
  handleCancel,
  handleCheckReturnEligibility,
  handleViewPaymentHistory,
} from './handlers/purchaseOrdersHistoryHandlers'
import {
  getPurchaseOrdersColumns,
  getPurchaseOrdersHeaderActions,
  getPurchaseOrdersRowActions,
  getPurchaseOrdersFilters,
  getStatisticsCardsData,
} from './Config'
import { PageWrapper } from '@shared/styles/PageWrapper'
import {
  fetchPurchaseOrdersData,
  fetchPurchaseOrderStats,
} from './utils/purchaseOrdersHistoryUtils'
import getCurrentUserCompanyId from '@shared/utils/authUtils'
import { LayoutSkeleton } from '@shared/components/skeletons/Layout.skeleton'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@shared/contexts'
import { isAdmin as checkIsAdmin } from '@shared/constants/roles'
import { clearSelection } from '@features/main/main.slice'
import { notifications } from '@mantine/notifications'
import { supabase } from '@app/core/supabase/Supabase.utils'

const PurchaseOrdersHistory = () => {
  const theme = useMantineTheme()
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([])
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [stores, setStores] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [initializing, setInitializing] = useState(true)
  const [isFetching, setIsFetching] = useState(false)
  const isFirstRender = useRef(true)
  const navigate = useNavigate()

  const companySettings = useSelector(selectCompanySettings)
  const isUnlocked = useSelector(selectIsUnlocked)
  const currency = companySettings?.default_currency || 'UGX'

  const [companyId, setCompanyId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [stats, setStats] = useState({
    total: 0,
    draft: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    received: 0,
    cancelled: 0,
    completed: 0,
    totalAmount: 0,
    totalPaid: 0,
    totalDue: 0,
    unpaid: 0,
    paid: 0,
    overdue: 0,
  })

  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [totalCount, setTotalCount] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('all')
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('all')
  const dispatch = useDispatch<AppDispatch>()
  const { storeIds } = useScopeFilter()
  const selectedStore = useSelector(
    (state: RootState) => state.areaStore?.selectedStore,
  )
  const { user: authUser } = useAuth()
  const userRoleId = authUser?.profile?.role_id
  const isAdmin = userRoleId ? checkIsAdmin(userRoleId) : false
  const currentStoreId =
    storeIds?.length === 1 ? storeIds[0] : selectedStore?.id || null

  useEffect(() => {
    const validateStoreAccess = async () => {
      if (selectedStore && companyId) {
        const { data: storeCheck } = await supabase
          .from('stores')
          .select('id, company_id')
          .eq('id', selectedStore.id)
          .eq('company_id', companyId)
          .maybeSingle()

        if (!storeCheck) {
          console.warn(
            '⚠️ Selected store does not belong to current company - clearing',
          )
          dispatch(clearSelection())
          notifications.show({
            title: 'Selection Cleared',
            message:
              'Previous store selection was invalid and has been cleared.',
            color: 'yellow',
          })
        }
      }
    }

    validateStoreAccess()
  }, [selectedStore, companyId, dispatch])

  useEffect(() => {
    const initializeCompanyData = async () => {
      try {
        console.log('🎬 [Initial Load] Starting company initialization...')
        setInitializing(true)
        setError(null)

        const userCompanyId = await getCurrentUserCompanyId()

        if (!userCompanyId) {
          setError('Company ID not found. Please ensure you are logged in.')
          setInitializing(false)
          return
        }

        console.log('✅ Company ID:', userCompanyId)
        setCompanyId(userCompanyId)

        console.log('✅ Using company settings from Redux:', companySettings)
      } catch (error) {
        console.error('❌ Error initializing company data:', error)
        setError('Failed to load company data. Please refresh the page.')
        setInitializing(false)
      }
    }

    initializeCompanyData()
  }, [companySettings])

  const fetchPurchaseOrders = useCallback(async () => {
    if (!companyId || isFetching) {
      console.log(
        '⏭️ [fetchPurchaseOrders] Skipping - companyId:',
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

      console.log('🔄 [fetchPurchaseOrders] Fetching with params:', {
        page: currentPage,
        pageSize,
        searchQuery,
        status: statusFilter,
        companyId,
        storeId: currentStoreId,
        storeIds: storeIds,
      })

      const poData = await fetchPurchaseOrdersData(
        {
          page: currentPage,
          pageSize,
          searchQuery,
          status: statusFilter,
          paymentStatus: paymentStatusFilter,
          paymentMethod: paymentMethodFilter,
          companyId: companyId,
          storeId: currentStoreId || undefined,
          storeIds: storeIds,
          isUnlocked,
        },
        companySettings,
      )

      console.log('✅ [fetchPurchaseOrders] Fetched:', {
        count: poData.purchaseOrdersData.length,
        totalCount: poData.totalCount,
        stats: poData.stats,
      })

      setPurchaseOrders(poData.purchaseOrdersData)
      setSuppliers(poData.suppliersData)
      setStores(poData.storesData)
      setTotalCount(poData.totalCount)

      if (poData.stats) {
        console.log('📊 [Stats updated from fetch]:', poData.stats)
        setStats(poData.stats)
      }
    } catch (err) {
      console.error('❌ Error fetching purchase orders:', err)
      setError('Failed to load purchase orders. Please try again.')
      setPurchaseOrders([])
      setSuppliers([])
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
    companyId,
    currentStoreId,
    isFetching,
    companySettings,
    isUnlocked,
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

      const poData = await fetchPurchaseOrdersData(
        {
          page: currentPage,
          pageSize,
          searchQuery,
          status: statusFilter,
          paymentStatus: paymentStatusFilter,
          paymentMethod: paymentMethodFilter,
          companyId: companyId,
          storeId: currentStoreId || undefined,
          storeIds: storeIds,
          isUnlocked,
        },
        companySettings,
      )

      console.log('✅ [fetchAllData] All data fetched successfully')

      setPurchaseOrders(poData.purchaseOrdersData)
      setSuppliers(poData.suppliersData)
      setStores(poData.storesData)
      setTotalCount(poData.totalCount)

      if (poData.stats) {
        console.log('📊 [Stats updated from fetchAll]:', poData.stats)
        setStats(poData.stats)
      }
    } catch (err) {
      console.error('❌ Error fetching all data:', err)
      setError('Failed to load data. Please try again.')
    } finally {
      setLoading(false)
      setIsFetching(false)
    }
  }, [
    currentPage,
    pageSize,
    searchQuery,
    statusFilter,
    companyId,
    currentStoreId,
    isFetching,
    companySettings,
    isUnlocked,
  ])

  useEffect(() => {
    if (companyId && initializing && companySettings) {
      console.log('🎬 [Initial Load] Loading purchase orders...')
      fetchAllData().then(() => {
        setInitializing(false)
        isFirstRender.current = false
        console.log('✅ [Initial Load] Complete')
      })
    }
  }, [companyId, initializing, companySettings])

  useEffect(() => {
    let timeoutId: NodeJS.Timeout

    const handlePurchaseOrderUpdate = () => {
      if (!initializing && !isFetching && companyId) {
        console.log('🔔 [Event] purchaseOrderUpdated received')
        clearTimeout(timeoutId)
        timeoutId = setTimeout(() => {
          console.log('🔄 [Event] Refreshing data...')
          fetchAllData()
        }, 300)
      }
    }

    window.addEventListener('purchaseOrderUpdated', handlePurchaseOrderUpdate)
    return () => {
      clearTimeout(timeoutId)
      window.removeEventListener(
        'purchaseOrderUpdated',
        handlePurchaseOrderUpdate,
      )
    }
  }, [initializing, isFetching, companyId, fetchAllData])

  useEffect(() => {
    const handlePaymentSuccess = () => {
      if (!initializing && !isFetching && companyId) {
        console.log('💰 [Event] Payment recorded successfully, refreshing...')
        fetchAllData()
      }
    }

    window.addEventListener('purchaseOrderPaymentSuccess', handlePaymentSuccess)
    return () => {
      window.removeEventListener(
        'purchaseOrderPaymentSuccess',
        handlePaymentSuccess,
      )
    }
  }, [initializing, isFetching, companyId, fetchAllData])

  useEffect(() => {
    if (isFirstRender.current) {
      return
    }

    if (!initializing && !isFetching && companyId) {
      console.log('🔍 [Filters] Change detected, fetching purchase orders...')
      const timeoutId = setTimeout(() => {
        fetchPurchaseOrders()
      }, 300)
      return () => clearTimeout(timeoutId)
    }
  }, [
    currentPage,
    pageSize,
    searchQuery,
    statusFilter,
    paymentStatusFilter,
    paymentMethodFilter,
    currentStoreId,
  ])

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

  const columns = getPurchaseOrdersColumns(currency)

  const headerActions = getPurchaseOrdersHeaderActions({
    onExportPDF: () => handleExportPDF(columns, purchaseOrders),
    onExportExcel: () => handleExportExcel(columns, purchaseOrders),
    onRefresh: handleRefreshClick,
  })

  const rowActions = getPurchaseOrdersRowActions(
    {
      onView: (row: any) => handleView(row, dispatch, currency),
      onEdit: (row: any) =>
        handleEdit(
          row,
          dispatch,
          companySettings,
          navigate,
          currentStoreId,
          isAdmin,
        ),
      onDelete: (row: any) => handleDelete(row, fetchAllData, companySettings),
      onSubmit: (row: any) => handleSubmit(row, fetchAllData, companySettings),
      onApprove: (row: any) =>
        handleApprove(row, fetchAllData, companySettings),
      onReject: (row: any) => handleReject(row, fetchAllData, companySettings),
      onReceive: (row: any) => handleReceiveGoods(row, fetchAllData, dispatch),
      onMarkPaid: (row: any) => handleMarkAsPaid(row, dispatch),
      onCancel: (row: any) => handleCancel(row, fetchAllData),
      onReturn: (row: any) =>
        handleCheckReturnEligibility(row, companySettings, dispatch),
    },
    companySettings,
  )

  const filters = getPurchaseOrdersFilters(
    (value) => {
      setStatusFilter(value)
      setCurrentPage(1)
    },
    (value) => {
      setPaymentStatusFilter(value)
      setCurrentPage(1)
    },
    (value) => {
      setPaymentMethodFilter(value)
      setCurrentPage(1)
    },
  )

  const statisticsData = getStatisticsCardsData(
    stats,
    companySettings,
    currency,
    theme,
  )

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
            title="Purchase Orders History"
            description="View and manage purchase orders"
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
        <TableHeader
          title="Purchase Orders History"
          description="View and manage purchase orders with complete status control"
          actions={headerActions}
        />

        {error && (
          <Alert
            icon={<IconAlertCircle size={16} />}
            title="Error Loading Purchase Orders"
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
          data={purchaseOrders}
          loading={loading}
          searchPlaceholder="Search by PO number, invoice, supplier, store..."
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
          onRowClick={(row) => handleView(row, dispatch, currency)}
        />
      </Container>
    </PageWrapper>
  )
}

export default PurchaseOrdersHistory

