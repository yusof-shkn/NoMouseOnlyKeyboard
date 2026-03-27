import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import * as yup from 'yup'
import {
  Box,
  Button,
  Container,
  Group,
  Stack,
  Text,
  Textarea,
  TextInput,
  Progress,
  Image,
  ActionIcon,
  Radio,
  Badge,
  Alert,
  Divider,
} from '@mantine/core'
import { Controller } from 'react-hook-form'
import {
  TbArrowLeft,
  TbUpload,
  TbPhoto,
  TbFileDescription,
  TbX,
  TbMapPin,
  TbPlus,
  TbAlertCircle,
  TbCheck,
  TbClock,
  TbShieldOff,
  TbCurrencyDollar,
  TbPhone,
  TbPencil,
  TbCamera,
} from 'react-icons/tb'
import { notifications } from '@mantine/notifications'
import { PageWrapper, PageHeader, ContentCard } from '@shared/ui/layout'
import { FormSelect } from '@shared/ui/form'
import { PageTitle, BlueDivider, SectionLabel } from '@shared/ui/typography'
import { SavedColors } from '@shared/constants'
import { supabase, DbAddress } from '../../../lib/supabase'
import { useAuth } from '../../../features/auth/context/AuthContext'
import AddressPickerModal, {
  AddressData,
} from '../../components/AddressPickerModal'

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_SIZE = 10 * 1024 * 1024

// ── Max dimension after resize — large enough to read every text clearly ──────
// Prescriptions photographed on phones are often 3000–4000px; we cap at 2400
// which keeps all text legible while cutting file size ~60–70%.
const RESIZE_MAX_PX = 2400
const RESIZE_QUALITY = 0.88 // JPEG quality — sharp but not wasteful

// ── Resize an image File using a canvas ────────────────────────────────────────
function resizeImage(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = document.createElement('img')
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)

      const { naturalWidth: w, naturalHeight: h } = img
      const scale = Math.min(1, RESIZE_MAX_PX / Math.max(w, h))

      // If the image is already smaller than the cap, return it unchanged
      if (scale >= 1) {
        resolve(file)
        return
      }

      const canvas = document.createElement('canvas')
      canvas.width = Math.round(w * scale)
      canvas.height = Math.round(h * scale)

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        resolve(file)
        return
      }

      // Use smooth interpolation so text stays sharp after downscaling
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file)
            return
          }
          const resized = new File(
            [blob],
            file.name.replace(/\.[^.]+$/, '.jpg'),
            { type: 'image/jpeg' },
          )
          resolve(resized)
        },
        'image/jpeg',
        RESIZE_QUALITY,
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Image load failed'))
    }
    img.src = url
  })
}

// ── One-time address history row ───────────────────────────────────────────────
interface AddressHistoryRow {
  id: string
  label: string
  street: string
  city: string
  zone: string
  instructions: string | null
  latitude: number | null
  longitude: number | null
  last_used_at: string
  use_count: number
}

// ── Unified selectable address ─────────────────────────────────────────────────
type SelectableAddress = {
  source: 'profile' | 'history'
  id: string
  label: string
  street: string
  city: string
  zone: string
  instructions: string | null
  latitude: number | null
  longitude: number | null
  is_default?: boolean
  use_count?: number
}

const schema = yup.object({
  profileId: yup.string().required('Select a profile'),
  selectedAddr: yup.string().required('Select a delivery address'),
  contactPhone: yup.string().required('Enter a contact number'),
  notes: yup.string().max(400).optional(),
})
type FormValues = yup.InferType<typeof schema>

