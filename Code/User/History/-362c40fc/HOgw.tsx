import { Link } from 'react-router-dom'
import { Box, Text, Anchor, Stack } from '@mantine/core'
import {
  TbBuildingHospital,
  TbMail,
  TbLock,
  TbClipboardList,
  TbShieldCheck,
  TbTruck,
} from 'react-icons/tb'
import styled, { keyframes } from 'styled-components'
import { FormInput, FormPasswordInput } from '@shared/ui/form'
import { usePharmacyLoginForm } from '@features/pharmacy/login-form/model/usePharmacyLoginForm'
import AppLogo from '../../components/AppLogo'

const fadeUp = keyframes`from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}`

const Page = styled.div`
  min-height: 100vh;
  display: grid;
  grid-template-columns: 420px 1fr;
  @media (max-width: 780px) {
    grid-template-columns: 1fr;
  }
`
const BrandPanel = styled.div`
  background: linear-gradient(170deg, #012970 0%, #0d5fa4 55%, #15b3e0 100%);
  padding: 3rem 2.5rem;
  display: flex;
  flex-direction: column;
  justify-content: center;
  position: relative;
  overflow: hidden;
  &::before {
    content: '';
    position: absolute;
    width: 320px;
    height: 320px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.04);
    top: -80px;
    right: -80px;
  }
  &::after {
    content: '';
    position: absolute;
    width: 200px;
    height: 200px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.04);
    bottom: 40px;
    left: -60px;
  }
  @media (max-width: 780px) {
    display: none;
  }
`
const FormPanel = styled.div`
  background: #f7f9fc;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem 1.5rem;
`
const Card = styled.div`
  width: 100%;
  max-width: 400px;
  background: #fff;
  border-radius: 20px;
  padding: 2.75rem 2.25rem;
  box-shadow: 0 2px 24px rgba(1, 41, 112, 0.07);
  border: 1px solid #edf0f7;
  animation: ${fadeUp} 0.45s ease both;
`
const FeatureRow = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 14px;
  margin-bottom: 22px;
`
const FeatureIcon = styled.div`
  width: 38px;
  height: 38px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.13);
  border: 1px solid rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
`
const InputWrap = styled.div`
  .mantine-TextInput-label,
  .mantine-PasswordInput-label {
    font-family: 'DM Sans', sans-serif;
    font-size: 13px;
    font-weight: 600;
    color: #2d3a4a;
    margin-bottom: 6px;
    letter-spacing: 0.01em;
  }
  .mantine-TextInput-input,
  .mantine-PasswordInput-input,
  .mantine-PasswordInput-innerInput {
    height: 46px;
    border: 1.5px solid #e4e9f0;
    border-radius: 10px;
    font-family: 'DM Sans', sans-serif;
    font-size: 14px;
    color: #1a2b3c;
    background: #fafbfd;
    transition:
      border-color 0.2s,
      box-shadow 0.2s;
    &:focus {
      border-color: #15b3e0;
      box-shadow: 0 0 0 3px rgba(21, 179, 224, 0.12);
      background: #fff;
    }
    &::placeholder {
      color: #b0bbc8;
    }
  }
  .mantine-Input-section {
    color: #9eadb8;
  }
  .mantine-TextInput-error,
  .mantine-PasswordInput-error {
    font-family: 'DM Sans', sans-serif;
    font-size: 12px;
  }
`
const PrimaryBtn = styled.button`
  width: 100%;
  height: 48px;
  background: linear-gradient(135deg, #15b3e0 0%, #012970 100%);
  border: none;
  border-radius: 10px;
  color: #fff;
  font-family: 'DM Sans', sans-serif;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  letter-spacing: 0.02em;
  transition:
    opacity 0.2s,
    transform 0.15s,
    box-shadow 0.2s;
  box-shadow: 0 4px 16px rgba(21, 179, 224, 0.3);
  &:hover:not(:disabled) {
    opacity: 0.9;
    transform: translateY(-1px);
    box-shadow: 0 6px 20px rgba(21, 179, 224, 0.4);
  }
  &:active:not(:disabled) {
    transform: translateY(0);
  }
  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
    box-shadow: none;
  }
`
const StaffBadge = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: rgba(255, 255, 255, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: 20px;
  padding: 5px 14px;
  margin-bottom: 24px;
`

const features = [
  {
    Icon: TbClipboardList,
    title: 'Order Management',
    desc: 'Review, price, and process prescriptions',
  },
  {
    Icon: TbShieldCheck,
    title: 'Insurance Verification',
    desc: 'Verify and manage patient insurance claims',
  },
  {
    Icon: TbTruck,
    title: 'Delivery Tracking',
    desc: 'Dispatch orders and track deliveries',
  },
]

