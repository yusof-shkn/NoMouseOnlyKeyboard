import { Select, TextInput, Group, Box } from '@mantine/core'
import { TbPhone } from 'react-icons/tb'
import styled from 'styled-components'

const COUNTRY_CODES = [
  { value: '+256', label: '🇺🇬 +256', country: 'Uganda' },
  { value: '+254', label: '🇰🇪 +254', country: 'Kenya' },
  { value: '+255', label: '🇹🇿 +255', country: 'Tanzania' },
  { value: '+250', label: '🇷🇼 +250', country: 'Rwanda' },
  { value: '+211', label: '🇸🇸 +211', country: 'South Sudan' },
  { value: '+243', label: '🇨🇩 +243', country: 'DRC' },
  { value: '+251', label: '🇪🇹 +251', country: 'Ethiopia' },
  { value: '+1', label: '🇺🇸 +1', country: 'USA/Canada' },
  { value: '+44', label: '🇬🇧 +44', country: 'UK' },
]

const Wrap = styled.div`
  .mantine-TextInput-label,
  .mantine-Select-label {
    font-family: 'DM Sans', sans-serif;
    font-size: 13px;
    font-weight: 600;
    color: #2d3a4a;
    margin-bottom: 6px;
  }
  .mantine-TextInput-input {
    height: 48px;
    border: 1.5px solid #e4e9f0;
    border-radius: 0 12px 12px 0;
    font-family: 'DM Sans', sans-serif;
    font-size: 14px;
    color: #1a2b3c;
    background: #fafbfd;
    &:focus {
      border-color: #15b3e0;
      box-shadow: 0 0 0 3px rgba(21, 179, 224, 0.12);
      background: #fff;
    }
    &::placeholder {
      color: #b0bbc8;
    }
    border-left: none;
  }
  .mantine-Select-input {
    height: 48px;
    border: 1.5px solid #e4e9f0;
    border-radius: 12px 0 0 12px;
    font-family: 'DM Sans', sans-serif;
    font-size: 13px;
    color: #1a2b3c;
    background: #f5f7fa;
    border-right: none;
    min-width: 110px;
    width: 110px;
    &:focus {
      border-color: #15b3e0;
      box-shadow: 0 0 0 3px rgba(21, 179, 224, 0.12);
    }
  }
  .mantine-TextInput-error {
    font-family: 'DM Sans', sans-serif;
    font-size: 12px;
  }
  .mantine-Input-section {
    color: #9eadb8;
  }
`

interface SmallWrapProps {
  $height?: number
}
const SmallWrap = styled.div<SmallWrapProps>`
  .mantine-TextInput-input {
    height: ${(p) => p.$height ?? 48}px;
    border-radius: 0 8px 8px 0;
  }
  .mantine-Select-input {
    height: ${(p) => p.$height ?? 48}px;
    border-radius: 8px 0 0 8px;
    min-width: 100px;
    width: 100px;
  }
`

export interface PhoneValue {
  countryCode: string
  number: string
}

interface CountryPhoneInputProps {
  label?: string
  value: PhoneValue
  onChange: (v: PhoneValue) => void
  error?: string
  required?: boolean
  placeholder?: string
  size?: 'sm' | 'md'
}

export function CountryPhoneInput({
  label,
  value,
  onChange,
  error,
  required,
  placeholder = '700 123 456',
  size = 'md',
}: CountryPhoneInputProps): JSX.Element {
  const height = size === 'sm' ? 42 : 48

  const inner = (
    <Box>
      {label && (
        <Box
          mb={6}
          style={{
            fontFamily: "'DM Sans',sans-serif",
            fontSize: 13,
            fontWeight: 600,
            color: '#2D3A4A',
          }}
        >
          {label}
          {required && (
            <span style={{ color: '#EF4444', marginLeft: 2 }}>*</span>
          )}
        </Box>
      )}
      <Group
        gap={0}
        align="flex-start"
        wrap="nowrap"
      >
        <Select
          value={value.countryCode}
          onChange={(v) => onChange({ ...value, countryCode: v ?? '+256' })}
          data={COUNTRY_CODES.map((c) => ({ value: c.value, label: c.label }))}
          style={{ width: 110, flexShrink: 0 }}
          comboboxProps={{ zIndex: 9999 }}
          styles={{
              height,
              borderRadius: size === 'sm' ? '8px 0 0 8px' : '12px 0 0 12px',
              borderRight: 'none',
              background: '#F5F7FA',
              fontFamily: "'DM Sans',sans-serif",
              fontSize: 13,
            },
          }}
        />
        <TextInput
          value={value.number}
          onChange={(e) =>
            onChange({ ...value, number: e.target.value.replace(/^\s*0+/, '') })
          }
          placeholder={placeholder}
          leftSection={<TbPhone size={15} />}
          error={error}
          style={{ flex: 1 }}
          styles={{
            input: {
              height,
              borderRadius: size === 'sm' ? '0 8px 8px 0' : '0 12px 12px 0',
              borderLeft: 'none',
              fontFamily: "'DM Sans',sans-serif",
              fontSize: 14,
            },
          }}
        />
      </Group>
    </Box>
  )

  return size === 'sm' ? (
    <SmallWrap $height={height}>
      <Wrap>{inner}</Wrap>
    </SmallWrap>
  ) : (
    <Wrap>{inner}</Wrap>
  )
}

/** Combine countryCode + number into a single E.164-ish string for storage */
export function combinePhone(v: PhoneValue): string {
  const num = v.number.replace(/\D/g, '')
  if (!num) return ''
  return v.countryCode + num
}

/** Split a stored phone string back into { countryCode, number } */
export function splitPhone(phone: string): PhoneValue {
  if (!phone) return { countryCode: '+256', number: '' }
  const known = COUNTRY_CODES.map((c) => c.value).sort(
    (a, b) => b.length - a.length,
  )
  for (const code of known) {
    if (phone.startsWith(code)) {
      return { countryCode: code, number: phone.slice(code.length) }
    }
  }
  return { countryCode: '+256', number: phone.replace(/^\+?/, '') }
}

