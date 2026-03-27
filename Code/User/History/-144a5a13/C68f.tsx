import { useState, useEffect, useRef, type ReactNode } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import {
  Avatar,
  Badge,
  Box,
  Group,
  Popover,
  Modal,
  ScrollArea,
  Text,
  Button,
  Divider,
} from '@mantine/core'
import {
  TbLayoutDashboard,
  TbClipboardList,
  TbUpload,
  TbUsers,
  TbBell,
  TbUser,
  TbLogout,
  TbShieldCheck,
  TbShieldOff,
  TbShield,
  TbPackage,
  TbShieldPlus,
  TbCurrencyDollar,
  TbClock,
} from 'react-icons/tb'
import styled, { keyframes, css } from 'styled-components'
import { SavedColors } from '@shared/constants'
import { useAuth } from '../../features/auth/context/AuthContext'
import { supabase, DbNotification } from '../../lib/supabase'
import AppLogo from '../components/AppLogo'
import { ProfileSelector } from '../components/ProfileSelector'

// ─── Keyframes ────────────────────────────────────────────────────────────────
const bellRing = keyframes`
  0%   { transform: rotate(0deg); }
  10%  { transform: rotate(14deg); }
  20%  { transform: rotate(-12deg); }
  30%  { transform: rotate(10deg); }
  40%  { transform: rotate(-8deg); }
  50%  { transform: rotate(6deg); }
  60%  { transform: rotate(-4deg); }
  70%  { transform: rotate(2deg); }
  80%  { transform: rotate(-2deg); }
  90%  { transform: rotate(0deg); }
  100% { transform: rotate(0deg); }
`

const badgePop = keyframes`
  0%   { transform: scale(0); opacity: 0; }
  60%  { transform: scale(1.25); }
  100% { transform: scale(1); opacity: 1; }
`

const pulseDot = keyframes`
  0%,100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.4); }
  50%      { box-shadow: 0 0 0 5px rgba(239,68,68,0); }
`

// ─── Navbar ───────────────────────────────────────────────────────────────────
const Navbar = styled.header`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 60px;
  background: #fff;
  border-bottom: 1px solid #eef2f8;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 1.25rem;
  z-index: 300;
  box-shadow: 0 1px 8px rgba(1, 41, 112, 0.06);
`
const Logo = styled.div`
  display: flex;
  align-items: center;
  gap: 9px;
  cursor: pointer;
`
const DesktopNav = styled.nav`
  display: none;
  align-items: center;
  gap: 2px;
  @media (min-width: 900px) {
    display: flex;
  }
`
const NavLink = styled.button<{ $active?: boolean }>`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 13px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  background: ${(p) => (p.$active ? '#EBF7FD' : 'transparent')};
  color: ${(p) => (p.$active ? SavedColors.Primaryblue : '#6B7A8D')};
  font-family: 'DM Sans', sans-serif;
  font-size: 13.5px;
  font-weight: ${(p) => (p.$active ? 700 : 500)};
  transition: all 0.15s;
  &:hover {
    background: #f0f9ff;
    color: ${SavedColors.Primaryblue};
  }
`
const RightGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`

// ─── Bell button ──────────────────────────────────────────────────────────────
const BellBtn = styled.button<{ $hasUnread: boolean }>`
  position: relative;
  width: 38px;
  height: 38px;
  border-radius: 10px;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${(p) => (p.$hasUnread ? '#FEF2F2' : '#F8FBFE')};
  border: 1.5px solid ${(p) => (p.$hasUnread ? '#FECACA' : '#E8EDF5')};
  transition: all 0.2s;
  &:hover {
    background: ${(p) => (p.$hasUnread ? '#FEE2E2' : '#EBF7FD')};
    border-color: ${(p) =>
      p.$hasUnread ? '#FCA5A5' : SavedColors.Primaryblue};
  }
  ${(p) =>
    p.$hasUnread &&
    css`
      animation: ${bellRing} 1.5s ease 0.3s;
    `}
