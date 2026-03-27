import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Box,
  Button,
  Container,
  Divider,
  Group,
  Stack,
  Table,
  Text,
  Badge,
  Loader,
  Center,
  Alert,
  Modal,
  Textarea,
} from '@mantine/core'
import {
  TbArrowLeft,
  TbCreditCard,
  TbShieldCheck,
  TbAlertCircle,
  TbCheck,
  TbX,
  TbNotes,
} from 'react-icons/tb'
import PrescriptionViewer from '../pharmacy/PrescriptionViewer'
import { notifications } from '@mantine/notifications'
import { PageWrapper, PageHeader, ContentCard } from '@shared/ui/layout'
import { PageTitle, BlueDivider, SectionLabel } from '@shared/ui/typography'
import { SavedColors } from '@shared/constants'
import {
  supabase,
  DbOrder,
  DbMedication,
  DbProfile,
} from '../../../lib/supabase'
import { useAuth } from '../../../features/auth/context/AuthContext'
import styled from 'styled-components'

// ─── Styled ───────────────────────────────────────────────────────────────────

const ActionBar = styled.div<{ $visible: boolean }>`
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 200;
  background: #fff;
  border-top: 2px solid #e4e9f0;
  padding: 14px 20px 20px;
  box-shadow: 0 -8px 32px rgba(1, 41, 112, 0.12);
  display: flex;
  flex-direction: column;
  gap: 10px;
  transform: translateY(${(p) => (p.$visible ? '0' : '100%')});
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  /* Sit above mobile bottom nav */
  @media (max-width: 899px) {
    bottom: 64px;
    border-radius: 16px 16px 0 0;
  }
`

const BottomSpacer = styled.div<{ $height: number }>`
  height: ${(p) => p.$height}px;
`

// ─── Component ────────────────────────────────────────────────────────────────

