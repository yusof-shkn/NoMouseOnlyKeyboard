import {
  getProductCategories,
  checkCategoryCodeUnique,
} from '../data/categories.queries'

export const validateCategoryData = (
  data: any,
): { valid: boolean; errors: string[] } => {
  const errors: string[] = []

  if (!data.company_id || isNaN(data.company_id)) {
    errors.push('Valid company ID is required')
  }

  if (!data.category_name || data.category_name.trim().length < 2) {
    errors.push('Category name must be at least 2 characters')
  }

  if (data.category_name && data.category_name.length > 255) {
    errors.push('Category name must not exceed 255 characters')
  }

  if (data.category_code && data.category_code.length > 50) {
    errors.push('Category code must not exceed 50 characters')
  }

  if (data.description && data.description.length > 1000) {
    errors.push('Description must not exceed 1000 characters')
  }

  return { valid: errors.length === 0, errors }
}

export const fetchCategoriesData = async ({
  page = 1,
  pageSize = 10,
  searchQuery = '',
  status = 'all',
}: {
  page?: number
  pageSize?: number
  searchQuery?: string
  status?: string
}) => {
  try {
    const { data, error, count } = await getProductCategories({
      page,
      pageSize,
      searchQuery,
      status,
    })
    if (error) throw new Error(error.message || 'Failed to fetch categories')
    return { categoriesData: data || [], totalCount: count || 0 }
  } catch (error: any) {
    console.error('Error fetching categories:', error)
    throw error
  }
}

export const checkCategoryCodeUniqueAsync = async (
  categoryCode: string,
  companyId: number,
  excludeCategoryId?: number,
): Promise<boolean> => {
  try {
    if (!categoryCode?.trim()) return true
    const { isUnique, error } = await checkCategoryCodeUnique(
      categoryCode.trim(),
      companyId,
      excludeCategoryId,
    )
    if (error) return false
    return isUnique
  } catch {
    return false
  }
}

export const formatCategoryForSubmit = (values: any) => ({
  company_id: parseInt(values.company_id),
  category_name: values.category_name.trim(),
  category_code: values.category_code?.trim() || null,
  description: values.description?.trim() || null,
  is_active: values.is_active ?? true,
})

