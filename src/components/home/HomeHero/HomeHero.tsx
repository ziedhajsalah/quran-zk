import { Badge, Box, Paper, Stack, Text, Title, useMantineTheme } from '@mantine/core'
import { getHomeThemeTokens } from '../home-theme'

interface HomeHeroProps {
  eyebrow: string
  greeting: string
  studentName: string
  quote: string
}

export function HomeHero({
  eyebrow,
  greeting,
  studentName,
  quote,
}: HomeHeroProps) {
  const theme = useMantineTheme()
  const homeTokens = getHomeThemeTokens(theme)

  return (
    <Paper
      p={{ base: 'xl', sm: '2.5rem' }}
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: homeTokens.heroRadius,
        background: `linear-gradient(145deg, ${theme.colors.primary[6]}, ${theme.colors.primary[7]})`,
      }}
    >
      <Box
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: [
            `radial-gradient(circle at top left, color-mix(in srgb, ${theme.white} 14%, transparent) 0, transparent 32%)`,
            `radial-gradient(circle at bottom right, color-mix(in srgb, ${theme.colors.primary[2]} 22%, transparent) 0, transparent 38%)`,
          ].join(','),
          opacity: 0.95,
        }}
      />

      <Stack
        gap="md"
        maw={560}
        style={{
          position: 'relative',
          zIndex: 1,
        }}
      >
        <Badge
          w="fit-content"
          size="lg"
          styles={{
            root: {
              borderRadius: 999,
              backgroundColor: `color-mix(in srgb, ${theme.white} 12%, transparent)`,
              color: theme.colors.primary[1],
              fontWeight: 600,
            },
          }}
        >
          {eyebrow}
        </Badge>

        <Title
          order={1}
          style={{
            color: theme.white,
            fontSize: 'clamp(2.25rem, 5vw, 3.5rem)',
            lineHeight: 1.2,
          }}
        >
          {greeting} {studentName}
        </Title>

        <Text
          maw={520}
          style={{
            color: theme.colors.primary[1],
            fontSize: 'clamp(1rem, 2vw, 1.2rem)',
            lineHeight: 1.9,
          }}
        >
          {quote}
        </Text>
      </Stack>
    </Paper>
  )
}
