import { supabase } from '@app/core/supabase/Supabase.utils'
import { PostgrestError } from '@supabase/supabase-js'
import { Unit, UnitWithRelations } from '@shared/types/units'

/**
 * CRITICAL: Ensure session is ready before making API calls
 */
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

/**
 * Fetch paginated and filtered units with base unit relationships
 */
export interface GetUnitsProps {
  page?: number
  pageSize?: number
  searchQuery?: string
  status?: 'all' | 'active' | 'inactive'
  type?: 'base' | 'derived' | 'compound' | 'all'
  scope?: 'all' | 'system' | 'company'
  companyId?: number
}

export interface GetUnitsResponse {
  data: UnitWithRelations[] | null
  error: PostgrestError | null
  count: number | null
}

export const getUnits = async ({
  page = 1,
  pageSize = 10,
  searchQuery = '',
  status = 'all',
  type = 'all',
  scope = 'all',
  companyId,
}: GetUnitsProps = {}): Promise<GetUnitsResponse> => {
  const hasSession = await ensureSessionReady()
  if (!hasSession) {
    console.warn('⚠️ No session - cannot fetch units')
    return { data: null, error: null, count: 0 }
  }

  let query = supabase.from('units').select(
    `
      *,
      base_unit:base_unit_id (
        id,
        name,
        short_code
      )
    `,
    { count: 'exact' },
  )

  // RLS already handles visibility (global + own company).

  // Soft delete filter
  query = query.is('deleted_at', null)

  // Scope filter: system = global only, company = non-global only
  if (scope === 'system') {
    query = query.eq('is_global', true)
  } else if (scope === 'company') {
    query = query.eq('is_global', false)
  }

  // Search across multiple fields
  if (searchQuery.trim()) {
    query = query.or(
      `name.ilike.%${searchQuery}%,short_code.ilike.%${searchQuery}%`,
    )
  }

  // Active status filter
  if (status === 'active') {
    query = query.eq('is_active', true)
  } else if (status === 'inactive') {
    query = query.eq('is_active', false)
  }

  // Unit type filter
  if (type !== 'all') {
    query = query.eq('type', type)
  }

  // Order: global units first, then by name
  query = query
    .order('is_global', { ascending: false })
    .order('name', { ascending: true })
    .range((page - 1) * pageSize, page * pageSize - 1)

  const result = await query

  return {
    data: result.data,
    error: result.error,
    count: result.count,
  }
}

/**
 * Get comprehensive unit statistics
 */
export const getUnitStats = async (
  companyId?: number,
): Promise<{
  data: {
    total: number
    active: number
    base: number
    derived: number
    compound: number
    system: number
    company: number
  } | null
  error: any
}> => {
  try {
    const hasSession = await ensureSessionReady()
    if (!hasSession) {
      console.warn('⚠️ No session - cannot fetch unit stats')
      return {
        data: {
          total: 0,
          active: 0,
          base: 0,
          derived: 0,
          compound: 0,
          system: 0,
          company: 0,
        },
        error: null,
      }
    }

    // RLS handles visibility — no need for company_id filter on total/active/type stats
    const [
      totalResult,
      activeResult,
      baseResult,
      derivedResult,
      compoundResult,
      systemResult,
      companyResult,
    ] = await Promise.all([
      supabase
        .from('units')
        .select('id', { count: 'exact', head: true })
        .is('deleted_at', null),
      supabase
        .from('units')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true)
        .is('deleted_at', null),
      supabase
        .from('units')
        .select('id', { count: 'exact', head: true })
        .eq('type', 'base')
        .is('deleted_at', null),
      supabase
        .from('units')
        .select('id', { count: 'exact', head: true })
        .eq('type', 'derived')
        .is('deleted_at', null),
      supabase
        .from('units')
        .select('id', { count: 'exact', head: true })
        .eq('type', 'compound')
        .is('deleted_at', null),
      supabase
        .from('units')
        .select('id', { count: 'exact', head: true })
        .eq('is_global', true)
        .is('deleted_at', null),
      supabase
        .from('units')
        .select('id', { count: 'exact', head: true })
        .eq('is_global', false)
        .is('deleted_at', null),
    ])

    return {
      data: {
        total: totalResult.count || 0,
        active: activeResult.count || 0,
        base: baseResult.count || 0,
        derived: derivedResult.count || 0,
        compound: compoundResult.count || 0,
        system: systemResult.count || 0,
        company: companyResult.count || 0,
      },
      error: null,
    }
  } catch (error) {
    console.error('❌ Error fetching unit stats:', error)
    return { data: null, error }
  }
}

