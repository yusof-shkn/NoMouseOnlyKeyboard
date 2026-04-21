import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Stack,
  Text,
  Group,
  Loader,
  Center,
  Avatar,
  Button,
  Modal,
  NumberInput,
  Badge,
  Table,
  ActionIcon,
  Tooltip,
} from '@mantine/core'
import {
  TbClipboardCheck,
  TbUser,
  TbHistory,
  TbPlus,
  TbFileTypePdf,
  TbDownload,
  TbShieldCheck,
  TbSwitchHorizontal,
} from 'react-icons/tb'
import { notifications } from '@mantine/notifications'
import styled from 'styled-components'
import { SavedColors } from '@shared/constants'
import { supabase } from '../../../lib/supabase'
import { useInsuranceStaff } from '../../../features/insurance/context/InsuranceStaffContext'

/* ── Types ─────────────────────────────────────────────────────────────── */
interface StaffInfo {
  id: string
  name: string
  provider_name: string
}
interface OrderForApproval {
  id: string
  order_number: string
  status: string
  subtotal?: number
  insured_amount?: number
  insurance_approval_ref?: string
  cash_only?: boolean
  updated_at: string
  profiles?: { name: string; photo_url?: string; is_chronic?: boolean }
  chronic_schedule_id?: string | null
  is_chronic_child?: boolean
}

interface HistoryApproval {
  id: string
  order_id: string
  order_number: string
  approval_ref: string
  patient_name: string
  patient_photo?: string
  insured_amount: number
  subtotal: number
  approved_by: string
  approved_at: string
  status: string
}

type ViewMode = 'new' | 'history'

/* ── Styled ─────────────────────────────────────────────────────────────── */
const ToggleWrap = styled.div`
  display: flex;
  background: var(--mantine-color-default-hover);
  border: 1px solid var(--mantine-color-default-border);
  border-radius: 10px;
  padding: 3px;
  gap: 2px;
`
const ToggleBtn = styled.button<{ $active: boolean }>`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border: none;
  cursor: pointer;
  border-radius: 8px;
  font-family: 'DM Sans', sans-serif;
  font-size: 13px;
  font-weight: ${(p) => (p.$active ? 700 : 500)};
  background: ${(p) =>
    p.$active ? 'var(--mantine-color-body)' : 'transparent'};
  color: ${(p) =>
    p.$active ? SavedColors.Primaryblue : 'var(--mantine-color-dimmed)'};
  box-shadow: ${(p) => (p.$active ? '0 1px 4px rgba(0,0,0,0.10)' : 'none')};
  transition: all 0.15s;
  &:hover {
    background: ${(p) =>
      p.$active ? 'var(--mantine-color-body)' : 'rgba(21,179,224,0.08)'};
  }
`

