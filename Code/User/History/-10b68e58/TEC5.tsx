import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Text,
  Stack,
  Loader,
  Center,
  CopyButton,
  Tooltip,
  ActionIcon,
  Badge,
  Group,
  Divider,
} from '@mantine/core'
import {
  TbCheck,
  TbCopy,
  TbExternalLink,
  TbPhone,
  TbLock,
  TbUserCheck,
} from 'react-icons/tb'
import styled from 'styled-components'
import { SavedColors } from '@shared/constants'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../features/auth/context/AuthContext'

interface ServiceAccount {
  insurance_provider: string
  phone: string
  display_name: string
}

interface StaffInfo {
  provider_name: string
}

const Card = styled.div`
  background: #fff;
  border: 1.5px solid ${SavedColors.DemWhite};
  border-radius: 14px;
  padding: 28px;
  max-width: 540px;
`

const CredRow = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 14px 16px;
`

const Label = styled.span`
  font-family: 'DM Sans', sans-serif;
  font-size: 11px;
  font-weight: 600;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  display: block;
  margin-bottom: 2px;
`

const Value = styled.span`
  font-family: 'Roboto Mono', monospace;
  font-size: 15px;
  font-weight: 600;
  color: ${SavedColors.TextColor};
`

const StepBubble = styled.div`
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: ${SavedColors.Primaryblue};
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
`

export default function InsuranceOrderOnBehalf(): JSX.Element {
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const [account, setAccount] = useState<ServiceAccount | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async (): Promise<void> => {
      const { data: si } = await supabase.rpc('get_my_insurance_staff_info')
      if (!si) return
      const providerName = (si as StaffInfo).provider_name
      const { data } = await supabase
        .from('insurance_service_accounts')
        .select('insurance_provider, phone, display_name')
        .eq('insurance_provider', providerName)
        .maybeSingle()
      if (data) setAccount(data as ServiceAccount)
      setLoading(false)
    }
    load()
  }, [])

  const handleLoginAsCustomer = async (): Promise<void> => {
    await signOut()
    navigate('/')
  }

  if (loading)
    return (
      <Center h="60vh">
        <Loader color="lotusCyan" />
      </Center>
    )

  const steps = [
    'Click "Open Customer Portal" below — this will sign you out of the Insurance Portal.',
    `Log in using the phone number and password shown below.`,
    'Search for the patient by name, then select their profile.',
    'Upload their prescription and complete the order as normal.',
    'When done, log out of the customer portal and log back in here.',
  ]

  return (
    <Box
      p={{ base: 'md', sm: 'xl' }}
      style={{ maxWidth: 700, m}}
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
        Order on Behalf of Customer
      </Text>
      <Text
        c="dimmed"
        size="sm"
        mb="xl"
      >
        For patients who do not have a smartphone — use the shared customer
        account below.
      </Text>

      {account ? (
        <Stack gap="xl">
          {/* Credentials card */}
          <Card>
            <Group
              gap={10}
              mb="md"
            >
              <TbUserCheck
                size={20}
                color={SavedColors.Primaryblue}
              />
              <Text
                style={{
                  fontFamily: "'Nunito',sans-serif",
                  fontWeight: 800,
                  fontSize: 15,
                  color: SavedColors.TextColor,
                }}
              >
                Shared Customer Account
              </Text>
              <Badge
                color="teal"
                variant="light"
                size="sm"
              >
                Active
              </Badge>
            </Group>

            <Stack gap="sm">
              {/* Phone */}
              <CredRow>
                <TbPhone
                  size={18}
                  color={SavedColors.Primaryblue}
                  style={{ flexShrink: 0 }}
                />
                <Box style={{ flex: 1 }}>
                  <Label>Phone Number</Label>
                  <Value>{account.phone}</Value>
                </Box>
                <CopyButton
                  value={account.phone}
                  timeout={2000}
                >
                  {({ copied, copy }) => (
                    <Tooltip
                      label={copied ? 'Copied!' : 'Copy'}
                      withArrow
                    >
                      <ActionIcon
                        color={copied ? 'teal' : 'gray'}
                        variant="subtle"
                        onClick={copy}
                        size="md"
                      >
                        {copied ? <TbCheck size={16} /> : <TbCopy size={16} />}
                      </ActionIcon>
                    </Tooltip>
                  )}
                </CopyButton>
              </CredRow>

              {/* Password */}
              <CredRow>
                <TbLock
                  size={18}
                  color={SavedColors.Primaryblue}
                  style={{ flexShrink: 0 }}
                />
                <Box style={{ flex: 1 }}>
                  <Label>Password</Label>
                  <Value>Customer1234!</Value>
                </Box>
                <CopyButton
                  value="Customer1234!"
                  timeout={2000}
                >
                  {({ copied, copy }) => (
                    <Tooltip
                      label={copied ? 'Copied!' : 'Copy'}
                      withArrow
                    >
                      <ActionIcon
                        color={copied ? 'teal' : 'gray'}
                        variant="subtle"
                        onClick={copy}
                        size="md"
                      >
                        {copied ? <TbCheck size={16} /> : <TbCopy size={16} />}
                      </ActionIcon>
                    </Tooltip>
                  )}
                </CopyButton>
              </CredRow>
            </Stack>

            <Divider my="lg" />

            {/* Open Portal button */}
            <button
              onClick={handleLoginAsCustomer}
              style={{
                width: '100%',
                padding: '13px 0',
                background: SavedColors.Primaryblue,
                color: '#fff',
                border: 'none',
                borderRadius: 10,
                fontFamily: "'DM Sans',sans-serif",
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <TbExternalLink size={17} />
              Open Customer Portal
            </button>

            <Text
              size="xs"
              c="dimmed"
              ta="center"
              mt="xs"
            >
              You will be signed out of the Insurance Portal
            </Text>
          </Card>

          {/* Steps */}
          <Box maw={540}>
            <Text
              style={{
                fontFamily: "'DM Sans',sans-serif",
                fontWeight: 700,
                fontSize: 13,
                color: SavedColors.TextColor,
                marginBottom: 12,
              }}
            >
              How it works
            </Text>
            <Stack gap="sm">
              {steps.map((step, i) => (
                <Group
                  key={i}
                  gap={12}
                  align="flex-start"
                >
                  <StepBubble>{i + 1}</StepBubble>
                  <Text
                    size="sm"
                    c="dimmed"
                    style={{ flex: 1, paddingTop: 3 }}
                  >
                    {step}
                  </Text>
                </Group>
              ))}
            </Stack>
          </Box>
        </Stack>
      ) : (
        <Card>
          <Text
            c="dimmed"
            size="sm"
          >
            No service account found for your insurance provider. Please contact
            your administrator.
          </Text>
        </Card>
      )}
    </Box>
  )
}

