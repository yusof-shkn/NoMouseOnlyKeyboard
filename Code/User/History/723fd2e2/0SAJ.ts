// handlers/stockListHandlers.ts - UPDATED TO USE DATABASE VIEWS
import { notifications } from '@mantine/notifications'
import { AppDispatch } from '@app/core/store/store'
import {
  enrichStockList,
  fetchStockListData,
  calculateStats,
  canEditStock,
} from '../utils/stockList.utils'
import { StockListItem, StockListStats } from '../types/stockList.types'
import { CompanySettings } from '@shared/types/companySettings'
import { exportToPDF } from '@app/core/exports/PdfExporter'
import { exportToExcel } from '@app/core/exports/CsvExporter'
import {
  deleteStockBatch,
  validateStockOperation,
  fetchLowStock,
  fetchExpiringStock,
  fetchFastMovingStock,
  getInventoryStatistics,
} from '../data/stockList.queries'
import { Role } from '@shared/constants/roles'
import { getCurrentUserRoleId } from '@shared/utils/authUtils'

export const handleExportPDF = (columns: any[], data: StockListItem[]) => {
  try {
    if (!data || data.length === 0) {
      notifications.show({
        title: 'No Data Available',
        message: 'There is no data to export to PDF',
        color: 'yellow',
      })
      return
    }

    exportToPDF({
      columns,
      data,
      fileName: 'stock_list',
      title: 'Stock List Report',
      orientation: 'landscape',
      includeDate: true,
    })

    notifications.show({
      title: 'Export Successful',
      message: 'PDF has been exported successfully',
      color: 'green',
    })
  } catch (error) {
    console.error('Failed to export PDF:', error)
    notifications.show({
      title: 'Export Failed',
      message: 'Failed to export PDF. Please try again.',
      color: 'red',
    })
  }
}

export const handleExportExcel = (columns: any[], data: StockListItem[]) => {
  try {
    if (!data || data.length === 0) {
      notifications.show({
        title: 'No Data Available',
        message: 'There is no data to export to Excel',
        color: 'yellow',
      })
      return
    }

    exportToExcel({
      columns,
      data,
      fileName: 'stock_list',
      sheetName: 'Stock List',
      title: 'Stock List Report',
      includeMetadata: true,
    })

    notifications.show({
      title: 'Export Successful',
      message: 'Excel file has been exported successfully',
      color: 'green',
    })
  } catch (error) {
    console.error('Failed to export Excel:', error)
    notifications.show({
      title: 'Export Failed',
      message: 'Failed to export Excel. Please try again.',
      color: 'red',
    })
  }
}

export const handleRefresh = async (
  setStockList: React.Dispatch<React.SetStateAction<StockListItem[]>>,
  setStores: React.Dispatch<React.SetStateAction<any[]>>,
  setCategories: React.Dispatch<React.SetStateAction<any[]>>,
  setStats: React.Dispatch<React.SetStateAction<StockListStats>>,
  setLoading: React.Dispatch<React.SetStateAction<boolean>>,
  setTotalCount: React.Dispatch<React.SetStateAction<number>>,
  companySettings: CompanySettings | null,
  companyId?: number,
) => {
  try {
    setLoading(true)
    const { stockListData, storesData, categoriesData, totalCount } =
      await fetchStockListData({ companyId }, companySettings)

    setStockList(stockListData)
    setStores(storesData)
    setCategories(categoriesData)
    setStats(calculateStats(stockListData, companySettings))
    setTotalCount(totalCount)

    notifications.show({
      title: 'Refreshed',
      message: 'Stock list updated successfully',
      color: 'blue',
    })
  } catch (error: any) {
    console.error('Error refreshing stock list:', error)
    notifications.show({
      title: 'Refresh Failed',
      message: error.message || 'Failed to refresh stock list',
      color: 'red',
    })
  } finally {
    setLoading(false)
  }
}

export const handleView = (row: any, dispatch: AppDispatch) => {
  console.log('View stock item:', row)
  notifications.show({
    title: 'View Details',
    message: `Viewing: ${row.product_name}`,
    color: 'blue',
  })
}

