import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import * as yup from 'yup'
import {
  Box, Button, Container, Group, Stack, Text, Textarea,
  TextInput, Progress, Image, ActionIcon, Badge, Divider,
} from '@mantine/core'
import { Controller } from 'react-hook-form'
import {
  TbArrowLeft, TbUpload, TbX,
  TbMapPin, TbPlus, TbCheck, TbClock,
  TbCurrencyDollar, TbPhone, TbPencil, TbCamera, TbChevronLeft, TbChevronRight,
  TbShieldPlus,
} from 'react-icons/tb'
import { notifications } from '@mantine/notifications'
import { PageWrapper, NavHeaderBar, NavHeaderTitle } from '@shared/ui/layout'
import { FormSelect } from '@shared/ui/form'
import { SavedColors } from '@shared/constants'
import { supabase, DbAddress, DbInsurance } from '../../../lib/supabase'
import { useAuth } from '../../../features/auth/context/AuthContext'
import AddressPickerModal, { AddressData } from '../../components/AddressPickerModal'

// ─── Image resize ─────────────────────────────────────────────────────────────
const RESIZE_MAX_PX = 2400
const RESIZE_QUALITY = 0.88

function resizeImage(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = document.createElement('img')
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const { naturalWidth: w, naturalHeight: h } = img
      const scale = Math.min(1, RESIZE_MAX_PX / Math.max(w, h))
      if (scale >= 1) { resolve(file); return }
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(w * scale)
      canvas.height = Math.round(h * scale)
      const ctx = canvas.getContext('2d')
      if (!ctx) { resolve(file); return }
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(
        (blob) => {
          if (!blob) { resolve(file); return }
          resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }))
        },
        'image/jpeg', RESIZE_QUALITY,
      )
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')) }
    img.src = url
  })
}

