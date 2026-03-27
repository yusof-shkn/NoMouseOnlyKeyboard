// src/features/main/SupplierForm/SupplierForm.tsx - ENHANCED with Theme & Dark Mode
import React, { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
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
  Textarea,
  ActionIcon,
  Tooltip,
  useMantineTheme,
  useMantineColorScheme,
} from '@mantine/core'
import { useForm } from '@mantine/form'
import {
  IconTruck,
  IconUser,
  IconPhone,
  IconMail,
  IconMapPin,
  IconInfoCircle,
  IconAlertCircle,
  IconCurrencyDollar,
  IconCalendar,
  IconStar,
  IconFileText,
  IconCode,
  IconRefresh,
} from '@tabler/icons-react'
import { SupplierFormProps } from '../types/supplierForm.types'
import { handleSubmit } from '../handlers/supplierForm.handlers'
import { Profile } from '@shared/types/profile'
import { getCurrentUserProfile } from '@shared/utils/authUtils'
import { ModalFormSkeleton } from '@shared/components/skeletons/ModalForm.skeleton'
import { DEFAULT_PAYMENT_TERMS } from '@shared/types/suppliers'
import { generateSupplierCode } from '../data/companySettings.queries'
import {
  selectCompanySettings,
  selectDefaultCurrency,
} from '@features/authentication/authSlice'
import {
  getPrimaryColor,
  getThemeColors,
  getSectionBorderColor,
  getPaperBackground,
  getSelectionColor,
} from '@app/core/theme/theme.utils'

interface SupplierFormComponentProps {
  initialValues?: SupplierFormProps['initialValues']
  supplier?: SupplierFormProps['initialValues']
  mode?: SupplierFormProps['mode']
}

