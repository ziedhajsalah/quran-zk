import { Link, createFileRoute } from '@tanstack/react-router'
import {
  Alert,
  Anchor,
  Badge,
  Button,
  Card,
  Container,
  Group,
  Paper,
  Stack,
  Text,
  Title,
} from '@mantine/core'
import { useAction } from 'convex/react'
import * as React from 'react'
import { useSuspenseQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from '../../convex/_generated/api'

export const Route = createFileRoute('/anotherPage')({
  component: AnotherPage,
})

function AnotherPage() {
  const callMyAction = useAction(api.myFunctions.myAction)
  const [pending, setPending] = React.useState(false)
  const [status, setStatus] = React.useState<'idle' | 'success' | 'error'>(
    'idle',
  )

  const { data } = useSuspenseQuery(
    convexQuery(api.myFunctions.listNumbers, { count: 10 }),
  )

  async function handleCallAction() {
    setPending(true)
    setStatus('idle')

    try {
      await callMyAction({
        first: Math.round(Math.random() * 100),
      })
      setStatus('success')
    } catch {
      setStatus('error')
    } finally {
      setPending(false)
    }
  }

  return (
    <Container size="sm" py="xl">
      <Stack gap="lg">
        <Group justify="space-between" align="center">
          <div>
            <Badge variant="light" color="violet" mb="sm">
              Action demo
            </Badge>
            <Title order={1}>Trigger a Convex action</Title>
          </div>
          <Badge variant="dot" color={pending ? 'orange' : 'teal'}>
            {pending ? 'Running' : 'Ready'}
          </Badge>
        </Group>

        <Card withBorder radius="xl" padding="xl" shadow="sm">
          <Stack gap="md">
            <Text c="dimmed">
              This route uses a Convex action instead of a direct mutation.
              Press the button to enqueue a random value and watch the shared
              numbers list update.
            </Text>

            <Paper withBorder radius="lg" p="md">
              <Text ff="monospace" size="sm">
                {data.numbers.length > 0
                  ? data.numbers.join(', ')
                  : 'No numbers stored yet.'}
              </Text>
            </Paper>

            <Group gap="sm">
              <Button loading={pending} onClick={handleCallAction}>
                Call action to add a random number
              </Button>
              <Anchor component={Link} to="/">
                Back to home
              </Anchor>
            </Group>

            {status === 'success' ? (
              <Alert color="teal" radius="lg" title="Action completed">
                The action finished successfully and the list should refresh
                automatically.
              </Alert>
            ) : null}

            {status === 'error' ? (
              <Alert color="red" radius="lg" title="Action failed">
                The request did not complete. Check the browser console or
                Convex logs for more detail.
              </Alert>
            ) : null}
          </Stack>
        </Card>
      </Stack>
    </Container>
  )
}
