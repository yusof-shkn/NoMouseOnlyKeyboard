import { useEffect, useState } from 'react'
import { Box, Stack, TextInput, Text, Loader, Center } from '@mantine/core'
import { IconSearch, IconUsers, IconMail, IconPhone } from '@tabler/icons-react'
import { getRoleUsers } from '../data/roles.queries'
import { formatDate } from '@shared/utils/formatters'
import { DrawerViewSkeleton } from '@shared/components/skeletons/DrawerView.skeleton'
import {
  DrawerHero,
  HeroBadge,
  DrawerSection,
  StatusPill,
  EmptyState,
  PersonCard,
} from '@shared/components/drawerView/DrawerViewComponents'

interface Props {
  roleId: number
  roleName: string
  userCount: number
}

const ViewRoleUsersModal = ({ roleId, roleName, userCount }: Props) => {
  const [users, setUsers] = useState<any[]>([])
  const [filtered, setFiltered] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    getRoleUsers(roleId)
      .then((res) => {
        setUsers(res.data || [])
        setFiltered(res.data || [])
      })
      .finally(() => setLoading(false))
  }, [roleId])

  useEffect(() => {
    const q = search.toLowerCase()
    setFiltered(
      users.filter((u: any) =>
        `${u.first_name} ${u.last_name} ${u.email} ${u.username}`
          .toLowerCase()
          .includes(q),
      ),
    )
  }, [search, users])

  if (loading) return <DrawerViewSkeleton variant="simple" />

  return (
    <Box>
      <DrawerHero
        icon={<IconUsers size={26} />}
        title={`Users: ${roleName}`}
        subtitle={`${users.length} user${users.length !== 1 ? 's' : ''} assigned`}
        color="violet"
        badges={<HeroBadge color="violet">{roleName}</HeroBadge>}
      />

      <DrawerSection
        icon={<IconUsers size={14} />}
        title="Users"
        accent="violet"
      >
        {users.length > 4 && (
          <TextInput
            placeholder="Search users…"
            leftSection={<IconSearch size={14} />}
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            mb="sm"
            size="sm"
          />
        )}

        {filtered.length === 0 ? (
          <EmptyState
            message={
              search
                ? 'No users match your search'
                : 'No users assigned to this role'
            }
            icon={<IconUsers size={24} />}
          />
        ) : (
          <Stack gap="xs">
            {filtered.map((user: any) => (
              <PersonCard
                key={user.id}
                name={
                  `${user.first_name || ''} ${user.last_name || ''}`.trim() ||
                  user.username
                }
                subtitle={user.username}
                email={user.email}
                phone={user.phone}
                avatarColor="violet"
                badge={
                  <StatusPill
                    label={user.is_active ? 'Active' : 'Inactive'}
                    color={user.is_active ? 'green' : 'red'}
                    size="xs"
                  />
                }
              />
            ))}
          </Stack>
        )}
      </DrawerSection>
    </Box>
  )
}

export default ViewRoleUsersModal

