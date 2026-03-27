// src/pages/StockAdjustment/StockAdjustment.tsx - UPDATED WITH THEMING & DARK MODE
import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Container,
  Alert,
  useMantineTheme,
  useMantineColorScheme,
} from '@mantine/core'
import { useDispatch, useSelector } from 'react-redux'
import { useScopeFilter } from '@shared/hooks/useScopeFilter'
import { AppDispatch, RootState } from '@app/core/store/store'
import { useDebouncedCallback } from '@mantine/hooks'
import { IconAlertCircle } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import PageHeader from '@shared/components/tableHeader/TableHeader'
import ContentTable from '@shared/components/tableContent/TableContent'
import type { StockAdjustment } from './types/stockAdjustmentTypes'
import { fetchStockAdjustmentsData } from './utils/stockAdjustment.utils'
import {
  handleAddAdjustment,
  handleExportPDF,
  handleExportExcel,
  handleEdit,
  handleRowClick,
  handleStoreChange,
  handleAdjustmentTypeChange,
  handleDateRangeChange,
  handleSortChange,
} from './handlers/stockAdjustment.handlers'
import {
  getStockAdjustmentColumns,
  getStockAdjustmentHeaderActions,
  getStockAdjustmentPrimaryAction,
  getStockAdjustmentRowActions,
  // getStockAdjustmentFilters,
} from './StockAdjustment.config'
import { LayoutSkeleton } from '@shared/components/skeletons/Layout.skeleton'
import { openModal } from '@shared/components/genericModal'
import { PageWrapper } from '@shared/styles/PageWrapper'
import { deleteStockAdjustment } from './data/stockAdjustment.queries'
// BUG FIX: Replaced old getCurrentUserRoleId + hardcoded role check with permission system
import { checkPermission } from '@shared/utils/Permissionutils'
import { Permission } from '@shared/constants/permissions'

