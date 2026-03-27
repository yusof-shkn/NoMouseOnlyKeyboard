import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Badge,
  Box,
  Button,
  Container,
  Group,
  Text,
  Stack,
  Loader,
  Center,
  Anchor,
  Divider,
  Modal,
  Textarea,
} from '@mantine/core'
import {
  TbArrowLeft,
  TbCheck,
  TbClock,
  TbTruck,
  TbPackage,
  TbPill,
  TbShieldCheck,
  TbCreditCard,
  TbAlertCircle,
  TbX,
  TbUpload,
  TbChevronRight,
  TbHeartbeat,
  TbQrcode,
  TbPhone,
  TbUser,
  TbShieldOff,
} from 'react-icons/tb'
import { QRCodeSVG } from 'qrcode.react'
import styled, { keyframes, css } from 'styled-components'
import { PageWrapper, PageHeader, ContentCard } from '@shared/ui/layout'
import { PageTitle, BlueDivider, SectionLabel } from '@shared/ui/typography'
import { SavedColors } from '@shared/constants'
import { supabase, DbOrder } from '../../../lib/supabase'
import { formatRelativeTime } from '../../../shared/utils/formatTime'
import { useAuth } from '../../../features/auth/context/AuthContext'
import { notifications } from '@mantine/notifications'

// ─── Animations ──────────────────────────────────────────────────────────────

const pulse = keyframes`
  0%   { transform: scale(1);    opacity: 1; }
  50%  { transform: scale(1.55); opacity: 0.35; }
  100% { transform: scale(1);    opacity: 1; }
`

const ripple = keyframes`
  0%   { transform: scale(0.85); opacity: 0.9; }
  70%  { transform: scale(2.2);  opacity: 0; }
  100% { transform: scale(0.85); opacity: 0; }
`

const heartbeat = keyframes`
  0%   { transform: scale(1); }
  14%  { transform: scale(1.2); }
  28%  { transform: scale(1); }
  42%  { transform: scale(1.15); }
  70%  { transform: scale(1); }
  100% { transform: scale(1); }
`

const fadeSlideIn = keyframes`
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
`

// ─── Styled components ────────────────────────────────────────────────────────

const TimelineWrap = styled.div`
  position: relative;
  padding: 4px 0;
`

const TimelineLine = styled.div<{ $progress: number }>`
  position: absolute;
  left: 23px;
  top: 28px;
  bottom: 28px;
  width: 2px;
  background: ${SavedColors.DemWhite};
  border-radius: 2px;
  overflow: hidden;
  &::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: ${(p: { $progress: number }) => p.$progress}%;
    background: linear-gradient(180deg, ${SavedColors.Primaryblue}, #012970);
    border-radius: 2px;
    transition: height 0.7s cubic-bezier(0.4, 0, 0.2, 1);
  }
`

const StepRow = styled.div<{ $state: 'done' | 'active' | 'pending' }>`
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 10px 0;
  animation: ${fadeSlideIn} 0.4s ease both;
  opacity: ${(p: { $state: string }) => (p.$state === 'pending' ? 0.42 : 1)};
  transition: opacity 0.3s ease;
`

const IconWrap = styled.div<{ $state: 'done' | 'active' | 'pending' }>`
  position: relative;
  flex-shrink: 0;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2;
  background: ${(p: { $state: string }) =>
    p.$state === 'done'
      ? 'linear-gradient(135deg,#12B76A,#059669)'
      : p.$state === 'active'
        ? 'linear-gradient(135deg,' + SavedColors.Primaryblue + ',#012970)'
        : SavedColors.DemWhite};
  box-shadow: ${(p: { $state: string }) =>
    p.$state === 'done'
      ? '0 4px 14px rgba(18,183,106,0.35)'
      : p.$state === 'active'
        ? '0 4px 20px rgba(21,179,224,0.5)'
        : 'none'};
  color: ${(p: { $state: string }) =>
    p.$state === 'pending' ? SavedColors.DarkWhite : '#fff'};
  transition: all 0.4s ease;
`

const PulseRing = styled.span`
  position: absolute;
  inset: -3px;
  border-radius: 50%;
  border: 2.5px solid ${SavedColors.Primaryblue};
  animation: ${ripple} 1.8s ease-out infinite;
  pointer-events: none;
`

const PulseRing2 = styled.span`
  position: absolute;
  inset: -3px;
  border-radius: 50%;
  border: 2.5px solid ${SavedColors.Primaryblue};
  animation: ${ripple} 1.8s ease-out infinite 0.6s;
  pointer-events: none;
`

