import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Text,
  Box,
  Group,
  Stack,
  Badge,
  Progress,
  Table,
  ActionIcon,
  Loader,
  Center,
  Paper,
  Avatar,
  Divider,
  ScrollArea,
  Grid,
  rem,
  Alert,
  RingProgress,
  SimpleGrid,
  Card,
  Skeleton,
  SegmentedControl,
  Tabs,
} from '@mantine/core'
import { AreaChart, DonutChart, BarChart, LineChart } from '@mantine/charts'
import {
  IconTrendingUp,
  IconTrendingDown,
  IconMinus,
  IconShoppingCart,
  IconUsers,
  IconPackage,
  IconAlertTriangle,
  IconCurrencyDollar,
  IconRefresh,
  IconReceipt,
  IconCreditCard,
  IconChartBar,
  IconTruck,
  IconShoppingBag,
  IconInfoCircle,
  IconLock,
  IconCash,
  IconWallet,
  IconPigMoney,
  IconChartLine,
  IconScale,
  IconReportMoney,
  IconArrowUpRight,
  IconArrowDownRight,
  IconBuildingStore,
  IconMapPin,
  IconTag,
  IconDiscount,
} from '@tabler/icons-react'
import { useSelector } from 'react-redux'
import { DashboardLayout as Layout } from '@layout/dashboard'
import { supabase } from '@app/core/supabase/Supabase.utils'
import {
  selectUserRoleId,
  selectCompanyId,
  selectDefaultStoreId,
  selectDefaultAreaId,
  selectCompanyName,
  selectUserFullName,
} from '@features/authentication/authSlice'
import type { RootState } from '@app/core/store/store'

// Import types
import type {
  DashboardData,
  StatCardProps,
  UserRole,
  DashboardPermissions,
  DataScope,
  RecentPurchaseOrder,
} from './types/dashboard.types'

// Import utilities
import {
  getDashboardPermissions,
  getAccessLevel,
  canAccessDashboard,
  getDashboardTitle,
  getDashboardDescription,
  formatCurrency,
  formatCurrencyCompact,
  formatPercentage,
  formatDate,
  getVisibleSections,
  getTrendColor,
  getVarianceColor,
  formatRatio,
  getRoleMeta,
} from './utils/dashboard.utils'

// Import handlers
import {
  buildDataScope,
  handleRefreshDashboard,
  invalidateDashboardCache,
} from './handlers/dashboard.handlers'
import { PageWrapper } from '@shared/styles/PageWrapper'

