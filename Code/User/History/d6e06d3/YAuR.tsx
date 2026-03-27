// src/components/PrintBarcode/PrintBarcode.tsx - Enhanced with theming
import React, { useState, useEffect, useRef } from 'react'
import { useDispatch } from 'react-redux'
import {
  IconSearch,
  IconX,
  IconPrinter,
  IconCreditCard,
  IconAlertCircle,
  IconPackage,
} from '@tabler/icons-react'
import {
  Container,
  Title,
  Text,
  Grid,
  Select,
  TextInput,
  Checkbox,
  Button,
  Table,
  Center,
  Group,
  Stack,
  ActionIcon,
  Alert,
  Badge,
  Card,
  useMantineTheme,
  useMantineColorScheme,
} from '@mantine/core'
import { useAppSelector } from '@app/core/store/hooks/reduxHook'
import { RootState, AppDispatch } from '@app/core/store/store'
import { BarcodeSkeleton } from '@shared/components/skeletons/BarcodeSkeleton'
import {
  fetchInitialData,
  fetchStores,
  filterProducts,
  validateInputs,
  formatDate,
} from './utils/barCode.utils'
import {
  handleProductSearch,
  handleProductSelect,
  handleGenerateBarcode,
  handlePrintBarcode,
  handleResetBarcode,
} from './handlers/barCode.handlers'
import { getProductBatches } from './data/barCode.queries'
import { Area } from '@shared/types/area'
import { ProductCatalog, ProductBatch } from './types/BarCode.types'
import { Store } from '@shared/types/Store'
import { getPrimaryColor, getThemeColors } from '@app/core/theme/theme.utils'
import { PageWrapper } from '@shared/styles/PageWrapper'