const HeartbeatIcon = styled.span`
  display: flex;
  align-items: center;
  justify-content: center;
  animation: ${heartbeat} 1.4s ease-in-out infinite;
`

const StepContent = styled.div`
  flex: 1;
  padding-top: 4px;
  min-width: 0;
`

const LiveBadge = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 2px 10px;
  border-radius: 20px;
  background: rgba(21, 179, 224, 0.1);
  border: 1px solid rgba(21, 179, 224, 0.3);
  font-size: 11px;
  font-weight: 700;
  color: ${SavedColors.Primaryblue};
  letter-spacing: 0.04em;
  text-transform: uppercase;
`

const LiveDot = styled.span`
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: ${SavedColors.Primaryblue};
  display: inline-block;
  animation: ${pulse} 1.2s ease-in-out infinite;
`

const ActionBanner = styled.div<{ $bg: string; $border: string }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 20px;
  background: ${(p: { $bg: string; $border: string }) => p.$bg};
  border: 1.5px solid ${(p: { $bg: string; $border: string }) => p.$border};
  border-radius: 12px;
  flex-wrap: wrap;
`

const SummaryGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
  gap: 10px;
  margin-top: 18px;
`


const reviewPulse = keyframes`
  0%,100% { box-shadow: 0 0 0 0 rgba(245,158,11,0.4); }
  50%      { box-shadow: 0 0 0 10px rgba(245,158,11,0); }
`
const ReviewBannerWrap = styled.div<{ $pulse: boolean }>`
  ${(p) =>
    p.$pulse &&
    css`
      animation: ${reviewPulse} 1.5s ease-in-out 3;
    `}
  border-radius: 12px;
`

const SummaryCell = styled.div`
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 8px;
  padding: 10px 14px;
`

const ConfirmBar = styled.div<{ $visible: boolean }>`
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 200;
  background: #fff;
  border-top: 2px solid #fde68a;
  padding: 14px 20px 20px;
  box-shadow: 0 -8px 32px rgba(1, 41, 112, 0.12);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  transform: translateY(
    ${(p: { $visible: boolean }) => (p.$visible ? '0' : '100%')}
  );
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  @media (max-width: 899px) {
    bottom: 64px;
    border-radius: 16px 16px 0 0;
    padding-bottom: 18px;
  }
`

const ConfirmSpacer = styled.div<{ $show: boolean }>`
  height: ${(p: { $show: boolean }) => (p.$show ? '130px' : '24px')};
  @media (max-width: 899px) {
    height: ${(p: { $show: boolean }) => (p.$show ? '190px' : '24px')};
  }
