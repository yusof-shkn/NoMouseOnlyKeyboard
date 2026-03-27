/**
 * PointOfViewPage.skeleton.tsx
 *
 * Mirrors the POS (Sales) and Purchase POP pages exactly:
 *  - Full viewport height layout
 *  - Real Navbar at top
 *  - Two-panel split: products (60%) + order panel (40% / min 340px)
 *
 * Products panel:
 *   - Header: title + refresh button
 *   - Search bar + category chips row
 *   - Product grid (4 cols)
 *
 * Order panel:
 *   - Supplier select + date inputs
 *   - Order items empty placeholder
 *   - Totals summary
 *   - Payment method chips
 *   - Submit button
 */
import React from 'react'
import {
  ScrollArea,
  useMantineTheme,
  useMantineColorScheme,
} from '@mantine/core'
import {
  AppContainer,
  MainContent,
  ProductsSection,
  ProductsHeader,
  PurchaseSection,
} from '@features/purchase/components/POP/styles'
import { ShimmerStyle } from './ShimmerStyle'
import { ProductGridSkeleton } from './ProductGrid.skeleton'
import { Skeleton } from './Skeleton'

const CATEGORY_WIDTHS = [110, 80, 95, 75, 100, 85, 70, 90]

export const PointOfViewPageSkeleton: React.FC = () => {
  const theme = useMantineTheme()
  const { colorScheme } = useMantineColorScheme()
  const isDark = colorScheme === 'dark'

  const panelBg = isDark ? theme.colors.dark[7] : theme.colors.gray[0]
  const cardBg = isDark ? theme.colors.dark[6] : theme.white
  const border = isDark ? theme.colors.dark[4] : theme.colors.gray[2]
  const divLine = isDark ? theme.colors.dark[4] : theme.colors.gray[2]

  return (
    <>
      <ShimmerStyle />
      <AppContainer>
        <MainContent>
          {/* ── Products panel (60%) ─────────────────────────────── */}
          <ProductsSection $fullWidth={false}>
            {/* Header */}
            <ProductsHeader>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <Skeleton
                  width={180}
                  height={24}
                  radius={5}
                />
                <Skeleton
                  width={240}
                  height={13}
                  radius={4}
                />
              </div>
              <Skeleton
                width={36}
                height={36}
                radius={6}
              />
            </ProductsHeader>

            {/* Search bar + badge */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <Skeleton
                height={36}
                style={{ flex: 1 }}
                radius={6}
              />
              <Skeleton
                width={90}
                height={36}
                radius={99}
              />
            </div>

            {/* Category chips */}
            <div
              style={{
                display: 'flex',
                gap: 6,
                marginBottom: 12,
                overflow: 'hidden',
              }}
            >
              {CATEGORY_WIDTHS.map((w, i) => (
                <Skeleton
                  key={i}
                  width={w}
                  height={28}
                  radius={99}
                  style={{ flexShrink: 0 }}
                />
              ))}
            </div>

            {/* Product grid */}
            <ProductGridSkeleton count={16} />
          </ProductsSection>

          {/* ── Order panel (40%) ───────────────────────────────── */}
          <PurchaseSection $hidden={false}>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                height: '100%',
              }}
            >
              {/* Supplier select + date row */}
              <div
                style={{
                  background: cardBg,
                  border: `1px solid ${border}`,
                  borderRadius: theme.radius.md,
                  padding: 10,
                }}
              >
                <div
                  style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
                >
                  {/* Supplier */}
                  <div
                    style={{ display: 'flex', flexDirection: 'column', gap: 4 }}
                  >
                    <Skeleton
                      width={60}
                      height={11}
                      radius={3}
                    />
                    <Skeleton
                      width="100%"
                      height={32}
                      radius={6}
                    />
                  </div>
                  {/* Date + Invoice row */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: 8,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4,
                      }}
                    >
                      <Skeleton
                        width={55}
                        height={11}
                        radius={3}
                      />
                      <Skeleton
                        width="100%"
                        height={32}
                        radius={6}
                      />
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4,
                      }}
                    >
                      <Skeleton
                        width={70}
                        height={11}
                        radius={3}
                      />
                      <Skeleton
                        width="100%"
                        height={32}
                        radius={6}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Order items header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Skeleton
                    width={80}
                    height={14}
                    radius={4}
                  />
                  <Skeleton
                    width={28}
                    height={20}
                    radius={99}
                  />
                </div>
                <Skeleton
                  width={60}
                  height={14}
                  radius={4}
                />
              </div>

              {/* Empty cart placeholder */}
              <div
                style={{
                  flex: 1,
                  background: cardBg,
                  border: `1px solid ${border}`,
                  borderRadius: theme.radius.md,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: 160,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  <Skeleton
                    width={44}
                    height={44}
                    circle
                  />
                  <Skeleton
                    width={130}
                    height={16}
                    radius={4}
                  />
                  <Skeleton
                    width={180}
                    height={13}
                    radius={4}
                  />
                </div>
              </div>

              {/* Totals summary */}
              <div
                style={{
                  background: cardBg,
                  border: `1px solid ${border}`,
                  borderRadius: theme.radius.md,
                  padding: 10,
                }}
              >
                <div
                  style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
                >
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                      }}
                    >
                      <Skeleton
                        width={70}
                        height={12}
                        radius={4}
                      />
                      <Skeleton
                        width={55}
                        height={12}
                        radius={4}
                      />
                    </div>
                  ))}
                  <div
                    style={{ height: 1, background: divLine, margin: '2px 0' }}
                  />
                  <div
                    style={{ display: 'flex', justifyContent: 'space-between' }}
                  >
                    <Skeleton
                      width={90}
                      height={15}
                      radius={4}
                    />
                    <Skeleton
                      width={70}
                      height={15}
                      radius={4}
                    />
                  </div>
                </div>
              </div>

              {/* Action buttons row */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 6,
                }}
              >
                <Skeleton
                  height={32}
                  radius={6}
                />
                <Skeleton
                  height={32}
                  radius={6}
                />
              </div>

              {/* Payment method chips */}
              <div
                style={{
                  background: cardBg,
                  border: `1px solid ${border}`,
                  borderRadius: theme.radius.md,
                  padding: 10,
                }}
              >
                <Skeleton
                  width={100}
                  height={12}
                  radius={4}
                  style={{ marginBottom: 8 }}
                />
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(5, 1fr)',
                    gap: 5,
                  }}
                >
                  {[0, 1, 2, 3, 4].map((i) => (
                    <Skeleton
                      key={i}
                      height={40}
                      radius={6}
                    />
                  ))}
                </div>
              </div>

              {/* Submit button */}
              <Skeleton
                height={38}
                radius={6}
              />
            </div>
          </PurchaseSection>
        </MainContent>
      </AppContainer>
    </>
  )
}

export default PointOfViewPageSkeleton

