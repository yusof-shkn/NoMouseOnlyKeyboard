// src/shared/components/GenericModal/GenericModal.tsx - UPDATED WITH CREDIT MODALS
import React, { useMemo } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { Modal } from '@mantine/core'
import { RootState, AppDispatch } from '@app/core/store/store'
import { closeModal } from './SliceGenericModal'
import { DRAWER_TYPES } from '@shared/components/genericDrawer/GenericDrawer'

// Existing imports
import { AreaForm, StoreForm } from '@features/main'
import UserForm from '@features/main/components/usersManagement/components/UsersForm'
import CategoryForm from '@features/itemsMaster/components/categories/components/CategoriesForm'
import UnitForm from '@features/itemsMaster/components/units/components/UnitsForm'
import BarcodeModalContent from '@features/itemsMaster/components/barCode/components/BarCodeModalContent'
import { BatchDetailsModalContent } from '@features/purchase/components/POP/components'
import SupplierForm from '@features/purchase/components/suppliers/components/SupplierForm'

// Sales modal imports
import { SaleBatchDetailsModalContent } from '@features/sales/components/POS/components/SaleBatchDetailsModal'
import { AdditionalCostsModalContent } from '@shared/components/PointOfSalePurchase/AdditionalCostsModal'
import { PrescriptionDetailsModalContent } from '@features/sales/components/POS/components/PrescriptionDetailsModal'
import CustomerForm from '@features/sales/components/customers/components/CustomerForm'

// Expense modal imports
import ExpenseForm from '@features/AccountingAndFinance/components/expenses/components/expenseForm'
import ExpenseCategoryForm from '@features/AccountingAndFinance/components/expenseCategory/components/ExpenseCategoryForm'

// Roles & Permissions modal imports
import AddEditRoleModal from '@features/main/components/roles&permissionManagement/components/AddEditRoleModal'
import AssignPermissionsModal from '@features/main/components/roles&permissionManagement/components/AssignPermissionsModal'

// Stock Adjustment modal import
import StockAdjustmentForm from '@features/inventory/components/stockAdjustment/components/StockAdjustmentForm'
import { CompleteSaleModalContent } from '@features/sales/components/POS/components/CompleteSaleModal'
import RecordPurchasePaymentForm from '@features/purchase/components/purchaseOrdersHistory/components/RecordPurchasePaymentForm'
import CreatePurchaseReturnForm from '@features/purchase/components/purchaseReturn/components/CreatePurchaseReturnForm'
import SupplierRatingForm from '@features/purchase/components/purchaseOrdersHistory/components/SupplierRatingForm'
import { PartialReturnModalContent } from '@features/sales/components/salesHistory/components/PartialReturnModal'
import { ConfirmDeleteSaleModalContent } from '@features/sales/components/salesHistory/components/ConfirmDeleteSaleModal'
import PayCustomerCreditModal from '@features/sales/components/customers/components/Paycustomercreditmodal'
import ReceiveGoodsForm from '@features/purchase/components/purchaseOrdersHistory/components/Receivegoodsform'
import StockTransferForm from '@features/inventory/components/stockTransfer/components/StockTransferForm'
import ConfirmModal from '@shared/components/confirmModal/ConfirmModal'
import PromptModal from '@shared/components/confirmModal/PromptModal'
import { CompletePurchaseModal } from '@features/purchase/components/POP/components/CompletePurchaseModal'
import { SingleItemBatchModalContent } from '@features/purchase/components/POP/components/SingleItemBatchModal'
import { ReceiveImmediatelyBatchModalContent } from '@features/purchase/components/POP/components/ReceiveImmediatelyBatchModal'
import { DeletedUsersModalContent } from '@features/main/components/usersManagement/components/DeletedUsersModal'
import { ChangePasswordModalContent } from '@features/authentication/components/profile/ChangePasswordModalContent'
import { CreateBudgetModalContent, AddEditBudgetItemModalContent } from '@features/AccountingAndFinance/components/BudgetManagement/BudgetModalContents'
import { CreateJournalEntryModalContent } from '@features/AccountingAndFinance/components/JournalEntries/CreateJournalEntryModalContent'
import { PermissionMatrixModalContent } from '@features/main/components/roles&permissionManagement/components/PermissionMatrixModalContent'
const modalContentMap: Partial<
  Record<NonNullable<RootState['modal']['type']>, React.ComponentType<any>>
