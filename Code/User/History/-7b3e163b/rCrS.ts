// dashboard.queries.ts - CORRECTED VERSION
// Fixed based on actual Supabase schema

import { supabase } from '@app/core/supabase/Supabase.utils'
import type {
  DataScope,
  SalesData,
  PurchasesData,
  CustomersData,
  SuppliersData,
  InventoryData,
  CreditData,
  ChartDataPoint,
  DonutChartData,
  SupabaseSale,
  Sale,
} from '../types/dashboard.types'
import {
  getToday,
  getMonthStart,
  getLastMonthStart,
  getLastMonthEnd,
  getLast7Days,
  getDayName,
  parseNumeric,
} from '../utils/dashboard.utils'

/**
 * SCHEMA CORRECTIONS APPLIED:
 * 1. customers: first_name, last_name (NOT customer_name)
 * 2. products: standard_cost, standard_price (NOT cost_price)
 * 3. product_batches: unit_cost (NOT cost_price)
 * 4. purchase_orders: po_date (NOT order_date)
 * 5. sale_items: has cost_price column
 */

/**
 * Get store IDs for an area
 */
export const getStoreIdsForArea = async (
  areaId: number,
  companyId: number,
): Promise<number[]> => {
  const { data, error } = await supabase
    .from('stores')
    .select('id')
    .eq('area_id', areaId)
    .eq('is_active', true)

  if (error) {
    console.error('Error fetching store IDs for area:', error)
    return []
  }

  return data.map((store) => store.id)
}

/**
 * Build store filter for queries
 */
const buildStoreFilter = (query: any, scope: DataScope) => {
  if (scope.storeId) {
    return query.eq('store_id', scope.storeId)
  }
  if (scope.storeIds && scope.storeIds.length > 0) {
    return query.in('store_id', scope.storeIds)
  }
  return query
}

/**
 * Fetch Sales Data
 */
