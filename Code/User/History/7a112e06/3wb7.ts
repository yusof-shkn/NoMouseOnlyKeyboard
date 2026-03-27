import { notifications } from '@mantine/notifications'
import { closeModal } from '@shared/components/genericModal'
import { AppDispatch } from '@app/core/store/store'
import { AreaFormProps } from '../types/areasForm.types'
import { Profile } from '@shared/types/profile'
import {
  createArea,
  updateArea,
  unassignAreaAdmins,
  assignAreaAdmins,
  unassignAreaStores,
  assignAreaStores,
} from '../data/areas.queries'
import { validateAreaData } from '../utils/areasManagement.utils'

/**
 * Handles form submission for creating or updating an area
 */
export const handleSubmit = async (
  values: any,
  mode: AreaFormProps['mode'],
  initialValues: AreaFormProps['initialValues'],
  dispatch: AppDispatch,
  setLoading: React.Dispatch<React.SetStateAction<boolean>>,
  currentUser: Profile | null,
) => {
  // Validate current user
  if (!currentUser) {
    notifications.show({
      title: 'Authentication Error',
      message: 'User session not found. Please log in again.',
      color: 'red',
    })
    return
  }

  setLoading(true)

  try {
    // Prepare submit data
    const submitData = {
      company_id: parseInt(values.company_id),
      area_name: values.area_name.trim(),
      area_code: values.area_code.trim(),
      description: values.description?.trim() || null,
      region: values.region?.trim() || null,
      country: values.country?.trim() || 'Uganda',
      is_active: values.is_active ?? true,
    }

    // Validate data
    const validation = validateAreaData(submitData)
    if (!validation.valid) {
      notifications.show({
        title: 'Validation Error',
        message: validation.errors.join(', '),
        color: 'red',
      })
      return
    }

    let areaId = initialValues?.id

    // Create or update area
    if (mode === 'edit' && initialValues?.id) {
      const { error } = await updateArea(initialValues.id, submitData)
      if (error) {
        throw new Error(error.message || 'Failed to update area')
      }
      areaId = initialValues.id
    } else {
      const { data, error } = await createArea(submitData)
      if (error) {
        throw new Error(error.message || 'Failed to create area')
      }
      areaId = data?.id
      if (!areaId) {
        throw new Error('Failed to retrieve new area ID')
      }
    }

    // Handle admin assignments (auth_id is string/UUID)
    const adminIds: string[] = values.assigned_admin_ids || []

    if (mode === 'edit' && initialValues?.id) {
      // Unassign admins not in the new list
      const { error: unassignError } = await unassignAreaAdmins(
        initialValues.id,
        adminIds,
      )
      if (unassignError) {
        console.error('Error unassigning admins:', unassignError)
        // Don't throw - continue with assignment
      }
    }

    // Assign selected admins
    if (adminIds.length > 0) {
      const { error: assignError } = await assignAreaAdmins(areaId, adminIds)
      if (assignError) {
        throw new Error(assignError.message || 'Failed to assign area admins')
      }
    }

    // Handle store assignments (store IDs are numbers)
    const storeIds: number[] = (values.assigned_store_ids || []).map(
      (id: any) => (typeof id === 'number' ? id : parseInt(id, 10)),
    )

    if (mode === 'edit' && initialValues?.id) {
      // Unassign stores not in the new list
      const { error: unassignError } = await unassignAreaStores(
        initialValues.id,
        storeIds,
      )
      if (unassignError) {
        console.error('Error unassigning stores:', unassignError)
        // Don't throw - continue with assignment
      }
    }

    // Assign selected stores
    if (storeIds.length > 0) {
      const { error: assignStoreError } = await assignAreaStores(
        areaId,
        storeIds,
      )
      if (assignStoreError) {
        throw new Error(
          assignStoreError.message || 'Failed to assign stores to area',
        )
      }
    }

    // Success notification
    const adminCount = adminIds.length
    const storeCount = storeIds.length

    notifications.show({
      title: 'Success',
      message: `Area ${mode === 'edit' ? 'updated' : 'created'} successfully${
        adminCount > 0 ? ` with ${adminCount} admin(s)` : ''
      }${storeCount > 0 ? ` and ${storeCount} store(s)` : ''}`,
      color: 'green',
    })

    // Trigger refresh event
    window.dispatchEvent(new CustomEvent('areaUpdated'))

    // Close modal
    dispatch(closeModal())
  } catch (error: any) {
    console.error('Error saving area:', error)
    notifications.show({
      title: 'Error',
      message: error.message || 'Failed to save area. Please try again.',
      color: 'red',
    })
  } finally {
    setLoading(false)
  }
}

