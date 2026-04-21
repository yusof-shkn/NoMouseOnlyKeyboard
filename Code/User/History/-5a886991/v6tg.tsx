import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Box,
  Stack,
  Text,
  TextInput,
  Button,
  Group,
  Center,
  Loader,
} from '@mantine/core'
import { TbArrowLeft, TbShieldCheck, TbUserPlus } from 'react-icons/tb'
import { notifications } from '@mantine/notifications'
import styled from 'styled-components'
import { SavedColors } from '@shared/constants'
import { supabase } from '../../../lib/supabase'
import { useInsuranceStaff } from '../../../features/insurance/context/InsuranceStaffContext'

const Card = styled.div`
  background: #fff;
  border-radius: 16px;
  border: 1.5px solid ${SavedColors.DemWhite};
  padding: 28px 24px;
  max-width: 480px;
  width: 100%;
`

export default function InsuranceAddStaffProfile(): JSX.Element {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const editId = searchParams.get('edit')
  const isEdit = !!editId

  const { staffInfo, refreshStaffProfiles } = useInsuranceStaff()

  const [displayName, setDisplayName] = useState('')
  const [title, setTitle] = useState('')
  const [saving, setSaving] = useState(false)
  const [loadingEdit, setLoadingEdit] = useState(isEdit)

  useEffect(() => {
    if (!editId) return
    supabase
      .from('insurance_staff_profiles')
      .select('display_name, title')
      .eq('id', editId)
      .single()
      .then(({ data }) => {
        if (data) {
          setDisplayName(
            (data as { display_name: string; title: string | null })
              .display_name,
          )
          setTitle(
            (data as { display_name: string; title: string | null }).title ??
              '',
          )
        }
        setLoadingEdit(false)
      })
  }, [editId])

  const handleSave = async (): Promise<void> => {
    if (!displayName.trim()) {
      notifications.show({
        title: 'Name required',
        message: 'Enter a display name for this profile.',
        color: 'orange',
        autoClose: 2500,
      })
      return
    }
    setSaving(true)

    if (isEdit && editId) {
      const { error } = await supabase
        .from('insurance_staff_profiles')
        .update({
          display_name: displayName.trim(),
          title: title.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editId)
      setSaving(false)
      if (error) {
        notifications.show({
          title: 'Error',
          message: error.message,
          color: 'red',
          autoClose: 3000,
        })
        return
      }
      notifications.show({
        title: 'Profile updated',
        message: `"${displayName.trim()}" has been saved.`,
        color: 'teal',
        autoClose: 2500,
      })
      await refreshStaffProfiles()
      navigate(-1)
      return
    }

    // staffInfo.id is the real staff row id — never fall back to auth uid
    if (!staffInfo?.id) {
      setSaving(false)
      notifications.show({
        title: 'Not ready',
        message: 'Staff info is still loading. Please try again.',
        color: 'orange',
        autoClose: 3000,
      })
      return
    }

    const { data, error } = await supabase
      .from('insurance_staff_profiles')
      .insert({
        staff_id: staffInfo.id,
        display_name: displayName.trim(),
        title: title.trim() || null,
        is_main: false,
      })
      .select('id')
      .single()

    setSaving(false)
    if (error) {
      notifications.show({
        title: 'Error',
        message: error.message,
        color: 'red',
        autoClose: 3000,
      })
      return
    }
    notifications.show({
      title: 'Profile created',
      message: `Switching to "${displayName.trim()}"`,
      color: 'lotusCyan',
      autoClose: 2500,
    })
    await refreshStaffProfiles(data?.id as string | undefined)
    navigate('/insurance/profile', { replace: true })
  }

  if (loadingEdit) {
    return (
      <Center h="60vh">
        <Loader color="lotusCyan" />
      </Center>
    )
  }

  return (
    <Box p={{ base: 'md', sm: 'xl' }}>
      <Group mb="xl">
        <Button
          variant="subtle"
          color="gray"
          size="xs"
          leftSection={<TbArrowLeft size={14} />}
          onClick={() => navigate(-1)}
        >
          Back
        </Button>
      </Group>

      <Box style={{ display: 'flex', justifyContent: 'center' }}>
        <Stack
          gap="xl"
          style={{ width: '100%', maxWidth: 480 }}
        >
          <Box>
            <Group
              gap={8}
              mb={4}
            >
              <TbShieldCheck
                size={20}
                color={SavedColors.Primaryblue}
              />
              <Text
                style={{
                  fontFamily: "'DM Sans',sans-serif",
                  fontWeight: 800,
                  fontSize: 20,
                  color: SavedColors.TextColor,
                }}
              >
                {isEdit ? 'Edit Profile' : 'New Profile'}
              </Text>
            </Group>
            <Text
              c="dimmed"
              size="sm"
            >
              {isEdit
                ? 'Update the name shown in reports and audit logs for this profile.'
                : 'Create a named profile. Each profile is tracked separately in reports and audit logs.'}
            </Text>
          </Box>

          <Card>
            <Stack gap="md">
              <Box
                px="sm"
                py={10}
                style={{
                  background: '#EBF7FD',
                  borderRadius: 8,
                  border: '1px solid #bae6fd',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <TbUserPlus
                  size={15}
                  color="#0891b2"
                />
                <Text
                  size="xs"
                  c="#0891b2"
                  fw={600}
                >
                  Provider: {staffInfo?.provider_name ?? '—'}
                </Text>
              </Box>

              <TextInput
                label="Display Name"
                description="This name will appear as the actor in all approvals, verifications, and reports."
                placeholder="e.g. Dr. Sarah Mukasa"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                styles={{
                  input: {
                    height: 44,
                    border: '1.5px solid #E4E9F0',
                    borderRadius: 10,
                  },
                  label: {
                    fontFamily: "'DM Sans',sans-serif",
                    fontWeight: 600,
                    fontSize: 13,
                    color: '#2D3A4A',
                    marginBottom: 4,
                  },
                  description: {
                    fontFamily: "'DM Sans',sans-serif",
                    fontSize: 12,
                    color: '#8A96A3',
                    marginBottom: 6,
                  },
                }}
              />

              <TextInput
                label="Title / Role (optional)"
                placeholder="e.g. Claims Officer, Senior Verifier"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                styles={{
                  input: {
                    height: 44,
                    border: '1.5px solid #E4E9F0',
                    borderRadius: 10,
                  },
                  label: {
                    fontFamily: "'DM Sans',sans-serif",
                    fontWeight: 600,
                    fontSize: 13,
                    color: '#2D3A4A',
                    marginBottom: 4,
                  },
                }}
              />

              <Group
                justify="flex-end"
                gap="sm"
                mt="xs"
              >
                <Button
                  variant="default"
                  onClick={() => navigate(-1)}
                >
                  Cancel
                </Button>
                <Button
                  color="lotusCyan"
                  loading={saving}
                  leftSection={<TbShieldCheck size={14} />}
                  onClick={() => void handleSave()}
                >
                  {isEdit ? 'Save Changes' : 'Create Profile'}
                </Button>
              </Group>
            </Stack>
          </Card>
        </Stack>
      </Box>
    </Box>
  )
}

