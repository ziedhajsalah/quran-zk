import { Box, Group, Paper, Stack, Text, useMantineTheme } from '@mantine/core'
import { IconBulb } from '@tabler/icons-react'
import { getHomeThemeTokens } from '../home-theme'

interface TipCardProps {
  title: string
  body: string
}

export function TipCard({ title, body }: TipCardProps) {
  const theme = useMantineTheme()
  const homeTokens = getHomeThemeTokens(theme)

  return (
    <Paper
      p={{ base: 'lg', sm: 'xl' }}
      style={{
        borderRadius: homeTokens.cardRadius,
        backgroundColor: `color-mix(in srgb, ${theme.colors.tertiary[1]} 54%, ${theme.white})`,
        border: `1px solid color-mix(in srgb, ${theme.colors.tertiary[4]} 35%, transparent)`,
      }}
    >
      <Group align="flex-start" justify="space-between" gap="md" wrap="nowrap">
        <Stack gap={6}>
          <Text fw={800} c="tertiary.6">
            {title}
          </Text>
          <Text c="gray.8" style={{ lineHeight: 1.9 }}>
            {body}
          </Text>
        </Stack>

        <Box
          style={{
            display: 'grid',
            placeItems: 'center',
            minWidth: 48,
            width: 48,
            height: 48,
            borderRadius: homeTokens.iconRadius,
            backgroundColor: theme.colors.tertiary[6],
            color: theme.white,
          }}
        >
          <IconBulb size={20} />
        </Box>
      </Group>
    </Paper>
  )
}
