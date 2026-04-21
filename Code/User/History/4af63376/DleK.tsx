import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Stack,
  Text,
  Badge,
  Group,
  Loader,
  Center,
  Avatar,
  Button,
  TextInput,
  Table,
} from '@mantine/core'
import {
  TbTruck,
  TbUser,
  TbHistory,
  TbArrowLeft,
  TbUserCheck,
  TbSearch,
  TbCircleCheck,
  TbPackage,
  TbSend,
  TbCheck,
  TbX,
} from 'react-icons/tb'
import { SavedColors } from '@shared/constants'
import { supabase } from '../../../lib/supabase'
import type { DbMedication } from '../../../lib/supabase'
import { formatRelativeTime } from '../../../shared/utils/formatTime'
import styled from 'styled-components'

/* ── Types ── */
interface StaffInfo {
  id: string
  name: string
  provider_name: string
}
interface OrderRow {
  id: string
  order_number: string
  status: string
  subtotal?: number
  insured_amount?: number
  cash_only?: boolean
  insurance_approval_ref?: string
  insurance_approved_by_name?: string
  updated_at: string
  created_at: string
  profile_id?: string
  profiles?: { name: string; photo_url?: string }
  medications?: DbMedication[]
}

/* ── Styled ── */
const PageWrap = styled.div`
  padding: 28px 32px;
  max-width: 1800px;
  @media (max-width: 899px) {
    padding: 16px;
  }
`

const PageHeader = styled.div`
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin-bottom: 24px;
  flex-wrap: wrap;
  gap: 12px;
`

const StatsBar = styled.div`
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
  flex-wrap: wrap;
`

const StatChip = styled.div<{ $active?: boolean }>`
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 7px 14px;
  border-radius: 8px;
  border: 1.5px solid
    ${(p) =>
      p.$active
        ? 'var(--mantine-color-cyan-4)'
        : 'var(--mantine-color-default-border)'};
  background: ${(p) =>
    p.$active ? 'rgba(21,179,224,0.07)' : 'var(--mantine-color-body)'};
  cursor: pointer;
  transition: all 0.14s;
  &:hover {
    border-color: var(--mantine-color-cyan-4);
    background: rgba(21, 179, 224, 0.05);
  }
`

const TableWrap = styled.div`
  background: var(--mantine-color-body);
  border: 1.5px solid var(--mantine-color-default-border);
  border-radius: 12px;
  overflow: hidden;
`

const TableHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid var(--mantine-color-default-border);
  background: var(--mantine-color-default-hover);
  gap: 12px;
  flex-wrap: wrap;
`

const TRow = styled.tr`
  cursor: pointer;
  transition: background 0.12s;
  &:hover td {
    background: var(--mantine-color-default-hover);
  }
  &:not(:last-child) td {
    border-bottom: 1px solid var(--mantine-color-default-border);
  }
`

const TCell = styled.td`
  padding: 12px 16px;
  vertical-align: middle;
  background: var(--mantine-color-body);
  transition: background 0.12s;
`

const THead = styled.th`
  padding: 10px 16px;
  text-align: left;
  font-family: 'DM Sans', sans-serif;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--mantine-color-dimmed);
  background: var(--mantine-color-default-hover);
  border-bottom: 1.5px solid var(--mantine-color-default-border);
  white-space: nowrap;
`

/* Mobile card */
const CardRow = styled.div`
  border-bottom: 1px solid var(--mantine-color-default-border);
  padding: 12px 16px;
  cursor: pointer;
  transition: background 0.12s;
  &:hover {
    background: var(--mantine-color-default-hover);
  }
  &:last-child {
    border-bottom: none;
  }
`

const EmptyState = styled.div`
  padding: 48px 24px;
  text-align: center;
  color: var(--mantine-color-dimmed);
`

const HistoryBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 8px;
  border: 1.5px solid var(--mantine-color-default-border);
  background: var(--mantine-color-body);
  cursor: pointer;
  font-family: 'DM Sans', sans-serif;
  font-size: 13px;
  font-weight: 600;
  color: var(--mantine-color-dimmed);
  transition: all 0.15s;
  &:hover {
    border-color: ${SavedColors.Primaryblue};
    color: ${SavedColors.Primaryblue};
    background: rgba(21, 179, 224, 0.04);
  }
`

