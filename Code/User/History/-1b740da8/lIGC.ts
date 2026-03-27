// purchaseOrderItemsQueries.ts - UPDATED WITH AREA/STORE FILTERING

import { supabase } from '@app/core/supabase/Supabase.utils'

/**
 * ✅ UPDATED: Get purchase order items statistics from database view
 * ✅ Apply area/store filtering
 */
export const getPurchaseOrderItemsStats = async (
  companyId: number,
  storeId?: number, // ⚠️ This can override Redux selection if provided
) => {
  try {
    console.log(
      '📊 Fetching purchase order items stats from view for company:',
      companyId,
    )

    let query = supabase
      .from('vw_purchase_order_items_stats')
      .select('*')
      .eq('company_id', companyId)

    // storeId param kept for explicit override; navbar scope handled by RLS
    if (storeId) query = query.eq('store_id', storeId)

    const { data, error } = await query

    if (error) {
      console.error('❌ Error fetching stats from view:', error)
      throw error
    }

    // If no data (no items yet) or area filtering returns multiple rows, aggregate
    if (!data || data.length === 0) {
      console.log('📊 No stats found, returning zeros')
      return {
        stats: {
          total: 0,
          totalQuantityOrdered: 0,
          totalQuantityReceived: 0,
          totalAmount: 0,
          averageUnitCost: 0,
          expiredCount: 0,
          criticalExpiryCount: 0,
          warningExpiryCount: 0,
        },
        error: null,
      }
    }

    // Aggregate multiple rows (in case of area filtering)
    const aggregatedStats = data.reduce(
      (acc, row) => {
        const total = acc.total + (row.total || 0)
        const totalQuantityOrdered =
          acc.totalQuantityOrdered + (row.total_quantity_ordered || 0)
        const totalQuantityReceived =
          acc.totalQuantityReceived + (row.total_quantity_received || 0)
        const totalAmount = acc.totalAmount + parseFloat(row.total_amount || 0)

        return {
          total,
          totalQuantityOrdered,
          totalQuantityReceived,
          totalAmount,
          averageUnitCost: total > 0 ? totalAmount / totalQuantityOrdered : 0,
          expiredCount: acc.expiredCount + (row.expired_count || 0),
          criticalExpiryCount:
            acc.criticalExpiryCount + (row.critical_expiry_count || 0),
          warningExpiryCount:
            acc.warningExpiryCount + (row.warning_expiry_count || 0),
        }
      },
      {
        total: 0,
        totalQuantityOrdered: 0,
        totalQuantityReceived: 0,
        totalAmount: 0,
        averageUnitCost: 0,
        expiredCount: 0,
        criticalExpiryCount: 0,
        warningExpiryCount: 0,
      },
    )

    console.log(
      '✅ Successfully fetched purchase order items stats:',
      aggregatedStats,
    )

    return { stats: aggregatedStats, error: null }
  } catch (error: any) {
    console.error('❌ Error in getPurchaseOrderItemsStats:', error)
    return {
      stats: {
        total: 0,
        totalQuantityOrdered: 0,
        totalQuantityReceived: 0,
        totalAmount: 0,
        averageUnitCost: 0,
        expiredCount: 0,
        criticalExpiryCount: 0,
        warningExpiryCount: 0,
      },
      error,
    }
  }
}

/**
 * Get purchase order items using the view (PAGINATED)
 * ✅ UPDATED: Apply area/store filtering
 */
