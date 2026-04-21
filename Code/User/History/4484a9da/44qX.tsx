import React, { useState, useEffect } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import {
  Autocomplete,
  Badge,
  Box,
  Button,
  Group,
  Stack,
  Text,
  Table,
  NumberInput,
  TextInput,
  Textarea,
  Modal,
  Loader,
  Center,
  Alert,
  Divider,
  Tooltip,
  Collapse,
  ActionIcon,
} from '@mantine/core'
import {
  TbArrowLeft,
  TbPencil,
  TbX,
  TbShieldCheck,
  TbShieldOff,
  TbAlertCircle,
  TbCheck,
  TbTruck,
  TbPackage,
  TbPlus,
  TbTrash,
  TbUser,
  TbBroadcast,
  TbCircleCheck,
  TbClock,
  TbPhone,
  TbMapPin,
  TbMessageCircle,
  TbNotes,
  TbCurrencyDollar,
  TbChevronRight,
  TbHistory,
  TbChevronDown,
  TbChevronUp,
  TbShieldBolt,
  TbRefresh,
  TbCalendar,
  TbReceipt,
} from 'react-icons/tb'
import styled, { keyframes, css } from 'styled-components'
import { notifications } from '@mantine/notifications'
import { DIAGNOSES } from '@shared/constants/diagnoses'
import { PortalPageWrap } from '@shared/ui/portal'
import { TRow, TCell, THead } from '@shared/ui/table'
import {
  supabase,
  DbOrder,
  DbInsurance,
  OrderStatus,
  DbStaff,
  DbDeliveryRequest,
  DeliveryRequestStatus,
} from '../../../lib/supabase'
import { useAuth } from '../../../features/auth/context/AuthContext'
import PrescriptionViewer from './PrescriptionViewer'
import { PharmacySidebarLayout } from '../../components/PharmacySidebar'
import { formatRelativeTime } from '../../../shared/utils/formatTime'

// ─── Animations ─────────────────────────────────────────────────────────────

const selectedPulse = keyframes`
  0%,100%{box-shadow:0 0 0 0 rgba(21,179,224,0.3)}
  50%{box-shadow:0 0 0 5px rgba(21,179,224,0)}
`

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
`

// ─── Layout Primitives ───────────────────────────────────────────────────────

const PageContainer = styled.div`
  animation: ${fadeIn} 0.25s ease;
`

const TwoColumnGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 360px;
  gap: 20px;
  align-items: flex-start;

  @media (max-width: 960px) {
    grid-template-columns: 1fr;
  }
`

const MainColumn = styled.div`
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
`

const SideColumn = styled.div`
  position: sticky;
  top: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
`

// ─── Cards ───────────────────────────────────────────────────────────────────

const Card = styled.div`
  background: var(--mantine-color-body);
  border: 1.5px solid var(--mantine-color-default-border);
  border-radius: 14px;
  overflow: hidden;
`

const CardHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 18px;
  border-bottom: 1px solid var(--mantine-color-default-border);
  background: linear-gradient(
    90deg,
    rgba(8, 145, 178, 0.06) 0%,
    transparent 60%
  );
`

const CardBody = styled.div`
  padding: 18px;
`

const CardHeaderTitle = styled(Text)`
  font-size: 13px;
  font-weight: 700;
  color: var(--mantine-color-text);
  flex: 1;
`

// ─── Order Hero (top bar) ─────────────────────────────────────────────────────

const OrderHero = styled.div`
  background: var(--mantine-color-body);
  border: 1.5px solid var(--mantine-color-default-border);
  border-radius: 14px;
  overflow: hidden;
  margin-bottom: 20px;
`

const HeroTopStrip = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 18px;
  background: linear-gradient(
    90deg,
    rgba(8, 145, 178, 0.08) 0%,
    rgba(8, 145, 178, 0.02) 100%
  );
  border-bottom: 1px solid var(--mantine-color-default-border);
`

const HeroGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  @media (max-width: 640px) {
    grid-template-columns: 1fr;
  }
`

const HeroCell = styled.div<{ $border?: boolean }>`
  padding: 18px 20px;
  border-right: ${(p) =>
    p.$border ? '1px solid var(--mantine-color-default-border)' : 'none'};
  @media (max-width: 640px) {
    border-right: none;
    border-bottom: 1px solid var(--mantine-color-default-border);
    &:last-child {
      border-bottom: none;
    }
  }
`

const HeroLabel = styled.div`
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.8px;
  text-transform: uppercase;
  color: var(--mantine-color-dimmed);
  margin-bottom: 7px;
`

// ─── Detail Row (address / contact) ─────────────────────────────────────────

const DetailRow = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 11px 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.04);
  &:last-child {
    border-bottom: none;
  }
`

const DetailIcon = styled.div`
  width: 30px;
  height: 30px;
  border-radius: 8px;
  background: rgba(8, 145, 178, 0.09);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-top: 1px;
`

const DetailLabel = styled(Text)`
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.6px;
  text-transform: uppercase;
  color: var(--mantine-color-dimmed);
  margin-bottom: 3px;
`

// ─── Medication Table ─────────────────────────────────────────────────────────

const MedTableWrap = styled.div`
  overflow-x: auto;
  border: 1px solid var(--mantine-color-default-border);
  border-radius: 10px;
  margin-top: 14px;
`

const MedTableRow = styled.tr<{ $editing?: boolean }>`
  background: ${(p) =>
    p.$editing ? 'rgba(16,185,129,0.06)' : 'transparent'} !important;
  transition: background 0.12s;
  &:hover td {
    background: rgba(8, 145, 178, 0.025);
  }
`

// ─── Summary Panel ───────────────────────────────────────────────────────────

const SummaryRow = styled.div<{ $accent?: 'teal' | 'orange' }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  background: ${(p) =>
    p.$accent === 'teal'
      ? 'rgba(16,185,129,0.05)'
      : p.$accent === 'orange'
        ? 'rgba(245,158,11,0.05)'
        : 'transparent'};
  &:last-child {
    border-bottom: none;
  }
`

const SummaryTotal = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  background: linear-gradient(
    90deg,
    rgba(8, 145, 178, 0.08),
    rgba(8, 145, 178, 0.03)
  );
  border-top: 2px solid rgba(8, 145, 178, 0.2);
`

const ApprovalPill = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 9px;
  border-radius: 20px;
  background: rgba(16, 185, 129, 0.1);
  border: 1px solid rgba(16, 185, 129, 0.3);
  font-size: 11px;
  font-weight: 700;
  color: #10b981;
`

const FullyCoveredBadge = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 14px;
  border-radius: 20px;
  background: rgba(16, 185, 129, 0.12);
  border: 1.5px solid rgba(16, 185, 129, 0.35);
  font-size: 14px;
  font-weight: 800;
  color: #10b981;
`

// ─── Banners ─────────────────────────────────────────────────────────────────

const AlertBanner = styled.div<{ $color: 'amber' | 'red' | 'blue' }>`
  display: flex;
  gap: 14px;
  align-items: flex-start;
  padding: 15px 18px;
  border-radius: 12px;
  border: 2px solid
    ${(p) =>
      p.$color === 'amber'
        ? 'rgba(245,158,11,0.5)'
        : p.$color === 'red'
          ? 'rgba(239,68,68,0.5)'
          : 'rgba(59,130,246,0.4)'};
  background: ${(p) =>
    p.$color === 'amber'
      ? 'rgba(245,158,11,0.06)'
      : p.$color === 'red'
        ? 'rgba(239,68,68,0.06)'
        : 'rgba(59,130,246,0.05)'};
  animation: ${css`
      ${selectedPulse}`} 2.5s ease-in-out 4;
`

const BannerIcon = styled.div<{ $color: string }>`
  width: 40px;
  height: 40px;
  border-radius: 10px;
  flex-shrink: 0;
  background: ${(p) => p.$color};
  display: flex;
  align-items: center;
  justify-content: center;
`

// ─── Rider Card ──────────────────────────────────────────────────────────────

const RiderCard = styled.div<{ $selected: boolean }>`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 10px;
  cursor: pointer;
  border: 2px solid
    ${(p) => (p.$selected ? '#0891B2' : 'var(--mantine-color-default-border)')};
  background: ${(p) =>
    p.$selected ? 'rgba(21,179,224,0.07)' : 'var(--mantine-color-body)'};
  transition: all 0.15s;
  ${(p) =>
    p.$selected &&
    css`
      animation: ${selectedPulse} 2s ease infinite;
    `}
  &:hover {
    border-color: #0891b2;
    background: rgba(21, 179, 224, 0.04);
  }
`

const RadioDot = styled.div<{ $selected: boolean }>`
  width: 18px;
  height: 18px;
  border-radius: 50%;
  flex-shrink: 0;
  border: 2px solid
    ${(p) => (p.$selected ? '#0891B2' : 'var(--mantine-color-default-border)')};
  background: ${(p) => (p.$selected ? '#0891B2' : 'var(--mantine-color-body)')};
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
`

// ─── Helpers ─────────────────────────────────────────────────────────────────

const statusLabel = (s: string, paymentMethod?: string): string => {
  const labels: Record<string, string> = {
    prescription_uploaded: 'Uploaded',
    insurance_verification: 'Insurance Check',
    pharmacy_review: 'Under Review',
    pricing_ready: 'Insurance Approval',
    awaiting_confirmation: 'Customer Confirming',
    confirmed:
      paymentMethod === 'cod' ? 'COD — Ready to Pack' : 'Paid — Ready to Pack',
    packing: 'Packing',
    dispatched: 'Dispatched',
    out_for_delivery: 'Out for Delivery',
    delivered: 'Delivered',
    rejected: 'Rejected',
    cancelled: 'Cancelled',
  }
  return labels[s] ?? s.replace(/_/g, ' ')
}

const statusColor = (s: string): string =>
  ({
    delivered: 'teal',
    prescription_uploaded: 'blue',
    pricing_ready: 'orange',
    out_for_delivery: 'cyan',
    rejected: 'red',
    cancelled: 'gray',
    packing: 'violet',
    awaiting_confirmation: 'yellow',
    pharmacy_review: 'indigo',
    confirmed: 'green',
    dispatched: 'cyan',
  })[s] ?? 'gray'

const DELIVERY_FEE = 10_000

interface StatusHistoryEntry {
  id: string
  order_id: string
  status: string
  changed_by_role: string | null
  changed_by_name: string | null
  notes: string | null
  created_at: string
}

