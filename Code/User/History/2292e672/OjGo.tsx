// @features/settings/companySettings/components/SettingsChangeHistory.tsx
// Component to display settings change history with filtering

import React, { useEffect, useState } from 'react'
import {
  Paper,
  Title,
  Text,
  Group,
  Stack,
  Badge,
  Timeline,
  Select,
  LoadingOverlay,
  Alert,
  Box,
  Tooltip,
  useMantineTheme,
  useMantineColorScheme,
} from '@mantine/core'
import {
  IconClock,
  IconUser,
  IconInfoCircle,
  IconBuilding,
  IconSettings,
  IconCreditCard,
  IconAlertCircle,
} from '@tabler/icons-react'
import { supabase } from '@app/core/supabase/Supabase.utils'
import { getCurrentUserProfile } from '@shared/utils/authUtils'
import { getThemeColors } from '@app/core/theme/theme.utils'

interface SettingsChange {
  id: number
  change_type: string
  field_name: string
  field_label: string
  old_value: string
  new_value: string
  old_value_display: string
  new_value_display: string
  changed_by_name: string
  created_at: string
  category: string
}

const SettingsChangeHistory: React.FC = () => {
  const theme = useMantineTheme()
  const { colorScheme } = useMantineColorScheme()
  const resolvedColorScheme =
    colorScheme === 'dark' || colorScheme === 'auto' ? 'dark' : 'light'
  const themeColors = getThemeColors(theme, resolvedColorScheme)

  const [changes, setChanges] = useState<SettingsChange[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterType, setFilterType] = useState<string | null>(null)
  const [companyId, setCompanyId] = useState<number | null>(null)

  useEffect(() => {
    loadChangeHistory()
  }, [filterType])

  const loadChangeHistory = async () => {
    try {
      setLoading(true)
      setError(null)

      // Get current user's company
      const user = await getCurrentUserProfile()
      if (!user?.company_id) {
        throw new Error('No company found')
      }

      setCompanyId(user.company_id)

      // Call the DETAILED database function (better for timeline display)
      const { data, error: fetchError } = await supabase.rpc(
        'get_settings_change_history_detailed',
        {
          p_company_id: user.company_id,
          p_limit: 100,
        },
      )

      if (fetchError) {
        console.error('Database error:', fetchError)
        throw fetchError
      }

      console.log('Loaded change history:', data?.length, 'items')

      // Filter by type if selected
      let filteredData = data || []
      if (filterType) {
        filteredData = filteredData.filter(
          (change: SettingsChange) => change.change_type === filterType,
        )
      }

      setChanges(filteredData)
    } catch (err) {
      console.error('Error loading change history:', err)
      setError(
        err instanceof Error ? err.message : 'Failed to load change history',
      )
    } finally {
      setLoading(false)
    }
  }

  const getChangeTypeIcon = (type: string) => {
    switch (type) {
      case 'company_profile':
        return <IconBuilding size={16} />
      case 'company_settings':
        return <IconSettings size={16} />
      case 'credit_settings':
      default:
        return <IconInfoCircle size={16} />
    }
  }

  const getChangeTypeColor = (type: string): string => {
    switch (type) {
      case 'company_profile':
        return 'blue'
      case 'company_settings':
        return 'green'
      case 'credit_settings':
        return 'orange'
      default:
        return 'gray'
    }
  }

  const getChangeTypeLabel = (type: string): string => {
    switch (type) {
      case 'company_profile':
        return 'Profile'
      case 'company_settings':
        return 'Settings'
      case 'credit_settings':
        return 'Credit'
      default:
        return type
    }
  }

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    })
  }

  const formatValue = (value: string): string => {
    if (!value || value === 'null' || value === 'undefined') return 'None'
    if (value === 'true') return 'Yes'
    if (value === 'false') return 'No'
    return value
  }

  return (
    <Paper
      p="lg"
      withBorder
      radius="md"
      style={{
        maxHeight: '600px',
        overflow: 'auto',
        backgroundColor:
          resolvedColorScheme === 'dark' ? theme.colors.dark[6] : theme.white,
        borderColor: themeColors.border,
      }}
    >
      <Group
        justify="space-between"
        mb="lg"
      >
        <div>
          <Title
            order={4}
            mb={4}
            style={{ color: themeColors.text }}
          >
            Recent Changes
          </Title>
          <Text
            size="sm"
            c="dimmed"
          >
            Track all modifications to company settings
          </Text>
        </div>

        <Select
          placeholder="Filter by type"
          clearable
          data={[
            { value: 'company_profile', label: 'Company Profile' },
            { value: 'company_settings', label: 'System Settings' },
            { value: 'credit_settings', label: 'Credit Settings' },
          ]}
          value={filterType}
          onChange={setFilterType}
          style={{ width: 200 }}
          size="sm"
        />
      </Group>

      <LoadingOverlay visible={loading} />

      {error && (
        <Alert
          icon={<IconAlertCircle />}
          color="red"
          mb="md"
        >
          {error}
        </Alert>
      )}

      {!loading && changes.length === 0 && (
        <Alert
          icon={<IconInfoCircle />}
          color="blue"
          variant="light"
        >
          No changes recorded yet. Changes will appear here when settings are
          modified.
        </Alert>
      )}

      {!loading && changes.length > 0 && (
        <Timeline
          active={changes.length}
          bulletSize={24}
          lineWidth={2}
        >
          {changes.map((change, index) => (
            <Timeline.Item
              key={`${change.id}-${index}`}
              bullet={getChangeTypeIcon(change.change_type)}
              title={
                <Group gap="xs">
                  <Text
                    fw={500}
                    size="sm"
                    style={{ color: themeColors.text }}
                  >
                    {change.field_label}
                  </Text>
                  <Badge
                    size="xs"
                    color={getChangeTypeColor(change.change_type)}
                    variant="light"
                  >
                    {getChangeTypeLabel(change.change_type)}
                  </Badge>
                </Group>
              }
            >
              <Stack
                gap="xs"
                mt="xs"
              >
                <Box>
                  <Group gap="xs">
                    <Text
                      size="xs"
                      c="dimmed"
                    >
                      From:
                    </Text>
                    <Text
                      size="xs"
                      style={{ textDecoration: 'line-through' }}
                      c="dimmed"
                    >
                      {formatValue(change.old_value_display)}
                    </Text>
                  </Group>
                  <Group gap="xs">
                    <Text
                      size="xs"
                      c="dimmed"
                    >
                      To:
                    </Text>
                    <Text
                      size="xs"
                      fw={500}
                      c="green"
                    >
                      {formatValue(change.new_value_display)}
                    </Text>
                  </Group>
                </Box>

                <Group
                  gap="md"
                  mt="xs"
                >
                  <Tooltip label="Changed by">
                    <Group
                      gap={4}
                      style={{ cursor: 'help' }}
                    >
                      <IconUser
                        size={14}
                        style={{ opacity: 0.6 }}
                      />
                      <Text
                        size="xs"
                        c="dimmed"
                      >
                        {change.changed_by_name || 'System'}
                      </Text>
                    </Group>
                  </Tooltip>

                  <Tooltip label={new Date(change.created_at).toLocaleString()}>
                    <Group
                      gap={4}
                      style={{ cursor: 'help' }}
                    >
                      <IconClock
                        size={14}
                        style={{ opacity: 0.6 }}
                      />
                      <Text
                        size="xs"
                        c="dimmed"
                      >
                        {formatDate(change.created_at)}
                      </Text>
                    </Group>
                  </Tooltip>
                </Group>
              </Stack>
            </Timeline.Item>
          ))}
        </Timeline>
      )}
    </Paper>
  )
}

export default SettingsChangeHistory

