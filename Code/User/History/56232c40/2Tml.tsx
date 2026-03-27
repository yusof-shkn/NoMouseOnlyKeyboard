import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Box, Text, Anchor, Stack, Checkbox } from '@mantine/core'
import { TbArrowRight, TbRefresh, TbCheck, TbLock } from 'react-icons/tb'
import styled, { keyframes } from 'styled-components'
import { notifications } from '@mantine/notifications'
import { supabase } from '../../../lib/supabase'
import AppLogo from '../../components/AppLogo'
import {
  CountryPhoneInput,
  type PhoneValue,
} from '../../components/CountryPhoneInput'
import { OTPInput } from '../../components/OTPInput'
import { ModalDatePicker } from '../../components/ModalDatePicker'
import { useAuth } from '../../../features/auth/context/AuthContext'

const fadeUp = keyframes`from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}`

const Page = styled.div`
  min-height: 100vh;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 2rem 1.5rem 2.5rem;
  position: relative;
  overflow-x: hidden;
  background: #f0f4fa;
  &::before {
    content: '';
    position: fixed;
    inset: 0;
    background-image: radial-gradient(
      circle,
      rgba(1, 41, 112, 0.07) 1px,
      transparent 1px
    );
    background-size: 28px 28px;
    pointer-events: none;
    z-index: 0;
  }
  @media (max-width: 640px) {
    padding: 0;
    align-items: stretch;
    background: linear-gradient(
      165deg,
      #011a4a 0%,
      #012970 35%,
      #0d5fa4 60%,
      #15b3e0 100%
    );
    &::before {
      display: none;
    }
  }
`

const Card = styled.div`
  width: 100%;
  max-width: 540px;
  background: #fff;
  border-radius: 24px;
  padding: 2rem 2rem;
  box-shadow: 0 8px 48px rgba(1, 41, 112, 0.11);
  border: 1px solid #edf0f7;
  animation: ${fadeUp} 0.5s ease both;
  position: relative;
  z-index: 2;
  @media (max-width: 640px) {
    border-radius: 0;
    box-shadow: none;
    border: none;
    padding: 1rem 1.25rem 1.5rem;
    width: 100%;
    margin-top: auto;
  }
`

const Label = styled.p`
  font-family: 'DM Sans', sans-serif;
  font-size: 13px;
  font-weight: 600;
  color: #2d3a4a;
  margin: 0 0 6px;
`

const PlainInput = styled.input<{ $icon?: boolean }>`
  width: 100%;
  height: 48px;
  border: 1.5px solid #e4e9f0;
  border-radius: 12px;
  font-family: 'DM Sans', sans-serif;
  font-size: 14px;
  color: #1a2b3c;
  background: #fafbfd;
  padding: 0 14px 0 ${(p) => (p.$icon ? '38px' : '14px')};
  outline: none;
  box-sizing: border-box;
  transition:
    border-color 0.2s,
    box-shadow 0.2s;
  &:focus {
    border-color: #15b3e0;
    box-shadow: 0 0 0 3px rgba(21, 179, 224, 0.12);
  }
  &::placeholder {
    color: #b0bbc8;
  }
  @media (max-width: 640px) {
    height: 44px;
  }
`

const FormStack = styled(Stack)`
  @media (max-width: 640px) {
    gap: 8px !important;
  }
`

const PrimaryBtn = styled.button`
  width: 100%;
  height: 50px;
  background: linear-gradient(135deg, #15b3e0 0%, #012970 100%);
  border: none;
  border-radius: 12px;
  color: #fff;
  font-family: 'DM Sans', sans-serif;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition:
    opacity 0.2s,
    transform 0.15s;
  box-shadow: 0 4px 18px rgba(21, 179, 224, 0.35);
  &:hover:not(:disabled) {
    opacity: 0.92;
    transform: translateY(-1px);
  }
  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
    box-shadow: none;
  }
  @media (max-width: 640px) {
    height: 46px;
  }
`

const BackBtn = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  color: #8a96a3;
  font-family: 'DM Sans', sans-serif;
  font-size: 13px;
  font-weight: 600;
  padding: 0;
  margin-bottom: 16px;
  &:hover {
    color: #012970;
  }
