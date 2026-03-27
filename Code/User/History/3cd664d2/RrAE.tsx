import React, { useState, useCallback } from 'react'
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
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import {
  IconArrowLeft,
  IconChevronRight,
  IconSearch,
  IconBuildingSkyscraper,
  IconSlideshow,
  IconShieldLock,
  IconLock,
  IconLockOpen,
  IconChevronDown,
  IconBell,
  IconUser,
} from '@tabler/icons-react'
import { NotificationMenu } from './NotificationMenu'
import { UserMenu } from './UserMenu'
import { AreasStoresSelectionIndicator } from './AreasStoresSelectionIndicator'
import { useSelector, useDispatch } from 'react-redux'
import { RootState, AppDispatch } from '@app/core/store/store'
import { Company } from '@shared/types/company'
import { Permission } from '@shared/constants/permissions'
import { Role } from '@shared/constants/roles'
import { PermissionGuard, RoleGuard } from '@shared/components/Permissionguards'
import { Link } from 'react-router-dom'
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

export const NAVBAR_HEIGHT = 52

const Navbar = ({
  breadcrumbs,
  onBack,
  backLabel = 'Go back',
  standalone = false,
}: NavbarProps) => {
  const theme = useMantineTheme()
  const { colorScheme } = useMantineColorScheme()
  const isDark = colorScheme === 'dark'
  const dispatch = useDispatch<AppDispatch>()

  const company = useSelector(
    (state: RootState) => state.auth.company as Company | null,
  )
  const companyId = useSelector(
    (state: RootState) => state.auth.company?.id as number | undefined,
  )
  const isUnlocked = useSelector(selectIsUnlocked)
  const isLoading = useSelector(selectRestrictedModeLoading)
  const reduxError = useSelector(selectRestrictedModeError)

  const [password, setPassword] = useState('')
  const [lockModalOpen, { open: openLockModal, close: closeLockModal }] =
    useDisclosure(false)

  const logoUrl = company?.logo_url
  const companyName = company?.company_name ?? 'PharmaSOS'
  const shortName =
    companyName.length > 16 ? companyName.slice(0, 16) + '…' : companyName

  const handleLockToggle = useCallback(() => {
    setPassword('')
    dispatch(clearRestrictedModeError())
    openLockModal()
  }, [openLockModal, dispatch])

  const handlePasswordSubmit = useCallback(async () => {
    if (isUnlocked) {
      dispatch(lockRestrictedMode())
      notifications.show({
        title: '🔒 Locked',
        message: 'Sensitive data is now hidden.',
        color: 'red',
        autoClose: 2000,
      })
      closeLockModal()
      return
    }
    if (!password.trim() || !companyId) return
    const result = await dispatch(unlockRestrictedMode({ password, companyId }))
    if (unlockRestrictedMode.fulfilled.match(result)) {
      notifications.show({
        title: '🔓 Unlocked',
        message: 'All data is now visible.',
        color: 'green',
        autoClose: 2000,
      })
      closeLockModal()
      setPassword('')
    }
  }, [password, isUnlocked, companyId, dispatch, closeLockModal])

  const handleLockModalClose = useCallback(() => {
    setPassword('')
    dispatch(clearRestrictedModeError())
    closeLockModal()
  }, [closeLockModal, dispatch])

  /* ── design tokens ───────────────────────────────────────── */
  const surface = isDark ? '#1c1f26' : '#ffffff'
  const borderCol = isDark ? '#2e3039' : '#e5e7eb'
  const textPrimary = isDark ? '#f0f2f5' : '#111827'
  const textMuted = isDark ? '#6b7280' : '#9ca3af'
  const hoverBg = isDark ? '#252830' : '#f3f4f6'
  const inputBg = isDark ? '#13151a' : '#f9fafb'
  const menuSurface = isDark ? '#1c1f26' : '#ffffff'
  const menuBorder = isDark ? '#2e3039' : '#e5e7eb'

  const headerStyle: React.CSSProperties = {
    height: NAVBAR_HEIGHT,
    backgroundColor: surface,
    borderBottom: `1px solid ${borderCol}`,
    ...(standalone
      ? { display: 'flex', alignItems: 'center', width: '100%', flexShrink: 0 }
      : {}),
  }

  const inner = (
    <Group
      h="100%"
      px={12}
      justify="space-between"
      wrap="nowrap"
      gap={0}
    >
      {/* ══ SECTION 1 — Brand (fixed width, always visible) ══════ */}
      <Group
        wrap="nowrap"
        gap={0}
        align="center"
        style={{
          width: 220,
          flexShrink: 0,
          borderRight: `1px solid ${borderCol}`,
          height: '100%',
          paddingRight: 12,
        }}
      >
        <Menu
          shadow="lg"
          width={220}
          radius={8}
          position="bottom-start"
          offset={0}
          styles={{
            dropdown: {
              backgroundColor: menuSurface,
              border: `1px solid ${menuBorder}`,
              padding: 4,
              boxShadow: isDark
                ? '0 4px 24px rgba(0,0,0,0.6)'
                : '0 4px 24px rgba(0,0,0,0.10)',
              borderRadius: 8,
            },
          }}
        >
          <Menu.Target>
            <Group
              gap={9}
              wrap="nowrap"
              align="center"
              style={{
                cursor: 'pointer',
                flex: 1,
                padding: '4px 6px',
                borderRadius: 6,
                transition: 'background 0.15s',
              }}
              styles={
                { root: { '&:hover': { backgroundColor: hoverBg } } } as any
              }
            >
              <Indicator
                color={isUnlocked ? 'teal' : 'red'}
                size={6}
                position="bottom-end"
                processing={isUnlocked}
                offset={1}
              >
                <Avatar
                  src={logoUrl}
                  size={28}
                  radius={6}
                  style={{ border: `1px solid ${borderCol}`, flexShrink: 0 }}
                />
              </Indicator>
              <Box style={{ flex: 1, minWidth: 0 }}>
                <Text
                  size="xs"
                  fw={700}
                  style={{
                    color: textPrimary,
                    letterSpacing: '-0.01em',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    lineHeight: 1.2,
                  }}
                >
                  {shortName}
                </Text>
                <Text
                  style={{
                    color: textMuted,
                    fontSize: 10,
                    lineHeight: 1.1,
                    marginTop: 1,
                  }}
                >
                  Pharmacy System
                </Text>
              </Box>
              <IconChevronDown
                size={11}
                stroke={2.5}
                style={{ color: textMuted, flexShrink: 0 }}
              />
            </Group>
          </Menu.Target>

          <Menu.Dropdown>
            {/* Company header */}
            <Box
              px={10}
              py={8}
              mb={2}
              style={{
                borderRadius: 6,
                background: isDark ? '#13151a' : '#f9fafb',
                border: `1px solid ${menuBorder}`,
              }}
            >
              <Group
                gap={8}
                wrap="nowrap"
              >
                <Avatar
                  src={logoUrl}
                  size={30}
                  radius={6}
                  style={{ border: `1px solid ${menuBorder}`, flexShrink: 0 }}
                />
                <Box style={{ minWidth: 0 }}>
                  <Text
                    size="xs"
                    fw={700}
                    lineClamp={1}
                    style={{ color: textPrimary, letterSpacing: '-0.01em' }}
                  >
                    {companyName}
                  </Text>
                  <Text style={{ color: textMuted, fontSize: 10 }}>
                    {isUnlocked ? '🔓 Unlocked' : '🔒 Restricted'}
                  </Text>
                </Box>
              </Group>
            </Box>

            <RoleGuard
              allowedRoles={[
                Role.company_admin,
                Role.area_admin,
                Role.store_admin,
              ]}
            >
              <PermissionGuard permission={Permission.COMPANY_SETTINGS_READ}>
                <Menu.Item
                  component={Link}
                  to="/settings/company"
                  leftSection={
                    <IconBuildingSkyscraper
                      size={13}
                      stroke={1.5}
                      style={{ color: textMuted }}
                    />
                  }
                  style={{
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 500,
                    color: textPrimary,
                    padding: '7px 8px',
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
                    size={13}
                    stroke={1.5}
                    style={{ color: textMuted }}
                  />
                }
                style={{
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 500,
                  color: textPrimary,
                  padding: '7px 8px',
                }}
              >
                Preferences
              </Menu.Item>
              <Menu.Item
                leftSection={
                  <IconShieldLock
                    size={13}
                    stroke={1.5}
                    style={{ color: textMuted }}
                  />
                }
                style={{
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 500,
                  color: textPrimary,
                  padding: '7px 8px',
                }}
              >
                Privacy
              </Menu.Item>
              <Menu.Divider
                style={{ borderColor: menuBorder, margin: '3px 0' }}
              />
            </RoleGuard>

            <Menu.Item
              onClick={handleLockToggle}
              leftSection={
                isUnlocked ? (
                  <IconLock
                    size={13}
                    stroke={1.5}
                    style={{ color: '#ef4444' }}
                  />
                ) : (
                  <IconLockOpen
                    size={13}
                    stroke={1.5}
                    style={{ color: '#10b981' }}
                  />
                )
              }
              style={{
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 500,
                padding: '7px 8px',
                color: isUnlocked ? '#ef4444' : textPrimary,
              }}
            >
              {isUnlocked ? 'Lock Restricted Mode' : 'Unlock Restricted Mode'}
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Group>

      {/* ══ SECTION 2 — Breadcrumb (flex, takes remaining space) ═ */}
      <Group
        wrap="nowrap"
        gap={6}
        align="center"
        style={{
          flex: 1,
          paddingLeft: 14,
          paddingRight: 14,
          minWidth: 0,
          overflow: 'hidden',
        }}
      >
        {/* Back button */}
        {onBack && (
          <Tooltip
            label={backLabel}
            withArrow
            position="bottom"
            openDelay={600}
          >
            <ActionIcon
              variant="subtle"
              size={26}
              radius={5}
              onClick={onBack}
              style={{ color: textMuted, flexShrink: 0 }}
              styles={{
                root: {
                  '&:hover': { backgroundColor: hoverBg, color: textPrimary },
                },
              }}
            >
              <IconArrowLeft
                size={14}
                stroke={1.8}
              />
            </ActionIcon>
          </Tooltip>
        )}

        {/* Breadcrumb trail */}
        {breadcrumbs && breadcrumbs.length > 0 && (
          <Group
            gap={4}
            wrap="nowrap"
            align="center"
            style={{ minWidth: 0, overflow: 'hidden' }}
          >
            {breadcrumbs.map((crumb, idx) => {
              const isLast = idx === breadcrumbs.length - 1
              const isFirst = idx === 0
              return (
                <React.Fragment key={idx}>
                  {!isFirst && (
                    <IconChevronRight
                      size={11}
                      stroke={2}
                      style={{ color: textMuted, flexShrink: 0, opacity: 0.5 }}
                    />
                  )}
                  {isLast ? (
                    <Text
                      size="xs"
                      fw={600}
                      style={{
                        color: textPrimary,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        letterSpacing: '-0.01em',
                      }}
                    >
                      {crumb.label}
                    </Text>
                  ) : (
                    <Text
                      size="xs"
                      onClick={crumb.onClick}
                      style={{
                        color: textMuted,
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                        cursor: crumb.onClick ? 'pointer' : 'default',
                        fontWeight: isFirst ? 500 : 400,
                      }}
                    >
                      {crumb.label}
                    </Text>
                  )}
                </React.Fragment>
              )
            })}
          </Group>
        )}
      </Group>

      {/* ══ SECTION 3 — Search (fixed width center) ═════════════ */}
      <Box style={{ flexShrink: 0, width: 260 }}>
        <TextInput
          placeholder="Search anything…"
          leftSection={
            <IconSearch
              size={14}
              stroke={1.8}
              style={{ color: textMuted }}
            />
          }
          radius={6}
          size="xs"
          styles={{
            input: {
              backgroundColor: inputBg,
              border: `1px solid ${borderCol}`,
              color: textPrimary,
              fontSize: 12,
              height: 32,
              paddingLeft: 32,
              transition: 'border-color 0.15s, box-shadow 0.15s',
              '&::placeholder': { color: textMuted },
              '&:focus': {
                borderColor: theme.colors[theme.primaryColor][isDark ? 6 : 5],
                boxShadow: `0 0 0 2px ${theme.colors[theme.primaryColor][isDark ? 9 : 1]}`,
              },
            },
          }}
        />
      </Box>

      {/* ══ SECTION 4 — Right actions ═══════════════════════════ */}
      <Group
        gap={2}
        wrap="nowrap"
        align="center"
        style={{
          flexShrink: 0,
          paddingLeft: 12,
          borderLeft: `1px solid ${borderCol}`,
          height: '100%',
          marginLeft: 12,
        }}
      >
        {/* Store / Area selector */}
        <AreasStoresSelectionIndicator />

        {/* divider */}
        <Box
          style={{
            width: 1,
            height: 16,
            backgroundColor: borderCol,
            marginInline: 4,
          }}
        />

        {/* Notifications */}
        <PermissionGuard permission={Permission.NOTIFICATIONS_READ}>
          <NotificationMenu />
        </PermissionGuard>

        {/* User avatar */}
        <UserMenu />
      </Group>
    </Group>
  )

  return (
    <>
      {/* Lock / unlock modal */}
      <Modal
        opened={lockModalOpen}
        onClose={handleLockModalClose}
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
              ? 'Click Lock to hide sensitive data from view.'
              : 'Enter your password to view all data.'}
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
                if (e.key === 'Enter') handlePasswordSubmit()
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
              onClick={handleLockModalClose}
            >
              Cancel
            </Button>
            <Button
              color={isUnlocked ? 'red' : 'green'}
              loading={isLoading}
              onClick={handlePasswordSubmit}
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

