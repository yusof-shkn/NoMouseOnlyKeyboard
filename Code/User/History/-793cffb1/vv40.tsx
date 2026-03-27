// src/features/purchases/PurchasePOP.tsx
// ✅ REFACTORED: Using shared components from sales feature

import React, { useState, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Button,
  Text,
  TextInput,
  Select,
  Badge,
  Group,
  Stack,
  ActionIcon,
  Paper,
  AppShell,
  Alert,
  Box,
  useMantineTheme,
  useMantineColorScheme,
} from '@mantine/core'
import {
  IconSearch,
  IconX,
  IconUserPlus,
  IconAlertCircle,
  IconEdit,
  IconBarcode,
  IconShoppingCart,
  IconLayoutSidebarRightCollapseFilled,
  IconLayoutSidebarRightCollapse,
  IconCalendar,
  IconCheck,
  IconChevronRight,
} from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'

import { useAuth } from '@shared/contexts/AuthProvider'
import {
  selectCompanyId,
  selectDefaultStoreId,
  selectUserFullName,
  selectCompanySettings,
} from '@features/authentication/authSlice'
import type { RootState } from '@app/core/store/store'
import {
  openModal,
  closeModal,
} from '@shared/components/genericModal/SliceGenericModal'

import { usePurchaseDataOptimized } from './hooks/usePurchaseData'
import { usePurchaseOrder, useFinancialState, useModalState } from './hooks'
import { useBarcodeScanner } from '@features/sales/components/POS/hooks'

// ✅ IMPORT SHARED COMPONENTS FROM SALES FEATURE
import {
  OrderItemCard,
  PurchaseSummary,
  EmptyOrderState,
  TableHeader,
  ProductGridInfiniteScroll,
} from '@shared/components/PointOfSalePurchase'

// ✅ IMPORT COMPLETE PURCHASE MODAL
import { CompletePurchaseModal } from './components/CompletePurchaseModal'

import { PointOfViewPageSkeleton } from '@shared/components/skeletons/PointOfViewPage.skeleton'
import Navbar from '@layout/dashboard/components/navbar/navbar'

import {
  handleSupplierSelect,
  handleTogglePurchasePanel,
  handleAddProduct,
  handleEditOrderItem,
  handleRemoveOrderItem,
  handleSaveBatchDetails,
  handleInlineItemChange,
  handleSubmitPurchaseOrder,
  handleSavePurchaseOrderAsDraft,
  handleApplyAdditionalCosts,
  handleResetOrder,
  handleCancelOrder,
} from './handlers/PurchasePOP.handlers'

import {
  calculatePurchaseTotals,
  formatDateForInput,
} from './utils/PurchasePOP.utils'

// ✅ IMPORT SHARED STYLES FROM SALES FEATURE
import {
  AppContainer,
  MainContent,
  ProductsSection,
  PurchaseSection,
  OrderItemsContainer,
} from '@shared/components/PointOfSalePurchase/styles'

import type {
  PaymentMethodOption,
  OrderItem,
  PaymentMethod,
  Supplier,
  Category,
  PurchaseTotals,
} from './types'
import { handleAddSupplier } from '../suppliers/handlers/suppliersManagement.handlers'
import { isAdmin as checkIsAdmin } from '@shared/constants/roles'
import { selectStore } from '@features/main/main.slice'
import {
  fetchStoreWithId,
  receiveAllGoodsFromPO,
} from './data/PurchasePOP.queries'
import supabase from '@app/core/supabase/Supabase.utils'

const paymentMethods: PaymentMethodOption[] = [
  { value: 'cash', label: 'Cash', icon: '💵' },
  { value: 'card', label: 'Card', icon: '💳' },
  { value: 'bank_transfer', label: 'Bank Transfer', icon: '🏦' },
  { value: 'credit', label: 'Credit', icon: '💰' },
  { value: 'mobile_money', label: 'Mobile Money', icon: '📱' },
]