// ─── StatCard extracted outside Dashboard to prevent remounts on re-render ───
const StatCard = React.memo<StatCardProps>(
  ({
    title,
    value,
    icon: Icon,
    color,
    subtitle,
    trend,
    onClick,
    isExpenseMetric,
  }) => {
    // Context-aware trend logic:
    // For expenses: going UP (positive trend) = bad (red), going DOWN = good (green)
    // For revenue/profit/sales: going UP = good (green), going DOWN = bad (red)
    const effectiveTrend =
      isExpenseMetric && trend !== undefined ? -trend : trend

    const TrendIcon =
      effectiveTrend !== undefined
        ? effectiveTrend > 0
          ? IconTrendingUp
          : effectiveTrend < 0
            ? IconTrendingDown
            : IconMinus
        : null

    const trendColor =
      effectiveTrend !== undefined
        ? effectiveTrend > 0
          ? 'var(--mantine-color-green-6)'
          : effectiveTrend < 0
            ? 'var(--mantine-color-red-6)'
            : 'var(--mantine-color-gray-6)'
        : undefined

    const trendMantineColor =
      effectiveTrend !== undefined
        ? effectiveTrend > 0
          ? 'green.6'
          : effectiveTrend < 0
            ? 'red.6'
            : 'gray.6'
        : 'gray.6'

    return (
      <Paper
        p="xl"
        radius="md"
        withBorder
        onClick={onClick}
        h="100%"
        style={{
          transition: 'all 0.3s ease',
          cursor: onClick ? 'pointer' : 'default',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
        onMouseEnter={(e) => {
          if (onClick) {
            e.currentTarget.style.transform = 'translateY(-4px)'
            e.currentTarget.style.boxShadow =
              '0 12px 24px -4px rgba(0, 0, 0, 0.15)'
          }
        }}
        onMouseLeave={(e) => {
          if (onClick) {
            e.currentTarget.style.transform = 'translateY(0)'
            e.currentTarget.style.boxShadow = ''
          }
        }}
      >
        <Group
          justify="space-between"
          mb="md"
        >
          <Text
            size="sm"
            c="dimmed"
            fw={500}
          >
            {title}
          </Text>
          <Box
            style={{
              width: rem(48),
              height: rem(48),
              borderRadius: rem(12),
              background: `linear-gradient(135deg, ${color}15 0%, ${color}30 100%)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon
              size={24}
              color={color}
            />
          </Box>
        </Group>
        <Text
          size={rem(32)}
          fw={700}
          mb={4}
        >
          {value}
        </Text>
        {subtitle && (
          <Text
            size="xs"
            c="dimmed"
            mb="xs"
          >
            {subtitle}
          </Text>
        )}
        {trend !== undefined && TrendIcon && (
          <Group gap={4}>
            <TrendIcon
              size={16}
              color={trendColor}
            />
            <Text
              size="xs"
              c={trendMantineColor}
              fw={600}
            >
              {trend === 0
                ? 'No change from last month'
                : `${Math.abs(trend)}% from last month`}
            </Text>
          </Group>
        )}
      </Paper>
    )
  },
)
StatCard.displayName = 'StatCard'

const Dashboard: React.FC = () => {
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const [revenueChartRange, setRevenueChartRange] = useState<
    '7d' | '30d' | 'month'
  >('7d')

  // BUG-01 fix: Read real user data from Redux instead of hardcoded values
  const roleId = useSelector(selectUserRoleId)
  const companyId = useSelector(selectCompanyId)
  const defaultStoreId = useSelector(selectDefaultStoreId)
  const defaultAreaId = useSelector(selectDefaultAreaId)
  const companyName = useSelector(selectCompanyName)
  const userFullName = useSelector(selectUserFullName)

  // Navbar area/store selection — takes priority over user's default
  const navbarSelectedStore = useSelector(
    (state: RootState) => state.areaStore.selectedStore,
  )
  const navbarSelectedArea = useSelector(
    (state: RootState) => state.areaStore.selectedArea,
  )

  // Effective IDs: navbar selection overrides the user's default store/area
  const storeId = navbarSelectedStore?.id ?? defaultStoreId
  const areaId = navbarSelectedArea?.id ?? defaultAreaId

  // Label shown in header to indicate active filter
  const activeFilterLabel = navbarSelectedStore
    ? navbarSelectedStore.store_name
    : navbarSelectedArea
      ? navbarSelectedArea.area_name
      : null

  // BUG-01 fix: Derive role + permissions + scope from real authenticated user
  const userRole = useMemo<UserRole>(() => {
    const rid = roleId ?? 0
    return {
      role_id: rid,
      role_name: String(rid),
      access_level: getAccessLevel(rid),
      store_id: storeId ?? undefined,
      area_id: areaId ?? undefined,
    }
  }, [roleId, storeId, areaId])

  const permissions = useMemo<DashboardPermissions>(
    () => getDashboardPermissions(userRole.role_id, userRole.role_name),
    [userRole.role_id, userRole.role_name],
  )

  const [dataScope, setDataScope] = useState<DataScope>({
    companyId: companyId ?? 0,
  })

  const [dashboardData, setDashboardData] = useState<DashboardData>({
    sales: {
      total: 0,
      today: 0,
      thisMonth: 0,
      trend: 0,
      recentTransactions: [],
      chartData: [],
      byType: [],
      byPaymentMethod: [],
      totalDiscounts: 0,
    },
    purchases: {
      total: 0,
      pending: 0,
      thisMonth: 0,
      trend: 0,
      chartData: [],
    },
    customers: {
      total: 0,
      active: 0,
      topCustomers: [],
    },
    suppliers: {
      total: 0,
      active: 0,
      topSuppliers: [],
    },
    inventory: {
      totalProducts: 0,
      lowStock: 0,
      expiringSoon: 0,
      expired: 0,
      totalValue: 0,
      categoryDistribution: [],
    },
    credit: {
      totalOutstanding: 0,
      overdue: 0,
      customers: 0,
      suppliers: 0,
    },
    financial: {
      revenue: {
        total: 0,
        today: 0,
        thisMonth: 0,
        lastMonth: 0,
        trend: 0,
        byCategory: [],
        chartData: [],
      },
      expenses: {
        total: 0,
        today: 0,
        thisMonth: 0,
        lastMonth: 0,
        trend: 0,
        byCategory: [],
        chartData: [],
        topExpenses: [],
      },
      profit: {
        gross: 0,
        net: 0,
        margin: 0,
        thisMonth: 0,
        lastMonth: 0,
        trend: 0,
      },
      cashFlow: {
        operating: 0,
        investing: 0,
        financing: 0,
        total: 0,
        trend: 0,
        chartData: [],
      },
      accounts: {
        totalAssets: 0,
        totalLiabilities: 0,
        totalEquity: 0,
        currentRatio: 0,
        quickRatio: 0,
        debtToEquity: 0,
        accountBalances: [],
      },
      budgetComparison: {
        budgetedRevenue: 0,
        actualRevenue: 0,
        budgetedExpenses: 0,
        actualExpenses: 0,
        revenueVariance: 0,
        expenseVariance: 0,
        variancePercentage: 0,
        byCategory: [],
      },
    },
    notifications: [],
    storePerformance: [],
    monthlyTrend: [],
    pharmacyKPIs: {
      prescriptionFillRate: 0,
      avgTransactionValue: 0,
      inventoryTurnoverRate: 0,
      returnRate: 0,
      totalSalesCount: 0,
    },
  })

  // Rebuild dataScope whenever auth user context OR navbar selection changes
  // storeId/areaId already reflect the navbar selection (see selectors above)
  useEffect(() => {
    if (!companyId) return
    invalidateDashboardCache(dataScope) // bust cache on selection change
    buildDataScope(
      companyId,
      userRole.role_id,
      storeId ?? undefined,
      areaId ?? undefined,
    ).then((scope) => setDataScope(scope))
  }, [companyId, userRole.role_id, storeId, areaId])

  /**
   * Load dashboard data
   */
  const loadDashboardData = useCallback(async () => {
    await handleRefreshDashboard(
      dataScope,
      permissions,
      setLoading,
      setDashboardData,
      setErrors,
    )
  }, [dataScope, permissions])

  /**
   * Load on mount and when scope changes
   */
  useEffect(() => {
    if (dataScope.companyId) {
      loadDashboardData()
    }
  }, [loadDashboardData])

  /**
   * Refresh handler — always bypasses cache (manual user action)
   */
  const handleRefresh = useCallback(() => {
    handleRefreshDashboard(
      dataScope,
      permissions,
      setLoading,
      setDashboardData,
      setErrors,
      true, // forceRefresh
    )
  }, [dataScope, permissions])

  // Skeleton loading - per section instead of full-page block
  if (
    loading &&
    !dashboardData.sales.total &&
    !dashboardData.financial.revenue.total
  ) {
    return (
      <PageWrapper>
        <Group
          justify="space-between"
          mb="xl"
        >
          <Stack gap="xs">
            <Skeleton
              height={40}
              width={300}
            />
            <Skeleton
              height={20}
              width={200}
            />
          </Stack>
          <Skeleton
            height={36}
            width={36}
            radius="md"
          />
        </Group>
        <Grid
          gutter="lg"
          mb="xl"
        >
          {[1, 2, 3, 4].map((i) => (
            <Grid.Col
              key={i}
              span={{ base: 12, xs: 6, md: 3 }}
            >
              <Skeleton
                height={130}
                radius="md"
              />
            </Grid.Col>
          ))}
        </Grid>
        <Grid
          gutter="lg"
          mb="xl"
        >
          <Grid.Col span={{ base: 12, md: 8 }}>
            <Skeleton
              height={350}
              radius="md"
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 4 }}>
            <Skeleton
              height={350}
              radius="md"
            />
          </Grid.Col>
        </Grid>
        <Skeleton
          height={400}
          radius="md"
        />
      </PageWrapper>
    )
  }

  // Get visible sections based on permissions
  const visibleSections = getVisibleSections(permissions)

  return (
    <PageWrapper>
      {/* Header */}
      <Group
        justify="space-between"
        mb="xl"
      >
        <div>
          <Group
            gap="sm"
            mb="xs"
            align="center"
          >
            <Text
              size={rem(32)}
              fw={700}
            >
              {getDashboardTitle(userRole.role_id, userRole.role_name)}
            </Text>
            {(() => {
              const meta = getRoleMeta(userRole.role_id)
              return (
                <Badge
                  size="lg"
                  variant="gradient"
                  gradient={{
                    from: meta.color,
                    to: meta.color === 'violet' ? 'indigo' : meta.color,
                    deg: 135,
                  }}
                  style={{ alignSelf: 'center' }}
                >
                  {meta.label}
                </Badge>
              )
            })()}
          </Group>
          <Group
            gap="xs"
            align="center"
          >
            <Text
              c="dimmed"
              size="sm"
            >
              {getDashboardDescription(userRole.role_id, userRole.role_name)}
            </Text>
            {companyName && (
              <>
                <Text
                  c="dimmed"
                  size="sm"
                >
                  ·
                </Text>
                <Text
                  c="dimmed"
                  size="sm"
                  fw={500}
                >
                  {companyName}
                </Text>
              </>
            )}
            {userFullName && (
              <>
                <Text
                  c="dimmed"
                  size="sm"
                >
                  ·
                </Text>
                <Text
                  c="dimmed"
                  size="sm"
                >
                  {userFullName}
                </Text>
              </>
            )}
            {activeFilterLabel && (
              <>
                <Text
                  c="dimmed"
                  size="sm"
                >
                  ·
                </Text>
                <Badge
                  size="sm"
                  variant="light"
                  color={navbarSelectedStore ? 'blue' : 'teal'}
                  leftSection={
                    navbarSelectedStore ? (
                      <IconBuildingStore size={12} />
                    ) : (
                      <IconMapPin size={12} />
                    )
                  }
                >
                  {activeFilterLabel}
                </Badge>
              </>
            )}
          </Group>
        </div>
        <Group gap="xs">
          <ActionIcon
            size="lg"
            variant="light"
            onClick={handleRefresh}
            loading={loading}
          >
            <IconRefresh size={20} />
          </ActionIcon>
        </Group>
      </Group>

      {/* Error Alert */}
      {errors.length > 0 && (
        <Alert
          icon={<IconInfoCircle size={16} />}
          title="Some data couldn't be loaded"
          color="yellow"
          mb="xl"
          onClose={() => setErrors([])}
          withCloseButton
        >
          {errors.join(', ')}
        </Alert>
      )}

      {/* Financial Overview - Top Priority */}
      {visibleSections.showFinancialOverview && (
        <>
          <Text
            size="xl"
            fw={700}
            mb="md"
          >
            Financial Overview
          </Text>
          <Grid
            gutter="lg"
            mb="xl"
            align="stretch"
          >
            <Grid.Col span={{ base: 12, xs: 6, md: 3 }}>
              <StatCard
                title="Revenue (This Month)"
                value={formatCurrencyCompact(
                  dashboardData.financial.revenue.thisMonth,
                )}
                icon={IconCurrencyDollar}
                color="#10b981"
                subtitle={
                  dashboardData.financial.revenue.lastMonth > 0
                    ? `${formatCurrencyCompact(dashboardData.financial.revenue.lastMonth)} last month`
                    : `${formatCurrency(dashboardData.financial.revenue.today)} today`
                }
                trend={dashboardData.financial.revenue.trend}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, xs: 6, md: 3 }}>
              <StatCard
                title="Expenses (This Month)"
                value={formatCurrencyCompact(
                  dashboardData.financial.expenses.thisMonth,
                )}
                icon={IconWallet}
                color="#ef4444"
                subtitle={
                  dashboardData.financial.expenses.lastMonth > 0
                    ? `${formatCurrencyCompact(dashboardData.financial.expenses.lastMonth)} last month`
                    : `${formatCurrency(dashboardData.financial.expenses.today)} today`
                }
                trend={dashboardData.financial.expenses.trend}
                isExpenseMetric
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, xs: 6, md: 3 }}>
              <StatCard
                title="Net Profit"
                value={formatCurrencyCompact(
                  dashboardData.financial.profit.net,
                )}
                icon={IconPigMoney}
                color="#8b5cf6"
                subtitle={
                  dashboardData.financial.profit.lastMonth !== 0
                    ? `${formatCurrencyCompact(dashboardData.financial.profit.lastMonth)} last month`
                    : `${formatPercentage(dashboardData.financial.profit.margin)} margin`
                }
                trend={dashboardData.financial.profit.trend}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, xs: 6, md: 3 }}>
              <StatCard
                title="Cash Flow (3 Months)"
                value={formatCurrencyCompact(
                  dashboardData.financial.cashFlow.total,
                )}
                icon={IconCash}
                color="#3b82f6"
                subtitle={`${formatCurrency(dashboardData.financial.cashFlow.operating)} from operations`}
              />
            </Grid.Col>
          </Grid>
        </>
      )}

      {/* Operational Metrics */}
      <Text
        size="xl"
        fw={700}
        mb="md"
      >
        Operational Metrics
      </Text>
      <Grid
        gutter="lg"
        mb="xl"
        align="stretch"
      >
        {visibleSections.showSalesCard && (
          <Grid.Col span={{ base: 12, xs: 6, md: 3 }}>
            <StatCard
              title="Today's Sales"
              value={formatCurrency(dashboardData.sales.today)}
              icon={IconShoppingCart}
              color="#8b5cf6"
              subtitle={`${formatCurrency(dashboardData.sales.thisMonth)} this month`}
              trend={dashboardData.sales.trend}
            />
          </Grid.Col>
        )}
        {visibleSections.showCustomersCard && (
          <Grid.Col span={{ base: 12, xs: 6, md: 3 }}>
            <StatCard
              title="Total Customers"
              value={dashboardData.customers.total.toLocaleString()}
              icon={IconUsers}
              color="#3b82f6"
              subtitle={`${dashboardData.customers.active} active customers`}
            />
          </Grid.Col>
        )}
        {visibleSections.showInventoryCard && (
          <Grid.Col span={{ base: 12, xs: 6, md: 3 }}>
            <StatCard
              title="Low Stock Items"
              value={dashboardData.inventory.lowStock}
              icon={IconAlertTriangle}
              color="#ef4444"
              subtitle={`${dashboardData.inventory.expiringSoon} expiring soon`}
            />
          </Grid.Col>
        )}
        {visibleSections.showInventoryCard && (
          <Grid.Col span={{ base: 12, xs: 6, md: 3 }}>
            <StatCard
              title="Inventory Value"
              value={formatCurrencyCompact(dashboardData.inventory.totalValue)}
              icon={IconPackage}
              color="#0ea5e9"
              subtitle={`${dashboardData.inventory.totalProducts} products in stock`}
            />
          </Grid.Col>
        )}
      </Grid>

      {/* ── Pharmacy KPIs ── */}
      {visibleSections.showPharmacyKPIs &&
        dashboardData.pharmacyKPIs.totalSalesCount > 0 && (
          <>
            <Text
              size="xl"
              fw={700}
              mb="md"
            >
              Pharmacy KPIs
            </Text>
            <SimpleGrid
              cols={{ base: 2, sm: 4 }}
              mb="xl"
            >
              <Paper
                p="lg"
                withBorder
                radius="md"
              >
                <Text
                  size="xs"
                  c="dimmed"
                  mb={4}
                >
                  Prescription Fill Rate
                </Text>
                <Text
                  size="xl"
                  fw={700}
                  c="blue.6"
                >
                  {dashboardData.pharmacyKPIs.prescriptionFillRate}%
                </Text>
                <Progress
                  value={dashboardData.pharmacyKPIs.prescriptionFillRate}
                  color="blue"
                  size="xs"
                  mt="xs"
                />
                <Text
                  size="xs"
                  c="dimmed"
                  mt={4}
                >
                  of sales are prescriptions
                </Text>
              </Paper>

              <Paper
                p="lg"
                withBorder
                radius="md"
              >
                <Text
                  size="xs"
                  c="dimmed"
                  mb={4}
                >
                  Avg Transaction Value
                </Text>
                <Text
                  size="xl"
                  fw={700}
                  c="violet.6"
                >
                  {formatCurrencyCompact(
                    dashboardData.pharmacyKPIs.avgTransactionValue,
                  )}
                </Text>
                <Text
                  size="xs"
                  c="dimmed"
                  mt={4}
                >
                  from{' '}
                  {dashboardData.pharmacyKPIs.totalSalesCount.toLocaleString()}{' '}
                  sales this month
                </Text>
              </Paper>

              <Paper
                p="lg"
                withBorder
                radius="md"
              >
                <Text
                  size="xs"
                  c="dimmed"
                  mb={4}
                >
                  Inventory Turnover
                </Text>
                <Text
                  size="xl"
                  fw={700}
                  c="teal.6"
                >
                  {dashboardData.pharmacyKPIs.inventoryTurnoverRate.toFixed(2)}x
                </Text>
                <Text
                  size="xs"
                  c="dimmed"
                  mt={4}
                >
                  revenue / inventory value ratio
                </Text>
              </Paper>

              <Paper
                p="lg"
                withBorder
                radius="md"
              >
                <Text
                  size="xs"
                  c="dimmed"
                  mb={4}
                >
                  Cancellation Rate
                </Text>
                <Text
                  size="xl"
                  fw={700}
                  c={
                    dashboardData.pharmacyKPIs.returnRate > 10
                      ? 'red.6'
                      : 'green.6'
                  }
                >
                  {dashboardData.pharmacyKPIs.returnRate}%
                </Text>
                <Progress
                  value={dashboardData.pharmacyKPIs.returnRate}
                  color={
                    dashboardData.pharmacyKPIs.returnRate > 10 ? 'red' : 'green'
                  }
                  size="xs"
                  mt="xs"
                />
                <Text
                  size="xs"
                  c="dimmed"
                  mt={4}
                >
                  cancelled / voided sales
                </Text>
              </Paper>
            </SimpleGrid>
          </>
        )}

      {/* Financial Charts Row */}
      {visibleSections.showFinancialOverview && (
        <>
          <Text
            size="xl"
            fw={700}
            mb="md"
          >
            Financial Performance
          </Text>
          <Grid
            gutter="lg"
            mb="xl"
          >
            {/* Revenue vs Expenses Chart */}
            <Grid.Col span={{ base: 12, md: 8 }}>
              <Paper
                p="xl"
                withBorder
                radius="md"
              >
                <Group
                  justify="space-between"
                  mb="md"
                >
                  <Group gap="xs">
                    <IconChartLine size={24} />
                    <Text
                      size="lg"
                      fw={600}
                    >
                      Revenue vs Expenses
                    </Text>
                  </Group>
                  <SegmentedControl
                    size="xs"
                    value={revenueChartRange}
                    onChange={(v) =>
                      setRevenueChartRange(v as '7d' | '30d' | 'month')
                    }
                    data={[
                      { label: '7D', value: '7d' },
                      { label: '30D', value: '30d' },
                      { label: 'Monthly', value: 'month' },
                    ]}
                  />
                </Group>
                {revenueChartRange === 'month' ? (
                  // Monthly view — use 12-month trend, filtered to months with data
                  dashboardData.monthlyTrend.length > 0 ? (
                    <AreaChart
                      h={300}
                      data={dashboardData.monthlyTrend}
                      dataKey="month"
                      series={[
                        { name: 'revenue', color: 'green.6', label: 'Revenue' },
                        { name: 'expenses', color: 'red.6', label: 'Expenses' },
                      ]}
                      curveType="monotone"
                      withLegend
                      tooltipAnimationDuration={200}
                    />
                  ) : (
                    <Center h={300}>
                      <Text c="dimmed">No monthly data available</Text>
                    </Center>
                  )
                ) : revenueChartRange === '30d' ? (
                  // 30-day view — dedicated 30-day dataset
                  dashboardData.financial.revenue.chartData30d.length > 0 ? (
                    <AreaChart
                      h={300}
                      data={dashboardData.financial.revenue.chartData30d.map(
                        (point, idx) => ({
                          date: point.date,
                          revenue: point.sales,
                          expenses:
                            dashboardData.financial.expenses.chartData30d[idx]
                              ?.expenses || 0,
                        }),
                      )}
                      dataKey="date"
                      series={[
                        { name: 'revenue', color: 'green.6', label: 'Revenue' },
                        { name: 'expenses', color: 'red.6', label: 'Expenses' },
                      ]}
                      curveType="monotone"
                      withLegend
                      tooltipAnimationDuration={200}
                    />
                  ) : (
                    <Center h={300}>
                      <Text c="dimmed">No data available</Text>
                    </Center>
                  )
                ) : // 7-day view — dedicated 7-day dataset
                dashboardData.financial.revenue.chartData.length > 0 ? (
                  <AreaChart
                    h={300}
                    data={dashboardData.financial.revenue.chartData.map(
                      (point, idx) => ({
                        date: point.date,
                        revenue: point.sales,
                        expenses:
                          dashboardData.financial.expenses.chartData[idx]
                            ?.expenses || 0,
                      }),
                    )}
                    dataKey="date"
                    series={[
                      { name: 'revenue', color: 'green.6', label: 'Revenue' },
                      { name: 'expenses', color: 'red.6', label: 'Expenses' },
                    ]}
                    curveType="monotone"
                    withLegend
                    tooltipAnimationDuration={200}
                  />
                ) : (
                  <Center h={300}>
                    <Text c="dimmed">No data available</Text>
                  </Center>
                )}
              </Paper>
            </Grid.Col>

            {/* Profit Margin & Financial Health */}
            <Grid.Col span={{ base: 12, md: 4 }}>
              <Paper
                p="xl"
                withBorder
                radius="md"
                h="100%"
              >
                <Group
                  gap="xs"
                  mb="md"
                >
                  <IconScale size={24} />
                  <Text
                    size="lg"
                    fw={600}
                  >
                    Financial Health
                  </Text>
                </Group>
                <Stack gap="lg">
                  {/* Profit Margin — use last month when this month has minimal data */}
                  {(() => {
                    const useLastMonth =
                      dashboardData.financial.profit.thisMonth === 0 ||
                      (dashboardData.financial.revenue.thisMonth < 10000 &&
                        dashboardData.financial.revenue.lastMonth > 0)
                    const displayMargin = useLastMonth
                      ? dashboardData.financial.revenue.lastMonth > 0
                        ? (dashboardData.financial.profit.lastMonth /
                            dashboardData.financial.revenue.lastMonth) *
                          100
                        : 0
                      : dashboardData.financial.profit.margin
                    const clampedMargin = Math.min(
                      Math.max(displayMargin, 0),
                      100,
                    )
                    const marginColor =
                      clampedMargin >= 20
                        ? 'green.6'
                        : clampedMargin >= 10
                          ? 'yellow.6'
                          : 'red.6'
                    return (
                      <div>
                        <Group
                          justify="space-between"
                          mb={4}
                        >
                          <Text
                            size="sm"
                            c="dimmed"
                          >
                            Profit Margin{' '}
                            {useLastMonth ? '(Last Month)' : '(This Month)'}
                          </Text>
                          {useLastMonth && (
                            <Badge
                              size="xs"
                              variant="light"
                              color="gray"
                            >
                              Feb data
                            </Badge>
                          )}
                        </Group>
                        <Group
                          justify="space-between"
                          align="center"
                        >
                          <Stack gap={2}>
                            <Text
                              size="xl"
                              fw={700}
                              c={marginColor}
                            >
                              {displayMargin.toFixed(1)}%
                            </Text>
                            <Text
                              size="xs"
                              c="dimmed"
                            >
                              Net:{' '}
                              {formatCurrencyCompact(
                                useLastMonth
                                  ? dashboardData.financial.profit.lastMonth
                                  : dashboardData.financial.profit.net,
                              )}
                            </Text>
                          </Stack>
                          <RingProgress
                            size={80}
                            thickness={8}
                            sections={[
                              { value: clampedMargin, color: marginColor },
                            ]}
                            label={
                              <Text
                                size="xs"
                                ta="center"
                                fw={700}
                              >
                                {clampedMargin.toFixed(0)}%
                              </Text>
                            }
                          />
                        </Group>
                      </div>
                    )
                  })()}
                  <Divider />
                  {/* Profit Breakdown — always meaningful */}
                  <div>
                    <Text
                      size="sm"
                      c="dimmed"
                      mb="xs"
                    >
                      Profit Breakdown (Last Month)
                    </Text>
                    <Stack gap="xs">
                      <Group justify="space-between">
                        <Text
                          size="xs"
                          c="dimmed"
                        >
                          Gross Revenue
                        </Text>
                        <Text
                          size="xs"
                          fw={500}
                          c="green.6"
                        >
                          {formatCurrencyCompact(
                            dashboardData.financial.revenue.lastMonth,
                          )}
                        </Text>
                      </Group>
                      <Group justify="space-between">
                        <Text
                          size="xs"
                          c="dimmed"
                        >
                          Total Expenses
                        </Text>
                        <Text
                          size="xs"
                          fw={500}
                          c="red.6"
                        >
                          −{' '}
                          {formatCurrencyCompact(
                            dashboardData.financial.expenses.lastMonth,
                          )}
                        </Text>
                      </Group>
                      <Divider size="xs" />
                      <Group justify="space-between">
                        <Text
                          size="xs"
                          fw={600}
                        >
                          Net Profit
                        </Text>
                        <Text
                          size="xs"
                          fw={700}
                          c={
                            dashboardData.financial.profit.lastMonth >= 0
                              ? 'green.7'
                              : 'red.7'
                          }
                        >
                          {formatCurrencyCompact(
                            dashboardData.financial.profit.lastMonth,
                          )}
                        </Text>
                      </Group>
                      <Group justify="space-between">
                        <Text
                          size="xs"
                          c="dimmed"
                        >
                          Inventory Value
                        </Text>
                        <Text
                          size="xs"
                          fw={500}
                          c="blue.6"
                        >
                          {formatCurrencyCompact(
                            dashboardData.inventory.totalValue,
                          )}
                        </Text>
                      </Group>
                    </Stack>
                  </div>
                </Stack>
              </Paper>
            </Grid.Col>
          </Grid>
        </>
      )}

      {/* Revenue & Expense Breakdown */}
      {visibleSections.showFinancialOverview && (
        <Grid
          gutter="lg"
          mb="xl"
        >
          {/* Revenue by Category */}
          <Grid.Col span={{ base: 12, md: 6 }}>
            <Paper
              p="xl"
              withBorder
              radius="md"
            >
              <Group
                gap="xs"
                mb="md"
              >
                <IconReportMoney size={24} />
                <Text
                  size="lg"
                  fw={600}
                >
                  Revenue by Category
                </Text>
              </Group>
              {dashboardData.financial.revenue.byCategory.length > 0 ? (
                <Stack gap="md">
                  {dashboardData.financial.revenue.byCategory.map((cat) => (
                    <div key={cat.category}>
                      <Group
                        justify="apart"
                        mb={4}
                      >
                        <Text
                          size="sm"
                          fw={500}
                        >
                          {cat.category}
                        </Text>
                        <Text
                          size="sm"
                          fw={600}
                          c="green.6"
                        >
                          {formatCurrency(cat.amount)}
                        </Text>
                      </Group>
                      <Progress
                        value={cat.percentage}
                        color="green"
                        size="sm"
                      />
                      <Text
                        size="xs"
                        c="dimmed"
                        mt={2}
                      >
                        {formatPercentage(cat.percentage, 0)} of total
                      </Text>
                    </div>
                  ))}
                </Stack>
              ) : (
                <Center h={200}>
                  <Text c="dimmed">No revenue data</Text>
                </Center>
              )}
            </Paper>
          </Grid.Col>

          {/* Expense by Category */}
          <Grid.Col span={{ base: 12, md: 6 }}>
            <Paper
              p="xl"
              withBorder
              radius="md"
            >
              <Group
                gap="xs"
                mb="md"
              >
                <IconWallet size={24} />
                <Text
                  size="lg"
                  fw={600}
                >
                  Expenses by Category
                </Text>
              </Group>
              {dashboardData.financial.expenses.byCategory.length > 0 ? (
                <Stack gap="md">
                  {dashboardData.financial.expenses.byCategory.map((cat) => (
                    <div key={cat.category}>
                      <Group
                        justify="apart"
                        mb={4}
                      >
                        <Text
                          size="sm"
                          fw={500}
                        >
                          {cat.category}
                        </Text>
                        <Text
                          size="sm"
                          fw={600}
                          c="red.6"
                        >
                          {formatCurrency(cat.amount)}
                        </Text>
                      </Group>
                      <Progress
                        value={cat.percentage}
                        color="red"
                        size="sm"
                      />
                      <Text
                        size="xs"
                        c="dimmed"
                        mt={2}
                      >
                        {formatPercentage(cat.percentage, 0)} of total
                      </Text>
                    </div>
                  ))}
                </Stack>
              ) : (
                <Center h={200}>
                  <Text c="dimmed">No expense data</Text>
                </Center>
              )}
            </Paper>
          </Grid.Col>
        </Grid>
      )}

      {/* Budget vs Actual */}
      {visibleSections.showBudgetComparison &&
        dashboardData.financial.budgetComparison.budgetedRevenue > 0 && (
          <Paper
            p="xl"
            withBorder
            radius="md"
            mb="xl"
          >
            <Group
              justify="space-between"
              mb="md"
            >
              <Group gap="xs">
                <IconChartBar size={24} />
                <Text
                  size="xl"
                  fw={600}
                >
                  Budget vs Actual
                </Text>
              </Group>
              <Badge
                color={getVarianceColor(
                  dashboardData.financial.budgetComparison.variancePercentage,
                )}
                size="lg"
                variant="light"
              >
                {formatPercentage(
                  dashboardData.financial.budgetComparison.variancePercentage,
                )}{' '}
                variance
              </Badge>
            </Group>
            <Grid gutter="lg">
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <Card withBorder>
                  <Text
                    size="sm"
                    c="dimmed"
                    mb="xs"
                  >
                    Revenue
                  </Text>
                  <Group
                    justify="apart"
                    mb="xs"
                  >
                    <Text size="xs">Budget</Text>
                    <Text
                      size="sm"
                      fw={500}
                    >
                      {formatCurrency(
                        dashboardData.financial.budgetComparison
                          .budgetedRevenue,
                      )}
                    </Text>
                  </Group>
                  <Group
                    justify="apart"
                    mb="xs"
                  >
                    <Text size="xs">Actual</Text>
                    <Text
                      size="sm"
                      fw={600}
                      c="green.6"
                    >
                      {formatCurrency(
                        dashboardData.financial.budgetComparison.actualRevenue,
                      )}
                    </Text>
                  </Group>
                  <Group justify="apart">
                    <Text
                      size="xs"
                      fw={500}
                    >
                      Variance
                    </Text>
                    <Badge
                      color={getVarianceColor(
                        dashboardData.financial.budgetComparison
                          .revenueVariance,
                      )}
                      variant="light"
                    >
                      {formatCurrency(
                        dashboardData.financial.budgetComparison
                          .revenueVariance,
                      )}
                    </Badge>
                  </Group>
                </Card>
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <Card withBorder>
                  <Text
                    size="sm"
                    c="dimmed"
                    mb="xs"
                  >
                    Expenses
                  </Text>
                  <Group
                    justify="apart"
                    mb="xs"
                  >
                    <Text size="xs">Budget</Text>
                    <Text
                      size="sm"
                      fw={500}
                    >
                      {formatCurrency(
                        dashboardData.financial.budgetComparison
                          .budgetedExpenses,
                      )}
                    </Text>
                  </Group>
                  <Group
                    justify="apart"
                    mb="xs"
                  >
                    <Text size="xs">Actual</Text>
                    <Text
                      size="sm"
                      fw={600}
                      c="red.6"
                    >
                      {formatCurrency(
                        dashboardData.financial.budgetComparison.actualExpenses,
                      )}
                    </Text>
                  </Group>
                  <Group justify="apart">
                    <Text
                      size="xs"
                      fw={500}
                    >
                      Variance
                    </Text>
                    <Badge
                      color={getVarianceColor(
                        dashboardData.financial.budgetComparison
                          .expenseVariance,
                        true,
                      )}
                      variant="light"
                    >
                      {formatCurrency(
                        dashboardData.financial.budgetComparison
                          .expenseVariance,
                      )}
                    </Badge>
                  </Group>
                </Card>
              </Grid.Col>
            </Grid>
          </Paper>
        )}

      {/* Recent Transactions */}
      {visibleSections.showRecentTransactions && (
        <Paper
          p="xl"
          withBorder
          radius="md"
          mb="xl"
        >
          <Group
            justify="space-between"
            mb="md"
          >
            <Group gap="xs">
              <IconReceipt size={24} />
              <Text
                size="xl"
                fw={600}
              >
                Recent Transactions
              </Text>
            </Group>
            <Group gap="xs">
              <Badge
                color="blue"
                variant="light"
                size="sm"
              >
                {dashboardData.sales.recentTransactions.length} sales
              </Badge>
              {visibleSections.showPurchasesCard && (
                <Badge
                  color="teal"
                  variant="light"
                  size="sm"
                >
                  {dashboardData.purchases.recentOrders?.length ?? 0} POs
                </Badge>
              )}
            </Group>
          </Group>

          <Tabs
            defaultValue={
              visibleSections.showSalesCard
                ? 'all'
                : visibleSections.showPurchasesCard
                  ? 'purchases'
                  : 'all'
            }
            mb="md"
          >
            <Tabs.List>
              <Tabs.Tab value="all">All</Tabs.Tab>
              {visibleSections.showSalesCard && (
                <Tabs.Tab
                  value="sales"
                  leftSection={<IconShoppingCart size={14} />}
                >
                  Sales
                </Tabs.Tab>
              )}
              {visibleSections.showPurchasesCard && (
                <Tabs.Tab
                  value="purchases"
                  leftSection={<IconShoppingBag size={14} />}
                >
                  Purchases
                </Tabs.Tab>
              )}
            </Tabs.List>

            {/* ── All tab ── */}
            <Tabs.Panel
              value="all"
              pt="md"
            >
              <ScrollArea h={400}>
                {dashboardData.sales.recentTransactions.length > 0 ||
                (dashboardData.purchases.recentOrders?.length ?? 0) > 0 ? (
                  <Table
                    striped
                    highlightOnHover
                  >
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>
                          <Text
                            size="sm"
                            fw={600}
                          >
                            #
                          </Text>
                        </Table.Th>
                        <Table.Th>
                          <Text
                            size="sm"
                            fw={600}
                          >
                            Type
                          </Text>
                        </Table.Th>
                        <Table.Th>
                          <Text
                            size="sm"
                            fw={600}
                          >
                            Party
                          </Text>
                        </Table.Th>
                        <Table.Th>
                          <Text
                            size="sm"
                            fw={600}
                          >
                            Store
                          </Text>
                        </Table.Th>
                        <Table.Th>
                          <Text
                            size="sm"
                            fw={600}
                          >
                            Status
                          </Text>
                        </Table.Th>
                        <Table.Th>
                          <Text
                            size="sm"
                            fw={600}
                          >
                            Date
                          </Text>
                        </Table.Th>
                        <Table.Th>
                          <Text
                            size="sm"
                            fw={600}
                          >
                            Amount
                          </Text>
                        </Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {[
                        ...dashboardData.sales.recentTransactions.map((s) => ({
                          kind: 'sale' as const,
                          ref: s.sale_number,
                          party: s.customers
                            ? `${s.customers.first_name} ${s.customers.last_name}`.trim()
                            : '—',
                          store: s.stores?.store_name ?? '—',
                          status: s.payment_status ?? '',
                          statusColor:
                            s.payment_status === 'paid'
                              ? 'green'
                              : s.payment_status === 'partial'
                                ? 'yellow'
                                : 'red',
                          date: s.sale_date,
                          amount: Number(s.total_amount),
                          saleType: s.sale_type,
                        })),
                        ...(dashboardData.purchases.recentOrders ?? []).map(
                          (p) => ({
                            kind: 'purchase' as const,
                            ref: p.po_number,
                            party: p.suppliers?.supplier_name ?? '—',
                            store: p.stores?.store_name ?? '—',
                            status: p.status ?? '',
                            statusColor:
                              p.status === 'received'
                                ? 'green'
                                : p.status === 'approved'
                                  ? 'blue'
                                  : p.status === 'pending'
                                    ? 'orange'
                                    : 'gray',
                            date: p.po_date,
                            amount: Number(p.total_amount),
                            saleType: undefined,
                          }),
                        ),
                      ]
                        .sort(
                          (a, b) =>
                            new Date(b.date).getTime() -
                            new Date(a.date).getTime(),
                        )
                        .map((row) => (
                          <Table.Tr key={`${row.kind}-${row.ref}`}>
                            <Table.Td>
                              <Text
                                size="sm"
                                fw={500}
                              >
                                {row.ref}
                              </Text>
                            </Table.Td>
                            <Table.Td>
                              <Badge
                                size="xs"
                                variant="light"
                                color={row.kind === 'sale' ? 'violet' : 'teal'}
                              >
                                {row.kind === 'sale'
                                  ? (row.saleType?.replace(/_/g, ' ') ?? 'sale')
                                  : 'purchase'}
                              </Badge>
                            </Table.Td>
                            <Table.Td>
                              <Text
                                size="sm"
                                c="dimmed"
                              >
                                {row.party}
                              </Text>
                            </Table.Td>
                            <Table.Td>
                              <Text
                                size="sm"
                                c="dimmed"
                              >
                                {row.store}
                              </Text>
                            </Table.Td>
                            <Table.Td>
                              <Badge
                                size="xs"
                                variant="dot"
                                color={row.statusColor}
                              >
                                {row.status}
                              </Badge>
                            </Table.Td>
                            <Table.Td>
                              <Text
                                size="sm"
                                c="dimmed"
                              >
                                {formatDate(row.date)}
                              </Text>
                            </Table.Td>
                            <Table.Td>
                              <Text
                                size="sm"
                                fw={600}
                                c={row.kind === 'sale' ? 'green.6' : 'teal.6'}
                              >
                                {formatCurrency(row.amount)}
                              </Text>
                            </Table.Td>
                          </Table.Tr>
                        ))}
                    </Table.Tbody>
                  </Table>
                ) : (
                  <Center h={400}>
                    <Text c="dimmed">No recent transactions</Text>
                  </Center>
                )}
              </ScrollArea>
            </Tabs.Panel>

            {/* ── Sales tab ── */}
            <Tabs.Panel
              value="sales"
              pt="md"
            >
              <ScrollArea h={400}>
                {dashboardData.sales.recentTransactions.length > 0 ? (
                  <Table
                    striped
                    highlightOnHover
                  >
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>
                          <Text
                            size="sm"
                            fw={600}
                          >
                            Sale #
                          </Text>
                        </Table.Th>
                        <Table.Th>
                          <Text
                            size="sm"
                            fw={600}
                          >
                            Customer
                          </Text>
                        </Table.Th>
                        <Table.Th>
                          <Text
                            size="sm"
                            fw={600}
                          >
                            Store
                          </Text>
                        </Table.Th>
                        <Table.Th>
                          <Text
                            size="sm"
                            fw={600}
                          >
                            Type
                          </Text>
                        </Table.Th>
                        <Table.Th>
                          <Text
                            size="sm"
                            fw={600}
                          >
                            Payment
                          </Text>
                        </Table.Th>
                        <Table.Th>
                          <Text
                            size="sm"
                            fw={600}
                          >
                            Status
                          </Text>
                        </Table.Th>
                        <Table.Th>
                          <Text
                            size="sm"
                            fw={600}
                          >
                            Date
                          </Text>
                        </Table.Th>
                        <Table.Th>
                          <Text
                            size="sm"
                            fw={600}
                          >
                            Amount
                          </Text>
                        </Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {dashboardData.sales.recentTransactions.map((sale) => (
                        <Table.Tr key={sale.sale_number}>
                          <Table.Td>
                            <Text
                              size="sm"
                              fw={500}
                            >
                              {sale.sale_number}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Text
                              size="sm"
                              c="dimmed"
                            >
                              {sale.customers
                                ? `${sale.customers.first_name} ${sale.customers.last_name}`.trim()
                                : '—'}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Text
                              size="sm"
                              c="dimmed"
                            >
                              {sale.stores?.store_name ?? '—'}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            {sale.sale_type && (
                              <Badge
                                size="xs"
                                variant="light"
                                color="violet"
                              >
                                {sale.sale_type.replace(/_/g, ' ')}
                              </Badge>
                            )}
                          </Table.Td>
                          <Table.Td>
                            {sale.payment_method && (
                              <Badge
                                size="xs"
                                variant="light"
                                color={
                                  sale.payment_method === 'cash'
                                    ? 'green'
                                    : sale.payment_method === 'credit'
                                      ? 'red'
                                      : 'blue'
                                }
                              >
                                {sale.payment_method.replace(/_/g, ' ')}
                              </Badge>
                            )}
                          </Table.Td>
                          <Table.Td>
                            {sale.payment_status && (
                              <Badge
                                size="xs"
                                variant="dot"
                                color={
                                  sale.payment_status === 'paid'
                                    ? 'green'
                                    : sale.payment_status === 'partial'
                                      ? 'yellow'
                                      : 'red'
                                }
                              >
                                {sale.payment_status}
                              </Badge>
                            )}
                          </Table.Td>
                          <Table.Td>
                            <Text
                              size="sm"
                              c="dimmed"
                            >
                              {formatDate(sale.sale_date)}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Text
                              size="sm"
                              fw={600}
                              c="green.6"
                            >
                              {formatCurrency(Number(sale.total_amount))}
                            </Text>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                ) : (
                  <Center h={400}>
                    <Text c="dimmed">No recent sales</Text>
                  </Center>
                )}
              </ScrollArea>
            </Tabs.Panel>

            {/* ── Purchases tab ── */}
            <Tabs.Panel
              value="purchases"
              pt="md"
            >
              <ScrollArea h={400}>
                {(dashboardData.purchases.recentOrders?.length ?? 0) > 0 ? (
                  <Table
                    striped
                    highlightOnHover
                  >
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>
                          <Text
                            size="sm"
                            fw={600}
                          >
                            PO #
                          </Text>
                        </Table.Th>
                        <Table.Th>
                          <Text
                            size="sm"
                            fw={600}
                          >
                            Supplier
                          </Text>
                        </Table.Th>
                        <Table.Th>
                          <Text
                            size="sm"
                            fw={600}
                          >
                            Store
                          </Text>
                        </Table.Th>
                        <Table.Th>
                          <Text
                            size="sm"
                            fw={600}
                          >
                            Status
                          </Text>
                        </Table.Th>
                        <Table.Th>
                          <Text
                            size="sm"
                            fw={600}
                          >
                            Date
                          </Text>
                        </Table.Th>
                        <Table.Th>
                          <Text
                            size="sm"
                            fw={600}
                          >
                            Amount
                          </Text>
                        </Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {(dashboardData.purchases.recentOrders ?? []).map(
                        (po) => (
                          <Table.Tr key={po.po_number}>
                            <Table.Td>
                              <Text
                                size="sm"
                                fw={500}
                              >
                                {po.po_number}
                              </Text>
                            </Table.Td>
                            <Table.Td>
                              <Text
                                size="sm"
                                c="dimmed"
                              >
                                {po.suppliers?.supplier_name ?? '—'}
                              </Text>
                            </Table.Td>
                            <Table.Td>
                              <Text
                                size="sm"
                                c="dimmed"
                              >
                                {po.stores?.store_name ?? '—'}
                              </Text>
                            </Table.Td>
                            <Table.Td>
                              <Badge
                                size="xs"
                                variant="light"
                                color={
                                  po.status === 'received'
                                    ? 'green'
                                    : po.status === 'approved'
                                      ? 'blue'
                                      : po.status === 'pending'
                                        ? 'orange'
                                        : 'gray'
                                }
                              >
                                {po.status}
                              </Badge>
                            </Table.Td>
                            <Table.Td>
                              <Text
                                size="sm"
                                c="dimmed"
                              >
                                {formatDate(po.po_date)}
                              </Text>
                            </Table.Td>
                            <Table.Td>
                              <Text
                                size="sm"
                                fw={600}
                                c="teal.6"
                              >
                                {formatCurrency(Number(po.total_amount))}
                              </Text>
                            </Table.Td>
                          </Table.Tr>
                        ),
                      )}
                    </Table.Tbody>
                  </Table>
                ) : (
                  <Center h={400}>
                    <Text c="dimmed">No recent purchase orders</Text>
                  </Center>
                )}
              </ScrollArea>
            </Tabs.Panel>
          </Tabs>
        </Paper>
      )}

      {/* ── Sales Breakdown: By Type & Payment Method ── */}
      {visibleSections.showSalesCard && (
        <Grid
          gutter="lg"
          mb="xl"
        >
          <Grid.Col span={{ base: 12, md: 4 }}>
            <Paper
              p="xl"
              withBorder
              radius="md"
            >
              <Group
                gap="xs"
                mb="md"
              >
                <IconTag size={20} />
                <Text
                  size="lg"
                  fw={600}
                >
                  Sales by Type
                </Text>
              </Group>
              {dashboardData.sales.byType.length > 0 ? (
                <DonutChart
                  h={200}
                  data={dashboardData.sales.byType}
                  withLabelsLine
                  withLabels
                  tooltipDataSource="segment"
                />
              ) : (
                <Center h={200}>
                  <Text c="dimmed">No data</Text>
                </Center>
              )}
            </Paper>
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 4 }}>
            <Paper
              p="xl"
              withBorder
              radius="md"
            >
              <Group
                gap="xs"
                mb="md"
              >
                <IconCreditCard size={20} />
                <Text
                  size="lg"
                  fw={600}
                >
                  Payment Methods
                </Text>
              </Group>
              {dashboardData.sales.byPaymentMethod.length > 0 ? (
                <DonutChart
                  h={200}
                  data={dashboardData.sales.byPaymentMethod}
                  withLabelsLine
                  withLabels
                  tooltipDataSource="segment"
                />
              ) : (
                <Center h={200}>
                  <Text c="dimmed">No data</Text>
                </Center>
              )}
            </Paper>
          </Grid.Col>

          {/* Inventory Category Distribution */}
          {visibleSections.showInventoryCard && (
            <Grid.Col span={{ base: 12, md: 4 }}>
              <Paper
                p="xl"
                withBorder
                radius="md"
              >
                <Group
                  gap="xs"
                  mb="md"
                >
                  <IconPackage size={20} />
                  <Text
                    size="lg"
                    fw={600}
                  >
                    Inventory by Category
                  </Text>
                </Group>
                {dashboardData.inventory.categoryDistribution.length > 0 ? (
                  <DonutChart
                    h={200}
                    data={dashboardData.inventory.categoryDistribution.map(
                      (c, i) => ({
                        name: c.name,
                        value: c.value,
                        color: `hsl(${i * 45}, 65%, 55%)`,
                      }),
                    )}
                    withLabelsLine
                    withLabels
                    tooltipDataSource="segment"
                  />
                ) : (
                  <Center h={200}>
                    <Text c="dimmed">No data</Text>
                  </Center>
                )}
              </Paper>
            </Grid.Col>
          )}
        </Grid>
      )}

      {/* ── Purchase Orders Status Donut ── */}
      {visibleSections.showPurchasesCard &&
        dashboardData.purchases.chartData.length > 0 && (
          <Grid
            gutter="lg"
            mb="xl"
          >
            <Grid.Col span={{ base: 12, md: 5 }}>
              <Paper
                p="xl"
                withBorder
                radius="md"
              >
                <Group
                  gap="xs"
                  mb="md"
                >
                  <IconShoppingBag size={20} />
                  <Text
                    size="lg"
                    fw={600}
                  >
                    Purchase Orders by Status
                  </Text>
                </Group>
                <DonutChart
                  h={220}
                  data={dashboardData.purchases.chartData}
                  withLabelsLine
                  withLabels
                  tooltipDataSource="segment"
                />
              </Paper>
            </Grid.Col>

            {/* Cash Flow Breakdown */}
            {visibleSections.showFinancialOverview && (
              <Grid.Col span={{ base: 12, md: 7 }}>
                <Paper
                  p="xl"
                  withBorder
                  radius="md"
                >
                  <Group
                    gap="xs"
                    mb="md"
                  >
                    <IconCash size={20} />
                    <Text
                      size="lg"
                      fw={600}
                    >
                      Cash Flow Breakdown
                    </Text>
                  </Group>
                  <Grid
                    gutter="md"
                    mb="md"
                  >
                    {[
                      {
                        label: 'Operating',
                        value: dashboardData.financial.cashFlow.operating,
                        color: 'green',
                      },
                      {
                        label: 'Investing',
                        value: dashboardData.financial.cashFlow.investing,
                        color: 'blue',
                      },
                      {
                        label: 'Financing',
                        value: dashboardData.financial.cashFlow.financing,
                        color: 'orange',
                      },
                    ].map(({ label, value, color }) => (
                      <Grid.Col
                        key={label}
                        span={4}
                      >
                        <Paper
                          withBorder
                          p="md"
                          radius="md"
                        >
                          <Text
                            size="xs"
                            c="dimmed"
                            mb={4}
                          >
                            {label}
                          </Text>
                          <Text
                            size="sm"
                            fw={700}
                            c={`${color}.6`}
                          >
                            {formatCurrencyCompact(value)}
                          </Text>
                        </Paper>
                      </Grid.Col>
                    ))}
                  </Grid>
                  <BarChart
                    h={150}
                    data={[
                      {
                        label: 'Operating',
                        value: dashboardData.financial.cashFlow.operating,
                      },
                      {
                        label: 'Investing',
                        value: dashboardData.financial.cashFlow.investing,
                      },
                      {
                        label: 'Financing',
                        value: dashboardData.financial.cashFlow.financing,
                      },
                    ]}
                    dataKey="label"
                    series={[
                      { name: 'value', color: 'teal.6', label: 'Amount' },
                    ]}
                  />
                </Paper>
              </Grid.Col>
            )}
          </Grid>
        )}

      {/* ── 12-Month Revenue Trend ── */}
      {visibleSections.showFinancialOverview &&
        dashboardData.monthlyTrend.length > 0 && (
          <Paper
            p="xl"
            withBorder
            radius="md"
            mb="xl"
          >
            <Group
              gap="xs"
              mb="md"
            >
              <IconChartLine size={24} />
              <Text
                size="xl"
                fw={600}
              >
                12-Month Performance Trend
              </Text>
            </Group>
            <AreaChart
              h={280}
              data={dashboardData.monthlyTrend}
              dataKey="month"
              series={[
                { name: 'revenue', color: 'green.6', label: 'Revenue' },
                { name: 'expenses', color: 'red.6', label: 'Expenses' },
                { name: 'profit', color: 'violet.6', label: 'Profit' },
              ]}
              curveType="monotone"
              withLegend
              tooltipAnimationDuration={200}
            />
          </Paper>
        )}

      {/* ── Top Customers Leaderboard ── */}
      {visibleSections.showTopCustomers &&
        dashboardData.customers.topCustomers.length > 0 && (
          <Grid
            gutter="lg"
            mb="xl"
          >
            <Grid.Col span={{ base: 12, md: 6 }}>
              <Paper
                p="xl"
                withBorder
                radius="md"
              >
                <Group
                  justify="space-between"
                  mb="md"
                >
                  <Group gap="xs">
                    <IconUsers size={20} />
                    <Text
                      size="lg"
                      fw={600}
                    >
                      Top Customers
                    </Text>
                  </Group>
                  <Badge
                    variant="light"
                    color="blue"
                  >
                    {dashboardData.customers.total} total
                  </Badge>
                </Group>
                <Stack gap="sm">
                  {dashboardData.customers.topCustomers.map((customer, idx) => (
                    <Group
                      key={customer.id}
                      justify="space-between"
                    >
                      <Group gap="sm">
                        <Avatar
                          size="sm"
                          color={
                            ['blue', 'violet', 'green', 'orange', 'red'][
                              idx % 5
                            ]
                          }
                          radius="xl"
                        >
                          {idx + 1}
                        </Avatar>
                        <Text
                          size="sm"
                          fw={500}
                        >
                          {customer.first_name} {customer.last_name}
                        </Text>
                      </Group>
                      <Text
                        size="sm"
                        fw={600}
                        c="green.6"
                      >
                        {formatCurrencyCompact(
                          Number(customer.total_purchases),
                        )}
                      </Text>
                    </Group>
                  ))}
                </Stack>
              </Paper>
            </Grid.Col>

            {/* ── Top Suppliers ── */}
            {visibleSections.showTopSuppliers &&
              dashboardData.suppliers.topSuppliers.length > 0 && (
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Paper
                    p="xl"
                    withBorder
                    radius="md"
                  >
                    <Group
                      justify="space-between"
                      mb="md"
                    >
                      <Group gap="xs">
                        <IconTruck size={20} />
                        <Text
                          size="lg"
                          fw={600}
                        >
                          Top Suppliers
                        </Text>
                      </Group>
                      <Badge
                        variant="light"
                        color="teal"
                      >
                        {dashboardData.suppliers.active} active
                      </Badge>
                    </Group>
                    <Stack gap="sm">
                      {dashboardData.suppliers.topSuppliers.map(
                        (supplier, idx) => (
                          <Group
                            key={supplier.id}
                            justify="space-between"
                          >
                            <Group gap="sm">
                              <Avatar
                                size="sm"
                                color={
                                  ['teal', 'cyan', 'blue', 'indigo', 'grape'][
                                    idx % 5
                                  ]
                                }
                                radius="xl"
                              >
                                {idx + 1}
                              </Avatar>
                              <Text
                                size="sm"
                                fw={500}
                              >
                                {supplier.supplier_name}
                              </Text>
                            </Group>
                            <Text
                              size="sm"
                              fw={600}
                              c="teal.6"
                            >
                              {formatCurrencyCompact(
                                Number(supplier.total_purchases),
                              )}
                            </Text>
                          </Group>
                        ),
                      )}
                    </Stack>
                  </Paper>
                </Grid.Col>
              )}
          </Grid>
        )}

      {/* ── Credit / Receivables Overview ── */}
      {visibleSections.showCreditOverview &&
        dashboardData.credit.totalOutstanding > 0 && (
          <Paper
            p="xl"
            withBorder
            radius="md"
            mb="xl"
          >
            <Group
              gap="xs"
              mb="md"
            >
              <IconCreditCard size={24} />
              <Text
                size="xl"
                fw={600}
              >
                Credit & Receivables
              </Text>
            </Group>
            <Grid gutter="lg">
              <Grid.Col span={{ base: 12, sm: 4 }}>
                <Paper
                  withBorder
                  p="md"
                  radius="md"
                >
                  <Text
                    size="xs"
                    c="dimmed"
                    mb={4}
                  >
                    Total Outstanding
                  </Text>
                  <Text
                    size="xl"
                    fw={700}
                    c="orange.6"
                  >
                    {formatCurrencyCompact(
                      dashboardData.credit.totalOutstanding,
                    )}
                  </Text>
                </Paper>
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 4 }}>
                <Paper
                  withBorder
                  p="md"
                  radius="md"
                >
                  <Text
                    size="xs"
                    c="dimmed"
                    mb={4}
                  >
                    Overdue (&gt;30 days)
                  </Text>
                  <Text
                    size="xl"
                    fw={700}
                    c="red.6"
                  >
                    {formatCurrencyCompact(dashboardData.credit.overdue)}
                  </Text>
                </Paper>
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 4 }}>
                <Paper
                  withBorder
                  p="md"
                  radius="md"
                >
                  <Text
                    size="xs"
                    c="dimmed"
                    mb={4}
                  >
                    Customers with Credit
                  </Text>
                  <Text
                    size="xl"
                    fw={700}
                    c="blue.6"
                  >
                    {dashboardData.credit.customers}
                  </Text>
                </Paper>
              </Grid.Col>
            </Grid>
            {dashboardData.credit.totalOutstanding > 0 && (
              <Box mt="md">
                <Text
                  size="xs"
                  c="dimmed"
                  mb={4}
                >
                  Overdue ratio:{' '}
                  {(
                    (dashboardData.credit.overdue /
                      dashboardData.credit.totalOutstanding) *
                    100
                  ).toFixed(1)}
                  %
                </Text>
                <Progress
                  value={
                    (dashboardData.credit.overdue /
                      dashboardData.credit.totalOutstanding) *
                    100
                  }
                  color="red"
                  size="sm"
                />
              </Box>
            )}
          </Paper>
        )}

      {/* ── Store Performance (Company/Area Admins) ── */}
      {visibleSections.showStorePerformance &&
        dashboardData.storePerformance.length > 0 && (
          <Paper
            p="xl"
            withBorder
            radius="md"
            mb="xl"
          >
            <Group
              gap="xs"
              mb="md"
            >
              <IconBuildingStore size={24} />
              <Text
                size="xl"
                fw={600}
              >
                Store Performance (This Month)
              </Text>
            </Group>
            <Table
              striped
              highlightOnHover
            >
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Store</Table.Th>
                  <Table.Th>Revenue</Table.Th>
                  <Table.Th>Sales Count</Table.Th>
                  <Table.Th>vs Last Month</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {dashboardData.storePerformance.map((store, idx) => (
                  <Table.Tr key={store.store_id}>
                    <Table.Td>
                      <Group gap="sm">
                        <Avatar
                          size="xs"
                          color={
                            [
                              'blue',
                              'violet',
                              'green',
                              'orange',
                              'red',
                              'teal',
                            ][idx % 6]
                          }
                          radius="xl"
                        >
                          {idx + 1}
                        </Avatar>
                        <Text
                          size="sm"
                          fw={500}
                        >
                          {store.store_name}
                        </Text>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Text
                        size="sm"
                        fw={600}
                        c="green.6"
                      >
                        {formatCurrencyCompact(store.revenue)}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{store.sales_count}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4}>
                        {store.trend > 0 ? (
                          <IconTrendingUp
                            size={14}
                            color="green"
                          />
                        ) : store.trend < 0 ? (
                          <IconTrendingDown
                            size={14}
                            color="red"
                          />
                        ) : (
                          <IconMinus size={14} />
                        )}
                        <Badge
                          size="xs"
                          variant="light"
                          color={
                            store.trend > 0
                              ? 'green'
                              : store.trend < 0
                                ? 'red'
                                : 'gray'
                          }
                        >
                          {store.trend > 0 ? '+' : ''}
                          {store.trend}%
                        </Badge>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Paper>
        )}

      {/* ── Discounts KPI ── */}
      {visibleSections.showSalesCard &&
        dashboardData.sales.totalDiscounts > 0 && (
          <Paper
            p="lg"
            withBorder
            radius="md"
            mb="xl"
          >
            <Group gap="xs">
              <IconDiscount
                size={20}
                color="orange"
              />
              <Text
                size="md"
                fw={600}
              >
                Total Discounts Given This Month:
              </Text>
              <Text
                size="md"
                fw={700}
                c="orange.6"
              >
                {formatCurrencyCompact(dashboardData.sales.totalDiscounts)}
              </Text>
            </Group>
          </Paper>
        )}
    </PageWrapper>
  )
}

export default Dashboard

