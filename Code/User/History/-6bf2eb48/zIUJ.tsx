import {
  useRef,
  useState,
  useEffect,
  useCallback,
  useLayoutEffect,
} from 'react'
import { createPortal } from 'react-dom'
import { TextInput, Box, Group } from '@mantine/core'
import { TbPhone, TbChevronDown, TbSearch } from 'react-icons/tb'
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
  from { opacity: 0; transform: translateY(-6px) scale(0.98); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
`

const Trigger = styled.button<{
  $height: number
  $size: 'sm' | 'md'
  $open: boolean
}>`
  flex-shrink: 0;
  width: ${(p) => (p.$size === 'sm' ? '100px' : '114px')};
  height: ${(p) => p.$height}px;
  padding: 0 10px 0 12px;
  border: 1.5px solid ${(p) => (p.$open ? '#15B3E0' : '#E4E9F0')};
  border-right: none;
  border-radius: ${(p) => (p.$size === 'sm' ? '8px 0 0 8px' : '12px 0 0 12px')};
  background: ${(p) => (p.$open ? '#EBF8FD' : '#F5F7FA')};
  box-shadow: ${(p) => (p.$open ? '0 0 0 3px rgba(21,179,224,0.14)' : 'none')};
  font-family: 'DM Sans', sans-serif;
  font-size: 13px;
  color: #1a2b3c;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 5px;
  outline: none;
  transition:
    border-color 0.15s,
    box-shadow 0.15s,
    background 0.15s;
  -webkit-tap-highlight-color: transparent;
  user-select: none;
  -webkit-user-select: none;

  .chevron {
    color: ${(p) => (p.$open ? '#15B3E0' : '#9eadb8')};
    flex-shrink: 0;
    transition: transform 0.2s;
    transform: ${(p) => (p.$open ? 'rotate(180deg)' : 'rotate(0deg)')};
  }
`

const DropdownList = styled.ul`
  position: fixed;
  background: #fff;
  border: 1.5px solid #e4e9f0;
  border-radius: 14px;
  box-shadow:
    0 4px 6px -1px rgba(0, 0, 0, 0.08),
    0 16px 40px -4px rgba(1, 41, 112, 0.18);
  padding: 6px;
  margin: 0;
  list-style: none;
  z-index: 999999;
  min-width: 190px;
  max-height: 280px;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  animation: ${dropdownFade} 0.16s cubic-bezier(0.16, 1, 0.3, 1) both;
  overscroll-behavior: contain;

  &::-webkit-scrollbar {
    width: 4px;
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  &::-webkit-scrollbar-thumb {
    background: #e4e9f0;
    border-radius: 4px;
  }
`

const SearchRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px 10px;
  border-bottom: 1px solid #f0f3f8;
  margin-bottom: 4px;

  svg {
    color: #9eadb8;
    flex-shrink: 0;
  }

  input {
    flex: 1;
    border: none;
    outline: none;
    font-family: 'DM Sans', sans-serif;
    font-size: 13px;
    color: #1a2b3c;
    background: transparent;
    min-width: 0;
    &::placeholder {
      color: #b0bbc8;
    }
  }
`

const DropdownItem = styled.li<{ $active: boolean }>`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 10px;
  cursor: pointer;
  background: ${(p) => (p.$active ? '#EBF8FD' : 'transparent')};
  border-radius: 8px;
  font-family: 'DM Sans', sans-serif;
  font-size: 13px;
  color: #1a2b3c;
  font-weight: ${(p) => (p.$active ? 600 : 400)};
  transition: background 0.1s;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;

  &:hover {
    background: ${(p) => (p.$active ? '#EBF8FD' : '#f5f8ff')};
  }

  .flag {
    font-size: 18px;
    line-height: 1;
    flex-shrink: 0;
  }
  .country {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .code {
    color: ${(p) => (p.$active ? '#15B3E0' : '#9eadb8')};
    font-size: 12px;
    font-weight: 500;
    flex-shrink: 0;
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

interface DropPos {
  top: number
  left: number
  width: number
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
  const [search, setSearch] = useState('')
  const [dropPos, setDropPos] = useState<DropPos>({
    top: 0,
    left: 0,
    width: 190,
  })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  // Track whether we're waiting for a card-lift animation to settle
  const rafRef = useRef<number>(0)

  const selected =
    COUNTRY_CODES.find((c) => c.value === value.countryCode) ?? COUNTRY_CODES[0]

  const filtered = search.trim()
    ? COUNTRY_CODES.filter(
        (c) =>
          c.country.toLowerCase().includes(search.toLowerCase()) ||
          c.value.includes(search),
      )
    : COUNTRY_CODES

  const recalcPos = useCallback(() => {
    if (!triggerRef.current) return
    const r = triggerRef.current.getBoundingClientRect()
    const dropWidth = Math.max(r.width + 76, 190)
    const dropHeight = Math.min(filtered.length * 44 + 70, 280)
    const spaceBelow = window.innerHeight - r.bottom
    const top =
      spaceBelow > dropHeight + 8 ? r.bottom + 4 : r.top - dropHeight - 4
    setDropPos({ top, left: r.left, width: dropWidth })
  }, [filtered.length])

  // Recalc position on EVERY render while open — catches card-lift layout shifts
  useLayoutEffect(() => {
    if (!open) return
    // Double rAF: wait for the browser to finish any layout changes (e.g. card
    // going position:fixed) before measuring the trigger position
    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = requestAnimationFrame(() => {
        recalcPos()
      })
    })
    return () => cancelAnimationFrame(rafRef.current)
  })

  // Focus search input after open
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => searchRef.current?.focus(), 50)
      return () => clearTimeout(t)
    }
  }, [open])

  // Single click handler — fires once on both mouse and touch
  const handleTriggerClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault()
      e.stopPropagation()
      setOpen((prev) => {
        if (prev) setSearch('')
        return !prev
      })
    },
    [],
  )

  const handleSelect = useCallback(
    (code: string) => {
      onChange({ ...value, countryCode: code })
      setOpen(false)
      setSearch('')
    },
    [value, onChange],
  )

  // Close on outside click/touch
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
      setSearch('')
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('touchstart', close, { passive: true })
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('touchstart', close)
    }
  }, [open])

  // Reposition on scroll/resize
  useEffect(() => {
    if (!open) return
    window.addEventListener('scroll', recalcPos, true)
    window.addEventListener('resize', recalcPos)
    return () => {
      window.removeEventListener('scroll', recalcPos, true)
      window.removeEventListener('resize', recalcPos)
    }
  }, [open, recalcPos])

  const dropdown = open
    ? createPortal(
        <DropdownList
          ref={listRef}
          role="listbox"
          style={{ top: dropPos.top, left: dropPos.left, width: dropPos.width }}
        >
          <SearchRow>
            <TbSearch size={14} />
            <input
              ref={searchRef}
              value={search}
              // IMPORTANT: stop focusin/blur from bubbling to the card's
              // onFocus/onBlur handlers so the card doesn't lift/unlift while
              // the dropdown is open
              onFocus={(e) => e.stopPropagation()}
              onBlur={(e) => e.stopPropagation()}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search country…"
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setOpen(false)
                  setSearch('')
                }
                if (e.key === 'Enter' && filtered.length > 0) {
                  handleSelect(filtered[0].value)
                }
              }}
            />
          </SearchRow>
          {filtered.length === 0 && (
            <li
              style={{
                padding: '14px 10px',
                textAlign: 'center',
                fontFamily: "'DM Sans',sans-serif",
                fontSize: 13,
                color: '#9eadb8',
              }}
            >
              No results
            </li>
          )}
          {filtered.map((c) => (
            <DropdownItem
              key={c.value}
              $active={c.value === value.countryCode}
              role="option"
              aria-selected={c.value === value.countryCode}
              onPointerDown={(e) => {
                // Prevent blur on phone input before click fires
                e.preventDefault()
              }}
              onClick={() => handleSelect(c.value)}
            >
              <span className="flag">{c.flag}</span>
              <span className="country">{c.country}</span>
              <span className="code">{c.value}</span>
            </DropdownItem>
          ))}
        </DropdownList>,
        document.body,
      )
    : null

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
          onClick={handleTriggerClick}
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
              color: open ? '#15B3E0' : '#6B7A8D',
              fontWeight: open ? 600 : 400,
              transition: 'color 0.15s',
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
      {dropdown}
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

