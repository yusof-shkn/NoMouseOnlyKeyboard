import React, { useEffect, useState } from 'react'
import { Skeleton, Alert, Box, Stack } from '@mantine/core'
import {
  IconUser,
  IconMail,
  IconPhone,
  IconUserShield,
  IconMapPin,
  IconBuildingStore,
  IconCalendar,
  IconAlertCircle,
  IconEdit,
  IconBriefcase,
  IconId,
  IconUserCheck,
} from '@tabler/icons-react'
import { formatDate } from '@shared/utils/formatters'
import { useDispatch } from 'react-redux'
import { closeModal, openModal } from '@shared/components/genericModal'
import { EnrichedUser } from '../utils/userManagement.utils'
import { getAllAreas, getAllStores } from '../data/users.queries'
import {
  DrawerHero,
  HeroBadge,
  DrawerSection,
  Field,
  FieldGrid,
  StatusPill,
  MetaFooter,
  EmptyState,
  PersonCard,
} from '@shared/components/drawerView/DrawerViewComponents'
import { ActionIcon } from '@mantine/core'

interface Props {
  userId: string
  userData?: EnrichedUser
}

const UserViewModal: React.FC<Props> = ({ userId, userData: initialData }) => {
  const [userData, setUserData] = useState<any>(initialData || null)
  const [areas, setAreas] = useState<any[]>([])
  const [stores, setStores] = useState<any[]>([])
  const [loading, setLoading] = useState(!initialData)
  const [error, setError] = useState<string | null>(null)
  const dispatch = useDispatch()

  useEffect(() => {
    if (initialData) {
      setUserData(initialData)
      loadRelated()
    } else loadAll()
  }, [userId])

  const loadAll = async () => {
    try {
      setLoading(true)
      await loadRelated()
    } catch (err: any) {
      setError(err.message || 'Failed to load user details')
    } finally {
      setLoading(false)
    }
  }

  const loadRelated = async () => {
    try {
      const [areasRes, storesRes] = await Promise.all([
        getAllAreas(),
        getAllStores(),
      ])
      setAreas(areasRes.data || [])
      setStores(storesRes.data || [])
    } catch (_) {}
  }

  const handleEdit = () => {
    if (!userData) return
    dispatch(closeModal())
    dispatch(
      openModal({
        type: 'edit-user',
        size: 'xl',
        props: { mode: 'edit', userId, initialValues: userData },
      }),
    )
  }

  if (loading)
    return (
      <Box p="sm">
        {[80, 140, 140].map((h, i) => (
          <Skeleton
            key={i}
            height={h}
            radius="md"
          />
        ))}
      </Box>
    )

  if (error || !userData)
    return (
      <Box p="md">
        <Alert
          icon={<IconAlertCircle size={16} />}
          title="Error"
          color="red"
          radius="md"
          variant="light"
        >
          {error || 'User not found'}
        </Alert>
      </Box>
    )

  const fullName =
    `${userData.first_name || ''} ${userData.last_name || ''}`.trim() ||
    userData.username
  const userAreas = areas.filter((a: any) => userData.area_ids?.includes(a.id))
  const userStores = stores.filter((s: any) =>
    userData.store_ids?.includes(s.id),
  )

  return (
    <Box>
      <DrawerHero
        icon={<IconUser size={26} />}
        title={fullName}
        subtitle={userData.email}
        color="blue"
        badges={
          <>
            <HeroBadge color={userData.is_active ? 'green' : 'red'}>
              {userData.is_active ? 'Active' : 'Inactive'}
            </HeroBadge>
            {userData.role?.role_name && (
              <HeroBadge color="violet">{userData.role.role_name}</HeroBadge>
            )}
          </>
        }
        actions={
          <ActionIcon
            variant="white"
            size="md"
            radius="sm"
            onClick={handleEdit}
            title="Edit User"
          >
            <IconEdit size={15} />
          </ActionIcon>
        }
      />

      <DrawerSection
        icon={<IconUser size={14} />}
        title="Personal Information"
        accent="blue"
      >
        <FieldGrid>
          <Field
            label="First Name"
            value={userData.first_name}
          />
          <Field
            label="Last Name"
            value={userData.last_name}
          />
          <Field
            label="Username"
            value={userData.username}
            mono
            icon={<IconId size={11} />}
          />
          <Field
            label="Email"
            value={userData.email}
            icon={<IconMail size={11} />}
          />
          {userData.phone && (
            <Field
              label="Phone"
              value={userData.phone}
              icon={<IconPhone size={11} />}
            />
          )}
          {userData.address && (
            <Field
              label="Address"
              value={userData.address}
              span="full"
              icon={<IconMapPin size={11} />}
            />
          )}
        </FieldGrid>
      </DrawerSection>

      <DrawerSection
        icon={<IconBriefcase size={14} />}
        title="Role & Access"
        accent="violet"
      >
        <FieldGrid>
          <Field
            label="Role"
            value={
              userData.role?.role_name ? (
                <StatusPill
                  label={userData.role.role_name}
                  color="violet"
                />
              ) : undefined
            }
          />
          <Field
            label="Account Status"
            value={
              <StatusPill
                label={userData.is_active ? 'Active' : 'Inactive'}
                color={userData.is_active ? 'green' : 'red'}
              />
            }
          />
          {userData.last_login_at && (
            <Field
              label="Last Login"
              value={formatDate(userData.last_login_at)}
              icon={<IconCalendar size={11} />}
            />
          )}
        </FieldGrid>
      </DrawerSection>

      {userAreas.length > 0 && (
        <DrawerSection
          icon={<IconMapPin size={14} />}
          title={`Areas (${userAreas.length})`}
          accent="teal"
        >
          <Stack gap="xs">
            {userAreas.map((area: any) => (
              <PersonCard
                key={area.id}
                name={area.area_name}
                subtitle={area.area_code}
                avatarColor="teal"
                icon={<IconMapPin size={16} />}
              />
            ))}
          </Stack>
        </DrawerSection>
      )}

      {userStores.length > 0 && (
        <DrawerSection
          icon={<IconBuildingStore size={14} />}
          title={`Stores (${userStores.length})`}
          accent="indigo"
        >
          <Stack gap="xs">
            {userStores.map((store: any) => (
              <PersonCard
                key={store.id}
                name={store.store_name}
                subtitle={store.store_code}
                avatarColor="indigo"
                icon={<IconBuildingStore size={16} />}
              />
            ))}
          </Stack>
        </DrawerSection>
      )}

      <MetaFooter
        createdAt={userData.created_at}
        updatedAt={userData.updated_at}
        formatDate={formatDate}
      />
    </Box>
  )
}

export default UserViewModal

