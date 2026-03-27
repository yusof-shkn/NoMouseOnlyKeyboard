import { useState } from 'react'
import {
  TbTruck,
  TbMapPin,
  TbQrcode,
  TbPackage,
  TbArrowRight,
  TbLock,
} from 'react-icons/tb'
import { Stack } from '@mantine/core'
import PortalLoginLayout, {
  LoginInputWrap,
  LoginPrimaryBtn,
  PortalDesktopHeader,
} from '../../components/PortalLoginLayout'
import {
  CountryPhoneInput,
  type PhoneValue,
} from '../../components/CountryPhoneInput'
import { usePortalLogin } from '../../../features/auth/otp/usePortalOTPLogin'
import styled from 'styled-components'

const GRADIENT =
  'linear-gradient(170deg,#011a4a 0%,#012970 40%,#0d5fa4 75%,#15B3E0 100%)'
const FEATURES = [
  {
    icon: (
      <TbMapPin
        size={18}
        color="#fff"
      />
    ),
    title: 'Live Dispatch',
    desc: 'Receive and accept delivery assignments',
  },
  {
    icon: (
      <TbQrcode
        size={18}
        color="#fff"
      />
    ),
    title: 'QR Confirmation',
    desc: 'Scan customer QR codes to confirm delivery',
  },
  {
    icon: (
      <TbPackage
        size={18}
        color="#fff"
      />
    ),
    title: 'Delivery History',
    desc: 'View your completed delivery records',
  },
]
const OTHER_PORTALS = [
  { to: '/login', label: 'Customer App' },
  { to: '/pharmacy/login', label: 'Pharmacy Staff' },
  { to: '/insurance/login', label: 'Insurance Staff' },
]

const PwdWrap = styled.div`
  input[type='password'] {
    width: 100%;
    height: 48px;
    border: 1.5px solid #e4e9f0;
    border-radius: 12px;
    font-family: 'DM Sans', sans-serif;
    font-size: 14px;
    color: #1a2b3c;
    background: #fafbfd;
    padding-left: 38px;
    padding-right: 14px;
    outline: none;
    box-sizing: border-box;
  }
`

export default function DeliveryLogin(): JSX.Element {
  const { loading, onSubmit } = usePortalLogin({
    allowedRoles: ['delivery', 'admin'],
    roleRpc: 'get_my_staff_role',
    redirectTo: '/delivery/dashboard',
    portalName: 'Delivery Portal',
  })
  const [phone, setPhone] = useState<PhoneValue>({
    countryCode: '+256',
    number: '',
  })
  const [password, setPassword] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(phone, password)
  }

  return (
    <PortalLoginLayout
      gradient={GRADIENT}
      portalIcon={
        <TbTruck
          size={28}
          color="#fff"
        />
      }
      portalLabel="Delivery Portal"
      headline={
        <>
          Deliver fast,
          <br />
          deliver right.
        </>
      }
      subheadline="Manage your deliveries, confirm orders with QR codes, and track your history."
      features={FEATURES}
      otherPortals={OTHER_PORTALS}
    >
      <PortalDesktopHeader>
        <Stack
          gap={4}
          mb={28}
        >
          <p
            style={{
              fontFamily: "'DM Sans',sans-serif",
              fontWeight: 800,
              fontSize: 24,
              color: '#1A2B3C',
              margin: 0,
            }}
          >
            Delivery Portal
          </p>
          <p
            style={{
              fontFamily: "'DM Sans',sans-serif",
              fontSize: 14,
              color: '#8A96A3',
              margin: 0,
            }}
          >
            Rider access only
          </p>
        </Stack>
      </PortalDesktopHeader>
      <form onSubmit={handleSubmit}>
        <Stack gap={16}>
          <LoginInputWrap>
            <CountryPhoneInput
              label="Phone Number"
              value={phone}
              onChange={setPhone}
              required
              placeholder="700 000 003"
            />
          </LoginInputWrap>
          <LoginInputWrap>
            <p
              style={{
                fontFamily: "'DM Sans',sans-serif",
                fontSize: 13,
                fontWeight: 600,
                color: '#2D3A4A',
                margin: '0 0 6px',
              }}
            >
              Password
            </p>
            <PwdWrap>
              <div style={{ position: 'relative' }}>
                <TbLock
                  size={15}
                  color="#9EADB8"
                  style={{
                    position: 'absolute',
                    left: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    zIndex: 1,
                  }}
                />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  onFocus={(e) => {
                    e.target.style.borderColor = '#15B3E0'
                    e.target.style.boxShadow = '0 0 0 3px rgba(21,179,224,0.12)'
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#E4E9F0'
                    e.target.style.boxShadow = 'none'
                  }}
                />
              </div>
            </PwdWrap>
          </LoginInputWrap>
          <LoginPrimaryBtn
            type="submit"
            disabled={loading}
          >
            {loading ? (
              'Signing in…'
            ) : (
              <>
                <span>Sign In</span> <TbArrowRight size={16} />
              </>
            )}
          </LoginPrimaryBtn>
        </Stack>
      </form>
    </PortalLoginLayout>
  )
}

