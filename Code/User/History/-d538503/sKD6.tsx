import { Text, Badge, Group, Stack, Paper, Divider, ThemeIcon, useMantineTheme, useMantineColorScheme, ColorSwatch } from '@mantine/core'
import { IconCategory, IconCode, IconNotes, IconCalendar, IconGlobe } from '@tabler/icons-react'
import { ProductCategory } from '@shared/types/products'

interface CategoryViewProps {
  category: ProductCategory
}

const InfoRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <Group justify="space-between" wrap="nowrap" gap="xs">
    <Text size="sm" c="dimmed" style={{ minWidth: 140 }}>{label}</Text>
    <Text size="sm" fw={500} ta="right">{value ?? '—'}</Text>
  </Group>
)

export const CategoryView = ({ category }: CategoryViewProps) => {
  const theme = useMantineTheme()
  const { colorScheme } = useMantineColorScheme()
  const isDark = colorScheme === 'dark'
  const cardBg = isDark ? theme.colors.dark[6] : theme.colors.gray[0]

  if (!category) return <Text c="dimmed" ta="center" py="xl">No category data available</Text>

  return (
    <Stack gap="md">
      {/* Header */}
      <Paper p="md" radius="md" bg={cardBg}>
        <Group justify="space-between" align="center">
          <Group gap="sm">
            <ThemeIcon size="lg" radius="md" variant="light" color={category.color_code || 'blue'}>
              <IconCategory size={20} />
            </ThemeIcon>
            <Stack gap={2}>
              <Text fw={700} size="lg">{category.category_name}</Text>
              {category.category_code && <Text size="sm" c="dimmed">{category.category_code}</Text>}
            </Stack>
          </Group>
          <Group gap="xs">
            <Badge color={category.is_active ? 'green' : 'red'} variant="light">
              {category.is_active ? 'Active' : 'Inactive'}
            </Badge>
            {category.is_global && <Badge color="violet" variant="light" leftSection={<IconGlobe size={10} />}>Global</Badge>}
          </Group>
        </Group>
      </Paper>

      {/* Details */}
      <Paper p="md" radius="md" bg={cardBg}>
        <Group gap="xs" mb="sm">
          <IconCode size={16} />
          <Text fw={600} size="sm">Category Details</Text>
        </Group>
        <Divider mb="sm" />
        <Stack gap="xs">
          <InfoRow label="Category Name" value={category.category_name} />
          <InfoRow label="Category Code" value={category.category_code} />
          <InfoRow label="Sort Order" value={category.sort_order} />
          <InfoRow
            label="Color"
            value={category.color_code
              ? <Group gap="xs"><ColorSwatch color={category.color_code} size={16} /><Text size="sm">{category.color_code}</Text></Group>
              : undefined}
          />
          <InfoRow label="Icon" value={category.icon_name} />
        </Stack>
      </Paper>

      {/* Description */}
      {category.description && (
        <Paper p="md" radius="md" bg={cardBg}>
          <Group gap="xs" mb="sm">
            <IconNotes size={16} />
            <Text fw={600} size="sm">Description</Text>
          </Group>
          <Divider mb="sm" />
          <Text size="sm">{category.description}</Text>
        </Paper>
      )}

      {/* Timestamps */}
      <Paper p="md" radius="md" bg={cardBg}>
        <Group gap="xs" mb="sm">
          <IconCalendar size={16} />
          <Text fw={600} size="sm">Record Info</Text>
        </Group>
        <Divider mb="sm" />
        <Stack gap="xs">
          <InfoRow label="Created" value={category.created_at ? new Date(category.created_at).toLocaleDateString() : undefined} />
          <InfoRow label="Updated" value={category.updated_at ? new Date(category.updated_at).toLocaleDateString() : undefined} />
        </Stack>
      </Paper>
    </Stack>
  )
}

export default CategoryView