export const handleEdit = (
  row: any,
  dispatch: AppDispatch,
  companySettings: CompanySettings | null,
) => {
  const editCheck = canEditStock(row, companySettings)

  if (!editCheck.allowed) {
    notifications.show({
      title: 'Edit Restricted',
      message: editCheck.reason || 'Cannot edit this item',
      color: 'red',
    })
    return
  }

  const initialValues = {
    id: row.id,
    batch_id: row.batch_id,
    product_id: row.product_id,
    store_id: row.store_id,
    batch_number: row.batch_number,
    quantity_in_stock: row.quantity_in_stock,
    quantity_reserved: row.quantity_reserved,
    unit_cost: row.unit_cost,
    selling_price: row.original_selling_price || row.selling_price,
    manufacturing_date: row.manufacturing_date,
    expiry_date: row.expiry_date,
    is_blocked: row.is_blocked,
    is_near_expiry: row.is_near_expiry,
  }

  console.log('Edit stock item:', initialValues)

  let message = `Editing: ${row.product_name}`
  if (row.is_blocked && companySettings?.block_expired_sales) {
    message += ' (Expired - View Only)'
  }

  notifications.show({
    title: 'Edit Stock',
    message,
    color: row.is_blocked ? 'yellow' : 'blue',
  })
}

export const handleDelete = async (
  row: any,
  fetchStockList: () => void,
  companySettings: CompanySettings | null,
) => {
  const userRoleId = await getCurrentUserRoleId()
  if (userRoleId !== Role.company_admin) {
    notifications.show({
      title: 'Permission Denied',
      message: 'You do not have permission to delete stock items.',
      color: 'red',
    })
    return
  }

  if (row.is_blocked && companySettings?.block_expired_sales) {
    const confirmBlocked = confirm(
      `This is an expired/blocked item: ${row.product_name}. Are you sure you want to delete it?`,
    )
    if (!confirmBlocked) return
  }

  if (
    !confirm(
      `Are you sure you want to delete this stock item: ${row.product_name}?`,
    )
  )
    return

  try {
    if (row.batches && row.batches.length > 0) {
      const deleteBatch = confirm(
        `This product has ${row.batches.length} batch(es). Delete all batches?`,
      )

      if (deleteBatch) {
        for (const batch of row.batches) {
          const { error } = await deleteStockBatch(batch.batch_id)
          if (error) throw error
        }
      } else {
        const { error } = await deleteStockBatch(row.batches[0].batch_id)
        if (error) throw error
      }
    } else {
      const { error } = await deleteStockBatch(row.batch_id || row.id)
      if (error) throw error
    }

    fetchStockList()

    notifications.show({
      title: 'Success',
      message: 'Stock item deleted successfully',
      color: 'green',
    })
  } catch (error: any) {
    console.error('Error deleting stock item:', error)
    notifications.show({
      title: 'Error',
      message: error.message || 'Failed to delete stock item',
      color: 'red',
    })
  }
}

/**
 * Handle stock adjustment with validation using Redux settings
 */
export const handleStockAdjustment = async (
  batchId: number,
  companySettings: CompanySettings | null,
  adjustment: {
    quantity: number
    reason: string
    currentAvailable: number
    isExpired: boolean
  },
) => {
  try {
    const validation = validateStockOperation(companySettings, {
      type: 'adjustment',
      batchId,
      quantity: Math.abs(adjustment.quantity),
      currentAvailable: adjustment.currentAvailable,
      isExpired: adjustment.isExpired,
    })

    if (!validation.valid) {
      notifications.show({
        title: 'Operation Blocked',
        message: validation.error || 'Cannot perform this adjustment',
        color: 'red',
      })
      return false
    }

    notifications.show({
      title: 'Adjustment Validated',
      message: 'Stock adjustment can proceed',
      color: 'green',
    })

    return true
  } catch (error) {
    console.error('Error validating adjustment:', error)
    notifications.show({
      title: 'Validation Error',
      message: 'Failed to validate stock adjustment',
      color: 'red',
    })
    return false
  }
}

/**
 * Show company settings info
 */
export const showCompanySettingsInfo = (settings: CompanySettings | null) => {
  if (!settings) {
    notifications.show({
      title: 'Settings Not Loaded',
      message: 'Company settings are not available',
      color: 'yellow',
    })
    return
  }

  const settingsInfo = `
    Currency: ${settings.default_currency}
    Near Expiry Warning: ${settings.near_expiry_warning_days} days
    Critical Expiry: ${settings.near_expiry_critical_days} days
    Low Stock Multiplier: ${settings.low_stock_multiplier}x
    Negative Stock: ${settings.allow_negative_stock ? 'Allowed' : 'Not Allowed'}
    Block Expired Sales: ${settings.block_expired_sales ? 'Yes' : 'No'}
    Near Expiry Discount: ${settings.allow_near_expiry_discount ? `${settings.near_expiry_discount_percentage}%` : 'Disabled'}
  `

  notifications.show({
    title: 'Company Settings',
    message: settingsInfo,
    color: 'blue',
    autoClose: 10000,
  })
}

