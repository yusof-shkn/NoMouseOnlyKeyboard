// src/shared/components/GenericModal/GenericModal.tsx - UPDATED WITH CREDIT MODALS
import React, { useMemo, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { Modal, Loader, Center } from '@mantine/core'
import { RootState, AppDispatch } from '@app/core/store/store'
import { closeModal } from './SliceGenericModal'

// Existing imports
import { AreaForm, StoreForm } from '@features/main'
import UserForm from '@features/main/components/usersManagement/components/UsersForm'
import MedicineForm from '@features/itemsMaster/components/medicines/components/MedicinesForm'
import CategoryForm from '@features/itemsMaster/components/categories/components/CategoriesForm'
import UnitForm from '@features/itemsMaster/components/units/components/UnitsForm'
import BarcodeModalContent from '@features/itemsMaster/components/barCode/components/BarCodeModalContent'
import AreaView from '@features/main/components/areasManagement/components/AreaView'
import UserView from '@features/main/components/usersManagement/components/UsersView'
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
import ViewRoleModal from '@features/main/components/roles&permissionManagement/components/ViewRoleModal'
import ViewRoleUsersModal from '@features/main/components/roles&permissionManagement/components/ViewRoleUsersModal'
import AssignPermissionsModal from '@features/main/components/roles&permissionManagement/components/AssignPermissionsModal'

// Stock Adjustment modal import
import StockAdjustmentForm from '@features/inventory/components/stockAdjustment/components/StockAdjustmentForm'
import { CompleteSaleModalContent } from '@features/sales/components/POS/components/CompleteSaleModal'
import RecordPurchasePaymentForm from '@features/purchase/components/purchaseOrdersHistory/components/RecordPurchasePaymentForm'
import CreatePurchaseReturnForm from '@features/purchase/components/purchaseReturn/components/CreatePurchaseReturnForm'
import SupplierRatingForm from '@features/purchase/components/purchaseOrdersHistory/components/SupplierRatingForm'
import SaleView from '@features/sales/components/salesHistory/components/SaleHistoryView'
import PayCustomerCreditModal from '@features/sales/components/customers/components/Paycustomercreditmodal'

// ✅ NEW: Credit Management modal imports
import CreditTransactionForm from '@features/sales/components/credits/components/Credittransactionform'
import RecordCreditPaymentForm from '@features/sales/components/credits/components/Recordcreditpaymentform'
import { receiveAllGoodsFromPO } from '@features/purchase/components/purchaseOrdersHistory/data/purchaseOrderHIstory.Queries'

const modalContentMap: Partial<
  Record<NonNullable<RootState['modal']['type']>, React.ComponentType<any>>
> = {
  'add-store': StoreForm,
  'add-area': AreaForm,
  'edit-area': AreaForm,
  'view-area': AreaView,
  'add-user': UserForm,
  'edit-user': UserForm,
  'view-user': UserView,
  'add-medicine': MedicineForm,
  'edit-medicine': MedicineForm,
  'view-medicine': MedicineForm,
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
  'view-role': ViewRoleModal,
  'view-role-users': ViewRoleUsersModal,
  'assign-permissions': AssignPermissionsModal,
  'add-stock-adjustment': StockAdjustmentForm,
  'complete-sale-confirmation': CompleteSaleModalContent,
  'view-sale': SaleView,
  'pay-customer-credit': PayCustomerCreditModal,
  // ✅ NEW: Credit Management modals
  'add-credit-transaction': CreditTransactionForm,
  'record-credit-payment': RecordCreditPaymentForm,
  'receive-goods': 
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
    'view-sale': 'Sale Details',
    // ✅ NEW: Credit Management titles
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

  if (type === 'view-role') {
    return `Role Details${props?.roleData?.role_name ? ` - ${props.roleData.role_name}` : ''}`
  }

  if (type === 'view-role-users') {
    return `Users with ${props?.roleName || 'Role'}`
  }

  if (type === 'assign-permissions') {
    return `Assign Permissions${props?.roleName ? ` - ${props.roleName}` : ''}`
  }

  if (type === 'add-stock-adjustment') {
    return props.mode === 'edit'
      ? 'Edit Stock Adjustment'
      : 'New Stock Adjustment'
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

  // Debug logging
  useEffect(() => {
    if (isOpen) {
      console.log('🔵 GenericModal state changed:', {
        isOpen,
        type,
        size,
        propsKeys: Object.keys(props),
        props: props,
        hasContent: !!content,
      })

      if (type === 'add-user' || type === 'edit-user') {
        console.log('👤 User modal props:', {
          hasAreas: 'areas' in props,
          hasStores: 'stores' in props,
          areasIsArray: Array.isArray(props.areas),
          storesIsArray: Array.isArray(props.stores),
          areasLength: props.areas?.length,
          storesLength: props.stores?.length,
        })
      }

      if (type === 'payment-record') {
        console.log('💰 Payment modal props:', {
          purchaseOrderId: props.purchaseOrderId,
          poNumber: props.poNumber,
          supplierName: props.supplierName,
          totalAmount: props.totalAmount,
          paidAmount: props.paidAmount,
          dueAmount: props.dueAmount,
        })
      }

      if (type === 'view-sale') {
        console.log('🛒 View Sale modal props:', {
          hasSale: 'sale' in props,
          hasSettings: 'settings' in props,
          saleId: props.sale?.id,
          saleNumber: props.sale?.sale_number,
        })
      }

      // ✅ NEW: Credit management modal logging
      if (
        type === 'add-credit-transaction' ||
        type === 'record-credit-payment'
      ) {
        console.log('💳 Credit modal props:', {
          hasCustomers: 'customers' in props,
          customersLength: props.customers?.length,
          hasOnSuccess: 'onSuccess' in props,
        })
      }

      if (type === 'add-credit-tier' || type === 'edit-credit-tier') {
        console.log('🏆 Tier modal props:', {
          mode: props.mode,
          hasTier: 'tier' in props,
          tiersCount: props.tiersCount,
        })
      }
    }
  }, [isOpen, type, size, props, content])

  const handleClose = () => {
    console.log('GenericModal: Closing modal')
    dispatch(closeModal())
  }

  const rendered = useMemo(() => {
    console.log('🔄 GenericModal: Rendering content for type:', type)

    // If custom content is provided, use it directly
    if (content) {
      console.log('GenericModal: Using custom content')
      return content
    }

    // If no type specified, return null
    if (!type) {
      console.log('GenericModal: No type specified')
      return null
    }

    // Get the component from the map
    const Component = modalContentMap[type]

    if (!Component) {
      console.error('❌ GenericModal: Unknown modal type:', type)
      return <div>Unknown modal type: {type}</div>
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

    console.log('✅ GenericModal: Rendering component with key:', key)

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

  // ✅ Always render Modal component, let Mantine handle animations
  return (
    <Modal
      opened={isOpen}
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
      {rendered ?? (
        <Center h={120}>
          <Loader />
        </Center>
      )}
    </Modal>
  )
}

export default GenericModal

