// src/shared/types/area.ts
import { StaffDetail } from './Store'

export interface Area {
  id: number
  company_id: number
  area_name: string
  area_code: string
  description: string | null
  is_active: boolean
  region: string | null
  country: string
  created_at: string
  updated_at: string
  deleted_at: string | null

  // Computed/enriched fields (from joins or aggregations)
  assigned_admin: string
  admin_phone: string
  store_count: number
  assigned_admin_ids: string[] // Fixed: auth_id is UUID (string)
  assigned_store_ids: number[]
  staff_details?: StaffDetail[]
}

// For API responses
export interface AreaWithDetails extends Area {
  stores?: {
    id: number
    store_name: string
    store_code: string
    is_active: boolean
  }[]
  admins?: {
    auth_id: string
    first_name: string
    last_name: string
    phone: string | null
    email: string
  }[]
}

// For form submissions
export interface AreaFormData {
  company_id: number
  area_name: string
  area_code: string
  description?: string
  parent_area_id?: number | null
  is_active: boolean
  region?: string
  country?: string
  assigned_admin_ids?: string[]
  assigned_store_ids?: number[]
}

