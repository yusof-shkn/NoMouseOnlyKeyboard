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
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
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
} from '@features/restrictedMode/restrictedMode.slice'

const Navbar = ({ showSearch }: { showSearch?: boolean }) => {
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
    if (!password.trim()) return

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
        >
          {/* Logo Section */}
          <Group
            w={244}
            h="100%"
            style={{
              borderRight: `1.5px solid ${colorScheme === 'dark' ? theme.colors.dark[4] : theme.colors.gray[3]}`,
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
              style={{
                backgroundImage:
                  colorScheme === 'dark'
                    ? `linear-gradient(135deg, ${theme.colors[theme.primaryColor][4]} 0%, ${theme.colors[theme.primaryColor][6]} 100%)`
                    : `linear-gradient(135deg, ${theme.colors[theme.primaryColor][7]} 0%, ${theme.colors[theme.primaryColor][5]} 100%)`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              {displayName}
            </Text>
          </Group>

          {/* Search Bar */}
          {showSearch && <SearchBar />}

          {/* Right Section */}
          <Group
            gap="xs"
            ml="auto"
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

const Navbar = ({ showSearch }: { showSearch?: boolean }) => {
  const theme = useMantineTheme()
  const { colorScheme } = useMantineColorScheme()

  const company = useSelector(
    (state: RootState) => state.auth.company as Company | null,
  )
  const userEmail = useSelector(
    (state: RootState) => state.auth.user?.email as string | undefined,
  )

  const [isUnlocked, setIsUnlocked] = useState(false)
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
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
    setError(null)
    openModal()
  }, [openModal])

  const handlePasswordSubmit = useCallback(async () => {
    if (!password.trim()) {
      setError('Please enter your password')
      return
    }

    if (!userEmail) {
      setError('Could not determine current user email')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // Validate password against Supabase by re-signing in
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password,
      })

      if (authError) {
        setError('Incorrect password. Please try again.')
        return
      }

      // Toggle unlock state
      setIsUnlocked((prev) => !prev)

      notifications.show({
        title: isUnlocked ? 'Locked' : 'Unlocked',
        message: isUnlocked
          ? 'Admin mode has been locked. Reloading...'
          : 'Admin mode is now active. Reloading...',
        color: isUnlocked ? 'red' : 'green',
        autoClose: 1500,
      })

      closeModal()

      // Reload page after short delay so notification is visible
      setTimeout(() => {
        window.location.reload()
      }, 1500)
    } catch (err) {
      setError('Something went wrong. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }, [password, userEmail, isUnlocked, closeModal])

  const handleModalClose = useCallback(() => {
    setPassword('')
    setError(null)
    closeModal()
  }, [closeModal])

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
            {isUnlocked ? '🔒 Lock Admin Mode' : '🔓 Unlock Admin Mode'}
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
              ? 'Enter your password to lock and deactivate admin mode.'
              : 'Enter your password to unlock admin mode.'}
          </Text>

          <PasswordInput
            label="Password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => {
              setPassword(e.currentTarget.value)
              setError(null)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handlePasswordSubmit()
            }}
            error={error}
            autoFocus
          />

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
        >
          {/* Logo Section */}
          <Group
            w={244}
            h="100%"
            style={{
              borderRight: `1.5px solid ${colorScheme === 'dark' ? theme.colors.dark[4] : theme.colors.gray[3]}`,
            }}
          >
            {/* Avatar with status dot */}
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
                processing={isUnlocked} // animated pulse when unlocked
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
              style={{
                backgroundImage:
                  colorScheme === 'dark'
                    ? `linear-gradient(135deg, ${theme.colors[theme.primaryColor][4]} 0%, ${theme.colors[theme.primaryColor][6]} 100%)`
                    : `linear-gradient(135deg, ${theme.colors[theme.primaryColor][7]} 0%, ${theme.colors[theme.primaryColor][5]} 100%)`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              {displayName}
            </Text>
          </Group>

          {/* Search Bar */}
          {showSearch && <SearchBar />}

          {/* Right Section */}
          <Group
            gap="xs"
            ml="auto"
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

