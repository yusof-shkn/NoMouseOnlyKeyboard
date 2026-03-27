import { ProductCategory } from '@shared/types/medicines'

export interface CategoryFormProps {
  initialValues?: ProductCategory
  mode?: 'create' | 'edit'
}

export interface CategoryFormValues {
  company_id: string
  category_name: string
  category_code: string
  description: string
  is_active: boolean
  color_code: string
  icon_name: string
  sort_order?: number
}

export interface CategorySubmitData {
  company_id: number
  category_name: string
  category_code?: string | null
  description?: string | null
  is_active: boolean
  color_code?: string | null
  icon_name?: string | null
  sort_order?: number | null
}

export interface CategoryWithHierarchy extends ProductCategory {
  product_count?: number
}

