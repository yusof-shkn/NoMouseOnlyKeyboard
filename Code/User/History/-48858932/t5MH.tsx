// src/features/main/UnitForm/UnitForm.tsx - Enhanced with theming
import React, { useEffect, useState } from 'react'
import { useDispatch } from 'react-redux'
import {
  Button,
  Switch,
  Select,
  TextInput,
  Stack,
  Group,
  Text,
  Paper,
  Box,
  Alert,
  NumberInput,
  ActionIcon,
  Tooltip,
  useMantineTheme,
  useMantineColorScheme,
} from '@mantine/core'
import { useForm } from '@mantine/form'
import {
  IconRuler,
  IconCode,
  IconInfoCircle,
  IconAlertCircle,
  IconDatabase,
  IconLayersLinked,
  IconBoxMultiple,
  IconRefresh,
} from '@tabler/icons-react'
import { UnitFormProps } from '../types/unitsForm.types'
import { handleSubmit } from '../handlers/unitsForm.handlers'
import { Profile } from '@shared/types/profile'
import { getCurrentUserProfile } from '@shared/utils/authUtils'
import { ModalFormSkeleton } from '@shared/components/skeletons/ModalForm.skeleton'
import { getBaseUnits } from '../data/units.queries'
import { UNIT_TYPES } from '@shared/types/units'
import { supabase } from '@app/core/supabase/Supabase.utils'
import { getPrimaryColor, getThemeColors } from '@app/core/theme/theme.utils'

const generateUnitCode = async (
  unitName: string,
  companyId: string,
): Promise<string> => {
  if (!unitName || !unitName.trim() || !companyId) {
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

    const unitPrefix = unitName
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .substring(0, 3)

    const randomNum = Math.floor(1000 + Math.random() * 9000)

    return `${companyPrefix}-UNIT-${unitPrefix}-${randomNum}`
  } catch (error) {
    console.error('Error generating unit code:', error)
    const fallbackPrefix = unitName
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .substring(0, 3)
    const randomNum = Math.floor(1000 + Math.random() * 9000)
    return `UNIT-${fallbackPrefix}-${randomNum}`
  }
}

