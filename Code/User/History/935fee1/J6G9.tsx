import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Text, Group, Badge, Button, ScrollArea, ActionIcon, Modal, Stack,
} from '@mantine/core'
import {
  TbBell, TbShieldCheck, TbShieldOff, TbShield,
  TbUser, TbMessage2, TbPackage, TbCurrencyDollar,
  TbArrowLeft, TbTrash, TbMailOpened, TbMail, TbX,
} from 'react-icons/tb'
import styled from 'styled-components'
import { SavedColors } from '@shared/constants'
import { useAuth } from '../../../features/auth/context/AuthContext'
import { supabase, DbNotification } from '../../../lib/supabase'
import { NavHeaderBar, NavHeaderTitle, PageWrapper } from '@shared/ui/layout'

// ─── Helpers ──────────────────────────────────────────────────────────────────
const notifAccent = (type: string): string => {
  if (type === 'insurance_verified')  return '#12B76A'
  if (type === 'insurance_rejected')  return '#EF4444'
  if (type === 'insurance_submitted') return '#F59F00'
  if (type === 'profile_updated')     return '#6366F1'
  if (type === 'new_message')         return '#8B5CF6'
  if (type === 'delivered')           return '#12B76A'
  if (type === 'out_for_delivery')    return SavedColors.Primaryblue
  if (type === 'order_status_change') return SavedColors.Primaryblue
  if (type.includes('deliver') || type.includes('dispatch')) return SavedColors.Primaryblue
  if (type.includes('insurance'))     return '#F59F00'
  if (type === 'pricing_ready')       return '#F59F00'
  if (type === 'payment_confirmed')   return '#12B76A'
  return SavedColors.Primaryblue
}

const notifIcon = (type: string): JSX.Element => {
  if (type === 'delivered' || type === 'out_for_delivery') return <TbPackage size={14} />
  if (type.includes('deliver') || type.includes('dispatch')) return <TbPackage size={14} />
  if (type === 'insurance_verified') return <TbShieldCheck size={14} />
  if (type === 'insurance_rejected') return <TbShieldOff size={14} />
  if (type.includes('insurance'))    return <TbShield size={14} />
  if (type === 'profile_updated')    return <TbUser size={14} />
  if (type === 'new_message')        return <TbMessage2 size={14} />
  if (type === 'pricing_ready')      return <TbCurrencyDollar size={14} />
  if (type === 'payment_confirmed')  return <TbCurrencyDollar size={14} />
  return <TbBell size={14} />
}

function getNotifRoute(n: DbNotification): string {
  const t     = n.type ?? ''
  const title = (n.title ?? '').toLowerCase()
  const body  = (n.body  ?? '').toLowerCase()
  const oid   = n.order_id
  if (t === 'profile_updated') return '/personal-info'
  if (t === 'new_message' && oid) return `/order/${oid}`
  if (t === 'insurance_verified' || t === 'insurance_rejected' || t === 'insurance_submitted') return '/insurance-management'
  if (!oid) return '/order-history'
  if (t === 'delivery_request' || t === 'out_for_delivery' || t === 'delivered' ||
      title.includes('out for delivery') || body.includes('qr code') || body.includes('rider is'))
    return `/order/${oid}/delivery`
  if (t === 'pricing_ready' || title.includes('pricing') ||
      body.includes('review and confirm') || body.includes('confirm to proceed'))
    return `/order/${oid}/breakdown`
  return `/order/${oid}`
}

// ─── Styled ───────────────────────────────────────────────────────────────────
const Shell = styled.div`
  min-height: calc(100vh - 54px);
  background: ${SavedColors.bgWhite};
  display: flex;
  flex-direction: column;
`

const NotifRow = styled.div<{ $unread: boolean }>`
  display: flex;
  gap: 12px;
  align-items: flex-start;
  padding: 14px 16px;
  background: ${p => p.$unread ? '#F0F9FF' : '#fff'};
  border-bottom: 1px solid #f3f4f6;
  transition: background 0.15s;
  position: relative;
`

const NotifContent = styled.div`
  display: flex;
  gap: 12px;
  align-items: flex-start;
  flex: 1;
  cursor: pointer;
  min-width: 0;
  &:hover { opacity: 0.85; }
`

const IconCircle = styled.div<{ $color: string; $bg: string }>`
  width: 36px; height: 36px; border-radius: 50%; flex-shrink: 0;
  background: ${p => p.$bg};
  border: 1.5px solid ${p => p.$color}40;
  display: flex; align-items: center; justify-content: center;
  color: ${p => p.$color};
  margin-top: 1px;
`