`

type Step = 'details' | 'otp'

export default function Register(): JSX.Element {
  const navigate = useNavigate()
  const { refreshProfile } = useAuth()
  const [step, setStep] = useState<Step>('details')
  const [loading, setLoading] = useState(false)

  // Form fields
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState<PhoneValue>({
    countryCode: '+256',
    number: '',
  })
  const [password, setPassword] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [email, setEmail] = useState('')
  const [dob, setDob] = useState<Date | null>(null)
  const [agreed, setAgreed] = useState(false)
  const [otp, setOtp] = useState('')

  const e164 =
    phone.countryCode + phone.number.replace(/\D/g, '').replace(/^0+/, '')

  const handleSignUp = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (!fullName.trim()) {
      notifications.show({
        title: 'Name required',
        color: 'red',
        autoClose: 2500,
        message: '',
      })
      return
    }
    const digits = phone.number.replace(/\D/g, '')
    if (!digits || digits.length < 6) {
      notifications.show({
        title: 'Valid phone required',
        color: 'red',
        autoClose: 2500,
        message: '',
      })
      return
    }
    if (password.length < 6) {
      notifications.show({
        title: 'Password too short',
        message: 'At least 6 characters.',
        color: 'red',
        autoClose: 2500,
      })
      return
    }
    if (password !== confirmPwd) {
      notifications.show({
        title: 'Passwords do not match',
        color: 'red',
        autoClose: 2500,
        message: '',
      })
      return
    }
    if (!agreed) {
      notifications.show({
        title: 'Accept terms',
        color: 'orange',
        autoClose: 2500,
        message: '',
      })
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.signUp({
      phone: e164,
      password,
      options: { data: { full_name: fullName.trim() } },
    })
    setLoading(false)

    if (error) {
      notifications.show({
        title: 'Sign up failed',
        message: error.message,
        color: 'red',
        autoClose: 3000,
      })
      return
    }

    notifications.show({
      title: 'Code sent',
      message: `Verification SMS sent to ${e164}`,
      color: 'teal',
      autoClose: 3000,
    })
    setStep('otp')
  }

  const verifyOTP = async () => {
    if (otp.length < 6) return
    setLoading(true)
    const { error } = await supabase.auth.verifyOtp({
      phone: e164,
      token: otp,
      type: 'sms',
    })
    if (error) {
      setLoading(false)
      notifications.show({
        title: 'Invalid code',
        message: error.message,
        color: 'red',
        autoClose: 3000,
      })
      return
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user) {
      await supabase
        .from('profiles')
        .update({
          name: fullName.trim(),
          phone: e164,
          date_of_birth: dob ? dob.toISOString().split('T')[0] : null,
        })
        .eq('user_id', user.id)
        .eq('is_main_account', true)

      if (email.trim()) await supabase.auth.updateUser({ email: email.trim() })
    }

    await refreshProfile()
    setLoading(false)
    notifications.show({
      title: 'Welcome!',
      message: 'Account created successfully.',
      color: 'teal',
      autoClose: 2000,
    })
    navigate('/dashboard')
  }

  const resendOTP = async () => {
    setOtp('')
    await supabase.auth.signInWithOtp({ phone: e164 })
    notifications.show({
      title: 'Code resent',
      message: `New SMS sent to ${e164}`,
      color: 'teal',
      autoClose: 2500,
    })
  }

  return (
    <Page>
      <Card>
        {/* ── Header ── */}
        <Box
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            marginBottom: 4,
          }}
        >
          <AppLogo
            size={32}
            variant="color"
          />
          <Box>
            <Text
              style={{
                fontFamily: "'DM Sans',sans-serif",
                fontWeight: 800,
                fontSize: 17,
                color: '#1A2B3C',
              }}
            >
              Create your account
            </Text>
            <Text
              style={{
                fontFamily: "'DM Sans',sans-serif",
                fontSize: 12,
                color: '#8A96A3',
              }}
            >
              {step === 'details'
                ? 'Join MedDeliverySOS for easy prescription delivery'
                : 'Enter the verification code we sent you'}
            </Text>
          </Box>
        </Box>

        <Box
          style={{ height: 1, background: '#EDF0F7', margin: '12px 0 16px' }}
        />

        {/* ── Step 1: Details ── */}
        {step === 'details' && (
          <form onSubmit={handleSignUp}>
            <FormStack gap={10}>
              <Box>
                <Label>Full Name *</Label>
                <PlainInput
                  placeholder="John Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </Box>

              <CountryPhoneInput
                label="Phone Number *"
                value={phone}
                onChange={setPhone}
                required
                placeholder="700 123 456"
              />

              <ModalDatePicker
                label="Date of Birth"
                value={dob}
                onChange={setDob}
                placeholder="Select date of birth"
                maxDate={new Date()}
                defaultLevel="decade"
              />

              <Box>
                <Label>
                  Email Address{' '}
                  <Text
                    span
                    style={{ color: '#9EADB8', fontSize: 12, fontWeight: 400 }}
                  >
                    (optional)
                  </Text>
                </Label>
                <PlainInput
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Box>

              <Box>
                <Label>Password *</Label>
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
                  <PlainInput
                    $icon
                    type="password"
                    placeholder="At least 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </Box>

              <Box>
                <Label>Confirm Password *</Label>
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
                  <PlainInput
                    $icon
                    type="password"
                    placeholder="Repeat your password"
                    value={confirmPwd}
                    onChange={(e) => setConfirmPwd(e.target.value)}
                    required
                  />
                </div>
              </Box>

              <Checkbox
                checked={agreed}
                onChange={(e) => setAgreed(e.currentTarget.checked)}
                color="lotusCyan"
                radius={4}
                label={
                  <Text
                    style={{
                      fontFamily: "'DM Sans',sans-serif",
                      fontSize: 13,
                      color: '#4A5568',
                    }}
                  >
                    I agree to the{' '}
                    <Anchor
                      href="#"
                      style={{ color: '#15B3E0', fontWeight: 600 }}
                    >
                      Terms
                    </Anchor>{' '}
                    and{' '}
                    <Anchor
                      href="#"
                      style={{ color: '#15B3E0', fontWeight: 600 }}
                    >
                      Privacy Policy
                    </Anchor>
                  </Text>
                }
              />

              <PrimaryBtn
                type="submit"
                disabled={loading}
              >
                {loading ? (
                  'Sending code…'
                ) : (
                  <>
                    Create Account &amp; Verify <TbArrowRight size={16} />
                  </>
                )}
              </PrimaryBtn>

              <Text
                ta="center"
                style={{
                  fontFamily: "'DM Sans',sans-serif",
                  fontSize: 14,
                  color: '#8A96A3',
                }}
              >
                Already have an account?{' '}
                <Anchor
                  component={Link}
                  to="/login"
                  style={{
                    fontFamily: "'DM Sans',sans-serif",
                    fontWeight: 700,
                    color: '#012970',
                  }}
                >
                  Sign in
                </Anchor>
              </Text>
            </FormStack>
          </form>
        )}

        {/* ── Step 2: OTP ── */}
        {step === 'otp' && (
          <Stack gap={20}>
            <BackBtn
              onClick={() => {
                setStep('details')
                setOtp('')
              }}
            >
              ← Back
            </BackBtn>
            <Box
              style={{
                padding: '12px 16px',
                borderRadius: 12,
                background: '#f0fdf4',
                border: '1.5px solid #86efac',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <TbCheck
                size={18}
                color="#16a34a"
              />
              <Text
                style={{
                  fontFamily: "'DM Sans',sans-serif",
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#15803d',
                }}
              >
                Account created — verify your number
              </Text>
            </Box>
            <Text
              ta="center"
              style={{
                fontFamily: "'DM Sans',sans-serif",
                fontSize: 14,
                color: '#8A96A3',
              }}
            >
              Code sent to <b style={{ color: '#1A2B3C' }}>{e164}</b>
            </Text>
            <OTPInput
              value={otp}
              onChange={(v) => {
                setOtp(v)
                if (v.length === 6) setTimeout(() => verifyOTP(), 80)
              }}
              disabled={loading}
            />
            <PrimaryBtn
              type="button"
              disabled={loading || otp.length < 6}
              onClick={verifyOTP}
            >
              {loading ? (
                'Verifying…'
              ) : (
                <>
                  Verify &amp; Enter App <TbArrowRight size={16} />
                </>
              )}
            </PrimaryBtn>
            <Box ta="center">
              <button
                type="button"
                onClick={resendOTP}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#15B3E0',
                  fontFamily: "'DM Sans',sans-serif",
                  fontSize: 13,
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <TbRefresh size={14} /> Resend code
              </button>
            </Box>
          </Stack>
        )}
      </Card>
    </Page>
  )
}

