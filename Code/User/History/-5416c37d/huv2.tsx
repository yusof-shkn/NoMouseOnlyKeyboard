import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Badge, Box, Button, Container, Group, TextInput,
  Stack, Text, Loader, Center, Modal, Divider, Image, ScrollArea,
} from '@mantine/core'
import {
  TbSearch, TbChevronRight, TbPill, TbRepeat,
  TbMapPin, TbPhone, TbNotes, TbPackage, TbAlertCircle,
  TbCheck, TbX, TbUsers, TbClock, TbTruck, TbEye,
} from 'react-icons/tb'
import styled, { keyframes } from 'styled-components'
import { PageWrapper } from '@shared/ui/layout'
import { SavedColors } from '@shared/constants'
import { supabase, DbOrder, DbInsurance, DbMedication } from '../../../lib/supabase'
import { useAuth } from '../../../features/auth/context/AuthContext'
import { formatRelativeTime } from '../../../shared/utils/formatTime'

// ─── Status helpers ───────────────────────────────────────────────────────────

const statusColor = (s: string): string =>
  ({
    delivered: '#12B76A', rejected: '#EF4444', cancelled: '#9CA3AF',
    out_for_delivery: '#06B6D4', pricing_ready: '#3B82F6',
    awaiting_confirmation: '#F59E0B', confirmed: '#10B981',
    packing: '#8B5CF6', dispatched: '#6366F1',
    pharmacy_review: '#0EA5E9', prescription_uploaded: '#64748B',
    insurance_verification: '#A78BFA',
  }[s] ?? '#64748B')

const statusLabel = (s: string): string =>
  s.split('_').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')

const needsAction = (s: string): boolean => s === 'awaiting_confirmation'
const isLive = (s: string): boolean =>
  !['delivered', 'rejected', 'cancelled', 'prescription_uploaded'].includes(s)

// ─── Animations ──────────────────────────────────────────────────────────────

const fadeUp = keyframes`
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
`
const blink = keyframes`
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.3; }
`

// ─── Styled ───────────────────────────────────────────────────────────────────

const StickyHead = styled.div`
  position: sticky;
  top: 0;
  z-index: 50;
  background: linear-gradient(135deg, #012970 0%, #0c3d8a 55%, #15B3E0 100%);
  padding: 14px 18px 16px;
`
const ScrollRow = styled.div`
  display: flex; gap: 8px;
  overflow-x: auto; -ms-overflow-style: none; scrollbar-width: none;
  &::-webkit-scrollbar { display: none; }
`
const StatBubble = styled.div`
  background: rgba(255,255,255,0.13);
  border: 1px solid rgba(255,255,255,0.22);
  border-radius: 28px;
  padding: 5px 12px;
  display: flex; align-items: center; gap: 5px;
  white-space: nowrap; flex-shrink: 0;
`
const LiveDot = styled.span<{ $color?: string }>`
  width: 6px; height: 6px; border-radius: 50%;
  background: ${p => p.$color ?? '#fff'};
  display: inline-block;
  animation: ${blink} 1.4s ease-in-out infinite;
`
const ProfileChip = styled.button`
  display: flex; align-items: center; gap: 6px;
  padding: 4px 10px 4px 5px;
  background: rgba(255,255,255,0.14);
  border: 1px solid rgba(255,255,255,0.25);
  border-radius: 20px; cursor: pointer;
  font-family: 'Manrope', sans-serif;
`
const FilterBar = styled.div`
  display: flex; gap: 7px;
  padding: 10px 16px 2px;
  overflow-x: auto; -ms-overflow-style: none; scrollbar-width: none;
  &::-webkit-scrollbar { display: none; }
  position: relative;
`
const FilterBarWrap = styled.div`
  position: relative;
  &::after {
    content: '';
    position: absolute;
    right: 0; top: 0; bottom: 2px;
    width: 36px;
    background: linear-gradient(to right, transparent, #f6faff);
    pointer-events: none;
    z-index: 2;
  }
`
const Pill = styled.button<{ $on: boolean }>`
  white-space: nowrap; flex-shrink: 0;
  padding: 5px 13px; border-radius: 28px;
  border: 1.5px solid ${p => p.$on ? 'rgba(0,103,130,0.70)' : 'rgba(196,198,210,0.30)'};
  background: ${p => p.$on ? SavedColors.lightBlue : '#fff'};
  color: ${p => p.$on ? SavedColors.Primaryblue : '#6B7280'};
  font-size: 12px; font-weight: 600; cursor: pointer;
  font-family: 'Manrope', sans-serif; transition: all 0.12s;
`
const Card = styled.div<{ $hot: boolean; $i: number }>`
  background: #fff;
  border-radius: 16px;
  /* border removed — depth via shadow (Clinical Concierge) */
  overflow: hidden; cursor: pointer;
  animation: ${fadeUp} 0.28s ease both;
  animation-delay: ${p => Math.min(p.$i * 0.04, 0.25)}s;
  box-shadow: 0 4px 24px rgba(1, 41, 112, 0.10);
  transition: transform 0.12s;
  &:active { transform: scale(0.988); }
`
const CardHead = styled.div`
  background: #fff;
  padding: 13px 15px;
  display: flex; align-items: center; gap: 11px;
`
const Orb = styled.div`
  width: 42px; height: 42px; border-radius: 12px; flex-shrink: 0;
  background: ${SavedColors.lightBlue};
  /* border removed — depth via shadow (Clinical Concierge) */
  display: flex; align-items: center; justify-content: center;
`
const CardFoot = styled.div`
  padding: 9px 15px 11px;
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  .foot-left { flex: 1; min-width: 0; display: flex; align-items: center; gap: 5px; overflow: hidden; }
  .foot-right { flex-shrink: 0; display: flex; align-items: center; gap: 6px; }
`
const ActionChip = styled.button<{ $c: string; $bg: string }>`
  display: flex; align-items: center; gap: 4px;
  padding: 6px 12px; border-radius: 20px; cursor: pointer;
  border: 1.5px solid ${p => p.$c}38; background: ${p => p.$bg};
  color: ${p => p.$c}; font-size: 12px; font-weight: 700;
  font-family: 'Manrope', sans-serif; transition: transform 0.1s;
  &:active { transform: scale(0.94); }
`
const Arrow = styled.div`
  width: 26px; height: 26px; border-radius: 50%; flex-shrink: 0;
  background: ${SavedColors.DemWhite};
  display: flex; align-items: center; justify-content: center;
`
const Empty = styled.div`
  padding: 52px 24px; text-align: center;
  display: flex; flex-direction: column; align-items: center; gap: 10px;
`

