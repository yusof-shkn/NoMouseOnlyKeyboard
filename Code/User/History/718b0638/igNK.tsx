import { useRef, useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Box,
  Button,
  Container,
  Divider,
  Grid,
  Group,
  Stack,
  Text,
  Title,
  Avatar,
  ActionIcon,
  Modal,
  Tooltip,
  Loader,
  Center,
  Badge,
  Collapse,
} from '@mantine/core'
import { Controller } from 'react-hook-form'
import { DateInput } from '@mantine/dates'
import {
  TbArrowLeft,
  TbUser,
  TbCalendar,
  TbCamera,
  TbUpload,
  TbX,
  TbRefresh,
  TbInfoCircle,
  TbShieldCheck,
  TbShieldOff,
  TbPhone,
  TbTrash,
} from 'react-icons/tb'
import { PageWrapper, PageHeader, ContentCard } from '@shared/ui/layout'
import { FormInput, FormSelect, FormCheckBox } from '@shared/ui/form'
import { PageTitle, BlueDivider, SectionLabel } from '@shared/ui/typography'
import { SavedColors } from '@shared/constants'
import { useEditProfileForm } from '@features/profile/edit-profile-form/model/useEditProfileForm'
import { useAuth } from '../../../features/auth/context/AuthContext'
import { INSURANCE_PROVIDERS } from '../../mockData'
import AddressSection from '../../components/AddressSection'
import styled from 'styled-components'

const InputWrap = styled.div`
  .mantine-TextInput-label,
  .mantine-Select-label,
  .mantine-DateInput-label {
    font-family: 'DM Sans', sans-serif;
    font-size: 13px;
    font-weight: 600;
    color: #2d3a4a;
    margin-bottom: 5px;
  }
  .mantine-TextInput-input,
  .mantine-Select-input,
  .mantine-DateInput-input {
    height: 42px;
    border: 1.5px solid #e4e9f0;
    border-radius: 8px;
    font-family: 'DM Sans', sans-serif;
    font-size: 14px;
    color: #1a2b3c;
    background: #fafbfd;
    &:focus {
      border-color: #15b3e0;
      box-shadow: 0 0 0 3px rgba(21, 179, 224, 0.1);
    }
    &::placeholder {
      color: #b0bbc8;
    }
  }
`