export default function PharmacyLogin() {
  const { control, handleSubmit, onSubmit, isSubmitting } =
    usePharmacyLoginForm()

  return (
    <Page>
      <BrandPanel>
        <Box
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 48,
          }}
        >
          <AppLogo
            size={36}
            variant="white"
          />
          <Text
            style={{
              fontFamily: "'DM Sans',sans-serif",
              fontWeight: 800,
              fontSize: 20,
              color: '#fff',
              letterSpacing: '-0.3px',
            }}
          >
            MedDeliverySOS
          </Text>
        </Box>

        <StaffBadge>
          <TbBuildingHospital
            size={13}
            color="rgba(255,255,255,0.85)"
          />
          <Text
            style={{
              fontFamily: "'DM Sans',sans-serif",
              fontSize: 11,
              fontWeight: 700,
              color: 'rgba(255,255,255,0.85)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            Pharmacy Staff Portal
          </Text>
        </StaffBadge>

        <Text
          style={{
            fontFamily: "'DM Sans',sans-serif",
            fontWeight: 800,
            fontSize: 28,
            color: '#fff',
            lineHeight: 1.2,
            marginBottom: 12,
          }}
        >
          Manage orders
          <br />
          with confidence.
        </Text>
        <Text
          style={{
            fontFamily: "'DM Sans',sans-serif",
            fontSize: 14,
            color: 'rgba(255,255,255,0.65)',
            marginBottom: 44,
            lineHeight: 1.7,
          }}
        >
          Review prescriptions, set pricing, verify insurance, and track
          deliveries — all from one dashboard.
        </Text>

        {features.map(({ Icon, title, desc }) => (
          <FeatureRow key={title}>
            <FeatureIcon>
              <Icon
                size={18}
                color="#fff"
              />
            </FeatureIcon>
            <Box>
              <Text
                style={{
                  fontFamily: "'DM Sans',sans-serif",
                  fontSize: 13,
                  fontWeight: 700,
                  color: '#fff',
                  marginBottom: 2,
                }}
              >
                {title}
              </Text>
              <Text
                style={{
                  fontFamily: "'DM Sans',sans-serif",
                  fontSize: 12,
                  color: 'rgba(255,255,255,0.6)',
                }}
              >
                {desc}
              </Text>
            </Box>
          </FeatureRow>
        ))}

        <Box
          style={{
            height: 1,
            background: 'rgba(255,255,255,0.15)',
            margin: '28px 0 20px',
          }}
        />
        <Text
          style={{
            fontFamily: "'DM Sans',sans-serif",
            fontSize: 11,
            color: 'rgba(255,255,255,0.4)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            marginBottom: 10,
          }}
        >
          Other portals
        </Text>
        <Stack gap={8}>
          {[
            { to: '/login', label: 'Customer App' },
            { to: '/support/login', label: 'Customer Support' },
            { to: '/delivery/login', label: 'Delivery Team' },
          ].map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              style={{ textDecoration: 'none' }}
            >
              <Box
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  borderRadius: 10,
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.18)',
                  cursor: 'pointer',
                }}
              >
                <Text
                  style={{
                    fontFamily: "'DM Sans',sans-serif",
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#fff',
                  }}
                >
                  {label}
                </Text>
                <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>
                  →
                </Text>
              </Box>
            </Link>
          ))}
        </Stack>
      </BrandPanel>

      <FormPanel>
        <Card>
          <Box
            mb={8}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              marginBottom: 24,
            }}
          >
            <Box
              style={{
                width: 46,
                height: 46,
                borderRadius: 12,
                background: 'linear-gradient(135deg,#15B3E0,#012970)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <TbBuildingHospital
                size={22}
                color="#fff"
              />
            </Box>
            <Box>
              <Text
                style={{
                  fontFamily: "'DM Sans',sans-serif",
                  fontWeight: 800,
                  fontSize: 22,
                  color: '#1A2B3C',
                  letterSpacing: '-0.3px',
                }}
              >
                Pharmacy Portal
              </Text>
              <Text
                style={{
                  fontFamily: "'DM Sans',sans-serif",
                  fontSize: 13,
                  color: '#8A96A3',
                }}
              >
                Staff access only
              </Text>
            </Box>
          </Box>

          <form onSubmit={handleSubmit(onSubmit)}>
            <Stack gap={16}>
              <InputWrap>
                <FormInput
                  name="email"
                  control={control}
                  label="Staff Email"
                  placeholder="pharmacist@medideliver.com"
                  leftSection={<TbMail size={15} />}
                />
              </InputWrap>
              <InputWrap>
                <FormPasswordInput
                  name="password"
                  control={control}
                  label="Password"
                  placeholder="Enter your password"
                  leftSection={<TbLock size={15} />}
                />
              </InputWrap>
              <Box
                style={{
                  background: '#F0F9FF',
                  border: '1px solid #BAE6FD',
                  borderRadius: 8,
                  padding: '10px 14px',
                }}
              >
                <Text
                  style={{
                    fontFamily: "'DM Sans',sans-serif",
                    fontSize: 12,
                    color: '#0369A1',
                  }}
                >
                  🔒 This portal is for pharmacy staff only. Accounts are
                  created by administrators.
                </Text>
              </Box>
              <PrimaryBtn
                type="submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Signing in…' : 'Sign In to Pharmacy Portal'}
              </PrimaryBtn>
            </Stack>
          </form>
        </Card>
      </FormPanel>
    </Page>
  )
}