// ─── Component ────────────────────────────────────────────────────────────────

export default function OrderHistory(): JSX.Element {
  const navigate = useNavigate()
  const { user, profiles, selectedProfile } = useAuth()
  const [search, setSearch]   = useState('')
  const [filter, setFilter]   = useState<string | null>(null)
  const [orders, setOrders]   = useState<DbOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [reorderSrc, setReorderSrc]   = useState<DbOrder | null>(null)
  const [reorderUrls, setReorderUrls] = useState<string[]>([])
  const [urlsLoading, setUrlsLoading] = useState(false)
  const [viewAll, setViewAll]           = useState(true)
  const [filterProfileId, setFilterProfileId] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen]     = useState(false)

  const mainProfile   = profiles.find(p => p.is_main_account) ?? profiles[0]
  const activeProfile = selectedProfile ?? mainProfile

  // ── Data ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return
    setLoading(true)
    const pid = !viewAll ? (filterProfileId ?? activeProfile?.id) : null
    const fetch = (): void => {
      let q = supabase.from('orders').select('*, medications(*), profiles(name), selected_insurance:insurance!orders_selected_insurance_id_fkey(provider, scheme_name, status)').eq('user_id', user.id)
      if (pid) q = q.eq('profile_id', pid)
      q.order('updated_at', { ascending: false }).then(({ data }) => {
        if (data) setOrders(data as DbOrder[])
        setLoading(false)
      })
    }
    fetch()
    const ch = supabase.channel(`oh:${user.id}:${viewAll}:${pid ?? 'a'}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `user_id=eq.${user.id}` }, () => fetch())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [user?.id, viewAll, filterProfileId, activeProfile?.id])

  // ── Reorder signed URLs ────────────────────────────────────────────────────
  useEffect(() => {
    if (!reorderSrc) { setReorderUrls([]); return }
    const load = async (): Promise<void> => {
      setUrlsLoading(true)
      const paths: string[] = reorderSrc.prescription_urls?.length
        ? reorderSrc.prescription_urls
        : reorderSrc.prescription_url ? [reorderSrc.prescription_url] : []
      const signed: string[] = []
      for (const raw of paths) {
        let p = raw
        const m = raw.match(/\/object\/(?:public|sign)\/prescriptions\/(.+?)(?:\?|$)/)
        if (m) p = decodeURIComponent(m[1])
        const { data } = await supabase.storage.from('prescriptions').createSignedUrl(p, 3600)
        if (data?.signedUrl) signed.push(data.signedUrl)
      }
      setReorderUrls(signed)
      setUrlsLoading(false)
    }
    load()
  }, [reorderSrc?.id])

  const handleReorder = (): void => {
    if (!reorderSrc) return
    const snap = reorderSrc.delivery_address_snapshot as {
      id?: string; source?: string; label?: string; street?: string
      city?: string; zone?: string; instructions?: string
      latitude?: number; longitude?: number
    } | null
    navigate('/upload-prescription', {
      state: {
        reorderProfileId: reorderSrc.profile_id,
        reorderNotes: reorderSrc.prescription_notes ?? '',
        reorderAddressId: snap?.source === 'profile' ? snap?.id : null,
        reorderAddressSnap: snap,
        reorderContactPhone: reorderSrc.contact_phone ?? '',
        reorderSignedUrls: reorderUrls,
        reorderMedicineNames: reorderSrc.medicine_names ?? '',
      },
    })
    setReorderSrc(null)
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const filtered = orders.filter(o =>
    (!filter || (filter === '_active_' ? isLive(o.status) : o.status === filter)) &&
    (!search ||
      o.order_number?.toLowerCase().includes(search.toLowerCase()) ||
      (o.profiles as { name: string } | null)?.name?.toLowerCase().includes(search.toLowerCase()))
  )

  const totalCount     = orders.length
  const deliveredCount = orders.filter(o => o.status === 'delivered').length
  const activeCount    = orders.filter(o => isLive(o.status)).length
  const actionCount    = orders.filter(o => needsAction(o.status)).length

  const addrSnap = (reorderSrc?.delivery_address_snapshot ?? null) as {
    label?: string; street?: string; city?: string; zone?: string
  } | null

  const quickFilters: { label: string; val: string | null }[] = [
    { label: 'All', val: null },
    { label: 'Need action', val: 'awaiting_confirmation' },
    { label: 'Active', val: '_active_' },
    { label: 'Delivered', val: 'delivered' },
    { label: 'Cancelled', val: 'cancelled' },
  ]

  const currentProfileLabel = viewAll
    ? 'All profiles'
    : (profiles.find(p => p.id === filterProfileId)?.name ?? activeProfile?.name ?? 'Profile')

  return (
    <PageWrapper>

      {/* ── Sticky coloured header ── */}
      <StickyHead>
        {/* Row 1: title + profile chip */}
        <Group justify="space-between" mb="sm">
          <Text style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: 21, color: '#fff', lineHeight: 1.2 }}>
            My Orders
          </Text>

          {profiles.length > 1 && (
            <ProfileChip onClick={() => setPickerOpen(true)}>
              <Box style={{ width: 22, height: 22, borderRadius: '50%', background: SavedColors.Primaryblue, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <TbUsers size={11} color="#fff" />
              </Box>
              <Text size="xs" c="#fff" fw={600} style={{ maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {currentProfileLabel}
              </Text>
            </ProfileChip>
          )}
        </Group>

        {/* Row 2: stat bubbles */}
        <ScrollRow>
          <StatBubble>
            <TbPackage size={12} color="rgba(255,255,255,0.65)" />
            <Text size="xs" c="#fff" fw={700}>{totalCount}</Text>
            <Text size="xs" c="rgba(255,255,255,0.55)">Total</Text>
          </StatBubble>
          <StatBubble>
            <TbCheck size={12} color="#86EFAC" />
            <Text size="xs" c="#fff" fw={700}>{deliveredCount}</Text>
            <Text size="xs" c="rgba(255,255,255,0.55)">Done</Text>
          </StatBubble>
          {actionCount > 0 && (
            <StatBubble>
              <LiveDot $color="#FCD34D" />
              <Text size="xs" c="#fff" fw={700}>{actionCount}</Text>
              <Text size="xs" c="rgba(255,255,255,0.55)">Need action</Text>
            </StatBubble>
          )}
          <StatBubble>
            <LiveDot $color="#67E8F9" />
            <Text size="xs" c="#fff" fw={700}>{activeCount}</Text>
            <Text size="xs" c="rgba(255,255,255,0.55)">Active</Text>
          </StatBubble>
        </ScrollRow>
      </StickyHead>

      {/* ── Search ── */}
      <Box px="md" pt="sm">
        <TextInput
          leftSection={<TbSearch size={15} color={SavedColors.DarkWhite} />}
          placeholder="Search by order number or name…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          radius="xl"
          styles={{ input: { background: '#fff', height: 40 } }}
        />
      </Box>

      {/* ── Quick-filter pills ── */}
      <FilterBarWrap>
        <FilterBar>
          {quickFilters.map(f => (
            <Pill key={f.label} $on={filter === f.val} onClick={() => setFilter(f.val)}>
              {f.label}
              {f.val === 'awaiting_confirmation' && actionCount > 0 && (
                <span style={{ background: '#F59E0B', color: '#fff', borderRadius: 10, padding: '0 5px', fontSize: 10, fontWeight: 800, marginLeft: 5 }}>
                  {actionCount}
                </span>
              )}
            </Pill>
          ))}
        </FilterBar>
      </FilterBarWrap>

      {/* ── List ── */}
      <Container size="md" py="sm" px="md">
        {loading ? (
          <Center py="xl"><Loader color="lotusCyan" size="md" /></Center>
        ) : filtered.length === 0 ? (
          <Empty>
            <Box style={{ width: 68, height: 68, borderRadius: '50%', background: SavedColors.lightBlue, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TbPill size={30} color={SavedColors.Primaryblue} />
            </Box>
            <Text fw={700} c={SavedColors.TextColor}>
              {search || filter ? 'No orders match' : 'No orders yet'}
            </Text>
            <Text size="sm" c="dimmed" maw={260} ta="center">
              {search || filter
                ? 'Try clearing the filter'
                : 'Upload a prescription to get started'}
            </Text>
            {!search && !filter && (
              <Button mt="xs" color="lotusCyan" radius="xl"
                onClick={() => navigate('/upload-prescription')}
                style={{ background: 'linear-gradient(135deg,#15B3E0,#012970)', border: 'none' }}>
                Upload Prescription
              </Button>
            )}
          </Empty>
        ) : (
          <Stack gap={10}>
            {filtered.map((order, idx) => {
              const color = statusColor(order.status)
              const hot   = needsAction(order.status)
              const live  = isLive(order.status)
              const name  = (order.profiles as { name: string } | null)?.name
              const amount = order.cash_amount ?? order.total_amount

              return (
                <Card key={order.id} $hot={hot} $i={idx} onClick={() => navigate('/order/' + order.id)}>

                  {/* Action-required banner */}
                  {hot && (
                    <Box style={{ background: SavedColors.lightBlue, borderBottom: `1px solid ${SavedColors.DemWhite}`, padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 5 }}>
                      <TbAlertCircle size={12} color={SavedColors.Primaryblue} />
                      <Text size="xs" fw={700} c={SavedColors.Primaryblue}>Action required — review &amp; pay</Text>
                    </Box>
                  )}

                  {/* Card header */}
                  <CardHead>
                    <Orb>
                      {order.status === 'delivered'
                        ? <TbCheck size={19} color={SavedColors.Primaryblue} />
                        : ['rejected','cancelled'].includes(order.status)
                          ? <TbX size={19} color="#9CA3AF" />
                          : ['out_for_delivery','dispatched'].includes(order.status)
                            ? <TbTruck size={19} color={SavedColors.Primaryblue} />
                            : ['packing','confirmed','awaiting_confirmation','pricing_ready'].includes(order.status)
                              ? <TbPackage size={19} color={SavedColors.Primaryblue} />
                              : <TbClock size={19} color={SavedColors.Primaryblue} />}
                    </Orb>

                    <Box style={{ flex: 1, minWidth: 0 }}>
                      <Group gap={5} wrap="nowrap">
                        <Text size="sm" fw={800} c={SavedColors.TextColor} style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                          #{order.order_number?.slice(-6).toUpperCase() ?? '—'}
                        </Text>
                        {order.insurance_status === 'verified' && (() => {
                          const ins = (order as DbOrder & { selected_insurance?: Pick<DbInsurance, 'provider' | 'scheme_name'> }).selected_insurance
                          const label = ins?.provider
                            ? ins.scheme_name ? `${ins.provider} · ${ins.scheme_name}` : ins.provider
                            : 'Insured'
                          return <Badge size="xs" color="teal" variant="dot">{label}</Badge>
                        })()}
                      </Group>
                      {name && <Text size="xs" c="dimmed" mt={1}>{name}</Text>}
                    </Box>

                    <Box style={{ flexShrink: 0, textAlign: 'right' }}>
                      <Text style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#9CA3AF', fontWeight: 700 }}>
                        {amount === 0 ? 'Coverage' : 'You pay'}
                      </Text>
                      <Text size="sm" fw={800} mt={1} c={SavedColors.Primaryblue}>
                        {amount != null
                          ? amount === 0 ? 'Covered' : `UGX ${amount.toLocaleString()}`
                          : 'TBD'}
                      </Text>
                    </Box>
                  </CardHead>

                  {/* Card footer */}
                  <CardFoot>
                    <div className="foot-left">
                      <Badge size="sm" variant="light"
                        style={{ background: `${color}16`, color, border: `1px solid ${color}28`, flexShrink: 0 }}>
                        {statusLabel(order.status)}
                      </Badge>
                      <Text size="xs" c="dimmed" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {formatRelativeTime(order.updated_at)}
                      </Text>
                    </div>

                    <div className="foot-right">
                      {order.status === 'delivered' && (
                        <ActionChip $c={SavedColors.Primaryblue} $bg={SavedColors.lightBlue}
                          onClick={e => { e.stopPropagation(); setReorderSrc(order) }}>
                          <TbRepeat size={12} />Reorder
                        </ActionChip>
                      )}
                      {hot && (
                        <ActionChip $c={SavedColors.Primaryblue} $bg={SavedColors.lightBlue}
                          onClick={e => { e.stopPropagation(); navigate('/order/' + order.id + '/breakdown') }}>
                          Review &amp; Pay<TbChevronRight size={12} />
                        </ActionChip>
                      )}
                      {!hot && live && order.status !== 'delivered' && (
                        <ActionChip $c={SavedColors.Primaryblue} $bg={SavedColors.lightBlue}
                          onClick={e => { e.stopPropagation(); navigate('/order/' + order.id) }}>
                          <TbEye size={12} />Track
                        </ActionChip>
                      )}
                      {['rejected','cancelled'].includes(order.status) && (
                        <Arrow><TbChevronRight size={14} color={SavedColors.DarkWhite} /></Arrow>
                      )}
                    </div>
                  </CardFoot>
                </Card>
              )
            })}
          </Stack>
        )}
      </Container>

      {/* ── Profile picker modal ── */}
      <Modal
        opened={pickerOpen} onClose={() => setPickerOpen(false)}
        title={<Text fw={700} style={{ fontFamily: "'Manrope', sans-serif" }}>Filter by Profile</Text>}
        centered size="sm" radius="md">
        <Stack gap="xs">
          <Box onClick={() => { setViewAll(true); setFilterProfileId(null); setPickerOpen(false) }}
            style={{ padding: '12px 14px', borderRadius: 10, cursor: 'pointer',
              border: `2px solid ${viewAll ? SavedColors.Primaryblue : SavedColors.DemWhite}`,
              background: viewAll ? SavedColors.lightBlue : '#fff' }}>
            <Group gap={8}>
              <TbUsers size={15} color={viewAll ? SavedColors.Primaryblue : '#9CA3AF'} />
              <Text size="sm" fw={600} c={viewAll ? SavedColors.Primaryblue : SavedColors.TextColor}>All profiles</Text>
            </Group>
          </Box>
          {profiles.map(p => {
            const sel = !viewAll && filterProfileId === p.id
            return (
              <Box key={p.id}
                onClick={() => { setViewAll(false); setFilterProfileId(p.id); setPickerOpen(false) }}
                style={{ padding: '12px 14px', borderRadius: 10, cursor: 'pointer',
                  border: `2px solid ${sel ? SavedColors.Primaryblue : SavedColors.DemWhite}`,
                  background: sel ? SavedColors.lightBlue : '#fff' }}>
                <Text size="sm" fw={600} c={SavedColors.TextColor}>
                  {p.name}{p.is_main_account ? ' (You)' : ''}
                </Text>
              </Box>
            )
          })}
        </Stack>
      </Modal>

      {/* ── Reorder modal ── */}
      <Modal
        opened={!!reorderSrc} onClose={() => setReorderSrc(null)}
        centered size="lg" radius="md"
        title={
          <Group gap="xs">
            <TbRepeat size={18} color={SavedColors.Primaryblue} />
            <Text fw={700} style={{ fontFamily: "'Manrope', sans-serif", color: '#171c20' }}>
              Review Order #{reorderSrc?.order_number}
            </Text>
          </Group>
        }
        styles={{ body: { padding: '0 20px 20px' } }}>
        {reorderSrc && (
          <ScrollArea.Autosize mah={520}>
            <Stack gap="md">
              {(urlsLoading || reorderUrls.length > 0) && (
                <Box>
                  <Text size="xs" fw={700} c="dimmed" mb={6} style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Prescription Images
                  </Text>
                  {urlsLoading
                    ? <Group gap="xs"><Loader size="xs" color="lotusCyan" /><Text size="xs" c="dimmed">Loading images…</Text></Group>
                    : <Group gap="xs" wrap="nowrap" style={{ overflowX: 'auto' }}>
                        {reorderUrls.map((url, i) => (
                          <Image key={i} src={url} alt={`Prescription ${i + 1}`} radius="md"
                            style={{ width: 120, height: 90, objectFit: 'cover', /* border removed */, flexShrink: 0 }} />
                        ))}
                      </Group>
                  }
                </Box>
              )}
              {((reorderSrc.medications as DbMedication[] | null)?.length ?? 0) > 0 && (
                <Box>
                  <Divider mb="sm" label={<Group gap={4}><TbPackage size={13} color={SavedColors.Primaryblue} /><Text size="xs" fw={600}>Previous Medications</Text></Group>} labelPosition="left" />
                  <Stack gap={4}>
                    {(reorderSrc.medications as DbMedication[]).map(m => (
                      <Group key={m.id} justify="space-between" px="xs">
                        <Text size="sm">{m.name} × {m.quantity}</Text>
                        <Badge size="xs" color={m.is_insured ? 'teal' : 'gray'} variant="light">{m.is_insured ? 'Insured' : 'Cash'}</Badge>
                      </Group>
                    ))}
                  </Stack>
                </Box>
              )}
              {addrSnap?.street && (
                <Box>
                  <Divider mb="sm" label={<Group gap={4}><TbMapPin size={13} color={SavedColors.Primaryblue} /><Text size="xs" fw={600}>Delivery Address</Text></Group>} labelPosition="left" />
                  <Text size="sm" c={SavedColors.TextColor}>
                    {addrSnap.label && <Text span fw={600}>{addrSnap.label} — </Text>}
                    {addrSnap.street}{addrSnap.city ? `, ${addrSnap.city}` : ''}{addrSnap.zone ? ` (${addrSnap.zone})` : ''}
                  </Text>
                </Box>
              )}
              {reorderSrc.contact_phone && (
                <Box>
                  <Divider mb="sm" label={<Group gap={4}><TbPhone size={13} color={SavedColors.Primaryblue} /><Text size="xs" fw={600}>Contact</Text></Group>} labelPosition="left" />
                  <Text size="sm">{reorderSrc.contact_phone}</Text>
                </Box>
              )}
              {reorderSrc.prescription_notes && (
                <Box>
                  <Divider mb="sm" label={<Group gap={4}><TbNotes size={13} color={SavedColors.Primaryblue} /><Text size="xs" fw={600}>Notes</Text></Group>} labelPosition="left" />
                  <Text size="sm" c="dimmed">{reorderSrc.prescription_notes}</Text>
                </Box>
              )}
              <Box p="sm" style={{ background: '#fffbeb', borderRadius: 8, border: '1px solid #fde68a' }}>
                <Text size="xs" c="#92400e">A new prescription image is required. Upload a fresh prescription — all other details will be pre-filled from this order.</Text>
              </Box>
              <Group justify="flex-end" gap="sm">
                <Button variant="default" radius={8} onClick={() => setReorderSrc(null)}>Cancel</Button>
                <Button radius={8} leftSection={<TbRepeat size={15} />} onClick={handleReorder}
                  style={{ background: 'linear-gradient(135deg,#15B3E0,#012970)', border: 'none' }}>
                  Continue to Upload
                </Button>
              </Group>
            </Stack>
          </ScrollArea.Autosize>
        )}
      </Modal>
    </PageWrapper>
  )
}