export default function EditProfile() {
  const navigate = useNavigate()
  const location = useLocation()
  const { profiles, user } = useAuth()

  const openInsurance = !!(location.state as { openInsurance?: boolean } | null)
    ?.openInsurance

  const {
    control,
    handleSubmit,
    onSubmit,
    isSubmitting,
    hasInsurance,
    isMainAccount,
    loading,
    existingPhotoUrl,
    insuranceStatus,
    insuranceRejectionReason,
    deleteProfile,
    setValue,
  } = useEditProfileForm({ openInsurance })

  const [renewingInsurance, setRenewingInsurance] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user')
  const videoRef = useRef<HTMLVideoElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const insuranceRef = useRef<HTMLDivElement>(null)

  // When arriving from "Add Insurance Now" modal, scroll to the insurance section once loaded
  useEffect(() => {
    if (openInsurance && !loading) {
      setTimeout(() => {
        insuranceRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        })
      }, 150)
    }
  }, [loading, openInsurance])

  const openCamera = async (mode: 'user' | 'environment' = facingMode) => {
    try {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop())
      }
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode },
      })
      setStream(s)
      setCameraOpen(true)
      setFacingMode(mode)
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = s
          videoRef.current.play()
        }
      }, 100)
    } catch {
      alert('Camera access denied or not available.')
    }
  }

  const closeCamera = () => {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop())
      setStream(null)
    }
    setCameraOpen(false)
  }

  const takePhoto = () => {
    if (!videoRef.current) return
    const canvas = document.createElement('canvas')
    canvas.width = videoRef.current.videoWidth
    canvas.height = videoRef.current.videoHeight
    canvas.getContext('2d')!.drawImage(videoRef.current, 0, 0)
    canvas.toBlob(
      (blob) => {
        if (!blob) return
        const file = new File([blob], `photo-${Date.now()}.jpg`, {
          type: 'image/jpeg',
        })
        setPhotoFile(file)
        setPhotoPreview(URL.createObjectURL(blob))
        closeCamera()
      },
      'image/jpeg',
      0.9,
    )
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  const handleFormSubmit = (values: any) => onSubmit(values, photoFile)

  if (loading)
    return (
      <Center h="100vh">
        <Loader color="lotusCyan" />
      </Center>
    )

  const displayPhoto = photoPreview || existingPhotoUrl

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
            Back to Dashboard
          </Button>
        </Container>
      </PageHeader>

      <Container
        size="md"
        py="xl"
      >
        <Box mb="xl">
          <SectionLabel>Profiles</SectionLabel>
          <PageTitle>Edit Profile</PageTitle>
          <BlueDivider />
          <Text
            c="dimmed"
            size="sm"
            mt="xs"
          >
            Update information for this family member
          </Text>
        </Box>

        <ContentCard>
          <form onSubmit={handleSubmit(handleFormSubmit)}>
            <Stack gap="xl">
              {/* ── Profile Photo ─────────────────────────── */}
              <Box>
                <Title
                  order={5}
                  mb="md"
                  c={SavedColors.TextColor}
                  style={{ fontFamily: "'DM Sans',sans-serif" }}
                >
                  Profile Photo
                </Title>
                <Group
                  gap="lg"
                  align="flex-start"
                >
                  <Box style={{ position: 'relative' }}>
                    <Avatar
                      src={displayPhoto}
                      size={90}
                      radius="xl"
                      color="lotusCyan"
                      style={{ border: `2px solid ${SavedColors.DemWhite}` }}
                    >
                      <TbUser size={36} />
                    </Avatar>
                    {displayPhoto && (
                      <ActionIcon
                        size="xs"
                        color="red"
                        variant="filled"
                        radius="xl"
                        style={{ position: 'absolute', top: -4, right: -4 }}
                        onClick={() => {
                          setPhotoFile(null)
                          setPhotoPreview(null)
                        }}
                      >
                        <TbX size={10} />
                      </ActionIcon>
                    )}
                  </Box>
                  <Stack gap="xs">
                    <Group gap="xs">
                      <Button
                        size="xs"
                        variant="outline"
                        color="lotusCyan"
                        leftSection={<TbCamera size={14} />}
                        onClick={() => openCamera('user')}
                      >
                        Take Photo
                      </Button>
                      <Button
                        size="xs"
                        variant="light"
                        color="lotusCyan"
                        leftSection={<TbUpload size={14} />}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        Upload File
                      </Button>
                    </Group>
                    <Text
                      size="xs"
                      c="dimmed"
                    >
                      PNG, JPG up to 5MB
                    </Text>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={handleFileUpload}
                    />
                  </Stack>
                </Group>
              </Box>

              <Divider />

              {/* ── Basic Info ─────────────────────────────── */}
              <Box>
                <Title
                  order={5}
                  mb="md"
                  c={SavedColors.TextColor}
                  style={{ fontFamily: "'DM Sans',sans-serif" }}
                >
                  Basic Information
                </Title>
                <Grid gutter={12}>
                  <Grid.Col span={12}>
                    <InputWrap>
                      <FormInput
                        name="name"
                        control={control}
                        label="Full Name"
                        placeholder="Full name"
                        leftSection={<TbUser size={15} />}
                        labelColor={SavedColors.TextColor}
                      />
                    </InputWrap>
                  </Grid.Col>
                  {isMainAccount && (
                    <Grid.Col span={12}>
                      <InputWrap>
                        <FormInput
                          name="phone"
                          control={control}
                          label="Phone Number *"
                          placeholder="+256 700 123 456"
                          leftSection={<TbPhone size={15} />}
                          labelColor={SavedColors.TextColor}
                        />
                      </InputWrap>
                    </Grid.Col>
                  )}
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <InputWrap>
                      <Controller
                        name="dateOfBirth"
                        control={control}
                        render={({ field, fieldState: { error } }) => (
                          <Stack gap={5}>
                            <Text
                              style={{
                                fontFamily: "'DM Sans',sans-serif",
                                fontSize: 13,
                                fontWeight: 600,
                                color: '#2D3A4A',
                              }}
                            >
                              Date of Birth
                            </Text>
                            <DateInput
                              value={field.value}
                              onChange={field.onChange}
                              placeholder="DD/MM/YYYY"
                              valueFormat="DD/MM/YYYY"
                              error={error?.message}
                              leftSection={
                                <TbCalendar
                                  size={15}
                                  color="#9EADB8"
                                />
                              }
                              styles={{
                                input: {
                                  height: 42,
                                  border: '1.5px solid #E4E9F0',
                                  borderRadius: 8,
                                  fontFamily: "'DM Sans',sans-serif",
                                  fontSize: 14,
                                  background: '#FAFBFD',
                                },
                                error: {
                                  fontFamily: "'DM Sans',sans-serif",
                                  fontSize: 12,
                                },
                              }}
                            />
                          </Stack>
                        )}
                      />
                    </InputWrap>
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <InputWrap>
                      <FormSelect
                        name="relationship"
                        control={control}
                        label="Relationship"
                        placeholder="Select"
                        labelColor={SavedColors.TextColor}
                        data={[
                          { value: 'Self', label: 'Self' },
                          { value: 'Spouse', label: 'Spouse' },
                          { value: 'Child', label: 'Child' },
                          { value: 'Parent', label: 'Parent' },
                          { value: 'Sibling', label: 'Sibling' },
                          { value: 'Other', label: 'Other' },
                        ]}
                      />
                    </InputWrap>
                  </Grid.Col>
                </Grid>
              </Box>

              <Divider />

              {/* ── Delivery Addresses ─────────────────────── */}
              {user && <AddressSection userId={user.id} />}

              <Divider
                label={
                  <Group gap={6}>
                    <TbShieldCheck
                      size={14}
                      color={SavedColors.Primaryblue}
                    />
                    <Text
                      size="sm"
                      fw={600}
                      c={SavedColors.TextColor}
                    >
                      Insurance Information
                    </Text>
                  </Group>
                }
                labelPosition="left"
              />

              {/* ── Insurance rejection notice with re-apply option ─── */}
              {insuranceStatus === 'rejected' && (
                <Box
                  p="md"
                  style={{
                    background: '#fef2f2',
                    borderRadius: 8,
                    border: '1px solid #fca5a5',
                  }}
                >
                  <Group
                    gap="xs"
                    mb="xs"
                  >
                    <TbShieldOff
                      size={16}
                      color="#EF4444"
                    />
                    <Text
                      size="sm"
                      fw={700}
                      c="red.7"
                    >
                      Insurance Not Verified
                    </Text>
                  </Group>
                  {insuranceRejectionReason && (
                    <Box
                      mb="sm"
                      p="xs"
                      style={{ background: '#fff', borderRadius: 6 }}
                    >
                      <Text
                        size="xs"
                        fw={600}
                        c="dimmed"
                        mb={2}
                      >
                        Reason from support:
                      </Text>
                      <Text
                        size="sm"
                        c="#374151"
                      >
                        {insuranceRejectionReason}
                      </Text>
                    </Box>
                  )}
                  <Text
                    size="xs"
                    c="dimmed"
                  >
                    Please update your insurance details below and save — your
                    information will be re-submitted for review.
                  </Text>
                </Box>
              )}

              {/* ── Insurance ──────────────────────────────── */}
              <Box ref={insuranceRef}>
                {insuranceStatus === 'verified' && !renewingInsurance ? (
                  <Box
                    p="md"
                    style={{
                      background: '#f0fdf4',
                      borderRadius: 10,
                      border: '1.5px solid #86efac',
                    }}
                  >
                    <Group
                      justify="space-between"
                      align="flex-start"
                    >
                      <Group gap="xs">
                        <TbShieldCheck
                          size={20}
                          color="#16a34a"
                        />
                        <Box>
                          <Text
                            size="sm"
                            fw={700}
                            c="#15803d"
                          >
                            Insurance Verified ✓
                          </Text>
                          <Text
                            size="xs"
                            c="dimmed"
                            mt={2}
                          >
                            Your insurance coverage is active and verified by
                            our support team.
                          </Text>
                        </Box>
                      </Group>
                      <Button
                        size="xs"
                        variant="outline"
                        color="green"
                        onClick={() => setRenewingInsurance(true)}
                        style={{ flexShrink: 0 }}
                      >
                        Renew Insurance
                      </Button>
                    </Group>
                  </Box>
                ) : insuranceStatus === 'expired' && !renewingInsurance ? (
                  <Box
                    p="md"
                    style={{
                      background: '#fffbeb',
                      borderRadius: 10,
                      border: '1.5px solid #fde68a',
                    }}
                  >
                    <Group
                      justify="space-between"
                      align="flex-start"
                    >
                      <Group gap="xs">
                        <TbInfoCircle
                          size={20}
                          color="#d97706"
                        />
                        <Box>
                          <Text
                            size="sm"
                            fw={700}
                            c="#92400e"
                          >
                            Insurance Expired
                          </Text>
                          <Text
                            size="xs"
                            c="dimmed"
                            mt={2}
                          >
                            Your insurance policy has expired. Please renew your
                            details to restore coverage.
                          </Text>
                        </Box>
                      </Group>
                      <Button
                        size="xs"
                        variant="filled"
                        color="orange"
                        onClick={() => setRenewingInsurance(true)}
                        style={{ flexShrink: 0 }}
                      >
                        Renew Now
                      </Button>
                    </Group>
                  </Box>
                ) : insuranceStatus === 'pending' && !renewingInsurance ? (
                  <Box
                    p="md"
                    style={{
                      background: '#fefce8',
                      borderRadius: 10,
                      border: '1.5px solid #fde68a',
                    }}
                  >
                    <Group
                      justify="space-between"
                      align="flex-start"
                    >
                      <Group gap="xs">
                        <TbInfoCircle
                          size={20}
                          color="#ca8a04"
                        />
                        <Box>
                          <Text
                            size="sm"
                            fw={700}
                            c="#92400e"
                          >
                            Insurance Under Review
                          </Text>
                          <Text
                            size="xs"
                            c="dimmed"
                            mt={2}
                          >
                            Your insurance details have been submitted and are
                            being reviewed by our support team.
                          </Text>
                        </Box>
                      </Group>
                      <Button
                        size="xs"
                        variant="outline"
                        color="yellow"
                        onClick={() => setRenewingInsurance(true)}
                        style={{ flexShrink: 0 }}
                      >
                        Update Details
                      </Button>
                    </Group>
                  </Box>
                ) : (
                  <>
                    {renewingInsurance && (
                      <Box
                        mb="md"
                        p="sm"
                        style={{
                          background: '#fefce8',
                          borderRadius: 8,
                          border: '1px solid #fde68a',
                        }}
                      >
                        <Group gap="xs">
                          <TbInfoCircle
                            size={14}
                            color="#ca8a04"
                          />
                          <Text
                            size="xs"
                            c="dimmed"
                          >
                            Updating your insurance will reset verification
                            status to pending review.
                          </Text>
                        </Group>
                        <Button
                          size="xs"
                          variant="subtle"
                          color="gray"
                          mt="xs"
                          onClick={() => setRenewingInsurance(false)}
                        >
                          Cancel Renewal
                        </Button>
                      </Box>
                    )}
                    <FormCheckBox
                      name="hasInsurance"
                      control={control}
                      label={
                        <Box>
                          <Text
                            size="sm"
                            fw={600}
                            c={SavedColors.TextColor}
                          >
                            Has health insurance
                          </Text>
                          <Text
                            size="xs"
                            c="dimmed"
                          >
                            Toggle to add or remove insurance coverage
                          </Text>
                        </Box>
                      }
                    />

                    {hasInsurance && (
                      <Box
                        mt="md"
                        pl="md"
                        style={{
                          borderLeft: `3px solid ${SavedColors.Primaryblue}`,
                          paddingTop: 4,
                        }}
                      >
                        <Grid gutter={12}>
                          <Grid.Col span={12}>
                            <InputWrap>
                              <FormSelect
                                name="insuranceProvider"
                                control={control}
                                label="Insurance Provider"
                                placeholder="Select provider"
                                labelColor="#2D3A4A"
                                data={INSURANCE_PROVIDERS.map((p) => ({
                                  value: p,
                                  label: p,
                                }))}
                              />
                            </InputWrap>
                          </Grid.Col>
                          <Grid.Col span={{ base: 12, sm: 6 }}>
                            <InputWrap>
                              <FormInput
                                name="policyNumber"
                                control={control}
                                label="Policy / Member Number"
                                placeholder="e.g. AAR-2024-12345"
                                labelColor="#2D3A4A"
                              />
                            </InputWrap>
                          </Grid.Col>
                          <Grid.Col span={{ base: 12, sm: 6 }}>
                            <InputWrap>
                              <FormInput
                                name="policyHolderName"
                                control={control}
                                label="Policy Holder Name"
                                placeholder="If different from above"
                                labelColor="#2D3A4A"
                              />
                            </InputWrap>
                          </Grid.Col>
                          <Grid.Col span={12}>
                            <InputWrap>
                              <Controller
                                name="expiryDate"
                                control={control}
                                render={({ field, fieldState: { error } }) => (
                                  <Stack gap={5}>
                                    <Text
                                      style={{
                                        fontFamily: "'DM Sans',sans-serif",
                                        fontSize: 13,
                                        fontWeight: 600,
                                        color: '#2D3A4A',
                                      }}
                                    >
                                      Policy Expiry Date
                                    </Text>
                                    <DateInput
                                      value={field.value}
                                      onChange={field.onChange}
                                      placeholder="DD/MM/YYYY"
                                      valueFormat="DD/MM/YYYY"
                                      error={error?.message}
                                      styles={{
                                        input: {
                                          height: 42,
                                          border: '1.5px solid #E4E9F0',
                                          borderRadius: 8,
                                          fontFamily: "'DM Sans',sans-serif",
                                          fontSize: 14,
                                          background: '#FAFBFD',
                                        },
                                        error: {
                                          fontFamily: "'DM Sans',sans-serif",
                                          fontSize: 12,
                                        },
                                      }}
                                    />
                                  </Stack>
                                )}
                              />
                            </InputWrap>
                          </Grid.Col>
                          <Grid.Col span={{ base: 12, sm: 6 }}>
                            <InputWrap>
                              <FormSelect
                                name="memberType"
                                control={control}
                                label="Member Type"
                                placeholder="Select type"
                                labelColor="#2D3A4A"
                                data={[
                                  'Principal',
                                  'Spouse',
                                  'Child',
                                  'Dependent',
                                ].map((v) => ({ value: v, label: v }))}
                              />
                            </InputWrap>
                          </Grid.Col>
                          <Grid.Col span={{ base: 12, sm: 6 }}>
                            <InputWrap>
                              <FormInput
                                name="planName"
                                control={control}
                                label="Plan / Benefit Tier"
                                placeholder="e.g. Gold, Inpatient+Outpatient"
                                labelColor="#2D3A4A"
                              />
                            </InputWrap>
                          </Grid.Col>
                          <Grid.Col span={12}>
                            <InputWrap>
                              <FormInput
                                name="employerName"
                                control={control}
                                label="Employer / Scheme Sponsor"
                                placeholder="e.g. Uganda Revenue Authority, MTN Uganda"
                                labelColor="#2D3A4A"
                              />
                            </InputWrap>
                          </Grid.Col>
                          <Grid.Col span={12}>
                            {insuranceStatus && insuranceStatus !== 'none' && (
                              <Box
                                p="sm"
                                style={{
                                  background: '#f0f9ff',
                                  borderRadius: 8,
                                  border: '1px solid #bae6fd',
                                }}
                              >
                                <Group gap="xs">
                                  <TbInfoCircle
                                    size={14}
                                    color={SavedColors.Primaryblue}
                                  />
                                  <Text
                                    size="xs"
                                    c="dimmed"
                                  >
                                    Editing insurance will reset verification
                                    status to pending review
                                  </Text>
                                </Group>
                              </Box>
                            )}
                          </Grid.Col>
                        </Grid>
                      </Box>
                    )}
                  </>
                )}
              </Box>

              <Group
                justify="space-between"
                gap="sm"
                mt="xs"
                wrap="wrap"
              >
                {/* Delete — only for non-main profiles */}
                {!isMainAccount ? (
                  <Button
                    variant="light"
                    color="red"
                    radius={8}
                    onClick={() => setDeleteConfirmOpen(true)}
                    leftSection={<TbTrash size={15} />}
                  >
                    Delete Profile
                  </Button>
                ) : (
                  <Box />
                )}

                <Group gap="sm">
                  <Button
                    variant="default"
                    onClick={() => navigate('/dashboard')}
                    radius={8}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    loading={isSubmitting}
                    radius={8}
                    style={{
                      background:
                        'linear-gradient(135deg,#15B3E0 0%,#012970 100%)',
                      border: 'none',
                    }}
                  >
                    Save Changes
                  </Button>
                </Group>
              </Group>
            </Stack>
          </form>
        </ContentCard>
      </Container>

      {/* Camera Modal */}
      <Modal
        opened={cameraOpen}
        onClose={closeCamera}
        title="Take Profile Photo"
        centered
        size="md"
        styles={{
          title: { fontFamily: "'DM Sans',sans-serif", fontWeight: 600 },
        }}
      >
        <Stack
          gap="md"
          align="center"
        >
          <Box
            style={{
              width: '100%',
              borderRadius: 8,
              overflow: 'hidden',
              background: '#000',
              maxHeight: 360,
            }}
          >
            <video
              ref={videoRef}
              style={{ width: '100%', display: 'block' }}
              playsInline
              muted
            />
          </Box>
          <Group gap="sm">
            <Tooltip label="Flip camera">
              <ActionIcon
                variant="light"
                color="lotusCyan"
                size="lg"
                onClick={() =>
                  openCamera(facingMode === 'user' ? 'environment' : 'user')
                }
              >
                <TbRefresh size={18} />
              </ActionIcon>
            </Tooltip>
            <Button
              color="lotusCyan"
              leftSection={<TbCamera size={16} />}
              onClick={takePhoto}
            >
              Capture
            </Button>
            <Button
              variant="outline"
              color="gray"
              onClick={closeCamera}
            >
              Cancel
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        opened={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        centered
        size="sm"
        radius="md"
        title="Delete Profile"
        styles={{
          title: {
            fontFamily: "'DM Sans',sans-serif",
            fontWeight: 700,
            color: '#1A2B3C',
          },
        }}
      >
        <Box>
          <Text
            size="sm"
            c="dimmed"
            mb="xl"
            lh={1.6}
          >
            Are you sure you want to delete this profile? This will also remove
            any associated insurance records. This action cannot be undone.
          </Text>
          <Group
            justify="flex-end"
            gap="sm"
          >
            <Button
              variant="default"
              radius={8}
              onClick={() => setDeleteConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button
              color="red"
              radius={8}
              loading={deleting}
              leftSection={<TbTrash size={15} />}
              onClick={async () => {
                setDeleting(true)
                await deleteProfile()
                setDeleting(false)
                setDeleteConfirmOpen(false)
              }}
            >
              Delete Profile
            </Button>
          </Group>
        </Box>
      </Modal>
    </PageWrapper>
  )
}

