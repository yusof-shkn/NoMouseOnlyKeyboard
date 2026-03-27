import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Badge, Box, Button, Container, Group, Stack, Text, Table,
  NumberInput, TextInput, Loader, Center, Alert, Divider, Tooltip,
} from '@mantine/core'
import {
  TbArrowLeft, TbBuildingHospital, TbUsers, TbX,
  TbShieldCheck, TbShieldOff, TbAlertCircle, TbCheck, TbTruck, TbPackage,
  TbPlus, TbTrash, TbUser, TbBroadcast, TbCircleCheck, TbClock, TbPhone,
  TbMessageCircle, TbNotes,
  TbCurrencyDollar,
} from 'react-icons/tb'
import styled, { keyframes, css } from 'styled-components'
import { notifications } from '@mantine/notifications'
import { SavedColors } from '@shared/constants'
import { PageTitle, BlueDivider, SectionLabel } from '@shared/ui/typography'
import { ContentCard } from '@shared/ui/layout'
import { supabase, DbOrder, OrderStatus, DbStaff, DbDeliveryRequest, DeliveryRequestStatus } from '../../../lib/supabase'
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
  box-shadow: 0 4px 16px rgba(245,158,11,0.2);
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
  box-shadow: 0 2px 10px rgba(59,130,246,0.15);
