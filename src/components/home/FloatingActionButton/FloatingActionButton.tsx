import { ActionIcon, Box, useMantineTheme } from '@mantine/core'
import { IconPlus } from '@tabler/icons-react'
import { getHomeThemeTokens } from '../home-theme'

interface FloatingActionButtonProps {
  label: string
  fixed?: boolean
}

export function FloatingActionButton({
  label,
  fixed = true,
}: FloatingActionButtonProps) {
  const theme = useMantineTheme()
  const homeTokens = getHomeThemeTokens(theme)

  return (
    <Box
      style={{
        position: fixed ? 'fixed' : 'static',
        left: fixed ? homeTokens.floatingActionOffset : undefined,
        bottom: fixed ? homeTokens.floatingActionBottom : undefined,
        zIndex: fixed ? 31 : undefined,
      }}
    >
      <ActionIcon
        aria-label={label}
        color="primary"
        radius={homeTokens.iconRadius}
        size={homeTokens.floatingActionSize}
        variant="filled"
      >
        <IconPlus size={24} />
      </ActionIcon>
    </Box>
  )
}
