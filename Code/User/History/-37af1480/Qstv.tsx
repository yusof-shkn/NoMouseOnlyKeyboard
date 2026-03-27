// src/pages/Finance/Expenses/ExpenseManagement.tsx
import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Container,
  Alert,
  useMantineTheme,
  useMantineColorScheme,
} from '@mantine/core'
import { useDispatch, useSelector } from 'react-redux'
import { AppDispatch } from '@app/core/store/store'
import { useDebouncedCallback } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { IconAlertCircle, IconInfoCircle } from '@tabler/icons-react'
import PageHeader from '@shared/components/tableHeader/TableHeader'
import ContentTable from '@shared/components/tableContent/TableContent'
import { Expense } from './types/expense.types'
import {
  fetchExpensesData,
  fetchExpenseStats,
  getCurrencyCode,
  isSystemExpense,
  canEditExpense,
  canDeleteExpense,
} from './utils/expense.utils'

import {
  handleAddExpense,
  handleExportPDF,
  handleExportExcel,
  handleViewDetails,
  handleEdit,
  handleStatusChange,
  handleCategoryChange,
  handleDateRangeChange,
} from './handlers/expenseForm.handlers'

import {
  getExpenseColumns,
  getExpenseHeaderActions,
  getExpensePrimaryAction,
  getExpenseRowActions,
  getExpenseFilters,
} from './Expense.config'
import { LayoutSkeleton } from '@shared/components/skeletons/Layout.skeleton'
import { PageWrapper } from '@shared/styles/PageWrapper'
import {
  deleteExpense,
  approveExpense,
  postExpense,
} from './data/expense.queries'
import {
  getCurrentUserRoleId,
  getCurrentUserProfile,
} from '@shared/utils/authUtils'
import { Role } from '@shared/constants/roles'
import { selectCompanySettings } from '@features/authentication/authSlice'
import { selectIsUnlocked } from '@core/restrictedMode/Restrictedmode.slice'
import { getPaperBackground, getTextColor } from '@app/core/theme/theme.utils'

