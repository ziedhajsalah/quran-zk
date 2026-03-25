import { Link, createFileRoute } from '@tanstack/react-router'
import {
  Anchor,
  Badge,
  Button,
  Card,
  Code,
  Container,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from '@mantine/core'
import { useMutation } from 'convex/react'
import { useSuspenseQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from '../../convex/_generated/api'
import { requireProtectedAppUser } from '~/lib/auth'

export const Route = createFileRoute('/')({
  beforeLoad: async ({ location }) => {
    await requireProtectedAppUser(location.href)
  },
  component: Home,
})

function Home() {
  const { data: currentUser } = useSuspenseQuery(convexQuery(api.auth.users.current, {}))
  const {
    data: { viewer, numbers },
  } = useSuspenseQuery(convexQuery(api.myFunctions.listNumbers, { count: 10 }))

  const addNumber = useMutation(api.myFunctions.addNumber)
  const hasNumbers = numbers.length > 0

  return (
    <Container size="lg" py="xl">
      <Stack gap="xl">
        <Paper withBorder radius="xl" p={{ base: 'lg', sm: 'xl' }} shadow="sm">
          <Stack gap="lg">
            <Group justify="space-between" align="flex-start" gap="md">
              <Stack gap="xs">
                <Badge variant="light" size="lg" radius="sm">
                  Live Convex starter
                </Badge>
                <Title order={1}>Convex + Mantine + TanStack Start</Title>
                <Text c="dimmed" maw={640}>
                  This page now uses Mantine primitives for layout, actions, and
                  status. The numbers below still come from Convex and update in
                  real time across tabs.
                </Text>
              </Stack>
              <Badge color={hasNumbers ? 'teal' : 'gray'} variant="dot">
                {numbers.length} stored values
              </Badge>
            </Group>

            <Group gap="sm">
              <Badge size="lg" variant="default">
                المستخدم: {viewer}
              </Badge>
              <Badge size="lg" variant="light" color={currentUser.isAdmin ? 'primary' : 'secondary'}>
                الأدوار: {currentUser.roles.join('، ')}
              </Badge>
            </Group>

            <Group gap="sm">
              <Button
                onClick={() => {
                  void addNumber({ value: Math.floor(Math.random() * 10) })
                }}
              >
                Add a random number
              </Button>
              <Button
                component={Link}
                to="/anotherPage"
                variant="default"
              >
                Open action page
              </Button>
            </Group>
          </Stack>
        </Paper>

        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
          <Card withBorder radius="xl" padding="lg" shadow="sm">
            <Stack gap="md">
              <Group justify="space-between" align="center">
                <Title order={3}>Realtime numbers</Title>
                <Badge color={hasNumbers ? 'teal' : 'orange'} variant="light">
                  {hasNumbers ? 'Synced' : 'Empty'}
                </Badge>
              </Group>
              <Text c="dimmed">
                Open this page in another window and add values from either tab
                to see the list stay in sync.
              </Text>
              <Paper withBorder radius="lg" p="md">
                <Text ff="monospace" size="sm">
                  {hasNumbers ? numbers.join(', ') : 'Click the button to seed the list.'}
                </Text>
              </Paper>
            </Stack>
          </Card>

          <Card withBorder radius="xl" padding="lg" shadow="sm">
            <Stack gap="md">
              <Title order={3}>Files to edit</Title>
              <Text c="dimmed">
                The demo is still driven by the same route and Convex function,
                just with Mantine components instead of plain HTML.
              </Text>
              <Group gap="xs">
                <Code>src/routes/index.tsx</Code>
                <Code>convex/myFunctions.ts</Code>
              </Group>
              <Text size="sm">
                Want to test an action instead of a mutation? Continue to the
                action page.
              </Text>
              <Anchor component={Link} to="/anotherPage">
                Go to another page
              </Anchor>
            </Stack>
          </Card>
        </SimpleGrid>

        <Stack gap="md">
          <Title order={2}>Useful resources</Title>
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <ResourceCard
              title="Convex docs"
              description="Read comprehensive documentation for queries, mutations, actions, and realtime data."
              href="https://docs.convex.dev/home"
            />
            <ResourceCard
              title="TypeScript handbook"
              description="Use the TypeScript handbook when you need a quick reference for types, narrowing, and utility patterns."
              href="https://www.typescriptlang.org/docs/handbook/2/basic-types.html"
            />
            <ResourceCard
              title="Templates"
              description="Browse prebuilt Convex templates when you want to move past the starter and into a fuller app structure."
              href="https://www.convex.dev/templates"
            />
            <ResourceCard
              title="Discord"
              description="Join the community for implementation questions, architecture tradeoffs, and product updates."
              href="https://www.convex.dev/community"
            />
          </SimpleGrid>
        </Stack>
      </Stack>
    </Container>
  )
}

function ResourceCard({
  title,
  description,
  href,
}: {
  title: string
  description: string
  href: string
}) {
  return (
    <Card withBorder radius="xl" padding="lg" h="100%">
      <Stack gap="sm" h="100%" justify="space-between">
        <div>
          <Text fw={600}>{title}</Text>
          <Text size="sm" c="dimmed" mt="xs">
            {description}
          </Text>
        </div>
        <Anchor href={href} target="_blank" rel="noreferrer">
          Open resource
        </Anchor>
      </Stack>
    </Card>
  )
}
