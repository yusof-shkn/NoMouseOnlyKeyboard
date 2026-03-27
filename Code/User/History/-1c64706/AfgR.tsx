import React, { useEffect, useState } from 'react'
import { useDispatch } from 'react-redux'
import {
  Button, Textarea, Switch, TextInput, Stack, Group,
  Text, Paper, Box, Alert, ColorInput, ActionIcon,
  Tooltip, Badge, useMantineTheme, useMantineColorScheme,
} from '@mantine/core'
import { useForm } from '@mantine/form'
import {
  IconCategory, IconCode, IconInfoCircle, IconAlertCircle,
  IconPalette, IconRefresh, IconWorldCheck, IconBuildingStore,
} from '@tabler/icons-react'
import { CategoryFormProps } from '../types/categoriesForm.types'
import { handleSubmit } from '../handlers/categoriesForm.handlers'
import { Profile } from '@shared/types/profile'
import { getCurrentUserProfile } from '@shared/utils/authUtils'
import { ModalFormSkeleton } from '@shared/components/skeletons/ModalForm.skeleton'
import { supabase } from '@app/core/supabase/Supabase.utils'
import { getPrimaryColor, getThemeColors } from '@app/core/theme/theme.utils'

const generateCategoryCode = async (categoryName: string, companyId: string): Promise<string> => {
  if (!categoryName?.trim() || !companyId) return ''

  try {
    const { data: companyData } = await supabase
      .from('companies')
      .select('company_name')
      .eq('id', companyId)
      .single()

    const companyPrefix = (companyData?.company_name || 'COMP')
      .trim().toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 3)

    const categoryPrefix = categoryName
      .trim().toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 4)

    const randomNum = Math.floor(1000 + Math.random() * 9000)
    return `${companyPrefix}-CAT-${categoryPrefix}-${randomNum}`
  } catch {
    const fallbackPrefix = categoryName.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 4)
    return `CAT-${fallbackPrefix}-${Math.floor(1000 + Math.random() * 9000)}`
  }
}