const ExpenseManagement = () => {
  const theme = useMantineTheme()
  const { colorScheme } = useMantineColorScheme()
  const resolvedColorScheme: 'light' | 'dark' =
    colorScheme === 'dark' ? 'dark' : 'light'

  const [expenses, setExpenses] = useState<Expense[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [initializing, setInitializing] = useState(true)
  const [isFetching, setIsFetching] = useState(false)
  const isFirstRender = useRef(true)

  const [error, setError] = useState<string | null>(null)
  const [companyId, setCompanyId] = useState<number | null>(null)

  const companySettings = useSelector(selectCompanySettings)
  const isUnlocked = useSelector(selectIsUnlocked)

  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    totalAmount: 0,
    monthlyAmount: 0,
  })

  const [currentPage, setCurrentPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(10)
  const [totalCount, setTotalCount] = useState<number>(0)
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([
    null,
    null,
  ])

  const dispatch = useDispatch<AppDispatch>()

  // Theme colors
  const paperBg = getPaperBackground(theme, resolvedColorScheme, false)
  const textColor = getTextColor(theme, resolvedColorScheme, 'primary')

  useEffect(() => {
    const initializeCompanyId = async () => {
      try {
        setInitializing(true)
        setError(null)

        const userProfile = await getCurrentUserProfile()

        if (!userProfile?.company_id) {
          setError('Company ID not found. Please ensure you are logged in.')
          setInitializing(false)
          return
        }

        setCompanyId(userProfile.company_id)
      } catch (error) {
        console.error('Error initializing company ID:', error)
        setError('Failed to load company information. Please refresh the page.')
        setInitializing(false)
      }
    }

    initializeCompanyId()
  }, [])

  const fetchExpenses = useCallback(async () => {
    if (!companyId || isFetching) return

    try {
      setIsFetching(true)
      setLoading(true)
      setError(null)

      const startDate = dateRange[0]
        ? dateRange[0].toISOString().split('T')[0]
        : null
      const endDate = dateRange[1]
        ? dateRange[1].toISOString().split('T')[0]
        : null

      const expensesResult = await fetchExpensesData({
        page: currentPage,
        pageSize,
        searchQuery,
        status: statusFilter,
        categoryId: categoryFilter ? parseInt(categoryFilter) : null,
        startDate,
        endDate,
        companyId,
        isUnlocked,
      })

      setExpenses(expensesResult.expensesData)
      setCategories(expensesResult.categoriesData || [])
      setTotalCount(expensesResult.totalCount)
    } catch (err) {
      console.error('Error fetching expenses:', err)
      setError('Failed to load expenses. Please try again.')
      setExpenses([])
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
    categoryFilter,
    dateRange,
    companyId,
    isFetching,
    isUnlocked,
  ])

  const fetchAllData = useCallback(async () => {
    if (!companyId || isFetching) return

    try {
      setIsFetching(true)
      setLoading(true)
      setError(null)

      const startDate = dateRange[0]
        ? dateRange[0].toISOString().split('T')[0]
        : null
      const endDate = dateRange[1]
        ? dateRange[1].toISOString().split('T')[0]
        : null

      const [statsData, expensesResult] = await Promise.all([
        fetchExpenseStats(companyId),
        fetchExpensesData({
          page: currentPage,
          pageSize,
          searchQuery,
          status: statusFilter,
          categoryId: categoryFilter ? parseInt(categoryFilter) : null,
          startDate,
          endDate,
          companyId,
        }),
      ])

      setStats(statsData)
      setExpenses(expensesResult.expensesData)
      setCategories(expensesResult.categoriesData || [])
      setTotalCount(expensesResult.totalCount)
    } catch (err) {
      console.error('Error fetching all data:', err)
      setError('Failed to load data. Please try again.')
      notifications.show({
        title: 'Error',
        message: 'Failed to load expenses',
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
    statusFilter,
    categoryFilter,
    dateRange,
    companyId,
    isFetching,
  ])

  useEffect(() => {
    if (companyId && initializing) {
      fetchAllData().then(() => {
        setInitializing(false)
        isFirstRender.current = false
      })
    }
  }, [companyId, initializing])

  useEffect(() => {
    let timeoutId: NodeJS.Timeout

    const handleExpenseUpdate = () => {
      if (!initializing && !isFetching && companyId) {
        clearTimeout(timeoutId)
        timeoutId = setTimeout(() => {
          fetchAllData()
        }, 300)
      }
    }

    window.addEventListener('expenseUpdated', handleExpenseUpdate)
    return () => {
      clearTimeout(timeoutId)
      window.removeEventListener('expenseUpdated', handleExpenseUpdate)
    }
  }, [initializing, isFetching, companyId, fetchAllData])

  useEffect(() => {
    if (isFirstRender.current) return

    if (!initializing && !isFetching && companyId) {
      const timeoutId = setTimeout(() => {
        fetchExpenses()
      }, 300)
      return () => clearTimeout(timeoutId)
    }
  }, [
    currentPage,
    pageSize,
    searchQuery,
    statusFilter,
    categoryFilter,
    dateRange,
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
        message: 'Expense data refreshed successfully',
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

  const handleDeleteExpense = useCallback(
    async (row: Expense): Promise<void> => {
      const userRoleId = await getCurrentUserRoleId()

      if (
        userRoleId !== Role.company_admin &&
        userRoleId !== Role.store_admin
      ) {
        notifications.show({
          title: 'Permission Denied',
          message: 'You do not have permission to delete expenses.',
          color: 'red',
        })
        return
      }

      if (isSystemExpense(row)) {
        notifications.show({
          title: 'Cannot Delete',
          message:
            'Cannot delete auto-generated expenses. These are created automatically from purchase orders.',
          color: 'yellow',
          icon: <IconAlertCircle size={16} />,
        })
        return
      }

      if (!canDeleteExpense(row)) {
        notifications.show({
          title: 'Cannot Delete',
          message: 'Cannot delete posted expenses.',
          color: 'yellow',
        })
        return
      }

      const confirmDelete = window.confirm(
        `Are you sure you want to delete expense "${row.expense_number}"?`,
      )
      if (!confirmDelete) return

      try {
        setLoading(true)
        const { error } = await deleteExpense(row.id)
        if (error) throw error

        await fetchAllData()

        notifications.show({
          title: 'Success',
          message: `Expense "${row.expense_number}" deleted successfully`,
          color: 'green',
        })
      } catch (error: any) {
        console.error('Error deleting expense:', error)
        notifications.show({
          title: 'Error',
          message: error.message || 'Failed to delete expense',
          color: 'red',
        })
        setLoading(false)
      }
    },
    [fetchAllData],
  )

  const handleApproveExpense = useCallback(
    async (row: Expense): Promise<void> => {
      const userRoleId = await getCurrentUserRoleId()
      const userProfile = await getCurrentUserProfile()

      if (
        userRoleId !== Role.company_admin &&
        userRoleId !== Role.store_admin
      ) {
        notifications.show({
          title: 'Permission Denied',
          message: 'You do not have permission to approve expenses.',
          color: 'red',
        })
        return
      }

      if (row.status !== 'pending') {
        notifications.show({
          title: 'Cannot Approve',
          message: 'Only pending expenses can be approved',
          color: 'yellow',
        })
        return
      }

      const currencyCode = getCurrencyCode(companySettings)
      const confirmApprove = window.confirm(
        `Approve expense "${row.expense_number}" for ${row.total_amount?.toLocaleString()} ${currencyCode}?`,
      )
      if (!confirmApprove) return

      try {
        setLoading(true)
        if (!userProfile?.id) throw new Error('User ID not found')

        const { error } = await approveExpense(row.id, userProfile.id)
        if (error) throw error

        await fetchAllData()

        notifications.show({
          title: 'Success',
          message: `Expense "${row.expense_number}" approved`,
          color: 'green',
        })
      } catch (error: any) {
        console.error('Error approving expense:', error)
        notifications.show({
          title: 'Error',
          message: error.message || 'Failed to approve expense',
          color: 'red',
        })
        setLoading(false)
      }
    },
    [fetchAllData, companySettings],
  )

  const handlePostExpense = useCallback(
    async (row: Expense): Promise<void> => {
      const userRoleId = await getCurrentUserRoleId()

      if (userRoleId !== Role.company_admin) {
        notifications.show({
          title: 'Permission Denied',
          message: 'Only company admins can post expenses.',
          color: 'red',
        })
        return
      }

      if (row.status !== 'approved') {
        notifications.show({
          title: 'Cannot Post',
          message: 'Only approved expenses can be posted',
          color: 'yellow',
        })
        return
      }

      const confirmPost = window.confirm(
        `Post expense "${row.expense_number}" to general ledger? This cannot be undone.`,
      )
      if (!confirmPost) return

      try {
        setLoading(true)
        const { error } = await postExpense(row.id)
        if (error) throw error

        await fetchAllData()

        notifications.show({
          title: 'Success',
          message: `Expense "${row.expense_number}" posted to GL`,
          color: 'green',
        })
      } catch (error: any) {
        console.error('Error posting expense:', error)
        notifications.show({
          title: 'Error',
          message: error.message || 'Failed to post expense',
          color: 'red',
        })
        setLoading(false)
      }
    },
    [fetchAllData],
  )

  const handleEditExpense = useCallback(
    (row: Expense) => {
      if (isSystemExpense(row)) {
        notifications.show({
          title: 'Cannot Edit',
          message:
            'Cannot edit auto-generated expenses. These are created automatically from purchase orders.',
          color: 'yellow',
          icon: <IconAlertCircle size={16} />,
        })
        return
      }

      if (!canEditExpense(row)) {
        notifications.show({
          title: 'Cannot Edit',
          message: 'Can only edit draft or pending expenses.',
          color: 'yellow',
        })
        return
      }

      handleEdit(row, dispatch)
    },
    [dispatch],
  )

  const columns = getExpenseColumns(companySettings)

  const headerActions = getExpenseHeaderActions({
    onExportPDF: () => handleExportPDF(columns, expenses, companySettings),
    onExportExcel: () => handleExportExcel(columns, expenses, companySettings),
    onRefresh: handleRefreshClick,
  })

  const primaryAction = getExpensePrimaryAction(() =>
    handleAddExpense(dispatch),
  )

  const rowActions = getExpenseRowActions({
    onViewDetails: (row) => handleViewDetails(row, dispatch),
    onEdit: handleEditExpense,
    onDelete: handleDeleteExpense,
    onApprove: handleApproveExpense,
    onPost: handlePostExpense,
  })

  const filters = getExpenseFilters({
    onStatusChange: (value) =>
      handleStatusChange(value, setStatusFilter, setCurrentPage),
    onCategoryChange: (value) =>
      handleCategoryChange(value, setCategoryFilter, setCurrentPage),
    onDateRangeChange: (value) =>
      handleDateRangeChange(value, setDateRange, setCurrentPage),
    categories,
    currentCategoryFilter: categoryFilter,
    dateRange,
  })

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

  if (error && !companyId) {
    return (
      <PageWrapper style={{ backgroundColor: paperBg }}>
        <Container
          size="xxl"
          px={0}
        >
          <PageHeader
            title="Expense Management"
            description="Track and manage expenses"
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

  const currencyCode = getCurrencyCode(companySettings)
  const totalAmount = stats.totalAmount.toLocaleString('en-UG', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })

  const monthlyAmount = stats.monthlyAmount.toLocaleString('en-UG', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })

  const systemGeneratedCount = expenses.filter(isSystemExpense).length

  return (
    <PageWrapper style={{ backgroundColor: paperBg }}>
      <Container
        size="xxl"
        px={0}
      >
        <PageHeader
          title="Expense Management"
          description={`Track and manage expenses - Total: ${totalAmount} ${currencyCode} | This Month: ${monthlyAmount} ${currencyCode}`}
          actions={headerActions}
          primaryAction={primaryAction}
        />

        {systemGeneratedCount > 0 && (
          <Alert
            icon={<IconInfoCircle size={16} />}
            title="Auto-Generated Expenses"
            color="violet"
            variant="light"
            mb="md"
          >
            {systemGeneratedCount} expense{systemGeneratedCount > 1 ? 's' : ''}{' '}
            automatically generated from purchase orders. These expenses are
            protected and cannot be edited or deleted manually.
          </Alert>
        )}

        <ContentTable
          columns={columns}
          data={expenses}
          loading={loading}
          searchPlaceholder="Search by number, description, invoice..."
          filters={filters}
          rowActions={rowActions}
          onSearch={debouncedSearch}
          pagination={true}
          totalCount={totalCount}
          currentPage={currentPage}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={(size) => {
            setPageSize(size)
            setCurrentPage(1)
          }}
          selectable={false}
        />
      </Container>
    </PageWrapper>
  )
}

export { ExpenseManagement }

