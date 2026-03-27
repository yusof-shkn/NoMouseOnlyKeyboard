// @features/settings/companySettings/CompanySettings.tsx
import React, { useState } from 'react'
import {
  Title,
  Text,
  Group,
  Button,
  Tabs,
  Alert,
  Paper,
  Box,
  Badge,
  useMantineTheme,
  useMantineColorScheme,
} from '@mantine/core'
import {
  IconAlertCircle,
  IconDeviceFloppy,
  IconRefresh,
  IconPackage,
  IconShoppingCart,
  IconTruck,
  IconCreditCard,
  IconCheck,
  IconBuilding,
  IconHistory,
  IconArrowsRightLeft,
  IconCalculator,
  IconShieldCheck,
} from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useSelector, useDispatch } from 'react-redux'
import {
  selectCompanySettings,
  selectCurrentCompany,
  updateCompanySettings as updateCompanySettingsAction,
  updateCompany as updateCompanyAction,
} from '@features/authentication/authSlice'
import { supabase } from '@app/core/supabase/Supabase.utils'
import {
  validateCompanySettings,
  getChangedSettings,
} from './utils/companySettings.utils'
import { CompanySettings as CompanySettingsType } from '@shared/types/companySettings'
import { Company } from '@shared/types/company'
import CompanySettingsSkeleton from '@shared/components/skeletons/CompanySettings.skeleton'
import {
  CompanyProfileTab,
  InventoryTab,
  SalesTab,
  PurchasesTab,
  CreditsTab,
  TransfersTab,
  AccountingTab,
  SettingsChangeHistory,
  SecurityTab,
} from './components'
import { getPrimaryColor, getThemeColors } from '@app/core/theme/theme.utils'