export default function UploadPrescription() {
  const navigate = useNavigate()
  const { user, profiles, selectedProfile } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [resizing, setResizing] = useState(false)
  const [originalSize, setOriginalSize] = useState<number>(0)
  const [resizedSize, setResizedSize] = useState<number>(0)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [profileAddrs, setProfileAddrs] = useState<DbAddress[]>([])
  const [historyAddrs, setHistoryAddrs] = useState<AddressHistoryRow[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [loadingAddrs, setLoadingAddrs] = useState(true)
  const [cashOnly, setCashOnly] = useState(false)
  const [editingPhone, setEditingPhone] = useState(false)

  const {
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { isSubmitting, errors },
  } = useForm<FormValues>({
    resolver: yupResolver(schema),
    defaultValues: {
      profileId: '',
      selectedAddr: '',
      contactPhone: '',
      notes: '',
    },
  })

  const selectedId = watch('selectedAddr')
  const profileId = watch('profileId')

  // ── Auto-fill contact phone when profile changes ───────────────────────────
  useEffect(() => {
    const profile = profiles.find((p) => p.id === profileId)
    if (profile?.phone) {
      setValue('contactPhone', profile.phone)
      setEditingPhone(false)
    } else {
      setValue('contactPhone', '')
      setEditingPhone(true)
    }
  }, [profileId, profiles, setValue])

  // ── Combine addresses ─────────────────────────────────────────────────────
  const allAddresses: SelectableAddress[] = [
    ...profileAddrs.map((a) => ({
      source: 'profile' as const,
      id: a.id,
      label: a.label,
      street: a.street,
      city: a.city,
      zone: a.zone,
      instructions: a.instructions ?? null,
      latitude: a.latitude ?? null,
      longitude: a.longitude ?? null,
      is_default: a.is_default,
    })),
    ...historyAddrs.map((a) => ({
      source: 'history' as const,
      id: a.id,
      label: a.label,
      street: a.street,
      city: a.city,
      zone: a.zone,
      instructions: a.instructions,
      latitude: a.latitude,
      longitude: a.longitude,
      use_count: a.use_count,
    })),
  ]

  // ── Load addresses ────────────────────────────────────────────────────────
  const loadAddresses = useCallback(async () => {
    if (!user) return
    const [{ data: pAddrs }, { data: hAddrs }] = await Promise.all([
      supabase
        .from('addresses')
        .select('*')
        .eq('user_id', user.id)
        .order('is_default', { ascending: false }),
      supabase
        .from('order_address_history')
        .select('*')
        .eq('user_id', user.id)
        .order('last_used_at', { ascending: false })
        .limit(5),
    ])
    if (pAddrs) setProfileAddrs(pAddrs as DbAddress[])
    if (hAddrs) setHistoryAddrs(hAddrs as AddressHistoryRow[])
    setLoadingAddrs(false)

    if (pAddrs) {
      const def = (pAddrs as DbAddress[]).find((a) => a.is_default)
      if (def) setValue('selectedAddr', def.id)
    }
  }, [user, setValue])

  useEffect(() => {
    if (profiles.length > 0) {
      const preferred = selectedProfile?.id ?? profiles[0].id
      reset((prev: FormValues) => ({
        ...prev,
        profileId: prev.profileId || preferred,
      }))
    }
  }, [profiles, selectedProfile, reset])

  useEffect(() => {
    loadAddresses()
  }, [loadAddresses])
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview)
    },
    [preview],
  )

  // ── Handle new address from picker ────────────────────────────────────────
  const handleNewAddress = async (addr: AddressData) => {
    if (!user) return
    const existing = historyAddrs.find(
      (h) =>
        h.street.toLowerCase() === addr.street.toLowerCase() &&
        h.city?.toLowerCase() === addr.city?.toLowerCase(),
    )
    let savedId: string
    if (existing) {
      await supabase
        .from('order_address_history')
        .update({
          label: addr.label || existing.label,
          instructions: addr.instructions || existing.instructions,
          latitude: addr.latitude ?? existing.latitude,
          longitude: addr.longitude ?? existing.longitude,
          last_used_at: new Date().toISOString(),
          use_count: existing.use_count + 1,
        })
        .eq('id', existing.id)
      savedId = existing.id
    } else {
      const { data } = await supabase
        .from('order_address_history')
        .insert({
          user_id: user.id,
          label: addr.label || 'One-time Address',
          street: addr.street,
          city: addr.city || '',
          zone: addr.zone || '',
          instructions: addr.instructions || null,
          latitude: addr.latitude,
          longitude: addr.longitude,
        })
        .select('id')
        .single()
      savedId = (data as { id: string })?.id ?? ''
    }
    await loadAddresses()
    if (savedId) setValue('selectedAddr', savedId)
  }

  // ── File handler — resize then preview ────────────────────────────────────
  const handleFile = async (f: File) => {
    if (!ACCEPTED.includes(f.type)) {
      notifications.show({
        title: 'Invalid file type',
        message: 'Please upload a JPG, PNG, WebP or GIF image.',
        color: 'orange',
      })
      return
    }
    if (f.size > MAX_SIZE) {
      notifications.show({
        title: 'File too large',
        message: 'Max file size is 10 MB.',
        color: 'orange',
      })
      return
    }

    if (preview) URL.revokeObjectURL(preview)
    setOriginalSize(f.size)
    setResizing(true)

    try {
      const resized = await resizeImage(f)
      setResizedSize(resized.size)
      setFile(resized)
      setPreview(URL.createObjectURL(resized))
    } catch {
      // Fallback — use original file if resize fails
      setFile(f)
      setResizedSize(f.size)
      setPreview(URL.createObjectURL(f))
    } finally {
      setResizing(false)
    }
  }

  const clearFile = () => {
    if (preview) URL.revokeObjectURL(preview)
    setFile(null)
    setPreview(null)
    setOriginalSize(0)
    setResizedSize(0)
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (cameraInputRef.current) cameraInputRef.current.value = ''
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  const onSubmit = async (values: FormValues) => {
    if (!user) return
    if (!file) {
      notifications.show({
        title: 'No image selected',
        message: 'Please upload a prescription image.',
        color: 'orange',
      })
      return
    }

    const chosen = allAddresses.find((a) => a.id === values.selectedAddr)
    if (!chosen) {
      notifications.show({
        title: 'Address not found',
        message: 'Please select a delivery address.',
        color: 'orange',
      })
      return
    }

    setUploading(true)
    setProgress(20)

    const ext = file.name.split('.').pop() || 'jpg'
    const filePath = `${user.id}/prescriptions/${Date.now()}.${ext}`

    const { error: uploadErr } = await supabase.storage
      .from('prescriptions')
      .upload(filePath, file, { contentType: file.type, upsert: false })

    if (uploadErr) {
      notifications.show({
        title: 'Upload failed',
        message: uploadErr.message,
        color: 'red',
      })
      setUploading(false)
      setProgress(0)
      return
    }
    setProgress(70)

    const addressSnapshot = {
      id: chosen.id,
      source: chosen.source,
      label: chosen.label,
      street: chosen.street,
      city: chosen.city,
      zone: chosen.zone,
      instructions: chosen.instructions,
      latitude: chosen.latitude,
      longitude: chosen.longitude,
    }

    const { error: orderErr } = await supabase.from('orders').insert({
      user_id: user.id,
      profile_id: values.profileId,
      prescription_url: filePath,
      prescription_notes: values.notes,
      status: 'prescription_uploaded',
      insurance_status: 'none',
      delivery_fee: 5000,
      address_id: chosen.source === 'profile' ? chosen.id : null,
      delivery_address_snapshot: addressSnapshot,
      cash_only: cashOnly,
      contact_phone: values.contactPhone,
    })

    if (orderErr) {
      notifications.show({
        title: 'Error',
        message: orderErr.message,
        color: 'red',
      })
      setUploading(false)
      setProgress(0)
      return
    }

    if (chosen.source === 'history') {
      const existing = historyAddrs.find((h) => h.id === chosen.id)
      if (existing) {
        await supabase
          .from('order_address_history')
          .update({
            last_used_at: new Date().toISOString(),
            use_count: existing.use_count + 1,
          })
          .eq('id', chosen.id)
      }
    }

    setProgress(100)
    notifications.show({
      title: 'Submitted ✅',
      message: 'Prescription received. Pharmacy will review shortly.',
      color: 'teal',
    })
    setUploading(false)
    navigate('/dashboard')
  }

  // ── Address card ──────────────────────────────────────────────────────────
  const renderAddrCard = (addr: SelectableAddress) => {
    const selected = selectedId === addr.id
    return (
      <Box
        key={`${addr.source}-${addr.id}`}
        onClick={() => setValue('selectedAddr', addr.id)}
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
          padding: '12px 14px',
          borderRadius: 10,
          cursor: 'pointer',
          border: `2px solid ${selected ? SavedColors.Primaryblue : SavedColors.DemWhite}`,
          background: selected ? '#EBF7FD' : '#fff',
          transition: 'all 0.15s',
        }}
      >
        <Box
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            flexShrink: 0,
            background: selected ? SavedColors.Primaryblue : '#f3f4f6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {selected ? (
            <TbCheck
              size={16}
              color="#fff"
            />
          ) : (
            <TbMapPin
              size={16}
              color="#9ca3af"
            />
          )}
        </Box>
        <Box style={{ flex: 1, minWidth: 0 }}>
          <Group
            gap={6}
            mb={2}
          >
            <Text
              size="sm"
              fw={700}
              c={SavedColors.TextColor}
            >
              {addr.label}
            </Text>
            {addr.is_default && (
              <Badge
                size="xs"
                color="lotusCyan"
                variant="light"
              >
                Default
              </Badge>
            )}
            {addr.source === 'history' && (
              <Badge
                size="xs"
                color="gray"
                variant="light"
                leftSection={<TbClock size={9} />}
              >
                Recent
              </Badge>
            )}
          </Group>
          <Text
            size="xs"
            c="dimmed"
          >
            {addr.street}
            {addr.city ? `, ${addr.city}` : ''}
            {addr.zone ? ` — ${addr.zone}` : ''}
          </Text>
          {addr.instructions && (
            <Text
              size="xs"
              c="dimmed"
              mt={2}
              style={{ fontStyle: 'italic' }}
            >
              {addr.instructions}
            </Text>
          )}
        </Box>
        <Radio
          checked={selected}
          onChange={() => setValue('selectedAddr', addr.id)}
          color="lotusCyan"
          style={{ pointerEvents: 'none' }}
        />
      </Box>
    )
  }

  // ── Derived values ────────────────────────────────────────────────────────
  const activeProfile = profiles.find((p) => p.id === profileId)
  const profilePhone = activeProfile?.phone ?? null
  const savedPercent =
    originalSize > 0 && resizedSize < originalSize
      ? Math.round((1 - resizedSize / originalSize) * 100)
      : 0

  return (
    <PageWrapper>
      <PageHeader style={{ top: 60 }}>
        <Container size="md">
          <Button
            variant="subtle"
            leftSection={<TbArrowLeft size={16} />}
            onClick={() => navigate('/dashboard')}
            style={{ color: '#fff' }}
          >
            Back
          </Button>
        </Container>
      </PageHeader>

      <Container
        size="md"
        py="xl"
      >
        <Box mb="xl">
          <SectionLabel>Prescriptions</SectionLabel>
          <PageTitle>Upload Prescription</PageTitle>
          <BlueDivider />
          <Text
            c="dimmed"
            size="sm"
            mt="xs"
          >
            Upload a clear photo of your prescription for pharmacy review
          </Text>
        </Box>

        <ContentCard>
          <form onSubmit={handleSubmit(onSubmit)}>
            <Stack gap="lg">
              {/* ── Profile ── */}
              <FormSelect
                name="profileId"
                control={control}
                label="For Profile"
                labelColor={SavedColors.TextColor}
                data={profiles.map((p) => ({
                  value: p.id,
                  label: p.name + (p.is_main_account ? ' (Me)' : ''),
                }))}
              />

              {/* ── Prescription image ── */}
              <Box>
                <Text
                  size="sm"
                  fw={600}
                  mb="xs"
                  c={SavedColors.TextColor}
                >
                  Prescription Image{' '}
                  <Text
                    component="span"
                    c="red"
                  >
                    *
                  </Text>
                </Text>

                {!preview ? (
                  <>
                    {/* Drop zone */}
                    <Box
                      onDrop={(e) => {
                        e.preventDefault()
                        const f = e.dataTransfer.files?.[0]
                        if (f) handleFile(f)
                      }}
                      onDragOver={(e) => e.preventDefault()}
                      onClick={() => fileInputRef.current?.click()}
                      style={{
                        border: `2px dashed ${SavedColors.Primaryblue}`,
                        borderRadius: 10,
                        padding: '32px 24px',
                        textAlign: 'center',
                        cursor: 'pointer',
                        background: SavedColors.lightBlue,
                      }}
                    >
                      <TbUpload
                        size={36}
                        color={SavedColors.Primaryblue}
                        style={{ margin: '0 auto 10px', display: 'block' }}
                      />
                      <Text
                        size="sm"
                        fw={600}
                        c={SavedColors.Primaryblue}
                      >
                        Click to upload or drag & drop
                      </Text>
                      <Text
                        size="xs"
                        c="dimmed"
                        mt={4}
                      >
                        JPG, PNG, WebP, GIF — max 10 MB
                      </Text>
                    </Box>

                    {/* Camera button — separate, prominent */}
                    <Box
                      onClick={() => cameraInputRef.current?.click()}
                      style={{
                        marginTop: 10,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '14px 18px',
                        borderRadius: 10,
                        cursor: 'pointer',
                        border: `2px solid ${SavedColors.Primaryblue}`,
                        background: '#fff',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={(e) => {
                        ;(e.currentTarget as HTMLElement).style.background =
                          SavedColors.lightBlue
                      }}
                      onMouseLeave={(e) => {
                        ;(e.currentTarget as HTMLElement).style.background =
                          '#fff'
                      }}
                    >
                      <Box
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: '50%',
                          flexShrink: 0,
                          background: 'linear-gradient(135deg,#15B3E0,#012970)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <TbCamera
                          size={20}
                          color="#fff"
                        />
                      </Box>
                      <Box style={{ flex: 1 }}>
                        <Text
                          size="sm"
                          fw={700}
                          c={SavedColors.TextColor}
                        >
                          Take a Photo
                        </Text>
                        <Text
                          size="xs"
                          c="dimmed"
                        >
                          Open camera to photograph your prescription
                        </Text>
                      </Box>
                      <Badge
                        size="xs"
                        color="lotusCyan"
                        variant="light"
                      >
                        Camera
                      </Badge>
                    </Box>
                  </>
                ) : (
                  /* Preview */
                  <Box style={{ position: 'relative' }}>
                    {resizing ? (
                      <Box
                        style={{
                          height: 200,
                          borderRadius: 8,
                          background: '#f0f4f8',
                          border: `1px solid ${SavedColors.DemWhite}`,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 8,
                        }}
                      >
                        <div
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: '50%',
                            border: `3px solid ${SavedColors.Primaryblue}`,
                            borderTopColor: 'transparent',
                            animation: 'spin 0.7s linear infinite',
                          }}
                        />
                        <Text
                          size="xs"
                          c="dimmed"
                        >
                          Optimising image…
                        </Text>
                      </Box>
                    ) : (
                      <Image
                        src={preview}
                        alt="Preview"
                        radius="md"
                        style={{
                          maxHeight: 320,
                          objectFit: 'contain',
                          background: '#f0f4f8',
                          border: `1px solid ${SavedColors.DemWhite}`,
                        }}
                      />
                    )}

                    <ActionIcon
                      color="red"
                      variant="filled"
                      radius="xl"
                      size="sm"
                      style={{ position: 'absolute', top: 8, right: 8 }}
                      onClick={clearFile}
                    >
                      <TbX size={12} />
                    </ActionIcon>

                    {!resizing && (
                      <Group
                        mt="xs"
                        gap="xs"
                        wrap="wrap"
                      >
                        <TbPhoto
                          size={14}
                          color={SavedColors.Primaryblue}
                        />
                        <Text
                          size="xs"
                          c="dimmed"
                        >
                          {file?.name} — {(resizedSize / 1024).toFixed(0)} KB
                          {savedPercent > 0 && (
                            <Text
                              component="span"
                              c="teal"
                              fw={600}
                            >
                              {' '}
                              (optimised, {savedPercent}% smaller)
                            </Text>
                          )}
                        </Text>
                        <Button
                          size="xs"
                          variant="subtle"
                          color="lotusCyan"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          Change
                        </Button>
                        <Button
                          size="xs"
                          variant="subtle"
                          color="lotusCyan"
                          leftSection={<TbCamera size={12} />}
                          onClick={() => cameraInputRef.current?.click()}
                        >
                          Retake
                        </Button>
                      </Group>
                    )}
                  </Box>
                )}

                {/* Hidden file input — gallery/files */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) handleFile(f)
                  }}
                />

                {/* Hidden camera input — rear camera, no gallery */}
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  capture="environment"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) handleFile(f)
                  }}
                />
              </Box>

              {/* ── Delivery Address ── */}
              <Box>
                <Group
                  justify="space-between"
                  mb="xs"
                >
                  <Text
                    size="sm"
                    fw={600}
                    c={SavedColors.TextColor}
                  >
                    Delivery Address{' '}
                    <Text
                      component="span"
                      c="red"
                    >
                      *
                    </Text>
                  </Text>
                  <Button
                    size="xs"
                    variant="subtle"
                    color="lotusCyan"
                    leftSection={<TbPlus size={12} />}
                    onClick={() => setPickerOpen(true)}
                  >
                    Use Different Address
                  </Button>
                </Group>

                {loadingAddrs ? (
                  <Group
                    gap="xs"
                    py="sm"
                  >
                    <div
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: '50%',
                        border: '2px solid #15B3E0',
                        borderTopColor: 'transparent',
                        animation: 'spin 0.7s linear infinite',
                      }}
                    />
                    <Text
                      size="xs"
                      c="dimmed"
                    >
                      Loading addresses…
                    </Text>
                  </Group>
                ) : allAddresses.length === 0 ? (
                  <Stack gap="xs">
                    <Text
                      size="sm"
                      c="dimmed"
                    >
                      No saved addresses yet.
                    </Text>
                    <Group gap="xs">
                      <Button
                        size="xs"
                        color="lotusCyan"
                        variant="light"
                        leftSection={<TbMapPin size={12} />}
                        onClick={() => setPickerOpen(true)}
                      >
                        Enter Address
                      </Button>
                      <Button
                        size="xs"
                        color="blue"
                        variant="subtle"
                        onClick={() => navigate('/edit-profile/me')}
                      >
                        Save to Profile
                      </Button>
                    </Group>
                  </Stack>
                ) : (
                  <Stack gap="xs">
                    {profileAddrs.length > 0 && (
                      <>
                        <Text
                          size="xs"
                          fw={600}
                          c="dimmed"
                          style={{
                            textTransform: 'uppercase',
                            letterSpacing: '0.06em',
                          }}
                        >
                          Saved Addresses
                        </Text>
                        {profileAddrs.map((a) =>
                          renderAddrCard({
                            source: 'profile',
                            id: a.id,
                            label: a.label,
                            street: a.street,
                            city: a.city,
                            zone: a.zone,
                            instructions: a.instructions ?? null,
                            latitude: a.latitude ?? null,
                            longitude: a.longitude ?? null,
                            is_default: a.is_default,
                          }),
                        )}
                      </>
                    )}
                    {historyAddrs.length > 0 && (
                      <>
                        {profileAddrs.length > 0 && <Divider my="xs" />}
                        <Text
                          size="xs"
                          fw={600}
                          c="dimmed"
                          style={{
                            textTransform: 'uppercase',
                            letterSpacing: '0.06em',
                          }}
                        >
                          Recently Used
                        </Text>
                        {historyAddrs.map((a) =>
                          renderAddrCard({
                            source: 'history',
                            id: a.id,
                            label: a.label,
                            street: a.street,
                            city: a.city,
                            zone: a.zone,
                            instructions: a.instructions,
                            latitude: a.latitude,
                            longitude: a.longitude,
                            use_count: a.use_count,
                          }),
                        )}
                      </>
                    )}
                  </Stack>
                )}

                {errors.selectedAddr && (
                  <Text
                    size="xs"
                    c="red"
                    mt={4}
                  >
                    {errors.selectedAddr.message}
                  </Text>
                )}
              </Box>

              {/* ── Contact Number ── */}
              <Box>
                <Group
                  justify="space-between"
                  mb="xs"
                >
                  <Text
                    size="sm"
                    fw={600}
                    c={SavedColors.TextColor}
                  >
                    Contact Number{' '}
                    <Text
                      component="span"
                      c="red"
                    >
                      *
                    </Text>
                  </Text>
                  {!editingPhone && profilePhone && (
                    <Button
                      size="xs"
                      variant="subtle"
                      color="lotusCyan"
                      leftSection={<TbPencil size={12} />}
                      onClick={() => setEditingPhone(true)}
                    >
                      Use Different Number
                    </Button>
                  )}
                </Group>

                <Stack gap="xs">
                  {/* Profile phone — always shown as a selectable card when it exists */}
                  {profilePhone && (
                    <Box
                      onClick={() => {
                        setValue('contactPhone', profilePhone)
                        setEditingPhone(false)
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '12px 14px',
                        borderRadius: 10,
                        cursor: 'pointer',
                        border: `2px solid ${!editingPhone ? SavedColors.Primaryblue : SavedColors.DemWhite}`,
                        background: !editingPhone ? '#EBF7FD' : '#fff',
                        transition: 'all 0.15s',
                      }}
                    >
                      <Box
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: '50%',
                          flexShrink: 0,
                          background: !editingPhone
                            ? SavedColors.Primaryblue
                            : '#f3f4f6',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {!editingPhone ? (
                          <TbCheck
                            size={16}
                            color="#fff"
                          />
                        ) : (
                          <TbPhone
                            size={16}
                            color="#9ca3af"
                          />
                        )}
                      </Box>
                      <Box style={{ flex: 1, minWidth: 0 }}>
                        <Group
                          gap={6}
                          mb={2}
                        >
                          <Text
                            size="sm"
                            fw={700}
                            c={SavedColors.TextColor}
                          >
                            {profilePhone}
                          </Text>
                          <Badge
                            size="xs"
                            color="lotusCyan"
                            variant="light"
                          >
                            Profile
                          </Badge>
                        </Group>
                        <Text
                          size="xs"
                          c="dimmed"
                        >
                          Saved contact for{' '}
                          {activeProfile?.name ?? 'this profile'}
                        </Text>
                      </Box>
                      <Radio
                        checked={!editingPhone}
                        onChange={() => {
                          setValue('contactPhone', profilePhone)
                          setEditingPhone(false)
                        }}
                        color="lotusCyan"
                        style={{ pointerEvents: 'none' }}
                      />
                    </Box>
                  )}

                  {/* Use a different number card */}
                  <Box
                    onClick={() => setEditingPhone(true)}
                    style={{
                      borderRadius: 10,
                      cursor: 'pointer',
                      border: `2px solid ${editingPhone ? SavedColors.Primaryblue : SavedColors.DemWhite}`,
                      background: editingPhone ? '#EBF7FD' : '#fff',
                      transition: 'all 0.15s',
                      overflow: 'hidden',
                    }}
                  >
                    {/* Card header — always visible */}
                    <Box
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '12px 14px',
                      }}
                    >
                      <Box
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: '50%',
                          flexShrink: 0,
                          background: editingPhone
                            ? SavedColors.Primaryblue
                            : '#f3f4f6',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {editingPhone ? (
                          <TbCheck
                            size={16}
                            color="#fff"
                          />
                        ) : (
                          <TbPencil
                            size={16}
                            color="#9ca3af"
                          />
                        )}
                      </Box>
                      <Box style={{ flex: 1 }}>
                        <Text
                          size="sm"
                          fw={700}
                          c={SavedColors.TextColor}
                        >
                          Use a different number
                        </Text>
                        <Text
                          size="xs"
                          c="dimmed"
                        >
                          Enter any contact number for this order
                        </Text>
                      </Box>
                      <Radio
                        checked={editingPhone}
                        onChange={() => setEditingPhone(true)}
                        color="lotusCyan"
                        style={{ pointerEvents: 'none' }}
                      />
                    </Box>

                    {/* Input — only shown when this option is selected */}
                    {editingPhone && (
                      <Box
                        style={{
                          borderTop: `1px solid ${SavedColors.DemWhite}`,
                          padding: '10px 14px 14px',
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Controller
                          name="contactPhone"
                          control={control}
                          render={({ field }) => (
                            <TextInput
                              {...field}
                              placeholder="e.g. +256 700 123456"
                              radius="sm"
                              error={errors.contactPhone?.message}
                              leftSection={
                                <TbPhone
                                  size={14}
                                  color={SavedColors.Primaryblue}
                                />
                              }
                              autoFocus
                            />
                          )}
                        />
                        <Text
                          size="xs"
                          c="dimmed"
                          mt={6}
                        >
                          The rider will call this number during delivery.
                        </Text>
                      </Box>
                    )}
                  </Box>
                </Stack>

                {!profilePhone && errors.contactPhone && (
                  <Text
                    size="xs"
                    c="red"
                    mt={4}
                  >
                    {errors.contactPhone.message}
                  </Text>
                )}
              </Box>

              {/* ── Payment method ── */}
              <Box>
                <Text
                  size="sm"
                  fw={600}
                  mb="xs"
                  c={SavedColors.TextColor}
                >
                  Payment Method
                </Text>
                <Stack gap="xs">
                  <Box
                    onClick={() => setCashOnly(false)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '12px 14px',
                      borderRadius: 10,
                      cursor: 'pointer',
                      border: `2px solid ${!cashOnly ? SavedColors.Primaryblue : SavedColors.DemWhite}`,
                      background: !cashOnly ? '#EBF7FD' : '#fff',
                      transition: 'all 0.15s',
                    }}
                  >
                    <Radio
                      checked={!cashOnly}
                      onChange={() => setCashOnly(false)}
                      color="lotusCyan"
                      style={{ pointerEvents: 'none' }}
                    />
                    <Box style={{ flex: 1 }}>
                      <Text
                        size="sm"
                        fw={700}
                        c={SavedColors.TextColor}
                      >
                        Use Insurance (if available)
                      </Text>
                      <Text
                        size="xs"
                        c="dimmed"
                      >
                        The pharmacy will apply your insurance coverage to
                        reduce costs
                      </Text>
                    </Box>
                  </Box>

                  <Box
                    onClick={() => setCashOnly(true)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '12px 14px',
                      borderRadius: 10,
                      cursor: 'pointer',
                      border: `2px solid ${cashOnly ? '#D97706' : SavedColors.DemWhite}`,
                      background: cashOnly ? '#FFFBEB' : '#fff',
                      transition: 'all 0.15s',
                    }}
                  >
                    <Radio
                      checked={cashOnly}
                      onChange={() => setCashOnly(true)}
                      color="orange"
                      style={{ pointerEvents: 'none' }}
                    />
                    <Box style={{ flex: 1 }}>
                      <Group gap={6}>
                        <TbCurrencyDollar
                          size={15}
                          color="#D97706"
                        />
                        <Text
                          size="sm"
                          fw={700}
                          c="#92400E"
                        >
                          Pay Cash (No Insurance)
                        </Text>
                      </Group>
                      <Text
                        size="xs"
                        c="dimmed"
                      >
                        Skip insurance — pay full cash price at confirmation
                      </Text>
                    </Box>
                    {cashOnly && (
                      <Badge
                        color="orange"
                        variant="light"
                        size="xs"
                        leftSection={<TbShieldOff size={9} />}
                      >
                        Cash Only
                      </Badge>
                    )}
                  </Box>
                </Stack>
              </Box>

              {/* ── Notes ── */}
              <Box>
                <Text
                  size="sm"
                  fw={600}
                  mb="xs"
                  c={SavedColors.TextColor}
                >
                  Notes for Pharmacist
                </Text>
                <Controller
                  name="notes"
                  control={control}
                  render={({ field }) => (
                    <Textarea
                      {...field}
                      placeholder="Any allergies, preferred brands, or notes…"
                      rows={3}
                      radius="sm"
                    />
                  )}
                />
              </Box>

              {uploading && progress < 100 && (
                <Progress
                  value={progress}
                  color="lotusCyan"
                  size="sm"
                  animated
                />
              )}

              <Group
                justify="flex-end"
                gap="sm"
              >
                <Button
                  variant="default"
                  onClick={() => navigate('/dashboard')}
                  radius={8}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  loading={isSubmitting || uploading || resizing}
                  radius={8}
                  leftSection={<TbFileDescription size={16} />}
                  style={{
                    background:
                      'linear-gradient(135deg,#15B3E0 0%,#012970 100%)',
                    border: 'none',
                  }}
                >
                  Submit Prescription
                </Button>
              </Group>
            </Stack>
          </form>
        </ContentCard>
      </Container>

      <AddressPickerModal
        opened={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSave={handleNewAddress}
        title="Use Different Address"
      />
    </PageWrapper>
  )
}

