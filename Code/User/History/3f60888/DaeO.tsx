// src/features/main/AreaForm/AreaForm.tsx - Fixed with useMantineColorScheme
import React, { useEffect, useState, useMemo } from 'react'
import { useDispatch } from 'react-redux'
import {
  Button,
  Textarea,
  Switch,
  MultiSelect,
  TextInput,
  Stack,
  Group,
  Text,
  Paper,
  Box,
  Alert,
  Select,
  ActionIcon,
  Tooltip,
  useMantineTheme,
  useMantineColorScheme,
  rem,
} from '@mantine/core'
import { useForm } from '@mantine/form'
import {
  IconMapPin,
  IconCode,
  IconUserShield,
  IconBuildingStore,
  IconInfoCircle,
  IconAlertCircle,
  IconWorld,
  IconMap2,
  IconRefresh,
  IconCheck,
} from '@tabler/icons-react'
import { AreaFormProps } from '../types/areasForm.types'
import { handleSubmit } from '../handlers/areasForm.handlers'
import { Profile } from '@shared/types/profile'
import { getCurrentUserProfile } from '@shared/utils/authUtils'
import { prepareGroupedOptions } from '@shared/utils/formUtils'
import { fetchStaffUsers } from '@shared/utils/staffUtils'
import { fetchStores } from '@shared/utils/storeUtils'
import { Store } from '@shared/types/Store'
import { Role, StaffRoles } from '@shared/constants/roles'
import { ModalFormSkeleton } from '@shared/components/skeletons/ModalForm.skeleton'
import { getActiveAreas } from '../data/areas.queries'
import { Area } from '@shared/types/area'
import { supabase } from '@app/core/supabase/Supabase.utils'

const generateAreaCode = async (
  areaName: string,
  companyId: string,
): Promise<string> => {
  if (!areaName || !areaName.trim() || !companyId) {
    return ''
  }

  try {
    const { data: companyData } = await supabase
      .from('companies')
      .select('company_name')
      .eq('id', companyId)
      .single()

    const companyName = companyData?.company_name || 'COMP'

    const companyPrefix = companyName
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .substring(0, 3)

    const areaPrefix = areaName
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .substring(0, 4)

    const randomNum = Math.floor(1000 + Math.random() * 9000)

    return `${companyPrefix}-AREA-${areaPrefix}-${randomNum}`
  } catch (error) {
    console.error('Error generating area code:', error)
    const fallbackPrefix = areaName
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .substring(0, 4)
    const randomNum = Math.floor(1000 + Math.random() * 9000)
    return `AREA-${fallbackPrefix}-${randomNum}`
  }
}