`

// ─── Data ─────────────────────────────────────────────────────────────────────

const STEPS = [
  {
    key: 'prescription_uploaded',
    label: 'Prescription Uploaded',
    desc: 'Your prescription has been received and is queued for review.',
    Icon: TbUpload,
  },
  {
    key: 'insurance_verification',
    label: 'Insurance Verification',
    desc: 'We are verifying your insurance coverage with the provider.',
    Icon: TbShieldCheck,
  },
  {
    key: 'pharmacy_review',
    label: 'Pharmacy Review',
    desc: 'A pharmacist is reviewing your prescription and checking stock.',
    Icon: TbPill,
  },
  {
    key: 'pricing_ready',
    label: 'Insurance Approval',
    desc: 'The pharmacy has set the pricing. Your insurance provider is reviewing the bill.',
    Icon: TbShieldCheck,
  },
  {
    key: 'awaiting_confirmation',
    label: 'Your Confirmation',
    desc: 'Insurance approved. Please review the final amount and confirm your order.',
    Icon: TbClock,
  },
  {
    key: 'confirmed',
    label: 'Payment Confirmed',
    desc: 'Payment received! The pharmacy will begin preparing your order.',
    Icon: TbCreditCard,
  },
  {
    key: 'packing',
    label: 'Packing Your Order',
    desc: 'Your medications are being carefully packed for delivery.',
    Icon: TbPackage,
  },
  {
    key: 'dispatched',
    label: 'Dispatched',
    desc: 'Your order has left the pharmacy and is on its way.',
    Icon: TbTruck,
  },
  {
    key: 'out_for_delivery',
    label: 'Out for Delivery',
    desc: 'Your rider is nearby — delivery expected shortly.',
    Icon: TbTruck,
  },
  {
    key: 'delivered',
    label: 'Delivered',
    desc: 'Your order has been successfully delivered. Thank you!',
    Icon: TbCheck,
  },
]

const STEP_KEYS = STEPS.map((s) => s.key)

const STATUS_META: Record<string, { label: string }> = {
  prescription_uploaded: { label: 'Prescription Uploaded' },
  insurance_verification: { label: 'Insurance Verification' },
  pharmacy_review: { label: 'Pharmacy Review' },
  pricing_ready: { label: 'Insurance Approval' },
  awaiting_confirmation: { label: 'Action Required' },
  confirmed: { label: 'Payment Confirmed' },
  packing: { label: 'Packing' },
  dispatched: { label: 'Dispatched' },
  out_for_delivery: { label: 'Out for Delivery' },
  delivered: { label: 'Delivered' },
  rejected: { label: 'Rejected' },
  cancelled: { label: 'Cancelled' },
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function OrderTracking() {
  const navigate = useNavigate()
  const { id } = useParams()
  const { user, profile } = useAuth()
  const [order, setOrder] = useState<DbOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [rejectModalOpen, setRejectModalOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [rejecting, setRejecting] = useState(false)
  const [riderInfo, setRiderInfo] = useState<{
    name: string
    phone: string | null
    email: string | null
  } | null>(null)
  const reviewRef = useRef<HTMLDivElement>(null)
  const prevStatusRef = useRef<string | null>(null)

  const handleReject = async (): Promise<void> => {
    if (!order || !rejectReason.trim()) return
    setRejecting(true)
    const { error } = await supabase.rpc('request_pricing_revision_by_customer', {
      p_order_id: order.id,
      p_reason: rejectReason.trim(),
    })
    setRejecting(false)
    if (error) {
      notifications.show({ title: 'Error', message: error.message, color: 'red', autoClose: 3000 })
      return
    }
    setRejectModalOpen(false)
    setRejectReason('')
    setOrder(prev => prev ? { ...prev, status: 'pharmacy_review' } : null)
    notifications.show({
      title: '↩ Returned to pharmacist',
      message: 'Your feedback has been sent. The pharmacist will revise the pricing.',
      color: 'orange',
      autoClose: 3500,
    })
  }

  const fetchRider = (orderId: string): void => {
    supabase
      .rpc('get_rider_info_for_order', { p_order_id: orderId })
      .then(({ data }) => {
        if (data)
          setRiderInfo(
            data as {
              name: string
              phone: string | null
              email: string | null
            },
          )
        else setRiderInfo(null)
      })
  }

  useEffect(() => {
    if (!id) return

    const fetchOrder = () =>
      supabase
        .from('orders')
        .select('*, medications(*), profiles(name, insurance(*))')
        .eq('id', id)
        .single()
        .then(({ data }) => {
          if (data) {
            setOrder(data as DbOrder)
            setLoading(false)
            fetchRider(id)
          }
        })

    fetchOrder()

    // Subscribe to order status changes
    const orderChannel = supabase
      .channel('order:' + id)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: 'id=eq.' + id,
        },
        (payload) => {
          setOrder((prev) =>
            prev ? { ...prev, ...payload.new } : (payload.new as DbOrder),
          )
          if (id) fetchRider(id)
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(orderChannel)
    }
  }, [id])

  // Subscribe to insurance changes for this order's profile — fixes the race condition where
  // insurance gets verified after the order was placed with pending status.
  useEffect(() => {
    if (!order?.profile_id) return

    const insuranceChannel = supabase
      .channel('insurance-for-order:' + order.id)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'insurance',
          filter: 'profile_id=eq.' + order.profile_id,
        },
        () => {
          // Re-fetch order — the DB trigger will have already updated insurance_status
          supabase
            .from('orders')
            .select('*, medications(*), profiles(name, insurance(*))')
            .eq('id', order.id)
            .single()
            .then(({ data }) => {
              if (data) setOrder(data as DbOrder)
            })
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(insuranceChannel)
    }
  }, [order?.profile_id, order?.id])

  // Auto-scroll to review banner when status becomes pricing_ready
  useEffect(() => {
    if (!order) return
    if (
      order.status === 'awaiting_confirmation' &&
      prevStatusRef.current !== 'awaiting_confirmation'
    ) {
      setTimeout(
        () =>
          reviewRef.current?.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
          }),
        400,
      )
    }
    prevStatusRef.current = order.status
  }, [order?.status])

  if (loading)
    return (
      <Center h="100vh">
        <Loader
          color="lotusCyan"
          size="lg"
        />
      </Center>
    )
  if (!order)
    return (
      <Center h="100vh">
        <Text c="dimmed">Order not found</Text>
      </Center>
    )

  const activeIdx = STEP_KEYS.indexOf(order.status)
  const isTerminal = order.status === 'rejected' || order.status === 'cancelled'
  const isDelivered = order.status === 'delivered'
  const meta = STATUS_META[order.status] || { label: order.status }

  // For cash-only orders, remove the insurance verification step entirely
  const visibleSteps = order.cash_only
    ? STEPS.filter(
        (s) => s.key !== 'insurance_verification' && s.key !== 'pricing_ready',
      )
    : STEPS
  const visibleStepKeys = visibleSteps.map((s) => s.key)
  const visibleActiveIdx = visibleStepKeys.indexOf(order.status)

  const progressPct = isTerminal
    ? 0
    : isDelivered
      ? 100
      : visibleActiveIdx < 0
        ? 0
        : Math.round(((visibleActiveIdx + 0.5) / visibleStepKeys.length) * 100)

  return (
    <>
      <PageWrapper>
        <PageHeader style={{ top: 60 }}>
          <Container size="md">
            <Group justify="space-between">
              <Button
                variant="subtle"
                leftSection={<TbArrowLeft size={16} />}
                onClick={() => navigate('/order-history')}
                style={{ color: '#fff' }}
              >
                Order History
              </Button>
              <Group
                gap={8}
                style={{ paddingRight: 8 }}
              >
                <LiveDot />
                <Text
                  size="xs"
                  c="rgba(255,255,255,0.75)"
                  fw={500}
                >
                  Live tracking
                </Text>
              </Group>
            </Group>
          </Container>
        </PageHeader>

        <Container
          size="md"
          py="xl"
        >
          <Box mb="xl">
            <SectionLabel>Tracking</SectionLabel>
            <PageTitle>Order #{order.order_number}</PageTitle>
            <BlueDivider />
          </Box>

          <Stack gap="lg">
            {/* ── Hero status card ── */}
            <Box
              style={{
                background:
                  'linear-gradient(135deg, #012970 0%, #0c3d8a 50%, #15B3E0 100%)',
                borderRadius: 16,
                padding: '24px 28px',
                color: '#fff',
                boxShadow: '0 8px 32px rgba(1,41,112,0.25)',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <Box
                style={{
                  position: 'absolute',
                  right: -40,
                  top: -40,
                  width: 180,
                  height: 180,
                  borderRadius: '50%',
                  background: 'rgba(255,255,255,0.05)',
                  pointerEvents: 'none',
                }}
              />
              <Box
                style={{
                  position: 'absolute',
                  right: 30,
                  bottom: -60,
                  width: 130,
                  height: 130,
                  borderRadius: '50%',
                  background: 'rgba(21,179,224,0.1)',
                  pointerEvents: 'none',
                }}
              />

              <Group
                justify="space-between"
                align="flex-start"
                wrap="nowrap"
              >
                <Box>
                  <Text
                    size="xs"
                    c="rgba(255,255,255,0.6)"
                    fw={500}
                    mb={4}
                  >
                    Current Status
                  </Text>
                  <Group
                    gap={10}
                    align="center"
                    mb={6}
                  >
                    <Text
                      style={{
                        fontSize: 22,
                        fontWeight: 800,
                        fontFamily: "'Nunito',sans-serif",
                        color: '#fff',
                      }}
                    >
                      {meta.label}
                    </Text>
                    {!isTerminal && !isDelivered && (
                      <LiveBadge>
                        <LiveDot />
                        Live
                      </LiveBadge>
                    )}
                  </Group>
                  <Text
                    size="sm"
                    c="rgba(255,255,255,0.65)"
                  >
                    Placed {formatRelativeTime(order.created_at)}
                  </Text>
                </Box>

                {!isTerminal && (
                  <Box
                    style={{
                      flexShrink: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <HeartbeatIcon>
                      <TbHeartbeat
                        size={38}
                        color={
                          isDelivered ? '#12B76A' : SavedColors.Primaryblue
                        }
                      />
                    </HeartbeatIcon>
                    <Text
                      size="10px"
                      c="rgba(255,255,255,0.5)"
                      fw={600}
                      style={{
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                      }}
                    >
                      {isDelivered ? 'Complete' : 'In Progress'}
                    </Text>
                  </Box>
                )}
              </Group>

              <SummaryGrid>
                <SummaryCell>
                  <Text
                    size="10px"
                    c="rgba(255,255,255,0.55)"
                    fw={600}
                    style={{
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                    }}
                  >
                    Patient
                  </Text>
                  <Text
                    size="sm"
                    fw={700}
                    c="#fff"
                    mt={2}
                  >
                    {(order.profiles as any)?.name || '—'}
                  </Text>
                </SummaryCell>
                <SummaryCell>
                  <Text
                    size="10px"
                    c="rgba(255,255,255,0.55)"
                    fw={600}
                    style={{
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                    }}
                  >
                    Items
                  </Text>
                  <Text
                    size="sm"
                    fw={700}
                    c="#fff"
                    mt={2}
                  >
                    {(order.medications as any[])?.length || 0} med(s)
                  </Text>
                </SummaryCell>
                <SummaryCell>
                  <Text
                    size="10px"
                    c="rgba(255,255,255,0.55)"
                    fw={600}
                    style={{
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                    }}
                  >
                    You Pay
                  </Text>
                  <Text
                    size="sm"
                    fw={700}
                    c={SavedColors.Primaryblue}
                    mt={2}
                  >
                    {order.total_amount != null && order.subtotal != null
                      ? order.total_amount === 0
                        ? 'Fully Covered'
                        : 'UGX ' + order.total_amount.toLocaleString()
                      : 'TBD'}
                  </Text>
                </SummaryCell>
                <SummaryCell>
                  <Text
                    size="10px"
                    c="rgba(255,255,255,0.55)"
                    fw={600}
                    style={{
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                    }}
                  >
                    Insurance
                  </Text>
                  {(() => {
                    const profileIns = (order.profiles as any)?.insurance
                    const insStatus: string =
                      (Array.isArray(profileIns) ? profileIns[0] : profileIns)
                        ?.status ||
                      order.insurance_status ||
                      'none'
                    return (
                      <Badge
                        size="xs"
                        color={
                          insStatus === 'verified'
                            ? 'teal'
                            : insStatus === 'pending'
                              ? 'yellow'
                              : insStatus === 'rejected'
                                ? 'red'
                                : 'gray'
                        }
                        variant="light"
                        mt={4}
                      >
                        {insStatus}
                      </Badge>
                    )
                  })()}
                </SummaryCell>
              </SummaryGrid>
            </Box>

            {/* ── Action banners ── */}
            {order.status === 'pricing_ready' && (
              <ActionBanner
                $bg="#EFF6FF"
                $border="#BFDBFE"
              >
                <Group
                  gap={12}
                  style={{ flex: 1 }}
                >
                  <Box
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg,#3B82F6,#1D4ED8)',
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
                  <Box>
                    <Text
                      fw={700}
                      size="sm"
                      c="#1E40AF"
                    >
                      Insurance is reviewing your order
                    </Text>
                    <Text
                      size="xs"
                      c="#2563EB"
                      mt={2}
                    >
                      Your insurance provider is reviewing the priced bill.
                      You'll be notified once approved.
                    </Text>
                  </Box>
                </Group>
              </ActionBanner>
            )}

            {order.status === 'awaiting_confirmation' &&
              ((order.total_amount ?? 0) === 0 ? (
                <ActionBanner
                  $bg="#F0FDF4"
                  $border="#BBF7D0"
                >
                  <Group
                    gap={12}
                    style={{ flex: 1 }}
                  >
                    <Box
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg,#16A34A,#15803D)',
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
                    <Box>
                      <Text
                        fw={700}
                        size="sm"
                        c="#15803D"
                      >
                        Order fully covered by insurance
                      </Text>
                      <Text
                        size="xs"
                        c="#16A34A"
                        mt={2}
                      >
                        Your insurance covers the full amount. Tap the button
                        below to confirm.
                      </Text>
                    </Box>
                  </Group>
                </ActionBanner>
              ) : (
                <ReviewBannerWrap
                  $pulse
                  ref={reviewRef}
                >
                  <ActionBanner
                    $bg="#FFFBEB"
                    $border="#FDE68A"
                  >
                    <Group
                      gap={12}
                      style={{ flex: 1 }}
                    >
                      <Box
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg,#F59F00,#EF8C2B)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <TbAlertCircle
                          size={20}
                          color="#fff"
                        />
                      </Box>
                      <Box>
                        <Text
                          fw={700}
                          size="sm"
                          c="#92400E"
                        >
                          Insurance approved — review &amp; confirm
                        </Text>
                        <Text
                          size="xs"
                          c="#B45309"
                          mt={2}
                        >
                          Your insurance has approved the bill. Tap the button
                          below to review and pay.
                        </Text>
                      </Box>
                    </Group>
                  </ActionBanner>
                </ReviewBannerWrap>
              ))}

            {order.status === 'out_for_delivery' && (
              <ActionBanner
                $bg="#ECFEFF"
                $border="#A5F3FC"
              >
                <Group
                  gap={12}
                  style={{ flex: 1 }}
                >
                  <Box
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg,#15B3E0,#0891B2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <TbTruck
                      size={20}
                      color="#fff"
                    />
                  </Box>
                  <Box>
                    <Text
                      fw={700}
                      size="sm"
                      c="#155E75"
                    >
                      Your rider is on the way!
                    </Text>
                    <Text
                      size="xs"
                      c="#0E7490"
                      mt={2}
                    >
                      Show the QR code below to the delivery person to confirm
                      receipt.
                    </Text>
                  </Box>
                </Group>
              </ActionBanner>
            )}

            {/* ── Rider contact card ── */}
            {order.status === 'out_for_delivery' && (
              <ContentCard>
                <Group
                  gap="xs"
                  mb="sm"
                >
                  <TbUser
                    size={16}
                    color={SavedColors.Primaryblue}
                  />
                  <Text
                    fw={700}
                    size="sm"
                    c={SavedColors.TextColor}
                  >
                    Your Delivery Rider
                  </Text>
                </Group>
                {riderInfo ? (
                  <Group
                    justify="space-between"
                    align="flex-start"
                  >
                    <Box>
                      <Text
                        size="sm"
                        fw={700}
                        c={SavedColors.TextColor}
                      >
                        {riderInfo.name}
                      </Text>
                      {riderInfo.phone ? (
                        <Anchor
                          href={`tel:${riderInfo.phone}`}
                          size="sm"
                          c={SavedColors.Primaryblue}
                          display="block"
                          mt={3}
                        >
                          <Group gap={5}>
                            <TbPhone size={13} />
                            {riderInfo.phone}
                          </Group>
                        </Anchor>
                      ) : (
                        <Text
                          size="xs"
                          c="dimmed"
                          mt={2}
                        >
                          No phone on file
                        </Text>
                      )}
                    </Box>
                    {riderInfo.phone && (
                      <Button
                        component="a"
                        href={`tel:${riderInfo.phone}`}
                        size="xs"
                        color="lotusCyan"
                        variant="light"
                        leftSection={<TbPhone size={13} />}
                      >
                        Call Rider
                      </Button>
                    )}
                  </Group>
                ) : (
                  <Text
                    size="sm"
                    c="dimmed"
                  >
                    Rider will be assigned shortly
                  </Text>
                )}
              </ContentCard>
            )}

            {/* ── Delivery QR Code ── always shown when out_for_delivery ── */}
            {order.status === 'out_for_delivery' && (
              <ContentCard>
                <Box
                  ta="center"
                  py="md"
                >
                  <Group
                    gap="xs"
                    justify="center"
                    mb="md"
                  >
                    <TbQrcode
                      size={20}
                      color={SavedColors.Primaryblue}
                    />
                    <Text
                      fw={700}
                      size="sm"
                      c={SavedColors.TextColor}
                    >
                      Delivery Confirmation QR
                    </Text>
                  </Group>
                  <Text
                    size="xs"
                    c="dimmed"
                    mb="lg"
                    maw={300}
                    mx="auto"
                  >
                    The delivery person will scan this QR code to confirm your
                    order has been delivered.
                  </Text>
                  <Box
                    style={{
                      display: 'inline-flex',
                      padding: 16,
                      background: '#fff',
                      borderRadius: 12,
                      border: `2px solid ${SavedColors.DemWhite}`,
                      boxShadow: '0 4px 16px rgba(21,179,224,0.12)',
                    }}
                  >
                    <QRCodeSVG
                      value={order.otp ? `${order.id}:${order.otp}` : order.id}
                      size={200}
                      fgColor={SavedColors.FooterBgColor}
                      level="M"
                    />
                  </Box>
                  <Text
                    size="xs"
                    c="dimmed"
                    mt="sm"
                  >
                    Keep this screen open during delivery
                  </Text>

                  {/* OTP fallback — shown below QR so rider can ask customer to read it */}
                  {order.otp && (
                    <Box
                      mt="lg"
                      p="md"
                      style={{
                        background: '#F0F9FF',
                        borderRadius: 10,
                        border: '1.5px dashed #15B3E0',
                        maxWidth: 280,
                        margin: '16px auto 0',
                      }}
                    >
                      <Text
                        size="xs"
                        c="dimmed"
                        fw={600}
                        mb={4}
                        style={{
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                        }}
                      >
                        Backup OTP — if QR won&apos;t scan
                      </Text>
                      <Text
                        style={{
                          fontFamily: "'Nunito',monospace",
                          fontWeight: 900,
                          fontSize: 28,
                          letterSpacing: '0.2em',
                          color: '#012970',
                        }}
                      >
                        {order.otp}
                      </Text>
                      <Text
                        size="xs"
                        c="dimmed"
                        mt={4}
                      >
                        Read this code to the rider if they can&apos;t scan the
                        QR
                      </Text>
                    </Box>
                  )}
                </Box>
              </ContentCard>
            )}

            {isTerminal && (
              <ActionBanner
                $bg={order.status === 'rejected' ? '#FFF5F5' : '#F9FAFB'}
                $border={order.status === 'rejected' ? '#FECACA' : '#E5E7EB'}
              >
                <Group gap={12}>
                  <Box
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      background:
                        order.status === 'rejected' ? '#EF4444' : '#9CA3AF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <TbX
                      size={20}
                      color="#fff"
                    />
                  </Box>
                  <Box>
                    <Text
                      fw={700}
                      size="sm"
                      c={order.status === 'rejected' ? '#991B1B' : '#374151'}
                    >
                      Order{' '}
                      {order.status === 'rejected' ? 'Rejected' : 'Cancelled'}
                    </Text>
                    {(order.rejection_reason || order.cancellation_reason) && (
                      <Text
                        size="xs"
                        c="dimmed"
                        mt={2}
                      >
                        {order.rejection_reason || order.cancellation_reason}
                      </Text>
                    )}
                  </Box>
                </Group>
              </ActionBanner>
            )}

            {/* ── Vertical Timeline ── */}
            {!isTerminal && !isDelivered && (
              <ContentCard>
                <Group
                  justify="space-between"
                  mb="lg"
                  align="center"
                >
                  <Text
                    fw={700}
                    c={SavedColors.TextColor}
                    size="sm"
                  >
                    Order Progress
                  </Text>
                  <LiveBadge>
                    <LiveDot />
                    Real-time
                  </LiveBadge>
                </Group>

                <TimelineWrap>
                  <TimelineLine $progress={progressPct} />
                  <Stack gap={0}>
                    {visibleSteps.map((step, idx) => {
                      const state: 'done' | 'active' | 'pending' =
                        idx < visibleActiveIdx
                          ? 'done'
                          : idx === visibleActiveIdx
                            ? 'active'
                            : 'pending'

                      return (
                        <StepRow
                          key={step.key}
                          $state={state}
                        >
                          <IconWrap $state={state}>
                            {state === 'active' && <PulseRing />}
                            {state === 'active' && <PulseRing2 />}
                            {state === 'active' ? (
                              <HeartbeatIcon>
                                <step.Icon size={20} />
                              </HeartbeatIcon>
                            ) : state === 'done' ? (
                              <TbCheck size={20} />
                            ) : (
                              <step.Icon size={18} />
                            )}
                          </IconWrap>

                          <StepContent>
                            <Group
                              gap={8}
                              align="center"
                              mb={2}
                              wrap="wrap"
                            >
                              <Text
                                size="sm"
                                fw={
                                  state === 'active'
                                    ? 700
                                    : state === 'done'
                                      ? 600
                                      : 500
                                }
                                c={
                                  state === 'active'
                                    ? SavedColors.Primaryblue
                                    : state === 'done'
                                      ? SavedColors.TextColor
                                      : SavedColors.DarkWhite
                                }
                              >
                                {step.label}
                              </Text>
                              {state === 'active' && (
                                <LiveBadge>
                                  <LiveDot />
                                  Now
                                </LiveBadge>
                              )}
                              {state === 'done' && (
                                <Badge
                                  size="xs"
                                  color="teal"
                                  variant="dot"
                                >
                                  Done
                                </Badge>
                              )}
                            </Group>
                            <Text
                              size="xs"
                              c={
                                state === 'active'
                                  ? SavedColors.TextColor
                                  : 'dimmed'
                              }
                              lh={1.5}
                            >
                              {step.desc}
                            </Text>
                          </StepContent>
                        </StepRow>
                      )
                    })}
                  </Stack>
                </TimelineWrap>
              </ContentCard>
            )}

            {/* ── Delivered celebration ── */}
            {isDelivered && (
              <ContentCard>
                <Box
                  ta="center"
                  py="md"
                >
                  <Box
                    style={{
                      width: 72,
                      height: 72,
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg,#12B76A,#059669)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 16px',
                      boxShadow: '0 8px 24px rgba(18,183,106,0.3)',
                    }}
                  >
                    <TbCheck
                      size={36}
                      color="#fff"
                    />
                  </Box>
                  <Text
                    fw={800}
                    size="xl"
                    c={SavedColors.TextColor}
                    style={{ fontFamily: "'Nunito',sans-serif" }}
                  >
                    Order Delivered!
                  </Text>
                  <Text
                    size="sm"
                    c="dimmed"
                    mt={6}
                    maw={340}
                    mx="auto"
                  >
                    Your medications have been delivered. Thank you for using
                    MedDeliverySOS.
                  </Text>
                </Box>
              </ContentCard>
            )}

            {/* ── Bottom actions ── */}
            <Group
              gap="sm"
              wrap="wrap"
            >
              {order.status === 'out_for_delivery' && (
                <Button
                  variant="outline"
                  color="cyan"
                  leftSection={<TbTruck size={16} />}
                  onClick={() => navigate('/order/' + id + '/delivery')}
                >
                  Delivery Details
                </Button>
              )}
              {![
                'prescription_uploaded',
                'insurance_verification',
                'pharmacy_review',
                'pricing_ready',
                'awaiting_confirmation',
              ].includes(order.status) && (
                <Button
                  color="lotusCyan"
                  leftSection={<TbPackage size={16} />}
                  onClick={() => navigate('/order/' + id + '/breakdown')}
                >
                  View Breakdown
                </Button>
              )}
            </Group>

            {/* Spacer so content isn't hidden behind ConfirmBar */}
            <ConfirmSpacer $show={order.status === 'awaiting_confirmation'} />
          </Stack>
        </Container>
      </PageWrapper>

      {/* ── Fixed confirm bar — constrained width on desktop ── */}
      {order.status === 'awaiting_confirmation' && (
        <ConfirmBar $visible>
          {/* Inner wrapper: centered + max-width so it doesn't stretch on desktop */}
          <Box style={{ maxWidth: 600, margin: '0 auto', width: '100%' }}>
            {(order.total_amount ?? 0) === 0 ? (
              <>
                <Box style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <Text size="sm" fw={700} c="#15803D">Fully covered by insurance</Text>
                  <Text size="sm" fw={800} c="#15803D">UGX 0</Text>
                </Box>
                <Button
                  size="md"
                  fullWidth
                  color="green"
                  leftSection={<TbCheck size={16} />}
                  onClick={() => navigate('/order/' + id + '/breakdown')}
                  style={{ fontWeight: 700 }}
                >
                  Confirm Order
                </Button>
              </>
            ) : (
              <>
                <Box style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <Text size="sm" fw={700} c={SavedColors.TextColor}>Insurance approved — review &amp; confirm</Text>
                  <Text size="sm" fw={800} c={SavedColors.Primaryblue}>
                    UGX {(order.total_amount ?? 0).toLocaleString()}
                  </Text>
                </Box>
                <Group gap={10} wrap="nowrap">
                  <Button
                    size="md"
                    variant="outline"
                    color="red"
                    leftSection={<TbShieldOff size={15} />}
                    onClick={() => { setRejectReason(''); setRejectModalOpen(true) }}
                    style={{ fontWeight: 700, flexShrink: 0 }}
                  >
                    Reject
                  </Button>
                  <Button
                    size="md"
                    color="orange"
                    rightSection={<TbChevronRight size={16} />}
                    onClick={() => navigate('/order/' + id + '/breakdown')}
                    style={{ fontWeight: 700, flex: 1 }}
                  >
                    Review &amp; Confirm
                  </Button>
                </Group>
              </>
            )}
          </Box>
        </ConfirmBar>
      )}

      {/* ── Reject & request revision modal ── */}
      <Modal
        opened={rejectModalOpen}
        onClose={() => setRejectModalOpen(false)}
        title="Request Pricing Changes"
        centered
        size="sm"
        styles={{ title: { fontFamily: "'DM Sans',sans-serif", fontWeight: 700 } }}
      >
        <Stack gap="md">
          <Box style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px', borderRadius: 10, background: '#fff7ed', border: '1.5px solid #fed7aa' }}>
            <TbAlertCircle size={18} color="#ea580c" style={{ flexShrink: 0, marginTop: 2 }} />
            <Text size="sm" c="#9a3412">
              The order will be <strong>returned to the pharmacist</strong> with your reason.
              They will revise the pricing and resubmit for your approval.
            </Text>
          </Box>
          <Textarea
            label="Reason for requesting changes"
            placeholder="e.g. The price seems too high, I'd like a generic alternative, please check my insurance coverage again…"
            value={rejectReason}
            onChange={e => setRejectReason(e.target.value)}
            minRows={3}
            autosize
            required
          />
          <Group justify="flex-end" gap="sm">
            <Button variant="default" onClick={() => setRejectModalOpen(false)}>Cancel</Button>
            <Button
              color="red"
              disabled={!rejectReason.trim()}
              loading={rejecting}
              leftSection={<TbX size={14} />}
              onClick={handleReject}
            >
              Send to Pharmacist
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  )
}


