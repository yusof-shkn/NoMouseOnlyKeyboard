import { useState, useEffect, useRef, type ReactNode } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import {
  Avatar,
  Box,
  Group,
  ActionIcon,
  Loader as MantineLoader,
  Text,
  Badge,
} from '@mantine/core'
import {
  TbLayoutDashboard,
  TbClipboardList,
  TbUpload,
  TbBell,
  TbUser,
  TbMessage2,
  TbX as TbXIcon,
  TbSend,
} from 'react-icons/tb'
import styled, { keyframes, css } from 'styled-components'
import { SavedColors } from '@shared/constants'
import { useAuth } from '../../features/auth/context/AuthContext'
import { supabase, DbChatMessage, DbNotification } from '../../lib/supabase'
import { notifications as mantineNotifications } from '@mantine/notifications'
import { ProfileSelector } from '../components/ProfileSelector'
import InsuranceModal, {
  type InsuranceFormData,
} from '../components/InsuranceModal'
import NoInsurancePage from '../pages/customer/NoInsurancePage'

// ─── Chat float ───────────────────────────────────────────────────────────────
const ChatFloat = styled.button`
  position: fixed;
  bottom: 80px;
  right: 18px;
  z-index: 450;
  width: 54px;
  height: 54px;
  border-radius: 50%;
  border: none;
  cursor: pointer;
  background: linear-gradient(135deg, #15b3e0, #012970);
  box-shadow: 0 4px 18px rgba(21, 179, 224, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.18s;
  &:hover {
    transform: scale(1.08);
  }
  @media (min-width: 900px) {
    bottom: 24px;
    right: 24px;
  }
`
const ChatUnreadDot = styled.span`
  position: absolute;
  top: -3px;
  right: -3px;
  min-width: 19px;
  height: 19px;
  border-radius: 10px;
  background: #ef4444;
  color: #fff;
  border: 2px solid #fff;
  font-size: 10px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 3px;
`
const ChatSlide = styled.div<{ $open: boolean }>`
  position: fixed;
  left: 0;
  right: 0;
  z-index: 500;
  bottom: 0;
  height: 72vh;
  max-height: 540px;
  background: #fff;
  border-radius: 20px 20px 0 0;
  box-shadow: 0 -8px 32px rgba(1, 41, 112, 0.18);
  display: flex;
  flex-direction: column;
  transform: translateY(${(p) => (p.$open ? '0' : '110%')});
  visibility: ${(p) => (p.$open ? 'visible' : 'hidden')};
  pointer-events: ${(p) => (p.$open ? 'auto' : 'none')};
  transition:
    transform 0.28s cubic-bezier(0.32, 0.72, 0, 1),
    visibility 0s linear ${(p) => (p.$open ? '0s' : '0.28s')};
  will-change: transform;
  @media (min-width: 900px) {
    bottom: 24px;
    left: auto;
    right: 24px;
    width: 380px;
    height: 480px;
    max-height: 480px;
    border-radius: 20px;
  }
`
const ChatBubble = styled.div<{ $isMe: boolean }>`
  max-width: 78%;
  padding: 9px 13px;
  border-radius: ${(p) =>
    p.$isMe ? '14px 14px 3px 14px' : '14px 14px 14px 3px'};
  background: ${(p) =>
    p.$isMe ? 'linear-gradient(135deg,#15B3E0,#012970)' : '#f1f5f9'};
  color: ${(p) => (p.$isMe ? '#fff' : '#1A2B3C')};
  box-shadow: ${(p) =>
    p.$isMe ? '0 2px 8px rgba(21,179,224,0.22)' : '0 1px 3px rgba(0,0,0,0.06)'};
`
const DragHandle = styled.div`
  width: 36px;
  height: 4px;
  border-radius: 2px;
  background: #d1d5db;
  margin: 10px auto 0;
  cursor: grab;
  flex-shrink: 0;
  @media (min-width: 900px) {
    display: none;
  }
`

