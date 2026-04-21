import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { Box, LoadingOverlay, Text, Switch } from '@mantine/core'
import { useMantineColorScheme } from '@mantine/core'
import {
  TbShieldCheck,
  TbUsers,
  TbBell,
  TbTruck,
  TbSettings,
  TbClipboardCheck,
  TbUser,
  TbReceipt,
  TbChartBar,
  TbHeart,
  TbMoon,
  TbSun,
} from 'react-icons/tb'
import { CiLogout } from 'react-icons/ci'
import styled from 'styled-components'
import { useAccent } from '../theme/AccentContext'
import { ACCENT_COLOR_MAP } from '../theme/theme'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../features/auth/context/AuthContext'
import { InsuranceStaffProvider } from '../../features/insurance/context/InsuranceStaffContext'
import { InsuranceProfileSelector } from '../components/InsuranceProfileSelector'

interface InsuranceStaffInfo {
  id: string
  name: string
  role: string
  insurance_provider_id: string
  provider_name: string
}

/* ── Styled ── */
const Shell = styled.div`
  display: flex;
  width: 100%;
  min-height: 100vh;
`

const SidebarNav = styled.nav<{ $bg: string }>`
  width: 240px;
  height: 100vh;
  background: ${(p) => p.$bg};
  position: sticky;
  top: 0;
  z-index: 200;
  display: none;
  flex-direction: column;
  overflow: hidden;
  flex-shrink: 0;
  @media (min-width: 900px) {
    display: flex;
  }
`
const MainContent = styled.div`
  flex: 1 1 0%;
  min-width: 0;
  width: 100%;
  min-height: 100vh;
  background: var(--mantine-color-body);
  @media (max-width: 899px) {
    padding-top: 56px;
    padding-bottom: 64px;
  }
`

/* Mobile top bar */
const MobileTopBar = styled.header<{ $bg: string }>`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 56px;
  z-index: 150;
  background: ${(p) => p.$bg};
  display: flex;
  align-items: center;
  padding: 0 1.1rem;
  gap: 10px;
  box-shadow: 0 2px 8px rgba(1, 41, 112, 0.25);
  @media (min-width: 900px) {
    display: none;
  }
`

const NavBtn = styled.button<{ $active?: boolean; $accent?: string }>`
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 10px 20px;
  border: none;
  cursor: pointer;
  background: ${(p) =>
    p.$active ? `${p.$accent ?? '#0891B2'}22` : 'transparent'};
  color: ${(p) =>
    p.$active ? (p.$accent ?? '#0891B2') : 'rgba(255,255,255,0.7)'};
  font-family: 'Roboto', sans-serif;
  font-size: 14px;
  border-left: ${(p) =>
    p.$active
      ? `3px solid ${p.$accent ?? '#0891B2'}`
      : '3px solid transparent'};
  &:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #fff;
  }
`
const NavBadge = styled.span`
  background: #ef4444;
  color: #fff;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 700;
  padding: 1px 7px;
  min-width: 20px;
  text-align: center;
`

/* ── Mobile bottom bar ── */
const BottomBar = styled.nav`
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 64px;
  background: var(--mantine-color-default-hover);
  border-top: 1px solid var(--mantine-color-default-border);
  display: flex;
  align-items: stretch;
  padding: 0 4px;
  z-index: 150;
  box-shadow: 0 -4px 16px rgba(1, 41, 112, 0.08);
  @media (min-width: 900px) {
    display: none;
  }
`
const BottomItem = styled.button<{ $active?: boolean; $accent?: string }>`
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
  margin: 6px 2px;
  background: ${(p) =>
    p.$active ? `${p.$accent ?? '#0891B2'}18` : 'transparent'};
  color: ${(p) =>
    p.$active ? (p.$accent ?? '#0891B2') : 'var(--mantine-color-dimmed)'};
  position: relative;
  transition: all 0.15s;
  &:hover {
    background: rgba(21, 179, 224, 0.1);
    color: ${(p) => p.$accent ?? '#0891B2'};
  }
`
const BottomLabel = styled.span<{ $active?: boolean }>`
  font-family: 'DM Sans', sans-serif;
  font-size: 10px;
  font-weight: ${(p) => (p.$active ? 700 : 500)};
`
const BottomBadge = styled.span`
  position: absolute;
  top: 3px;
  right: calc(50% - 20px);
  min-width: 17px;
  height: 17px;
  border-radius: 9px;
  background: #ef4444;
  color: #fff;
  border: 2px solid #fff;
  font-size: 9px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 3px;
`