export const CompanySettings: React.FC = () => {
  const dispatch = useDispatch()
  const theme = useMantineTheme()
  const { colorScheme } = useMantineColorScheme()
  const resolvedColorScheme =
    colorScheme === 'dark' || colorScheme === 'auto' ? 'dark' : 'light'
  const themeColors = getThemeColors(theme, resolvedColorScheme)
  const primaryColor = getPrimaryColor(theme)

  const companySettings = useSelector(selectCompanySettings)
  const company = useSelector(selectCurrentCompany)

  const [activeTab, setActiveTab] = useState<string>('profile')
  const [localSettings, setLocalSettings] =
    useState<CompanySettingsType | null>(companySettings)
  const [localCompany, setLocalCompany] = useState<Company | null>(company)
  const [saving, setSaving] = useState(false)
  const [validationErrors, setValidationErrors] = useState<
    { field: string; message: string }[]
  >([])

  React.useEffect(() => {
    if (companySettings) setLocalSettings(companySettings)
  }, [companySettings])

  React.useEffect(() => {
    if (company) setLocalCompany(company)
  }, [company])

  const hasSettingsChanges =
    localSettings && companySettings
      ? JSON.stringify(localSettings) !== JSON.stringify(companySettings)
      : false

  const hasCompanyChanges =
    localCompany && company
      ? JSON.stringify(localCompany) !== JSON.stringify(company)
      : false

  const currentHasChanges =
    activeTab === 'profile' ? hasCompanyChanges : hasSettingsChanges

  const handleSettingsChange = <K extends keyof CompanySettingsType>(
    field: K,
    value: CompanySettingsType[K],
  ) => {
    if (!localSettings) return
    const updated = { ...localSettings, [field]: value }
    setLocalSettings(updated)
    const validation = validateCompanySettings({ [field]: value } as any)
    setValidationErrors(validation.errors)
  }

  const handleCompanyChange = <K extends keyof Company>(
    field: K,
    value: Company[K],
  ) => {
    if (!localCompany) return
    setLocalCompany({ ...localCompany, [field]: value })
  }

  const handleSaveSettings = async () => {
    if (!localSettings || !companySettings) return

    setSaving(true)
    setValidationErrors([])

    try {
      const changes = getChangedSettings(companySettings, localSettings)

      if (Object.keys(changes).length === 0) {
        notifications.show({
          title: 'No Changes',
          message: 'No changes to save',
          color: 'blue',
        })
        return
      }

      const validation = validateCompanySettings(changes)
      if (!validation.isValid) {
        setValidationErrors(validation.errors)
        notifications.show({
          title: 'Validation Error',
          message: 'Please fix the errors before saving',
          color: 'red',
        })
        return
      }

      const { id, company_id, created_at, updated_at, ...updateData } =
        changes as any

      const { data, error } = await supabase
        .from('company_settings')
        .update({
          ...updateData,
          updated_at: new Date().toISOString(),
        })
        .eq('company_id', companySettings.company_id)
        .select()
        .single()

      if (error) throw error

      dispatch(updateCompanySettingsAction(data))

      notifications.show({
        title: 'Success',
        message: 'Settings saved successfully',
        color: 'green',
        icon: <IconCheck />,
      })
    } catch (err) {
      console.error('Failed to save settings:', err)
      notifications.show({
        title: 'Error',
        message: err instanceof Error ? err.message : 'Failed to save settings',
        color: 'red',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleSaveCompany = async () => {
    if (!localCompany || !company) return

    setSaving(true)

    try {
      const { created_at, updated_at, deleted_at, ...updateData } = localCompany

      const { data, error } = await supabase
        .from('companies')
        .update({
          ...updateData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', company.id)
        .select()
        .single()

      if (error) throw error

      dispatch(updateCompanyAction(data))

      notifications.show({
        title: 'Success',
        message: 'Company profile updated successfully',
        color: 'green',
        icon: <IconCheck />,
      })
    } catch (err) {
      console.error('Failed to save company:', err)
      notifications.show({
        title: 'Error',
        message:
          err instanceof Error
            ? err.message
            : 'Failed to update company profile',
        color: 'red',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleDiscard = () => {
    if (activeTab === 'profile') {
      setLocalCompany(company)
    } else {
      setLocalSettings(companySettings)
    }
    setValidationErrors([])
  }

  if (!companySettings || !company || !localSettings || !localCompany) {
    return <CompanySettingsSkeleton />
  }

  const tabsWithoutSave = ['history', 'security']

  return (
    <Box
      h="92.7vh"
      style={{
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor:
          resolvedColorScheme === 'dark'
            ? theme.colors.dark[7]
            : theme.colors.gray[0],
      }}
    >
      <Box
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          width: '100%',
          maxWidth: '100%',
          padding: '1rem 2rem',
        }}
      >
        {/* HEADER */}
        <Paper
          p="lg"
          shadow="xs"
          radius="md"
          mb="md"
          style={{
            backgroundColor:
              resolvedColorScheme === 'dark'
                ? theme.colors.dark[6]
                : theme.white,
            borderColor: themeColors.border,
          }}
        >
          <Group
            justify="space-between"
            align="center"
          >
            <div>
              <Group
                gap="xs"
                mb="xs"
              >
                <Title
                  order={2}
                  style={{ color: themeColors.text }}
                >
                  Company Settings
                </Title>
                {company.is_active && (
                  <Badge
                    color="green"
                    variant="light"
                  >
                    Active
                  </Badge>
                )}
              </Group>
              <Text
                size="sm"
                c="dimmed"
              >
                Manage your company profile and system preferences
              </Text>
            </div>

            <Group>
              {!tabsWithoutSave.includes(activeTab) && currentHasChanges && (
                <Button
                  variant="subtle"
                  onClick={handleDiscard}
                >
                  Discard
                </Button>
              )}
              {!tabsWithoutSave.includes(activeTab) && (
                <Button
                  leftSection={
                    saving ? (
                      <IconRefresh size={16} />
                    ) : (
                      <IconDeviceFloppy size={16} />
                    )
                  }
                  loading={saving}
                  disabled={!currentHasChanges}
                  onClick={
                    activeTab === 'profile'
                      ? handleSaveCompany
                      : handleSaveSettings
                  }
                  style={{
                    backgroundColor: !currentHasChanges
                      ? undefined
                      : primaryColor,
                  }}
                >
                  Save Changes
                </Button>
              )}
            </Group>
          </Group>
        </Paper>

        {/* ALERTS */}
        {currentHasChanges && (
          <Alert
            icon={<IconAlertCircle />}
            color="yellow"
            mb="md"
          >
            You have unsaved changes
          </Alert>
        )}

        {validationErrors.length > 0 && (
          <Alert
            icon={<IconAlertCircle />}
            color="red"
            mb="md"
          >
            <div>
              <strong>Validation Errors:</strong>
              <ul style={{ margin: '0.5rem 0 0 0', paddingLeft: '1.5rem' }}>
                {validationErrors.map((err, idx) => (
                  <li key={idx}>{err.message}</li>
                ))}
              </ul>
            </div>
          </Alert>
        )}

        {/* TABS */}
        <Paper
          shadow="xs"
          radius="md"
          style={{
            flex: 1,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor:
              resolvedColorScheme === 'dark'
                ? theme.colors.dark[6]
                : theme.white,
          }}
        >
          <Tabs
            value={activeTab}
            onChange={(v) => setActiveTab(v || 'profile')}
            style={{ display: 'flex', flexDirection: 'column', height: '100%' }}
            color={primaryColor}
          >
            <Tabs.List
              px="md"
              pt="md"
            >
              <Tabs.Tab
                value="profile"
                leftSection={<IconBuilding size={16} />}
              >
                Company Profile
              </Tabs.Tab>
              <Tabs.Tab
                value="inventory"
                leftSection={<IconPackage size={16} />}
              >
                Inventory
              </Tabs.Tab>
              <Tabs.Tab
                value="sales"
                leftSection={<IconShoppingCart size={16} />}
              >
                Sales
              </Tabs.Tab>
              <Tabs.Tab
                value="purchases"
                leftSection={<IconTruck size={16} />}
              >
                Purchases
              </Tabs.Tab>
              <Tabs.Tab
                value="credits"
                leftSection={<IconCreditCard size={16} />}
              >
                Credits & Payments
              </Tabs.Tab>
              <Tabs.Tab
                value="transfers"
                leftSection={<IconArrowsRightLeft size={16} />}
              >
                Store Transfers
              </Tabs.Tab>
              <Tabs.Tab
                value="accounting"
                leftSection={<IconCalculator size={16} />}
              >
                Accounting & Finance
              </Tabs.Tab>
              <Tabs.Tab
                value="history"
                leftSection={<IconHistory size={16} />}
              >
                History
              </Tabs.Tab>
              <Tabs.Tab
                value="security"
                leftSection={<IconShieldCheck size={16} />}
              >
                Security
              </Tabs.Tab>
            </Tabs.List>

            <Box
              style={{ flex: 1, overflow: 'auto' }}
              p="xl"
            >
              <Tabs.Panel value="profile">
                <CompanyProfileTab
                  company={localCompany}
                  onChange={handleCompanyChange}
                />
              </Tabs.Panel>

              <Tabs.Panel value="inventory">
                <InventoryTab
                  settings={localSettings}
                  onChange={handleSettingsChange}
                  validationErrors={validationErrors}
                />
              </Tabs.Panel>

              <Tabs.Panel value="sales">
                <SalesTab
                  settings={localSettings}
                  onChange={handleSettingsChange}
                  validationErrors={validationErrors}
                />
              </Tabs.Panel>

              <Tabs.Panel value="purchases">
                <PurchasesTab
                  settings={localSettings}
                  onChange={handleSettingsChange}
                  validationErrors={validationErrors}
                />
              </Tabs.Panel>

              <Tabs.Panel value="credits">
                <CreditsTab
                  settings={localSettings}
                  onChange={handleSettingsChange}
                  validationErrors={validationErrors}
                />
              </Tabs.Panel>

              <Tabs.Panel value="transfers">
                <TransfersTab
                  settings={localSettings}
                  onChange={handleSettingsChange}
                  validationErrors={validationErrors}
                />
              </Tabs.Panel>

              <Tabs.Panel value="accounting">
                <AccountingTab
                  settings={localSettings}
                  onChange={handleSettingsChange}
                  validationErrors={validationErrors}
                />
              </Tabs.Panel>

              <Tabs.Panel value="history">
                <SettingsChangeHistory />
              </Tabs.Panel>

              <Tabs.Panel value="security">
                <SecurityTab />
              </Tabs.Panel>
            </Box>
          </Tabs>
        </Paper>
      </Box>
    </Box>
  )
}

export default CompanySettings

