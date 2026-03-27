import { supabase } from '@app/core/supabase/Supabase.utils'
import { PostgrestError } from '@supabase/supabase-js'
import { ProductCategory } from '@shared/types/medicines'

const ensureSessionReady = async (): Promise<boolean> => {
  try {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession()
    if (error) {
      console.error('Session check error:', error)
      return false
    }
    return !!session
  } catch (error) {
    console.error('Error ensuring session ready:', error)
    return false
  }
}

export interface GetProductCategoriesProps {
  page?: number
  pageSize?: number
  searchQuery?: string
  status?: string
  hasProducts?: string
  categoryType?: string
}

export interface GetProductCategoriesResponse {
  data: ProductCategory[] | null
  error: PostgrestError | null
  count: number | null
}

export const getProductCategories = async ({
  page = 1,
  pageSize = 10,
  searchQuery = '',
  status = 'all',
  hasProducts = 'all',
  categoryType = 'all',
}: GetProductCategoriesProps = {}): Promise<GetProductCategoriesResponse> => {
  const hasSession = await ensureSessionReady()
  if (!hasSession) {
    console.warn('⚠️ No session - cannot fetch categories')
    return { data: null, error: null, count: 0 }
  }

  let query = supabase
    .from('categories')
    .select('*', { count: 'exact' })
    .is('deleted_at', null)

  if (categoryType === 'system') {
    query = query.eq('company_id', 1)
  } else if (categoryType === 'company') {
    query = query.neq('company_id', 1)
  }

  if (searchQuery.trim()) {
    query = query.or(
      `category_name.ilike.%${searchQuery}%,category_code.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`,
    )
  }

  if (status === 'active') {
    query = query.eq('is_active', true)
  } else if (status === 'inactive') {
    query = query.eq('is_active', false)
  }

  query = query
    .order('category_name', { ascending: true })
    .range((page - 1) * pageSize, page * pageSize - 1)

  const result = await query

  if (result.error) {
    console.error('❌ Error fetching categories:', result.error)
    return { data: null, error: result.error, count: result.count }
  }

  // Fetch product counts separately
  const categoriesWithCount = await Promise.all(
    (result.data || []).map(async (category: any) => {
      const { count: productCount } = await supabase
        .from('products')
        .select('id', { count: 'exact', head: true })
        .eq('category_id', category.id)
        .is('deleted_at', null)

      return {
        ...category,
        product_count: productCount || 0,
      }
    }),
  )

  // Apply hasProducts filter AFTER getting counts
  let filteredData = categoriesWithCount

  if (hasProducts === 'with') {
    filteredData = categoriesWithCount.filter(
      (cat: any) => cat.product_count > 0,
    )
  } else if (hasProducts === 'without') {
    filteredData = categoriesWithCount.filter(
      (cat: any) => cat.product_count === 0,
    )
  } else if (hasProducts === '10plus') {
    filteredData = categoriesWithCount.filter(
      (cat: any) => cat.product_count >= 10,
    )
  } else if (hasProducts === '50plus') {
    filteredData = categoriesWithCount.filter(
      (cat: any) => cat.product_count >= 50,
    )
  }

  return {
    data: filteredData as ProductCategory[],
    error: null,
    count: result.count,
  }
}

export const getCategoryStats = async (): Promise<{
  data: {
    total: number
    active: number
    withProducts: number
  } | null
  error: any
}> => {
  try {
    const hasSession = await ensureSessionReady()
    if (!hasSession) {
      return { data: { total: 0, active: 0, withProducts: 0 }, error: null }
    }

    const [totalResult, activeResult] = await Promise.all([
      supabase
        .from('categories')
        .select('id', { count: 'exact', head: true })
        .is('deleted_at', null),
      supabase
        .from('categories')
        .select('id', { count: 'exact', head: true })
        .is('deleted_at', null)
        .eq('is_active', true),
    ])

    const { data: allCategories } = await supabase
      .from('categories')
      .select('id')
      .is('deleted_at', null)

    if (!allCategories) {
      return {
        data: {
          total: totalResult.count || 0,
          active: activeResult.count || 0,
          withProducts: 0,
        },
        error: null,
      }
    }

    const withProductsCounts = await Promise.all(
      allCategories.map(async (cat) => {
        const { count } = await supabase
          .from('products')
          .select('id', { count: 'exact', head: true })
          .eq('category_id', cat.id)
          .is('deleted_at', null)
        return count || 0
      }),
    )

    return {
      data: {
        total: totalResult.count || 0,
        active: activeResult.count || 0,
        withProducts: withProductsCounts.filter((c) => c > 0).length,
      },
      error: null,
    }
  } catch (error) {
    console.error('❌ Error fetching category stats:', error)
    return { data: null, error }
  }
}

