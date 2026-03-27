import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  Container,
  Alert,
  useMantineTheme,
  useMantineColorScheme,
} from '@mantine/core'
import { useDispatch } from 'react-redux'
import { AppDispatch } from '@app/core/store/store'
import { useDebouncedCallback } from '@mantine/hooks'
import { IconAlertCircle } from '@tabler/icons-react'
import PageHeader from '@shared/components/tableHeader/TableHeader'
import ContentTable from '@shared/components/tableContent/TableContent'
import StatisticsCard from '@shared/components/statistics/StatisticsCard'
import { ProductCategory } from '@shared/types/medicines'
import {
  fetchCategoriesData,
  fetchCategoryStats,
} from './utils/categoriesManagement.utils'
import {
  handleAddCategory,
  handleExportPDF,
  handleExportExcel,
  handleView,
  handleEdit,
} from './handlers/categoriesManagement.handlers'
import {
  getCategoryColumns,
  getCategoryHeaderActions,
  getCategoryPrimaryAction,
  getCategoryRowActions,
  getCategoryFilters,
  getStatisticsCardsData,
} from './CategoriesManagement.config'
import { notifications } from '@mantine/notifications'
import { LayoutSkeleton } from '@shared/components/skeletons/Layout.skeleton'
import { PageWrapper } from '@shared/styles/PageWrapper'
import { useNavigate } from 'react-router-dom'
import { deleteCategory } from './data/categories.queries'
import {
  getCurrentUserRoleId,
  getCurrentUserCompany,
} from '@shared/utils/authUtils'
import { Role } from '@shared/constants/roles'

