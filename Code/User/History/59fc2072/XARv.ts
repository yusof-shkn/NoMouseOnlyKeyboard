// src/features/main/CategoryForm/handlers/categoryForm.handlers.ts
import { notifications } from '@mantine/notifications'
import { closeModal } from '@shared/components/genericModal'
import { AppDispatch } from '@app/core/store/store'
import {
  CategoryFormProps,
  CategorySubmitData,
} from '../types/categoriesForm.types'
import { Profile } from '@shared/types/profile'
import {
  createCategory,
  updateCategory,
  checkCategoryCodeUnique,
} from '../data/categories.queries'
import { validateCategoryData } from '../utils/categoriesForm.utils'

export const handleSubmit = async (
  values: any,
  mode: CategoryFormProps['mode'],
  initialValues: CategoryFormProps['initialValues'],
  dispatch: AppDispatch,
  setLoading: React.Dispatch<React.SetStateAction<boolean>>,
  currentUser: Profile | null,
) => {
  if (!currentUser) {
    notifications.show({
      title: 'Authentication Error',
      message: 'User session not found. Please log in again.',
      color: 'red',
    })
    return
  }

  if (mode === 'edit' && initialValues?.company_id === 1) {
    notifications.show({
      title: 'Permission Denied',
      message: 'System categories cannot be edited.',
      color: 'red',
    })
    return
  }

  setLoading(true)

  try {
    const submitData: CategorySubmitData = {
      company_id: parseInt(values.company_id),
      category_name: values.category_name.trim(),
      category_code: values.category_code?.trim() || null,
      description: values.description?.trim() || null,
      is_active: values.is_active ?? true,
      color_code: values.color_code?.trim() || null,
      icon_name: values.icon_name?.trim() || null,
      sort_order: values.sort_order || null,
    }

    if (submitData.company_id === 1) {
      notifications.show({
        title: 'Permission Denied',
        message: 'Cannot create or modify system categories.',
        color: 'red',
      })
      setLoading(false)
      return
    }

    const validation = validateCategoryData(submitData)
    if (!validation.valid) {
      notifications.show({
        title: 'Validation Error',
        message: validation.errors.join(', '),
        color: 'red',
      })
      setLoading(false)
      return
    }

    if (submitData.category_code) {
      const { isUnique, error: uniqueError } = await checkCategoryCodeUnique(
        submitData.category_code,
        submitData.company_id,
        mode === 'edit' ? initialValues?.id : undefined,
      )

      if (uniqueError) {
        console.error('Error checking code uniqueness:', uniqueError)
      } else if (!isUnique) {
        notifications.show({
          title: 'Validation Error',
          message: `Category code "${submitData.category_code}" is already in use. Please choose a different code.`,
          color: 'orange',
        })
        setLoading(false)
        return
      }
    }

    if (mode === 'edit' && initialValues?.id) {
      const { error } = await updateCategory(initialValues.id, submitData)

      if (error) {
        if (error.code === '23505') {
          notifications.show({
            title: 'Duplicate Entry',
            message:
              'A category with this code already exists in your company.',
            color: 'orange',
          })
        } else if (error.code === 'SYSTEM_CATEGORY_UPDATE') {
          notifications.show({
            title: 'Permission Denied',
            message: 'System categories cannot be modified.',
            color: 'red',
          })
        } else {
          throw new Error(error.message || 'Failed to update category')
        }
        setLoading(false)
        return
      }

      notifications.show({
        title: 'Success',
        message: `Category "${submitData.category_name}" updated successfully`,
        color: 'green',
        icon: '✓',
      })
    } else {
      const { data, error } = await createCategory(submitData)

      if (error) {
        if (error.code === '23505') {
          notifications.show({
            title: 'Duplicate Entry',
            message:
              'A category with this code already exists in your company.',
            color: 'orange',
          })
        } else {
          throw new Error(error.message || 'Failed to create category')
        }
        setLoading(false)
        return
      }

      if (!data?.id) {
        throw new Error('Failed to retrieve new category ID')
      }

      notifications.show({
        title: 'Success',
        message: `Category "${submitData.category_name}" created successfully`,
        color: 'green',
        icon: '✓',
      })
    }

    window.dispatchEvent(new CustomEvent('categoryUpdated'))
    dispatch(closeModal())
  } catch (error: any) {
    console.error('Error saving category:', error)

    let errorMessage = 'Failed to save category. Please try again.'

    if (error.message?.includes('unique')) {
      errorMessage = 'A category with this code already exists.'
    } else if (error.message?.includes('check constraint')) {
      errorMessage = 'Invalid data: please check your input values.'
    } else if (error.message?.includes('System categories')) {
      errorMessage = 'System categories cannot be modified.'
    } else if (error.message) {
      errorMessage = error.message
    }

    notifications.show({
      title: 'Error',
      message: errorMessage,
      color: 'red',
    })
  } finally {
    setLoading(false)
  }
}

export const handleCategoryCodeBlur = async (
  categoryCode: string,
  companyId: number,
  excludeCategoryId?: number,
): Promise<boolean> => {
  if (!categoryCode?.trim() || companyId === 1) return true

  try {
    const { isUnique } = await checkCategoryCodeUnique(
      categoryCode.trim(),
      companyId,
      excludeCategoryId,
    )

    if (!isUnique) {
      notifications.show({
        title: 'Duplicate Code',
        message: `Category code "${categoryCode}" is already in use.`,
        color: 'orange',
        autoClose: 3000,
      })
    }

    return isUnique
  } catch (error) {
    console.error('Error checking category code:', error)
    return true
  }
}

