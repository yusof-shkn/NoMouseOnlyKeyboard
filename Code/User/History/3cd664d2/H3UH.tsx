import { useState, useCallback } from 'react'
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
  Divider,
  Breadcrumbs,
  Anchor,
  Tooltip,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { IconArrowLeft, IconChevronRight } from '@tabler/icons-react'
import { SearchBar } from './SearchBar'
import { NotificationMenu } from './NotificationMenu'
import { SettingsMenu } from './SettingsMenu'
import { UserMenu } from './UserMenu'
import { AreasStoresSelectionIndicator } from './AreasStoresSelectionIndicator'
import { useSelector, useDispatch } from 'react-redux'
import { RootState, AppDispatch } from '@app/core/store/store'
import { Company } from '@shared/types/company'
import { Permission } from '@shared/constants/permissions'
import { PermissionGuard } from '@shared/components/Permissionguards'
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
  /** Page title shown in the navbar center area (used on full-screen pages like POS/POP) */
  pageTitle?: string
  /** Breadcrumb trail shown next to the back button */
  breadcrumbs?: NavbarBreadcrumb[]
  /** If provided, a back button is rendered in the navbar */
  onBack?: () => void
  /** Tooltip label for the back button */
  backLabel?: string
}

const Navbar = ({
  showSearch,
  pageTitle,
  breadcrumbs,
  onBack,
  backLabel = 'Go back',
}: NavbarProps) => {
  const theme = useMantineTheme()
  const { colorScheme } = useMantineColorScheme()
  const dispatch = useDispatch<AppDispatch>()

  const company = useSelector(
    (state: RootState) => state.auth.company as Company | null,
  )
  const companyId = useSelector(
    (state: RootState) => state.auth.company?.id as number | undefined,
  )

  // ── Restricted mode state from Redux ──
  const isUnlocked = useSelector(selectIsUnlocked)
  const isLoading = useSelector(selectRestrictedModeLoading)
  const reduxError = useSelector(selectRestrictedModeError)

  const [password, setPassword] = useState('')
  const [modalOpened, { open: openModal, close: closeModal }] =
    useDisclosure(false)

  const logoPublicUrl = company?.logo_url
  const displayName = company?.company_name
    ? company.company_name.length > 20
      ? company.company_name.slice(0, 20) + '...'
      : company.company_name
    : 'Dashboard'

  const handleDoubleClick = useCallback(() => {
    setPassword('')
    dispatch(clearRestrictedModeError())
    openModal()
  }, [openModal, dispatch])

  const handlePasswordSubmit = useCallback(async () => {
    // If already unlocked — lock immediately, no password needed
    if (isUnlocked) {
      dispatch(lockRestrictedMode())
      notifications.show({
        title: '🔒 Restricted Mode On',
        message: 'Sensitive data is now hidden.',
        color: 'red',
        autoClose: 2000,
      })
      closeModal()
      return
    }

    // Unlock — verify password via Redux thunk
    if (!password.trim()) return
    if (!companyId) return

    const result = await dispatch(unlockRestrictedMode({ password, companyId }))

    if (unlockRestrictedMode.fulfilled.match(result)) {
      notifications.show({
        title: '🔓 Restricted Mode Off',
        message: 'All data is now visible.',
        color: 'green',
        autoClose: 2000,
      })
      closeModal()
      setPassword('')
    }
    // Error is shown inline via reduxError
  }, [password, isUnlocked, companyId, dispatch, closeModal])

  const handleModalClose = useCallback(() => {
    setPassword('')
    dispatch(clearRestrictedModeError())
    closeModal()
  }, [closeModal, dispatch])

  return (
    <>
      {/* Password Modal */}
      <Modal
        opened={modalOpened}
        onClose={handleModalClose}
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
              : 'Enter the restricted mode password to view all data.'}
          </Text>

          {!isUnlocked && (
            <PasswordInput
              label="Password"
              placeholder="Enter restricted mode password"
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
              onClick={handleModalClose}
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

      {/* Navbar */}
      <AppShell.Header
        style={{
          borderBottom: `1.5px solid ${colorScheme === 'dark' ? theme.colors.dark[4] : theme.colors.gray[3]}`,
          backgroundColor:
            colorScheme === 'dark' ? theme.colors.dark[7] : theme.white,
          boxShadow:
            colorScheme === 'dark'
              ? '0 2px 4px rgba(0, 0, 0, 0.5)'
              : '0 2px 4px rgba(0, 0, 0, 0.08)',
        }}
      >
        <Group
          h="100%"
          px="md"
          justify="start"
          wrap="nowrap"
        >
          {/* Logo Section */}
          <Group
            w={244}
            h="100%"
            wrap="nowrap"
            style={{
              borderRight: `1.5px solid ${colorScheme === 'dark' ? theme.colors.dark[4] : theme.colors.gray[3]}`,
              flexShrink: 0,
            }}
          >
            {/* Avatar with lock status indicator */}
            <Box
              onDoubleClick={handleDoubleClick}
              style={{ cursor: 'pointer', position: 'relative' }}
              title={
                isUnlocked ? 'Double-click to lock' : 'Double-click to unlock'
              }
            >
              <Indicator
                color={isUnlocked ? 'green' : 'red'}
                size={10}
                position="bottom-end"
                processing={isUnlocked}
                offset={4}
              >
                <Avatar
                  src={logoPublicUrl}
                  size={40}
                  radius="md"
                  style={{
                    border: `2px solid ${
                      isUnlocked
                        ? theme.colors.green[5]
                        : colorScheme === 'dark'
                          ? theme.colors.dark[4]
                          : theme.colors.gray[3]
                    }`,
                    transition: 'border-color 0.3s ease, transform 0.2s ease',
                  }}
                  styles={{
                    root: {
                      '&:hover': {
                        transform: 'scale(1.05)',
                      },
                    },
                  }}
                />
              </Indicator>
            </Box>

            <Text
              size="lg"
              fw={700}
              visibleFrom="sm"
              style={{
                backgroundImage:
                  colorScheme === 'dark'
                    ? `linear-gradient(135deg, ${theme.colors[theme.primaryColor][4]} 0%, ${theme.colors[theme.primaryColor][6]} 100%)`
                    : `linear-gradient(135deg, ${theme.colors[theme.primaryColor][7]} 0%, ${theme.colors[theme.primaryColor][5]} 100%)`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                maxWidth: 160,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={company?.company_name || 'Dashboard'}
            >
              {displayName}
            </Text>
          </Group>

          {/* ── Back button + Breadcrumbs / Page Title (full-screen pages) ── */}
          {(onBack || pageTitle || breadcrumbs) && (
            <Group
              gap="xs"
              wrap="nowrap"
              align="center"
              style={{ flexShrink: 0 }}
            >
              {onBack && (
                <>
                  <Tooltip
                    label={backLabel}
                    withArrow
                    position="bottom"
                  >
                    <ActionIcon
                      variant="subtle"
                      color={colorScheme === 'dark' ? 'gray' : 'dark'}
                      size="md"
                      radius="md"
                      onClick={onBack}
                      style={{
                        transition: 'background 0.15s ease',
                      }}
                    >
                      <IconArrowLeft size={17} />
                    </ActionIcon>
                  </Tooltip>

                  <Divider
                    orientation="vertical"
                    style={{ height: 20, alignSelf: 'center' }}
                  />
                </>
              )}

              {breadcrumbs && breadcrumbs.length > 0 ? (
                <Breadcrumbs
                  separator={
                    <IconChevronRight
                      size={13}
                      style={{
                        color:
                          colorScheme === 'dark'
                            ? theme.colors.dark[3]
                            : theme.colors.gray[5],
                      }}
                    />
                  }
                  separatorMargin={4}
                >
                  {breadcrumbs.map((crumb, idx) => {
                    const isLast = idx === breadcrumbs.length - 1
                    return isLast ? (
                      <Text
                        key={idx}
                        size="sm"
                        fw={600}
                        style={{
                          color:
                            colorScheme === 'dark'
                              ? theme.colors[theme.primaryColor][4]
                              : theme.colors[theme.primaryColor][7],
                        }}
                      >
                        {crumb.label}
                      </Text>
                    ) : (
                      <Anchor
                        key={idx}
                        size="sm"
                        c="dimmed"
                        fw={400}
                        underline="hover"
                        onClick={crumb.onClick}
                        href={crumb.href}
                        style={{
                          cursor:
                            crumb.onClick || crumb.href ? 'pointer' : 'default',
                        }}
                      >
                        {crumb.label}
                      </Anchor>
                    )
                  })}
                </Breadcrumbs>
              ) : pageTitle ? (
                <Text
                  size="sm"
                  fw={600}
                  style={{
                    color:
                      colorScheme === 'dark'
                        ? theme.colors[theme.primaryColor][4]
                        : theme.colors[theme.primaryColor][7],
                  }}
                >
                  {pageTitle}
                </Text>
              ) : null}
            </Group>
          )}

          {/* Search Bar */}
          {showSearch && <SearchBar />}

          {/* Right Section */}
          <Group
            gap="xs"
            ml="auto"
            wrap="nowrap"
          >
            <AreasStoresSelectionIndicator />

            <PermissionGuard permission={Permission.NOTIFICATIONS_READ}>
              <NotificationMenu />
            </PermissionGuard>

            <SettingsMenu />
            <UserMenu />
          </Group>
        </Group>
      </AppShell.Header>
    </>
  )
}

export default Navbar

