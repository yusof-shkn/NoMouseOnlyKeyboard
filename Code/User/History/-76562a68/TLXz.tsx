// ============================================================
// FILE: src/shared/components/genericModal/SliceGenericModal.ts
// UPDATED: Added 'payment-record' modal type for purchase order payments
// ============================================================
import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { ReactNode } from 'react'

type ModalType =
  | 'add-area'
  | 'edit-area'
  | 'view-area'
  | 'add-store'
  | 'add-user'
  | 'edit-user'
  | 'view-user'
  | 'add-medicine'
  | 'edit-medicine'
  | 'view-medicine'
  | 'barcode-preview'
  | 'add-category'
  | 'add-unit'
  | 'purchase-batch-details'
  | 'purchase-additional-costs'
  | 'sale-batch-details'
  | 'additional-costs'
  | 'prescription-details'
  | 'quotation-details'
  | 'add-supplier'
  | 'add-customer'
  | 'add-credit-transaction'
  | 'view-credit-transaction'
  | 'record-credit-payment'
  | 'add-credit-tier'
  | 'edit-credit-tier'
  | 'payment-record'
  | 'supplier-rating'
  | 'view-sale'
  | 'expense-form'
  | 'expense-details'
  | 'add-expense-category'
  | 'add-role'
  | 'edit-role'
  | 'view-role'
  | 'view-role-users'
  | 'assign-permissions'
  | 'add-stock-adjustment'
  | 'view-stock-adjustment'
  | 'complete-sale-confirmation'
  | 'create-purchase-return'
  | 'pay-customer-credit'
  | 'receive-goods'
  | null

interface ModalState {
  isOpen: boolean
  type: ModalType
  size: string
  props?: Record<string, any>
  content?: ReactNode
}

const initialState: ModalState = {
  isOpen: false,
  type: null,
  size: 'md',
  props: {},
}

const modalSlice = createSlice({
  name: 'modal',
  initialState,
  reducers: {
    openModal: (
      state,
      action: PayloadAction<{
        type: ModalType
        size: string
        props?: Record<string, any>
        content?: ReactNode
      }>,
    ) => {
      state.isOpen = true
      state.type = action.payload.type
      state.size = action.payload.size
      state.props = action.payload.props
      state.content = action.payload.content
    },
    closeModal: (state) => {
      state.isOpen = false
      state.type = null
      state.props = {}
      state.content = undefined
    },
  },
})

export const { openModal, closeModal } = modalSlice.actions
export default modalSlice.reducer

