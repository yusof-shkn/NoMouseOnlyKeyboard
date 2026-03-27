// src/features/main/CategoryForm/CategoryForm.tsx - Enhanced with theming
import React, { useEffect, useState, useMemo } from 'react'
import { useDispatch } from 'react-redux'
import {
  Button,
  Textarea,
  Switch,
  Select,
  TextInput,
  Stack,
  Group,
  Text,
  Paper,
  Box,
  Alert,
  ColorInput,
  ActionIcon,
  Tooltip,
  Badge,
  useMantineTheme,
  useMantineColorScheme,
} from '@mantine/core'
import { useForm } from '@mantine/form'
import {
  IconCategory,
  IconCode,
  IconInfoCircle,
  IconAlertCircle,
  IconFolderOpen,
  IconSubtask,
  IconPalette,
  IconRefresh,
  IconWorldCheck,
  IconBuildingStore,
} from '@tabler/icons-react'
import { CategoryFormProps } from '../types/categoriesForm.types'
import { handleSubmit } from '../handlers/categoriesForm.handlers'
import { Profile } from '@shared/types/profile'
import { getCurrentUserProfile } from '@shared/utils/authUtils'
import { getParentCategories } from '../data/categories.queries'
import { ModalFormSkeleton } from '@shared/components/skeletons/ModalForm.skeleton'
import { supabase } from '@app/core/supabase/Supabase.utils'
import { getPrimaryColor, getThemeColors } from '@app/core/theme/theme.utils'

const generateCategoryCode = async (
  categoryName: string,
  companyId: string,
): Promise<string> => {
  if (!categoryName || !categoryName.trim() || !companyId) {
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

    const categoryPrefix = categoryName
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .substring(0, 4)

    const randomNum = Math.floor(1000 + Math.random() * 9000)

    return `${companyPrefix}-CAT-${categoryPrefix}-${randomNum}`
  } catch (error) {
    console.error('Error generating category code:', error)
    const fallbackPrefix = categoryName
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .substring(0, 4)
    const randomNum = Math.floor(1000 + Math.random() * 9000)
    return `CAT-${fallbackPrefix}-${randomNum}`
  }
}