/* ── Status helpers ── */
const TRACKING_STATUSES = [
  'awaiting_confirmation',
  'confirmed',
  'packing',
  'dispatched',
  'out_for_delivery',
]
const HISTORY_STATUSES = ['delivered', 'cancelled', 'rejected']

const STATUS_META: Record<
  string,
  { color: string; label: string; icon: JSX.Element }
> = {
  awaiting_confirmation: {
    color: 'orange',
    label: 'Awaiting Customer',
    icon: <TbUser size={12} />,
  },
  confirmed: {
    color: 'green',
    label: 'Confirmed',
    icon: <TbCircleCheck size={12} />,
  },
  packing: { color: 'violet', label: 'Packing', icon: <TbPackage size={12} /> },
  dispatched: {
    color: 'cyan',
    label: 'Dispatched',
    icon: <TbSend size={12} />,
  },
  out_for_delivery: {
    color: 'cyan',
    label: 'Out for Delivery',
    icon: <TbTruck size={12} />,
  },
  delivered: { color: 'teal', label: 'Delivered', icon: <TbCheck size={12} /> },
  cancelled: { color: 'red', label: 'Cancelled', icon: <TbX size={12} /> },
  rejected: { color: 'red', label: 'Rejected', icon: <TbX size={12} /> },
}

function statusMeta(s: string) {
  return (
    STATUS_META[s] ?? { color: 'gray', label: s.replace(/_/g, ' '), icon: null }
  )
}

/* ── Desktop table row ── */
function DesktopRow({
  o,
  onClick,
}: {
  o: OrderRow
  onClick: () => void
}): JSX.Element {
  const profile = o.profiles as { name?: string; photo_url?: string } | null
  const meta = statusMeta(o.status)
  return (
    <TRow onClick={onClick}>
      <TCell>
        <Group
          gap={10}
          wrap="nowrap"
        >
          <Avatar
            src={profile?.photo_url}
            size={32}
            radius="xl"
            color="lotusCyan"
          >
            <TbUser size={14} />
          </Avatar>
          <Box style={{ minWidth: 0 }}>
            <Text
              size="sm"
              fw={700}
              c={SavedColors.TextColor}
              style={{ whiteSpace: 'nowrap' }}
            >
              {profile?.name ?? '—'}
            </Text>
            {o.insurance_approved_by_name && (
              <Group gap={4}>
                <TbUserCheck
                  size={10}
                  color="#9ca3af"
                />
                <Text
                  size="xs"
                  c="dimmed"
                >
                  {o.insurance_approved_by_name}
                </Text>
              </Group>
            )}
          </Box>
        </Group>
      </TCell>
      <TCell>
        <Text
          size="sm"
          fw={600}
          c="dimmed"
          ff="monospace"
        >
          #{o.order_number}
        </Text>
        {o.insurance_approval_ref && (
          <Text
            size="xs"
            c="teal"
            fw={600}
          >
            Ref: {o.insurance_approval_ref}
          </Text>
        )}
      </TCell>
      <TCell>
        <Badge
          size="sm"
          color={meta.color}
          variant="light"
          leftSection={meta.icon}
        >
          {meta.label}
        </Badge>
      </TCell>
      <TCell>
        {o.subtotal != null ? (
          <Box>
            <Text
              size="sm"
              fw={600}
            >
              UGX {o.subtotal.toLocaleString()}
            </Text>
            <Text
              size="xs"
              c="dimmed"
            >
              Insured: UGX {(o.insured_amount ?? 0).toLocaleString()}
            </Text>
          </Box>
        ) : (
          <Text
            size="sm"
            c="dimmed"
          >
            —
          </Text>
        )}
      </TCell>
      <TCell>
        <Text
          size="xs"
          c="dimmed"
        >
          {formatRelativeTime(o.updated_at)}
        </Text>
      </TCell>
    </TRow>
  )
}

