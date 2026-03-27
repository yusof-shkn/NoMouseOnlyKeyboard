// src/features/areasManagement/data/areas.queries.ts - UPDATED WITH NEW FILTERS
import { supabase } from '@app/core/supabase/Supabase.utils'
import { PostgrestError } from '@supabase/supabase-js'
import { Area, AreaFormData } from '@shared/types/area'

/**
 * Get active areas for dropdowns/selects
 */
export const getActiveAreas = async (
  companyId: number,
): Promise<{ data: Area[] | null; error: PostgrestError | null }> => {
  return await supabase
    .from('areas')
    .select('*')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('area_name', { ascending: true })
}

/**
 * Fetch paginated and filtered areas with enriched data
 * ENHANCED: Added new filter parameters
 */
export const getAreas = async ({
  companyId,
  page = 1,
  pageSize = 10,
  searchQuery = '',
  status = 'all',
  region,
  hasAdmin,
  storeCountRange,
}: {
  companyId?: number | null
  page?: number
  pageSize?: number
  searchQuery?: string
  status?: string
  region?: string
  hasAdmin?: boolean
  storeCountRange?: string
} = {}): Promise<{
  data: Area[] | null
  error: PostgrestError | null
  count: number | null
}> => {
  let query = supabase
    .from('areas')
    .select('*', { count: 'exact' })
    .is('deleted_at', null)

  // Only apply company_id filter if provided and valid
  if (companyId != null) {
    query = query.eq('company_id', companyId)
  }

  // Search across multiple fields
  if (searchQuery.trim()) {
    const term = searchQuery.trim()
    query = query.or(
      `area_name.ilike.%${term}%,area_code.ilike.%${term}%,description.ilike.%${term}%,region.ilike.%${term}%`,
    )
  }

  // Status filter
  if (status === 'active') {
    query = query.eq('is_active', true)
  } else if (status === 'inactive') {
    query = query.eq('is_active', false)
  }

  // Region filter
  if (region) {
    query = query.eq('region', region)
  }


  // Fetch initial data
  query = query
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1)

  const result = await query

  if (result.error) return result

  // Post-process for admin assignment filter
  if (hasAdmin !== undefined && companyId != null) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('default_area_id')
      .eq('company_id', companyId)
      .not('default_area_id', 'is', null)
      .is('deleted_at', null)

    const areasWithAdmins = new Set(
      profiles?.map((p) => p.default_area_id) || [],
    )

    result.data =
      result.data?.filter((area) =>
        hasAdmin ? areasWithAdmins.has(area.id) : !areasWithAdmins.has(area.id),
      ) || null
  }

  // Post-process for store count range filter
  if (storeCountRange && companyId != null) {
    const { data: stores } = await supabase
      .from('stores')
      .select('area_id')
      .eq('company_id', companyId)
      .not('area_id', 'is', null)
      .is('deleted_at', null)

    const storeCountByArea = (stores || []).reduce<Record<number, number>>(
      (acc, store) => {
        if (store.area_id) {
          acc[store.area_id] = (acc[store.area_id] || 0) + 1
        }
        return acc
      },
      {},
    )

    result.data =
      result.data?.filter((area) => {
        const count = storeCountByArea[area.id] || 0
        switch (storeCountRange) {
          case 'zero':
            return count === 0
          case '1-5':
            return count >= 1 && count <= 5
          case '6-10':
            return count >= 6 && count <= 10
          case '11+':
            return count >= 11
          default:
            return true
        }
      }) || null
  }

  return result
}

/**
 * Get area with full details including stores and admins
 */
export const getAreaWithDetails = async (
  areaId: number,
): Promise<{
  data: any | null
  error: PostgrestError | null
}> => {
  const { data, error } = await supabase
    .from('areas')
    .select(
      `
      *,
      stores:stores!area_id (
        id,
        store_name,
        store_code,
        store_type,
        is_active,
        phone,
        email
      ),
      admins:profiles!default_area_id (
        auth_id,
        first_name,
        last_name,
        phone,
        email,
        role:roles!role_id (
          role_name
        )
      )
    `,
    )
    .eq('id', areaId)
    .is('deleted_at', null)
    .single()

  return { data, error }
}

/**
 * Create a new area
 */
export const createArea = async (
  areaData: AreaFormData,
): Promise<{ data: { id: number } | null; error: PostgrestError | null }> => {
  const { assigned_admin_ids, assigned_store_ids, ...coreData } = areaData

  return await supabase.from('areas').insert([coreData]).select('id').single()
}

/**
 * Update an area
 */