const ActionBar = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  padding-top: 2px;
`

// ─── Component ────────────────────────────────────────────────────────────────
export default function Notifications(): JSX.Element {
  const navigate = useNavigate()
  const { user, selectedProfile, profiles } = useAuth()
  const [notifs, setNotifs]         = useState<DbNotification[]>([])
  const [clearOpen, setClearOpen]   = useState(false)
  const [clearing, setClearing]     = useState(false)
  const seenIdsRef = useRef<Set<string>>(new Set())
  const seededRef  = useRef(false)

  const mainProfile   = profiles.find(p => p.is_main_account) ?? profiles[0]
  const activeProfile = selectedProfile ?? mainProfile

  const profileNotifs = notifs.filter(n => {
    if (!n.order_id && !n.profile_id) return true
    if (n.profile_id) return n.profile_id === activeProfile?.id
    return true
  })
  const unread = profileNotifs.filter(n => !n.is_read).length

  const fetchNotifs = (): void => {
    if (!user) return
    supabase.from('notifications').select('*').eq('user_id', user.id)
      .order('created_at', { ascending: false }).limit(50)
      .then(({ data }) => {
        if (!data) return
        const incoming = data as DbNotification[]
        setNotifs(incoming)
        if (!seededRef.current) {
          seededRef.current = true
          incoming.forEach(n => seenIdsRef.current.add(n.id))
        }
      })
  }

  useEffect(() => {
    if (!user) return
    fetchNotifs()
    const ch = supabase.channel('notifs-page:' + user.id)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: 'user_id=eq.' + user.id }, () => fetchNotifs())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Actions ── */
  const markRead = async (id: string): Promise<void> => {
    await supabase.from('notifications').update({ is_read: true, read_at: new Date().toISOString() }).eq('id', id)
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
  }

  const markUnread = async (id: string): Promise<void> => {
    await supabase.from('notifications').update({ is_read: false, read_at: null }).eq('id', id)
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, is_read: false } : n))
  }

  const toggleRead = async (id: string, currentlyRead: boolean): Promise<void> => {
    if (currentlyRead) await markUnread(id)
    else await markRead(id)
  }

  const deleteNotif = async (id: string): Promise<void> => {
    await supabase.from('notifications').delete().eq('id', id)
    setNotifs(prev => prev.filter(n => n.id !== id))
  }

  const markAllRead = async (): Promise<void> => {
    const ids = profileNotifs.filter(n => !n.is_read).map(n => n.id)
    if (!ids.length) return
    await supabase.from('notifications').update({ is_read: true, read_at: new Date().toISOString() }).in('id', ids)
    setNotifs(prev => prev.map(n => ({ ...n, is_read: true })))
  }

  const clearAllRead = async (): Promise<void> => {
    setClearing(true)
    const ids = profileNotifs.filter(n => n.is_read).map(n => n.id)
    if (ids.length) {
      await supabase.from('notifications').delete().in('id', ids)
      setNotifs(prev => prev.filter(n => !ids.includes(n.id)))
    }
    setClearing(false)
    setClearOpen(false)
  }

  const handleRowClick = async (n: DbNotification): Promise<void> => {
    if (!n.is_read) await markRead(n.id)
    navigate(getNotifRoute(n))
  }

  const readCount = profileNotifs.filter(n => n.is_read).length

  return (
    <PageWrapper>
      <NavHeaderBar>
        <Button variant="subtle" color="lotusCyan" leftSection={<TbArrowLeft size={16} />}
          onClick={() => navigate(-1)}
          style={{ fontFamily: "'DM Sans',sans-serif", fontWeight: 600, fontSize: 13 }}>
          Back
        </Button>
        <NavHeaderTitle>Notifications</NavHeaderTitle>
      </NavHeaderBar>

      <Shell>
        {/* ── Header strip ── */}
        <Box px={16} py={10} style={{ background: '#fff', borderBottom: '1px solid #eef2f8' }}>
          <Group justify="space-between" align="center">
            <Group gap={6}>
              <TbBell size={16} color={SavedColors.Primaryblue} />
              <Text size="sm" fw={700} c={SavedColors.TextColor} style={{ fontFamily: "'DM Sans',sans-serif" }}>
                {unread > 0 ? `${unread} unread` : 'All caught up'}
              </Text>
              {unread > 0 && <Badge color="red" size="xs" circle>{unread > 9 ? '9+' : unread}</Badge>}
            </Group>
            <Group gap={6}>
              {unread > 0 && (
                <Button size="xs" variant="subtle" color="lotusCyan" onClick={markAllRead}
                  leftSection={<TbMailOpened size={13} />}
                  style={{ fontFamily: "'DM Sans',sans-serif" }}>
                  All read
                </Button>
              )}
              {readCount > 0 && (
                <Button size="xs" variant="subtle" color="red" onClick={() => setClearOpen(true)}
                  leftSection={<TbTrash size={13} />}
                  style={{ fontFamily: "'DM Sans',sans-serif" }}>
                  Clear read
                </Button>
              )}
            </Group>
          </Group>
        </Box>

        {/* ── List ── */}
        <ScrollArea style={{ flex: 1 }}>
          {profileNotifs.length === 0 ? (
            <Box ta="center" py={60} px="md">
              <Box style={{ width: 64, height: 64, borderRadius: '50%', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <TbBell size={28} color="#d1d5db" />
              </Box>
              <Text size="sm" fw={600} c={SavedColors.TextColor} style={{ fontFamily: "'DM Sans',sans-serif" }}>No notifications yet</Text>
              <Text size="xs" c="dimmed" mt={4}>You'll be notified when your order status changes.</Text>
            </Box>
          ) : profileNotifs.map(n => {
            const accent = notifAccent(n.type ?? '')
            const bg     = n.is_read ? '#f3f4f6' : `${accent}18`
            return (
              <NotifRow key={n.id} $unread={!n.is_read}>
                {/* ── Clickable content area ── */}
                <NotifContent onClick={() => handleRowClick(n)}>
                  <IconCircle $color={n.is_read ? '#9ca3af' : accent} $bg={bg}>
                    {notifIcon(n.type ?? '')}
                  </IconCircle>
                  <Box style={{ flex: 1, minWidth: 0 }}>
                    <Group gap={4} wrap="nowrap" mb={2}>
                      <Text size="sm" fw={n.is_read ? 500 : 700} c={SavedColors.TextColor}
                        style={{ flex: 1, lineHeight: 1.4, fontFamily: "'DM Sans',sans-serif" }}>
                        {n.title}
                      </Text>
                      {!n.is_read && (
                        <Box style={{ width: 7, height: 7, borderRadius: '50%', background: '#EF4444', flexShrink: 0, marginTop: 3 }} />
                      )}
                    </Group>
                    <Text size="xs" c="dimmed" lh={1.45}>{n.body}</Text>
                    <Text size="xs" c="dimmed" mt={4} style={{ fontSize: 10, fontFamily: "'DM Sans',sans-serif" }}>
                      {new Date(n.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </Box>
                </NotifContent>

                {/* ── Per-row actions ── */}
                <ActionBar>
                  <ActionIcon
                    size="sm" variant="subtle"
                    color={n.is_read ? 'blue' : 'gray'}
                    title={n.is_read ? 'Mark as unread' : 'Mark as read'}
                    onClick={e => { e.stopPropagation(); toggleRead(n.id, n.is_read) }}
                  >
                    {n.is_read ? <TbMail size={14} /> : <TbMailOpened size={14} />}
                  </ActionIcon>
                  <ActionIcon
                    size="sm" variant="subtle" color="red"
                    title="Delete notification"
                    onClick={e => { e.stopPropagation(); deleteNotif(n.id) }}
                  >
                    <TbX size={14} />
                  </ActionIcon>
                </ActionBar>
              </NotifRow>
            )
          })}
        </ScrollArea>
      </Shell>

      {/* ── Clear read confirmn modal ── */}
      <Modal
        opened={clearOpen}
        onClose={() => { if (!clearing) setClearOpen(false) }}
        centered size="xs" radius="md" withCloseButton={false}
      >
        <Stack align="center" gap="md" py="xs">
          <Box style={{ width: 48, height: 48, borderRadius: '50%', background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <TbTrash size={22} color="#EF4444" />
          </Box>
          <Box ta="center">
            <Text fw={700} size="md" c="#1A2B3C" style={{ fontFamily: "'DM Sans',sans-serif" }}>
              Clear {readCount} read notification{readCount !== 1 ? 's' : ''}?
            </Text>
            <Text size="sm" c="dimmed" mt={4}>This can't be undone.</Text>
          </Box>
          <Group gap="sm" w="100%">
            <Button flex={1} variant="default" radius={8} onClick={() => setClearOpen(false)}>Cancel</Button>
            <Button flex={1} color="red" radius={8} loading={clearing} onClick={clearAllRead}
              leftSection={<TbTrash size={14} />}>
              Clear
            </Button>
          </Group>
        </Stack>
      </Modal>
    </PageWrapper>
  )
}
