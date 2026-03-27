// File: TableContent.tsx (Updated with improved filter button visibility)
import React, { useState, useRef, useEffect } from 'react'
import {
  TextInput,
  Button,
  Table,
  ActionIcon,
  Group,
  Pagination,
  Menu,
  Text,
  Tooltip,
  Box,
  useMantineTheme,
  useMantineColorScheme,
  Loader,
  Center,
} from '@mantine/core'
import {
  IconSearch,
  IconChevronDown,
  IconMaximize,
  IconMinimize,
  IconCheck,
  IconDots,
  IconX,
} from '@tabler/icons-react'
import {
  Card,
  SearchBar,
  Footer,
  StyledTable,
  ScrollContainer,
  ResizeHandle,
} from './styles'
import { TableContentProps, RowAction } from './types'
import { TableContentSkeleton } from '../skeletons/TableContent.skeleton'
import { alpha } from '@mantine/core'

const PAGE_SIZE_OPTIONS = [8, 15, 25, 50, 100]

// Extracted so it can have its own hover state — hooks can't be used inside .map()
function ActionCell({
  actions,
  row,
  rowIndex,
  isFullScreen,
  onExitFullScreen,
  colorScheme,
  theme,
}: {
  actions: RowAction[]
  row: any
  rowIndex: number
  isFullScreen: boolean
  onExitFullScreen: () => void
  colorScheme: string
  theme: any
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <Menu
      shadow="md"
      width={200}
      position="bottom-end"
      withinPortal
      zIndex={1001}
    >
      <Menu.Target>
        <Table.Td
          onClick={(e) => e.stopPropagation()}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          style={{
            right: 0,
            padding: 0,
            verticalAlign: 'middle',
            width: '60px',
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'background-color 0.15s ease',
            backgroundColor: hovered
              ? colorScheme === 'dark'
                ? theme.colors.dark[5]
                : theme.colors.gray[2]
              : 'inherit',
          }}
        >
          <Box
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              height: '100%',
              minHeight: '36px',
            }}
          >
            <IconDots
              size={16}
              color={hovered ? theme.colors.gray[7] : theme.colors.gray[5]}
            />
          </Box>
        </Table.Td>
      </Menu.Target>
      <Menu.Dropdown>
        {actions.map((act, k) => (
          <Menu.Item
            key={k}
            leftSection={act.icon}
            color={act.color}
            onClick={(e) => {
              e.stopPropagation()
              if (isFullScreen) onExitFullScreen()
              act.onClick?.(row, rowIndex)
            }}
          >
            {act.label || `Action ${k + 1}`}
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  )
}

function TableContent({
  columns = [],
  data = [],
  loading = false,
  searchPlaceholder = 'Search',
  filters = [],
  rowActions = [],
  onSearch,
  pagination = true,
  onRowClick,
  selectedRowId,
  totalCount = 0,
  currentPage = 1,
  pageSize = 8,
  onPageChange,
  onPageSizeChange,
  rowIdAccessor = 'id',
  selectable = false,
  striped = false,
}: TableContentProps & { striped?: boolean }) {
  const theme = useMantineTheme()
  const { colorScheme } = useMantineColorScheme()
  const [searchQuery, setSearchQuery] = useState('')
  const [isFullScreen, setIsFullScreen] = useState(false)
  const [columnWidths, setColumnWidths] = useState<number[]>(
    columns?.map(() => 0) || [],
  )
  const [resizingIndex, setResizingIndex] = useState<number | null>(null)
  const [startX, setStartX] = useState(0)
  const [startWidth, setStartWidth] = useState(0)
  const headerRefs = useRef<(HTMLTableCellElement | null)[]>([])

  const themedProps = { ...theme, colorScheme }

  const getSelectionColor = (isHover: boolean = false) => {
    const primaryColor = theme.colors[theme.primaryColor][6]
    if (isHover) {
      return alpha(primaryColor, 0.08)
    }
    return alpha(primaryColor, 0.05)
  }

  const getHoverColor = () => {
    return colorScheme === 'dark' ? theme.colors.dark[5] : theme.colors.gray[0]
  }

  const getBackgroundColor = () => {
    return colorScheme === 'dark' ? theme.colors.dark[7] : theme.white
  }

  useEffect(() => {
    if (
      !loading &&
      data?.length > 0 &&
      columnWidths.every((w) => w === 0) &&
      !isFullScreen
    ) {
      const widths = headerRefs.current.map((ref) => ref?.offsetWidth || 200)
      setColumnWidths(widths)
    }
  }, [loading, data, columnWidths, isFullScreen])

  useEffect(() => {
    setColumnWidths(columns?.map(() => 0) || [])
  }, [isFullScreen, columns])

  const serverTotalPages = Math.ceil(totalCount / pageSize)

  const handleSearchClick = () => {
    onSearch?.(searchQuery)
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearchClick()
    }
  }

  const handleClearSearch = () => {
    setSearchQuery('')
    onSearch?.('')
  }

  const toggleFullScreen = () => setIsFullScreen(!isFullScreen)

  const getRowActions = (row: any, rowIndex: number): RowAction[] =>
    typeof rowActions === 'function'
      ? rowActions(row, rowIndex)
      : rowActions || []

  const hasActions = (): boolean => {
    if (typeof rowActions === 'function') {
      return data?.length > 0 && getRowActions(data[0], 0).length > 0
    }
    return Array.isArray(rowActions) && rowActions.length > 0
  }

  const handleResizeStart = (e: React.MouseEvent, index: number) => {
    e.preventDefault()
    e.stopPropagation()
    setResizingIndex(index)
    setStartX(e.clientX)
    setStartWidth(columnWidths[index])
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (resizingIndex === null) return
      const diff = e.clientX - startX
      const newWidth = Math.max(80, startWidth + diff)
      setColumnWidths((prev) => {
        const newWidths = [...prev]
        newWidths[resizingIndex] = newWidth
        return newWidths
      })
    }
    const handleMouseUp = () => {
      setResizingIndex(null)
    }
    if (resizingIndex !== null) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [resizingIndex, startX, startWidth])

  const renderTruncatedContent = (content: any, col: any) => {
    if (content === null || content === undefined) {
      return (
        <Text
          c="dimmed"
          fw={500}
        >
          -
        </Text>
      )
    }
    const contentString = String(content)
    return (
      <Tooltip
        label={contentString}
        disabled={contentString.length <= (col.maxLength || 40)}
        withinPortal
        multiline
        w={300}
      >
        <Box
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: '100%',
            display: 'block',
          }}
        >
          {contentString}
        </Box>
      </Tooltip>
    )
  }

  const renderTableBody = () => {
    if (!Array.isArray(data) || !Array.isArray(columns) || data.length === 0) {
      return (
        <Table.Tr>
          <Table.Td
            colSpan={Math.max(columns?.length || 1, 1) + (hasActions() ? 1 : 0)}
          >
            <Center py="xl">
              <Text
                c="dimmed"
                size="sm"
                fw={500}
              >
                No data available
              </Text>
            </Center>
          </Table.Td>
        </Table.Tr>
      )
    }

    return data.map((row, rowIndex) => {
      const currentRowActions = getRowActions(row, rowIndex)
      const isSelected = selectable && row[rowIdAccessor] === selectedRowId

      return (
        <Table.Tr
          key={rowIndex}
          onClick={selectable ? () => onRowClick?.(row) : undefined}
          style={{
            cursor: selectable ? 'pointer' : 'default',
            backgroundColor: isSelected ? getSelectionColor() : 'transparent',
            transition: 'background-color 0.15s ease',
          }}
          className={`${selectable ? 'selectable-row' : ''} ${isSelected ? 'selected' : ''}`}
          onMouseEnter={(e) => {
            if (selectable && !isSelected) {
              e.currentTarget.style.backgroundColor = getHoverColor()
            } else if (selectable && isSelected) {
              e.currentTarget.style.backgroundColor = getSelectionColor(true)
            }
          }}
          onMouseLeave={(e) => {
            if (selectable && isSelected) {
              e.currentTarget.style.backgroundColor = getSelectionColor()
            } else if (selectable) {
              e.currentTarget.style.backgroundColor = 'transparent'
            }
          }}
        >
          {columns.map((col, j) => (
            <Table.Td
              key={j}
              style={{
                width: columnWidths[j]
                  ? `${columnWidths[j]}px`
                  : col.maxWidth || col.minWidth || 'auto',
                minWidth: columnWidths[j]
                  ? `${columnWidths[j]}px`
                  : col.minWidth,
                maxWidth: columnWidths[j]
                  ? `${columnWidths[j]}px`
                  : col.maxWidth || '200px',
                borderRight: `1px solid ${
                  colorScheme === 'dark'
                    ? theme.colors.dark[4]
                    : theme.colors.gray[3]
                }`,
              }}
            >
              {col.render ? (
                <div
                  style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {col.render(row, rowIndex)}
                </div>
              ) : (
                renderTruncatedContent(row[col.accessor], col)
              )}
            </Table.Td>
          ))}

          {currentRowActions.length > 0 && (
            <Menu
              shadow="md"
              width={200}
              position="bottom-end"
              withinPortal
              zIndex={1001}
            >
              <Menu.Target>
                {/*
                 * The whole Table.Td is the menu target.
                 * Clicking anywhere in the cell opens the dropdown.
                 * e.stopPropagation() prevents the row's onRowClick from firing.
                 */}
                <Table.Td
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    right: 0,
                    backgroundColor: 'inherit',
                    padding: 0,
                    verticalAlign: 'middle',
                    width: '60px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    transition: 'background-color 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor =
                      colorScheme === 'dark'
                        ? theme.colors.dark[5]
                        : theme.colors.gray[1]
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'inherit'
                  }}
                >
                  <Box
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '100%',
                      height: '100%',
                      minHeight: '36px',
                    }}
                  >
                    <IconDots
                      size={16}
                      color={theme.colors.gray[6]}
                    />
                  </Box>
                </Table.Td>
              </Menu.Target>
              <Menu.Dropdown>
                {currentRowActions.map((act, k) => (
                  <Menu.Item
                    key={k}
                    leftSection={act.icon}
                    color={act.color}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (isFullScreen) {
                        setIsFullScreen(false)
                      }
                      act.onClick?.(row, rowIndex)
                    }}
                  >
                    {act.label || `Action ${k + 1}`}
                  </Menu.Item>
                ))}
              </Menu.Dropdown>
            </Menu>
          )}
        </Table.Tr>
      )
    })
  }

  if (!Array.isArray(columns) || columns.length === 0) {
    return (
      <Card theme={themedProps}>
        <Center py="xl">
          <Text
            c="dimmed"
            fw={500}
          >
            No columns defined
          </Text>
        </Center>
      </Card>
    )
  }

  return (
    <Card
      theme={themedProps}
      className={isFullScreen ? 'full-screen' : ''}
      style={
        isFullScreen
          ? {
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 1000,
              padding: theme.spacing.xl,
              backgroundColor: getBackgroundColor(),
              display: 'flex',
              flexDirection: 'column',
              height: '100vh',
            }
          : {
              display: 'flex',
              flexDirection: 'column',
            }
      }
    >
      <SearchBar theme={themedProps}>
        <Group
          gap={0}
          style={{ flex: 1, maxWidth: 400 }}
        >
          <TextInput
            placeholder={searchPlaceholder}
            leftSection={<IconSearch size={16} />}
            rightSection={
              searchQuery ? (
                <ActionIcon
                  size="sm"
                  variant="subtle"
                  color="gray"
                  onClick={handleClearSearch}
                  disabled={loading}
                >
                  <IconX size={14} />
                </ActionIcon>
              ) : null
            }
            style={{ flex: 1 }}
            radius="md"
            styles={{
              input: {
                borderTopRightRadius: 0,
                borderBottomRightRadius: 0,
                borderRight: 'none',
                fontWeight: 500,
              },
            }}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={loading}
          />
          <ActionIcon
            size={36}
            variant="filled"
            color={theme.primaryColor}
            onClick={handleSearchClick}
            disabled={loading}
            style={{
              borderTopLeftRadius: 0,
              borderBottomLeftRadius: 0,
            }}
          >
            {loading ? (
              <Loader
                size="xs"
                color="white"
              />
            ) : (
              <IconSearch size={18} />
            )}
          </ActionIcon>
        </Group>
        <Group gap="xs">
          {filters?.map((filter, i) => (
            <Menu
              key={i}
              shadow="md"
              width={150}
              position="bottom-start"
              withinPortal={isFullScreen}
              zIndex={isFullScreen ? 1001 : undefined}
            >
              <Menu.Target>
                <Button
                  variant="default"
                  rightSection={<IconChevronDown size={16} />}
                  radius="md"
                  disabled={loading}
                  styles={{
                    root: {
                      fontWeight: 600,
                      border: `1.5px solid ${
                        colorScheme === 'dark'
                          ? theme.colors.dark[4]
                          : theme.colors.gray[4]
                      }`,
                      backgroundColor:
                        colorScheme === 'dark'
                          ? theme.colors.dark[6]
                          : theme.white,
                      color:
                        colorScheme === 'dark'
                          ? theme.colors.dark[0]
                          : theme.colors.gray[8],
                      '&:hover': {
                        backgroundColor:
                          colorScheme === 'dark'
                            ? theme.colors.dark[5]
                            : theme.colors.gray[0],
                        borderColor:
                          colorScheme === 'dark'
                            ? theme.colors.dark[3]
                            : theme.colors.gray[5],
                      },
                    },
                  }}
                >
                  {filter.currentValue !== undefined
                    ? filter.options?.find(
                        (opt) => opt.value === filter.currentValue,
                      )?.label || filter.label
                    : filter.label}
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                {filter.options?.map((opt, j) => (
                  <Menu.Item
                    key={j}
                    onClick={() => filter.onChange?.(opt.value)}
                    rightSection={
                      filter.currentValue === opt.value ? (
                        <IconCheck size={14} />
                      ) : undefined
                    }
                  >
                    {opt.label}
                  </Menu.Item>
                ))}
              </Menu.Dropdown>
            </Menu>
          ))}
          <Tooltip
            label={isFullScreen ? 'Exit full screen' : 'Enter full screen'}
          >
            <ActionIcon
              variant="default"
              onClick={toggleFullScreen}
              disabled={loading}
              size="lg"
              radius="md"
              styles={{
                root: {
                  border: `1.5px solid ${
                    colorScheme === 'dark'
                      ? theme.colors.dark[4]
                      : theme.colors.gray[4]
                  }`,
                  backgroundColor:
                    colorScheme === 'dark' ? theme.colors.dark[6] : theme.white,
                  color:
                    colorScheme === 'dark'
                      ? theme.colors.dark[0]
                      : theme.colors.gray[8],
                  '&:hover': {
                    backgroundColor:
                      colorScheme === 'dark'
                        ? theme.colors.dark[5]
                        : theme.colors.gray[0],
                    borderColor:
                      colorScheme === 'dark'
                        ? theme.colors.dark[3]
                        : theme.colors.gray[5],
                  },
                },
              }}
            >
              {isFullScreen ? (
                <IconMinimize size={18} />
              ) : (
                <IconMaximize size={18} />
              )}
            </ActionIcon>
          </Tooltip>
        </Group>
      </SearchBar>

      <ScrollContainer
        $isFullScreen={isFullScreen}
        theme={themedProps}
      >
        {loading ? (
          <TableContentSkeleton />
        ) : (
          <div style={{ width: 'fit-content', minWidth: '100%' }}>
            <StyledTable
              theme={themedProps}
              highlightOnHover={selectable}
              className={striped ? 'striped' : ''}
              style={{
                tableLayout: isFullScreen ? 'auto' : 'fixed',
                width:
                  !isFullScreen && columnWidths.some((w) => w > 0)
                    ? columnWidths.reduce((sum, w) => sum + w, 0) +
                      (hasActions() ? 60 : 0)
                    : '100%',
              }}
            >
              <Table.Thead
                style={
                  isFullScreen
                    ? {
                        position: 'sticky',
                        top: 0,
                        backgroundColor: getBackgroundColor(),
                        zIndex: 10,
                        boxShadow: theme.shadows.sm,
                      }
                    : {
                        position: 'sticky',
                        top: 0,
                        backgroundColor: getBackgroundColor(),
                        zIndex: 10,
                      }
                }
              >
                <Table.Tr>
                  {columns.map((col, i) => (
                    <Table.Th
                      key={i}
                      ref={(el) => (headerRefs.current[i] = el)}
                      style={{
                        width: columnWidths[i]
                          ? `${columnWidths[i]}px`
                          : col.maxWidth || col.minWidth || 'auto',
                        minWidth: columnWidths[i]
                          ? `${columnWidths[i]}px`
                          : col.minWidth,
                        maxWidth: columnWidths[i]
                          ? `${columnWidths[i]}px`
                          : col.maxWidth || '200px',
                        position: 'relative',
                        padding: theme.spacing.md,
                        borderRight: `1px solid ${
                          colorScheme === 'dark'
                            ? theme.colors.dark[4]
                            : theme.colors.gray[3]
                        }`,
                      }}
                    >
                      <div
                        style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {col.header}
                      </div>
                      <ResizeHandle
                        theme={themedProps}
                        $isResizing={resizingIndex === i}
                        onMouseDown={(e) => handleResizeStart(e, i)}
                        title="Drag to resize column"
                      >
                        <div className="resize-indicator" />
                      </ResizeHandle>
                    </Table.Th>
                  ))}
                  {hasActions() && (
                    <Table.Th
                      style={{
                        right: 0,
                        backgroundColor: getBackgroundColor(),
                        boxShadow: `-2px 0 4px ${
                          colorScheme === 'dark'
                            ? 'rgba(0,0,0,0.3)'
                            : theme.colors.gray[1]
                        }`,
                        zIndex: 2,
                        padding: theme.spacing.md,
                        width: '60px',
                        textAlign: 'center',
                      }}
                    ></Table.Th>
                  )}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>{renderTableBody()}</Table.Tbody>
            </StyledTable>
          </div>
        )}
      </ScrollContainer>

      {pagination && (
        <Footer
          theme={themedProps}
          style={
            isFullScreen
              ? {
                  position: 'sticky',
                  bottom: 0,
                  backgroundColor: getBackgroundColor(),
                  padding: `${theme.spacing.md} 0`,
                  marginTop: 'auto',
                  borderTop: `1.5px solid ${
                    colorScheme === 'dark'
                      ? theme.colors.dark[4]
                      : theme.colors.gray[4]
                  }`,
                }
              : {}
          }
        >
          <Group gap="xs">
            <Text
              size="sm"
              c="dimmed"
              fw={500}
            >
              Rows per page:
            </Text>
            <Menu
              shadow="md"
              width={80}
              position="top-start"
              withinPortal={isFullScreen}
              zIndex={isFullScreen ? 1001 : undefined}
            >
              <Menu.Target>
                <Button
                  variant="default"
                  size="xs"
                  w={70}
                  rightSection={<IconChevronDown size={14} />}
                  disabled={loading}
                  styles={{
                    root: {
                      fontWeight: 600,
                      border: `1.5px solid ${
                        colorScheme === 'dark'
                          ? theme.colors.dark[4]
                          : theme.colors.gray[4]
                      }`,
                      backgroundColor:
                        colorScheme === 'dark'
                          ? theme.colors.dark[6]
                          : theme.white,
                      color:
                        colorScheme === 'dark'
                          ? theme.colors.dark[0]
                          : theme.colors.gray[8],
                      '&:hover': {
                        backgroundColor:
                          colorScheme === 'dark'
                            ? theme.colors.dark[5]
                            : theme.colors.gray[0],
                      },
                    },
                  }}
                >
                  {pageSize}
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <Menu.Item
                    key={size}
                    onClick={() => onPageSizeChange?.(size)}
                    rightSection={
                      pageSize === size ? <IconCheck size={14} /> : undefined
                    }
                  >
                    {size}
                  </Menu.Item>
                ))}
              </Menu.Dropdown>
            </Menu>
            <Text
              size="sm"
              c="dimmed"
              fw={500}
            >
              {`${(currentPage - 1) * pageSize + 1}-${Math.min(
                currentPage * pageSize,
                totalCount,
              )} of ${totalCount}`}
            </Text>
          </Group>
          <Pagination
            total={serverTotalPages}
            value={currentPage}
            onChange={onPageChange}
            size="sm"
            withEdges
            disabled={loading}
            color={theme.primaryColor}
          />
        </Footer>
      )}
    </Card>
  )
}

export default TableContent

