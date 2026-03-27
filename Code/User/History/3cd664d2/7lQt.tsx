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
  Divider,
  Badge,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import {
  IconArrowLeft,
  IconChevronRight,
  IconHome2,
  IconBuildingSkyscraper,
  IconSlideshow,
  IconShieldLock,
  IconLock,
  IconLockOpen,
  IconChevronDown,
} from '@tabler/icons-react'
import { NotificationMenu } from './NotificationMenu'
import { UserMenu } from './UserMenu'
import { AreasStoresSelectionIndicator } from './AreasStoresSelectionIndicator'
import { useSelector, useDispatch } from 'react-redux'
import { RootState, AppDispatch } from '@app/core/store/store'
import { Company } from '@shared/types/company'
import { Permission } from '@shared/constants/permissions'
import { Role } from '@shared/constants/roles'
import { PermissionGuard } from '@shared/components/Permissionguards'
import { RoleGuard } from '@shared/components/Permissionguards'
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

export const NAVBAR_HEIGHT = 56

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
    companyName.length > 18 ? companyName.slice(0, 18) + '…' : companyName

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

  /* ── tokens ──────────────────────────────────────────────── */
  const surface = isDark ? '#111318' : '#ffffff'
  const border = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
  const text = isDark ? '#f1f3f5' : '#1a1d23'
  const muted = isDark ? '#636878' : '#9ea3ae'
  const hover = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'
  const menuBg = isDark ? '#16181f' : '#ffffff'
  const menuShadow = isDark
    ? '0 0 0 1px rgba(255,255,255,0.06), 0 16px 48px rgba(0,0,0,0.7)'
    : '0 0 0 1px rgba(0,0,0,0.06), 0 16px 48px rgba(0,0,0,0.10)'

  const headerStyle: React.CSSProperties = {
    height: NAVBAR_HEIGHT,
    backgroundColor: surface,
    borderBottom: `1px solid ${border}`,
    ...(standalone
      ? { display: 'flex', alignItems: 'center', width: '100%', flexShrink: 0 }
      : {}),
  }

  const inner = (
    <Group
      h="100%"
      px={14}
      justify="space-between"
      wrap="nowrap"
      gap={0}
    >
      {/* ── LEFT: company logo dropdown ───────────────────────── */}
      <Group
        wrap="nowrap"
        gap={0}
        align="center"
        style={{ flexShrink: 0 }}
      >
        <Menu
          shadow="xl"
          width={230}
          radius={10}
          position="bottom-start"
          offset={8}
          styles={{
            dropdown: {
              backgroundColor: menuBg,
              border: `1px solid ${border}`,
              padding: 6,
              boxShadow: menuShadow,
            },
          }}
        >
          <Menu.Target>
            <Box
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 9,
                cursor: 'pointer',
                borderRadius: 8,
                padding: '5px 10px 5px 6px',
                transition: 'background 0.15s',
                border: `1px solid transparent`,
              }}
              styles={
                {
                  '&:hover': { backgroundColor: hover, borderColor: border },
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
                  src={logoUrl}
                  size={30}
                  radius={7}
                  style={{ border: `1.5px solid ${border}`, flexShrink: 0 }}
                />
              </Indicator>
              <Text
                size="sm"
                fw={600}
                style={{
                  color: text,
                  letterSpacing: '-0.02em',
                  whiteSpace: 'nowrap',
                  userSelect: 'none',
                }}
              >
                {shortName}
              </Text>
              <IconChevronDown
                size={12}
                stroke={2.5}
                style={{ color: muted, marginLeft: 2 }}
              />
            </Box>
          </Menu.Target>

          <Menu.Dropdown>
            {/* Company info pill */}
            <Box
              px={10}
              py={8}
              mb={4}
              style={{
                borderRadius: 8,
                backgroundColor: isDark
                  ? 'rgba(255,255,255,0.03)'
                  : 'rgba(0,0,0,0.02)',
                border: `1px solid ${border}`,
              }}
            >
              <Group
                gap={10}
                wrap="nowrap"
              >
                <Avatar
                  src={logoUrl}
                  size={32}
                  radius={7}
                  style={{ border: `1.5px solid ${border}`, flexShrink: 0 }}
                />
                <Box style={{ minWidth: 0 }}>
                  <Text
                    size="sm"
                    fw={600}
                    lineClamp={1}
                    style={{ color: text, letterSpacing: '-0.02em' }}
                  >
                    {companyName}
                  </Text>
                  <Text
                    size="xs"
                    style={{ color: muted, fontSize: 11 }}
                  >
                    Pharmacy Management
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
                      size={14}
                      stroke={1.5}
                      style={{ color: muted }}
                    />
                  }
                  style={{
                    borderRadius: 7,
                    fontSize: 13,
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
                  fontSize: 13,
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
                  fontSize: 13,
                  fontWeight: 500,
                  color: text,
                }}
              >
                Privacy
              </Menu.Item>

              <Menu.Divider style={{ borderColor: border, margin: '4px 0' }} />
            </RoleGuard>

            {/* Restricted mode toggle */}
            <Menu.Item
              onClick={handleLockToggle}
              leftSection={
                isUnlocked ? (
                  <IconLock
                    size={14}
                    stroke={1.5}
                    style={{
                      color: isDark ? theme.colors.red[4] : theme.colors.red[6],
                    }}
                  />
                ) : (
                  <IconLockOpen
                    size={14}
                    stroke={1.5}
                    style={{
                      color: isDark
                        ? theme.colors.teal[4]
                        : theme.colors.teal[6],
                    }}
                  />
                )
              }
              style={{
                borderRadius: 7,
                fontSize: 13,
                fontWeight: 500,
                color: isUnlocked
                  ? isDark
                    ? theme.colors.red[4]
                    : theme.colors.red[6]
                  : text,
              }}
            >
              {isUnlocked ? 'Lock Restricted Mode' : 'Unlock Restricted Mode'}
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>

        {/* divider after brand */}
        <Box
          style={{
            width: 1,
            height: 18,
            backgroundColor: border,
            marginLeft: 12,
            marginRight: 12,
            flexShrink: 0,
          }}
        />
      </Group>

      {/* ── CENTRE: back + breadcrumbs ────────────────────────── */}
      <Group
        wrap="nowrap"
        gap={6}
        align="center"
        style={{ flex: 1, minWidth: 0 }}
      >
        {onBack && (
          <Tooltip
            label={backLabel}
            withArrow
            position="bottom"
            openDelay={500}
          >
            <ActionIcon
              variant="subtle"
              size={28}
              radius={6}
              onClick={onBack}
              style={{ color: muted, flexShrink: 0 }}
              styles={{
                root: { '&:hover': { backgroundColor: hover, color: text } },
              }}
            >
              <IconArrowLeft
                size={14}
                stroke={1.8}
              />
            </ActionIcon>
          </Tooltip>
        )}

        {breadcrumbs && breadcrumbs.length > 0 && (
          <Group
            gap={5}
            wrap="nowrap"
            align="center"
            style={{ minWidth: 0 }}
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
                      style={{ color: border, flexShrink: 0 }}
                    />
                  )}
                  {isLast ? (
                    <Text
                      size="sm"
                      fw={500}
                      style={{
                        color: text,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {crumb.label}
                    </Text>
                  ) : (
                    <Group
                      gap={4}
                      wrap="nowrap"
                      align="center"
                      onClick={crumb.onClick}
                      style={{
                        cursor: crumb.onClick ? 'pointer' : 'default',
                        flexShrink: 0,
                      }}
                    >
                      {isFirst && (
                        <IconHome2
                          size={13}
                          stroke={1.6}
                          style={{ color: muted }}
                        />
                      )}
                      <Text
                        size="sm"
                        style={{ color: muted, whiteSpace: 'nowrap' }}
                      >
                        {crumb.label}
                      </Text>
                    </Group>
                  )}
                </React.Fragment>
              )
            })}
          </Group>
        )}
      </Group>

      {/* ── RIGHT: store + notifications + user ───────────────── */}
      <Group
        gap={4}
        wrap="nowrap"
        align="center"
        style={{ flexShrink: 0 }}
      >
        <AreasStoresSelectionIndicator />

        <Box
          style={{
            width: 1,
            height: 18,
            backgroundColor: border,
            marginInline: 6,
          }}
        />

        <PermissionGuard permission={Permission.NOTIFICATIONS_READ}>
          <NotificationMenu />
        </PermissionGuard>

        <Box
          style={{
            width: 1,
            height: 18,
            backgroundColor: border,
            marginInline: 6,
          }}
        />

        <UserMenu />
      </Group>
    </Group>
  )

  return (
    <>
      {/* Restricted mode password modal */}
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
              ? 'Click Lock to hide sensitive data.'
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