interface MedRow {
  id: string
  name: string
  dosage: string
  quantity: number
  unit_price: number
  is_insured: boolean
  in_stock: boolean
  is_delivery: boolean
  days: number | null
  freq_per_day: number | null
  approved_qty?: number | null
  approval_status?: 'pending' | 'approved' | 'partial' | 'rejected'
  coverage_notes?: string | null
  isNew?: boolean
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PharmacyOrderDetail(): JSX.Element {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { staffInfo } = useAuth()

  const [order, setOrder] = useState<DbOrder | null>(null)
  const [meds, setMeds] = useState<MedRow[]>([])
  const [loading, setLoading] = useState(true)
  const [diagnosis, setDiagnosis] = useState<string>('')
  const [savingPricing, setSavingPricing] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [savingStatus, setSavingStatus] = useState<string | null>(null)
  const [prescriptionSignedUrl, setPrescriptionSignedUrl] = useState<
    string | null
  >(null)
  const [allSignedUrls, setAllSignedUrls] = useState<string[]>([])

  const BROADCAST_TIMEOUT_SECS = 5 * 60

  const [deliveryStaff, setDeliveryStaff] = useState<DbStaff[]>([])
  const [deliveryRequests, setDeliveryRequests] = useState<DbDeliveryRequest[]>(
    [],
  )
  const [selectedRider, setSelectedRider] = useState<string | null>(null)
  const [assigning, setAssigning] = useState(false)
  const [broadcastSecsLeft, setBroadcastSecsLeft] = useState<number | null>(
    null,
  )
  const [rejectModalOpen, setRejectModalOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [walkinOtpModalOpen, setWalkinOtpModalOpen] = useState(false)
  const [walkinOtpInput, setWalkinOtpInput] = useState('')
  const [walkinOtpError, setWalkinOtpError] = useState<string | null>(null)
  const [verifyingWalkinOtp, setVerifyingWalkinOtp] = useState(false)
  const [statusHistory, setStatusHistory] = useState<StatusHistoryEntry[]>([])
  const [historyOpen, setHistoryOpen] = useState(false)

  useEffect(() => {
    if (!loading && location.hash === '#rider-section') {
      setTimeout(() => {
        document
          .getElementById('rider-section')
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    }
  }, [loading, location.hash])

  const fetchOrder = async (): Promise<void> => {
    if (!id) return
    const { data } = await supabase
      .from('orders')
      .select(
        '*, profiles(name, relationship, insurance(*)), medications(*), selected_insurance:insurance!orders_selected_insurance_id_fkey(*)',
      )
      .eq('id', id)
      .single()
    if (data) {
      setOrder(data as DbOrder)
      setDiagnosis((data as DbOrder).diagnosis ?? '')
      setMeds(
        ((data.medications as MedRow[] | null) ?? []).map((m: MedRow) => ({
          id: m.id,
          name: m.name,
          quantity: m.quantity ?? 1,
          unit_price: m.unit_price ?? 0,
          dosage: (m as { dosage?: string }).dosage ?? '',
          is_insured: m.is_insured ?? false,
          in_stock: m.in_stock !== false,
          is_delivery: m.is_delivery ?? false,
          days: (m as { days?: number | null }).days ?? null,
          freq_per_day:
            (m as { freq_per_day?: number | null }).freq_per_day ?? null,
          approved_qty:
            (m as { approved_qty?: number | null }).approved_qty ?? null,
          approval_status:
            (m as { approval_status?: MedRow['approval_status'] })
              .approval_status ?? 'pending',
          coverage_notes:
            (m as { coverage_notes?: string | null }).coverage_notes ?? null,
        })),
      )

      if ((data as DbOrder).no_rider) {
        setSelectedRider('__no_rider__')
      } else if ((data as DbOrder).delivery_address_snapshot) {
        setSelectedRider('__broadcast__')
      }

      const allPaths: string[] = data.prescription_urls?.length
        ? data.prescription_urls
        : data.prescription_url
          ? [data.prescription_url]
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
    }
    setLoading(false)
  }

  const fetchDeliveryData = async (): Promise<void> => {
    if (!id) return
    const { data: sd } = await supabase
      .from('staff')
      .select('*')
      .eq('role', 'delivery')
      .order('name')
    if (sd) setDeliveryStaff(sd as DbStaff[])

    const { data: rd } = await supabase
      .from('delivery_requests')
      .select('*')
      .eq('order_id', id)
      .order('created_at', { ascending: false })

    if (!rd) return

    const staffIds = [...new Set(rd.map((r) => r.delivery_staff_id as string))]
    const { data: staffList } = await supabase
      .from('staff')
      .select('id, name, phone, role, is_active, email, created_at, updated_at')
      .in('id', staffIds)

    const staffById: Record<string, DbStaff> = {}
    for (const s of staffList ?? []) {
      staffById[(s as DbStaff).id] = s as DbStaff
    }

    const enriched: DbDeliveryRequest[] = rd.map((r) => ({
      ...(r as DbDeliveryRequest),
      staff: staffById[r.delivery_staff_id as string] ?? null,
    }))
    setDeliveryRequests(enriched)
  }

  const fetchStatusHistory = async (): Promise<void> => {
    if (!id) return
    const { data: rows } = await supabase
      .from('order_status_history')
      .select('id, order_id, status, changed_by_role, notes, created_at')
      .eq('order_id', id)
      .order('created_at', { ascending: false })
      .limit(40)
    if (!rows) return
    setStatusHistory(
      (rows as Omit<StatusHistoryEntry, 'changed_by_name'>[]).map((r) => ({
        ...r,
        changed_by_name: null,
      })),
    )
  }

  useEffect(() => {
    fetchOrder()
    fetchDeliveryData()
    fetchStatusHistory()

    const orderCh = supabase
      .channel(`order-detail-rt:${id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${id}`,
        },
        () => fetchOrder(),
      )
      .subscribe()
    const reqCh = supabase
      .channel(`delivery-req-rt:${id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'delivery_requests',
          filter: `order_id=eq.${id}`,
        },
        async () => {
          await fetchDeliveryData()
          fetchOrder()
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(orderCh)
      supabase.removeChannel(reqCh)
    }
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!order?.broadcast_timeout_at || !order.dispatch_is_broadcast) {
      setBroadcastSecsLeft(null)
      return
    }
    const hasAccepted = deliveryRequests.some((r) => r.status === 'accepted')
    if (hasAccepted || order.rider_declined_at) {
      setBroadcastSecsLeft(null)
      return
    }

    const tick = (): number => {
      const secsLeft = Math.floor(
        (new Date(order.broadcast_timeout_at!).getTime() - Date.now()) / 1000,
      )
      setBroadcastSecsLeft(Math.max(0, secsLeft))
      return secsLeft
    }
    const initial = tick()
    if (initial <= 0) {
      supabase
        .rpc('expire_broadcast_timeout', { p_order_id: order.id })
        .then(() => {
          fetchDeliveryData()
          fetchOrder()
        })
      return
    }
    const interval = setInterval(async () => {
      const remaining = tick()
      if (remaining <= 0) {
        clearInterval(interval)
        await supabase.rpc('expire_broadcast_timeout', { p_order_id: order.id })
        fetchDeliveryData()
        fetchOrder()
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [
    order?.broadcast_timeout_at,
    order?.dispatch_is_broadcast,
    order?.rider_declined_at,
    deliveryRequests,
  ]) // eslint-disable-line react-hooks/exhaustive-deps

  const profileInsurance: DbInsurance | null = order?.cash_only
    ? null
    : ((order?.selected_insurance as DbInsurance | null) ?? null)
  const insuranceStatus: string = order?.cash_only
    ? 'none'
    : (profileInsurance?.status ?? order?.insurance_status ?? 'none')
  const insuranceVerified = !order?.cash_only && insuranceStatus === 'verified'

  const [insuranceProviderPhone, setInsuranceProviderPhone] = React.useState<
    string | null
  >(null)
  React.useEffect(() => {
    if (!profileInsurance?.provider) {
      setInsuranceProviderPhone(null)
      return
    }
    supabase
      .from('insurance_providers')
      .select('contact_phone')
      .eq('name', profileInsurance.provider)
      .limit(1)
      .single()
      .then(({ data }) => {
        setInsuranceProviderPhone(
          (data as { contact_phone?: string | null } | null)?.contact_phone ??
            null,
        )
      })
  }, [profileInsurance?.provider]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleInsured = (medId: string, checked: boolean): void => {
    if (order?.cash_only) {
      notifications.show({
        title: 'Cash-only order',
        message: 'Insurance coverage cannot be applied to cash-only orders.',
        color: 'orange',
      })
      return
    }
    if (checked && !insuranceVerified) {
      notifications.show({
        title: 'Insurance not verified',
        message:
          'Insurance must be verified by support before applying coverage.',
        color: 'orange',
      })
      return
    }
    setMeds((prev) =>
      prev.map((m) => (m.id === medId ? { ...m, is_insured: checked } : m)),
    )
  }
  const updatePrice = (medId: string, price: number): void =>
    setMeds((prev) =>
      prev.map((m) => (m.id === medId ? { ...m, unit_price: price } : m)),
    )
  const toggleStock = (medId: string, inStock: boolean): void =>
    setMeds((prev) =>
      prev.map((m) => (m.id === medId ? { ...m, in_stock: inStock } : m)),
    )
  const addMedRow = (): void => {
    const newId = `new-${Date.now()}`
    setMeds((prev) => [
      ...prev,
      {
        id: newId,
        name: '',
        quantity: 1,
        dosage: '',
        unit_price: 0,
        is_insured: false,
        in_stock: true,
        is_delivery: false,
        days: null,
        freq_per_day: null,
        isNew: true,
      },
    ])
    setEditingId(newId)
  }
  const removeMedRow = (medId: string): void =>
    setMeds((prev) => prev.filter((m) => m.id !== medId))
  const updateName = (medId: string, name: string): void =>
    setMeds((prev) => prev.map((m) => (m.id === medId ? { ...m, name } : m)))
  const updateDosage = (medId: string, dosage: string): void =>
    setMeds((prev) => prev.map((m) => (m.id === medId ? { ...m, dosage } : m)))
  const updateQty = (medId: string, quantity: number): void =>
    setMeds((prev) =>
      prev.map((m) => (m.id === medId ? { ...m, quantity } : m)),
    )
  const updateDays = (medId: string, days: number | null): void =>
    setMeds((prev) =>
      prev.map((m) =>
        m.id === medId
          ? {
              ...m,
              days,
              quantity:
                days != null && m.freq_per_day != null
                  ? days * m.freq_per_day
                  : m.quantity,
            }
          : m,
      ),
    )
  const updateFreq = (medId: string, freq: number | null): void =>
    setMeds((prev) =>
      prev.map((m) =>
        m.id === medId
          ? {
              ...m,
              freq_per_day: freq,
              quantity:
                freq != null && m.days != null ? m.days * freq : m.quantity,
            }
          : m,
      ),
    )

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const sendCustomerNotification = async (
    _status: OrderStatus,
    _orderRef: DbOrder,
  ): Promise<void> => {
    return
  }

  const savePricing = async (): Promise<void> => {
    if (!order) return
    const namedMeds = meds.filter((m) => m.name.trim())
    if (!namedMeds.length) {
      notifications.show({
        title: 'No medications',
        message: 'Add at least one medication before saving.',
        color: 'orange',
      })
      return
    }
    setSavingPricing(true)

    const wasInsuranceApproved =
      !!order.insurance_approval_ref && !order.cash_only
    let needsInsuranceReapproval = false

    if (wasInsuranceApproved) {
      const dbMeds = (order.medications ?? []) as MedRow[]
      const dbMedMap = new Map(dbMeds.map((m) => [m.id, m]))
      const removedInsuredMed = dbMeds.some(
        (dbMed) =>
          dbMed.is_insured &&
          dbMed.approval_status !== 'rejected' &&
          !namedMeds.find((m) => m.id === dbMed.id),
      )
      const addedInsuredMed = namedMeds.some((m) => m.isNew && m.is_insured)
      const changedInsuredMed = namedMeds.some((m) => {
        if (m.isNew) return false
        const orig = dbMedMap.get(m.id)
        if (!orig) return false
        if (orig.is_insured || m.is_insured) {
          if (orig.is_insured !== m.is_insured) return true
          if (orig.unit_price !== m.unit_price) return true
          if (orig.quantity !== m.quantity) {
            const approvedQty = orig.approved_qty ?? orig.quantity
            if (m.quantity < approvedQty) return true
            return false
          }
        }
        return false
      })
      needsInsuranceReapproval =
        removedInsuredMed || addedInsuredMed || changedInsuredMed
    }

    const existingMedIds = namedMeds.filter((m) => !m.isNew).map((m) => m.id)
    const allDbMeds = (order.medications ?? []) as { id: string }[]
    const removedIds = allDbMeds
      .map((m) => m.id)
      .filter((dbId) => !existingMedIds.includes(dbId))
    if (removedIds.length > 0)
      await supabase.from('medications').delete().in('id', removedIds)

    for (const med of namedMeds) {
      if (med.isNew) {
        await supabase
          .from('medications')
          .insert({
            order_id: order.id,
            name: med.name.trim(),
            dosage: med.dosage.trim() || null,
            quantity: med.quantity,
            unit_price: med.unit_price,
            is_insured: med.is_insured,
            in_stock: med.in_stock,
            is_delivery: false,
            days: med.days ?? null,
            freq_per_day: med.freq_per_day ?? null,
          })
      } else {
        const existingApprovedQty = med.approved_qty ?? null
        const clampedApprovedQty =
          existingApprovedQty != null
            ? Math.min(existingApprovedQty, med.quantity)
            : null
        const newApprovalStatus: string | null = (() => {
          if (!med.is_insured || clampedApprovedQty == null)
            return med.approval_status ?? null
          if (clampedApprovedQty === med.quantity) return 'approved'
          if (clampedApprovedQty === 0) return 'rejected'
          return 'partial'
        })()
        await supabase
          .from('medications')
          .update({
            dosage: med.dosage.trim() || null,
            quantity: med.quantity,
            unit_price: med.unit_price,
            is_insured: med.is_insured,
            in_stock: med.in_stock,
            days: med.days ?? null,
            freq_per_day: med.freq_per_day ?? null,
            ...(existingApprovedQty != null
              ? {
                  approved_qty: clampedApprovedQty,
                  approval_status: newApprovalStatus,
                }
              : {}),
          })
          .eq('id', med.id)
      }
    }

    const calcSubtotal = namedMeds
      .filter((m) => m.in_stock)
      .reduce((s, m) => s + m.unit_price * m.quantity, 0)
    const insuredMedAmount = namedMeds
      .filter((m) => m.is_insured && m.in_stock)
      .reduce((s, m) => s + m.unit_price * m.quantity, 0)
    const cashMedAmount = namedMeds
      .filter((m) => !m.is_insured && m.in_stock)
      .reduce((s, m) => s + m.unit_price * m.quantity, 0)
    const isCashOrder = order.cash_only === true
    const deliveryFeeCalc = order.no_rider ? 0 : DELIVERY_FEE
    const insuredAmount = insuredMedAmount
    const cashAmount = cashMedAmount
    const totalAmount = isCashOrder
      ? cashMedAmount + deliveryFeeCalc
      : cashMedAmount

    const newStatus: string = (() => {
      if (isCashOrder) return 'awaiting_confirmation'
      if (wasInsuranceApproved)
        return needsInsuranceReapproval
          ? 'pricing_ready'
          : 'awaiting_confirmation'
      return 'pricing_ready'
    })()

    const orderUpdatePayload: Record<string, unknown> = {
      subtotal: calcSubtotal,
      insured_amount: insuredAmount,
      cash_amount: cashAmount,
      delivery_fee: 0,
      total_amount: totalAmount,
      delivery_skipped: order.no_rider ?? false,
      status: newStatus,
      price_revision_count: (order.price_revision_count ?? 0) + 1,
      diagnosis: diagnosis.trim() || null,
      updated_at: new Date().toISOString(),
    }

    if (needsInsuranceReapproval) {
      orderUpdatePayload.insurance_approval_ref = null
      orderUpdatePayload.insurance_approved_by_name = null
      orderUpdatePayload.insurance_approved_at = null
      orderUpdatePayload.insurance_approval_snapshot = null
      orderUpdatePayload.needs_reapproval = true
    } else if (wasInsuranceApproved && !needsInsuranceReapproval) {
      orderUpdatePayload.needs_reapproval = false
    }

    const { error: orderErr } = await supabase
      .from('orders')
      .update(orderUpdatePayload)
      .eq('id', order.id)
    if (orderErr) {
      notifications.show({
        title: 'Error saving',
        message: orderErr.message,
        color: 'red',
      })
      setSavingPricing(false)
      return
    }

    const historyNotes = (() => {
      if (isCashOrder) return 'Pricing set (cash order)'
      if (wasInsuranceApproved && needsInsuranceReapproval)
        return 'Insured items modified — sent back to insurance for re-approval'
      if (wasInsuranceApproved && !needsInsuranceReapproval)
        return 'Cash items updated — sent directly to customer (insurance approval unchanged)'
      return 'Pricing set — sent to insurance for approval'
    })()

    await supabase
      .from('order_status_history')
      .insert({
        order_id: order.id,
        status: newStatus,
        changed_by_role: 'pharmacist',
        notes: historyNotes,
      })

    notifications.show({
      title: needsInsuranceReapproval
        ? '⚠️ Sent to Insurance'
        : '✅ Pricing saved',
      message: (() => {
        if (isCashOrder) return 'Customer notified to review and confirm.'
        if (wasInsuranceApproved && needsInsuranceReapproval)
          return 'Insured items changed — sent back to insurance for re-approval.'
        if (wasInsuranceApproved && !needsInsuranceReapproval)
          return 'Only cash items changed — customer notified directly. Insurance approval preserved.'
        return 'Sent to insurance for approval.'
      })(),
      color: needsInsuranceReapproval ? 'orange' : 'teal',
    })
    setSavingPricing(false)
    fetchOrder()
  }

  const updateStatus = async (
    status: OrderStatus,
    reason?: string,
  ): Promise<void> => {
    if (!order) return
    setSavingStatus(status)
    const { error: updateErr } = await supabase
      .from('orders')
      .update({
        status,
        ...(reason ? { cancellation_reason: reason } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('id', order.id)
    if (updateErr) {
      notifications.show({
        title: 'Failed to update status',
        message: updateErr.message,
        color: 'red',
      })
      setSavingStatus(null)
      return
    }
    const updatedOrder: DbOrder = {
      ...order,
      status,
      ...(reason ? { cancellation_reason: reason } : {}),
    }
    if (reason && (status === 'rejected' || status === 'cancelled')) {
      await supabase.rpc('notify_customer', {
        p_user_id: order.user_id,
        p_type: 'order_status_update',
        p_title: status === 'rejected' ? 'Order Rejected' : 'Order Cancelled',
        p_body: `Order #${order.order_number} ${status === 'rejected' ? 'was rejected' : 'was cancelled'}. Reason: ${reason}`,
        p_order_id: order.id,
      })
    } else {
      await sendCustomerNotification(status, updatedOrder)
    }
    notifications.show({
      title: 'Status updated',
      message: statusLabel(status, order?.payment_method),
      color: 'teal',
    })
    setSavingStatus(null)
    fetchOrder()
  }

  const verifyWalkinOtp = async (): Promise<void> => {
    if (!order || !walkinOtpInput.trim()) return
    setVerifyingWalkinOtp(true)
    setWalkinOtpError(null)
    const { data, error } = await supabase.rpc('verify_delivery_otp', {
      p_order_id: order.id,
      p_otp: walkinOtpInput.trim(),
    })
    setVerifyingWalkinOtp(false)
    if (error || !(data as { success: boolean }).success) {
      setWalkinOtpError(
        (data as { error?: string } | null)?.error ??
          error?.message ??
          'Invalid OTP — please check and try again.',
      )
      return
    }
    notifications.show({
      title: '✅ Walk-in handover confirmed',
      message: 'OTP verified. Order marked as delivered.',
      color: 'teal',
    })
    setWalkinOtpModalOpen(false)
    setWalkinOtpInput('')
    await supabase
      .from('order_status_history')
      .insert({
        order_id: order.id,
        status: 'delivered',
        changed_by_role: 'pharmacist',
        notes: 'Walk-in handover — OTP verified by pharmacist at counter',
      })
    fetchOrder()
  }

  const confirmDispatch = async (): Promise<void> => {
    if (!order || !selectedRider) {
      notifications.show({
        title: 'Select a rider',
        message: 'Choose a rider or broadcast before dispatching.',
        color: 'orange',
      })
      return
    }
    setAssigning(true)
    const isNoRider = selectedRider === '__no_rider__'
    const isBroadcast = selectedRider === '__broadcast__'

    if (isNoRider) {
      await supabase
        .from('orders')
        .update({
          no_rider: true,
          rider_declined_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.id)
      await updateStatus('out_for_delivery' as OrderStatus)
      notifications.show({
        title: '✅ Walk-in confirmed',
        message: 'Order is out for delivery — no rider assigned.',
        color: 'violet',
      })
      setAssigning(false)
      setSelectedRider(null)
      fetchDeliveryData()
      return
    }

    const staffToNotify = isBroadcast
      ? deliveryStaff
      : deliveryStaff.filter((s) => s.id === selectedRider)
    if (!staffToNotify.length) {
      notifications.show({
        title: 'No riders available',
        message: 'No active delivery staff found.',
        color: 'orange',
      })
      setAssigning(false)
      return
    }

    const { error: reqErr } = await supabase
      .from('delivery_requests')
      .insert(
        staffToNotify.map((s) => ({
          order_id: order.id,
          delivery_staff_id: s.id,
          sent_by: staffInfo?.id ?? null,
          status: 'pending' as DeliveryRequestStatus,
        })),
      )
    if (reqErr) {
      notifications.show({
        title: 'Error dispatching',
        message: reqErr.message,
        color: 'red',
      })
      setAssigning(false)
      return
    }

    const { error: orderUpdateErr } = await supabase
      .from('orders')
      .update({
        rider_declined_at: null,
        declined_rider_name: null,
        dispatch_is_broadcast: isBroadcast,
        broadcast_timeout_at: isBroadcast
          ? new Date(Date.now() + BROADCAST_TIMEOUT_SECS * 1000).toISOString()
          : null,
      })
      .eq('id', order.id)
    if (orderUpdateErr)
      console.error('confirmDispatch order update error:', orderUpdateErr)

    notifications.show({
      title: isBroadcast ? '📡 Broadcast sent!' : '🚴 Rider notified!',
      message: isBroadcast
        ? `${staffToNotify.length} rider(s) notified — waiting for acceptance.`
        : `${staffToNotify[0].name} has been sent the delivery request.`,
      color: 'teal',
    })
    setAssigning(false)
    setSelectedRider(null)
    fetchDeliveryData()
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

  const subtotal = meds
    .filter((m) => m.in_stock)
    .reduce((s, m) => s + m.unit_price * m.quantity, 0)
  const RIDER_ASSIGNED_STATUSES = [
    'dispatched',
    'out_for_delivery',
    'delivered',
  ]
  const riderHasAccepted =
    RIDER_ASSIGNED_STATUSES.includes(order.status) ||
    deliveryRequests.some((r) => r.status === 'accepted')
  const deliveryFee = order.no_rider ? 0 : riderHasAccepted ? DELIVERY_FEE : 0
  const isCashOrder = order.cash_only === true

  const insuredMedAmountPreview = meds
    .filter((m) => m.is_insured && m.in_stock)
    .reduce((s, m) => {
      const approvedQty = m.approved_qty ?? m.quantity
      return s + m.unit_price * approvedQty
    }, 0)
  const cashMedAmountPreview = meds
    .filter((m) => m.in_stock)
    .reduce((s, m) => {
      if (!m.is_insured) return s + m.unit_price * m.quantity
      const approvedQty = m.approved_qty ?? m.quantity
      return s + m.unit_price * (m.quantity - approvedQty)
    }, 0)
  const grandTotal = isCashOrder
    ? cashMedAmountPreview + deliveryFee
    : cashMedAmountPreview
  const deliverySkippedLocal = !!order.no_rider

  const canSetPricing =
    order.status === 'pharmacy_review' ||
    order.status === 'pricing_ready' ||
    order.status === 'awaiting_confirmation'
  const pricingSummaryVisible = ![
    'prescription_uploaded',
    'insurance_verification',
    'pharmacy_review',
  ].includes(order.status)
  const allDeclinedOrExpired =
    deliveryRequests.length > 0 &&
    deliveryRequests.every(
      (r) => r.status === 'declined' || r.status === 'expired',
    )
  const hasAcceptedRider = deliveryRequests.some((r) => r.status === 'accepted')
  const isManualDispatch = order.dispatch_is_broadcast === false
  const manualRiderDeclined =
    order.status === 'packing' &&
    !!order.rider_declined_at &&
    isManualDispatch &&
    !!order.declined_rider_name
  const broadcastAllDeclined =
    order.status === 'packing' &&
    !!order.rider_declined_at &&
    order.dispatch_is_broadcast === true
  const riderJustDeclined = manualRiderDeclined || broadcastAllDeclined
  const showBroadcastCountdown =
    order.status === 'packing' &&
    order.dispatch_is_broadcast === true &&
    !hasAcceptedRider &&
    !order.rider_declined_at &&
    broadcastSecsLeft !== null &&
    broadcastSecsLeft > 0
  const showAssignPanel = order.status === 'packing'

  // ── Smart routing detection (for sidebar preview) ───────────────────────────
  const getInsuredChanged = (): boolean => {
    if (!order.insurance_approval_ref || order.cash_only) return false
    const dbMeds = (order.medications ?? []) as MedRow[]
    const dbMedMap = new Map(dbMeds.map((m) => [m.id, m]))
    return (
      dbMeds.some(
        (dbMed) =>
          dbMed.is_insured &&
          dbMed.approval_status !== 'rejected' &&
          !meds.find((m) => m.id === dbMed.id),
      ) ||
      meds.some((m) => m.isNew && m.is_insured) ||
      meds.some((m) => {
        if (m.isNew) return false
        const orig = dbMedMap.get(m.id)
        if (!orig) return false
        if (orig.is_insured || m.is_insured) {
          if (orig.is_insured !== m.is_insured) return true
          if (orig.unit_price !== m.unit_price) return true
          if (orig.quantity !== m.quantity)
            return m.quantity < (orig.approved_qty ?? orig.quantity)
        }
        return false
      })
    )
  }
  const insuredChanged = getInsuredChanged()

  return (
    <PharmacySidebarLayout>
      <PortalPageWrap>
        <PageContainer>
          {/* ══ ORDER HERO ══ */}
          <OrderHero>
            <HeroTopStrip>
              <Button
                variant="subtle"
                color="lotusCyan"
                leftSection={<TbArrowLeft size={14} />}
                onClick={() => navigate('/pharmacy/dashboard')}
                size="xs"
                style={{ marginLeft: -6 }}
              >
                Back to Dashboard
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
                >
                  Order
                </Text>
                <Text
                  size="xs"
                  fw={700}
                  c="lotusCyan"
                  style={{ fontFamily: 'monospace', letterSpacing: '0.5px' }}
                >
                  #{order.id.slice(0, 8).toUpperCase()}
                </Text>
              </Group>
            </HeroTopStrip>

            <HeroGrid>
              {/* Patient */}
              <HeroCell $border>
                <HeroLabel>Patient</HeroLabel>
                <Text
                  fw={700}
                  size="md"
                  mb={3}
                >
                  {(order.profiles as { name?: string } | null)?.name ?? '—'}
                </Text>
                {(order.profiles as { relationship?: string } | null)
                  ?.relationship && (
                  <Text
                    size="xs"
                    c="dimmed"
                    mb={5}
                  >
                    {
                      (order.profiles as { relationship?: string } | null)
                        ?.relationship
                    }
                  </Text>
                )}
                {(order.profiles as { is_chronic?: boolean } | null)
                  ?.is_chronic && (
                  <Badge
                    size="xs"
                    color="red"
                    variant="light"
                    leftSection={<TbUser size={10} />}
                  >
                    Chronic patient
                  </Badge>
                )}
              </HeroCell>

              {/* Status */}
              <HeroCell $border>
                <HeroLabel>Order Status</HeroLabel>
                <Badge
                  color={statusColor(order.status)}
                  size="lg"
                  mb={7}
                >
                  {statusLabel(order.status, order.payment_method)}
                </Badge>
                {order.created_at && (
                  <Group gap={5}>
                    <TbCalendar
                      size={12}
                      color="var(--mantine-color-dimmed)"
                    />
                    <Text
                      size="xs"
                      c="dimmed"
                    >
                      {new Date(order.created_at).toLocaleDateString('en-UG', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </Text>
                  </Group>
                )}
              </HeroCell>

              {/* Payment / Insurance */}
              <HeroCell>
                <HeroLabel>Payment Type</HeroLabel>
                {order.cash_only ? (
                  <Group
                    gap={6}
                    mb={4}
                  >
                    <TbCurrencyDollar
                      size={15}
                      color="#D97706"
                    />
                    <Badge
                      color="orange"
                      variant="light"
                      size="md"
                    >
                      Cash Only
                    </Badge>
                  </Group>
                ) : (
                  <>
                    <Group
                      gap={6}
                      mb={6}
                    >
                      {insuranceVerified ? (
                        <TbShieldCheck
                          size={15}
                          color="#12B76A"
                        />
                      ) : (
                        <TbShieldOff
                          size={15}
                          color={
                            insuranceStatus === 'rejected'
                              ? '#EF4444'
                              : 'var(--mantine-color-dimmed)'
                          }
                        />
                      )}
                      <Badge
                        color={
                          insuranceVerified
                            ? 'teal'
                            : insuranceStatus === 'pending'
                              ? 'yellow'
                              : insuranceStatus === 'rejected'
                                ? 'red'
                                : 'gray'
                        }
                        variant="light"
                        size="sm"
                      >
                        Insurance · {insuranceStatus}
                      </Badge>
                    </Group>
                    {profileInsurance?.provider && (
                      <Stack gap={2}>
                        <Text
                          size="xs"
                          c="dimmed"
                        >
                          {profileInsurance.provider}
                          {profileInsurance.scheme_name
                            ? ` · ${profileInsurance.scheme_name}`
                            : ''}
                        </Text>
                        {profileInsurance.policy_number && (
                          <Text
                            size="xs"
                            c="dimmed"
                            fw={500}
                          >
                            Policy: {profileInsurance.policy_number}
                          </Text>
                        )}
                        {profileInsurance.policy_holder_name && (
                          <Text
                            size="xs"
                            c="dimmed"
                          >
                            Holder: {profileInsurance.policy_holder_name}
                          </Text>
                        )}
                        {order.insurance_approval_ref && (
                          <Text
                            size="xs"
                            c="teal"
                            fw={700}
                            mt={2}
                          >
                            Ref: {order.insurance_approval_ref}
                          </Text>
                        )}
                        {insuranceProviderPhone && (
                          <Group
                            gap={4}
                            mt={3}
                          >
                            <TbPhone
                              size={11}
                              color="var(--mantine-color-blue-6)"
                            />
                            <Text
                              size="xs"
                              fw={600}
                              c="dimmed"
                              component="a"
                              href={`tel:${insuranceProviderPhone}`}
                              style={{ textDecoration: 'none' }}
                            >
                              {insuranceProviderPhone}
                            </Text>
                          </Group>
                        )}
                      </Stack>
                    )}
                  </>
                )}
              </HeroCell>
            </HeroGrid>
          </OrderHero>

          {/* ══ MAIN TWO-COLUMN LAYOUT ══ */}
          <TwoColumnGrid>
            {/* ── LEFT COLUMN ─────────────────────────────────────────────── */}
            <MainColumn>
              {/* Order Details Card */}
              {(order.delivery_address_snapshot ||
                order.no_rider ||
                order.created_at ||
                order.contact_phone) && (
                <Card>
                  <CardHeader>
                    <TbTruck
                      size={14}
                      color="#0891B2"
                    />
                    <CardHeaderTitle>Order Details</CardHeaderTitle>
                  </CardHeader>
                  <CardBody>
                    {order.created_at && (
                      <DetailRow>
                        <DetailIcon>
                          <TbClock
                            size={14}
                            color="#0891B2"
                          />
                        </DetailIcon>
                        <div>
                          <DetailLabel>Placed</DetailLabel>
                          <Text
                            size="sm"
                            fw={600}
                          >
                            {new Date(order.created_at).toLocaleString(
                              'en-UG',
                              {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              },
                            )}
                          </Text>
                        </div>
                      </DetailRow>
                    )}
                    {order.delivery_address_snapshot ? (
                      <DetailRow>
                        <DetailIcon>
                          <TbMapPin
                            size={14}
                            color="#0891B2"
                          />
                        </DetailIcon>
                        <div>
                          <DetailLabel>Delivery Address</DetailLabel>
                          {(
                            order.delivery_address_snapshot as {
                              label?: string
                            }
                          ).label && (
                            <Text
                              size="sm"
                              fw={700}
                            >
                              {
                                (
                                  order.delivery_address_snapshot as {
                                    label?: string
                                  }
                                ).label
                              }
                            </Text>
                          )}
                          {(
                            order.delivery_address_snapshot as {
                              street?: string
                            }
                          ).street && (
                            <Text size="sm">
                              {
                                (
                                  order.delivery_address_snapshot as {
                                    street?: string
                                  }
                                ).street
                              }
                            </Text>
                          )}
                          {((
                            order.delivery_address_snapshot as { city?: string }
                          ).city ||
                            (
                              order.delivery_address_snapshot as {
                                zone?: string
                              }
                            ).zone) && (
                            <Text
                              size="xs"
                              c="dimmed"
                            >
                              {[
                                (
                                  order.delivery_address_snapshot as {
                                    city?: string
                                  }
                                ).city,
                                (
                                  order.delivery_address_snapshot as {
                                    zone?: string
                                  }
                                ).zone,
                              ]
                                .filter(Boolean)
                                .join(', ')}
                            </Text>
                          )}
                          {(
                            order.delivery_address_snapshot as {
                              instructions?: string
                            }
                          ).instructions && (
                            <Text
                              size="xs"
                              c="dimmed"
                              fs="italic"
                              mt={2}
                            >
                              {
                                (
                                  order.delivery_address_snapshot as {
                                    instructions?: string
                                  }
                                ).instructions
                              }
                            </Text>
                          )}
                        </div>
                      </DetailRow>
                    ) : order.no_rider ? (
                      <DetailRow>
                        <DetailIcon>
                          <TbMapPin
                            size={14}
                            color="#0891B2"
                          />
                        </DetailIcon>
                        <div>
                          <DetailLabel>Delivery</DetailLabel>
                          <Badge
                            size="sm"
                            color="violet"
                            variant="light"
                          >
                            In-store pickup
                          </Badge>
                        </div>
                      </DetailRow>
                    ) : null}
                    {order.contact_phone && (
                      <DetailRow>
                        <DetailIcon>
                          <TbPhone
                            size={14}
                            color="#0891B2"
                          />
                        </DetailIcon>
                        <div>
                          <DetailLabel>Contact</DetailLabel>
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
                        </div>
                      </DetailRow>
                    )}
                  </CardBody>
                </Card>
              )}

              {/* Insurance Status Alerts */}
              {order.cash_only ? (
                <Alert
                  color="orange"
                  icon={<TbCurrencyDollar size={15} />}
                >
                  <Text
                    size="sm"
                    fw={600}
                  >
                    Cash-only order — insurance verification skipped
                  </Text>
                  <Text
                    size="xs"
                    mt={2}
                  >
                    The customer chose to pay in full. All medications must be
                    priced as cash pay.
                  </Text>
                </Alert>
              ) : (
                <>
                  {insuranceStatus === 'pending' && (
                    <Alert
                      color="yellow"
                      icon={<TbAlertCircle size={15} />}
                    >
                      <Text
                        size="sm"
                        fw={600}
                      >
                        Insurance under review by support
                      </Text>
                      <Text
                        size="xs"
                        mt={2}
                      >
                        You cannot apply insurance coverage until verification
                        is complete.
                      </Text>
                    </Alert>
                  )}
                  {insuranceStatus === 'rejected' && (
                    <Alert
                      color="red"
                      icon={<TbShieldOff size={15} />}
                    >
                      <Text
                        size="sm"
                        fw={600}
                      >
                        Insurance rejected — all medications are cash pay
                      </Text>
                    </Alert>
                  )}
                  {insuranceStatus === 'none' && (
                    <Alert
                      color="gray"
                      icon={<TbShieldOff size={15} />}
                    >
                      <Text
                        size="sm"
                        fw={600}
                      >
                        No insurance on file — full cash payment applies
                      </Text>
                    </Alert>
                  )}
                  {(order as DbOrder & { needs_reapproval?: boolean })
                    .needs_reapproval && (
                    <Alert
                      color="red"
                      icon={<TbAlertCircle size={15} />}
                      style={{
                        borderWidth: 2,
                        borderColor: 'rgba(239,68,68,0.3)',
                      }}
                    >
                      <Text
                        size="sm"
                        fw={700}
                        c="red.8"
                      >
                        Re-approval Required
                      </Text>
                      <Text
                        size="xs"
                        mt={2}
                      >
                        Insured items were changed after insurance approval.
                        This order must be resubmitted to insurance before the
                        customer can confirm.
                      </Text>
                    </Alert>
                  )}
                </>
              )}

              {/* Medicine Names (text-only order) */}
              {!prescriptionSignedUrl && order.medicine_names && (
                <Card>
                  <CardHeader>
                    <TbNotes
                      size={14}
                      color="#0891B2"
                    />
                    <CardHeaderTitle>Medicine Order (Text)</CardHeaderTitle>
                    <Badge
                      color="orange"
                      variant="light"
                      size="sm"
                      leftSection={<TbNotes size={11} />}
                    >
                      No image
                    </Badge>
                  </CardHeader>
                  <CardBody>
                    <Box
                      style={{
                        background: 'rgba(251,146,60,0.1)',
                        border: '2px solid rgba(251,146,60,0.5)',
                        borderRadius: 10,
                        padding: '13px 15px',
                      }}
                    >
                      <Text
                        size="xs"
                        fw={700}
                        c="orange.8"
                        mb={5}
                        style={{
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                        }}
                      >
                        Medicines requested by customer
                      </Text>
                      <Text
                        size="sm"
                        fw={600}
                        c="orange.9"
                        lh={1.7}
                        style={{ whiteSpace: 'pre-wrap' }}
                      >
                        {order.medicine_names}
                      </Text>
                    </Box>
                    {(order as { prescription_notes?: string })
                      .prescription_notes && (
                      <Box
                        mt={12}
                        style={{
                          display: 'flex',
                          gap: 12,
                          padding: '13px 15px',
                          borderRadius: 10,
                          border: '2px solid rgba(59,130,246,0.4)',
                          background: 'rgba(59,130,246,0.05)',
                        }}
                      >
                        <Box
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 9,
                            flexShrink: 0,
                            background:
                              'linear-gradient(135deg,#3b82f6,#1d4ed8)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <TbNotes
                            size={18}
                            color="#fff"
                          />
                        </Box>
                        <div>
                          <Group
                            gap={6}
                            mb={4}
                          >
                            <Text
                              size="sm"
                              fw={700}
                              c="blue.7"
                            >
                              Patient Note
                            </Text>
                            <Badge
                              color="blue"
                              variant="filled"
                              size="xs"
                            >
                              From Customer
                            </Badge>
                          </Group>
                          <Text
                            size="sm"
                            fw={600}
                            lh={1.6}
                          >
                            {
                              (order as { prescription_notes?: string })
                                .prescription_notes
                            }
                          </Text>
                        </div>
                      </Box>
                    )}
                  </CardBody>
                </Card>
              )}

              {/* Prescription Image */}
              {prescriptionSignedUrl && (
                <Card>
                  <CardHeader>
                    <TbNotes
                      size={14}
                      color="#0891B2"
                    />
                    <CardHeaderTitle>
                      {order.medicine_names
                        ? 'Prescription + Medicine Names'
                        : 'Prescription'}
                    </CardHeaderTitle>
                  </CardHeader>
                  <CardBody>
                    {order.medicine_names && (
                      <Box
                        mb={12}
                        style={{
                          background: 'rgba(251,146,60,0.1)',
                          border: '2px solid rgba(251,146,60,0.5)',
                          borderRadius: 10,
                          padding: '12px 14px',
                        }}
                      >
                        <Text
                          size="xs"
                          fw={700}
                          c="orange.8"
                          mb={4}
                          style={{
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                          }}
                        >
                          Customer also typed
                        </Text>
                        <Text
                          size="sm"
                          fw={600}
                          c="orange.9"
                          lh={1.7}
                          style={{ whiteSpace: 'pre-wrap' }}
                        >
                          {order.medicine_names}
                        </Text>
                      </Box>
                    )}
                    {(order as { prescription_notes?: string })
                      .prescription_notes && (
                      <Box
                        mb={12}
                        style={{
                          display: 'flex',
                          gap: 12,
                          padding: '13px 15px',
                          borderRadius: 10,
                          border: '2px solid rgba(59,130,246,0.4)',
                          background: 'rgba(59,130,246,0.05)',
                        }}
                      >
                        <Box
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 9,
                            flexShrink: 0,
                            background:
                              'linear-gradient(135deg,#3b82f6,#1d4ed8)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <TbNotes
                            size={18}
                            color="#fff"
                          />
                        </Box>
                        <div>
                          <Group
                            gap={6}
                            mb={4}
                          >
                            <Text
                              size="sm"
                              fw={700}
                              c="blue.7"
                            >
                              Patient Note
                            </Text>
                            <Badge
                              color="blue"
                              variant="filled"
                              size="xs"
                            >
                              From Customer
                            </Badge>
                          </Group>
                          <Text
                            size="sm"
                            fw={600}
                            lh={1.6}
                          >
                            {
                              (order as { prescription_notes?: string })
                                .prescription_notes
                            }
                          </Text>
                        </div>
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

              {/* Insurance Rejection Banner */}
              {order.status === 'pharmacy_review' &&
                (order as { rejection_reason?: string }).rejection_reason && (
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
                          Insurance Rejected — Revision Required
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
                        {
                          (order as { rejection_reason?: string })
                            .rejection_reason
                        }
                      </Text>
                      <Text
                        size="xs"
                        c="red.7"
                        mt={8}
                        fw={600}
                      >
                        Review the reason above, update the pricing, then
                        re-save to resubmit to insurance.
                      </Text>
                    </div>
                  </AlertBanner>
                )}

              {/* Customer change request Banner */}
              {order.pharmacy_notes?.startsWith(
                '[Customer requested changes]:',
              ) && (
                <AlertBanner $color="amber">
                  <BannerIcon $color="linear-gradient(135deg,#f59e0b,#d97706)">
                    <TbMessageCircle
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
                        c="yellow.8"
                      >
                        Customer Requested Changes
                      </Text>
                      <Badge
                        color="orange"
                        variant="filled"
                        size="xs"
                      >
                        Action Required
                      </Badge>
                    </Group>
                    <Text
                      size="sm"
                      fw={600}
                      c="yellow.9"
                      lh={1.6}
                      style={{
                        background: 'rgba(255,255,255,0.6)',
                        borderRadius: 8,
                        padding: '8px 12px',
                        border: '1px solid rgba(245,158,11,0.25)',
                      }}
                    >
                      {order.pharmacy_notes.replace(
                        '[Customer requested changes]: ',
                        '',
                      )}
                    </Text>
                    <Text
                      size="xs"
                      c="yellow.8"
                      mt={8}
                      fw={600}
                    >
                      Review the pricing below and update accordingly, then
                      re-save to notify the customer.
                    </Text>
                  </div>
                </AlertBanner>
              )}

              {/* Insurance Approval Card */}
              {order.insurance_approval_ref && (
                <Box
                  p="md"
                  style={{
                    background: 'var(--mantine-color-body)',
                    borderRadius: 12,
                    border: '1.5px solid rgba(16,185,129,0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                  }}
                >
                  <Box
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      background: 'linear-gradient(135deg,#10b981,#059669)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <TbShieldCheck
                      size={18}
                      color="#fff"
                    />
                  </Box>
                  <Box style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      size="xs"
                      c="dimmed"
                      fw={600}
                      style={{
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}
                    >
                      Insurance Approval
                    </Text>
                    <Text
                      size="sm"
                      fw={800}
                      c="teal.8"
                      style={{ letterSpacing: '0.04em' }}
                    >
                      {order.insurance_approval_ref}
                    </Text>
                    {(order as { insurance_approved_by_name?: string })
                      .insurance_approved_by_name && (
                      <Text
                        size="xs"
                        c="dimmed"
                        mt={2}
                      >
                        Approved by{' '}
                        {
                          (order as { insurance_approved_by_name?: string })
                            .insurance_approved_by_name
                        }
                        {(order as { insurance_approved_by_phone?: string })
                          .insurance_approved_by_phone
                          ? ` · ${(order as { insurance_approved_by_phone?: string }).insurance_approved_by_phone}`
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

              {/* ── Medications & Pricing Card ── */}
              <Card>
                <CardHeader>
                  <TbPackage
                    size={14}
                    color="#0891B2"
                  />
                  <CardHeaderTitle>Medications &amp; Pricing</CardHeaderTitle>
                  {order.cash_only ? (
                    <Badge
                      color="orange"
                      variant="light"
                      size="sm"
                      leftSection={<TbCurrencyDollar size={11} />}
                    >
                      Cash-only
                    </Badge>
                  ) : insuranceVerified ? (
                    <Badge
                      color="teal"
                      variant="light"
                      size="sm"
                      leftSection={<TbShieldCheck size={11} />}
                    >
                      Insurance verified
                    </Badge>
                  ) : (
                    <Badge
                      color="orange"
                      variant="light"
                      size="sm"
                      leftSection={<TbShieldOff size={11} />}
                    >
                      Unverified insurance
                    </Badge>
                  )}
                </CardHeader>
                <CardBody>
                  {/* Diagnosis */}
                  <Box mb="md">
                    {canSetPricing ? (
                      <Autocomplete
                        label="Diagnosis"
                        placeholder="Search and select a diagnosis…"
                        data={DIAGNOSES}
                        value={diagnosis}
                        onChange={setDiagnosis}
                        limit={12}
                        maxDropdownHeight={260}
                        leftSection={<TbNotes size={14} />}
                        styles={{
                          input: { fontWeight: 600 },
                          label: { fontWeight: 700, marginBottom: 4 },
                        }}
                      />
                    ) : order.diagnosis ? (
                      <Group gap={8}>
                        <TbNotes
                          size={14}
                          color="#0891B2"
                        />
                        <Text
                          size="sm"
                          c="dimmed"
                          fw={600}
                        >
                          Diagnosis:
                        </Text>
                        <Badge
                          color="blue"
                          variant="light"
                          size="md"
                        >
                          {order.diagnosis}
                        </Badge>
                      </Group>
                    ) : null}
                  </Box>

                  {meds.length === 0 && canSetPricing && (
                    <Alert
                      color="blue"
                      variant="light"
                      icon={<TbAlertCircle size={13} />}
                      mb="md"
                    >
                      <Text size="sm">
                        {order.medicine_names
                          ? "No medications added yet. Use the customer's typed medicine list above to add and price each item."
                          : 'No medications yet. Add medications from the prescription above.'}
                      </Text>
                    </Alert>
                  )}

                  {/* Medication Table */}
                  <MedTableWrap>
                    <Table
                      striped={false}
                      highlightOnHover={false}
                      withRowBorders={false}
                      style={{ tableLayout: 'fixed' }}
                    >
                      <Table.Thead
                        style={{
                          background: 'rgba(8,145,178,0.04)',
                          borderBottom:
                            '1px solid var(--mantine-color-default-border)',
                        }}
                      >
                        <Table.Tr>
                          <THead>Medication</THead>
                          <THead>Dosage</THead>
                          <THead>Days</THead>
                          <THead>Freq/day</THead>
                          <THead>Qty</THead>
                          <THead>Unit Price (UGX)</THead>
                          <THead>Coverage</THead>
                          <THead>Subtotal</THead>
                          {canSetPricing && <THead />}
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {meds.map((med) => {
                          const isEditing = editingId === med.id
                          return (
                            <MedTableRow
                              key={med.id}
                              $editing={isEditing}
                              style={{ opacity: med.in_stock ? 1 : 0.5 }}
                            >
                              <TCell>
                                {isEditing && med.isNew && !med.is_delivery ? (
                                  <TextInput
                                    value={med.name}
                                    onChange={(e) =>
                                      updateName(med.id, e.target.value)
                                    }
                                    placeholder="Medication name"
                                    size="xs"
                                    style={{ width: 160 }}
                                  />
                                ) : (
                                  <Group gap={4}>
                                    <Text
                                      size="sm"
                                      fw={600}
                                    >
                                      {med.name}
                                    </Text>
                                    {med.is_delivery && (
                                      <Badge
                                        size="xs"
                                        color="cyan"
                                        variant="light"
                                      >
                                        Delivery
                                      </Badge>
                                    )}
                                  </Group>
                                )}
                              </TCell>
                              <TCell>
                                {isEditing ? (
                                  <TextInput
                                    value={med.dosage}
                                    onChange={(e) =>
                                      updateDosage(med.id, e.target.value)
                                    }
                                    placeholder="e.g. 500mg"
                                    size="xs"
                                    style={{ width: 90 }}
                                  />
                                ) : (
                                  <Text
                                    size="sm"
                                    c="dimmed"
                                  >
                                    {med.dosage || '—'}
                                  </Text>
                                )}
                              </TCell>
                              <TCell>
                                {isEditing ? (
                                  <NumberInput
                                    value={med.days ?? ''}
                                    onChange={(val) =>
                                      updateDays(
                                        med.id,
                                        val !== '' ? Number(val) : null,
                                      )
                                    }
                                    min={1}
                                    placeholder="—"
                                    size="xs"
                                    style={{ width: 65 }}
                                  />
                                ) : (
                                  <Text
                                    size="sm"
                                    c="dimmed"
                                  >
                                    {med.days ?? '—'}
                                  </Text>
                                )}
                              </TCell>
                              <TCell>
                                {isEditing ? (
                                  <NumberInput
                                    value={med.freq_per_day ?? ''}
                                    onChange={(val) =>
                                      updateFreq(
                                        med.id,
                                        val !== '' ? Number(val) : null,
                                      )
                                    }
                                    min={1}
                                    placeholder="—"
                                    size="xs"
                                    style={{ width: 65 }}
                                  />
                                ) : (
                                  <Text
                                    size="sm"
                                    c="dimmed"
                                  >
                                    {med.freq_per_day ?? '—'}
                                  </Text>
                                )}
                              </TCell>
                              <TCell>
                                {isEditing ? (
                                  <NumberInput
                                    value={med.quantity}
                                    onChange={(val) =>
                                      updateQty(med.id, Number(val) || 1)
                                    }
                                    min={1}
                                    size="xs"
                                    style={{ width: 70 }}
                                  />
                                ) : (
                                  <Text size="sm">{med.quantity}</Text>
                                )}
                              </TCell>
                              <TCell>
                                {isEditing ? (
                                  <NumberInput
                                    value={med.unit_price}
                                    onChange={(val) =>
                                      updatePrice(med.id, Number(val) || 0)
                                    }
                                    min={0}
                                    step={500}
                                    size="xs"
                                    style={{ width: 120 }}
                                  />
                                ) : (
                                  <Text size="sm">
                                    {med.unit_price.toLocaleString()}
                                  </Text>
                                )}
                              </TCell>
                              <TCell>
                                {isEditing ? (
                                  <Tooltip
                                    label="Cash-only order — insurance not applicable"
                                    disabled={!order.cash_only}
                                  >
                                    <span>
                                      <Button
                                        size="xs"
                                        variant={
                                          med.is_insured ? 'filled' : 'outline'
                                        }
                                        color={med.is_insured ? 'teal' : 'gray'}
                                        disabled={order.cash_only}
                                        onClick={() =>
                                          toggleInsured(med.id, !med.is_insured)
                                        }
                                        leftSection={
                                          med.is_insured ? (
                                            <TbShieldCheck size={11} />
                                          ) : (
                                            <TbShieldOff size={11} />
                                          )
                                        }
                                      >
                                        {med.is_insured
                                          ? 'Insured'
                                          : 'Cash Pay'}
                                      </Button>
                                    </span>
                                  </Tooltip>
                                ) : !med.is_insured ? (
                                  <Badge
                                    size="xs"
                                    color="gray"
                                    variant="light"
                                  >
                                    Cash Pay
                                  </Badge>
                                ) : med.approval_status === 'approved' ? (
                                  <Badge
                                    size="xs"
                                    color="teal"
                                    variant="light"
                                    leftSection={<TbShieldCheck size={10} />}
                                  >
                                    Approved
                                  </Badge>
                                ) : med.approval_status === 'partial' ? (
                                  <Stack gap={2}>
                                    <Badge
                                      size="xs"
                                      color="orange"
                                      variant="light"
                                      leftSection={<TbShieldCheck size={10} />}
                                    >
                                      Partial
                                    </Badge>
                                    <Text
                                      size="10px"
                                      c="orange"
                                      fw={600}
                                    >
                                      {med.approved_qty}/{med.quantity} covered
                                    </Text>
                                  </Stack>
                                ) : med.approval_status === 'rejected' ||
                                  med.approved_qty === 0 ? (
                                  <Badge
                                    size="xs"
                                    color="red"
                                    variant="light"
                                    leftSection={<TbShieldOff size={10} />}
                                  >
                                    Rejected
                                  </Badge>
                                ) : (
                                  <Badge
                                    size="xs"
                                    color="teal"
                                    variant="light"
                                    leftSection={<TbShieldCheck size={10} />}
                                  >
                                    Insured
                                  </Badge>
                                )}
                              </TCell>
                              <TCell>
                                {med.is_insured ? (
                                  (() => {
                                    const aqty = med.approved_qty
                                    const status = med.approval_status
                                    if (aqty == null || status === 'pending')
                                      return (
                                        <Badge
                                          size="xs"
                                          color="teal"
                                          variant="light"
                                        >
                                          Covered
                                        </Badge>
                                      )
                                    if (status === 'approved')
                                      return (
                                        <Stack gap={2}>
                                          <Badge
                                            size="xs"
                                            color="teal"
                                            variant="light"
                                          >
                                            ✅ Fully Approved
                                          </Badge>
                                          <Text
                                            size="xs"
                                            c="teal"
                                            fw={600}
                                          >
                                            {aqty} ×{' '}
                                            {med.unit_price.toLocaleString()} =
                                            UGX{' '}
                                            {(
                                              aqty * med.unit_price
                                            ).toLocaleString()}
                                          </Text>
                                        </Stack>
                                      )
                                    if (status === 'partial') {
                                      const cashQty = med.quantity - aqty
                                      return (
                                        <Stack gap={2}>
                                          <Badge
                                            size="xs"
                                            color="orange"
                                            variant="light"
                                          >
                                            ⚠️ Partial
                                          </Badge>
                                          <Text
                                            size="xs"
                                            c="teal"
                                            fw={600}
                                          >
                                            Ins: {aqty} ×{' '}
                                            {med.unit_price.toLocaleString()} =
                                            UGX{' '}
                                            {(
                                              aqty * med.unit_price
                                            ).toLocaleString()}
                                          </Text>
                                          <Text
                                            size="xs"
                                            c="orange"
                                            fw={600}
                                          >
                                            Cash: {cashQty} ×{' '}
                                            {med.unit_price.toLocaleString()} =
                                            UGX{' '}
                                            {(
                                              cashQty * med.unit_price
                                            ).toLocaleString()}
                                          </Text>
                                          {med.coverage_notes && (
                                            <Text
                                              size="xs"
                                              c="dimmed"
                                              fs="italic"
                                            >
                                              {med.coverage_notes}
                                            </Text>
                                          )}
                                        </Stack>
                                      )
                                    }
                                    return (
                                      <Stack gap={2}>
                                        <Badge
                                          size="xs"
                                          color="red"
                                          variant="light"
                                        >
                                          ❌ Rejected
                                        </Badge>
                                        <Text
                                          size="xs"
                                          c="dimmed"
                                        >
                                          UGX{' '}
                                          {(
                                            med.unit_price * med.quantity
                                          ).toLocaleString()}{' '}
                                          → Cash
                                        </Text>
                                        {med.coverage_notes && (
                                          <Text
                                            size="xs"
                                            c="dimmed"
                                            fs="italic"
                                          >
                                            {med.coverage_notes}
                                          </Text>
                                        )}
                                      </Stack>
                                    )
                                  })()
                                ) : (
                                  <Text
                                    size="sm"
                                    fw={600}
                                  >
                                    {med.in_stock
                                      ? `UGX ${(med.unit_price * med.quantity).toLocaleString()}`
                                      : 'N/A'}
                                  </Text>
                                )}
                              </TCell>
                              {canSetPricing && (
                                <TCell>
                                  <Group
                                    gap={4}
                                    wrap="nowrap"
                                  >
                                    {isEditing ? (
                                      <Button
                                        size="xs"
                                        color="green"
                                        variant="light"
                                        onClick={() => setEditingId(null)}
                                      >
                                        Done
                                      </Button>
                                    ) : (
                                      <Button
                                        size="xs"
                                        variant="subtle"
                                        color="blue"
                                        onClick={() => setEditingId(med.id)}
                                        disabled={
                                          editingId !== null &&
                                          editingId !== med.id
                                        }
                                      >
                                        <TbPencil size={13} />
                                      </Button>
                                    )}
                                    <Button
                                      size="xs"
                                      variant="subtle"
                                      color="red"
                                      onClick={() => {
                                        if (editingId === med.id)
                                          setEditingId(null)
                                        removeMedRow(med.id)
                                      }}
                                    >
                                      <TbTrash size={13} />
                                    </Button>
                                  </Group>
                                </TCell>
                              )}
                            </MedTableRow>
                          )
                        })}
                      </Table.Tbody>
                    </Table>
                  </MedTableWrap>

                  {canSetPricing && (
                    <Group
                      gap="xs"
                      mt="sm"
                    >
                      <Button
                        variant="subtle"
                        color="lotusCyan"
                        size="sm"
                        leftSection={<TbPlus size={13} />}
                        onClick={addMedRow}
                      >
                        Add Medication
                      </Button>
                    </Group>
                  )}
                </CardBody>
              </Card>

              {/* ── Rider declined alert ── */}
              {riderJustDeclined && (
                <Card
                  style={{
                    borderColor: 'rgba(239,68,68,0.35)',
                    borderWidth: 2,
                    background: 'rgba(239,68,68,0.04)',
                  }}
                >
                  <CardBody>
                    <Group gap="md">
                      <Box
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 10,
                          flexShrink: 0,
                          background: '#ef4444',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <TbX
                          size={20}
                          color="#fff"
                        />
                      </Box>
                      <Box style={{ flex: 1 }}>
                        {manualRiderDeclined ? (
                          <>
                            <Text
                              fw={800}
                              size="md"
                              c="red.7"
                            >
                              Rider Declined
                            </Text>
                            <Text
                              size="xs"
                              c="red.8"
                              mt={2}
                            >
                              <b>{order.declined_rider_name}</b> has declined
                              this order. Please assign a different rider below.
                            </Text>
                          </>
                        ) : (
                          <>
                            <Text
                              fw={800}
                              size="md"
                              c="red.7"
                            >
                              All Riders Declined / Timed Out
                            </Text>
                            <Text
                              size="xs"
                              c="red.8"
                              mt={2}
                            >
                              Every rider has declined or did not respond in
                              time. Please assign a new rider below to
                              re-dispatch.
                            </Text>
                          </>
                        )}
                      </Box>
                      <Badge
                        color="red"
                        variant="filled"
                        size="sm"
                      >
                        Action Required
                      </Badge>
                    </Group>
                  </CardBody>
                </Card>
              )}

              {/* ── Broadcast countdown ── */}
              {showBroadcastCountdown && broadcastSecsLeft !== null && (
                <Card
                  style={{
                    borderColor: 'rgba(245,158,11,0.35)',
                    borderWidth: 2,
                    background: 'rgba(245,158,11,0.04)',
                  }}
                >
                  <CardBody>
                    <Group gap="md">
                      <Box
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 10,
                          flexShrink: 0,
                          background: 'var(--mantine-color-yellow-5)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <TbClock
                          size={20}
                          color="#fff"
                        />
                      </Box>
                      <Box style={{ flex: 1 }}>
                        <Group
                          gap={8}
                          mb={2}
                        >
                          <Text
                            fw={800}
                            size="md"
                            c="yellow.8"
                          >
                            Waiting for a Rider to Accept
                          </Text>
                          <Badge
                            color="yellow"
                            variant="filled"
                            size="sm"
                          >
                            {Math.floor(broadcastSecsLeft / 60)}:
                            {String(broadcastSecsLeft % 60).padStart(2, '0')}{' '}
                            left
                          </Badge>
                        </Group>
                        <Text
                          size="xs"
                          c="yellow.9"
                        >
                          Broadcast sent to {deliveryRequests.length} rider
                          {deliveryRequests.length !== 1 ? 's' : ''}. If no one
                          accepts before the timer ends, you'll be prompted to
                          re-assign.
                        </Text>
                      </Box>
                    </Group>
                  </CardBody>
                </Card>
              )}

              {/* ── Rider Assignment Panel ── */}
              {showAssignPanel && (
                <Card
                  id="rider-section"
                  style={{ borderColor: 'rgba(8,145,178,0.3)', borderWidth: 2 }}
                >
                  <CardHeader>
                    <Box
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 8,
                        flexShrink: 0,
                        background: 'linear-gradient(135deg,#15B3E0,#1d4ed8)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <TbTruck
                        size={15}
                        color="#fff"
                      />
                    </Box>
                    <Box style={{ flex: 1 }}>
                      <CardHeaderTitle style={{ lineHeight: 1.3 }}>
                        {allDeclinedOrExpired
                          ? 'Re-Assign Delivery Rider'
                          : 'Assign Delivery Rider'}
                      </CardHeaderTitle>
                      <Text
                        size="xs"
                        c="dimmed"
                      >
                        {allDeclinedOrExpired
                          ? 'All previous riders declined. Pick a new rider or broadcast again.'
                          : 'Status moves to "Dispatched" once the rider accepts.'}
                      </Text>
                    </Box>
                    {allDeclinedOrExpired && (
                      <Badge
                        color="orange"
                        variant="light"
                        size="sm"
                      >
                        All declined
                      </Badge>
                    )}
                  </CardHeader>
                  <CardBody>
                    {deliveryStaff.length === 0 ? (
                      <Alert
                        color="orange"
                        variant="light"
                        icon={<TbAlertCircle size={13} />}
                      >
                        <Text
                          size="sm"
                          fw={600}
                        >
                          No delivery staff found
                        </Text>
                        <Text
                          size="xs"
                          mt={2}
                        >
                          Go to{' '}
                          <Text
                            component="span"
                            fw={700}
                            c="lotusCyan"
                            style={{ cursor: 'pointer' }}
                            onClick={() => navigate('/pharmacy/users')}
                          >
                            User Management
                          </Text>{' '}
                          to add delivery staff.
                        </Text>
                      </Alert>
                    ) : (
                      <Stack gap="sm">
                        <Text
                          size="xs"
                          c="dimmed"
                          mb={4}
                        >
                          Choose how to assign delivery — broadcast notifies all
                          riders, or pick a specific one:
                        </Text>

                        <RiderCard
                          $selected={selectedRider === '__broadcast__'}
                          onClick={() => setSelectedRider('__broadcast__')}
                        >
                          <RadioDot
                            $selected={selectedRider === '__broadcast__'}
                          >
                            {selectedRider === '__broadcast__' && (
                              <Box
                                style={{
                                  width: 7,
                                  height: 7,
                                  borderRadius: '50%',
                                  background: 'var(--mantine-color-body)',
                                }}
                              />
                            )}
                          </RadioDot>
                          <Box
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: '50%',
                              flexShrink: 0,
                              background:
                                'linear-gradient(135deg,#15B3E0,#1d4ed8)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <TbBroadcast
                              size={16}
                              color="#fff"
                            />
                          </Box>
                          <Box style={{ flex: 1 }}>
                            <Group
                              gap={6}
                              mb={2}
                            >
                              <Text
                                size="sm"
                                fw={700}
                              >
                                Broadcast to all riders
                              </Text>
                              <Badge
                                color="blue"
                                variant="light"
                                size="xs"
                              >
                                Recommended
                              </Badge>
                            </Group>
                            <Text
                              size="xs"
                              c="dimmed"
                            >
                              {deliveryStaff.length} rider
                              {deliveryStaff.length !== 1 ? 's' : ''} notified
                              simultaneously — first to accept delivers
                            </Text>
                          </Box>
                        </RiderCard>

                        {deliveryStaff.length > 0 && (
                          <Divider
                            label="or pick a specific rider"
                            labelPosition="center"
                            my={4}
                          />
                        )}

                        {deliveryStaff.map((s) => (
                          <RiderCard
                            key={s.id}
                            $selected={selectedRider === s.id}
                            onClick={() => setSelectedRider(s.id)}
                          >
                            <RadioDot $selected={selectedRider === s.id}>
                              {selectedRider === s.id && (
                                <Box
                                  style={{
                                    width: 7,
                                    height: 7,
                                    borderRadius: '50%',
                                    background: 'var(--mantine-color-body)',
                                  }}
                                />
                              )}
                            </RadioDot>
                            <Box
                              style={{
                                width: 36,
                                height: 36,
                                borderRadius: '50%',
                                flexShrink: 0,
                                background: s.is_active
                                  ? 'var(--mantine-color-default-hover)'
                                  : '#f3f4f6',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <TbUser
                                size={16}
                                color={
                                  s.is_active
                                    ? '#0891B2'
                                    : 'var(--mantine-color-dimmed)'
                                }
                              />
                            </Box>
                            <Box style={{ flex: 1 }}>
                              <Text
                                size="sm"
                                fw={700}
                                c={
                                  s.is_active
                                    ? 'var(--mantine-color-text)'
                                    : 'dimmed'
                                }
                              >
                                {s.name}
                              </Text>
                              {s.phone && (
                                <Text
                                  size="xs"
                                  c="lotusCyan"
                                  component="a"
                                  href={`tel:${s.phone}`}
                                  style={{ textDecoration: 'none' }}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {s.phone}
                                </Text>
                              )}
                            </Box>
                            <Badge
                              color={s.is_active ? 'green' : 'gray'}
                              variant="dot"
                              size="sm"
                            >
                              {s.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                          </RiderCard>
                        ))}

                        <Group
                          justify="flex-end"
                          mt="sm"
                        >
                          <Button
                            size="md"
                            color="lotusCyan"
                            loading={assigning}
                            disabled={!selectedRider}
                            leftSection={<TbTruck size={15} />}
                            style={{ minWidth: 200 }}
                            onClick={confirmDispatch}
                          >
                            {selectedRider === '__no_rider__'
                              ? 'Confirm Walk-in / No Rider'
                              : allDeclinedOrExpired
                                ? 'Re-Notify Rider(s)'
                                : 'Notify Rider(s)'}
                          </Button>
                        </Group>
                      </Stack>
                    )}
                  </CardBody>
                </Card>
              )}

              {/* ── Delivery Requests Tracker ── */}
              {deliveryRequests.length > 0 && !showAssignPanel && (
                <Card>
                  <CardHeader>
                    <TbTruck
                      size={14}
                      color="#0891B2"
                    />
                    <CardHeaderTitle>Delivery Requests</CardHeaderTitle>
                    <Badge
                      size="xs"
                      color="lotusCyan"
                      variant="light"
                    >
                      {deliveryRequests.length}
                    </Badge>
                  </CardHeader>
                  <CardBody>
                    <Stack gap="xs">
                      {deliveryRequests.map((req) => {
                        const reqStaff = req.staff as DbStaff | undefined
                        const statusColors: Record<
                          DeliveryRequestStatus,
                          string
                        > = {
                          pending: 'yellow',
                          accepted: 'teal',
                          declined: 'red',
                          expired: 'gray',
                        }
                        const statusIcon: Record<
                          DeliveryRequestStatus,
                          JSX.Element
                        > = {
                          pending: <TbClock size={11} />,
                          accepted: <TbCircleCheck size={11} />,
                          declined: <TbX size={11} />,
                          expired: <TbClock size={11} />,
                        }
                        const sentAt = new Date(req.created_at)
                        return (
                          <Box
                            key={req.id}
                            p="sm"
                            style={{
                              background:
                                req.status === 'accepted'
                                  ? 'rgba(16,185,129,0.06)'
                                  : req.status === 'pending'
                                    ? 'rgba(245,158,11,0.06)'
                                    : 'var(--mantine-color-default-hover)',
                              borderRadius: 10,
                              border: `1px solid ${req.status === 'accepted' ? 'rgba(16,185,129,0.25)' : req.status === 'pending' ? 'rgba(245,158,11,0.3)' : 'var(--mantine-color-default-border)'}`,
                            }}
                          >
                            <Group
                              justify="space-between"
                              wrap="nowrap"
                            >
                              <Group
                                gap="sm"
                                style={{
                                  flex: 1,
                                  minWidth: 0,
                                  cursor:
                                    req.status === 'accepted' && reqStaff
                                      ? 'pointer'
                                      : 'default',
                                }}
                                onClick={() => {
                                  if (req.status === 'accepted' && reqStaff)
                                    navigate(`/pharmacy/riders/${reqStaff.id}`)
                                }}
                              >
                                <Box
                                  style={{
                                    width: 36,
                                    height: 36,
                                    borderRadius: '50%',
                                    flexShrink: 0,
                                    background:
                                      req.status === 'accepted'
                                        ? '#dcfce7'
                                        : req.status === 'pending'
                                          ? '#fef9c3'
                                          : '#fee2e2',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}
                                >
                                  <TbUser
                                    size={16}
                                    color={
                                      req.status === 'accepted'
                                        ? '#16a34a'
                                        : req.status === 'pending'
                                          ? '#d97706'
                                          : '#dc2626'
                                    }
                                  />
                                </Box>
                                <Box style={{ flex: 1, minWidth: 0 }}>
                                  <Group
                                    gap={6}
                                    align="center"
                                  >
                                    <Text
                                      size="sm"
                                      fw={700}
                                      c={
                                        req.status === 'accepted' && reqStaff
                                          ? '#0891B2'
                                          : 'var(--mantine-color-text)'
                                      }
                                      style={{
                                        textDecoration:
                                          req.status === 'accepted' && reqStaff
                                            ? 'underline'
                                            : 'none',
                                      }}
                                    >
                                      {reqStaff?.name ?? 'Unknown'}
                                    </Text>
                                    <Badge
                                      color={statusColors[req.status]}
                                      variant="light"
                                      size="xs"
                                      leftSection={statusIcon[req.status]}
                                    >
                                      {req.status.charAt(0).toUpperCase() +
                                        req.status.slice(1)}
                                    </Badge>
                                  </Group>
                                  <Group
                                    gap={6}
                                    mt={2}
                                  >
                                    {reqStaff?.phone && (
                                      <Text
                                        size="xs"
                                        c="lotusCyan"
                                        component="a"
                                        href={`tel:${reqStaff.phone}`}
                                        style={{ textDecoration: 'none' }}
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        {reqStaff.phone}
                                      </Text>
                                    )}
                                    <Text
                                      size="xs"
                                      c="dimmed"
                                    >
                                      Sent{' '}
                                      {sentAt.toLocaleTimeString('en-UG', {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      })}{' '}
                                      ·{' '}
                                      {sentAt.toLocaleDateString('en-UG', {
                                        day: 'numeric',
                                        month: 'short',
                                      })}
                                    </Text>
                                  </Group>
                                </Box>
                              </Group>
                              <Group
                                gap={6}
                                style={{ flexShrink: 0 }}
                              >
                                {req.status === 'accepted' && reqStaff && (
                                  <TbChevronRight
                                    size={13}
                                    color="var(--mantine-color-dimmed)"
                                  />
                                )}
                                {(req.status === 'declined' ||
                                  req.status === 'expired') &&
                                  reqStaff && (
                                    <Button
                                      size="xs"
                                      variant="light"
                                      color="lotusCyan"
                                      leftSection={<TbRefresh size={12} />}
                                      onClick={async () => {
                                        const { error } = await supabase
                                          .from('delivery_requests')
                                          .insert({
                                            order_id: order.id,
                                            delivery_staff_id: reqStaff.id,
                                            sent_by: staffInfo?.id ?? null,
                                            status:
                                              'pending' as DeliveryRequestStatus,
                                          })
                                        if (error) {
                                          notifications.show({
                                            title: 'Error',
                                            message: error.message,
                                            color: 'red',
                                          })
                                        } else {
                                          notifications.show({
                                            title: '🚴 Resent!',
                                            message: `New request sent to ${reqStaff.name}.`,
                                            color: 'teal',
                                            autoClose: 2500,
                                          })
                                          fetchDeliveryData()
                                        }
                                      }}
                                    >
                                      Resend
                                    </Button>
                                  )}
                              </Group>
                            </Group>
                          </Box>
                        )
                      })}
                    </Stack>
                  </CardBody>
                </Card>
              )}

              {/* ── Assigned Rider Card ── */}
              {['dispatched', 'out_for_delivery'].includes(order.status) &&
                (() => {
                  const acceptedReq = deliveryRequests.find(
                    (r) => r.status === 'accepted',
                  )
                  if (!acceptedReq?.staff) return null
                  return (
                    <Card
                      style={{
                        borderColor: 'rgba(8,145,178,0.25)',
                        borderWidth: 2,
                        cursor: 'pointer',
                      }}
                      onClick={() =>
                        navigate(`/pharmacy/riders/${acceptedReq.staff!.id}`)
                      }
                    >
                      <CardBody>
                        <Group gap="md">
                          <Box
                            style={{
                              width: 40,
                              height: 40,
                              borderRadius: 10,
                              flexShrink: 0,
                              background:
                                'linear-gradient(135deg,#15B3E0,#1d4ed8)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <TbTruck
                              size={20}
                              color="#fff"
                            />
                          </Box>
                          <Box style={{ flex: 1 }}>
                            <Text
                              fw={700}
                              size="sm"
                            >
                              Assigned Rider
                            </Text>
                            <Text
                              size="sm"
                              fw={600}
                              c="lotusCyan"
                              mt={2}
                              style={{ textDecoration: 'underline' }}
                            >
                              {acceptedReq.staff.name}
                            </Text>
                            {acceptedReq.staff.phone && (
                              <Text
                                size="xs"
                                c="lotusCyan"
                                mt={2}
                                component="a"
                                href={`tel:${acceptedReq.staff.phone}`}
                                style={{ textDecoration: 'none' }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                {acceptedReq.staff.phone}
                              </Text>
                            )}
                          </Box>
                          <TbChevronRight
                            size={15}
                            color="var(--mantine-color-dimmed)"
                          />
                        </Group>
                      </CardBody>
                    </Card>
                  )
                })()}

              {/* ── OTP Fallback Panel ── */}
              {order.status === 'out_for_delivery' && order.otp && (
                <Card
                  style={{
                    borderColor: 'rgba(8,145,178,0.25)',
                    borderWidth: 2,
                  }}
                >
                  <CardHeader>
                    <Box
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: 7,
                        flexShrink: 0,
                        background: 'linear-gradient(135deg,#15B3E0,#1d4ed8)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <TbPhone
                        size={13}
                        color="#fff"
                      />
                    </Box>
                    <Box style={{ flex: 1 }}>
                      <CardHeaderTitle>Delivery OTP</CardHeaderTitle>
                    </Box>
                  </CardHeader>
                  <CardBody>
                    <Alert
                      color="blue"
                      variant="light"
                      icon={<TbAlertCircle size={13} />}
                      mb="md"
                    >
                      <Text
                        size="sm"
                        fw={600}
                      >
                        The OTP is already with the customer
                      </Text>
                      <Text
                        size="xs"
                        mt={2}
                        c="dimmed"
                      >
                        The customer sees this code in their app. The rider must
                        ask the customer to read it out to complete the delivery
                        handover.
                      </Text>
                    </Alert>
                    <Box style={{ textAlign: 'center' }}>
                      <Text
                        size="xs"
                        c="dimmed"
                        mb={8}
                        style={{
                          textTransform: 'uppercase',
                          letterSpacing: '0.08em',
                          fontWeight: 600,
                        }}
                      >
                        Delivery OTP for Order #{order.order_number}
                      </Text>
                      <Box
                        style={{
                          display: 'inline-block',
                          background: 'var(--mantine-color-default-hover)',
                          border: '2px solid #0891B2',
                          borderRadius: 12,
                          padding: '12px 30px',
                        }}
                      >
                        <Text
                          style={{
                            fontFamily: "'Nunito', monospace",
                            fontWeight: 900,
                            fontSize: 34,
                            letterSpacing: '0.25em',
                            color: '#0891B2',
                          }}
                        >
                          {order.otp}
                        </Text>
                      </Box>
                      {order.otp_expires_at && (
                        <Text
                          size="xs"
                          c="dimmed"
                          mt={8}
                        >
                          Expires: {formatRelativeTime(order.otp_expires_at)}
                        </Text>
                      )}
                    </Box>
                  </CardBody>
                </Card>
              )}
            </MainColumn>

            {/* ── RIGHT SIDEBAR ────────────────────────────────────────────── */}
            <SideColumn>
              {/* Financial Summary */}
              {pricingSummaryVisible &&
                (() => {
                  const insuredCoveragePreview = isCashOrder
                    ? 0
                    : insuredMedAmountPreview
                  const hasPartialApproval = meds.some(
                    (m) => m.is_insured && m.approval_status === 'partial',
                  )
                  return (
                    <Card>
                      <CardHeader>
                        <TbCurrencyDollar
                          size={14}
                          color="#0891B2"
                        />
                        <CardHeaderTitle>Order Summary</CardHeaderTitle>
                        {order.insurance_approval_ref && (
                          <ApprovalPill>
                            <TbCircleCheck size={10} />
                            Ref: {order.insurance_approval_ref}
                          </ApprovalPill>
                        )}
                      </CardHeader>

                      <SummaryRow>
                        <Group gap={7}>
                          <TbPackage
                            size={13}
                            color="var(--mantine-color-dimmed)"
                          />
                          <Text
                            size="sm"
                            c="dimmed"
                          >
                            Medications subtotal
                          </Text>
                        </Group>
                        <Text
                          size="sm"
                          fw={600}
                        >
                          UGX {subtotal.toLocaleString()}
                        </Text>
                      </SummaryRow>

                      {deliverySkippedLocal ? (
                        <SummaryRow>
                          <Group gap={7}>
                            <TbTruck
                              size={13}
                              color="var(--mantine-color-dimmed)"
                            />
                            <Text
                              size="sm"
                              c="dimmed"
                            >
                              Delivery
                            </Text>
                          </Group>
                          <Badge
                            size="sm"
                            color="violet"
                            variant="light"
                          >
                            In-store pickup
                          </Badge>
                        </SummaryRow>
                      ) : riderHasAccepted ? (
                        <SummaryRow $accent={!isCashOrder ? 'teal' : undefined}>
                          <Group gap={7}>
                            <TbTruck
                              size={13}
                              color={
                                !isCashOrder
                                  ? '#10B981'
                                  : 'var(--mantine-color-dimmed)'
                              }
                            />
                            <Text
                              size="sm"
                              c={!isCashOrder ? 'teal' : 'dimmed'}
                            >
                              Delivery fee
                              {!isCashOrder && (
                                <Text
                                  span
                                  size="xs"
                                  c="teal"
                                  fw={500}
                                  ml={6}
                                >
                                  (covered by insurance)
                                </Text>
                              )}
                            </Text>
                          </Group>
                          <Text
                            size="sm"
                            fw={600}
                            c={!isCashOrder ? 'teal' : undefined}
                          >
                            UGX {DELIVERY_FEE.toLocaleString()}
                          </Text>
                        </SummaryRow>
                      ) : (
                        <SummaryRow>
                          <Group gap={7}>
                            <TbTruck
                              size={13}
                              color="var(--mantine-color-dimmed)"
                            />
                            <Text
                              size="sm"
                              c="dimmed"
                            >
                              Delivery fee
                            </Text>
                          </Group>
                          <Text
                            size="sm"
                            fw={600}
                          >
                            UGX {DELIVERY_FEE.toLocaleString()}
                          </Text>
                        </SummaryRow>
                      )}

                      {insuredCoveragePreview > 0 && (
                        <SummaryRow $accent="teal">
                          <Group gap={7}>
                            <TbShieldCheck
                              size={13}
                              color="#10B981"
                            />
                            <Text
                              size="sm"
                              c="teal"
                              fw={500}
                            >
                              Insurance covers{' '}
                              <Text
                                span
                                size="xs"
                                c="teal"
                                fw={400}
                              >
                                (
                                {hasPartialApproval
                                  ? 'approved qty'
                                  : 'insured meds'}
                                )
                              </Text>
                            </Text>
                          </Group>
                          <Text
                            size="sm"
                            fw={700}
                            c="teal"
                          >
                            − UGX {insuredCoveragePreview.toLocaleString()}
                          </Text>
                        </SummaryRow>
                      )}

                      <SummaryTotal>
                        <Text
                          fw={700}
                          size="sm"
                        >
                          Customer Pays
                        </Text>
                        {grandTotal === 0 ? (
                          <FullyCoveredBadge>
                            <TbShieldCheck size={14} />
                            UGX 0 — Fully Covered
                          </FullyCoveredBadge>
                        ) : (
                          <Text
                            fw={900}
                            size="xl"
                            c="lotusCyan"
                            style={{ letterSpacing: '-0.5px' }}
                          >
                            UGX {grandTotal.toLocaleString()}
                          </Text>
                        )}
                      </SummaryTotal>
                    </Card>
                  )
                })()}

              {/* Smart routing preview */}
              {canSetPricing &&
                !!order.insurance_approval_ref &&
                !order.cash_only && (
                  <Alert
                    color={insuredChanged ? 'orange' : 'teal'}
                    variant="light"
                    icon={
                      insuredChanged ? (
                        <TbShieldBolt size={13} />
                      ) : (
                        <TbShieldCheck size={13} />
                      )
                    }
                  >
                    <Text
                      size="sm"
                      fw={700}
                    >
                      {insuredChanged
                        ? '⚠️ Insured items changed — will be sent back to insurance'
                        : '✅ Only cash items changed — insurance approval preserved'}
                    </Text>
                    <Text
                      size="xs"
                      mt={2}
                      c="dimmed"
                    >
                      {insuredChanged
                        ? 'Modified insured items require re-approval before customer can confirm.'
                        : 'The existing insurance approval remains valid.'}
                    </Text>
                  </Alert>
                )}

              {/* Save pricing button */}
              {canSetPricing &&
                (() => {
                  const wasApproved =
                    !!order.insurance_approval_ref && !order.cash_only
                  if (order.cash_only) {
                    return (
                      <Button
                        fullWidth
                        color="lotusCyan"
                        loading={savingPricing}
                        onClick={savePricing}
                        leftSection={<TbCheck size={15} />}
                        size="md"
                      >
                        Save Pricing &amp; Notify Customer
                      </Button>
                    )
                  }
                  if (wasApproved) {
                    return insuredChanged ? (
                      <Button
                        fullWidth
                        color="orange"
                        loading={savingPricing}
                        onClick={savePricing}
                        leftSection={<TbShieldBolt size={15} />}
                        size="md"
                      >
                        Resubmit to Insurance
                      </Button>
                    ) : (
                      <Button
                        fullWidth
                        color="teal"
                        loading={savingPricing}
                        onClick={savePricing}
                        leftSection={<TbCheck size={15} />}
                        size="md"
                      >
                        Save &amp; Send to Customer
                      </Button>
                    )
                  }
                  return (
                    <Button
                      fullWidth
                      color="lotusCyan"
                      loading={savingPricing}
                      onClick={savePricing}
                      leftSection={<TbCheck size={15} />}
                      size="md"
                    >
                      {order.status === 'pricing_ready'
                        ? 'Resubmit Pricing to Insurance'
                        : (order as { rejection_reason?: string })
                              .rejection_reason
                          ? 'Revise &amp; Resubmit to Insurance'
                          : 'Save Pricing &amp; Send to Insurance'}
                    </Button>
                  )
                })()}

              {/* Actions Card */}
              <Card>
                <CardHeader>
                  <TbBroadcast
                    size={14}
                    color="#0891B2"
                  />
                  <CardHeaderTitle>Actions</CardHeaderTitle>
                </CardHeader>
                <CardBody>
                  <Stack
                    gap="sm"
                    align="flex-start"
                  >
                    {order.status === 'insurance_verification' && (
                      <Alert
                        color="grape"
                        variant="light"
                        icon={<TbShieldCheck size={13} />}
                        style={{ width: '100%' }}
                      >
                        <Text
                          size="sm"
                          fw={600}
                        >
                          Waiting for insurance verification
                        </Text>
                        <Text
                          size="xs"
                          mt={2}
                          c="dimmed"
                        >
                          The customer's insurance card is pending verification
                          by support staff. This order will move to{' '}
                          <b>Pharmacy Review</b> automatically once verified.
                        </Text>
                      </Alert>
                    )}
                    {order.status === 'prescription_uploaded' && (
                      <Button
                        fullWidth
                        color="blue"
                        loading={savingStatus === 'pharmacy_review'}
                        leftSection={<TbPackage size={15} />}
                        onClick={() =>
                          updateStatus('pharmacy_review' as OrderStatus)
                        }
                      >
                        Start Pharmacy Review
                      </Button>
                    )}
                    {order.status === 'confirmed' && (
                      <Button
                        fullWidth
                        color="violet"
                        loading={savingStatus === 'packing'}
                        leftSection={<TbPackage size={15} />}
                        onClick={() => updateStatus('packing' as OrderStatus)}
                      >
                        Start Packing
                      </Button>
                    )}
                    {order.status === 'packing' && (
                      <Alert
                        color="blue"
                        variant="light"
                        icon={<TbTruck size={13} />}
                        style={{ width: '100%' }}
                      >
                        <Text
                          size="sm"
                          fw={600}
                        >
                          Ready to dispatch?
                        </Text>
                        <Text
                          size="xs"
                          mt={2}
                          c="dimmed"
                        >
                          Use the <b>Assign Delivery Rider</b> card on the left
                          to select a rider or broadcast to all riders.
                        </Text>
                      </Alert>
                    )}
                    {order.status === 'dispatched' &&
                      !allDeclinedOrExpired &&
                      (hasAcceptedRider ? (
                        <Button
                          fullWidth
                          color="teal"
                          loading={savingStatus === 'out_for_delivery'}
                          leftSection={<TbTruck size={15} />}
                          onClick={() =>
                            updateStatus('out_for_delivery' as OrderStatus)
                          }
                        >
                          Mark Out for Delivery
                        </Button>
                      ) : (
                        <Alert
                          color="yellow"
                          variant="light"
                          icon={<TbClock size={13} />}
                          style={{ width: '100%' }}
                        >
                          <Text
                            size="sm"
                            fw={600}
                          >
                            Waiting for a rider to accept
                          </Text>
                          <Text
                            size="xs"
                            mt={2}
                            c="dimmed"
                          >
                            The "Out for Delivery" button appears once a rider
                            accepts.
                          </Text>
                        </Alert>
                      ))}
                    {order.status === 'out_for_delivery' && (
                      <Stack
                        gap="xs"
                        align="flex-start"
                        style={{ width: '100%' }}
                      >
                        {order.no_rider ? (
                          <>
                            <Button
                              fullWidth
                              color="green"
                              loading={savingStatus === 'delivered'}
                              leftSection={<TbShieldCheck size={15} />}
                              onClick={() => {
                                setWalkinOtpInput('')
                                setWalkinOtpError(null)
                                setWalkinOtpModalOpen(true)
                              }}
                            >
                              Verify OTP &amp; Mark Delivered
                            </Button>
                            <Text
                              size="xs"
                              c="dimmed"
                            >
                              Walk-in — ask the customer to read their OTP from
                              the app.
                            </Text>
                          </>
                        ) : (
                          <Button
                            fullWidth
                            color="green"
                            loading={savingStatus === 'delivered'}
                            leftSection={<TbCheck size={15} />}
                            onClick={() =>
                              updateStatus('delivered' as OrderStatus)
                            }
                          >
                            Mark as Delivered
                          </Button>
                        )}
                      </Stack>
                    )}
                    {!['rejected', 'cancelled', 'delivered'].includes(
                      order.status,
                    ) && (
                      <Button
                        fullWidth
                        color="red"
                        variant="subtle"
                        loading={savingStatus === 'rejected'}
                        onClick={() => {
                          setRejectReason('')
                          setRejectModalOpen(true)
                        }}
                      >
                        Reject Order
                      </Button>
                    )}
                  </Stack>
                </CardBody>
              </Card>

              {/* Status History */}
              {statusHistory.length > 0 && (
                <Card>
                  <CardHeader
                    style={{ cursor: 'pointer' }}
                    onClick={() => setHistoryOpen((o) => !o)}
                  >
                    <TbHistory
                      size={14}
                      color="#0891B2"
                    />
                    <CardHeaderTitle>Status History</CardHeaderTitle>
                    <Badge
                      size="xs"
                      color="lotusCyan"
                      variant="light"
                      mr={6}
                    >
                      {statusHistory.length}
                    </Badge>
                    <ActionIcon
                      size="xs"
                      variant="subtle"
                      color="gray"
                    >
                      {historyOpen ? (
                        <TbChevronUp size={13} />
                      ) : (
                        <TbChevronDown size={13} />
                      )}
                    </ActionIcon>
                  </CardHeader>
                  <Collapse in={historyOpen}>
                    <Stack gap={0}>
                      {statusHistory.map((entry, i) => {
                        const roleLabel = entry.changed_by_role
                          ? entry.changed_by_role
                              .replace(/_/g, ' ')
                              .replace(/\b\w/g, (c) => c.toUpperCase())
                          : 'System'
                        const statusFormatted = entry.status
                          .split('_')
                          .map((w: string) => w[0].toUpperCase() + w.slice(1))
                          .join(' ')
                        const dotColor: Record<string, string> = {
                          delivered: '#10b981',
                          confirmed: '#10b981',
                          packing: '#8b5cf6',
                          dispatched: '#06b6d4',
                          out_for_delivery: '#06b6d4',
                          pricing_ready: '#3b82f6',
                          awaiting_confirmation: '#f59e0b',
                          rejected: '#ef4444',
                          cancelled: '#ef4444',
                        }
                        const color =
                          dotColor[entry.status] ??
                          'var(--mantine-color-dimmed)'
                        return (
                          <DetailRow
                            key={entry.id}
                            style={{
                              padding: '11px 18px',
                              alignItems: 'flex-start',
                            }}
                          >
                            <Box
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                paddingTop: 5,
                                flexShrink: 0,
                                width: 24,
                              }}
                            >
                              <Box
                                style={{
                                  width: 9,
                                  height: 9,
                                  borderRadius: '50%',
                                  background: color,
                                  border: `2px solid ${color}20`,
                                  boxShadow: `0 0 0 3px ${color}15`,
                                }}
                              />
                              {i < statusHistory.length - 1 && (
                                <Box
                                  style={{
                                    width: 2,
                                    flex: 1,
                                    minHeight: 20,
                                    background:
                                      'var(--mantine-color-default-border)',
                                    marginTop: 4,
                                  }}
                                />
                              )}
                            </Box>
                            <Box style={{ flex: 1 }}>
                              <Group
                                justify="space-between"
                                wrap="nowrap"
                                align="flex-start"
                              >
                                <Box>
                                  <Text
                                    size="sm"
                                    fw={700}
                                    mb={3}
                                  >
                                    {statusFormatted}
                                  </Text>
                                  <Group gap={6}>
                                    <Box
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 4,
                                        background:
                                          'var(--mantine-color-default-hover)',
                                        borderRadius: 6,
                                        padding: '2px 7px',
                                      }}
                                    >
                                      <TbShieldBolt
                                        size={9}
                                        color="var(--mantine-color-dimmed)"
                                      />
                                      <Text
                                        size="xs"
                                        c="dimmed"
                                        fw={500}
                                      >
                                        {roleLabel}
                                      </Text>
                                    </Box>
                                    {entry.notes && (
                                      <Text
                                        size="xs"
                                        c="dimmed"
                                        fs="italic"
                                      >
                                        {entry.notes}
                                      </Text>
                                    )}
                                  </Group>
                                </Box>
                                <Text
                                  size="xs"
                                  c="dimmed"
                                  style={{ flexShrink: 0, paddingTop: 2 }}
                                >
                                  {new Date(
                                    entry.created_at,
                                  ).toLocaleDateString('en-UG', {
                                    day: 'numeric',
                                    month: 'short',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </Text>
                              </Group>
                            </Box>
                          </DetailRow>
                        )
                      })}
                    </Stack>
                  </Collapse>
                </Card>
              )}
            </SideColumn>
          </TwoColumnGrid>
        </PageContainer>
      </PortalPageWrap>

      {/* ── Reject Modal ── */}
      <Modal
        opened={rejectModalOpen}
        onClose={() => setRejectModalOpen(false)}
        title="Reject this order?"
        centered
        size="sm"
        styles={{
          title: { fontFamily: "'DM Sans',sans-serif", fontWeight: 700 },
        }}
      >
        <Stack gap="md">
          <Text
            size="sm"
            c="dimmed"
          >
            Please provide a reason so the customer understands why their order
            was rejected.
          </Text>
          <Textarea
            label="Reason for rejection"
            placeholder="e.g. Medication out of stock, invalid prescription, etc."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            minRows={3}
            autosize
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
              loading={savingStatus === 'rejected'}
              leftSection={<TbX size={13} />}
              onClick={async () => {
                setRejectModalOpen(false)
                await updateStatus(
                  'rejected' as OrderStatus,
                  rejectReason.trim(),
                )
              }}
            >
              Confirm Rejection
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* ── Walk-in OTP Modal ── */}
      <Modal
        opened={walkinOtpModalOpen}
        onClose={() => {
          setWalkinOtpModalOpen(false)
          setWalkinOtpInput('')
          setWalkinOtpError(null)
        }}
        title="Verify Walk-in Handover"
        centered
        size="sm"
        styles={{
          title: { fontFamily: "'DM Sans',sans-serif", fontWeight: 700 },
        }}
      >
        <Stack gap="md">
          <Alert
            color="blue"
            variant="light"
            icon={<TbShieldCheck size={13} />}
          >
            <Text
              size="sm"
              fw={600}
            >
              OTP required for walk-in pickup
            </Text>
            <Text
              size="xs"
              mt={2}
              c="dimmed"
            >
              Ask the customer to open their app and read you the 6-digit OTP.
              This confirms they collected the order and creates an audit trail.
            </Text>
          </Alert>
          <TextInput
            label="Customer OTP"
            placeholder="Enter 6-digit OTP"
            value={walkinOtpInput}
            onChange={(e) => {
              setWalkinOtpInput(e.target.value.replace(/\D/g, '').slice(0, 6))
              setWalkinOtpError(null)
            }}
            error={walkinOtpError}
            maxLength={6}
            size="lg"
            autoFocus
            styles={{
              input: {
                fontFamily: "'Nunito', monospace",
                fontWeight: 800,
                fontSize: 28,
                letterSpacing: '0.3em',
                textAlign: 'center',
              },
            }}
          />
          <Group
            justify="flex-end"
            gap="sm"
          >
            <Button
              variant="default"
              onClick={() => {
                setWalkinOtpModalOpen(false)
                setWalkinOtpInput('')
                setWalkinOtpError(null)
              }}
            >
              Cancel
            </Button>
            <Button
              color="green"
              loading={verifyingWalkinOtp}
              disabled={walkinOtpInput.length !== 6}
              leftSection={<TbShieldCheck size={13} />}
              onClick={verifyWalkinOtp}
            >
              Verify and Complete Handover
            </Button>
          </Group>
        </Stack>
      </Modal>
    </PharmacySidebarLayout>
  )
}