export const getPurchaseOrderItemsHistory = async ({
  page = 1,
  pageSize = 10,
  searchQuery = '',
  purchaseOrderId = null,
  dateFilter = 'all',
  expiryFilter = 'all',
  companyId = null,
  storeId = null, // ⚠️ This can override Redux selection if provided
  warningDays = 30,
  criticalDays = 7,
}) => {
  try {
    console.log('🔍 Fetching purchase order items with params:', {
      page,
      pageSize,
      searchQuery,
      purchaseOrderId,
      dateFilter,
      expiryFilter,
      companyId,
      storeId,
    })

    let query = supabase
      .from('vw_purchase_order_items_history')
      .select('*', { count: 'exact' })

    if (companyId) {
      query = query.eq('company_id', companyId)
    }

    // storeId param kept for explicit override; navbar scope handled by RLS
    if (storeId) query = query.eq('store_id', storeId)

    if (purchaseOrderId) {
      query = query.eq('purchase_order_id', purchaseOrderId)
    }

    // Apply date filter
    if (dateFilter !== 'all') {
      const now = new Date()
      let startDate: Date

      switch (dateFilter) {
        case 'last_7_days':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          break
        case 'last_30_days':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
          break
        case 'last_3_months':
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
          break
        case 'last_6_months':
          startDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000)
          break
        case 'this_year':
          startDate = new Date(now.getFullYear(), 0, 1)
          break
        default:
          startDate = new Date(0)
      }

      query = query.gte('created_at', startDate.toISOString())
    }

    // Apply expiry filter
    if (expiryFilter !== 'all') {
      switch (expiryFilter) {
        case 'expired':
          query = query.lt('days_until_expiry', 0)
          break
        case 'critical':
          query = query
            .gte('days_until_expiry', 0)
            .lte('days_until_expiry', criticalDays)
          break
        case 'warning':
          query = query
            .gt('days_until_expiry', criticalDays)
            .lte('days_until_expiry', warningDays)
          break
      }
    }

    // Apply search filter
    if (searchQuery) {
      query = query.or(
        `batch_number.ilike.%${searchQuery}%,product_name.ilike.%${searchQuery}%,po_number.ilike.%${searchQuery}%`,
      )
    }

    // Apply pagination
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    query = query.range(from, to).order('created_at', { ascending: false })

    const { data, error, count } = await query

    if (error) {
      console.error('❌ Error fetching purchase order items:', error)
      throw error
    }

    console.log('✅ Successfully fetched purchase order items:', {
      count: data?.length || 0,
      totalCount: count || 0,
    })

    if (data && data.length > 0) {
      console.log('📦 Sample item:', data[0])
    } else {
      console.warn('⚠️ No items returned from query')
    }

    return { data: data || [], error: null, count: count || 0 }
  } catch (error: any) {
    console.error('❌ Error in getPurchaseOrderItemsHistory:', error)
    return { data: [], error, count: 0 }
  }
}

/**
 * Get products from the products table
 */
export const getProducts = async () => {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('id, product_name, unit_id, units!inner(name, short_code)')
      .is('deleted_at', null)
      .order('product_name', { ascending: true })

    if (error) throw error

    return { data, error: null }
  } catch (error: any) {
    console.error('Error fetching products:', error)
    return { data: null, error }
  }
}

/**
 * Delete a purchase order item
 */
export const deletePurchaseOrderItem = async (id: number) => {
  try {
    console.log('🗑️ Deleting purchase order item:', id)

    const { data: item, error: checkError } = await supabase
      .from('purchase_order_items')
      .select(
        `
        id, 
        purchase_order_id,
        purchase_orders!inner(status)
      `,
      )
      .eq('id', id)
      .single()

    if (checkError) {
      console.error('❌ Error checking item:', checkError)
      throw checkError
    }

    if (!item) {
      throw new Error('Purchase order item not found')
    }

    const purchaseOrder = item.purchase_orders as any
    const poStatus = purchaseOrder?.status

    console.log('📋 Purchase order status:', poStatus)

    if (poStatus && ['received', 'cancelled'].includes(poStatus)) {
      throw new Error(`Cannot delete items from ${poStatus} purchase orders`)
    }

    const { data, error } = await supabase
      .from('purchase_order_items')
      .delete()
      .eq('id', id)
      .select()

    if (error) {
      console.error('❌ Error deleting item:', error)
      throw error
    }

    console.log('✅ Purchase order item deleted successfully')

    return { data, error: null }
  } catch (error: any) {
    console.error('❌ Error deleting purchase order item:', error)
    return { data: null, error }
  }
}

/**
 * Get current user's role with permissions
 */
export const getCurrentUserRole = async () => {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return null

    const { data, error } = await supabase
      .from('profiles')
      .select(
        `
        role_id,
        roles!inner(
          id,
          role_name,
          is_system,
          priority,
          role_permissions(
            permissions(
              permission_name,
              module,
              resource,
              action
            )
          )
        )
      `,
      )
      .eq('auth_id', user.id)
      .is('deleted_at', null)
      .single()

    if (error) {
      console.error('Error fetching user role:', error)
      return null
    }

    const roleObj = Array.isArray(data.roles) ? data.roles[0] : data.roles

    return { ...data, roles: roleObj }
  } catch (error) {
    console.error('Error in getCurrentUserRole:', error)
    return null
  }
}

/**
 * Check if user has specific permission
 */
export const hasPermission = async (
  permissionName: string,
): Promise<boolean> => {
  try {
    const roleData = await getCurrentUserRole()
    if (!roleData?.roles) return false

    const rolePermissions = roleData.roles.role_permissions || []

    const permissions = rolePermissions
      .map((rp: any) => rp.permissions?.permission_name)
      .filter(Boolean)

    return permissions.includes(permissionName)
  } catch (error) {
    console.error('Error checking permission:', error)
    return false
  }
}

/**
 * Get current user's company ID
 */
export const getCurrentUserCompanyId = async (): Promise<number | null> => {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return null

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('auth_id', user.id)
      .single()

    if (error || !profile) {
      console.error('Error fetching user company:', error)
      return null
    }

    return profile.company_id
  } catch (error) {
    console.error('Error in getCurrentUserCompanyId:', error)
    return null
  }
}

