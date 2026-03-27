import { type ReactNode, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Box, Text, Stack } from '@mantine/core'
import { TbArrowRight } from 'react-icons/tb'
import styled, { keyframes, css } from 'styled-components'
import AppLogo from './AppLogo'

// ─── Animations ───────────────────────────────────────────────────────────────
const fadeUp = keyframes`from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}`
const float = keyframes`0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}`
const pulse = keyframes`0%,100%{opacity:0.4;transform:scale(1)}50%{opacity:0.7;transform:scale(1.05)}`

// ─── Page shell ───────────────────────────────────────────────────────────────
const Page = styled.div`
  min-height: 100vh;
  display: grid;
  grid-template-columns: 440px 1fr;
  @media (max-width: 800px) {
    display: block;
  }
`

// ─── Brand panel ──────────────────────────────────────────────────────────────
const BrandPanel = styled.div<{ $grad: string }>`
  background: ${(p) => p.$grad};
  padding: 3rem 2.5rem;
  display: flex;
  flex-direction: column;
  justify-content: center;
  position: relative;
  overflow: hidden;
  @media (max-width: 800px) {
    display: none;
  }
`
const BrandOrb = styled.div<{
  $size: number
  $top: string
  $left: string
  $delay?: string
}>`
  position: absolute;
  width: ${(p) => p.$size}px;
  height: ${(p) => p.$size}px;
  border-radius: 50%;
  background: radial-gradient(
    circle,
    rgba(255, 255, 255, 0.12) 0%,
    rgba(255, 255, 255, 0) 70%
  );
  top: ${(p) => p.$top};
  left: ${(p) => p.$left};
  animation: ${pulse} ${(p) => (p.$delay ? '5s' : '7s')} ease-in-out infinite
    ${(p) => p.$delay || '0s'};
`
const FeatureRow = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 14px;
  margin-bottom: 20px;
`
const FeatureIcon = styled.div`
  width: 38px;
  height: 38px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
`
const PortalChip = styled(Link)`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-radius: 10px;
  text-decoration: none;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.18);
  transition: background 0.15s;
  &:hover {
    background: rgba(255, 255, 255, 0.18);
  }
`

// ─── Form panel ───────────────────────────────────────────────────────────────
const FormPanel = styled.div<{ $grad: string }>`
  background: #f0f4fa;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem 1.5rem;
  position: relative;

  overflow: hidden;
  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(rgba(1, 41, 112, 0.04) 1px, transparent 1px),
      linear-gradient(90deg, rgba(1, 41, 112, 0.04) 1px, transparent 1px);
    background-size: 32px 32px;
    pointer-events: none;
  }
  @media (max-width: 800px) {
    min-height: 100vh;
    padding: 0;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    background: ${(p) => p.$grad};
    &::before {
      display: none;
    }
  }
`

// ─── Mobile hero ─────────────────────────────────────────────────────────────
const MobileHero = styled.div<{ $lifted: boolean }>`
  display: none;
  @media (max-width: 800px) {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    position: relative;
    flex-shrink: 0;
    padding: 2.25rem 1.5rem 3.25rem;
    /* GPU-accelerated fade only — no layout properties */
    opacity: ${(p) => (p.$lifted ? 0 : 1)};
    pointer-events: ${(p) => (p.$lifted ? 'none' : 'auto')};
    transition: opacity 0.2s ease;
    will-change: opacity;
  }
`
const MobileOrb = styled.div<{ $size: number; $top: string; $left: string }>`
  position: absolute;
  width: ${(p) => p.$size}px;
  height: ${(p) => p.$size}px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.06);
  top: ${(p) => p.$top};
  left: ${(p) => p.$left};
  pointer-events: none;
