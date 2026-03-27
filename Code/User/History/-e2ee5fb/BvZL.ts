// src/features/areasManagement/handlers/areasManagement.handlers.ts
import { notifications } from '@mantine/notifications'
import { openModal } from '@shared/components/genericModal'
import { AppDispatch } from '@app/core/store/store'
import { fetchAreasData, fetchAreaStats } from '../utils/areasManagement.utils'
import { Area } from '@shared/types/area'
import { exportToPDF } from '@app/core/exports/PdfExporter'
import { exportToExcel } from '@app/core/exports/CsvExporter'
import { deleteArea } from '../data/areas.queries'
import { Profile } from '@shared/types/profile'
import { Store } from '@shared/types/Store'
import { NavigateFunction } from 'react-router-dom'
import { selectArea } from '@features/main/main.slice'

/**
 * Handles opening the modal to add a new area
 */
export const handleAddArea = (dispatch: AppDispatch, companyId: number) => {
  dispatch(
    openModal({
      type: 'add-area',
      size: 'lg',
      props: {
        mode: 'create',
        companyId,
      },
    }),
  )
}

/**
 * Handles exporting areas to PDF
 */
export const handleExportPDF = (columns: any[], data: Area[]) => {
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
      fileName: `areas_export_${new Date().toISOString().split('T')[0]}`,
      title: 'Areas Management Report',
      orientation: 'landscape',
      includeDate: true,
    })

    notifications.show({
      title: 'Export Successful',
      message: `${data.length} area(s) exported to PDF successfully`,
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

/**
 * Handles exporting areas to Excel
 */
export const handleExportExcel = (columns: any[], data: Area[]) => {
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
      fileName: `areas_export_${new Date().toISOString().split('T')[0]}`,
      sheetName: 'Areas',
      title: 'Areas Management Report',
      includeMetadata: true,
    })

    notifications.show({
      title: 'Export Successful',
      message: `${data.length} area(s) exported to Excel successfully`,
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

/**
 * Handles refreshing the areas list
 * FIXED: Added companyId parameter
 */
export const handleRefresh = async (
  companyId: number,
  setAreas: React.Dispatch<React.SetStateAction<Area[]>>,
  setProfiles: React.Dispatch<React.SetStateAction<Profile[]>>,
  setStores: React.Dispatch<React.SetStateAction<Store[]>>,
  setLoading: React.Dispatch<React.SetStateAction<boolean>>,
  setTotalCount: React.Dispatch<React.SetStateAction<number>>,
  fetchStats: () => Promise<void>,
  currentPage: number = 1,
  pageSize: number = 10,
  searchQuery: string = '',
  statusFilter: string = 'all',
) => {
  try {
    setLoading(true)

    const { areasData, profilesData, storesData, totalCount } =
      await fetchAreasData({
        companyId,
        page: currentPage,
        pageSize,
        searchQuery,
        status: statusFilter,
      })

    setAreas(areasData)
    setProfiles(profilesData)
    setStores(storesData)
    setTotalCount(totalCount)

    // Refresh stats
    await fetchStats()

    notifications.show({
      title: 'Refreshed',
      message: `Areas list updated - ${totalCount} total area(s) found`,
      color: 'blue',
    })
  } catch (error: any) {
    console.error('Error refreshing areas:', error)
    // Error notification already shown in fetchAreasData
  } finally {
    setLoading(false)
  }
}

/**
 * Handles viewing area details
 */
export const handleView = (row: Area, dispatch: AppDispatch) => {
  dispatch(
    openModal({
      type: 'view-area',
      size: 'lg',
      props: {
        areaId: row.id,
        areaData: row,
      },
    }),
  )
}

/**
 * Handles editing an area
 * FIXED: Proper handling of auth_id (string[]) vs number[]
 */
export const handleEdit = (row: Area, dispatch: AppDispatch) => {
  // Ensure admin IDs are properly typed as string[] (auth_id is UUID)
  const assignedAdminIds: string[] = Array.isArray(row.assigned_admin_ids)
    ? row.assigned_admin_ids.filter(
        (id): id is string => typeof id === 'string',
      )
    : []

  // Ensure store IDs are properly typed as number[]
  const assignedStoreIds: number[] = Array.isArray(row.assigned_store_ids)
    ? row.assigned_store_ids.filter(
        (id): id is number => typeof id === 'number',
      )
    : []

  const initialValues = {
    id: row.id,
    company_id: row.company_id,
    area_name: row.area_name,
    area_code: row.area_code,
    description: row.description || '',
    region: row.region || '',
    country: row.country || 'Uganda',
    assigned_admin_ids: assignedAdminIds,
    assigned_store_ids: assignedStoreIds,
    is_active: row.is_active ?? true,
  }

  dispatch(
    openModal({
      type: 'edit-area',
      size: 'lg',
      props: {
        mode: 'edit',
        initialValues,
      },
    }),
  )
}

/**
 * Handles deleting an area (soft delete)
 * FIXED: Added fetchStats parameter
 */
export const handleDelete = async (
  row: Area,
  fetchAreas: () => void,
  fetchStats: () => Promise<void>,
) => {
  // Confirm deletion
  const confirmed = window.confirm(
    `Are you sure you want to delete the area "${row.area_name}"?\n\n` +
      `This action will:\n` +
      `- Mark the area as deleted (soft delete)\n` +
      `- Unassign ${row.store_count || 0} store(s)\n` +
      `- Unassign all area admins\n\n` +
      `Note: Stores and admins will not be deleted, just unassigned.`,
  )

  if (!confirmed) return

  try {
    const { error } = await deleteArea(row.id)

    if (error) {
      throw new Error(error.message || 'Failed to delete area')
    }

    // Refresh the list and stats
    fetchAreas()
    await fetchStats()

    notifications.show({
      title: 'Success',
      message: `Area "${row.area_name}" deleted successfully`,
      color: 'green',
    })
  } catch (error: any) {
    console.error('Error deleting area:', error)
    notifications.show({
      title: 'Error',
      message: error.message || 'Failed to delete area. Please try again.',
      color: 'red',
    })
  }
}

/**
 * Handles viewing staff assigned to an area
 */
export const handleViewStaff = (
  row: Area,
  dispatch: AppDispatch,
  navigate: NavigateFunction,
): void => {
  dispatch(selectArea(row))
  navigate('/user-management')
}

/**
 * Handles viewing stores in an area
 */
export const handleViewStores = (
  row: Area,
  dispatch: AppDispatch,
  navigate: NavigateFunction,
): void => {
  dispatch(selectArea(row))
  navigate('/stores-management')
}

