import React, { useEffect, useState } from 'react'
import {
  Skeleton,
  Alert,
  Box,
  Stack,
  Text,
  Badge,
  Group,
  Avatar,
} from '@mantine/core'
import {
  IconMapPin,
  IconUserShield,
  IconBuildingStore,
  IconInfoCircle,
  IconAlertCircle,
  IconEdit,
  IconMap2,
  IconWorld,
} from '@tabler/icons-react'
import { getAreaWithDetails } from '../data/areas.queries'
import { formatDate } from '@shared/utils/formatters'
import { useDispatch } from 'react-redux'
import { closeModal, openModal } from '@shared/components/genericModal'
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
  areaId: number
  areaData?: any
}

const AreaViewModal: React.FC<Props> = ({ areaId, areaData: initialData }) => {
  const [areaData, setAreaData] = useState<any>(initialData || null)
  const [loading, setLoading] = useState(!initialData)
  const [error, setError] = useState<string | null>(null)
  const dispatch = useDispatch()

  useEffect(() => {
    if (!initialData) fetchAreaDetails()
  }, [areaId, initialData])

  const fetchAreaDetails = async () => {
    try {
      setLoading(true)
      setError(null)
      const { data, error: fetchError } = await getAreaWithDetails(areaId)
      if (fetchError) throw fetchError
      setAreaData(data)
    } catch (err: any) {
      setError(err.message || 'Failed to load area details')
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = () => {
    dispatch(closeModal())
    dispatch(
      openModal({
        type: 'edit-area',
        size: 'xl',
        props: {
          mode: 'edit',
          initialValues: {
            id: areaData.id,
            company_id: areaData.company_id,
            area_name: areaData.area_name,
            area_code: areaData.area_code,
            description: areaData.description,
            parent_area_id: areaData.parent_area_id,
            region: areaData.region,
            country: areaData.country,
            assigned_admin_ids:
              areaData.admins?.map((a: any) => a.auth_id) || [],
            assigned_store_ids: areaData.stores?.map((s: any) => s.id) || [],
            is_active: areaData.is_active,
          },
        },
      }),
    )
  }

  if (loading)
    return (
      <Box p="sm">
        {[80, 140, 140, 120].map((h, i) => (
          <Skeleton
            key={i}
            height={h}
            radius="md"
          />
        ))}
      </Box>
    )

  if (error || !areaData)
    return (
      <Box p="md">
        <Alert
          icon={<IconAlertCircle size={16} />}
          title="Error"
          color="red"
          radius="md"
          variant="light"
        >
          {error || 'Area not found'}
        </Alert>
      </Box>
    )

  return (
    <Box>
      <DrawerHero
        icon={<IconMapPin size={26} />}
        title={areaData.area_name}
        subtitle={areaData.area_code}
        color="blue"
        badges={
          <HeroBadge color={areaData.is_active ? 'green' : 'red'}>
            {areaData.is_active ? 'Active' : 'Inactive'}
          </HeroBadge>
        }
        actions={
          <ActionIcon
            variant="white"
            size="md"
            radius="sm"
            onClick={handleEdit}
            title="Edit Area"
          >
            <IconEdit size={15} />
          </ActionIcon>
        }
      />

      <DrawerSection
        icon={<IconInfoCircle size={14} />}
        title="Basic Information"
        accent="blue"
      >
        <FieldGrid>
          <Field
            label="Area Name"
            value={areaData.area_name}
          />
          <Field
            label="Area Code"
            value={areaData.area_code}
            mono
          />
          {areaData.region && (
            <Field
              label="Region"
              value={areaData.region}
              icon={<IconMap2 size={12} />}
            />
          )}
          {areaData.country && (
            <Field
              label="Country"
              value={areaData.country}
              icon={<IconWorld size={12} />}
            />
          )}
          {areaData.description && (
            <Field
              label="Description"
              value={areaData.description}
              span="full"
            />
          )}
        </FieldGrid>
      </DrawerSection>

      <DrawerSection
        icon={<IconUserShield size={14} />}
        title={`Area Admins (${areaData.admins?.length || 0})`}
        accent="violet"
      >
        {areaData.admins?.length > 0 ? (
          <Stack gap="xs">
            {areaData.admins.map((admin: any) => (
              <PersonCard
                key={admin.auth_id}
                name={`${admin.first_name} ${admin.last_name}`}
                email={admin.email}
                phone={admin.phone}
                avatarColor="violet"
                badge={
                  admin.role && (
                    <StatusPill
                      label={admin.role.role_name}
                      color="violet"
                      size="xs"
                    />
                  )
                }
              />
            ))}
          </Stack>
        ) : (
          <EmptyState message="No admins assigned to this area" />
        )}
      </DrawerSection>

      <DrawerSection
        icon={<IconBuildingStore size={14} />}
        title={`Assigned Stores (${areaData.stores?.length || 0})`}
        accent="indigo"
      >
        {areaData.stores?.length > 0 ? (
          <Stack gap="xs">
            {areaData.stores.map((store: any) => (
              <PersonCard
                key={store.id}
                name={store.store_name}
                subtitle={`${store.store_code}${store.store_type ? ` · ${store.store_type}` : ''}`}
                phone={store.phone}
                email={store.email}
                avatarColor="indigo"
                icon={<IconBuildingStore size={16} />}
                badge={
                  <StatusPill
                    label={store.is_active ? 'Active' : 'Inactive'}
                    color={store.is_active ? 'green' : 'red'}
                    size="xs"
                  />
                }
              />
            ))}
          </Stack>
        ) : (
          <EmptyState message="No stores assigned to this area" />
        )}
      </DrawerSection>

      <MetaFooter
        createdAt={areaData.created_at}
        updatedAt={areaData.updated_at}
        formatDate={formatDate}
      />
    </Box>
  )
}

export default AreaViewModal