export const updateArea = async (
  id: number,
  updates: Partial<AreaFormData>,
): Promise<{ error: PostgrestError | null }> => {
  const { assigned_admin_ids, assigned_store_ids, ...coreUpdates } = updates

  return await supabase
    .from('areas')
    .update({
      ...coreUpdates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
}

/**
 * Soft delete an area
 */
export const deleteArea = async (
  id: number,
): Promise<{ error: PostgrestError | null }> => {
  return await supabase
    .from('areas')
    .update({
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
}

/**
 * Unassign admins from an area
 */
export const unassignAreaAdmins = async (
  areaId: number,
  adminIdsToKeep: string[],
): Promise<{ error: PostgrestError | null }> => {
  if (adminIdsToKeep.length === 0) {
    return await supabase
      .from('profiles')
      .update({
        default_area_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq('default_area_id', areaId)
  }

  return await supabase
    .from('profiles')
    .update({
      default_area_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq('default_area_id', areaId)
    .not('auth_id', 'in', `(${adminIdsToKeep.join(',')})`)
}

/**
 * Assign admins to an area
 */
export const assignAreaAdmins = async (
  areaId: number,
  adminIds: string[],
): Promise<{ error: PostgrestError | null }> => {
  if (adminIds.length === 0) return { error: null }

  return await supabase
    .from('profiles')
    .update({
      default_area_id: areaId,
      updated_at: new Date().toISOString(),
    })
    .in('auth_id', adminIds)
}

/**
 * Unassign stores from an area
 */
export const unassignAreaStores = async (
  areaId: number,
  storeIdsToKeep: number[],
): Promise<{ error: PostgrestError | null }> => {
  if (storeIdsToKeep.length === 0) {
    return await supabase
      .from('stores')
      .update({
        area_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq('area_id', areaId)
  }

  return await supabase
    .from('stores')
    .update({
      area_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq('area_id', areaId)
    .not('id', 'in', `(${storeIdsToKeep.join(',')})`)
}

/**
 * Assign stores to an area
 */
export const assignAreaStores = async (
  areaId: number,
  storeIds: number[],
): Promise<{ error: PostgrestError | null }> => {
  if (storeIds.length === 0) return { error: null }

  return await supabase
    .from('stores')
    .update({
      area_id: areaId,
      updated_at: new Date().toISOString(),
    })
    .in('id', storeIds)
}

/**
 * Get area statistics efficiently using database RPC function
 */

/**
 * Get area statistics efficiently using database RPC function
 * Falls back to direct queries if RPC fails
 */
export const getAreaStats = async (
  companyId: number,
): Promise<{
  data: {
    total: number
    active: number
    inactive: number
    total_stores: number
    total_admins: number
  } | null
  error: any
}> => {
  try {
    // Try RPC function first
    const { data, error } = await supabase.rpc('get_area_stats', {
      p_company_id: companyId,
    })

    console.log('RPC Response:', { data, error, companyId })

    if (!error && data) {
      // The RPC returns a single row (not an array) with these columns:
      // total_count, active_count, inactive_count, store_count, admin_count

      // Handle both array and single object response
      const statsData = Array.isArray(data) ? data[0] : data

      if (statsData) {
        return {
          data: {
            total: Number(statsData.total_count || statsData.total) || 0,
            active: Number(statsData.active_count || statsData.active) || 0,
            inactive:
              Number(statsData.inactive_count || statsData.inactive) || 0,
            total_stores:
              Number(statsData.store_count || statsData.total_stores) || 0,
            total_admins:
              Number(statsData.admin_count || statsData.total_admins) || 0,
          },
          error: null,
        }
      }
    }

    // Fallback to direct queries if RPC fails
    console.log(
      'RPC failed, using fallback method for area stats. Error:',
      error,
    )

    // Get areas count
    const { data: areasData, error: areasError } = await supabase
      .from('areas')
      .select('id, is_active', { count: 'exact' })
      .eq('company_id', companyId)
      .is('deleted_at', null)

    if (areasError) throw areasError

    const total = areasData?.length || 0
    const active = areasData?.filter((a) => a.is_active).length || 0
    const inactive = total - active

    // Get stores count (with area_id assigned and active)
    const { count: storesCount, error: storesError } = await supabase
      .from('stores')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .not('area_id', 'is', null)
      .eq('is_active', true)
      .is('deleted_at', null)

    if (storesError) throw storesError

    // Get admins count (with area assigned and active)
    const { count: adminsCount, error: adminsError } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .not('default_area_id', 'is', null)
      .eq('is_active', true)
      .is('deleted_at', null)

    if (adminsError) throw adminsError

    console.log('Fallback stats:', {
      total,
      active,
      inactive,
      storesCount,
      adminsCount,
    })

    return {
      data: {
        total,
        active,
        inactive,
        total_stores: storesCount || 0,
        total_admins: adminsCount || 0,
      },
      error: null,
    }
  } catch (error) {
    console.error('Error fetching area stats:', error)
    return {
      data: {
        total: 0,
        active: 0,
        inactive: 0,
        total_stores: 0,
        total_admins: 0,
      },
      error,
    }
  }
}

/**
 * Get hierarchical area tree
 */
export const getAreaHierarchy = async (
  companyId: number,
): Promise<{
  data: Area[] | null
  error: PostgrestError | null
}> => {
  return await supabase
    .from('areas')
    .select('*')
    .eq('company_id', companyId)
    .is('deleted_at', null)
    .order('path', { ascending: true })
}

/**
 * Check if area code is unique within company
 */
export const checkAreaCodeUnique = async (
  companyId: number,
  areaCode: string,
  excludeId?: number,
): Promise<boolean> => {
  let query = supabase
    .from('areas')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .eq('area_code', areaCode)
    .is('deleted_at', null)

  if (excludeId) {
    query = query.neq('id', excludeId)
  }

  const { count } = await query
  return count === 0
}