const Categories = () => {
  const theme = useMantineTheme()
  const { colorScheme } = useMantineColorScheme()
  const isDark = colorScheme === 'dark'

  const [categories, setCategories] = useState<ProductCategory[]>([])
  const [loading, setLoading] = useState(false)
  const [initializing, setInitializing] = useState(true)
  const [isFetching, setIsFetching] = useState(false)
  const isFirstRender = useRef(true)
  const [error, setError] = useState<string | null>(null)

  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    withProducts: 0,
  })

  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(8)
  const [totalCount, setTotalCount] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [productFilter, setProductFilter] = useState('all')
  const [categoryTypeFilter, setCategoryTypeFilter] = useState('all')

  const dispatch = useDispatch<AppDispatch>()
  const navigate = useNavigate()

  const fetchCategories = useCallback(async () => {
    if (isFetching) return

    try {
      setIsFetching(true)
      setLoading(true)
      setError(null)

      const categoriesResult = await fetchCategoriesData({
        page: currentPage,
        pageSize,
        searchQuery,
        status: statusFilter,
        hasProducts: productFilter,
        categoryType: categoryTypeFilter,
      })

      setCategories(categoriesResult.categoriesData)
      setTotalCount(categoriesResult.totalCount)
    } catch (err: any) {
      console.error('❌ [fetchCategories] Error:', err)
      setError(err.message || 'Failed to load categories. Please try again.')
      setCategories([])
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
    productFilter,
    categoryTypeFilter,
    isFetching,
  ])

  const fetchAllData = useCallback(async () => {
    if (isFetching) return

    try {
      setIsFetching(true)
      setLoading(true)
      setError(null)

      const [statsData, categoriesResult] = await Promise.all([
        fetchCategoryStats(),
        fetchCategoriesData({
          page: currentPage,
          pageSize,
          searchQuery,
          status: statusFilter,
          hasProducts: productFilter,
          categoryType: categoryTypeFilter,
        }),
      ])

      setStats({
        total: statsData.total,
        active: statsData.active,
        withProducts: statsData.withProducts,
      })
      setCategories(categoriesResult.categoriesData)
      setTotalCount(categoriesResult.totalCount)
    } catch (err: any) {
      console.error('❌ [fetchAllData] Error:', err)
      setError(err.message || 'Failed to load data. Please try again.')
    } finally {
      setLoading(false)
      setIsFetching(false)
    }
  }, [
    currentPage,
    pageSize,
    searchQuery,
    statusFilter,
    productFilter,
    categoryTypeFilter,
    isFetching,
  ])

  useEffect(() => {
    fetchAllData().then(() => {
      setInitializing(false)
      isFirstRender.current = false
    })
  }, [])

  useEffect(() => {
    let timeoutId: NodeJS.Timeout

    const handleCategoryUpdate = () => {
      if (!initializing && !isFetching) {
        clearTimeout(timeoutId)
        timeoutId = setTimeout(() => {
          fetchAllData()
        }, 300)
      }
    }

    window.addEventListener('categoryUpdated', handleCategoryUpdate)
    return () => {
      clearTimeout(timeoutId)
      window.removeEventListener('categoryUpdated', handleCategoryUpdate)
    }
  }, [initializing, isFetching, fetchAllData])

  useEffect(() => {
    if (isFirstRender.current) return

    if (!initializing && !isFetching) {
      const timeoutId = setTimeout(() => {
        fetchCategories()
      }, 300)
      return () => clearTimeout(timeoutId)
    }
  }, [
    currentPage,
    pageSize,
    searchQuery,
    statusFilter,
    productFilter,
    categoryTypeFilter,
  ])

  const debouncedSearch = useDebouncedCallback((query: string) => {
    setSearchQuery(query)
    setCurrentPage(1)
  }, 400)

  const handleRefreshClick = useCallback(async () => {
    try {
      await fetchAllData()
      notifications.show({
        title: 'Refreshed',
        message: 'Data refreshed successfully',
        color: 'blue',
      })
    } catch (error: any) {
      notifications.show({
        title: 'Refresh Failed',
        message: error.message || 'Failed to refresh data',
        color: 'red',
      })
    }
  }, [fetchAllData])

  const handleDelete = useCallback(
    async (row: ProductCategory): Promise<void> => {
      const userRoleId = await getCurrentUserRoleId()
      const userCompanyId = await getCurrentUserCompany()

      if (row.company_id === 1) {
        notifications.show({
          title: 'Permission Denied',
          message: 'System categories cannot be deleted.',
          color: 'red',
        })
        return
      }

      if (userRoleId !== Role.company_admin) {
        notifications.show({
          title: 'Permission Denied',
          message: 'You do not have permission to delete categories.',
          color: 'red',
        })
        return
      }

      if (row.company_id !== userCompanyId?.id) {
        notifications.show({
          title: 'Permission Denied',
          message: 'You can only delete categories from your own company.',
          color: 'red',
        })
        return
      }

      const confirmDelete = window.confirm(
        `Are you sure you want to delete "${row.category_name}"?`,
      )
      if (!confirmDelete) return

      try {
        setLoading(true)
        const { error } = await deleteCategory(row.id)
        if (error) throw error

        await fetchAllData()

        notifications.show({
          title: 'Success',
          message: `Category "${row.category_name}" deleted successfully`,
          color: 'green',
        })
      } catch (error: any) {
        console.error('❌ Error deleting category:', error)
        notifications.show({
          title: 'Error',
          message: error.message || 'Failed to delete category',
          color: 'red',
        })
        setLoading(false)
      }
    },
    [fetchAllData],
  )

  const handleFilterChange = useCallback((value: string) => {
    setStatusFilter(value)
    setCurrentPage(1)
  }, [])

  const handleProductFilterChange = useCallback((value: string) => {
    setProductFilter(value)
    setCurrentPage(1)
  }, [])

  const handleCategoryTypeFilterChange = useCallback((value: string) => {
    setCategoryTypeFilter(value)
    setCurrentPage(1)
  }, [])

  const columns = useMemo(() => getCategoryColumns(), [])

  const filters = useMemo(
    () =>
      getCategoryFilters({
        onStatusChange: handleFilterChange,
        onProductChange: handleProductFilterChange,
        onCategoryTypeChange: handleCategoryTypeFilterChange,
        currentStatusFilter: statusFilter,
        currentProductFilter: productFilter,
        currentCategoryTypeFilter: categoryTypeFilter,
      }),
    [
      handleFilterChange,
      handleProductFilterChange,
      handleCategoryTypeFilterChange,
      statusFilter,
      productFilter,
      categoryTypeFilter,
    ],
  )

  const statisticsData = useMemo(() => getStatisticsCardsData(stats), [stats])

  const headerActions = useMemo(
    () =>
      getCategoryHeaderActions({
        onExportPDF: () => handleExportPDF(columns, categories),
        onExportExcel: () => handleExportExcel(columns, categories),
        onRefresh: handleRefreshClick,
      }),
    [columns, categories, handleRefreshClick],
  )

  const primaryAction = useMemo(
    () => getCategoryPrimaryAction(() => handleAddCategory(dispatch)),
    [dispatch],
  )

  const rowActions = useMemo(
    () =>
      getCategoryRowActions({
        onView: (row) => handleView(row, dispatch, navigate),
        onEdit: (row) => handleEdit(row, dispatch),
        onDelete: handleDelete,
      }),
    [dispatch, navigate, handleDelete],
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

  return (
    <PageWrapper>
      <Container
        size="xxl"
        px={0}
      >
        <PageHeader
          title="Product Categories"
          description="Manage your product categories"
          actions={headerActions}
          primaryAction={primaryAction}
        />

        {error && (
          <Alert
            icon={<IconAlertCircle size={16} />}
            title="Error Loading Categories"
            color="red"
            mb="lg"
            withCloseButton
            onClose={() => setError(null)}
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
          data={categories}
          loading={loading}
          searchPlaceholder="Search by category name, code, or description..."
          filters={filters}
          rowActions={rowActions}
          onSearch={debouncedSearch}
          pagination={true}
          totalCount={totalCount}
          currentPage={currentPage}
          pageSize={pageSize}
          onPageChange={(page) => setCurrentPage(page)}
          onPageSizeChange={(size) => {
            setPageSize(size)
            setCurrentPage(1)
          }}
          selectable={true}
        />
      </Container>
    </PageWrapper>
  )
}

export default Categories

