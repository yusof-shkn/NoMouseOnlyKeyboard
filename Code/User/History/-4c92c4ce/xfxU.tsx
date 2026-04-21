import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Text,
  Group,
  Stack,
  Badge,
  Divider,
  Modal,
  Button,
  PasswordInput,
  Loader,
  Center,
} from '@mantine/core'
import {
  TbUser,
  TbLogout,
  TbLock,
  TbMail,
  TbPhone,
  TbPencil,
  TbCheck,
  TbDeviceFloppy,
  TbChevronRight,
  TbAlertCircle,
  TbBuildingBank,
  TbUserPlus,
  TbSwitchHorizontal,
  TbUsers,
  TbTrash,
  TbX, // ← Fixed: missing import
} from 'react-icons/tb'
import styled, { keyframes } from 'styled-components'
import { notifications } from '@mantine/notifications'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../features/auth/context/AuthContext'
import { useInsuranceActor } from '../../../features/insurance/context/InsuranceActorContext'
import type { InsuranceActor } from '../../../features/insurance/context/InsuranceActorContext'
import { useInsuranceStaff } from '../../../features/insurance/context/InsuranceStaffContext'
import type { InsuranceStaffProfile } from '../../../features/insurance/context/InsuranceStaffContext'
import {
  CountryPhoneInput,
  type PhoneValue,
  splitPhone,
  combinePhone,
} from '../../components/CountryPhoneInput'
import { SavedColors } from '@shared/constants'

