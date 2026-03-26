import { Box, Container, Grid, Stack, useMantineTheme } from '@mantine/core'
import { BottomNav } from '../BottomNav'
import { CoursesSection } from '../CoursesSection'
import { DailyProgressCard } from '../DailyProgressCard'
import { FloatingActionButton } from '../FloatingActionButton'
import { HomeHero } from '../HomeHero'
import { HomeTopBar } from '../HomeTopBar'
import { RecentLessonsSection } from '../RecentLessonsSection'
import { TipCard } from '../TipCard'
import type { HomeDashboardData } from '../home-dashboard.types'

interface HomeDashboardProps {
  data: HomeDashboardData
  overlayNavigation?: boolean
}

export function HomeDashboard({
  data,
  overlayNavigation = true,
}: HomeDashboardProps) {
  const theme = useMantineTheme()

  return (
    <Box
      style={{
        backgroundColor: theme.other.semanticColors.background,
        minHeight: '100vh',
      }}
    >
      <HomeTopBar
        brandMarkText={data.brandMarkText}
        brandName={data.brandName}
        notificationLabel={data.notificationLabel}
      />

      <Container
        size="xl"
        px={{ base: 'lg', sm: 'xl' }}
        py={{ base: 'lg', sm: 'xl' }}
        style={{
          paddingBottom: overlayNavigation ? '10rem' : undefined,
        }}
      >
        <Stack gap="xl">
          <HomeHero
            eyebrow={data.heroEyebrow}
            greeting={data.heroGreeting}
            quote={data.heroQuote}
            studentName={data.studentName}
          />

          <Grid gutter={{ base: 'xl', md: 'lg' }}>
            <Grid.Col span={{ base: 12, md: 4 }}>
              <Stack gap="lg">
                <DailyProgressCard data={data.dailyProgress} />
                <TipCard body={data.tip.body} title={data.tip.title} />
              </Stack>
            </Grid.Col>

            <Grid.Col span={{ base: 12, md: 8 }}>
              <Stack gap="xl">
                <RecentLessonsSection
                  actionLabel={data.recentLessonsActionLabel}
                  lessons={data.recentLessons}
                  title={data.recentLessonsTitle}
                />
                <CoursesSection courses={data.courses} title={data.coursesTitle} />
              </Stack>
            </Grid.Col>
          </Grid>

          {!overlayNavigation ? (
            <Stack gap="md">
              <FloatingActionButton fixed={false} label={data.floatingActionLabel} />
              <BottomNav
                activeItemId={data.activeBottomNavId}
                fixed={false}
                items={data.bottomNavItems}
              />
            </Stack>
          ) : null}
        </Stack>
      </Container>

      {overlayNavigation ? (
        <>
          <BottomNav activeItemId={data.activeBottomNavId} items={data.bottomNavItems} />
          <FloatingActionButton label={data.floatingActionLabel} />
        </>
      ) : null}
    </Box>
  )
}
