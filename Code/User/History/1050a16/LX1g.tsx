import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Avatar, Badge, Box, Button, Container, Group, Modal, Stack, Table,
  Text, Textarea, Title, Loader, Center, Tabs, Alert, Divider, SimpleGrid, Image
} from '@mantine/core'
import {
  TbArrowLeft, TbShieldCheck, TbShieldX, TbUser, TbSearch,
  TbShieldOff, TbCalendar, TbId, TbBuildingHospital, TbAlertCircle, TbCheck,
  TbBriefcase, TbUsers, TbPhoto, TbMenu2, TbX,
} from 'react-icons/tb'
import { CiLogout } from 'react-icons/ci'
import { notifications } from '@mantine/notifications'
import { PageWrapper, PageHeader, ContentCard } from '@shared/ui/layout'
import { PageTitle, BlueDivider, SectionLabel } from '@shared/ui/typography'
import { SavedColors } from '@shared/constants'
import { supabase, DbProfile, DbInsurance, InsuranceStatus } from '../../../lib/supabase'
import { useAuth } from '../../../features/auth/context/AuthContext'
import styled from 'styled-components'

const Shell = styled.div`display:flex;`
const Sidebar = styled.nav<{$open:boolean}>`
  width:240px;min-height:100vh;background:${SavedColors.FooterBgColor};
  position:fixed;top:0;left:0;z-index:200;
  display:flex;flex-direction:column;
  transform:${p=>p.$open?'translateX(0)':'translateX(-100%)'};transition:transform 0.3s;
  @media(min-width:900px){transform:translateX(0);position:sticky;flex-shrink:0;}
`
const Main = styled.div`flex:1;min-height:100vh;background:${SavedColors.bgWhite};`
const TopBar = styled.header`background:${SavedColors.FooterBgColor};padding:0.85rem 1.25rem;display:flex;align-items:center;justify-content:space-between;@media(min-width:900px){display:none;}`
const NavBtn = styled.button`display:flex;align-items:center;gap:12px;width:100%;padding:10px 20px;border:none;cursor:pointer;background:transparent;color:rgba(255,255,255,0.7);font-family:'Roboto',sans-serif;font-size:14px;&:hover{background:rgba(21,179,224,0.1);color:#fff;}`

// ── types ──────────────────────────────────────────────────────────────────
interface ProfileWithInsurance extends DbProfile {
  insurance?: DbInsurance
}

interface UserGroup {
  userId: string
  email?: string
  profiles: ProfileWithInsurance[]
  pendingCount: number
}

// ── helpers ────────────────────────────────────────────────────────────────
const insuranceColor: Record<InsuranceStatus, string> = {
  pending: 'yellow', verified: 'teal', rejected: 'red', expired: 'gray', none: 'gray'
}

const StatusBadge = ({ status }: { status: InsuranceStatus }) => (
  <Badge
    size="sm"
    color={insuranceColor[status]}
    variant={status === 'pending' ? 'filled' : 'light'}
    leftSection={status === 'verified'
      ? <TbShieldCheck size={11}/>
      : status === 'rejected'
      ? <TbShieldX size={11}/>
      : <TbShieldOff size={11}/>}
  >
    {status}
  </Badge>
)

const InputStyle = styled.input`
  width: 100%; padding: 8px 12px;
  border: 1px solid ${SavedColors.DemWhite}; border-radius: 6px;
  font-family: 'Roboto', sans-serif; font-size: 13px; outline: none;
  &:focus { border-color: ${SavedColors.Primaryblue}; }
`