const UnitForm: React.FC<UnitFormProps> = ({
  initialValues,
  unit,
  mode = 'create',
}) => {
  const unitData = initialValues || unit
  const dispatch = useDispatch()
  const theme = useMantineTheme()
  const { colorScheme } = useMantineColorScheme()
  const resolvedColorScheme: 'light' | 'dark' =
    colorScheme === 'auto' ? 'light' : colorScheme

  const themeColors = getThemeColors(theme, resolvedColorScheme)
  const primaryColor = getPrimaryColor(theme)

  const [currentUser, setCurrentUser] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(false)
  const [dataLoading, setDataLoading] = useState(true)
  const [loadingError, setLoadingError] = useState<string | null>(null)
  const [generatingCode, setGeneratingCode] = useState(false)
  const [baseUnits, setBaseUnits] = useState<
    Array<{ value: string; label: string }>
  >([])

  const form = useForm({
    initialValues: {
      company_id: '',
      name: '',
      short_code: '',
      type: 'base' as 'base' | 'derived' | 'compound',
      base_unit_id: '',
      conversion_factor: 1,
      is_active: true,
    },
    validate: {
      company_id: (v) =>
        v && v.toString().trim().length > 0 ? null : 'Company is required',
      name: (v) => {
        if (!v || !v.trim()) return 'Unit name is required'
        if (v.trim().length < 1) return 'Unit name must be at least 1 character'
        if (v.trim().length > 100)
          return 'Unit name must not exceed 100 characters'
        return null
      },
      short_code: (v) => {
        if (!v || !v.trim()) return 'Unit code is required'
        if (v.trim().length > 20)
          return 'Unit code must not exceed 20 characters'
        return null
      },
      type: (v) => {
        if (!v) return 'Unit type is required'
        if (!['base', 'derived', 'compound'].includes(v))
          return 'Invalid unit type'
        return null
      },
      base_unit_id: (v, values) => {
        if (values.type !== 'base' && (!v || v === '')) {
          return 'Base unit is required for derived and compound units'
        }
        return null
      },
      conversion_factor: (v, values) => {
        if (values.type !== 'base') {
          if (!v || v <= 0) return 'Conversion factor must be greater than 0'
          if (v > 1000000) return 'Conversion factor seems unreasonably large'
        }
        return null
      },
    },
  })

  const handleGenerateCode = async () => {
    if (!form.values.name || !form.values.company_id) {
      return
    }

    setGeneratingCode(true)
    try {
      const newCode = await generateUnitCode(
        form.values.name,
        form.values.company_id,
      )
      form.setFieldValue('short_code', newCode)
    } catch (error) {
      console.error('Error generating code:', error)
    } finally {
      setGeneratingCode(false)
    }
  }

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

        const companyId = user.company_id.toString()

        const { data: baseUnitsData, error: baseUnitsError } =
          await getBaseUnits(user.company_id)
        if (baseUnitsError) {
          console.error('Error fetching base units:', baseUnitsError)
        } else if (baseUnitsData) {
          setBaseUnits(
            baseUnitsData.map((unit) => ({
              value: unit.id.toString(),
              label: `${unit.name} (${unit.short_code})`,
            })),
          )
        }

        if (mode === 'edit' && unitData) {
          let formType: 'base' | 'derived' | 'compound' = 'base'
          if (unitData.type === 'derived' || unitData.type === 'compound') {
            formType = unitData.type
          }

          form.setValues({
            company_id: String(unitData.company_id ?? companyId),
            name: unitData.name ?? '',
            short_code: unitData.short_code ?? '',
            type: formType,
            base_unit_id: unitData.base_unit_id?.toString() ?? '',
            conversion_factor: unitData.conversion_factor ?? 1,
            is_active: unitData.is_active ?? true,
          })
        } else {
          const initialCode = await generateUnitCode('', companyId)
          form.setValues({
            company_id: companyId,
            name: '',
            short_code: initialCode,
            type: 'base',
            base_unit_id: '',
            conversion_factor: 1,
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
  }, [mode, initialValues?.id, unit?.id])

  useEffect(() => {
    if (mode === 'create' && form.values.name && form.values.company_id) {
      const timeoutId = setTimeout(() => {
        handleGenerateCode()
      }, 500)
      return () => clearTimeout(timeoutId)
    }
  }, [form.values.name, mode])

  const unitTypeOptions = [
    { value: 'base', label: 'Base Unit' },
    { value: 'derived', label: 'Derived Unit' },
    { value: 'compound', label: 'Compound Unit' },
  ]

  const currentTypeConfig = UNIT_TYPES[form.values.type]
  const showBaseUnitField = currentTypeConfig?.requiresBaseUnit
  const showConversionField = currentTypeConfig?.requiresConversion

  if (dataLoading) {
    return <ModalFormSkeleton />
  }

  if (loadingError) {
    return (
      <Box p="20px">
        <Alert
          icon={<IconAlertCircle size={16} />}
          title="Error Loading Form"
          color="red"
          mb="md"
          styles={{
            root: { backgroundColor: themeColors.backgroundAlt },
          }}
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
    <Box
      style={{
        display: 'flex',
        flexDirection: 'column',
        borderRadius: '12px',
        backgroundColor: themeColors.background,
      }}
    >
      <form
        onSubmit={form.onSubmit((values) =>
          handleSubmit(
            values,
            mode,
            unitData,
            dispatch,
            setLoading,
            currentUser,
          ),
        )}
        style={{ display: 'flex', flexDirection: 'column', width: '100%' }}
      >
        <Box
          style={{
            display: 'flex',
            flexDirection: 'row',
            gap: '20px',
            width: '100%',
          }}
        >
          {/* LEFT COLUMN */}
          <Box style={{ flex: 1 }}>
            <Paper
              p="20px"
              withBorder
              shadow="sm"
              style={{
                borderLeft: `4px solid ${primaryColor}`,
                backgroundColor: themeColors.background,
              }}
            >
              <Text
                fw={600}
                size="md"
                c={themeColors.text}
                mb="md"
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <IconRuler
                  size={20}
                  color={primaryColor}
                />
                Basic Information
              </Text>

              <Stack gap="md">
                <TextInput
                  label="Unit Name"
                  placeholder="e.g., Tablet, Strip, Box"
                  {...form.getInputProps('name')}
                  required
                  leftSection={<IconRuler size={16} />}
                  description="Enter the unit name"
                />

                <TextInput
                  label="Unit Code"
                  placeholder={
                    mode === 'edit'
                      ? 'Unit code'
                      : 'Auto-generated from company & unit name'
                  }
                  {...form.getInputProps('short_code')}
                  required
                  leftSection={<IconCode size={16} />}
                  disabled={mode === 'edit'}
                  description={
                    mode === 'create'
                      ? 'Auto-generated code: COMPANY-UNIT-XXX-XXXX'
                      : 'Short code for this unit (cannot be changed)'
                  }
                  rightSection={
                    mode === 'create' ? (
                      <Tooltip label="Regenerate code">
                        <ActionIcon
                          variant="subtle"
                          color="blue"
                          onClick={handleGenerateCode}
                          loading={generatingCode}
                          disabled={
                            !form.values.name || !form.values.company_id
                          }
                        >
                          <IconRefresh size={16} />
                        </ActionIcon>
                      </Tooltip>
                    ) : null
                  }
                />

                <Select
                  label="Unit Type"
                  placeholder="Select unit type"
                  data={unitTypeOptions}
                  value={form.values.type}
                  onChange={(value) => {
                    form.setFieldValue(
                      'type',
                      value as 'base' | 'derived' | 'compound',
                    )
                    if (value === 'base') {
                      form.setFieldValue('base_unit_id', '')
                      form.setFieldValue('conversion_factor', 1)
                    }
                  }}
                  required
                  leftSection={<IconDatabase size={16} />}
                  description="Select the type of unit"
                />

                {currentTypeConfig && (
                  <Alert
                    icon={<IconInfoCircle size={16} />}
                    color={currentTypeConfig.color}
                    variant="light"
                    styles={{
                      root: { backgroundColor: themeColors.backgroundAlt },
                    }}
                  >
                    <strong>{currentTypeConfig.label}:</strong>{' '}
                    {currentTypeConfig.description}
                  </Alert>
                )}

                {showBaseUnitField && (
                  <Select
                    label="Base Unit"
                    placeholder="Select base unit"
                    data={baseUnits}
                    value={form.values.base_unit_id}
                    onChange={(value) =>
                      form.setFieldValue('base_unit_id', value || '')
                    }
                    required
                    leftSection={<IconLayersLinked size={16} />}
                    description="The base unit this unit is derived from"
                    disabled={baseUnits.length === 0}
                    error={
                      baseUnits.length === 0
                        ? 'No base units available. Create a base unit first.'
                        : undefined
                    }
                  />
                )}

                {showConversionField && (
                  <NumberInput
                    label="Conversion Factor"
                    placeholder="e.g., 10"
                    {...form.getInputProps('conversion_factor')}
                    required
                    min={0.000001}
                    max={1000000}
                    decimalScale={6}
                    leftSection={<IconBoxMultiple size={16} />}
                    description={
                      form.values.base_unit_id && baseUnits.length > 0
                        ? `1 ${form.values.short_code || 'unit'} = ${form.values.conversion_factor} ${
                            baseUnits
                              .find((u) => u.value === form.values.base_unit_id)
                              ?.label.split('(')[1]
                              ?.replace(')', '') || 'base units'
                          }`
                        : 'Number of base units in this unit'
                    }
                  />
                )}
              </Stack>
            </Paper>
          </Box>

          {/* RIGHT COLUMN */}
          <Stack style={{ flex: 1 }}>
            <Paper
              p="20px"
              withBorder
              shadow="sm"
              style={{
                borderLeft: `4px solid ${primaryColor}`,
                backgroundColor: themeColors.background,
              }}
            >
              <Group
                justify="space-between"
                align="center"
              >
                <div>
                  <Text
                    fw={600}
                    size="sm"
                    c={themeColors.text}
                    mb={4}
                  >
                    Unit Status
                  </Text>
                  <Text
                    size="xs"
                    c="dimmed"
                  >
                    {form.values.is_active
                      ? 'Active and available for use'
                      : 'Inactive and hidden'}
                  </Text>
                </div>
                <Switch
                  size="lg"
                  checked={form.values.is_active}
                  onChange={(e) =>
                    form.setFieldValue('is_active', e.currentTarget.checked)
                  }
                  onLabel="Active"
                  offLabel="Inactive"
                  color={theme.primaryColor}
                />
              </Group>
            </Paper>

            <Paper
              p="20px"
              withBorder
              shadow="sm"
              style={{
                borderLeft: `4px solid ${primaryColor}`,
                backgroundColor: themeColors.background,
              }}
            >
              <Text
                fw={600}
                size="md"
                c={themeColors.text}
                mb="md"
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <IconInfoCircle
                  size={20}
                  color={primaryColor}
                />
                Unit Examples
              </Text>

              <Stack gap="xs">
                <Text
                  size="xs"
                  c="dimmed"
                >
                  <strong>Base Units:</strong> Tablet, Bottle, Gram, Liter
                </Text>
                <Text
                  size="xs"
                  c="dimmed"
                >
                  <strong>Derived Units:</strong> Strip (10 tablets), Box (100
                  tablets)
                </Text>
                <Text
                  size="xs"
                  c="dimmed"
                >
                  <strong>Compound Units:</strong> mg/mL, mg/tablet
                </Text>
              </Stack>
            </Paper>
          </Stack>
        </Box>

        <Alert
          icon={<IconInfoCircle size={16} />}
          color={theme.primaryColor}
          variant="light"
          mt="20px"
          styles={{
            root: { backgroundColor: themeColors.backgroundAlt },
          }}
        >
          <Text
            size="sm"
            fw={500}
            mb={4}
            c={themeColors.text}
          >
            Unit Management Tips:
          </Text>
          <Text
            size="xs"
            c="dimmed"
          >
            • <strong>Base units</strong> are fundamental (e.g., Tablet, Bottle)
            <br />• <strong>Derived units</strong> convert to base units (e.g.,
            1 Strip = 10 Tablets)
            <br />• <strong>Compound units</strong> combine measurements (e.g.,
            mg/mL)
            <br />• Create base units before creating derived/compound units
          </Text>
        </Alert>

        <Group
          justify="center"
          mt="xl"
        >
          <Button
            type="submit"
            size="lg"
            loading={loading}
            disabled={!form.values.company_id}
            leftSection={<IconRuler size={18} />}
            color={theme.primaryColor}
          >
            {mode === 'edit' ? 'Update Unit' : 'Create Unit'}
          </Button>
        </Group>
      </form>
    </Box>
  )
}

export default UnitForm

