// Enhanced Unit interface with compound units support
export interface Unit {
  id: number
  company_id: number
  name: string
  short_code: string
  type: 'base' | 'derived' | 'compound' // Updated to match DB schema
  base_unit_id: number | null
  conversion_factor: number // For compound/derived units
  is_active: boolean
  is_global: boolean // true = system unit (company_id=1), false = company-specific
  created_at: string
  updated_at: string
  deleted_at?: string | null
}

// Unit scope: 'system' = global/shared, 'company' = created by this company
export type UnitScope = 'system' | 'company'

export const getUnitScope = (unit: { is_global: boolean }): UnitScope =>
  unit.is_global ? 'system' : 'company'

// Extended unit with relationships
export interface UnitWithRelations extends Unit {
  base_unit?: {
    id: number
    name: string
    short_code: string
  } | null
  derived_units?: Array<{
    id: number
    name: string
    short_code: string
    conversion_factor: number
  }>
}

// Unit type metadata
export const UNIT_TYPES = {
  base: {
    label: 'Base Unit',
    description: 'Fundamental measurement unit (e.g., tablets, bottles)',
    color: 'blue',
    requiresBaseUnit: false,
    requiresConversion: false,
  },
  derived: {
    label: 'Derived Unit',
    description: 'Unit derived from a base unit (e.g., 1 strip = 10 tablets)',
    color: 'green',
    requiresBaseUnit: true,
    requiresConversion: true,
  },
  compound: {
    label: 'Compound Unit',
    description: 'Complex unit combining multiple measurements',
    color: 'orange',
    requiresBaseUnit: true,
    requiresConversion: true,
  },
} as const

// Unit usage context
export type UnitContext = 'purchase' | 'sale' | 'inventory' | 'general'

// Status represents activation state, not usage context
export interface UnitStatus {
  is_active: boolean
  last_used_at?: string | null
  product_count?: number
}