/* ── Mobile card ── */
function MobileCard({
  o,
  onClick,
}: {
  o: OrderRow
  onClick: () => void
}): JSX.Element {
  const profile = o.profiles as { name?: string; photo_url?: string } | null
  const meta = statusMeta(o.status)
  return (
    <CardRow onClick={onClick}>
      <Group
        justify="space-between"
        wrap="nowrap"
      >
        <Group gap={10}>
          <Avatar
            src={profile?.photo_url}
            size={36}
            radius="xl"
            color="lotusCyan"
          >
            <TbUser size={16} />
          </Avatar>
          <Box>
            <Text
              size="sm"
              fw={700}
              c={SavedColors.TextColor}
            >
              {profile?.name ?? '—'}
            </Text>
            <Text
              size="xs"
              c="dimmed"
            >
              #{o.order_number} · {formatRelativeTime(o.updated_at)}
            </Text>
            {o.subtotal != null && (
              <Text
                size="xs"
                c="dimmed"
              >
                UGX {o.subtotal.toLocaleString()} · Insured: UGX{' '}
                {(o.insured_amount ?? 0).toLocaleString()}
              </Text>
            )}
          </Box>
        </Group>
        <Badge
          size="sm"
          color={meta.color}
          variant="light"
        >
          {meta.label}
        </Badge>
      </Group>
    </CardRow>
  )
}

