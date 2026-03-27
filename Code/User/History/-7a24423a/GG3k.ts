// src/features/purchases/hooks/usePurchaseData.REAL_FIX.ts
// ✅ REAL FIX: Proper pagination reset when switching categories
import { useState, useEffect, useCallback, useRef } from 'react'
import {
  fetchProductsWithInventoryPaginated,
  fetchCategoriesWithCount,
  fetchSuppliers,
  fetchUnits,
} from '../data/PurchasePOP.queries'

export const usePurchaseDataOptimized = (
  companyId: number,
  storeId: number,
  isUnlocked = false,
) => {
  const [products, setProducts] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [units, setUnits] = useState<any[]>([])

  const [isInitialLoading, setIsInitialLoading] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [currentPage, setCurrentPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [totalCount, setTotalCount] = useState(0)

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(
    null,
  )

  const searchTimeoutRef = useRef<NodeJS.Timeout>()
  const loadingRef = useRef(false)
  const initialProductsLoadedRef = useRef(false)

  const PAGE_SIZE = 20

  // Load initial data (categories, suppliers, units)
  useEffect(() => {
    const loadInitialData = async () => {
      if (!companyId || !storeId) {
        setIsInitialLoading(false)
        return
      }

      try {
        setIsInitialLoading(true)
        setLoadError(null)

        const [categoriesData, suppliersData, unitsData] = await Promise.all([
          fetchCategoriesWithCount(companyId, storeId),
          fetchSuppliers(companyId),
          fetchUnits(companyId),
        ])

        console.log('✅ Categories loaded with counts:', categoriesData)
        setCategories(categoriesData)
        setSuppliers(suppliersData)
        setUnits(unitsData)
      } catch (error) {
        console.error('Error loading initial data:', error)
        setLoadError(
          error instanceof Error
            ? error.message
            : 'Failed to load data. Please try again.',
        )
      } finally {
        setIsInitialLoading(false)
      }
    }

    loadInitialData()
  }, [companyId, storeId])

  // Load products (paginated)
  const loadProducts = useCallback(
    async (page: number, append: boolean = false) => {
      if (!companyId || !storeId) return

      if (loadingRef.current) {
        console.log('⏸️ Load already in progress, skipping...')
        return
      }

      try {
        loadingRef.current = true

        if (append) {
          setIsLoadingMore(true)
        } else {
          setIsLoading(true)
        }
        setLoadError(null)

        console.log(
          `📦 Loading products: page=${page}, append=${append}, search="${searchQuery}", category=${selectedCategoryId}`,
        )

        const result = await fetchProductsWithInventoryPaginated(
          companyId,
          storeId,
          {
            page,
            pageSize: PAGE_SIZE,
            searchQuery,
            categoryId: selectedCategoryId,
            isUnlocked,
          },
        )

        console.log(
          `✅ Loaded ${result.products.length} products, hasMore=${result.hasMore}, total=${result.totalCount}`,
        )

        if (append) {
          setProducts((prev) => {
            const existingIds = new Set(prev.map((p) => p.id))
            const newProducts = result.products.filter(
              (p) => !existingIds.has(p.id),
            )
            console.log(`➕ Adding ${newProducts.length} new products`)
            return [...prev, ...newProducts]
          })
        } else {
          setProducts(result.products)
        }

        setHasMore(result.hasMore)
        setTotalCount(result.totalCount)
        setCurrentPage(page)

        if (!initialProductsLoadedRef.current && result.products.length > 0) {
          initialProductsLoadedRef.current = true
          console.log('✅ Initial products loaded, infinite scroll ready')
        }
      } catch (error) {
        console.error('❌ Error loading products:', error)

        // ✅ FIX: Better error handling for 416 range errors
        const errorMessage =
          error instanceof Error ? error.message : String(error)
        if (
          errorMessage.includes('416') ||
          errorMessage.includes('Range Not Satisfiable')
        ) {
          console.log('⚠️ Range error - no more products available')
          setHasMore(false)
          // Don't show error to user, just stop loading
        } else {
          setLoadError(
            error instanceof Error
              ? error.message
              : 'Failed to load products. Please try again.',
          )
        }
      } finally {
        setIsLoading(false)
        setIsLoadingMore(false)
        loadingRef.current = false
      }
    },
    [companyId, storeId, searchQuery, selectedCategoryId, isUnlocked],
  )

  // ✅ FIX: Reset EVERYTHING when filters change (category/search)
  useEffect(() => {
    console.log('🔄 Filters changed - FULL RESET')
    console.log('   - Search:', searchQuery)
    console.log('   - Category:', selectedCategoryId)

    // Reset all pagination state
    setCurrentPage(1)
    setProducts([])
    setHasMore(true)
    setTotalCount(0)
    initialProductsLoadedRef.current = false
    loadingRef.current = false

    // Load first page
    loadProducts(1, false)
  }, [searchQuery, selectedCategoryId, companyId, storeId, isUnlocked])

  // Load more products
  const loadMore = useCallback(() => {
    if (loadingRef.current) {
      console.log('❌ Cannot load more: Already loading')
      return
    }

    if (isLoadingMore) {
      console.log('❌ Cannot load more: isLoadingMore is true')
      return
    }

    if (!hasMore) {
      console.log('❌ Cannot load more: No more items (hasMore=false)')
      return
    }

    if (!initialProductsLoadedRef.current) {
      console.log('❌ Cannot load more: Initial products not yet loaded')
      return
    }

    console.log(`📦 Loading more products, page: ${currentPage + 1}`)
    loadProducts(currentPage + 1, true)
  }, [currentPage, hasMore, isLoadingMore, loadProducts])

  // Handle search with debounce
  const handleSearch = useCallback((query: string) => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    setIsLoading(true)

    searchTimeoutRef.current = setTimeout(() => {
      console.log(`🔍 Search query changed to: "${query}"`)
      setSearchQuery(query)
    }, 300)
  }, [])

  // Handle category filter
  const handleCategoryFilter = useCallback((categoryId: number | null) => {
    console.log(`📁 Category filter changed to: ${categoryId}`)
    setIsLoading(true)
    setSelectedCategoryId(categoryId)
  }, [])

  // Refresh products
  const refreshProducts = useCallback(() => {
    console.log('🔄 Refreshing products...')
    setCurrentPage(1)
    setProducts([])
    setHasMore(true)
    setTotalCount(0)
    initialProductsLoadedRef.current = false
    loadingRef.current = false
    loadProducts(1, false)
  }, [loadProducts])

  // Cleanup
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [])

  return {
    // Data
    products,
    categories,
    suppliers,
    units,

    // Loading states
    isLoading: isInitialLoading || isLoading,
    isLoadingMore,
    loadError,

    // Pagination
    hasMore,
    totalCount,
    currentPage,

    // Filters
    searchQuery,
    selectedCategoryId,

    // Actions
    loadMore,
    handleSearch,
    handleCategoryFilter,
    refreshProducts,
  }
}

export default usePurchaseDataOptimized

