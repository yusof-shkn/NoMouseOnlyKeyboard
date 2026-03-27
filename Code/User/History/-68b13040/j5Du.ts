// src/pages/StockHistory/types/stockHistory.types.ts

export interface StockHistoryItem {
  // Transaction identification
  transaction_type: 'RECEIPT' | 'SALE' | 'RETURN' | 'ADJUSTMENT'
  transaction_id: number
  reference_number: string | null

  // Product information
  product_id: number
  product_name: string
  product_code: string | null

  // Store information
  store_id: number
  store_name: string

  // Batch information
  batch_number: string | null

  // Quantity and pricing
  quantity: number
  unit_price: number | null
  total_amount: number | null

  // Customer information (for sales/returns)
  customer_id: number | null
  customer_name: string | null

  // Supplier information (for receipts)
  supplier_id: number | null
  supplier_name: string | null

  // Reference information
  reference_id: number | null
  reference_order_number: string | null

  // Batch details
  manufacturing_date: string | null
  expiry_date: string | null
  storage_location: string | null

  // Unit information
  unit_name: string | null
  unit_short_code: string | null

  // Additional information
  notes: string | null
  processed_by: number | null
  company_id: number

  // Timestamps
  transaction_date: string
  created_at: string
}

export interface StockHistoryFilters {
  page?: number
  pageSize?: number
  searchQuery?: string
  storeId?: string | number | null
  productId?: string | number | null
  batchNumber?: string | null
  transactionType?: 'RECEIPT' | 'SALE' | 'RETURN' | 'ADJUSTMENT' | null
  startDate?: string | null
  endDate?: string | null
  customerId?: string | number | null
  supplierId?: string | number | null
  companyId?: string | number | null
  isUnlocked?: boolean
}

export interface StockHistoryStats {
  totalTransactions: number
  totalQuantityIn: number
  totalQuantityOut: number
  netQuantityChange: number
  totalValue: number
  uniqueProducts: number
}

export interface FetchStockHistoryResult {
  items: StockHistoryItem[]
  totalCount: number
  stats: StockHistoryStats
}

export interface ExpiryStatus {
  isExpired: boolean
  isNearExpiry: boolean
  isCriticalExpiry: boolean
  daysUntilExpiry: number
}