> = {
  'add-store': StoreForm,
  'add-area': AreaForm,
  'edit-area': AreaForm,
  'add-user': UserForm,
  'edit-user': UserForm,
  'add-category': CategoryForm,
  'add-unit': UnitForm,
  'purchase-batch-details': BatchDetailsModalContent,
  'additional-costs': AdditionalCostsModalContent,
  'sale-batch-details': SaleBatchDetailsModalContent,
  'prescription-details': PrescriptionDetailsModalContent,
  'add-supplier': SupplierForm,
  'barcode-preview': BarcodeModalContent,
  'add-customer': CustomerForm,
  'payment-record': RecordPurchasePaymentForm,
  'supplier-rating': SupplierRatingForm,
  'create-purchase-return': CreatePurchaseReturnForm,
  'expense-form': ExpenseForm,
  'add-expense-category': ExpenseCategoryForm,
  'add-role': AddEditRoleModal,
  'edit-role': AddEditRoleModal,
  'assign-permissions': AssignPermissionsModal,
  'add-stock-adjustment': StockAdjustmentForm,
  'complete-sale-confirmation': CompleteSaleModalContent,
  'partial-return': PartialReturnModalContent,
  'confirm-delete-sale': ConfirmDeleteSaleModalContent,
  'pay-customer-credit': PayCustomerCreditModal,
  'receive-goods': ReceiveGoodsForm,
  'add-stock-transfer': StockTransferForm,
  'confirm-action': ConfirmModal,
  'prompt-action': PromptModal,
  'complete-purchase': CompletePurchaseModalContent,
  'single-item-batch': SingleItemBatchModalContent,
  'receive-immediately-batch': ReceiveImmediatelyBatchModalContent,
  'deleted-users': DeletedUsersModalContent,
  'change-password': ChangePasswordModalContent,
  'create-budget': CreateBudgetModalContent,
  'add-edit-budget-item': AddEditBudgetItemModalContent,
  'create-journal-entry': CreateJournalEntryModalContent,
  'permission-matrix': PermissionMatrixModalContent,
  // Note: all view-* types are handled by GenericDrawer
}

