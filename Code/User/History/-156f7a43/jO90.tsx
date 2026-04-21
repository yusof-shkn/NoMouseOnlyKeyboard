import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Box,
  Stack,
  Text,
  Badge,
  Group,
  Loader,
  Center,
  Avatar,
  Button,
  Modal,
  TextInput,
  Textarea,
  SimpleGrid,
  Tooltip,
} from '@mantine/core'
import {
  TbShieldCheck,
  TbShieldX,
  TbUser,
  TbSearch,
  TbArrowLeft,
  TbHeart,
  TbUserCheck,
  TbSwitchHorizontal,
} from 'react-icons/tb'
import { notifications } from '@mantine/notifications'
import { SavedColors } from '@shared/constants'
import { supabase } from '../../../lib/supabase'
import type { DbInsurance } from '../../../lib/supabase'
import { formatRelativeTime } from '../../../shared/utils/formatTime'
import { useInsuranceStaff } from '../../../features/insurance/context/InsuranceStaffContext'

interface InsuranceWithProfile extends DbInsurance {
  profiles?: {
    name: string
    user_id: string
    photo_url?: string
    is_chronic?: boolean
  }
  verified_by_name?: string
}
interface StaffInfo {
  provider_name: string
}

const statusColor: Record<string, string> = {
  pending: 'yellow',
  verified: 'teal',
  rejected: 'red',
  expired: 'orange',
}

