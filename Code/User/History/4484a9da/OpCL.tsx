import React, { useState, useEffect } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import {
  Badge,
  Box,
  Button,
  Container,
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
  Tabs,
  Collapse,
  ActionIcon,
} from '@mantine/core'
import {
  TbArrowLeft,
  TbPencil,
  TbBuildingHospital,
  TbUsers,
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
} from 'react-icons/tb'
import styled, { keyframes, css } from 'styled-components'
import { notifications } from '@mantine/notifications'
import { SavedColors } from '@shared/constants'
import { PageTitle, BlueDivider, SectionLabel } from '@shared/ui/typography'
import { ContentCard } from '@shared/ui/layout'
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
import OrderChatPanel from '../../components/OrderChatPanel'

//  Styled components

const selectedPulse = keyframes`
  0%,100%{box-shadow:0 0 0 0 rgba(21,179,224,0.3)}
  50%{box-shadow:0 0 0 5px rgba(21,179,224,0)}
`

const CustomerMessageBanner = styled.div`
  display: flex;
  gap: 14px;
  align-items: flex-start;
  padding: 16px 18px;
  border-radius: 12px;
  border: 2px solid #f59e0b;
  background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
  margin-bottom: 20px;
  box-shadow: 0 4px 16px rgba(245, 158, 11, 0.2);
  animation: ${css`
      ${selectedPulse}`} 2.5s ease-in-out 4;
`

const PrescriptionNoteBanner = styled.div`
  display: flex;
  gap: 14px;
  align-items: flex-start;
  padding: 14px 18px;
  border-radius: 10px;
  border: 2px solid #3b82f6;
  background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
  margin-bottom: 12px;
  box-shadow: 0 2px 10px rgba(59, 130, 246, 0.15);
`

const InsuranceRejectionBanner = styled.div`
  display: flex;
  gap: 14px;
  align-items: flex-start;
  padding: 16px 18px;
  border-radius: 12px;
  border: 2px solid #ef4444;
  background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
  margin-bottom: 20px;
  box-shadow: 0 4px 16px rgba(239, 68, 68, 0.2);
  animation: ${css`
      ${selectedPulse}`} 2.5s ease-in-out 4;
`

const RiderCard = styled.div<{ $selected: boolean }>`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 10px;
  cursor: pointer;
  border: 2px solid
    ${(p) => (p.$selected ? SavedColors.Primaryblue : '#E8EDF5')};
  background: ${(p) => (p.$selected ? '#EBF7FD' : '#fff')};
  transition: all 0.15s;
  ${(p) =>
    p.$selected &&
    css`
      animation: ${selectedPulse} 2s ease infinite;
    `}
  &:hover {
    border-color: ${SavedColors.Primaryblue};
    background: #f0fbff;
  }
`
const RadioDot = styled.div<{ $selected: boolean }>`
  width: 18px;
  height: 18px;
  border-radius: 50%;
  flex-shrink: 0;
  border: 2px solid
    ${(p) => (p.$selected ? SavedColors.Primaryblue : '#d1d5db')};
  background: ${(p) => (p.$selected ? SavedColors.Primaryblue : '#fff')};
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
`

//  Helpers
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

//  Constants
const DELIVERY_FEE = 10_000 // UGX — fixed delivery fee

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