// ─── Keyframes ────────────────────────────────────────────────────────────────
const bellRingKf = keyframes`
  0%   { transform: rotate(0deg); }
  10%  { transform: rotate(15deg); }
  20%  { transform: rotate(-13deg); }
  30%  { transform: rotate(11deg); }
  40%  { transform: rotate(-9deg); }
  50%  { transform: rotate(7deg); }
  60%  { transform: rotate(-4deg); }
  70%  { transform: rotate(2deg); }
  80%  { transform: rotate(-1deg); }
  90%, 100% { transform: rotate(0deg); }
`
const badgePopKf = keyframes`
  0%   { transform: scale(0); opacity: 0; }
  60%  { transform: scale(1.3); }
  100% { transform: scale(1); opacity: 1; }
`
const pulseDotKf = keyframes`
  0%,100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.5); }
  50%      { box-shadow: 0 0 0 6px rgba(239,68,68,0); }
`
const shimmerKf = keyframes`
  0%   { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
`

const ShimmerOverlay = styled.div`
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: linear-gradient(
    105deg,
    transparent 30%,
    rgba(255, 255, 255, 0.22) 50%,
    transparent 70%
  );
  animation: ${shimmerKf} 2.2s ease-in-out infinite;
  pointer-events: none;
`

// ─── Bottom nav ───────────────────────────────────────────────────────────────
const BottomBar = styled.nav`
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 64px;
  background: rgba(255, 255, 255, 0.97);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-top: 1px solid #eef2f8;
  display: flex;
  align-items: stretch;
  padding: 0 6px;
  z-index: 400;
  box-shadow: 0 -4px 20px rgba(1, 41, 112, 0.08);
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
const BellWrap = styled.div<{ $ring: boolean }>`
  position: relative;
  display: inline-flex;
  ${(p) =>
    p.$ring &&
    css`
      animation: ${bellRingKf} 1.2s ease;
    `}
`
const UnreadDot = styled.div<{ $visible: boolean; $critical: boolean }>`
  position: absolute;
  top: -4px;
  right: -5px;
  min-width: 15px;
  height: 15px;
  border-radius: 8px;
  background: ${(p) => (p.$critical ? '#EF4444' : '#15B3E0')};
  border: 1.5px solid #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 2px;
  font-family: 'DM Sans', sans-serif;
  font-size: 9px;
  font-weight: 800;
  color: #fff;
  opacity: ${(p) => (p.$visible ? 1 : 0)};
  pointer-events: none;
  ${(p) =>
    p.$visible &&
    css`
      animation:
        ${badgePopKf} 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275) both,
        ${pulseDotKf} 2.5s ease 0.5s 3;
    `}
`
const PageContent = styled.div`
  min-height: calc(100vh - 64px);
  background: ${SavedColors.bgWhite};
  @media (max-width: 899px) {
    padding-bottom: 64px;
  }
  @media (min-width: 900px) {
    min-height: 100vh;
  }
`

// ─── Desktop layout ───────────────────────────────────────────────────────────
const DesktopShell = styled.div`
  display: none;
  @media (min-width: 900px) {
    display: flex;
    min-height: 100vh;
    background: #f0f4f8;
  }
`

const Sidebar = styled.nav`
  width: 240px;
  min-height: 100vh;
  background: linear-gradient(180deg, #012970 0%, #0c3d8a 60%, #0e4fa8 100%);
  display: flex;
  flex-direction: column;
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  z-index: 200;
  box-shadow: 4px 0 24px rgba(1, 41, 112, 0.18);
`

const SidebarLogo = styled.div`
  padding: 28px 20px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
`

const SidebarNav = styled.div`
  flex: 1;
  padding: 16px 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
`

const SidebarItem = styled.button<{ $active?: boolean }>`
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 11px 14px;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  text-align: left;
  transition: all 0.15s;
  background: ${(p) => (p.$active ? 'rgba(255,255,255,0.15)' : 'transparent')};
  color: ${(p) => (p.$active ? '#fff' : 'rgba(255,255,255,0.6)')};
  box-shadow: ${(p) =>
    p.$active ? 'inset 0 0 0 1px rgba(255,255,255,0.18)' : 'none'};
  &:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
  }
`

const SidebarLabel = styled.span`
  font-family: 'DM Sans', sans-serif;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.01em;
`

const SidebarSection = styled.div`
  padding: 6px 12px 2px;
  font-family: 'DM Sans', sans-serif;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.35);
`

const SidebarFooter = styled.div`
  padding: 16px 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
`

const SidebarProfile = styled.button`
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  border: none;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.08);
  cursor: pointer;
  text-align: left;
  transition: background 0.15s;
  &:hover {
    background: rgba(255, 255, 255, 0.14);
  }
`

const DesktopMain = styled.main`
  margin-left: 240px;
  flex: 1;
  min-height: 100vh;
  background: #f0f4f8;
  display: flex;
  flex-direction: column;
