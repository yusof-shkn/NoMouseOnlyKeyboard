// @features/settings/companySettings/components/SecurityTab.tsx
import React, { useState } from 'react'
import {
  Stack,
  Text,
  PasswordInput,
  Button,
  Group,
  Alert,
  Paper,
  Title,
  Divider,
  Badge,
  ThemeIcon,
  Box,
} from '@mantine/core'
import {
  IconLock,
  IconShieldCheck,
  IconAlertCircle,
  IconCheck,
  IconEye,
  IconEyeOff,
} from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useSelector, useDispatch } from 'react-redux'
import { RootState, AppDispatch } from '@app/core/store/store'
import {
  setRestrictedModePassword,
  selectRestrictedModeLoading,
  selectRestrictedModeError,
  clearRestrictedModeError,
} from '@features/restrictedMode/restrictedMode.slice'

export const SecurityTab: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>()

  const companyId = useSelector(
    (state: RootState) => state.auth.company?.id as number | undefined,
  )
  const hasPassword = useSelector(
    (state: RootState) =>
      !!(state.auth.companySettings as any)?.restricted_mode_password,
  )
  const isLoading = useSelector(selectRestrictedModeLoading)
  const reduxError = useSelector(selectRestrictedModeError)

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const handleSave = async () => {
    setLocalError(null)
    dispatch(clearRestrictedModeError())
    setSaved(false)

    if (!newPassword.trim()) {
      setLocalError('Password cannot be empty.')
      return
    }
    if (newPassword.length < 4) {
      setLocalError('Password must be at least 4 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setLocalError('Passwords do not match.')
      return
    }
    if (!companyId) {
      setLocalError('Company not found.')
      return
    }

    const result = await dispatch(
      setRestrictedModePassword({ password: newPassword, companyId }),
    )

    if (setRestrictedModePassword.fulfilled.match(result)) {
      setSaved(true)
      setNewPassword('')
      setConfirmPassword('')
      notifications.show({
        title: '✅ Password Saved',
        message: 'Restricted mode password has been updated.',
        color: 'green',
        autoClose: 3000,
      })
    }
  }

  const error = localError || reduxError

  return (
    <Stack gap="xl">
      {/* Header */}
      <Group gap="sm">
        <ThemeIcon
          size={40}
          radius="md"
          variant="light"
          color="orange"
        >
          <IconShieldCheck size={22} />
        </ThemeIcon>
        <Box>
          <Title order={4}>Restricted Mode</Title>
          <Text
            size="sm"
            c="dimmed"
          >
            Control which data is visible to staff without admin access
          </Text>
        </Box>
      </Group>

      <Divider />

      {/* How it works */}
      <Alert
        icon={<IconLock size={16} />}
        title="How restricted mode works"
        color="blue"
        variant="light"
      >
        <Stack gap={4}>
          <Text size="sm">
            • Records marked as <strong>Restricted</strong> are hidden by
            default from all users
          </Text>
          <Text size="sm">
            • Admins can temporarily unlock using the password (double-click the
            logo in the navbar)
          </Text>
          <Text size="sm">
            • When unlocked, all data is visible until locked again or the
            session ends
          </Text>
          <Text size="sm">
            • Use this to hide sensitive cost, profit, and financial data from
            floor staff
          </Text>
        </Stack>
      </Alert>

      {/* Password status */}
      <Paper
        withBorder
        p="md"
        radius="md"
      >
        <Group
          justify="space-between"
          mb="md"
        >
          <Text
            fw={500}
            size="sm"
          >
            Restricted Mode Password
          </Text>
          <Badge
            color={hasPassword ? 'green' : 'gray'}
            variant="light"
          >
            {hasPassword ? 'Password set' : 'Not configured'}
          </Badge>
        </Group>

        <Stack gap="sm">
          <PasswordInput
            label="New Password"
            placeholder="Enter a new restricted mode password"
            value={newPassword}
            onChange={(e) => {
              setNewPassword(e.currentTarget.value)
              setLocalError(null)
              dispatch(clearRestrictedModeError())
              setSaved(false)
            }}
            leftSection={<IconLock size={16} />}
          />

          <PasswordInput
            label="Confirm Password"
            placeholder="Re-enter the password"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.currentTarget.value)
              setLocalError(null)
              setSaved(false)
            }}
            leftSection={<IconLock size={16} />}
            error={
              confirmPassword && confirmPassword !== newPassword
                ? 'Passwords do not match'
                : undefined
            }
          />

          {error && (
            <Alert
              icon={<IconAlertCircle size={16} />}
              color="red"
              variant="light"
            >
              {error}
            </Alert>
          )}

          {saved && (
            <Alert
              icon={<IconCheck size={16} />}
              color="green"
              variant="light"
            >
              Password saved successfully.
            </Alert>
          )}

          <Group justify="flex-end">
            <Button
              leftSection={<IconShieldCheck size={16} />}
              loading={isLoading}
              onClick={handleSave}
              disabled={!newPassword || !confirmPassword}
            >
              {hasPassword ? 'Update Password' : 'Set Password'}
            </Button>
          </Group>
        </Stack>
      </Paper>
    </Stack>
  )
}

