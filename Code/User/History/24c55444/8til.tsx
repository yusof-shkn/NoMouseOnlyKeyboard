import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Box,
  Button,
  Group,
  Stack,
  Text,
  Badge,
  Loader,
  Center,
  Divider,
  Table,
  Modal,
  Textarea,
  Checkbox,
  Tooltip,
  NumberInput,
  Collapse,
  ScrollArea,
} from '@mantine/core'
import {
  TbArrowLeft,
  TbShieldCheck,
  TbMessage2,
  TbX,
  TbCheck,
  TbAlertCircle,
  TbNotes,
  TbShieldOff,
  TbShieldBolt,
  TbMapPin,
  TbPhone,
  TbClock,
  TbHeart,
  TbTruck,
  TbPackage,
  TbHistory,
  TbChevronDown,
  TbReceipt,
  TbCalendar,
  TbCalendarRepeat,
} from 'react-icons/tb'
import { PortalPageWrap } from '@shared/ui/portal'
import { TRow, TCell, THead } from '@shared/ui/table'
import PrescriptionViewer from '../pharmacy/PrescriptionViewer'
import styled, { keyframes } from 'styled-components'
import { supabase } from '../../../lib/supabase'
import type {
  DbMedication,
  DbInsuranceApprovalEvent,
  ApprovalMedicationSnapshot,
} from '../../../lib/supabase'
import {
  formatRelativeTime,
  formatDateTime,
  formatDuration,
} from '../../../shared/utils/formatTime'
import { useAuth } from '../../../features/auth/context/AuthContext'
import { notifications } from '@mantine/notifications'
import OrderChatPanel from '../../components/OrderChatPanel'

/* ─── Animations ───────────────────────────────────────────────────────────── */

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
`
const pulse = keyframes`0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.5);opacity:0.4}`

/* ─── Layout Primitives ────────────────────────────────────────────────────── */

const PageContainer = styled.div`
  animation: ${fadeIn} 0.3s ease;
`

const PageLayout = styled.div`
  display: grid;
  grid-template-columns: 1fr 420px;
  gap: 20px;
  align-items: flex-start;

  @media (max-width: 1300px) {
    grid-template-columns: 1fr 360px;
  }
  @media (max-width: 1024px) {
    grid-template-columns: 1fr;
  }
`

const MainContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-width: 0;
  padding-bottom: 48px;
`

const RightSidebar = styled.div`
  position: sticky;
  top: 28px;
  max-height: calc(100vh - 28px);
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto;
  padding-bottom: 48px;
  scrollbar-width: thin;

  @media (max-width: 1024px) {
    position: static;
    max-height: none;
  }
`

const PatientArea = styled.div`
  min-width: 0;
`

const AlertsArea = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
`

const MedicationArea = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-width: 0;
`

/* ─── Cards ────────────────────────────────────────────────────────────────── */

const Card = styled.div`
  background: var(--mantine-color-body);
  border: 1px solid var(--mantine-color-default-border);
  border-radius: 18px;
  overflow: hidden;
`

const CardHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 20px;
  border-bottom: 1px solid var(--mantine-color-default-border);
`

const CardBody = styled.div`
  padding: 20px;
  height: auto;
`

const CardHeaderTitle = styled(Text)`
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--mantine-color-dimmed);
  flex: 1;
`

/* ─── Hero ─────────────────────────────────────────────────────────────────── */

const HeroTopStrip = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
  position: relative;
  z-index: 10;
`

const HeroLabel = styled.div`
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: #15b3e0;
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  gap: 8px;

  &::after {
    content: '';
    display: block;
    flex: 1;
    height: 1px;
    background: var(--mantine-color-default-border);
    opacity: 0.5;
  }
`

const PatientName = styled.div`
  font-size: clamp(28px, 3.5vw, 44px);
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1.1;
  color: var(--mantine-color-text);
  margin-bottom: 12px;
  font-family: 'DM Sans', sans-serif;
`

/* ─── Detail Rows ──────────────────────────────────────────────────────────── */

const DetailRow = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid var(--mantine-color-default-border);
  opacity: 0.9;
  &:last-child {
    border-bottom: none;
  }
`

const DetailIcon = styled.div`
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: rgba(8, 145, 178, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-top: 1px;
`

const DetailLabel = styled(Text)`
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--mantine-color-dimmed);
  margin-bottom: 3px;
`

/* ─── Summary ──────────────────────────────────────────────────────────────── */

const SummaryRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 9px 0;
  border-bottom: 1px solid var(--mantine-color-default-border);
  &:last-child {
    border-bottom: none;
  }
`

const SummaryTotal = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 0 4px;
  border-top: 1px solid var(--mantine-color-default-border);
  margin-top: 4px;
`

/* ─── Banners ──────────────────────────────────────────────────────────────── */

const AlertBanner = styled.div<{ $color: 'amber' | 'red' | 'blue' }>`
  display: flex;
  gap: 16px;
  align-items: flex-start;
  padding: 16px 20px;
  border-radius: 18px;
  border: 1px solid
    ${(p) =>
      p.$color === 'amber'
        ? 'rgba(245,158,11,0.35)'
        : p.$color === 'red'
          ? 'rgba(239,68,68,0.35)'
          : 'rgba(59,130,246,0.3)'};
  background: ${(p) =>
    p.$color === 'amber'
      ? 'rgba(245,158,11,0.05)'
      : p.$color === 'red'
        ? 'rgba(239,68,68,0.05)'
        : 'rgba(59,130,246,0.04)'};
`

const BannerIcon = styled.div<{ $color: string }>`
  width: 36px;
  height: 36px;
  border-radius: 10px;
  flex-shrink: 0;
  background: ${(p) => p.$color};
  display: flex;
  align-items: center;
  justify-content: center;
`

/* ─── Approval Action Bar ──────────────────────────────────────────────────── */

const InlineActionBar = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px 20px;
  background: var(--mantine-color-body);
  border: 1px solid var(--mantine-color-default-border);
  border-radius: 18px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.07);
`

/* ─── Medication Table ─────────────────────────────────────────────────────── */

const MedTableWrap = styled.div`
  overflow-x: auto;
  border: 1px solid var(--mantine-color-default-border);
  border-radius: 12px;
`

/* ─── Chat ─────────────────────────────────────────────────────────────────── */

const ChatFloat = styled.button`
  position: fixed;
  right: 28px;
  bottom: 28px;
  z-index: 400;
  width: 54px;
  height: 54px;
  border-radius: 50%;
  border: none;
  cursor: pointer;
  background: var(--mantine-color-blue-9);
  box-shadow: 0 4px 18px rgba(21, 179, 224, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.18s;
  &:hover {
    transform: scale(1.08);
  }
`

const UnreadDot = styled.span`
  position: absolute;
  top: -3px;
  right: -3px;
  min-width: 19px;
  height: 19px;
  border-radius: 10px;
  background: #ef4444;
  color: #fff;
  border: 2px solid var(--mantine-color-body);
  font-size: 10px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 3px;
`

const ChatSlide = styled.div<{ $open: boolean }>`
  position: fixed;
  bottom: 90px;
  right: 24px;
  z-index: 500;
  width: 380px;
  height: 460px;
  max-height: 460px;
  background: var(--mantine-color-body);
  border-radius: 20px;
  box-shadow: 0 -8px 32px rgba(1, 41, 112, 0.18);
  display: flex;
  flex-direction: column;
  transform: translateY(${(p: { $open: boolean }) => (p.$open ? '0' : '110%')});
  visibility: ${(p: { $open: boolean }) => (p.$open ? 'visible' : 'hidden')};
  pointer-events: ${(p: { $open: boolean }) => (p.$open ? 'auto' : 'none')};
  transition:
    transform 0.28s cubic-bezier(0.32, 0.72, 0, 1),
    visibility 0s linear
      ${(p: { $open: boolean }) => (p.$open ? '0s' : '0.28s')};

  @media (max-width: 899px) {
    bottom: 0;
    left: 0;
    right: 0;
    width: auto;
    height: 72vh;
    max-height: 560px;
    border-radius: 20px 20px 0 0;
  }
`

const LiveDot = styled.span`
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #15b3e0;
  display: inline-block;
  animation: ${pulse} 1.2s ease-in-out infinite;
`

/* ─── Types ────────────────────────────────────────────────────────────────── */

interface StaffInfo {
  id: string
  name: string
  provider_name: string
}
interface HistoryRow {
  status: string
  created_at: string
}

interface AddrSnap {
  label?: string
  street?: string
  city?: string
  zone?: string
  instructions?: string
}

interface OrderDetail {
  id: string
  order_number: string
  status: string
  subtotal?: number
  insured_amount?: number
  total_amount?: number
  insurance_status?: string
  updated_at: string
  created_at?: string
  insurance_approval_ref?: string
  insurance_approved_by_name?: string
  insurance_approved_by_phone?: string
  cash_only?: boolean
  delivery_skipped?: boolean
  diagnosis?: string | null
  is_chronic_child?: boolean
  delivery_type?: string | null
  block_number?: number | null
  chronic_schedule_id?: string | null
  delivery_address_snapshot?: AddrSnap | null
  contact_phone?: string | null
  selected_insurance_id?: string | null
  profiles?: { name: string; photo_url?: string; is_chronic?: boolean }
  medications?: DbMedication[]
}

/* ─── Helpers ──────────────────────────────────────────────────────────────── */

const statusLabel = (s: string): string =>
  s
    .split('_')
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ')