// List view
export function InsuranceVerificationsList(): JSX.Element {
  const navigate = useNavigate()
  const [items, setItems] = useState<InsuranceWithProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<'pending' | 'all' | 'chronic'>('pending')

  useEffect(() => {
    let providerName = ''
    const load = async () => {
      const { data: si } = await supabase.rpc('get_my_insurance_staff_info')
      if (!si) return
      providerName = (si as StaffInfo).provider_name
      const { data } = await supabase
        .from('insurance')
        .select('*, profiles(name,user_id,photo_url,is_chronic)')
        .eq('provider', providerName)
        .order('created_at', { ascending: false })
      setItems((data ?? []) as InsuranceWithProfile[])
      setLoading(false)
    }
    load()
    const ch = supabase
      .channel('insurance-verifications-list')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'insurance' },
        () => load(),
      )
      .subscribe()
    return () => {
      supabase.removeChannel(ch)
    }
  }, [])

  const filtered = items.filter((i) => {
    if (tab === 'pending' && i.status !== 'pending') return false
    if (tab === 'chronic' && !i.profiles?.is_chronic) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        (i.profiles?.name ?? '').toLowerCase().includes(q) ||
        (i.policy_number ?? '').toLowerCase().includes(q)
      )
    }
    return true
  })

  if (loading)
    return (
      <Center h="60vh">
        <Loader color="lotusCyan" />
      </Center>
    )

  return (
    <Box
      p={{ base: 'md', sm: 'xl' }}
      style={{ maxWidth: 2200 }}
    >
      <Text
        style={{
          fontFamily: "'DM Sans',sans-serif",
          fontSize: 22,
          fontWeight: 800,
          color: SavedColors.TextColor,
          marginBottom: 4,
        }}
      >
        Verifications
      </Text>
      <Text
        c="dimmed"
        size="sm"
        mb="xl"
      >
        Review and verify member insurance submissions
      </Text>

      <Group
        gap="sm"
        mb="md"
        wrap="wrap"
      >
        {(['pending', 'chronic', 'all'] as const).map((t) => (
          <Button
            key={t}
            size="xs"
            variant={tab === t ? 'filled' : 'light'}
            color={t === 'chronic' ? 'red' : 'lotusCyan'}
            onClick={() => setTab(t)}
            leftSection={t === 'chronic' ? <TbHeart size={12} /> : undefined}
            style={{ textTransform: 'capitalize' }}
          >
            {t === 'chronic' ? 'Chronic' : t}
          </Button>
        ))}
        <TextInput
          placeholder="Search name or card number..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          leftSection={<TbSearch size={14} />}
          size="xs"
          style={{ flex: 1, minWidth: 160 }}
          radius="xl"
        />
      </Group>

      {filtered.length === 0 ? (
        <Box
          p="xl"
          ta="center"
          style={{
            borderRadius: 12,
            border: `1.5px dashed var(--mantine-color-default-border)`,
            background: 'var(--mantine-color-default-hover)',
          }}
        >
          <TbShieldCheck
            size={32}
            color="#D1D5DB"
            style={{ marginBottom: 8 }}
          />
          <Text
            size="sm"
            c="dimmed"
          >
            No verifications found
          </Text>
        </Box>
      ) : (
        <Stack gap={8}>
          {filtered.map((ins) => (
            <Box
              key={ins.id}
              p="sm"
              style={{
                borderRadius: 10,
                border: `1.5px solid ${ins.profiles?.is_chronic ? '#fca5a5' : 'var(--mantine-color-default-border)'}`,
                background: 'var(--mantine-color-body)',
                cursor: 'pointer',
                outline: 'none',
              }}
              role="button"
              tabIndex={0}
              aria-label={`Review insurance for ${ins.profiles?.name ?? 'member'}`}
              onClick={() => navigate(`/insurance/verifications/${ins.id}`)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  navigate(`/insurance/verifications/${ins.id}`)
                }
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
                    src={
                      (ins.profiles as { photo_url?: string } | null)?.photo_url
                    }
                    color="lotusCyan"
                  >
                    <TbUser size={16} />
                  </Avatar>
                  <Box>
                    <Group gap={6}>
                      <Text
                        size="sm"
                        fw={700}
                        c={SavedColors.TextColor}
                      >
                        {ins.profiles?.name ?? 'Unknown'}
                      </Text>
                      {ins.profiles?.is_chronic && (
                        <Badge
                          size="xs"
                          color="red"
                          variant="light"
                          leftSection={<TbHeart size={10} />}
                        >
                          Chronic
                        </Badge>
                      )}
                    </Group>
                    <Text
                      size="xs"
                      c="dimmed"
                    >
                      {ins.policy_number} • {formatRelativeTime(ins.created_at)}
                    </Text>
                    {ins.status === 'verified' && ins.verified_by_name && (
                      <Group
                        gap={4}
                        mt={2}
                      >
                        <TbUserCheck
                          size={11}
                          color="#059669"
                        />
                        <Text
                          size="xs"
                          c="teal"
                        >
                          Verified by <b>{ins.verified_by_name}</b>
                        </Text>
                      </Group>
                    )}
                  </Box>
                </Group>
                <Badge
                  size="sm"
                  color={statusColor[ins.status] ?? 'gray'}
                  variant={ins.status === 'pending' ? 'filled' : 'light'}
                >
                  {ins.status}
                </Badge>
              </Group>
            </Box>
          ))}
        </Stack>
      )}
    </Box>
  )
}

