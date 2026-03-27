import { useState } from 'react'
import { TbShieldCheck, TbArrowRight, TbLock } from 'react-icons/tb'
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
      <TbShieldCheck
        size={18}
        color="#fff"
      />
    ),
    title: 'Verify Members',
    desc: 'Review and approve insurance submissions',
  },
  {
    icon: (
      <TbShieldCheck
        size={18}
        color="#fff"
      />
    ),
    title: 'Track Orders',
    desc: 'Monitor insured orders through delivery',
  },
  {
    icon: (
      <TbShieldCheck
        size={18}
        color="#fff"
      />
    ),
    title: 'Scheme Management',
    desc: 'Add, edit and manage insurance schemes',
  },
]
const OTHER_PORTALS = [
  { to: '/login', label: 'Customer App' },
  { to: '/pharmacy/login', label: 'Pharmacy Staff' },
  { to: '/delivery/login', label: 'Delivery Team' },
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

export default function InsuranceLogin(): JSX.Element {
  const { loading, onSubmit } = usePortalLogin({
    allowedRoles: ['insurance_staff'],
    roleRpc: 'get_my_insurance_staff_info',
    redirectTo: '/insurance/orders',
    portalName: 'Insurance Portal',
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
        <TbShieldCheck
          size={28}
          color="#fff"
        />
      }
      portalLabel="Insurance Portal"
      headline={
        <>
          Verify members,
          <br />
          protect patients.
        </>
      }
      subheadline="Review insurance submissions, approve coverage, and track insured orders."
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
            Insurance Portal
          </p>
          <p
            style={{
              fontFamily: "'DM Sans',sans-serif",
              fontSize: 14,
              color: '#8A96A3',
              margin: 0,
            }}
          >
            Staff access only
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
              placeholder="700 000 002"
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

