import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Avatar,
  Badge,
  Box,
  Container,
  Group,
  Stack,
  Text,
  Loader,
  Center,
  SimpleGrid,
} from '@mantine/core'
import {
  TbUpload,
  TbChevronRight,
  TbShieldCheck,
  TbTruck,
  TbPill,
  TbClipboardList,
  TbPlus,
} from 'react-icons/tb'
import styled, { keyframes } from 'styled-components'
import { SavedColors } from '@shared/constants'
import { ContentCard } from '@shared/ui/layout'
import { useAuth } from '../../../features/auth/context/AuthContext'
import { supabase, DbOrder } from '../../../lib/supabase'
import { formatRelativeTime } from '../../../shared/utils/formatTime'
import { Button } from '@mantine/core'
const fadeUp = keyframes`from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}`
const Appear = styled.div<{ $delay?: number }>`
  animation: ${fadeUp} 0.4s ease both;
  animation-delay: ${(p) => p.$delay || 0}ms;
`

const ActionCard = styled.button<{ $primary?: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
  padding: 20px;
  border: none;
  border-radius: 16px;
  cursor: pointer;
  width: 100%;
  text-align: left;
  transition:
    transform 0.18s,
    box-shadow 0.18s;
  background: ${(p) =>
    p.$primary ? 'linear-gradient(135deg, #012970 0%, #15B3E0 100%)' : '#fff'};
  border: ${(p) =>
    p.$primary ? 'none' : `1.5px solid ${SavedColors.DemWhite}`};
  box-shadow: ${(p) =>
    p.$primary
      ? '0 6px 20px rgba(21,179,224,0.28)'
      : '0 2px 8px rgba(1,41,112,0.06)'};
  &:hover {
    transform: translateY(-2px);
    box-shadow: ${(p) =>
      p.$primary
        ? '0 10px 28px rgba(21,179,224,0.38)'
        : '0 6px 16px rgba(1,41,112,0.1)'};
  }
`
const ActionIconWrap = styled.div<{ $primary?: boolean }>`
  width: 42px;
  height: 42px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${(p) =>
    p.$primary ? 'rgba(255,255,255,0.2)' : SavedColors.lightBlue};
`

const OrderRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-radius: 12px;
  cursor: pointer;
  background: ${SavedColors.bgWhite};
  border: 1.5px solid ${SavedColors.DemWhite};
  transition:
    border-color 0.15s,
    box-shadow 0.15s;
  &:hover {
    border-color: ${SavedColors.Primaryblue};
    box-shadow: 0 2px 10px rgba(21, 179, 224, 0.12);
  }
`

const AVATAR_COLORS = [
  'linear-gradient(135deg,#15B3E0,#0891B2)',
  'linear-gradient(135deg,#7C3AED,#5B21B6)',
  'linear-gradient(135deg,#D97706,#B45309)',
  'linear-gradient(135deg,#059669,#047857)',
]

const statusColor = (s: string): string =>
  ({
    delivered: 'teal',
    prescription_uploaded: 'blue',
    pricing_ready: 'blue',
    awaiting_confirmation: 'orange',
    out_for_delivery: 'cyan',
    rejected: 'red',
    cancelled: 'gray',
  })[s] ?? 'gray'

const statusLabel = (s: string): string =>
  s
    .split('_')
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ')

export default function Dashboard(): JSX.Element {
  const navigate = useNavigate()
  const { user, profiles, selectedProfile } = useAuth()
  const [orders, setOrders] = useState<DbOrder[]>([])
  const [loading, setLoading] = useState(true)

  // Derive active profile — selectedProfile is the source of truth
  const activeProfile =
    selectedProfile ?? profiles.find((p) => p.is_main_account) ?? profiles[0]

  useEffect(() => {
    if (!user || !activeProfile) return

    setLoading(true)

    const fetch = () =>
      supabase
        .from('orders')
        .select('*, medications(*), profiles(name)')
        .eq('user_id', user.id)
        .eq('profile_id', activeProfile.id) // ← filter by selected profile
        .order('created_at', { ascending: false })
        .limit(8)
        .then(({ data }) => {
          if (data) setOrders(data as DbOrder[])
          setLoading(false)
        })

    fetch()

    // Re-subscribe with new profile filter when profile changes
    const ch = supabase
      .channel(`dashboard-orders:${user.id}:${activeProfile.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `profile_id=eq.${activeProfile.id}`,
        },
        () => fetch(),
      )
      .subscribe()

    return () => {
      supabase.removeChannel(ch)
    }
  }, [user?.id, activeProfile?.id]) // re-run when profile changes

  const activeOrders = orders.filter(
    (o) => !['delivered', 'cancelled', 'rejected'].includes(o.status),
  )
  const recentOrders = orders.slice(0, 5)

  return (
    <Container
      size="md"
      py="lg"
      px="md"
    >
      {/* ── Active order highlight ── */}
      {activeOrders.length > 0 && (
        <Appear $delay={60}>
          <Box
            mb="xl"
            style={{
              background: 'linear-gradient(135deg,#012970 0%,#15B3E0 100%)',
              borderRadius: 18,
              padding: '18px 20px',
              cursor: 'pointer',
              boxShadow: '0 6px 24px rgba(1,41,112,0.2)',
            }}
            onClick={() => navigate('/order/' + activeOrders[0].id)}
          >
            <Group
              justify="space-between"
              align="center"
            >
              <Box>
                <Text
                  size="xs"
                  fw={600}
                  c="rgba(255,255,255,0.65)"
                  mb={3}
                  style={{
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                  }}
                >
                  Active Order
                </Text>
                <Text
                  fw={800}
                  c="#fff"
                  size="lg"
                  style={{ fontFamily: "'Nunito',sans-serif" }}
                >
                  #{activeOrders[0].order_number}
                </Text>
                <Badge
                  mt={6}
                  size="sm"
                  variant="white"
                  color="blue"
                  style={{
                    background: 'rgba(255,255,255,0.18)',
                    color: '#fff',
                    border: '1px solid rgba(255,255,255,0.3)',
                  }}
                >
                  {statusLabel(activeOrders[0].status)}
                </Badge>
              </Box>
              <Box
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Box
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    background: 'rgba(255,255,255,0.18)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <TbTruck
                    size={22}
                    color="#fff"
                  />
                </Box>
                <TbChevronRight
                  size={16}
                  color="rgba(255,255,255,0.6)"
                />
              </Box>
            </Group>
            {activeOrders.length > 1 && (
              <Text
                size="xs"
                c="rgba(255,255,255,0.5)"
                mt={8}
              >
                +{activeOrders.length - 1} more active order
                {activeOrders.length > 2 ? 's' : ''}
              </Text>
            )}
          </Box>
        </Appear>
      )}

      {/* ── Quick actions ── */}
      <Appear $delay={120}>
        <SimpleGrid
          cols={2}
          spacing="md"
          mb="xl"
        >
          <ActionCard
            $primary
            onClick={() => navigate('/upload-prescription')}
          >
            <ActionIconWrap $primary>
              <TbUpload
                size={20}
                color="#fff"
              />
            </ActionIconWrap>
            <Box>
              <Text
                fw={700}
                c="#fff"
                size="sm"
              >
                Upload
              </Text>
              <Text
                size="xs"
                c="rgba(255,255,255,0.7)"
              >
                New prescription
              </Text>
            </Box>
          </ActionCard>
          <ActionCard onClick={() => navigate('/order-history')}>
            <ActionIconWrap>
              <TbClipboardList
                size={20}
                color={SavedColors.Primaryblue}
              />
            </ActionIconWrap>
            <Box>
              <Text
                fw={700}
                c={SavedColors.TextColor}
                size="sm"
              >
                Orders
              </Text>
              <Text
                size="xs"
                c="dimmed"
              >
                {orders.length} total
              </Text>
            </Box>
          </ActionCard>
        </SimpleGrid>
      </Appear>

      {/* ── Family profiles row ── */}
      <Appear $delay={180}>
        <ContentCard
          mb="xl"
          style={{ padding: '16px 18px', overflow: 'hidden' }}
        >
          <Group
            justify="space-between"
            mb="md"
          >
            <Text
              fw={700}
              size="sm"
              c={SavedColors.TextColor}
            >
              Family Profiles
            </Text>
            <Button
              variant="subtle"
              size="xs"
              color="lotusCyan"
              rightSection={<TbChevronRight size={12} />}
              onClick={() =>
                window.dispatchEvent(new CustomEvent('open-profile-picker'))
              }
            >
              Manage
            </Button>
          </Group>
          <Group
            gap="sm"
            wrap="nowrap"
            style={{
              overflowX: 'auto',
              paddingBottom: 4,
              paddingTop: 2,
              minWidth: 0,
            }}
          >
            {profiles.map((p, i) => {
              const insuranceStatus = (
                p.insurance as { status?: string } | null
              )?.status
              const isSelected = activeProfile?.id === p.id
              return (
                <Box
                  key={p.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 5,
                    cursor: 'pointer',
                    flexShrink: 0,
                    width: 72,
                  }}
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent('open-profile-picker'))
                  }}
                >
                  <Box style={{ position: 'relative' }}>
                    <Box
                      style={{
                        width: 52,
                        height: 52,
                        borderRadius: '50%',
                        background: AVATAR_COLORS[i % AVATAR_COLORS.length],
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontFamily: "'Nunito',sans-serif",
                        fontWeight: 800,
                        fontSize: 20,
                        color: '#fff',
                        boxShadow: isSelected
                          ? '0 0 0 3px #15B3E0'
                          : '0 2px 8px rgba(0,0,0,0.12)',
                        transition: 'box-shadow 0.2s',
                        flexShrink: 0,
                      }}
                    >
                      {(p as { photo_url?: string }).photo_url ? (
                        <Avatar
                          size={52}
                          radius="xl"
                          src={(p as { photo_url?: string }).photo_url}
                        />
                      ) : (
                        p.name[0].toUpperCase()
                      )}
                    </Box>
                    {insuranceStatus === 'verified' && (
                      <Box
                        style={{
                          position: 'absolute',
                          bottom: 0,
                          right: 0,
                          width: 16,
                          height: 16,
                          borderRadius: '50%',
                          background: '#12B76A',
                          border: '2px solid #fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <TbShieldCheck
                          size={9}
                          color="#fff"
                        />
                      </Box>
                    )}
                  </Box>
                  <Text
                    size="xs"
                    fw={isSelected ? 700 : 600}
                    c={
                      isSelected
                        ? SavedColors.Primaryblue
                        : SavedColors.TextColor
                    }
                    ta="center"
                    style={{
                      width: 72,
                      height: '2.6em',
                      lineHeight: 1.3,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      wordBreak: 'break-word',
                      whiteSpace: 'normal',
                      overflow: 'hidden',
                    }}
                  >
                    {p.name}
                  </Text>
                </Box>
              )
            })}
            <Box
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 5,
                cursor: 'pointer',
                flexShrink: 0,
                minWidth: 64,
              }}
              onClick={() => navigate('/add-profile')}
            >
              <Box
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: '50%',
                  background: SavedColors.DemWhite,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: `2px dashed ${SavedColors.DarkWhite}`,
                }}
              >
                <TbPlus
                  size={20}
                  color={SavedColors.DarkWhite}
                />
              </Box>
              <Text
                size="xs"
                fw={500}
                c="dimmed"
              >
                Add
              </Text>
            </Box>
          </Group>
        </ContentCard>
      </Appear>

      {/* ── Recent orders ── */}
      <Appear $delay={240}>
        <Group
          justify="space-between"
          mb="sm"
        >
          <Text
            fw={700}
            size="sm"
            c={SavedColors.TextColor}
          >
            Recent Orders
          </Text>
          <Button
            variant="subtle"
            size="xs"
            color="lotusCyan"
            rightSection={<TbChevronRight size={12} />}
            onClick={() => navigate('/order-history')}
          >
            See all
          </Button>
        </Group>

        {loading ? (
          <Center py="xl">
            <Loader
              color="lotusCyan"
              size="sm"
            />
          </Center>
        ) : recentOrders.length === 0 ? (
          <Box
            ta="center"
            py="xl"
            style={{
              background: '#fff',
              borderRadius: 16,
              border: `1.5px dashed ${SavedColors.DemWhite}`,
            }}
          >
            <TbPill
              size={36}
              color={SavedColors.DarkWhite}
              style={{ margin: '0 auto 8px' }}
            />
            <Text
              c="dimmed"
              size="sm"
              fw={500}
            >
              No orders for {activeProfile?.name ?? 'this profile'}
            </Text>
            <Button
              mt="md"
              color="lotusCyan"
              size="xs"
              leftSection={<TbUpload size={13} />}
              onClick={() => navigate('/upload-prescription')}
            >
              Upload a prescription
            </Button>
          </Box>
        ) : (
          <Stack gap="xs">
            {recentOrders.map((order) => (
              <OrderRow
                key={order.id}
                onClick={() => {
                  if (order.status === 'awaiting_confirmation') {
                    navigate('/order/' + order.id + '/breakdown')
                  } else {
                    navigate('/order/' + order.id)
                  }
                }}
              >
                <Group
                  gap="md"
                  style={{ flex: 1, minWidth: 0 }}
                >
                  <Box
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 10,
                      background: SavedColors.lightBlue,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <TbPill
                      size={18}
                      color={SavedColors.Primaryblue}
                    />
                  </Box>
                  <Box style={{ minWidth: 0 }}>
                    <Text
                      size="sm"
                      fw={700}
                      c={SavedColors.TextColor}
                    >
                      #{order.order_number}
                    </Text>
                    <Text
                      size="xs"
                      c="dimmed"
                      style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {(order.profiles as { name: string } | null)?.name} ·{' '}
                      {formatRelativeTime(order.created_at)}
                    </Text>
                  </Box>
                </Group>
                <Group
                  gap="sm"
                  style={{ flexShrink: 0 }}
                >
                  <Badge
                    size="xs"
                    color={
                      order.status === 'awaiting_confirmation'
                        ? 'orange'
                        : statusColor(order.status)
                    }
                    variant="light"
                  >
                    {order.status === 'awaiting_confirmation'
                      ? 'Review Pricing'
                      : statusLabel(order.status)}
                  </Badge>
                  <TbChevronRight
                    size={14}
                    color={SavedColors.DarkWhite}
                  />
                </Group>
              </OrderRow>
            ))}
          </Stack>
        )}
      </Appear>
    </Container>
  )
}