const StockAdjustment = () => {
  const theme = useMantineTheme()
  const { colorScheme } = useMantineColorScheme()

  const [adjustments, setAdjustments] = useState<StockAdjustment[]>([])
  const [stores, setStores] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [initializing, setInitializing] = useState(true)
  const [isFetching, setIsFetching] = useState(false)
  const isFirstRender = useRef(true)

  const [error, setError] = useState<string | null>(null)

  const [currentPage, setCurrentPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(8)
  const [totalCount, setTotalCount] = useState<number>(0)
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [storeFilter, setStoreFilter] = useState<string>('all')
  const [adjustmentTypeFilter, setAdjustmentTypeFilter] =
    useState<string>('all')
  const [dateRangeFilter, setDateRangeFilter] = useState<string>('all')
  const [sortFilter, setSortFilter] = useState<string>('desc')

  const { storeIds } = useScopeFilter()
  const selectedStore = useSelector(
    (state: RootState) => state.areaStore.selectedStore,
  )

  const dispatch = useDispatch<AppDispatch>()

  const fetchAllData = useCallback(async () => {
    if (isFetching) {
      console.log('⏭️ [fetchAllData] Already fetching, skipping...')
      return
    }

    try {
      setIsFetching(true)
      setLoading(true)
      setError(null)

      console.log('🔄 [fetchAllData] Fetching stock adjustments...')

      const adjustmentsResult = await fetchStockAdjustmentsData({
        page: currentPage,
        pageSize,
        searchQuery,
        storeId: storeFilter !== 'all' ? parseInt(storeFilter) : null,
        adjustmentType: adjustmentTypeFilter,
        dateRange: dateRangeFilter,
        sort: sortFilter,
      })

      console.log('✅ [fetchAllData] Data fetched successfully')

      setAdjustments(adjustmentsResult.adjustmentsData)
      setStores(adjustmentsResult.storesData || [])
      setTotalCount(adjustmentsResult.totalCount)
    } catch (err: any) {
      console.error('❌ [fetchAllData] Error:', err)
      setError(err.message || 'Failed to fetch stock adjustments')
      notifications.show({
        title: 'Error',
        message: 'Failed to fetch stock adjustments',
        color: 'red',
      })
    } finally {
      setLoading(false)
      setIsFetching(false)
    }
  }, [
    currentPage,
    pageSize,
    searchQuery,
    storeFilter,
    adjustmentTypeFilter,
    dateRangeFilter,
    sortFilter,
    isFetching,
  ])

  useEffect(() => {
    console.log('🎬 [StockAdjustment] Starting initial data load...')
    fetchAllData().then(() => {
      setInitializing(false)
      isFirstRender.current = false
      console.log('✅ [StockAdjustment] Initial load complete')
    })
  }, [])

  useEffect(() => {
    let timeoutId: NodeJS.Timeout

    const handleAdjustmentUpdate = () => {
      if (!initializing && !isFetching) {
        console.log('🔔 [Event] adjustmentUpdated received')
        clearTimeout(timeoutId)
        timeoutId = setTimeout(() => {
          console.log('🔄 [Event] Refreshing data...')
          fetchAllData()
        }, 300)
      }
    }

    window.addEventListener('adjustmentUpdated', handleAdjustmentUpdate)
    return () => {
      clearTimeout(timeoutId)
      window.removeEventListener('adjustmentUpdated', handleAdjustmentUpdate)
    }
  }, [initializing, isFetching, fetchAllData])

  useEffect(() => {
    if (isFirstRender.current) {
      return
    }

    if (!initializing && !isFetching) {
      console.log('🔍 [Filters] Change detected')
      const timeoutId = setTimeout(() => {
        fetchAllData()
      }, 300)
      return () => clearTimeout(timeoutId)
    }
  }, [
    currentPage,
    pageSize,
    searchQuery,
    storeFilter,
    adjustmentTypeFilter,
    dateRangeFilter,
    sortFilter,
  ])

  useEffect(() => {
    if (selectedStore && !isFirstRender.current) {
      console.log('🏪 [Redux] Scope changed:', storeIds)
      if (storeIds?.length === 1) {
        setStoreFilter(String(storeIds[0]))
      } else {
        setStoreFilter('all')
      }
      setCurrentPage(1)
    }
  }, [JSON.stringify(storeIds)])

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
    async (row: StockAdjustment): Promise<void> => {
      // BUG FIX: Was checking getCurrentUserRoleId() !== Role.company_admin && !== Role.store_admin
      // This broke custom roles and ignored the STOCK_ADJUST_DELETE permission.
      // Now uses the permission cache correctly.
      if (!checkPermission(Permission.STOCK_ADJUST_DELETE)) {
        notifications.show({
          title: 'Permission Denied',
          message: 'You do not have permission to delete adjustments.',
          color: 'red',
        })
        return
      }

      if (row.is_approved) {
        notifications.show({
          title: 'Cannot Delete',
          message: 'Cannot delete approved adjustments',
          color: 'red',
        })
        return
      }

      dispatch(
        openModal({
          type: 'confirm-action',
          size: 'sm',
          props: {
            title: 'Delete Adjustment',
            message: `Are you sure you want to delete adjustment "${row.adjustment_number}"?`,
            confirmLabel: 'Delete',
            intent: 'danger',
            onConfirm: async () => {
              try {
                setLoading(true)
                const { error } = await deleteStockAdjustment(row.id)
                if (error) throw error

                await fetchAllData()

                notifications.show({
                  title: 'Success',
                  message: `Adjustment "${row.adjustment_number}" deleted successfully`,
                  color: 'green',
                })
              } catch (error: any) {
                console.error('❌ Error deleting adjustment:', error)
                notifications.show({
                  title: 'Error',
                  message: error.message || 'Failed to delete adjustment',
                  color: 'red',
                })
                setLoading(false)
              }
            },
          },
        }),
      )
    },
    [fetchAllData, dispatch],
  )

  const columns = getStockAdjustmentColumns(
    theme,
    colorScheme === 'auto' ? 'light' : colorScheme,
  )

  const headerActions = getStockAdjustmentHeaderActions({
    onExportPDF: () => handleExportPDF(columns, adjustments),
    onExportExcel: () => handleExportExcel(columns, adjustments),
    onRefresh: handleRefreshClick,
  })

  const primaryAction = getStockAdjustmentPrimaryAction(() =>
    handleAddAdjustment(dispatch),
  )

  const rowActions = getStockAdjustmentRowActions({
    onView: (row) =>
      dispatch(
        openModal({
          type: 'view-stock-adjustment',
          size: 'lg',
          props: { adjustment: row },
        }),
      ),
    onEdit: (row) => handleEdit(row, dispatch),
    onDelete: handleDelete,
  })

  const filters = getStockAdjustmentFilters({
    onStoreChange: (value) => {
      console.log('🔍 Store filter changed:', value)
      handleStoreChange(value, setStoreFilter, setCurrentPage, dispatch, stores)
    },
    onAdjustmentTypeChange: (value) => {
      console.log('🔍 Adjustment type filter changed:', value)
      handleAdjustmentTypeChange(value, setAdjustmentTypeFilter, setCurrentPage)
    },
    onDateRangeChange: (value) => {
      console.log('🔍 Date range filter changed:', value)
      handleDateRangeChange(value, setDateRangeFilter, setCurrentPage)
    },
    onSortChange: (value) => {
      console.log('🔍 Sort filter changed:', value)
      handleSortChange(value, setSortFilter, setCurrentPage)
    },
    stores,
    currentStoreFilter: storeFilter,
    currentAdjustmentTypeFilter: adjustmentTypeFilter,
    currentDateRangeFilter: dateRangeFilter,
    currentSortFilter: sortFilter,
  })

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
          title="Stock Adjustments"
          description={`Manage inventory adjustments - ${totalCount} total records`}
          actions={headerActions}
          primaryAction={primaryAction}
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

        <ContentTable
          columns={columns}
          data={adjustments}
          loading={loading}
          searchPlaceholder="Search by adjustment number, product name, or batch..."
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
            dispatch(
              openModal({
                type: 'view-stock-adjustment',
                size: 'lg',
                props: { adjustment: row },
              }),
            )
          }
          selectable={true}
        />
      </Container>
    </PageWrapper>
  )
}

export { StockAdjustment }