// ── main component ─────────────────────────────────────────────────────────
export default function UserManagement() {
  const navigate = useNavigate()
  const { staffInfo, signOut } = useAuth()

  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState<UserGroup[]>([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<ProfileWithInsurance | null>(null)
  const [rejecting, setRejecting] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [processing, setProcessing] = useState(false)
  const [activeTab, setActiveTab] = useState<string>('pending')
  const [pendingOrdersCount, setPendingOrdersCount] = useState(0)

  // ── fetch all profiles + insurance ──────────────────────────────────────
  const fetchUsers = async () => {
    setLoading(true)
    // Exclude staff accounts — fetch only profiles whose user_id is NOT in the staff table
    const { data: staffIds } = await supabase.from('staff').select('id')
    const staffIdList = (staffIds || []).map((s: any) => s.id)

    const { data, error } = await supabase
      .from('profiles')
      .select('*, insurance(*)')
      .not('user_id', 'in', `(${staffIdList.length ? staffIdList.join(',') : 'null'})`)
      .order('created_at', { ascending: false })

    if (error) {
      notifications.show({ title: 'Error loading users', message: error.message, color: 'red' })
      setLoading(false)
      return
    }

    // Group profiles by user_id
    const grouped: Record<string, UserGroup> = {}
    for (const p of data as ProfileWithInsurance[]) {
      if (!grouped[p.user_id]) {
        grouped[p.user_id] = { userId: p.user_id, profiles: [], pendingCount: 0 }
      }
      grouped[p.user_id].profiles.push(p)
      const ins = Array.isArray(p.insurance) ? p.insurance[0] : p.insurance
      if ((ins as any)?.status === 'pending') {
        grouped[p.user_id].pendingCount++
      }
    }

    setUsers(Object.values(grouped))
    setLoading(false)
  }

  const fetchPendingOrders = async () => {
    const { count } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .in('status', ['prescription_uploaded', 'pharmacy_review'])
    setPendingOrdersCount(count ?? 0)
  }

  useEffect(() => {
    fetchUsers()
    fetchPendingOrders()

    const ch = supabase.channel('user-mgmt-orders-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchPendingOrders())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  // ── insurance decision ────────────────────────────────────────────────
  const decide = async (insuranceId: string, decision: 'verified' | 'rejected') => {
    setProcessing(true)
    const { error } = await supabase.rpc('staff_decide_insurance', {
      p_insurance_id: insuranceId,
      p_decision: decision,
      p_rejection_reason: decision === 'rejected' ? rejectionReason || null : null,
    })

    if (error) {
      notifications.show({ title: 'Error', message: error.message, color: 'red' })
      setProcessing(false)
      return
    }

    notifications.show({
      title: decision === 'verified' ? 'Insurance Approved ✅' : 'Insurance Rejected',
      message: decision === 'verified'
        ? 'Customer has been notified that their insurance is verified.'
        : 'Customer has been notified with the rejection reason.',
      color: decision === 'verified' ? 'teal' : 'red',
    })

    setProcessing(false)
    setSelected(null)
    setRejecting(false)
    setRejectionReason('')
    fetchUsers()
  }

  // ── derived data ──────────────────────────────────────────────────────
  const allProfiles = users.flatMap(u => u.profiles)
  // insurance(*) returns an array from the join — unwrap to first element
  const withInsurance = allProfiles.filter(p => {
    const ins = Array.isArray(p.insurance) ? p.insurance[0] : p.insurance
    return ins?.id
  })
  const pending  = withInsurance.filter(p => {
    const ins = Array.isArray(p.insurance) ? p.insurance[0] : p.insurance
    return (ins as any)?.status === 'pending'
  })
  const verified = withInsurance.filter(p => {
    const ins = Array.isArray(p.insurance) ? p.insurance[0] : p.insurance
    return (ins as any)?.status === 'verified'
  })
  const rejected = withInsurance.filter(p => {
    const ins = Array.isArray(p.insurance) ? p.insurance[0] : p.insurance
    return (ins as any)?.status === 'rejected'
  })

  const filterProfiles = (list: ProfileWithInsurance[]) =>
    list.filter(p =>
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.insurance as any)?.provider?.toLowerCase().includes(search.toLowerCase()) ||
      (p.insurance as any)?.policy_number?.toLowerCase().includes(search.toLowerCase())
    )

  // ── insurance detail modal ──────────────────────────────────────────
  // insurance(*) returns array — unwrap first element
  const ins = Array.isArray(selected?.insurance) ? (selected?.insurance as any[])[0] : selected?.insurance as DbInsurance | undefined

  const pendingCount = users.reduce((sum, u) => sum + u.pendingCount, 0)

  return (
    <Shell>
      {/* ── Sidebar ── */}
      <Sidebar $open={sidebarOpen}>
        <Box p="lg" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <Group gap="sm">
            <TbBuildingHospital size={24} color={SavedColors.Primaryblue} />
            <Text style={{ fontFamily: "'Nunito',sans-serif", fontWeight: 800, fontSize: 16, color: '#fff' }}>
              Pharmacy Portal
            </Text>
          </Group>
        </Box>
        <Box pt="md" style={{ flex: 1 }}>
          <NavBtn onClick={() => navigate('/pharmacy/dashboard')}>
            <TbBuildingHospital size={16} />
            <span style={{ flex: 1, textAlign: 'left' }}>Order Management</span>
            {pendingOrdersCount > 0 && (
              <span style={{ background: '#EF4444', color: '#fff', borderRadius: 10, fontSize: 11, fontWeight: 700, padding: '1px 7px', minWidth: 20, textAlign: 'center' }}>
                {pendingOrdersCount}
              </span>
            )}
          </NavBtn>
          <NavBtn style={{ background: 'rgba(21,179,224,0.15)', color: SavedColors.Primaryblue, borderLeft: '3px solid ' + SavedColors.Primaryblue }}
            onClick={() => navigate('/pharmacy/users')}>
            <TbUsers size={16} />
            <span style={{ flex: 1, textAlign: 'left' }}>User Management</span>
            {pendingCount > 0 && (
              <span style={{ background: '#EF4444', color: '#fff', borderRadius: 10, fontSize: 11, fontWeight: 700, padding: '1px 7px', minWidth: 20, textAlign: 'center' }}>
                {pendingCount}
              </span>
            )}
          </NavBtn>
        </Box>
        <Box p="md" style={{ borderTop: '1px solid rgba(255,255,255,0.1)', marginTop: 'auto' }}>
          <NavBtn onClick={() => { signOut(); navigate('/pharmacy/login') }}>
            <CiLogout size={16} /> Sign Out
          </NavBtn>
        </Box>
      </Sidebar>

      <Main>
        <TopBar>
          <Text style={{ color: '#fff', fontWeight: 700, fontFamily: "'Nunito',sans-serif" }}>Pharmacy Portal</Text>
          <Button variant="subtle" p={4} onClick={() => setSidebarOpen(o => !o)} style={{ color: '#fff' }}>
            {sidebarOpen ? <TbX size={20} /> : <TbMenu2 size={20} />}
          </Button>
        </TopBar>

      <Container size="xl" py="xl">
        <Box mb="xl">
          <SectionLabel>Pharmacy</SectionLabel>
          <PageTitle>User Management</PageTitle>
          <BlueDivider />
          <Text c="dimmed" size="sm" mt="xs">
            Review and approve or reject customer insurance documents
          </Text>
        </Box>

        {/* Stats row */}
        <Group gap="md" mb="xl" wrap="wrap">
          {[
            { label: 'Total Users',       value: users.length,    gradient: true },
            { label: 'Pending Review',    value: pending.length,  highlight: pending.length > 0 },
            { label: 'Verified',          value: verified.length, color: '#f0fdf4', border: '#86efac' },
            { label: 'Rejected',          value: rejected.length, color: '#fff5f5', border: '#fca5a5' },
          ].map(({ label, value, gradient, highlight, color, border }) => (
            <Box key={label} p="md" style={{
              background: gradient ? 'linear-gradient(135deg,#15B3E0,#012970)' : highlight ? '#fffbeb' : color || SavedColors.PrimaryWhite,
              border: `${highlight ? '2px' : '1px'} solid ${highlight ? '#f59f00' : border || SavedColors.DemWhite}`,
              borderRadius: 8, minWidth: 130, flex: 1,
            }}>
              <Text size="xs" c={gradient ? 'rgba(255,255,255,0.75)' : 'dimmed'}>{label}</Text>
              <Text style={{ fontSize: 28, fontWeight: 800, fontFamily: "'Nunito',sans-serif",
                color: gradient ? '#fff' : highlight ? '#f59f00' : SavedColors.TextColor }}>
                {value}
              </Text>
            </Box>
          ))}
        </Group>

        {pending.length > 0 && (
          <Alert color="orange" variant="light" icon={<TbAlertCircle size={16}/>} mb="lg">
            <Text size="sm" fw={600}>
              {pending.length} insurance record{pending.length > 1 ? 's' : ''} pending review — customers are waiting for approval.
            </Text>
          </Alert>
        )}

        {/* Search */}
        <ContentCard style={{ marginBottom: 20 }}>
          <Group gap="sm">
            <TbSearch size={16} color={SavedColors.DarkWhite}/>
            <InputStyle
              placeholder="Search by name, provider, or policy number…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ border: 'none', outline: 'none', flex: 1, padding: '4px 0' }}
            />
          </Group>
        </ContentCard>

        <ContentCard>
          {loading ? (
            <Center py="xl"><Loader color="lotusCyan"/></Center>
          ) : (
            <Tabs value={activeTab} onChange={v => setActiveTab(v || 'pending')} color="lotusCyan">
              <Tabs.List mb="md">
                <Tabs.Tab value="pending" leftSection={<TbAlertCircle size={14}/>}>
                  Pending ({filterProfiles(pending).length})
                </Tabs.Tab>
                <Tabs.Tab value="verified" leftSection={<TbShieldCheck size={14}/>}>
                  Verified ({filterProfiles(verified).length})
                </Tabs.Tab>
                <Tabs.Tab value="rejected" leftSection={<TbShieldX size={14}/>}>
                  Rejected ({filterProfiles(rejected).length})
                </Tabs.Tab>
                <Tabs.Tab value="all" leftSection={<TbUser size={14}/>}>
                  All with Insurance ({filterProfiles(withInsurance).length})
                </Tabs.Tab>
              </Tabs.List>

              {['pending', 'verified', 'rejected', 'all'].map(tab => {
                const list = filterProfiles(
                  tab === 'pending' ? pending :
                  tab === 'verified' ? verified :
                  tab === 'rejected' ? rejected : withInsurance
                )
                return (
                  <Tabs.Panel key={tab} value={tab}>
                    <InsuranceTable items={list} onReview={setSelected}/>
                  </Tabs.Panel>
                )
              })}
            </Tabs>
          )}
        </ContentCard>
      </Container>

      {/* ── Insurance Review Modal ── */}
      <Modal
        opened={!!selected}
        onClose={() => { setSelected(null); setRejecting(false); setRejectionReason('') }}
        title={
          <Group gap="sm">
            <TbShieldCheck size={20} color={SavedColors.Primaryblue}/>
            <Text fw={700} c={SavedColors.TextColor}>Insurance Review</Text>
          </Group>
        }
        size="lg"
        radius="md"
      >
        {selected && ins && (
          <Stack gap="lg">
            {/* Patient info */}
            <Group gap="md" p="sm" style={{ background: SavedColors.bgWhite, borderRadius: 8, border: `1px solid ${SavedColors.DemWhite}` }}>
              <Avatar size={48} radius="xl" color="lotusCyan">
                {selected.name[0]}
              </Avatar>
              <Box>
                <Text fw={700} c={SavedColors.TextColor}>{selected.name}</Text>
                <Text size="xs" c="dimmed">{selected.relationship} · DOB: {selected.date_of_birth}</Text>
                <StatusBadge status={ins.status}/>
              </Box>
            </Group>

            {/* Insurance details */}
            <Box>
              <Text fw={600} size="sm" c={SavedColors.TextColor} mb="sm">Insurance Details</Text>
              <SimpleGrid cols={2} spacing="sm">
                {[
                  { icon: TbBuildingHospital, label: 'Provider / Insurer',  value: ins.provider },
                  { icon: TbId,              label: 'Policy / Member No.',  value: ins.policy_number },
                  { icon: TbUser,            label: 'Policy Holder Name',   value: ins.policy_holder_name },
                  { icon: TbCalendar,        label: 'Expiry Date',          value: ins.expiry_date },
                  { icon: TbUsers,           label: 'Member Type',          value: ins.member_type ?? '—' },
                  { icon: TbPhoto,           label: 'Plan / Benefit Tier',  value: ins.plan_name ?? '—' },
                  { icon: TbBriefcase,       label: 'Employer / Scheme',    value: ins.employer_name ?? '—' },
                ].map(({ icon: Icon, label, value }) => (
                  <Box key={label} p="sm" style={{ background: '#f9fafb', borderRadius: 6, border: `1px solid ${SavedColors.DemWhite}` }}>
                    <Group gap={6} mb={2}>
                      <Icon size={13} color={SavedColors.Primaryblue}/>
                      <Text size="xs" c="dimmed">{label}</Text>
                    </Group>
                    <Text size="sm" fw={600} c={value === '—' ? 'dimmed' : SavedColors.TextColor}>{value}</Text>
                  </Box>
                ))}
              </SimpleGrid>
            </Box>

            {/* Card photos — critical for Uganda insurance verification */}
            {(ins.card_front_url || ins.card_back_url) && (
              <Box>
                <Text fw={600} size="sm" c={SavedColors.TextColor} mb="sm">Insurance Card Photos</Text>
                <Group gap="sm" align="flex-start">
                  {ins.card_front_url && (
                    <Box style={{ flex: 1 }}>
                      <Text size="xs" c="dimmed" mb={4} fw={600}>Front of Card</Text>
                      <Image
                        src={ins.card_front_url} alt="Insurance card front"
                        radius="md"
                        style={{ border: `1px solid ${SavedColors.DemWhite}`, cursor: 'pointer' }}
                        onClick={() => window.open(ins.card_front_url, '_blank')}
                      />
                    </Box>
                  )}
                  {ins.card_back_url && (
                    <Box style={{ flex: 1 }}>
                      <Text size="xs" c="dimmed" mb={4} fw={600}>Back of Card</Text>
                      <Image
                        src={ins.card_back_url} alt="Insurance card back"
                        radius="md"
                        style={{ border: `1px solid ${SavedColors.DemWhite}`, cursor: 'pointer' }}
                        onClick={() => window.open(ins.card_back_url, '_blank')}
                      />
                    </Box>
                  )}
                </Group>
                <Text size="xs" c="dimmed" mt={6}>Click any photo to open full size</Text>
              </Box>
            )}


            {/* Previous rejection reason if any */}
            {ins.status === 'rejected' && ins.rejection_reason && (
              <Alert color="red" variant="light" icon={<TbShieldX size={14}/>}>
                <Text size="xs" c="dimmed" mb={2}>Previous rejection reason:</Text>
                <Text size="sm">{ins.rejection_reason}</Text>
              </Alert>
            )}

            <Divider/>

            {/* Action area */}
            {ins.status === 'verified' ? (
              <Alert color="teal" variant="light" icon={<TbCheck size={14}/>}>
                <Text size="sm" fw={600}>This insurance is already verified. Customer has been notified.</Text>
              </Alert>
            ) : (
              <>
                {rejecting ? (
                  <Stack gap="sm">
                    <Text size="sm" fw={600} c={SavedColors.TextColor}>Rejection Reason</Text>
                    <Textarea
                      placeholder="Explain why the insurance was not approved (customer will see this)…"
                      value={rejectionReason}
                      onChange={e => setRejectionReason(e.target.value)}
                      rows={3} radius="sm"
                    />
                    <Group justify="flex-end" gap="sm">
                      <Button variant="subtle" onClick={() => { setRejecting(false); setRejectionReason('') }}>
                        Cancel
                      </Button>
                      <Button
                        color="red" loading={processing}
                        leftSection={<TbShieldX size={15}/>}
                        onClick={() => decide(ins.id, 'rejected')}
                      >
                        Confirm Rejection
                      </Button>
                    </Group>
                  </Stack>
                ) : (
                  <Group justify="flex-end" gap="sm">
                    <Button
                      color="red" variant="outline"
                      leftSection={<TbShieldX size={15}/>}
                      onClick={() => setRejecting(true)}
                    >
                      Reject
                    </Button>
                    <Button
                      color="teal"
                      leftSection={<TbShieldCheck size={15}/>}
                      loading={processing}
                      onClick={() => decide(ins.id, 'verified')}
                    >
                      Approve Insurance
                    </Button>
                  </Group>
                )}
              </>
            )}
          </Stack>
        )}
      </Modal>
      </Main>
    </Shell>
  )
}

// ── Insurance table (outside parent to avoid remount) ─────────────────────
interface InsuranceTableProps {
  items: ProfileWithInsurance[]
  onReview: (p: ProfileWithInsurance) => void
}

function InsuranceTable({ items, onReview }: InsuranceTableProps) {
  if (items.length === 0) {
    return (
      <Box ta="center" py="xl">
        <TbShieldOff size={36} color={SavedColors.DarkWhite} style={{ margin: '0 auto 8px' }}/>
        <Text c="dimmed" size="sm">No records in this category</Text>
      </Box>
    )
  }

  return (
    <Box style={{ overflowX: 'auto' }}>
      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th c={SavedColors.TextColor}>Patient</Table.Th>
            <Table.Th c={SavedColors.TextColor}>Relationship</Table.Th>
            <Table.Th c={SavedColors.TextColor}>Provider</Table.Th>
            <Table.Th c={SavedColors.TextColor}>Policy #</Table.Th>
            <Table.Th c={SavedColors.TextColor}>Expiry</Table.Th>
            <Table.Th c={SavedColors.TextColor}>Status</Table.Th>
            <Table.Th c={SavedColors.TextColor}>Action</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {items.map(p => {
            const ins = (Array.isArray(p.insurance) ? p.insurance[0] : p.insurance) as DbInsurance
            return (
              <Table.Tr key={p.id}>
                <Table.Td>
                  <Group gap="sm">
                    <Avatar size={32} radius="xl" color="lotusCyan">{p.name[0]}</Avatar>
                    <Text size="sm" fw={600} c={SavedColors.TextColor}>{p.name}</Text>
                  </Group>
                </Table.Td>
                <Table.Td><Text size="sm" c="dimmed">{p.relationship}</Text></Table.Td>
                <Table.Td><Text size="sm">{ins?.provider || '—'}</Text></Table.Td>
                <Table.Td>
                  <Text size="sm" ff="monospace" c={SavedColors.Primaryblue}>{ins?.policy_number || '—'}</Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" c={ins?.expiry_date && ins.expiry_date < new Date().toISOString().slice(0,10) ? 'red' : 'dimmed'}>
                    {ins?.expiry_date || '—'}
                    {ins?.expiry_date && ins.expiry_date < new Date().toISOString().slice(0,10) && (
                      <Badge size="xs" color="red" variant="light" ml={4}>Expired</Badge>
                    )}
                  </Text>
                </Table.Td>
                <Table.Td>
                  {ins && <StatusBadge status={ins.status}/>}
                </Table.Td>
                <Table.Td>
                  <Button
                    size="xs"
                    color={ins?.status === 'pending' ? 'orange' : 'lotusCyan'}
                    variant={ins?.status === 'pending' ? 'filled' : 'subtle'}
                    onClick={() => onReview(p)}
                  >
                    {ins?.status === 'pending' ? 'Review Now' : 'View'}
                  </Button>
                </Table.Td>
              </Table.Tr>
            )
          })}
        </Table.Tbody>
      </Table>
    </Box>
  )
}