export const PurchasePOP: React.FC = () => {
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const location = useLocation()

  // ✅ THEME HOOKS
  const theme = useMantineTheme()
  const { colorScheme } = useMantineColorScheme()
  const isDark = colorScheme === 'dark'
  const height = '3.5rem'

  const { isAuthenticated, isAuthInitialized, user: authUser } = useAuth()
  const companyId = useSelector(selectCompanyId)
  const defaultStoreId = useSelector(selectDefaultStoreId)
  const userName = useSelector(selectUserFullName)
  const companySettings = useSelector(selectCompanySettings)

  const selectedStore = useSelector(
    (state: RootState) => state.areaStore?.selectedStore,
  )

  const editModeStoreId = location.state?.purchaseOrderData?.store_id

  let storeId: number | null = null

  if (editModeStoreId) {
    storeId = editModeStoreId
  } else if (selectedStore?.id) {
    storeId = selectedStore.id
  } else if (authUser?.profile.default_store_id) {
    storeId = authUser.profile.default_store_id
  } else if (defaultStoreId) {
    storeId = defaultStoreId
  }

  const getUserProfileId = (): number | null => {
    if (authUser?.profile?.id && typeof authUser.profile.id === 'number') {
      return authUser.profile.id
    }
    if (authUser?.id && typeof authUser.id === 'number') {
      return authUser.id
    }
    return null
  }

  const userRoleId = authUser?.profile?.role_id || 7
  const isAdmin = checkIsAdmin(userRoleId)

  useEffect(() => {
    const loadStoreData = async () => {
      if (storeId) {
        try {
          const storeData = await fetchStoreWithId(storeId)
          if (storeData) {
            if (selectedStore?.id !== storeId) {
              dispatch(selectStore(storeData))
              if (editModeStoreId && editModeStoreId !== selectedStore?.id) {
                notifications.show({
                  title: 'Store Context Switched',
                  message: `Now working in: ${storeData.store_name}`,
                  color: 'blue',
                  icon: '🏪',
                })
              }
            }
          }
        } catch (error) {
          console.error('Error fetching store data:', error)
        }
      }
    }
    loadStoreData()
  }, [storeId, dispatch, editModeStoreId, selectedStore?.id])

  useEffect(() => {
    if (isAuthInitialized && isAuthenticated && companyId && userRoleId) {
      if (!isAdmin && !storeId) {
        navigate('/no-store-access')
        return
      }
      if (isAdmin && !storeId && !editModeStoreId) {
        notifications.show({
          title: 'No Store Selected',
          message: 'Please select a store to continue with purchases.',
          color: 'orange',
        })
        navigate('/stores-management')
        return
      }
      if (!isAdmin && editModeStoreId && storeId !== editModeStoreId) {
        notifications.show({
          title: 'Access Denied',
          message: 'You do not have access to edit this purchase order.',
          color: 'red',
        })
        navigate('/purchases/order-history')
        return
      }
    }
  }, [
    isAuthInitialized,
    isAuthenticated,
    companyId,
    storeId,
    userRoleId,
    isAdmin,
    navigate,
    editModeStoreId,
  ])

  const safeCompanyId = companyId ? Number(companyId) : 0
  const safeStoreId = storeId ? Number(storeId) : 0

  // Extract settings from Redux companySettings
  const taxRate = companySettings?.tax_rate || 0
  const currency =
    companySettings?.default_currency || companySettings?.base_currency || 'UGX'
  const requiresApproval = companySettings?.require_purchase_approval ?? false
  const poPrefix = companySettings?.po_prefix || 'PO'
  const documentPadding = companySettings?.document_number_padding || 5
  const autoIncrementDocuments =
    companySettings?.auto_increment_documents ?? true
  const defaultCreditDays = companySettings?.default_credit_days || 30

  const {
    products,
    categories,
    suppliers,
    units,
    isLoading,
    isLoadingMore,
    loadError,
    hasMore,
    totalCount,
    searchQuery,
    selectedCategoryId,
    loadMore,
    handleSearch,
    handleCategoryFilter,
    refreshProducts,
  } = usePurchaseDataOptimized(safeCompanyId, safeStoreId)

  const {
    orderItems,
    setOrderItems,
    selectedPayment,
    setSelectedPayment,
    invoiceNumber,
    setInvoiceNumber,
  } = usePurchaseOrder(safeCompanyId, safeStoreId)

  const {
    taxPercentage,
    setTaxPercentage,
    coupon,
    setCoupon,
    discount,
    setDiscount,
    shipping,
    setShipping,
    resetFinancials,
  } = useFinancialState({ initialTaxRate: taxRate })

  const { currentEditItem, setCurrentEditItem } = useModalState()

  const [selectedSupplier, setSelectedSupplier] = useState<string | null>(null)
  const [isPurchasePanelHidden, setIsPurchasePanelHidden] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [orderDate, setOrderDate] = useState(formatDateForInput())
  const [initialDataLoading, setInitialDataLoading] = useState(true)
  const [localSearchQuery, setLocalSearchQuery] = useState('')
  const [receiveImmediately, setReceiveImmediately] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [editingPOId, setEditingPOId] = useState<number | null>(null)
  const [editingPOStatus, setEditingPOStatus] = useState<string | null>(null)

  // ✅ NEW: Complete Purchase Modal state
  const [completePurchaseModalOpen, setCompletePurchaseModalOpen] =
    useState(false)

  const { detectAndProcessBarcode, handleEnterKey } = useBarcodeScanner(
    safeCompanyId,
    safeStoreId,
    (item) => {
      setCurrentEditItem(item)
      handleOpenBatchModalWithItem(item)
    },
  )

  useEffect(() => {
    if (!isLoading && (products.length > 0 || loadError)) {
      setInitialDataLoading(false)
    }
  }, [isLoading, products.length, loadError])

  useEffect(() => {
    const loadPurchaseOrderForEdit = async () => {
      if (location.state?.editMode && location.state?.purchaseOrderData) {
        const poData = location.state.purchaseOrderData

        if (poData.store_id !== storeId) {
          notifications.show({
            title: 'Store Mismatch',
            message: 'Cannot edit this purchase order. Store context error.',
            color: 'red',
          })
          navigate('/purchases/order-history')
          return
        }

        setEditMode(true)
        setEditingPOId(poData.id)
        setEditingPOStatus(poData.status)
        setSelectedSupplier(poData.supplier_id?.toString() || null)
        setInvoiceNumber(poData.po_number)
        setOrderDate(poData.po_date || formatDateForInput())

        try {
          const { data: items, error } = await supabase
            .from('purchase_order_items')
            .select(
              `
            *,
            product:products!inner(
              id,
              product_name,
              product_code,
              unit:units(short_code)
            )
          `,
            )
            .eq('purchase_order_id', poData.id)

          if (error) throw error

          if (items && items.length > 0) {
            const loadedItems = items.map((item: any) => ({
              id: item.product_id,
              productName: item.product.product_name,
              productCode: item.product.product_code,
              unit: item.product.unit?.short_code || 'Unit',
              batchNumber: item.batch_number,
              batchId: null,
              qty: item.quantity_ordered,
              price: item.unit_cost,
              costPrice: item.unit_cost,
              expiryDate: item.expiry_date || null,
              subtotal: item.quantity_ordered * item.unit_cost,
              availableStock: 0,
              discountAmount: 0,
            }))

            setOrderItems(loadedItems)
          }

          if (poData.tax_amount && poData.subtotal) {
            const taxPerc = (poData.tax_amount / poData.subtotal) * 100
            setTaxPercentage(taxPerc)
          }
          setDiscount(poData.discount_amount || 0)

          notifications.show({
            title: 'Edit Mode',
            message: `Editing PO ${poData.po_number}`,
            color: 'blue',
            icon: <IconEdit size={18} />,
          })
        } catch (error: any) {
          notifications.show({
            title: 'Error',
            message: error.message || 'Failed to load purchase order items',
            color: 'red',
          })
          navigate('/purchases/order-history')
        }
      }
    }

    loadPurchaseOrderForEdit()
  }, [location.state, storeId, navigate])

  const totals = calculatePurchaseTotals(
    orderItems,
    taxPercentage,
    shipping,
    coupon,
    discount,
  )

  const handleOpenBatchModalWithItem = (item: OrderItem) => {
    setCurrentEditItem(item)
    dispatch(
      openModal({
        type: 'purchase-batch-details',
        size: 'md',
        props: {
          itemData: item,
          units: units,
        },
      }),
    )
  }

  const handleCloseBatchModal = () => {
    dispatch(closeModal())
    setCurrentEditItem(null)
  }

  const handleSaveBatchDetailsFromModal = (updatedItem: OrderItem) => {
    try {
      handleSaveBatchDetails(
        updatedItem,
        orderItems,
        setOrderItems,
        () => {
          handleCloseBatchModal()
        },
        safeCompanyId,
        safeStoreId,
      )
    } catch (error) {
      notifications.show({
        title: 'Error',
        message:
          error instanceof Error ? error.message : 'An unknown error occurred',
        color: 'red',
      })
    }
  }

  const handleOpenAdditionalCostsModal = () => {
    dispatch(
      openModal({
        type: 'additional-costs',
        size: 'sm',
        props: {
          taxPercentage,
          shipping,
          coupon,
          discount,
          totals,
        },
      }),
    )
  }

  const handleApplyAdditionalCostsFromModal = (updatedValues: {
    taxPercentage: number
    shipping: number
    coupon: number
    discount: number
  }) => {
    const validation = handleApplyAdditionalCosts(
      updatedValues.taxPercentage,
      updatedValues.shipping,
      updatedValues.coupon,
      updatedValues.discount,
      totals.subTotal,
      () => {
        setTaxPercentage(updatedValues.taxPercentage)
        setShipping(updatedValues.shipping)
        setCoupon(updatedValues.coupon)
        setDiscount(updatedValues.discount)
        dispatch(closeModal())
      },
    )

    if (!validation.isValid) {
      notifications.show({
        title: 'Validation Error',
        message: validation.errors.join('\n'),
        color: 'red',
      })
    }
  }

  const handleCancelAdditionalCostsModal = () => {
    dispatch(closeModal())
  }

  const onAddProduct = (product: any) => {
    handleAddProduct(
      product,
      null,
      orderItems,
      safeCompanyId,
      safeStoreId,
      (item) => {
        setCurrentEditItem(item)
        handleOpenBatchModalWithItem(item)
      },
    )
  }

  const onEditOrderItem = (item: any) => {
    handleEditOrderItem(item, (editItem) => {
      setCurrentEditItem(editItem)
      handleOpenBatchModalWithItem(editItem)
    })
  }

  const onRemoveOrderItem = (index: number) => {
    handleRemoveOrderItem(
      index,
      orderItems,
      setOrderItems,
      safeCompanyId,
      safeStoreId,
    )
  }

  const onInlineItemChange = (
    index: number,
    field: 'qty' | 'price',
    value: number,
  ) => {
    handleInlineItemChange(
      index,
      field,
      value,
      orderItems,
      setOrderItems,
      safeCompanyId,
      safeStoreId,
    )
  }

  const onResetOrder = () => {
    handleResetOrder(
      setOrderItems,
      setSelectedPayment,
      safeCompanyId,
      safeStoreId,
    )
    resetFinancials(taxRate)
    setInvoiceNumber('')
    setOrderDate(formatDateForInput())
    setReceiveImmediately(false)
  }

  const onCancelOrder = () => {
    handleCancelOrder(onResetOrder)
  }

  const onSaveDraft = async () => {
    if (editMode && editingPOStatus !== 'draft') return

    setIsSubmitting(true)
    try {
      if (editMode && editingPOId) {
        if (orderItems.length === 0) {
          throw new Error('Please add items to save as draft')
        }

        const updateData: any = {
          supplier_id: selectedSupplier ? parseInt(selectedSupplier) : null,
          po_date: orderDate,
          subtotal: totals.subTotal,
          tax_amount: totals.tax,
          discount_amount: discount,
          total_amount: totals.grandTotal,
          payment_terms: `Net ${defaultCreditDays}`,
          notes: invoiceNumber
            ? `Supplier Invoice: ${invoiceNumber}`
            : 'Draft Order',
          status: 'draft' as const,
          updated_at: new Date().toISOString(),
        }

        const { error: poError } = await supabase
          .from('purchase_orders')
          .update(updateData)
          .eq('id', editingPOId)

        if (poError)
          throw new Error(`Failed to update draft: ${poError.message}`)

        const { error: deleteError } = await supabase
          .from('purchase_order_items')
          .delete()
          .eq('purchase_order_id', editingPOId)

        if (deleteError) throw deleteError

        const productIds = orderItems.map((item) => item.id)
        const { data: products, error: productsError } = await supabase
          .from('products')
          .select('id, unit_id')
          .in('id', productIds)

        if (productsError) throw productsError

        const productUnitMap = new Map(
          products?.map((p) => [p.id, p.unit_id]) || [],
        )

        const itemsToInsert = orderItems.map((item) => ({
          purchase_order_id: editingPOId,
          product_id: item.id,
          unit_id: productUnitMap.get(item.id),
          batch_number: item.batchNumber || 'DRAFT-BATCH',
          quantity_ordered: item.qty,
          quantity_received: 0,
          unit_cost: item.price,
          discount_amount: 0,
          total_cost: item.qty * item.price,
          manufacture_date: null,
          expiry_date: item.expiryDate || null,
        }))

        const { error: itemsError } = await supabase
          .from('purchase_order_items')
          .insert(itemsToInsert)

        if (itemsError) throw itemsError

        notifications.show({
          title: 'Draft Updated',
          message: `Purchase Order ${invoiceNumber} updated successfully`,
          color: 'blue',
        })

        navigate('/purchases/order-history')
      } else {
        const userId = getUserProfileId()

        await handleSavePurchaseOrderAsDraft(
          orderItems,
          totals,
          safeCompanyId,
          safeStoreId,
          selectedSupplier ? parseInt(selectedSupplier) : null,
          taxPercentage,
          shipping,
          coupon,
          discount,
          userId,
          invoiceNumber,
          orderDate,
          selectedPayment,
          (poNumber) => {
            notifications.show({
              title: 'Draft Saved',
              message: `Purchase Order ${poNumber} saved as draft`,
              color: 'blue',
            })
            onResetOrder()
          },
          (error) => {
            notifications.show({
              title: 'Error Saving Draft',
              message: error,
              color: 'red',
            })
          },
          {
            po_prefix: poPrefix,
            document_number_padding: documentPadding,
            auto_increment_documents: autoIncrementDocuments,
            require_purchase_approval: requiresApproval,
            default_credit_days: defaultCreditDays,
          },
        )
      }
    } catch (error: any) {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to save draft',
        color: 'red',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // ✅ Called when user clicks the main CTA — opens the modal instead of submitting
  const onOpenCompletePurchase = () => {
    setCompletePurchaseModalOpen(true)
  }

  
const onSubmitOrder = async (receiveInvoiceNumber?: string) => {
  setIsSubmitting(true)

  // Prefer the invoice number entered inside the modal (when receiveImmediately
  // is on) over the one typed in the POP panel.
  const effectiveInvoiceNumber = receiveInvoiceNumber?.trim() || invoiceNumber

  try {
    const userId = getUserProfileId()

    if (receiveImmediately && !isAdmin) {
      throw new Error('Only administrators can receive goods immediately')
    }

    if (editMode && editingPOId) {
      if (orderItems.length === 0)
        throw new Error('Please add items to the order')
      if (!selectedSupplier) throw new Error('Please select a supplier')

      const itemsWithoutBatch = orderItems.filter((item) => !item.batchNumber)
      if (itemsWithoutBatch.length > 0) {
        throw new Error('All items must have batch numbers')
      }

      let newStatus: string

      if (receiveImmediately && isAdmin) {
        newStatus = 'approved'
      } else if (editingPOStatus === 'draft') {
        newStatus = requiresApproval ? 'pending' : 'approved'
      } else if (editingPOStatus === 'pending' && !requiresApproval) {
        newStatus = 'approved'
      } else {
        newStatus = editingPOStatus
      }

      const now = new Date().toISOString()

      const updateData: any = {
        supplier_id: parseInt(selectedSupplier),
        po_date: orderDate,
        subtotal: totals.subTotal,
        tax_amount: totals.tax,
        discount_amount: discount,
        total_amount: totals.grandTotal,
        payment_terms: `Net ${defaultCreditDays}`,
        notes: effectiveInvoiceNumber
          ? `Supplier Invoice: ${effectiveInvoiceNumber}`
          : undefined,
        updated_at: now,
      }

      if (newStatus === 'approved' && editingPOStatus === 'draft') {
        updateData.approved_at = now
        updateData.approved_by = userId
      }

      const { error: poError } = await supabase
        .from('purchase_orders')
        .update(updateData)
        .eq('id', editingPOId)

      if (poError) throw new Error(`Failed to update PO: ${poError.message}`)

      const { error: statusError } = await supabase.rpc('set_po_status', {
        p_po_id: editingPOId,
        p_status: newStatus,
      })

      if (statusError)
        throw new Error(`Failed to update status: ${statusError.message}`)

      if (receiveImmediately && isAdmin) {
        await receiveAllGoodsFromPO(editingPOId, safeCompanyId, userId, {
          invoiceNumber: effectiveInvoiceNumber,
          invoiceDate: new Date().toISOString(),
        })

        setCompletePurchaseModalOpen(false)
        notifications.show({
          title: 'Order Updated & Received',
          message: `PO ${effectiveInvoiceNumber || editingPOId} updated and inventory updated`,
          color: 'green',
        })

        const { data: supplierData } = await supabase
          .from('suppliers')
          .select('rating')
          .eq('id', parseInt(selectedSupplier))
          .single()

        dispatch(
          openModal({
            type: 'supplier-rating',
            size: 'lg',
            props: {
              purchaseOrderId: editingPOId,
              poNumber: effectiveInvoiceNumber || String(editingPOId),
              supplierId: parseInt(selectedSupplier),
              supplierName: suppliers.find(
                (s) => s.id === parseInt(selectedSupplier),
              )?.supplier_name,
              totalAmount: totals.grandTotal,
              currentRating: supplierData?.rating || 0,
            },
          }),
        )
      } else {
        setCompletePurchaseModalOpen(false)
        notifications.show({
          title: 'Purchase Order Updated',
          message:
            requiresApproval && newStatus === 'pending'
              ? `PO updated and submitted for approval`
              : `PO updated successfully!`,
          color:
            requiresApproval && newStatus === 'pending' ? 'orange' : 'green',
        })
      }

      navigate('/purchases/order-history')
    } else {
      await handleSubmitPurchaseOrder(
        orderItems,
        totals,
        safeCompanyId,
        safeStoreId,
        selectedSupplier ? parseInt(selectedSupplier) : null,
        taxPercentage,
        shipping,
        coupon,
        discount,
        userId,
        effectiveInvoiceNumber, // ← use effective value
        orderDate,
        receiveImmediately,
        selectedPayment,
        isAdmin,
        async (poNumber, poId, finalStatus, requiresApprovalFlag) => {
          if (receiveImmediately && isAdmin && finalStatus === 'received') {
            const { data: supplierData } = await supabase
              .from('suppliers')
              .select('rating')
              .eq('id', parseInt(selectedSupplier!))
              .single()

            setCompletePurchaseModalOpen(false)
            notifications.show({
              title: 'Order Created & Received',
              message: `PO ${poNumber} created and inventory updated`,
              color: 'green',
            })

            dispatch(
              openModal({
                type: 'supplier-rating',
                size: 'lg',
                props: {
                  purchaseOrderId: poId,
                  poNumber: poNumber,
                  supplierId: parseInt(selectedSupplier!),
                  supplierName: suppliers.find(
                    (s) => s.id === parseInt(selectedSupplier!),
                  )?.supplier_name,
                  totalAmount: totals.grandTotal,
                  currentRating: supplierData?.rating || 0,
                },
              }),
            )
          } else {
            setCompletePurchaseModalOpen(false)
            notifications.show({
              title: 'Purchase Order Created',
              message: requiresApprovalFlag
                ? `PO ${poNumber} created and requires approval`
                : `PO ${poNumber} created successfully!`,
              color: requiresApprovalFlag ? 'orange' : 'green',
            })
          }

          onResetOrder()
        },
        (error) => {
          notifications.show({
            title: 'Error Creating Order',
            message: error,
            color: 'red',
          })
        },
        {
          po_prefix: poPrefix,
          document_number_padding: documentPadding,
          auto_increment_documents: autoIncrementDocuments,
          require_purchase_approval: requiresApproval,
          default_credit_days: defaultCreditDays,
        },
      )
    }
  } catch (error: any) {
    notifications.show({
      title: 'Error',
      message: error.message || 'Failed to submit order',
      color: 'red',
    })
  } finally {
    setIsSubmitting(false)
  }
}
  const handlePaymentSelect = (value: string) => {
    setSelectedPayment(value as PaymentMethod)
  }

  const handleSearchChange = async (value: string) => {
    setLocalSearchQuery(value)
    const result = await detectAndProcessBarcode(value)
    if (result?.shouldClear) {
      setLocalSearchQuery('')
      return
    }
    handleSearch(value)
  }

  const handleCategoryChange = (categoryId: number | null) => {
    handleCategoryFilter(categoryId)
  }

  useEffect(() => {
    ;(window as any).__purchaseModalHandlers = {
      onSaveBatchDetails: handleSaveBatchDetailsFromModal,
      onCancelBatchDetails: handleCloseBatchModal,
      onApplyAdditionalCosts: handleApplyAdditionalCostsFromModal,
      onCancelAdditionalCosts: handleCancelAdditionalCostsModal,
      currentEditItem: currentEditItem,
      setCurrentEditItem: setCurrentEditItem,
      units: units,
    }

    return () => {
      delete (window as any).__purchaseModalHandlers
    }
  }, [currentEditItem, orderItems, totals, units])

  const purchaseTotals: PurchaseTotals = {
    subTotal: totals.subTotal,
    tax: totals.tax,
    shipping: totals.shipping,
    coupon: totals.coupon,
    discount: totals.discount,
    grandTotal: totals.grandTotal,
    taxPercentage: totals.taxPercentage,
  }

  if (!isAuthInitialized) {
    return <PointOfViewPageSkeleton />
  }

  if (!isAuthenticated) {
    return (
      <AppContainer>
        <Box
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            backgroundColor: isDark ? theme.colors.dark[7] : theme.white,
          }}
        >
          <Paper
            p="xl"
            withBorder
            style={{ maxWidth: '400px', textAlign: 'center' }}
          >
            <Stack
              gap="md"
              align="center"
            >
              <IconX
                size={48}
                color={theme.colors.red[6]}
              />
              <Text
                size="lg"
                fw={600}
              >
                Authentication Required
              </Text>
              <Text
                size="sm"
                c="dimmed"
              >
                Please log in to access this page.
              </Text>
              <Button
                onClick={() => navigate('/login')}
                color={theme.primaryColor}
                fullWidth
              >
                Go to Login
              </Button>
            </Stack>
          </Paper>
        </Box>
      </AppContainer>
    )
  }

  if (!companyId || isNaN(Number(companyId))) {
    return (
      <AppContainer>
        <Box
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            backgroundColor: isDark ? theme.colors.dark[7] : theme.white,
          }}
        >
          <Paper
            p="xl"
            withBorder
            style={{ maxWidth: '400px', textAlign: 'center' }}
          >
            <Stack
              gap="md"
              align="center"
            >
              <IconX
                size={48}
                color={theme.colors.red[6]}
              />
              <Text
                size="lg"
                fw={600}
              >
                Configuration Error
              </Text>
              <Text
                size="sm"
                c="dimmed"
              >
                Company information not found. Please contact your
                administrator.
              </Text>
            </Stack>
          </Paper>
        </Box>
      </AppContainer>
    )
  }

  if (!userRoleId && isAuthInitialized && isAuthenticated) {
    return <PointOfViewPageSkeleton />
  }

  if (initialDataLoading && isLoading) {
    return <PointOfViewPageSkeleton />
  }

  if (loadError) {
    return (
      <AppContainer>
        <Box
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            backgroundColor: isDark ? theme.colors.dark[7] : theme.white,
          }}
        >
          <Paper
            p="xl"
            withBorder
            style={{ maxWidth: '500px', textAlign: 'center' }}
          >
            <Stack
              gap="md"
              align="center"
            >
              <IconX
                size={48}
                color={theme.colors.red[6]}
              />
              <Text
                size="lg"
                fw={600}
              >
                Error Loading Data
              </Text>
              <Text
                size="sm"
                c="dimmed"
              >
                {loadError}
              </Text>
              <Button
                onClick={() => window.location.reload()}
                color={theme.primaryColor}
                fullWidth
              >
                Refresh Page
              </Button>
            </Stack>
          </Paper>
        </Box>
      </AppContainer>
    )
  }

  return (
    <AppContainer>
      {/* ── Complete Purchase Modal ───────────────────────────────────────── */}
      <CompletePurchaseModal
        opened={completePurchaseModalOpen}
        onClose={() => setCompletePurchaseModalOpen(false)}
        onConfirm={onSubmitOrder}
        totals={purchaseTotals}
        currency={currency}
        isAdmin={isAdmin}
        isSubmitting={isSubmitting}
        editMode={editMode}
        invoiceNumber={invoiceNumber}
        orderItemsCount={orderItems.length}
        paymentMethods={paymentMethods}
        selectedPayment={selectedPayment}
        onSelectPayment={handlePaymentSelect}
        receiveImmediately={receiveImmediately}
        onToggleReceiveImmediately={setReceiveImmediately}
      />

      <AppShell>
        <Box style={{ height: '3.2rem' }}>
          <Navbar showSearch={false} />
        </Box>

        <AppShell.Main>
          <MainContent>
            {/* ── Products Panel ──────────────────────────────────────────── */}
            <ProductsSection
              $fullWidth={isPurchasePanelHidden}
              style={{
                backgroundColor: isDark ? theme.colors.dark[7] : theme.white,
                borderRight: `1px solid ${isDark ? theme.colors.dark[4] : theme.colors.gray[3]}`,
              }}
            >
              <Stack
                gap="sm"
                mb="md"
              >
                <Group
                  gap="md"
                  justify="space-between"
                  wrap="nowrap"
                  align="stretch"
                >
                  <TextInput
                    placeholder="Search by name, SKU, or scan barcode"
                    leftSection={<IconSearch size={18} />}
                    rightSection={
                      <Group
                        gap={4}
                        wrap="nowrap"
                      >
                        {localSearchQuery && (
                          <ActionIcon
                            size="sm"
                            variant="subtle"
                            color="gray"
                            onClick={() => {
                              setLocalSearchQuery('')
                              handleSearch('')
                            }}
                          >
                            <IconX size={14} />
                          </ActionIcon>
                        )}
                      </Group>
                    }
                    value={localSearchQuery}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    styles={{
                      input: { height, fontSize: 14 },
                    }}
                    style={{ flex: 1, minWidth: 0 }}
                  />

                  <Paper
                    withBorder
                    style={{
                      height,
                      display: 'flex',
                      alignItems: 'center',
                      paddingInline: 12,
                      backgroundColor: isDark
                        ? theme.colors.dark[6]
                        : theme.white,
                      borderColor: isDark
                        ? theme.colors.dark[4]
                        : theme.colors.gray[3],
                    }}
                  >
                    <Box style={{ textAlign: 'center' }}>
                      <Text
                        size="sm"
                        fw={700}
                        c={theme.primaryColor}
                      >
                        {totalCount.toLocaleString()}
                      </Text>
                      <Text
                        size="xs"
                        c="dimmed"
                      >
                        Products
                      </Text>
                    </Box>
                  </Paper>

                  <ActionIcon
                    variant="light"
                    color={theme.primaryColor}
                    style={{ height, width: height }}
                    onClick={() =>
                      handleTogglePurchasePanel(
                        isPurchasePanelHidden,
                        setIsPurchasePanelHidden,
                      )
                    }
                  >
                    {isPurchasePanelHidden ? (
                      <IconLayoutSidebarRightCollapse size={18} />
                    ) : (
                      <IconLayoutSidebarRightCollapseFilled size={18} />
                    )}
                  </ActionIcon>
                </Group>

                <Box
                  style={{
                    position: 'relative',
                    width: '100%',
                  }}
                >
                  <Group
                    gap="xs"
                    wrap="nowrap"
                    style={{
                      overflowX: 'auto',
                      overflowY: 'hidden',
                      display: 'flex',
                      flexWrap: 'nowrap',
                      WebkitOverflowScrolling: 'touch',
                      scrollbarWidth: 'none', // Firefox
                      msOverflowStyle: 'none', // IE/Edge
                    }}
                  >
                    <Button
                      size="xs"
                      variant={selectedCategoryId === null ? 'filled' : 'light'}
                      color={theme.primaryColor}
                      onClick={() => handleCategoryChange(null)}
                      radius="md"
                      style={{ flexShrink: 0 }}
                    >
                      All
                    </Button>
                    {categories.map((category: Category) => (
                      <Button
                        key={category.id}
                        size="xs"
                        variant={
                          selectedCategoryId === category.id
                            ? 'filled'
                            : 'light'
                        }
                        color={theme.primaryColor}
                        onClick={() => handleCategoryChange(category.id)}
                        radius="md"
                        style={{ flexShrink: 0 }}
                      >
                        {category.category_name}
                      </Button>
                    ))}
                  </Group>

                  {/* Gradient fade indicator */}
                  <Box
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: 0,
                      bottom: 0,
                      width: '60px',
                      background: isDark
                        ? `linear-gradient(to right, transparent, ${theme.colors.dark[7]})`
                        : `linear-gradient(to right, transparent, ${theme.white})`,
                      pointerEvents: 'none',
                      zIndex: 1,
                    }}
                  />

                  {/* Optional: Arrow icon on the right */}
                  <Box
                    style={{
                      position: 'absolute',
                      right: '8px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      pointerEvents: 'none',
                      zIndex: 2,
                      opacity: 0.6,
                    }}
                  >
                    <IconChevronRight
                      size={16}
                      color={
                        isDark ? theme.colors.dark[1] : theme.colors.gray[7]
                      }
                    />
                  </Box>
                </Box>
              </Stack>

              <ProductGridInfiniteScroll
                products={products}
                isLoading={isLoading}
                isLoadingMore={isLoadingMore}
                hasMore={hasMore}
                onLoadMore={loadMore}
                onAddProduct={onAddProduct}
                totalCount={totalCount}
              />
            </ProductsSection>

            {/* ── Purchase Panel ───────────────────────────────────────────── */}
            <PurchaseSection
              $hidden={isPurchasePanelHidden}
              style={{
                backgroundColor: isDark
                  ? theme.colors.dark[6]
                  : theme.colors.gray[0],
              }}
            >
              <Stack
                gap="sm"
                style={{ height: '100%', overflow: 'hidden' }}
              >
                {/* ── Order meta ─────────────────────────────────────────── */}
                <Paper
                  p="sm"
                  withBorder
                  style={{
                    borderColor: isDark
                      ? theme.colors.dark[4]
                      : theme.colors.gray[3],
                    backgroundColor: isDark
                      ? theme.colors.dark[7]
                      : theme.white,
                  }}
                >
                  <Stack gap="sm">
                    {/* Date + Invoice — no labels */}
                    <Group
                      gap="xs"
                      grow
                    >
                      <TextInput
                        type="date"
                        size="sm"
                        value={orderDate}
                        onChange={(e) => setOrderDate(e.target.value)}
                        leftSection={<IconCalendar size={16} />}
                        placeholder="Order date"
                      />
                      <TextInput
                        placeholder="Invoice #"
                        size="sm"
                        value={invoiceNumber}
                        onChange={(e) => setInvoiceNumber(e.target.value)}
                      />
                    </Group>

                    {/* Supplier — no label */}
                    {suppliers.length === 0 ? (
                      <Alert
                        icon={<IconAlertCircle size={16} />}
                        color="orange"
                        variant="light"
                      >
                        <Group
                          justify="space-between"
                          align="center"
                        >
                          <Text
                            size="xs"
                            fw={500}
                          >
                            No suppliers found
                          </Text>
                          <Button
                            size="xs"
                            variant="light"
                            color="orange"
                            onClick={() => handleAddSupplier(dispatch)}
                            leftSection={<IconUserPlus size={14} />}
                          >
                            Add Supplier
                          </Button>
                        </Group>
                      </Alert>
                    ) : (
                      <Group
                        gap="xs"
                        align="center"
                      >
                        <Select
                          placeholder="Select supplier"
                          size="sm"
                          data={suppliers.map((s: Supplier) => ({
                            value: String(s.id),
                            label: s.supplier_name,
                          }))}
                          value={selectedSupplier}
                          onChange={(value) =>
                            handleSupplierSelect(value, setSelectedSupplier)
                          }
                          style={{ flex: 1 }}
                        />
                        <ActionIcon
                          size="lg"
                          variant="light"
                          color={theme.primaryColor}
                          onClick={() => handleAddSupplier(dispatch)}
                        >
                          <IconUserPlus size={18} />
                        </ActionIcon>
                      </Group>
                    )}

                    {editMode && (
                      <Badge
                        size="lg"
                        variant="light"
                        color="blue"
                        leftSection={<IconEdit size={14} />}
                      >
                        Editing: {invoiceNumber}
                      </Badge>
                    )}
                  </Stack>
                </Paper>

                {/* ── Order items header ─────────────────────────────────── */}
                <Group justify="space-between">
                  <Text
                    size="sm"
                    fw={600}
                  >
                    Order Details
                  </Text>
                  <Badge
                    size="sm"
                    color={theme.primaryColor}
                  >
                    {orderItems.length} Items
                  </Badge>
                </Group>

                {/* ── Order items list ───────────────────────────────────── */}
                {orderItems.length === 0 ? (
                  <EmptyOrderState />
                ) : (
                  <>
                    <TableHeader />
                    <OrderItemsContainer>
                      {orderItems.map((item, index) => (
                        <OrderItemCard
                          key={`${item.id}-${item.batchNumber}-${index}`}
                          item={item}
                          index={index}
                          onEdit={onEditOrderItem}
                          onRemove={onRemoveOrderItem}
                          onInlineChange={onInlineItemChange}
                        />
                      ))}
                    </OrderItemsContainer>
                  </>
                )}

                {/* ── Purchase summary ───────────────────────────────────── */}
                <PurchaseSummary
                  totals={purchaseTotals}
                  shipping={shipping}
                  coupon={coupon}
                  discount={discount}
                  onEditCosts={handleOpenAdditionalCostsModal}
                />

                {/* ── Secondary actions ──────────────────────────────────── */}
                <Group
                  gap="xs"
                  grow
                >
                  <Button
                    size="sm"
                    variant="light"
                    color="red"
                    onClick={onCancelOrder}
                    leftSection={<IconX size={16} />}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    variant="light"
                    color={theme.primaryColor}
                    onClick={onResetOrder}
                  >
                    Reset
                  </Button>
                  {(!editMode || editingPOStatus === 'draft') && (
                    <Button
                      size="sm"
                      variant="light"
                      color="blue"
                      disabled={orderItems.length === 0 || isSubmitting}
                      onClick={onSaveDraft}
                    >
                      {editMode ? 'Update' : 'Save'} Draft
                    </Button>
                  )}
                </Group>

                {/* ── Primary CTA — opens Complete Purchase modal ────────── */}
                <Button
                  size="md"
                  fullWidth
                  color={theme.primaryColor}
                  disabled={
                    orderItems.length === 0 ||
                    !selectedSupplier ||
                    !invoiceNumber ||
                    isSubmitting
                  }
                  onClick={onOpenCompletePurchase}
                  leftSection={<IconCheck size={18} />}
                >
                  {editMode ? 'Review & Update' : 'Review & Create'}
                </Button>
              </Stack>
            </PurchaseSection>
          </MainContent>
        </AppShell.Main>
      </AppShell>
    </AppContainer>
  )
}

export default PurchasePOP


