import { ActionIcon, Group, Paper, Stack, Text, useMantineTheme } from '@mantine/core'
import { IconBook2, IconHome2, IconUserCircle } from '@tabler/icons-react'
import { getHomeThemeTokens } from '../home-theme'
import type { BottomNavItem } from '../home-dashboard.types'

interface BottomNavProps {
  items: Array<BottomNavItem>
  activeItemId: BottomNavItem['id']
  fixed?: boolean
}

const bottomNavIcons = {
  home: IconHome2,
  lessons: IconBook2,
  profile: IconUserCircle,
} as const

export function BottomNav({
  items,
  activeItemId,
  fixed = true,
}: BottomNavProps) {
  const theme = useMantineTheme()
  const homeTokens = getHomeThemeTokens(theme)

  return (
    <Paper
      p="sm"
      style={{
        position: fixed ? 'fixed' : 'static',
        left: fixed ? 0 : undefined,
        right: fixed ? 0 : undefined,
        bottom: fixed ? 0 : undefined,
        zIndex: fixed ? 30 : undefined,
        borderTop: fixed ? `1px solid ${theme.colors.gray[3]}` : undefined,
        backdropFilter: fixed ? theme.other.glass.backdropBlur : undefined,
        WebkitBackdropFilter: fixed ? theme.other.glass.backdropBlur : undefined,
        backgroundColor: fixed
          ? `color-mix(in srgb, ${theme.white} 84%, transparent)`
          : theme.white,
        boxShadow: fixed ? '0 -12px 28px rgba(25, 28, 26, 0.08)' : theme.shadows.sm,
      }}
    >
      <Group
        justify="space-around"
        style={{
          marginInline: 'auto',
          maxWidth: homeTokens.bottomNavMaxWidth,
        }}
      >
        {items.map((item) => {
          const isActive = item.id === activeItemId
          const Icon = bottomNavIcons[item.icon]

          return (
            <ActionIcon
              key={item.id}
              aria-label={item.label}
              color={isActive ? 'primary' : 'gray'}
              p="xs"
              radius={homeTokens.iconRadius}
              size="auto"
              styles={{
                root: {
                  minWidth: 84,
                  height: 62,
                  backgroundColor: isActive ? theme.colors.primary[6] : 'transparent',
                  color: isActive ? theme.white : theme.colors.gray[8],
                },
              }}
              variant="transparent"
            >
              <Stack align="center" gap={2}>
                <Icon size={20} />
                <Text
                  c={isActive ? theme.white : theme.colors.gray[8]}
                  fw={isActive ? 700 : 500}
                  size="xs"
                >
                  {item.label}
                </Text>
              </Stack>
            </ActionIcon>
          )
        })}
      </Group>
    </Paper>
  )
}
