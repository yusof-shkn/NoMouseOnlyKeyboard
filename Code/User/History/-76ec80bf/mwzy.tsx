// src/features/sales/salesPOS.enhanced.tsx
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
  Modal,
  Textarea,
  NumberInput,
  Box,
  useMantineTheme,
  useMantineColorScheme,
} from '@mantine/core'
import {
  IconSearch,
  IconX,
  IconPrescription,
  IconUserPlus,
  IconAlertTriangle,
  IconCheck,
  IconInfoCircle,
  IconCalendar,
  IconEdit,
  IconShoppingCart,
  IconBuildingStore,
  IconCreditCard,
  IconChevronRight,
  IconLayoutSidebarRightCollapse,
  IconLayoutSidebarRightCollapseFilled,
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
import { useSaleDataOptimized } from './hooks/useSaleData'
import { useSaleOrder, useFinancialState, useModalState } from './hooks'
import { useBarcodeScanner } from './hooks/useBarcodeScanner'

import { PointOfViewPageSkeleton } from '@shared/components/skeletons/PointOfViewPage.skeleton'
import Navbar from '@layout/dashboard/components/navbar/navbar'
import {
  handleCustomerSelect,
  handleToggleSalePanel,
  handleAddProduct,
  handleEditOrderItem,
  handleRemoveOrderItem,
  handleSaveBatchDetails,
  handleInlineItemChange,
  handleSubmitSale,
  handleApplyAdditionalCosts,
  handleResetOrder,
  handleCancelOrder,
  handleSaleTypeToggle,
  handleOpenCompleteSaleModal,
  fetchCustomerCreditInfo,
  validateCreditForUI,
} from './handlers/SalesPOS.handlers'
import { calculateSaleTotals, formatDateForInput } from './utils/SalesPOS.utils'

import type {
  PaymentMethodOption,
  OrderItem,
  PaymentMethod,
  Customer,
  Category,
  PurchaseTotals,
} from './types'
import type { CustomerCreditSummary } from './types/Credit.types'
import { isAdmin as checkIsAdmin } from '@shared/constants/roles'
import { fetchStoreWithId } from '@features/purchase/components/POP/data/PurchasePOP.queries'
import { selectStore } from '@features/main/main.slice'
import { supabase } from '@app/core/supabase/Supabase.utils'
import {
  AppContainer,
  MainContent,
  ProductsSection,
  PurchaseSection,
  OrderItemsContainer,
} from '@shared/components/PointOfSalePurchase/styles'
import {
  OrderItemCard,
  PurchaseSummary,
  EmptyOrderState,
  TableHeader,
  ProductGridInfiniteScroll,
} from '@shared/components/PointOfSalePurchase'

const paymentMethods: PaymentMethodOption[] = [
  { value: 'cash', label: 'Cash', icon: <IconCreditCard size={16} /> },
  { value: 'card', label: 'Card', icon: <IconCreditCard size={16} /> },
  {
    value: 'mobile_money',
    label: 'Mobile Money',
    icon: <IconCreditCard size={16} />,
  },
  { value: 'credit', label: 'Credit', icon: <IconCreditCard size={16} /> },
]

const saleTypes = [
  {
    value: 'retail',
    label: 'Retail',
    icon: <IconShoppingCart size={16} />,
    description: 'Walk-in customers',
  },
  {
    value: 'wholesale',
    label: 'Wholesale',
    icon: <IconBuildingStore size={16} />,
    description: 'Bulk sales to businesses',
  },
]

export const SalePOS: React.FC = () => {
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const location = useLocation()
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

  const editingSale = location.state?.editingSale
  const [isEditMode, setIsEditMode] = useState(false)
  const [editingSaleId, setEditingSaleId] = useState<number | null>(null)
  const [editingSaleNumber, setEditingSaleNumber] = useState<string | null>(
    null,
  )
  const [originalSaleType, setOriginalSaleType] = useState<string | null>(null)
  const [originalPaymentMethod, setOriginalPaymentMethod] = useState<
    string | null
  >(null)

  const defaultCurrency =
    companySettings?.default_currency || companySettings?.base_currency || 'UGX'
  const taxRate = companySettings?.tax_rate || 0
  const enableBatchTracking = companySettings?.enable_batch_tracking ?? true
  const enableSerialNumbers = companySettings?.enable_serial_numbers ?? false
  const allowNegativeStock = companySettings?.allow_negative_stock ?? false
  const nearExpiryWarningDays = companySettings?.near_expiry_warning_days || 60
  const blockExpiredSales = companySettings?.block_expired_sales ?? true
  const maxDiscountPercentage = companySettings?.max_discount_percentage || 20
  const requireDiscountApproval =
    companySettings?.require_discount_approval ?? false

  let storeId: number | null = null
  if (authUser?.profile.default_store_id) {
    storeId = authUser.profile.default_store_id
  } else if (selectedStore?.id) {
    storeId = selectedStore.id
  } else if (defaultStoreId) {
    storeId = defaultStoreId
  }

  useEffect(() => {
    const loadStoreData = async () => {
      if (storeId) {
        try {
          const storeData = await fetchStoreWithId(storeId)
          if (storeData) dispatch(selectStore(storeData))
        } catch (error) {
          console.error('Error fetching store data:', error)
        }
      }
    }
    loadStoreData()
  }, [storeId, dispatch])

  const userRoleId = authUser?.profile?.role_id || 7
  const isAdmin = checkIsAdmin(userRoleId)
  const safeCompanyId = companyId ? Number(companyId) : 0
  const safeStoreId = storeId ? Number(storeId) : 0

  const {
    products,
    categories,
    customers,
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
  } = useSaleDataOptimized(safeCompanyId, safeStoreId)

  const { orderItems, setOrderItems, selectedPayment, setSelectedPayment } =
    useSaleOrder(safeCompanyId, safeStoreId)

  const {
    taxPercentage,
    setTaxPercentage,
    discount,
    setDiscount,
    resetFinancials,
  } = useFinancialState()

  const { currentEditItem, setCurrentEditItem } = useModalState()

  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null)
  const [saleType, setSaleType] = useState<string>('retail')
  const [isSalePanelHidden, setIsSalePanelHidden] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [saleDate, setSaleDate] = useState(formatDateForInput())
  const [initialDataLoading, setInitialDataLoading] = useState(true)
  const [localSearchQuery, setLocalSearchQuery] = useState('')
  const [prescriptionDetails, setPrescriptionDetails] = useState<any>(null)

  // Credit state - only fetched, not shown until needed
  const [selectedCustomerCredit, setSelectedCustomerCredit] =
    useState<CustomerCreditSummary | null>(null)
  const [isLoadingCredit, setIsLoadingCredit] = useState(false)

  const { detectAndProcessBarcode } = useBarcodeScanner(
    safeCompanyId,
    safeStoreId,
    (item) => {
      setCurrentEditItem(item)
      handleOpenBatchModalWithItem(item)
    },
  )

  // Edit mode setup
  useEffect(() => {
    if (editingSale) {
      setIsEditMode(true)
      setEditingSaleId(editingSale.saleId)
      setEditingSaleNumber(editingSale.saleNumber)
      const saleTypeToSet = editingSale.saleType || 'retail'
      setSaleType(saleTypeToSet)
      setOriginalSaleType(saleTypeToSet)
      const paymentMethodToSet = editingSale.paymentMethod || 'cash'
      setSelectedPayment(paymentMethodToSet as PaymentMethod)
      setOriginalPaymentMethod(paymentMethodToSet)
      if (editingSale.customerId)
        setSelectedCustomer(String(editingSale.customerId))
      if (editingSale.items?.length > 0) {
        const formattedItems = editingSale.items.map((item: any) => {
          const batchData = item.batches || {}
          const productData = item.products || {}
          const unitData = productData.unit || {}
          return {
            id: item.product_id,
            productName: productData.product_name || '',
            productCode: productData.product_code || '',
            genericName: productData.generic_name || '',
            batchId: item.batch_id,
            batchNumber: item.batch_number || batchData.batch_number || '',
            qty: item.quantity,
            price: item.unit_price,
            costPrice: item.cost_price || 0,
            discountAmount: item.discount_amount || 0,
            taxAmount: item.tax_amount || 0,
            taxRate: item.tax_rate || 0,
            subtotal:
              item.total_price ||
              item.quantity * item.unit_price - (item.discount_amount || 0),
            expiryDate: batchData.expiry_date || null,
            availableStock: batchData.available_quantity || item.quantity,
            unit: unitData.short_code || '',
          }
        })
        setOrderItems(formattedItems)
      }
      if (editingSale.discount) setDiscount(editingSale.discount)
      if (editingSale.prescriptionId) {
        setPrescriptionDetails({
          prescription_id: editingSale.prescriptionId,
          prescription_number: editingSale.prescriptionNumber || '',
          prescription_date: editingSale.prescriptionDate || '',
          prescriber_name: editingSale.prescriberName || '',
          prescriber_license: editingSale.prescriberLicense || '',
        })
      }
      notifications.show({
        title: 'Edit Mode',
        message: `Editing sale ${editingSale.saleNumber}`,
        color: 'blue',
        icon: <IconEdit size={18} />,
      })
    }
  }, [location.state])

  useEffect(() => {
    if (taxRate && taxPercentage === 0) setTaxPercentage(taxRate)
  }, [taxRate, taxPercentage, setTaxPercentage])

  useEffect(() => {
    if (!isLoading && initialDataLoading) setInitialDataLoading(false)
  }, [isLoading, initialDataLoading])

  // Load credit info silently when customer selected (no UI shown yet)
  useEffect(() => {
    if (selectedCustomer) {
      loadCustomerCreditInfo(Number(selectedCustomer))
    } else {
      setSelectedCustomerCredit(null)
    }
  }, [selectedCustomer])

  const loadCustomerCreditInfo = async (customerId: number) => {
    try {
      const summary = await fetchCustomerCreditInfo(
        supabase,
        customerId,
        safeCompanyId,
      )
      setSelectedCustomerCredit(summary)
    } catch (error) {
      console.error('Error loading credit info:', error)
    }
  }

  const totals = calculateSaleTotals(orderItems, taxPercentage, discount)

  // Credit validation before checkout (called when Complete Sale is clicked)
  const validateCreditBeforeCheckout = async (): Promise<boolean> => {
    if (selectedPayment !== 'credit') return true

    if (!selectedCustomer) {
      notifications.show({
        title: 'Customer Required',
        message: 'Please select a customer for credit sale',
        color: 'red',
        icon: <IconX size={18} />,
      })
      return false
    }

    setIsLoadingCredit(true)
    try {
      const validation = await validateCreditForUI(
        supabase,
        Number(selectedCustomer),
        safeCompanyId,
        totals.grandTotal,
      )

      if (!validation.isValid || !validation.canPurchaseOnCredit) {
        validation.errors.forEach((error) => {
          notifications.show({
            title: 'Credit Validation Failed',
            message: error,
            color: 'red',
            icon: <IconX size={18} />,
          })
        })
        return false
      }

      validation.warnings.forEach((warning) => {
        notifications.show({
          title: 'Credit Warning',
          message: warning,
          color: 'yellow',
          icon: <IconAlertTriangle size={18} />,
        })
      })

      return true
    } catch (error) {
      console.error('Credit validation error:', error)
      notifications.show({
        title: 'Validation Error',
        message: 'Failed to validate credit',
        color: 'red',
        icon: <IconX size={18} />,
      })
      return false
    } finally {
      setIsLoadingCredit(false)
    }
  }

  const validatePrescriptionRequirement = () => {
    const requiresPrescription = orderItems.some((item) => {
      const product = products.find((p) => p.id === item.id)
      return product?.requires_prescription
    })
    if (requiresPrescription && saleType === 'retail' && !prescriptionDetails) {
      notifications.show({
        title: 'Prescription Required',
        message: 'This sale contains items that require a prescription',
        color: 'orange',
        icon: <IconAlertTriangle />,
      })
      return false
    }
    return true
  }

  const validateExpiredBatches = () => {
    if (!blockExpiredSales) return true
    const hasExpiredBatches = orderItems.some((item) => {
      if (!item.expiryDate) return false
      return new Date(item.expiryDate) < new Date()
    })
    if (hasExpiredBatches) {
      notifications.show({
        title: 'Expired Batch Detected',
        message:
          'Cannot sell expired batches. Please remove them from the order.',
        color: 'red',
        icon: <IconAlertTriangle />,
      })
      return false
    }
    return true
  }

  const validateNearExpiryBatches = () => {
    if (!nearExpiryWarningDays) return true
    const today = new Date()
    const warningDate = new Date(today)
    warningDate.setDate(today.getDate() + nearExpiryWarningDays)
    const nearExpiryItems = orderItems.filter((item) => {
      if (!item.expiryDate) return false
      const expiryDate = new Date(item.expiryDate)
      return expiryDate <= warningDate && expiryDate > today
    })
    if (nearExpiryItems.length > 0) {
      notifications.show({
        title: 'Near Expiry Warning',
        message: `${nearExpiryItems.length} item(s) nearing expiry: ${nearExpiryItems.map((i) => i.productName).join(', ')}`,
        color: 'yellow',
        icon: <IconAlertTriangle />,
        autoClose: 5000,
      })
    }
    return true
  }

  const validateDiscountLimit = () => {
    if (!requireDiscountApproval) return true
    const discountPercentage = (discount / totals.subTotal) * 100
    if (discountPercentage > maxDiscountPercentage) {
      notifications.show({
        title: 'Discount Limit Exceeded',
        message: `Maximum discount is ${maxDiscountPercentage}%. Approval required for ${discountPercentage.toFixed(1)}%`,
        color: 'orange',
        icon: <IconAlertTriangle />,
      })
      return false
    }
    return true
  }

  const validateStockAvailability = () => {
    if (allowNegativeStock) return true
    const insufficientStock = orderItems.filter(
      (item) => item.qty > item.availableStock,
    )
    if (insufficientStock.length > 0) {
      notifications.show({
        title: 'Insufficient Stock',
        message: insufficientStock
          .map(
            (i) =>
              `${i.productName} (Need: ${i.qty}, Available: ${i.availableStock})`,
          )
          .join('\n'),
        color: 'red',
        icon: <IconAlertTriangle />,
      })
      return false
    }
    return true
  }

  const handleOpenBatchModalWithItem = (item: OrderItem) => {
    setCurrentEditItem(item)
    dispatch(
      openModal({
        type: 'sale-batch-details',
        size: 'md',
        props: {
          itemData: item,
          units,
          companyId: safeCompanyId,
          storeId: safeStoreId,
          enableBatchTracking,
          enableSerialNumbers,
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
        () => handleCloseBatchModal(),
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
        props: { taxPercentage, discount, totals, maxDiscountPercentage },
      }),
    )
  }

  const handleApplyAdditionalCostsFromModal = (updatedValues: {
    taxPercentage: number
    discount: number
  }) => {
    const validation = handleApplyAdditionalCosts(
      updatedValues.taxPercentage,
      updatedValues.discount,
      totals.subTotal,
      () => {
        setTaxPercentage(updatedValues.taxPercentage)
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

  const handleCancelAdditionalCostsModal = () => dispatch(closeModal())

  const handleOpenPrescriptionModal = () => {
    dispatch(
      openModal({
        type: 'prescription-details',
        size: 'md',
        props: { prescriptionData: prescriptionDetails },
      }),
    )
  }

  const handleSavePrescriptionDetails = (details: any) => {
    setPrescriptionDetails(details)
    dispatch(closeModal())
    notifications.show({
      title: 'Prescription Saved',
      message: `Prescription #${details.prescription_number} saved`,
      color: 'green',
    })
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
    setOrderItems([])
    setSelectedPayment('cash')
    resetFinancials()
    setSaleDate(formatDateForInput())
    setPrescriptionDetails(null)
    setSelectedCustomer(null)
    setSelectedCustomerCredit(null)
    setIsEditMode(false)
    setEditingSaleId(null)
    setEditingSaleNumber(null)
    setOriginalSaleType(null)
    setOriginalPaymentMethod(null)
    localStorage.removeItem(`sale_order_${safeCompanyId}_${safeStoreId}`)
  }

  const onCancelOrder = () => handleCancelOrder(onResetOrder)

  const onSubmitOrder = async () => {
    if (!validatePrescriptionRequirement()) return
    if (!validateExpiredBatches()) return
    if (!validateDiscountLimit()) return
    if (!validateStockAvailability()) return
    validateNearExpiryBatches()
    const isValidCredit = await validateCreditBeforeCheckout()
    if (!isValidCredit) return

    const selectedCustomerData = customers.find(
      (c) => String(c.id) === selectedCustomer,
    )
    const customerName = selectedCustomerData
      ? `${selectedCustomerData.first_name} ${selectedCustomerData.last_name}`.trim()
      : undefined

    handleOpenCompleteSaleModal(
      orderItems,
      totals,
      saleType,
      customerName,
      (config) =>
        dispatch(
          openModal({
            ...config,
            props: {
              ...config.props,
              isEditMode,
              editingSaleId,
              editingSaleNumber,
              originalSaleType,
              originalPaymentMethod,
              // Pass the selected payment so CompleteSaleModal knows it
              selectedPayment,
            },
          }),
        ),
    )
  }

  const handlePaymentSelect = async (value: string) => {
    if (value === 'credit' && !selectedCustomer) {
      notifications.show({
        title: 'Customer Required',
        message: 'Please select a customer before choosing credit payment',
        color: 'yellow',
        icon: <IconAlertTriangle size={18} />,
      })
      return
    }

    if (
      isEditMode &&
      originalPaymentMethod &&
      value !== originalPaymentMethod
    ) {
      const isCreditChange =
        originalPaymentMethod === 'credit' || value === 'credit'
      const confirmMessage = isCreditChange
        ? originalPaymentMethod === 'credit'
          ? `⚠️ Changing from CREDIT to ${value.toUpperCase()} will reverse the credit transaction. Continue?`
          : `⚠️ Changing to CREDIT will use ${defaultCurrency} ${totals.grandTotal.toLocaleString()} from the customer's credit. Continue?`
        : `⚠️ Changing payment method from "${originalPaymentMethod}" to "${value}". Continue?`

      if (!confirm(confirmMessage)) return
    }

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

  const handleSaleTypeChange = (type: string) => {
    if (isEditMode && originalSaleType && type !== originalSaleType) {
      if (
        !confirm(
          `⚠️ Changing sale type from ${originalSaleType.toUpperCase()} to ${type.toUpperCase()}. Continue?`,
        )
      )
        return
      if (originalSaleType === 'wholesale' && type === 'retail') {
        setSelectedCustomer(null)
        setSelectedCustomerCredit(null)
        if (selectedPayment === 'credit') setSelectedPayment('cash')
      }
      if (originalSaleType === 'retail' && type === 'wholesale')
        setPrescriptionDetails(null)
    }

    handleSaleTypeToggle(type, setSaleType)

    if (!isEditMode) {
      if (type !== 'retail') setPrescriptionDetails(null)
      if (type !== 'wholesale') {
        setSelectedCustomer(null)
        setSelectedCustomerCredit(null)
      }
      if (type === 'retail') setSelectedPayment('cash')
    }
  }

  // Window handlers — NOTE: pass selectedPayment into onCompleteSale so the
  // modal can use it AND so Credit.handlers gets called with the right method
  useEffect(() => {
    ;(window as any).__saleModalHandlers = {
      onSaveBatchDetails: handleSaveBatchDetailsFromModal,
      onCancelBatchDetails: handleCloseBatchModal,
      onApplyAdditionalCosts: handleApplyAdditionalCostsFromModal,
      onCancelAdditionalCosts: handleCancelAdditionalCostsModal,
      onSavePrescriptionDetails: handleSavePrescriptionDetails,
      currentEditItem,
      setCurrentEditItem,
      units,
      orderItems,
      totals,
      customers,
      // Expose pre-loaded credit summary so CompleteSaleModal can read it
      customerCreditSummary: selectedCustomerCredit,
      onCompleteSale: async (documentOptions: {
        generateReceipt: boolean
        generateInvoice: boolean
        printImmediately: boolean
        downloadPdf: boolean
        // CompleteSaleModal passes back the chosen payment method
        paymentMethod?: string
        amountTendered?: number
      }) => {
        setIsSubmitting(true)
        // Use payment method from modal if provided (user may change it there)
        const finalPaymentMethod = (documentOptions.paymentMethod ||
          selectedPayment) as string
        const selectedCustomerData = customers.find(
          (c) => String(c.id) === selectedCustomer,
        )
        const customerDetails = selectedCustomerData
          ? {
              name: `${selectedCustomerData.first_name} ${selectedCustomerData.last_name}`.trim(),
              phone: selectedCustomerData.phone || '',
              address: selectedCustomerData.address || '',
            }
          : undefined
        try {
          await handleSubmitSale(
            orderItems,
            totals,
            safeCompanyId,
            safeStoreId,
            selectedCustomer ? parseInt(selectedCustomer) : null,
            saleType,
            taxPercentage,
            discount,
            totals.grandTotal,
            documentOptions.amountTendered ?? totals.grandTotal,
            finalPaymentMethod,
            prescriptionDetails,
            null,
            (saleNumber, saleId) => {
              notifications.show({
                title: isEditMode ? 'Sale Updated' : 'Sale Completed',
                message: isEditMode
                  ? `Sale ${saleNumber} updated successfully!`
                  : `Sale ${saleNumber} completed successfully!`,
                color: 'green',
              })
              dispatch(closeModal())
              onResetOrder()
            },
            (error) => {
              notifications.show({
                title: isEditMode ? 'Update Failed' : 'Error Creating Sale',
                message: error,
                color: 'red',
              })
            },
            documentOptions,
            companySettings,
            customerDetails,
            isEditMode,
            editingSaleId,
            originalSaleType,
            originalPaymentMethod,
          )
        } finally {
          setIsSubmitting(false)
        }
      },
    }
    return () => {
      delete (window as any).__saleModalHandlers
    }
  }, [
    currentEditItem,
    orderItems,
    totals,
    units,
    prescriptionDetails,
    customers,
    selectedCustomer,
    saleType,
    selectedPayment,
    taxPercentage,
    discount,
    companySettings,
    safeCompanyId,
    safeStoreId,
    isEditMode,
    editingSaleId,
    originalSaleType,
    originalPaymentMethod,
  ])

  const purchaseTotals: PurchaseTotals = {
    subTotal: totals.subTotal,
    tax: totals.tax,
    shipping: 0,
    coupon: 0,
    discount: totals.discount,
    grandTotal: totals.grandTotal,
    taxPercentage: totals.taxPercentage,
  }

  if (!isAuthInitialized) return <PointOfViewPageSkeleton />

  if (!isAuthenticated) {
    return (
      <AppContainer>
        <Box
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
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

  if (!userRoleId && isAuthInitialized && isAuthenticated)
    return <PointOfViewPageSkeleton />
  if (initialDataLoading && isLoading) return <PointOfViewPageSkeleton />

  if (loadError) {
    return (
      <AppContainer>
        <Box
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
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
      <AppShell>
        <Box style={{ height: '3.2rem' }}>
          <Navbar showSearch={false} />
        </Box>

        <AppShell.Main>
          <MainContent>
            {/* Products Section */}
            <ProductsSection
              $fullWidth={isSalePanelHidden}
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
                      localSearchQuery ? (
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
                      ) : null
                    }
                    value={localSearchQuery}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    styles={{ input: { height, fontSize: 14 } }}
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
                      handleToggleSalePanel(
                        isSalePanelHidden,
                        setIsSalePanelHidden,
                      )
                    }
                  >
                    {isSalePanelHidden ? (
                      <IconLayoutSidebarRightCollapse size={18} />
                    ) : (
                      <IconLayoutSidebarRightCollapseFilled size={18} />
                    )}
                  </ActionIcon>
                </Group>

                {/* Categories */}
                <Box style={{ position: 'relative', width: '100%' }}>
                  <Group
                    gap="xs"
                    wrap="nowrap"
                    style={{
                      overflowX: 'auto',
                      overflowY: 'hidden',
                      display: 'flex',
                      flexWrap: 'nowrap',
                      WebkitOverflowScrolling: 'touch',
                      scrollbarWidth: 'none',
                      msOverflowStyle: 'none',
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

            {/* Purchase Section */}
            <PurchaseSection
              $hidden={isSalePanelHidden}
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
                    {/* Sale Type + Date */}
                    <Group
                      gap="xs"
                      wrap="nowrap"
                    >
                      {saleTypes.map((type) => (
                        <Button
                          key={type.value}
                          size="md"
                          variant={saleType === type.value ? 'filled' : 'light'}
                          color={theme.primaryColor}
                          onClick={() => handleSaleTypeChange(type.value)}
                          leftSection={type.icon}
                          style={{ flex: 1 }}
                        >
                          {type.label}
                        </Button>
                      ))}
                      <TextInput
                        type="date"
                        size="sm"
                        value={saleDate}
                        onChange={(e) => setSaleDate(e.target.value)}
                        leftSection={<IconCalendar size={14} />}
                        styles={{
                          root: { width: '140px', minWidth: '140px' },
                          input: { fontSize: '0.75rem', paddingLeft: '32px' },
                        }}
                      />
                    </Group>

                    {/* Customer select — wholesale only */}
                    {saleType === 'wholesale' && (
                      <Group
                        gap="xs"
                        wrap="nowrap"
                      >
                        <Select
                          placeholder="Select Customer"
                          size="sm"
                          data={customers.map((c: Customer) => ({
                            value: String(c.id),
                            label: `${c.first_name} ${c.last_name}`,
                          }))}
                          value={selectedCustomer}
                          onChange={(value) =>
                            handleCustomerSelect(value, setSelectedCustomer)
                          }
                          searchable
                          style={{ flex: 1 }}
                        />
                        <ActionIcon
                          size="lg"
                          variant="light"
                          color={theme.primaryColor}
                          onClick={() =>
                            dispatch(
                              openModal({
                                type: 'add-customer',
                                size: 'lg',
                                props: { mode: 'create' },
                              }),
                            )
                          }
                        >
                          <IconUserPlus size={18} />
                        </ActionIcon>
                      </Group>
                    )}

                    {/* Payment method buttons — wholesale only */}
                    {saleType === 'wholesale' && (
                      <Group
                        gap="xs"
                        wrap="nowrap"
                      >
                        {paymentMethods.map((method) => (
                          <Button
                            key={method.value}
                            size="xs"
                            variant={
                              selectedPayment === method.value
                                ? 'filled'
                                : 'light'
                            }
                            color={
                              selectedPayment === method.value
                                ? theme.primaryColor
                                : 'gray'
                            }
                            onClick={() => handlePaymentSelect(method.value)}
                            disabled={
                              method.value === 'credit' && !selectedCustomer
                            }
                            style={{ flex: 1 }}
                          >
                            {method.label}
                          </Button>
                        ))}
                      </Group>
                    )}
                  </Stack>
                </Paper>

                {/* Order Items */}
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

                {orderItems.length === 0 ? (
                  <EmptyOrderState />
                ) : (
                  <>
                    <TableHeader />
                    <OrderItemsContainer>
                      {orderItems.map((item, index) => (
                        <OrderItemCard
                          key={`${item.id}-${item.batchNumber || 'no-batch'}-${index}`}
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

                <PurchaseSummary
                  totals={purchaseTotals}
                  shipping={0}
                  coupon={0}
                  discount={discount}
                  onEditCosts={handleOpenAdditionalCostsModal}
                />

                {/* Action Buttons */}
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
                  {saleType === 'retail' && (
                    <Button
                      size="sm"
                      variant={prescriptionDetails ? 'filled' : 'light'}
                      color={prescriptionDetails ? 'green' : theme.primaryColor}
                      onClick={handleOpenPrescriptionModal}
                    >
                      <IconPrescription size={16} />
                    </Button>
                  )}
                </Group>

                <Button
                  size="md"
                  fullWidth
                  color={theme.primaryColor}
                  disabled={
                    orderItems.length === 0 ||
                    (saleType === 'wholesale' && !selectedCustomer) ||
                    isSubmitting ||
                    isLoadingCredit
                  }
                  loading={isSubmitting || isLoadingCredit}
                  onClick={onSubmitOrder}
                  leftSection={
                    isEditMode ? (
                      <IconCheck size={18} />
                    ) : (
                      <IconShoppingCart size={18} />
                    )
                  }
                >
                  {isLoadingCredit
                    ? 'Validating...'
                    : isEditMode
                      ? 'Update Sale'
                      : 'Complete Sale'}
                </Button>
              </Stack>
            </PurchaseSection>
          </MainContent>
        </AppShell.Main>
      </AppShell>
    </AppContainer>
  )
}

export default SalePOS