`

const RiderCard = styled.div<{ $selected: boolean }>`
  display:flex;align-items:center;gap:12px;
  padding:12px 14px;border-radius:10px;cursor:pointer;
  border:2px solid ${p => p.$selected ? SavedColors.Primaryblue : '#E8EDF5'};
  background:${p => p.$selected ? '#EBF7FD' : '#fff'};
  transition:all 0.15s;
  ${p => p.$selected && css`animation:${selectedPulse} 2s ease infinite;`}
  &:hover{border-color:${SavedColors.Primaryblue};background:#f0fbff;}
`
const RadioDot = styled.div<{ $selected: boolean }>`
  width:18px;height:18px;border-radius:50%;flex-shrink:0;
  border:2px solid ${p => p.$selected ? SavedColors.Primaryblue : '#d1d5db'};
  background:${p => p.$selected ? SavedColors.Primaryblue : '#fff'};
  display:flex;align-items:center;justify-content:center;transition:all 0.15s;
`

//  Helpers 
const statusLabel = (s: string): string => ({
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
}[s] ?? s.replace(/_/g, ' '))

const statusColor = (s: string): string => ({
  delivered: 'teal', prescription_uploaded: 'blue', pricing_ready: 'orange',
  out_for_delivery: 'cyan', rejected: 'red', cancelled: 'gray', packing: 'violet',
  awaiting_confirmation: 'yellow', pharmacy_review: 'indigo', confirmed: 'green',
  dispatched: 'cyan',
}[s] ?? 'gray')

//  Types 
interface MedRow {
  id: string
  name: string
  quantity: number
  unit_price: number
  is_insured: boolean
  in_stock: boolean
  isNew?: boolean
}

//  Main component 
export default function PharmacyOrderDetail(): JSX.Element {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { staffInfo } = useAuth()
  const [order, setOrder] = useState<DbOrder | null>(null)
  const [meds, setMeds] = useState<MedRow[]>([])
  const [loading, setLoading] = useState(true)
  const [savingPricing, setSavingPricing] = useState(false)
  const [savingStatus, setSavingStatus]   = useState<string | null>(null) // holds the status string being saved
  const [prescriptionSignedUrl, setPrescriptionSignedUrl] = useState<string | null>(null)
  const [allSignedUrls, setAllSignedUrls] = useState<string[]>([])


  // Delivery
  const [deliveryStaff, setDeliveryStaff] = useState<DbStaff[]>([])
  const [deliveryRequests, setDeliveryRequests] = useState<DbDeliveryRequest[]>([])
  const [selectedRider, setSelectedRider] = useState<string | null>(null)
  const [assigning, setAssigning] = useState(false)

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
      setMeds(((data.medications as MedRow[] | null) ?? []).map((m: MedRow) => ({
        id: m.id, name: m.name,
        quantity: m.quantity ?? 1,
        unit_price: m.unit_price ?? 0,
        is_insured: m.is_insured ?? false,
        in_stock: m.in_stock !== false,
      })))

      // Sign all prescription images (multi-image support)
      const allPaths: string[] = data.prescription_urls?.length
        ? data.prescription_urls
        : data.prescription_url ? [data.prescription_url] : []

      if (allPaths.length) {
        const signedAll: string[] = []
        for (const rawUrl of allPaths) {
          let storagePath = rawUrl
          const match = rawUrl.match(/\/object\/(?:public|sign)\/prescriptions\/(.+?)(?:\?|$)/)
          if (match) storagePath = decodeURIComponent(match[1])
          const { data: signed, error: signErr } = await supabase.storage
            .from('prescriptions').createSignedUrl(storagePath, 3600)
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
    const { data: sd } = await supabase.from('staff').select('*').eq('role', 'delivery').order('name')
    if (sd) setDeliveryStaff(sd as DbStaff[])

    const { data: rd } = await supabase
      .from('delivery_requests')
      .select('*, staff:delivery_staff_id(id, name, phone, role)')
      .eq('order_id', id)
      .order('created_at', { ascending: false })
    if (rd) setDeliveryRequests(rd as DbDeliveryRequest[])
  }

  useEffect(() => {
    fetchOrder()
    fetchDeliveryData()

    const orderCh = supabase.channel(`order-detail-rt:${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${id}` }, () => fetchOrder())
      .subscribe()
    const reqCh = supabase.channel(`delivery-req-rt:${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_requests', filter: `order_id=eq.${id}` }, () => fetchDeliveryData())
      .subscribe()
    return () => { supabase.removeChannel(orderCh); supabase.removeChannel(reqCh) }
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  //  Insurance — ignored entirely for cash-only orders
  type ProfileWithInsurance = { insurance?: { status?: string; provider?: string } }
  const profileInsurance = order?.cash_only ? null : (order?.profiles as ProfileWithInsurance | null)?.insurance
  const insuranceStatus: string = order?.cash_only ? 'none' : (profileInsurance?.status ?? order?.insurance_status ?? 'none')
  const insuranceVerified = !order?.cash_only && insuranceStatus === 'verified'

  //  Med helpers 
  const toggleInsured = (medId: string, checked: boolean): void => {
    if (order?.cash_only) {
      notifications.show({ title: 'Cash-only order', message: 'Insurance coverage cannot be applied to cash-only orders.', color: 'orange' })
      return
    }
    if (checked && !insuranceVerified) {
      notifications.show({ title: 'Insurance not verified', message: "Insurance must be verified by support before applying coverage.", color: 'orange' })
      return
    }
    setMeds(prev => prev.map(m => m.id === medId ? { ...m, is_insured: checked } : m))
  }
  const updatePrice = (medId: string, price: number): void =>
    setMeds(prev => prev.map(m => m.id === medId ? { ...m, unit_price: price } : m))
  const toggleStock = (medId: string, inStock: boolean): void =>
    setMeds(prev => prev.map(m => m.id === medId ? { ...m, in_stock: inStock } : m))
  const addMedRow = (): void =>
    setMeds(prev => [...prev, { id: `new-${Date.now()}`, name: '', quantity: 1, unit_price: 0, is_insured: false, in_stock: true, isNew: true }])
  const removeMedRow = (medId: string): void =>
    setMeds(prev => prev.filter(m => m.id !== medId))
  const updateName = (medId: string, name: string): void =>
    setMeds(prev => prev.map(m => m.id === medId ? { ...m, name } : m))
  const updateQty = (medId: string, quantity: number): void =>
    setMeds(prev => prev.map(m => m.id === medId ? { ...m, quantity } : m))

  //  Send notification to customer via SECURITY DEFINER RPC 
  const sendCustomerNotification = async (status: OrderStatus, orderRef: DbOrder): Promise<void> => {
    const msgs: Partial<Record<OrderStatus, { title: string; body: string }>> = {
      pharmacy_review:    { title: 'Pharmacy Review Started',         body: `A pharmacist is now reviewing your prescription for order #${orderRef.order_number}.` },
      pricing_ready:      { title: 'Pricing Ready — Action Required', body: `Your order #${orderRef.order_number} is priced. Please review and confirm to proceed.` },
      packing:            { title: 'Order Being Packed',              body: `Your medications for order #${orderRef.order_number} are being packed.` },
      dispatched:         { title: 'Order Dispatched!',               body: `Your order #${orderRef.order_number} has left the pharmacy. A rider is on the way!` },
      out_for_delivery:   { title: 'Out for Delivery — Almost There!',body: `Your rider is nearby with order #${orderRef.order_number}. Have your QR code ready.` },
      delivered:          { title: 'Order Delivered',                  body: `Your order #${orderRef.order_number} has been delivered. Thank you for using MedDeliverySOS!` },
      rejected:           { title: 'Order Rejected',                   body: `Order #${orderRef.order_number} could not be fulfilled. Please contact support.` },
      cancelled:          { title: 'Order Cancelled',                    body: `Your order #${orderRef.order_number} has been cancelled.` },
    }
    const msg = msgs[status]
    if (!msg || !orderRef.user_id) return
    const { error } = await supabase.rpc('notify_customer', {
      p_user_id: orderRef.user_id, p_type: 'order_status_update',
      p_title: msg.title, p_body: msg.body, p_order_id: orderRef.id,
    })
    if (error) console.warn('notify_customer RPC failed:', error.message)
  }

  //  Save pricing 
  const savePricing = async (): Promise<void> => {
    if (!order) return
    const namedMeds = meds.filter(m => m.name.trim())
    if (!namedMeds.length) {
      notifications.show({ title: 'No medications', message: 'Add at least one medication before saving.', color: 'orange' })
      return
    }
    setSavingPricing(true)

    for (const med of namedMeds) {
      if (med.isNew) {
        await supabase.from('medications').insert({
          order_id: order.id, name: med.name.trim(), quantity: med.quantity,
          unit_price: med.unit_price, is_insured: med.is_insured, in_stock: med.in_stock,
        })
      } else {
        await supabase.from('medications').update({
          unit_price: med.unit_price, is_insured: med.is_insured, in_stock: med.in_stock,
        }).eq('id', med.id)
      }
    }

    const subtotal      = namedMeds.filter(m => m.in_stock).reduce((s, m) => s + m.unit_price * m.quantity, 0)
    const insuredAmount = namedMeds.filter(m => m.is_insured && m.in_stock).reduce((s, m) => s + m.unit_price * m.quantity, 0)
    const cashTotal     = namedMeds.filter(m => !m.is_insured && m.in_stock).reduce((s, m) => s + m.unit_price * m.quantity, 0)
    const deliveryFee   = order.delivery_fee ?? 5000

    const { error: orderErr } = await supabase.from('orders').update({
      subtotal, insured_amount: insuredAmount, cash_amount: cashTotal,
      total_amount: cashTotal + deliveryFee, status: 'pricing_ready',
      price_revision_count: (order.price_revision_count ?? 0) + 1,
      updated_at: new Date().toISOString(),
    }).eq('id', order.id)

    if (orderErr) {
      notifications.show({ title: 'Error saving', message: orderErr.message, color: 'red' })
      setSavingPricing(false)
      return
    }

    await sendCustomerNotification('pricing_ready', order)
    notifications.show({ title: 'Pricing saved', message: 'Customer notified to review and confirm.', color: 'teal' })
    setSavingPricing(false)
    setEditingPricing(false)
    fetchOrder()
  }

  //  Update status 
  const updateStatus = async (status: OrderStatus): Promise<void> => {
    if (!order) return
    setSavingStatus(status)

    const { error: updateErr } = await supabase.from('orders').update({
      status, updated_at: new Date().toISOString(),
    }).eq('id', order.id)

    if (updateErr) {
      notifications.show({ title: 'Failed to update status', message: updateErr.message, color: 'red' })
      setSavingStatus(null)
      return
    }

    notifications.show({ title: 'Status updated', message: statusLabel(status), color: 'teal' })
    setSavingStatus(null)
    fetchOrder()
  }

  //  Dispatch 
  const confirmDispatch = async (): Promise<void> => {
    if (!order || !selectedRider) {
      notifications.show({ title: 'Select a rider', message: 'Choose a rider or broadcast before dispatching.', color: 'orange' })
      return
    }
    setAssigning(true)

    const isBroadcast = selectedRider === '__broadcast__'
    const staffToNotify = isBroadcast ? deliveryStaff : deliveryStaff.filter(s => s.id === selectedRider)

    if (!staffToNotify.length) {
      notifications.show({ title: 'No riders available', message: 'No active delivery staff found.', color: 'orange' })
      setAssigning(false)
      return
    }

    const { error: reqErr } = await supabase.from('delivery_requests').insert(
      staffToNotify.map(s => ({
        order_id: order.id, delivery_staff_id: s.id,
        sent_by: staffInfo?.id ?? null, status: 'pending' as DeliveryRequestStatus,
      }))
    )

    if (reqErr) {
      notifications.show({ title: 'Error dispatching', message: reqErr.message, color: 'red' })
      setAssigning(false)
      return
    }

    await updateStatus('dispatched' as OrderStatus)

    notifications.show({
      title: isBroadcast ? ' Broadcast sent!' : ' Rider assigned!',
      message: isBroadcast
        ? `${staffToNotify.length} rider(s) notified — first to accept delivers.`
        : `${staffToNotify[0].name} has been sent the delivery request.`,
      color: 'teal',
    })

    setAssigning(false)
    setSelectedRider(null)
    fetchDeliveryData()
  }

  //  Render guards 
  if (loading) return <Center h="100vh"><Loader color="lotusCyan" /></Center>
  if (!order)  return <Center h="100vh"><Text c="dimmed">Order not found</Text></Center>

  //  Derived values 
  const subtotal      = meds.filter(m => m.in_stock).reduce((s, m) => s + m.unit_price * m.quantity, 0)
  const insuredAmount = meds.filter(m => m.is_insured && m.in_stock).reduce((s, m) => s + m.unit_price * m.quantity, 0)
  const cashTotal     = meds.filter(m => !m.is_insured && m.in_stock).reduce((s, m) => s + m.unit_price * m.quantity, 0)
  const deliveryFee   = order.delivery_fee ?? 5000
  const grandTotal    = cashTotal + deliveryFee

  // Staff can edit pricing when order is being reviewed OR when pricing is already set (unlimited revisions)
  const canSetPricing = order.status === 'pharmacy_review' || order.status === 'pricing_ready'

  // Show pricing summary totals once pricing has been submitted at least once
  const pricingSummaryVisible = !['prescription_uploaded', 'insurance_verification'].includes(order.status)

  const allDeclinedOrExpired = deliveryRequests.length > 0 &&
    deliveryRequests.every(r => r.status === 'declined' || r.status === 'expired')
  const hasAcceptedRider = deliveryRequests.some(r => r.status === 'accepted')

  // Show delivery assignment panel when packing, or when dispatched but all requests failed
  const showAssignPanel = order.status === 'packing' ||
    (order.status === 'dispatched' && allDeclinedOrExpired)

  return (
    <PharmacySidebarLayout>
      <Container size="xl" py="xl">
          <Button variant="subtle" color="lotusCyan" leftSection={<TbArrowLeft size={16} />}
            onClick={() => navigate('/pharmacy/dashboard')} mb="lg">
            Back to Dashboard
          </Button>

          <Box mb="xl">
            <SectionLabel>Order Detail</SectionLabel>
            <PageTitle>Order #{order.order_number}</PageTitle>
            <BlueDivider />
          </Box>

          {/*  Info cards  */}
          <Group gap="md" mb="xl" wrap="wrap">
            <ContentCard
              style={{ flex: 1, minWidth: 200, cursor: 'pointer', transition: 'box-shadow 0.15s', border: `1.5px solid ${SavedColors.DemWhite}` }}
              onClick={() => order.user_id && navigate(`/pharmacy/customer/${order.user_id}`)}
            >
              <Group justify="space-between" align="flex-start">
                <Box>
                  <Text size="xs" c="dimmed" mb={4}>Patient</Text>
                  <Text fw={700}>{(order.profiles as { name?: string } | null)?.name ?? '—'}</Text>
                  <Text size="xs" c="dimmed">{(order.profiles as { relationship?: string } | null)?.relationship}</Text>
                </Box>
                <TbUser size={16} color={SavedColors.Primaryblue} style={{ marginTop: 2, flexShrink: 0 }} />
              </Group>
              <Text size="xs" c={SavedColors.Primaryblue} mt={8} fw={600}>View Profile </Text>
            </ContentCard>
            <ContentCard style={{ flex: 1, minWidth: 200 }}>
              <Text size="xs" c="dimmed" mb={4}>Order Status</Text>
              <Badge color={statusColor(order.status)} size="lg">{statusLabel(order.status)}</Badge>
            </ContentCard>
            {/* Payment type card — replaces insurance card for cash orders */}
            <ContentCard style={{ flex: 1, minWidth: 200 }}>
              <Text size="xs" c="dimmed" mb={4}>Payment Type</Text>
              {order.cash_only ? (
                <Group gap={6}>
                  <TbCurrencyDollar size={18} color="#D97706" />
                  <Badge color="orange" variant="light" size="md">Cash Only</Badge>
                </Group>
              ) : (
                <>
                  <Group gap={6} mb={4}>
                    {insuranceVerified
                      ? <TbShieldCheck size={18} color="#12B76A" />
                      : <TbShieldOff size={18} color={insuranceStatus === 'rejected' ? '#EF4444' : '#9ca3af'} />
                    }
                    <Badge
                      color={insuranceVerified ? 'teal' : insuranceStatus === 'pending' ? 'yellow' : insuranceStatus === 'rejected' ? 'red' : 'gray'}
                      variant="light">
                      Insurance · {insuranceStatus}
                    </Badge>
                  </Group>
                  {profileInsurance?.provider && <Text size="xs" c="dimmed">{profileInsurance.provider}</Text>}
                </>
              )}
            </ContentCard>
          </Group>

          {/* Cash-only banner — shown instead of insurance alerts */}
          {order.cash_only ? (
            <Alert color="orange" icon={<TbCurrencyDollar size={16} />} mb="lg">
              <Text size="sm" fw={600}>Cash-only order — insurance verification skipped</Text>
              <Text size="xs" mt={2}>The customer chose to pay in full. All medications must be priced as cash pay.</Text>
            </Alert>
          ) : (
            <>
              {insuranceStatus === 'pending' && (
                <Alert color="yellow" icon={<TbAlertCircle size={16} />} mb="lg">
                  <Text size="sm" fw={600}>Insurance under review by support</Text>
                  <Text size="xs" mt={2}>You cannot apply insurance coverage until verification is complete.</Text>
                </Alert>
              )}
              {insuranceStatus === 'rejected' && (
                <Alert color="red" icon={<TbShieldOff size={16} />} mb="lg">
                  <Text size="sm" fw={600}>Insurance rejected — all medications are cash pay</Text>
                </Alert>
              )}
              {insuranceStatus === 'none' && (
                <Alert color="gray" icon={<TbShieldOff size={16} />} mb="lg">
                  <Text size="sm" fw={600}>No insurance on file — full cash payment applies</Text>
                </Alert>
              )}
            </>
          )}

          {/*  Prescription viewer  */}
          {prescriptionSignedUrl && (
            <ContentCard style={{ marginBottom: 24 }}>
              <Text fw={700} c={SavedColors.TextColor} size="sm" mb="sm">Prescription</Text>
              {(order as { prescription_notes?: string }).prescription_notes && (
                <PrescriptionNoteBanner>
                  <Box style={{
                    width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                    background: 'linear-gradient(135deg,#3b82f6,#1d4ed8)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <TbNotes size={20} color="#fff" />
                  </Box>
                  <Box style={{ flex: 1 }}>
                    <Group gap={6} mb={4}>
                      <Text size="sm" fw={800} c="#1d4ed8">Patient Note</Text>
                      <Badge color="blue" variant="filled" size="xs">From Customer</Badge>
                    </Group>
                    <Text size="sm" fw={600} c="#1e3a5f" lh={1.6}>
                      {(order as { prescription_notes?: string }).prescription_notes}
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
              <Box style={{
                width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                background: 'linear-gradient(135deg,#f59e0b,#d97706)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(245,158,11,0.4)',
              }}>
                <TbMessageCircle size={22} color="#fff" />
              </Box>
              <Box style={{ flex: 1 }}>
                <Group gap={8} mb={6}>
                  <Text size="sm" fw={800} c="#92400e"> Customer Requested Changes</Text>
                  <Badge color="orange" variant="filled" size="xs">Action Required</Badge>
                </Group>
                <Text size="sm" fw={600} c="#78350f" lh={1.6} style={{
                  background: 'rgba(255,255,255,0.6)',
                  borderRadius: 8,
                  padding: '8px 12px',
                  border: '1px solid rgba(245,158,11,0.3)',
                }}>
                  {order.pharmacy_notes.replace('[Customer requested changes]: ', '')}
                </Text>
                <Text size="xs" c="#92400e" mt={8} fw={600}>
                  Please review the pricing below and update accordingly, then re-save to notify the customer.
                </Text>
              </Box>
            </CustomerMessageBanner>
          )}

          {/*  Order Chat Panel — visible for all active non-terminal orders  */}
          {!['delivered', 'cancelled', 'rejected'].includes(order.status) && staffInfo && (
            <ContentCard style={{ padding: 0, overflow: 'hidden', marginBottom: 24 }}>
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

          {/*  Medications & Pricing  */}
          <ContentCard style={{ marginBottom: 24 }}>
            <Group justify="space-between" mb="md">
              <Text fw={700} c={SavedColors.TextColor}>Medications & Pricing</Text>
              {order.cash_only
                ? <Badge color="orange" variant="light" leftSection={<TbCurrencyDollar size={12} />}>Cash-only order — no insurance coverage</Badge>
                : insuranceVerified
                  ? <Badge color="teal" variant="light" leftSection={<TbShieldCheck size={12} />}>Insurance verified — coverage available</Badge>
                  : <Badge color="orange" variant="light" leftSection={<TbShieldOff size={12} />}>Verify insurance to apply coverage</Badge>
              }
            </Group>

            {meds.length === 0 && canSetPricing && (
              <Alert color="blue" variant="light" icon={<TbAlertCircle size={14} />} mb="md">
                <Text size="sm">No medications yet. Add medications from the prescription above.</Text>
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
                  {meds.map(med => (
                    <Table.Tr key={med.id} style={{ opacity: med.in_stock ? 1 : 0.5 }}>
                      <Table.Td>
                        {canSetPricing && med.isNew
                          ? <TextInput value={med.name} onChange={e => updateName(med.id, e.target.value)} placeholder="Medication name" size="xs" style={{ width: 160 }} />
                          : <Text size="sm" fw={600}>{med.name}</Text>
                        }
                      </Table.Td>
                      <Table.Td>
                        {canSetPricing && med.isNew
                          ? <NumberInput value={med.quantity} onChange={val => updateQty(med.id, Number(val) || 1)} min={1} size="xs" style={{ width: 70 }} />
                          : <Text size="sm">{med.quantity}</Text>
                        }
                      </Table.Td>
                      <Table.Td>
                        {canSetPricing
                          ? <NumberInput value={med.unit_price} onChange={val => updatePrice(med.id, Number(val) || 0)} min={0} step={500} size="xs" style={{ width: 120 }} disabled={med.is_insured} />
                          : <Text size="sm">{med.unit_price.toLocaleString()}</Text>
                        }
                      </Table.Td>
                      <Table.Td>
                        {canSetPricing
                          ? (
                            <Tooltip label={order.cash_only ? 'Cash-only order' : !insuranceVerified ? 'Insurance must be verified first' : ''} disabled={!order.cash_only && insuranceVerified}>
                              <span>
                                <Button size="xs" variant={med.is_insured ? 'filled' : 'outline'}
                                  color={med.is_insured ? 'teal' : 'gray'} disabled={order.cash_only || !insuranceVerified}
                                  onClick={() => toggleInsured(med.id, !med.is_insured)}
                                  leftSection={med.is_insured ? <TbShieldCheck size={12} /> : <TbShieldOff size={12} />}>
                                  {med.is_insured ? 'Insured' : 'Cash Pay'}
                                </Button>
                              </span>
                            </Tooltip>
                          )
                          : <Badge size="xs" color={med.is_insured ? 'teal' : 'gray'} variant="light">{med.is_insured ? 'Insured' : 'Cash Pay'}</Badge>
                        }
                      </Table.Td>
                      <Table.Td>
                        {canSetPricing
                          ? <Button size="xs" variant={med.in_stock ? 'light' : 'outline'} color={med.in_stock ? 'green' : 'red'} onClick={() => toggleStock(med.id, !med.in_stock)}>{med.in_stock ? 'In Stock' : 'Out of Stock'}</Button>
                          : <Badge size="xs" color={med.in_stock ? 'green' : 'red'} variant="light">{med.in_stock ? 'In Stock' : 'Out of Stock'}</Badge>
                        }
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" fw={600} c={med.is_insured ? 'teal' : undefined}>
                          {med.is_insured ? 'Covered' : med.in_stock ? `UGX ${(med.unit_price * med.quantity).toLocaleString()}` : 'N/A'}
                        </Text>
                      </Table.Td>
                      {canSetPricing && (
                        <Table.Td>
                          <Button size="xs" variant="subtle" color="red" onClick={() => removeMedRow(med.id)}>
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
              <Button variant="subtle" color="lotusCyan" size="sm" mt="sm" leftSection={<TbPlus size={14} />} onClick={addMedRow}>
                Add Medication
              </Button>
            )}

            {/* Task 10: Only show summary totals when pricing has been submitted */}
            {pricingSummaryVisible && (
              <>
                <Divider my="md" />
                <Group justify="flex-end">
                  <Stack gap={4} align="flex-end">
                    <Group gap="xl">
                      <Text size="sm" c="dimmed">Subtotal</Text>
                      <Text size="sm" fw={600}>UGX {subtotal.toLocaleString()}</Text>
                    </Group>
                    {insuredAmount > 0 && (
                      <Group gap="xl">
                        <Text size="sm" c="teal">Insurance Covers</Text>
                        <Text size="sm" fw={600} c="teal">− UGX {insuredAmount.toLocaleString()}</Text>
                      </Group>
                    )}
                    <Group gap="xl">
                      <Text size="sm" c="dimmed">Cash Medications</Text>
                      <Text size="sm" fw={600}>UGX {cashTotal.toLocaleString()}</Text>
                    </Group>
                    <Group gap="xl">
                      <Text size="sm" c="dimmed">Delivery Fee</Text>
                      <Text size="sm" fw={600}>UGX {deliveryFee.toLocaleString()}</Text>
                    </Group>
                    <Divider style={{ width: '100%' }} />
                    <Group gap="xl">
                      <Text fw={700}>Total (Cash Due)</Text>
                      <Text fw={800} size="xl" c={SavedColors.Primaryblue}>UGX {grandTotal.toLocaleString()}</Text>
                    </Group>
                  </Stack>
                </Group>
              </>
            )}

            {/* Save pricing button — available in pharmacy_review and pricing_ready */}
            {canSetPricing && (
              <Group justify="flex-end" mt="md">
                <Button color="lotusCyan" loading={savingPricing} onClick={savePricing}
                  leftSection={<TbCheck size={16} />} size="md">
                  {order.status === 'pricing_ready' ? 'Update Pricing & Notify Customer' : 'Save Pricing & Notify Customer'}
                </Button>
              </Group>
            )}
          </ContentCard>

          {/* 
              DELIVERY ASSIGNMENT PANEL
              Shown when: packing  OR  dispatched + all requests failed
               */}
          {showAssignPanel && (
            <ContentCard style={{ marginBottom: 24, borderColor: `${SavedColors.Primaryblue}50`, borderWidth: 2 }}>
              {/* Step header */}
              <Group gap="md" mb="lg" pb="md" style={{ borderBottom: '1px solid #e8edf5' }}>
                <Box style={{
                  width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                  background: 'linear-gradient(135deg,#15B3E0,#012970)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <TbTruck size={22} color="#fff" />
                </Box>
                <Box style={{ flex: 1 }}>
                  <Group gap={8}>
                    <Text fw={800} size="md" c={SavedColors.TextColor}>
                      {order.status === 'dispatched' ? 'Re-Assign Delivery Rider' : 'Assign Delivery Rider'}
                    </Text>
                    {order.status === 'dispatched' && allDeclinedOrExpired && (
                      <Badge color="orange" variant="light" size="sm">All requests failed</Badge>
                    )}
                  </Group>
                  <Text size="xs" c="dimmed" mt={2}>
                    {order.status === 'dispatched'
                      ? 'All previous requests were declined or expired. Pick a new rider to re-dispatch.'
                      : 'Select who will deliver this order. The order moves to "Dispatched" once you confirm.'}
                  </Text>
                </Box>
              </Group>

              {deliveryStaff.length === 0 ? (
                <Alert color="orange" variant="light" icon={<TbAlertCircle size={14} />}>
                  <Text size="sm" fw={600}>No delivery staff found</Text>
                  <Text size="xs" mt={2}>
                    Go to{' '}
                    <Text component="span" fw={700} c={SavedColors.Primaryblue} style={{ cursor: 'pointer' }}
                      onClick={() => navigate('/pharmacy/users')}>User Management</Text>
                    {' '}to add delivery staff before dispatching.
                  </Text>
                </Alert>
              ) : (
                <Stack gap="sm">
                  <Text size="xs" c="dimmed" mb={4}>
                    Choose how to assign delivery — broadcast notifies all riders, or pick a specific one:
                  </Text>

                  {/* Broadcast option */}
                  <RiderCard $selected={selectedRider === '__broadcast__'} onClick={() => setSelectedRider('__broadcast__')}>
                    <RadioDot $selected={selectedRider === '__broadcast__'}>
                      {selectedRider === '__broadcast__' && (
                        <Box style={{ width: 7, height: 7, borderRadius: '50%', background: '#fff' }} />
                      )}
                    </RadioDot>
                    <Box style={{
                      width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                      background: 'linear-gradient(135deg,#15B3E0,#012970)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <TbBroadcast size={18} color="#fff" />
                    </Box>
                    <Box style={{ flex: 1 }}>
                      <Group gap={6} mb={2}>
                        <Text size="sm" fw={700} c={SavedColors.TextColor}>Broadcast to all riders</Text>
                        <Badge color="blue" variant="light" size="xs">Recommended</Badge>
                      </Group>
                      <Text size="xs" c="dimmed">
                        {deliveryStaff.length} rider{deliveryStaff.length !== 1 ? 's' : ''} notified simultaneously — first to accept delivers
                      </Text>
                    </Box>
                  </RiderCard>

                  {deliveryStaff.length > 0 && (
                    <Divider label="or pick a specific rider" labelPosition="center" my={4} />
                  )}

                  {/* Individual rider cards */}
                  {deliveryStaff.map(s => (
                    <RiderCard key={s.id} $selected={selectedRider === s.id} onClick={() => setSelectedRider(s.id)}>
                      <RadioDot $selected={selectedRider === s.id}>
                        {selectedRider === s.id && (
                          <Box style={{ width: 7, height: 7, borderRadius: '50%', background: '#fff' }} />
                        )}
                      </RadioDot>
                      <Box style={{
                        width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                        background: s.is_active ? SavedColors.lightBlue : '#f3f4f6',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <TbUser size={18} color={s.is_active ? SavedColors.Primaryblue : '#9ca3af'} />
                      </Box>
                      <Box style={{ flex: 1 }}>
                        <Text size="sm" fw={700} c={s.is_active ? SavedColors.TextColor : '#9ca3af'}>{s.name}</Text>
                        {s.phone && <Text size="xs" c="dimmed">{s.phone}</Text>}
                      </Box>
                      <Badge color={s.is_active ? 'green' : 'gray'} variant="dot" size="sm">
                        {s.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </RiderCard>
                  ))}

                  {/* Confirm button */}
                  <Group justify="flex-end" mt="sm">
                    <Button
                      size="md"
                      color="lotusCyan"
                      loading={assigning}
                      disabled={!selectedRider}
                      leftSection={<TbTruck size={16} />}
                      style={{ minWidth: 200 }}
                      onClick={confirmDispatch}
                    >
                      {order.status === 'dispatched' ? 'Re-Dispatch & Notify' : 'Dispatch Order & Notify'}
                    </Button>
                  </Group>
                </Stack>
              )}
            </ContentCard>
          )}

          {/*  Delivery Requests Tracker  */}
          {deliveryRequests.length > 0 && !showAssignPanel && (
            <ContentCard style={{ marginBottom: 24 }}>
              <Group gap="sm" mb="md">
                <TbTruck size={18} color={SavedColors.Primaryblue} />
                <Text fw={700} c={SavedColors.TextColor}>Delivery Requests</Text>
              </Group>
              <Stack gap="xs">
                {deliveryRequests.map(req => {
                  const reqStaff = req.staff as DbStaff | undefined
                  const statusColors: Record<DeliveryRequestStatus, string> = {
                    pending: 'yellow', accepted: 'teal', declined: 'red', expired: 'gray',
                  }
                  const statusIcon: Record<DeliveryRequestStatus, JSX.Element> = {
                    pending: <TbClock size={12} />,
                    accepted: <TbCircleCheck size={12} />,
                    declined: <TbX size={12} />,
                    expired: <TbClock size={12} />,
                  }
                  return (
                    <Group key={req.id} justify="space-between" p="sm" style={{
                      background: req.status === 'accepted' ? '#f0fdf4' : SavedColors.bgWhite,
                      borderRadius: 8,
                      border: `1px solid ${req.status === 'accepted' ? '#86efac' : SavedColors.DemWhite}`,
                    }}>
                      <Group gap="sm">
                        <Box style={{ width: 36, height: 36, borderRadius: '50%', background: SavedColors.lightBlue, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <TbUser size={18} color={SavedColors.Primaryblue} />
                        </Box>
                        <Box>
                          <Text size="sm" fw={600}>{reqStaff?.name ?? 'Unknown'}</Text>
                          {reqStaff?.phone && <Text size="xs" c="dimmed">{reqStaff.phone}</Text>}
                        </Box>
                      </Group>
                      <Badge color={statusColors[req.status]} variant="light" size="sm" leftSection={statusIcon[req.status]}>
                        {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                      </Badge>
                    </Group>
                  )
                })}
              </Stack>
            </ContentCard>
          )}

          {/*  OTP Fallback Panel — shown when out for delivery  */}
          {order.status === 'out_for_delivery' && order.otp && (
            <ContentCard style={{ marginBottom: 24, borderColor: '#15B3E050', borderWidth: 2 }}>
              <Group gap="md" mb="md" pb="md" style={{ borderBottom: '1px solid #e8edf5' }}>
                <Box style={{
                  width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                  background: 'linear-gradient(135deg,#15B3E0,#012970)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <TbPhone size={22} color="#fff" />
                </Box>
                <Box>
                  <Text fw={800} size="md" c={SavedColors.TextColor}>OTP Fallback — Rider Assistance</Text>
                  <Text size="xs" c="dimmed" mt={2}>
                    If the rider calls because the customer&apos;s QR code won&apos;t scan, read them this OTP.
                    The rider enters it manually to confirm delivery.
                  </Text>
                </Box>
              </Group>
              <Alert color="yellow" variant="light" icon={<TbAlertCircle size={14} />} mb="md">
                <Text size="sm" fw={600}>Only share this OTP with the assigned delivery rider over the phone</Text>
                <Text size="xs" mt={2} c="dimmed">Never give this to the customer directly — the rider must enter it on their device.</Text>
              </Alert>
              <Box style={{ textAlign: 'center' }}>
                <Text size="xs" c="dimmed" mb={8} style={{ textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
                  Delivery OTP for Order #{order.order_number}
                </Text>
                <Box style={{
                  display: 'inline-block',
                  background: SavedColors.lightBlue,
                  border: `2px solid ${SavedColors.Primaryblue}`,
                  borderRadius: 12,
                  padding: '14px 32px',
                }}>
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
                  <Text size="xs" c="dimmed" mt={8}>
                    Expires: {formatRelativeTime(order.otp_expires_at)}
                  </Text>
                )}
              </Box>
            </ContentCard>
          )}
          <ContentCard>
            <Text fw={700} mb="md" c={SavedColors.TextColor}>Actions</Text>
            <Stack gap="sm" align="flex-start">

              {order.status === 'prescription_uploaded' && (
                <Button color="blue" loading={savingStatus === 'pharmacy_review'} leftSection={<TbPackage size={16} />}
                  onClick={() => updateStatus('pharmacy_review' as OrderStatus)}>
                  Start Pharmacy Review
                </Button>
              )}

              {order.status === 'confirmed' && (
                <Button color="violet" loading={savingStatus === 'packing'} leftSection={<TbPackage size={16} />}
                  onClick={() => updateStatus('packing' as OrderStatus)}>
                  Start Packing
                </Button>
              )}

              {order.status === 'packing' && (
                <Alert color="blue" variant="light" icon={<TbTruck size={14} />} style={{ width: '100%' }}>
                  <Text size="sm" fw={600}>Ready to dispatch?</Text>
                  <Text size="xs" mt={2} c="dimmed">Use the <b>Assign Delivery Rider</b> card above to select a rider and dispatch this order.</Text>
                </Alert>
              )}

              {order.status === 'dispatched' && !allDeclinedOrExpired && (
                hasAcceptedRider ? (
                  <Button color="teal" loading={savingStatus === 'out_for_delivery'} leftSection={<TbTruck size={16} />}
                    onClick={() => updateStatus('out_for_delivery' as OrderStatus)}>
                    Mark Out for Delivery
                  </Button>
                ) : (
                  <Alert color="yellow" variant="light" icon={<TbClock size={14} />} style={{ width: '100%' }}>
                    <Text size="sm" fw={600}>Waiting for a rider to accept</Text>
                    <Text size="xs" mt={2} c="dimmed">
                      The &quot;Out for Delivery&quot; button appears once a rider accepts the request.
                    </Text>
                  </Alert>
                )
              )}

              {order.status === 'out_for_delivery' && (
                <Button color="green" loading={savingStatus === 'delivered'} leftSection={<TbCheck size={16} />}
                  onClick={() => updateStatus('delivered' as OrderStatus)}>
                  Mark as Delivered
                </Button>
              )}

              {!['rejected', 'cancelled', 'delivered'].includes(order.status) && (
                <Button color="red" variant="subtle" loading={savingStatus === 'rejected'}
                  onClick={() => updateStatus('rejected' as OrderStatus)}>
                  Reject Order
                </Button>
              )}
            </Stack>
          </ContentCard>

      </Container>
    </PharmacySidebarLayout>
  )
}