`

const DesktopContent = styled.div`
  flex: 1;
  padding: 0;
`

const MobileShell = styled.div`
  display: block;
  @media (min-width: 900px) {
    display: none;
  }
`

// ─── Nav items ────────────────────────────────────────────────────────────────
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
  const { user, profiles, openProfilePicker, selectedProfile, refreshProfile } =
    useAuth()

  useEffect(() => {
    const handler = () => openProfilePicker()
    window.addEventListener('open-profile-picker', handler)
    return () => window.removeEventListener('open-profile-picker', handler)
  }, [openProfilePicker])

  const [chatOpen, setChatOpen] = useState(false)
  const [chatUnread, setChatUnread] = useState(0)
  const [chatMsgs, setChatMsgs] = useState<DbChatMessage[]>([])
  const [chatLoading, setChatLoading] = useState(false)
  const [chatText, setChatText] = useState('')
  const [chatSending, setChatSending] = useState(false)
  const chatScrollRef = useRef<HTMLDivElement>(null)
  const chatSeenRef = useRef<Set<string>>(new Set())

  const [notifs, setNotifs] = useState<DbNotification[]>([])
  const [displayUnread, setDisplayUnread] = useState(0)
  const [bellRinging, setBellRinging] = useState(false)
  const [noInsPage, setNoInsPage] = useState(false)
  const [insModalOpen, setInsModalOpen] = useState(false)

  const seenNotifIdsRef = useRef<Set<string>>(new Set())
  const notifSeededRef = useRef(false)
  const insuranceModalFiredRef = useRef(false)

  const mainProfile = profiles.find((p) => p.is_main_account) ?? profiles[0]
  const activeProfile = selectedProfile ?? mainProfile
  const activeInsuranceStatus =
    (activeProfile?.insurance as { status?: string } | null)?.status ?? 'none'

  const orderRouteMatch = location.pathname.match(/^\/order\/([^/]+)/)
  const currentOrderId = orderRouteMatch ? orderRouteMatch[1] : null
  const isOnOrderPage =
    !!currentOrderId &&
    location.pathname.startsWith('/order/') &&
    !location.pathname.endsWith('/payment') &&
    !location.pathname.endsWith('/delivery')

  useEffect(() => {
    if (!isOnOrderPage) {
      setChatOpen(false)
      setChatUnread(0)
    }
  }, [isOnOrderPage])

  useEffect(() => {
    if (!currentOrderId || !user) return
    const fetchUnread = () =>
      supabase
        .from('chat_messages')
        .select('id', { count: 'exact', head: true })
        .eq('order_id', currentOrderId)
        .eq('chat_thread', 'customer')
        .eq('is_read', false)
        .neq('sender_id', user.id)
        .then(({ count }) => setChatUnread(count ?? 0))
    fetchUnread()
    const ch = supabase
      .channel('layout-chat-unread:' + currentOrderId)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_messages',
          filter: `order_id=eq.${currentOrderId}`,
        },
        fetchUnread,
      )
      .subscribe()
    return () => {
      supabase.removeChannel(ch)
    }
  }, [currentOrderId, user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!currentOrderId) {
      setChatMsgs([])
      return
    }
    setChatLoading(true)
    supabase
      .from('chat_messages')
      .select('*')
      .eq('order_id', currentOrderId)
      .eq('chat_thread', 'customer')
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        const msgs = (data ?? []) as DbChatMessage[]
        setChatMsgs(msgs)
        msgs.forEach((m) => chatSeenRef.current.add(m.id))
        setChatLoading(false)
      })
    const ch = supabase
      .channel('layout-chat-msgs:' + currentOrderId)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `order_id=eq.${currentOrderId}`,
        },
        (payload) => {
          const msg = payload.new as DbChatMessage
          if (msg.chat_thread !== 'customer') return
          setChatMsgs((prev) => [...prev, msg])
          if (!chatSeenRef.current.has(msg.id)) {
            chatSeenRef.current.add(msg.id)
            if (msg.sender_type !== 'customer') setChatUnread((n) => n + 1)
          }
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(ch)
    }
  }, [currentOrderId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (chatOpen && chatScrollRef.current)
      chatScrollRef.current.scrollTo({
        top: chatScrollRef.current.scrollHeight,
        behavior: 'smooth',
      })
  }, [chatMsgs, chatOpen])

  const sendChatMsg = async (): Promise<void> => {
    const txt = chatText.trim()
    if (!txt || !currentOrderId || !user) return
    setChatSending(true)
    setChatText('')
    await supabase.from('chat_messages').insert({
      order_id: currentOrderId,
      sender_id: user.id,
      sender_name: (selectedProfile ?? profiles[0])?.name ?? 'Customer',
      sender_type: 'customer',
      chat_thread: 'customer',
      message: txt,
    })
    setChatSending(false)
  }

  // No-insurance page trigger
  useEffect(() => {
    if (!user || !selectedProfile) return
    if (insuranceModalFiredRef.current) return
    const insStatus =
      (selectedProfile.insurance as { status?: string } | null)?.status ??
      'none'
    if (insStatus && insStatus !== 'none') return
    insuranceModalFiredRef.current = true
    const t = setTimeout(() => setNoInsPage(true), 1500)
    return () => clearTimeout(t)
  }, [user?.id, selectedProfile?.id, activeInsuranceStatus]) // eslint-disable-line react-hooks/exhaustive-deps

  const profileNotifs = notifs.filter((n) => {
    if (!n.order_id && !n.profile_id) return true
    if (n.profile_id) return n.profile_id === activeProfile?.id
    return true
  })
  const unread = profileNotifs.filter((n) => !n.is_read).length
  const hasCritical = profileNotifs.some(
    (n) =>
      !n.is_read &&
      (n.type === 'insurance_rejected' || n.type === 'payment_confirmed'),
  )

  useEffect(() => {
    setDisplayUnread(unread)
  }, [unread])

  const fetchNotifs = (): void => {
    if (!user) return
    supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(30)
      .then(({ data }) => {
        if (!data) return
        const incoming = data as DbNotification[]
        setNotifs(incoming)
        if (!notifSeededRef.current) {
          notifSeededRef.current = true
          incoming.forEach((n) => seenNotifIdsRef.current.add(n.id))
          return
        }
        // Animate bell only — no mantine toast for real notifications
        let hasNew = false
        for (const n of incoming) {
          if (!n.is_read && !seenNotifIdsRef.current.has(n.id)) {
            seenNotifIdsRef.current.add(n.id)
            hasNew = true
          }
        }
        if (hasNew) {
          setBellRinging(true)
          setTimeout(() => setBellRinging(false), 1400)
        }
      })
  }

  useEffect(() => {
    if (!user) return
    fetchNotifs()
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
      .subscribe()
    return () => {
      supabase.removeChannel(ch)
    }
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleBellClick = (): void => {
    navigate('/notifications')
  }

  const handleInsuranceSave = async (
    data: InsuranceFormData,
  ): Promise<void> => {
    if (!user || !activeProfile) return
    const { error } = await supabase.from('insurance').insert({
      profile_id: activeProfile.id,
      provider: data.companyName,
      scheme_name: data.schemeName || null,
      policy_number: data.medicalCardNumber,
      policy_holder_name: '',
      expiry_date: new Date(Date.now() + 2 * 365 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0],
      status: 'pending',
      gender: data.gender || null,
      member_type: activeProfile.is_main_account ? 'Principal' : 'Dependent',
    })
    if (error) {
      mantineNotifications.show({
        title: 'Failed',
        message: 'Could not save insurance.',
        color: 'red',
        autoClose: 3000,
      })
      return
    }
    mantineNotifications.show({
      title: 'Insurance added',
      message: `${data.companyName} submitted.`,
      color: 'teal',
      autoClose: 2500,
    })
    setInsModalOpen(false)
    await refreshProfile()
  }

  // ── Shared bottom bar renderer ────────────────────────────────────────────
  const isUploadPage = location.pathname === '/upload-prescription'

  const renderBottomBar = (onNavClick?: (path: string) => void) => (
    <BottomBar>
      {NAV_ITEMS.map(({ icon: Icon, label, path, exact }) => {
        const active = isActive(path, location.pathname, exact)
        const isUploadBtn = path === '/upload-prescription'

        // On the upload prescription page, the Upload button becomes a submit trigger
        if (isUploadBtn && isUploadPage) {
          return (
            <BottomItem
              key={path}
              $active={false}
              onClick={() => {
                const btn = document.getElementById(
                  'upload-prescription-submit',
                )
                btn?.click()
              }}
              style={{
                flex: 1.4,
                background: 'linear-gradient(135deg,#15B3E0 0%,#012970 100%)',
                borderRadius: 16,
                margin: '4px 6px',
                boxShadow: '0 4px 18px rgba(21,179,224,0.45)',
                color: '#fff',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {/* Shimmer effect */}
              <ShimmerOverlay />
              <TbUpload
                size={20}
                color="#fff"
              />
              <BottomLabel
                $active={true}
                style={{ color: '#fff', fontSize: 11, fontWeight: 800 }}
              >
                Submit
              </BottomLabel>
            </BottomItem>
          )
        }

        return (
          <BottomItem
            key={path}
            $active={active}
            onClick={() => (onNavClick ? onNavClick(path) : navigate(path))}
          >
            <Icon size={21} />
            <BottomLabel $active={active}>{label}</BottomLabel>
          </BottomItem>
        )
      })}
      <BottomItem
        $active={isActive('/notifications', location.pathname)}
        onClick={handleBellClick}
        style={{ position: 'relative' }}
      >
        <BellWrap $ring={bellRinging}>
          <TbBell
            size={21}
            color={
              hasCritical
                ? '#EF4444'
                : displayUnread > 0
                  ? SavedColors.Primaryblue
                  : undefined
            }
          />
          <UnreadDot
            $visible={displayUnread > 0}
            $critical={hasCritical}
          >
            {displayUnread > 9 ? '9+' : displayUnread}
          </UnreadDot>
        </BellWrap>
        <BottomLabel $active={isActive('/notifications', location.pathname)}>
          Alerts
        </BottomLabel>
      </BottomItem>
      <BottomItem
        $active={isActive('/profile', location.pathname)}
        onClick={() =>
          onNavClick ? onNavClick('/profile') : navigate('/profile')
        }
        style={{ position: 'relative' }}
      >
        <Box style={{ position: 'relative', display: 'inline-flex' }}>
          <Avatar
            src={activeProfile?.photo_url ?? null}
            size={24}
            radius={24}
            color="lotusCyan"
            style={{
              border: `1.5px solid ${isActive('/profile', location.pathname) ? SavedColors.Primaryblue : '#d1d5db'}`,
              transition: 'border-color 0.15s',
            }}
          >
            <TbUser size={12} />
          </Avatar>
          <Box
            style={{
              position: 'absolute',
              top: -2,
              right: -3,
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
        <BottomLabel $active={isActive('/profile', location.pathname)}>
          Me
        </BottomLabel>
      </BottomItem>
    </BottomBar>
  )

  // ── No-insurance page overlay ─────────────────────────────────────────────
  if (noInsPage) {
    return (
      <>
        <ProfileSelector />
        <NoInsurancePage onDismiss={() => setNoInsPage(false)} />
        {renderBottomBar((path) => {
          setNoInsPage(false)
          navigate(path)
        })}
      </>
    )
  }

  const ALL_NAV_ITEMS: NavItem[] = [
    { icon: TbLayoutDashboard, label: 'Home', path: '/dashboard', exact: true },
    { icon: TbClipboardList, label: 'Orders', path: '/order-history' },
    {
      icon: TbUpload,
      label: 'Upload Prescription',
      path: '/upload-prescription',
    },
    { icon: TbBell, label: 'Notifications', path: '/notifications' },
  ]

  const insStatusColor =
    activeInsuranceStatus === 'verified'
      ? '#12B76A'
      : activeInsuranceStatus === 'pending'
        ? '#F59F00'
        : activeInsuranceStatus === 'rejected'
          ? '#EF4444'
          : '#d1d5db'

  const chatPanel =
    isOnOrderPage && user && currentOrderId ? (
      <>
        <ChatFloat
          onClick={() => {
            const o = !chatOpen
            setChatOpen(o)
            if (o) setChatUnread(0)
          }}
        >
          <TbMessage2
            size={22}
            color="#fff"
          />
          {chatUnread > 0 && (
            <ChatUnreadDot>{chatUnread > 9 ? '9+' : chatUnread}</ChatUnreadDot>
          )}
        </ChatFloat>

        <ChatSlide $open={chatOpen}>
          <DragHandle
            onTouchStart={(e) => {
              const startY = e.touches[0].clientY
              const onMove = (mv: TouchEvent) => {
                if (mv.touches[0].clientY - startY > 70) {
                  setChatOpen(false)
                  cleanup()
                }
              }
              const cleanup = () => {
                window.removeEventListener('touchmove', onMove)
                window.removeEventListener('touchend', cleanup)
              }
              window.addEventListener('touchmove', onMove, { passive: true })
              window.addEventListener('touchend', cleanup)
            }}
          />
          <Box
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 16px 8px',
              borderBottom: '1px solid #EEF2F8',
              flexShrink: 0,
            }}
          >
            <Text
              fw={700}
              size="sm"
              style={{ fontFamily: "'DM Sans',sans-serif", color: '#1A2B3C' }}
            >
              Chat with Pharmacy
            </Text>
            <button
              onClick={() => setChatOpen(false)}
              style={{
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                padding: 4,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <TbXIcon
                size={17}
                color="#9EADB8"
              />
            </button>
          </Box>
          <Box
            ref={chatScrollRef}
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '12px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            {chatLoading ? (
              <Box
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  flex: 1,
                }}
              >
                <MantineLoader
                  size="sm"
                  color="lotusCyan"
                />
              </Box>
            ) : chatMsgs.length === 0 ? (
              <Box
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  flex: 1,
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                <TbMessage2
                  size={28}
                  color="#D1D5DB"
                />
                <Text
                  size="xs"
                  c="dimmed"
                  ta="center"
                >
                  No messages yet — ask the pharmacist anything
                </Text>
              </Box>
            ) : (
              chatMsgs.map((msg) => {
                const isMe = msg.sender_id === user.id
                return (
                  <Box
                    key={msg.id}
                    style={{
                      display: 'flex',
                      justifyContent: isMe ? 'flex-end' : 'flex-start',
                      alignItems: 'flex-end',
                      gap: 6,
                    }}
                  >
                    {!isMe && (
                      <Box
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg,#15B3E0,#012970)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <Text
                          size="10px"
                          fw={700}
                          c="#fff"
                        >
                          {msg.sender_name?.[0]?.toUpperCase()}
                        </Text>
                      </Box>
                    )}
                    <ChatBubble $isMe={isMe}>
                      {!isMe && (
                        <Text
                          size="10px"
                          fw={600}
                          mb={2}
                          style={{ opacity: 0.7 }}
                        >
                          {msg.sender_name}
                        </Text>
                      )}
                      <Text
                        size="sm"
                        lh={1.5}
                      >
                        {msg.message}
                      </Text>
                      <Text
                        size="10px"
                        mt={3}
                        style={{
                          opacity: 0.5,
                          textAlign: isMe ? 'right' : 'left',
                        }}
                      >
                        {new Date(msg.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Text>
                    </ChatBubble>
                  </Box>
                )
              })
            )}
          </Box>
          <Box
            style={{
              padding: '8px 12px 10px',
              borderTop: '1px solid #EEF2F8',
              flexShrink: 0,
              display: 'flex',
              gap: 8,
              alignItems: 'center',
              background: '#fff',
            }}
          >
            <Box
              style={{
                flex: 1,
                background: '#F5F7FA',
                borderRadius: 99,
                padding: '8px 14px',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <input
                value={chatText}
                onChange={(e) => setChatText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    sendChatMsg()
                  }
                }}
                placeholder="Message the pharmacy…"
                style={{
                  flex: 1,
                  border: 'none',
                  background: 'transparent',
                  outline: 'none',
                  fontFamily: "'DM Sans',sans-serif",
                  fontSize: 14,
                  color: '#1A2B3C',
                  minWidth: 0,
                }}
              />
            </Box>
            <ActionIcon
              size="lg"
              radius="xl"
              variant="filled"
              color="lotusCyan"
              loading={chatSending}
              disabled={!chatText.trim()}
              onClick={sendChatMsg}
            >
              <TbSend size={15} />
            </ActionIcon>
          </Box>
        </ChatSlide>

        {chatOpen && (
          <div
            onClick={() => setChatOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 499,
              background: 'rgba(0,0,0,0.3)',
            }}
          />
        )}
      </>
    ) : null

  return (
    <>
      <ProfileSelector />

      <InsuranceModal
        opened={insModalOpen}
        onClose={() => setInsModalOpen(false)}
        onSave={handleInsuranceSave}
        title="Add Insurance"
      />

      {/* ── Mobile layout ── */}
      <MobileShell>
        <PageContent>{children ?? <Outlet />}</PageContent>
        {renderBottomBar()}
        {chatPanel}
      </MobileShell>

      {/* ── Desktop layout ── */}
      <DesktopShell>
        {/* Sidebar */}
        <Sidebar>
          <SidebarLogo>
            <Group
              gap={10}
              align="center"
            >
              <Box
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: 'linear-gradient(135deg,#15B3E0,#fff2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1.5px solid rgba(255,255,255,0.2)',
                }}
              >
                <TbUpload
                  size={18}
                  color="#fff"
                />
              </Box>
              <Box>
                <Text
                  style={{
                    fontFamily: "'Nunito',sans-serif",
                    fontWeight: 800,
                    fontSize: 16,
                    color: '#fff',
                    lineHeight: 1.1,
                  }}
                >
                  MediDeliver
                </Text>
                <Text
                  style={{
                    fontFamily: "'DM Sans',sans-serif",
                    fontSize: 10,
                    color: 'rgba(255,255,255,0.45)',
                    letterSpacing: '0.04em',
                  }}
                >
                  CUSTOMER PORTAL
                </Text>
              </Box>
            </Group>
          </SidebarLogo>

          <SidebarNav>
            <SidebarSection>Navigation</SidebarSection>
            {ALL_NAV_ITEMS.map(({ icon: Icon, label, path, exact }) => {
              const active = isActive(path, location.pathname, exact)
              return (
                <SidebarItem
                  key={path}
                  $active={active}
                  onClick={() => navigate(path)}
                >
                  <Icon size={19} />
                  <SidebarLabel>{label}</SidebarLabel>
                  {path === '/notifications' && displayUnread > 0 && (
                    <Badge
                      size="xs"
                      style={{
                        marginLeft: 'auto',
                        background: hasCritical ? '#EF4444' : '#15B3E0',
                        color: '#fff',
                        fontFamily: "'DM Sans',sans-serif",
                      }}
                    >
                      {displayUnread > 9 ? '9+' : displayUnread}
                    </Badge>
                  )}
                </SidebarItem>
              )
            })}
          </SidebarNav>

          <SidebarFooter>
            <SidebarProfile onClick={() => navigate('/profile')}>
              <Box style={{ position: 'relative', flexShrink: 0 }}>
                <Avatar
                  src={activeProfile?.photo_url ?? null}
                  size={34}
                  radius={34}
                  color="lotusCyan"
                  style={{ border: '2px solid rgba(255,255,255,0.25)' }}
                >
                  <TbUser size={16} />
                </Avatar>
                <Box
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    right: 0,
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: insStatusColor,
                    border: '2px solid #0c3d8a',
                  }}
                />
              </Box>
              <Box style={{ flex: 1, minWidth: 0 }}>
                <Text
                  style={{
                    fontFamily: "'DM Sans',sans-serif",
                    fontWeight: 700,
                    fontSize: 13,
                    color: '#fff',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {activeProfile?.name ?? 'My Account'}
                </Text>
                <Text
                  style={{
                    fontFamily: "'DM Sans',sans-serif",
                    fontSize: 11,
                    color: 'rgba(255,255,255,0.45)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {user?.email ?? 'Account'}
                </Text>
              </Box>
            </SidebarProfile>
          </SidebarFooter>
        </Sidebar>

        {/* Main area */}
        <DesktopMain>
          <DesktopContent>{children ?? <Outlet />}</DesktopContent>
        </DesktopMain>

        {chatPanel}
      </DesktopShell>
    </>
  )
}





### 🟢 PART 3 — New Sections & Features

11. **Chronic section for Insurance portal** — Add a new alerts/section page for insurance staff to see chronic patients (similar to `PharmacyAlertsChronic.tsx` which already exists for pharmacy).

12. **Chronic section for Pharmacy staff** — `PharmacyAlertsChronic.tsx` exists but may need enhancements to match requirements.

13. **Order history for Insurance** — `InsuranceOrders.tsx` currently shows only active/tracking orders. Need a history tab showing completed/delivered orders.

14. **Order history for Staff (pharmacy) with hide delivered toggle** — Add order history view in pharmacy portal with ability to hide delivered orders.

15. **Normal order schedule & chronic order schedule** — Two separate schedule/list views — one for regular orders, one for chronic refill orders.

16. **Actor/Auditor ** — in the every log there should be the actor information as well  what (staff actions log).

17. **Report section** — Reporting/analytics page for insurance or pharmacy.

18. **Delivery schedule** — A schedule view for deliveries.