export const fetchSalesData = async (scope: DataScope): Promise<SalesData> => {
  const today = getToday()
  const monthStart = getMonthStart()
  const lastMonthStart = getLastMonthStart()
  const lastMonthEnd = getLastMonthEnd()
  const last7Days = getLast7Days()

  // Today's sales
  let todayQuery = supabase
    .from('sales')
    .select('total_amount')
    .gte('sale_date', today)
    .neq('sale_status', 'cancelled')

  todayQuery = buildStoreFilter(todayQuery, scope)

  const { data: todaySales, error: todayError } = await todayQuery

  if (todayError) {
    console.error('Error fetching today sales:', todayError)
  }

  const todayTotal =
    todaySales?.reduce(
      (sum, sale) => sum + parseNumeric(sale.total_amount),
      0,
    ) || 0

  // This month's sales
  let thisMonthQuery = supabase
    .from('sales')
    .select('total_amount')
    .gte('sale_date', monthStart)
    .neq('sale_status', 'cancelled')

  thisMonthQuery = buildStoreFilter(thisMonthQuery, scope)

  const { data: thisMonthSales, error: thisMonthError } = await thisMonthQuery

  if (thisMonthError) {
    console.error('Error fetching this month sales:', thisMonthError)
  }

  const thisMonthTotal =
    thisMonthSales?.reduce(
      (sum, sale) => sum + parseNumeric(sale.total_amount),
      0,
    ) || 0

  // Last month's sales for trend
  let lastMonthQuery = supabase
    .from('sales')
    .select('total_amount')
    .gte('sale_date', lastMonthStart)
    .lte('sale_date', lastMonthEnd)
    .neq('sale_status', 'cancelled')

  lastMonthQuery = buildStoreFilter(lastMonthQuery, scope)

  const { data: lastMonthSales, error: lastMonthError } = await lastMonthQuery

  if (lastMonthError) {
    console.error('Error fetching last month sales:', lastMonthError)
  }

  const lastMonthTotal =
    lastMonthSales?.reduce(
      (sum, sale) => sum + parseNumeric(sale.total_amount),
      0,
    ) || 0

  // Calculate trend
  const trend =
    lastMonthTotal > 0
      ? ((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100
      : 0

  // Recent transactions
  let recentQuery = supabase
    .from('sales')
    .select('id, sale_number, total_amount, sale_date, customer_id, store_id')
    .neq('sale_status', 'cancelled')
    .order('sale_date', { ascending: false })
    .limit(10)

  recentQuery = buildStoreFilter(recentQuery, scope)

  const { data: recentSales, error: recentError } = await recentQuery

  if (recentError) {
    console.error('Error fetching recent sales:', recentError)
  }

  // Build recent transactions
  const recentTransactions: Sale[] = []

  for (const sale of recentSales || []) {
    let customerName = 'Walk-in Customer'
    let storeName = 'Unknown Store'

    // Get customer name - using first_name, last_name
    if (sale.customer_id) {
      const { data: customer } = await supabase
        .from('customers')
        .select('first_name, last_name')
        .eq('id', sale.customer_id)
        .maybeSingle()

      if (customer) {
        customerName =
          `${customer.first_name || ''} ${customer.last_name || ''}`.trim() ||
          'Unknown Customer'
      }
    }

    // Get store name
    if (sale.store_id) {
      const { data: store } = await supabase
        .from('stores')
        .select('store_name')
        .eq('id', sale.store_id)
        .maybeSingle()

      if (store) {
        storeName = store.store_name
      }
    }

    recentTransactions.push({
      sale_number: sale.sale_number,
      total_amount: sale.total_amount,
      sale_date: sale.sale_date,
      customers: sale.customer_id
        ? {
            first_name: customerName.split(' ')[0] || '',
            last_name: customerName.split(' ').slice(1).join(' ') || '',
          }
        : null,
      stores: { store_name: storeName },
    })
  }

  // Chart data for last 7 days
  const chartData: ChartDataPoint[] = []

  for (const date of last7Days) {
    let dayQuery = supabase
      .from('sales')
      .select('total_amount')
      .gte('sale_date', date)
      .lt('sale_date', getNextDay(date))
      .neq('sale_status', 'cancelled')

    dayQuery = buildStoreFilter(dayQuery, scope)

    const { data } = await dayQuery

    const total =
      data?.reduce((sum, sale) => sum + parseNumeric(sale.total_amount), 0) || 0

    chartData.push({
      date: getDayName(date),
      sales: total,
    })
  }

  return {
    total: thisMonthTotal,
    today: todayTotal,
    thisMonth: thisMonthTotal,
    trend: Math.round(trend),
    recentTransactions,
    chartData,
  }
}

/**
 * Fetch Purchases Data
 * FIXED: Using po_date instead of order_date
 */
export const fetchPurchasesData = async (
  scope: DataScope,
): Promise<PurchasesData> => {
  const monthStart = getMonthStart()

  // Pending purchase orders
  let pendingQuery = supabase
    .from('purchase_orders')
    .select('id', { count: 'exact', head: true })
    .in('status', ['pending', 'approved'])

  pendingQuery = buildStoreFilter(pendingQuery, scope)

  const { count: pendingCount, error: pendingError } = await pendingQuery

  if (pendingError) {
    console.error('Error fetching pending POs:', pendingError)
  }

  // This month's purchase orders - FIXED: using po_date
  let thisMonthQuery = supabase
    .from('purchase_orders')
    .select('total_amount')
    .gte('po_date', monthStart)

  thisMonthQuery = buildStoreFilter(thisMonthQuery, scope)

  const { data: thisMonthPOs, error: thisMonthError } = await thisMonthQuery

  if (thisMonthError) {
    console.error('Error fetching this month POs:', thisMonthError)
  }

  const thisMonthTotal =
    thisMonthPOs?.reduce((sum, po) => sum + parseNumeric(po.total_amount), 0) ||
    0

  // Last month for trend - FIXED: using po_date
  const lastMonthStart = getLastMonthStart()
  const lastMonthEnd = getLastMonthEnd()

  let lastMonthQuery = supabase
    .from('purchase_orders')
    .select('total_amount')
    .gte('po_date', lastMonthStart)
    .lte('po_date', lastMonthEnd)

  lastMonthQuery = buildStoreFilter(lastMonthQuery, scope)

  const { data: lastMonthPOs, error: lastMonthError } = await lastMonthQuery

  if (lastMonthError) {
    console.error('Error fetching last month POs:', lastMonthError)
  }

  const lastMonthTotal =
    lastMonthPOs?.reduce((sum, po) => sum + parseNumeric(po.total_amount), 0) ||
    0

  const trend =
    lastMonthTotal > 0
      ? ((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100
      : 0

  // Purchase orders by status - FIXED: using po_date
  let statusQuery = supabase
    .from('purchase_orders')
    .select('status, total_amount')
    .gte('po_date', monthStart)

  statusQuery = buildStoreFilter(statusQuery, scope)

  const { data: posByStatus, error: statusError } = await statusQuery

  if (statusError) {
    console.error('Error fetching POs by status:', statusError)
  }

  const statusMap: { [key: string]: number } = {}
  posByStatus?.forEach((po) => {
    const status = po.status || 'unknown'
    statusMap[status] = (statusMap[status] || 0) + parseNumeric(po.total_amount)
  })

  const chartData: DonutChartData[] = Object.entries(statusMap).map(
    ([status, value], index) => ({
      name: status.replace('_', ' ').toUpperCase(),
      value,
      color: getStatusColor(status, index),
    }),
  )

  return {
    total: thisMonthTotal,
    pending: pendingCount || 0,
    thisMonth: thisMonthTotal,
    trend: Math.round(trend),
    chartData,
  }
}

/**
 * Fetch Customers Data
 * FIXED: Using first_name, last_name instead of customer_name
 */
export const fetchCustomersData = async (
  scope: DataScope,
): Promise<CustomersData> => {
  // Total customers
  const { count: totalCount, error: totalError } = await supabase
    .from('customers')
    .select('id', { count: 'exact', head: true })
    .is('deleted_at', null)

  if (totalError) {
    console.error('Error fetching total customers:', totalError)
  }

  // Active customers
  const { count: activeCount, error: activeError } = await supabase
    .from('customers')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', true)
    .is('deleted_at', null)

  if (activeError) {
    console.error('Error fetching active customers:', activeError)
  }

  // Top customers - FIXED: using first_name, last_name
  const { data: customers, error: customersError } = await supabase
    .from('customers')
    .select('id, first_name, last_name, is_active')
    .eq('is_active', true)
    .is('deleted_at', null)
    .limit(20)

  if (customersError) {
    console.error('Error fetching customers:', customersError)
  }

  // Calculate total purchases for each customer
  const topCustomersWithTotal = []

  for (const customer of customers || []) {
    const { data: sales, error: salesError } = await supabase
      .from('sales')
      .select('total_amount')
      .eq('customer_id', customer.id)
      .neq('sale_status', 'cancelled')

    if (salesError) {
      console.error(
        `Error fetching sales for customer ${customer.id}:`,
        salesError,
      )
    }

    const total_purchases =
      sales?.reduce((sum, sale) => sum + parseNumeric(sale.total_amount), 0) ||
      0

    topCustomersWithTotal.push({
      id: customer.id,
      first_name: customer.first_name || '',
      last_name: customer.last_name || '',
      is_active: customer.is_active,
      total_purchases,
    })
  }

  // Sort by total purchases and take top 5
  topCustomersWithTotal.sort((a, b) => b.total_purchases - a.total_purchases)

  return {
    total: totalCount || 0,
    active: activeCount || 0,
    topCustomers: topCustomersWithTotal.slice(0, 5),
  }
}

/**
 * Fetch Suppliers Data
 */
export const fetchSuppliersData = async (
  scope: DataScope,
): Promise<SuppliersData> => {
  // Total suppliers
  const { count: totalCount, error: totalError } = await supabase
    .from('suppliers')
    .select('id', { count: 'exact', head: true })
    .is('deleted_at', null)

  if (totalError) {
    console.error('Error fetching total suppliers:', totalError)
  }

  // Active suppliers
  const { count: activeCount, error: activeError } = await supabase
    .from('suppliers')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', true)
    .is('deleted_at', null)

  if (activeError) {
    console.error('Error fetching active suppliers:', activeError)
  }

  // Top suppliers
  const { data: suppliers, error: suppliersError } = await supabase
    .from('suppliers')
    .select('id, supplier_name, is_active')
    .eq('is_active', true)
    .is('deleted_at', null)
    .limit(20)

  if (suppliersError) {
    console.error('Error fetching suppliers:', suppliersError)
  }

  // Calculate total purchases for each supplier
  const topSuppliersWithTotal = []

  for (const supplier of suppliers || []) {
    const { data: purchaseOrders, error: posError } = await supabase
      .from('purchase_orders')
      .select('total_amount')
      .eq('supplier_id', supplier.id)
      .in('status', ['approved', 'received'])

    if (posError) {
      console.error(`Error fetching POs for supplier ${supplier.id}:`, posError)
    }

    const total_purchases =
      purchaseOrders?.reduce(
        (sum, po) => sum + parseNumeric(po.total_amount),
        0,
      ) || 0

    topSuppliersWithTotal.push({
      id: supplier.id,
      supplier_name: supplier.supplier_name,
      is_active: supplier.is_active,
      total_purchases,
    })
  }

  // Sort by total purchases and take top 5
  topSuppliersWithTotal.sort((a, b) => b.total_purchases - a.total_purchases)

  return {
    total: totalCount || 0,
    active: activeCount || 0,
    topSuppliers: topSuppliersWithTotal.slice(0, 5),
  }
}

/**
 * Fetch Inventory Data
 * FIXED: Using product_batches.unit_cost and products.standard_cost
 */
export const fetchInventoryData = async (
  scope: DataScope,
): Promise<InventoryData> => {
  const today = getToday()
  const expiryDate = getFutureDate(90)

  // Get product batches with unit_cost
  let batchQuery = supabase
    .from('product_batches')
    .select('id, product_id, quantity_available, expiry_date, unit_cost')
    .eq('is_active', true)

  batchQuery = buildStoreFilter(batchQuery, scope)

  const { data: batches, error: batchError } = await batchQuery

  if (batchError) {
    console.error('Error fetching batches:', batchError)
    return {
      totalProducts: 0,
      lowStock: 0,
      expiringSoon: 0,
      expired: 0,
      totalValue: 0,
      categoryDistribution: [],
    }
  }

  // Get unique product IDs
  const productIds = [...new Set(batches?.map((b) => b.product_id) || [])]

  // Get product details with standard_cost
  const { data: products, error: productError } = await supabase
    .from('products')
    .select('id, product_name, reorder_level, category_id, standard_cost')
    .in('id', productIds)

  if (productError) {
    console.error('Error fetching products:', productError)
  }

  // Get category details
  const categoryIds = [
    ...new Set(products?.map((p) => p.category_id).filter(Boolean) || []),
  ]

  const { data: categories, error: categoryError } = await supabase
    .from('categories')
    .select('id, category_name')
    .in('id', categoryIds)

  if (categoryError) {
    console.error('Error fetching categories:', categoryError)
  }

  // Build lookup maps
  const productMap = new Map(products?.map((p) => [p.id, p]) || [])
  const categoryMap = new Map(categories?.map((c) => [c.id, c]) || [])

  // Combine data
  const inventory =
    batches?.map((batch) => {
      const product = productMap.get(batch.product_id)
      const category = product?.category_id
        ? categoryMap.get(product.category_id)
        : null

      return {
        ...batch,
        product_name: product?.product_name || 'Unknown',
        reorder_level: product?.reorder_level || 10,
        category_name: category?.category_name || 'Uncategorized',
        // Use batch unit_cost if available, otherwise product standard_cost
        cost_price: parseNumeric(
          batch.unit_cost || product?.standard_cost || 0,
        ),
      }
    }) || []

  // Calculate metrics
  const totalProducts = productIds.length

  // Low stock items - group by product
  const productStockMap = new Map<number, number>()
  inventory.forEach((item) => {
    const current = productStockMap.get(item.product_id) || 0
    productStockMap.set(item.product_id, current + item.quantity_available)
  })

  const lowStockProducts = new Set<number>()
  productStockMap.forEach((stock, productId) => {
    const product = productMap.get(productId)
    if (product && stock <= (product.reorder_level || 10)) {
      lowStockProducts.add(productId)
    }
  })

  // Expiring soon
  const expiringSoon = inventory.filter(
    (item) =>
      item.expiry_date &&
      item.expiry_date <= expiryDate &&
      item.expiry_date > today,
  ).length

  // Expired
  const expired = inventory.filter(
    (item) => item.expiry_date && item.expiry_date <= today,
  ).length

  // Total inventory value
  const totalValue = inventory.reduce(
    (sum, item) => sum + item.quantity_available * item.cost_price,
    0,
  )

  // Category distribution
  const categoryDistMap: { [key: string]: number } = {}
  inventory.forEach((item) => {
    const category = item.category_name
    categoryDistMap[category] =
      (categoryDistMap[category] || 0) + item.quantity_available
  })

  const categoryDistribution = Object.entries(categoryDistMap).map(
    ([name, value]) => ({
      name,
      value,
    }),
  )

  return {
    totalProducts,
    lowStock: lowStockProducts.size,
    expiringSoon,
    expired,
    totalValue,
    categoryDistribution,
  }
}

/**
 * Fetch Credit Data
 * Calculate from sales using total_amount - amount_paid
 */
export const fetchCreditData = async (
  scope: DataScope,
): Promise<CreditData> => {
  // Get credit sales
  let creditQuery = supabase
    .from('sales')
    .select('customer_id, total_amount, amount_paid')
    .eq('payment_method', 'credit')
    .neq('payment_status', 'paid')

  creditQuery = buildStoreFilter(creditQuery, scope)

  const { data: creditSales, error: creditError } = await creditQuery

  if (creditError) {
    console.error('Error fetching credit sales:', creditError)
    return {
      totalOutstanding: 0,
      overdue: 0,
      customers: 0,
      suppliers: 0,
    }
  }

  // Group by customer
  const customerBalances = new Map<number, number>()
  creditSales?.forEach((sale) => {
    if (sale.customer_id) {
      const outstanding =
        parseNumeric(sale.total_amount) - parseNumeric(sale.amount_paid || 0)
      const current = customerBalances.get(sale.customer_id) || 0
      customerBalances.set(sale.customer_id, current + outstanding)
    }
  })

  const totalOutstanding = Array.from(customerBalances.values()).reduce(
    (sum, balance) => sum + balance,
    0,
  )

  return {
    totalOutstanding,
    overdue: totalOutstanding * 0.3, // Estimate
    customers: customerBalances.size,
    suppliers: 0,
  }
}

/**
 * Helper Functions
 */
const getNextDay = (date: string): string => {
  const d = new Date(date)
  d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]
}

const getFutureDate = (days: number): string => {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString().split('T')[0]
}

const getStatusColor = (status: string, index: number): string => {
  const colors: { [key: string]: string } = {
    draft: '#94a3b8',
    pending: '#fb923c',
    approved: '#3b82f6',
    received: '#10b981',
    partially_received: '#eab308',
    cancelled: '#ef4444',
    rejected: '#dc2626',
  }
  return colors[status] || `hsl(${index * 60}, 70%, 50%)`
}