/* ── PDF Export ─────────────────────────────────────────────────────────── */
function exportApprovalPDF(
  approval: HistoryApproval,
  providerName: string,
): void {
  const coverPct =
    approval.subtotal > 0
      ? Math.round((approval.insured_amount / approval.subtotal) * 100)
      : 0
  const customerPays = Math.max(
    0,
    approval.subtotal - approval.insured_amount + 10000,
  )
  const dateStr = new Date(approval.approved_at).toLocaleDateString('en-UG', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Approval Certificate — ${approval.approval_ref}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; padding: 48px; color: #1a2332; background: #fff; }
  .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 36px; padding-bottom: 24px; border-bottom: 3px solid #15B3E0; }
  .brand-name { font-size:22px; font-weight:800; color:#1a2332; }
  .brand-sub { font-size:13px; color:#64748b; margin-top:2px; }
  .ref-box { background:#EBF7FD; border:1.5px solid #bae6fd; border-radius:10px; padding:12px 18px; text-align:right; }
  .ref-label { font-size:11px; font-weight:600; color:#0891b2; text-transform:uppercase; letter-spacing:0.06em; }
  .ref-number { font-size:20px; font-weight:800; color:#0891b2; margin-top:3px; font-family:monospace; }
  .title { font-size:26px; font-weight:800; color:#1a2332; text-align:center; margin-bottom:6px; }
  .subtitle { font-size:14px; color:#64748b; text-align:center; margin-bottom:32px; }
  .section-title { font-size:11px; font-weight:700; color:#94a3b8; text-transform:uppercase; letter-spacing:0.08em; margin-bottom:10px; }
  .info-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:28px; }
  .info-item { background:#f8fafc; border-radius:8px; padding:12px 14px; }
  .info-label { font-size:11px; color:#64748b; font-weight:600; text-transform:uppercase; letter-spacing:0.05em; }
  .info-value { font-size:15px; font-weight:700; color:#1a2332; margin-top:3px; }
  .amounts-row { display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px; margin-bottom:20px; }
  .amount-card { border-radius:10px; padding:16px; text-align:center; }
  .amount-card.bill { background:#f1f5f9; }
  .amount-card.covered { background:#d1fae5; }
  .amount-card.pays { background:#fef3c7; }
  .amount-label { font-size:11px; font-weight:600; color:#64748b; text-transform:uppercase; letter-spacing:0.05em; }
  .amount-value { font-size:17px; font-weight:800; margin-top:4px; }
  .amount-card.bill .amount-value { color:#475569; }
  .amount-card.covered .amount-value { color:#059669; }
  .amount-card.pays .amount-value { color:#d97706; }
  .bar-bg { background:#e2e8f0; border-radius:999px; height:10px; overflow:hidden; margin-top:12px; }
  .bar-fill { height:100%; border-radius:999px; background:linear-gradient(90deg,#15B3E0,#059669); }
  .bar-pct { font-size:13px; font-weight:700; color:#0891b2; margin-top:4px; text-align:right; }
  .footer { margin-top:48px; padding-top:20px; border-top:1.5px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center; }
  .footer-note { font-size:11px; color:#94a3b8; }
  .stamp { background:linear-gradient(135deg,#10b981,#059669); color:#fff; border-radius:8px; padding:8px 18px; font-size:12px; font-weight:700; }
</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand-name">${providerName}</div>
      <div class="brand-sub">Insurance Approval Certificate · MediDeliver</div>
    </div>
    <div class="ref-box">
      <div class="ref-label">Approval Reference</div>
      <div class="ref-number">${approval.approval_ref}</div>
    </div>
  </div>
  <div class="title">Insurance Coverage Approval</div>
  <div class="subtitle">This document certifies that the insurance coverage has been officially approved</div>
  <div class="section-title">Patient &amp; Order Details</div>
  <div class="info-grid">
    <div class="info-item"><div class="info-label">Patient Name</div><div class="info-value">${approval.patient_name}</div></div>
    <div class="info-item"><div class="info-label">Order Number</div><div class="info-value">#${approval.order_number}</div></div>
    <div class="info-item"><div class="info-label">Approved By</div><div class="info-value">${approval.approved_by}</div></div>
    <div class="info-item"><div class="info-label">Approval Date</div><div class="info-value">${dateStr}</div></div>
  </div>
  <div class="section-title">Coverage Breakdown</div>
  <div class="amounts-row">
    <div class="amount-card bill"><div class="amount-label">Total Bill</div><div class="amount-value">UGX ${approval.subtotal.toLocaleString()}</div></div>
    <div class="amount-card covered"><div class="amount-label">Insurance Covers</div><div class="amount-value">UGX ${approval.insured_amount.toLocaleString()}</div></div>
    <div class="amount-card pays"><div class="amount-label">Patient Pays</div><div class="amount-value">UGX ${customerPays.toLocaleString()}</div></div>
  </div>
  <div class="bar-bg"><div class="bar-fill" style="width:${coverPct}%"></div></div>
  <div class="bar-pct">${coverPct}% covered by insurance</div>
  <div class="footer">
    <div class="footer-note">Generated by MediDeliver · ${new Date().toLocaleString()}<br/>This is an official insurance approval document. Please retain for your records.</div>
    <div class="stamp">✓ APPROVED</div>
  </div>
</body>
</html>`

  const win = window.open('', '_blank')
  if (!win) return
  win.document.write(html)
  win.document.close()
  win.onload = () => {
    win.print()
  }
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-UG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}
function fmtUGX(n: number): string {
  return 'UGX ' + n.toLocaleString()
}

export default function InsuranceApprovals(): JSX.Element {
  const navigate = useNavigate()
  const { staffInfo, activeStaffProfile, openProfilePicker } =
    useInsuranceStaff()
  // actorName: the display name used in audit logs and approval records
  const actorName =
    activeStaffProfile?.display_name ?? staffInfo?.name ?? 'Staff'
  const [viewMode, setViewMode] = useState<ViewMode>('new')
  const [orders, setOrders] = useState<OrderForApproval[]>([])
  const [history, setHistory] = useState<HistoryApproval[]>([])
  const [loading, setLoading] = useState(true)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [approveModal, setApproveModal] = useState<OrderForApproval | null>(
    null,
  )
  const [insuredInput, setInsuredInput] = useState<number | string>('')
  const [approving, setApproving] = useState(false)
  const historyFetched = useRef(false)

  const load = useCallback(async (): Promise<void> => {
    if (!staffInfo) {
      setLoading(false)
      return
    }
    const pname = staffInfo.provider_name

    // Bug 6 fix: filter by selected_insurance_id (the exact card the customer chose),
    // NOT by profile_id. Using profile_id meant any provider that had a verified card
    // for that profile could see and approve the same order — a multi-provider leak.
    const { data: ins } = await supabase
      .from('insurance')
      .select('id')
      .eq('provider', pname)
      .eq('status', 'verified')
    const insuranceIds = (ins ?? []).map((i: { id: string }) => i.id)
    if (!insuranceIds.length) {
      setLoading(false)
      return
    }

    const { data: orderData } = await supabase
      .from('orders')
      .select(
        '*, profiles(name,photo_url,is_chronic), insurance_approval_ref, chronic_schedule_id, is_chronic_child',
      )
      .in('selected_insurance_id', insuranceIds)
      .eq('status', 'pricing_ready')
      .eq('cash_only', false)
      .order('updated_at', { ascending: false })

    setOrders((orderData ?? []) as OrderForApproval[])
    setLoading(false)
  }, [staffInfo])

  const loadHistory = useCallback(async (): Promise<void> => {
    if (!staffInfo) return
    setHistoryLoading(true)

    // Bug 6 fix: same correction as load() — use insurance IDs not profile IDs
    const { data: ins } = await supabase
      .from('insurance')
      .select('id')
      .eq('provider', staffInfo.provider_name)
      .eq('status', 'verified')
    const insuranceIds = (ins ?? []).map((i: { id: string }) => i.id)
    if (!insuranceIds.length) {
      setHistoryLoading(false)
      return
    }

    const { data: approvedOrders } = await supabase
      .from('orders')
      .select(
        'id, order_number, status, subtotal, insured_amount, insurance_approval_ref, insurance_approved_by_name, updated_at, profiles(name,photo_url)',
      )
      .in('selected_insurance_id', insuranceIds)
      .eq('cash_only', false)
      .not('insurance_approval_ref', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(200)

    type RawApproved = {
      id: string
      order_number: string
      status: string
      subtotal: number | null
      insured_amount: number | null
      insurance_approval_ref: string | null
      insurance_approved_by_name: string | null
      updated_at: string
      profiles:
        | { name: string; photo_url?: string }
        | { name: string; photo_url?: string }[]
        | null
    }

    const rows = (approvedOrders ?? []) as RawApproved[]
    const historyRows: HistoryApproval[] = rows.map((o) => {
      const pn = o.profiles
      const patientName = Array.isArray(pn)
        ? (pn[0]?.name ?? 'Unknown')
        : (pn?.name ?? 'Unknown')
      const patientPhoto = Array.isArray(pn)
        ? pn[0]?.photo_url
        : (pn as { photo_url?: string } | null)?.photo_url
      return {
        id: o.id,
        order_id: o.id,
        order_number: o.order_number,
        approval_ref: o.insurance_approval_ref ?? '—',
        patient_name: patientName,
        patient_photo: patientPhoto,
        insured_amount: o.insured_amount ?? 0,
        subtotal: o.subtotal ?? 0,
        approved_by: o.insurance_approved_by_name ?? 'System',
        approved_at: o.updated_at,
        status: o.status,
      }
    })

    setHistory(historyRows)
    setHistoryLoading(false)
  }, [staffInfo])

  useEffect(() => {
    load()
    const ch = supabase
      .channel('ins-approvals-rt')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        load,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'insurance' },
        load,
      )
      .subscribe()
    return () => {
      supabase.removeChannel(ch)
    }
  }, [load])

  useEffect(() => {
    if (viewMode === 'history' && staffInfo) {
      historyFetched.current = true
      loadHistory()
    }
  }, [viewMode, staffInfo, loadHistory])

  const handleApprove = async (): Promise<void> => {
    if (!approveModal) return
    setApproving(true)
    const insAmt =
      typeof insuredInput === 'number'
        ? insuredInput
        : parseFloat(String(insuredInput)) || undefined

    // Bug 3 fix: generate the approval ref here and pass it INTO the RPC.
    // The RPC now writes approval_ref, insurance_approved_by_name, and
    // insurance_approved_at atomically, so there is no race condition or
    // silent audit gap between a pre-write and the RPC call.
    const approvalRef = `INS-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`

    const { error } = await supabase.rpc('approve_insurance_coverage', {
      p_order_id: approveModal.id,
      p_insured_amount: insAmt ?? null,
      p_approval_ref: approvalRef,
    })
    setApproving(false)
    if (error) {
      notifications.show({
        title: 'Error',
        message: error.message,
        color: 'red',
        autoClose: 3000,
      })
      return
    }

    // Audit log — written after successful RPC
    await supabase.from('insurance_coverage_logs').insert({
      order_id: approveModal.id,
      field_name: 'Insurance approved',
      old_value: null,
      new_value:
        insAmt != null
          ? `UGX ${insAmt.toLocaleString()} covered · Ref: ${approvalRef}`
          : `Ref: ${approvalRef}`,
      changed_by: staffInfo?.id ?? null,
      note: `Approved by ${actorName}`,
    })
    notifications.show({
      title: 'Order approved',
      message: `Approval ref: ${approvalRef}. Customer notified.`,
      color: 'lotusCyan',
      autoClose: 4000,
    })
    setApproveModal(null)
    setInsuredInput('')
    setOrders((prev) => prev.filter((o) => o.id !== approveModal.id))
    historyFetched.current = false
  }

  if (loading)
    return (
      <Center h="60vh">
        <Loader color="lotusCyan" />
      </Center>
    )

  return (
    <Box
      p={{ base: 'md', sm: 'xl' }}
      style={{ maxWidth: 1800 }}
    >
      <Group
        justify="space-between"
        mb={4}
        wrap="wrap"
        gap={10}
      >
        <Box>
          <Text
            style={{
              fontFamily: "'DM Sans',sans-serif",
              fontSize: 22,
              fontWeight: 800,
              color: SavedColors.TextColor,
            }}
          >
            Order Approvals
          </Text>
          <Text
            c="dimmed"
            size="sm"
            mt={2}
          >
            {viewMode === 'new'
              ? 'Review and approve priced orders for your insured members'
              : 'History of all processed insurance approvals'}
          </Text>
        </Box>
        <ToggleWrap>
          <ToggleBtn
            $active={viewMode === 'new'}
            onClick={() => setViewMode('new')}
          >
            <TbPlus size={14} />
            New
            {orders.length > 0 && (
              <Badge
                size="xs"
                color="red"
                variant="filled"
                style={{ marginLeft: 2 }}
              >
                {orders.length}
              </Badge>
            )}
          </ToggleBtn>
          <ToggleBtn
            $active={viewMode === 'history'}
            onClick={() => setViewMode('history')}
          >
            <TbHistory size={14} />
            History
          </ToggleBtn>
        </ToggleWrap>
      </Group>

      {/* NEW VIEW */}
      {viewMode === 'new' && (
        <Box mt="xl">
          {orders.length === 0 ? (
            <Box
              p="xl"
              ta="center"
              style={{
                borderRadius: 12,
                border: `1.5px dashed var(--mantine-color-default-border)`,
                background: 'var(--mantine-color-default-hover)',
              }}
            >
              <TbClipboardCheck
                size={32}
                color="#D1D5DB"
                style={{ marginBottom: 8 }}
              />
              <Text
                size="sm"
                c="dimmed"
              >
                No orders awaiting approval
              </Text>
              <Button
                size="xs"
                variant="subtle"
                color="lotusCyan"
                mt="sm"
                leftSection={<TbHistory size={13} />}
                onClick={() => setViewMode('history')}
              >
                View approval history
              </Button>
            </Box>
          ) : (
            <Stack gap={8}>
              {orders.map((o) => {
                const profile = o.profiles as {
                  name?: string
                  photo_url?: string
                  is_chronic?: boolean
                } | null
                const isChronic = !!profile?.is_chronic
                const isReplacement = isChronic && !!o.chronic_schedule_id
                return (
                  <Box
                    key={o.id}
                    p="sm"
                    style={{
                      borderRadius: 10,
                      border: `1.5px solid ${isReplacement ? '#FED7AA' : 'var(--mantine-color-default-border)'}`,
                      background: isReplacement
                        ? 'rgba(253,186,116,0.06)'
                        : 'var(--mantine-color-body)',
                    }}
                  >
                    <Group
                      justify="space-between"
                      wrap="nowrap"
                    >
                      <Group gap={10}>
                        <Avatar
                          size={36}
                          radius="xl"
                          src={profile?.photo_url}
                          color="lotusCyan"
                        >
                          <TbUser size={16} />
                        </Avatar>
                        <Box>
                          <Group
                            gap={6}
                            mb={2}
                          >
                            <Text
                              size="sm"
                              fw={700}
                              c={SavedColors.TextColor}
                            >
                              {profile?.name ?? 'Unknown'}
                            </Text>
                            {isChronic && (
                              <Badge
                                size="xs"
                                color="red"
                                variant="light"
                              >
                                Chronic
                              </Badge>
                            )}
                            {isReplacement && (
                              <Badge
                                size="xs"
                                color="orange"
                                variant="filled"
                              >
                                Rx changed
                              </Badge>
                            )}
                          </Group>
                          <Text
                            size="xs"
                            c="dimmed"
                          >
                            Order #{o.order_number}
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
                          {o.subtotal != null && (
                            <Text
                              size="xs"
                              c="dimmed"
                            >
                              Bill: UGX {o.subtotal.toLocaleString()} · Insured:
                              UGX {(o.insured_amount ?? 0).toLocaleString()}
                            </Text>
                          )}
                        </Box>
                      </Group>
                      <Group gap={8}>
                        <Button
                          size="xs"
                          variant="light"
                          color="blue"
                          onClick={() => navigate('/insurance/orders/' + o.id)}
                        >
                          View
                        </Button>
                        <Button
                          size="xs"
                          variant="filled"
                          color="lotusCyan"
                          leftSection={<TbClipboardCheck size={13} />}
                          onClick={() => {
                            setApproveModal(o)
                            setInsuredInput(o.insured_amount ?? '')
                          }}
                        >
                          Approve
                        </Button>
                      </Group>
                    </Group>
                  </Box>
                )
              })}
            </Stack>
          )}
        </Box>
      )}

      {/* HISTORY VIEW */}
      {viewMode === 'history' && (
        <Box mt="xl">
          {historyLoading ? (
            <Center h="40vh">
              <Loader color="lotusCyan" />
            </Center>
          ) : history.length === 0 ? (
            <Box
              p="xl"
              ta="center"
              style={{
                borderRadius: 12,
                border: `1.5px dashed var(--mantine-color-default-border)`,
                background: 'var(--mantine-color-default-hover)',
              }}
            >
              <TbHistory
                size={32}
                color="#D1D5DB"
                style={{ marginBottom: 8 }}
              />
              <Text
                size="sm"
                c="dimmed"
              >
                No approvals history yet
              </Text>
            </Box>
          ) : (
            <Box
              style={{
                borderRadius: 14,
                border: `1.5px solid var(--mantine-color-default-border)`,
                background: 'var(--mantine-color-body)',
                overflow: 'hidden',
              }}
            >
              <Box
                px="md"
                py="sm"
                style={{
                  borderBottom: `1px solid var(--mantine-color-default-border)`,
                  background: 'var(--mantine-color-default-hover)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <TbShieldCheck
                  size={16}
                  color={SavedColors.Primaryblue}
                />
                <Text
                  fw={700}
                  size="sm"
                  c={SavedColors.TextColor}
                >
                  Approval History
                </Text>
                <Badge
                  size="xs"
                  color="lotusCyan"
                  variant="light"
                  ml="auto"
                >
                  {history.length} total
                </Badge>
              </Box>
              <Box style={{ overflowX: 'auto' }}>
                <Table highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Approval Ref</Table.Th>
                      <Table.Th>Patient</Table.Th>
                      <Table.Th>Order #</Table.Th>
                      <Table.Th>Approved By</Table.Th>
                      <Table.Th ta="right">Bill</Table.Th>
                      <Table.Th ta="right">Covered</Table.Th>
                      <Table.Th ta="center">Status</Table.Th>
                      <Table.Th>Date</Table.Th>
                      <Table.Th ta="center">PDF</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {history.map((h) => {
                      const coverPct =
                        h.subtotal > 0
                          ? Math.round((h.insured_amount / h.subtotal) * 100)
                          : 0
                      return (
                        <Table.Tr key={h.id}>
                          <Table.Td>
                            <Text
                              size="xs"
                              fw={700}
                              style={{
                                fontFamily: 'monospace',
                                color: SavedColors.Primaryblue,
                              }}
                            >
                              {h.approval_ref}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Group
                              gap={6}
                              wrap="nowrap"
                            >
                              <Avatar
                                size={24}
                                radius="xl"
                                src={h.patient_photo}
                                color="lotusCyan"
                              >
                                <TbUser size={11} />
                              </Avatar>
                              <Text
                                size="xs"
                                c={SavedColors.TextColor}
                              >
                                {h.patient_name}
                              </Text>
                            </Group>
                          </Table.Td>
                          <Table.Td>
                            <Text
                              size="xs"
                              c="dimmed"
                              fw={600}
                            >
                              #{h.order_number}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Text
                              size="xs"
                              c="dimmed"
                            >
                              {h.approved_by}
                            </Text>
                          </Table.Td>
                          <Table.Td ta="right">
                            <Text
                              size="xs"
                              c="dimmed"
                            >
                              {fmtUGX(h.subtotal)}
                            </Text>
                          </Table.Td>
                          <Table.Td ta="right">
                            <Text
                              size="xs"
                              fw={600}
                              c="teal"
                            >
                              {fmtUGX(h.insured_amount)}
                            </Text>
                          </Table.Td>
                          <Table.Td ta="center">
                            <Group
                              gap={4}
                              justify="center"
                            >
                              <Badge
                                size="xs"
                                variant="light"
                                color={
                                  h.status === 'delivered'
                                    ? 'teal'
                                    : h.status === 'cancelled'
                                      ? 'red'
                                      : 'blue'
                                }
                              >
                                {h.status.replace(/_/g, ' ')}
                              </Badge>
                              <Badge
                                size="xs"
                                variant="light"
                                color={
                                  coverPct >= 76
                                    ? 'teal'
                                    : coverPct >= 51
                                      ? 'blue'
                                      : 'orange'
                                }
                              >
                                {coverPct}%
                              </Badge>
                            </Group>
                          </Table.Td>
                          <Table.Td>
                            <Text
                              size="xs"
                              c="dimmed"
                            >
                              {fmtDate(h.approved_at)}
                            </Text>
                          </Table.Td>
                          <Table.Td ta="center">
                            <Tooltip
                              label="Download approval as PDF"
                              withArrow
                            >
                              <ActionIcon
                                size="sm"
                                variant="light"
                                color="red"
                                onClick={() =>
                                  exportApprovalPDF(
                                    h,
                                    staffInfo?.provider_name ?? 'Insurance',
                                  )
                                }
                              >
                                <TbFileTypePdf size={14} />
                              </ActionIcon>
                            </Tooltip>
                          </Table.Td>
                        </Table.Tr>
                      )
                    })}
                  </Table.Tbody>
                </Table>
              </Box>
              <Box
                px="md"
                py="sm"
                style={{
                  borderTop: `1px solid var(--mantine-color-default-border)`,
                  display: 'flex',
                  justifyContent: 'flex-end',
                }}
              >
                <Button
                  size="xs"
                  variant="light"
                  color="red"
                  leftSection={<TbDownload size={13} />}
                  onClick={() =>
                    history.forEach((h) =>
                      exportApprovalPDF(
                        h,
                        staffInfo?.provider_name ?? 'Insurance',
                      ),
                    )
                  }
                >
                  Export All as PDF
                </Button>
              </Box>
            </Box>
          )}
        </Box>
      )}

      {/* APPROVE MODAL */}
      <Modal
        opened={!!approveModal}
        onClose={() => {
          setApproveModal(null)
          setInsuredInput('')
        }}
        title="Approve Insurance Coverage"
        centered
        size="sm"
        radius="md"
        styles={{
          title: { fontFamily: "'DM Sans',sans-serif", fontWeight: 700 },
        }}
      >
        {approveModal && (
          <Stack gap="md">
            {staffInfo && (
              <Box
                px="sm"
                py={8}
                style={{
                  background: 'rgba(21,179,224,0.08)',
                  borderRadius: 8,
                  border: '1px solid rgba(21,179,224,0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  justifyContent: 'space-between',
                }}
              >
                <Box style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <TbUser
                    size={14}
                    color="#0891b2"
                  />
                  <Text
                    size="xs"
                    c="#0891b2"
                    fw={600}
                  >
                    Approving as: <b>{actorName}</b> · {staffInfo.provider_name}
                  </Text>
                </Box>
                <Tooltip
                  label="Switch profile"
                  withArrow
                >
                  <Box
                    onClick={openProfilePicker}
                    style={{ cursor: 'pointer', color: '#0891b2' }}
                  >
                    <TbSwitchHorizontal size={14} />
                  </Box>
                </Tooltip>
              </Box>
            )}
            <Text
              size="sm"
              c="dimmed"
            >
              Order <b>#{approveModal.order_number}</b> — Bill total:{' '}
              <b>UGX {(approveModal.subtotal ?? 0).toLocaleString()}</b>
            </Text>
            {approveModal.insurance_approval_ref && (
              <Text
                size="xs"
                c="teal"
                fw={600}
              >
                Approval Ref: {approveModal.insurance_approval_ref}
              </Text>
            )}
            <NumberInput
              label="Insured Amount (UGX)"
              description="Amount your insurance will cover. Leave as-is to use pharmacy's calculation."
              value={insuredInput}
              onChange={setInsuredInput}
              min={0}
              max={approveModal.subtotal ?? 999999999}
              step={1000}
              styles={{
                input: {
                  height: 42,
                  border: '1.5px solid #E4E9F0',
                  borderRadius: 8,
                },
              }}
            />
            {typeof insuredInput === 'number' &&
              approveModal.subtotal != null &&
              (() => {
                const insured = insuredInput as number
                const subtotalVal = approveModal.subtotal ?? 0
                // Bug 3 fix: customer pays = (subtotal - insured_amount).
                // Delivery fee (10,000 UGX) is always covered by insurance separately
                // and is added to total_amount only after a rider accepts the order.
                const customerPays = Math.max(0, subtotalVal - insured)
                return (
                  <Box
                    p="sm"
                    style={{
                      background: SavedColors.lightBlue,
                      borderRadius: 8,
                      border: '1px solid ' + SavedColors.DemWhite,
                    }}
                  >
                    <Text
                      size="xs"
                      c="green.7"
                      fw={600}
                    >
                      Customer pays: UGX {customerPays.toLocaleString()}{' '}
                      (medications)
                    </Text>
                    <Text
                      size="xs"
                      c="dimmed"
                    >
                      + UGX 10,000 delivery fee (covered by insurance, added
                      when rider assigned)
                    </Text>
                  </Box>
                )
              })()}
            <Group
              justify="flex-end"
              gap="sm"
            >
              <Button
                variant="default"
                onClick={() => {
                  setApproveModal(null)
                  setInsuredInput('')
                }}
              >
                Cancel
              </Button>
              <Button
                color="lotusCyan"
                loading={approving}
                onClick={handleApprove}
                leftSection={<TbClipboardCheck size={14} />}
              >
                Approve &amp; Notify Customer
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Box>
  )
}

