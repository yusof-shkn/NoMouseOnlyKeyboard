import {
  Text,
  Badge,
  Group,
  Stack,
  Paper,
  Divider,
  ThemeIcon,
  useMantineTheme,
  useMantineColorScheme,
} from '@mantine/core'
import {
  IconRuler,
  IconCalendar,
  IconArrowRight,
  IconWorld,
  IconBuilding,
} from '@tabler/icons-react'
import { UnitWithRelations } from '@shared/types/units'

interface UnitViewProps {
  unit: UnitWithRelations
}

const InfoRow = ({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) => (
  <Group
    justify="space-between"
    wrap="nowrap"
    gap="xs"
  >
    <Text
      size="sm"
      c="dimmed"
      style={{ minWidth: 140 }}
    >
      {label}
    </Text>
    <Text
      size="sm"
      fw={500}
      ta="right"
    >
      {value ?? '—'}
    </Text>
  </Group>
)

const typeColors: Record<string, string> = {
  base: 'blue',
  derived: 'teal',
  compound: 'violet',
}

export const UnitView = ({ unit }: UnitViewProps) => {
  const theme = useMantineTheme()
  const { colorScheme } = useMantineColorScheme()
  const isDark = colorScheme === 'dark'
  const cardBg = isDark ? theme.colors.dark[6] : theme.colors.gray[0]
  const isSystem = (unit as any).is_global === true

  if (!unit)
    return (
      <Text
        c="dimmed"
        ta="center"
        py="xl"
      >
        No unit data available
      </Text>
    )

  return (
    <Stack gap="md">
      {/* Header */}
      <Paper
        p="md"
        radius="md"
        bg={cardBg}
      >
        <Group
          justify="space-between"
          align="center"
        >
          <Group gap="sm">
            <ThemeIcon
              size="lg"
              radius="md"
              variant="light"
              color={typeColors[unit.type] || 'blue'}
            >
              <IconRuler size={20} />
            </ThemeIcon>
            <Stack gap={2}>
              <Text
                fw={700}
                size="lg"
              >
                {unit.name}
              </Text>
              <Text
                size="sm"
                c="dimmed"
              >
                {unit.short_code}
              </Text>
            </Stack>
          </Group>
          <Group gap="xs">
            <Badge
              color={isSystem ? 'violet' : 'teal'}
              variant="light"
              leftSection={
                isSystem ? <IconWorld size={10} /> : <IconBuilding size={10} />
              }
            >
              {isSystem ? 'System' : 'Company'}
            </Badge>
            <Badge
              color={typeColors[unit.type] || 'blue'}
              variant="light"
            >
              {unit.type?.toUpperCase()}
            </Badge>
            <Badge
              color={unit.is_active ? 'green' : 'red'}
              variant="light"
            >
              {unit.is_active ? 'Active' : 'Inactive'}
            </Badge>
          </Group>
        </Group>
      </Paper>

      {/* Details */}
      <Paper
        p="md"
        radius="md"
        bg={cardBg}
      >
        <Group
          gap="xs"
          mb="sm"
        >
          <IconRuler size={16} />
          <Text
            fw={600}
            size="sm"
          >
            Unit Details
          </Text>
        </Group>
        <Divider mb="sm" />
        <Stack gap="xs">
          <InfoRow
            label="Name"
            value={unit.name}
          />
          <InfoRow
            label="Short Code"
            value={unit.short_code}
          />
          <InfoRow
            label="Scope"
            value={
              <Badge
                color={isSystem ? 'violet' : 'teal'}
                variant="light"
                size="sm"
                leftSection={
                  isSystem ? (
                    <IconWorld size={10} />
                  ) : (
                    <IconBuilding size={10} />
                  )
                }
              >
                {isSystem ? 'System (Global)' : 'Company'}
              </Badge>
            }
          />
          <InfoRow
            label="Type"
            value={
              <Badge
                color={typeColors[unit.type] || 'blue'}
                variant="light"
                size="sm"
              >
                {unit.type}
              </Badge>
            }
          />
          {unit.base_unit && (
            <InfoRow
              label="Base Unit"
              value={
                <Group gap="xs">
                  <IconArrowRight size={12} />
                  <Text size="sm">
                    {unit.base_unit.name} ({unit.base_unit.short_code})
                  </Text>
                </Group>
              }
            />
          )}
          {unit.conversion_factor && unit.conversion_factor !== 1 && (
            <InfoRow
              label="Conversion Factor"
              value={`${unit.conversion_factor}x`}
            />
          )}
        </Stack>
      </Paper>

      {/* Derived units */}
      {unit.derived_units && unit.derived_units.length > 0 && (
        <Paper
          p="md"
          radius="md"
          bg={cardBg}
        >
          <Group
            gap="xs"
            mb="sm"
          >
            <IconArrowRight size={16} />
            <Text
              fw={600}
              size="sm"
            >
              Derived Units ({unit.derived_units.length})
            </Text>
          </Group>
          <Divider mb="sm" />
          <Stack gap="xs">
            {unit.derived_units.map((du) => (
              <InfoRow
                key={du.id}
                label={du.name}
                value={`${du.conversion_factor}x (${du.short_code})`}
              />
            ))}
          </Stack>
        </Paper>
      )}

      {/* Timestamps */}
      <Paper
        p="md"
        radius="md"
        bg={cardBg}
      >
        <Group
          gap="xs"
          mb="sm"
        >
          <IconCalendar size={16} />
          <Text
            fw={600}
            size="sm"
          >
            Record Info
          </Text>
        </Group>
        <Divider mb="sm" />
        <Stack gap="xs">
          <InfoRow
            label="Created"
            value={
              unit.created_at
                ? new Date(unit.created_at).toLocaleDateString()
                : undefined
            }
          />
          <InfoRow
            label="Updated"
            value={
              unit.updated_at
                ? new Date(unit.updated_at).toLocaleDateString()
                : undefined
            }
          />
        </Stack>
      </Paper>
    </Stack>
  )
}

export default UnitView