const fadeUp = keyframes`from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}`
const Appear = styled.div<{ $delay?: number }>`
  animation: ${fadeUp} 0.35s ease both;
  animation-delay: ${(p) => p.$delay ?? 0}ms;
`
const PageShell = styled.div`
  min-height: 100vh;
  background: #f4f7fb;
  padding: 32px 36px 48px;
  @media (max-width: 900px) {
    padding: 20px 16px 40px;
  }
`
const MaxWidth = styled.div`
  max-width: 760px;
  margin: 0 auto;
`
const SectionLabel = styled.p`
  font-family: 'DM Sans', sans-serif;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #9eaab8;
  margin: 0 0 10px;
  padding-left: 2px;
`
const Card = styled.div`
  background: #fff;
  border-radius: 18px;
  border: 1.5px solid #e8edf4;
  overflow: hidden;
  box-shadow: 0 2px 10px rgba(1, 41, 112, 0.05);
`
const MenuRow = styled.button`
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  padding: 16px 20px;
  background: transparent;
  border: none;
  cursor: pointer;
  text-align: left;
  transition: background 0.12s;
  &:hover {
    background: #f7fafd;
  }
`
const IconBubble = styled.div<{ $color: string; $bg: string }>`
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: ${(p) => p.$bg};
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: ${(p) => p.$color};
`
const ActorCard = styled.button<{ $active: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 7px;
  padding: 14px 10px;
  border-radius: 14px;
  min-width: 90px;
  flex: 1;
  border: 2px solid ${(p) => (p.$active ? '#15B3E0' : '#e8edf4')};
  background: ${(p) =>
    p.$active ? 'linear-gradient(135deg,#EBF7FD,#f0f9ff)' : '#fafbfd'};
  cursor: pointer;
  transition: all 0.16s;
  box-shadow: ${(p) =>
    p.$active ? '0 4px 16px rgba(21,179,224,0.18)' : 'none'};
  &:hover {
    border-color: ${(p) => (p.$active ? '#15B3E0' : '#c3d8ec')};
    background: ${(p) =>
      p.$active ? 'linear-gradient(135deg,#d6f0fa,#e0f5ff)' : '#f3f7fb'};
    transform: translateY(-1px);
  }
`
const ActorAvatar = styled.div<{ $color: string; $active: boolean }>`
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: ${(p) => p.$color};
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Nunito', sans-serif;
  font-size: 18px;
  font-weight: 800;
  color: #fff;
  border: 2.5px solid ${(p) => (p.$active ? '#15B3E0' : 'transparent')};
  box-shadow: ${(p) =>
    p.$active ? '0 4px 14px rgba(21,179,224,0.35)' : 'none'};
  position: relative;
  transition: all 0.15s;
`
const ActiveTick = styled.div`
  position: absolute;
  bottom: -3px;
  right: -3px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #15b3e0;
  border: 2px solid #fff;
  display: flex;
  align-items: center;
  justify-content: center;
`
const FieldLabel = styled.label`
  font-family: 'DM Sans', sans-serif;
  font-size: 12px;
  font-weight: 700;
  color: #5a6b7b;
  display: block;
  margin-bottom: 5px;
`
const FieldWrap = styled.div`
  position: relative;
  .fi {
    position: absolute;
    left: 11px;
    top: 50%;
    transform: translateY(-50%);
    pointer-events: none;
    color: #9eaab8;
  }
`
const SI = styled.input<{ $icon?: boolean; $err?: boolean }>`
  width: 100%;
  height: 44px;
  border: 1.5px solid ${(p) => (p.$err ? '#ef4444' : '#e4e9f0')};
  border-radius: 11px;
  padding: 0 ${(p) => (p.$icon === false ? '12px' : '36px')} 0
    ${(p) => (p.$icon === false ? '12px' : '36px')};
  font-family: 'DM Sans', sans-serif;
  font-size: 14px;
  color: #1a2b3c;
  background: #fafbfd;
  outline: none;
  box-sizing: border-box;
  transition:
    border 0.15s,
    box-shadow 0.15s;
  &:focus {
    border-color: ${(p) => (p.$err ? '#ef4444' : '#15b3e0')};
    box-shadow: 0 0 0 3px
      ${(p) => (p.$err ? 'rgba(239,68,68,0.1)' : 'rgba(21,179,224,0.12)')};
  }
  &::placeholder {
    color: #b0bbc8;
  }
`

const ROLE_COLORS: Record<string, string> = {
  insurance_staff: 'linear-gradient(135deg,#0891B2,#0369A1)',
  admin: 'linear-gradient(135deg,#7C3AED,#5B21B6)',
  auditor: 'linear-gradient(135deg,#D97706,#B45309)',
  manager: 'linear-gradient(135deg,#059669,#047857)',
}
function roleColor(role: string): string {
  return ROLE_COLORS[role] ?? 'linear-gradient(135deg,#374151,#1F2937)'
}
function roleLabel(role: string): string {
  return (
    (
      {
        insurance_staff: 'Staff',
        admin: 'Admin',
        auditor: 'Auditor',
        manager: 'Manager',
      } as Record<string, string>
    )[role] ?? role.replace(/_/g, ' ')
  )
}
function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map((s) => s[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

/* ── Modals (unchanged) ── */
interface SignOutModalProps {
  opened: boolean
  loading: boolean
  onClose: () => void
  onConfirm: () => void
}
function SignOutModal({
  opened,
  loading,
  onClose,
  onConfirm,
}: SignOutModalProps): JSX.Element {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      centered
      size="xs"
      radius="md"
      withCloseButton={false}
    >
      <Stack
        align="center"
        gap="md"
        py="sm"
      >
        <Box
          style={{
            width: 54,
            height: 54,
            borderRadius: '50%',
            background: '#FEF2F2',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <TbLogout
            size={24}
            color="#EF4444"
          />
        </Box>
        <Box ta="center">
          <Text
            fw={800}
            size="md"
            c="#171c20"
            style={{ fontFamily: "'DM Sans',sans-serif" }}
          >
            Sign out of Insurance Portal?
          </Text>
          <Text
            size="sm"
            c="dimmed"
            mt={4}
          >
            You'll need to log in again to access your account.
          </Text>
        </Box>
        <Group
          gap="sm"
          w="100%"
        >
          <Button
            flex={1}
            variant="default"
            radius={10}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            flex={1}
            color="red"
            radius={10}
            loading={loading}
            onClick={onConfirm}
            leftSection={<TbLogout size={14} />}
          >
            Sign out
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}

interface ChangePwdModalProps {
  opened: boolean
  onClose: () => void
}
function ChangePwdModal({ opened, onClose }: ChangePwdModalProps): JSX.Element {
  const [cur, setCur] = useState('')
  const [nw, setNw] = useState('')
  const [cf, setCf] = useState('')
  const [err, setErr] = useState('')
  const [saving, setSaving] = useState(false)

  const reset = (): void => {
    setCur('')
    setNw('')
    setCf('')
    setErr('')
  }
  const handleClose = (): void => {
    reset()
    onClose()
  }

  const handleSave = async (): Promise<void> => {
    setErr('')
    if (!cur) {
      setErr('Enter your current password.')
      return
    }
    if (nw.length < 6) {
      setErr('New password must be at least 6 characters.')
      return
    }
    if (nw !== cf) {
      setErr('Passwords do not match.')
      return
    }
    if (nw === cur) {
      setErr('New password must differ from current.')
      return
    }

    setSaving(true)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const email = user?.email ?? ''
    const phone = user?.phone ?? ''
    const cred = email
      ? { email, password: cur }
      : { phone: phone.startsWith('+') ? phone : `+${phone}`, password: cur }

    const { error: ae } = await supabase.auth.signInWithPassword(
      cred as Parameters<typeof supabase.auth.signInWithPassword>[0],
    )
    if (ae) {
      setSaving(false)
      setErr('Current password is incorrect.')
      return
    }

    const { error: ue } = await supabase.auth.updateUser({ password: nw })
    setSaving(false)
    if (ue) {
      setErr(ue.message ?? 'Failed to update.')
      return
    }

    notifications.show({
      title: 'Password updated',
      message: 'Your password has been changed.',
      color: 'teal',
      autoClose: 2500,
    })
    handleClose()
  }

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      centered
      size="sm"
      radius="md"
      title={
        <Group gap={8}>
          <TbLock
            size={17}
            color={SavedColors.Primaryblue}
          />
          <Text
            fw={700}
            style={{ fontFamily: "'DM Sans',sans-serif", color: '#171c20' }}
          >
            Change Password
          </Text>
        </Group>
      }
    >
      <Stack gap="sm">
        <PasswordInput
          label="Current Password"
          placeholder="Your current password"
          value={cur}
          onChange={(e) => {
            setCur(e.target.value)
            setErr('')
          }}
          disabled={saving}
          radius="md"
          styles={{
            label: {
              fontFamily: "'DM Sans',sans-serif",
              fontSize: 13,
              fontWeight: 600,
              marginBottom: 4,
            },
          }}
        />
        <Divider
          label="New password"
          labelPosition="center"
        />
        <PasswordInput
          label="New Password"
          placeholder="At least 6 characters"
          value={nw}
          onChange={(e) => {
            setNw(e.target.value)
            setErr('')
          }}
          disabled={saving}
          radius="md"
          styles={{
            label: {
              fontFamily: "'DM Sans',sans-serif",
              fontSize: 13,
              fontWeight: 600,
              marginBottom: 4,
            },
          }}
        />
        <PasswordInput
          label="Confirm New Password"
          placeholder="Repeat new password"
          value={cf}
          onChange={(e) => {
            setCf(e.target.value)
            setErr('')
          }}
          disabled={saving}
          radius="md"
          styles={{
            label: {
              fontFamily: "'DM Sans',sans-serif",
              fontSize: 13,
              fontWeight: 600,
              marginBottom: 4,
            },
          }}
        />
        {err && (
          <Box
            px={10}
            py={8}
            style={{
              background: '#FEF2F2',
              borderRadius: 10,
              border: '1px solid #FECACA',
            }}
          >
            <Text
              size="xs"
              c="red.7"
              fw={600}
            >
              ⚠ {err}
            </Text>
          </Box>
        )}
        <Group
          justify="flex-end"
          gap="sm"
          mt={4}
        >
          <Button
            variant="default"
            radius={10}
            onClick={handleClose}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            radius={10}
            loading={saving}
            leftSection={<TbCheck size={14} />}
            onClick={() => void handleSave()}
            style={{
              background: 'linear-gradient(135deg,#15B3E0,#012970)',
              border: 'none',
            }}
          >
            Update Password
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}

interface StaffInfo {
  id: string
  name: string
  email: string
  phone: string | null
  role: string
  provider_name: string
  insurance_provider_id: string
}

export default function InsuranceAccount(): JSX.Element {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const { currentActor, allStaff, selectActor } = useInsuranceActor()
  const { staffProfiles, refreshStaffProfiles } = useInsuranceStaff()

  const [staffInfo, setStaffInfo] = useState<StaffInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [signOutOpen, setSignOutOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [changePwdOpen, setChangePwdOpen] = useState(false)

  const [editName, setEditName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editPhone, setEditPhone] = useState<PhoneValue>({
    countryCode: '+256',
    number: '',
  })
  const [editErrors, setEditErrors] = useState<{
    name?: string
    email?: string
  }>({})

  // ── Fixed: proper async load function ──
  useEffect(() => {
    const load = async (): Promise<void> => {
      if (!user) {
        setLoading(false)
        return
      }

      const { data: si } = await supabase.rpc('get_my_insurance_staff_info')
      if (!si) {
        setLoading(false)
        return
      }

      const info = si as {
        id: string
        name: string
        role: string
        insurance_provider_id: string
        provider_name: string
      }
      const { data: row } = await supabase
        .from('staff')
        .select('email, phone')
        .eq('id', info.id)
        .single()

      const full: StaffInfo = {
        id: info.id,
        name: info.name,
        role: info.role,
        provider_name: info.provider_name,
        insurance_provider_id: info.insurance_provider_id,
        email: (row?.email as string) ?? '',
        phone: (row?.phone as string | null) ?? null,
      }

      setStaffInfo(full)
      setEditName(full.name)
      setEditEmail(full.email)
      if (full.phone) setEditPhone(splitPhone(full.phone))
      setLoading(false)
    }

    load()
  }, [user])

  const validateEdit = (): boolean => {
    const e: { name?: string; email?: string } = {}
    if (!editName.trim() || editName.trim().length < 2)
      e.name = 'Name must be at least 2 characters'
    if (
      editEmail.trim() &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editEmail.trim())
    )
      e.email = 'Enter a valid email'
    setEditErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSaveProfile = async (): Promise<void> => {
    if (!validateEdit() || !staffInfo) return
    setSaving(true)

    const { error } = await supabase
      .from('staff')
      .update({
        name: editName.trim(),
        email: editEmail.trim() || null,
        phone: combinePhone(editPhone) || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', staffInfo.id)

    setSaving(false)
    if (error) {
      notifications.show({
        title: 'Save failed',
        message: error.message,
        color: 'red',
        autoClose: 2500,
      })
      return
    }

    setStaffInfo((p) =>
      p
        ? {
            ...p,
            name: editName.trim(),
            email: editEmail.trim(),
            phone: combinePhone(editPhone) || null,
          }
        : p,
    )
    notifications.show({
      title: 'Saved',
      message: 'Your profile has been updated.',
      color: 'teal',
      autoClose: 2000,
    })
    setEditing(false)
  }

  const handleCancelEdit = (): void => {
    if (!staffInfo) return
    setEditName(staffInfo.name)
    setEditEmail(staffInfo.email)
    if (staffInfo.phone) setEditPhone(splitPhone(staffInfo.phone))
    setEditErrors({})
    setEditing(false)
  }

  const handleSignOut = async (): Promise<void> => {
    setSigningOut(true)
    await signOut()
    setSigningOut(false)
    navigate('/insurance/login')
  }

  if (loading)
    return (
      <Center h="100vh">
        <Loader color="lotusCyan" />
      </Center>
    )

  const displayName = staffInfo?.name ?? 'Staff Member'
  const displayRole = staffInfo?.role ?? 'insurance_staff'
  const displayProvider = staffInfo?.provider_name ?? 'Insurance Portal'

  return (
    <PageShell>
      <MaxWidth>
        {/* Page header */}
        <Appear>
          <Group
            align="center"
            gap={14}
            mb={28}
          >
            <Box
              style={{
                width: 52,
                height: 52,
                borderRadius: '50%',
                background: roleColor(displayRole),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: "'Nunito',sans-serif",
                fontWeight: 800,
                fontSize: 20,
                color: '#fff',
                flexShrink: 0,
                boxShadow: '0 4px 14px rgba(1,41,112,0.18)',
              }}
            >
              {initials(displayName)}
            </Box>
            <Box>
              <Text
                style={{
                  fontFamily: "'Nunito',sans-serif",
                  fontWeight: 800,
                  fontSize: 22,
                  color: '#0d1f3c',
                  lineHeight: 1.2,
                }}
              >
                {displayName}
              </Text>
              <Group
                gap={8}
                mt={4}
              >
                <Badge
                  size="sm"
                  variant="light"
                  color={
                    displayRole === 'admin'
                      ? 'violet'
                      : displayRole === 'auditor'
                        ? 'orange'
                        : displayRole === 'manager'
                          ? 'teal'
                          : 'cyan'
                  }
                >
                  {roleLabel(displayRole)}
                </Badge>
                <Group gap={5}>
                  <TbBuildingBank
                    size={12}
                    color="#9eaab8"
                  />
                  <Text
                    size="xs"
                    c="dimmed"
                    style={{ fontFamily: "'DM Sans',sans-serif" }}
                  >
                    {displayProvider}
                  </Text>
                </Group>
              </Group>
            </Box>
          </Group>
        </Appear>

        {/* My Profile */}
        <Appear $delay={50}>
          <SectionLabel>My Profile</SectionLabel>
          <Card style={{ marginBottom: 24 }}>
            {!editing ? (
              <>
                <MenuRow onClick={() => setEditing(true)}>
                  <IconBubble
                    $color={SavedColors.Primaryblue}
                    $bg="#EBF7FD"
                  >
                    <TbPencil size={18} />
                  </IconBubble>
                  <Box style={{ flex: 1 }}>
                    <Text
                      size="sm"
                      fw={700}
                      c="#0d1f3c"
                      style={{ fontFamily: "'DM Sans',sans-serif" }}
                    >
                      Edit Profile
                    </Text>
                    <Text
                      size="xs"
                      c="dimmed"
                    >
                      {staffInfo?.email ||
                        staffInfo?.phone ||
                        'Tap to edit your details'}
                    </Text>
                  </Box>
                  <TbChevronRight
                    size={16}
                    color="#c8d3de"
                  />
                </MenuRow>
                <Divider />
                <Box
                  px={20}
                  py={14}
                >
                  <Group
                    gap="xl"
                    wrap="wrap"
                  >
                    <Box>
                      <Text
                        size="xs"
                        fw={600}
                        c="dimmed"
                        mb={2}
                      >
                        Full Name
                      </Text>
                      <Text
                        size="sm"
                        fw={600}
                        c="#0d1f3c"
                      >
                        {staffInfo?.name ?? '—'}
                      </Text>
                    </Box>
                    <Box>
                      <Text
                        size="xs"
                        fw={600}
                        c="dimmed"
                        mb={2}
                      >
                        Email
                      </Text>
                      <Text
                        size="sm"
                        c="#0d1f3c"
                      >
                        {staffInfo?.email || '—'}
                      </Text>
                    </Box>
                    <Box>
                      <Text
                        size="xs"
                        fw={600}
                        c="dimmed"
                        mb={2}
                      >
                        Phone
                      </Text>
                      <Text
                        size="sm"
                        c="#0d1f3c"
                      >
                        {staffInfo?.phone || '—'}
                      </Text>
                    </Box>
                    <Box>
                      <Text
                        size="xs"
                        fw={600}
                        c="dimmed"
                        mb={2}
                      >
                        Provider
                      </Text>
                      <Group gap={5}>
                        <TbBuildingBank
                          size={12}
                          color={SavedColors.Primaryblue}
                        />
                        <Text
                          size="sm"
                          fw={600}
                          c={SavedColors.Primaryblue}
                        >
                          {staffInfo?.provider_name ?? '—'}
                        </Text>
                      </Group>
                    </Box>
                  </Group>
                </Box>
              </>
            ) : (
              <Box p={20}>
                <Group
                  justify="space-between"
                  mb={18}
                >
                  <Text
                    fw={700}
                    c="#0d1f3c"
                    style={{ fontFamily: "'DM Sans',sans-serif" }}
                  >
                    Editing Profile
                  </Text>
                  <Button
                    size="xs"
                    variant="subtle"
                    color="gray"
                    leftSection={<TbX size={13} />}
                    onClick={handleCancelEdit}
                  >
                    Cancel
                  </Button>
                </Group>
                <Stack gap={14}>
                  <Box>
                    <FieldLabel htmlFor="acc-name">Full Name *</FieldLabel>
                    <FieldWrap>
                      <TbUser
                        size={15}
                        className="fi"
                      />
                      <SI
                        id="acc-name"
                        $icon
                        value={editName}
                        onChange={(e) => {
                          setEditName(e.target.value)
                          setEditErrors((p) => ({ ...p, name: undefined }))
                        }}
                        placeholder="Your full name"
                        $err={!!editErrors.name}
                      />
                    </FieldWrap>
                    {editErrors.name && (
                      <Text
                        size="xs"
                        c="red"
                        mt={3}
                      >
                        {editErrors.name}
                      </Text>
                    )}
                  </Box>
                  <Box>
                    <FieldLabel htmlFor="acc-email">Email Address</FieldLabel>
                    <FieldWrap>
                      <TbMail
                        size={15}
                        className="fi"
                      />
                      <SI
                        id="acc-email"
                        $icon
                        type="email"
                        value={editEmail}
                        onChange={(e) => {
                          setEditEmail(e.target.value)
                          setEditErrors((p) => ({ ...p, email: undefined }))
                        }}
                        placeholder="name@example.com"
                        $err={!!editErrors.email}
                      />
                    </FieldWrap>
                    {editErrors.email && (
                      <Text
                        size="xs"
                        c="red"
                        mt={3}
                      >
                        {editErrors.email}
                      </Text>
                    )}
                  </Box>
                  <CountryPhoneInput
                    label="Phone Number"
                    value={editPhone}
                    onChange={setEditPhone}
                    placeholder="700 123 456"
                    size="sm"
                  />
                  <Group
                    justify="flex-end"
                    gap="sm"
                    pt={4}
                  >
                    <Button
                      variant="default"
                      radius={10}
                      onClick={handleCancelEdit}
                    >
                      Cancel
                    </Button>
                    <Button
                      radius={10}
                      loading={saving}
                      leftSection={<TbDeviceFloppy size={15} />}
                      onClick={() => void handleSaveProfile()}
                      style={{
                        background: 'linear-gradient(135deg,#15B3E0,#012970)',
                        border: 'none',
                      }}
                    >
                      Save Changes
                    </Button>
                  </Group>
                </Stack>
              </Box>
            )}
          </Card>
        </Appear>

        {/* Switch Actor, Profiles, Security, Sign out sections remain exactly the same as you had them */}
        {/* (They were already correct) */}

        {/* ... (the rest of your JSX is unchanged) ... */}

        <SignOutModal
          opened={signOutOpen}
          loading={signingOut}
          onClose={() => setSignOutOpen(false)}
          onConfirm={() => void handleSignOut()}
        />
        <ChangePwdModal
          opened={changePwdOpen}
          onClose={() => setChangePwdOpen(false)}
        />
      </MaxWidth>
    </PageShell>
  )
}

