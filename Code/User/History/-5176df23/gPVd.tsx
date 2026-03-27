// src/pages/RolesPermissions/RolesPermissions.tsx
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  Container,
  Alert,
  useMantineTheme,
  useMantineColorScheme,
  Modal,
  Group,
  Badge,
  Text,
} from '@mantine/core'
import { useDispatch, useSelector } from 'react-redux'
import { AppDispatch, RootState } from '@app/core/store/store'
import { useDebouncedCallback } from '@mantine/hooks'
import { IconAlertCircle, IconKey } from '@tabler/icons-react'
import PageHeader from '@shared/components/tableHeader/TableHeader'
import ContentTable from '@shared/components/tableContent/TableContent'
import StatisticsCard from '@shared/components/statistics/StatisticsCard'
import { EnrichedRole } from './utils/roles.utils'
import { notifications } from '@mantine/notifications'
import { LayoutSkeleton } from '@shared/components/skeletons/Layout.skeleton'
import { PageWrapper } from '@shared/styles/PageWrapper'

import {
  fetchRolesData,
  fetchRoleStats,
  fetchPermissionsData,
} from './utils/roles.utils'
import {
  handleAddRole,
  handleExportPDF,
  handleExportExcel,
  handleView,
  handleEdit,
  handleDelete,
} from './handlers/roles.handlers'
import {
  getRoleColumns,
  getRoleHeaderActions,
  getRolePrimaryAction,
  getRoleRowActions,
  getRoleFilters,
  getStatisticsCardsData,
} from './RolesPermissions.config'
import { Permission } from './utils/permissions.utils'
import PermissionMatrix from './components/PermissionMatrix'