// Helper to get modal title from type
const getModalTitle = (
  type: string | null,
  props: Record<string, any> = {},
): string => {
  if (!type) return 'Modal'

  // Custom titles for specific modals
  const customTitles: Record<string, string> = {
    'purchase-batch-details': 'Edit Batch Details',
    'purchase-additional-costs': 'Additional Costs',
    'sale-batch-details': 'Select Batch & Quantity',
    'sale-additional-costs': 'Additional Costs',
    'prescription-details': 'Prescription Details',
    'quotation-details': 'Quotation Details',
    'expense-form': 'Expense',
    'complete-sale-confirmation': 'Complete Sale',
    'payment-record': 'Record Payment',
    'partial-return': 'Process Return',
    'confirm-delete-sale': 'Confirm Delete',
    'add-stock-transfer': 'New Stock Transfer',
    'confirm-action': 'Confirm',
    'prompt-action': 'Input Required',
    'complete-purchase': 'Complete Purchase',
    'single-item-batch': 'Enter Batch Details',
    'receive-immediately-batch': 'Enter Batch Details',
    'deleted-users': 'Deleted Users',
    'change-password': 'Change Password',
    'create-budget': 'Create New Budget',
    'add-edit-budget-item': 'Budget Line Item',
    'create-journal-entry': 'New Manual Journal Entry',
    'permission-matrix': 'Permission Matrix',
    // Credit Management titles
    'add-credit-transaction': 'Add Credit Transaction',
    'record-credit-payment': 'Record Credit Payment',
    'add-credit-tier': 'Create Credit Tier',
    'edit-credit-tier': 'Edit Credit Tier',
  }

  // Dynamic titles based on props
  if (type === 'add-expense-category') {
    return props?.mode === 'edit'
      ? 'Edit Expense Category'
      : 'Add New Expense Category'
  }

  if (type === 'add-role') {
    return 'Create New Role'
  }

  if (type === 'edit-role') {
    return 'Edit Role'
  }



  if (type === 'confirm-action' && props?.title) return props.title
  if (type === 'prompt-action' && props?.title) return props.title

  if (type === 'assign-permissions') {
    return `Assign Permissions${props?.roleName ? ` - ${props.roleName}` : ''}`
  }

  if (type === 'add-stock-adjustment') {
    return props.mode === 'edit'
      ? 'Edit Stock Adjustment'
      : 'New Stock Adjustment'
  }

  if (type === 'add-edit-budget-item') {
    return props?.editingItem ? 'Edit Budget Line' : 'Add Budget Line'
  }

  if (type === 'permission-matrix') {
    return props?.preselectedRoleId
      ? `Permission Matrix`
      : 'Permission Matrix'
  }

  if (customTitles[type]) return customTitles[type]

  // Default: capitalize and replace hyphens
  return type
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export const GenericModal: React.FC = () => {
  const {
    isOpen,
    type,
    size,
    props = {},
    content,
  } = useSelector((state: RootState) => state.modal)
  const dispatch = useDispatch<AppDispatch>()

  const handleClose = () => {
    dispatch(closeModal())
  }

  const rendered = useMemo(() => {
    // Skip entirely for drawer types — handled by GenericDrawer
    if (!type || DRAWER_TYPES.has(type)) return null

    // If custom content is provided, use it directly
    if (content) return content

    // Get the component from the map
    const Component = modalContentMap[type]

    if (!Component) {
      console.warn('GenericModal: Unknown modal type:', type)
      return null
    }

    // Ensure arrays are always arrays for user modals
    let componentProps = { ...props }

    if (type === 'add-user' || type === 'edit-user') {
      console.log('👤 Processing user modal props...')

      // Ensure areas is always an array
      if (!componentProps.areas || !Array.isArray(componentProps.areas)) {
        console.warn('⚠️ areas was not an array, setting to empty array')
        componentProps.areas = []
      }

      // Ensure stores is always an array
      if (!componentProps.stores || !Array.isArray(componentProps.stores)) {
        console.warn('⚠️ stores was not an array, setting to empty array')
        componentProps.stores = []
      }

      console.log('✅ User modal safe props:', {
        areasLength: componentProps.areas.length,
        storesLength: componentProps.stores.length,
        mode: componentProps.mode,
      })
    }

    // ✅ NEW: Ensure customers array for credit modals
    if (type === 'add-credit-transaction' || type === 'record-credit-payment') {
      if (
        !componentProps.customers ||
        !Array.isArray(componentProps.customers)
      ) {
        console.warn('⚠️ customers was not an array, setting to empty array')
        componentProps.customers = []
      }
    }

    // Filter out non-serializable props for the key (but pass all props to component)
    const serializableProps = Object.entries(componentProps).reduce(
      (acc, [key, value]) => {
        if (typeof value !== 'function') {
          acc[key] = value
        }
        return acc
      },
      {} as Record<string, any>,
    )

    // Create unique key for component
    const key = serializableProps.id
      ? `${type}-${serializableProps.id}`
      : serializableProps.itemData?.id
        ? `${type}-${serializableProps.itemData.id}`
        : serializableProps.roleId
          ? `${type}-${serializableProps.roleId}`
          : serializableProps.purchaseOrderId
            ? `${type}-${serializableProps.purchaseOrderId}`
            : serializableProps.sale?.id
              ? `${type}-${serializableProps.sale.id}`
              : serializableProps.tier?.id
                ? `${type}-${serializableProps.tier.id}`
                : serializableProps.initialValues?.id
                  ? `${type}-${serializableProps.initialValues.id}`
                  : `${type}-${Date.now()}`

    return (
      <Component
        key={key}
        {...componentProps}
      />
    )
  }, [type, props, content])

  // Dynamic title based on type and props
  const modalTitle = useMemo(() => {
    return getModalTitle(type, props)
  }, [type, props])

  // Don't open as a modal if the type belongs to GenericDrawer
  const isModalType = !type || !DRAWER_TYPES.has(type)

  // Render Modal only for non-drawer types
  return (
    <Modal
      opened={isOpen && isModalType && !!rendered}
      onClose={handleClose}
      title={modalTitle}
      centered
      size={size}
      closeOnClickOutside={true}
      closeOnEscape={true}
      transitionProps={{
        transition: 'fade',
        duration: 200,
        timingFunction: 'ease',
      }}
      overlayProps={{
        backgroundOpacity: 0.55,
        blur: 3,
      }}
    >
      {rendered}
    </Modal>
  )
}

export default GenericModal


