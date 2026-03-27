import { useEffect, useState } from 'react'
import {
  Box,
  Stack,
  Text,
  Badge,
  Group,
  Accordion,
  ThemeIcon,
  Loader,
  Center,
  Alert,
} from '@mantine/core'
import {
  IconShieldCheck,
  IconUsers,
  IconKey,
  IconInfoCircle,
  IconCalendar,
} from '@tabler/icons-react'
import { EnrichedRole } from '../utils/roles.utils'
import {
  Permission,
  groupPermissionsByModule,
  getModuleIcon,
  getModuleColor,
  sortPermissionsByAction,
  getActionLabel,
  isCriticalPermission,
} from '../utils/permissions.utils'
import { getRolePermissions } from '../data/permissions.queries'
import { getRoleUsers } from '../data/roles.queries'
import { formatDate } from '@shared/utils/formatters'
import { DrawerViewSkeleton } from '@shared/components/skeletons/DrawerView.skeleton'
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

interface Props {
  roleId: number
  roleData: EnrichedRole
}

const ViewRoleModal = ({ roleId, roleData }: Props) => {
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (roleId) {
      Promise.all([getRolePermissions(roleId), getRoleUsers(roleId)])
        .then(([permsRes, usersRes]) => {
          setPermissions(permsRes.data || [])
          setUsers(usersRes.data || [])
        })
        .finally(() => setLoading(false))
    }
  }, [roleId])

  const groupedPermissions = groupPermissionsByModule(permissions)
  const actionColors: Record<string, string> = {
    read: 'blue',
    create: 'green',
    update: 'yellow',
    delete: 'red',
  }

  if (loading) return <DrawerViewSkeleton variant="simple" />

  return (
    <Box>
      <DrawerHero
        icon={<IconShieldCheck size={26} />}
        title={roleData.role_name}
        subtitle={roleData.description}
        color="violet"
        badges={
          <>
            <HeroBadge color={roleData.is_custom ? 'blue' : 'gray'}>
              {roleData.is_custom ? 'Custom Role' : 'System Role'}
            </HeroBadge>
            {roleData.is_system && (
              <HeroBadge color="orange">System Role</HeroBadge>
            )}
          </>
        }
      />

      <DrawerSection
        icon={<IconKey size={14} />}
        title={`Permissions (${permissions.length})`}
        accent="violet"
      >
        {permissions.length === 0 ? (
          <EmptyState
            message="No permissions assigned to this role"
            icon={<IconKey size={24} />}
          />
        ) : (
          <Accordion
            variant="separated"
            radius="sm"
          >
            {Object.entries(groupedPermissions).map(([module, perms]) => (
              <Accordion.Item
                key={module}
                value={module}
              >
                <Accordion.Control>
                  <Group
                    justify="space-between"
                    pr="sm"
                  >
                    <Group gap="xs">
                      <ThemeIcon
                        color={getModuleColor(module)}
                        variant="light"
                        size="sm"
                        radius="sm"
                      >
                        {getModuleIcon(module)}
                      </ThemeIcon>
                      <Text
                        size="sm"
                        fw={600}
                      >
                        {module}
                      </Text>
                    </Group>
                    <Badge
                      color={getModuleColor(module)}
                      variant="light"
                      size="sm"
                    >
                      {perms.length}
                    </Badge>
                  </Group>
                </Accordion.Control>
                <Accordion.Panel>
                  <Stack gap="xs">
                    {sortPermissionsByAction(perms).map((perm: Permission) => (
                      <Group
                        key={perm.id}
                        gap="xs"
                        wrap="nowrap"
                      >
                        <Badge
                          size="xs"
                          color={
                            perm.action
                              ? actionColors[perm.action] || 'gray'
                              : 'gray'
                          }
                          variant="light"
                        >
                          {getActionLabel(perm.action || 'unknown')}
                        </Badge>
                        <Text size="sm">
                          {perm.resource || perm.permission_name}
                        </Text>
                        {isCriticalPermission(perm.permission_name) && (
                          <Badge
                            size="xs"
                            color="orange"
                            variant="outline"
                          >
                            Critical
                          </Badge>
                        )}
                      </Group>
                    ))}
                  </Stack>
                </Accordion.Panel>
              </Accordion.Item>
            ))}
          </Accordion>
        )}
      </DrawerSection>

      <DrawerSection
        icon={<IconUsers size={14} />}
        title={`Assigned Users (${users.length})`}
        accent="green"
      >
        {users.length === 0 ? (
          <EmptyState
            message="No users assigned to this role"
            icon={<IconUsers size={24} />}
          />
        ) : (
          <Stack gap="xs">
            {users.slice(0, 8).map((user: any) => (
              <PersonCard
                key={user.id}
                name={
                  `${user.first_name || ''} ${user.last_name || ''}`.trim() ||
                  user.username
                }
                email={user.email}
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
            {users.length > 8 && (
              <Text
                size="xs"
                c="dimmed"
                ta="center"
              >
                +{users.length - 8} more users
              </Text>
            )}
          </Stack>
        )}
      </DrawerSection>

      <MetaFooter
        createdAt={roleData.created_at}
        updatedAt={roleData.updated_at}
        formatDate={formatDate}
      />
    </Box>
  )
}

export default ViewRoleModal

