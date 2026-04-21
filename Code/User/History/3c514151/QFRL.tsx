import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Avatar, Box, Text, Stack, Group, Modal, Button, Divider,
  Badge,
} from '@mantine/core'
import {
  TbUser, TbLogout, TbChevronRight,
  TbShieldCheck, TbShieldOff, TbShieldHalf, TbShield,
  TbHeart, TbPencil, TbUsersGroup,
  TbAlertCircle, TbShieldBolt,
} from 'react-icons/tb'
import styled, { keyframes } from 'styled-components'
import { SavedColors } from '@shared/constants'
import { useAuth } from '../../../features/auth/context/AuthContext'

// ─── Animations ──────────────────────────────────────────────────────────────
const fadeUp = keyframes`from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}`
const Appear = styled.div<{ $delay?: number }>`
  animation: \${fadeUp} 0.35s ease both;
  animation-delay: \${p => p.\$delay ?? 0}ms;
`

// ─── Styled ───────────────────────────────────────────────────────────────────
const PageShell = styled.div`
  min-height: calc(100vh - 64px);
  background: ${SavedColors.bgWhite};
  display: flex;
  flex-direction: column;
`

const HeroSection = styled.div`
  background: linear-gradient(160deg, #012970 0%, #0c3d8a 60%, #15B3E0 100%);
  padding: 28px 20px 60px;
  position: relative;
  overflow: hidden;
  &::after {
    content: '';
    position: absolute;
    bottom: -1px; left: 0; right: 0;
    height: 32px;
    background: ${SavedColors.bgWhite};
    border-radius: 28px 28px 0 0;
  }
`

const AvatarRing = styled.div`
  position: relative;
  display: inline-block;
`

const AvatarChangeBtn = styled.button`
  position: absolute;
  bottom: 2px; right: 2px;
  width: 30px; height: 30px;
  border-radius: 50%;
  border: 2px solid #fff;
  background: ${SavedColors.Primaryblue};
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0,0,0,0.2);
  transition: transform 0.15s;
  &:hover { transform: scale(1.1); }
`

const MenuRow = styled.button`
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  padding: 15px 20px;
  border: none;
  background: #fff;
  cursor: pointer;
  transition: background 0.12s;
  text-align: left;
  &:hover { background: #f8fbfe; }
  &:active { background: #f0f7fc; }
`

