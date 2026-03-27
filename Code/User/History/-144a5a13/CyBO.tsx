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
  if (type.includes('deliver')) return SavedColors.Primaryblue
  if (type.includes('dispatch')) return SavedColors.Primaryblue
  return SavedColors.Primaryblue
}

const notifIcon = (type: string): JSX.Element => {
  if (type.includes('deliver') || type.includes('dispatch'))
    return <TbPackage size={13} />
  if (type.includes('insurance')) return <TbShieldCheck size={13} />
  return <TbBell size={13} />
}

// Map a notification to the route the user should land on
function getNotifRoute(n: DbNotification): string {
  const t = n.type ?? ''
  const title = (n.title ?? '').toLowerCase()
  const body = (n.body ?? '').toLowerCase()
  const oid = n.order_id

  // Insurance notifications → family profiles page
  if (t === 'insurance_verified' || t === 'insurance_rejected') {
    return '/family-profiles'
  }

  // No order linked → order history
  if (!oid) return '/order-history'

  // Delivery tracking page
  if (
    t === 'delivery_request' ||
    title.includes('out for delivery') ||
    body.includes('qr code') ||
    body.includes('rider is')
  )
    return `/order/${oid}/delivery`

  // Pricing breakdown page
  if (
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

  // Fetch order IDs belonging to the active profile so we can scope notifications
  const [profileOrderIds, setProfileOrderIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!user || !activeProfile) return
    supabase
      .from('orders')
      .select('id')
      .eq('user_id', user.id)
      .eq('profile_id', activeProfile.id)
      .then(({ data }) => {
        setProfileOrderIds(
          new Set((data ?? []).map((o: { id: string }) => o.id)),
        )
      })
  }, [user?.id, activeProfile?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Filter notifications: show if no order_id (account-level) OR order belongs to active profile
  const profileNotifs = notifs.filter(
    (n) => !n.order_id || profileOrderIds.has(n.order_id),
  )

  const unread = profileNotifs.filter((n) => !n.is_read).length

  // Show no-insurance popup once per user session if selected profile has no insurance
  useEffect(() => {
    if (!user || !selectedProfile) return
    if (insuranceAlertShownRef.current.has(user.id)) return
    const insStatus =
      (selectedProfile.insurance as { status?: string } | null)?.status ??
      'none'
    if (!insStatus || insStatus === 'none') {
      insuranceAlertShownRef.current.add(user.id)
      // Small delay so page renders first
      const t = setTimeout(() => setNoInsuranceOpen(true), 1200)
      return () => clearTimeout(t)
    }
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
        }}
        title="Add Insurance for Faster Orders"
      >
        <Box
          ta="center"
          py="xs"
        >
          <Box
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: 'linear-gradient(135deg,#15B3E0,#012970)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              boxShadow: '0 6px 20px rgba(21,179,224,0.3)',
            }}
          >
            <TbShieldPlus
              size={30}
              color="#fff"
            />
          </Box>
          <Text
            fw={700}
            size="md"
            mb={6}
            style={{ fontFamily: "'DM Sans',sans-serif" }}
          >
            {activeProfile?.name || 'This profile'} has no insurance on file
          </Text>
          <Text
            size="sm"
            c="dimmed"
            mb="xl"
            lh={1.6}
          >
            Adding insurance lets the pharmacy bill your provider directly —
            reducing your out-of-pocket costs and speeding up order processing.
          </Text>
          <Button
            fullWidth
            color="lotusCyan"
            leftSection={<TbShieldPlus size={16} />}
            mb="sm"
            onClick={() => {
              setNoInsuranceOpen(false)
              // Navigate to edit profile, state signals to open insurance checkbox
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
          <Button
            variant="subtle"
            color="gray"
            fullWidth
            onClick={() => setNoInsuranceOpen(false)}
          >
            Skip for now
          </Button>
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
            width="target"
            shadow="lg"
            radius="md"
            onClose={markAllRead}
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
              style={{ width: 'min(340px, calc(100vw - 16px))', right: 0, border: '1rem solid red' , wi }}
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
                        // display: 'flex', gap: 10, alignItems: 'flex-start',
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
                    (mainProfile as { photo_url?: string })?.photo_url ?? null
                  }
                  style={{ border: `2px solid ${SavedColors.DemWhite}` }}
                >
                  {mainProfile?.name?.[0] ?? 'U'}
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
                  {mainProfile?.name ?? 'Account'}
                </Text>
                <Text
                  size="xs"
                  c="dimmed"
                >
                  {mainProfile?.relationship}
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
              {profiles.length > 1 && (
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
              )}
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