`

const UnreadBadge = styled.div<{ $visible: boolean }>`
  position: absolute;
  top: -5px;
  right: -5px;
  min-width: 18px;
  height: 18px;
  border-radius: 9px;
  background: #ef4444;
  border: 2px solid #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
  font-family: 'DM Sans', sans-serif;
  font-size: 10px;
  font-weight: 800;
  color: #fff;
  line-height: 1;
  opacity: ${(p) => (p.$visible ? 1 : 0)};
  pointer-events: none;
  ${(p) =>
    p.$visible &&
    css`
      animation:
        ${badgePop} 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) both,
        ${pulseDot} 2s ease 0.5s 2;
    `}
`

// ─── Bottom nav ───────────────────────────────────────────────────────────────
const BottomBar = styled.nav`
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 64px;
  background: #fff;
  border-top: 1px solid #eef2f8;
  display: flex;
  align-items: stretch;
  padding: 0 6px;
  z-index: 300;
  box-shadow: 0 -4px 16px rgba(1, 41, 112, 0.06);
  @media (min-width: 900px) {
    display: none;
  }
`
const BottomItem = styled.button<{ $active?: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  flex: 1;
  border: none;
  background: transparent;
  cursor: pointer;
  padding: 6px 4px;
  border-radius: 12px;
  margin: 6px 3px;
  background: ${(p) => (p.$active ? '#EBF7FD' : 'transparent')};
  color: ${(p) => (p.$active ? SavedColors.Primaryblue : '#9EAAB8')};
  transition: all 0.15s;
  &:hover {
    background: #f0f9ff;
    color: ${SavedColors.Primaryblue};
  }
`
const BottomLabel = styled.span<{ $active?: boolean }>`
  font-family: 'DM Sans', sans-serif;
  font-size: 10.5px;
  font-weight: ${(p) => (p.$active ? 700 : 500)};
  letter-spacing: 0.01em;
`

// ─── Page shell ───────────────────────────────────────────────────────────────
const PageContent = styled.div`
  padding-top: 60px;
  min-height: 100vh;
  background: ${SavedColors.bgWhite};
  @media (max-width: 899px) {
    padding-bottom: 64px;
  }
`

// ─── Notification dot color per type ─────────────────────────────────────────
const notifAccent = (type: string): string => {
  if (type === 'insurance_verified') return '#12B76A'
  if (type === 'insurance_rejected') return '#EF4444'
  if (type === 'insurance_submitted') return '#F59F00'
  if (type === 'profile_updated') return '#6366F1'
  if (type.includes('deliver') || type.includes('dispatch'))
    return SavedColors.Primaryblue
  if (type.includes('insurance')) return '#F59F00'
  if (type === 'pricing_ready') return '#F59F00'
  return SavedColors.Primaryblue
}

const notifIcon = (type: string): JSX.Element => {
  if (type.includes('deliver') || type.includes('dispatch'))
    return <TbPackage size={13} />
  if (type === 'insurance_verified') return <TbShieldCheck size={13} />
  if (type === 'insurance_rejected') return <TbShieldOff size={13} />
  if (type.includes('insurance')) return <TbShield size={13} />
  if (type === 'profile_updated') return <TbUser size={13} />
  return <TbBell size={13} />
}

// Map a notification to the route the user should land on
function getNotifRoute(n: DbNotification): string {
  const t = n.type ?? ''
  const title = (n.title ?? '').toLowerCase()
  const body = (n.body ?? '').toLowerCase()
  const oid = n.order_id

  // Profile update → edit profile page
  if (t === 'profile_updated') return '/edit-profile/me'

  // Insurance notifications → family profiles page
  if (
    t === 'insurance_verified' ||
    t === 'insurance_rejected' ||
    t === 'insurance_submitted'
  ) {
    return '/family-profiles'
  }

  // No order linked → order history
  if (!oid) return '/order-history'

  // Delivery tracking page
  if (
    t === 'delivery_request' ||
    t === 'out_for_delivery' ||
    t === 'delivered' ||
    title.includes('out for delivery') ||
    body.includes('qr code') ||
    body.includes('rider is')
  )
    return `/order/${oid}/delivery`

  // Pricing breakdown page
  if (
    t === 'pricing_ready' ||
    title.includes('pricing') ||
    body.includes('review and confirm') ||
    body.includes('confirm to proceed')
  )
    return `/order/${oid}/breakdown`

  // Default → order status/tracking page
  return `/order/${oid}`
}

