import { useState, useEffect } from 'react'
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
} from '@mantine/core'
import {
  TbArrowLeft,
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
  TbMessageCircle,
  TbNotes,
  TbCurrencyDollar,
  TbChevronRight,
} from 'react-icons/tb'
import styled, { keyframes, css } from 'styled-components'
import { notifications } from '@mantine/notifications'
import { SavedColors } from '@shared/constants'
import { PageTitle, BlueDivider, SectionLabel } from '@shared/ui/typography'
import { ContentCard } from '@shared/ui/layout'
import {
  supabase,
  DbOrder,
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
  animation: ${selectedPulse} 2.5s ease-in-out 4;
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
const statusLabel = (s: string): string =>
  ({
    prescription_uploaded: 'Uploaded',
    insurance_verification: 'Insurance Check',
    pharmacy_review: 'Under Review',
    pricing_ready: 'Awaiting Customer',
    awaiting_confirmation: 'Customer Confirming',
    confirmed: 'Paid — Ready to Pack',
    packing: 'Packing',
    dispatched: 'Dispatched',
    out_for_delivery: 'Out for Delivery',
    delivered: 'Delivered',
    rejected: 'Rejected',
    cancelled: 'Cancelled',
  })[s] ?? s.replace(/_/g, ' ')

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

interface MedRow {
  id: string
  name: string
  quantity: number
  unit_price: number
  is_insured: boolean
  in_stock: boolean
  is_delivery: boolean
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
  const [broadcastSecsLeft, setBroadcastSecsLeft] = useState<number | null>(null)
  // Reject order modal
  const [rejectModalOpen, setRejectModalOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
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
      .select('*, profiles(name, relationship, insurance(*)), medications(*)')
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
          is_insured: m.is_insured ?? false,
          in_stock: m.in_stock !== false,
          is_delivery: m.is_delivery ?? false,
        })),
      )

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

  useEffect(() => {
    fetchOrder()
    fetchDeliveryData()

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
      supabase.rpc('expire_broadcast_timeout', { p_order_id: order.id }).then(() => {
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
  }, [order?.broadcast_timeout_at, order?.dispatch_is_broadcast, order?.rider_declined_at, deliveryRequests]) // eslint-disable-line react-hooks/exhaustive-deps

  //  Insurance — ignored entirely for cash-only orders
  type ProfileWithInsurance = {
    insurance?: { status?: string; provider?: string }
  }
  const profileInsurance = order?.cash_only
    ? null
    : (order?.profiles as ProfileWithInsurance | null)?.insurance
  const insuranceStatus: string = order?.cash_only
    ? 'none'
    : (profileInsurance?.status ?? order?.insurance_status ?? 'none')
  const insuranceVerified = !order?.cash_only && insuranceStatus === 'verified'

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
  const addMedRow = (): void =>
    setMeds((prev) => [
      ...prev,
      {
        id: `new-${Date.now()}`,
        name: '',
        quantity: 1,
        unit_price: 0,
        is_insured: false,
        in_stock: true,
        is_delivery: false,
        isNew: true,
      },
    ])
  const removeMedRow = (medId: string): void =>
    setMeds((prev) => prev.filter((m) => m.id !== medId))
  const updateName = (medId: string, name: string): void =>
    setMeds((prev) => prev.map((m) => (m.id === medId ? { ...m, name } : m)))
  const updateQty = (medId: string, quantity: number): void =>
    setMeds((prev) =>
      prev.map((m) => (m.id === medId ? { ...m, quantity } : m)),
    )

  //  Send notification to customer via SECURITY DEFINER RPC
  const sendCustomerNotification = async (
    status: OrderStatus,
    orderRef: DbOrder,
  ): Promise<void> => {
    const msgs: Partial<Record<OrderStatus, { title: string; body: string }>> =
      {
        pharmacy_review: {
          title: 'Pharmacy Review Started',
          body: `A pharmacist is now reviewing your prescription for order #${orderRef.order_number}.`,
        },
        pricing_ready: {
          title: 'Pricing Ready — Action Required',
          body: `Your order #${orderRef.order_number} is priced. Please review and confirm to proceed.`,
        },
        packing: {
          title: 'Order Being Packed',
          body: `Your medications for order #${orderRef.order_number} are being packed.`,
        },
        dispatched: {
          title: 'Order Dispatched!',
          body: `Your order #${orderRef.order_number} has left the pharmacy. A rider is on the way!`,
        },
        out_for_delivery: {
          title: 'Out for Delivery — Almost There!',
          body: `Your rider is nearby with order #${orderRef.order_number}. Have your QR code ready.`,
        },
        delivered: {
          title: 'Order Delivered',
          body: `Your order #${orderRef.order_number} has been delivered. Thank you for using MedDeliverySOS!`,
        },
        rejected: {
          title: 'Order Rejected',
          body: `Order #${orderRef.order_number} could not be fulfilled. Please contact support.`,
        },
        cancelled: {
          title: 'Order Cancelled',
          body: `Your order #${orderRef.order_number} has been cancelled.`,
        },
      }
    const msg = msgs[status]
    if (!msg || !orderRef.user_id) return
    const { error } = await supabase.rpc('notify_customer', {
      p_user_id: orderRef.user_id,
      p_type: 'order_status_update',
      p_title: msg.title,
      p_body: msg.body,
      p_order_id: orderRef.id,
    })
    if (error) console.warn('notify_customer RPC failed:', error.message)
  }

  //  Save pricing
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

    // ── DELETE medications that were removed from the UI ──────────────────
    // Existing meds in DB = the ones that were loaded (not isNew)
    const existingMedIds = namedMeds.filter(m => !m.isNew).map(m => m.id)
    const allDbMeds = (order.medications ?? []) as { id: string }[]
    const removedIds = allDbMeds
      .map(m => m.id)
      .filter(dbId => !existingMedIds.includes(dbId))
    if (removedIds.length > 0) {
      await supabase.from('medications').delete().in('id', removedIds)
    }

    // ── INSERT new / UPDATE existing ──────────────────────────────────────
    for (const med of namedMeds) {
      if (med.isNew) {
        await supabase.from('medications').insert({
          order_id: order.id,
          name: med.name.trim(),
          quantity: med.quantity,
          unit_price: med.unit_price,
          is_insured: med.is_insured,
          in_stock: med.in_stock,
          is_delivery: false,
        })
      } else {
        await supabase
          .from('medications')
          .update({
            unit_price: med.unit_price,
            is_insured: med.is_insured,
            in_stock: med.in_stock,
          })
          .eq('id', med.id)
      }
    }

    // ── Calculate totals ──────────────────────────────────────────────────
    const subtotal = namedMeds
      .filter((m) => m.in_stock)
      .reduce((s, m) => s + m.unit_price * m.quantity, 0)
    const insuredMedAmount = namedMeds
      .filter((m) => m.is_insured && m.in_stock)
      .reduce((s, m) => s + m.unit_price * m.quantity, 0)
    const cashMedAmount = namedMeds
      .filter((m) => !m.is_insured && m.in_stock)
      .reduce((s, m) => s + m.unit_price * m.quantity, 0)

    const deliveryFeeCalc = order.no_rider ? 0 : DELIVERY_FEE

    // Delivery fee coverage rule:
    //  - Insurance order (cash_only = false): delivery fee is covered by insurance
    //    → insured_amount includes delivery fee, total_amount = cash meds only
    //  - Cash order (cash_only = true): delivery fee is NOT covered
    //    → total_amount = cash meds + delivery fee
    const isCashOrder = order.cash_only === true
    const insuredAmount = isCashOrder
      ? insuredMedAmount
      : insuredMedAmount + deliveryFeeCalc          // delivery covered by insurance
    const cashAmount = cashMedAmount
    const totalAmount = isCashOrder
      ? cashMedAmount + deliveryFeeCalc             // customer pays meds + delivery
      : cashMedAmount                               // customer only pays non-insured meds

    const { error: orderErr } = await supabase
      .from('orders')
      .update({
        subtotal,
        insured_amount: insuredAmount,
        cash_amount: cashAmount,
        delivery_fee: deliveryFeeCalc,
        total_amount: totalAmount,
        delivery_skipped: order.no_rider ?? false,
        status: 'pricing_ready',
        price_revision_count: (order.price_revision_count ?? 0) + 1,
        updated_at: new Date().toISOString(),
      })
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

    await sendCustomerNotification('pricing_ready', order)
    notifications.show({
      title: 'Pricing saved',
      message: 'Customer notified to review and confirm.',
      color: 'teal',
    })
    setSavingPricing(false)
    fetchOrder()
  }

  //  Update status
  const updateStatus = async (status: OrderStatus, reason?: string): Promise<void> => {
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
      message: statusLabel(status),
      color: 'teal',
    })
    setSavingStatus(null)
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

    const isNoRider  = selectedRider === '__no_rider__'
    const isBroadcast = selectedRider === '__broadcast__'

    // ── No Rider / Walk-in path ──────────────────────────────────────────────
    if (isNoRider) {
      await supabase.from('orders').update({
        no_rider: true,
        rider_declined_at: null,
        updated_at: new Date().toISOString(),
      }).eq('id', order.id)
      // Skip dispatched, go straight to out_for_delivery
      await updateStatus('out_for_delivery' as OrderStatus)
      notifications.show({
        title: '✅ Walk-in confirmed',
        message: 'Order is out for delivery — no rider assigned. Mark as delivered when done.',
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
    const { error: orderUpdateErr } = await supabase.from('orders')
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
  const insuredMedAmountPreview = meds
    .filter((m) => m.is_insured && m.in_stock)
    .reduce((s, m) => s + m.unit_price * m.quantity, 0)
  const cashMedAmountPreview = meds
    .filter((m) => !m.is_insured && m.in_stock)
    .reduce((s, m) => s + m.unit_price * m.quantity, 0)

  // Delivery fee is always DELIVERY_FEE (10,000 UGX) unless no_rider (in-store pickup)
  const deliveryFee = order.no_rider ? 0 : DELIVERY_FEE
  const isCashOrder = order.cash_only === true
  // If insurance order: delivery fee is covered → customer only pays non-insured meds
  // If cash order: delivery fee is NOT covered → customer pays cash meds + delivery
  const grandTotal = isCashOrder
    ? cashMedAmountPreview + deliveryFee
    : cashMedAmountPreview
  const deliverySkippedLocal = !!order.no_rider

  // Staff can edit pricing when order is being reviewed OR when pricing is already set (unlimited revisions)
  const canSetPricing =
    order.status === 'pharmacy_review' || order.status === 'pricing_ready'

  // Show pricing summary totals once pricing has been submitted at least once
  const pricingSummaryVisible = ![
    'prescription_uploaded',
    'insurance_verification',
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

        {/*  Order Chat Panel — always at top for active non-terminal orders  */}
        {!['delivered', 'cancelled', 'rejected'].includes(order.status) &&
          staffInfo && (
            <ContentCard
              style={{ padding: 0, overflow: 'hidden', marginBottom: 24 }}
            >
              <OrderChatPanel
                orderId={order.id}
                senderId={staffInfo.id}
                senderName={staffInfo.name}
                senderType="pharmacy"
                placeholder="Reply to customer or share an update…"
                height={280}
              />
            </ContentCard>
          )}

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
              {statusLabel(order.status)}
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
                  <Text
                    size="xs"
                    c="dimmed"
                  >
                    {profileInsurance.provider}
                    {(profileInsurance as { scheme_name?: string }).scheme_name
                      ? ` · ${(profileInsurance as { scheme_name?: string }).scheme_name}`
                      : ''}
                  </Text>
                )}
              </>
            )}
          </ContentCard>
        </Group>

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
          </>
        )}

        {/*  Prescription viewer  */}
        {prescriptionSignedUrl && (
          <ContentCard style={{ marginBottom: 24 }}>
            <Text
              fw={700}
              c={SavedColors.TextColor}
              size="sm"
              mb="sm"
            >
              Prescription
            </Text>
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
                No medications yet. Add medications from the prescription above.
              </Text>
            </Alert>
          )}

          <Box style={{ overflowX: 'auto' }}>
            <Table striped>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Medication</Table.Th>
                  <Table.Th>Qty</Table.Th>
                  <Table.Th>Unit Price (UGX)</Table.Th>
                  <Table.Th>Coverage</Table.Th>
                  <Table.Th>Stock</Table.Th>
                  <Table.Th>Subtotal</Table.Th>
                  {canSetPricing && <Table.Th />}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {meds.map((med) => (
                  <Table.Tr
                    key={med.id}
                    style={{ opacity: med.in_stock ? 1 : 0.5 }}
                  >
                    <Table.Td>
                      {canSetPricing && med.isNew && !med.is_delivery ? (
                        <TextInput
                          value={med.name}
                          onChange={(e) => updateName(med.id, e.target.value)}
                          placeholder="Medication name"
                          size="xs"
                          style={{ width: 160 }}
                        />
                      ) : (
                        <Group gap={4}>
                          <Text size="sm" fw={600}>{med.name}</Text>
                          {med.is_delivery && (
                            <Badge size="xs" color="cyan" variant="light">Delivery</Badge>
                          )}
                        </Group>
                      )}
                    </Table.Td>
                    <Table.Td>
                      {canSetPricing && med.isNew ? (
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
                      {canSetPricing ? (
                        <NumberInput
                          value={med.unit_price}
                          onChange={(val) =>
                            updatePrice(med.id, Number(val) || 0)
                          }
                          min={0}
                          step={500}
                          size="xs"
                          style={{ width: 120 }}
                          disabled={med.is_insured}
                        />
                      ) : (
                        <Text size="sm">{med.unit_price.toLocaleString()}</Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      {canSetPricing ? (
                        <Tooltip
                          label={
                            order.cash_only
                              ? 'Cash-only order'
                              : !insuranceVerified
                                ? 'Insurance must be verified first'
                                : ''
                          }
                          disabled={!order.cash_only && insuranceVerified}
                        >
                          <span>
                            <Button
                              size="xs"
                              variant={med.is_insured ? 'filled' : 'outline'}
                              color={med.is_insured ? 'teal' : 'gray'}
                              disabled={order.cash_only || !insuranceVerified}
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
                      ) : (
                        <Badge
                          size="xs"
                          color={med.is_insured ? 'teal' : 'gray'}
                          variant="light"
                        >
                          {med.is_insured ? 'Insured' : 'Cash Pay'}
                        </Badge>
                      )}
                    </Table.Td>
                    <Table.Td>
                      {canSetPricing ? (
                        <Button
                          size="xs"
                          variant={med.in_stock ? 'light' : 'outline'}
                          color={med.in_stock ? 'green' : 'red'}
                          onClick={() => toggleStock(med.id, !med.in_stock)}
                        >
                          {med.in_stock ? 'In Stock' : 'Out of Stock'}
                        </Button>
                      ) : (
                        <Badge
                          size="xs"
                          color={med.in_stock ? 'green' : 'red'}
                          variant="light"
                        >
                          {med.in_stock ? 'In Stock' : 'Out of Stock'}
                        </Badge>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Text
                        size="sm"
                        fw={600}
                        c={med.is_insured ? 'teal' : undefined}
                      >
                        {med.is_insured
                          ? 'Covered'
                          : med.in_stock
                            ? `UGX ${(med.unit_price * med.quantity).toLocaleString()}`
                            : 'N/A'}
                      </Text>
                    </Table.Td>
                    {canSetPricing && (
                      <Table.Td>
                        <Button
                          size="xs"
                          variant="subtle"
                          color="red"
                          onClick={() => removeMedRow(med.id)}
                        >
                          <TbTrash size={14} />
                        </Button>
                      </Table.Td>
                    )}
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Box>

          {canSetPricing && (
            <Group gap="xs" mt="sm">
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

          {/* Task 10: Only show summary totals when pricing has been submitted */}
          {pricingSummaryVisible && (
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
                      Subtotal
                    </Text>
                    <Text
                      size="sm"
                      fw={600}
                    >
                      UGX {subtotal.toLocaleString()}
                    </Text>
                  </Group>
                  {insuredMedAmountPreview > 0 && (
                    <Group gap="xl">
                      <Text
                        size="sm"
                        c="teal"
                      >
                        Insurance Covers (Meds)
                      </Text>
                      <Text
                        size="sm"
                        fw={600}
                        c="teal"
                      >
                        − UGX {insuredMedAmountPreview.toLocaleString()}
                      </Text>
                    </Group>
                  )}
                  {!isCashOrder && !deliverySkippedLocal && (
                    <Group gap="xl">
                      <Text size="sm" c="teal">Insurance Covers (Delivery)</Text>
                      <Text size="sm" fw={600} c="teal">
                        − UGX {DELIVERY_FEE.toLocaleString()}
                      </Text>
                    </Group>
                  )}
                  <Group gap="xl">
                    <Text
                      size="sm"
                      c="dimmed"
                    >
                      Cash Medications
                    </Text>
                    <Text
                      size="sm"
                      fw={600}
                    >
                      UGX {cashMedAmountPreview.toLocaleString()}
                    </Text>
                  </Group>
                  <Group gap="xl">
                    <Text size="sm" c="dimmed">
                      Delivery Fee
                    </Text>
                    <Text size="sm" fw={600} c={deliverySkippedLocal ? 'dimmed' : undefined}>
                      {deliverySkippedLocal
                        ? 'No delivery (in-store)'
                        : `UGX ${DELIVERY_FEE.toLocaleString()}${!isCashOrder ? ' (insured)' : ''}`}
                    </Text>
                  </Group>
                  <Divider style={{ width: '100%' }} />
                  <Group gap="xl">
                    <Text fw={700}>Customer Pays</Text>
                    <Text
                      fw={800}
                      size="xl"
                      c={grandTotal === 0 ? 'teal' : SavedColors.Primaryblue}
                    >
                      {grandTotal === 0 ? 'UGX 0 (Fully Covered)' : `UGX ${grandTotal.toLocaleString()}`}
                    </Text>
                  </Group>
                </Stack>
              </Group>
            </>
          )}

          {/* Save pricing button — available in pharmacy_review and pricing_ready */}
          {canSetPricing && (
            <Group
              justify="flex-end"
              mt="md"
            >
              <Button
                color="lotusCyan"
                loading={savingPricing}
                onClick={savePricing}
                leftSection={<TbCheck size={16} />}
                size="md"
              >
                {order.status === 'pricing_ready'
                  ? 'Update Pricing & Notify Customer'
                  : 'Save Pricing & Notify Customer'}
              </Button>
            </Group>
          )}
        </ContentCard>

        {/* 
              DELIVERY ASSIGNMENT PANEL
              Shown when: packing  OR  dispatched + all requests failed
               */}
        {/* Task 16: Rider declined alert banner — smart manual vs broadcast variant */}
        {riderJustDeclined && (
          <ContentCard style={{ marginBottom: 16, borderColor: '#fca5a5', borderWidth: 2, background: '#fef2f2' }}>
            <Group gap="md">
              <Box style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0, background: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <TbX size={24} color="#fff" />
              </Box>
              <Box style={{ flex: 1 }}>
                {manualRiderDeclined ? (
                  <>
                    <Text fw={800} size="md" c="#b91c1c">Rider Declined</Text>
                    <Text size="xs" c="#991b1b" mt={2}>
                      <b>{order.declined_rider_name}</b> has declined this order.
                      Please assign a different rider below.
                    </Text>
                  </>
                ) : (
                  <>
                    <Text fw={800} size="md" c="#b91c1c">All Riders Declined / Timed Out</Text>
                    <Text size="xs" c="#991b1b" mt={2}>
                      Every rider has declined or did not respond in time.
                      Please assign a new rider below to re-dispatch.
                    </Text>
                  </>
                )}
              </Box>
              <Badge color="red" variant="filled" size="sm">Action Required</Badge>
            </Group>
          </ContentCard>
        )}

        {/* Broadcast countdown timer — shown while waiting for any rider to accept */}
        {showBroadcastCountdown && broadcastSecsLeft !== null && (
          <ContentCard style={{ marginBottom: 16, borderColor: '#fde68a', borderWidth: 2, background: '#fffbeb' }}>
            <Group gap="md">
              <Box style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0, background: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <TbClock size={22} color="#fff" />
              </Box>
              <Box style={{ flex: 1 }}>
                <Group gap={8} mb={2}>
                  <Text fw={800} size="md" c="#92400e">Waiting for a Rider to Accept</Text>
                  <Badge color="yellow" variant="filled" size="sm">
                    {Math.floor(broadcastSecsLeft / 60)}:{String(broadcastSecsLeft % 60).padStart(2, '0')} left
                  </Badge>
                </Group>
                <Text size="xs" c="#78350f">
                  Broadcast sent to {deliveryRequests.length} rider{deliveryRequests.length !== 1 ? 's' : ''}.
                  If no one accepts before the timer ends, you'll be prompted to re-assign.
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
                {/* ── No Rider / Walk-in option ── */}
                <RiderCard
                  $selected={selectedRider === '__no_rider__'}
                  onClick={() => setSelectedRider('__no_rider__')}
                  style={{ borderColor: selectedRider === '__no_rider__' ? '#7C3AED' : undefined,
                           background: selectedRider === '__no_rider__' ? '#f5f3ff' : undefined }}
                >
                  <RadioDot $selected={selectedRider === '__no_rider__'}
                    style={{ borderColor: selectedRider === '__no_rider__' ? '#7C3AED' : undefined,
                             background: selectedRider === '__no_rider__' ? '#7C3AED' : undefined }}>
                    {selectedRider === '__no_rider__' && (
                      <Box style={{ width: 7, height: 7, borderRadius: '50%', background: '#fff' }} />
                    )}
                  </RadioDot>
                  <Box style={{ width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                      background: 'rgba(124,58,237,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <TbUser size={18} color="#7C3AED" />
                  </Box>
                  <Box style={{ flex: 1 }}>
                    <Group gap={6} mb={2}>
                      <Text size="sm" fw={700} c={SavedColors.TextColor}>No Rider / Walk-in</Text>
                      <Badge color="violet" variant="light" size="xs">Skip Delivery</Badge>
                    </Group>
                    <Text size="xs" c="dimmed">
                      Customer collects directly or staff delivers. Skips QR scan — staff can mark as delivered manually.
                    </Text>
                  </Box>
                </RiderCard>

                <Divider label="or assign a rider" labelPosition="center" my={4} />

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
                return (
                  <Group
                    key={req.id}
                    justify="space-between"
                    p="sm"
                    style={{
                      background:
                        req.status === 'accepted'
                          ? '#f0fdf4'
                          : SavedColors.bgWhite,
                      borderRadius: 8,
                      border: `1px solid ${req.status === 'accepted' ? '#86efac' : SavedColors.DemWhite}`,
                      cursor: req.status === 'accepted' && reqStaff ? 'pointer' : 'default',
                    }}
                    onClick={() => {
                      if (req.status === 'accepted' && reqStaff) {
                        navigate(`/pharmacy/riders/${reqStaff.id}`)
                      }
                    }}
                  >
                    <Group gap="sm">
                      <Box
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: '50%',
                          background: req.status === 'accepted' ? '#dcfce7' : SavedColors.lightBlue,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <TbUser
                          size={18}
                          color={req.status === 'accepted' ? '#16a34a' : SavedColors.Primaryblue}
                        />
                      </Box>
                      <Box>
                        <Text
                          size="sm"
                          fw={600}
                          c={req.status === 'accepted' && reqStaff ? SavedColors.Primaryblue : SavedColors.TextColor}
                          style={{ textDecoration: req.status === 'accepted' && reqStaff ? 'underline' : 'none' }}
                        >
                          {reqStaff?.name ?? 'Unknown'}
                        </Text>
                        {reqStaff?.phone && (
                          <Text
                            size="xs"
                            c="dimmed"
                          >
                            {reqStaff.phone}
                          </Text>
                        )}
                      </Box>
                    </Group>
                    <Group gap="sm">
                      <Badge
                        color={statusColors[req.status]}
                        variant="light"
                        size="sm"
                        leftSection={statusIcon[req.status]}
                      >
                        {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                      </Badge>
                      {req.status === 'accepted' && reqStaff && (
                        <TbChevronRight size={14} color={SavedColors.DarkWhite} />
                      )}
                    </Group>
                  </Group>
                )
              })}
            </Stack>
          </ContentCard>
        )}

        {/*  Assigned Rider Card — shown once dispatched or out for delivery  */}
        {['dispatched', 'out_for_delivery'].includes(order.status) && (() => {
          const acceptedReq = deliveryRequests.find(r => r.status === 'accepted')
          if (!acceptedReq?.staff) return null
          return (
            <ContentCard
              style={{ marginBottom: 24, borderColor: '#15B3E050', borderWidth: 2, cursor: 'pointer' }}
              onClick={() => navigate(`/pharmacy/riders/${acceptedReq.staff!.id}`)}
            >
              <Group gap="md">
                <Box style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                  background: 'linear-gradient(135deg,#15B3E0,#012970)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <TbTruck size={22} color="#fff" />
                </Box>
                <Box style={{ flex: 1 }}>
                  <Text fw={800} size="sm" c={SavedColors.TextColor}>Assigned Rider</Text>
                  <Text size="sm" fw={600} c={SavedColors.Primaryblue} mt={2}
                    style={{ textDecoration: 'underline' }}>
                    {acceptedReq.staff.name}
                  </Text>
                  {acceptedReq.staff.phone && (
                    <Text size="xs" c="dimmed" mt={2}>{acceptedReq.staff.phone}</Text>
                  )}
                </Box>
                <TbChevronRight size={16} color={SavedColors.DarkWhite} />
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
                  The customer has this OTP in their app. Ask them to read it
                  to the rider to confirm delivery.
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
                <Text size="sm" fw={600}>Ready to dispatch?</Text>
                <Text size="xs" mt={2} c="dimmed">
                  Use the <b>Assign Delivery Rider</b> card above to select a
                  rider, broadcast to all riders, or choose <b>No Rider</b> for
                  walk-in / direct handover.
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
              <Stack gap="xs" align="flex-start">
                <Button
                  color="green"
                  loading={savingStatus === 'delivered'}
                  leftSection={<TbCheck size={16} />}
                  onClick={() => updateStatus('delivered' as OrderStatus)}
                >
                  Mark as Delivered
                </Button>
                {order.no_rider && (
                  <Text size="xs" c="dimmed">
                    Walk-in order — no QR scan required.
                  </Text>
                )}
              </Stack>
            )}

            {!['rejected', 'cancelled', 'delivered'].includes(order.status) && (
              <Button
                color="red"
                variant="subtle"
                loading={savingStatus === 'rejected'}
                onClick={() => { setRejectReason(''); setRejectModalOpen(true) }}
              >
                Reject Order
              </Button>
            )}
          </Stack>
        </ContentCard>
      </Box>

      {/* Reject order modal — reason required */}
      <Modal
        opened={rejectModalOpen}
        onClose={() => setRejectModalOpen(false)}
        title="Reject this order?"
        centered
        size="sm"
        styles={{ title: { fontFamily: "'DM Sans',sans-serif", fontWeight: 700 } }}
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            Please provide a reason so the customer understands why their order was rejected.
          </Text>
          <Textarea
            label="Reason for rejection"
            placeholder="e.g. Medication out of stock, invalid prescription, etc."
            value={rejectReason}
            onChange={e => setRejectReason(e.target.value)}
            minRows={3}
            autosize
          />
          <Group justify="flex-end" gap="sm">
            <Button variant="default" onClick={() => setRejectModalOpen(false)}>Cancel</Button>
            <Button
              color="red"
              disabled={!rejectReason.trim()}
              loading={savingStatus === 'rejected'}
              leftSection={<TbX size={14} />}
              onClick={async () => {
                setRejectModalOpen(false)
                await updateStatus('rejected' as OrderStatus, rejectReason.trim())
              }}
            >
              Confirm Rejection
            </Button>
          </Group>
        </Stack>
      </Modal>
    </PharmacySidebarLayout>
  )
}

