import { Box, Group, Paper, RingProgress, Stack, Text, Title, useMantineTheme } from '@mantine/core'
import { IconStarFilled } from '@tabler/icons-react'
import { formatArabicPercent } from '../home-formatters'
import { getHomeThemeTokens } from '../home-theme'
import type { DailyProgressData } from '../home-dashboard.types'

interface DailyProgressCardProps {
  data: DailyProgressData
}

export function DailyProgressCard({ data }: DailyProgressCardProps) {
  const theme = useMantineTheme()
  const homeTokens = getHomeThemeTokens(theme)

  return (
    <Paper
      p={{ base: 'xl', sm: '2rem' }}
      style={{
        borderRadius: homeTokens.cardRadius,
        backgroundColor: theme.white,
        boxShadow: theme.shadows.ambient,
      }}
    >
      <Stack gap="xl">
        <Group justify="space-between" align="center" wrap="nowrap">
          <Title order={3} c="primary.6">
            {data.title}
          </Title>

          <Box
            style={{
              display: 'grid',
              placeItems: 'center',
              width: 28,
              height: 28,
              borderRadius: '999px',
              backgroundColor: theme.colors.tertiary[6],
              color: theme.white,
            }}
          >
            <IconStarFilled size={14} />
          </Box>
        </Group>

        <Stack align="center" gap="lg">
          <RingProgress
            size={196}
            thickness={12}
            roundCaps
            rootColor="gray.2"
            sections={[
              {
                value: data.completionPercent,
                color: 'primary',
              },
            ]}
            label={(
              <Stack align="center" gap={2}>
                <Text fw={900} size="2rem" c="primary.6">
                  {formatArabicPercent(data.completionPercent)}
                </Text>
                <Text size="xs" c="gray.8">
                  {data.completionLabel}
                </Text>
              </Stack>
            )}
          />

          <Text c="gray.8" ta="center" maw={280}>
            {data.summary}
          </Text>

          <Group gap="sm" justify="center">
            {Array.from({ length: data.totalDots }).map((_, index) => {
              const isComplete = index < data.completedDots

              return (
                <Box
                  key={`progress-dot-${index + 1}`}
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: '999px',
                    backgroundColor: isComplete
                      ? theme.colors.primary[6]
                      : theme.colors.gray[2],
                  }}
                />
              )
            })}
          </Group>
        </Stack>
      </Stack>
    </Paper>
  )
}