const RolesPermissions = () => {
  const theme = useMantineTheme()
  const { colorScheme } = useMantineColorScheme()
  const isDark = colorScheme === 'dark'

  const [roles, setRoles] = useState<EnrichedRole[]>([])
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [loading, setLoading] = useState(false)
  const [initializing, setInitializing] = useState(true)
  const [isFetching, setIsFetching] = useState(false)
  const isFirstRender = useRef(true)

  // Permission modal state
  const [selectedRoleForPermissions, setSelectedRoleForPermissions] =
    useState<EnrichedRole | null>(null)
  const [permissionsModalOpen, setPermissionsModalOpen] = useState(false)

  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState({ total: 0, system: 0, custom: 0, active: 0 })

  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(8)
  const [totalCount, setTotalCount] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [roleTypeFilter, setRoleTypeFilter] = useState('all')
  const [accessLevelFilter, setAccessLevelFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [permissionCoverageFilter, setPermissionCoverageFilter] = useState('all')

  const dispatch = useDispatch<AppDispatch>()
  const companyId = useSelector((state: RootState) => state.auth.company?.id)

  // ── Fetch helpers ─────────────────────────────────────────────────────────
  const fetchRoles = useCallback(async () => {
    if (isFetching) return
    try {
      setIsFetching(true)
      setLoading(true)
      setError(null)
      const rolesResult = await fetchRolesData({
        page: currentPage, pageSize, searchQuery,
        roleType: roleTypeFilter, accessLevel: accessLevelFilter,
        priority: priorityFilter, permissionCoverage: permissionCoverageFilter,
      })
      setRoles(rolesResult.rolesData)
      setTotalCount(rolesResult.totalCount)
    } catch (err) {
      setError('Failed to load roles. Please try again.')
      setRoles([])
      setTotalCount(0)
      notifications.show({ title: 'Error', message: 'Failed to fetch roles', color: 'red' })
    } finally {
      setLoading(false)
      setIsFetching(false)
    }
  }, [currentPage, pageSize, searchQuery, roleTypeFilter, accessLevelFilter, priorityFilter, permissionCoverageFilter, isFetching])

  const fetchAllData = useCallback(async () => {
    if (isFetching) return
    try {
      setIsFetching(true)
      setLoading(true)
      setError(null)
      const [statsData, rolesResult, permissionsResult] = await Promise.all([
        fetchRoleStats(),
        fetchRolesData({ page: currentPage, pageSize, searchQuery, roleType: roleTypeFilter, accessLevel: accessLevelFilter, priority: priorityFilter, permissionCoverage: permissionCoverageFilter }),
        fetchPermissionsData(),
      ])
      setStats(statsData)
      setRoles(rolesResult.rolesData)
      setTotalCount(rolesResult.totalCount)
      setPermissions(permissionsResult.permissionsData)
    } catch (err) {
      setError('Failed to load data. Please try again.')
      notifications.show({ title: 'Error', message: 'Failed to fetch data', color: 'red' })
    } finally {
      setLoading(false)
      setIsFetching(false)
    }
  }, [currentPage, pageSize, searchQuery, roleTypeFilter, accessLevelFilter, priorityFilter, permissionCoverageFilter, isFetching])

  useEffect(() => {
    fetchAllData().then(() => {
      setInitializing(false)
      isFirstRender.current = false
    })
  }, [])

  useEffect(() => {
    let timeoutId: NodeJS.Timeout
    const handleRoleUpdate = () => {
      if (!initializing && !isFetching) {
        clearTimeout(timeoutId)
        timeoutId = setTimeout(() => fetchAllData(), 300)
      }
    }
    window.addEventListener('roleUpdated', handleRoleUpdate)
    return () => { clearTimeout(timeoutId); window.removeEventListener('roleUpdated', handleRoleUpdate) }
  }, [initializing, isFetching, fetchAllData])

  useEffect(() => {
    if (isFirstRender.current) return
    if (!initializing && !isFetching) {
      const timeoutId = setTimeout(() => fetchRoles(), 300)
      return () => clearTimeout(timeoutId)
    }
  }, [currentPage, pageSize, searchQuery, roleTypeFilter, accessLevelFilter, priorityFilter, permissionCoverageFilter])

  // ── Handlers ──────────────────────────────────────────────────────────────
  const debouncedSearch = useDebouncedCallback((query: string) => {
    setSearchQuery(query)
    setCurrentPage(1)
  }, 400)

  const handleRefreshClick = useCallback(async () => {
    try { await fetchAllData() } catch (error: any) { console.error(error) }
  }, [fetchAllData])

  const handleLocalDelete = useCallback(
    async (row: EnrichedRole): Promise<void> => { await handleDelete(row, fetchAllData) },
    [fetchAllData],
  )

  const handleOpenPermissions = useCallback((role: EnrichedRole) => {
    setSelectedRoleForPermissions(role)
    setPermissionsModalOpen(true)
  }, [])

  const handleClosePermissions = useCallback(() => {
    setPermissionsModalOpen(false)
    setTimeout(() => setSelectedRoleForPermissions(null), 300)
  }, [])

  // ── Config ────────────────────────────────────────────────────────────────
  const columns = useMemo(
    () => getRoleColumns(permissions.length, theme),
    [permissions.length, theme],
  )

  const headerActions = useMemo(
    () =>
      getRoleHeaderActions({
        onExportPDF: () => handleExportPDF(columns, roles),
        onExportExcel: () => handleExportExcel(columns, roles),
        onRefresh: handleRefreshClick,
      }),
    [columns, roles, handleRefreshClick],
  )

  const primaryAction = useMemo(
    () => getRolePrimaryAction(() => handleAddRole(dispatch)),
    [dispatch],
  )

  const rowActions = useCallback(
    (row: EnrichedRole) => {
      const handlers = getRoleRowActions({
        onView: (row: EnrichedRole) => handleView(row, dispatch),
        onEdit: (row: EnrichedRole) => handleEdit(row, dispatch, permissions),
        onDelete: handleLocalDelete,
        onManagePermissions: handleOpenPermissions,
      })
      return handlers(row)
    },
    [dispatch, permissions, handleLocalDelete, handleOpenPermissions],
  )

  const filters = useMemo(
    () =>
      getRoleFilters({
        onRoleTypeChange: (value) => { setRoleTypeFilter(value); setCurrentPage(1) },
        onAccessLevelChange: (value) => { setAccessLevelFilter(value); setCurrentPage(1) },
        onPriorityChange: (value) => { setPriorityFilter(value); setCurrentPage(1) },
        onPermissionCoverageChange: (value) => { setPermissionCoverageFilter(value); setCurrentPage(1) },
        currentRoleTypeFilter: roleTypeFilter,
        currentAccessLevelFilter: accessLevelFilter,
        currentPriorityFilter: priorityFilter,
        currentPermissionCoverageFilter: permissionCoverageFilter,
      }),
    [roleTypeFilter, accessLevelFilter, priorityFilter, permissionCoverageFilter],
  )

  const statisticsData = useMemo(
    () => getStatisticsCardsData(stats, theme),
    [stats, theme],
  )

  // ── Render ────────────────────────────────────────────────────────────────
  if (initializing) {
    return (
      <PageWrapper>
        <Container size="xxl" px={0}>
          <LayoutSkeleton />
        </Container>
      </PageWrapper>
    )
  }

  if (error && roles.length === 0 && !loading) {
    return (
      <PageWrapper>
        <Container size="xxl" px={0}>
          <PageHeader
            title="Roles & Permissions Management"
            description="Manage roles, permissions, and access control"
            actions={headerActions}
            primaryAction={primaryAction}
          />
          <Alert icon={<IconAlertCircle size={16} />} title="Error Loading Data" color="red" mt="md" radius="md">
            {error}
          </Alert>
        </Container>
      </PageWrapper>
    )
  }

  return (
    <PageWrapper>
      <Container size="xxl" px={0}>
        <PageHeader
          title="Roles & Permissions Management"
          description="Manage roles, permissions, and access control"
          actions={headerActions}
          primaryAction={primaryAction}
        />
        <StatisticsCard stats={statisticsData} />


  return (
    <PageWrapper>
      <Container size="xxl" px={0}>
        <PageHeader
          title="Roles & Permissions Management"
          description="Manage roles, permissions, and access control"
          actions={headerActions}
          primaryAction={primaryAction}
        />

        <StatisticsCard stats={statisticsData} />

        <ContentTable
          columns={columns}
          data={roles}
          loading={loading}
          searchPlaceholder="Search roles..."
          filters={filters}
          rowActions={rowActions}
          onSearch={debouncedSearch}
          pagination={true}
          totalCount={totalCount}
          currentPage={currentPage}
          pageSize={pageSize}
          onPageChange={(page) => setCurrentPage(page)}
          onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1) }}
        />

        {/* ── Permission Matrix Modal ───────────────────────────────── */}
        <Modal
          opened={permissionsModalOpen}
          onClose={handleClosePermissions}
          size="90%"
          radius="md"
          padding="lg"
          styles={{
            header: {
              background: isDark
                ? theme.colors.dark[7]
                : theme.colors[theme.primaryColor][0],
              borderBottom: `1px solid ${isDark ? theme.colors.dark[4] : theme.colors[theme.primaryColor][2]}`,
              paddingBottom: theme.spacing.sm,
            },
            body: {
              background: isDark ? theme.colors.dark[8] : theme.white,
              padding: theme.spacing.lg,
            },
            content: {
              background: isDark ? theme.colors.dark[8] : theme.white,
            },
          }}
          title={
            <Group gap="xs">
              <IconKey size={16} color={theme.colors[theme.primaryColor][isDark ? 4 : 6]} />
              <Text fw={600} size="sm">
                Permission Matrix
              </Text>
              {selectedRoleForPermissions && (
                <>
                  <Text size="sm" c="dimmed">—</Text>
                  <Badge color={theme.primaryColor} variant="light" size="sm">
                    {selectedRoleForPermissions.role_name}
                  </Badge>
                </>
              )}
            </Group>
          }
        >
          <PermissionMatrix
            roles={roles}
            permissions={permissions}
            onUpdate={fetchAllData}
            preselectedRoleId={
              selectedRoleForPermissions?.id?.toString() ?? null
            }
          />
        </Modal>
      </Container>
    </PageWrapper>
  )


export default RolesPermissions
