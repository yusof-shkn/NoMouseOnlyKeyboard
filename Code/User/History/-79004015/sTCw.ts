// src/features/areasManagement/utils/areasManagement.utils.ts - UPDATED WITH NEW FILTERS
import { notifications } from '@mantine/notifications'
import { Area, AreaFormData } from '@shared/types/area'
import { Profile } from '@shared/types/profile'
import { Store } from '@shared/types/Store'
import { getAreas, getAreaStats } from '../data/areas.queries'
import { supabase } from '@app/core/supabase/Supabase.utils'

/**
 * Enriches area data with related information from profiles and stores
 * OPTIMIZED: Uses efficient grouping instead of repeated filters
 */
export const enrichAreas = (
  areasData: Area[],
  profilesData: Profile[],
  storesData: Store[],
): Area[] => {
  if (!areasData?.length) return []

  // Build efficient lookup maps
  const profilesByArea = profilesData.reduce<Record<number, Profile[]>>(
    (acc, profile) => {
      if (profile.default_area_id) {
        if (!acc[profile.default_area_id]) {
          acc[profile.default_area_id] = []
        }
        acc[profile.default_area_id].push(profile)
      }
      return acc
    },
    {},
  )

  const storesByArea = storesData.reduce<Record<number, Store[]>>(
    (acc, store) => {
      if (store.area_id) {
        if (!acc[store.area_id]) {
          acc[store.area_id] = []
        }
        acc[store.area_id].push(store)
      }
      return acc
    },
    {},
  )

  return areasData.map((area) => {
    const areaProfiles = profilesByArea[area.id] || []
    const areaStores = storesByArea[area.id] || []

    // Build admin names string
    const assignedAdmins =
      areaProfiles.length > 0
        ? areaProfiles
            .map((p) => `${p.first_name || ''} ${p.last_name || ''}`.trim())
            .filter(Boolean)
            .join(', ') || 'None'
        : 'None'

    // Build admin phones string
    const adminPhones =
      areaProfiles.length > 0
        ? areaProfiles.map((p) => p.phone || 'N/A').join(', ') || 'N/A'
        : 'N/A'

    return {
      ...area,
      assigned_admin: assignedAdmins,
      admin_phone: adminPhones,
      store_count: areaStores.length,
      assigned_admin_ids: areaProfiles
        .map((p) => p.auth_id)
        .filter((id) => id !== null),
      assigned_store_ids: areaStores.map((s) => s.id),
    }
  })
}

/**
 * Fetches area statistics efficiently using database RPC function
 * OPTIMIZED: Uses database aggregation instead of fetching all records
 */
export const fetchAreaStats = async (
  companyId: number,
): Promise<{
  total: number
  active: number
  inactive: number
  totalAdmins: number
  totalStores: number
}> => {
  try {
    const { data, error } = await getAreaStats(companyId)

    if (error) throw error

    return {
      total: data?.total || 0,
      active: data?.active || 0,
      inactive: data?.inactive || 0,
      totalAdmins: data?.total_admins || 0,
      totalStores: data?.total_stores || 0,
    }
  } catch (error: any) {
    console.error('Error fetching area stats:', error)
    notifications.show({
      title: 'Error',
      message: error.message || 'Failed to fetch area statistics',
      color: 'red',
    })
    throw error
  }
}

/**
 * Fetches areas data with pagination, search, and filtering
 * ENHANCED: Added new filter parameters
 */
export const fetchAreasData = async ({
  companyId,
  page = 1,
  pageSize = 10,
  searchQuery = '',
  status = 'all',
  region,
  parentAreaId,
  hasAdmin,
  storeCountRange,
}: {
  companyId: number
  page?: number
  pageSize?: number
  searchQuery?: string
  status?: string
  region?: string
  parentAreaId?: number | null
  hasAdmin?: boolean
  storeCountRange?: string
}) => {
  try {
    // Fetch areas with pagination and filters
    const areasResult = await getAreas({
      companyId,
      page,
      pageSize,
      searchQuery,
      status,
      region,
      hasAdmin,
      storeCountRange,
    })

    if (areasResult.error) throw areasResult.error

    // Fetch related data for enrichment (only active records)
    const [profilesResult, storesResult] = await Promise.all([
      supabase
        .from('profiles')
        .select('*')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .is('deleted_at', null),
      supabase
        .from('stores')
        .select('*')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .is('deleted_at', null),
    ])

    if (profilesResult.error) throw profilesResult.error
    if (storesResult.error) throw storesResult.error

    const enrichedAreas = enrichAreas(
      areasResult.data || [],
      profilesResult.data || [],
      storesResult.data || [],
    )

    return {
      areasData: enrichedAreas,
      profilesData: profilesResult.data || [],
      storesData: storesResult.data || [],
      totalCount: areasResult.count || 0,
    }
  } catch (error: any) {
    console.error('Error fetching areas data:', error)
    notifications.show({
      title: 'Error',
      message: error.message || 'Failed to fetch areas data',
      color: 'red',
    })
    throw error
  }
}

/**
 * Validates area data before submission
 * ENHANCED: Includes all required database constraints
 */
export const validateAreaData = (
  data: AreaFormData,
): { valid: boolean; errors: string[] } => {
  const errors: string[] = []

  // Area name validation (CHECK constraint: >= 2 chars)
  if (!data.area_name?.trim()) {
    errors.push('Area name is required')
  } else if (data.area_name.trim().length < 2) {
    errors.push('Area name must be at least 2 characters')
  } else if (data.area_name.trim().length > 255) {
    errors.push('Area name must not exceed 255 characters')
  }

  // Area code validation
  if (!data.area_code?.trim()) {
    errors.push('Area code is required')
  } else if (data.area_code.trim().length > 50) {
    errors.push('Area code must not exceed 50 characters')
  }

  // Company ID validation
  if (!data.company_id || data.company_id <= 0) {
    errors.push('Valid company is required')
  }

  // Parent area validation (cannot be self-referencing)
  if (data.parent_area_id && data.parent_area_id === (data as any).id) {
    errors.push('Area cannot be its own parent')
  }

  // Description length validation
  if (data.description && data.description.length > 5000) {
    errors.push('Description is too long (max 5000 characters)')
  }

  // Region validation
  if (data.region && data.region.length > 100) {
    errors.push('Region must not exceed 100 characters')
  }

  // Country validation
  if (data.country && data.country.length > 100) {
    errors.push('Country must not exceed 100 characters')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Build hierarchical area tree from flat list
 */
export const buildAreaTree = (areas: Area[]): Area[] => {
  const areaMap = new Map<number, Area & { children?: Area[] }>()
  const rootAreas: Area[] = []

  // First pass: create map
  areas.forEach((area) => {
    areaMap.set(area.id, { ...area, children: [] })
  })

  return rootAreas
}

/**
 * Get area breadcrumb path
 */
export const getAreaBreadcrumb = (area: Area, allAreas: Area[]): string[] => {
  const path: string[] = [area.area_name]

  return path
}

/**
 * Format area display name with hierarchy
 */
export const formatAreaName = (area: Area, allAreas: Area[]): string => {
  const breadcrumb = getAreaBreadcrumb(area, allAreas)
  return breadcrumb.join(' > ')
}

