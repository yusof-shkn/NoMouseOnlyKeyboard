import { notifications } from '@mantine/notifications'
import { ProductCategory } from '@shared/types/medicines'
import {
  getProductCategories,
  getCategoryStats,
  checkCategoryProducts,
} from '../data/categories.queries'

export interface ExtendedProductCategory extends ProductCategory {
  product_count?: number
}

export interface FetchCategoriesParams {
  page?: number
  pageSize?: number
  searchQuery?: string
  status?: string
  hasProducts?: string
  categoryType?: string
}

export const fetchCategoriesData = async ({
  page = 1,
  pageSize = 10,
  searchQuery = '',
  status = 'all',
  hasProducts = 'all',
  categoryType = 'all',
}: FetchCategoriesParams): Promise<{
  categoriesData: ExtendedProductCategory[]
  totalCount: number
}> => {
  try {
    const categoriesResult = await getProductCategories({
      page,
      pageSize,
      searchQuery,
      status,
      hasProducts,
      categoryType,
    })

    if (categoriesResult.error) {
      throw new Error(
        categoriesResult.error.message || 'Failed to fetch categories',
      )
    }

    return {
      categoriesData: (categoriesResult.data ||
        []) as ExtendedProductCategory[],
      totalCount: categoriesResult.count || 0,
    }
  } catch (error: any) {
    notifications.show({
      title: 'Error',
      message: error.message || 'Failed to fetch categories data',
      color: 'red',
    })
    throw error
  }
}

export const fetchCategoryStats = async (): Promise<{
  total: number
  active: number
  withProducts: number
}> => {
  try {
    const { data, error } = await getCategoryStats()

    if (error) throw new Error('Failed to fetch category statistics')

    return data || { total: 0, active: 0, withProducts: 0 }
  } catch (error: any) {
    notifications.show({
      title: 'Error',
      message: error.message || 'Failed to fetch category statistics',
      color: 'red',
    })
    throw error
  }
}

export const validateCategoryData = (data: {
  category_name: string
  category_code?: string
  company_id: number
  description?: string
  color_code?: string
}): { valid: boolean; errors: string[] } => {
  const errors: string[] = []

  if (!data.category_name?.trim()) {
    errors.push('Category name is required')
  } else if (data.category_name.trim().length < 2) {
    errors.push('Category name must be at least 2 characters')
  } else if (data.category_name.trim().length > 255) {
    errors.push('Category name must not exceed 255 characters')
  }

  if (data.category_code && data.category_code.trim().length > 50) {
    errors.push('Category code must not exceed 50 characters')
  }

  if (!data.company_id || data.company_id <= 0) {
    errors.push('Valid company is required')
  }

  if (data.description && data.description.length > 1000) {
    errors.push('Description must not exceed 1000 characters')
  }

  if (data.color_code && !/^#[0-9A-F]{6}$/i.test(data.color_code)) {
    errors.push('Color code must be a valid hex color (e.g., #FF5733)')
  }

  return { valid: errors.length === 0, errors }
}

export const canDeleteCategory = async (
  categoryId: number,
  companyId: number,
): Promise<{ canDelete: boolean; productCount: number; message?: string }> => {
  try {
    if (companyId === 1) {
      return {
        canDelete: false,
        productCount: 0,
        message: 'System categories cannot be deleted.',
      }
    }

    const { data, error } = await checkCategoryProducts(categoryId)
    if (error) throw error

    const productCount = data?.count || 0
    return {
      canDelete: productCount === 0,
      productCount,
      message:
        productCount > 0
          ? `Cannot delete: ${productCount} product(s) are using this category. Please reassign products first.`
          : undefined,
    }
  } catch (error: any) {
    return {
      canDelete: false,
      productCount: 0,
      message: 'Error checking category usage',
    }
  }
}

export const canEditCategory = (companyId: number): boolean => companyId !== 1

export const getCategoryTypeLabel = (companyId: number): string =>
  companyId === 1 ? 'System' : 'Company'

export const formatCategoryForExport = (
  category: ExtendedProductCategory,
): Record<string, any> => ({
  Type: getCategoryTypeLabel(category.company_id),
  'Category Code': category.category_code || 'N/A',
  'Category Name': category.category_name,
  Description: category.description || 'N/A',
  'Product Count': category.product_count || 0,
  Status: category.is_active ? 'Active' : 'Inactive',
  'Created At': category.created_at
    ? new Date(category.created_at).toLocaleDateString()
    : 'N/A',
})