const CategoryForm: React.FC<CategoryFormProps> = ({
  initialValues,
  mode = 'create',
}) => {
  const dispatch = useDispatch()
  const theme = useMantineTheme()
  const { colorScheme } = useMantineColorScheme()
  const resolvedColorScheme: 'light' | 'dark' =
    colorScheme === 'auto' ? 'light' : colorScheme

  const themeColors = getThemeColors(theme, resolvedColorScheme)
  const primaryColor = getPrimaryColor(theme)

  const [currentUser, setCurrentUser] = useState<Profile | null>(null)
  const [parentCategories, setParentCategories] = useState<any[]>([])
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
      parent_category_id: '',
      description: '',
      is_active: true,
      color_code: '',
      icon_name: '',
    },
    validate: {
      company_id: (v) =>
        v && v.toString().trim().length > 0 ? null : 'Company is required',
      category_name: (v) => {
        if (!v || !v.trim()) return 'Category name is required'
        if (v.trim().length < 2)
          return 'Category name must be at least 2 characters'
        if (v.trim().length > 255)
          return 'Category name must not exceed 255 characters'
        return null
      },
      category_code: (v) => {
        if (!v || !v.trim()) return 'Category code is required'
        if (v.trim().length > 50)
          return 'Category code must not exceed 50 characters'
        return null
      },
      description: (v) => {
        if (v && v.length > 1000)
          return 'Description must not exceed 1000 characters'
        return null
      },
      color_code: (v) => {
        if (v && !/^#[0-9A-F]{6}$/i.test(v))
          return 'Color must be a valid hex code (e.g., #FF5733)'
        return null
      },
    },
  })

  const handleGenerateCode = async () => {
    if (!form.values.category_name || !form.values.company_id) {
      return
    }

    setGeneratingCode(true)
    try {
      const newCode = await generateCategoryCode(
        form.values.category_name,
        form.values.company_id,
      )
      form.setFieldValue('category_code', newCode)
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

        const { data: parentCategoriesData, error: parentCategoriesError } =
          await getParentCategories()

        if (parentCategoriesError) {
          console.error(
            'Error fetching parent categories:',
            parentCategoriesError,
          )
        }

        const filteredParentCategories =
          mode === 'edit' && initialValues?.id
            ? (parentCategoriesData || []).filter(
                (cat) => cat.id !== initialValues.id,
              )
            : parentCategoriesData || []

        setParentCategories(filteredParentCategories)

        if (mode === 'edit' && initialValues) {
          const isSysCategory = initialValues.company_id === 1
          setIsSystemCategory(isSysCategory)

          form.setValues({
            company_id: String(initialValues.company_id ?? companyId),
            category_name: initialValues.category_name ?? '',
            category_code: initialValues.category_code ?? '',
            parent_category_id: initialValues.parent_category_id
              ? String(initialValues.parent_category_id)
              : '',
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
            parent_category_id: '',
            description: '',
            is_active: true,
            color_code: '',
            icon_name: '',
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

  useEffect(() => {
    if (
      mode === 'create' &&
      form.values.category_name &&
      form.values.company_id
    ) {
      handleGenerateCode()
    }
  }, [form.values.category_name, form.values.company_id, mode])

  const parentCategoryOptions = useMemo(() => {
    return [
      { value: '', label: 'None (Root Category)' },
      ...parentCategories.map((cat) => ({
        value: String(cat.id),
        label: `${cat.category_name}${cat.category_code ? ` (${cat.category_code})` : ''} ${cat.company_id === 1 ? '[System]' : '[Company]'}`,
      })),
    ]
  }, [parentCategories])

  // ── Loading / error states ───────────────────────────────────────────────
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

  // ── Read-only view for system categories ─────────────────────────────────
  if (isSystemCategory) {
    return (
      <Box
        style={{
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '12px',
          backgroundColor: themeColors.background,
        }}
      >
        <Alert
          icon={<IconWorldCheck size={16} />}
          title="System Category - Read Only"
          color="blue"
          mb="md"
          styles={{
            root: { backgroundColor: themeColors.backgroundAlt },
          }}
        >
          This is a system category and cannot be edited. System categories are
          shared across all companies and managed by administrators.
        </Alert>

        <Box
          style={{
            display: 'flex',
            flexDirection: 'row',
            gap: '20px',
            width: '100%',
          }}
        >
          <Box style={{ flex: 1 }}>
            <Paper
              p="20px"
              withBorder
              shadow="sm"
              style={{
                borderLeft: '4px solid #3b82f6',
                opacity: 0.8,
                backgroundColor: themeColors.background,
              }}
            >
              <Group
                justify="space-between"
                mb="md"
              >
                <Text
                  fw={600}
                  size="md"
                  c={themeColors.text}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <IconCategory size={20} />
                  Basic Information
                </Text>
                <Badge
                  variant="light"
                  color="blue"
                  leftSection={<IconWorldCheck size={14} />}
                  size="lg"
                >
                  System Category
                </Badge>
              </Group>

              <Stack gap="md">
                <TextInput
                  label="Category Name"
                  value={form.values.category_name}
                  disabled
                  leftSection={<IconCategory size={16} />}
                />
                <TextInput
                  label="Category Code"
                  value={form.values.category_code}
                  disabled
                  leftSection={<IconCode size={16} />}
                />
                <Select
                  label="Parent Category"
                  data={parentCategoryOptions}
                  value={form.values.parent_category_id}
                  disabled
                  leftSection={
                    form.values.parent_category_id ? (
                      <IconSubtask size={16} />
                    ) : (
                      <IconFolderOpen size={16} />
                    )
                  }
                />
              </Stack>
            </Paper>
          </Box>

          <Stack style={{ flex: 1 }}>
            <Paper
              p="20px"
              withBorder
              shadow="sm"
              style={{
                borderLeft: '4px solid #3b82f6',
                opacity: 0.8,
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
                <IconInfoCircle size={20} />
                Additional Details
              </Text>

              <Stack gap="md">
                <Textarea
                  label="Description"
                  value={form.values.description}
                  disabled
                  minRows={4}
                />
                <ColorInput
                  label="Color Code"
                  value={form.values.color_code}
                  disabled
                  leftSection={<IconPalette size={16} />}
                />
                <TextInput
                  label="Icon Name"
                  value={form.values.icon_name}
                  disabled
                />
              </Stack>
            </Paper>

            <Paper
              p="20px"
              withBorder
              shadow="sm"
              style={{
                borderLeft: '4px solid #3b82f6',
                opacity: 0.8,
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
                    Category Status
                  </Text>
                  <Text
                    size="xs"
                    c="dimmed"
                  >
                    {form.values.is_active ? 'Active' : 'Inactive'}
                  </Text>
                </div>
                <Switch
                  size="lg"
                  checked={form.values.is_active}
                  disabled
                  onLabel="Active"
                  offLabel="Inactive"
                  color={theme.primaryColor}
                />
              </Group>
            </Paper>
          </Stack>
        </Box>

        <Group
          justify="center"
          mt="xl"
        >
          <Button
            variant="light"
            color={theme.primaryColor}
            onClick={() => window.history.back()}
          >
            Close
          </Button>
        </Group>
      </Box>
    )
  }

  // ── Editable form ────────────────────────────────────────────────────────
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
            initialValues,
            dispatch,
            setLoading,
            currentUser,
          ),
        )}
        style={{ display: 'flex', flexDirection: 'column', width: '100%' }}
      >
        {mode === 'edit' && (
          <Alert
            icon={<IconBuildingStore size={16} />}
            title="Company Category"
            color="grape"
            mb="md"
            styles={{
              root: { backgroundColor: themeColors.backgroundAlt },
            }}
          >
            This is a company-specific category and can be edited.
          </Alert>
        )}

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
                <IconCategory
                  size={20}
                  color={primaryColor}
                />
                Basic Information
              </Text>

              <Stack gap="md">
                <TextInput
                  label="Category Name"
                  placeholder="e.g., Antibiotics, Analgesics"
                  {...form.getInputProps('category_name')}
                  required
                  leftSection={<IconCategory size={16} />}
                  description="Enter the category name (2–255 characters)"
                />

                <TextInput
                  label="Category Code"
                  placeholder="Auto-generated from company & category name"
                  {...form.getInputProps('category_code')}
                  required
                  leftSection={<IconCode size={16} />}
                  description={
                    mode === 'create'
                      ? 'Auto-generated code (COMPANY-CATEGORY-XXXX)'
                      : 'Unique code: COMPANY-CATEGORY-XXXX'
                  }
                  disabled
                  rightSection={
                    mode === 'create' ? (
                      <Tooltip label="Regenerate code">
                        <ActionIcon
                          variant="subtle"
                          color="blue"
                          onClick={handleGenerateCode}
                          loading={generatingCode}
                          disabled={
                            !form.values.category_name ||
                            !form.values.company_id
                          }
                        >
                          <IconRefresh size={16} />
                        </ActionIcon>
                      </Tooltip>
                    ) : null
                  }
                />

                <Select
                  label="Parent Category"
                  placeholder="Select a parent category"
                  data={parentCategoryOptions}
                  value={form.values.parent_category_id}
                  onChange={(value) =>
                    form.setFieldValue('parent_category_id', value || '')
                  }
                  searchable
                  clearable
                  leftSection={
                    form.values.parent_category_id ? (
                      <IconSubtask size={16} />
                    ) : (
                      <IconFolderOpen size={16} />
                    )
                  }
                  description="Leave empty for root category (max 10 levels)"
                />

                {!form.values.parent_category_id && (
                  <Alert
                    icon={<IconInfoCircle size={16} />}
                    color="blue"
                    variant="light"
                    styles={{
                      root: { backgroundColor: themeColors.backgroundAlt },
                    }}
                  >
                    This will be a <strong>root category</strong> (level 0). You
                    can create subcategories under it later.
                  </Alert>
                )}

                {form.values.parent_category_id && (
                  <Alert
                    icon={<IconSubtask size={16} />}
                    color="violet"
                    variant="light"
                    styles={{
                      root: { backgroundColor: themeColors.backgroundAlt },
                    }}
                  >
                    This will be a <strong>subcategory</strong>. The hierarchy
                    level and path will be automatically calculated.
                  </Alert>
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
                Additional Details
              </Text>

              <Stack gap="md">
                <Textarea
                  label="Description"
                  placeholder="Describe this category (optional)"
                  {...form.getInputProps('description')}
                  minRows={4}
                  maxRows={8}
                  description="Provide details about this category (max 1000 characters)"
                />

                <ColorInput
                  label="Color Code"
                  placeholder="#7c3aed"
                  {...form.getInputProps('color_code')}
                  leftSection={<IconPalette size={16} />}
                  description="Optional color for UI display (hex format)"
                  format="hex"
                />

                <TextInput
                  label="Icon Name"
                  placeholder="e.g., pill, syringe"
                  {...form.getInputProps('icon_name')}
                  description="Optional icon identifier (max 100 characters)"
                />
              </Stack>
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
                    Category Status
                  </Text>
                  <Text
                    size="xs"
                    c="dimmed"
                  >
                    {form.values.is_active
                      ? 'Category is active and visible'
                      : 'Category is inactive and hidden'}
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
          </Stack>
        </Box>

        <Alert
          icon={<IconInfoCircle size={16} />}
          color="blue"
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
            Database Features:
          </Text>
          <Text
            size="xs"
            c="dimmed"
          >
            • Hierarchical structure with up to 10 levels
            <br />
            • Automatic level and path calculation
            <br />
            • Soft delete support (deleted records are recoverable)
            <br />
            • Trigram search indexing for fast queries
            <br />• Unique constraint: category_code per company
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
            leftSection={<IconCategory size={18} />}
            color={theme.primaryColor}
          >
            {mode === 'edit' ? 'Update Category' : 'Create Category'}
          </Button>
        </Group>
      </form>
    </Box>
  )
}

export default CategoryForm

