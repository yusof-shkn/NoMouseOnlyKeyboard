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
import { useSelector } from 'react-redux'
import { RootState } from '@app/core/store/store'
import { Company } from '@shared/types/company'
import { Permission } from '@shared/constants/permissions'
import { PermissionGuard } from '@shared/components/Permissionguards'
import { supabase } from '@app/core/supabase/client' // adjust to your supabase client path

const Navbar = ({ showSearch }: { showSearch?: boolean }) => {
  const theme = useMantineTheme()
  const { colorScheme } = useMantineColorScheme()

  const [company, userEmail] = useSelector((state: RootState) => [
    state.auth.company as Company | null,
    state.auth.user?.email as string | undefined,
  ])

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
          ? 'Admin mode has been locked.'
          : 'Admin mode is now active.',
        color: isUnlocked ? 'red' : 'green',
        autoClose: 3000,
      })

      closeModal()
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