const SupplierForm: React.FC<SupplierFormComponentProps> = ({
  initialValues,
  supplier,
  mode = 'create',
}) => {
  const supplierData = initialValues || supplier
  const dispatch = useDispatch()
  const theme = useMantineTheme()
  const { colorScheme } = useMantineColorScheme()
  const resolvedColorScheme: 'light' | 'dark' =
    colorScheme === 'dark' ? 'dark' : 'light'
  const isDark = resolvedColorScheme === 'dark'
  const themeColors = getThemeColors(theme, resolvedColorScheme)
  const primaryColor = getPrimaryColor(theme)

  const [currentUser, setCurrentUser] = useState<Profile | null>(null)
  const companySettings = useSelector(selectCompanySettings)
  const defaultCurrency = useSelector(selectDefaultCurrency)

  const [loading, setLoading] = useState(false)
  const [dataLoading, setDataLoading] = useState(true)
  const [loadingError, setLoadingError] = useState<string | null>(null)
  const [generatingCode, setGeneratingCode] = useState(false)

  const form = useForm({
    initialValues: {
      company_id: '',
      supplier_name: '',
      supplier_code: '',
      contact_person: '',
      phone: '',
      email: '',
      address: '',
      city: '',
      country: 'Uganda',
      tax_id: '',
      payment_terms: 'Net 30',
      credit_limit: 0,
      notes: '',
      is_active: true,
    },
    validate: {
      company_id: (v) =>
        v && v.toString().trim().length > 0 ? null : 'Company is required',
      supplier_name: (v) => {
        if (!v || !v.trim()) return 'Supplier name is required'
        if (v.trim().length < 2)
          return 'Supplier name must be at least 2 characters'
        if (v.trim().length > 255)
          return 'Supplier name must not exceed 255 characters'
        return null
      },
      supplier_code: (v) => {
        if (!v || v.trim().length === 0) return 'Supplier code is required'
        if (v.trim().length < 2)
          return 'Supplier code must be at least 2 characters'
        if (v.trim().length > 20)
          return 'Supplier code must be less than 20 characters'
        if (!/^[A-Z0-9-_]+$/i.test(v.trim())) {
          return 'Supplier code can only contain letters, numbers, hyphens, and underscores'
        }
        return null
      },
      phone: (v) => {
        if (!v || !v.trim()) return 'Phone number is required'
        const cleaned = v.replace(/[\s()-]/g, '')
        if (!/^\+?[0-9]{10,15}$/.test(cleaned))
          return 'Invalid phone number format (10-15 digits)'
        return null
      },
      email: (v) => {
        if (v && v.trim()) {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
          if (!emailRegex.test(v)) return 'Invalid email format'
          if (v.length > 255) return 'Email must not exceed 255 characters'
        }
        return null
      },
      contact_person: (v) => {
        if (v && v.length > 255)
          return 'Contact person name must not exceed 255 characters'
        return null
      },
      payment_terms: (v) => {
        if (v && v.length > 100)
          return 'Payment terms must not exceed 100 characters'
        return null
      },
      credit_limit: (v) => {
        if (v !== undefined && v < 0) return 'Credit limit cannot be negative'
        return null
      },
    },
  })

  const handleGenerateCode = async () => {
    if (!form.values.company_id) return

    setGeneratingCode(true)
    try {
      const { code, error } = await generateSupplierCode(
        parseInt(form.values.company_id),
      )

      if (error || !code) {
        throw new Error('Failed to generate supplier code')
      }

      form.setFieldValue('supplier_code', code)
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

        console.log('🔄 Initializing form...', { mode, supplierData })

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

        if (!companySettings) {
          console.error('Company settings not found in Redux')
          setLoadingError('Company settings not loaded')
          setDataLoading(false)
          return
        }

        if (mode === 'edit' && supplierData) {
          console.log(
            '✅ Edit mode - populating with supplier data:',
            supplierData,
          )

          form.setValues({
            company_id: String(supplierData.company_id ?? companyId),
            supplier_name: supplierData.supplier_name ?? '',
            supplier_code: supplierData.supplier_code ?? '',
            contact_person: supplierData.contact_person ?? '',
            phone: supplierData.phone ?? '',
            email: supplierData.email ?? '',
            address: supplierData.address ?? '',
            city: supplierData.city ?? '',
            country: supplierData.country ?? 'Uganda',
            tax_id: supplierData.tax_id ?? '',
            payment_terms: supplierData.payment_terms ?? 'Net 30',
            credit_limit: supplierData.credit_limit ?? 0,
            notes: supplierData.notes ?? '',
            is_active: supplierData.is_active ?? true,
          })
        } else {
          console.log('✅ Create mode - setting defaults')

          const companyIdStr = companyId.toString()

          let initialCode = ''
          if (companySettings.auto_generate_supplier_codes) {
            const { code } = await generateSupplierCode(companyId)
            initialCode = code || ''
          }

          form.setValues({
            company_id: companyIdStr,
            supplier_name: '',
            supplier_code: initialCode,
            contact_person: '',
            phone: '',
            email: '',
            address: '',
            city: '',
            country: 'Uganda',
            tax_id: '',
            payment_terms: 'Net 30',
            credit_limit: 0,
            notes: '',
            is_active: true,
          })
        }

        setDataLoading(false)
      } catch (error: any) {
        console.error('❌ Error initializing form:', error)
        setLoadingError(error.message || 'Failed to load form data')
        setDataLoading(false)
      }
    }

    initializeForm()
  }, [mode, supplierData?.id, companySettings])

  const paymentTermsOptions = DEFAULT_PAYMENT_TERMS.map((term) => ({
    value: term,
    label: term,
  }))

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

  const isAutoGenerate = companySettings?.auto_generate_supplier_codes ?? true
  const isCodeFieldDisabled = mode === 'create' ? isAutoGenerate : true

  return (
    <Box
      style={{
        display: 'flex',
        flexDirection: 'column',
        borderRadius: '12px',
        background: getPaperBackground(theme, resolvedColorScheme),
      }}
    >
      <form
        onSubmit={form.onSubmit((values) =>
          handleSubmit(
            values,
            mode,
            supplierData,
            dispatch,
            setLoading,
            currentUser,
          ),
        )}
        style={{ display: 'flex', flexDirection: 'column', width: '100%' }}
      >
        {/* TWO COLUMN LAYOUT */}
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
            {/* Basic Information */}
            <Paper
              p="xl"
              withBorder
              shadow="sm"
              radius="md"
              style={{
                borderLeft: `4px solid ${primaryColor}`,
                marginBottom: '20px',
                background: getPaperBackground(
                  theme,
                  resolvedColorScheme,
                  true,
                ),
              }}
            >
              <Group
                mb="lg"
                gap="xs"
              >
                <IconTruck
                  size={24}
                  color={primaryColor}
                />
                <Text
                  fw={600}
                  size="lg"
                  c={themeColors.text}
                >
                  Basic Information
                </Text>
              </Group>

              <Stack gap="md">
                <TextInput
                  label="Supplier Name"
                  placeholder="e.g., ABC Pharmaceuticals Ltd."
                  {...form.getInputProps('supplier_name')}
                  required
                  leftSection={
                    <IconTruck
                      size={16}
                      color={themeColors.textSecondary}
                    />
                  }
                  description="Enter the full supplier/company name"
                  styles={{
                    input: {
                      backgroundColor: isDark
                        ? theme.colors.dark[6]
                        : theme.white,
                      borderColor: theme.colors.gray[isDark ? 6 : 4],
                      '&:focus': {
                        borderColor: primaryColor,
                      },
                    },
                  }}
                />

                <TextInput
                  label="Supplier Code"
                  placeholder={
                    isAutoGenerate
                      ? `Auto-generated (e.g., ${companySettings?.supplier_code_prefix || 'SUP'}-0001)`
                      : 'e.g., VENDOR-ABC'
                  }
                  {...form.getInputProps('supplier_code')}
                  required
                  leftSection={
                    <IconCode
                      size={16}
                      color={themeColors.textSecondary}
                    />
                  }
                  disabled={isCodeFieldDisabled}
                  description={
                    mode === 'edit'
                      ? 'Supplier code cannot be changed'
                      : isAutoGenerate
                        ? `Auto-generated: ${companySettings?.supplier_code_prefix || 'SUP'}-XXXX`
                        : 'Enter a unique supplier code (letters, numbers, hyphens, underscores)'
                  }
                  rightSection={
                    mode === 'create' && isAutoGenerate ? (
                      <Tooltip label="Regenerate code">
                        <ActionIcon
                          variant="subtle"
                          color={theme.primaryColor}
                          onClick={handleGenerateCode}
                          loading={generatingCode}
                          disabled={!form.values.company_id}
                        >
                          <IconRefresh size={16} />
                        </ActionIcon>
                      </Tooltip>
                    ) : null
                  }
                  styles={{
                    input: {
                      backgroundColor: isDark
                        ? theme.colors.dark[6]
                        : theme.white,
                      borderColor: theme.colors.gray[isDark ? 6 : 4],
                    },
                  }}
                />

                <TextInput
                  label="Contact Person"
                  placeholder="e.g., John Doe"
                  {...form.getInputProps('contact_person')}
                  leftSection={
                    <IconUser
                      size={16}
                      color={themeColors.textSecondary}
                    />
                  }
                  description="Primary contact person at the supplier"
                  styles={{
                    input: {
                      backgroundColor: isDark
                        ? theme.colors.dark[6]
                        : theme.white,
                      borderColor: theme.colors.gray[isDark ? 6 : 4],
                      '&:focus': {
                        borderColor: primaryColor,
                      },
                    },
                  }}
                />

                <TextInput
                  label="Phone Number"
                  placeholder="e.g., +256700000000"
                  {...form.getInputProps('phone')}
                  required
                  leftSection={
                    <IconPhone
                      size={16}
                      color={themeColors.textSecondary}
                    />
                  }
                  description="Primary contact phone number"
                  styles={{
                    input: {
                      backgroundColor: isDark
                        ? theme.colors.dark[6]
                        : theme.white,
                      borderColor: theme.colors.gray[isDark ? 6 : 4],
                      '&:focus': {
                        borderColor: primaryColor,
                      },
                    },
                  }}
                />

                <TextInput
                  label="Email Address"
                  placeholder="e.g., contact@supplier.com"
                  {...form.getInputProps('email')}
                  leftSection={
                    <IconMail
                      size={16}
                      color={themeColors.textSecondary}
                    />
                  }
                  description="Email address for correspondence"
                  styles={{
                    input: {
                      backgroundColor: isDark
                        ? theme.colors.dark[6]
                        : theme.white,
                      borderColor: theme.colors.gray[isDark ? 6 : 4],
                      '&:focus': {
                        borderColor: primaryColor,
                      },
                    },
                  }}
                />
              </Stack>
            </Paper>

            {/* Location Information */}
            <Paper
              p="xl"
              withBorder
              shadow="sm"
              radius="md"
              style={{
                borderLeft: `4px solid ${primaryColor}`,
                background: getPaperBackground(
                  theme,
                  resolvedColorScheme,
                  true,
                ),
              }}
            >
              <Group
                mb="lg"
                gap="xs"
              >
                <IconMapPin
                  size={24}
                  color={primaryColor}
                />
                <Text
                  fw={600}
                  size="lg"
                  c={themeColors.text}
                >
                  Location Information
                </Text>
              </Group>

              <Stack gap="md">
                <Textarea
                  label="Address"
                  placeholder="e.g., Plot 123, Industrial Area"
                  {...form.getInputProps('address')}
                  leftSection={
                    <IconMapPin
                      size={16}
                      color={themeColors.textSecondary}
                    />
                  }
                  description="Street address or location"
                  minRows={2}
                  styles={{
                    input: {
                      backgroundColor: isDark
                        ? theme.colors.dark[6]
                        : theme.white,
                      borderColor: theme.colors.gray[isDark ? 6 : 4],
                      '&:focus': {
                        borderColor: primaryColor,
                      },
                    },
                  }}
                />

                <TextInput
                  label="City"
                  placeholder="e.g., Kampala"
                  {...form.getInputProps('city')}
                  leftSection={
                    <IconMapPin
                      size={16}
                      color={themeColors.textSecondary}
                    />
                  }
                  description="City or town"
                  styles={{
                    input: {
                      backgroundColor: isDark
                        ? theme.colors.dark[6]
                        : theme.white,
                      borderColor: theme.colors.gray[isDark ? 6 : 4],
                      '&:focus': {
                        borderColor: primaryColor,
                      },
                    },
                  }}
                />

                <TextInput
                  label="Country"
                  placeholder="e.g., Uganda"
                  {...form.getInputProps('country')}
                  leftSection={
                    <IconMapPin
                      size={16}
                      color={themeColors.textSecondary}
                    />
                  }
                  description="Country of operation"
                  styles={{
                    input: {
                      backgroundColor: isDark
                        ? theme.colors.dark[6]
                        : theme.white,
                      borderColor: theme.colors.gray[isDark ? 6 : 4],
                      '&:focus': {
                        borderColor: primaryColor,
                      },
                    },
                  }}
                />
              </Stack>
            </Paper>
          </Box>

          {/* RIGHT COLUMN */}
          <Stack style={{ flex: 1 }}>
            {/* Business Information */}
            <Paper
              p="xl"
              withBorder
              shadow="sm"
              radius="md"
              style={{
                borderLeft: `4px solid ${primaryColor}`,
                background: getPaperBackground(
                  theme,
                  resolvedColorScheme,
                  true,
                ),
              }}
            >
              <Group
                mb="lg"
                gap="xs"
              >
                <IconFileText
                  size={24}
                  color={primaryColor}
                />
                <Text
                  fw={600}
                  size="lg"
                  c={themeColors.text}
                >
                  Business Information
                </Text>
              </Group>

              <Stack gap="md">
                <TextInput
                  label="Tax ID / TIN"
                  placeholder="e.g., 1234567890"
                  {...form.getInputProps('tax_id')}
                  leftSection={
                    <IconFileText
                      size={16}
                      color={themeColors.textSecondary}
                    />
                  }
                  description="Tax identification number"
                  styles={{
                    input: {
                      backgroundColor: isDark
                        ? theme.colors.dark[6]
                        : theme.white,
                      borderColor: theme.colors.gray[isDark ? 6 : 4],
                      '&:focus': {
                        borderColor: primaryColor,
                      },
                    },
                  }}
                />

                <Select
                  label="Payment Terms"
                  placeholder="Select payment terms"
                  data={paymentTermsOptions}
                  {...form.getInputProps('payment_terms')}
                  leftSection={
                    <IconCalendar
                      size={16}
                      color={themeColors.textSecondary}
                    />
                  }
                  description="Default payment terms for this supplier"
                  styles={{
                    input: {
                      backgroundColor: isDark
                        ? theme.colors.dark[6]
                        : theme.white,
                      borderColor: theme.colors.gray[isDark ? 6 : 4],
                      '&:focus': {
                        borderColor: primaryColor,
                      },
                    },
                    option: {
                      '&[data-selected="true"]': {
                        backgroundColor: getSelectionColor(theme, 'active'),
                      },
                      '&[data-hovered="true"]': {
                        backgroundColor: getSelectionColor(theme, 'hover'),
                      },
                    },
                  }}
                />

                <NumberInput
                  label="Credit Limit"
                  placeholder="0"
                  {...form.getInputProps('credit_limit')}
                  min={0}
                  max={999999999}
                  decimalScale={2}
                  prefix={`${defaultCurrency} `}
                  thousandSeparator=","
                  leftSection={
                    <IconCurrencyDollar
                      size={16}
                      color={themeColors.textSecondary}
                    />
                  }
                  description="Maximum credit allowed for this supplier"
                  styles={{
                    input: {
                      backgroundColor: isDark
                        ? theme.colors.dark[6]
                        : theme.white,
                      borderColor: theme.colors.gray[isDark ? 6 : 4],
                      '&:focus': {
                        borderColor: primaryColor,
                      },
                    },
                  }}
                />
              </Stack>
            </Paper>
          </Stack>
        </Box>

        {/* Submit Button */}
        <Group
          justify="center"
          mt="xl"
        >
          <Button
            type="submit"
            size="lg"
            loading={loading}
            disabled={!form.values.company_id}
            leftSection={<IconTruck size={18} />}
            color={theme.primaryColor}
            radius="md"
            styles={{
              root: {
                background: primaryColor,
                '&:hover': {
                  background: theme.colors[theme.primaryColor][7],
                },
              },
            }}
          >
            {mode === 'edit' ? 'Update Supplier' : 'Create Supplier'}
          </Button>
        </Group>
      </form>
    </Box>
  )
}

export default SupplierForm

