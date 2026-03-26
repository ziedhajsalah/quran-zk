import type { MantineTheme } from '@mantine/core'

export interface HomeThemeTokens {
  heroRadius: string
  cardRadius: string
  navRadius: string
  iconRadius: string
  bottomNavMaxWidth: string
  floatingActionOffset: string
  floatingActionBottom: string
  floatingActionSize: string
}

export function getHomeThemeTokens(theme: MantineTheme): HomeThemeTokens {
  return theme.other.componentTokens.home as HomeThemeTokens
}