const PrintBarcode: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>()
  const theme = useMantineTheme()
  const { colorScheme } = useMantineColorScheme()
  const resolvedColorScheme: 'light' | 'dark' =
    colorScheme === 'auto' ? 'light' : colorScheme

  const themeColors = getThemeColors(theme, resolvedColorScheme)
  const primaryColor = getPrimaryColor(theme)

  const userProfile = useAppSelector((state: RootState) => state.auth.user)
  const companyId = userProfile?.profile.company_id

  const [areas, setAreas] = useState<Area[]>([])
  const [products, setProducts] = useState<ProductCatalog[]>([])
  const [filteredStores, setFilteredStores] = useState<Store[]>([])
  const [filteredProducts, setFilteredProducts] = useState<ProductCatalog[]>([])
  const [availableBatches, setAvailableBatches] = useState<ProductBatch[]>([])

  const [selectedArea, setSelectedArea] = useState<string>('')
  const [selectedStore, setSelectedStore] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [selectedProduct, setSelectedProduct] = useState<ProductCatalog | null>(
    null,
  )
  const [selectedBatch, setSelectedBatch] = useState<ProductBatch | null>(null)
  const [paperSize, setPaperSize] = useState<string>('')
  const [showStoreName, setShowStoreName] = useState<boolean>(true)
  const [showProductName, setShowProductName] = useState<boolean>(true)
  const [showPrice, setShowPrice] = useState<boolean>(true)
  const [showBatchNumber, setShowBatchNumber] = useState<boolean>(true)
  const [showExpiryDate, setShowExpiryDate] = useState<boolean>(true)
  const [showProductDropdown, setShowProductDropdown] = useState<boolean>(false)
  const [loading, setLoading] = useState<boolean>(false)
  const [initializing, setInitializing] = useState<boolean>(true)
  const [storesLoading, setStoresLoading] = useState<boolean>(false)
  const [batchesLoading, setBatchesLoading] = useState<boolean>(false)
  const [error, setError] = useState<string>('')

  const dropdownRef = useRef<HTMLDivElement>(null)

  const useDebounce = (value: string, delay: number): string => {
    const [debouncedValue, setDebouncedValue] = useState(value)
    useEffect(() => {
      const handler = setTimeout(() => setDebouncedValue(value), delay)
      return () => clearTimeout(handler)
    }, [value, delay])
    return debouncedValue
  }

  const debouncedSearchQuery = useDebounce(searchQuery, 300)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent): void => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowProductDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (companyId) {
      fetchInitialData(
        companyId,
        setAreas,
        setProducts,
        setError,
        setLoading,
      ).finally(() => setInitializing(false))
    }
  }, [companyId])

  useEffect(() => {
    if (selectedArea && companyId) {
      fetchStores(
        selectedArea,
        companyId,
        setFilteredStores,
        setSelectedStore,
        setError,
        setStoresLoading,
      )
    }
  }, [selectedArea, companyId])

  useEffect(() => {
    filterProducts(
      debouncedSearchQuery,
      products,
      setFilteredProducts,
      setShowProductDropdown,
    )
  }, [debouncedSearchQuery, products])

  useEffect(() => {
    const productId = selectedProduct?.id

    if (!productId || !companyId) {
      setAvailableBatches([])
      setSelectedBatch(null)
      return
    }

    const fetchBatches = async () => {
      setBatchesLoading(true)

      try {
        let validStoreId: number | undefined = undefined

        if (selectedStore && selectedStore.trim() !== '') {
          const parsed = parseInt(selectedStore, 10)
          if (!isNaN(parsed) && parsed > 0) {
            validStoreId = parsed
          }
        }

        const { data, error } = await getProductBatches(
          companyId,
          productId,
          validStoreId,
        )

        if (error) {
          setError('Failed to load batches')
          setAvailableBatches([])
          return
        }

        const batches = data || []
        setAvailableBatches(batches)

        if (batches.length === 1) {
          setSelectedBatch(batches[0])
        } else {
          setSelectedBatch(null)
        }
      } catch (err) {
        setError('Failed to load batches')
        setAvailableBatches([])
      } finally {
        setBatchesLoading(false)
      }
    }

    fetchBatches()
  }, [selectedProduct?.id, companyId, selectedStore])

  const getBatchExpiryBadge = (batch: ProductBatch | null) => {
    if (!batch || !batch.expiry_date) return null
    const today = new Date()
    const expiryDate = new Date(batch.expiry_date)
    const daysUntilExpiry = Math.floor(
      (expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
    )

    if (daysUntilExpiry < 0) return <Badge color="red">Expired</Badge>
    if (daysUntilExpiry <= 30)
      return <Badge color="orange">Expires in {daysUntilExpiry} days</Badge>
    if (daysUntilExpiry <= 90)
      return <Badge color="yellow">Expires in {daysUntilExpiry} days</Badge>
    return <Badge color="green">Valid</Badge>
  }

  if (initializing || loading) {
    return <BarcodeSkeleton />
  }

  return (
    <PageWrapper>
      <Card
        shadow="sm"
        radius="md"
        p="xl"
        mb="md"
        style={{
          backgroundColor: themeColors.background,
        }}
      >
        <Group
          justify="space-between"
          align="center"
          mb="md"
        >
          <div>
            <Title
              order={2}
              c={themeColors.text}
            >
              Print Barcode with Batch
            </Title>
            <Text
              size="sm"
              c="dimmed"
              mt={4}
            >
              Dashboard / Print Barcode / Batch Selection
            </Text>
          </div>
        </Group>

        {error && (
          <Alert
            icon={<IconAlertCircle size={16} />}
            title="Error"
            color="red"
            mb="md"
            withCloseButton
            onClose={() => setError('')}
            styles={{
              root: { backgroundColor: themeColors.backgroundAlt },
            }}
          >
            {error}
          </Alert>
        )}

        <Grid
          gutter="md"
          mb="md"
        >
          <Grid.Col span={6}>
            <Select
              label="Area"
              placeholder="Select an area"
              data={areas.map((a) => ({
                value: a.id.toString(),
                label: a.area_name,
              }))}
              value={selectedArea}
              onChange={(value) => {
                setSelectedArea(value || '')
                setError('')
              }}
              required
              searchable
              clearable
            />
          </Grid.Col>
          <Grid.Col span={6}>
            <Select
              label="Store"
              placeholder="Select a store"
              data={filteredStores.map((s) => ({
                value: s.id.toString(),
                label: s.store_name,
              }))}
              value={selectedStore || null}
              onChange={(value) => {
                setSelectedStore(value || '')
                setError('')
              }}
              disabled={!selectedArea || storesLoading}
              required
              searchable
              clearable
            />
          </Grid.Col>
        </Grid>

        <div
          ref={dropdownRef}
          style={{ position: 'relative', marginBottom: '24px' }}
        >
          <TextInput
            label="Product"
            placeholder="Search by name, code, or generic name (min 2 characters)"
            value={searchQuery}
            onChange={(e) =>
              handleProductSearch(
                e.currentTarget.value,
                setSearchQuery,
                setSelectedProduct,
                setShowProductDropdown,
              )
            }
            leftSection={<IconSearch size={16} />}
            rightSection={
              searchQuery && (
                <ActionIcon
                  variant="subtle"
                  onClick={() => {
                    setSearchQuery('')
                    setSelectedProduct(null)
                    setShowProductDropdown(false)
                  }}
                >
                  <IconX size={16} />
                </ActionIcon>
              )
            }
            required
          />

          {showProductDropdown && (
            <Card
              shadow="md"
              p="xs"
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                zIndex: 1000,
                marginTop: '4px',
                maxHeight: '300px',
                overflowY: 'auto',
                backgroundColor: themeColors.background,
              }}
            >
              {filteredProducts.length > 0 ? (
                filteredProducts.map((product, index) => (
                  <div
                    key={
                      product.id || `product-${index}-${product.product_code}`
                    }
                    onClick={() =>
                      handleProductSelect(
                        product,
                        setSelectedProduct,
                        setSearchQuery,
                        setShowProductDropdown,
                        setError,
                      )
                    }
                    style={{
                      padding: '8px',
                      cursor: 'pointer',
                      borderBottom: `1px solid ${themeColors.border}`,
                      backgroundColor: themeColors.background,
                      borderRadius: '4px',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor =
                        themeColors.backgroundAlt
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor =
                        themeColors.background
                    }}
                  >
                    <Text
                      size="sm"
                      fw={500}
                      c={themeColors.text}
                    >
                      {product.product_name}
                    </Text>
                    <Text
                      size="xs"
                      c="dimmed"
                    >
                      {product.product_code || 'N/A'} -{' '}
                      {product.generic_name || 'N/A'}
                    </Text>
                  </div>
                ))
              ) : (
                <Text
                  size="sm"
                  c="dimmed"
                  ta="center"
                  py="md"
                >
                  No products found
                </Text>
              )}
            </Card>
          )}
        </div>

        {selectedProduct && (
          <Select
            label="Select Batch"
            placeholder={
              batchesLoading
                ? 'Loading batches...'
                : availableBatches.length === 0
                  ? 'No batches available'
                  : 'Select a batch'
            }
            data={availableBatches.map((b) => ({
              value: b.id.toString(),
              label: `${b.batch_number} - Qty: ${b.quantity_available} - Exp: ${b.expiry_date || 'N/A'}`,
            }))}
            value={selectedBatch?.id.toString() || ''}
            onChange={(value) => {
              const batch = availableBatches.find(
                (b) => b.id === parseInt(value || '0'),
              )
              setSelectedBatch(batch || null)
              setError('')
            }}
            disabled={batchesLoading || availableBatches.length === 0}
            required
            searchable
            clearable
            leftSection={<IconPackage size={16} />}
            mb="md"
          />
        )}

        {selectedBatch && (
          <Card
            withBorder
            mb="md"
            p="md"
            style={{
              backgroundColor: themeColors.backgroundAlt,
            }}
          >
            <Group
              justify="space-between"
              mb="xs"
            >
              <Text
                fw={600}
                size="sm"
                c={themeColors.text}
              >
                Selected Batch Details
              </Text>
              {getBatchExpiryBadge(selectedBatch)}
            </Group>
            <Grid>
              <Grid.Col span={3}>
                <Text
                  size="xs"
                  c="dimmed"
                >
                  Batch Number
                </Text>
                <Text
                  size="sm"
                  fw={500}
                  c={themeColors.text}
                >
                  {selectedBatch.batch_number}
                </Text>
              </Grid.Col>
              <Grid.Col span={3}>
                <Text
                  size="xs"
                  c="dimmed"
                >
                  Available Quantity
                </Text>
                <Text
                  size="sm"
                  fw={500}
                  c={themeColors.text}
                >
                  {selectedBatch.quantity_available} units
                </Text>
              </Grid.Col>
              <Grid.Col span={3}>
                <Text
                  size="xs"
                  c="dimmed"
                >
                  Manufacturing Date
                </Text>
                <Text
                  size="sm"
                  fw={500}
                  c={themeColors.text}
                >
                  {formatDate(selectedBatch.manufacturing_date)}
                </Text>
              </Grid.Col>
              <Grid.Col span={3}>
                <Text
                  size="xs"
                  c="dimmed"
                >
                  Expiry Date
                </Text>
                <Text
                  size="sm"
                  fw={500}
                  c={themeColors.text}
                >
                  {formatDate(selectedBatch.expiry_date)}
                </Text>
              </Grid.Col>
            </Grid>
          </Card>
        )}

        <Table.ScrollContainer
          minWidth={500}
          mb="md"
        >
          <Table
            striped
            highlightOnHover
            withTableBorder
            style={{ backgroundColor: themeColors.background }}
          >
            <Table.Thead style={{ backgroundColor: themeColors.backgroundAlt }}>
              <Table.Tr>
                <Table.Th>Product</Table.Th>
                <Table.Th>Code</Table.Th>
                <Table.Th>Category</Table.Th>
                <Table.Th>Batch</Table.Th>
                <Table.Th>Expiry</Table.Th>
                <Table.Th>Manufacturer</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {selectedProduct ? (
                <Table.Tr>
                  <Table.Td>{selectedProduct.product_name}</Table.Td>
                  <Table.Td>
                    {selectedProduct.product_code ||
                      selectedProduct.barcode ||
                      'N/A'}
                  </Table.Td>
                  <Table.Td>{selectedProduct.category_name || 'N/A'}</Table.Td>
                  <Table.Td>
                    {selectedBatch?.batch_number || 'Not selected'}
                  </Table.Td>
                  <Table.Td>
                    {selectedBatch
                      ? formatDate(selectedBatch.expiry_date)
                      : 'N/A'}
                  </Table.Td>
                  <Table.Td>{selectedProduct.manufacturer || 'N/A'}</Table.Td>
                </Table.Tr>
              ) : (
                <Table.Tr>
                  <Table.Td colSpan={6}>
                    <Center py="xl">
                      <Stack
                        align="center"
                        gap="xs"
                      >
                        <IconCreditCard
                          size={40}
                          color="#adb5bd"
                        />
                        <Text
                          size="sm"
                          c="dimmed"
                        >
                          No product selected
                        </Text>
                      </Stack>
                    </Center>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>

        <Grid
          gutter="md"
          align="flex-end"
          mb="md"
        >
          <Grid.Col span={{ base: 12, md: 3 }}>
            <Select
              label="Paper Size"
              placeholder="Select size"
              data={[
                { value: 'a4', label: 'A4 (210mm x 297mm)' },
                { value: 'a5', label: 'A5 (148mm x 210mm)' },
                { value: 'label', label: 'Label (2" x 1")' },
              ]}
              value={paperSize}
              onChange={(value) => {
                setPaperSize(value || '')
                setError('')
              }}
              required
              clearable
            />
          </Grid.Col>
          <Grid.Col span={{ base: 6, md: 2 }}>
            <Checkbox
              label="Store Name"
              checked={showStoreName}
              onChange={(e) => setShowStoreName(e.currentTarget.checked)}
              color={theme.primaryColor}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 6, md: 2 }}>
            <Checkbox
              label="Product Name"
              checked={showProductName}
              onChange={(e) => setShowProductName(e.currentTarget.checked)}
              color={theme.primaryColor}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 6, md: 2 }}>
            <Checkbox
              label="Batch No"
              checked={showBatchNumber}
              onChange={(e) => setShowBatchNumber(e.currentTarget.checked)}
              color={theme.primaryColor}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 6, md: 2 }}>
            <Checkbox
              label="Expiry"
              checked={showExpiryDate}
              onChange={(e) => setShowExpiryDate(e.currentTarget.checked)}
              color={theme.primaryColor}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 6, md: 1 }}>
            <Checkbox
              label="Price"
              checked={showPrice}
              onChange={(e) => setShowPrice(e.currentTarget.checked)}
              color={theme.primaryColor}
            />
          </Grid.Col>
        </Grid>

        <Group
          justify="flex-end"
          gap="md"
        >
          <Button
            leftSection={<IconCreditCard size={18} />}
            onClick={() =>
              handleGenerateBarcode(
                validateInputs,
                filteredStores,
                selectedStore,
                selectedProduct,
                selectedBatch,
                paperSize,
                showStoreName,
                showProductName,
                showBatchNumber,
                showExpiryDate,
                showPrice,
                dispatch,
                setError,
              )
            }
            disabled={!selectedProduct || !selectedBatch || !paperSize}
            color={theme.primaryColor}
            variant="light"
          >
            Generate Barcode
          </Button>
          <Button
            leftSection={<IconPrinter size={18} />}
            onClick={() =>
              handlePrintBarcode(
                validateInputs,
                filteredStores,
                selectedStore,
                selectedProduct,
                selectedBatch,
                paperSize,
                showStoreName,
                showProductName,
                showBatchNumber,
                showExpiryDate,
                showPrice,
                setError,
              )
            }
            disabled={!selectedProduct || !selectedBatch || !paperSize}
            color="green"
          >
            Print Barcode
          </Button>
          <Button
            leftSection={<IconX size={18} />}
            onClick={() =>
              handleResetBarcode(
                setSelectedArea,
                setSelectedStore,
                setSearchQuery,
                setSelectedProduct,
                setSelectedBatch,
                setPaperSize,
                setShowStoreName,
                setShowProductName,
                setShowBatchNumber,
                setShowExpiryDate,
                setShowPrice,
                setError,
              )
            }
            color="red"
            variant="outline"
          >
            Reset
          </Button>
        </Group>
      </Card>
    </PageWrapper>
  )
}

export default PrintBarcode

