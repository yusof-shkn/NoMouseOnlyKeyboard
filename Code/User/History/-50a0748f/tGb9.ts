import { notifications } from '@mantine/notifications'
import { ProductCategory } from '@shared/types/medicines'
import { AppDispatch } from '@app/core/store/store'
import { formatCategoryForExport } from '../utils/categoriesManagement.utils'
import {
  deleteCategory,
  checkCategoryProducts,
} from '../data/categories.queries'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import { openModal } from '@shared/components/genericModal'

interface ExtendedProductCategory extends ProductCategory {
  product_count?: number
}

export const handleAddCategory = (dispatch: AppDispatch) => {
  dispatch(
    openModal({
      type: 'add-category',
      size: 'xl',
      props: { mode: 'create' },
    }),
  )
  notifications.show({
    title: 'Add Category',
    message: 'Opening category creation form...',
    color: 'blue',
    autoClose: 2000,
  })
}

export const handleView = (
  row: ExtendedProductCategory,
  dispatch: AppDispatch,
  navigate: any,
) => {
  notifications.show({
    title: 'View Category',
    message: `Viewing: ${row.category_name}`,
    color: 'blue',
    autoClose: 3000,
  })
  // navigate(`/categories/${row.id}`)
}

export const handleEdit = (
  row: ExtendedProductCategory,
  dispatch: AppDispatch,
) => {
  dispatch(
    openModal({
      type: 'add-category',
      size: 'xl',
      props: {
        mode: 'edit',
        category: row,
      },
    }),
  )
  notifications.show({
    title: 'Edit Category',
    message: `Editing: ${row.category_name}`,
    color: 'blue',
    autoClose: 2000,
  })
}

export const handleDelete = async (
  row: ExtendedProductCategory,
  fetchCategories: () => void,
  fetchStats: () => void,
) => {
  try {
    const { data: checkData } = await checkCategoryProducts(row.id)

    if (checkData && checkData.count > 0) {
      notifications.show({
        title: 'Cannot Delete',
        message: `This category has ${checkData.count} product(s). Please reassign or remove products before deleting.`,
        color: 'orange',
        autoClose: 7000,
      })
      return
    }

    const confirmMessage =
      `Are you sure you want to delete "${row.category_name}"?\n\n` +
      `This will perform a soft delete (recoverable).`

    if (!confirm(confirmMessage)) return

    const { error } = await deleteCategory(row.id)

    if (error) {
      if (error.code === '23503') {
        notifications.show({
          title: 'Cannot Delete',
          message:
            'This category is referenced by other records and cannot be deleted.',
          color: 'orange',
        })
        return
      }
      throw error
    }

    notifications.show({
      title: 'Success',
      message: `Category "${row.category_name}" has been deleted`,
      color: 'green',
      icon: '✓',
    })

    fetchCategories()
    fetchStats()
    window.dispatchEvent(new Event('categoryUpdated'))
  } catch (error: any) {
    console.error('Error deleting category:', error)
    notifications.show({
      title: 'Error',
      message: error.message || 'Failed to delete category',
      color: 'red',
    })
  }
}

export const handleExportPDF = (
  columns: any[],
  data: ExtendedProductCategory[],
) => {
  try {
    const doc = new jsPDF()

    doc.setFontSize(18)
    doc.text('Product Categories List', 14, 22)

    doc.setFontSize(10)
    doc.text(`Exported: ${new Date().toLocaleDateString()}`, 14, 30)

    const tableData = data.map((item) => [
      item.category_code || 'N/A',
      item.category_name,
      item.description || 'N/A',
      item.product_count || 0,
      item.is_active ? 'Active' : 'Inactive',
    ])

    autoTable(doc, {
      head: [['Code', 'Category Name', 'Description', 'Products', 'Status']],
      body: tableData,
      startY: 35,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [124, 58, 237] },
    })

    doc.save(`categories-list-${new Date().toISOString().split('T')[0]}.pdf`)

    notifications.show({
      title: 'Success',
      message: 'PDF exported successfully',
      color: 'green',
      icon: '✓',
    })
  } catch (error: any) {
    console.error('Error exporting PDF:', error)
    notifications.show({
      title: 'Error',
      message: 'Failed to export PDF',
      color: 'red',
    })
  }
}

export const handleExportExcel = (
  columns: any[],
  data: ExtendedProductCategory[],
) => {
  try {
    const exportData = data.map(formatCategoryForExport)

    const worksheet = XLSX.utils.json_to_sheet(exportData)

    const columnWidths = [
      { wch: 10 }, // Type
      { wch: 15 }, // Category Code
      { wch: 25 }, // Category Name
      { wch: 30 }, // Description
      { wch: 12 }, // Product Count
      { wch: 10 }, // Status
      { wch: 15 }, // Created At
    ]
    worksheet['!cols'] = columnWidths

    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Categories')

    const fileName = `categories-list-${new Date().toISOString().split('T')[0]}.xlsx`
    XLSX.writeFile(workbook, fileName)

    notifications.show({
      title: 'Success',
      message: 'Excel file exported successfully',
      color: 'green',
      icon: '✓',
    })
  } catch (error: any) {
    console.error('Error exporting Excel:', error)
    notifications.show({
      title: 'Error',
      message: 'Failed to export Excel file',
      color: 'red',
    })
  }
}

export const handleBulkDelete = async (
  selectedIds: number[],
  fetchCategories: () => void,
  fetchStats: () => void,
) => {
  if (selectedIds.length === 0) {
    notifications.show({
      title: 'No Selection',
      message: 'Please select categories to delete',
      color: 'orange',
    })
    return
  }

  const confirmMessage = `Are you sure you want to delete ${selectedIds.length} categor${selectedIds.length > 1 ? 'ies' : 'y'}?`
  if (!confirm(confirmMessage)) return

  try {
    const results = await Promise.allSettled(
      selectedIds.map((id) => deleteCategory(id)),
    )

    const successCount = results.filter((r) => r.status === 'fulfilled').length
    const failCount = results.filter((r) => r.status === 'rejected').length

    if (successCount > 0) {
      notifications.show({
        title: 'Bulk Delete Complete',
        message: `Successfully deleted ${successCount} categor${successCount > 1 ? 'ies' : 'y'}${failCount > 0 ? ` (${failCount} failed)` : ''}`,
        color: failCount > 0 ? 'orange' : 'green',
      })

      fetchCategories()
      fetchStats()
      window.dispatchEvent(new Event('categoryUpdated'))
    }
  } catch (error: any) {
    console.error('Error in bulk delete:', error)
    notifications.show({
      title: 'Error',
      message: 'Failed to complete bulk delete',
      color: 'red',
    })
  }
}
