import React, { useState, useCallback, useEffect } from 'react'
import {
  AppShell,
  Avatar,
  Group,
  Text,
  useMantineTheme,
  useMantineColorScheme,
  Modal,
  PasswordInput,
  Button,
  Stack,
  Box,
  Indicator,
  ActionIcon,
  Tooltip,
  Menu,
  TextInput,
  Badge,
  Divider,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import {
  IconChevronLeft,
  IconChevronRight as IconChevRight,
  IconSearch,
  IconBuildingSkyscraper,
  IconSlideshow,
  IconShieldLock,
  IconLock,
  IconLockOpen,
  IconChevronDown,
  IconUser,
  IconDeviceLaptop,
  IconShoppingBagCheck,
  IconAlertTriangle,
  IconClock,
  IconArrowsRightLeft,
  IconBarcode,
  IconSettings,
  IconLogout,
  IconUserCircle,
} from '@tabler/icons-react'
import { NotificationMenu } from './NotificationMenu'
import { AreasStoresSelectionIndicator } from './AreasStoresSelectionIndicator'
import { useSelector, useDispatch } from 'react-redux'
import { RootState, AppDispatch } from '@app/core/store/store'
import { Company } from '@shared/types/company'
import { Permission } from '@shared/constants/permissions'
import { Role } from '@shared/constants/roles'
import { PermissionGuard, RoleGuard } from '@shared/components/Permissionguards'
import { Link, useNavigate as useNav } from 'react-router-dom'
import { useAuth } from '@shared/contexts/AuthProvider'
import {
  selectUserRoleId,
  selectUserInitials,
} from '@features/authentication/authSlice'
import { RoleMetadata } from '@shared/constants/roles'
import { getRoleColor } from '@features/main/components/usersManagement/UsersManagement.config'
import { supabase } from '@app/core/supabase/Supabase.utils'
import {
  unlockRestrictedMode,
  lockRestrictedMode,
  clearRestrictedModeError,
  selectIsUnlocked,
  selectRestrictedModeLoading,
  selectRestrictedModeError,
} from '@core/restrictedMode/Restrictedmode.slice'

export interface NavbarBreadcrumb {
  label: string
  href?: string
  onClick?: () => void
}

interface NavbarProps {
  showSearch?: boolean
  pageTitle?: string
  breadcrumbs?: NavbarBreadcrumb[]
  onBack?: () => void
  backLabel?: string
  standalone?: boolean
}

export const NAVBAR_HEIGHT = 56
export const SIDEBAR_WIDTH = 260

const Navbar = ({ breadcrumbs, standalone = false }: NavbarProps) => {
  const theme = useMantineTheme()
  const { colorScheme } = useMantineColorScheme()
  const isDark = colorScheme === 'dark'
  const dispatch = useDispatch<AppDispatch>()
  const router = useNav()

  /* ── auth ────────────────────────────────────────── */
  const company = useSelector(
    (state: RootState) => state.auth.company as Company | null,
  )
  const companyId = useSelector(
    (state: RootState) => state.auth.company?.id as number | undefined,
  )
  const { logout, user } = useAuth()
  const userRoleId = useSelector(selectUserRoleId)
  const userInitials = useSelector(selectUserInitials)
  const roleInfo = userRoleId ? RoleMetadata[userRoleId] : null
  const roleName = roleInfo?.name || 'User'
  const fullName =
    user?.profile?.first_name && user?.profile?.last_name
      ? `${user.profile.first_name} ${user.profile.last_name}`
      : user?.email?.split('@')[0] || 'User'

  /* ── restricted mode ─────────────────────────────── */
  const isUnlocked = useSelector(selectIsUnlocked)
  const isLoading = useSelector(selectRestrictedModeLoading)
  const reduxError = useSelector(selectRestrictedModeError)
  const [password, setPassword] = useState('')
  const [lockOpen, { open: openLock, close: closeLock }] = useDisclosure(false)

  const handleLockToggle = useCallback(() => {
    setPassword('')
    dispatch(clearRestrictedModeError())
    openLock()
  }, [openLock, dispatch])

  const handleLockSubmit = useCallback(async () => {
    if (isUnlocked) {
      dispatch(lockRestrictedMode())
      notifications.show({
        title: '🔒 Locked',
        message: 'Sensitive data hidden.',
        color: 'red',
        autoClose: 2000,
      })
      closeLock()
      return
    }
    if (!password.trim() || !companyId) return
    const res = await dispatch(unlockRestrictedMode({ password, companyId }))
    if (unlockRestrictedMode.fulfilled.match(res)) {
      notifications.show({
        title: '🔓 Unlocked',
        message: 'All data visible.',
        color: 'green',
        autoClose: 2000,
      })
      closeLock()
      setPassword('')
    }
  }, [password, isUnlocked, companyId, dispatch, closeLock])

  /* ── live inventory alerts ───────────────────────── */
  const [lowStockCount, setLowStockCount] = useState<number>(0)
  const [expiringSoonCount, setExpiringSoonCount] = useState<number>(0)
  const scopeStoreId = useSelector(
    (state: RootState) => state.areaStore.selectedStore?.id,
  )

  useEffect(() => {
    if (!companyId) return
    const fetchCounts = async () => {
      try {
        let lowQ = supabase
          .from('stock_batches')
          .select('id', { count: 'exact', head: true })
          .eq('company_id', companyId)
          .gt('quantity', 0)
          .lte('quantity', 10)
        if (scopeStoreId) lowQ = lowQ.eq('store_id', scopeStoreId)
        const { count: lc } = await lowQ
        setLowStockCount(lc ?? 0)

        const soon = new Date()
        soon.setDate(soon.getDate() + 30)
        let expQ = supabase
          .from('stock_batches')
          .select('id', { count: 'exact', head: true })
          .eq('company_id', companyId)
          .gt('quantity', 0)
          .lte('expiry_date', soon.toISOString().split('T')[0])
          .gte('expiry_date', new Date().toISOString().split('T')[0])
        if (scopeStoreId) expQ = expQ.eq('store_id', scopeStoreId)
        const { count: ec } = await expQ
        setExpiringSoonCount(ec ?? 0)
      } catch (_) {}
    }
    fetchCounts()
    const interval = setInterval(fetchCounts, 5 * 60 * 1000) // refresh every 5 min
    return () => clearInterval(interval)
  }, [companyId, scopeStoreId])

  /* ── tokens ──────────────────────────────────────── */
  const bg = isDark ? '#16181f' : '#ffffff'
  const border = isDark ? '#252836' : '#e8eaed'
  const text = isDark ? '#ebedf2' : '#111827'
  const muted = isDark ? '#5c6070' : '#9399a8'
  const hover = isDark ? '#1f2130' : '#f0f1f5'
  const inputBg = isDark ? '#0f1018' : '#f5f6fa'
  const dropBg = isDark ? '#1c1e28' : '#ffffff'
  const shadow = isDark
    ? '0 2px 4px rgba(0,0,0,0.5), 0 8px 24px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06)'
    : '0 2px 4px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.06)'
  const dropStyles = {
    dropdown: {
      backgroundColor: dropBg,
      border: `1px solid ${border}`,
      borderRadius: 10,
      padding: 5,
      boxShadow: shadow,
    },
  }

  /* ── shared tiny divider ─────────────────────────── */
  const VDivider = () => (
    <Box
      style={{
        width: 1,
        height: 18,
        backgroundColor: border,
        flexShrink: 0,
        marginInline: 2,
      }}
    />
  )

  /* ── shared icon button style ────────────────────── */
  const ib = (extra?: React.CSSProperties): React.CSSProperties => ({
    color: muted,
    borderRadius: 6,
    transition: 'background 0.1s, color 0.1s',
    ...extra,
  })

  const headerStyle: React.CSSProperties = {
    height: NAVBAR_HEIGHT,
    backgroundColor: bg,
    borderBottom: `1px solid ${border}`,
    ...(standalone
      ? { display: 'flex', alignItems: 'center', width: '100%', flexShrink: 0 }
      : {}),
  }

  const inner = (
    <Group
      h="100%"
      px={0}
      wrap="nowrap"
      gap={0}
      align="center"
      style={{ overflow: 'hidden' }}
    >
      {/* ══════════════════════════════════════════════════════
          SECTION 1 — Brand (exact sidebar width)
          Logo  |  User name (top) / Company name (bottom)
          Opens dropdown → profile, company settings, lock
      ══════════════════════════════════════════════════════ */}
      <Box
        style={{
          width: SIDEBAR_WIDTH,
          flexShrink: 0,
          height: '100%',
          borderRight: `1px solid ${border}`,
          display: 'flex',
          alignItems: 'center',
          paddingInline: 12,
        }}
      >
        <Menu
          shadow="lg"
          width={SIDEBAR_WIDTH + 20}
          radius={10}
          position="bottom-start"
          offset={0}
          styles={dropStyles}
        >
          <Menu.Target>
            <Group
              gap={10}
              wrap="nowrap"
              align="center"
              style={{
                flex: 1,
                cursor: 'pointer',
                borderRadius: 8,
                padding: '6px 8px',
                userSelect: 'none',
                transition: 'background 0.12s',
              }}
              styles={
                { root: { '&:hover': { backgroundColor: hover } } } as any
              }
            >
              <Indicator
                color={isUnlocked ? 'teal' : 'red'}
                size={7}
                position="bottom-end"
                processing={isUnlocked}
                offset={2}
              >
                <Avatar
                  src={company?.logo_url}
                  radius={8}
                  size={34}
                  style={{ border: `1.5px solid ${border}`, flexShrink: 0 }}
                />
              </Indicator>

              <Box style={{ flex: 1, minWidth: 0 }}>
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    lineHeight: 1.2,
                    color: text,
                    letterSpacing: '-0.01em',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {fullName}
                </Text>
                <Text
                  style={{
                    fontSize: 11,
                    lineHeight: 1.2,
                    marginTop: 2,
                    color: muted,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {company?.company_name ?? 'PharmaSOS'}
                </Text>
              </Box>

              <IconChevronDown
                size={12}
                stroke={2.5}
                style={{ color: muted, flexShrink: 0 }}
              />
            </Group>
          </Menu.Target>

          <Menu.Dropdown>
            {/* user card */}
            <Box
              px={10}
              py={9}
              mb={4}
              style={{
                borderRadius: 8,
                background: isDark ? '#0f1018' : '#f5f6fa',
                border: `1px solid ${border}`,
              }}
            >
              <Group
                gap={9}
                wrap="nowrap"
              >
                <Avatar
                  radius={8}
                  size={36}
                  style={{
                    backgroundColor: isDark
                      ? `${theme.colors[theme.primaryColor][9]}60`
                      : theme.colors[theme.primaryColor][0],
                    color: isDark
                      ? theme.colors[theme.primaryColor][3]
                      : theme.colors[theme.primaryColor][7],
                    fontWeight: 700,
                    fontSize: 13,
                    flexShrink: 0,
                    border: `1.5px solid ${isDark ? `${theme.colors[theme.primaryColor][8]}50` : theme.colors[theme.primaryColor][2]}`,
                  }}
                >
                  {userInitials || <IconUser size={16} />}
                </Avatar>
                <Stack
                  gap={2}
                  style={{ flex: 1, minWidth: 0 }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: text,
                      letterSpacing: '-0.01em',
                    }}
                    lineClamp={1}
                  >
                    {fullName}
                  </Text>
                  <Text
                    style={{ fontSize: 11, color: muted }}
                    lineClamp={1}
                  >
                    {user?.email}
                  </Text>
                  <Badge
                    color={getRoleColor(userRoleId)}
                    variant="light"
                    size="xs"
                    radius={4}
                    style={{
                      width: 'fit-content',
                      fontWeight: 600,
                      fontSize: 9,
                      textTransform: 'none',
                      marginTop: 1,
                    }}
                  >
                    {roleName}
                  </Badge>
                </Stack>
              </Group>
            </Box>

            <PermissionGuard permission={Permission.PROFILE_VIEW}>
              <Menu.Item
                component={Link}
                to="/profile"
                leftSection={
                  <IconUserCircle
                    size={14}
                    stroke={1.5}
                    style={{ color: muted }}
                  />
                }
                style={{
                  borderRadius: 7,
                  fontSize: 12,
                  fontWeight: 500,
                  color: text,
                }}
              >
                My Profile
              </Menu.Item>
            </PermissionGuard>

            <Menu.Divider style={{ borderColor: border, margin: '4px 0' }} />

            <RoleGuard
              allowedRoles={[
                Role.company_admin,
                Role.area_admin,
                Role.store_admin,
              ]}
            >
              <Menu.Label
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.07em',
                  textTransform: 'uppercase',
                  color: muted,
                  padding: '2px 8px',
                }}
              >
                Company
              </Menu.Label>
              <PermissionGuard permission={Permission.COMPANY_SETTINGS_READ}>
                <Menu.Item
                  component={Link}
                  to="/settings/company"
                  leftSection={
                    <IconBuildingSkyscraper
                      size={14}
                      stroke={1.5}
                      style={{ color: muted }}
                    />
                  }
                  style={{
                    borderRadius: 7,
                    fontSize: 12,
                    fontWeight: 500,
                    color: text,
                  }}
                >
                  Company Settings
                </Menu.Item>
              </PermissionGuard>
              <Menu.Item
                component={Link}
                to="/settings/preferences"
                leftSection={
                  <IconSlideshow
                    size={14}
                    stroke={1.5}
                    style={{ color: muted }}
                  />
                }
                style={{
                  borderRadius: 7,
                  fontSize: 12,
                  fontWeight: 500,
                  color: text,
                }}
              >
                Preferences
              </Menu.Item>
              <Menu.Item
                leftSection={
                  <IconShieldLock
                    size={14}
                    stroke={1.5}
                    style={{ color: muted }}
                  />
                }
                style={{
                  borderRadius: 7,
                  fontSize: 12,
                  fontWeight: 500,
                  color: text,
                }}
              >
                Privacy
              </Menu.Item>
              <Menu.Divider style={{ borderColor: border, margin: '4px 0' }} />
            </RoleGuard>

            <Menu.Item
              onClick={handleLockToggle}
              leftSection={
                isUnlocked ? (
                  <IconLock
                    size={14}
                    stroke={1.5}
                    style={{ color: '#ef4444' }}
                  />
                ) : (
                  <IconLockOpen
                    size={14}
                    stroke={1.5}
                    style={{ color: '#10b981' }}
                  />
                )
              }
              style={{
                borderRadius: 7,
                fontSize: 12,
                fontWeight: 500,
                color: isUnlocked ? '#ef4444' : text,
              }}
            >
              {isUnlocked ? 'Lock Restricted Mode' : 'Unlock Restricted Mode'}
            </Menu.Item>

            <Menu.Divider style={{ borderColor: border, margin: '4px 0' }} />

            <Menu.Item
              color="red"
              onClick={() => logout()}
              leftSection={
                <IconLogout
                  size={14}
                  stroke={1.5}
                />
              }
              style={{ borderRadius: 7, fontSize: 12, fontWeight: 500 }}
            >
              Sign out
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Box>

      {/* ══════════════════════════════════════════════════════
          SECTION 2 — Back / Forward
      ══════════════════════════════════════════════════════ */}
      <Group
        gap={1}
        wrap="nowrap"
        align="center"
        style={{ flexShrink: 0, paddingInline: 8 }}
      >
        <Tooltip
          label="Go back"
          withArrow
          position="bottom"
          openDelay={500}
        >
          <ActionIcon
            variant="subtle"
            size={30}
            radius={6}
            onClick={() => router(-1)}
            style={ib()}
            styles={{
              root: { '&:hover': { backgroundColor: hover, color: text } },
            }}
          >
            <IconChevronLeft
              size={16}
              stroke={2}
            />
          </ActionIcon>
        </Tooltip>
        <Tooltip
          label="Go forward"
          withArrow
          position="bottom"
          openDelay={500}
        >
          <ActionIcon
            variant="subtle"
            size={30}
            radius={6}
            onClick={() => router(1)}
            style={ib()}
            styles={{
              root: { '&:hover': { backgroundColor: hover, color: text } },
            }}
          >
            <IconChevRight
              size={16}
              stroke={2}
            />
          </ActionIcon>
        </Tooltip>
      </Group>

      <VDivider />

      {/* ══════════════════════════════════════════════════════
          SECTION 3 — Search
      ══════════════════════════════════════════════════════ */}
      <Box style={{ flexShrink: 0, width: 210, paddingInline: 8 }}>
        <TextInput
          placeholder="Search…"
          leftSection={
            <IconSearch
              size={13}
              stroke={1.8}
              style={{ color: muted }}
            />
          }
          radius={7}
          size="xs"
          styles={{
            input: {
              backgroundColor: inputBg,
              border: `1px solid ${border}`,
              color: text,
              fontSize: 12,
              height: 30,
              '&::placeholder': { color: muted },
              '&:focus': {
                borderColor: theme.colors[theme.primaryColor][isDark ? 6 : 5],
                boxShadow: `0 0 0 2px ${theme.colors[theme.primaryColor][isDark ? 9 : 1]}`,
              },
            },
          }}
        />
      </Box>

      <VDivider />

      {/* ══════════════════════════════════════════════════════
          SECTION 4 — Breadcrumb (flex, centered)
      ══════════════════════════════════════════════════════ */}
      <Group
        gap={4}
        wrap="nowrap"
        align="center"
        style={{
          flex: 1,
          minWidth: 0,
          paddingInline: 12,
          overflow: 'hidden',
          justifyContent: 'center',
        }}
      >
        {breadcrumbs && breadcrumbs.length > 0 ? (
          breadcrumbs.map((crumb, idx) => {
            const isLast = idx === breadcrumbs.length - 1
            return (
              <React.Fragment key={idx}>
                {idx > 0 && (
                  <IconChevRight
                    size={11}
                    stroke={2}
                    style={{ color: muted, opacity: 0.5, flexShrink: 0 }}
                  />
                )}
                <Text
                  onClick={!isLast && crumb.onClick ? crumb.onClick : undefined}
                  style={{
                    fontSize: 12,
                    color: isLast ? text : muted,
                    fontWeight: isLast ? 600 : 400,
                    whiteSpace: 'nowrap',
                    cursor: !isLast && crumb.onClick ? 'pointer' : 'default',
                    maxWidth: isLast ? 180 : 110,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {crumb.label}
                </Text>
              </React.Fragment>
            )
          })
        ) : (
          <Text style={{ fontSize: 12, color: muted }}>
            Pharmacy Management System
          </Text>
        )}
      </Group>

      <VDivider />

      {/* ══════════════════════════════════════════════════════
          SECTIONS 5–8 — Right-side actions
          5. Branch selector
          6. Live stock alerts (low stock + expiring soon)
          7. Notifications
          8. Quick tools (POS · POP · Barcode · Transfer · Settings)
      ══════════════════════════════════════════════════════ */}
      <Group
        gap={2}
        wrap="nowrap"
        align="center"
        style={{ flexShrink: 0, paddingInline: 10, height: '100%' }}
      >
        {/* 5 ─ Branch selector */}
        <AreasStoresSelectionIndicator />

        <VDivider />

        {/* 6 ─ Live inventory alerts */}
        <PermissionGuard permission={Permission.INVENTORY_READ}>
          <Tooltip
            label={`${lowStockCount} low stock items`}
            withArrow
            position="bottom"
            openDelay={300}
          >
            <ActionIcon
              variant="subtle"
              size={30}
              radius={6}
              component={Link}
              to="/inventory/low-stock"
              style={ib({ position: 'relative' })}
              styles={{
                root: {
                  '&:hover': {
                    backgroundColor: hover,
                    color: lowStockCount > 0 ? '#f59e0b' : text,
                  },
                },
              }}
            >
              <Indicator
                label={lowStockCount > 99 ? '99+' : lowStockCount}
                size={14}
                disabled={lowStockCount === 0}
                color="orange"
                offset={3}
                styles={{
                  indicator: { fontSize: 9, fontWeight: 700, padding: '0 3px' },
                }}
              >
                <IconAlertTriangle
                  size={16}
                  stroke={1.8}
                  style={{ color: lowStockCount > 0 ? '#f59e0b' : muted }}
                />
              </Indicator>
            </ActionIcon>
          </Tooltip>

          <Tooltip
            label={`${expiringSoonCount} expiring within 30 days`}
            withArrow
            position="bottom"
            openDelay={300}
          >
            <ActionIcon
              variant="subtle"
              size={30}
              radius={6}
              component={Link}
              to="/inventory/expiring-soon"
              style={ib()}
              styles={{
                root: {
                  '&:hover': {
                    backgroundColor: hover,
                    color: expiringSoonCount > 0 ? '#ef4444' : text,
                  },
                },
              }}
            >
              <Indicator
                label={expiringSoonCount > 99 ? '99+' : expiringSoonCount}
                size={14}
                disabled={expiringSoonCount === 0}
                color="red"
                offset={3}
                styles={{
                  indicator: { fontSize: 9, fontWeight: 700, padding: '0 3px' },
                }}
              >
                <IconClock
                  size={16}
                  stroke={1.8}
                  style={{ color: expiringSoonCount > 0 ? '#ef4444' : muted }}
                />
              </Indicator>
            </ActionIcon>
          </Tooltip>
        </PermissionGuard>

        <VDivider />

        {/* 7 ─ Notifications */}
        <PermissionGuard permission={Permission.NOTIFICATIONS_READ}>
          <NotificationMenu />
        </PermissionGuard>

        <VDivider />

        {/* 8 ─ Quick-launch tools */}
        <Group
          gap={1}
          wrap="nowrap"
        >
          <Tooltip
            label="Point of Sale"
            withArrow
            position="bottom"
            openDelay={400}
          >
            <ActionIcon
              variant="subtle"
              size={30}
              radius={6}
              component={Link}
              to="/sales/pos"
              style={ib()}
              styles={{
                root: { '&:hover': { backgroundColor: hover, color: text } },
              }}
            >
              <IconDeviceLaptop
                size={15}
                stroke={1.6}
              />
            </ActionIcon>
          </Tooltip>

          <Tooltip
            label="Purchase Order"
            withArrow
            position="bottom"
            openDelay={400}
          >
            <ActionIcon
              variant="subtle"
              size={30}
              radius={6}
              component={Link}
              to="/purchases/pop"
              style={ib()}
              styles={{
                root: { '&:hover': { backgroundColor: hover, color: text } },
              }}
            >
              <IconShoppingBagCheck
                size={15}
                stroke={1.6}
              />
            </ActionIcon>
          </Tooltip>

          <Tooltip
            label="Stock Transfer"
            withArrow
            position="bottom"
            openDelay={400}
          >
            <ActionIcon
              variant="subtle"
              size={30}
              radius={6}
              component={Link}
              to="/inventory/stock-transfer"
              style={ib()}
              styles={{
                root: { '&:hover': { backgroundColor: hover, color: text } },
              }}
            >
              <IconArrowsRightLeft
                size={15}
                stroke={1.6}
              />
            </ActionIcon>
          </Tooltip>

          <Tooltip
            label="Barcode Manager"
            withArrow
            position="bottom"
            openDelay={400}
          >
            <ActionIcon
              variant="subtle"
              size={30}
              radius={6}
              component={Link}
              to="/items-master/bar-codes"
              style={ib()}
              styles={{
                root: { '&:hover': { backgroundColor: hover, color: text } },
              }}
            >
              <IconBarcode
                size={15}
                stroke={1.6}
              />
            </ActionIcon>
          </Tooltip>

          <RoleGuard
            allowedRoles={[
              Role.company_admin,
              Role.area_admin,
              Role.store_admin,
            ]}
          >
            <Tooltip
              label="Settings"
              withArrow
              position="bottom"
              openDelay={400}
            >
              <ActionIcon
                variant="subtle"
                size={30}
                radius={6}
                component={Link}
                to="/settings/company"
                style={ib()}
                styles={{
                  root: { '&:hover': { backgroundColor: hover, color: text } },
                }}
              >
                <IconSettings
                  size={15}
                  stroke={1.6}
                />
              </ActionIcon>
            </Tooltip>
          </RoleGuard>
        </Group>
      </Group>
    </Group>
  )

  return (
    <>
      <Modal
        opened={lockOpen}
        onClose={() => {
          setPassword('')
          dispatch(clearRestrictedModeError())
          closeLock()
        }}
        title={
          <Text
            fw={600}
            size="sm"
          >
            {isUnlocked
              ? '🔒 Lock Restricted Mode'
              : '🔓 Unlock Restricted Mode'}
          </Text>
        }
        centered
        size="sm"
        overlayProps={{ blur: 3 }}
      >
        <Stack gap="md">
          <Text
            size="sm"
            c="dimmed"
          >
            {isUnlocked
              ? 'Click Lock to hide sensitive data.'
              : 'Enter your password to reveal all data.'}
          </Text>
          {!isUnlocked && (
            <PasswordInput
              label="Password"
              placeholder="Restricted mode password"
              value={password}
              onChange={(e) => {
                setPassword(e.currentTarget.value)
                dispatch(clearRestrictedModeError())
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleLockSubmit()
              }}
              error={reduxError}
              autoFocus
            />
          )}
          <Group
            justify="flex-end"
            gap="sm"
          >
            <Button
              variant="subtle"
              color="gray"
              onClick={() => {
                setPassword('')
                dispatch(clearRestrictedModeError())
                closeLock()
              }}
            >
              Cancel
            </Button>
            <Button
              color={isUnlocked ? 'red' : 'green'}
              loading={isLoading}
              onClick={handleLockSubmit}
            >
              {isUnlocked ? 'Lock' : 'Unlock'}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {standalone ? (
        <div style={headerStyle}>{inner}</div>
      ) : (
        <AppShell.Header style={headerStyle}>{inner}</AppShell.Header>
      )}
    </>
  )
}

export default Navbar

