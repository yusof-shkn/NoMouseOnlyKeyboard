import React from 'react'
import {
  Menu,
  ActionIcon,
  useMantineTheme,
  useMantineColorScheme,
  Tooltip,
  Box,
  Text,
} from '@mantine/core'
import {
  IconSettings,
  IconBuildingSkyscraper,
  IconSlideshow,
  IconShieldLock,
} from '@tabler/icons-react'
import { Link } from 'react-router-dom'
import { Permission } from '@shared/constants/permissions'
import { Role } from '@shared/constants/roles'
import { PermissionGuard, RoleGuard } from '@shared/components/Permissionguards'

export function SettingsMenu() {
  const theme = useMantineTheme()
  const { colorScheme } = useMantineColorScheme()
  const isDark = colorScheme === 'dark'

  const bg = isDark ? '#0f1117' : '#ffffff'
  const border = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'
  const mutedText = isDark ? '#6b7280' : '#9ca3af'
  const bodyText = isDark ? '#e5e7eb' : '#111827'
  const subtleHover = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'

  return (
    <RoleGuard
      allowedRoles={[Role.company_admin, Role.area_admin, Role.store_admin]}
    >
      <Menu
        shadow="xl"
        width={200}
        radius={10}
        position="bottom-end"
        offset={8}
        styles={{
          dropdown: {
            backgroundColor: bg,
            border: `1px solid ${border}`,
            padding: 6,
            boxShadow: isDark
              ? '0 0 0 1px rgba(255,255,255,0.04), 0 8px 32px rgba(0,0,0,0.6)'
              : '0 0 0 1px rgba(0,0,0,0.04), 0 8px 32px rgba(0,0,0,0.12)',
          },
        }}
      >
        <Menu.Target>
          <Tooltip
            label="Settings"
            withArrow
            position="bottom"
            openDelay={500}
          >
            <ActionIcon
              variant="subtle"
              size={32}
              radius={6}
              style={{
                color: mutedText,
                transition: 'color 0.15s, background 0.15s',
              }}
              styles={{
                root: {
                  '&:hover': { backgroundColor: subtleHover, color: bodyText },
                },
              }}
            >
              <IconSettings
                size={16}
                stroke={1.6}
              />
            </ActionIcon>
          </Tooltip>
        </Menu.Target>

        <Menu.Dropdown>
          <Menu.Label
            style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: mutedText,
              paddingInline: 8,
            }}
          >
            Settings
          </Menu.Label>

          <PermissionGuard permission={Permission.COMPANY_SETTINGS_READ}>
            <Menu.Item
              component={Link}
              to="/settings/company"
              leftSection={
                <IconBuildingSkyscraper
                  size={14}
                  stroke={1.5}
                />
              }
              style={{
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 500,
                color: bodyText,
              }}
            >
              Company
            </Menu.Item>
          </PermissionGuard>

          <Menu.Item
            component={Link}
            to="/settings/preferences"
            leftSection={
              <IconSlideshow
                size={14}
                stroke={1.5}
              />
            }
            style={{
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 500,
              color: bodyText,
            }}
          >
            Preferences
          </Menu.Item>

          <Menu.Divider style={{ borderColor: border, margin: '4px 0' }} />

          <Menu.Item
            leftSection={
              <IconShieldLock
                size={14}
                stroke={1.5}
              />
            }
            style={{
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 500,
              color: bodyText,
            }}
          >
            Privacy
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
    </RoleGuard>
  )
}