// Detail / review view
export function InsuranceVerificationDetail(): JSX.Element {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { staffInfo, activeStaffProfile, openProfilePicker } =
    useInsuranceStaff()
  const actorName =
    activeStaffProfile?.display_name ?? staffInfo?.name ?? 'Staff'
  const [ins, setIns] = useState<InsuranceWithProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [approveOpen, setApproveOpen] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [processing, setProcessing] = useState(false)

  const load = async () => {
    if (!id) return
    const { data } = await supabase
      .from('insurance')
      .select('*, profiles(name,user_id,photo_url,is_chronic)')
      .eq('id', id)
      .single()
    setIns(data as InsuranceWithProfile | null)
    setLoading(false)
  }
  useEffect(() => {
    load()
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleApprove = async () => {
    if (!ins) return
    setProcessing(true)
    const { error } = await supabase.rpc('insurance_staff_approve', {
      p_insurance_id: ins.id,
      p_actor_name: actorName,
    })
    setProcessing(false)
    if (error) {
      notifications.show({
        title: 'Error',
        message: error.message,
        color: 'red',
        autoClose: 2500,
      })
      return
    }
    notifications.show({
      title: 'Approved',
      message: 'Insurance verified and customer notified.',
      color: 'lotusCyan',
      autoClose: 2000,
    })
    setApproveOpen(false)
    navigate('/insurance/verifications')
  }

  const handleReject = async () => {
    if (!ins || !rejectReason.trim()) {
      notifications.show({
        title: 'Reason required',
        message: 'Enter a rejection reason.',
        color: 'orange',
        autoClose: 2500,
      })
      return
    }
    setProcessing(true)
    const { error } = await supabase.rpc('insurance_staff_reject', {
      p_insurance_id: ins.id,
      p_reason: rejectReason.trim(),
    })
    setProcessing(false)
    if (error) {
      notifications.show({
        title: 'Error',
        message: error.message,
        color: 'red',
        autoClose: 2500,
      })
      return
    }
    notifications.show({
      title: 'Rejected',
      message: 'Customer has been notified.',
      color: 'orange',
      autoClose: 2000,
    })
    setRejectOpen(false)
    navigate('/insurance/verifications')
  }

  if (loading)
    return (
      <Center h="60vh">
        <Loader color="lotusCyan" />
      </Center>
    )
  if (!ins)
    return (
      <Center h="60vh">
        <Text c="dimmed">Record not found</Text>
      </Center>
    )

  const profile = ins.profiles as {
    name: string
    photo_url?: string
    is_chronic?: boolean
  } | null

  return (
    <Box
      p={{ base: 'md', sm: 'xl' }}
      style={{ maxWidth: 900 }}
    >
      <Group mb="xl">
        <Button
          variant="subtle"
          leftSection={<TbArrowLeft size={14} />}
          onClick={() => navigate('/insurance/verifications')}
          color="gray"
          size="xs"
        >
          Back
        </Button>
      </Group>

      <Group mb="lg">
        <Avatar
          src={profile?.photo_url}
          size={56}
          radius="xl"
          color="lotusCyan"
        >
          <TbUser size={24} />
        </Avatar>
        <Box>
          <Group
            gap={8}
            mb={4}
          >
            <Text
              style={{
                fontFamily: "'DM Sans',sans-serif",
                fontSize: 20,
                fontWeight: 800,
                color: SavedColors.TextColor,
              }}
            >
              {profile?.name}
            </Text>
            {profile?.is_chronic && (
              <Badge
                color="red"
                variant="light"
                leftSection={<TbHeart size={12} />}
              >
                Chronic Patient
              </Badge>
            )}
          </Group>
          <Badge
            color={statusColor[ins.status] ?? 'gray'}
            variant={ins.status === 'pending' ? 'filled' : 'light'}
          >
            {ins.status}
          </Badge>
        </Box>
      </Group>

      {profile?.is_chronic && (
        <Box
          p="sm"
          mb="lg"
          style={{
            background: '#fff5f5',
            borderRadius: 8,
            border: '1px solid #fca5a5',
          }}
        >
          <Group gap={6}>
            <TbHeart
              size={14}
              color="#EF4444"
            />
            <Text
              size="sm"
              fw={600}
              c="red.7"
            >
              This member is a chronic patient
            </Text>
          </Group>
          <Text
            size="xs"
            c="dimmed"
            mt={4}
          >
            Chronic patients require regular medication refills. Verify their
            insurance carefully.
          </Text>
        </Box>
      )}

      <SimpleGrid
        cols={{ base: 1, sm: 2 }}
        spacing="sm"
        mb="lg"
      >
        {[
          { label: 'Provider', value: ins.provider },
          { label: 'Scheme', value: ins.scheme_name },
          { label: 'Card Number', value: ins.policy_number },
          { label: 'Member Type', value: ins.member_type },
          { label: 'Gender', value: ins.gender },
          { label: 'Submitted', value: formatRelativeTime(ins.created_at) },
          ...(ins.expiry_date
            ? [{ label: 'Expiry Date', value: ins.expiry_date }]
            : []),
          ...(ins.verified_by_name
            ? [{ label: 'Verified By', value: ins.verified_by_name }]
            : []),
          ...(ins.verified_at
            ? [
                {
                  label: 'Verified At',
                  value: formatRelativeTime(ins.verified_at),
                },
              ]
            : []),
        ].map(({ label, value }) =>
          value ? (
            <Box
              key={label}
              p="sm"
              style={{
                background: 'var(--mantine-color-default-hover)',
                borderRadius: 8,
                border: `1px solid var(--mantine-color-default-border)`,
              }}
            >
              <Text
                size="xs"
                c="dimmed"
                mb={2}
              >
                {label}
              </Text>
              <Text
                size="sm"
                fw={600}
              >
                {value}
              </Text>
            </Box>
          ) : null,
        )}
      </SimpleGrid>

      {ins.rejection_reason && (
        <Box
          p="sm"
          mb="lg"
          style={{
            background: '#fef2f2',
            borderRadius: 8,
            border: '1px solid #fca5a5',
          }}
        >
          <Text
            size="xs"
            fw={600}
            c="red"
            mb={2}
          >
            Previous rejection reason:
          </Text>
          <Text
            size="sm"
            c="#374151"
          >
            {ins.rejection_reason}
          </Text>
        </Box>
      )}

      {ins.status === 'verified' && ins.verified_by_name && (
        <Box
          p="sm"
          mb="lg"
          style={{
            background: '#f0fdf4',
            borderRadius: 8,
            border: '1px solid #86efac',
          }}
        >
          <Group gap={6}>
            <TbUserCheck
              size={14}
              color="#16a34a"
            />
            <Text
              size="sm"
              fw={600}
              c="green.7"
            >
              Verified by {ins.verified_by_name}
              {ins.verified_at
                ? ` · ${formatRelativeTime(ins.verified_at)}`
                : ''}
            </Text>
          </Group>
        </Box>
      )}

      {ins.status === 'pending' && (
        <Group gap="sm">
          <Button
            color="red"
            variant="outline"
            leftSection={<TbShieldX size={15} />}
            onClick={() => setRejectOpen(true)}
          >
            Reject
          </Button>
          <Button
            color="lotusCyan"
            leftSection={<TbShieldCheck size={15} />}
            onClick={() => setApproveOpen(true)}
          >
            Approve
          </Button>
        </Group>
      )}

      <Modal
        opened={approveOpen}
        onClose={() => {
          if (!processing) setApproveOpen(false)
        }}
        title={<Text fw={700}>Confirm Approval</Text>}
        centered
        size="sm"
        radius="lg"
      >
        <Stack gap="md">
          {/* Actor chip */}
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
              <TbUserCheck
                size={14}
                color="#0891b2"
              />
              <Text
                size="xs"
                c="#0891b2"
                fw={600}
              >
                Verifying as: <b>{actorName}</b>
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
          <Text
            size="sm"
            c="dimmed"
            lh={1.6}
          >
            Approve insurance for <b>{ins.provider}</b>
            {ins.scheme_name ? (
              <>
                {' '}
                — <b>{ins.scheme_name}</b>
              </>
            ) : (
              ''
            )}
            ? The expiry date will be set by the scheme.
          </Text>
          <Group
            justify="flex-end"
            gap="sm"
          >
            <Button
              variant="default"
              onClick={() => setApproveOpen(false)}
              disabled={processing}
            >
              Cancel
            </Button>
            <Button
              color="lotusCyan"
              loading={processing}
              onClick={handleApprove}
              leftSection={<TbShieldCheck size={14} />}
            >
              Yes, Approve
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={rejectOpen}
        onClose={() => setRejectOpen(false)}
        title={<Text fw={700}>Reject Insurance</Text>}
        centered
        radius="lg"
      >
        <Stack gap="md">
          <Text
            size="sm"
            c="dimmed"
          >
            Provide a reason. The customer will see this message.
          </Text>
          <Textarea
            placeholder="e.g. Card number not found in our system."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            minRows={3}
            autosize
          />
          <Group justify="flex-end">
            <Button
              variant="default"
              onClick={() => setRejectOpen(false)}
            >
              Cancel
            </Button>
            <Button
              color="red"
              loading={processing}
              onClick={handleReject}
              disabled={!rejectReason.trim()}
            >
              Confirm Rejection
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Box>
  )
}

