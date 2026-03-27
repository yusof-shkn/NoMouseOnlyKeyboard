import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Box, Button, Group, Stack, Text, Badge, Loader, Center,
  Divider, Table, Avatar, Modal, Textarea,
} from '@mantine/core'
import {
  TbArrowLeft, TbShieldCheck, TbUser, TbMessage2, TbX, TbCheck, TbAlertCircle,
  TbNotes, TbShieldOff,
} from 'react-icons/tb'
import PrescriptionViewer from '../pharmacy/PrescriptionViewer'
import styled, { keyframes } from 'styled-components'
import { SavedColors } from '@shared/constants'
import { supabase } from '../../../lib/supabase'
import type { DbOrder, DbMedication } from '../../../lib/supabase'
import { formatRelativeTime } from '../../../shared/utils/formatTime'
import { useAuth } from '../../../features/auth/context/AuthContext'
import { notifications } from '@mantine/notifications'
import OrderChatPanel from '../../components/OrderChatPanel'

const ApproveBar = styled.div<{ $visible: boolean }>`
  position: fixed;
  bottom: 0; left: 0; right: 0;
  z-index: 310;
  background: #fff;
  border-top: 2px solid #bbf7d0;
  padding: 14px 20px calc(18px + env(safe-area-inset-bottom, 0px));
  box-shadow: 0 -6px 24px rgba(6,78,59,0.14);
  display: flex; flex-direction: column; gap: 8px;
  transform: translateY(${(p: { $visible: boolean }) => p.$visible ? '0' : '100%'});
  transition: transform 0.3s cubic-bezier(0.34,1.56,0.64,1);
  @media(max-width:899px){
    bottom: 64px;
    border-radius: 16px 16px 0 0;
    padding-bottom: 18px;
  }
`
const BarSpacer = styled.div<{ $h: number }>`height:${(p: { $h: number }) => p.$h}px;`

interface StaffInfo { id: string; name: string; provider_name: string }
interface OrderDetail {
  id: string; order_number: string; status: string
  subtotal?: number; insured_amount?: number; total_amount?: number
  insurance_status?: string; updated_at: string; profile_id?: string
  profiles?: { name: string; photo_url?: string }
  medications?: DbMedication[]
}

const pulse = keyframes`0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.5);opacity:0.4}`
const slideUp = keyframes`from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}`

const ChatFloat = styled.button<{ $barVisible: boolean }>`
  position: fixed; right: 18px; z-index: 400;
  bottom: ${(p: { $barVisible: boolean }) => p.$barVisible ? 'calc(64px + 130px)' : '84px'};
  width: 54px; height: 54px; border-radius: 50%; border: none; cursor: pointer;
  background: linear-gradient(135deg,#10b981,#064e3b);
  box-shadow: 0 4px 18px rgba(16,185,129,0.45);
  display: flex; align-items: center; justify-content: center;
  transition: transform 0.18s, bottom 0.25s ease;
  &:hover { transform: scale(1.08); }
  @media(min-width:900px){
    bottom: ${(p: { $barVisible: boolean }) => p.$barVisible ? '160px' : '28px'};
    right: 28px;
  }
`
const UnreadDot = styled.span`
  position: absolute; top: -3px; right: -3px;
  min-width: 19px; height: 19px; border-radius: 10px;
  background: #EF4444; color: #fff; border: 2px solid #fff;
  font-size: 10px; font-weight: 700;
  display: flex; align-items: center; justify-content: center; padding: 0 3px;
`
const ChatSlide = styled.div<{ $open: boolean }>`
  position: fixed; bottom: 0; left: 0; right: 0; z-index: 500;
  height: 72vh; max-height: 560px;
  background: #fff; border-radius: 20px 20px 0 0;
  box-shadow: 0 -8px 32px rgba(1,41,112,0.18);
  display: flex; flex-direction: column;
  transform: translateY(${(p: { $open: boolean }) => p.$open ? '0' : '110%'});
  visibility: ${(p: { $open: boolean }) => p.$open ? 'visible' : 'hidden'};
  pointer-events: ${(p: { $open: boolean }) => p.$open ? 'auto' : 'none'};
  transition: transform 0.28s cubic-bezier(0.32,0.72,0,1),
              visibility 0s linear ${(p: { $open: boolean }) => p.$open ? '0s' : '0.28s'};
  will-change: transform;
  @media(min-width:900px){
    bottom: 90px; left: auto; right: 24px;
    width: 380px; height: 460px; max-height: 460px;
    border-radius: 20px;
  }
`
const DragHandle = styled.div`
  width: 36px; height: 4px; border-radius: 2px;
  background: #D1D5DB; margin: 10px auto 0; cursor: grab; flex-shrink: 0;
  @media(min-width:900px){ display:none; }
`
const LiveDot = styled.span`
  width: 7px; height: 7px; border-radius: 50%; background: #10b981;
  display: inline-block; animation: ${pulse} 1.2s ease-in-out infinite;
`
// keep slideUp referenced to avoid unused warning
const _unusedSlideUp = slideUp