const AreaForm: React.FC<AreaFormProps> = ({
  initialValues,
  mode = 'create',
}) => {
  const dispatch = useDispatch()
  const theme = useMantineTheme()
  const { colorScheme } = useMantineColorScheme()

  const [currentUser, setCurrentUser] = useState<Profile | null>(null)
  const [staffUsers, setStaffUsers] = useState<Profile[]>([])
  const [stores, setStores] = useState<Store[]>([])
  const [areas, setAreas] = useState<Area[]>([])
  const [loading, setLoading] = useState(false)
  const [dataLoading, setDataLoading] = useState(true)
  const [loadingError, setLoadingError] = useState<string | null>(null)
  const [generatingCode, setGeneratingCode] = useState(false)

  const handleGenerateCode = async () => {
    if (!form.values.area_name || !form.values.company_id) {
      return
    }

    setGeneratingCode(true)
    try {
      const newCode = await generateAreaCode(
        form.values.area_name,
        form.values.company_id,
      )
      form.setFieldValue('area_code', newCode)
    } catch (error) {
      console.error('Error generating code:', error)
    } finally {
      setGeneratingCode(false)
    }
  }

  const form = useForm({
    initialValues: {
      company_id: '',
      area_name: '',
      area_code: '',
      description: '',
      region: '',
      country: 'Uganda',
      assigned_admin_ids: [] as string[],
      assigned_store_ids: [] as string[],
      is_active: true,
    },
    validate: {
      company_id: (v) =>
        v && v.toString().trim().length > 0 ? null : 'Company is required',
      area_name: (v) => {
        if (!v || !v.trim()) return 'Area name is required'
        if (v.trim().length < 2)
          return 'Area name must be at least 2 characters'
        if (v.trim().length > 255)
          return 'Area name must not exceed 255 characters'
        return null
      },
      area_code: (v) => {
        if (!v || !v.trim()) return 'Area code is required'
        if (v.trim().length < 2)
          return 'Area code must be at least 2 characters'
        if (v.trim().length > 50)
          return 'Area code must not exceed 50 characters'
        return null
      },
      description: (v) => {
        if (v && v.length > 5000)
          return 'Description must not exceed 5000 characters'
        return null
      },
      region: (v) => {
        if (v && v.length > 100) return 'Region must not exceed 100 characters'
        return null
      },
      country: (v) => {
        if (v && v.length > 100) return 'Country must not exceed 100 characters'
        return null
      },
    },
  })

  useEffect(() => {
    if (mode === 'create' && form.values.area_name && form.values.company_id) {
      handleGenerateCode()
    }
  }, [form.values.area_name, form.values.company_id, mode])

  useEffect(() => {
    const initializeForm = async () => {
      try {
        setDataLoading(true)
        setLoadingError(null)

        const user = await getCurrentUserProfile()

        if (!user) {
          setLoadingError('Failed to load user profile')
          setDataLoading(false)
          return
        }

        setCurrentUser(user)

        if (!user.company_id) {
          setLoadingError('User is not associated with a company')
          setDataLoading(false)
          return
        }

        const companyId = user.company_id

        const [staffData, storesData, areasData] = await Promise.all([
          fetchStaffUsers(companyId, StaffRoles),
          fetchStores(companyId),
          getActiveAreas(companyId),
        ])

        setStaffUsers(staffData || [])
        setStores(storesData || [])
        setAreas(areasData.data || [])

        if (mode === 'edit' && initialValues) {
          const assignedAdminIds: string[] = Array.isArray(
            initialValues.assigned_admin_ids,
          )
            ? initialValues.assigned_admin_ids.map((id) => String(id))
            : []

          const assignedStoreIds: string[] = Array.isArray(
            initialValues.assigned_store_ids,
          )
            ? initialValues.assigned_store_ids.map((id) => String(id))
            : []

          form.setValues({
            company_id: String(initialValues.company_id ?? companyId),
            area_name: initialValues.area_name ?? '',
            area_code: initialValues.area_code ?? '',
            description: initialValues.description ?? '',
            region: initialValues.region ?? '',
            country: initialValues.country ?? 'Uganda',
            assigned_admin_ids: assignedAdminIds,
            assigned_store_ids: assignedStoreIds,
            is_active: initialValues.is_active ?? true,
          })
        } else {
          const initialCode = await generateAreaCode('', String(companyId))
          form.setValues({
            company_id: String(companyId),
            area_name: '',
            area_code: initialCode,
            description: '',
            region: '',
            country: 'Uganda',
            assigned_admin_ids: [],
            assigned_store_ids: [],
            is_active: true,
          })
        }

        setDataLoading(false)
      } catch (error: any) {
        console.error('Error initializing form:', error)
        setLoadingError(error.message || 'Failed to load form data')
        setDataLoading(false)
      }
    }

    initializeForm()
  }, [mode, initialValues])

  const adminOptions = useMemo(() => {
    return prepareGroupedOptions<Profile>(
      staffUsers,
      (user) => user.default_area_id ?? null,
      (user) => String(user.auth_id),
      (user) =>
        `${user.first_name || ''} ${user.last_name || ''}`.trim() ||
        'Unnamed User',
      initialValues?.id,
      'Unassigned Admins',
      'Admins Assigned to Other Areas',
    )
  }, [staffUsers, initialValues?.id])

  const storeOptions = useMemo(() => {
    return prepareGroupedOptions<Store>(
      stores,
      (store) => store.area_id ?? null,
      (store) => String(store.id),
      (store) => store.store_name || 'Unnamed Store',
      initialValues?.id,
      'Unassigned Stores',
      'Stores Assigned to Other Areas',
    )
  }, [stores, initialValues?.id])

  if (dataLoading) {
    return <ModalFormSkeleton />
  }

  if (loadingError) {
    return (
      <Box p="xl">
        <Alert
          icon={<IconAlertCircle size={16} />}
          title="Error Loading Form"
          color="red"
          mb="md"
          radius="md"
          variant="light"
        >
          {loadingError}
        </Alert>
        <Button
          onClick={() => window.location.reload()}
          variant="light"
          fullWidth
        >
          Reload Page
        </Button>
      </Box>
    )
  }

  return (
    <Box style={{ display: 'flex', flexDirection: 'column' }}>
      <form
        onSubmit={form.onSubmit((values) =>
          handleSubmit(
            values,
            mode,
            initialValues,
            dispatch,
            setLoading,
            currentUser,
          ),
        )}
      >
        <Stack gap="lg">
          {/* Area Information Section */}
          <Paper
            p="xl"
            withBorder
            radius="md"
            shadow="sm"
            style={{
              borderLeft: `${rem(4)} solid ${theme.colors[theme.primaryColor][6]}`,
              backgroundColor:
                colorScheme === 'dark' ? theme.colors.dark[6] : theme.white,
            }}
          >
            <Group
              mb="lg"
              gap="xs"
            >
              <IconMapPin
                size={22}
                color={theme.colors[theme.primaryColor][6]}
              />
              <Text
                fw={600}
                size="lg"
                c={colorScheme === 'dark' ? theme.white : theme.colors.gray[8]}
              >
                Area Information
              </Text>
            </Group>

            <Stack gap="md">
              <TextInput
                label="Area Name"
                placeholder="e.g., Central Region"
                {...form.getInputProps('area_name')}
                required
                leftSection={<IconMapPin size={16} />}
                description="Enter a unique, descriptive name for this area"
                radius="md"
                size="md"
              />

              <TextInput
                label="Area Code"
                placeholder={
                  mode === 'create'
                    ? 'Auto-generated from company & area name'
                    : 'e.g., ABC-AREA-CENT-1234'
                }
                {...form.getInputProps('area_code')}
                required
                leftSection={<IconCode size={16} />}
                disabled
                description={
                  mode === 'create'
                    ? 'Auto-generated code: COMPANY-AREA-XXXX-XXXX'
                    : 'Unique identifier for this area'
                }
                radius="md"
                size="md"
                rightSection={
                  mode === 'create' ? (
                    <Tooltip label="Regenerate code">
                      <ActionIcon
                        variant="subtle"
                        color={theme.primaryColor}
                        size="lg"
                        onClick={handleGenerateCode}
                        loading={generatingCode}
                        disabled={
                          !form.values.area_name || !form.values.company_id
                        }
                      >
                        <IconRefresh size={16} />
                      </ActionIcon>
                    </Tooltip>
                  ) : null
                }
              />

              <Group grow>
                <TextInput
                  label="Region"
                  placeholder="e.g., Central"
                  {...form.getInputProps('region')}
                  leftSection={<IconMap2 size={16} />}
                  description="Geographic region"
                  radius="md"
                  size="md"
                />

                <TextInput
                  label="Country"
                  placeholder="e.g., Uganda"
                  {...form.getInputProps('country')}
                  leftSection={<IconWorld size={16} />}
                  description="Country location"
                  radius="md"
                  size="md"
                />
              </Group>

              <Textarea
                label="Description"
                placeholder="Enter area description (optional)"
                {...form.getInputProps('description')}
                minRows={3}
                maxRows={6}
                description="Provide additional details about this area"
                radius="md"
                size="md"
              />
            </Stack>
          </Paper>

          {/* Admin Assignment Section */}
          <Paper
            p="xl"
            withBorder
            radius="md"
            shadow="sm"
            style={{
              borderLeft: `${rem(4)} solid ${theme.colors.violet[6]}`,
              backgroundColor:
                colorScheme === 'dark' ? theme.colors.dark[6] : theme.white,
            }}
          >
            <Group
              mb="lg"
              gap="xs"
            >
              <IconUserShield
                size={22}
                color={theme.colors.violet[6]}
              />
              <Text
                fw={600}
                size="lg"
                c={colorScheme === 'dark' ? theme.white : theme.colors.gray[8]}
              >
                Admin Assignment
              </Text>
            </Group>

            <Stack gap="md">
              <MultiSelect
                label="Area Admins"
                placeholder="Select one or more admins"
                data={adminOptions || []}
                value={form.values.assigned_admin_ids}
                onChange={(value) =>
                  form.setFieldValue('assigned_admin_ids', value)
                }
                error={form.errors.assigned_admin_ids}
                disabled={!form.values.company_id}
                searchable
                clearable
                leftSection={<IconUserShield size={16} />}
                nothingFoundMessage={
                  !form.values.company_id
                    ? 'Please select a company first'
                    : !adminOptions ||
                        adminOptions.reduce(
                          (acc, group) => acc + (group?.items?.length || 0),
                          0,
                        ) === 0
                      ? 'No staff users found for this company'
                      : 'No results found'
                }
                description="Optional: Assign admins to manage this area"
                radius="md"
                size="md"
              />

              {form.values.assigned_admin_ids.length > 0 && (
                <Alert
                  icon={<IconInfoCircle size={16} />}
                  title="Admin Assignment"
                  color="blue"
                  variant="light"
                  radius="md"
                >
                  {form.values.assigned_admin_ids.length} admin
                  {form.values.assigned_admin_ids.length > 1 ? 's' : ''} will be
                  assigned to this area
                </Alert>
              )}
            </Stack>
          </Paper>

          {/* Store Assignment Section */}
          <Paper
            p="xl"
            withBorder
            radius="md"
            shadow="sm"
            style={{
              borderLeft: `${rem(4)} solid ${theme.colors.indigo[6]}`,
              backgroundColor:
                colorScheme === 'dark' ? theme.colors.dark[6] : theme.white,
            }}
          >
            <Group
              mb="lg"
              gap="xs"
            >
              <IconBuildingStore
                size={22}
                color={theme.colors.indigo[6]}
              />
              <Text
                fw={600}
                size="lg"
                c={colorScheme === 'dark' ? theme.white : theme.colors.gray[8]}
              >
                Store Assignment
              </Text>
            </Group>

            <Stack gap="md">
              <MultiSelect
                label="Assigned Stores"
                placeholder="Select stores to assign"
                data={storeOptions || []}
                value={form.values.assigned_store_ids}
                onChange={(value) =>
                  form.setFieldValue('assigned_store_ids', value)
                }
                error={form.errors.assigned_store_ids}
                disabled={!form.values.company_id}
                searchable
                clearable
                leftSection={<IconBuildingStore size={16} />}
                nothingFoundMessage={
                  !form.values.company_id
                    ? 'Please select a company first'
                    : !storeOptions ||
                        storeOptions.reduce(
                          (acc, group) => acc + (group?.items?.length || 0),
                          0,
                        ) === 0
                      ? 'No stores found for this company'
                      : 'No results found'
                }
                description="Optional: Assign stores to this area"
                radius="md"
                size="md"
              />

              {form.values.assigned_store_ids.length > 0 && (
                <Alert
                  icon={<IconInfoCircle size={16} />}
                  title="Store Assignment"
                  color="blue"
                  variant="light"
                  radius="md"
                >
                  {form.values.assigned_store_ids.length} store
                  {form.values.assigned_store_ids.length > 1 ? 's' : ''} will be
                  assigned to this area
                </Alert>
              )}
            </Stack>
          </Paper>

          {/* Status Section */}
          <Paper
            p="xl"
            withBorder
            radius="md"
            shadow="sm"
            style={{
              borderLeft: `${rem(4)} solid ${form.values.is_active ? theme.colors.green[6] : theme.colors.gray[6]}`,
              backgroundColor:
                colorScheme === 'dark' ? theme.colors.dark[6] : theme.white,
            }}
          >
            <Group
              justify="space-between"
              align="center"
            >
              <div>
                <Text
                  fw={600}
                  size="md"
                  mb={4}
                >
                  Area Status
                </Text>
                <Text
                  size="sm"
                  c="dimmed"
                >
                  {form.values.is_active
                    ? 'Area is currently active and operational'
                    : 'Area is inactive and hidden from general views'}
                </Text>
              </div>
              <Switch
                size="lg"
                checked={form.values.is_active}
                onChange={(e) =>
                  form.setFieldValue('is_active', e.currentTarget.checked)
                }
                onLabel={<IconCheck size={16} />}
                color={theme.primaryColor}
                thumbIcon={
                  form.values.is_active ? (
                    <IconCheck
                      size={12}
                      color={theme.colors.green[6]}
                    />
                  ) : undefined
                }
              />
            </Group>
          </Paper>

          {/* Submit Button */}
          <Group
            justify="center"
            mt="md"
          >
            <Button
              type="submit"
              size="lg"
              loading={loading}
              disabled={!form.values.company_id}
              leftSection={<IconMapPin size={18} />}
              radius="md"
              color={theme.primaryColor}
            >
              {mode === 'edit' ? 'Update Area' : 'Create Area'}
            </Button>
          </Group>
        </Stack>
      </form>
    </Box>
  )
}

export default AreaForm