function openCamera(onFile: (f: File) => void): void {
  const tmp = document.createElement('input')
  tmp.type = 'file'
  tmp.accept = 'image/*'
  tmp.capture = 'environment'
  tmp.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0'
  document.body.appendChild(tmp)
  tmp.onchange = () => {
    const f = tmp.files?.[0]
    if (f) onFile(f)
    document.body.removeChild(tmp)
  }
  tmp.click()
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface AddressHistoryRow {
  id: string; label: string; street: string; city: string; zone: string
  instructions: string | null; latitude: number | null; longitude: number | null
  last_used_at: string; use_count: number
}

type SelectableAddress = {
  source: 'profile' | 'history'; id: string; label: string
  street: string; city: string; zone: string; instructions: string | null
  latitude: number | null; longitude: number | null
  is_default?: boolean; use_count?: number
 py="md"}

type ContactOption = 'profile' | 'custom'

const schema = yup.object({
  profileId:    yup.string().required('Please select a profile'),
  selectedAddr: yup.string().required('Please select a delivery address'),
  contactPhone: yup
    .string()
    .required('Enter a contact number')
    .min(10, 'Phone number is too short')
    .matches(/^[+\d\s()-]{7,20}$/, 'Enter a valid phone number'),
  notes: yup.string().max(400, 'Notes too long (max 400 characters)').optional(),
})
type FormValues = yup.InferType<typeof schema>

// ─── Component ────────────────────────────────────────────────────────────────
export default function UploadPrescription(): JSX.Element {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, profiles, selectedProfile } = useAuth()
  // Task 15: reorder state from OrderHistory
  const reorderState = (location.state as {
    reorderProfileId?: string
    reorderNotes?: string
    reorderContactPhone?: string
    reorderAddressId?: string
    reorderAddressSnap?: Record<string, unknown>
    reorderSignedUrls?: string[]
  } | null)
  const reorderAddressId = reorderState?.reorderAddressId ?? null
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Multi-image state ────────────────────────────────────────────────────────
  const [files, setFiles]           = useState<File[]>([])
  const [previews, setPreviews]     = useState<string[]>([])
  const [activeImg, setActiveImg]   = useState(0)
  const [resizing, setResizing]     = useState(false)

  const [uploading, setUploading]           = useState(false)
  const [progress, setProgress]             = useState(0)
  const [profileAddrs, setProfileAddrs]     = useState<DbAddress[]>([])
  const [historyAddrs, setHistoryAddrs]     = useState<AddressHistoryRow[]>([])
  const [pickerOpen, setPickerOpen]         = useState(false)
  const [loadingAddrs, setLoadingAddrs]     = useState(true)
  const [cashOnly, setCashOnly]             = useState(false)  // will be set true when no insurance on mount
  const [profileInsurances, setProfileInsurances] = useState<DbInsurance[]>([])
  const [selectedInsuranceId, setSelectedInsuranceId] = useState<string | null>(null)
  const [contactOption, setContactOption]   = useState<ContactOption>('profile')
  const [selectedProfileAddrId, setSelectedProfileAddrId]     = useState<string | null>(null)
  const [selectedContactProfileId, setSelectedContactProfileId] = useState<string | null>(null)
  const [addrModalOpen, setAddrModalOpen]       = useState(false)
  const [contactModalOpen, setContactModalOpen] = useState(false)
  const [notesOpen, setNotesOpen]               = useState(false)

  const { control, handleSubmit, reset, watch, setValue, formState: { isSubmitting, errors } } =
    useForm<FormValues>({
      resolver: yupResolver(schema),
      defaultValues: { profileId: '', selectedAddr: '', contactPhone: '', notes: '' },
    })

  const selectedId = watch('selectedAddr')
  const profileId  = watch('profileId')

  const activeProfile     = profiles.find(p => p.id === profileId)
  // Only verified insurance counts — pending is shown but not usable
  const profileHasInsurance = !!(activeProfile?.insurance as { status?: string } | null)?.status &&
    (activeProfile?.insurance as { status?: string } | null)?.status === 'verified'
  const defaultAddress    = selectedProfileAddrId
    ? (profileAddrs.find(a => a.id === selectedProfileAddrId) ?? profileAddrs.find(a => a.is_default) ?? null)
    : (profileAddrs.find(a => a.is_default) ?? null)
  const contactProfile    = selectedContactProfileId
    ? (profiles.find(p => p.id === selectedContactProfileId) ?? activeProfile)
    : activeProfile
  const effectiveProfilePhone = contactProfile?.phone ?? null

  useEffect(() => {
    if (effectiveProfilePhone) { setValue('contactPhone', effectiveProfilePhone); setContactOption('profile') }
    else { setValue('contactPhone', ''); setContactOption('custom') }
  }, [profileId, selectedContactProfileId, effectiveProfilePhone, setValue])

  // Fetch all insurances for the selected profile
  useEffect(() => {
    if (!profileId) { setProfileInsurances([]); setSelectedInsuranceId(null); return }
    supabase
      .from('insurance')
      .select('*')
      .eq('profile_id', profileId)
      .in('status', ['verified', 'pending'])
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        const ins = (data ?? []) as DbInsurance[]
        setProfileInsurances(ins)
        // Auto-select first verified insurance only (pending is not selectable)
        const firstVerified = ins.find(i => i.status === 'verified') ?? null
        setSelectedInsuranceId(firstVerified?.id ?? null)
      })
  }, [profileId])

  // Task 7: when profile changes, auto-set cashOnly based on insurance status
  useEffect(() => {
    if (!profileId) return
    if (!profileHasInsurance) setCashOnly(true)
    else setCashOnly(false)
  }, [profileId, profileHasInsurance])

  // Revoke object URLs on unmount
  useEffect(() => () => { previews.forEach(p => URL.revokeObjectURL(p)) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Address list ──────────────────────────────────────────────────────────
  const allAddresses: SelectableAddress[] = [
    ...profileAddrs.map(a => ({ source: 'profile' as const, id: a.id, label: a.label, street: a.street, city: a.city, zone: a.zone, instructions: a.instructions ?? null, latitude: a.latitude ?? null, longitude: a.longitude ?? null, is_default: a.is_default })),
    ...historyAddrs.map(a => ({ source: 'history' as const, id: a.id, label: a.label, street: a.street, city: a.city, zone: a.zone, instructions: a.instructions, latitude: a.latitude, longitude: a.longitude, use_count: a.use_count })),
  ]

  const loadAddresses = useCallback(async () => {
    if (!user) return
    const [{ data: pAddrs }, { data: hAddrs }] = await Promise.all([
      supabase.from('addresses').select('*').eq('user_id', user.id).order('is_default', { ascending: false }),
      supabase.from('order_address_history').select('*').eq('user_id', user.id).order('last_used_at', { ascending: false }).limit(5),
    ])
    if (pAddrs) setProfileAddrs(pAddrs as DbAddress[])
    if (hAddrs) setHistoryAddrs(hAddrs as AddressHistoryRow[])
    setLoadingAddrs(false)
    if (pAddrs) {
      const def = (pAddrs as DbAddress[]).find(a => a.is_default)
      if (def) {
        setValue('selectedAddr', def.id)
        setSelectedProfileAddrId(def.id)
      } else if ((pAddrs as DbAddress[]).length > 0) {
        // No default — pick first profile address
        const first = (pAddrs as DbAddress[])[0]
        setValue('selectedAddr', first.id)
        setSelectedProfileAddrId(first.id)
      } else if (hAddrs && (hAddrs as AddressHistoryRow[]).length > 0) {
        // No profile addresses — fall back to most-recently-used
        setValue('selectedAddr', (hAddrs as AddressHistoryRow[])[0].id)
      }
    }
    // Reorder: override default with the address from the previous order
    // Must run after addresses are loaded so the ID is recognised by the select
    if (reorderAddressId) {
      setValue('selectedAddr', reorderAddressId)
    }
  }, [user, setValue]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (profiles.length > 0) {
      // Always use the active selected profile — no manual selection
      const preferred = reorderState?.reorderProfileId ?? selectedProfile?.id ?? profiles[0].id
      reset((prev: FormValues) => ({
        ...prev,
        profileId:    preferred,
        notes:        prev.notes        || reorderState?.reorderNotes    || '',
        contactPhone: prev.contactPhone || reorderState?.reorderContactPhone || '',
      }))
    }
  }, [profiles, selectedProfile, reset]) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync profileId whenever selectedProfile changes
  useEffect(() => {
    if (selectedProfile?.id) setValue('profileId', selectedProfile.id)
  }, [selectedProfile, setValue])

  useEffect(() => { loadAddresses() }, [loadAddresses])

  // Reorder: pre-load prescription images from signed URLs of the previous order
  useEffect(() => {
    const urls = reorderState?.reorderSignedUrls
    if (!urls?.length) return
    let cancelled = false
    const loadImages = async (): Promise<void> => {
      const fetched: File[] = []
      for (let i = 0; i < urls.length; i++) {
        try {
          const res = await fetch(urls[i])
          if (!res.ok || cancelled) break
          const blob = await res.blob()
          const ext = blob.type.includes('png') ? 'png' : 'jpg'
          fetched.push(new File([blob], `reorder-${i + 1}.${ext}`, { type: blob.type }))
        } catch {
          // skip failed images silently
        }
      }
      if (!cancelled && fetched.length) {
        await handleFiles(fetched)
      }
    }
    void loadImages()
    return () => { cancelled = true }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── New address from picker ──────────────────────────────────────────────
  const handleNewAddress = async (addr: AddressData) => {
    if (!user) return
    const existing = historyAddrs.find(h =>
      h.street.toLowerCase() === addr.street.toLowerCase() &&
      h.city?.toLowerCase() === addr.city?.toLowerCase()
    )
    let savedId: string
    if (existing) {
      await supabase.from('order_address_history').update({
        label: addr.label || existing.label, instructions: addr.instructions || existing.instructions,
        latitude: addr.latitude ?? existing.latitude, longitude: addr.longitude ?? existing.longitude,
        last_used_at: new Date().toISOString(), use_count: existing.use_count + 1,
      }).eq('id', existing.id)
      savedId = existing.id
    } else {
      const { data } = await supabase.from('order_address_history').insert({
        user_id: user.id, label: addr.label || 'One-time Address',
        street: addr.street, city: addr.city || '', zone: addr.zone || '',
        instructions: addr.instructions || null, latitude: addr.latitude, longitude: addr.longitude,
      }).select('id').single()
      savedId = (data as { id: string })?.id ?? ''
    }
    await loadAddresses()
    if (savedId) setValue('selectedAddr', savedId)
  }

  // ── File handler — accepts multiple ──────────────────────────────────────
  const handleFiles = async (incoming: File[]) => {
    const valid = incoming.filter(f => {
      if (!f.type.startsWith('image/')) {
        notifications.show({ title: 'Invalid file type', message: `${f.name} is not an image.`, color: 'orange' })
        return false
      }
      if (f.size > 10 * 1024 * 1024) {
        notifications.show({ title: 'File too large', message: `${f.name} exceeds 10 MB.`, color: 'orange' })
        return false
      }
      return true
    })
    if (!valid.length) return

    setResizing(true)
    const resized: File[] = []
    for (const f of valid) {
      try { resized.push(await resizeImage(f)) }
      catch { resized.push(f) }
    }
    setResizing(false)

    // Revoke old previews
    setPreviews(prev => { prev.forEach(p => URL.revokeObjectURL(p)); return [] })

    setFiles(prev => {
      const combined = [...prev, ...resized]
      const newPreviews = combined.map(f => URL.createObjectURL(f))
      setPreviews(newPreviews)
      setActiveImg(combined.length - 1)
      return combined
    })
  }

  const removeImage = (idx: number) => {
    URL.revokeObjectURL(previews[idx])
    setFiles(prev => prev.filter((_, i) => i !== idx))
    setPreviews(prev => prev.filter((_, i) => i !== idx))
    setActiveImg(prev => Math.max(0, prev >= idx ? prev - 1 : prev))
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  const onSubmit = async (values: FormValues) => {
    if (!user) return
    if (!files.length) {
      notifications.show({ title: 'No image selected', message: 'Please upload at least one prescription image.', color: 'orange' })
      return
    }
    const chosen = allAddresses.find(a => a.id === values.selectedAddr)
    if (!chosen) {
      notifications.show({ title: 'Address not found', message: 'Please select a delivery address.', color: 'orange' })
      return
    }

    setUploading(true)
    setProgress(10)

    // Upload all images
    const uploadedPaths: string[] = []
    const perFile = 60 / files.length
    for (const f of files) {
      const ext = f.name.split('.').pop() || 'jpg'
      const filePath = `${user.id}/prescriptions/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error: uploadErr } = await supabase.storage.from('prescriptions').upload(filePath, f, { contentType: f.type, upsert: false })
      if (uploadErr) {
        notifications.show({ title: 'Upload failed', message: uploadErr.message, color: 'red' })
        setUploading(false); setProgress(0); return
      }
      uploadedPaths.push(filePath)
      setProgress(p => Math.min(70, p + perFile))
    }

    setProgress(75)

    const { error: orderErr } = await supabase.from('orders').insert({
      user_id:      user.id,
      profile_id:   values.profileId,
      prescription_url:  uploadedPaths[0],   // first image for backward compat
      prescription_urls: uploadedPaths,       // all images
      prescription_notes: values.notes,
      status:       'prescription_uploaded',
      insurance_status: 'none',
      delivery_fee: 0,  // pharmacy sets this via the delivery product row
      address_id:   chosen.source === 'profile' ? chosen.id : null,
      delivery_address_snapshot: {
        id: chosen.id, source: chosen.source, label: chosen.label,
        street: chosen.street, city: chosen.city, zone: chosen.zone,
        instructions: chosen.instructions, latitude: chosen.latitude, longitude: chosen.longitude,
      },
      cash_only:     cashOnly,
      contact_phone: values.contactPhone,
      selected_insurance_id: (!cashOnly && selectedInsuranceId) ? selectedInsuranceId : null,
    })

    if (orderErr) {
      notifications.show({ title: 'Error', message: orderErr.message, color: 'red' })
      setUploading(false); setProgress(0); return
    }

    if (chosen.source === 'history') {
      const existing = historyAddrs.find(h => h.id === chosen.id)
      if (existing) {
        await supabase.from('order_address_history').update({
          last_used_at: new Date().toISOString(), use_count: existing.use_count + 1,
        }).eq('id', chosen.id)
      }
    }

    setProgress(100)
    notifications.show({ title: 'Submitted', message: 'Prescription received. Pharmacy will review shortly.', color: 'teal' })
    setUploading(false)
    navigate('/dashboard')
  }

  // ── Address card (used inside AddressPickerModal list in modal) ──────────────────────────────────────────────
  const renderAddrCard = (addr: SelectableAddress) => {
    const isSelected = selectedId === addr.id
    return (
      <Box key={`${addr.source}-${addr.id}`} onClick={() => { setValue('selectedAddr', addr.id); setAddrModalOpen(false) }} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px', borderRadius: 10, cursor: 'pointer', border: `2px solid ${isSelected ? SavedColors.Primaryblue : SavedColors.DemWhite}`, background: isSelected ? '#EBF7FD' : '#fff', transition: 'all 0.15s', marginBottom: 8 }}>
        <Box style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0, background: isSelected ? SavedColors.Primaryblue : '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {isSelected ? <TbCheck size={16} color="#fff"/> : <TbMapPin size={16} color="#9ca3af"/>}
        </Box>
        <Box style={{ flex: 1, minWidth: 0 }}>
          <Group gap={6} mb={2}>
            <Text size="sm" fw={700} c={SavedColors.TextColor}>{addr.label}</Text>
            {addr.is_default && <Badge size="xs" color="lotusCyan" variant="light">Default</Badge>}
            {addr.source === 'history' && <Badge size="xs" color="gray" variant="light" leftSection={<TbClock size={9}/>}>Recent</Badge>}
          </Group>
          <Text size="xs" c="dimmed">{addr.street}{addr.city ? `, ${addr.city}` : ''}{addr.zone ? ` — ${addr.zone}` : ''}</Text>
          {addr.instructions && <Text size="xs" c="dimmed" mt={2} style={{ fontStyle: 'italic' }}>{addr.instructions}</Text>}
        </Box>
      </Box>
    )
  }

  const selectedAddrObj = allAddresses.find(a => a.id === selectedId)
  const selectedContactPhone = watch('contactPhone')

  return (
    <PageWrapper>
      <style>{`
        @media (min-width: 900px) {
          .desktop-submit-btn { display: block !important; }
        }
      `}</style>
      <NavHeaderBar>
        <Button variant="subtle" color="lotusCyan" leftSection={<TbArrowLeft size={16}/>} onClick={() => navigate('/dashboard')} style={{ fontFamily:"'DM Sans',sans-serif", fontWeight:600, fontSize:13 }}>Home</Button>
        <NavHeaderTitle>Upload Prescription</NavHeaderTitle>
      </NavHeaderBar>

      <Container size="md" py={0} px={0} pb={80}>
        <form onSubmit={handleSubmit(onSubmit)}>
            <Stack gap="sm"  px="md">

              {/* ── Prescription Images ── */}
              <Box>
                <Text size="sm" fw={600} mb={8} c={SavedColors.TextColor}>
                  Prescription{' '}<Text component="span" c="red">*</Text>
                </Text>

                {/* Preview if images selected */}
                {previews.length > 0 && (
                  <Box mb={8}>
                    <Box style={{ position: 'relative', marginBottom: 6 }}>
                      <Image
                        src={previews[activeImg]}
                        alt={`Prescription ${activeImg + 1}`}
                        radius="md"
                        style={{ maxHeight: 200, objectFit: 'contain', background: '#f0f4f8', border: `1px solid ${SavedColors.DemWhite}` }}
                      />
                      <ActionIcon color="red" variant="filled" radius="xl" size="sm"
                        style={{ position: 'absolute', top: 8, right: 8 }}
                        onClick={() => removeImage(activeImg)}>
                        <TbX size={12}/>
                      </ActionIcon>
                      {previews.length > 1 && (
                        <>
                          <ActionIcon variant="filled" color="dark" radius="xl" size="sm"
                            style={{ position: 'absolute', top: '50%', left: 8, transform: 'translateY(-50%)' }}
                            onClick={() => setActiveImg(i => (i - 1 + previews.length) % previews.length)}>
                            <TbChevronLeft size={14}/>
                          </ActionIcon>
                          <ActionIcon variant="filled" color="dark" radius="xl" size="sm"
                            style={{ position: 'absolute', top: '50%', right: 8, transform: 'translateY(-50%)' }}
                            onClick={() => setActiveImg(i => (i + 1) % previews.length)}>
                            <TbChevronRight size={14}/>
                          </ActionIcon>
                        </>
                      )}
                    </Box>
                    {previews.length > 1 && (
                      <Group gap={5} wrap="wrap" mb={4}>
                        {previews.map((src, i) => (
                          <Box key={i} onClick={() => setActiveImg(i)}
                            style={{ width: 44, height: 44, borderRadius: 6, overflow: 'hidden', cursor: 'pointer',
                              border: `2px solid ${i === activeImg ? SavedColors.Primaryblue : SavedColors.DemWhite}`, flexShrink: 0 }}>
                            <img src={src} alt={`thumb-${i}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                          </Box>
                        ))}
                      </Group>
                    )}
                  </Box>
                )}

                {/* Upload buttons */}
                {!resizing && (
                  <Group gap={8} grow>
                    <Box
                      tabIndex={0} role="button"
                      onClick={() => fileInputRef.current?.click()}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInputRef.current?.click() } }}
                      style={{ border: `1.5px dashed ${SavedColors.Primaryblue}`, borderRadius: 10, padding: '14px 8px',
                        textAlign: 'center', cursor: 'pointer', background: SavedColors.lightBlue, outline: 'none' }}
                    >
                      <TbUpload size={22} color={SavedColors.Primaryblue} style={{ margin: '0 auto 4px', display: 'block' }}/>
                      <Text size="xs" fw={600} c={SavedColors.Primaryblue}>{previews.length > 0 ? 'Add more' : 'Upload'}</Text>
                    </Box>
                    <Box
                      tabIndex={0} role="button"
                      onClick={() => openCamera(f => handleFiles([f]))}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openCamera(f => handleFiles([f])) } }}
                      style={{ border: `1.5px dashed ${SavedColors.Primaryblue}`, borderRadius: 10, padding: '14px 8px',
                        textAlign: 'center', cursor: 'pointer', background: '#fff', outline: 'none' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = SavedColors.lightBlue }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#fff' }}
                    >
                      <TbCamera size={22} color={SavedColors.Primaryblue} style={{ margin: '0 auto 4px', display: 'block' }}/>
                      <Text size="xs" fw={600} c={SavedColors.Primaryblue}>Camera</Text>
                    </Box>
                  </Group>
                )}

                {resizing && (
                  <Group gap="xs" py="xs">
                    <div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid #15B3E0', borderTopColor: 'transparent', animation: 'spin 0.7s linear infinite' }}/>
                    <Text size="xs" c="dimmed">Optimising…</Text>
                  </Group>
                )}

                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple hidden
                  onChange={e => { const fs = Array.from(e.target.files ?? []); if (fs.length) handleFiles(fs); e.target.value = '' }}/>
              </Box>

              <Divider />

              {/* ── Delivery Address — summary row → opens modal ── */}
              <Box>
                <Text size="sm" fw={600} mb={8} c={SavedColors.TextColor}>
                  Delivery Address{' '}<Text component="span" c="red">*</Text>
                </Text>
                {loadingAddrs ? (
                  <Group gap="xs" py="xs">
                    <div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid #15B3E0', borderTopColor: 'transparent', animation: 'spin 0.7s linear infinite' }}/>
                    <Text size="xs" c="dimmed">Loading…</Text>
                  </Group>
                ) : (
                  <Box
                    onClick={() => {
                      if (allAddresses.length === 0) {
                        setPickerOpen(true)
                      } else {
                        setAddrModalOpen(true)
                      }
                    }}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderRadius: 10, cursor: 'pointer', border: `1.5px solid ${errors.selectedAddr ? '#EF4444' : (selectedAddrObj ? SavedColors.Primaryblue : SavedColors.DemWhite)}`, background: selectedAddrObj ? '#EBF7FD' : '#FAFBFD', transition: 'all 0.15s' }}
                  >
                    <Box style={{ width: 34, height: 34, borderRadius: '50%', flexShrink: 0, background: selectedAddrObj ? SavedColors.Primaryblue : '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <TbMapPin size={15} color={selectedAddrObj ? '#fff' : '#9ca3af'}/>
                    </Box>
                    <Box style={{ flex: 1, minWidth: 0 }}>
                      {selectedAddrObj ? (
                        <>
                          <Text size="sm" fw={700} c={SavedColors.TextColor} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedAddrObj.label}</Text>
                          <Text size="xs" c="dimmed" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedAddrObj.street}{selectedAddrObj.city ? `, ${selectedAddrObj.city}` : ''}</Text>
                        </>
                      ) : (
                        <Text size="sm" c="dimmed">{allAddresses.length === 0 ? 'Tap to add an address' : 'Select delivery address'}</Text>
                      )}
                    </Box>
                    <TbChevronRight size={16} color="#9ca3af" style={{ flexShrink: 0 }}/>
                  </Box>
                )}
                {errors.selectedAddr && <Text size="xs" c="red" mt={4}>{errors.selectedAddr.message}</Text>}
              </Box>

              {/* ── Contact Number — summary row → opens modal ── */}
              <Box>
                <Text size="sm" fw={600} mb={8} c={SavedColors.TextColor}>
                  Contact Number{' '}<Text component="span" c="red">*</Text>
                </Text>
                <Box
                  onClick={() => setContactModalOpen(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderRadius: 10, cursor: 'pointer', border: `1.5px solid ${errors.contactPhone ? '#EF4444' : (selectedContactPhone ? SavedColors.Primaryblue : SavedColors.DemWhite)}`, background: selectedContactPhone ? '#EBF7FD' : '#FAFBFD', transition: 'all 0.15s' }}
                >
                  <Box style={{ width: 34, height: 34, borderRadius: '50%', flexShrink: 0, background: selectedContactPhone ? SavedColors.Primaryblue : '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <TbPhone size={15} color={selectedContactPhone ? '#fff' : '#9ca3af'}/>
                  </Box>
                  <Box style={{ flex: 1, minWidth: 0 }}>
                    {selectedContactPhone ? (
                      <>
                        <Text size="sm" fw={700} c={SavedColors.TextColor}>{selectedContactPhone.slice(0, -4).replace(/\d/g, '•') + selectedContactPhone.slice(-4)}</Text>
                        <Text size="xs" c="dimmed">{contactOption === 'profile' ? `${contactProfile?.name ?? 'Profile'} contact` : 'Custom number'}</Text>
                      </>
                    ) : (
                      <Text size="sm" c="dimmed">Select or enter contact number</Text>
                    )}
                  </Box>
                  <TbChevronRight size={16} color="#9ca3af" style={{ flexShrink: 0 }}/>
                </Box>
                {errors.contactPhone && <Text size="xs" c="red" mt={4}>{errors.contactPhone.message}</Text>}
              </Box>

              <Divider />

              {/* ── Payment Method — horizontal scrollable avatar chips ── */}
              <Box>
                <Text size="sm" fw={600} mb={10} c={SavedColors.TextColor}>Payment</Text>
                <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4, msOverflowStyle: 'none', scrollbarWidth: 'none' }}>
                  {/* Cash option — always first */}
                  <Box
                    onClick={() => setCashOnly(true)}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, flexShrink: 0, cursor: 'pointer', minWidth: 64 }}
                  >
                    <Box style={{ width: 52, height: 52, borderRadius: '50%', background: cashOnly ? SavedColors.Primaryblue : '#f3f4f6', border: `2.5px solid ${cashOnly ? SavedColors.Primaryblue : SavedColors.DemWhite}`, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s', position: 'relative' }}>
                      <TbCurrencyDollar size={22} color={cashOnly ? '#fff' : '#6B7280'}/>
                      {cashOnly && (
                        <Box style={{ position: 'absolute', bottom: -2, right: -2, width: 16, height: 16, borderRadius: '50%', background: '#12B76A', border: '2px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <TbCheck size={9} color="#fff"/>
                        </Box>
                      )}
                    </Box>
                    <Text size="10px" c={cashOnly ? SavedColors.Primaryblue : 'dimmed'} fw={cashOnly ? 700 : 400} style={{ textAlign: 'center' }}>Cash</Text>
                  </Box>
                  {/* Insurance options */}
                  {profileInsurances.map(ins => {
                    const isPending = ins.status === 'pending'
                    const isSelected = !cashOnly && selectedInsuranceId === ins.id && !isPending
                    const shortName = ins.provider.split(' ').map((w: string) => w[0]).join('').slice(0, 3).toUpperCase()
                    return (
                      <Box
                        key={ins.id}
                        onClick={() => { if (!isPending) { setCashOnly(false); setSelectedInsuranceId(ins.id) } }}
                        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, flexShrink: 0, cursor: isPending ? 'not-allowed' : 'pointer', minWidth: 64, opacity: isPending ? 0.6 : 1 }}
                      >
                        <Box style={{ width: 52, height: 52, borderRadius: '50%', background: isSelected ? SavedColors.Primaryblue : isPending ? '#f9f3e3' : '#f3f4f6', border: `2.5px solid ${isSelected ? SavedColors.Primaryblue : isPending ? '#F59F00' : SavedColors.DemWhite}`, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s', position: 'relative' }}>
                          <Text style={{ fontSize: 13, fontWeight: 800, color: isSelected ? '#fff' : isPending ? '#d97706' : '#6B7280', fontFamily: "'DM Sans',sans-serif" }}>{shortName}</Text>
                          {isPending && (
                            <Box style={{ position: 'absolute', bottom: -2, right: -2, width: 16, height: 16, borderRadius: '50%', background: '#F59F00', border: '2px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <TbClock size={9} color="#fff"/>
                            </Box>
                          )}
                          {isSelected && !isPending && (
                            <Box style={{ position: 'absolute', bottom: -2, right: -2, width: 16, height: 16, borderRadius: '50%', background: '#12B76A', border: '2px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <TbCheck size={9} color="#fff"/>
                            </Box>
                          )}
                        </Box>
                        <Text size="10px" c={isSelected ? SavedColors.Primaryblue : isPending ? '#d97706' : 'dimmed'} fw={isSelected || isPending ? 700 : 400} style={{ textAlign: 'center', maxWidth: 64, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ins.provider}</Text>
                        {isPending && <Badge size="xs" color="yellow" variant="light" style={{ fontSize: 8 }}>Pending</Badge>}
                      </Box>
                    )
                  })}
                  {/* Add insurance CTA chip — only when profile has no insurance */}
                  {!profileHasInsurance && profileId && (
                    <Box
                      onClick={() => navigate('/insurance-management')}
                      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, flexShrink: 0, cursor: 'pointer', minWidth: 64 }}
                    >
                      <Box style={{ width: 52, height: 52, borderRadius: '50%', background: '#f3f4f6', border: `2px dashed ${SavedColors.DemWhite}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <TbShieldPlus size={20} color="#9ca3af"/>
                      </Box>
                      <Text size="10px" c="dimmed" style={{ textAlign: 'center', maxWidth: 64, lineHeight: 1.2 }}>Add Insurance</Text>
                    </Box>
                  )}
                </div>
                {/* Pending insurance note */}
                {!cashOnly && selectedInsuranceId && profileInsurances.find(i => i.id === selectedInsuranceId)?.status === 'pending' && (
                  <Text size="xs" c="dimmed" mt={6}>Insurance pending — you can still submit and it'll be applied when verified.</Text>
                )}
              </Box>

              <Divider />

              {/* ── Notes — toggle checkbox ── */}
              <Box>
                <Box
                  onClick={() => setNotesOpen(v => !v)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}
                >
                  <Box style={{ width: 20, height: 20, borderRadius: 5, border: `2px solid ${notesOpen ? SavedColors.Primaryblue : '#D1D5DB'}`, background: notesOpen ? SavedColors.Primaryblue : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s' }}>
                    {notesOpen && <TbCheck size={12} color="#fff"/>}
                  </Box>
                  <Text size="sm" fw={500} c={SavedColors.TextColor}>Add note for pharmacist</Text>
                </Box>
                {notesOpen && (
                  <Box mt={8}>
                    <Controller name="notes" control={control} render={({ field }) => (
                      <Textarea {...field} placeholder="Any allergies, preferred brands, or special instructions…" rows={2} radius="md" autoFocus/>
                    )}/>
                  </Box>
                )}
              </Box>

              {uploading && progress < 100 && <Progress value={progress} color="lotusCyan" size="sm" animated/>}

              {/* Hidden submit trigger for bottom bar */}
              <button id="upload-prescription-submit" type="submit" style={{ display: 'none' }} aria-hidden="true" />

              {/* Desktop-only submit button (bottom bar hidden on desktop) */}
              <Box
                style={{
                  position: 'sticky', bottom: 0,
                  margin: '0 0 0', padding: '10px 0 24px',
                  background: '#fff', borderTop: `1px solid ${SavedColors.DemWhite}`,
                  zIndex: 10,
                  display: 'none',
                }}
                className="desktop-submit-btn"
              >
                <Button type="submit" fullWidth loading={isSubmitting || uploading || resizing} radius={8}
                  leftSection={<TbUpload size={16} />}
                  style={{ background: 'linear-gradient(135deg,#15B3E0 0%,#012970 100%)', border: 'none', boxShadow: '0 4px 18px rgba(21,179,224,0.35)', height: 46 }}>
                  Submit Prescription
                </Button>
              </Box>
            </Stack>
        </form>
      </Container>

      {/* ── Address picker modal (new address) ── */}
      <AddressPickerModal opened={pickerOpen} onClose={() => setPickerOpen(false)} onSave={handleNewAddress} title="Add New Address"/>

      {/* ── Address selector modal ── */}
      {addrModalOpen && (
        <Box
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 500, display: 'flex', alignItems: 'flex-end' }}
          className="modal-backdrop-addr"
          onClick={() => setAddrModalOpen(false)}
        >
          <style>{`
            @media (min-width: 900px) {
              .modal-backdrop-addr,
              .modal-backdrop-contact { align-items: center !important; justify-content: center !important; }
              .modal-sheet-addr,
              .modal-sheet-contact {
                border-radius: 16px !important;
                max-height: 70vh !important;
                width: 460px !important;
                padding-bottom: 24px !important;
              }
            }
          `}</style>
          <Box
            onClick={e => e.stopPropagation()}
            className="modal-sheet-addr"
            style={{ width: '100%', maxWidth: 520, margin: '0 auto', background: '#fff', borderRadius: '16px 16px 0 0', padding: '20px 20px 90px', maxHeight: '80vh', overflowY: 'auto' }}
          >
            <Group justify="space-between" mb="md">
              <Text fw={700} size="sm" c={SavedColors.TextColor}>Delivery Address</Text>
              <ActionIcon variant="subtle" color="gray" onClick={() => setAddrModalOpen(false)}><TbX size={16}/></ActionIcon>
            </Group>
            {allAddresses.map(addr => renderAddrCard(addr))}
            <Box
              onClick={() => { setAddrModalOpen(false); setPickerOpen(true) }}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderRadius: 10, cursor: 'pointer', border: `1.5px dashed ${SavedColors.DemWhite}`, marginTop: 4 }}
            >
              <Box style={{ width: 34, height: 34, borderRadius: '50%', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <TbPlus size={15} color="#9ca3af"/>
              </Box>
              <Text size="sm" fw={600} c={SavedColors.TextColor}>Use a different address</Text>
            </Box>
          </Box>
        </Box>
      )}

      {/* ── Contact selector modal ── */}
      {contactModalOpen && (
        <Box
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 500, display: 'flex', alignItems: 'flex-end' }}
          className="modal-backdrop-contact"
          onClick={() => setContactModalOpen(false)}
        >
          <Box
            onClick={e => e.stopPropagation()}
            className="modal-sheet-contact"
            style={{ width: '100%', maxWidth: 520, margin: '0 auto', background: '#fff', borderRadius: '16px 16px 0 0', padding: '20px 20px 90px', maxHeight: '80vh', overflowY: 'auto' }}
          >
            <Group justify="space-between" mb="md">
              <Text fw={700} size="sm" c={SavedColors.TextColor}>Contact Number</Text>
              <ActionIcon variant="subtle" color="gray" onClick={() => setContactModalOpen(false)}><TbX size={16}/></ActionIcon>
            </Group>
            <Stack gap="xs">
              {profiles.filter(p => p.phone).map(p => {
                const isSelected = contactOption === 'profile' && (selectedContactProfileId ?? profileId) === p.id
                const masked = p.phone ? p.phone.slice(0, -4).replace(/\d/g, '•') + p.phone.slice(-4) : ''
                return (
                  <Box key={p.id} onClick={() => { setSelectedContactProfileId(p.id); if (p.phone) { setValue('contactPhone', p.phone); setContactOption('profile') } setContactModalOpen(false) }}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderRadius: 10, cursor: 'pointer', border: `2px solid ${isSelected ? SavedColors.Primaryblue : SavedColors.DemWhite}`, background: isSelected ? '#EBF7FD' : '#fff' }}>
                    <Box style={{ width: 34, height: 34, borderRadius: '50%', flexShrink: 0, background: isSelected ? SavedColors.Primaryblue : '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {isSelected ? <TbCheck size={15} color="#fff"/> : <TbPhone size={15} color="#9ca3af"/>}
                    </Box>
                    <Box style={{ flex: 1, minWidth: 0 }}>
                      <Text size="sm" fw={700} c={SavedColors.TextColor}>{masked}</Text>
                      <Text size="xs" c="dimmed">{p.name}{p.is_main_account ? ' (Me)' : ''}</Text>
                    </Box>
                  </Box>
                )
              })}
              {/* Enter custom number */}
              <Box onClick={() => setContactOption('custom')}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderRadius: 10, cursor: 'pointer', border: `2px solid ${contactOption === 'custom' ? SavedColors.Primaryblue : SavedColors.DemWhite}`, background: contactOption === 'custom' ? '#EBF7FD' : '#fff' }}>
                <Box style={{ width: 34, height: 34, borderRadius: '50%', flexShrink: 0, background: contactOption === 'custom' ? SavedColors.Primaryblue : '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {contactOption === 'custom' ? <TbCheck size={15} color="#fff"/> : <TbPencil size={15} color="#9ca3af"/>}
                </Box>
                <Text size="sm" fw={600} c={SavedColors.TextColor}>Enter a different number</Text>
              </Box>
              {contactOption === 'custom' && (
                <Controller name="contactPhone" control={control} render={({ field }) => (
                  <TextInput {...field} placeholder="e.g. +256 700 123456" radius="md" error={errors.contactPhone?.message}
                    leftSection={<TbPhone size={14} color={SavedColors.Primaryblue}/>} autoFocus/>
                )}/>
              )}
              {contactOption === 'custom' && (
                <Button size="sm" radius={8}
                  style={{ background: 'linear-gradient(135deg,#15B3E0,#012970)', border: 'none', alignSelf: 'flex-end' }}
                  onClick={() => { if (watch('contactPhone')) setContactModalOpen(false) }}>
                  Confirm
                </Button>
              )}
            </Stack>
          </Box>
        </Box>
      )}
    </PageWrapper>
  )
}