const statusColor = (s: string): string =>
  (
    ({
      pricing_ready: 'blue',
      awaiting_confirmation: 'orange',
      confirmed: 'green',
      packing: 'violet',
      dispatched: 'cyan',
      out_for_delivery: 'cyan',
      delivered: 'teal',
      rejected: 'red',
      cancelled: 'gray',
    }) as Record<string, string>
  )[s] ?? 'gray'

/* ─── Component ────────────────────────────────────────────────────────────── */

export default function InsuranceOrderDetail(): JSX.Element {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [order, setOrder] = useState<OrderDetail | null>(null)
  const [staffInfo, setStaffInfo] = useState<StaffInfo | null>(null)
  const [loading, setLoading] = useState(true)

  const [chatOpen, setChatOpen] = useState(false)
  const [unread, setUnread] = useState(0)

  const [prescriptionSignedUrl, setPrescriptionSignedUrl] = useState<
    string | null
  >(null)
  const [allSignedUrls, setAllSignedUrls] = useState<string[]>([])
  const [statusHistory, setStatusHistory] = useState<HistoryRow[]>([])

  const [approving, setApproving] = useState(false)
  const [rejectModalOpen, setRejectModalOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [rejecting, setRejecting] = useState(false)
  const [partialReason, setPartialReason] = useState('')
  const [schemeBlocked, setSchemeBlocked] = useState<{
    blocked: boolean
    reason: string
  }>({ blocked: false, reason: '' })

  const [coveredMedIds, setCoveredMedIds] = useState<Set<string>>(new Set())
  const [approvedQtys, setApprovedQtys] = useState<Record<string, number>>({})

  const [approvalEvents, setApprovalEvents] = useState<
    DbInsuranceApprovalEvent[]
  >([])
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null)

  const [deliveryType, setDeliveryType] = useState<'normal' | 'scheduled'>(
    'normal',
  )
  const [savingSchedule, setSavingSchedule] = useState(false)

  const openChat = (): void => {
    setChatOpen(true)
    setUnread(0)
  }

  useEffect(() => {
    if (!id) return
    const load = async (): Promise<void> => {
      const [{ data: si }, { data: ord }, { data: evts }] = await Promise.all([
        supabase.rpc('get_my_insurance_staff_info'),
        supabase
          .from('orders')
          .select('*, profiles(name,photo_url), medications(*)')
          .eq('id', id)
          .single(),
        supabase
          .from('insurance_approval_events')
          .select('*')
          .eq('order_id', id)
          .order('version_number', { ascending: true }),
      ])
      if (si) setStaffInfo(si as StaffInfo)
      if (evts) setApprovalEvents(evts as DbInsuranceApprovalEvent[])
      if (ord) {
        const ordData = ord as OrderDetail
        setOrder(ordData)
        const meds = (ordData.medications ?? []) as DbMedication[]
        setCoveredMedIds(
          new Set(meds.filter((m) => m.is_insured).map((m) => m.id)),
        )
        const qtyMap: Record<string, number> = {}
        for (const m of meds) {
          if (m.is_insured)
            qtyMap[m.id] =
              (m as DbMedication & { approved_qty?: number | null })
                .approved_qty ?? m.quantity
        }
        setApprovedQtys(qtyMap)

        if (ordData.selected_insurance_id) {
          const { data: insRec } = await supabase
            .from('insurance')
            .select('insurance_scheme_id')
            .eq('id', ordData.selected_insurance_id)
            .maybeSingle()
          const schemeId = (
            insRec as { insurance_scheme_id?: string | null } | null
          )?.insurance_scheme_id
          if (schemeId) {
            const { data: scheme } = await supabase
              .from('insurance_schemes')
              .select('id, name, is_active, expiry_date')
              .eq('id', schemeId)
              .maybeSingle()
            if (scheme) {
              const s = scheme as {
                id: string
                name: string
                is_active: boolean
                expiry_date?: string | null
              }
              const isExpired =
                s.expiry_date && new Date(s.expiry_date) < new Date()
              if (!s.is_active && isExpired)
                setSchemeBlocked({
                  blocked: true,
                  reason: `The scheme "${s.name}" is disabled and expired on ${s.expiry_date}.`,
                })
              else if (!s.is_active)
                setSchemeBlocked({
                  blocked: true,
                  reason: `The scheme "${s.name}" has been disabled by the provider.`,
                })
              else if (isExpired)
                setSchemeBlocked({
                  blocked: true,
                  reason: `The scheme "${s.name}" expired on ${s.expiry_date}.`,
                })
            }
          }
        }

        const ordWithUrls = ordData as typeof ordData & {
          prescription_urls?: string[]
          prescription_url?: string
        }
        const allPaths: string[] = ordWithUrls.prescription_urls?.length
          ? ordWithUrls.prescription_urls
          : ordWithUrls.prescription_url
            ? [ordWithUrls.prescription_url]
            : []
        if (allPaths.length) {
          const signedAll: string[] = []
          for (const rawUrl of allPaths) {
            let storagePath = rawUrl
            const match = rawUrl.match(
              /\/object\/(?:public|sign)\/prescriptions\/(.+?)(?:\?|$)/,
            )
            if (match) storagePath = decodeURIComponent(match[1])
            const { data: signed, error: signErr } = await supabase.storage
              .from('prescriptions')
              .createSignedUrl(storagePath, 3600)
            if (!signErr && signed?.signedUrl) signedAll.push(signed.signedUrl)
          }
          if (signedAll.length) {
            setPrescriptionSignedUrl(signedAll[0])
            setAllSignedUrls(signedAll)
          }
        }

        if (ordData.status === 'delivered') {
          const { data: hist } = await supabase
            .from('order_status_history')
            .select('status, created_at')
            .eq('order_id', id)
            .in('status', ['out_for_delivery', 'delivered'])
            .order('created_at', { ascending: true })
          setStatusHistory((hist ?? []) as HistoryRow[])
        }
      }
      setLoading(false)
    }
    load()
    const ch = supabase
      .channel('ins-order-detail:' + id)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${id}`,
        },
        (payload) =>
          setOrder((prev) => (prev ? { ...prev, ...payload.new } : null)),
      )
      .subscribe()
    return () => {
      supabase.removeChannel(ch)
    }
  }, [id])

  useEffect(() => {
    if (!id) return
    supabase
      .from('chat_messages')
      .select('id, sender_type')
      .eq('order_id', id)
      .eq('chat_thread', 'insurance')
      .then(({ data }) => {
        const m = (data ?? []) as { sender_type: string }[]
        if (!chatOpen)
          setUnread(
            m.filter((msg) => msg.sender_type !== 'insurance_staff').length,
          )
      })
    const ch = supabase
      .channel('ins-unread:' + id)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `order_id=eq.${id}`,
        },
        (payload) => {
          const msg = payload.new as {
            chat_thread: string
            sender_type: string
          }
          if (msg.chat_thread !== 'insurance') return
          if (!chatOpen && msg.sender_type === 'pharmacy')
            setUnread((n) => n + 1)
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(ch)
    }
  }, [id, chatOpen])

  const handleApprove = async (): Promise<void> => {
    if (!order || !staffInfo) return
    setApproving(true)
    const medsPayload = meds.map((m) => ({
      id: m.id,
      is_insured: coveredMedIds.has(m.id),
      approved_qty: coveredMedIds.has(m.id)
        ? (approvedQtys[m.id] ?? m.quantity)
        : null,
      approval_status: !coveredMedIds.has(m.id)
        ? 'rejected'
        : (approvedQtys[m.id] ?? m.quantity) < m.quantity
          ? 'partial'
          : 'approved',
      coverage_decision: coveredMedIds.has(m.id) ? 'covered' : 'excluded',
    }))
    const scheduledParam = showDeliverySelector ? deliveryType : null
    const { error } = await supabase.rpc('approve_insurance_order', {
      p_order_id: order.id,
      p_staff_id: staffInfo.id,
      p_staff_name: staffInfo.name,
      p_staff_phone: null,
      p_medications: medsPayload,
      p_partial_reason: isPartialSel ? partialReason : null,
      p_delivery_type: scheduledParam,
    })
    setApproving(false)
    if (error) {
      notifications.show({
        title: 'Error',
        message: error.message,
        color: 'red',
      })
      return
    }
    const { data: evts } = await supabase
      .from('insurance_approval_events')
      .select('*')
      .eq('order_id', order.id)
      .order('version_number', { ascending: true })
    if (evts) setApprovalEvents(evts as DbInsuranceApprovalEvent[])
    notifications.show({
      title: isPartialSel ? '⚡ Partial approval sent' : '✅ Order approved',
      message: isPartialSel
        ? 'Partial coverage recorded and pharmacist notified.'
        : 'Full coverage approved. Pharmacist will proceed.',
      color: isPartialSel ? 'orange' : 'teal',
      autoClose: 3500,
    })
  }

  const handleReject = async (): Promise<void> => {
    if (!order || !staffInfo || !rejectReason.trim()) return
    setRejecting(true)
    const { error } = await supabase.rpc('reject_insurance_order', {
      p_order_id: order.id,
      p_staff_id: staffInfo.id,
      p_staff_name: staffInfo.name,
      p_reason: rejectReason.trim(),
    })
    setRejecting(false)
    if (error) {
      notifications.show({
        title: 'Error',
        message: error.message,
        color: 'red',
      })
      return
    }
    setRejectModalOpen(false)
    setRejectReason('')
    setOrder((prev) => (prev ? { ...prev, status: 'pharmacy_review' } : null))
    notifications.show({
      title: '❌ Rejected & returned to pharmacist',
      message: 'The pharmacist will see your reason and can revise pricing.',
      color: 'orange',
      autoClose: 3500,
    })
  }

  if (loading)
    return (
      <Center h="100vh">
        <Loader color="lotusCyan" />
      </Center>
    )
  if (!order)
    return (
      <Center h="100vh">
        <Text c="dimmed">Order not found</Text>
      </Center>
    )

  const profile = order.profiles as { name?: string; photo_url?: string } | null
  const meds = (order.medications ?? []) as DbMedication[]
  const isActive = !['delivered', 'cancelled', 'rejected'].includes(
    order.status,
  )
  const barVisible = order.status === 'pricing_ready'

  const insurableMeds = meds.filter((m) => m.is_insured)
  const coveredMedsLive = insurableMeds.filter((m) => coveredMedIds.has(m.id))
  const coveredCount = coveredMedsLive.length
  const insurableCount = insurableMeds.length

  const calculatedInsured = coveredMedsLive.reduce((sum, m) => {
    const approvedQty = Math.min(approvedQtys[m.id] ?? m.quantity, m.quantity)
    return sum + m.unit_price * approvedQty
  }, 0)

  const hasPartialQty = coveredMedsLive.some(
    (m) => (approvedQtys[m.id] ?? m.quantity) < m.quantity,
  )
  const customerPays = Math.max(0, (order.subtotal ?? 0) - calculatedInsured)
  const approvedTotal = Math.max(0, order.total_amount ?? 0)
  const allChecked = insurableCount > 0 && coveredCount === insurableCount
  const someChecked = coveredCount > 0 && coveredCount < insurableCount
  const isPartialSel = someChecked || hasPartialQty

  const toggleMed = (medId: string): void => {
    setCoveredMedIds((prev) => {
      const next = new Set(prev)
      if (next.has(medId)) next.delete(medId)
      else next.add(medId)
      return next
    })
  }

  const updateApprovedQty = (
    medId: string,
    qty: number,
    maxQty: number,
  ): void => {
    const clamped = Math.min(Math.max(0, Math.round(qty)), maxQty)
    setApprovedQtys((prev) => ({ ...prev, [medId]: clamped }))
  }

  const toggleAll = (): void => {
    setCoveredMedIds(
      allChecked ? new Set() : new Set(insurableMeds.map((m) => m.id)),
    )
  }

  const approveLabel = isPartialSel
    ? `Partially Approve (${coveredCount}/${insurableCount})`
    : 'Approve All'
  const isChronic = !!(order?.profiles as { is_chronic?: boolean } | null)
    ?.is_chronic
  const isChronicChild = !!order?.is_chronic_child
  const orderDays =
    meds.length > 0 ? Math.max(...meds.map((m) => m.days ?? 0)) : 0
  const showDeliverySelector =
    orderDays >= 60 && !isChronicChild && order?.status === 'pricing_ready'

  /* ── Approval panel content (reused in sticky bar) ── */
  const approvalPanelContent = (
    <>
      {showDeliverySelector && (
        <Box
          style={{
            background: 'rgba(16,185,129,0.07)',
            border: '1.5px solid #86EFAC',
            borderRadius: 10,
            padding: '12px 14px',
          }}
        >
          <Group
            gap={6}
            mb={8}
          >
            <TbHeart
              size={14}
              color="#EF4444"
            />
            <Text
              size="xs"
              fw={700}
              c="green.8"
            >
              {orderDays}-day supply detected — choose delivery type
            </Text>
          </Group>
          <Group
            gap={8}
            grow
          >
            {(['normal', 'scheduled'] as const).map((dt) => (
              <Box
                key={dt}
                onClick={() => setDeliveryType(dt)}
                style={{
                  borderRadius: 8,
                  border: `2px solid ${deliveryType === dt ? (dt === 'normal' ? '#15B3E0' : '#7C3AED') : 'var(--mantine-color-default-border)'}`,
                  background:
                    deliveryType === dt
                      ? dt === 'normal'
                        ? 'rgba(21,179,224,0.07)'
                        : 'rgba(124,58,237,0.07)'
                      : 'var(--mantine-color-body)',
                  padding: '10px 12px',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                <Text
                  size="xs"
                  fw={700}
                  c={
                    deliveryType === dt
                      ? dt === 'normal'
                        ? 'blue.8'
                        : 'violet.7'
                      : 'var(--mantine-color-dimmed)'
                  }
                >
                  {dt === 'normal' ? 'Normal' : 'Scheduled 90-day'}
                </Text>
                <Text
                  size="xs"
                  c="dimmed"
                  mt={2}
                >
                  {dt === 'normal' ? 'Single delivery' : '3 monthly blocks'}
                </Text>
              </Box>
            ))}
          </Group>
          {savingSchedule && (
            <Group
              gap={6}
              mt={8}
            >
              <Loader
                size="xs"
                color="violet"
              />
              <Text
                size="xs"
                c="dimmed"
              >
                Creating 90-day schedule…
              </Text>
            </Group>
          )}
        </Box>
      )}

      {insurableCount > 0 && (
        <Box
          px="md"
          py={8}
          style={{
            background: isPartialSel
              ? 'rgba(251,146,60,0.08)'
              : 'rgba(21,179,224,0.07)',
            borderRadius: 10,
            border: `1.5px solid ${isPartialSel ? '#fed7aa' : '#E8EDF5'}`,
          }}
        >
          <Group
            justify="space-between"
            wrap="nowrap"
          >
            <Group gap={6}>
              {isPartialSel ? (
                <TbShieldBolt
                  size={15}
                  color="#ea580c"
                />
              ) : (
                <TbShieldCheck
                  size={15}
                  color="#15B3E0"
                />
              )}
              <Text
                size="xs"
                fw={600}
                c={isPartialSel ? 'orange.8' : 'var(--mantine-color-text)'}
              >
                {coveredCount === 0
                  ? 'No medications selected — nothing will be covered'
                  : isPartialSel
                    ? hasPartialQty
                      ? `Partial quantities — ${coveredCount}/${insurableCount} items, UGX ${calculatedInsured.toLocaleString()} covered`
                      : `Partial: ${coveredCount} of ${insurableCount} medications covered`
                    : `Full coverage: all ${insurableCount} medications covered`}
              </Text>
            </Group>
            {calculatedInsured > 0 && (
              <Text
                size="xs"
                fw={700}
                c={isPartialSel ? 'orange.8' : 'var(--mantine-color-text)'}
                style={{ flexShrink: 0 }}
              >
                UGX {calculatedInsured.toLocaleString()}
              </Text>
            )}
          </Group>
        </Box>
      )}

      {isPartialSel && (
        <Box>
          <Textarea
            placeholder="Reason for partial approval (required) — e.g. quantity reduced per scheme limit, medication not on formulary…"
            value={partialReason}
            onChange={(e) => setPartialReason(e.target.value)}
            minRows={2}
            autosize
            size="xs"
            required
            styles={{
              input: {
                fontSize: 12,
                borderColor: partialReason.trim() ? '#6ee7b7' : '#fca5a5',
              },
            }}
          />
          {!partialReason.trim() && (
            <Text
              size="xs"
              c="red"
              mt={4}
              fw={500}
            >
              A reason is required when approving partially or excluding
              medications.
            </Text>
          )}
        </Box>
      )}

      {schemeBlocked.blocked && (
        <Box
          style={{
            background: 'rgba(239,68,68,0.07)',
            border: '1.5px solid rgba(239,68,68,0.35)',
            borderRadius: 10,
            padding: '10px 14px',
          }}
        >
          <Group
            gap={6}
            mb={4}
          >
            <TbShieldOff
              size={15}
              color="#EF4444"
            />
            <Text
              size="xs"
              fw={700}
              c="red.7"
            >
              {schemeBlocked.reason.includes('disabled') &&
              !schemeBlocked.reason.includes('expired')
                ? 'Scheme Disabled'
                : schemeBlocked.reason.includes('expired') &&
                    !schemeBlocked.reason.includes('disabled')
                  ? 'Scheme Expired'
                  : 'Scheme Disabled & Expired'}
            </Text>
          </Group>
          <Text
            size="xs"
            c="dimmed"
          >
            {schemeBlocked.reason}
          </Text>
          <Text
            size="xs"
            c="dimmed"
            mt={4}
          >
            Approval is blocked. The provider must renew or re-enable this
            scheme first.
          </Text>
        </Box>
      )}

      <Group
        justify="space-between"
        align="center"
        gap={8}
        wrap="nowrap"
      >
        <Box style={{ flex: 1, minWidth: 0 }}>
          <Text
            fw={700}
            size="sm"
            c="var(--mantine-color-text)"
          >
            Awaiting your approval
          </Text>
          <Text
            size="xs"
            c="lotusCyan"
            mt={1}
          >
            {schemeBlocked.blocked
              ? schemeBlocked.reason
              : isPartialSel && !partialReason.trim()
                ? 'Enter a reason above before approving'
                : isPartialSel
                  ? `Customer pays UGX ${customerPays.toLocaleString()} after partial coverage`
                  : coveredCount === 0 && insurableCount > 0
                    ? 'Select at least one medication to approve'
                    : 'Adjust coverage above, then approve.'}
          </Text>
        </Box>
        <Group
          gap={8}
          wrap="nowrap"
          style={{ flexShrink: 0 }}
        >
          <Button
            variant="outline"
            color="red"
            size="sm"
            leftSection={<TbShieldOff size={15} />}
            onClick={() => {
              setRejectReason('')
              setRejectModalOpen(true)
            }}
          >
            Reject
          </Button>
          <Tooltip
            label={schemeBlocked.reason}
            disabled={!schemeBlocked.blocked}
            withArrow
            multiline
            maw={280}
          >
            <Button
              color="lotusCyan"
              size="sm"
              loading={approving}
              disabled={
                schemeBlocked.blocked ||
                (coveredCount === 0 && insurableCount > 0) ||
                (isPartialSel && !partialReason.trim())
              }
              onClick={handleApprove}
              leftSection={
                isPartialSel ? (
                  <TbShieldBolt size={15} />
                ) : (
                  <TbCheck size={15} />
                )
              }
            >
              {approveLabel}
            </Button>
          </Tooltip>
        </Group>
      </Group>
    </>
  )

  return (
    <PortalPageWrap>
      <PageContainer>
        {/* ══ TWO-COLUMN GRID ══ */}
        <PageLayout>
          {/* ── LEFT: Main Content ── */}
          <MainContent>
            {/* ── TOP STRIP ── */}
            <HeroTopStrip>
              <Button
                variant="subtle"
                color="lotusCyan"
                leftSection={<TbArrowLeft size={14} />}
                onClick={() => navigate('/insurance/orders')}
                size="xs"
                style={{
                  marginLeft: -6,
                  fontWeight: 600,
                  letterSpacing: '0.02em',
                }}
              >
                Back to Orders
              </Button>
              <Group gap={6}>
                <TbReceipt
                  size={13}
                  color="var(--mantine-color-dimmed)"
                />
                <Text
                  size="xs"
                  c="dimmed"
                  fw={500}
                  style={{ letterSpacing: '0.05em' }}
                >
                  Order
                </Text>
                <Text
                  size="xs"
                  fw={800}
                  c="lotusCyan"
                  style={{ fontFamily: 'monospace', letterSpacing: '1px' }}
                >
                  #{order.order_number}
                </Text>
                <Badge
                  color={statusColor(order.status)}
                  size="sm"
                  variant="light"
                >
                  {statusLabel(order.status)}
                </Badge>
                <LiveDot />
                <Text
                  size="xs"
                  c="dimmed"
                >
                  Live
                </Text>
              </Group>
            </HeroTopStrip>

            {/* Patient Hero */}
            <PatientArea>
              <HeroLabel>Patient Record</HeroLabel>
              <PatientName>{profile?.name ?? '—'}</PatientName>
              <Group
                gap={10}
                align="center"
                wrap="wrap"
              >
                <Badge
                  color={statusColor(order.status)}
                  size="sm"
                  variant="light"
                >
                  {statusLabel(order.status)}
                </Badge>
                {order.insurance_status === 'verified' && (
                  <Badge
                    color="lotusCyan"
                    size="sm"
                    variant="light"
                    leftSection={<TbShieldCheck size={10} />}
                  >
                    Insured
                  </Badge>
                )}
                {isChronic && (
                  <Badge
                    color="red"
                    size="sm"
                    variant="light"
                  >
                    Chronic patient
                  </Badge>
                )}
                <Text
                  size="xs"
                  c="dimmed"
                  style={{ fontFamily: 'monospace', letterSpacing: '0.04em' }}
                >
                  ID: #{order.id.slice(0, 8).toUpperCase()}
                </Text>
                <Text
                  size="xs"
                  c="dimmed"
                >
                  ·
                </Text>
                <Group gap={5}>
                  <TbCalendar
                    size={11}
                    color="var(--mantine-color-dimmed)"
                  />
                  <Text
                    size="xs"
                    c="dimmed"
                  >
                    {order.created_at
                      ? new Date(order.created_at).toLocaleDateString('en-UG', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })
                      : formatRelativeTime(order.updated_at)}
                  </Text>
                </Group>
              </Group>
            </PatientArea>

            {/* Alerts */}
            <AlertsArea>
              {schemeBlocked.blocked && (
                <AlertBanner $color="red">
                  <BannerIcon $color="linear-gradient(135deg,#ef4444,#b91c1c)">
                    <TbShieldOff
                      size={20}
                      color="#fff"
                    />
                  </BannerIcon>
                  <div style={{ flex: 1 }}>
                    <Group
                      gap={8}
                      mb={6}
                    >
                      <Text
                        size="sm"
                        fw={800}
                        c="red.7"
                      >
                        Insurance Scheme Blocked
                      </Text>
                      <Badge
                        color="red"
                        variant="filled"
                        size="xs"
                      >
                        Action Required
                      </Badge>
                    </Group>
                    <Text
                      size="sm"
                      fw={600}
                      c="red.9"
                      lh={1.6}
                      style={{
                        background: 'rgba(255,255,255,0.6)',
                        borderRadius: 8,
                        padding: '8px 12px',
                        border: '1px solid rgba(239,68,68,0.25)',
                      }}
                    >
                      {schemeBlocked.reason}
                    </Text>
                    <Text
                      size="xs"
                      c="red.7"
                      mt={8}
                      fw={600}
                    >
                      The provider must renew or re-enable this scheme before
                      approval can proceed.
                    </Text>
                  </div>
                </AlertBanner>
              )}

              {order.insurance_approval_ref && (
                <Box
                  p="md"
                  style={{
                    background: 'var(--mantine-color-body)',
                    borderRadius: 18,
                    border: '1px solid rgba(16,185,129,0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                  }}
                >
                  <Box
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 10,
                      background: 'rgba(16,185,129,0.12)',
                      border: '1px solid rgba(16,185,129,0.25)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <TbShieldCheck
                      size={16}
                      color="#10b981"
                    />
                  </Box>
                  <Box style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      size="xs"
                      c="dimmed"
                      fw={700}
                      style={{
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                      }}
                    >
                      Insurance Approval
                    </Text>
                    <Text
                      size="sm"
                      fw={800}
                      c="teal.7"
                      style={{ letterSpacing: '0.04em' }}
                    >
                      {order.insurance_approval_ref}
                    </Text>
                    {order.insurance_approved_by_name && (
                      <Text
                        size="xs"
                        c="dimmed"
                        mt={2}
                      >
                        Approved by {order.insurance_approved_by_name}
                        {order.insurance_approved_by_phone
                          ? ` · ${order.insurance_approved_by_phone}`
                          : ''}
                      </Text>
                    )}
                  </Box>
                  <Badge
                    color="teal"
                    variant="light"
                    size="sm"
                  >
                    Approved
                  </Badge>
                </Box>
              )}
            </AlertsArea>

            {/* ── Medication & Pricing ── */}
            <MedicationArea>
              {meds.length > 0 && (
                <Card>
                  <CardHeader
                    style={{ background: 'var(--mantine-color-default-hover)' }}
                  >
                    <CardHeaderTitle>Prescription Items</CardHeaderTitle>
                    {barVisible && insurableCount > 0 && (
                      <Group
                        gap={8}
                        align="center"
                      >
                        <Text
                          size="xs"
                          c="dimmed"
                        >
                          {coveredCount === 0
                            ? 'None covered'
                            : coveredCount === insurableCount
                              ? 'All covered'
                              : `${coveredCount} of ${insurableCount} covered`}
                        </Text>
                        <Tooltip
                          label={allChecked ? 'Deselect all' : 'Select all'}
                          withArrow
                          position="left"
                        >
                          <Checkbox
                            checked={allChecked}
                            indeterminate={someChecked}
                            onChange={toggleAll}
                            color="lotusCyan"
                            size="sm"
                          />
                        </Tooltip>
                      </Group>
                    )}
                    {!barVisible && order.insurance_status === 'verified' && (
                      <Badge
                        color="teal"
                        variant="light"
                        size="xs"
                        leftSection={<TbShieldCheck size={10} />}
                      >
                        Insured
                      </Badge>
                    )}
                  </CardHeader>

                  {barVisible && insurableCount > 0 && (
                    <Box
                      px="md"
                      py={8}
                      style={{
                        background: 'rgba(21,179,224,0.05)',
                        borderBottom:
                          '1px solid var(--mantine-color-default-border)',
                      }}
                    >
                      <Group gap={6}>
                        <TbShieldBolt
                          size={14}
                          color="#15B3E0"
                        />
                        <Text
                          size="xs"
                          c="var(--mantine-color-text)"
                        >
                          Tick the medications your scheme covers. Uncheck any
                          to exclude from coverage.
                        </Text>
                      </Group>
                    </Box>
                  )}

                  <MedTableWrap>
                    <Table
                      striped={false}
                      highlightOnHover={false}
                      withRowBorders={false}
                      style={{ minWidth: 900 }}
                    >
                      <Table.Thead
                        style={{
                          background: 'var(--mantine-color-default-hover)',
                          borderBottom:
                            '1px solid var(--mantine-color-default-border)',
                        }}
                      >
                        <Table.Tr>
                          {barVisible && <THead style={{ width: 44 }} />}
                          <THead>Medication</THead>
                          <THead>Dosage</THead>
                          <THead style={{ textAlign: 'center' }}>Days</THead>
                          <THead style={{ textAlign: 'center' }}>
                            Freq/day
                          </THead>
                          <THead style={{ textAlign: 'center' }}>Qty</THead>
                          <THead style={{ textAlign: 'center' }}>
                            Approved Qty
                          </THead>
                          <THead style={{ textAlign: 'right' }}>
                            Unit Price
                          </THead>
                          <THead style={{ textAlign: 'right' }}>Total</THead>
                          <THead style={{ textAlign: 'center' }}>Cover</THead>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {meds.map((m) => {
                          const isInsurable = m.is_insured
                          const isCovered = coveredMedIds.has(m.id)
                          const rowBg =
                            barVisible && isInsurable
                              ? isCovered
                                ? 'rgba(21,179,224,0.06)'
                                : 'rgba(0,0,0,0.018)'
                              : undefined
                          return (
                            <TRow
                              key={m.id}
                              style={{
                                background: rowBg,
                                opacity:
                                  barVisible && isInsurable && !isCovered
                                    ? 0.5
                                    : 1,
                                transition: 'background 0.15s, opacity 0.15s',
                                cursor:
                                  barVisible && isInsurable
                                    ? 'pointer'
                                    : 'default',
                              }}
                              onClick={() => {
                                if (barVisible && isInsurable) toggleMed(m.id)
                              }}
                            >
                              {barVisible && (
                                <TCell onClick={(e) => e.stopPropagation()}>
                                  {isInsurable ? (
                                    <Checkbox
                                      checked={isCovered}
                                      onChange={() => toggleMed(m.id)}
                                      color="lotusCyan"
                                      size="sm"
                                    />
                                  ) : (
                                    <Box style={{ width: 20 }} />
                                  )}
                                </TCell>
                              )}
                              <TCell>
                                <Text
                                  size="sm"
                                  fw={500}
                                >
                                  {m.name}
                                </Text>
                              </TCell>
                              <TCell>
                                <Text
                                  size="sm"
                                  c="dimmed"
                                >
                                  {(m as { dosage?: string }).dosage || '—'}
                                </Text>
                              </TCell>
                              <TCell style={{ textAlign: 'center' }}>
                                <Text
                                  size="sm"
                                  c="dimmed"
                                >
                                  {(m as { days?: number | null }).days ?? '—'}
                                </Text>
                              </TCell>
                              <TCell style={{ textAlign: 'center' }}>
                                <Text
                                  size="sm"
                                  c="dimmed"
                                >
                                  {(m as { freq_per_day?: number | null })
                                    .freq_per_day ?? '—'}
                                </Text>
                              </TCell>
                              <TCell style={{ textAlign: 'center' }}>
                                <Text size="sm">{m.quantity}</Text>
                              </TCell>
                              <TCell
                                style={{ textAlign: 'center' }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                {barVisible && isInsurable ? (
                                  <Stack
                                    gap={2}
                                    align="center"
                                  >
                                    <NumberInput
                                      value={approvedQtys[m.id] ?? m.quantity}
                                      onChange={(v) =>
                                        updateApprovedQty(
                                          m.id,
                                          typeof v === 'number' ? v : 0,
                                          m.quantity,
                                        )
                                      }
                                      min={0}
                                      max={m.quantity}
                                      step={1}
                                      size="xs"
                                      style={{ width: 72 }}
                                      disabled={!isCovered}
                                      styles={{
                                        input: {
                                          textAlign: 'center',
                                          border: `1.5px solid ${!isCovered ? 'var(--mantine-color-default-border)' : (approvedQtys[m.id] ?? m.quantity) < m.quantity ? '#fed7aa' : '#6ee7b7'}`,
                                          borderRadius: 8,
                                        },
                                      }}
                                    />
                                    {isCovered &&
                                      (approvedQtys[m.id] ?? m.quantity) <
                                        m.quantity && (
                                        <Text
                                          size="10px"
                                          c="orange"
                                          fw={600}
                                        >
                                          {m.quantity -
                                            (approvedQtys[m.id] ??
                                              m.quantity)}{' '}
                                          → cash
                                        </Text>
                                      )}
                                  </Stack>
                                ) : isInsurable && m.approved_qty != null ? (
                                  <Stack
                                    gap={2}
                                    align="center"
                                  >
                                    <Text
                                      size="sm"
                                      fw={700}
                                      c={
                                        m.approved_qty < m.quantity
                                          ? 'orange'
                                          : 'teal'
                                      }
                                    >
                                      {m.approved_qty}
                                    </Text>
                                    {m.approved_qty < m.quantity && (
                                      <Text
                                        size="10px"
                                        c="dimmed"
                                      >
                                        {m.quantity - m.approved_qty} cash
                                      </Text>
                                    )}
                                  </Stack>
                                ) : (
                                  <Text
                                    size="sm"
                                    c="dimmed"
                                    ta="center"
                                  >
                                    —
                                  </Text>
                                )}
                              </TCell>
                              <TCell style={{ textAlign: 'right' }}>
                                <Text size="sm">
                                  UGX {m.unit_price.toLocaleString()}
                                </Text>
                              </TCell>
                              <TCell style={{ textAlign: 'right' }}>
                                <Text
                                  size="sm"
                                  fw={600}
                                >
                                  UGX{' '}
                                  {(m.unit_price * m.quantity).toLocaleString()}
                                </Text>
                              </TCell>
                              <TCell style={{ textAlign: 'center' }}>
                                {barVisible && isInsurable ? (
                                  <Badge
                                    size="xs"
                                    color={isCovered ? 'teal' : 'gray'}
                                    variant={isCovered ? 'light' : 'outline'}
                                  >
                                    {isCovered ? 'Covered' : 'Excluded'}
                                  </Badge>
                                ) : !m.is_insured ? (
                                  <Badge
                                    size="xs"
                                    color="gray"
                                    variant="light"
                                  >
                                    Cash
                                  </Badge>
                                ) : (
                                  (() => {
                                    const aqty = m.approved_qty
                                    const astatus = m.approval_status
                                    if (astatus === 'approved')
                                      return (
                                        <Stack
                                          gap={2}
                                          align="center"
                                        >
                                          <Badge
                                            size="xs"
                                            color="teal"
                                            variant="light"
                                          >
                                            Approved
                                          </Badge>
                                          <Text
                                            size="10px"
                                            c="teal"
                                            fw={600}
                                          >
                                            {aqty} of {m.quantity}
                                          </Text>
                                        </Stack>
                                      )
                                    if (astatus === 'partial') {
                                      const cashQty = m.quantity - (aqty ?? 0)
                                      return (
                                        <Stack
                                          gap={2}
                                          align="center"
                                        >
                                          <Badge
                                            size="xs"
                                            color="orange"
                                            variant="light"
                                          >
                                            Partial
                                          </Badge>
                                          <Text
                                            size="10px"
                                            c="teal"
                                            fw={600}
                                          >
                                            Ins: {aqty}
                                          </Text>
                                          <Text
                                            size="10px"
                                            c="orange"
                                            fw={600}
                                          >
                                            Cash: {cashQty}
                                          </Text>
                                        </Stack>
                                      )
                                    }
                                    if (
                                      astatus === 'rejected' ||
                                      (aqty != null && aqty === 0)
                                    )
                                      return (
                                        <Badge
                                          size="xs"
                                          color="red"
                                          variant="light"
                                        >
                                          Rejected
                                        </Badge>
                                      )
                                    return (
                                      <Badge
                                        size="xs"
                                        color="teal"
                                        variant="light"
                                      >
                                        Insured
                                      </Badge>
                                    )
                                  })()
                                )}
                              </TCell>
                            </TRow>
                          )
                        })}
                      </Table.Tbody>
                    </Table>
                  </MedTableWrap>

                  {/* Totals footer */}
                  <CardBody>
                    <SummaryRow>
                      <Text
                        size="sm"
                        c="dimmed"
                      >
                        Subtotal (meds)
                      </Text>
                      <Text size="sm">
                        UGX {(order.subtotal ?? 0).toLocaleString()}
                      </Text>
                    </SummaryRow>
                    <SummaryRow>
                      <Text
                        size="sm"
                        c="dimmed"
                      >
                        Delivery fee
                      </Text>
                      <Group gap={6}>
                        <Text size="sm">UGX 10,000</Text>
                        {!order.cash_only && (
                          <Badge
                            size="xs"
                            color="teal"
                            variant="light"
                          >
                            Insurance covered
                          </Badge>
                        )}
                      </Group>
                    </SummaryRow>
                    {barVisible && calculatedInsured > 0 && (
                      <SummaryRow>
                        <Text
                          size="sm"
                          c="teal"
                        >
                          Insurance covers meds
                          {isPartialSel
                            ? ` (${coveredCount} item${coveredCount !== 1 ? 's' : ''})`
                            : ''}
                        </Text>
                        <Text
                          size="sm"
                          c="teal"
                        >
                          − UGX {calculatedInsured.toLocaleString()}
                        </Text>
                      </SummaryRow>
                    )}
                    {!barVisible &&
                      (order.insured_amount ?? 0) > 0 &&
                      (() => {
                        const hasPartialMed = meds.some(
                          (m) =>
                            m.is_insured && m.approval_status === 'partial',
                        )
                        const hasRejectedMed = meds.some(
                          (m) =>
                            m.is_insured &&
                            (m.approval_status === 'rejected' ||
                              m.approved_qty === 0),
                        )
                        return (
                          <SummaryRow>
                            <Text
                              size="sm"
                              c="teal"
                            >
                              {hasPartialMed || hasRejectedMed
                                ? 'Insurance covers meds (partial)'
                                : 'Insurance covers meds'}
                            </Text>
                            <Text
                              size="sm"
                              c="teal"
                            >
                              − UGX{' '}
                              {(order.insured_amount ?? 0).toLocaleString()}
                            </Text>
                          </SummaryRow>
                        )
                      })()}
                    <SummaryTotal>
                      <Text
                        fw={700}
                        size="sm"
                      >
                        {barVisible ? 'Customer will pay' : 'Customer pays'}
                      </Text>
                      <Text
                        fw={800}
                        size="md"
                        c={
                          barVisible
                            ? customerPays === 0
                              ? 'teal'
                              : 'lotusCyan'
                            : approvedTotal === 0
                              ? 'teal'
                              : 'lotusCyan'
                        }
                      >
                        {barVisible
                          ? customerPays === 0
                            ? 'Fully Covered'
                            : `UGX ${customerPays.toLocaleString()}`
                          : approvedTotal === 0
                            ? 'Fully Covered'
                            : `UGX ${approvedTotal.toLocaleString()}`}
                      </Text>
                    </SummaryTotal>
                  </CardBody>
                </Card>
              )}

              {/* Inline sticky approval bar */}
              {barVisible && (
                <InlineActionBar>
                  <Group
                    gap={8}
                    mb={2}
                  >
                    <TbShieldCheck
                      size={16}
                      color="#15B3E0"
                    />
                    <Text
                      fw={800}
                      size="sm"
                      c="var(--mantine-color-text)"
                    >
                      Coverage Decision
                    </Text>
                  </Group>
                  {approvalPanelContent}
                </InlineActionBar>
              )}

              {/* Approval History */}
              {approvalEvents.length > 0 && (
                <Card>
                  <CardHeader>
                    <TbHistory
                      size={15}
                      color="#15B3E0"
                    />
                    <CardHeaderTitle>Approval History</CardHeaderTitle>
                    <Badge
                      color="lotusCyan"
                      variant="light"
                      size="sm"
                    >
                      {approvalEvents.length} version
                      {approvalEvents.length !== 1 ? 's' : ''}
                    </Badge>
                  </CardHeader>
                  {[...approvalEvents].reverse().map((evt, revIdx) => {
                    const isExpanded = expandedEventId === evt.id
                    const isLatest = revIdx === 0
                    const msnap =
                      evt.medications_snapshot as ApprovalMedicationSnapshot[]
                    const coveredSnap = msnap.filter(
                      (m) => m.is_insured && m.coverage_decision === 'covered',
                    )
                    const insurableSnap = msnap.filter((m) => m.is_insured)
                    const approvedAt = new Date(evt.approved_at)
                    return (
                      <Box
                        key={evt.id}
                        style={{
                          borderBottom:
                            revIdx < approvalEvents.length - 1
                              ? '1px solid var(--mantine-color-default-border)'
                              : 'none',
                        }}
                      >
                        <Box
                          px="md"
                          py={12}
                          onClick={() =>
                            setExpandedEventId(isExpanded ? null : evt.id)
                          }
                          style={{
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            userSelect: 'none',
                          }}
                        >
                          <Box
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: 8,
                              flexShrink: 0,
                              background: isLatest
                                ? 'linear-gradient(135deg,#15B3E0,#0891B2)'
                                : 'var(--mantine-color-default-hover)',
                              border:
                                '1.5px solid var(--mantine-color-default-border)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Text
                              size="10px"
                              fw={800}
                              c={isLatest ? '#fff' : 'dimmed'}
                            >
                              v{evt.version_number}
                            </Text>
                          </Box>
                          <Box style={{ flex: 1, minWidth: 0 }}>
                            <Group
                              gap={6}
                              wrap="nowrap"
                            >
                              {evt.approval_type === 'full' ? (
                                <Badge
                                  size="xs"
                                  color="teal"
                                  variant="light"
                                  leftSection={<TbShieldCheck size={10} />}
                                >
                                  Full
                                </Badge>
                              ) : (
                                <Badge
                                  size="xs"
                                  color="orange"
                                  variant="light"
                                  leftSection={<TbShieldBolt size={10} />}
                                >
                                  Partial
                                </Badge>
                              )}
                              {isLatest && (
                                <Badge
                                  size="xs"
                                  color="blue"
                                  variant="dot"
                                >
                                  Latest
                                </Badge>
                              )}
                              <Text
                                size="xs"
                                c="dimmed"
                                style={{
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}
                              >
                                {approvedAt.toLocaleString('en-UG', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </Text>
                            </Group>
                            <Group
                              gap={8}
                              mt={3}
                            >
                              <Text
                                size="xs"
                                c="var(--mantine-color-text)"
                                fw={600}
                              >
                                {evt.approved_by_name ?? '—'}
                              </Text>
                              <Text
                                size="xs"
                                c="teal"
                                fw={700}
                              >
                                UGX {(evt.insured_amount ?? 0).toLocaleString()}{' '}
                                covered
                              </Text>
                              <Text
                                size="xs"
                                c="dimmed"
                              >
                                {coveredSnap.length}/{insurableSnap.length} meds
                              </Text>
                            </Group>
                          </Box>
                          <TbChevronDown
                            size={16}
                            color="var(--mantine-color-dimmed)"
                            style={{
                              flexShrink: 0,
                              transform: isExpanded
                                ? 'rotate(180deg)'
                                : 'rotate(0deg)',
                              transition: 'transform 0.2s',
                            }}
                          />
                        </Box>
                        <Collapse in={isExpanded}>
                          <Box
                            px="md"
                            pb="md"
                            style={{
                              borderTop:
                                '1px solid var(--mantine-color-default-border)',
                              background: 'var(--mantine-color-default-hover)',
                            }}
                          >
                            {(evt.approval_ref || evt.approved_by_name) && (
                              <Box
                                mt={10}
                                mb={10}
                                px={12}
                                py={10}
                                style={{
                                  background: 'rgba(16,185,129,0.06)',
                                  borderRadius: 8,
                                  border: '1px solid rgba(16,185,129,0.2)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 12,
                                }}
                              >
                                <TbShieldCheck
                                  size={16}
                                  color="#10b981"
                                  style={{ flexShrink: 0 }}
                                />
                                <Box>
                                  {evt.approval_ref && (
                                    <Text
                                      size="xs"
                                      fw={800}
                                      c="teal.8"
                                      style={{ letterSpacing: '0.04em' }}
                                    >
                                      {evt.approval_ref}
                                    </Text>
                                  )}
                                  {evt.approved_by_name && (
                                    <Text
                                      size="xs"
                                      c="dimmed"
                                    >
                                      Approved by {evt.approved_by_name}
                                      {evt.approved_by_phone
                                        ? ` · ${evt.approved_by_phone}`
                                        : ''}
                                    </Text>
                                  )}
                                </Box>
                              </Box>
                            )}
                            {evt.partial_reason && (
                              <Box
                                mb={10}
                                px={12}
                                py={8}
                                style={{
                                  background: 'rgba(251,146,60,0.08)',
                                  borderRadius: 8,
                                  border: '1px solid rgba(251,146,60,0.25)',
                                  display: 'flex',
                                  alignItems: 'flex-start',
                                  gap: 8,
                                }}
                              >
                                <TbAlertCircle
                                  size={14}
                                  color="#ea580c"
                                  style={{ flexShrink: 0, marginTop: 2 }}
                                />
                                <Text
                                  size="xs"
                                  c="orange.8"
                                >
                                  {evt.partial_reason}
                                </Text>
                              </Box>
                            )}
                            <ScrollArea>
                              <Table style={{ fontSize: 12, minWidth: 420 }}>
                                <Table.Thead>
                                  <Table.Tr>
                                    <Table.Th
                                      style={{
                                        fontSize: 11,
                                        color: 'var(--mantine-color-dimmed)',
                                        fontWeight: 700,
                                        padding: '6px 8px',
                                      }}
                                    >
                                      Medication
                                    </Table.Th>
                                    <Table.Th
                                      style={{
                                        fontSize: 11,
                                        color: 'var(--mantine-color-dimmed)',
                                        fontWeight: 700,
                                        padding: '6px 8px',
                                        textAlign: 'center',
                                      }}
                                    >
                                      Prescribed
                                    </Table.Th>
                                    <Table.Th
                                      style={{
                                        fontSize: 11,
                                        color: 'var(--mantine-color-dimmed)',
                                        fontWeight: 700,
                                        padding: '6px 8px',
                                        textAlign: 'center',
                                      }}
                                    >
                                      Approved
                                    </Table.Th>
                                    <Table.Th
                                      style={{
                                        fontSize: 11,
                                        color: 'var(--mantine-color-dimmed)',
                                        fontWeight: 700,
                                        padding: '6px 8px',
                                        textAlign: 'right',
                                      }}
                                    >
                                      Covered
                                    </Table.Th>
                                    <Table.Th
                                      style={{
                                        fontSize: 11,
                                        color: 'var(--mantine-color-dimmed)',
                                        fontWeight: 700,
                                        padding: '6px 8px',
                                        textAlign: 'center',
                                      }}
                                    >
                                      Status
                                    </Table.Th>
                                  </Table.Tr>
                                </Table.Thead>
                                <Table.Tbody>
                                  {msnap.map((m) => {
                                    const coveredAmt =
                                      m.is_insured && m.approved_qty != null
                                        ? m.unit_price * m.approved_qty
                                        : 0
                                    return (
                                      <Table.Tr
                                        key={m.id}
                                        style={{
                                          opacity:
                                            !m.is_insured ||
                                            m.coverage_decision === 'excluded'
                                              ? 0.55
                                              : 1,
                                        }}
                                      >
                                        <Table.Td
                                          style={{ padding: '6px 8px' }}
                                        >
                                          <Text
                                            size="xs"
                                            fw={600}
                                          >
                                            {m.name}
                                          </Text>
                                          {m.dosage && (
                                            <Text
                                              size="10px"
                                              c="dimmed"
                                            >
                                              {m.dosage}
                                            </Text>
                                          )}
                                        </Table.Td>
                                        <Table.Td
                                          style={{
                                            padding: '6px 8px',
                                            textAlign: 'center',
                                          }}
                                        >
                                          <Text size="xs">{m.quantity}</Text>
                                        </Table.Td>
                                        <Table.Td
                                          style={{
                                            padding: '6px 8px',
                                            textAlign: 'center',
                                          }}
                                        >
                                          {m.is_insured &&
                                          m.approved_qty != null ? (
                                            <Text
                                              size="xs"
                                              fw={700}
                                              c={
                                                m.approved_qty < m.quantity
                                                  ? 'orange'
                                                  : 'teal'
                                              }
                                            >
                                              {m.approved_qty}
                                            </Text>
                                          ) : (
                                            <Text
                                              size="xs"
                                              c="dimmed"
                                            >
                                              —
                                            </Text>
                                          )}
                                        </Table.Td>
                                        <Table.Td
                                          style={{
                                            padding: '6px 8px',
                                            textAlign: 'right',
                                          }}
                                        >
                                          {coveredAmt > 0 ? (
                                            <Text
                                              size="xs"
                                              fw={700}
                                              c="teal"
                                            >
                                              UGX {coveredAmt.toLocaleString()}
                                            </Text>
                                          ) : (
                                            <Text
                                              size="xs"
                                              c="dimmed"
                                            >
                                              —
                                            </Text>
                                          )}
                                        </Table.Td>
                                        <Table.Td
                                          style={{
                                            padding: '6px 8px',
                                            textAlign: 'center',
                                          }}
                                        >
                                          {!m.is_insured ? (
                                            <Badge
                                              size="xs"
                                              color="gray"
                                              variant="light"
                                            >
                                              Cash
                                            </Badge>
                                          ) : m.approval_status ===
                                            'approved' ? (
                                            <Badge
                                              size="xs"
                                              color="teal"
                                              variant="light"
                                            >
                                              Approved
                                            </Badge>
                                          ) : m.approval_status ===
                                            'partial' ? (
                                            <Badge
                                              size="xs"
                                              color="orange"
                                              variant="light"
                                            >
                                              Partial
                                            </Badge>
                                          ) : m.approval_status ===
                                              'rejected' ||
                                            m.coverage_decision ===
                                              'excluded' ? (
                                            <Badge
                                              size="xs"
                                              color="red"
                                              variant="light"
                                            >
                                              Excluded
                                            </Badge>
                                          ) : (
                                            <Badge
                                              size="xs"
                                              color="gray"
                                              variant="light"
                                            >
                                              —
                                            </Badge>
                                          )}
                                        </Table.Td>
                                      </Table.Tr>
                                    )
                                  })}
                                </Table.Tbody>
                              </Table>
                            </ScrollArea>
                            <Divider my={8} />
                            <Group
                              justify="space-between"
                              px={4}
                            >
                              <Group gap={16}>
                                <Box>
                                  <Text
                                    size="10px"
                                    c="dimmed"
                                    fw={700}
                                    style={{
                                      textTransform: 'uppercase',
                                      letterSpacing: '0.06em',
                                    }}
                                  >
                                    Insurance covers
                                  </Text>
                                  <Text
                                    size="sm"
                                    fw={800}
                                    c="teal"
                                  >
                                    UGX{' '}
                                    {(evt.insured_amount ?? 0).toLocaleString()}
                                  </Text>
                                </Box>
                                <Box>
                                  <Text
                                    size="10px"
                                    c="dimmed"
                                    fw={700}
                                    style={{
                                      textTransform: 'uppercase',
                                      letterSpacing: '0.06em',
                                    }}
                                  >
                                    Customer paid
                                  </Text>
                                  <Text
                                    size="sm"
                                    fw={800}
                                    c={
                                      evt.customer_pays === 0
                                        ? 'teal'
                                        : 'var(--mantine-color-text)'
                                    }
                                  >
                                    {evt.customer_pays === 0
                                      ? 'Fully Covered'
                                      : `UGX ${(evt.customer_pays ?? 0).toLocaleString()}`}
                                  </Text>
                                </Box>
                              </Group>
                              {evt.approval_ref && (
                                <Badge
                                  color="teal"
                                  variant="outline"
                                  size="sm"
                                  style={{ fontFamily: 'monospace' }}
                                >
                                  {evt.approval_ref}
                                </Badge>
                              )}
                            </Group>
                          </Box>
                        </Collapse>
                      </Box>
                    )
                  })}
                </Card>
              )}
            </MedicationArea>
          </MainContent>

          {/* ── RIGHT: Sticky Sidebar ── */}
          <RightSidebar>
            {/* Order Details Card */}
            <Card>
              <CardHeader>
                <TbReceipt
                  size={14}
                  color="#15B3E0"
                />
                <CardHeaderTitle>Order Details</CardHeaderTitle>
                <Badge
                  color={statusColor(order.status)}
                  size="xs"
                  variant="light"
                >
                  {statusLabel(order.status)}
                </Badge>
              </CardHeader>
              <CardBody>
                <DetailRow>
                  <DetailIcon>
                    <TbCalendar
                      size={13}
                      color="#0891B2"
                    />
                  </DetailIcon>
                  <Box style={{ flex: 1, minWidth: 0 }}>
                    <DetailLabel>Order Date</DetailLabel>
                    <Text
                      size="sm"
                      fw={600}
                    >
                      {order.created_at
                        ? new Date(order.created_at).toLocaleDateString(
                            'en-UG',
                            { day: 'numeric', month: 'short', year: 'numeric' },
                          )
                        : '—'}
                    </Text>
                    <Text
                      size="xs"
                      c="dimmed"
                    >
                      {formatRelativeTime(order.updated_at)}
                    </Text>
                  </Box>
                </DetailRow>

                <DetailRow>
                  <DetailIcon>
                    <TbCalendarRepeat
                      size={13}
                      color="#0891B2"
                    />
                  </DetailIcon>
                  <Box style={{ flex: 1, minWidth: 0 }}>
                    <DetailLabel>Order Type</DetailLabel>
                    {order.is_chronic_child ? (
                      <Group
                        gap={6}
                        mt={2}
                        align="center"
                      >
                        <Badge
                          color="violet"
                          variant="light"
                          size="sm"
                          leftSection={<TbCalendarRepeat size={10} />}
                        >
                          Scheduled
                        </Badge>
                        {order.block_number != null && (
                          <Text
                            size="xs"
                            c="dimmed"
                            fw={500}
                          >
                            Block {order.block_number}
                          </Text>
                        )}
                      </Group>
                    ) : (
                      <Badge
                        color="blue"
                        variant="light"
                        size="sm"
                        mt={2}
                      >
                        Normal
                      </Badge>
                    )}
                  </Box>
                </DetailRow>

                {order.diagnosis && (
                  <DetailRow>
                    <DetailIcon>
                      <TbNotes
                        size={13}
                        color="#0891B2"
                      />
                    </DetailIcon>
                    <Box style={{ flex: 1, minWidth: 0 }}>
                      <DetailLabel>Diagnosis</DetailLabel>
                      <Badge
                        color="blue"
                        variant="light"
                        size="sm"
                        mt={2}
                      >
                        {order.diagnosis}
                      </Badge>
                    </Box>
                  </DetailRow>
                )}

                {order.delivery_address_snapshot ? (
                  <DetailRow>
                    <DetailIcon>
                      <TbMapPin
                        size={13}
                        color="#0891B2"
                      />
                    </DetailIcon>
                    <Box style={{ flex: 1, minWidth: 0 }}>
                      <DetailLabel>Delivery Address</DetailLabel>
                      {order.delivery_address_snapshot.label && (
                        <Text
                          size="sm"
                          fw={700}
                        >
                          {order.delivery_address_snapshot.label}
                        </Text>
                      )}
                      {(order.delivery_address_snapshot.street ||
                        order.delivery_address_snapshot.zone) && (
                        <Text
                          size="sm"
                          c="dimmed"
                        >
                          {[
                            order.delivery_address_snapshot.street,
                            order.delivery_address_snapshot.zone,
                          ]
                            .filter(Boolean)
                            .join(', ')}
                        </Text>
                      )}
                      {order.delivery_address_snapshot.city && (
                        <Text
                          size="sm"
                          c="dimmed"
                        >
                          {order.delivery_address_snapshot.city}
                        </Text>
                      )}
                      {order.delivery_address_snapshot.instructions && (
                        <Text
                          size="xs"
                          c="dimmed"
                          fs="italic"
                          mt={2}
                        >
                          {order.delivery_address_snapshot.instructions}
                        </Text>
                      )}
                      {order.delivery_skipped && (
                        <Badge
                          size="xs"
                          color="violet"
                          variant="light"
                          mt={4}
                        >
                          In-store
                        </Badge>
                      )}
                    </Box>
                  </DetailRow>
                ) : order.delivery_skipped ||
                  (order as { no_rider?: boolean }).no_rider ? (
                  <DetailRow>
                    <DetailIcon>
                      <TbMapPin
                        size={13}
                        color="#9ca3af"
                      />
                    </DetailIcon>
                    <Box style={{ flex: 1, minWidth: 0 }}>
                      <DetailLabel>Delivery</DetailLabel>
                      <Badge
                        size="sm"
                        color="violet"
                        variant="light"
                      >
                        In-store pickup — no delivery
                      </Badge>
                    </Box>
                  </DetailRow>
                ) : null}

                {order.contact_phone && (
                  <DetailRow>
                    <DetailIcon>
                      <TbPhone
                        size={13}
                        color="#0891B2"
                      />
                    </DetailIcon>
                    <Box style={{ flex: 1, minWidth: 0 }}>
                      <DetailLabel>Contact Phone</DetailLabel>
                      <Text
                        size="sm"
                        fw={600}
                        c="lotusCyan"
                        component="a"
                        href={`tel:${order.contact_phone}`}
                        style={{ textDecoration: 'none' }}
                      >
                        {order.contact_phone}
                      </Text>
                    </Box>
                  </DetailRow>
                )}
              </CardBody>
            </Card>

            {/* Delivery Summary (delivered orders) */}
            {order.status === 'delivered' &&
              (() => {
                const outEntry = statusHistory.find(
                  (e) => e.status === 'out_for_delivery',
                )
                const delEntry = statusHistory.find(
                  (e) => e.status === 'delivered',
                )
                const outAt = outEntry?.created_at ?? null
                const delAt =
                  (order as { delivered_at?: string }).delivered_at ??
                  delEntry?.created_at ??
                  null
                const createdAt =
                  (order as { created_at?: string }).created_at ?? null
                const deliveryMs =
                  outAt && delAt
                    ? new Date(delAt).getTime() - new Date(outAt).getTime()
                    : null
                const totalMs =
                  createdAt && delAt
                    ? new Date(delAt).getTime() - new Date(createdAt).getTime()
                    : null

                const timelineRows = [
                  {
                    label: 'Order Placed',
                    icon: (
                      <TbPackage
                        size={13}
                        color="#0891B2"
                      />
                    ),
                    value: formatDateTime(createdAt),
                    active: !!createdAt,
                  },
                  {
                    label: 'Out for Delivery',
                    icon: (
                      <TbTruck
                        size={13}
                        color="#7c3aed"
                      />
                    ),
                    value: outAt ? formatDateTime(outAt) : '—',
                    active: !!outAt,
                  },
                  {
                    label: 'Delivered',
                    icon: (
                      <TbCheck
                        size={13}
                        color="#10b981"
                      />
                    ),
                    value: delAt ? formatDateTime(delAt) : '—',
                    active: !!delAt,
                  },
                ]
                const statRows = [
                  deliveryMs !== null
                    ? {
                        icon: (
                          <TbTruck
                            size={13}
                            color="#10b981"
                          />
                        ),
                        label: 'Delivery Duration',
                        value: formatDuration(deliveryMs),
                        color: 'teal' as const,
                        bg: 'rgba(16,185,129,0.05)',
                      }
                    : null,
                  totalMs !== null
                    ? {
                        icon: (
                          <TbClock
                            size={13}
                            color="#0891B2"
                          />
                        ),
                        label: 'Total Order Time',
                        value: formatDuration(totalMs),
                        color: 'blue' as const,
                        bg: 'rgba(8,145,178,0.05)',
                      }
                    : null,
                ].filter((r): r is NonNullable<typeof r> => r !== null)

                return (
                  <Card style={{ borderColor: 'rgba(16,185,129,0.3)' }}>
                    <CardHeader>
                      <TbClock
                        size={14}
                        color="#10b981"
                      />
                      <CardHeaderTitle>Delivery Summary</CardHeaderTitle>
                      <Badge
                        color="teal"
                        variant="light"
                        size="xs"
                      >
                        Completed
                      </Badge>
                    </CardHeader>
                    {timelineRows.map(
                      ({ label, icon, value, active }, i, arr) => (
                        <Box
                          key={label}
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 10,
                            padding: '10px 20px',
                            borderBottom:
                              i < arr.length - 1
                                ? '1px solid var(--mantine-color-default-border)'
                                : 'none',
                            opacity: active ? 1 : 0.45,
                          }}
                        >
                          <Box
                            style={{
                              width: 24,
                              height: 24,
                              borderRadius: 7,
                              flexShrink: 0,
                              background: 'var(--mantine-color-default-hover)',
                              border:
                                '1px solid var(--mantine-color-default-border)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              marginTop: 2,
                            }}
                          >
                            {icon}
                          </Box>
                          <Box style={{ flex: 1, minWidth: 0 }}>
                            <DetailLabel>{label}</DetailLabel>
                            <Text
                              size="sm"
                              fw={600}
                              mt={1}
                            >
                              {value}
                            </Text>
                          </Box>
                        </Box>
                      ),
                    )}
                    {statRows.length > 0 && (
                      <Box
                        style={{
                          borderTop:
                            '2px solid var(--mantine-color-default-border)',
                        }}
                      >
                        {statRows.map((stat, i) => (
                          <Box
                            key={stat.label}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              flexWrap: 'wrap',
                              gap: '6px 12px',
                              padding: '10px 20px',
                              borderBottom:
                                i < statRows.length - 1
                                  ? '1px solid var(--mantine-color-default-border)'
                                  : 'none',
                              background: stat.bg,
                            }}
                          >
                            <Group
                              gap={7}
                              style={{ flexShrink: 0 }}
                            >
                              {stat.icon}
                              <Text
                                size="sm"
                                fw={600}
                                c={stat.color === 'teal' ? 'teal.7' : 'blue.7'}
                              >
                                {stat.label}
                              </Text>
                            </Group>
                            <Badge
                              color={stat.color}
                              variant="filled"
                              size="md"
                              radius="sm"
                              style={{
                                fontFamily: 'monospace',
                                fontWeight: 800,
                                letterSpacing: '0.04em',
                                flexShrink: 0,
                              }}
                            >
                              {stat.value}
                            </Badge>
                          </Box>
                        ))}
                      </Box>
                    )}
                  </Card>
                )
              })()}

            {/* Prescription Viewer */}
            {prescriptionSignedUrl && (
              <Card>
                <CardHeader>
                  <CardHeaderTitle>Prescription</CardHeaderTitle>
                </CardHeader>
                <CardBody style={{ padding: 0 }}>
                  {(order as { prescription_notes?: string })
                    .prescription_notes && (
                    <Box
                      style={{
                        display: 'flex',
                        gap: 12,
                        padding: '12px 16px',
                        borderBottom:
                          '1px solid var(--mantine-color-default-border)',
                        background: 'rgba(59,130,246,0.06)',
                      }}
                    >
                      <Box
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 8,
                          flexShrink: 0,
                          background: 'linear-gradient(135deg,#3b82f6,#1d4ed8)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <TbNotes
                          size={15}
                          color="#fff"
                        />
                      </Box>
                      <Box style={{ flex: 1 }}>
                        <Text
                          size="xs"
                          fw={700}
                          c="blue.7"
                          mb={3}
                          style={{
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                          }}
                        >
                          Patient Note
                        </Text>
                        <Text
                          size="sm"
                          fw={600}
                          c="var(--mantine-color-text)"
                          lh={1.6}
                        >
                          {
                            (order as { prescription_notes?: string })
                              .prescription_notes
                          }
                        </Text>
                      </Box>
                    </Box>
                  )}
                  <PrescriptionViewer
                    src={prescriptionSignedUrl}
                    signedUrl={prescriptionSignedUrl}
                    allSignedUrls={allSignedUrls}
                  />
                </CardBody>
              </Card>
            )}
          </RightSidebar>
        </PageLayout>
      </PageContainer>

      {/* ── Floating chat button ── */}
      {isActive && user && staffInfo && (
        <>
          <ChatFloat
            onClick={openChat}
            aria-label="Open chat with pharmacy"
          >
            <TbMessage2
              size={22}
              color="#fff"
            />
            {unread > 0 && <UnreadDot>{unread > 9 ? '9+' : unread}</UnreadDot>}
          </ChatFloat>

          <ChatSlide $open={chatOpen}>
            <Box
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 16px 8px',
                borderBottom: '1px solid var(--mantine-color-default-border)',
                flexShrink: 0,
              }}
            >
              <Text
                fw={700}
                size="sm"
                style={{
                  fontFamily: "'DM Sans',sans-serif",
                  color: 'var(--mantine-color-text)',
                }}
              >
                Chat with Pharmacy
              </Text>
              <button
                onClick={() => setChatOpen(false)}
                aria-label="Close chat"
                style={{
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  padding: 4,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <TbX
                  size={17}
                  color="#9EADB8"
                />
              </button>
            </Box>
            <Box
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                minHeight: 0,
              }}
            >
              <OrderChatPanel
                orderId={order.id}
                senderId={staffInfo.id}
                senderName={staffInfo.name + ' (Insurance)'}
                senderType="insurance_staff"
                chatThread="insurance"
                placeholder="Message pharmacy…"
                height={255}
                disabled={[
                  'prescription_uploaded',
                  'insurance_verification',
                  'pharmacy_review',
                  'delivered',
                  'cancelled',
                  'rejected',
                ].includes(order.status)}
              />
            </Box>
          </ChatSlide>

          {chatOpen && (
            <div
              onClick={() => setChatOpen(false)}
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 499,
                background: 'rgba(0,0,0,0.3)',
              }}
            />
          )}
        </>
      )}

      {/* ── Rejection modal ── */}
      <Modal
        opened={rejectModalOpen}
        onClose={() => setRejectModalOpen(false)}
        title="Reject & Return to Pharmacist"
        centered
        size="sm"
        styles={{
          title: { fontFamily: "'DM Sans',sans-serif", fontWeight: 700 },
        }}
      >
        <Stack gap="md">
          <Box
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
              padding: '12px 14px',
              borderRadius: 10,
              background: 'rgba(245,158,11,0.07)',
              border: '1.5px solid rgba(245,158,11,0.25)',
            }}
          >
            <TbAlertCircle
              size={18}
              color="#ea580c"
              style={{ flexShrink: 0, marginTop: 2 }}
            />
            <Text
              size="sm"
              c="dimmed"
            >
              The order will be <strong>returned to the pharmacist</strong> with
              your reason. They can revise the pricing and resubmit for
              approval.
            </Text>
          </Box>
          <Textarea
            label="Reason for rejection"
            placeholder="e.g. Medication not covered under this scheme, incorrect quantity billed, member not eligible for this benefit…"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            minRows={3}
            autosize
            required
          />
          <Group
            justify="flex-end"
            gap="sm"
          >
            <Button
              variant="default"
              onClick={() => setRejectModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              color="red"
              disabled={!rejectReason.trim()}
              loading={rejecting}
              leftSection={<TbX size={14} />}
              onClick={handleReject}
            >
              Confirm Rejection
            </Button>
          </Group>
        </Stack>
      </Modal>
    </PortalPageWrap>
  )
}

