// @features/settings/companySettings/components/tabs/CreditsTab.tsx
import React from 'react'
import {
  Stack,
  Title,
  Text,
  Switch,
  NumberInput,
  JsonInput,
  useMantineTheme,
  useMantineColorScheme,
} from '@mantine/core'
import { CompanySettings } from '@shared/types/companySettings'
import SettingCard from './SettingCard'
import { getThemeColors } from '@app/core/theme/theme.utils'

interface CreditsTabProps {
  settings: CompanySettings
  onChange: <K extends keyof CompanySettings>(
    field: K,
    value: CompanySettings[K],
  ) => void
  validationErrors: { field: string; message: string }[]
}

const CreditsTab: React.FC<CreditsTabProps> = ({
  settings,
  onChange,
  validationErrors,
}) => {
  const theme = useMantineTheme()
  const { colorScheme } = useMantineColorScheme()
  const resolvedColorScheme =
    colorScheme === 'dark' || colorScheme === 'auto' ? 'dark' : 'light'
  const themeColors = getThemeColors(theme, resolvedColorScheme)

  const getError = (field: string) =>
    validationErrors.find((e) => e.field === field)?.message

  return (
    <Stack gap="lg">
      <div>
        <Title
          order={3}
          mb="xs"
          style={{ color: themeColors.text }}
        >
          Credit & Payment Management Settings
        </Title>
        <Text
          size="sm"
          c="dimmed"
        >
          Configure credit terms and payment notifications
        </Text>
      </div>

      <SettingCard
        title="Credit Terms"
        description="Configure default credit payment terms"
      >
        <NumberInput
          label="Default Credit Days"
          description="Default number of days for payment terms"
          value={settings.default_credit_days}
          onChange={(value) => onChange('default_credit_days', Number(value))}
          min={1}
          max={365}
          suffix=" days"
          error={getError('default_credit_days')}
          size="sm"
        />
      </SettingCard>

      <SettingCard
        title="Advanced Credit Settings"
        description="Advanced credit configuration stored as JSON"
      >
        <JsonInput
          label="Credit Settings (JSON)"
          description="Advanced credit settings in JSON format"
          value={JSON.stringify(settings.credit_settings || {}, null, 2)}
          onChange={(value) => {
            try {
              const parsed = JSON.parse(value)
              onChange('credit_settings', parsed)
            } catch (e) {
              // Invalid JSON, don't update
            }
          }}
          placeholder='{ "grace_period_days": 7, "late_fee": 0 }'
          formatOnBlur
          autosize
          minRows={4}
          maxRows={10}
        />
      </SettingCard>

      <SettingCard
        title="Payment Notifications"
        description="Configure payment reminder notifications"
      >
        <Switch
          label="Enable Payment Notifications"
          description="Send payment reminders and notifications to customers"
          checked={settings.enable_payment_notifications}
          onChange={(e) =>
            onChange('enable_payment_notifications', e.currentTarget.checked)
          }
        />
      </SettingCard>
    </Stack>
  )
}

export default CreditsTab