export default function OrderBreakdown(): JSX.Element {
  const navigate = useNavigate()
  const { id } = useParams()
  const { user } = useAuth()

  const [order, setOrder] = useState<DbOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [confirming, setConfirming] = useState(false)
  const [rejectModalOpen, setRejectModalOpen] = useState(false)
  const [acting, setActing] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [prescriptionSignedUrl, setPrescriptionSignedUrl] = useState<
    string | null
  >(null)
  const [allSignedUrls, setAllSignedUrls] = useState<string[]>([])

  // ── Fetch order + realtime ────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return
    const fetchOrder = (): void => {
      supabase
        .from('orders')
        .select('*, medications(*), profiles(name, insurance(*))')
        .eq('id', id)
        .single()
        .then(async ({ data }) => {
          if (data) {
            setOrder(data as DbOrder)
            // Sign prescription images
            const ordData = data as DbOrder & {
              prescription_urls?: string[]
              prescription_url?: string
            }
            const allPaths: string[] = ordData.prescription_urls?.length
              ? ordData.prescription_urls
              : ordData.prescription_url
                ? [ordData.prescription_url]
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
                if (!signErr && signed?.signedUrl)
                  signedAll.push(signed.signedUrl)
              }
              if (signedAll.length) {
                setPrescriptionSignedUrl(signedAll[0])
                setAllSignedUrls(signedAll)
              }
            }
          }
          setLoading(false)
        })
    }
    fetchOrder()
    const ch = supabase
      .channel(`order-breakdown-rt:${id}`)
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
    return () => {
      supabase.removeChannel(ch)
    }
  }, [id])

  // ── Confirm pricing ───────────────────────────────────────────────────────
  const confirmOrder = async (): Promise<void> => {
    if (!order) return
    setConfirming(true)
    const { error } = await supabase.rpc('confirm_pricing_review', {
      p_order_id: order.id,
    })
    if (error) {
      notifications.show({
        title: 'Error',
        message: error.message.includes('awaiting_confirmation')
          ? 'Order already confirmed or state changed.'
          : error.message,
        color: 'red',
      })
      setConfirming(false)
      return
    }
    setConfirming(false)
    const refetch = await supabase
      .from('orders')
      .select('total_amount')
      .eq('id', id!)
      .single()
    const total = refetch.data?.total_amount ?? order.total_amount ?? 0
    if (total === 0) {
      notifications.show({
        title: 'Fully covered',
        message: 'Insurance covers the full amount. Order confirmed.',
        color: 'teal',
      })
      navigate('/order/' + id)
    } else {
      notifications.show({
        title: 'Pricing confirmed',
        message: 'Proceeding to payment…',
        color: 'teal',
      })
      navigate('/order/' + id + '/payment')
    }
  }

  // ── Cancel order ──────────────────────────────────────────────────────────
  const rejectPricing = async (): Promise<void> => {
    if (!order) return
    setActing(true)
    const { error } = await supabase.rpc('cancel_order_by_customer', {
      p_order_id: order.id,
    })
    if (!error && cancelReason.trim()) {
      await supabase
        .from('orders')
        .update({ cancellation_reason: cancelReason.trim() })
        .eq('id', order.id)
    }
    setActing(false)
    setRejectModalOpen(false)
    if (error) {
      notifications.show({
        title: 'Error',
        message: error.message,
        color: 'red',
      })
      return
    }
    notifications.show({
      title: 'Order cancelled',
      message: 'Your order has been cancelled.',
      color: 'gray',
    })
    navigate('/order-history')
  }

  // ── Guards ────────────────────────────────────────────────────────────────
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

  const medications: DbMedication[] = order.medications ?? []
  const isPricingReady = order.status === 'awaiting_confirmation' // customer action now here
  const isInsuranceReview = order.status === 'pricing_ready' // GA reviewing, info only
  const isAwaitingPayment = false // payment handled via navigate
  const isAlreadyConfirmed = [
    'confirmed',
    'packing',
    'dispatched',
    'out_for_delivery',
    'delivered',
    'cancelled',
    'rejected',
  ].includes(order.status)
  const actionBarVisible = isPricingReady

  // Derive insurance status from profile's latest insurance (most up-to-date)
  const profileIns = (
    order.profiles as {
      insurance?: { status?: string } | { status?: string }[]
    } | null
  )?.insurance
  const ins = Array.isArray(profileIns) ? profileIns[0] : profileIns
  const insStatus: string =
    (ins as { status?: string } | undefined)?.status ??
    order.insurance_status ??
    'none'

  return (
    <>
      <PageWrapper>
        <PageHeader style={{ top: 60 }}>
          <Container size="md">
            <Button
              variant="subtle"
              leftSection={<TbArrowLeft size={16} />}
              onClick={() => navigate('/order/' + id)}
              style={{ color: '#fff' }}
            >
              Back
            </Button>
          </Container>
        </PageHeader>

        <Container
          size="md"
          py="xl"
        >
          <Box mb="xl">
            <SectionLabel>Order</SectionLabel>
            <PageTitle>Breakdown #{order.order_number}</PageTitle>
            <BlueDivider />
          </Box>

          <Stack gap="lg">
            {/* ── Status banners ── */}
            {isPricingReady && (
              <Alert
                color="orange"
                variant="filled"
                icon={<TbAlertCircle size={18} />}
                style={{ borderRadius: 14 }}
              >
                <Text
                  size="sm"
                  fw={700}
                  mb={2}
                >
                  Pricing ready — action required
                </Text>
                <Text
                  size="sm"
                  style={{ opacity: 0.9 }}
                >
                  Review the breakdown below and confirm to proceed to payment.
                  Tap the chat button for questions.
                </Text>
              </Alert>
            )}

            {isInsuranceReview && (
              <Alert
                color="blue"
                variant="light"
                icon={<TbShieldCheck size={16} />}
              >
                <Text
                  size="sm"
                  fw={600}
                >
                  Insurance is reviewing this order
                </Text>
                <Text
                  size="xs"
                  c="dimmed"
                  mt={2}
                >
                  Your insurance provider is reviewing the priced bill. You'll
                  be notified once they approve.
                </Text>
              </Alert>
            )}

            {isAlreadyConfirmed && !isPricingReady && (
              <Alert
                color="teal"
                variant="light"
                icon={<TbCheck size={16} />}
              >
                <Text
                  size="sm"
                  fw={600}
                >
                  Confirmed — status: <b>{order.status.replace(/_/g, ' ')}</b>
                </Text>
              </Alert>
            )}

            {/* ── Prescription viewer ── */}
            {prescriptionSignedUrl && (
              <ContentCard style={{ padding: 0, overflow: 'hidden' }}>
                <Box
                  p="md"
                  style={{ borderBottom: `1px solid ${SavedColors.DemWhite}` }}
                >
                  <Text
                    fw={700}
                    size="sm"
                    c={SavedColors.TextColor}
                  >
                    Your Prescription
                  </Text>
                </Box>
                {(order as { prescription_notes?: string })
                  .prescription_notes && (
                  <Box
                    p="md"
                    style={{
                      borderBottom: `1px solid ${SavedColors.DemWhite}`,
                      background: '#eff6ff',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 12,
                    }}
                  >
                    <Box
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 8,
                        flexShrink: 0,
                        background: 'linear-gradient(135deg,#3b82f6,#1d4ed8)',
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
                    <Box style={{ flex: 1 }}>
                      <Text
                        size="sm"
                        fw={800}
                        c="#1d4ed8"
                        mb={4}
                      >
                        Your Note
                      </Text>
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
                  </Box>
                )}
                <PrescriptionViewer
                  src={prescriptionSignedUrl}
                  signedUrl={prescriptionSignedUrl}
                  allSignedUrls={allSignedUrls}
                />
              </ContentCard>
            )}

            {/* ── Pricing card ── */}
            <ContentCard>
              <Group
                justify="space-between"
                mb="md"
                wrap="wrap"
                gap="xs"
              >
                <Text
                  fw={700}
                  size="sm"
                  c={SavedColors.TextColor}
                >
                  Patient: {(order.profiles as DbProfile)?.name}
                </Text>
                <Badge
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
                  leftSection={<TbShieldCheck size={11} />}
                >
                  Insurance: {insStatus}
                </Badge>
              </Group>

              {/* Medications table */}
              <Box style={{ overflowX: 'auto' }}>
                <Table
                  mb="lg"
                  style={{ minWidth: 400 }}
                >
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th c={SavedColors.TextColor}>Medication</Table.Th>
                      <Table.Th
                        c={SavedColors.TextColor}
                        ta="center"
                      >
                        Qty
                      </Table.Th>
                      <Table.Th c={SavedColors.TextColor}>Dosage</Table.Th>
                      <Table.Th
                        c={SavedColors.TextColor}
                        ta="right"
                      >
                        Total
                      </Table.Th>
                      <Table.Th
                        c={SavedColors.TextColor}
                        ta="center"
                      >
                        Cover
                      </Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {medications.length === 0 && (
                      <Table.Tr>
                        <Table.Td colSpan={5}>
                          <Text
                            ta="center"
                            c="dimmed"
                            size="sm"
                            py="md"
                          >
                            No medications listed yet
                          </Text>
                        </Table.Td>
                      </Table.Tr>
                    )}
                    {medications.map((item: DbMedication) => (
                      <Table.Tr key={item.id}>
                        <Table.Td>
                          <Text
                            size="sm"
                            fw={500}
                          >
                            {item.name}
                          </Text>
                        </Table.Td>
                        <Table.Td ta="center">
                          <Text size="sm">{item.quantity}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Text
                            size="sm"
                            c="dimmed"
                          >
                            {item.dosage || '—'}
                          </Text>
                        </Table.Td>
                        <Table.Td ta="right">
                          <Text
                            size="sm"
                            fw={600}
                          >
                            UGX{' '}
                            {(
                              item.unit_price * item.quantity
                            )?.toLocaleString()}
                          </Text>
                        </Table.Td>
                        <Table.Td ta="center">
                          <Badge
                            size="xs"
                            color={item.is_insured ? 'teal' : 'gray'}
                            variant="light"
                          >
                            {item.is_insured ? 'Insured' : 'Cash'}
                          </Badge>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Box>

              <Divider mb="md" />
              <Stack gap="xs">
                <Group justify="space-between">
                  <Text
                    size="sm"
                    c="dimmed"
                  >
                    Subtotal
                  </Text>
                  <Text size="sm">
                    UGX {order.subtotal?.toLocaleString() || '0'}
                  </Text>
                </Group>
                {(order.insured_amount || 0) > 0 && (
                  <Group justify="space-between">
                    <Text
                      size="sm"
                      c="teal"
                    >
                      Insurance covers
                    </Text>
                    <Text
                      size="sm"
                      c="teal"
                    >
                      − UGX {order.insured_amount?.toLocaleString()}
                    </Text>
                  </Group>
                )}
                <Group justify="space-between">
                  <Text
                    size="sm"
                    c="dimmed"
                  >
                    Delivery fee
                  </Text>
                  <Text
                    size="sm"
                    c={
                      (order as { delivery_skipped?: boolean }).delivery_skipped
                        ? 'dimmed'
                        : !order.cash_only
                          ? 'teal'
                          : undefined
                    }
                  >
                    {(order as { delivery_skipped?: boolean }).delivery_skipped
                      ? 'No delivery (in-store)'
                      : order.cash_only
                        ? 'UGX 10,000'
                        : 'UGX 10,000 (insured)'}
                  </Text>
                </Group>
                <Divider />
                <Group justify="space-between">
                  <Text
                    fw={700}
                    size="lg"
                  >
                    You Pay
                  </Text>
                  <Text
                    fw={800}
                    size="xl"
                    c={
                      (order.total_amount ?? 0) === 0
                        ? 'teal'
                        : SavedColors.Primaryblue
                    }
                  >
                    {(order.total_amount ?? 0) === 0
                      ? 'UGX 0 — Fully Covered'
                      : `UGX ${(order.total_amount ?? 0).toLocaleString()}`}
                  </Text>
                </Group>
              </Stack>
            </ContentCard>

            {/* ── Pharmacist note ── */}
            {order.pharmacy_notes &&
              !order.pharmacy_notes.startsWith(
                '[Customer requested changes]:',
              ) && (
                <ContentCard>
                  <Group
                    gap={8}
                    mb={6}
                  >
                    <Box
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: '#15B3E0',
                        flexShrink: 0,
                      }}
                    />
                    <Text
                      size="sm"
                      fw={700}
                      c={SavedColors.TextColor}
                    >
                      Note from Pharmacist
                    </Text>
                  </Group>
                  <Text
                    size="sm"
                    c="dimmed"
                    lh={1.6}
                  >
                    {order.pharmacy_notes}
                  </Text>
                </ContentCard>
              )}

            <BottomSpacer $height={actionBarVisible ? 200 : 24} />
          </Stack>
        </Container>
      </PageWrapper>

      {/* ── Sticky action bar — only mounted when order needs action ── */}
      {actionBarVisible && (
        <ActionBar $visible>
          {isPricingReady && (
            <>
              <Box
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 2,
                }}
              >
                <Text
                  size="sm"
                  fw={700}
                  c={SavedColors.TextColor}
                >
                  Insurance approved — ready to confirm
                </Text>
                <Text
                  size="sm"
                  fw={800}
                  c={SavedColors.Primaryblue}
                >
                  UGX {(order.total_amount ?? 0).toLocaleString()}
                </Text>
              </Box>
              <Button
                fullWidth
                size="md"
                color="lotusCyan"
                leftSection={<TbCreditCard size={16} />}
                loading={confirming}
                onClick={confirmOrder}
                style={{ fontWeight: 700 }}
              >
                Confirm Pricing &amp; Proceed to Payment
              </Button>
              <Button
                variant="subtle"
                color="red"
                size="xs"
                fullWidth
                leftSection={<TbX size={13} />}
                onClick={() => setRejectModalOpen(true)}
              >
                Reject &amp; Cancel Order
              </Button>
            </>
          )}
          {isAwaitingPayment && (
            <>
              <Text
                size="xs"
                c="dimmed"
                ta="center"
              >
                Pricing confirmed — complete your payment below
              </Text>
              <Button
                fullWidth
                size="md"
                color="lotusCyan"
                leftSection={<TbCreditCard size={16} />}
                onClick={() => navigate('/order/' + id + '/payment')}
                style={{ fontWeight: 700 }}
              >
                Go to Payment
              </Button>
            </>
          )}
        </ActionBar>
      )}

      {/* Cancel modal */}
      <Modal
        opened={rejectModalOpen}
        onClose={() => setRejectModalOpen(false)}
        title="Cancel this order?"
        centered
        size="sm"
        radius="md"
        styles={{
          title: { fontFamily: "'DM Sans',sans-serif", fontWeight: 700 },
        }}
      >
        <Stack gap="md">
          <Text
            size="sm"
            c="dimmed"
          >
            This will cancel the order entirely. You can upload a new
            prescription to start over.
          </Text>
          <Textarea
            label="Reason for cancelling (optional)"
            placeholder="e.g. Found medication elsewhere, changed my mind…"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            minRows={2}
            autosize
            radius="md"
          />
          <Group
            justify="flex-end"
            gap="sm"
          >
            <Button
              variant="default"
              onClick={() => setRejectModalOpen(false)}
            >
              Go Back
            </Button>
            <Button
              color="red"
              loading={acting}
              onClick={rejectPricing}
              leftSection={<TbX size={14} />}
            >
              Yes, Cancel Order
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  )
}