// ─── Nav items ────────────────────────────────────────────────────────────────
interface NavItem {
  icon: React.ComponentType<{ size?: number }>
  label: string
  path: string
  exact?: boolean
}
const NAV_ITEMS: NavItem[] = [
  { icon: TbLayoutDashboard, label: 'Home', path: '/dashboard', exact: true },
  { icon: TbClipboardList, label: 'Orders', path: '/order-history' },
  { icon: TbUpload, label: 'Upload', path: '/upload-prescription' },
]
function isActive(path: string, current: string, exact?: boolean): boolean {
  return exact ? current === path : current.startsWith(path)
}

// ─── Component ────────────────────────────────────────────────────────────────
interface CustomerLayoutProps {
  children?: ReactNode
}

export function CustomerLayout({ children }: CustomerLayoutProps): JSX.Element {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, profiles, signOut, openProfilePicker, selectedProfile } =
    useAuth()

  // Allow child components to trigger the picker via a custom DOM event
  useEffect(() => {
    const handler = () => openProfilePicker()
    window.addEventListener('open-profile-picker', handler)
    return () => window.removeEventListener('open-profile-picker', handler)
  }, [openProfilePicker])

  const [notifs, setNotifs] = useState<DbNotification[]>([])
  const [notifOpen, setNotifOpen] = useState(false)
  const [displayUnread, setDisplayUnread] = useState(0)
  const [noInsuranceOpen, setNoInsuranceOpen] = useState(false)
  // Track which user IDs have already been shown the no-insurance alert this session
  const insuranceAlertShownRef = useRef<Set<string>>(new Set())

  const mainProfile = profiles.find((p) => p.is_main_account) ?? profiles[0]
  const activeProfile = selectedProfile ?? mainProfile
  const activeInsuranceStatus =
    (activeProfile?.insurance as { status?: string } | null)?.status ?? 'none'

  // Filter notifications for the active profile.
  // Priority: use profile_id field when present (set by updated notify_customer RPC).
  // Fallback: account-level notifications (no order_id, no profile_id) always show.
  // This avoids the async race where profileOrderIds was empty on first render.
  const profileNotifs = notifs.filter((n) => {
    // Account-level notification (no order, no profile) → always show
    if (!n.order_id && !n.profile_id) return true
    // Has a profile_id → match exactly against active profile
    if (n.profile_id) return n.profile_id === activeProfile?.id
    // Legacy: has order_id but no profile_id → show for main/active profile
    // rather than hiding while we wait for an async fetch
    return true
  })

  const unread = profileNotifs.filter((n) => !n.is_read).length

  // Show no-insurance popup once per user session if selected profile has no insurance
  useEffect(() => {
    if (!user || !selectedProfile) return
    if (insuranceAlertShownRef.current.has(user.id)) return
    const insStatus =
      (selectedProfile.insurance as { status?: string } | null)?.status ??
      'none'
    // Never show for profiles that have insurance (any status except 'none')
    if (insStatus && insStatus !== 'none') return
    // Skip for profiles created within the last 90 seconds — user just registered
    const profileAge = Date.now() - new Date(selectedProfile.created_at).getTime()
    if (profileAge < 90_000) return
    insuranceAlertShownRef.current.add(user.id)
    // Small delay so page renders first
    const t = setTimeout(() => setNoInsuranceOpen(true), 1200)
    return () => clearTimeout(t)
  }, [user?.id, selectedProfile?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Keep displayUnread in sync: update it when notifs change and popover is CLOSED
  // When popover is open we freeze displayUnread so the badge stays visible
  useEffect(() => {
    if (!notifOpen) setDisplayUnread(unread)
  }, [unread, notifOpen])

  // ─── Fetch & realtime ────────────────────────────────────────────────────
  const fetchNotifs = (): void => {
    if (!user) return
    supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(30)
      .then(({ data }) => {
        if (data) setNotifs(data as DbNotification[])
      })
  }

  useEffect(() => {
    if (!user) return
    fetchNotifs()

    // Listen for new notifications inserted for this user
    const ch = supabase
      .channel('customer-notifs:' + user.id)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: 'user_id=eq.' + user.id,
        },
        () => fetchNotifs(),
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: 'user_id=eq.' + user.id,
        },
        () => fetchNotifs(),
      )
      .subscribe()

    return () => {
      supabase.removeChannel(ch)
    }
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Mark as read ────────────────────────────────────────────────────────
  const markRead = async (id: string): Promise<void> => {
    await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', id)
    setNotifs((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
    )
  }

  const markAllRead = async (): Promise<void> => {
    const ids = profileNotifs.filter((n) => !n.is_read).map((n) => n.id)
    if (!ids.length) return
    await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .in('id', ids)
    setNotifs((prev) => prev.map((n) => ({ ...n, is_read: true })))
  }

  const handleBellClick = (): void => {
    const opening = !notifOpen
    setNotifOpen(opening)
    // Mark all as read only when CLOSING (after user has seen the list)
    if (!opening) markAllRead()
  }

  return (
    <>
      <ProfileSelector />

      {/* ── No Insurance Alert Modal ── */}
      <Modal
        opened={noInsuranceOpen}
        onClose={() => setNoInsuranceOpen(false)}
        centered
        size="sm"
        withCloseButton
        radius="md"
        styles={{
          title: { fontFamily: "'Nunito',sans-serif", fontWeight: 800 },
          body: { padding: '8px 20px 24px' },
        }}
        title="Add Your Insurance"
      >
        <Box>
          {/* Hero icon */}
          <Box ta="center" mb="md">
            <Box
              style={{
                width: 72, height: 72, borderRadius: '50%',
                background: 'linear-gradient(135deg,#15B3E0,#012970)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 12px',
                boxShadow: '0 8px 24px rgba(21,179,224,0.35)',
              }}
            >
              <TbShieldPlus size={34} color="#fff" />
            </Box>
            <Text fw={700} size="md" mb={4} style={{ fontFamily: "'DM Sans',sans-serif", color: '#1A2B3C' }}>
              {activeProfile?.name || 'Your profile'} has no insurance on file
            </Text>
            <Text size="sm" c="dimmed" lh={1.6}>
              Add it once — the pharmacy bills your provider automatically on every order.
            </Text>
          </Box>

          {/* Benefits list */}
          {[
            { icon: TbShieldCheck, color: '#12B76A', text: 'Medications covered by your provider' },
            { icon: TbCurrencyDollar, color: '#F59F00', text: 'Pay only what insurance doesn\'t cover' },
            { icon: TbClock, color: SavedColors.Primaryblue, text: 'Verified within 24 hours, applied automatically' },
          ].map(({ icon: Icon, color, text }) => (
            <Box
              key={text}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', marginBottom: 6, borderRadius: 8, background: '#F8FBFE', border: '1px solid #E8EDF5' }}
            >
              <Box style={{ width: 30, height: 30, borderRadius: '50%', background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon size={15} color={color} />
              </Box>
              <Text size="sm" fw={500} c="#374151">{text}</Text>
            </Box>
          ))}

          <Stack gap="xs" mt="lg">
            <Button
              fullWidth
              color="lotusCyan"
              size="md"
              leftSection={<TbShieldPlus size={16} />}
              onClick={() => {
                setNoInsuranceOpen(false)
                const profileId = activeProfile?.is_main_account
                  ? 'me'
                  : (activeProfile?.id ?? 'me')
                navigate(`/edit-profile/${profileId}`, {
                  state: { openInsurance: true },
                })
              }}
            >
              Add Insurance Now
            </Button>
            <Button variant="subtle" color="gray" fullWidth onClick={() => setNoInsuranceOpen(false)}>
              Remind me later
            </Button>
          </Stack>
        </Box>
      </Modal>

      {/* ── Navbar ── */}
      <Navbar>
        <Logo onClick={() => navigate('/dashboard')}>
          <AppLogo
            size={30}
            variant="color"
          />
          <Text
            style={{
              fontFamily: "'Nunito',sans-serif",
              fontWeight: 800,
              fontSize: 16,
              color: SavedColors.FooterBgColor,
              letterSpacing: '-0.2px',
            }}
          >
            MedDeliverySOS
          </Text>
        </Logo>

        {/* Desktop nav links */}
        <DesktopNav>
          {NAV_ITEMS.map(({ icon: Icon, label, path, exact }) => (
            <NavLink
              key={path}
              $active={isActive(path, location.pathname, exact)}
              onClick={() => navigate(path)}
            >
              <Icon size={15} /> {label}
            </NavLink>
          ))}
        </DesktopNav>

        <RightGroup>
          {/* ── Notification Bell ── */}
          <Popover
            opened={notifOpen}
            onChange={setNotifOpen}
            position="bottom-end"
            width={360}
            shadow="lg"
            radius="md"
            onClose={markAllRead}
            zIndex={400}
          >
            <Popover.Target>
              <BellBtn
                $hasUnread={displayUnread > 0}
                onClick={handleBellClick}
                aria-label="Notifications"
              >
                <TbBell
                  size={19}
                  color={displayUnread > 0 ? '#EF4444' : '#6B7A8D'}
                />
                <UnreadBadge $visible={displayUnread > 0}>
                  {displayUnread > 99 ? '99+' : String(displayUnread)}
                </UnreadBadge>
              </BellBtn>
            </Popover.Target>

            <Popover.Dropdown
              p={0}
              style={{
                border: '1px solid #e5e7eb',
                borderRadius: 12,
                overflow: 'hidden',
                boxShadow: '0 8px 32px rgba(1,41,112,0.12)',
              }}
            >
              {/* Popover header */}
              <Box
                p="sm"
                style={{ borderBottom: '1px solid #e5e7eb' }}
              >
                <Group justify="space-between">
                  <Group gap="xs">
                    <TbBell
                      size={16}
                      color={SavedColors.Primaryblue}
                    />
                    <Text
                      size="sm"
                      fw={700}
                      c={SavedColors.TextColor}
                    >
                      Notifications
                    </Text>
                    {unread > 0 && (
                      <Badge
                        color="red"
                        size="xs"
                        circle
                      >
                        {unread}
                      </Badge>
                    )}
                  </Group>
                  {profileNotifs.some((n) => !n.is_read) && (
                    <Button
                      size="xs"
                      variant="subtle"
                      color="lotusCyan"
                      onClick={markAllRead}
                    >
                      Mark all read
                    </Button>
                  )}
                </Group>
              </Box>

              {/* Notification list */}
              <ScrollArea h={300}>
                {profileNotifs.length === 0 ? (
                  <Box
                    ta="center"
                    py="xl"
                    px="md"
                  >
                    <TbBell
                      size={28}
                      color="#d1d5db"
                      style={{ marginBottom: 8 }}
                    />
                    <Text
                      size="sm"
                      c="dimmed"
                    >
                      No notifications yet
                    </Text>
                    <Text
                      size="xs"
                      c="dimmed"
                      mt={4}
                    >
                      You&apos;ll be notified when your order status changes
                    </Text>
                  </Box>
                ) : (
                  profileNotifs.map((n) => (
                    <Box
                      key={n.id}
                      onClick={async () => {
                        await markRead(n.id)
                        setNotifOpen(false)
                        navigate(getNotifRoute(n))
                      }}
                      style={{
                        display: 'flex',
                        gap: 10,
                        alignItems: 'flex-start',
                        padding: '10px 12px',
                        background: n.is_read ? 'transparent' : '#FFF8F0',
                        borderBottom: '1px solid #f3f4f6',
                        cursor: 'pointer',
                        transition: 'background 0.15s',
                      }}
                    >
                      {/* Colored icon circle */}
                      <Box
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: '50%',
                          flexShrink: 0,
                          background: n.is_read
                            ? '#f3f4f6'
                            : `${notifAccent(n.type)}18`,
                          border: `1.5px solid ${n.is_read ? '#e5e7eb' : notifAccent(n.type)}40`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: n.is_read ? '#9ca3af' : notifAccent(n.type),
                          marginTop: 1,
                        }}
                      >
                        {notifIcon(n.type)}
                      </Box>

                      <Box style={{ flex: 1, minWidth: 0 }}>
                        <Group
                          gap={4}
                          wrap="nowrap"
                        >
                          <Text
                            size="xs"
                            fw={n.is_read ? 500 : 700}
                            c={SavedColors.TextColor}
                            style={{ flex: 1, lineHeight: 1.4 }}
                          >
                            {n.title}
                          </Text>
                          {!n.is_read && (
                            <Box
                              style={{
                                width: 6,
                                height: 6,
                                borderRadius: '50%',
                                background: '#EF4444',
                                flexShrink: 0,
                                marginTop: 2,
                              }}
                            />
                          )}
                        </Group>
                        <Text
                          size="xs"
                          c="dimmed"
                          mt={2}
                          lh={1.4}
                        >
                          {n.body}
                        </Text>
                        <Text
                          size="xs"
                          c="dimmed"
                          mt={3}
                          style={{ fontSize: 10 }}
                        >
                          {new Date(n.created_at).toLocaleString([], {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </Text>
                      </Box>
                    </Box>
                  ))
                )}
              </ScrollArea>

              {profileNotifs.length > 0 && (
                <Box
                  p="xs"
                  style={{
                    borderTop: '1px solid #f3f4f6',
                    textAlign: 'center',
                  }}
                >
                  <Text
                    size="xs"
                    c="dimmed"
                  >
                    {profileNotifs.length} notification
                    {profileNotifs.length !== 1 ? 's' : ''}
                  </Text>
                </Box>
              )}
            </Popover.Dropdown>
          </Popover>

          {/* ── Avatar + dropdown ── */}
          <Popover
            position="bottom-end"
            width={210}
            shadow="md"
            radius="md"
          >
            <Popover.Target>
              <Box style={{ position: 'relative', cursor: 'pointer' }}>
                <Avatar
                  size={34}
                  radius="xl"
                  color="lotusCyan"
                  src={
                    (activeProfile as { photo_url?: string })?.photo_url ?? null
                  }
                  style={{ border: `2px solid ${SavedColors.DemWhite}` }}
                >
                  {activeProfile?.name?.[0]?.toUpperCase() ?? 'U'}
                </Avatar>
                {/* Insurance status dot */}
                <Box
                  style={{
                    position: 'absolute',
                    bottom: -1,
                    right: -1,
                    width: 13,
                    height: 13,
                    borderRadius: '50%',
                    background:
                      activeInsuranceStatus === 'verified'
                        ? '#12B76A'
                        : activeInsuranceStatus === 'pending'
                          ? '#F59F00'
                          : activeInsuranceStatus === 'rejected'
                            ? '#EF4444'
                            : '#9ca3af',
                    border: '2px solid #fff',
                  }}
                />
              </Box>
            </Popover.Target>
            <Popover.Dropdown p="xs">
              <Box
                px="xs"
                py={6}
              >
                <Text
                  size="sm"
                  fw={700}
                  c={SavedColors.TextColor}
                >
                  {activeProfile?.name ?? 'Account'}
                </Text>
                <Text
                  size="xs"
                  c="dimmed"
                >
                  {activeProfile?.relationship}
                  {!activeProfile?.is_main_account && (
                    <Text
                      span
                      size="xs"
                      c={SavedColors.Primaryblue}
                      fw={600}
                    >
                      {' '}
                      · Active Profile
                    </Text>
                  )}
                </Text>
                <Group
                  gap={4}
                  mt={4}
                >
                  {activeInsuranceStatus === 'verified' ? (
                    <>
                      <TbShieldCheck
                        size={12}
                        color="#12B76A"
                      />
                      <Text
                        size="xs"
                        c="#12B76A"
                        fw={600}
                      >
                        Insurance Verified
                      </Text>
                    </>
                  ) : activeInsuranceStatus === 'pending' ? (
                    <>
                      <TbShield
                        size={12}
                        color="#F59F00"
                      />
                      <Text
                        size="xs"
                        c="#d97706"
                        fw={600}
                      >
                        Insurance Pending
                      </Text>
                    </>
                  ) : activeInsuranceStatus === 'rejected' ? (
                    <>
                      <TbShieldOff
                        size={12}
                        color="#EF4444"
                      />
                      <Text
                        size="xs"
                        c="#ef4444"
                        fw={600}
                      >
                        Insurance Rejected
                      </Text>
                    </>
                  ) : (
                    <>
                      <TbShieldOff
                        size={12}
                        color="#9ca3af"
                      />
                      <Text
                        size="xs"
                        c="dimmed"
                      >
                        No Insurance
                      </Text>
                    </>
                  )}
                </Group>
              </Box>
              <Divider my={4} />
              <NavLink
                style={{
                  color: SavedColors.TextColor,
                  width: '100%',
                  padding: '7px 10px',
                  gap: 8,
                }}
                onClick={() => navigate('/edit-profile/me')}
              >
                <TbUser size={14} /> My Profile
              </NavLink>
              <NavLink
                style={{
                  color: SavedColors.Primaryblue,
                  width: '100%',
                  padding: '7px 10px',
                  gap: 8,
                }}
                onClick={openProfilePicker}
              >
                <TbUsers size={14} /> Switch Profile
              </NavLink>
              <Divider my={4} />
              <NavLink
                style={{
                  color: '#EF4444',
                  width: '100%',
                  padding: '7px 10px',
                  gap: 8,
                }}
                onClick={async () => {
                  await signOut()
                  navigate('/login')
                }}
              >
                <TbLogout size={14} /> Sign Out
              </NavLink>
            </Popover.Dropdown>
          </Popover>
        </RightGroup>
      </Navbar>

      {/* ── Content ── */}
      <PageContent>{children ?? <Outlet />}</PageContent>

      {/* ── Bottom bar ── */}
      <BottomBar>
        {NAV_ITEMS.map(({ icon: Icon, label, path, exact }) => {
          const active = isActive(path, location.pathname, exact)
          return (
            <BottomItem
              key={path}
              $active={active}
              onClick={() => navigate(path)}
            >
              <Icon size={21} />
              <BottomLabel $active={active}>{label}</BottomLabel>
            </BottomItem>
          )
        })}
        {/* Profile button — opens selector picker */}
        <BottomItem
          $active={false}
          onClick={openProfilePicker}
          style={{ position: 'relative' }}
        >
          <Box style={{ position: 'relative', display: 'inline-flex' }}>
            <TbUser size={21} />
            {/* Insurance status dot */}
            <Box
              style={{
                position: 'absolute',
                top: -2,
                right: -4,
                width: 8,
                height: 8,
                borderRadius: '50%',
                background:
                  activeInsuranceStatus === 'verified'
                    ? '#12B76A'
                    : activeInsuranceStatus === 'pending'
                      ? '#F59F00'
                      : activeInsuranceStatus === 'rejected'
                        ? '#EF4444'
                        : '#d1d5db',
                border: '1.5px solid #fff',
              }}
            />
          </Box>
          <BottomLabel $active={false}>Profile</BottomLabel>
        </BottomItem>
      </BottomBar>
    </>
  )
}