/**
 * Fetch and display low stock alerts using view_low_stock
 */
export const handleLowStockAlerts = async (
  companyId: number,
  storeId?: number,
) => {
  try {
    const lowStockItems = await fetchLowStock(companyId, storeId)

    if (lowStockItems.length === 0) {
      notifications.show({
        title: 'No Low Stock Items',
        message: 'All items are adequately stocked',
        color: 'green',
      })
      return
    }

    const criticalItems = lowStockItems.filter(
      (item) => item.priority_level === 1,
    )
    const urgentItems = lowStockItems.filter(
      (item) => item.priority_level === 2,
    )

    notifications.show({
      title: 'Low Stock Alert',
      message: `${criticalItems.length} critical, ${urgentItems.length} urgent items need reordering`,
      color: criticalItems.length > 0 ? 'red' : 'orange',
      autoClose: 5000,
    })

    return lowStockItems
  } catch (error: any) {
    console.error('Error fetching low stock alerts:', error)
    notifications.show({
      title: 'Error',
      message: 'Failed to fetch low stock alerts',
      color: 'red',
    })
  }
}

/**
 * Fetch and display expiring stock alerts using view_expiring_stock
 */
export const handleExpiringStockAlerts = async (
  companyId: number,
  storeId?: number,
) => {
  try {
    const expiringItems = await fetchExpiringStock(companyId, storeId, [
      'EXPIRED',
      'CRITICAL',
      'URGENT',
    ])

    if (expiringItems.length === 0) {
      notifications.show({
        title: 'No Expiring Items',
        message: 'No items are expiring soon',
        color: 'green',
      })
      return
    }

    const expired = expiringItems.filter(
      (item) => item.expiry_status === 'EXPIRED',
    )
    const critical = expiringItems.filter(
      (item) => item.expiry_status === 'CRITICAL',
    )

    notifications.show({
      title: 'Expiry Alert',
      message: `${expired.length} expired, ${critical.length} critical items found`,
      color: expired.length > 0 ? 'red' : 'orange',
      autoClose: 5000,
    })

    return expiringItems
  } catch (error: any) {
    console.error('Error fetching expiring stock alerts:', error)
    notifications.show({
      title: 'Error',
      message: 'Failed to fetch expiring stock alerts',
      color: 'red',
    })
  }
}

/**
 * Fetch fast moving items using view_fast_moving_stock
 */
export const handleFastMovingAnalysis = async (
  companyId: number,
  storeId?: number,
) => {
  try {
    const fastMovingItems = await fetchFastMovingStock(companyId, storeId, [
      'VERY_FAST',
      'FAST',
    ])

    if (fastMovingItems.length === 0) {
      notifications.show({
        title: 'No Fast Moving Items',
        message: 'No fast moving items found',
        color: 'yellow',
      })
      return
    }

    const needsReorder = fastMovingItems.filter(
      (item) =>
        item.reorder_urgency === 'URGENT' || item.reorder_urgency === 'SOON',
    )

    notifications.show({
      title: 'Fast Moving Items',
      message: `${fastMovingItems.length} fast moving items, ${needsReorder.length} need reordering`,
      color: 'blue',
      autoClose: 5000,
    })

    return fastMovingItems
  } catch (error: any) {
    console.error('Error fetching fast moving analysis:', error)
    notifications.show({
      title: 'Error',
      message: 'Failed to fetch fast moving analysis',
      color: 'red',
    })
  }
}

/**
 * Display inventory statistics dashboard
 */
export const handleInventoryStatistics = async (
  companyId: number,
  storeId?: number,
) => {
  try {
    const stats = await getInventoryStatistics(companyId, storeId)

    const summary = `
      Total Products: ${stats.total_products}
      Inventory Value: ${stats.total_inventory_value.toLocaleString()}
      Out of Stock: ${stats.out_of_stock}
      Low Stock: ${stats.low_stock}
      Expired Batches: ${stats.expired_batches}
      Expiring Soon: ${stats.expiring_soon}
    `

    notifications.show({
      title: 'Inventory Statistics',
      message: summary,
      color: 'blue',
      autoClose: 10000,
    })

    return stats
  } catch (error: any) {
    console.error('Error fetching inventory statistics:', error)
    notifications.show({
      title: 'Error',
      message: 'Failed to fetch inventory statistics',
      color: 'red',
    })
  }
}

