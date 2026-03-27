// src/features/purchases/components/ProductGridInfiniteScroll.CSS_FIX.tsx
// ✅ CSS FIX: Properly handle overflow and height issues
import React from 'react'
import InfiniteScroll from 'react-infinite-scroll-component'
import { Loader, Text, Center, Stack } from '@mantine/core'
import { ProductCard } from './ProductCard'
import { ProductGridSkeleton } from '@shared/components/skeletons/ProductGrid.skeleton'

interface ProductGridInfiniteScrollProps {
  products: any[]
  isLoading?: boolean
  isLoadingMore: boolean
  hasMore: boolean
  onLoadMore: () => void
  onAddProduct: (product: any) => void
  totalCount: number
  mode?: 'sales' | 'purchase' // ✅ NEW: controls whether NO_BATCH/OUT_OF_STOCK blocks clicking
}

export const ProductGridInfiniteScroll: React.FC<
  ProductGridInfiniteScrollProps
> = ({
  products,
  isLoading = false,
  isLoadingMore,
  hasMore,
  onLoadMore,
  onAddProduct,
  totalCount,
  mode = 'sales', // default keeps existing sales behaviour unchanged
}) => {
  // Show skeleton when initially loading
  if (isLoading && products.length === 0) {
    return <ProductGridSkeleton count={40} />
  }

  // Show empty state
  if (products.length === 0 && !isLoading && !isLoadingMore) {
    return (
      <Center p="xl">
        <Stack
          align="center"
          gap="md"
        >
          <Text
            size="lg"
            c="#6B7280"
          >
            No products found
          </Text>
          <Text
            size="sm"
            c="#9CA3AF"
          >
            Try adjusting your search or filters
          </Text>
        </Stack>
      </Center>
    )
  }

  return (
    <div
      id="scrollableProductList"
      style={{
        height: '100%',
        overflow: 'auto',
        width: '100%',
      }}
    >
      <InfiniteScroll
        dataLength={products.length}
        next={onLoadMore}
        hasMore={hasMore}
        loader={
          <Center
            p="md"
            key="loader"
          >
            <Stack
              align="center"
              gap="xs"
            >
              <Loader
                size="sm"
                color="gray"
              />
              <Text
                size="xs"
                c="#6B7280"
              >
                Loading more products...
              </Text>
            </Stack>
          </Center>
        }
        endMessage={
          products.length > 0 ? (
            <Center
              p="md"
              key="end"
            >
              <Text
                size="sm"
                c="#6B7280"
              >
                Showing all {totalCount} products
              </Text>
            </Center>
          ) : null
        }
        scrollThreshold={0.8}
        scrollableTarget="scrollableProductList"
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
            gap: '12px',
            padding: '16px',
            width: '100%',
          }}
        >
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onAddProduct={onAddProduct}
              mode={mode} // ✅ pass down
            />
          ))}
        </div>
      </InfiniteScroll>
    </div>
  )
}

export default ProductGridInfiniteScroll