/**
 * Create a new unit with validation
 */
export const createUnit = async (
  unitData: Partial<Unit>,
): Promise<{ data: Unit | null; error: PostgrestError | null }> => {
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

  // Validate conversion factor for derived/compound units
  if (
    (unitData.type === 'derived' || unitData.type === 'compound') &&
    !unitData.base_unit_id
  ) {
    return {
      data: null,
      error: {
        message: 'Derived and compound units must have a base unit',
        details: '',
        hint: '',
        code: 'VALIDATION_ERROR',
      } as PostgrestError,
    }
  }

  return await supabase.from('units').insert([unitData]).select('*').single()
}

/**
 * Update a unit
 */
export const updateUnit = async (
  id: number,
  updates: Partial<Unit>,
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

  return await supabase
    .from('units')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
}

/**
 * Soft delete a unit
 */
export const deleteUnit = async (
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

  return await supabase
    .from('units')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
}

/**
 * Check unit usage across products
 */
export const checkUnitUsage = async (
  unitId: number,
): Promise<{ data: { count: number } | null; error: any }> => {
  try {
    const hasSession = await ensureSessionReady()
    if (!hasSession) {
      return { data: { count: 0 }, error: null }
    }

    const result = await supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('unit_id', unitId)
      .is('deleted_at', null)

    return {
      data: { count: result.count || 0 },
      error: result.error,
    }
  } catch (error) {
    return { data: null, error }
  }
}

/**
 * Get all base units for dropdown (used when creating derived/compound units)
 */
// units.queries.ts - Returns all accessible base units (global + own company) via RLS
export const getBaseUnits = async (
  companyId?: number,
): Promise<{
  data: Pick<Unit, 'id' | 'name' | 'short_code' | 'is_global'>[] | null
  error: PostgrestError | null
}> => {
  const hasSession = await ensureSessionReady()
  if (!hasSession) {
    return { data: [], error: null }
  }

  // RLS ensures only accessible units are returned (global + own company)
  return await supabase
    .from('units')
    .select('id, name, short_code, is_global')
    .eq('type', 'base') // ✅ CRITICAL: Only base units
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('is_global', { ascending: false }) // global units first
    .order('name', { ascending: true })
}
/**
 * Get unit with all derived units
 */
export const getUnitWithDerived = async (
  unitId: number,
): Promise<{
  data: UnitWithRelations | null
  error: PostgrestError | null
}> => {
  const hasSession = await ensureSessionReady()
  if (!hasSession) {
    return { data: null, error: null }
  }

  const { data, error } = await supabase
    .from('units')
    .select(
      `
      *,
      base_unit:base_unit_id (
        id,
        name,
        short_code
      ),
      derived_units:units!base_unit_id (
        id,
        name,
        short_code,
        conversion_factor
      )
    `,
    )
    .eq('id', unitId)
    .single()

  return { data, error }
}

/**
 * Convert quantity between units
 */
export const convertQuantity = async (
  fromUnitId: number,
  toUnitId: number,
  quantity: number,
): Promise<{ convertedQuantity: number | null; error: any }> => {
  try {
    const hasSession = await ensureSessionReady()
    if (!hasSession) {
      return { convertedQuantity: null, error: 'No active session' }
    }

    const [fromUnit, toUnit] = await Promise.all([
      supabase.from('units').select('*').eq('id', fromUnitId).single(),
      supabase.from('units').select('*').eq('id', toUnitId).single(),
    ])

    if (fromUnit.error || toUnit.error) {
      throw new Error('Units not found')
    }

    // If same unit, no conversion needed
    if (fromUnitId === toUnitId) {
      return { convertedQuantity: quantity, error: null }
    }

    // Both must share the same base unit for conversion
    const fromBase = fromUnit.data.base_unit_id || fromUnitId
    const toBase = toUnit.data.base_unit_id || toUnitId

    if (fromBase !== toBase) {
      throw new Error('Units cannot be converted (different base units)')
    }

    // Convert to base unit, then to target unit
    const fromFactor = fromUnit.data.conversion_factor || 1
    const toFactor = toUnit.data.conversion_factor || 1

    const baseQuantity = quantity * fromFactor
    const convertedQuantity = baseQuantity / toFactor

    return { convertedQuantity, error: null }
  } catch (error: any) {
    return { convertedQuantity: null, error: error.message }
  }
}