const statusLabel = (s: string): string => s.split('_').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')
const statusColor = (s: string): string => ({
  pricing_ready:'blue', awaiting_confirmation:'orange', confirmed:'green',
  packing:'violet', dispatched:'cyan', out_for_delivery:'cyan', delivered:'teal',
  rejected:'red', cancelled:'gray',
} as Record<string, string>)[s] ?? 'gray'

export default function InsuranceOrderDetail(): JSX.Element {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [order, setOrder]         = useState<OrderDetail | null>(null)
  const [staffInfo, setStaffInfo] = useState<StaffInfo | null>(null)
  const [loading, setLoading]     = useState(true)

  const [chatOpen, setChatOpen] = useState(false)
  const [unread, setUnread]     = useState(0)

  const [prescriptionSignedUrl, setPrescriptionSignedUrl] = useState<string | null>(null)
  const [allSignedUrls, setAllSignedUrls] = useState<string[]>([])

  const [approving, setApproving]     = useState(false)
  const [rejectModalOpen, setRejectModalOpen] = useState(false)
  const [rejectReason, setRejectReason]       = useState('')
  const [rejecting, setRejecting]             = useState(false)

  useEffect(() => {
    if (!id) return
    const load = async (): Promise<void> => {
      const [{ data: si }, { data: ord }] = await Promise.all([
        supabase.rpc('get_my_insurance_staff_info'),
        supabase.from('orders').select('*, profiles(name,photo_url), medications(*)')
          .eq('id', id).single(),
      ])
      if (si) setStaffInfo(si as StaffInfo)
      if (ord) {
        setOrder(ord as OrderDetail)
        const ordData = ord as DbOrder & { prescription_urls?: string[]; prescription_url?: string }
        const allPaths: string[] = ordData.prescription_urls?.length
          ? ordData.prescription_urls
          : ordData.prescription_url ? [ordData.prescription_url] : []
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
    load()
    const ch = supabase.channel('ins-order-detail:' + id)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${id}` },
        payload => setOrder(prev => prev ? { ...prev, ...payload.new } : null))
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [id])

  useEffect(() => {
    if (!id) return
    supabase.from('chat_messages').select('id, sender_type').eq('order_id', id)
      .eq('chat_thread', 'insurance')
      .then(({ data }) => {
        const m = (data ?? []) as { sender_type: string }[]
        if (!chatOpen) setUnread(m.filter(msg => msg.sender_type !== 'insurance_staff').length)
      })
    const ch = supabase.channel('ins-unread:' + id)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `order_id=eq.${id}` },
        payload => {
          const msg = payload.new as { chat_thread: string; sender_type: string }
          if (msg.chat_thread !== 'insurance') return
          if (!chatOpen && msg.sender_type === 'pharmacy') setUnread(n => n + 1)
        })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [id, chatOpen])

  const openChat = (): void => { setChatOpen(true); setUnread(0) }

  const handleApprove = async (): Promise<void> => {
    if (!order) return
    setApproving(true)
    const { error } = await supabase.rpc('approve_insurance_coverage', {
      p_order_id: order.id, p_insured_amount: null,
    })
    setApproving(false)
    if (error) { notifications.show({ title: 'Error', message: error.message, color: 'red', autoClose: 3000 }); return }
    setOrder(prev => prev ? { ...prev, status: 'awaiting_confirmation' } : null)
    notifications.show({ title: '✅ Approved', message: 'Customer has been notified.', color: 'teal', autoClose: 2500 })
  }

  const handleReject = async (): Promise<void> => {
    if (!order || !rejectReason.trim()) return
    setRejecting(true)
    const { error } = await supabase.rpc('reject_insurance_coverage', {
      p_order_id: order.id,
      p_reason: rejectReason.trim(),
    })
    setRejecting(false)
    if (error) { notifications.show({ title: 'Error', message: error.message, color: 'red', autoClose: 3000 }); return }
    setRejectModalOpen(false)
    setRejectReason('')
    setOrder(prev => prev ? { ...prev, status: 'pharmacy_review' } : null)
    notifications.show({
      title: '❌ Rejected & returned to pharmacist',
      message: 'The pharmacist will see your reason and can revise pricing.',
      color: 'orange', autoClose: 3500,
    })
  }

  if (loading) return <Center h="100vh"><Loader color="green"/></Center>
  if (!order)  return <Center h="100vh"><Text c="dimmed">Order not found</Text></Center>

  const profile    = order.profiles as { name?: string; photo_url?: string } | null
  const meds       = (order.medications ?? []) as DbMedication[]
  const isActive   = !['delivered','cancelled','rejected'].includes(order.status)
  const barVisible = order.status === 'pricing_ready'

  return (
    <Box style={{ minHeight:'100vh', background:'#F0F4FA' }}>
      {/* Header */}
      <Box style={{ background:'linear-gradient(135deg,#064e3b,#047857)', padding:'14px 24px', display:'flex', alignItems:'center', gap:12 }}>
        <Button variant="subtle" leftSection={<TbArrowLeft size={16}/>}
          onClick={() => navigate('/insurance/orders')} style={{ color:'#fff' }}>
          Orders
        </Button>
        <Text style={{ fontFamily:"'DM Sans',sans-serif", fontWeight:700, fontSize:16, color:'#fff' }}>
          Order #{order.order_number}
        </Text>
        <Box style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:8 }}>
          <LiveDot/>
          <Text size="xs" c="rgba(255,255,255,0.7)">Live</Text>
        </Box>
      </Box>

      <Box style={{ maxWidth:720, margin:'0 auto', padding:'24px 16px' }}>
        <Stack gap="lg">
          {/* Status card */}
          <Box p="lg" style={{ background:'linear-gradient(135deg,#064e3b,#047857)', borderRadius:16, color:'#fff' }}>
            <Group gap="lg" align="flex-start">
              <Avatar src={profile?.photo_url} size={52} radius="xl" color="green">
                <TbUser size={22}/>
              </Avatar>
              <Box style={{ flex:1 }}>
                <Text fw={800} size="lg" c="#fff" style={{ fontFamily:"'Nunito',sans-serif" }}>
                  {profile?.name ?? '—'}
                </Text>
                <Group gap={8} mt={4}>
                  <Badge color={statusColor(order.status)} variant="light">{statusLabel(order.status)}</Badge>
                  {order.insurance_status === 'verified' && (
                    <Badge color="teal" variant="light" leftSection={<TbShieldCheck size={11}/>}>Insured</Badge>
                  )}
                </Group>
                <Text size="xs" c="rgba(255,255,255,0.6)" mt={6}>{formatRelativeTime(order.updated_at)}</Text>
              </Box>
            </Group>
            <Group gap={0} mt="lg" style={{ background:'rgba(255,255,255,0.1)', borderRadius:10, overflow:'hidden' }}>
              {[
                { label:'Subtotal', value: order.subtotal ? `UGX ${order.subtotal.toLocaleString()}` : 'TBD' },
                { label:'Insured', value: order.insured_amount != null ? `UGX ${order.insured_amount.toLocaleString()}` : 'TBD' },
                { label:'Customer Pays', value: order.total_amount != null ? (order.total_amount === 0 ? 'Covered' : `UGX ${order.total_amount.toLocaleString()}`) : 'TBD' },
              ].map(({ label, value }, i) => (
                <Box key={label} style={{ flex:1, padding:'12px 14px', borderLeft: i > 0 ? '1px solid rgba(255,255,255,0.15)' : 'none' }}>
                  <Text size="10px" c="rgba(255,255,255,0.55)" style={{ textTransform:'uppercase', letterSpacing:'0.06em' }}>{label}</Text>
                  <Text size="sm" fw={700} c="#fff" mt={2}>{value}</Text>
                </Box>
              ))}
            </Group>
          </Box>

          {barVisible && <BarSpacer $h={0}/>}

          {/* Prescription viewer */}
          {prescriptionSignedUrl && (
            <Box style={{ background:'#fff', borderRadius:12, border:`1.5px solid ${SavedColors.DemWhite}`, overflow:'hidden' }}>
              <Box p="md" style={{ borderBottom:`1px solid ${SavedColors.DemWhite}` }}>
                <Text fw={700} size="sm" c={SavedColors.TextColor}>Prescription</Text>
              </Box>
              {(order as { prescription_notes?: string }).prescription_notes && (
                <Box p="md" style={{ borderBottom:`1px solid ${SavedColors.DemWhite}`, background:'#eff6ff', display:'flex', alignItems:'flex-start', gap:12 }}>
                  <Box style={{ width:36, height:36, borderRadius:8, flexShrink:0, background:'linear-gradient(135deg,#3b82f6,#1d4ed8)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <TbNotes size={18} color="#fff"/>
                  </Box>
                  <Box style={{ flex:1 }}>
                    <Text size="sm" fw={800} c="#1d4ed8" mb={4}>Patient Note</Text>
                    <Text size="sm" fw={600} c="#1e3a5f" lh={1.6}>
                      {(order as { prescription_notes?: string }).prescription_notes}
                    </Text>
                  </Box>
                </Box>
              )}
              <PrescriptionViewer
                src={prescriptionSignedUrl}
                signedUrl={prescriptionSignedUrl}
                allSignedUrls={allSignedUrls}
              />
            </Box>
          )}

          {/* Medications table */}
          {meds.length > 0 && (
            <Box style={{ background:'#fff', borderRadius:12, border:`1.5px solid ${SavedColors.DemWhite}`, overflow:'hidden' }}>
              <Box p="md" style={{ borderBottom:`1px solid ${SavedColors.DemWhite}` }}>
                <Text fw={700} size="sm" c={SavedColors.TextColor}>Prescription Items</Text>
              </Box>
              <Box style={{ overflowX:'auto' }}>
                <Table>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Medication</Table.Th>
                      <Table.Th>Dosage</Table.Th>
                      <Table.Th ta="center">Qty</Table.Th>
                      <Table.Th ta="right">Unit Price</Table.Th>
                      <Table.Th ta="right">Total</Table.Th>
                      <Table.Th ta="center">Cover</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {meds.map(m => (
                      <Table.Tr key={m.id}>
                        <Table.Td><Text size="sm" fw={500}>{m.name}</Text></Table.Td>
                        <Table.Td><Text size="sm" c="dimmed">{(m as {dosage?:string}).dosage || '—'}</Text></Table.Td>
                        <Table.Td ta="center"><Text size="sm">{m.quantity}</Text></Table.Td>
                        <Table.Td ta="right"><Text size="sm">UGX {m.unit_price.toLocaleString()}</Text></Table.Td>
                        <Table.Td ta="right"><Text size="sm" fw={600}>UGX {(m.unit_price * m.quantity).toLocaleString()}</Text></Table.Td>
                        <Table.Td ta="center">
                          <Badge size="xs" color={m.is_insured ? 'teal' : 'gray'} variant="light">
                            {m.is_insured ? 'Insured' : 'Cash'}
                          </Badge>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Box>
              <Box p="md" style={{ borderTop:`1px solid ${SavedColors.DemWhite}` }}>
                <Stack gap={4}>
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">Subtotal</Text>
                    <Text size="sm">UGX {(order.subtotal ?? 0).toLocaleString()}</Text>
                  </Group>
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">Delivery fee</Text>
                    <Text size="sm" c={(order as { delivery_skipped?: boolean }).delivery_skipped ? 'dimmed' : undefined}>
                      {(order as { delivery_skipped?: boolean }).delivery_skipped ? 'No delivery (in-store)' : 'UGX 10,000'}
                    </Text>
                  </Group>
                  {(order.insured_amount ?? 0) > 0 && (
                    <Group justify="space-between">
                      <Text size="sm" c="teal">Insurance covers</Text>
                      <Text size="sm" c="teal">− UGX {(order.insured_amount ?? 0).toLocaleString()}</Text>
                    </Group>
                  )}
                  <Divider my={4}/>
                  <Group justify="space-between">
                    <Text fw={700} size="sm">Customer pays</Text>
                    <Text fw={700} size="sm" c={(order.total_amount ?? 0) === 0 ? 'teal' : SavedColors.Primaryblue}>
                      {(order.total_amount ?? 0) === 0 ? 'Fully Covered' : `UGX ${(order.total_amount ?? 0).toLocaleString()}`}
                    </Text>
                  </Group>
                </Stack>
              </Box>
            </Box>
          )}
        </Stack>
        {barVisible && <BarSpacer $h={140}/>}
      </Box>

      {/* ── Fixed approve / reject bar ── */}
      {barVisible && (
        <ApproveBar $visible>
          <Group justify="space-between" align="center" gap={8} wrap="nowrap">
            <Box style={{ flex:1, minWidth:0 }}>
              <Text fw={700} size="sm" c="#065f46">Awaiting your approval</Text>
              <Text size="xs" c="#047857" mt={1}>Review the bill above, then approve or reject.</Text>
            </Box>
            <Group gap={8} wrap="nowrap" style={{ flexShrink:0 }}>
              <Button
                variant="outline" color="red" size="md"
                leftSection={<TbShieldOff size={15}/>}
                onClick={() => { setRejectReason(''); setRejectModalOpen(true) }}
              >
                Reject
              </Button>
              <Button
                color="green" size="md" loading={approving}
                onClick={handleApprove} leftSection={<TbCheck size={15}/>}
              >
                Approve
              </Button>
            </Group>
          </Group>
        </ApproveBar>
      )}

      {/* ── Floating chat head ── */}
      {isActive && user && staffInfo && (
        <>
          <ChatFloat $barVisible={barVisible} onClick={openChat}>
            <TbMessage2 size={22} color="#fff"/>
            {unread > 0 && <UnreadDot>{unread > 9 ? '9+' : unread}</UnreadDot>}
          </ChatFloat>

          <ChatSlide $open={chatOpen}>
            <DragHandle
              onTouchStart={e => {
                const startY = e.touches[0].clientY
                const onMove = (mv: TouchEvent): void => {
                  if (mv.touches[0].clientY - startY > 70) { setChatOpen(false); cleanup() }
                }
                const cleanup = (): void => {
                  window.removeEventListener('touchmove', onMove)
                  window.removeEventListener('touchend', cleanup)
                }
                window.addEventListener('touchmove', onMove, { passive: true })
                window.addEventListener('touchend', cleanup)
              }}
            />
            <Box style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 16px 8px', borderBottom:'1px solid #EEF2F8', flexShrink:0 }}>
              <Text fw={700} size="sm" style={{ fontFamily:"'DM Sans',sans-serif", color:'#1A2B3C' }}>
                Chat with Pharmacy
              </Text>
              <button onClick={() => setChatOpen(false)} style={{ border:'none', background:'transparent', cursor:'pointer', padding:4, display:'flex', alignItems:'center' }}>
                <TbX size={17} color="#9EADB8"/>
              </button>
            </Box>
            <Box style={{ flex:1, overflow:'hidden' }}>
              <OrderChatPanel
                orderId={order.id}
                senderId={staffInfo.id}
                senderName={staffInfo.name + ' (Insurance)'}
                senderType="insurance_staff"
                chatThread="insurance"
                placeholder="Message pharmacy…"
                height={340}
              />
            </Box>
          </ChatSlide>

          {chatOpen && (
            <div
              onClick={() => setChatOpen(false)}
              style={{ position:'fixed', inset:0, zIndex:499, background:'rgba(0,0,0,0.3)' }}
            />
          )}
        </>
      )}

      {/* ── Rejection modal ── */}
      <Modal
        opened={rejectModalOpen}
        onClose={() => setRejectModalOpen(false)}
        title="Reject & Return to Pharmacist"
        centered size="sm"
        styles={{ title: { fontFamily:"'DM Sans',sans-serif", fontWeight:700 } }}
      >
        <Stack gap="md">
          <Box style={{ display:'flex', alignItems:'flex-start', gap:12, padding:'12px 14px', borderRadius:10, background:'#fff7ed', border:'1.5px solid #fed7aa' }}>
            <TbAlertCircle size={18} color="#ea580c" style={{ flexShrink:0, marginTop:2 }}/>
            <Text size="sm" c="#9a3412">
              The order will be <strong>returned to the pharmacist</strong> with your reason.
              They can revise the pricing and resubmit for approval.
            </Text>
          </Box>
          <Textarea
            label="Reason for rejection"
            placeholder="e.g. Medication not covered under this scheme, incorrect quantity billed, member not eligible for this benefit…"
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
              leftSection={<TbX size={14}/>}
              onClick={handleReject}
            >
              Confirm Rejection
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Box>
  )
}