/* ── Component ── */
export default function InsuranceOrders(): JSX.Element {
  const navigate = useNavigate()
  const [showHistory, setShowHistory] = useState(false)
  const [search, setSearch] = useState('')
  const [activeOrders, setActiveOrders] = useState<OrderRow[]>([])
  const [historyOrders, setHistoryOrders] = useState<OrderRow[]>([])
  const [profileIds, setProfileIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  const loadProfileIds = useCallback(async (): Promise<string[]> => {
    const { data: si } = await supabase.rpc('get_my_insurance_staff_info')
    if (!si) return []
    const info = si as StaffInfo
    const { data: ins } = await supabase
      .from('insurance')
      .select('profile_id')
      .eq('provider', info.provider_name)
      .eq('status', 'verified')
    const ids = (ins ?? []).map((i: { profile_id: string }) => i.profile_id)
    setProfileIds(ids)
    return ids
  }, [])

  const loadActive = useCallback(async (ids: string[]): Promise<void> => {
    if (!ids.length) return
    const { data } = await supabase
      .from('orders')
      .select('*, profiles(name,photo_url), medications(*)')
      .in('profile_id', ids)
      .in('status', TRACKING_STATUSES)
      .eq('cash_only', false)
      .order('updated_at', { ascending: false })
    setActiveOrders((data ?? []) as OrderRow[])
  }, [])

  const loadHistory = useCallback(async (ids: string[]): Promise<void> => {
    if (!ids.length) return
    const { data } = await supabase
      .from('orders')
      .select('*, profiles(name,photo_url), medications(*)')
      .in('profile_id', ids)
      .in('status', HISTORY_STATUSES)
      .eq('cash_only', false)
      .order('updated_at', { ascending: false })
      .limit(100)
    setHistoryOrders((data ?? []) as OrderRow[])
  }, [])

  useEffect(() => {
    const init = async (): Promise<void> => {
      const ids = await loadProfileIds()
      await Promise.all([loadActive(ids), loadHistory(ids)])
      setLoading(false)
    }
    init()
  }, [loadProfileIds, loadActive, loadHistory])

  useEffect(() => {
    if (!profileIds.length) return
    const ch = supabase
      .channel('ins-orders-rt')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => {
          loadActive(profileIds)
          loadHistory(profileIds)
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(ch)
    }
  }, [profileIds, loadActive, loadHistory])

  if (loading)
    return (
      <Center h="60vh">
        <Loader color="lotusCyan" />
      </Center>
    )

  const source = showHistory ? historyOrders : activeOrders
  const shown = search.trim()
    ? source.filter((o) => {
        const q = search.toLowerCase()
        return (
          ((o.profiles as { name?: string } | null)?.name ?? '')
            .toLowerCase()
            .includes(q) ||
          o.order_number.toLowerCase().includes(q) ||
          (o.insurance_approval_ref ?? '').toLowerCase().includes(q)
        )
      })
    : source

  return (
    <PageWrap>
      <PageHeader>
        <Box>
          {showHistory ? (
            <>
              <Group
                gap={8}
                mb={4}
              >
                <Button
                  variant="subtle"
                  size="xs"
                  color="gray"
                  p={0}
                  leftSection={<TbArrowLeft size={13} />}
                  onClick={() => setShowHistory(false)}
                  style={{
                    fontFamily: "'DM Sans',sans-serif",
                    fontWeight: 600,
                  }}
                >
                  Back to Active
                </Button>
              </Group>
              <Text
                style={{
                  fontFamily: "'DM Sans',sans-serif",
                  fontSize: 22,
                  fontWeight: 800,
                  color: SavedColors.TextColor,
                }}
              >
                Order History
              </Text>
              <Text
                c="dimmed"
                size="sm"
                mt={2}
              >
                Completed and cancelled orders for your insured members
              </Text>
            </>
          ) : (
            <>
              <Text
                style={{
                  fontFamily: "'DM Sans',sans-serif",
                  fontSize: 22,
                  fontWeight: 800,
                  color: SavedColors.TextColor,
                }}
              >
                Orders
              </Text>
              <Text
                c="dimmed"
                size="sm"
                mt={2}
              >
                Track active insured deliveries
              </Text>
            </>
          )}
        </Box>

        {!showHistory && (
          <HistoryBtn
            onClick={() => setShowHistory(true)}
            aria-label="View order history"
          >
            <TbHistory size={15} />
            History
            {historyOrders.length > 0 && (
              <Badge
                size="xs"
                color="gray"
                variant="light"
                ml={2}
              >
                {historyOrders.length}
              </Badge>
            )}
          </HistoryBtn>
        )}
      </PageHeader>

      {/* Stats chips */}
      <StatsBar>
        <StatChip
          $active={!showHistory}
          onClick={() => setShowHistory(false)}
        >
          <TbTruck
            size={14}
            color={SavedColors.Primaryblue}
          />
          <Text
            size="xs"
            fw={700}
            c={!showHistory ? SavedColors.Primaryblue : 'dimmed'}
          >
            {activeOrders.length} active
          </Text>
        </StatChip>
        <StatChip
          $active={showHistory}
          onClick={() => setShowHistory(true)}
        >
          <TbHistory
            size={14}
            color={showHistory ? SavedColors.Primaryblue : '#9ca3af'}
          />
          <Text
            size="xs"
            fw={700}
            c={showHistory ? SavedColors.Primaryblue : 'dimmed'}
          >
            {historyOrders.length} history
          </Text>
        </StatChip>
      </StatsBar>

      {/* Table */}
      <TableWrap>
        <TableHeader>
          <Text
            size="sm"
            fw={700}
            c={SavedColors.TextColor}
          >
            {shown.length} order{shown.length !== 1 ? 's' : ''}
          </Text>
          <TextInput
            placeholder="Search member, order #, ref…"
            leftSection={<TbSearch size={14} />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            size="xs"
            radius="md"
            style={{ width: 240 }}
            styles={{ input: { fontFamily: "'DM Sans',sans-serif" } }}
          />
        </TableHeader>

        {shown.length === 0 ? (
          <EmptyState>
            {!showHistory ? (
              <>
                <TbTruck
                  size={36}
                  style={{ marginBottom: 10, opacity: 0.3 }}
                />
                <br />
                <Text
                  size="sm"
                  c="dimmed"
                >
                  No active orders
                </Text>
              </>
            ) : (
              <>
                <TbHistory
                  size={36}
                  style={{ marginBottom: 10, opacity: 0.3 }}
                />
                <br />
                <Text
                  size="sm"
                  c="dimmed"
                >
                  No order history yet
                </Text>
              </>
            )}
          </EmptyState>
        ) : (
          <>
            {/* Desktop table */}
            <Box visibleFrom="sm">
              <Table
                striped={false}
                highlightOnHover={false}
                withRowBorders={false}
                style={{ tableLayout: 'fixed' }}
              >
                <Table.Thead>
                  <Table.Tr>
                    <THead style={{ width: '30%' }}>Patient</THead>
                    <THead style={{ width: '18%' }}>Order #</THead>
                    <THead style={{ width: '20%' }}>Status</THead>
                    <THead style={{ width: '20%' }}>Amount</THead>
                    <THead style={{ width: '12%' }}>Updated</THead>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {shown.map((o) => (
                    <DesktopRow
                      key={o.id}
                      o={o}
                      onClick={() => navigate('/insurance/orders/' + o.id)}
                    />
                  ))}
                </Table.Tbody>
              </Table>
            </Box>

            {/* Mobile cards */}
            <Box hiddenFrom="sm">
              <Stack gap={0}>
                {shown.map((o) => (
                  <MobileCard
                    key={o.id}
                    o={o}
                    onClick={() => navigate('/insurance/orders/' + o.id)}
                  />
                ))}
              </Stack>
            </Box>
          </>
        )}
      </TableWrap>
    </PageWrap>
  )
}

