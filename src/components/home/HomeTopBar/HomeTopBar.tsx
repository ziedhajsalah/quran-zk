import { ActionIcon, Box, Container, Group, Text, ThemeIcon, useMantineTheme } from '@mantine/core'
import { IconBell, IconBook2 } from '@tabler/icons-react'
import { getHomeThemeTokens } from '../home-theme'

interface HomeTopBarProps {
  brandName: string
  brandMarkText: string
  notificationLabel: string
}

export function HomeTopBar({
  brandName,
  brandMarkText,
  notificationLabel,
}: HomeTopBarProps) {
  const theme = useMantineTheme()
  const homeTokens = getHomeThemeTokens(theme)

  return (
    <Box
      component="header"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 20,
        backdropFilter: theme.other.glass.backdropBlur,
        WebkitBackdropFilter: theme.other.glass.backdropBlur,
        backgroundColor: `color-mix(in srgb, ${theme.white} 88%, transparent)`,
      }}
    >
      <Container size="xl" px={{ base: 'lg', sm: 'xl' }} py="md">
        <Group justify="space-between" wrap="nowrap">
          <Group gap="sm" wrap="nowrap">
            <ThemeIcon
              size={48}
              radius={homeTokens.iconRadius}
              variant="filled"
              color="primary"
            >
              <IconBook2 size={20} />
            </ThemeIcon>

            <Box>
              <Text
                fw={900}
                style={{
                  color: theme.colors.primary[6],
                  fontFamily: theme.headings.fontFamily,
                  fontSize: 'clamp(1.65rem, 2vw, 2.1rem)',
                }}
              >
                {brandName}
              </Text>
              <Text size="xs" c="gray.8">
                {brandMarkText}
              </Text>
            </Box>
          </Group>

          <ActionIcon
            aria-label={notificationLabel}
            color="primary"
            radius={homeTokens.iconRadius}
            size={42}
            variant="subtle"
          >
            <IconBell size={22} />
          </ActionIcon>
        </Group>
      </Container>
    </Box>
  )
}