const IconBubble = styled.div<{ $color: string; $bg: string }>`
  width: 38px; height: 38px;
  border-radius: 11px;
  background: \${p => p.\$bg};
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  color: \${p => p.\$color};
\`

const SectionCard = styled.div\`
  background: #fff;
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid \${SavedColors.DemWhite};
  box-shadow: 0 2px 8px rgba(1,41,112,0.04);
\`

const SwitchProfileButton = styled.button\`
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 16px 20px;
  border-radius: 16px;
  border: 1.5px solid \${SavedColors.Primaryblue};
  background: linear-gradient(135deg, #EBF7FD 0%, #f0f9ff 100%);
  cursor: pointer;
  transition: all 0.18s;
  box-shadow: 0 2px 8px rgba(1,41,112,0.06);
  &:hover {
    background: linear-gradient(135deg, #d6f0fa 0%, #e0f5ff 100%);
    box-shadow: 0 4px 16px rgba(1,41,112,0.14);
    transform: translateY(-1px);
  }
  &:active { transform: translateY(0); }
\`

const insStatusMap: Record<string, { color: string; icon: React.ComponentType<{ size?: number }>; label: string; bg: string }> = {
  verified: { color: '#12B76A', icon: TbShieldCheck, label: 'Verified', bg: '#ECFDF5' },
  pending:  { color: '#F59F00', icon: TbShield,      label: 'Pending',  bg: '#FFFBEB' },
  rejected: { color: '#EF4444', icon: TbShieldOff,   label: 'Rejected', bg: '#FEF2F2' },
  expired:  { color: '#9CA3AF', icon: TbShieldHalf,  label: 'Expired',  bg: '#F3F4F6' },
  none:     { color: '#9CA3AF', icon: TbShieldHalf,  label: 'No insurance', bg: '#F3F4F6' },
}

// ─── Chronic info modal ───────────────────────────────────────────────────────
interface ChronicModalProps {
  opened: boolean
  onClose: () => void
  profile: {
    name: string
    is_chronic?: boolean
    chronic_conditions?: string | null
    current_medications?: string | null
    medication_duration?: string | null
    last_refill_date?: string | null
  }
}

function ChronicModal({ opened, onClose, profile }: ChronicModalProps): JSX.Element {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Medical Information"
      centered size="sm" radius="md"
      styles={{ title: { fontFamily: "'DM Sans',sans-serif", fontWeight: 700, color: '#1A2B3C' } }}
    >
      <Stack gap="sm">
        <Group gap={8}>
          <TbHeart size={16} color="#EF4444" />
          <Text size="sm" fw={700} c="#1A2B3C" style={{ fontFamily: "'DM Sans',sans-serif" }}>
            {profile.name}'s Health Info
          </Text>
        </Group>
        <Box p="sm" style={{ background: '#FEF2F2', borderRadius: 10, border: '1px solid #FECACA' }}>
          <Text size="xs" fw={600} c="red.7" mb={4}>Chronic Patient</Text>
          {profile.chronic_conditions && <Text size="sm" c="#374151">Conditions: {profile.chronic_conditions}</Text>}
          {profile.current_medications && <Text size="sm" c="#374151" mt={4}>Medications: {profile.current_medications}</Text>}
          {profile.medication_duration && <Text size="sm" c="#374151" mt={4}>Duration: {profile.medication_duration}</Text>}
          {profile.last_refill_date && <Text size="sm" c="#374151" mt={4}>Last refill: {profile.last_refill_date}</Text>}
        </Box>
        <Button variant="light" color="gray" onClick={onClose} radius={8} size="sm">Close</Button>
      </Stack>
    </Modal>
  )
}

// ─── Sign-out confirm modal ───────────────────────────────────────────────────
interface SignOutModalProps {
  opened: boolean
  loading: boolean
  onClose: () => void
  onConfirm: () => void
}
function SignOutModal({ opened, loading, onClose, onConfirm }: SignOutModalProps): JSX.Element {
  return (
    <Modal opened={opened} onClose={onClose} centered size="xs" radius="md" withCloseButton={false}>
      <Stack align="center" gap="md" py="xs">
        <Box style={{ width: 52, height: 52, borderRadius: '50%', background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <TbLogout size={24} color="#EF4444" />
        </Box>
        <Box ta="center">
          <Text fw={700} size="md" c="#1A2B3C" style={{ fontFamily: "'DM Sans',sans-serif" }}>Sign out?</Text>
          <Text size="sm" c="dimmed" mt={4}>You'll need to log in again to access your account.</Text>
        </Box>
        <Group gap="sm" w="100%">
          <Button flex={1} variant="default" radius={8} onClick={onClose}>Cancel</Button>
          <Button flex={1} color="red" radius={8} loading={loading} onClick={onConfirm}
            leftSection={<TbLogout size={15} />}>Sign out</Button>
        </Group>
      </Stack>
    </Modal>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function ProfilePage(): JSX.Element {
  const navigate = useNavigate()
  const { user, profiles, selectedProfile, openProfilePicker, signOut } = useAuth()

  const mainProfile = profiles.find(p => p.is_main_account) ?? profiles[0]
  const active = selectedProfile ?? mainProfile

  const [signOutOpen, setSignOutOpen] = useState(false)
  const [signingOut, setSigningOut]   = useState(false)
  const [chronicOpen, setChronicOpen] = useState(false)

  const insStatus = (active?.insurance as { status?: string } | null)?.status ?? 'none'
  const ins = insStatusMap[insStatus] ?? insStatusMap.none
  const InsIcon = ins.icon

  const handleSignOut = async (): Promise<void> => {
    setSigningOut(true)
    await signOut()
    setSigningOut(false)
    setSignOutOpen(false)
  }

  return (
    <PageShell>
      {/* ── Hero banner ── */}
      <HeroSection>
        <Appear>
          <Stack align="center" gap={10}>
            <AvatarRing>
              <Avatar
                src={active?.photo_url ?? null}
                size={88} radius={88} color="lotusCyan"
                style={{ border: '3px solid rgba(255,255,255,0.6)', boxShadow: '0 4px 20px rgba(0,0,0,0.25)' }}
              >
                <TbUser size={36} />
              </Avatar>
              <AvatarChangeBtn onClick={() => navigate('/personal-info')}>
                <TbPencil size={13} color="#fff" />
              </AvatarChangeBtn>
            </AvatarRing>

            <Box ta="center">
              <Text style={{ fontFamily: "'Nunito',sans-serif", fontWeight: 800, fontSize: 20, color: '#fff', lineHeight: 1.2 }}>
                {active?.name ?? 'My Profile'}
              </Text>
              <Text size="sm" style={{ color: 'rgba(255,255,255,0.65)', fontFamily: "'DM Sans',sans-serif" }} mt={2}>
                {user?.email ?? active?.phone ?? ''}
              </Text>
              <Badge mt={8} size="sm" variant="filled"
                style={{ background: ins.bg, color: ins.color, border: \`1px solid \${ins.color}30\` }}
                leftSection={<InsIcon size={11} />}>
                Insurance · {ins.label}
              </Badge>
            </Box>
          </Stack>
        </Appear>
      </HeroSection>

      {/* ── Content ── */}
      <Box px={16} pb={24} style={{ flex: 1 }}>

        {/* ── Manage section ── */}
        <Appear \$delay={80}>
          <SectionCard>
            <MenuRow onClick={() => navigate('/personal-info')}>
              <IconBubble \$color={SavedColors.Primaryblue} \$bg="#EBF7FD">
                <TbPencil size={18} />
              </IconBubble>
              <Box style={{ flex: 1 }}>
                <Text size="sm" fw={700} c={SavedColors.TextColor} style={{ fontFamily: "'DM Sans',sans-serif" }}>Personal Information</Text>
                <Text size="xs" c="dimmed">Name, phone, date of birth, address</Text>
              </Box>
              <TbChevronRight size={16} color={SavedColors.DarkWhite} />
            </MenuRow>

            <Divider />

            <MenuRow onClick={() => navigate('/insurance-management')}>
              <IconBubble \$color="#12B76A" \$bg="#ECFDF5">
                <TbShieldBolt size={18} />
              </IconBubble>
              <Box style={{ flex: 1 }}>
                <Text size="sm" fw={700} c={SavedColors.TextColor} style={{ fontFamily: "'DM Sans',sans-serif" }}>Insurance Management</Text>
                <Text size="xs" c="dimmed">
                  {insStatus === 'none'
                    ? 'No insurance added yet'
                    : \`\${insStatus.charAt(0).toUpperCase() + insStatus.slice(1)} · \${(active?.insurance as { provider?: string } | null)?.provider ?? ''}\`}
                </Text>
              </Box>
              <TbChevronRight size={16} color={SavedColors.DarkWhite} />
            </MenuRow>

            {active?.is_chronic && (
              <>
                <Divider />
                <MenuRow onClick={() => setChronicOpen(true)}>
                  <IconBubble \$color="#EF4444" \$bg="#FEF2F2">
                    <TbHeart size={18} />
                  </IconBubble>
                  <Box style={{ flex: 1 }}>
                    <Text size="sm" fw={700} c={SavedColors.TextColor} style={{ fontFamily: "'DM Sans',sans-serif" }}>Chronic Info</Text>
                    <Text size="xs" c="dimmed">{active.chronic_conditions ?? 'View conditions & medications'}</Text>
                  </Box>
                  <TbChevronRight size={16} color={SavedColors.DarkWhite} />
                </MenuRow>
              </>
            )}
          </SectionCard>
        </Appear>

        {/* ── Switch Profile button ── */}
        <Appear \$delay={140}>
          <Box mt={20}>
            <Text size="xs" fw={700} c="dimmed" mb={10}
              style={{ textTransform: 'uppercase', letterSpacing: '0.06em', paddingLeft: 4 }}>
              Profiles
            </Text>
            <SwitchProfileButton onClick={() => openProfilePicker()}>
              <Box style={{
                width: 40, height: 40, borderRadius: 12,
                background: \`linear-gradient(135deg, \${SavedColors.Primaryblue}, #15B3E0)\`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <TbUsersGroup size={20} color="#fff" />
              </Box>
              <Box style={{ flex: 1, textAlign: 'left' }}>
                <Text size="sm" fw={700} c={SavedColors.Primaryblue} style={{ fontFamily: "'DM Sans',sans-serif" }}>
                  Switch Profile
                </Text>
                <Text size="xs" c="dimmed">
                  {profiles.length > 1
                    ? \`\${profiles.length} profiles · Active: \${active?.name ?? 'me'}\`
                    : 'Manage family profiles'}
                </Text>
              </Box>
              <TbChevronRight size={16} color={SavedColors.Primaryblue} />
            </SwitchProfileButton>
          </Box>
        </Appear>

        {/* ── Account ── */}
        <Appear \$delay={200}>
          <Text size="xs" fw={700} c="dimmed" mb={8} mt={20}
            style={{ textTransform: 'uppercase', letterSpacing: '0.06em', paddingLeft: 4 }}>
            Account
          </Text>
          <SectionCard>
            <MenuRow onClick={() => setSignOutOpen(true)}>
              <IconBubble \$color="#EF4444" \$bg="#FEF2F2">
                <TbLogout size={18} />
              </IconBubble>
              <Box style={{ flex: 1 }}>
                <Text size="sm" fw={700} c="#EF4444" style={{ fontFamily: "'DM Sans',sans-serif" }}>Sign Out</Text>
                <Text size="xs" c="dimmed">{user?.email ?? ''}</Text>
              </Box>
              <TbAlertCircle size={15} color="#FECACA" />
            </MenuRow>
          </SectionCard>
        </Appear>
      </Box>

      {/* ── Modals ── */}
      {active && (
        <ChronicModal
          opened={chronicOpen}
          onClose={() => setChronicOpen(false)}
          profile={active}
        />
      )}
      <SignOutModal
        opened={signOutOpen}
        loading={signingOut}
        onClose={() => setSignOutOpen(false)}
        onConfirm={handleSignOut}
      />
    </PageShell>
  )
}
