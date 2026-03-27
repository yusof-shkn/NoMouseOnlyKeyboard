import { useRef, useState, useEffect, useCallback } from 'react'
import { TextInput, Box, Group } from '@mantine/core'
import { TbPhone, TbChevronDown } from 'react-icons/tb'
import styled, { keyframes } from 'styled-components'

const COUNTRY_CODES = [
  { value: '+256', flag: '🇺🇬', country: 'Uganda' },
  { value: '+254', flag: '🇰🇪', country: 'Kenya' },
  { value: '+255', flag: '🇹🇿', country: 'Tanzania' },
  { value: '+250', flag: '🇷🇼', country: 'Rwanda' },
  { value: '+211', flag: '🇸🇸', country: 'South Sudan' },
  { value: '+243', flag: '🇨🇩', country: 'DRC' },
  { value: '+251', flag: '🇪🇹', country: 'Ethiopia' },
  { value: '+1', flag: '🇺🇸', country: 'USA/Canada' },
  { value: '+44', flag: '🇬🇧', country: 'UK' },
]

const dropdownFade = keyframes`
  from { opacity: 0; transform: translateY(-6px); }
  to   { opacity: 1; transform: translateY(0); }
`

const Trigger = styled.button<{
  $height: number
  $size: 'sm' | 'md'
  $open: boolean
}>`
  flex-shrink: 0;
  width: ${(p) => (p.$size === 'sm' ? '100px' : '110px')};
  height: ${(p) => p.$height}px;
  padding: 0 10px 0 12px;
  border: 1.5px solid ${(p) => (p.$open ? '#15B3E0' : '#E4E9F0')};
  border-right: none;
  border-radius: ${(p) => (p.$size === 'sm' ? '8px 0 0 8px' : '12px 0 0 12px')};
  background: ${(p) => (p.$open ? '#fff' : '#F5F7FA')};
  box-shadow: ${(p) => (p.$open ? '0 0 0 3px rgba(21,179,224,0.12)' : 'none')};
  font-family: 'DM Sans', sans-serif;
  font-size: 13px;
  color: #1a2b3c;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
  outline: none;
  transition:
    border-color 0.15s,
    box-shadow 0.15s,
    background 0.15s;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
  user-select: none;
  -webkit-user-select: none;

  .chevron {
    color: #9eadb8;
    flex-shrink: 0;
    transition: transform 0.2s;
    transform: ${(p) => (p.$open ? 'rotate(180deg)' : 'rotate(0deg)')};
  }
`

const DropdownList = styled.ul`
  position: fixed;
  background: #fff;
  border: 1.5px solid #e4e9f0;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(1, 41, 112, 0.14);
  padding: 4px 0;
  margin: 0;
  list-style: none;
  z-index: 9999;
  min-width: 180px;
  max-height: 260px;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  animation: ${dropdownFade} 0.15s ease both;
`

const DropdownItem = styled.li<{ $active: boolean }>`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  cursor: pointer;
  background: ${(p) => (p.$active ? '#EBF8FD' : 'transparent')};
  font-family: 'DM Sans', sans-serif;
  font-size: 13px;
  color: #1a2b3c;
  font-weight: ${(p) => (p.$active ? 600 : 400)};
  transition: background 0.1s;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;

  &:hover {
    background: #f0f9fd;
  }

  .flag {
    font-size: 18px;
    line-height: 1;
  }
  .code {
    color: #6b7a8d;
    font-size: 12px;
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
  const [open, setOpen] = useState(false)
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 0 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const selected =
    COUNTRY_CODES.find((c) => c.value === value.countryCode) ?? COUNTRY_CODES[0]

  const recalcPos = useCallback(() => {
    if (!triggerRef.current) return
    const r = triggerRef.current.getBoundingClientRect()
    setDropPos({
      top: r.bottom + 4,
      left: r.left,
      width: Math.max(r.width, 180),
    })
  }, [])

  const handleTrigger = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault()
      e.stopPropagation()
      recalcPos()
      setOpen((prev) => !prev)
    },
    [recalcPos],
  )

  const handleSelect = useCallback(
    (code: string) => {
      onChange({ ...value, countryCode: code })
      setOpen(false)
    },
    [value, onChange],
  )

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node
      if (
        listRef.current?.contains(target) ||
        triggerRef.current?.contains(target)
      )
        return
      setOpen(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('touchstart', close, { passive: true })
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('touchstart', close)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const reposition = () => recalcPos()
    window.addEventListener('scroll', reposition, true)
    window.addEventListener('resize', reposition)
    return () => {
      window.removeEventListener('scroll', reposition, true)
      window.removeEventListener('resize', reposition)
    }
  }, [open, recalcPos])

  return (
    <Box style={{ position: 'relative' }}>
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
        <Trigger
          ref={triggerRef}
          type="button"
          $height={height}
          $size={size}
          $open={open}
          onMouseDown={handleTrigger}
          onTouchEnd={handleTrigger}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label="Select country code"
        >
          <span style={{ fontSize: 16, lineHeight: 1 }}>{selected.flag}</span>
          <span
            style={{
              flex: 1,
              textAlign: 'left',
              fontSize: 12,
              color: '#6B7A8D',
            }}
          >
            {selected.value}
          </span>
          <TbChevronDown
            size={13}
            className="chevron"
          />
        </Trigger>

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

      {open && (
        <DropdownList
          ref={listRef}
          role="listbox"
          style={{ top: dropPos.top, left: dropPos.left, width: dropPos.width }}
        >
          {COUNTRY_CODES.map((c) => (
            <DropdownItem
              key={c.value}
              $active={c.value === value.countryCode}
              role="option"
              aria-selected={c.value === value.countryCode}
              onMouseDown={(e) => {
                e.preventDefault()
                handleSelect(c.value)
              }}
              onTouchEnd={(e) => {
                e.preventDefault()
                handleSelect(c.value)
              }}
            >
              <span className="flag">{c.flag}</span>
              <span style={{ flex: 1 }}>{c.country}</span>
              <span className="code">{c.value}</span>
            </DropdownItem>
          ))}
        </DropdownList>
      )}
    </Box>
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

