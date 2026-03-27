import React, { useState, useCallback, useEffect, useRef } from 'react'
import ReactDOM from 'react-dom'
import {
  AppShell,
  Avatar,
  Group,
  Text,
  Stack,
  Box,
  Indicator,
  ActionIcon,
  Tooltip,
  Menu,
  TextInput,
  Badge,
  Modal,
  PasswordInput,
  Button,
  ScrollArea,
  useMantineTheme,
  useMantineColorScheme,
} from '@mantine/core'
import { useDisclosure, useHotkeys } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import {
  IconChevronLeft,
  IconChevronRight as IconChevRight,
  IconSearch,
  IconBuildingSkyscraper,
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
  IconSlideshow as IconPrefs,
  IconLogout,
  IconUserCircle,
  IconSlideshow,
} from '@tabler/icons-react'
import { NotificationMenu } from './NotificationMenu'
import { AreasStoresSelectionIndicator } from './AreasStoresSelectionIndicator'
import { GlobalSearch, ALL_SEARCH_ITEMS, scoreMatch } from './GlobalSearch'
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

  /* ── auth ─────────────────────────────────────────── */
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

  /* company abbreviation — e.g. "PharmaSOS" → "PS", "Green Life Pharmacy" → "GL" */
  const companyAbbr = React.useMemo(() => {
    const name = company?.company_name ?? 'PharmaSOS'
    const words = name.trim().split(/\s+/).filter(Boolean)
    if (words.length === 1) return name.slice(0, 2).toUpperCase()
    return (words[0][0] + words[1][0]).toUpperCase()
  }, [company?.company_name])

  /* ── restricted mode ──────────────────────────────── */
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

  /* ── global search ────────────────────────────────── */
  const [searchOpen, { open: openSearch, close: closeSearch }] =
    useDisclosure(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const [dropdownPos, setDropdownPos] = useState<{
    top: number
    left: number
    width: number
  } | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const searchContainerRef = useRef<HTMLDivElement>(null)

  // Recalculate dropdown position whenever focused
  useEffect(() => {
    if (!searchFocused || !searchContainerRef.current) {
      setDropdownPos(null)
      return
    }
    const rect = searchContainerRef.current.getBoundingClientRect()
    setDropdownPos({ top: rect.bottom + 4, left: rect.left, width: rect.width })
  }, [searchFocused])

  useHotkeys([
    [
      'mod+k',
      () => {
        searchRef.current?.focus()
        setSearchFocused(true)
      },
    ],
  ])

  /* ── live inventory alerts ────────────────────────── */
  const [lowStockCount, setLowStockCount] = useState(0)
  const [expiringSoonCount, setExpiringSoonCount] = useState(0)
  const scopeStoreId = useSelector(
    (state: RootState) => state.areaStore.selectedStore?.id,
  )

  useEffect(() => {
    if (!companyId) return
    const fetchCounts = async () => {
      try {
        let lowQ = supabase
          .from('view_low_stock')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', companyId)
        if (scopeStoreId) lowQ = lowQ.eq('store_id', scopeStoreId)
        const { count: lc } = await lowQ
        setLowStockCount(lc ?? 0)

        let expQ = supabase
          .from('view_expiring_stock')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', companyId)
          .lte('days_to_expiry', 30)
        if (scopeStoreId) expQ = expQ.eq('store_id', scopeStoreId)
        const { count: ec } = await expQ
        setExpiringSoonCount(ec ?? 0)
      } catch (_) {}
    }
    fetchCounts()
    const t = setInterval(fetchCounts, 5 * 60 * 1000)
    return () => clearInterval(t)
  }, [companyId, scopeStoreId])

  /* ── theme-derived tokens (NO hardcoded hex) ──────── */
  const bg = isDark ? theme.colors.dark[7] : theme.white
  const borderCol = isDark ? theme.colors.dark[5] : theme.colors.gray[2]
  const textPrimary = isDark ? theme.colors.dark[0] : theme.colors.gray[9]
  const textMuted = isDark ? theme.colors.dark[3] : theme.colors.gray[5]
  const hoverBg = isDark ? theme.colors.dark[7] : theme.colors.gray[0]
  const activeBg = isDark ? theme.colors.dark[6] : theme.colors.gray[1]
  const inputBg = isDark ? theme.colors.dark[9] : theme.colors.gray[0]
  const dropBg = isDark ? theme.colors.dark[7] : theme.white
  const primary = theme.colors[theme.primaryColor][isDark ? 4 : 6]
  const primaryBg = isDark
    ? `${theme.colors[theme.primaryColor][9]}50`
    : theme.colors[theme.primaryColor][0]
  const primaryBorder = isDark
    ? `${theme.colors[theme.primaryColor][8]}60`
    : theme.colors[theme.primaryColor][2]

  const dropStyles = {
    dropdown: {
      backgroundColor: dropBg,
      border: `1px solid ${borderCol}`,
      borderRadius: theme.radius.md,
      padding: 5,
      boxShadow: theme.shadows.lg,
    },
  }

  /* ── reusable sub-components ──────────────────────── */
  const VDivider = () => (
    <Box
      style={{
        width: 1,
        height: 18,
        backgroundColor: borderCol,
        flexShrink: 0,
        marginInline: 3,
      }}
    />
  )

  const iconBtnStyles = {
    root: {
      color: textMuted,
      borderRadius: theme.radius.sm,
      '&:hover': { backgroundColor: hoverBg, color: textPrimary },
    },
  }

  const menuItemStyle = {
    borderRadius: theme.radius.sm,
    fontSize: 13,
    fontWeight: 500,
    color: textPrimary,
  }

  const headerStyle: React.CSSProperties = {
    height: NAVBAR_HEIGHT,
    backgroundColor: bg,
    borderBottom: `1px solid ${borderCol}`,
    ...(standalone
      ? { display: 'flex', alignItems: 'center', width: '100%', flexShrink: 0 }
      : {}),
  }

  return (
    <>
      {/* Global search modal */}
      <GlobalSearch
        opened={searchOpen}
        onClose={closeSearch}
      />

      {/* Lock/Unlock modal */}
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
            {isUnlocked ? '🔒 Lock' : '🔓 Unlock'} Restricted Mode
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

      {(() => {
        const inner = (
          <Group
            h="100%"
            px={0}
            wrap="nowrap"
            gap={0}
            align="center"
            style={{ overflow: 'hidden' }}
          >
            {/* ══════════════════════════════════════════════════
                1. BRAND — width = sidebar (260px)
                   Avatar | Full name (top) / Company (bottom)
                   Dropdown: profile, company, preferences, lock
            ══════════════════════════════════════════════════ */}
            <Box
              style={{
                width: SIDEBAR_WIDTH,
                flexShrink: 0,
                height: '100%',
                borderRight: `1px solid ${borderCol}`,
                display: 'flex',
                alignItems: 'center',
                paddingInline: 12,
              }}
            >
              <Menu
                shadow="lg"
                width={SIDEBAR_WIDTH + 16}
                radius="md"
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
                      borderRadius: theme.radius.sm,
                      padding: '6px 8px',
                      userSelect: 'none',
                      transition: 'background 0.12s',
                    }}
                    styles={
                      {
                        root: { '&:hover': { backgroundColor: hoverBg } },
                      } as any
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
                        radius="sm"
                        size={34}
                        style={{
                          backgroundColor: primaryBg,
                          border: `1.5px solid ${primaryBorder}`,
                          flexShrink: 0,
                          color: primary,
                          fontWeight: 700,
                          fontSize: 13,
                          letterSpacing: '-0.02em',
                        }}
                      >
                        {companyAbbr}
                      </Avatar>
                    </Indicator>
                    <Box style={{ flex: 1, minWidth: 0 }}>
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          lineHeight: 1.25,
                          color: textPrimary,
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
                          color: textMuted,
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
                      style={{ color: textMuted, flexShrink: 0 }}
                    />
                  </Group>
                </Menu.Target>

                <Menu.Dropdown>
                  {/* User card */}
                  <Box
                    px={10}
                    py={9}
                    mb={4}
                    style={{
                      borderRadius: theme.radius.sm,
                      background: inputBg,
                      border: `1px solid ${borderCol}`,
                    }}
                  >
                    <Group
                      gap={9}
                      wrap="nowrap"
                    >
                      <Avatar
                        radius="sm"
                        size={36}
                        style={{
                          backgroundColor: primaryBg,
                          color: primary,
                          fontWeight: 700,
                          fontSize: 13,
                          flexShrink: 0,
                          border: `1.5px solid ${primaryBorder}`,
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
                            color: textPrimary,
                          }}
                          lineClamp={1}
                        >
                          {fullName}
                        </Text>
                        <Text
                          style={{ fontSize: 11, color: textMuted }}
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
                          style={{ color: textMuted }}
                        />
                      }
                      style={menuItemStyle}
                    >
                      My Profile
                    </Menu.Item>
                  </PermissionGuard>

                  <Menu.Divider
                    style={{ borderColor: borderCol, margin: '4px 0' }}
                  />

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
                        color: textMuted,
                        padding: '2px 8px',
                      }}
                    >
                      Company
                    </Menu.Label>
                    <PermissionGuard
                      permission={Permission.COMPANY_SETTINGS_READ}
                    >
                      <Menu.Item
                        component={Link}
                        to="/settings/company"
                        leftSection={
                          <IconBuildingSkyscraper
                            size={14}
                            stroke={1.5}
                            style={{ color: textMuted }}
                          />
                        }
                        style={menuItemStyle}
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
                          style={{ color: textMuted }}
                        />
                      }
                      style={menuItemStyle}
                    >
                      Preferences
                    </Menu.Item>
                    <Menu.Item
                      leftSection={
                        <IconShieldLock
                          size={14}
                          stroke={1.5}
                          style={{ color: textMuted }}
                        />
                      }
                      style={menuItemStyle}
                    >
                      Privacy
                    </Menu.Item>
                    <Menu.Divider
                      style={{ borderColor: borderCol, margin: '4px 0' }}
                    />
                  </RoleGuard>

                  <Menu.Item
                    onClick={handleLockToggle}
                    leftSection={
                      isUnlocked ? (
                        <IconLock
                          size={14}
                          stroke={1.5}
                          style={{ color: theme.colors.red[isDark ? 4 : 6] }}
                        />
                      ) : (
                        <IconLockOpen
                          size={14}
                          stroke={1.5}
                          style={{ color: theme.colors.teal[isDark ? 4 : 6] }}
                        />
                      )
                    }
                    style={{
                      ...menuItemStyle,
                      color: isUnlocked
                        ? theme.colors.red[isDark ? 4 : 6]
                        : textPrimary,
                    }}
                  >
                    {isUnlocked
                      ? 'Lock Restricted Mode'
                      : 'Unlock Restricted Mode'}
                  </Menu.Item>

                  <Menu.Divider
                    style={{ borderColor: borderCol, margin: '4px 0' }}
                  />

                  <Menu.Item
                    color="red"
                    onClick={() => logout()}
                    leftSection={
                      <IconLogout
                        size={14}
                        stroke={1.5}
                      />
                    }
                    style={{
                      ...menuItemStyle,
                      color: theme.colors.red[isDark ? 4 : 6],
                    }}
                  >
                    Sign out
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            </Box>

            {/* ══════════════════════════════════════════════════
                2. BACK / FORWARD
            ══════════════════════════════════════════════════ */}
            <Group
              gap={1}
              wrap="nowrap"
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
                  radius="sm"
                  onClick={() => router(-1)}
                  styles={iconBtnStyles}
                >
                  <IconChevronLeft
                    size={15}
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
                  radius="sm"
                  onClick={() => router(1)}
                  styles={iconBtnStyles}
                >
                  <IconChevRight
                    size={15}
                    stroke={2}
                  />
                </ActionIcon>
              </Tooltip>
            </Group>

            <VDivider />

            {/* ══════════════════════════════════════════════════
                3. SEARCH — inline input with dropdown results
            ══════════════════════════════════════════════════ */}
            <Box
              ref={searchContainerRef}
              style={{
                flexShrink: 0,
                width: 340,
                paddingInline: 8,
                position: 'relative',
              }}
            >
              {/* Inline search input */}
              <Box
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  height: 32,
                  paddingInline: 10,
                  borderRadius: theme.radius.sm,
                  backgroundColor: inputBg,
                  border: `1px solid ${searchFocused ? primary : borderCol}`,
                  transition: 'border-color 0.15s, box-shadow 0.15s',
                  boxShadow: searchFocused ? `0 0 0 2px ${primaryBg}` : 'none',
                }}
              >
                <IconSearch
                  size={13}
                  stroke={1.8}
                  style={{
                    color: searchFocused ? primary : textMuted,
                    flexShrink: 0,
                  }}
                />
                <input
                  ref={searchRef}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => {
                    // slight delay so click on result registers first
                    setTimeout(() => setSearchFocused(false), 150)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setSearchQuery('')
                      searchRef.current?.blur()
                    }
                  }}
                  placeholder="Search pages, features…"
                  style={{
                    flex: 1,
                    border: 'none',
                    outline: 'none',
                    background: 'transparent',
                    fontSize: 12,
                    color: textPrimary,
                    minWidth: 0,
                  }}
                />
                <Box
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    padding: '1px 5px',
                    borderRadius: 4,
                    backgroundColor: isDark
                      ? theme.colors.dark[6]
                      : theme.colors.gray[1],
                    border: `1px solid ${borderCol}`,
                    flexShrink: 0,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 9,
                      color: textMuted,
                      fontWeight: 600,
                      letterSpacing: '0.02em',
                    }}
                  >
                    ⌘K
                  </Text>
                </Box>
              </Box>

              {/* Portal dropdown — rendered at body level to escape overflow:hidden */}
              {searchFocused &&
                dropdownPos &&
                (() => {
                  const q = searchQuery.trim()
                  const results = q
                    ? ALL_SEARCH_ITEMS.map((item) => ({
                        item,
                        score: scoreMatch(item, q),
                      }))
                        .filter((x) => x.score > 0)
                        .sort((a, b) => b.score - a.score)
                        .slice(0, 8)
                        .map((x) => x.item)
                    : ALL_SEARCH_ITEMS.slice(0, 6)
                  if (results.length === 0) return null
                  return ReactDOM.createPortal(
                    <Box
                      style={{
                        position: 'fixed',
                        top: dropdownPos.top,
                        left: dropdownPos.left,
                        width: dropdownPos.width,
                        backgroundColor: dropBg,
                        border: `1px solid ${borderCol}`,
                        borderRadius: theme.radius.md,
                        boxShadow: theme.shadows.xl,
                        zIndex: 9999,
                        overflow: 'hidden',
                      }}
                    >
                      <ScrollArea mah={320}>
                        <Box p={6}>
                          {!q && (
                            <Text
                              style={{
                                fontSize: 10,
                                fontWeight: 700,
                                letterSpacing: '0.07em',
                                textTransform: 'uppercase',
                                color: textMuted,
                                padding: '4px 8px 6px',
                              }}
                            >
                              Quick navigation
                            </Text>
                          )}
                          {results.map((item) => {
                            const Icon = item.icon
                            return (
                              <Box
                                key={item.link}
                                onMouseDown={(e) => {
                                  // use onMouseDown so it fires before onBlur
                                  e.preventDefault()
                                  router(item.link)
                                  setSearchQuery('')
                                  setSearchFocused(false)
                                  searchRef.current?.blur()
                                }}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 9,
                                  padding: '7px 8px',
                                  borderRadius: 6,
                                  cursor: 'pointer',
                                  transition: 'background 0.1s',
                                }}
                                onMouseEnter={(e) => {
                                  ;(
                                    e.currentTarget as HTMLElement
                                  ).style.backgroundColor = hoverBg
                                }}
                                onMouseLeave={(e) => {
                                  ;(
                                    e.currentTarget as HTMLElement
                                  ).style.backgroundColor = 'transparent'
                                }}
                              >
                                <Box
                                  style={{
                                    width: 26,
                                    height: 26,
                                    borderRadius: 6,
                                    flexShrink: 0,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    backgroundColor: isDark
                                      ? theme.colors.dark[6]
                                      : theme.colors.gray[1],
                                    border: `1px solid ${borderCol}`,
                                  }}
                                >
                                  <Icon
                                    size={14}
                                    stroke={1.6}
                                    style={{ color: textMuted }}
                                  />
                                </Box>
                                <Box style={{ flex: 1, minWidth: 0 }}>
                                  <Text
                                    style={{
                                      fontSize: 12,
                                      fontWeight: 500,
                                      color: textPrimary,
                                      lineHeight: 1.3,
                                    }}
                                  >
                                    {item.name}
                                  </Text>
                                  <Text
                                    style={{
                                      fontSize: 10,
                                      color: textMuted,
                                      lineHeight: 1.2,
                                    }}
                                  >
                                    {item.group}
                                  </Text>
                                </Box>
                              </Box>
                            )
                          })}
                        </Box>
                      </ScrollArea>
                    </Box>,
                    document.body,
                  )
                })()}
            </Box>

            <VDivider />

            {/* ══════════════════════════════════════════════════
                4. BREADCRUMB — centered flex
            ══════════════════════════════════════════════════ */}
            <Group
              gap={4}
              wrap="nowrap"
              align="center"
              style={{
                flex: 1,
                minWidth: 0,
                paddingInline: 10,
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
                          style={{
                            color: textMuted,
                            opacity: 0.4,
                            flexShrink: 0,
                          }}
                        />
                      )}
                      <Text
                        onClick={
                          !isLast && crumb.onClick ? crumb.onClick : undefined
                        }
                        style={{
                          fontSize: 12,
                          fontWeight: isLast ? 600 : 400,
                          color: isLast ? textPrimary : textMuted,
                          whiteSpace: 'nowrap',
                          cursor:
                            !isLast && crumb.onClick ? 'pointer' : 'default',
                          maxWidth: isLast ? 180 : 100,
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
                <Text style={{ fontSize: 12, color: textMuted }}>
                  Pharmacy Management System
                </Text>
              )}
            </Group>

            <VDivider />

            {/* ══════════════════════════════════════════════════
                5-8. RIGHT ACTIONS
            ══════════════════════════════════════════════════ */}
            <Group
              gap={2}
              wrap="nowrap"
              align="center"
              style={{ flexShrink: 0, paddingInline: 8, height: '100%' }}
            >
              {/* 5 — Branch selector */}
              <AreasStoresSelectionIndicator />
              <VDivider />

              {/* 6 — Live stock alerts */}
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
                    radius="sm"
                    component={Link}
                    to="/inventory/low-stock"
                    styles={{
                      root: {
                        color:
                          lowStockCount > 0
                            ? theme.colors.orange[isDark ? 4 : 6]
                            : textMuted,
                        '&:hover': { backgroundColor: hoverBg },
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
                        indicator: {
                          fontSize: 9,
                          fontWeight: 700,
                          padding: '0 3px',
                        },
                      }}
                    >
                      <IconAlertTriangle
                        size={16}
                        stroke={1.8}
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
                    radius="sm"
                    component={Link}
                    to="/inventory/expiring-soon"
                    styles={{
                      root: {
                        color:
                          expiringSoonCount > 0
                            ? theme.colors.red[isDark ? 4 : 6]
                            : textMuted,
                        '&:hover': { backgroundColor: hoverBg },
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
                        indicator: {
                          fontSize: 9,
                          fontWeight: 700,
                          padding: '0 3px',
                        },
                      }}
                    >
                      <IconClock
                        size={16}
                        stroke={1.8}
                      />
                    </Indicator>
                  </ActionIcon>
                </Tooltip>
              </PermissionGuard>

              <VDivider />

              {/* 7 — Notifications */}
              <PermissionGuard permission={Permission.NOTIFICATIONS_READ}>
                <NotificationMenu />
              </PermissionGuard>

              <VDivider />

              {/* 8 — Quick-launch tools */}
              <Group
                gap={1}
                wrap="nowrap"
              >
                {/* ← CHANGED: settings icon now links to preferences */}
                <Tooltip
                  label="Preferences"
                  withArrow
                  position="bottom"
                  openDelay={400}
                >
                  <ActionIcon
                    variant="subtle"
                    size={30}
                    radius="sm"
                    component={Link}
                    to="/settings/preferences"
                    styles={iconBtnStyles}
                  >
                    <IconSlideshow
                      size={15}
                      stroke={1.6}
                    />
                  </ActionIcon>
                </Tooltip>
              </Group>
            </Group>
          </Group>
        )

        return standalone ? (
          <div style={headerStyle}>{inner}</div>
        ) : (
          <AppShell.Header style={headerStyle}>{inner}</AppShell.Header>
        )
      })()}
    </>
  )
}

export default Navbar