export function InsuranceLayout(): JSX.Element {
  const { user, loading, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { colorScheme, toggleColorScheme } = useMantineColorScheme()
  const { accentId } = useAccent()
  const accentDef = ACCENT_COLOR_MAP[accentId]
  const accentColor = colorScheme === 'dark' ? accentDef.dark : accentDef.color
  const isDark = colorScheme === 'dark'
  const [staffInfo, setStaffInfo] = useState<InsuranceStaffInfo | null>(null)
  const [staffLoading, setStaffLoading] = useState(true)

  // Sidebar background: dark-mode uses a deep dark tint, light-mode uses a deep accent-tinted navy
  const sidebarBg = isDark
    ? `color-mix(in srgb, ${accentColor} 18%, #0d0f1a)`
    : `color-mix(in srgb, ${accentColor} 22%, #001645)`

  /* Counts */
  const [pendingMemberCount, setPendingMemberCount] = useState(0)
  const [approvalCount, setApprovalCount] = useState(0)
  const [alertCount, setAlertCount] = useState(0)
  const [chatUnread, setChatUnread] = useState(0)
  const [chronicOverdue, setChronicOverdue] = useState(0)

  const isLogin =
    location.pathname === '/insurance' ||
    location.pathname === '/insurance/login'

  useEffect(() => {
    if (loading || isLogin) return
    if (!user) {
      navigate('/insurance/login')
      return
    }
    supabase.rpc('get_my_insurance_staff_info').then(({ data }) => {
      if (!data || !(data as InsuranceStaffInfo).id)
        navigate('/insurance/login')
      else setStaffInfo(data as InsuranceStaffInfo)
      setStaffLoading(false)
    })
  }, [user, loading, isLogin, navigate])

  /* Verification + approval counts */
  useEffect(() => {
    if (!staffInfo) return
    const pname = staffInfo.provider_name

    const fetchCounts = async (): Promise<void> => {
      const [pendingIns] = await Promise.all([
        supabase
          .from('insurance')
          .select('id', { count: 'exact', head: true })
          .eq('provider', pname)
          .eq('status', 'pending'),
      ])
      setPendingMemberCount(pendingIns.count ?? 0)

      const { data: verified } = await supabase
        .from('insurance')
        .select('profile_id')
        .eq('provider', pname)
        .eq('status', 'verified')
      const pids = (verified ?? []).map(
        (i: { profile_id: string }) => i.profile_id,
      )
      if (pids.length > 0) {
        const { count } = await supabase
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .in('profile_id', pids)
          .eq('status', 'pricing_ready')
          .eq('cash_only', false)
        setApprovalCount(count ?? 0)
      } else {
        setApprovalCount(0)
      }
    }

    fetchCounts()
    const ch = supabase
      .channel('ins-layout-counts')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'insurance' },
        fetchCounts,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        fetchCounts,
      )
      .subscribe()
    return () => {
      supabase.removeChannel(ch)
    }
  }, [staffInfo?.provider_name])

  /* Unread alert count */
  useEffect(() => {
    if (!user) return
    const fetchAlerts = async (): Promise<void> => {
      const { count } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false)
        .in('type', ['staff_alert', 'insurance_alert', 'system'])
      setAlertCount(count ?? 0)
    }
    fetchAlerts()
    const ch = supabase
      .channel('ins-layout-alerts:' + user.id)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        fetchAlerts,
      )
      .subscribe()
    return () => {
      supabase.removeChannel(ch)
    }
  }, [user?.id])

  /* Unread chat count */
  useEffect(() => {
    if (!staffInfo) return
    const fetchChatUnread = async (): Promise<void> => {
      const { data, error } = await supabase.rpc(
        'get_insurance_chat_unread_count',
      )
      if (!error && typeof data === 'number') setChatUnread(data)
    }
    fetchChatUnread()
    const ch = supabase
      .channel('ins-layout-chat-unread')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        fetchChatUnread,
      )
      .subscribe()
    return () => {
      supabase.removeChannel(ch)
    }
  }, [staffInfo?.id])

  /* Chronic overdue count for this provider */
  useEffect(() => {
    if (!staffInfo) return
    const providerName = staffInfo.provider_name
    const fetchChronicOverdue = async (): Promise<void> => {
      const { data: insData } = await supabase
        .from('insurance')
        .select('profile_id')
        .eq('provider', providerName)
      const profileIds = ((insData ?? []) as { profile_id: string }[]).map(
        (i) => i.profile_id,
      )
      if (profileIds.length === 0) {
        setChronicOverdue(0)
        return
      }
      const { data } = await supabase
        .from('profiles')
        .select('id, last_refill_date, refill_interval_days')
        .in('id', profileIds)
        .eq('is_chronic', true)
        .not('last_refill_date', 'is', null)
        .not('refill_interval_days', 'is', null)
      if (!data) return
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const count = (
        data as { last_refill_date: string; refill_interval_days: number }[]
      ).filter((p) => {
        const next = new Date(p.last_refill_date)
        next.setDate(next.getDate() + p.refill_interval_days)
        next.setHours(0, 0, 0, 0)
        return next <= today
      }).length
      setChronicOverdue(count)
    }
    fetchChronicOverdue()
    const ch = supabase
      .channel('ins-layout-chronic-overdue')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        fetchChronicOverdue,
      )
      .subscribe()
    return () => {
      supabase.removeChannel(ch)
    }
  }, [staffInfo?.provider_name])

  if (isLogin) return <Outlet />

  if (loading || staffLoading)
    return (
      <LoadingOverlay
        visible
        zIndex={500}
      />
    )

  const p = location.pathname
  const isVerifications = p.startsWith('/insurance/verifications')
  const isApprovals = p.startsWith('/insurance/approvals')
  const isOrders = p.startsWith('/insurance/orders')
  const isCustomers =
    p.startsWith('/insurance/customers') || p.startsWith('/insurance/customer/')
  const isChronic = p.startsWith('/insurance/chronic')
  const isSchemes = p.startsWith('/insurance/schemes')
  const isAlerts = p.startsWith('/insurance/alerts')
  const isReports = p.startsWith('/insurance/reports')
  const isProfile = p.startsWith('/insurance/profile')

  const handleSignOut = async (): Promise<void> => {
    await signOut()
    navigate('/insurance/login')
  }

  return (
    <Shell>
      {/* ── Desktop sidebar ── */}
      <SidebarNav $bg={sidebarBg}>
        <Box
          p="lg"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}
        >
          <Box style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <TbShieldCheck
              size={22}
              color={accentColor}
            />
            <Box>
              <Text
                style={{
                  fontFamily: "'Nunito',sans-serif",
                  fontWeight: 800,
                  fontSize: 13,
                  color: '#fff',
                }}
              >
                Insurance Portal
              </Text>
              {staffInfo?.provider_name && (
                <Text
                  style={{
                    fontFamily: "'DM Sans',sans-serif",
                    fontSize: 11,
                    color: 'rgba(255,255,255,0.5)',
                  }}
                >
                  {staffInfo.provider_name}
                </Text>
              )}
            </Box>
          </Box>
        </Box>

        <Box
          pt="md"
          style={{ flex: 1 }}
        >
          <NavBtn
            $accent={accentColor}
            $active={isVerifications}
            onClick={() => navigate('/insurance/verifications')}
          >
            <TbShieldCheck size={16} />
            <span style={{ flex: 1, textAlign: 'left' }}>Verifications</span>
            {pendingMemberCount > 0 && (
              <NavBadge>{pendingMemberCount}</NavBadge>
            )}
          </NavBtn>
          <NavBtn
            $accent={accentColor}
            $active={isApprovals}
            onClick={() => navigate('/insurance/approvals')}
          >
            <TbClipboardCheck size={16} />
            <span style={{ flex: 1, textAlign: 'left' }}>Approvals</span>
            {approvalCount > 0 && <NavBadge>{approvalCount}</NavBadge>}
          </NavBtn>
          <NavBtn
            $accent={accentColor}
            $active={isOrders}
            onClick={() => navigate('/insurance/orders')}
          >
            <TbTruck size={16} />
            <span style={{ flex: 1, textAlign: 'left' }}>Orders</span>
            {chatUnread > 0 && <NavBadge>{chatUnread}</NavBadge>}
          </NavBtn>
          <NavBtn
            $accent={accentColor}
            $active={isCustomers}
            onClick={() => navigate('/insurance/customers')}
          >
            <TbUsers size={16} />
            <span style={{ flex: 1, textAlign: 'left' }}>Members</span>
          </NavBtn>
          <NavBtn
            $accent={accentColor}
            $active={isChronic}
            onClick={() => navigate('/insurance/chronic')}
          >
            <TbHeart size={16} />
            <span style={{ flex: 1, textAlign: 'left' }}>Chronic</span>
            {chronicOverdue > 0 && <NavBadge>{chronicOverdue}</NavBadge>}
          </NavBtn>
          <NavBtn
            $accent={accentColor}
            $active={isSchemes}
            onClick={() => navigate('/insurance/schemes')}
          >
            <TbSettings size={16} />
            <span style={{ flex: 1, textAlign: 'left' }}>Schemes</span>
          </NavBtn>
          <NavBtn
            $accent={accentColor}
            $active={isAlerts}
            onClick={() => navigate('/insurance/alerts')}
          >
            <TbBell size={16} />
            <span style={{ flex: 1, textAlign: 'left' }}>Alerts</span>
            {alertCount > 0 && <NavBadge>{alertCount}</NavBadge>}
          </NavBtn>
          <NavBtn
            $accent={accentColor}
            $active={isReports}
            onClick={() => navigate('/insurance/reports')}
          >
            <TbChartBar size={16} />
            <span style={{ flex: 1, textAlign: 'left' }}>Reports</span>
          </NavBtn>
        </Box>

        <Box
          p="md"
          style={{
            borderTop: '1px solid rgba(255,255,255,0.1)',
            marginTop: 'auto',
          }}
        >
          {staffInfo && (
            <Text
              style={{
                fontFamily: "'DM Sans',sans-serif",
                fontSize: 12,
                color: 'rgba(255,255,255,0.4)',
                marginBottom: 8,
                paddingLeft: 4,
              }}
            >
              {staffInfo.name}
            </Text>
          )}
          <NavBtn
            $accent={accentColor}
            onClick={() => navigate('/insurance/preferences')}
          >
            {isDark ? <TbMoon size={16} /> : <TbSun size={16} />}
            <span style={{ flex: 1, textAlign: 'left' }}>Preferences</span>
          </NavBtn>
          <NavBtn
            $accent={accentColor}
            $active={isProfile}
            onClick={() => navigate('/insurance/profile')}
          >
            <TbUser size={16} /> Profile
          </NavBtn>
          <NavBtn
            $accent={accentColor}
            onClick={handleSignOut}
          >
            <CiLogout size={16} /> Sign Out
          </NavBtn>
        </Box>
      </SidebarNav>

      <MainContent>
        {/* Mobile top header */}
        <MobileTopBar $bg={sidebarBg}>
          <TbShieldCheck
            size={20}
            color={accentColor}
          />
          <Text
            style={{
              color: '#fff',
              fontWeight: 700,
              fontFamily: "'Nunito',sans-serif",
              fontSize: 15,
              flex: 1,
            }}
          >
            {staffInfo?.provider_name ?? 'Insurance Portal'}
          </Text>
        </MobileTopBar>

        <Outlet />
        <InsuranceProfileSelector />
      </MainContent>

      {/* ── Mobile bottom navigation bar ── */}
      <BottomBar>
        <BottomItem
          $accent={accentColor}
          $active={isVerifications}
          onClick={() => navigate('/insurance/verifications')}
        >
          <Box style={{ position: 'relative', display: 'inline-flex' }}>
            <TbShieldCheck size={22} />
            {pendingMemberCount > 0 && (
              <BottomBadge>
                {pendingMemberCount > 9 ? '9+' : pendingMemberCount}
              </BottomBadge>
            )}
          </Box>
          <BottomLabel $active={isVerifications}>Verify</BottomLabel>
        </BottomItem>
        <BottomItem
          $accent={accentColor}
          $active={isApprovals}
          onClick={() => navigate('/insurance/approvals')}
        >
          <Box style={{ position: 'relative', display: 'inline-flex' }}>
            <TbClipboardCheck size={22} />
            {approvalCount > 0 && (
              <BottomBadge>
                {approvalCount > 9 ? '9+' : approvalCount}
              </BottomBadge>
            )}
          </Box>
          <BottomLabel $active={isApprovals}>Approvals</BottomLabel>
        </BottomItem>
        <BottomItem
          $accent={accentColor}
          $active={isOrders}
          onClick={() => navigate('/insurance/orders')}
        >
          <Box style={{ position: 'relative', display: 'inline-flex' }}>
            <TbTruck size={22} />
            {chatUnread > 0 && (
              <BottomBadge>{chatUnread > 9 ? '9+' : chatUnread}</BottomBadge>
            )}
          </Box>
          <BottomLabel $active={isOrders}>Orders</BottomLabel>
        </BottomItem>
        <BottomItem
          $accent={accentColor}
          $active={isCustomers}
          onClick={() => navigate('/insurance/customers')}
        >
          <TbUsers size={22} />
          <BottomLabel $active={isCustomers}>Members</BottomLabel>
        </BottomItem>
        <BottomItem
          $accent={accentColor}
          $active={isChronic}
          onClick={() => navigate('/insurance/chronic')}
        >
          <Box style={{ position: 'relative', display: 'inline-flex' }}>
            <TbHeart size={22} />
            {chronicOverdue > 0 && (
              <BottomBadge>
                {chronicOverdue > 9 ? '9+' : chronicOverdue}
              </BottomBadge>
            )}
          </Box>
          <BottomLabel $active={isChronic}>Chronic</BottomLabel>
        </BottomItem>
        <BottomItem
          $accent={accentColor}
          $active={isSchemes}
          onClick={() => navigate('/insurance/schemes')}
        >
          <TbSettings size={22} />
          <BottomLabel $active={isSchemes}>Schemes</BottomLabel>
        </BottomItem>
        <BottomItem
          $accent={accentColor}
          $active={isAlerts}
          onClick={() => navigate('/insurance/alerts')}
        >
          <Box style={{ position: 'relative', display: 'inline-flex' }}>
            <TbBell size={22} />
            {alertCount > 0 && (
              <BottomBadge>{alertCount > 9 ? '9+' : alertCount}</BottomBadge>
            )}
          </Box>
          <BottomLabel $active={isAlerts}>Alerts</BottomLabel>
        </BottomItem>
        <BottomItem
          $accent={accentColor}
          $active={isReports}
          onClick={() => navigate('/insurance/reports')}
        >
          <TbChartBar size={22} />
          <BottomLabel $active={isReports}>Reports</BottomLabel>
        </BottomItem>
      </BottomBar>
    </Shell>
  )
}

// Wrap with InsuranceStaffProvider so all insurance pages have access to staff context
export function InsuranceLayoutWithProviders(): JSX.Element {
  return (
    <InsuranceStaffProvider>
      <InsuranceLayout />
    </InsuranceStaffProvider>
  )
}