`
const PillIcon = styled.div`
  width: 64px;
  height: 64px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.18);
  border: 1.5px solid rgba(255, 255, 255, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 18px;
  animation: ${float} 4s ease-in-out infinite;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
`

// ─── Form card ─────────────────────────────────────────────────────────────
// On mobile: normal bottom-sheet. On focus: fixed full-screen overlay so
// keyboard never covers content and user can scroll to "Create account".
// Uses transform (GPU) not max-height/flex (layout = laggy).
export const LoginCard = styled.div<{ $lifted?: boolean }>`
  width: 100%;
  max-width: 420px;
  background: #fff;
  border-radius: 20px;
  padding: 2.75rem 2.25rem;
  box-shadow: 0 8px 40px rgba(1, 41, 112, 0.13);
  border: 1px solid #edf0f7;
  animation: ${fadeUp} 0.5s ease both;
  position: relative;
  z-index: 2;

  @media (max-width: 800px) {
    max-width: 100%;
    border: none;
    box-shadow: 0 -4px 40px rgba(0, 0, 0, 0.18);

    /* Default: bottom-sheet */
    border-radius: 28px 28px 0 0;
    padding: 2rem 1.5rem 2.5rem;

    /* Lifted: fixed full-screen white card, scrollable */
    ${(p) =>
      p.$lifted
        ? `
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      border-radius: 0;
      overflow-y: auto;
      overflow-x: hidden;
      padding: 2.5rem 1.5rem 3rem;
      z-index: 500;
      box-shadow: none;
      -webkit-overflow-scrolling: touch;
    `
        : ''}
  }
`

// ─── Input wrapper ─────────────────────────────────────────────────────────
export const LoginInputWrap = styled.div`
  .mantine-TextInput-label,
  .mantine-PasswordInput-label,
  .mantine-Select-label {
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
    height: 48px;
    border: 1.5px solid #e4e9f0;
    border-radius: 12px;
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

// ─── Primary button ───────────────────────────────────────────────────────────
export const LoginPrimaryBtn = styled.button`
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
  letter-spacing: 0.02em;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition:
    opacity 0.2s,
    transform 0.15s,
    box-shadow 0.2s;
  box-shadow: 0 4px 18px rgba(21, 179, 224, 0.35);
  &:hover:not(:disabled) {
    opacity: 0.92;
    transform: translateY(-1px);
    box-shadow: 0 6px 24px rgba(21, 179, 224, 0.45);
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

// ─── Types ────────────────────────────────────────────────────────────────────
interface Feature {
  icon: ReactNode
  title: string
  desc: string
}
interface PortalLink {
  to: string
  label: string
}

interface PortalLoginLayoutProps {
  gradient: string
  portalIcon: ReactNode
  portalLabel: string
  headline: ReactNode
  subheadline: string
  features: Feature[]
  otherPortals: PortalLink[]
  children: ReactNode
}

export default function PortalLoginLayout({
  gradient,
  portalIcon,
  portalLabel,
  headline,
  subheadline,
  features,
  otherPortals,
  children,
}: PortalLoginLayoutProps): JSX.Element {
  const [lifted, setLifted] = useState(false)

  const handleFocusIn = useCallback(() => setLifted(true), [])
  const handleFocusOut = useCallback(() => setLifted(false), [])

  return (
    <Page>
      {/* ── Desktop brand panel ── */}
      <BrandPanel $grad={gradient}>
        <BrandOrb
          $size={400}
          $top="-120px"
          $left="-100px"
        />
        <BrandOrb
          $size={280}
          $top="55%"
          $left="60%"
          $delay="2s"
        />

        <Box
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 52,
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

        <Box
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            background: 'rgba(255,255,255,0.12)',
            border: '1px solid rgba(255,255,255,0.22)',
            borderRadius: 20,
            padding: '5px 14px',
            marginBottom: 20,
            width: 'fit-content',
          }}
        >
          {portalIcon}
          <Text
            style={{
              fontFamily: "'DM Sans',sans-serif",
              fontSize: 11,
              fontWeight: 700,
              color: 'rgba(255,255,255,0.9)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            {portalLabel}
          </Text>
        </Box>

        <Text
          style={{
            fontFamily: "'DM Sans',sans-serif",
            fontWeight: 800,
            fontSize: 30,
            color: '#fff',
            lineHeight: 1.2,
            marginBottom: 12,
          }}
        >
          {headline}
        </Text>
        <Text
          style={{
            fontFamily: "'DM Sans',sans-serif",
            fontSize: 14,
            color: 'rgba(255,255,255,0.65)',
            marginBottom: 44,
            lineHeight: 1.75,
          }}
        >
          {subheadline}
        </Text>

        {features.map(({ icon, title, desc }) => (
          <FeatureRow key={title}>
            <FeatureIcon>{icon}</FeatureIcon>
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
            color: 'rgba(255,255,255,0.45)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            marginBottom: 10,
          }}
        >
          Other portals
        </Text>
        <Stack gap={8}>
          {otherPortals.map(({ to, label }) => (
            <PortalChip
              key={to}
              to={to}
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
              <TbArrowRight
                size={14}
                color="rgba(255,255,255,0.6)"
              />
            </PortalChip>
          ))}
        </Stack>
      </BrandPanel>

      {/* ── Form panel ── */}
      <FormPanel $grad={gradient}>
        {/* Mobile hero — fades/shrinks when form focused */}
        <MobileHero $lifted={lifted}>
          <MobileOrb
            $size={300}
            $top="-80px"
            $left="-80px"
          />
          <MobileOrb
            $size={200}
            $top="30%"
            $left="70%"
          />
          <MobileOrb
            $size={150}
            $top="70%"
            $left="-20px"
          />
          <PillIcon>{portalIcon}</PillIcon>
          <Text
            style={{
              fontFamily: "'DM Sans',sans-serif",
              fontWeight: 800,
              fontSize: lifted ? 16 : 22,
              color: '#fff',
              lineHeight: 1.2,
              marginBottom: 4,
              transition: 'font-size 0.3s ease',
            }}
          >
            {portalLabel}
          </Text>
          {!lifted && (
            <Text
              style={{
                fontFamily: "'DM Sans',sans-serif",
                fontSize: 13,
                color: 'rgba(255,255,255,0.7)',
                lineHeight: 1.6,
              }}
            >
              MedDeliverySOS
            </Text>
          )}
        </MobileHero>

        {/* White card — lifts on focus */}
        <LoginCard
          $lifted={lifted}
          onFocus={handleFocusIn}
          onBlur={handleFocusOut}
        >
          {children}
        </LoginCard>
      </FormPanel>
    </Page>
  )
}