//  Main component
export default function PharmacyOrderDetail(): JSX.Element {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { staffInfo } = useAuth()

  const [order, setOrder] = useState<DbOrder | null>(null)
  const [meds, setMeds] = useState<MedRow[]>([])
  const [loading, setLoading] = useState(true)
  const [savingPricing, setSavingPricing] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null) // which med row is being edited
  const [savingStatus, setSavingStatus] = useState<string | null>(null)
  const [prescriptionSignedUrl, setPrescriptionSignedUrl] = useState<
    string | null
  >(null)
  const [allSignedUrls, setAllSignedUrls] = useState<string[]>([])

  // Broadcast timeout: how long riders have to accept (in seconds)
  const BROADCAST_TIMEOUT_SECS = 5 * 60 // 5 minutes

  // Delivery
  const [deliveryStaff, setDeliveryStaff] = useState<DbStaff[]>([])
  const [deliveryRequests, setDeliveryRequests] = useState<DbDeliveryRequest[]>(
    [],
  )
  const [selectedRider, setSelectedRider] = useState<string | null>(null)
  const [assigning, setAssigning] = useState(false)
  // Countdown timer for broadcast (seconds remaining)
  const [broadcastSecsLeft, setBroadcastSecsLeft] = useState<number | null>(
    null,
  )
  // Reject order modal
  const [rejectModalOpen, setRejectModalOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  // Bug 4: Walk-in OTP verification modal
  const [walkinOtpModalOpen, setWalkinOtpModalOpen] = useState(false)
  const [walkinOtpInput, setWalkinOtpInput] = useState('')
  const [walkinOtpError, setWalkinOtpError] = useState<string | null>(null)
  const [verifyingWalkinOtp, setVerifyingWalkinOtp] = useState(false)
  // Status history / audit log
  const [statusHistory, setStatusHistory] = useState<StatusHistoryEntry[]>([])
  const [historyOpen, setHistoryOpen] = useState(false)
  // Scroll to rider section once order finishes loading
  useEffect(() => {
    if (!loading && location.hash === '#rider-section') {
      setTimeout(() => {
        document
          .getElementById('rider-section')
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    }
  }, [loading, location.hash])

  //  Fetching
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

      // Auto-select rider mode based on how the customer placed the order:
      // - Walk-in (no_rider) → pre-select __no_rider__
      // - Delivery with address → pre-select __broadcast__ (default)
      if ((data as DbOrder).no_rider) {
        setSelectedRider('__no_rider__')
      } else if ((data as DbOrder).delivery_address_snapshot) {
        setSelectedRider('__broadcast__')
      }

      // Sign all prescription images (multi-image support)
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

    // delivery_staff_id FK points to auth.users, not staff table,
    // so PostgREST can't auto-join — manually enrich with staff data
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

    // Enrich with staff name via staffInfo from auth (current viewer) or notes context
    // order_status_history doesn't have a staff_id FK so we surface role + notes
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

  // Broadcast countdown timer
  useEffect(() => {
    if (!order?.broadcast_timeout_at || !order.dispatch_is_broadcast) {
      setBroadcastSecsLeft(null)
      return
    }
    // Don't run timer if someone already accepted or if already timed-out
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
      // Already expired — fire RPC immediately
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

  //  Insurance — use the specific insurance the customer selected for this order
  //  (order.selected_insurance_id is set at prescription upload time)
  const profileInsurance: DbInsurance | null = order?.cash_only
    ? null
    : ((order?.selected_insurance as DbInsurance | null) ?? null)
  const insuranceStatus: string = order?.cash_only
    ? 'none'
    : (profileInsurance?.status ?? order?.insurance_status ?? 'none')
  const insuranceVerified = !order?.cash_only && insuranceStatus === 'verified'

  // Insurance provider contact phone (fetched once insurance is known)
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

  //  Med helpers
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

  //  Send notification to customer via SECURITY DEFINER RPC
  // sendCustomerNotification is intentionally a no-op.
  // The DB trigger trg_notify_customer_on_status_change on order_status_history handles all notifications.
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

    // ── Smart re-approval detection ──────────────────────────────────────────
    // If insurance previously approved this order (insurance_approval_ref is set),
    // we compare the current meds against the DB snapshot to determine whether
    // the changes affect insured items (→ must go back to insurance) or only
    // cash items (→ can go straight to customer confirmation).
    const wasInsuranceApproved =
      !!order.insurance_approval_ref && !order.cash_only
    let needsInsuranceReapproval = false

    if (wasInsuranceApproved) {
      const dbMeds = (order.medications ?? []) as MedRow[]
      const dbMedMap = new Map(dbMeds.map((m) => [m.id, m]))

      // 1. Any insured med was removed
      const removedInsuredMed = dbMeds.some(
        (dbMed) =>
          dbMed.is_insured && !namedMeds.find((m) => m.id === dbMed.id),
      )

      // 2. Any new med added as insured
      const addedInsuredMed = namedMeds.some((m) => m.isNew && m.is_insured)

      // 3. Existing insured med had unit_price, quantity, or coverage (is_insured) changed
      const changedInsuredMed = namedMeds.some((m) => {
        if (m.isNew) return false
        const orig = dbMedMap.get(m.id)
        if (!orig) return false
        // Was insured before or is insured now — any price/qty/coverage change triggers re-approval
        if (orig.is_insured || m.is_insured) {
          return (
            orig.unit_price !== m.unit_price ||
            orig.quantity !== m.quantity ||
            orig.is_insured !== m.is_insured
          )
        }
        return false
      })

      needsInsuranceReapproval =
        removedInsuredMed || addedInsuredMed || changedInsuredMed
    }
    // ────────────────────────────────────────────────────────────────────────

    // DELETE medications removed from UI
    const existingMedIds = namedMeds.filter((m) => !m.isNew).map((m) => m.id)
    const allDbMeds = (order.medications ?? []) as { id: string }[]
    const removedIds = allDbMeds
      .map((m) => m.id)
      .filter((dbId) => !existingMedIds.includes(dbId))
    if (removedIds.length > 0) {
      await supabase.from('medications').delete().in('id', removedIds)
    }

    // INSERT new / UPDATE existing
    for (const med of namedMeds) {
      if (med.isNew) {
        await supabase.from('medications').insert({
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
          })
          .eq('id', med.id)
      }
    }

    // Calculate totals
    const calcSubtotal = namedMeds
      .filter((m) => m.in_stock)
      .reduce((s, m) => s + m.unit_price * m.quantity, 0)
    const insuredMedAmount = namedMeds
      .filter((m) => m.is_insured && m.in_stock)
      .reduce((s, m) => s + m.unit_price * m.quantity, 0)
    const cashMedAmount = namedMeds
      .filter((m) => !m.is_insured && m.in_stock)
      .reduce((s, m) => s + m.unit_price * m.quantity, 0)
    // Bug 2 fix: delivery fee is NOT included in the pharmacy pricing calculation.
    // It is a fixed 10,000 UGX fee added only after a rider accepts the order.
    // For insured orders, insurance always covers the delivery fee separately.
    // Storing 0 here keeps DB clean; the fee is shown to the customer at payment time.
    const isCashOrder = order.cash_only === true
    const deliveryFeeCalc = order.no_rider ? 0 : DELIVERY_FEE

    // insured_amount = value of insured medications only (no delivery fee here)
    const insuredAmount = insuredMedAmount
    // cash_amount = value of non-insured medications only
    const cashAmount = cashMedAmount
    // total_amount = what the customer will owe:
    //   - Cash order: non-insured meds + delivery fee
    //   - Insured order: non-insured meds only (delivery covered by insurance, added later)
    const totalAmount = isCashOrder
      ? cashMedAmount + deliveryFeeCalc
      : cashMedAmount

    // ── Smart routing: decide next status ────────────────────────────────────
    // Priority:
    //   1. Cash order → always straight to customer (awaiting_confirmation)
    //   2. Insured order, previously approved, insured items changed
    //      → back to insurance (pricing_ready) + flag needs_reapproval
    //   3. Insured order, previously approved, only cash items changed
    //      → straight to customer (awaiting_confirmation), clear needs_reapproval
    //   4. Insured order, not yet approved → insurance first (pricing_ready)
    const newStatus: string = (() => {
      if (isCashOrder) return 'awaiting_confirmation'
      if (wasInsuranceApproved) {
        return needsInsuranceReapproval
          ? 'pricing_ready'
          : 'awaiting_confirmation'
      }
      return 'pricing_ready'
    })()
    // ────────────────────────────────────────────────────────────────────────

    // Build order update payload — clear approval fields when sending back to insurance
    const orderUpdatePayload: Record<string, unknown> = {
      subtotal: calcSubtotal,
      insured_amount: insuredAmount,
      cash_amount: cashAmount,
      delivery_fee: 0,
      total_amount: totalAmount,
      delivery_skipped: order.no_rider ?? false,
      status: newStatus,
      price_revision_count: (order.price_revision_count ?? 0) + 1,
      updated_at: new Date().toISOString(),
    }

    if (needsInsuranceReapproval) {
      // Invalidate the previous approval so insurance must review fresh
      orderUpdatePayload.insurance_approval_ref = null
      orderUpdatePayload.insurance_approved_by_name = null
      orderUpdatePayload.insurance_approved_at = null
      orderUpdatePayload.insurance_approval_snapshot = null
      orderUpdatePayload.needs_reapproval = true
    } else if (wasInsuranceApproved && !needsInsuranceReapproval) {
      // Approval still valid — only cash items changed, clear the flag
      orderUpdatePayload.needs_reapproval = false
    }

    // Bug 2 fix: delivery_fee is NOT written at pharmacy pricing time.
    // It stays 0 and is set to DELIVERY_FEE (10,000 UGX) only when a rider accepts.
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

    // Build human-readable notes for the audit trail
    const historyNotes = (() => {
      if (isCashOrder) return 'Pricing set (cash order)'
      if (wasInsuranceApproved && needsInsuranceReapproval)
        return 'Insured items modified — sent back to insurance for re-approval'
      if (wasInsuranceApproved && !needsInsuranceReapproval)
        return 'Cash items updated — sent directly to customer (insurance approval unchanged)'
      return 'Pricing set — sent to insurance for approval'
    })()

    // Add status history so DB trigger fires the notification
    await supabase.from('order_status_history').insert({
      order_id: order.id,
      status: newStatus,
      changed_by_role: 'pharmacist',
      notes: historyNotes,
    })

    // Success notification with context-aware message
    const successMessage = (() => {
      if (isCashOrder) return 'Customer notified to review and confirm.'
      if (wasInsuranceApproved && needsInsuranceReapproval)
        return 'Insured items changed — sent back to insurance for re-approval.'
      if (wasInsuranceApproved && !needsInsuranceReapproval)
        return 'Only cash items changed — customer notified directly. Insurance approval preserved.'
      return 'Sent to insurance for approval.'
    })()

    notifications.show({
      title: needsInsuranceReapproval
        ? '⚠️ Sent to Insurance'
        : '✅ Pricing saved',
      message: successMessage,
      color: needsInsuranceReapproval ? 'orange' : 'teal',
    })
    setSavingPricing(false)
    fetchOrder()
  }

  //  Update status
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

    // Notify the customer — include reason in body for rejected/cancelled
    const updatedOrder: DbOrder = {
      ...order,
      status,
      ...(reason ? { cancellation_reason: reason } : {}),
    }
    if (reason && (status === 'rejected' || status === 'cancelled')) {
      // Override the notification body to include the reason
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

  // Bug 4: Walk-in OTP verification — calls the same RPC used by the rider scanner
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
    // OTP verified — RPC already set status to 'delivered'
    notifications.show({
      title: '✅ Walk-in handover confirmed',
      message: 'OTP verified. Order marked as delivered.',
      color: 'teal',
    })
    setWalkinOtpModalOpen(false)
    setWalkinOtpInput('')
    // Insert status history entry for audit trail
    await supabase.from('order_status_history').insert({
      order_id: order.id,
      status: 'delivered',
      changed_by_role: 'pharmacist',
      notes: 'Walk-in handover — OTP verified by pharmacist at counter',
    })
    fetchOrder()
  }

  //  Dispatch
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

    // ── No Rider / Walk-in path ──────────────────────────────────────────────
    if (isNoRider) {
      await supabase
        .from('orders')
        .update({
          no_rider: true,
          rider_declined_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.id)
      // Skip dispatched, go straight to out_for_delivery
      await updateStatus('out_for_delivery' as OrderStatus)
      notifications.show({
        title: '✅ Walk-in confirmed',
        message:
          'Order is out for delivery — no rider assigned. Mark as delivered when done.',
        color: 'violet',
      })
      setAssigning(false)
      setSelectedRider(null)
      fetchDeliveryData()
      return
    }

    // ── Normal rider / broadcast path ────────────────────────────────────────
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

    const { error: reqErr } = await supabase.from('delivery_requests').insert(
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

    // Clear decline flags and record dispatch type when re-dispatching
    const { error: orderUpdateErr } = await supabase
      .from('orders')
      .update({
        rider_declined_at: null,
        declined_rider_name: null,
        dispatch_is_broadcast: isBroadcast,
        // Set a 5-minute timeout for broadcast dispatches
        broadcast_timeout_at: isBroadcast
          ? new Date(Date.now() + BROADCAST_TIMEOUT_SECS * 1000).toISOString()
          : null,
      })
      .eq('id', order.id)

    if (orderUpdateErr) {
      console.error('confirmDispatch order update error:', orderUpdateErr)
    }

    // ⚠️ Do NOT change order status here.
    // Status stays 'packing' until a rider accepts the request.
    // acceptRequest on the delivery side will move it to 'dispatched'.

    notifications.show({
      title: isBroadcast ? '📡 Broadcast sent!' : '🚴 Rider notified!',
      message: isBroadcast
        ? `${staffToNotify.length} rider(s) notified — waiting for acceptance.`
        : `${staffToNotify[0].name} has been sent the delivery request. Waiting for acceptance.`,
      color: 'teal',
    })

    setAssigning(false)
    setSelectedRider(null)
    fetchDeliveryData()
  }

  //  Render guards
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

  //  Derived values (all medications — delivery is a fixed separate line)
  const subtotal = meds
    .filter((m) => m.in_stock)
    .reduce((s, m) => s + m.unit_price * m.quantity, 0)

  // Bug 2 fix: delivery fee (10,000 UGX) is only applied after a rider accepts.
  // We show it in the pharmacy summary only once the order is dispatched/out_for_delivery/delivered.
  // For cash orders it is included in total_amount at pricing time (no insurance to cover it).
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

  // For insured meds that have been approved (approved_qty != null),
  // insurance only covers the approved portion — the remainder is cash.
  // For meds still pending approval (approved_qty == null), use full quantity as preview.
  const insuredMedAmountPreview = meds
    .filter((m) => m.is_insured && m.in_stock)
    .reduce((s, m) => {
      const approvedQty = m.approved_qty ?? m.quantity
      return s + m.unit_price * approvedQty
    }, 0)

  // Cash portion = non-insured meds + the partial-qty remainder of insured meds
  const cashMedAmountPreview = meds
    .filter((m) => m.in_stock)
    .reduce((s, m) => {
      if (!m.is_insured) return s + m.unit_price * m.quantity
      // For partially-approved insured meds, the non-approved qty is cash
      const approvedQty = m.approved_qty ?? m.quantity
      const cashQty = m.quantity - approvedQty
      return s + m.unit_price * cashQty
    }, 0)

  // grandTotal: what customer ultimately pays
  // Cash order: cash meds + delivery (delivery not covered)
  // Insured order: cash med portion only (delivery covered by insurance once rider assigned)
  const grandTotal = isCashOrder
    ? cashMedAmountPreview + deliveryFee
    : cashMedAmountPreview
  const deliverySkippedLocal = !!order.no_rider

  // Staff can edit pricing during active pharmacy review, while waiting for insurance,
  // AND while waiting for customer confirmation (pharmacist may need to correct errors).
  const canSetPricing =
    order.status === 'pharmacy_review' ||
    order.status === 'pricing_ready' ||
    order.status === 'awaiting_confirmation'

  // Show pricing summary totals once pricing has been submitted at least once
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

  // Is this a manual-rider dispatch (not broadcast)?
  const isManualDispatch = order.dispatch_is_broadcast === false
  // Manual: show named-rider declined alert immediately when that one rider declines
  const manualRiderDeclined =
    order.status === 'packing' &&
    !!order.rider_declined_at &&
    isManualDispatch &&
    !!order.declined_rider_name
  // Broadcast: show "all declined / timed out" alert only when nothing is pending
  const broadcastAllDeclined =
    order.status === 'packing' &&
    !!order.rider_declined_at &&
    order.dispatch_is_broadcast === true

  const riderJustDeclined = manualRiderDeclined || broadcastAllDeclined

  // Show broadcast countdown when: packing, broadcast was sent, no acceptance yet, timer running
  const showBroadcastCountdown =
    order.status === 'packing' &&
    order.dispatch_is_broadcast === true &&
    !hasAcceptedRider &&
    !order.rider_declined_at &&
    broadcastSecsLeft !== null &&
    broadcastSecsLeft > 0

  // Show assignment panel whenever status is 'packing'
  // (status stays 'packing' until a rider accepts, so panel always shows while waiting)
  const showAssignPanel = order.status === 'packing'

  return (
    <PharmacySidebarLayout>
      <Box style={{ width: '100%', padding: '2rem' }}>
        <Button
          variant="subtle"
          color="lotusCyan"
          leftSection={<TbArrowLeft size={16} />}
          onClick={() => navigate('/pharmacy/dashboard')}
          mb="lg"
        >
          Back to Dashboard
        </Button>

        {/*  Order Chats — customer always visible; insurance open after pricing_ready;
              rider open once a rider has accepted. Input + WebSocket closed when disabled. */}
        {!['cancelled', 'rejected'].includes(order.status) &&
          staffInfo &&
          (() => {
            const isDelivered = order.status === 'delivered'

            // Insurance thread: visible from pricing_ready onward
            const INSURANCE_OPEN_STATUSES: string[] = [
              'pricing_ready',
              'awaiting_confirmation',
              'confirmed',
              'packing',
              'dispatched',
              'out_for_delivery',
              'delivered',
            ]
            const showInsuranceTab =
              !order.cash_only && INSURANCE_OPEN_STATUSES.includes(order.status)
            const insuranceChatActive = showInsuranceTab && !isDelivered

            // Rider thread: tab only appears once a rider has accepted; hidden before that
            const showRiderTab = hasAcceptedRider
            const riderChatActive = showRiderTab && !isDelivered

            // Customer thread: always visible while order exists
            const customerChatActive = !isDelivered

            return (
              <ContentCard
                style={{ padding: 0, overflow: 'hidden', marginBottom: 24 }}
              >
                <Tabs
                  defaultValue="customer"
                  color="lotusCyan"
                  styles={{
                    list: {
                      borderBottom: '1px solid #EEF2F8',
                      paddingLeft: 12,
                    },
                    tab: { fontFamily: "'DM Sans',sans-serif", fontSize: 13 },
                  }}
                >
                  <Tabs.List>
                    <Tabs.Tab value="customer">Customer</Tabs.Tab>
                    {showInsuranceTab && (
                      <Tabs.Tab value="insurance">Insurance</Tabs.Tab>
                    )}
                    {showRiderTab && <Tabs.Tab value="rider">Rider</Tabs.Tab>}
                  </Tabs.List>
                  <Tabs.Panel value="customer">
                    <OrderChatPanel
                      orderId={order.id}
                      senderId={staffInfo.id}
                      senderName={staffInfo.name}
                      senderType="pharmacy"
                      chatThread="customer"
                      placeholder="Reply to customer…"
                      height={260}
                      disabled={!customerChatActive}
                    />
                  </Tabs.Panel>
                  {showInsuranceTab && (
                    <Tabs.Panel value="insurance">
                      <OrderChatPanel
                        orderId={order.id}
                        senderId={staffInfo.id}
                        senderName={staffInfo.name}
                        senderType="pharmacy"
                        chatThread="insurance"
                        placeholder="Message insurance staff…"
                        height={260}
                        disabled={!insuranceChatActive}
                      />
                    </Tabs.Panel>
                  )}
                  {showRiderTab && (
                    <Tabs.Panel value="rider">
                      <OrderChatPanel
                        orderId={order.id}
                        senderId={staffInfo.id}
                        senderName={staffInfo.name}
                        senderType="pharmacy"
                        chatThread="rider"
                        placeholder="Message rider…"
                        height={260}
                        disabled={!riderChatActive}
                      />
                    </Tabs.Panel>
                  )}
                </Tabs>
              </ContentCard>
            )
          })()}

        {/*  Info cards  */}
        <Group
          gap="md"
          mb="xl"
          wrap="wrap"
        >
          <ContentCard
            style={{
              flex: 1,
              minWidth: 200,
              cursor: 'pointer',
              transition: 'box-shadow 0.15s',
              border: `1.5px solid ${SavedColors.DemWhite}`,
            }}
            onClick={() =>
              order.user_id && navigate(`/pharmacy/customer/${order.user_id}`)
            }
          >
            <Group
              justify="space-between"
              align="flex-start"
            >
              <Box>
                <Text
                  size="xs"
                  c="dimmed"
                  mb={4}
                >
                  Patient
                </Text>
                <Text fw={700}>
                  {(order.profiles as { name?: string } | null)?.name ?? '—'}
                </Text>
                <Text
                  size="xs"
                  c="dimmed"
                >
                  {
                    (order.profiles as { relationship?: string } | null)
                      ?.relationship
                  }
                </Text>
                {(order.profiles as { is_chronic?: boolean } | null)
                  ?.is_chronic && (
                  <Badge
                    size="xs"
                    color="red"
                    variant="light"
                    mt={4}
                    leftSection={<TbUser size={10} />}
                  >
                    Chronic
                  </Badge>
                )}
              </Box>
              <TbUser
                size={16}
                color={SavedColors.Primaryblue}
                style={{ marginTop: 2, flexShrink: 0 }}
              />
            </Group>
            <Text
              size="xs"
              c={SavedColors.Primaryblue}
              mt={8}
              fw={600}
            >
              View Profile{' '}
            </Text>
          </ContentCard>
          <ContentCard style={{ flex: 1, minWidth: 200 }}>
            <Text
              size="xs"
              c="dimmed"
              mb={4}
            >
              Order Status
            </Text>
            <Badge
              color={statusColor(order.status)}
              size="lg"
            >
              {statusLabel(order.status, order.payment_method)}
            </Badge>
          </ContentCard>
          {/* Payment type card — replaces insurance card for cash orders */}
          <ContentCard style={{ flex: 1, minWidth: 200 }}>
            <Text
              size="xs"
              c="dimmed"
              mb={4}
            >
              Payment Type
            </Text>
            {order.cash_only ? (
              <Group gap={6}>
                <TbCurrencyDollar
                  size={18}
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
                  mb={4}
                >
                  {insuranceVerified ? (
                    <TbShieldCheck
                      size={18}
                      color="#12B76A"
                    />
                  ) : (
                    <TbShieldOff
                      size={18}
                      color={
                        insuranceStatus === 'rejected' ? '#EF4444' : '#9ca3af'
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
                        Approval Ref: {order.insurance_approval_ref}
                      </Text>
                    )}
                    {insuranceProviderPhone && (
                      <Group
                        gap={4}
                        mt={4}
                      >
                        <TbPhone
                          size={13}
                          color="#012970"
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
          </ContentCard>
        </Group>

        {/* ── Delivery address + order time card ── */}
        {(order.delivery_address_snapshot ||
          order.no_rider ||
          order.created_at ||
          order.contact_phone) && (
          <ContentCard mb="xl">
            <Group
              gap={8}
              mb={10}
            >
              <TbTruck
                size={15}
                color={SavedColors.Primaryblue}
              />
              <Text
                fw={700}
                size="sm"
                c={SavedColors.TextColor}
              >
                Order Details
              </Text>
            </Group>
            <Stack gap={6}>
              {order.created_at && (
                <Group gap={8}>
                  <TbClock
                    size={13}
                    color="#9ca3af"
                    style={{ flexShrink: 0 }}
                  />
                  <Text
                    size="xs"
                    c="dimmed"
                    style={{ minWidth: 80 }}
                  >
                    Ordered
                  </Text>
                  <Text
                    size="xs"
                    fw={600}
                    c={SavedColors.TextColor}
                  >
                    {new Date(order.created_at).toLocaleString('en-UG', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </Group>
              )}
              {order.delivery_address_snapshot ? (
                <Group
                  gap={8}
                  align="flex-start"
                >
                  <Box style={{ width: 13, flexShrink: 0, marginTop: 2 }}>
                    <TbMapPin
                      size={13}
                      color="#9ca3af"
                    />
                  </Box>
                  <Text
                    size="xs"
                    c="dimmed"
                    style={{ minWidth: 80 }}
                  >
                    Address
                  </Text>
                  <Box style={{ flex: 1 }}>
                    {(order.delivery_address_snapshot as { label?: string })
                      .label && (
                      <Text
                        size="xs"
                        fw={700}
                        c={SavedColors.TextColor}
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
                    {(order.delivery_address_snapshot as { street?: string })
                      .street && (
                      <Text
                        size="xs"
                        c={SavedColors.TextColor}
                      >
                        {
                          (
                            order.delivery_address_snapshot as {
                              street?: string
                            }
                          ).street
                        }
                      </Text>
                    )}
                    {((order.delivery_address_snapshot as { city?: string })
                      .city ||
                      (order.delivery_address_snapshot as { zone?: string })
                        .zone) && (
                      <Text
                        size="xs"
                        c="dimmed"
                      >
                        {[
                          (order.delivery_address_snapshot as { city?: string })
                            .city,
                          (order.delivery_address_snapshot as { zone?: string })
                            .zone,
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
                  </Box>
                </Group>
              ) : order.no_rider ? (
                <Group gap={8}>
                  <TbMapPin
                    size={13}
                    color="#9ca3af"
                    style={{ flexShrink: 0 }}
                  />
                  <Text
                    size="xs"
                    c="dimmed"
                    style={{ minWidth: 80 }}
                  >
                    Delivery
                  </Text>
                  <Badge
                    size="xs"
                    color="violet"
                    variant="light"
                  >
                    In-store pickup
                  </Badge>
                </Group>
              ) : null}
              {order.contact_phone && (
                <Group gap={8}>
                  <TbPhone
                    size={13}
                    color="#9ca3af"
                    style={{ flexShrink: 0 }}
                  />
                  <Text
                    size="xs"
                    c="dimmed"
                    style={{ minWidth: 80 }}
                  >
                    Contact
                  </Text>
                  <Text
                    size="xs"
                    fw={600}
                    c={SavedColors.Primaryblue}
                    component="a"
                    href={`tel:${order.contact_phone}`}
                    style={{ textDecoration: 'none' }}
                  >
                    {order.contact_phone}
                  </Text>
                </Group>
              )}
            </Stack>
          </ContentCard>
        )}

        {/* Cash-only banner — shown instead of insurance alerts */}
        {order.cash_only ? (
          <Alert
            color="orange"
            icon={<TbCurrencyDollar size={16} />}
            mb="lg"
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
              The customer chose to pay in full. All medications must be priced
              as cash pay.
            </Text>
          </Alert>
        ) : (
          <>
            {insuranceStatus === 'pending' && (
              <Alert
                color="yellow"
                icon={<TbAlertCircle size={16} />}
                mb="lg"
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
                  You cannot apply insurance coverage until verification is
                  complete.
                </Text>
              </Alert>
            )}
            {insuranceStatus === 'rejected' && (
              <Alert
                color="red"
                icon={<TbShieldOff size={16} />}
                mb="lg"
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
                icon={<TbShieldOff size={16} />}
                mb="lg"
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
                icon={<TbAlertCircle size={16} />}
                mb="lg"
                style={{ borderWidth: 2, borderColor: '#fca5a5' }}
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
                  Insured items were changed after insurance approval. This
                  order must be resubmitted to insurance before the customer can
                  confirm.
                </Text>
              </Alert>
            )}
          </>
        )}

        {/*  Prescription / Medicine Order viewer  */}
        {/* Show medicine names banner for cash+text orders with no image */}
        {!prescriptionSignedUrl && order.medicine_names && (
          <ContentCard style={{ marginBottom: 24 }}>
            <Group
              gap={8}
              mb="sm"
            >
              <Text
                fw={700}
                c={SavedColors.TextColor}
                size="sm"
              >
                Medicine Order (Text)
              </Text>
              <Badge
                color="orange"
                variant="light"
                size="sm"
                leftSection={<TbNotes size={11} />}
              >
                No Image — Customer typed medicines
              </Badge>
            </Group>
            <Box
              style={{
                background: 'linear-gradient(135deg,#fff7ed,#ffedd5)',
                border: '2px solid #fb923c',
                borderRadius: 10,
                padding: '14px 16px',
              }}
            >
              <Text
                size="xs"
                fw={700}
                c="#9a3412"
                mb={6}
                style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}
              >
                Medicines requested by customer
              </Text>
              <Text
                size="sm"
                fw={600}
                c="#7c2d12"
                lh={1.7}
                style={{ whiteSpace: 'pre-wrap' }}
              >
                {order.medicine_names}
              </Text>
            </Box>
            {(order as { prescription_notes?: string }).prescription_notes && (
              <PrescriptionNoteBanner
                style={{ marginTop: 12, marginBottom: 0 }}
              >
                <Box
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    flexShrink: 0,
                    background: 'linear-gradient(135deg,#3b82f6,#1d4ed8)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <TbNotes
                    size={20}
                    color="#fff"
                  />
                </Box>
                <Box style={{ flex: 1 }}>
                  <Group
                    gap={6}
                    mb={4}
                  >
                    <Text
                      size="sm"
                      fw={800}
                      c="#1d4ed8"
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
                    c="#1e3a5f"
                    lh={1.6}
                  >
                    {
                      (order as { prescription_notes?: string })
                        .prescription_notes
                    }
                  </Text>
                </Box>
              </PrescriptionNoteBanner>
            )}
          </ContentCard>
        )}

        {prescriptionSignedUrl && (
          <ContentCard style={{ marginBottom: 24 }}>
            <Text
              fw={700}
              c={SavedColors.TextColor}
              size="sm"
              mb="sm"
            >
              {order.medicine_names
                ? 'Prescription Image + Medicine Names'
                : 'Prescription'}
            </Text>
            {/* Show medicine names alongside the image if both exist */}
            {order.medicine_names && (
              <Box
                style={{
                  background: 'linear-gradient(135deg,#fff7ed,#ffedd5)',
                  border: '2px solid #fb923c',
                  borderRadius: 10,
                  padding: '12px 14px',
                  marginBottom: 12,
                }}
              >
                <Text
                  size="xs"
                  fw={700}
                  c="#9a3412"
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
                  c="#7c2d12"
                  lh={1.7}
                  style={{ whiteSpace: 'pre-wrap' }}
                >
                  {order.medicine_names}
                </Text>
              </Box>
            )}
            {(order as { prescription_notes?: string }).prescription_notes && (
              <PrescriptionNoteBanner>
                <Box
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    flexShrink: 0,
                    background: 'linear-gradient(135deg,#3b82f6,#1d4ed8)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <TbNotes
                    size={20}
                    color="#fff"
                  />
                </Box>
                <Box style={{ flex: 1 }}>
                  <Group
                    gap={6}
                    mb={4}
                  >
                    <Text
                      size="sm"
                      fw={800}
                      c="#1d4ed8"
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
                    c="#1e3a5f"
                    lh={1.6}
                  >
                    {
                      (order as { prescription_notes?: string })
                        .prescription_notes
                    }
                  </Text>
                </Box>
              </PrescriptionNoteBanner>
            )}
            <PrescriptionViewer
              src={prescriptionSignedUrl}
              signedUrl={prescriptionSignedUrl}
              allSignedUrls={allSignedUrls}
            />
          </ContentCard>
        )}

        {/*  Insurance rejection banner — shown when insurance returned order with a reason */}
        {order.status === 'pharmacy_review' &&
          (order as { rejection_reason?: string }).rejection_reason && (
            <InsuranceRejectionBanner>
              <Box
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  flexShrink: 0,
                  background: 'linear-gradient(135deg,#ef4444,#b91c1c)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(239,68,68,0.4)',
                }}
              >
                <TbShieldOff
                  size={22}
                  color="#fff"
                />
              </Box>
              <Box style={{ flex: 1 }}>
                <Group
                  gap={8}
                  mb={6}
                >
                  <Text
                    size="sm"
                    fw={800}
                    c="#b91c1c"
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
                  c="#7f1d1d"
                  lh={1.6}
                  style={{
                    background: 'rgba(255,255,255,0.6)',
                    borderRadius: 8,
                    padding: '8px 12px',
                    border: '1px solid rgba(239,68,68,0.3)',
                  }}
                >
                  {(order as { rejection_reason?: string }).rejection_reason}
                </Text>
                <Text
                  size="xs"
                  c="#b91c1c"
                  mt={8}
                  fw={600}
                >
                  Please review the reason above, update the pricing
                  accordingly, then re-save to resubmit to insurance.
                </Text>
              </Box>
            </InsuranceRejectionBanner>
          )}

        {/*  Customer "Request Changes" message banner  */}
        {order.pharmacy_notes?.startsWith('[Customer requested changes]:') && (
          <CustomerMessageBanner>
            <Box
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                flexShrink: 0,
                background: 'linear-gradient(135deg,#f59e0b,#d97706)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(245,158,11,0.4)',
              }}
            >
              <TbMessageCircle
                size={22}
                color="#fff"
              />
            </Box>
            <Box style={{ flex: 1 }}>
              <Group
                gap={8}
                mb={6}
              >
                <Text
                  size="sm"
                  fw={800}
                  c="#92400e"
                >
                  {' '}
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
                c="#78350f"
                lh={1.6}
                style={{
                  background: 'rgba(255,255,255,0.6)',
                  borderRadius: 8,
                  padding: '8px 12px',
                  border: '1px solid rgba(245,158,11,0.3)',
                }}
              >
                {order.pharmacy_notes.replace(
                  '[Customer requested changes]: ',
                  '',
                )}
              </Text>
              <Text
                size="xs"
                c="#92400e"
                mt={8}
                fw={600}
              >
                Please review the pricing below and update accordingly, then
                re-save to notify the customer.
              </Text>
            </Box>
          </CustomerMessageBanner>
        )}

        {/*  Insurance Approval card  */}
        {order.insurance_approval_ref && (
          <Box
            mb={24}
            p="md"
            style={{
              background: '#fff',
              borderRadius: 12,
              border: '1.5px solid #d1fae5',
              display: 'flex',
              alignItems: 'center',
              gap: 14,
            }}
          >
            <Box
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: 'linear-gradient(135deg,#10b981,#059669)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <TbShieldCheck
                size={20}
                color="#fff"
              />
            </Box>
            <Box style={{ flex: 1, minWidth: 0 }}>
              <Text
                size="xs"
                c="dimmed"
                fw={600}
                style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}
              >
                Insurance Approval
              </Text>
              <Text
                size="sm"
                fw={800}
                c="#065f46"
                style={{
                  fontFamily: "'DM Sans',sans-serif",
                  letterSpacing: '0.04em',
                }}
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

        {/*  Medications & Pricing  */}
        <ContentCard style={{ marginBottom: 24 }}>
          <Group
            justify="space-between"
            mb="md"
          >
            <Text
              fw={700}
              c={SavedColors.TextColor}
            >
              Medications & Pricing
            </Text>
            {order.cash_only ? (
              <Badge
                color="orange"
                variant="light"
                leftSection={<TbCurrencyDollar size={12} />}
              >
                Cash-only order — no insurance coverage
              </Badge>
            ) : insuranceVerified ? (
              <Badge
                color="teal"
                variant="light"
                leftSection={<TbShieldCheck size={12} />}
              >
                Insurance verified — coverage available
              </Badge>
            ) : (
              <Badge
                color="orange"
                variant="light"
                leftSection={<TbShieldOff size={12} />}
              >
                Verify insurance to apply coverage
              </Badge>
            )}
          </Group>

          {meds.length === 0 && canSetPricing && (
            <Alert
              color="blue"
              variant="light"
              icon={<TbAlertCircle size={14} />}
              mb="md"
            >
              <Text size="sm">
                {order.medicine_names
                  ? "No medications added yet. Use the customer's typed medicine list above to add and price each item."
                  : 'No medications yet. Add medications from the prescription above.'}
              </Text>
            </Alert>
          )}

          <Box style={{ overflowX: 'auto' }}>
            <Table striped>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Medication</Table.Th>
                  <Table.Th>Dosage</Table.Th>
                  <Table.Th>Days</Table.Th>
                  <Table.Th>Freq/day</Table.Th>
                  <Table.Th>Qty</Table.Th>
                  <Table.Th>Unit Price (UGX)</Table.Th>
                  <Table.Th>Coverage</Table.Th>
                  <Table.Th>Subtotal</Table.Th>
                  {canSetPricing && <Table.Th />}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {meds.map((med) => {
                  const isEditing = editingId === med.id
                  return (
                    <Table.Tr
                      key={med.id}
                      style={{
                        opacity: med.in_stock ? 1 : 0.5,
                        background: isEditing ? '#f0fdf4' : undefined,
                      }}
                    >
                      <Table.Td>
                        {isEditing && med.isNew && !med.is_delivery ? (
                          <TextInput
                            value={med.name}
                            onChange={(e) => updateName(med.id, e.target.value)}
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
                      </Table.Td>
                      <Table.Td>
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
                      </Table.Td>
                      <Table.Td>
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
                      </Table.Td>
                      <Table.Td>
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
                      </Table.Td>
                      <Table.Td>
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
                      </Table.Td>
                      <Table.Td>
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
                      </Table.Td>
                      <Table.Td>
                        {isEditing ? (
                          <Tooltip
                            label="Cash-only order — insurance not applicable"
                            disabled={!order.cash_only}
                          >
                            <span>
                              <Button
                                size="xs"
                                variant={med.is_insured ? 'filled' : 'outline'}
                                color={med.is_insured ? 'teal' : 'gray'}
                                disabled={order.cash_only}
                                onClick={() =>
                                  toggleInsured(med.id, !med.is_insured)
                                }
                                leftSection={
                                  med.is_insured ? (
                                    <TbShieldCheck size={12} />
                                  ) : (
                                    <TbShieldOff size={12} />
                                  )
                                }
                              >
                                {med.is_insured ? 'Insured' : 'Cash Pay'}
                              </Button>
                            </span>
                          </Tooltip>
                        ) : /* Not editing — show actual insurance/approval status */
                        !med.is_insured ? (
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
                      </Table.Td>
                      <Table.Td>
                        {med.is_insured ? (
                          (() => {
                            const aqty = med.approved_qty
                            const status = med.approval_status
                            // Not yet approved — just show covered
                            if (aqty == null || status === 'pending') {
                              return (
                                <Badge
                                  size="xs"
                                  color="teal"
                                  variant="light"
                                >
                                  Covered
                                </Badge>
                              )
                            }
                            // Fully approved
                            if (status === 'approved') {
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
                                    {aqty} × UGX{' '}
                                    {med.unit_price.toLocaleString()} = UGX{' '}
                                    {(aqty * med.unit_price).toLocaleString()}
                                  </Text>
                                </Stack>
                              )
                            }
                            // Partially approved
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
                                    Ins: {aqty} × UGX{' '}
                                    {med.unit_price.toLocaleString()} = UGX{' '}
                                    {(aqty * med.unit_price).toLocaleString()}
                                  </Text>
                                  <Text
                                    size="xs"
                                    c="orange"
                                    fw={600}
                                  >
                                    Cash: {cashQty} × UGX{' '}
                                    {med.unit_price.toLocaleString()} = UGX{' '}
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
                            // Rejected
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
                      </Table.Td>
                      {canSetPricing && (
                        <Table.Td>
                          <Group
                            gap={4}
                            wrap="nowrap"
                          >
                            {isEditing ? (
                              <>
                                <Button
                                  size="xs"
                                  color="green"
                                  variant="light"
                                  onClick={() => setEditingId(null)}
                                >
                                  Done
                                </Button>
                              </>
                            ) : (
                              <Button
                                size="xs"
                                variant="subtle"
                                color="blue"
                                onClick={() => setEditingId(med.id)}
                                disabled={
                                  editingId !== null && editingId !== med.id
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
                                if (editingId === med.id) setEditingId(null)
                                removeMedRow(med.id)
                              }}
                            >
                              <TbTrash size={14} />
                            </Button>
                          </Group>
                        </Table.Td>
                      )}
                    </Table.Tr>
                  )
                })}
              </Table.Tbody>
            </Table>
          </Box>

          {canSetPricing && (
            <Group
              gap="xs"
              mt="sm"
            >
              <Button
                variant="subtle"
                color="lotusCyan"
                size="sm"
                leftSection={<TbPlus size={14} />}
                onClick={addMedRow}
              >
                Add Medication
              </Button>
            </Group>
          )}

          {/* Only show summary totals when pricing has been submitted at least once */}
          {pricingSummaryVisible &&
            (() => {
              // Bug 2 fix: delivery fee is only shown after a rider has accepted.
              // For insured orders: insurance covers meds (+ delivery once rider assigned).
              // For cash orders: delivery fee is always included in total.
              //
              // Formula:
              //   Subtotal (meds)
              // + Delivery fee          ← only shown once rider accepted (or cash order)
              // − Insurance covers      ← insured med portion only (delivery shown separately)
              // = Customer Pays

              // Insurance coverage = insured med amount only (delivery handled separately)
              const insuredCoveragePreview = isCashOrder
                ? 0
                : insuredMedAmountPreview

              const hasPartialApproval = meds.some(
                (m) => m.is_insured && m.approval_status === 'partial',
              )
              return (
                <>
                  <Divider my="md" />
                  <Group justify="flex-end">
                    <Stack
                      gap={4}
                      align="flex-end"
                    >
                      <Group gap="xl">
                        <Text
                          size="sm"
                          c="dimmed"
                        >
                          Subtotal (medications)
                        </Text>
                        <Text
                          size="sm"
                          fw={600}
                        >
                          UGX {subtotal.toLocaleString()}
                        </Text>
                      </Group>
                      {/* Delivery fee row — hidden entirely for walk-in/no-rider orders */}
                      {deliverySkippedLocal ? (
                        <Group gap="xl">
                          <Text
                            size="sm"
                            c="dimmed"
                          >
                            Delivery
                          </Text>
                          <Badge
                            size="sm"
                            color="violet"
                            variant="light"
                          >
                            In-store pickup — no fee
                          </Badge>
                        </Group>
                      ) : riderHasAccepted ? (
                        /* Rider accepted — show the actual delivery fee */
                        <Group gap="xl">
                          <Text
                            size="sm"
                            c="dimmed"
                          >
                            Delivery fee{' '}
                            {!isCashOrder && '(covered by insurance)'}
                          </Text>
                          <Text
                            size="sm"
                            fw={600}
                            c={!isCashOrder ? 'teal' : undefined}
                          >
                            UGX {DELIVERY_FEE.toLocaleString()}
                          </Text>
                        </Group>
                      ) : (
                        /* No rider yet — show flat fee */
                        <Group gap="xl">
                          <Text
                            size="sm"
                            c="dimmed"
                          >
                            Delivery fee
                          </Text>
                          <Text
                            size="sm"
                            fw={600}
                          >
                            UGX {DELIVERY_FEE.toLocaleString()}
                          </Text>
                        </Group>
                      )}
                      {insuredCoveragePreview > 0 && (
                        <Group gap="xl">
                          <Text
                            size="sm"
                            c="teal"
                          >
                            Insurance covers (
                            {hasPartialApproval
                              ? 'approved qty'
                              : 'insured meds'}
                            )
                          </Text>
                          <Text
                            size="sm"
                            fw={600}
                            c="teal"
                          >
                            − UGX {insuredCoveragePreview.toLocaleString()}
                          </Text>
                        </Group>
                      )}
                      {order.insurance_approval_ref && (
                        <Group gap="xl">
                          <Text
                            size="xs"
                            c="dimmed"
                          >
                            Approval Ref
                          </Text>
                          <Text
                            size="xs"
                            fw={700}
                            c="teal"
                          >
                            {order.insurance_approval_ref}
                          </Text>
                        </Group>
                      )}
                      <Divider style={{ width: '100%' }} />
                      <Group gap="xl">
                        <Text fw={700}>Customer Pays</Text>
                        <Text
                          fw={800}
                          size="xl"
                          c={
                            grandTotal === 0 ? 'teal' : SavedColors.Primaryblue
                          }
                        >
                          {grandTotal === 0
                            ? 'UGX 0 (Fully Covered)'
                            : `UGX ${grandTotal.toLocaleString()}`}
                        </Text>
                      </Group>
                    </Stack>
                  </Group>
                </>
              )
            })()}

          {/* Smart routing preview — shown when editing a previously-approved insured order */}
          {canSetPricing &&
            !!order.insurance_approval_ref &&
            !order.cash_only &&
            (() => {
              const dbMeds = (order.medications ?? []) as MedRow[]
              const dbMedMap = new Map(dbMeds.map((m) => [m.id, m]))
              const insuredChanged =
                dbMeds.some(
                  (dbMed) =>
                    dbMed.is_insured && !meds.find((m) => m.id === dbMed.id),
                ) ||
                meds.some((m) => m.isNew && m.is_insured) ||
                meds.some((m) => {
                  if (m.isNew) return false
                  const orig = dbMedMap.get(m.id)
                  if (!orig) return false
                  if (orig.is_insured || m.is_insured) {
                    return (
                      orig.unit_price !== m.unit_price ||
                      orig.quantity !== m.quantity ||
                      orig.is_insured !== m.is_insured
                    )
                  }
                  return false
                })
              return (
                <Alert
                  color={insuredChanged ? 'orange' : 'teal'}
                  variant="light"
                  icon={
                    insuredChanged ? (
                      <TbShieldBolt size={14} />
                    ) : (
                      <TbShieldCheck size={14} />
                    )
                  }
                  mt="md"
                  mb={4}
                >
                  <Text
                    size="sm"
                    fw={700}
                  >
                    {insuredChanged
                      ? '⚠️ Insured items changed — will be sent back to insurance for re-approval'
                      : '✅ Only cash items changed — will go directly to customer (insurance approval preserved)'}
                  </Text>
                  <Text
                    size="xs"
                    mt={2}
                    c="dimmed"
                  >
                    {insuredChanged
                      ? 'You modified the unit price, quantity, or coverage of an insured medication. The previous approval will be cleared and insurance must re-approve before the customer can confirm.'
                      : 'Your changes only affect non-insured (cash) medications. The existing insurance approval remains valid and the customer will be notified directly.'}
                  </Text>
                </Alert>
              )
            })()}

          {/* Save pricing button — available in pharmacy_review and pricing_ready only */}
          {canSetPricing && (
            <Group
              justify="flex-end"
              mt="md"
            >
              {(() => {
                // Smart button label: predict where save will route
                const wasApproved =
                  !!order.insurance_approval_ref && !order.cash_only
                if (order.cash_only) {
                  return (
                    <Button
                      color="lotusCyan"
                      loading={savingPricing}
                      onClick={savePricing}
                      leftSection={<TbCheck size={16} />}
                      size="md"
                    >
                      Save Pricing &amp; Notify Customer
                    </Button>
                  )
                }
                if (wasApproved) {
                  // Detect if current edits affect insured items
                  const dbMeds = (order.medications ?? []) as MedRow[]
                  const dbMedMap = new Map(dbMeds.map((m) => [m.id, m]))
                  const insuredChanged =
                    dbMeds.some(
                      (dbMed) =>
                        dbMed.is_insured &&
                        !meds.find((m) => m.id === dbMed.id),
                    ) ||
                    meds.some((m) => m.isNew && m.is_insured) ||
                    meds.some((m) => {
                      if (m.isNew) return false
                      const orig = dbMedMap.get(m.id)
                      if (!orig) return false
                      if (orig.is_insured || m.is_insured) {
                        return (
                          orig.unit_price !== m.unit_price ||
                          orig.quantity !== m.quantity ||
                          orig.is_insured !== m.is_insured
                        )
                      }
                      return false
                    })
                  return insuredChanged ? (
                    <Button
                      color="orange"
                      loading={savingPricing}
                      onClick={savePricing}
                      leftSection={<TbShieldBolt size={16} />}
                      size="md"
                    >
                      Resubmit to Insurance (Insured Items Changed)
                    </Button>
                  ) : (
                    <Button
                      color="teal"
                      loading={savingPricing}
                      onClick={savePricing}
                      leftSection={<TbCheck size={16} />}
                      size="md"
                    >
                      Save &amp; Send to Customer (Cash Change Only)
                    </Button>
                  )
                }
                return (
                  <Button
                    color="lotusCyan"
                    loading={savingPricing}
                    onClick={savePricing}
                    leftSection={<TbCheck size={16} />}
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
            </Group>
          )}
        </ContentCard>

        {/* 
              DELIVERY ASSIGNMENT PANEL
              Shown when: packing  OR  dispatched + all requests failed
               */}
        {/* Task 16: Rider declined alert banner — smart manual vs broadcast variant */}
        {riderJustDeclined && (
          <ContentCard
            style={{
              marginBottom: 16,
              borderColor: '#fca5a5',
              borderWidth: 2,
              background: '#fef2f2',
            }}
          >
            <Group gap="md">
              <Box
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  flexShrink: 0,
                  background: '#ef4444',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <TbX
                  size={24}
                  color="#fff"
                />
              </Box>
              <Box style={{ flex: 1 }}>
                {manualRiderDeclined ? (
                  <>
                    <Text
                      fw={800}
                      size="md"
                      c="#b91c1c"
                    >
                      Rider Declined
                    </Text>
                    <Text
                      size="xs"
                      c="#991b1b"
                      mt={2}
                    >
                      <b>{order.declined_rider_name}</b> has declined this
                      order. Please assign a different rider below.
                    </Text>
                  </>
                ) : (
                  <>
                    <Text
                      fw={800}
                      size="md"
                      c="#b91c1c"
                    >
                      All Riders Declined / Timed Out
                    </Text>
                    <Text
                      size="xs"
                      c="#991b1b"
                      mt={2}
                    >
                      Every rider has declined or did not respond in time.
                      Please assign a new rider below to re-dispatch.
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
          </ContentCard>
        )}

        {/* Broadcast countdown timer — shown while waiting for any rider to accept */}
        {showBroadcastCountdown && broadcastSecsLeft !== null && (
          <ContentCard
            style={{
              marginBottom: 16,
              borderColor: '#fde68a',
              borderWidth: 2,
              background: '#fffbeb',
            }}
          >
            <Group gap="md">
              <Box
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  flexShrink: 0,
                  background: '#f59e0b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <TbClock
                  size={22}
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
                    c="#92400e"
                  >
                    Waiting for a Rider to Accept
                  </Text>
                  <Badge
                    color="yellow"
                    variant="filled"
                    size="sm"
                  >
                    {Math.floor(broadcastSecsLeft / 60)}:
                    {String(broadcastSecsLeft % 60).padStart(2, '0')} left
                  </Badge>
                </Group>
                <Text
                  size="xs"
                  c="#78350f"
                >
                  Broadcast sent to {deliveryRequests.length} rider
                  {deliveryRequests.length !== 1 ? 's' : ''}. If no one accepts
                  before the timer ends, you'll be prompted to re-assign.
                </Text>
              </Box>
            </Group>
          </ContentCard>
        )}

        {showAssignPanel && (
          <ContentCard
            id="rider-section"
            style={{
              marginBottom: 24,
              borderColor: `${SavedColors.Primaryblue}50`,
              borderWidth: 2,
            }}
          >
            {/* Step header */}
            <Group
              gap="md"
              mb="lg"
              pb="md"
              style={{ borderBottom: '1px solid #e8edf5' }}
            >
              <Box
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  flexShrink: 0,
                  background: 'linear-gradient(135deg,#15B3E0,#012970)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <TbTruck
                  size={22}
                  color="#fff"
                />
              </Box>
              <Box style={{ flex: 1 }}>
                <Group gap={8}>
                  <Text
                    fw={800}
                    size="md"
                    c={SavedColors.TextColor}
                  >
                    {allDeclinedOrExpired
                      ? 'Re-Assign Delivery Rider'
                      : 'Assign Delivery Rider'}
                  </Text>
                  {allDeclinedOrExpired && (
                    <Badge
                      color="orange"
                      variant="light"
                      size="sm"
                    >
                      All requests declined
                    </Badge>
                  )}
                </Group>
                <Text
                  size="xs"
                  c="dimmed"
                  mt={2}
                >
                  {allDeclinedOrExpired
                    ? 'All previous riders declined. Pick a new rider or broadcast again.'
                    : 'Select who will deliver this order. Status moves to \"Dispatched\" once the rider accepts.'}
                </Text>
              </Box>
            </Group>

            {deliveryStaff.length === 0 ? (
              <Alert
                color="orange"
                variant="light"
                icon={<TbAlertCircle size={14} />}
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
                    c={SavedColors.Primaryblue}
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigate('/pharmacy/users')}
                  >
                    User Management
                  </Text>{' '}
                  to add delivery staff before dispatching.
                </Text>
              </Alert>
            ) : (
              <Stack gap="sm">
                <Text
                  size="xs"
                  c="dimmed"
                  mb={4}
                >
                  Choose how to assign delivery — broadcast notifies all riders,
                  or pick a specific one:
                </Text>

                {/* Broadcast option */}
                {/* ── No Rider / Walk-in option — hidden ── */}
                {false && (
                  <RiderCard
                    $selected={selectedRider === '__no_rider__'}
                    onClick={() => setSelectedRider('__no_rider__')}
                    style={{
                      borderColor:
                        selectedRider === '__no_rider__'
                          ? '#7C3AED'
                          : undefined,
                      background:
                        selectedRider === '__no_rider__'
                          ? '#f5f3ff'
                          : undefined,
                    }}
                  >
                    <RadioDot
                      $selected={selectedRider === '__no_rider__'}
                      style={{
                        borderColor:
                          selectedRider === '__no_rider__'
                            ? '#7C3AED'
                            : undefined,
                        background:
                          selectedRider === '__no_rider__'
                            ? '#7C3AED'
                            : undefined,
                      }}
                    >
                      {selectedRider === '__no_rider__' && (
                        <Box
                          style={{
                            width: 7,
                            height: 7,
                            borderRadius: '50%',
                            background: '#fff',
                          }}
                        />
                      )}
                    </RadioDot>
                    <Box
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: '50%',
                        flexShrink: 0,
                        background: 'rgba(124,58,237,0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <TbUser
                        size={18}
                        color="#7C3AED"
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
                          c={SavedColors.TextColor}
                        >
                          No Rider / Walk-in
                        </Text>
                        <Badge
                          color="violet"
                          variant="light"
                          size="xs"
                        >
                          Skip Delivery
                        </Badge>
                      </Group>
                      <Text
                        size="xs"
                        c="dimmed"
                      >
                        Customer collects at the counter. An OTP is generated
                        and must be verified at handover — no rider needed.
                      </Text>
                    </Box>
                  </RiderCard>
                )}

                {false && (
                  <Divider
                    label="or assign a rider"
                    labelPosition="center"
                    my={4}
                  />
                )}

                <RiderCard
                  $selected={selectedRider === '__broadcast__'}
                  onClick={() => setSelectedRider('__broadcast__')}
                >
                  <RadioDot $selected={selectedRider === '__broadcast__'}>
                    {selectedRider === '__broadcast__' && (
                      <Box
                        style={{
                          width: 7,
                          height: 7,
                          borderRadius: '50%',
                          background: '#fff',
                        }}
                      />
                    )}
                  </RadioDot>
                  <Box
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: '50%',
                      flexShrink: 0,
                      background: 'linear-gradient(135deg,#15B3E0,#012970)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <TbBroadcast
                      size={18}
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
                        c={SavedColors.TextColor}
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

                {/* Individual rider cards */}
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
                            background: '#fff',
                          }}
                        />
                      )}
                    </RadioDot>
                    <Box
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: '50%',
                        flexShrink: 0,
                        background: s.is_active
                          ? SavedColors.lightBlue
                          : '#f3f4f6',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <TbUser
                        size={18}
                        color={
                          s.is_active ? SavedColors.Primaryblue : '#9ca3af'
                        }
                      />
                    </Box>
                    <Box style={{ flex: 1 }}>
                      <Text
                        size="sm"
                        fw={700}
                        c={s.is_active ? SavedColors.TextColor : '#9ca3af'}
                      >
                        {s.name}
                      </Text>
                      {s.phone && (
                        <Text
                          size="xs"
                          c="dimmed"
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

                {/* Confirm button */}
                <Group
                  justify="flex-end"
                  mt="sm"
                >
                  <Button
                    size="md"
                    color="lotusCyan"
                    loading={assigning}
                    disabled={!selectedRider}
                    leftSection={<TbTruck size={16} />}
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
          </ContentCard>
        )}

        {/*  Delivery Requests Tracker  */}
        {deliveryRequests.length > 0 && !showAssignPanel && (
          <ContentCard style={{ marginBottom: 24 }}>
            <Group
              gap="sm"
              mb="md"
            >
              <TbTruck
                size={18}
                color={SavedColors.Primaryblue}
              />
              <Text
                fw={700}
                c={SavedColors.TextColor}
              >
                Delivery Requests
              </Text>
              <Badge
                size="xs"
                color="lotusCyan"
                variant="light"
              >
                {deliveryRequests.length}
              </Badge>
            </Group>
            <Stack gap="xs">
              {deliveryRequests.map((req) => {
                const reqStaff = req.staff as DbStaff | undefined
                const statusColors: Record<DeliveryRequestStatus, string> = {
                  pending: 'yellow',
                  accepted: 'teal',
                  declined: 'red',
                  expired: 'gray',
                }
                const statusIcon: Record<DeliveryRequestStatus, JSX.Element> = {
                  pending: <TbClock size={12} />,
                  accepted: <TbCircleCheck size={12} />,
                  declined: <TbX size={12} />,
                  expired: <TbClock size={12} />,
                }
                const sentAt = new Date(req.created_at)
                const sentLabel = sentAt.toLocaleTimeString('en-UG', {
                  hour: '2-digit',
                  minute: '2-digit',
                })
                const sentDateLabel = sentAt.toLocaleDateString('en-UG', {
                  day: 'numeric',
                  month: 'short',
                })
                const canResend =
                  req.status === 'declined' || req.status === 'expired'

                return (
                  <Box
                    key={req.id}
                    p="sm"
                    style={{
                      background:
                        req.status === 'accepted'
                          ? '#f0fdf4'
                          : req.status === 'pending'
                            ? '#fffbeb'
                            : SavedColors.bgWhite,
                      borderRadius: 10,
                      border: `1px solid ${
                        req.status === 'accepted'
                          ? '#86efac'
                          : req.status === 'pending'
                            ? '#fde68a'
                            : SavedColors.DemWhite
                      }`,
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
                            width: 38,
                            height: 38,
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
                            size={18}
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
                                  ? SavedColors.Primaryblue
                                  : SavedColors.TextColor
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
                                c="dimmed"
                              >
                                {reqStaff.phone}
                              </Text>
                            )}
                            <Text
                              size="xs"
                              c="dimmed"
                            >
                              Sent {sentLabel} · {sentDateLabel}
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
                            size={14}
                            color={SavedColors.DarkWhite}
                          />
                        )}
                        {canResend && reqStaff && (
                          <Button
                            size="xs"
                            variant="light"
                            color="lotusCyan"
                            leftSection={<TbRefresh size={13} />}
                            onClick={async () => {
                              const { error } = await supabase
                                .from('delivery_requests')
                                .insert({
                                  order_id: order.id,
                                  delivery_staff_id: reqStaff.id,
                                  sent_by: staffInfo?.id ?? null,
                                  status: 'pending' as DeliveryRequestStatus,
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
          </ContentCard>
        )}

        {/*  Assigned Rider Card — shown once dispatched or out for delivery  */}
        {['dispatched', 'out_for_delivery'].includes(order.status) &&
          (() => {
            const acceptedReq = deliveryRequests.find(
              (r) => r.status === 'accepted',
            )
            if (!acceptedReq?.staff) return null
            return (
              <ContentCard
                style={{
                  marginBottom: 24,
                  borderColor: '#15B3E050',
                  borderWidth: 2,
                  cursor: 'pointer',
                }}
                onClick={() =>
                  navigate(`/pharmacy/riders/${acceptedReq.staff!.id}`)
                }
              >
                <Group gap="md">
                  <Box
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      flexShrink: 0,
                      background: 'linear-gradient(135deg,#15B3E0,#012970)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <TbTruck
                      size={22}
                      color="#fff"
                    />
                  </Box>
                  <Box style={{ flex: 1 }}>
                    <Text
                      fw={800}
                      size="sm"
                      c={SavedColors.TextColor}
                    >
                      Assigned Rider
                    </Text>
                    <Text
                      size="sm"
                      fw={600}
                      c={SavedColors.Primaryblue}
                      mt={2}
                      style={{ textDecoration: 'underline' }}
                    >
                      {acceptedReq.staff.name}
                    </Text>
                    {acceptedReq.staff.phone && (
                      <Text
                        size="xs"
                        c="dimmed"
                        mt={2}
                      >
                        {acceptedReq.staff.phone}
                      </Text>
                    )}
                  </Box>
                  <TbChevronRight
                    size={16}
                    color={SavedColors.DarkWhite}
                  />
                </Group>
              </ContentCard>
            )
          })()}

        {/*  OTP Fallback Panel — shown when out for delivery  */}
        {order.status === 'out_for_delivery' && order.otp && (
          <ContentCard
            style={{
              marginBottom: 24,
              borderColor: '#15B3E050',
              borderWidth: 2,
            }}
          >
            <Group
              gap="md"
              mb="md"
              pb="md"
              style={{ borderBottom: '1px solid #e8edf5' }}
            >
              <Box
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  flexShrink: 0,
                  background: 'linear-gradient(135deg,#15B3E0,#012970)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <TbPhone
                  size={22}
                  color="#fff"
                />
              </Box>
              <Box>
                <Text
                  fw={800}
                  size="md"
                  c={SavedColors.TextColor}
                >
                  Delivery OTP — Confirm with Customer
                </Text>
                <Text
                  size="xs"
                  c="dimmed"
                  mt={2}
                >
                  The customer has this OTP in their app. Ask them to read it to
                  the rider to confirm delivery.
                </Text>
              </Box>
            </Group>
            <Alert
              color="blue"
              variant="light"
              icon={<TbAlertCircle size={14} />}
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
                The customer sees this code in their app. The rider must ask the
                customer to read it out to complete the delivery handover.
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
                  background: SavedColors.lightBlue,
                  border: `2px solid ${SavedColors.Primaryblue}`,
                  borderRadius: 12,
                  padding: '14px 32px',
                }}
              >
                <Text
                  style={{
                    fontFamily: "'Nunito', monospace",
                    fontWeight: 900,
                    fontSize: 36,
                    letterSpacing: '0.25em',
                    color: SavedColors.Primaryblue,
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
          </ContentCard>
        )}
        <ContentCard>
          <Text
            fw={700}
            mb="md"
            c={SavedColors.TextColor}
          >
            Actions
          </Text>
          <Stack
            gap="sm"
            align="flex-start"
          >
            {order.status === 'insurance_verification' && (
              <Alert
                color="grape"
                variant="light"
                icon={<TbShieldCheck size={14} />}
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
                  The customer's insurance card is pending verification by
                  support staff. This order will move to <b>Pharmacy Review</b>{' '}
                  automatically once the insurance is verified. No action needed
                  yet.
                </Text>
              </Alert>
            )}

            {order.status === 'prescription_uploaded' && (
              <Button
                color="blue"
                loading={savingStatus === 'pharmacy_review'}
                leftSection={<TbPackage size={16} />}
                onClick={() => updateStatus('pharmacy_review' as OrderStatus)}
              >
                Start Pharmacy Review
              </Button>
            )}

            {order.status === 'confirmed' && (
              <Button
                color="violet"
                loading={savingStatus === 'packing'}
                leftSection={<TbPackage size={16} />}
                onClick={() => updateStatus('packing' as OrderStatus)}
              >
                Start Packing
              </Button>
            )}

            {order.status === 'packing' && (
              <Alert
                color="blue"
                variant="light"
                icon={<TbTruck size={14} />}
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
                  Use the <b>Assign Delivery Rider</b> card above to select a
                  rider, broadcast to all riders
                </Text>
              </Alert>
            )}

            {order.status === 'dispatched' &&
              !allDeclinedOrExpired &&
              (hasAcceptedRider ? (
                <Button
                  color="teal"
                  loading={savingStatus === 'out_for_delivery'}
                  leftSection={<TbTruck size={16} />}
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
                  icon={<TbClock size={14} />}
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
                    The &quot;Out for Delivery&quot; button appears once a rider
                    accepts the request.
                  </Text>
                </Alert>
              ))}

            {order.status === 'out_for_delivery' && (
              <Stack
                gap="xs"
                align="flex-start"
              >
                {order.no_rider ? (
                  /* Bug 4 fix: walk-in orders require OTP from the customer before
                     the pharmacist can mark as delivered. This creates an audit trail
                     and prevents fraud/misdelivery at the counter. */
                  <>
                    <Button
                      color="green"
                      loading={savingStatus === 'delivered'}
                      leftSection={<TbShieldCheck size={16} />}
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
                      Walk-in — ask the customer to read their OTP from the app.
                    </Text>
                  </>
                ) : (
                  <Button
                    color="green"
                    loading={savingStatus === 'delivered'}
                    leftSection={<TbCheck size={16} />}
                    onClick={() => updateStatus('delivered' as OrderStatus)}
                  >
                    Mark as Delivered
                  </Button>
                )}
              </Stack>
            )}

            {!['rejected', 'cancelled', 'delivered'].includes(order.status) && (
              <Button
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
        </ContentCard>
      </Box>

      {/* ── Order Status History / Audit Panel ── */}
      {statusHistory.length > 0 && (
        <Box
          px={{ base: 'md', sm: 'xl' }}
          pb="md"
        >
          <ContentCard>
            <Box
              style={{ cursor: 'pointer' }}
              onClick={() => setHistoryOpen((o) => !o)}
            >
              <Group
                justify="space-between"
                align="center"
              >
                <Group gap={8}>
                  <TbHistory
                    size={16}
                    color={SavedColors.Primaryblue}
                  />
                  <Text
                    fw={700}
                    size="sm"
                    c={SavedColors.TextColor}
                  >
                    Status History
                  </Text>
                  <Badge
                    size="xs"
                    color="lotusCyan"
                    variant="light"
                  >
                    {statusHistory.length}
                  </Badge>
                </Group>
                <ActionIcon
                  size="xs"
                  variant="subtle"
                  color="gray"
                >
                  {historyOpen ? (
                    <TbChevronUp size={14} />
                  ) : (
                    <TbChevronDown size={14} />
                  )}
                </ActionIcon>
              </Group>
            </Box>
            <Collapse in={historyOpen}>
              <Stack
                gap={0}
                mt="sm"
              >
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
                  const color = dotColor[entry.status] ?? '#9ca3af'
                  return (
                    <Box
                      key={entry.id}
                      style={{
                        borderBottom:
                          i < statusHistory.length - 1
                            ? `1px solid #f3f4f6`
                            : 'none',
                        paddingTop: 10,
                        paddingBottom: 10,
                      }}
                    >
                      <Group
                        align="flex-start"
                        gap={10}
                        wrap="nowrap"
                      >
                        {/* Timeline dot */}
                        <Box
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            paddingTop: 4,
                            flexShrink: 0,
                          }}
                        >
                          <Box
                            style={{
                              width: 10,
                              height: 10,
                              borderRadius: '50%',
                              background: color,
                              flexShrink: 0,
                            }}
                          />
                          {i < statusHistory.length - 1 && (
                            <Box
                              style={{
                                width: 2,
                                height: 20,
                                background: '#e5e7eb',
                                marginTop: 3,
                              }}
                            />
                          )}
                        </Box>
                        <Box style={{ flex: 1, minWidth: 0 }}>
                          <Group
                            justify="space-between"
                            wrap="nowrap"
                            align="flex-start"
                          >
                            <Box>
                              <Text
                                size="sm"
                                fw={700}
                                c={SavedColors.TextColor}
                              >
                                {statusFormatted}
                              </Text>
                              <Group
                                gap={6}
                                mt={2}
                              >
                                <Box
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    background: '#f3f4f6',
                                    borderRadius: 6,
                                    padding: '2px 7px',
                                  }}
                                >
                                  <TbShieldBolt
                                    size={11}
                                    color="#6b7280"
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
                                    style={{ fontStyle: 'italic' }}
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
                              {new Date(entry.created_at).toLocaleDateString(
                                'en-UG',
                                {
                                  day: 'numeric',
                                  month: 'short',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                },
                              )}
                            </Text>
                          </Group>
                        </Box>
                      </Group>
                    </Box>
                  )
                })}
              </Stack>
            </Collapse>
          </ContentCard>
        </Box>
      )}

      {/* Reject order modal — reason required */}
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
              leftSection={<TbX size={14} />}
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

      {/* Bug 4: Walk-in OTP verification modal */}
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
            icon={<TbShieldCheck size={14} />}
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
            styles={{
              input: {
                fontFamily: "'Nunito', monospace",
                fontWeight: 800,
                fontSize: 28,
                letterSpacing: '0.3em',
                textAlign: 'center',
              },
            }}
            autoFocus
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
              leftSection={<TbShieldCheck size={14} />}
              onClick={verifyWalkinOtp}
            >
              Verify &amp; Complete Handover
            </Button>
          </Group>
        </Stack>
      </Modal>
    </PharmacySidebarLayout>
  )
}

