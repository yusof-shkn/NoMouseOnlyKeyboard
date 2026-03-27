import { notifications } from '@mantine/notifications'
import { Unit, UnitWithRelations, UNIT_TYPES } from '@shared/types/units'
import { getUnits, getUnitStats } from '../data/units.queries'
import { supabase } from '@app/core/supabase/Supabase.utils'

/**
 * Fetches unit statistics efficiently using database aggregation
 */
export const fetchUnitStats = async (
  companyId: number,
): Promise<{
  total: number
  active: number
  base: number
  derived: number
  compound: number
  system: number
  company: number
}> => {
  try {
    const { data, error } = await getUnitStats(companyId)

    if (error) throw error

    return (
      data || {
        total: 0,
        active: 0,
        base: 0,
        derived: 0,
        compound: 0,
        system: 0,
        company: 0,
      }
    )
  } catch (error: any) {
    console.error('Error fetching unit stats:', error)
    notifications.show({
      title: 'Error',
      message: error.message || 'Failed to fetch unit statistics',
      color: 'red',
    })
    throw error
  }
}

/**
 * Fetches units data with pagination, search, and filtering
 */
export const fetchUnitsData = async ({
  page = 1,
  pageSize = 10,
  searchQuery = '',
  status = 'all',
  type = 'all',
  scope = 'all',
  companyId,
}: {
  page?: number
  pageSize?: number
  searchQuery?: string
  status?: 'all' | 'active' | 'inactive'
  type?: 'base' | 'derived' | 'compound' | 'all'
  scope?: 'all' | 'system' | 'company'
  companyId: number
}) => {
  try {
    const unitsResult = await getUnits({
      page,
      pageSize,
      searchQuery,
      status,
      type,
      scope,
    })

    if (unitsResult.error) throw unitsResult.error

    return {
      unitsData: unitsResult.data || [],
      totalCount: unitsResult.count || 0,
    }
  } catch (error: any) {
    console.error('Error fetching units data:', error)
    notifications.show({
      title: 'Error',
      message: error.message || 'Failed to fetch units data',
      color: 'red',
    })
    throw error
  }
}

/**
 * Enhanced validation for unit data including compound units
 */
export const validateUnitData = (data: {
  name: string
  short_code?: string
  type: 'base' | 'derived' | 'compound'
  company_id: number
  base_unit_id?: number | null
  conversion_factor?: number
}): { valid: boolean; errors: string[] } => {
  const errors: string[] = []

  // Name validation
  if (!data.name?.trim()) {
    errors.push('Unit name is required')
  } else if (data.name.trim().length < 1) {
    errors.push('Unit name must be at least 1 character')
  } else if (data.name.trim().length > 100) {
    errors.push('Unit name must not exceed 100 characters')
  }

  // Code validation
  if (!data.short_code?.trim()) {
    errors.push('Unit code is required')
  } else if (data.short_code.trim().length > 20) {
    errors.push('Unit code must not exceed 20 characters')
  }

  // Type validation
  if (!data.type) {
    errors.push('Unit type is required')
  } else if (!['base', 'derived', 'compound'].includes(data.type)) {
    errors.push('Invalid unit type. Must be base, derived, or compound')
  }

  // Base unit and conversion validation for derived/compound units
  const typeConfig = UNIT_TYPES[data.type]
  if (typeConfig?.requiresBaseUnit) {
    if (!data.base_unit_id) {
      errors.push(`${typeConfig.label} requires a base unit`)
    }

    if (typeConfig.requiresConversion) {
      if (!data.conversion_factor || data.conversion_factor <= 0) {
        errors.push('Conversion factor must be greater than 0')
      }
    }
  }

  // Prevent self-referencing
  if (data.base_unit_id && data.base_unit_id === (data as any).id) {
    errors.push('A unit cannot be its own base unit')
  }

  // Company validation
  if (!data.company_id || data.company_id <= 0) {
    errors.push('Valid company is required')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Format unit data for display with conversion info
 */
export const formatUnitForDisplay = (
  unit: UnitWithRelations,
): UnitWithRelations => {
  return {
    ...unit,
    short_code: unit.short_code || 'N/A',
  }
}

/**
 * Format conversion relationship for display
 */
export const formatConversionDisplay = (unit: UnitWithRelations): string => {
  if (
    !unit.base_unit ||
    !unit.conversion_factor ||
    unit.conversion_factor === 1
  ) {
    return ''
  }

  return `1 ${unit.short_code} = ${unit.conversion_factor} ${unit.base_unit.short_code}`
}

/**
 * Check if a unit can be deleted
 */
/**
 * Check if a unit can be deleted
 */
export const canDeleteUnit = async (
  unitId: number,
): Promise<{
  canDelete: boolean
  usageCount: number
  derivedCount: number
  message?: string
}> => {
  try {
    // Destructure count separately from the response
    const { count: productsCount, error: productsError } = await supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('unit_id', unitId)
      .is('deleted_at', null)

    const { count: derivedCount, error: derivedError } = await supabase
      .from('units')
      .select('id', { count: 'exact', head: true })
      .eq('base_unit_id', unitId)
      .is('deleted_at', null)

    if (productsError || derivedError) {
      throw new Error('Error checking unit usage')
    }

    const usageCount = productsCount || 0
    const derivedCountValue = derivedCount || 0
    const totalBlockers = usageCount + derivedCountValue

    let message: string | undefined
    if (totalBlockers > 0) {
      const parts: string[] = []
      if (usageCount > 0) {
        parts.push(`${usageCount} product(s)`)
      }
      if (derivedCountValue > 0) {
        parts.push(`${derivedCountValue} derived unit(s)`)
      }
      message = `Cannot delete: ${parts.join(' and ')} depend on this unit`
    }

    return {
      canDelete: totalBlockers === 0,
      usageCount,
      derivedCount: derivedCountValue,
      message,
    }
  } catch (error: any) {
    console.error('Error checking unit usage:', error)
    return {
      canDelete: false,
      usageCount: 0,
      derivedCount: 0,
      message: 'Error checking unit usage',
    }
  }
}
/**
 * Calculate effective quantity in base units
 */
export const calculateBaseQuantity = (quantity: number, unit: Unit): number => {
  const conversionFactor = unit.conversion_factor || 1
  return quantity * conversionFactor
}

/**
 * Get unit hierarchy path (for display)
 */
export const getUnitHierarchy = (unit: UnitWithRelations): string[] => {
  const path: string[] = [unit.name]

  if (unit.base_unit) {
    path.unshift(unit.base_unit.name)
  }

  return path
}

/**
 * Validate conversion factor for derived/compound units
 */
export const validateConversionFactor = (
  factor: number | undefined,
  unitType: string,
): { valid: boolean; message?: string } => {
  if (unitType === 'base') {
    return { valid: true }
  }

  if (!factor || factor <= 0) {
    return {
      valid: false,
      message:
        'Conversion factor must be greater than 0 for derived/compound units',
    }
  }

  if (factor > 1000000) {
    return {
      valid: false,
      message: 'Conversion factor seems unreasonably large',
    }
  }

  return { valid: true }
}

