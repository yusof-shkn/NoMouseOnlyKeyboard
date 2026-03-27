// src/features/main/CustomerForm/CustomerForm.tsx

import React, { useEffect, useState } from 'react'
import { useDispatch } from 'react-redux'
import {
  Button,
  Switch,
  TextInput,
  Stack,
  Group,
  Text,
  Paper,
  Box,
  Alert,
  Textarea,
  NumberInput,
  useMantineTheme,
  useMantineColorScheme,
} from '@mantine/core'
import { useForm } from '@mantine/form'
import {
  IconUser,
  IconPhone,
  IconMail,
  IconMapPin,
  IconInfoCircle,
  IconAlertCircle,
  IconCurrencyDollar,
  IconCalendar,
  IconShieldCheck,
  IconFileText,
  IconCheck,
  IconClock,
} from '@tabler/icons-react'
import { CustomerFormProps } from '../types/customerForm.types'
import { handleSubmit } from '../handlers/customerForm.handlers'
import { Profile } from '@shared/types/profile'
import { getCurrentUserProfile } from '@shared/utils/authUtils'
import { ModalFormSkeleton } from '@shared/components/skeletons/ModalForm.skeleton'
import { getCompanySettings } from '../data/customers.queries'

const CustomerForm: React.FC<CustomerFormProps> = ({
  customer,
  mode = 'create',
}) => {
  const dispatch = useDispatch()
  const theme = useMantineTheme()
  const { colorScheme } = useMantineColorScheme()
  const isDark = colorScheme === 'dark'

  const sectionBorderColor = theme.colors[theme.primaryColor][5]
  const labelColor = isDark ? theme.colors.dark[1] : theme.colors.gray[7]
  const paperBg = isDark ? theme.colors.dark[6] : theme.white

  const [currentUser, setCurrentUser] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(false)
  const [dataLoading, setDataLoading] = useState(true)
  const [loadingError, setLoadingError] = useState<string | null>(null)
  const [defaultCreditDays, setDefaultCreditDays] = useState(30)

  const form = useForm({
    initialValues: {
      company_id: '',
      first_name: '',
      last_name: '',
      phone: '',
      email: '',
      address: '',
      insurance_provider: '',
      insurance_number: '',
      insurance_expiry_date: '',
      insurance_policy_type: '',
      insurance_coverage_limit: 0,
      credit_limit: 0,
      credit_days: 30,
      notes: '',
      is_active: true,
    },
    validate: {
      company_id: (v) =>
        v && v.toString().trim().length > 0 ? null : 'Company is required',
      first_name: (v) => {
        if (!v || !v.trim()) return 'First name is required'
        if (v.trim().length < 2)
          return 'First name must be at least 2 characters'
        if (v.trim().length > 100)
          return 'First name must not exceed 100 characters'
        return null
      },
      last_name: (v) => {
        if (!v || !v.trim()) return 'Last name is required'
        if (v.trim().length < 2)
          return 'Last name must be at least 2 characters'
        if (v.trim().length > 100)
          return 'Last name must not exceed 100 characters'
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
          if (v.length > 100) return 'Email must not exceed 100 characters'
        }
        return null
      },
      credit_limit: (v) => {
        if (v !== undefined && v < 0) return 'Credit limit cannot be negative'
        return null
      },
      credit_days: (v) => {
        if (v !== undefined && v < 0) return 'Credit days cannot be negative'
        if (v !== undefined && v > 365) return 'Credit days cannot exceed 365'
        return null
      },
    },
  })

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

        // Get default credit days from company settings if available
        const { data: settings } = await getCompanySettings(user.company_id)
        const creditDays = settings?.default_credit_days || 30
        setDefaultCreditDays(creditDays)

        if (mode === 'edit' && customer) {
          form.setValues({
            company_id: String(customer.company_id ?? companyId),
            first_name: customer.first_name ?? '',
            last_name: customer.last_name ?? '',
            phone: customer.phone ?? '',
            email: customer.email ?? '',
            address: customer.address ?? '',
            insurance_provider:
              (customer as any).customer_insurance?.insurance_provider ?? '',
            insurance_number:
              (customer as any).customer_insurance?.insurance_number ?? '',
            insurance_expiry_date:
              (customer as any).customer_insurance?.insurance_expiry_date ?? '',
            insurance_policy_type:
              (customer as any).customer_insurance?.policy_type ?? '',
            insurance_coverage_limit:
              (customer as any).customer_insurance?.coverage_limit ?? 0,
            credit_limit: customer.credit_limit ?? 0,
            credit_days: customer.credit_days ?? creditDays,
            notes: customer.notes ?? '',
            is_active: customer.is_active ?? true,
          })
        } else {
          form.setValues({
            company_id: companyId,
            first_name: '',
            last_name: '',
            phone: '',
            email: '',
            address: '',
            insurance_provider: '',
            insurance_number: '',
            insurance_expiry_date: '',
            insurance_policy_type: '',
            insurance_coverage_limit: 0,
            credit_limit: 0,
            credit_days: creditDays,
            notes: '',
            is_active: true,
          })
        }

        setDataLoading(false)
      } catch (error: any) {
        setLoadingError(error.message || 'Failed to load form data')
        setDataLoading(false)
      }
    }
    initializeForm()
  }, [mode, customer])

  if (dataLoading) return <ModalFormSkeleton />

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

  const sectionStyle = {
    borderLeft: `4px solid ${sectionBorderColor}`,
    marginBottom: '20px',
    backgroundColor: paperBg,
  }

  return (
    <Box
      style={{ display: 'flex', flexDirection: 'column', borderRadius: '12px' }}
    >
      <form
        onSubmit={form.onSubmit((values) =>
          handleSubmit(
            values,
            mode,
            customer,
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
            {/* Basic Information */}
            <Paper
              p="20px"
              withBorder
              shadow="sm"
              style={sectionStyle}
            >
              <Text
                fw={600}
                size="md"
                c={labelColor}
                mb="md"
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <IconUser
                  size={20}
                  color={sectionBorderColor}
                />
                Basic Information
              </Text>
              <Stack gap="md">
                <TextInput
                  label="First Name"
                  placeholder="e.g., John"
                  {...form.getInputProps('first_name')}
                  required
                  leftSection={<IconUser size={16} />}
                  description="Customer's first name"
                />
                <TextInput
                  label="Last Name"
                  placeholder="e.g., Doe"
                  {...form.getInputProps('last_name')}
                  required
                  leftSection={<IconUser size={16} />}
                  description="Customer's last name"
                />
                <TextInput
                  label="Phone Number"
                  placeholder="e.g., +256700000000"
                  {...form.getInputProps('phone')}
                  required
                  leftSection={<IconPhone size={16} />}
                  description="Primary contact phone number"
                />
                <TextInput
                  label="Email Address"
                  placeholder="e.g., customer@email.com"
                  {...form.getInputProps('email')}
                  leftSection={<IconMail size={16} />}
                  description="Email address (optional)"
                />
              </Stack>
            </Paper>

            {/* Location Information */}
            <Paper
              p="20px"
              withBorder
              shadow="sm"
              style={sectionStyle}
            >
              <Text
                fw={600}
                size="md"
                c={labelColor}
                mb="md"
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <IconMapPin
                  size={20}
                  color={sectionBorderColor}
                />
                Location Information
              </Text>
              <Textarea
                label="Address"
                placeholder="e.g., Plot 123, Kampala Road, Central District, Kampala"
                {...form.getInputProps('address')}
                description="Full address including city and district"
                minRows={3}
              />
            </Paper>

            {/* Credit Information */}
            <Paper
              p="20px"
              withBorder
              shadow="sm"
              style={sectionStyle}
            >
              <Text
                fw={600}
                size="md"
                c={labelColor}
                mb="md"
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <IconCurrencyDollar
                  size={20}
                  color={sectionBorderColor}
                />
                Credit Information
              </Text>
              <Stack gap="md">
                <NumberInput
                  label="Credit Limit"
                  placeholder="e.g., 500000"
                  {...form.getInputProps('credit_limit')}
                  leftSection={<IconCurrencyDollar size={16} />}
                  description="Maximum amount customer can owe (0 = no credit)"
                  min={0}
                  thousandSeparator=","
                />
                <NumberInput
                  label="Credit Days"
                  placeholder="e.g., 30"
                  {...form.getInputProps('credit_days')}
                  leftSection={<IconClock size={16} />}
                  description="Number of days customer has to pay"
                  min={0}
                  max={365}
                />
              </Stack>
            </Paper>
          </Box>

          {/* RIGHT COLUMN */}
          <Stack style={{ flex: 1 }}>
            {/* Insurance Information */}
            <Paper
              p="20px"
              withBorder
              shadow="sm"
              style={sectionStyle}
            >
              <Text
                fw={600}
                size="md"
                c={labelColor}
                mb="md"
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <IconShieldCheck
                  size={20}
                  color={sectionBorderColor}
                />
                Insurance Information
              </Text>
              <Alert
                icon={<IconInfoCircle size={14} />}
                color={theme.primaryColor}
                variant="light"
                mb="md"
              >
                <Text size="xs">
                  Insurance information will be saved to a separate insurance
                  record linked to this customer.
                </Text>
              </Alert>
              <Stack gap="md">
                <TextInput
                  label="Insurance Provider"
                  placeholder="e.g., AAR Healthcare"
                  {...form.getInputProps('insurance_provider')}
                  leftSection={<IconShieldCheck size={16} />}
                  description="Insurance company name"
                />
                <TextInput
                  label="Insurance Number"
                  placeholder="e.g., INS123456"
                  {...form.getInputProps('insurance_number')}
                  leftSection={<IconFileText size={16} />}
                  description="Insurance policy number"
                />
                <TextInput
                  label="Policy Type"
                  placeholder="e.g., Premium, Standard"
                  {...form.getInputProps('insurance_policy_type')}
                  leftSection={<IconFileText size={16} />}
                  description="Type of insurance policy"
                />
                <NumberInput
                  label="Coverage Limit"
                  placeholder="e.g., 1000000"
                  {...form.getInputProps('insurance_coverage_limit')}
                  leftSection={<IconCurrencyDollar size={16} />}
                  description="Maximum coverage amount"
                  min={0}
                  thousandSeparator=","
                />
                <TextInput
                  label="Insurance Expiry Date"
                  placeholder="YYYY-MM-DD"
                  type="date"
                  {...form.getInputProps('insurance_expiry_date')}
                  leftSection={<IconCalendar size={16} />}
                  description="When insurance expires"
                />
              </Stack>
            </Paper>

            {/* Additional Information */}
            <Paper
              p="20px"
              withBorder
              shadow="sm"
              style={sectionStyle}
            >
              <Text
                fw={600}
                size="md"
                c={labelColor}
                mb="md"
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <IconInfoCircle
                  size={20}
                  color={sectionBorderColor}
                />
                Additional Information
              </Text>
              <Stack gap="md">
                <Textarea
                  label="Notes"
                  placeholder="Any additional notes or comments"
                  {...form.getInputProps('notes')}
                  description="Internal notes about this customer"
                  minRows={3}
                />
                <Group
                  justify="space-between"
                  align="center"
                >
                  <div>
                    <Text
                      fw={600}
                      size="sm"
                      mb={4}
                    >
                      Customer Status
                    </Text>
                    <Text
                      size="xs"
                      c="dimmed"
                    >
                      {form.values.is_active
                        ? 'Active and can make purchases'
                        : 'Inactive and cannot make purchases'}
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
              </Stack>
            </Paper>
          </Stack>
        </Box>

        <Group
          justify="center"
          mt="xl"
        >
          <Button
            type="submit"
            size="lg"
            loading={loading}
            disabled={!form.values.company_id}
            leftSection={<IconCheck size={18} />}
            color={theme.primaryColor}
          >
            {mode === 'edit' ? 'Update Customer' : 'Create Customer'}
          </Button>
        </Group>
      </form>
    </Box>
  )
}

export default CustomerForm