const CategoryForm: React.FC<CategoryFormProps> = ({ initialValues, mode = 'create' }) => {
  const dispatch = useDispatch()
  const theme = useMantineTheme()
  const { colorScheme } = useMantineColorScheme()
  const resolvedColorScheme: 'light' | 'dark' = colorScheme === 'auto' ? 'light' : colorScheme
  const themeColors = getThemeColors(theme, resolvedColorScheme)
  const primaryColor = getPrimaryColor(theme)

  const [currentUser, setCurrentUser] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(false)
  const [dataLoading, setDataLoading] = useState(true)
  const [loadingError, setLoadingError] = useState<string | null>(null)
  const [generatingCode, setGeneratingCode] = useState(false)
  const [isSystemCategory, setIsSystemCategory] = useState(false)

  const form = useForm({
    initialValues: {
      company_id: '',
      category_name: '',
      category_code: '',
      description: '',
      is_active: true,
      color_code: '',
      icon_name: '',
    },
    validate: {
      company_id: (v) => (v?.toString().trim().length > 0 ? null : 'Company is required'),
      category_name: (v) => {
        if (!v?.trim()) return 'Category name is required'
        if (v.trim().length < 2) return 'Category name must be at least 2 characters'
        if (v.trim().length > 255) return 'Category name must not exceed 255 characters'
        return null
      },
      category_code: (v) => {
        if (!v?.trim()) return 'Category code is required'
        if (v.trim().length > 50) return 'Category code must not exceed 50 characters'
        return null
      },
      description: (v) => (v && v.length > 1000 ? 'Description must not exceed 1000 characters' : null),
      color_code: (v) => (v && !/^#[0-9A-F]{6}$/i.test(v) ? 'Color must be a valid hex code (e.g., #FF5733)' : null),
    },
  })

  const handleGenerateCode = async () => {
    if (!form.values.category_name || !form.values.company_id) return
    setGeneratingCode(true)
    try {
      const newCode = await generateCategoryCode(form.values.category_name, form.values.company_id)
      form.setFieldValue('category_code', newCode)
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
        if (!user) { setLoadingError('Failed to load user profile'); setDataLoading(false); return }

        setCurrentUser(user)

        if (!user.company_id) { setLoadingError('User is not associated with a company'); setDataLoading(false); return }

        const companyId = user.company_id.toString()

        if (mode === 'edit' && initialValues) {
          setIsSystemCategory(initialValues.company_id === 1)
          form.setValues({
            company_id: String(initialValues.company_id ?? companyId),
            category_name: initialValues.category_name ?? '',
            category_code: initialValues.category_code ?? '',
            description: initialValues.description ?? '',
            is_active: initialValues.is_active ?? true,
            color_code: initialValues.color_code ?? '',
            icon_name: initialValues.icon_name ?? '',
          })
        } else {
          const initialCode = await generateCategoryCode('', companyId)
          form.setValues({
            company_id: companyId,
            category_name: '',
            category_code: initialCode,
            description: '',
            is_active: true,
            color_code: '',
            icon_name: '',
          })
        }

        setDataLoading(false)
      } catch (error: any) {
        setLoadingError(error.message || 'Failed to load form data')
        setDataLoading(false)
      }
    }

    initializeForm()
  }, [mode, initialValues])

  useEffect(() => {
    if (mode === 'create' && form.values.category_name && form.values.company_id) {
      handleGenerateCode()
    }
  }, [form.values.category_name, form.values.company_id, mode])

  if (dataLoading) return <ModalFormSkeleton />

  if (loadingError) {
    return (
      <Box p="20px">
        <Alert icon={<IconAlertCircle size={16} />} title="Error Loading Form" color="red" mb="md">
          {loadingError}
        </Alert>
        <Button onClick={() => window.location.reload()} variant="light" fullWidth>Reload Page</Button>
      </Box>
    )
  }

  // Read-only for system categories
  if (isSystemCategory) {
    return (
      <Box style={{ display: 'flex', flexDirection: 'column', borderRadius: '12px', backgroundColor: themeColors.background }}>
        <Alert icon={<IconWorldCheck size={16} />} title="System Category - Read Only" color="blue" mb="md">
          This is a system category and cannot be edited. System categories are shared across all companies.
        </Alert>

        <Box style={{ display: 'flex', flexDirection: 'row', gap: '20px', width: '100%' }}>
          <Box style={{ flex: 1 }}>
            <Paper p="20px" withBorder shadow="sm" style={{ borderLeft: '4px solid #3b82f6', opacity: 0.8, backgroundColor: themeColors.background }}>
              <Group justify="space-between" mb="md">
                <Text fw={600} size="md" c={themeColors.text} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <IconCategory size={20} /> Basic Information
                </Text>
                <Badge variant="light" color="blue" leftSection={<IconWorldCheck size={14} />} size="lg">
                  System Category
                </Badge>
              </Group>
              <Stack gap="md">
                <TextInput label="Category Name" value={form.values.category_name} disabled leftSection={<IconCategory size={16} />} />
                <TextInput label="Category Code" value={form.values.category_code} disabled leftSection={<IconCode size={16} />} />
              </Stack>
            </Paper>
          </Box>

          <Stack style={{ flex: 1 }}>
            <Paper p="20px" withBorder shadow="sm" style={{ borderLeft: '4px solid #3b82f6', opacity: 0.8, backgroundColor: themeColors.background }}>
              <Text fw={600} size="md" c={themeColors.text} mb="md" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <IconInfoCircle size={20} /> Additional Details
              </Text>
              <Stack gap="md">
                <Textarea label="Description" value={form.values.description} disabled minRows={4} />
                <ColorInput label="Color Code" value={form.values.color_code} disabled leftSection={<IconPalette size={16} />} />
                <TextInput label="Icon Name" value={form.values.icon_name} disabled />
              </Stack>
            </Paper>
