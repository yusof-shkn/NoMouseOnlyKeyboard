// src/features/sales/salesPOS.enhanced.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react'
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
  Box,
  useMantineTheme,
  useMantineColorScheme,
  Tooltip,
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
  IconBookmark,
  IconBuildingStore,
  IconCreditCard,
  IconChevronRight,
  IconLayoutSidebarRightCollapse,
  IconLayoutSidebarRightCollapseFilled,
  IconRefresh,
  IconClipboardList,
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
import { usePOSKeyboardShortcuts } from './hooks/usePOSKeyboardShortcuts'

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
  handleSaveDraft,
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
  ProductGridInfiniteScroll,
} from '@shared/components/PointOfSalePurchase'

// ✅ FIX: Credit payment only makes sense for wholesale (customer required)
// Retail uses cash/card/mobile_money only
const retailPaymentMethods: PaymentMethodOption[] = [
  { value: 'cash', label: 'Cash', icon: <IconCreditCard size={16} /> },
  { value: 'card', label: 'Card', icon: <IconCreditCard size={16} /> },
  {
    value: 'mobile_money',
    label: 'Mobile Money',
    icon: <IconCreditCard size={16} />,
  },
]

const wholesalePaymentMethods: PaymentMethodOption[] = [
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
  // ✅ FIX: Get companyId from Redux (not async profile fetch)
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

  const userRoleId = authUser?.profile?.role_id || 7
  const isAdmin = checkIsAdmin(userRoleId)
  const safeCompanyId = companyId ? Number(companyId) : 0
  const safeStoreId = storeId ? Number(storeId) : 0

  useEffect(() => {
    const loadStoreData = async () => {
      if (storeId) {
        // User has a store set — load its full details into Redux
        try {
          const storeData = await fetchStoreWithId(storeId)
          if (storeData) dispatch(selectStore(storeData))
        } catch (error) {
          console.error('Error fetching store data:', error)
        }
      } else if (safeCompanyId) {
        // No store assigned — auto-select the first available store for this company
        try {
          const { data: stores } = await supabase
            .from('stores')
            .select('*')
            .eq('company_id', safeCompanyId)
            .eq('is_active', true)
            .is('deleted_at', null)
            .order('store_name', { ascending: true })
            .limit(1)
            .single()

          if (stores) {
            console.warn(
              '⚠️ No default store set — auto-selecting first store:',
              stores.store_name,
            )
            dispatch(selectStore(stores))
          }
        } catch (error) {
          console.error('Error auto-selecting store:', error)
        }
      }
    }
    loadStoreData()
  }, [storeId, safeCompanyId, dispatch])

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
    lastRefreshed,
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
  const [isSalePanelHidden, setIsSalePanelHidden] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSavingDraft, setIsSavingDraft] = useState(false)
  const [currentDraftId, setCurrentDraftId] = useState<number | null>(null)
  // ✅ FIX: saleDate state is now passed to the DB so cashier-chosen date is saved
  const [saleDate, setSaleDate] = useState(formatDateForInput())
  const [initialDataLoading, setInitialDataLoading] = useState(true)
  const [localSearchQuery, setLocalSearchQuery] = useState('')
  const [prescriptionDetails, setPrescriptionDetails] = useState<any>(null)

  // Ref for F2 keyboard shortcut → focus search
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Credit state — fetched silently when customer is selected
  const [selectedCustomerCredit, setSelectedCustomerCredit] =
    useState<CustomerCreditSummary | null>(null)
  // ✅ FIX: isLoadingCredit only used during the final checkout validation (not double-validated)
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
      // Draft sales are "resumed" — items load into POS but it's treated as a new sale
      // When completed, a new completed sale is created and the draft is deleted
      const isDraft = editingSale.isDraft === true
      if (isDraft) {
        setCurrentDraftId(editingSale.saleId)
        setIsEditMode(false) // draft resume is NOT edit mode
        setEditingSaleId(null)
        setEditingSaleNumber(null)
      } else {
        setIsEditMode(true)
        setEditingSaleId(editingSale.saleId)
        setEditingSaleNumber(editingSale.saleNumber)
      }
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
          const unitData = productData.units || productData.unit || {}
          // unit_short_code is stored directly on sale_items — best fallback
          const unitShortCode =
            unitData.short_code || item.unit_short_code || item.unit || ''
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
            unit: unitShortCode,
          }
        })
        setOrderItems(formattedItems)
        setIsSalePanelHidden(false)
      }
      if (editingSale.discount) setDiscount(editingSale.discount)
      if (editingSale.saleDate) setSaleDate(editingSale.saleDate)
      if (editingSale.prescriptionId) {
        setPrescriptionDetails({
          prescription_id: editingSale.prescriptionId,
          prescription_number: editingSale.prescriptionNumber || '',
          prescription_date: editingSale.prescriptionDate || '',
          prescriber_name: editingSale.prescriberName || '',
          prescriber_license: editingSale.prescriberLicense || '',
        })
      }
      if (isDraft) {
        notifications.show({
          title: 'Draft Resumed',
          message: `Draft ${editingSale.saleNumber} loaded — complete when ready`,
          color: 'yellow',
          icon: <IconBookmark size={18} />,
        })
      } else {
        notifications.show({
          title: 'Edit Mode',
          message: `Editing sale ${editingSale.saleNumber}`,
          color: 'blue',
          icon: <IconEdit size={18} />,
        })
      }
    }
  }, [location.state])

  useEffect(() => {
    if (taxRate && taxPercentage === 0) setTaxPercentage(taxRate)
  }, [taxRate, taxPercentage, setTaxPercentage])

  useEffect(() => {
    if (!isLoading && initialDataLoading) setInitialDataLoading(false)
  }, [isLoading, initialDataLoading])

  // Silently pre-fetch credit info when customer is selected
  useEffect(() => {
    if (selectedCustomer) {
      fetchCustomerCreditInfo(supabase, Number(selectedCustomer), safeCompanyId)
        .then(setSelectedCustomerCredit)
        .catch(() => setSelectedCustomerCredit(null))
    } else {
      setSelectedCustomerCredit(null)
    }
  }, [selectedCustomer, safeCompanyId])

  const totals = calculateSaleTotals(orderItems, taxPercentage, discount)

  // ✅ FIX: Single credit validation — only runs at checkout, not twice
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

    // Use pre-fetched credit summary if available to avoid extra round-trip
    if (selectedCustomerCredit) {
      const available = selectedCustomerCredit.available_credit
      if (available < totals.grandTotal) {
        notifications.show({
          title: 'Insufficient Credit',
          message: `Available credit: ${defaultCurrency} ${available.toLocaleString()}. Sale total: ${defaultCurrency} ${totals.grandTotal.toLocaleString()}`,
          color: 'red',
          icon: <IconX size={18} />,
        })
        return false
      }
      if (
        selectedCustomerCredit.credit_status !== 'active' &&
        selectedCustomerCredit.credit_status !== 'good'
      ) {
        notifications.show({
          title: 'Credit Not Active',
          message: `Customer credit status: ${selectedCustomerCredit.credit_status}`,
          color: 'red',
          icon: <IconX size={18} />,
        })
        return false
      }
      return true
    }

    // Fallback: fetch fresh if pre-fetch wasn't available
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
        size: 'xl',
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
      // Auto-open the right panel when a product is added to cart
      setIsSalePanelHidden(false)
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
    // ✅ IDEA: Pre-fill patient_name from selected retail customer
    const selectedCustomerData = selectedCustomer
      ? customers.find((c: any) => String(c.id) === selectedCustomer)
      : null
    const prefilledPatientName = selectedCustomerData
      ? `${selectedCustomerData.first_name} ${selectedCustomerData.last_name}`.trim()
      : ''

    dispatch(
      openModal({
        type: 'prescription-details',
        size: 'md',
        props: {
          prescriptionData: prescriptionDetails
            ? prescriptionDetails
            : prefilledPatientName
              ? { patient_name: prefilledPatientName }
              : null,
        },
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
    setCurrentDraftId(null)
    setIsSalePanelHidden(true)
  }

  const onCancelOrder = () => handleCancelOrder(onResetOrder)

  // ✅ FIX: handleSaleTypeChange defined before keyboard shortcuts hook
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
      // ✅ FIX: Clear customer & reset to cash when switching away from wholesale
      if (type !== 'wholesale') {
        setSelectedCustomer(null)
        setSelectedCustomerCredit(null)
        setSelectedPayment('cash')
      }
    }
  }

  const handlePaymentSelect = async (value: string) => {
    // ✅ FIX: Credit only allowed for wholesale with a customer
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
              selectedPayment,
            },
          }),
        ),
    )
  }

  // ── Undo last item — Ctrl+Z / Delete key ────────────────────────────────
  const onUndoLastItem = useCallback(() => {
    if (orderItems.length === 0) return
    onRemoveOrderItem(orderItems.length - 1)
  }, [orderItems])

  // ── Keyboard shortcuts ───────────────────────────────────────────────────
  // All handlers are now fully initialised before this hook runs.
  usePOSKeyboardShortcuts(
    {
      searchInputRef,
      orderItems,
      saleType,
      isSubmitting,
      isSalePanelHidden,
      onFocusSearch: () => {
        setLocalSearchQuery('')
        handleSearch('')
      },
      onToggleSalePanel: () =>
        handleToggleSalePanel(isSalePanelHidden, setIsSalePanelHidden),
      onOpenPrescriptionModal: handleOpenPrescriptionModal,
      onOpenAdditionalCostsModal: handleOpenAdditionalCostsModal,
      onSubmitOrder,
      onCancelOrder,
      onUndoLastItem,
      onResetOrder,
      onSwitchSaleType: handleSaleTypeChange,
    },
    isAuthInitialized && isAuthenticated,
  )

  // Window handlers for modal communication
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
      customerCreditSummary: selectedCustomerCredit,
      onCompleteSale: async (documentOptions: {
        generateReceipt: boolean
        generateInvoice: boolean
        printImmediately: boolean
        downloadPdf: boolean
        paymentMethod?: string
        amountTendered?: number
      }) => {
        setIsSubmitting(true)
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
            async (saleNumber, saleId) => {
              // If this sale was completed from a draft, soft-delete the draft record
              if (currentDraftId) {
                try {
                  await supabase
                    .from('sales')
                    .update({ deleted_at: new Date().toISOString() })
                    .eq('id', currentDraftId)
                    .eq('sale_status', 'draft')
                } catch (e) {
                  console.warn('Could not delete draft after completion:', e)
                }
              }
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
            saleDate, // ✅ FIX: pass cashier-selected date to DB
            authUser?.profile?.id ?? null, // ✅ FIX A-01: pass who processed the sale
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
    saleDate,
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

  // ✅ Payment methods depend on sale type — credit only for wholesale
  const availablePaymentMethods =
    saleType === 'wholesale' ? wholesalePaymentMethods : retailPaymentMethods

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
          <Navbar
            showSearch={false}
            onBack={() => navigate(-1)}
            backLabel="Back to Sales"
            breadcrumbs={[{ label: 'Sales' }, { label: 'Point of Sale' }]}
          />
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
                  {/* ── Search ── */}
                  <TextInput
                    ref={searchInputRef}
                    placeholder="Search by name, SKU, or scan barcode  [Ctrl+F]"
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
                    title={`Refresh stock [Auto every 2 min]\nLast: ${lastRefreshed.toLocaleTimeString()}`}
                    onClick={refreshProducts}
                    loading={isLoading}
                  >
                    <IconRefresh size={18} />
                  </ActionIcon>

                  <ActionIcon
                    variant="light"
                    color={theme.primaryColor}
                    style={{ height, width: height }}
                    title="Toggle cart panel [F4]"
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
                style={{
                  height: '100%',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                }}
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
                    flexShrink: 0,
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
                          title={`${type.description} [Ctrl+${type.value === 'retail' ? '1' : '2'}]`}
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

                    {/* Customer select — retail shows patients (optional, walk-in default) */}
                    {saleType === 'retail' && (
                      <Group
                        gap="xs"
                        wrap="nowrap"
                      >
                        <Select
                          placeholder="Walk-in Customer (default)"
                          size="sm"
                          clearable
                          data={[
                            { value: 'walk_in', label: 'Walk-in Customer' },
                            ...customers
                              .filter(
                                (c: any) =>
                                  c.customer_type === 'patient' ||
                                  c.customer_type === undefined,
                              )
                              .map((c: any) => ({
                                value: String(c.id),
                                label: `${c.first_name} ${c.last_name}`,
                                description: c.phone,
                              })),
                          ]}
                          value={
                            selectedCustomer === null
                              ? 'walk_in'
                              : selectedCustomer
                          }
                          onChange={(value) => {
                            if (value === 'walk_in' || value === null) {
                              handleCustomerSelect(null, setSelectedCustomer)
                            } else {
                              handleCustomerSelect(value, setSelectedCustomer)
                            }
                          }}
                          searchable
                          style={{ flex: 1 }}
                          renderOption={({ option }: any) => (
                            <Group gap="xs">
                              <Box>
                                <Text
                                  size="sm"
                                  fw={500}
                                >
                                  {option.label}
                                </Text>
                                {option.description && (
                                  <Text
                                    size="xs"
                                    c="dimmed"
                                  >
                                    {option.description}
                                  </Text>
                                )}
                              </Box>
                            </Group>
                          )}
                        />
                        <ActionIcon
                          size="lg"
                          variant="light"
                          color={theme.primaryColor}
                          title="Add new patient"
                          onClick={() =>
                            dispatch(
                              openModal({
                                type: 'add-customer',
                                size: 'lg',
                                props: {
                                  mode: 'create',
                                  defaultType: 'patient',
                                },
                              }),
                            )
                          }
                        >
                          <IconUserPlus size={18} />
                        </ActionIcon>
                      </Group>
                    )}

                    {/* Customer select — wholesale shows business accounts, retail shows patients */}
                    {saleType === 'wholesale' && (
                      <Group
                        gap="xs"
                        wrap="nowrap"
                      >
                        <Select
                          placeholder="Select Business / Customer  [Ctrl+Shift+C]"
                          size="sm"
                          data={customers
                            .filter(
                              (c: any) =>
                                c.customer_type === 'business' ||
                                c.customer_type === undefined,
                            )
                            .map((c: any) => ({
                              value: String(c.id),
                              label:
                                c.customer_type === 'business' &&
                                c.business_name
                                  ? `${c.business_name} (${c.first_name} ${c.last_name})`
                                  : `${c.first_name} ${c.last_name}`,
                              description: c.phone,
                            }))}
                          value={selectedCustomer}
                          onChange={(value) =>
                            handleCustomerSelect(value, setSelectedCustomer)
                          }
                          searchable
                          style={{ flex: 1 }}
                          renderOption={({ option }: any) => (
                            <Group gap="xs">
                              <Box>
                                <Text
                                  size="sm"
                                  fw={500}
                                >
                                  {option.label}
                                </Text>
                                {option.description && (
                                  <Text
                                    size="xs"
                                    c="dimmed"
                                  >
                                    {option.description}
                                  </Text>
                                )}
                              </Box>
                            </Group>
                          )}
                        />
                        <ActionIcon
                          size="lg"
                          variant="light"
                          color="grape"
                          title="Add new business account"
                          onClick={() =>
                            dispatch(
                              openModal({
                                type: 'add-customer',
                                size: 'lg',
                                props: {
                                  mode: 'create',
                                  defaultType: 'business',
                                },
                              }),
                            )
                          }
                        >
                          <IconUserPlus size={18} />
                        </ActionIcon>
                      </Group>
                    )}

                    {/* Credit info badge — visible whenever a customer with a credit limit is selected */}
                    {selectedCustomer &&
                      selectedCustomerCredit &&
                      selectedCustomerCredit.credit_limit > 0 && (
                        <Group gap="xs">
                          <Badge
                            size="sm"
                            variant="light"
                            color={
                              selectedCustomerCredit.available_credit >
                              totals.grandTotal
                                ? 'green'
                                : 'red'
                            }
                          >
                            Credit: {defaultCurrency}{' '}
                            {selectedCustomerCredit.available_credit.toLocaleString()}{' '}
                            available
                          </Badge>
                          {selectedCustomerCredit.credit_status !== 'active' &&
                            selectedCustomerCredit.credit_status !== 'good' && (
                              <Badge
                                size="sm"
                                variant="filled"
                                color="orange"
                              >
                                Status: {selectedCustomerCredit.credit_status}
                              </Badge>
                            )}
                        </Group>
                      )}
                  </Stack>
                </Paper>

                {/* Order Items */}
                <Group
                  justify="space-between"
                  style={{ flexShrink: 0 }}
                >
                  <Text
                    size="sm"
                    fw={600}
                  >
                    Order Details
                  </Text>
                  <Group gap="xs">
                    <Badge
                      size="sm"
                      color={theme.primaryColor}
                    >
                      {orderItems.length} Items
                    </Badge>
                    <Badge
                      size="xs"
                      variant="outline"
                      color="gray"
                      title="Ctrl+F=Search · Alt+P=Toggle Panel · Alt+R=Prescription · Alt+T=Tax/Discount · Ctrl+Enter=Complete Sale · Ctrl+Z=Undo Last · Ctrl+Shift+R=Reset · Ctrl+1=Retail · Ctrl+2=Wholesale · Esc=Cancel"
                      style={{ cursor: 'help', fontSize: '9px' }}
                    >
                      ⌨ Shortcuts
                    </Badge>
                  </Group>
                </Group>

                {orderItems.length === 0 ? (
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <EmptyOrderState />
                  </div>
                ) : (
                  <div
                    style={{
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      overflow: 'hidden',
                      minHeight: 0,
                    }}
                  >
                    <OrderItemsContainer style={{ flex: 1, maxHeight: 'none' }}>
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
                  </div>
                )}

                <div style={{ flexShrink: 0 }}>
                  <PurchaseSummary
                    totals={purchaseTotals}
                    shipping={0}
                    coupon={0}
                    discount={discount}
                    onEditCosts={handleOpenAdditionalCostsModal}
                  />
                </div>

                {/* Action Buttons */}
                <Group
                  gap="xs"
                  grow
                  style={{ flexShrink: 0 }}
                >
                  <Button
                    size="sm"
                    variant="light"
                    color="red"
                    onClick={onCancelOrder}
                    leftSection={<IconX size={16} />}
                    title="Cancel order [Esc]"
                  >
                    Cancel{' '}
                    <span
                      style={{ opacity: 0.55, fontSize: '10px', marginLeft: 2 }}
                    >
                      [Esc]
                    </span>
                  </Button>
                  <Button
                    size="sm"
                    variant="light"
                    color={theme.primaryColor}
                    onClick={onResetOrder}
                    title="Reset order [Ctrl+Shift+R]"
                  >
                    Reset{' '}
                    <span
                      style={{ opacity: 0.55, fontSize: '10px', marginLeft: 2 }}
                    >
                      [⇧R]
                    </span>
                  </Button>
                  {!isEditMode && (
                    <Button
                      size="sm"
                      variant="light"
                      color="yellow"
                      disabled={
                        orderItems.length === 0 || isSubmitting || isSavingDraft
                      }
                      loading={isSavingDraft}
                      leftSection={<IconBookmark size={16} />}
                      title="Save order as draft [Alt+D]"
                      onClick={() => {
                        setIsSavingDraft(true)
                        handleSaveDraft(
                          orderItems,
                          totals,
                          safeCompanyId,
                          safeStoreId,
                          selectedCustomer ? parseInt(selectedCustomer) : null,
                          saleType,
                          discount,
                          selectedPayment || 'cash',
                          saleDate,
                          currentDraftId,
                          (saleNumber, saleId) => {
                            setIsSavingDraft(false)
                            onResetOrder()
                          },
                          (error) => {
                            setIsSavingDraft(false)
                          },
                          authUser?.profile?.id ?? null, // ✅ FIX A-03: track who drafted
                        )
                      }}
                    >
                      {currentDraftId ? 'Draft ↑' : 'Draft'}{' '}
                      <span
                        style={{
                          opacity: 0.55,
                          fontSize: '10px',
                          marginLeft: 2,
                        }}
                      >
                        [⌥D]
                      </span>
                    </Button>
                  )}
                  {saleType === 'retail' && (
                    <Button
                      size="sm"
                      variant={prescriptionDetails ? 'filled' : 'light'}
                      color={prescriptionDetails ? 'green' : theme.primaryColor}
                      onClick={handleOpenPrescriptionModal}
                      title="Prescription [Alt+R]"
                    >
                      <IconPrescription size={16} />
                    </Button>
                  )}
                </Group>

                <Button
                  size="md"
                  fullWidth
                  color={theme.primaryColor}
                  style={{ flexShrink: 0 }}
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
                  title="Complete sale [Ctrl+Enter]"
                >
                  {isLoadingCredit
                    ? 'Validating...'
                    : isEditMode
                      ? 'Update Sale  [Ctrl+↵]'
                      : 'Complete Sale  [Ctrl+↵]'}
                </Button>
              </Stack>
            </PurchaseSection>
          </MainContent>
        </AppShell.Main>
      </AppShell>

      {/* ── Fixed Sales Orders button ─ bottom left ── */}
      <Box
        style={{
          position: 'fixed',
          bottom: 24,
          left: 24,
          zIndex: 200,
        }}
      >
        <Tooltip
          label="View all sales orders"
          position="right"
          withArrow
        >
          <Button
            size="sm"
            color={isDark ? theme.primaryColor : 'dark'}
            onClick={() => navigate('/sales/orders')}
            leftSection={<IconClipboardList size={16} />}
            style={{
              boxShadow: isDark
                ? `0 4px 12px rgba(0,0,0,0.4)`
                : `0 4px 12px rgba(0,0,0,0.2)`,
              borderRadius: 12,
            }}
          >
            Sales Orders
          </Button>
        </Tooltip>
      </Box>
    </AppContainer>
  )
}

export default SalePOS