export interface CategoryData {
  company_id?: number
  category_name?: string
  category_code?: string | null
  description?: string | null
  is_active?: boolean
  color_code?: string | null
  icon_name?: string | null
  sort_order?: number | null
}

export const createCategory = async (
  categoryData: CategoryData,
): Promise<{ data: { id: number } | null; error: PostgrestError | null }> => {
  const hasSession = await ensureSessionReady()
  if (!hasSession) {
    return {
      data: null,
      error: {
        message: 'No active session',
        details: '',
        hint: '',
        code: 'NO_SESSION',
      } as PostgrestError,
    }
  }

  const dataToInsert: CategoryData = {
    company_id: categoryData.company_id,
    category_name: categoryData.category_name,
    category_code: categoryData.category_code || null,
    description: categoryData.description || null,
    is_active: categoryData.is_active ?? true,
    color_code: categoryData.color_code || null,
    icon_name: categoryData.icon_name || null,
    sort_order: categoryData.sort_order || null,
  }

  return await supabase
    .from('categories')
    .insert([dataToInsert])
    .select('id')
    .single()
}

export const updateCategory = async (
  id: number,
  updates: CategoryData,
): Promise<{ error: PostgrestError | null }> => {
  const hasSession = await ensureSessionReady()
  if (!hasSession) {
    return {
      error: {
        message: 'No active session',
        details: '',
        hint: '',
        code: 'NO_SESSION',
      } as PostgrestError,
    }
  }

  const { data: category } = await supabase
    .from('categories')
    .select('company_id')
    .eq('id', id)
    .single()

  if (category && category.company_id === 1) {
    return {
      error: {
        message: 'System categories cannot be modified',
        details: 'Categories with company_id = 1 are system categories',
        hint: 'Only company-specific categories can be edited',
        code: 'SYSTEM_CATEGORY_UPDATE',
      } as PostgrestError,
    }
  }

  return await supabase
    .from('categories')
    .update(updates)
    .eq('id', id)
    .is('deleted_at', null)
}

export const deleteCategory = async (
  id: number,
): Promise<{ error: PostgrestError | null }> => {
  const hasSession = await ensureSessionReady()
  if (!hasSession) {
    return {
      error: {
        message: 'No active session',
        details: '',
        hint: '',
        code: 'NO_SESSION',
      } as PostgrestError,
    }
  }

  const { data: category } = await supabase
    .from('categories')
    .select('company_id')
    .eq('id', id)
    .single()

  if (category && category.company_id === 1) {
    return {
      error: {
        message: 'System categories cannot be deleted',
        details: 'Categories with company_id = 1 are system categories',
        hint: 'Only company-specific categories can be deleted',
        code: 'SYSTEM_CATEGORY_DELETE',
      } as PostgrestError,
    }
  }

  return await supabase
    .from('categories')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
}

export const checkCategoryProducts = async (
  categoryId: number,
): Promise<{ data: { count: number } | null; error: any }> => {
  try {
    const hasSession = await ensureSessionReady()
    if (!hasSession) return { data: { count: 0 }, error: null }

    const result = await supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('category_id', categoryId)
      .is('deleted_at', null)

    return { data: { count: result.count || 0 }, error: result.error }
  } catch (error) {
    return { data: null, error }
  }
}

export const getCategoryById = async (
  id: number,
): Promise<{ data: ProductCategory | null; error: PostgrestError | null }> => {
  const hasSession = await ensureSessionReady()
  if (!hasSession) return { data: null, error: null }

  const result = await supabase
    .from('categories')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (result.error) return { data: null, error: result.error }

  const { count: productCount } = await supabase
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('category_id', result.data.id)
    .is('deleted_at', null)

  return {
    data: {
      ...result.data,
      product_count: productCount || 0,
    } as ProductCategory,
    error: null,
  }
}

export const checkCategoryCodeUnique = async (
  categoryCode: string,
  companyId: number,
  excludeCategoryId?: number,
): Promise<{ isUnique: boolean; error: any }> => {
  try {
    const hasSession = await ensureSessionReady()
    if (!hasSession) return { isUnique: false, error: 'No active session' }

    let query = supabase
      .from('categories')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('category_code', categoryCode)
      .is('deleted_at', null)

    if (excludeCategoryId) {
      query = query.neq('id', excludeCategoryId)
    }

    const result = await query
    return { isUnique: (result.count || 0) === 0, error: result.error }
  } catch (error) {
    return { isUnique: false, error }
  }
}

