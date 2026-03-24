import {
  Accordion,
  ActionIcon,
  Alert,
  Anchor,
  Avatar,
  Badge,
  Blockquote,
  Button,
  Card,
  Checkbox,
  Chip,
  Code,
  Divider,
  Group,
  Notification,
  Pagination,
  Paper,
  PasswordInput,
  Progress,
  Radio,
  RingProgress,
  SegmentedControl,
  Select,
  SimpleGrid,
  Slider,
  Stack,
  Switch,
  Table,
  Tabs,
  Text,
  TextInput,
  Textarea,
  ThemeIcon,
  Title,
} from '@mantine/core'
import { themeTokens } from '../theme'
import type { Meta, StoryObj } from '@storybook/react-vite'

function MantineShowcase() {
  const lessonRows = [
    { surah: 'Al-Fatihah', ayat: '7 ayat', progress: 'Complete' },
    { surah: 'Al-Baqarah', ayat: '286 ayat', progress: 'In progress' },
    { surah: 'Yasin', ayat: '83 ayat', progress: 'Planned' },
  ]

  return (
    <div
      style={{
        backgroundColor: themeTokens.semanticColors.background,
        color: themeTokens.semanticColors.onSurface,
        minHeight: '100vh',
        padding: '2rem',
      }}
    >
      <Stack gap="xl" maw={1200} mx="auto">
        <Paper
          p="xl"
          radius="xl"
          style={{
            backgroundColor: themeTokens.semanticColors.surfaceContainerLow,
          }}
        >
          <Stack gap="lg">
            <Group justify="space-between" align="flex-start">
              <div>
                <Badge variant="light" color="primary" mb="sm">
                  Theme Overview
                </Badge>
                <Title order={1}>Mantine design-system showcase</Title>
                <Text c="dimmed" maw={720} mt="xs">
                  A single story with common components rendered together so
                  you can judge the palette, typography, spacing, surfaces, and
                  interaction states in one place.
                </Text>
              </div>

              <Group gap="sm">
                <Badge variant="dot" color="primary">
                  Primary
                </Badge>
                <Badge variant="dot" color="secondary">
                  Secondary
                </Badge>
                <Badge variant="dot" color="tertiary">
                  Tertiary
                </Badge>
              </Group>
            </Group>

            <Group gap="sm">
              <Button variant="gradient">Start lesson</Button>
              <Button variant="default">Continue reading</Button>
              <Button variant="light" color="secondary">
                Review notes
              </Button>
              <Button variant="outline" color="tertiary">
                Bookmark ayah
              </Button>
              <ActionIcon variant="filled" color="primary" size="lg">
                +
              </ActionIcon>
            </Group>
          </Stack>
        </Paper>

        <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="lg">
          <Card
            p="xl"
            style={{
              backgroundColor:
                themeTokens.semanticColors.surfaceContainerLowest,
            }}
          >
            <Stack gap="md">
              <Title order={3}>Inputs</Title>
              <TextInput
                label="Lesson title"
                description="Primary text input appearance"
                placeholder="Memorize the first ten ayat"
                defaultValue="Morning revision"
              />
              <PasswordInput
                label="Private note"
                placeholder="Enter a secure study note"
                defaultValue="light-and-clarity"
              />
              <Select
                label="Teacher"
                placeholder="Pick one"
                defaultValue="ustadhah-amal"
                data={[
                  { label: 'Ustadhah Amal', value: 'ustadhah-amal' },
                  { label: 'Ustadh Yusuf', value: 'ustadh-yusuf' },
                  { label: 'Shaykh Ibrahim', value: 'shaykh-ibrahim' },
                ]}
              />
              <Textarea
                label="Reflection"
                minRows={4}
                placeholder="Write your notes about today's reading"
                defaultValue="The tone feels calm, spacious, and focused."
              />
            </Stack>
          </Card>

          <Card
            p="xl"
            style={{
              backgroundColor:
                themeTokens.semanticColors.surfaceContainerLowest,
            }}
          >
            <Stack gap="md">
              <Title order={3}>Selection controls</Title>
              <SegmentedControl
                fullWidth
                data={[
                  { label: 'Read', value: 'read' },
                  { label: 'Memorize', value: 'memorize' },
                  { label: 'Review', value: 'review' },
                ]}
                defaultValue="memorize"
              />
              <Radio.Group
                label="Recitation mode"
                defaultValue="teacher"
                name="recitation-mode"
              >
                <Group mt="xs">
                  <Radio value="solo" label="Solo" />
                  <Radio value="teacher" label="With teacher" />
                  <Radio value="group" label="Group" />
                </Group>
              </Radio.Group>
              <Checkbox.Group
                label="Daily checklist"
                defaultValue={['wird', 'tafseer']}
              >
                <Stack gap="xs" mt="xs">
                  <Checkbox value="wird" label="Finish wird" />
                  <Checkbox value="tafseer" label="Read tafseer notes" />
                  <Checkbox value="audio" label="Listen to recitation" />
                </Stack>
              </Checkbox.Group>
              <Group justify="space-between">
                <Switch label="Prayer reminders" defaultChecked />
                <Switch label="Compact layout" />
              </Group>
              <Chip.Group multiple defaultValue={['arabic', 'translation']}>
                <Group gap="xs">
                  <Chip value="arabic">Arabic</Chip>
                  <Chip value="translation">Translation</Chip>
                  <Chip value="tafsir">Tafsir</Chip>
                </Group>
              </Chip.Group>
              <div>
                <Text size="sm" fw={500} mb="xs">
                  Session focus
                </Text>
                <Slider
                  color="primary"
                  defaultValue={65}
                  label={(value) => `${value}%`}
                />
              </div>
            </Stack>
          </Card>
        </SimpleGrid>

        <SimpleGrid cols={{ base: 1, lg: 3 }} spacing="lg">
          <Card
            p="xl"
            style={{
              backgroundColor:
                themeTokens.semanticColors.surfaceContainerLowest,
            }}
          >
            <Stack gap="md">
              <Title order={3}>Feedback</Title>
              <Alert color="primary" title="Lesson unlocked">
                You completed the previous module and the next study path is
                now available.
              </Alert>
              <Notification color="tertiary" title="Gentle reminder">
                Review your memorized verses before Maghrib.
              </Notification>
              <Blockquote color="primary" cite="Surah Al-Alaq">
                Read in the name of your Lord who created.
              </Blockquote>
            </Stack>
          </Card>

          <Card
            p="xl"
            style={{
              backgroundColor:
                themeTokens.semanticColors.surfaceContainerLowest,
            }}
          >
            <Stack gap="md">
              <Title order={3}>Indicators</Title>
              <Group>
                <ThemeIcon color="primary" radius="xl" size="lg">
                  نور
                </ThemeIcon>
                <Badge color="primary">Ready</Badge>
                <Badge color="secondary" variant="light">
                  Reviewing
                </Badge>
                <Badge color="tertiary" variant="outline">
                  Needs focus
                </Badge>
              </Group>
              <Progress value={72} color="primary" size="lg" radius="xl" />
              <RingProgress
                size={132}
                thickness={12}
                sections={[
                  { value: 72, color: 'primary' },
                  { value: 18, color: 'secondary' },
                  { value: 10, color: 'tertiary' },
                ]}
                label={
                  <Text ta="center" fw={700} size="lg">
                    72%
                  </Text>
                }
              />
              <Pagination total={7} value={3} />
            </Stack>
          </Card>

          <Card
            p="xl"
            style={{
              backgroundColor:
                themeTokens.semanticColors.surfaceContainerLowest,
            }}
          >
            <Stack gap="md">
              <Title order={3}>Identity</Title>
              <Group>
                <Avatar color="primary" radius="xl">
                  ZA
                </Avatar>
                <div>
                  <Text fw={600}>Zied A.</Text>
                  <Text size="sm" c="dimmed">
                    Memorization cohort
                  </Text>
                </div>
              </Group>
              <Divider />
              <Text size="sm">
                Current token pair:{' '}
                <Code>{themeTokens.semanticColors.background}</Code> on{' '}
                <Code>{themeTokens.semanticColors.onSurface}</Code>
              </Text>
              <Anchor href="https://mantine.dev" target="_blank">
                Mantine documentation
              </Anchor>
            </Stack>
          </Card>
        </SimpleGrid>

        <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="lg">
          <Card
            p="xl"
            style={{
              backgroundColor:
                themeTokens.semanticColors.surfaceContainerLowest,
            }}
          >
            <Stack gap="md">
              <Title order={3}>Navigation patterns</Title>
              <Tabs defaultValue="overview">
                <Tabs.List>
                  <Tabs.Tab value="overview">Overview</Tabs.Tab>
                  <Tabs.Tab value="schedule">Schedule</Tabs.Tab>
                  <Tabs.Tab value="progress">Progress</Tabs.Tab>
                </Tabs.List>
                <Tabs.Panel value="overview" pt="md">
                  <Text size="sm" c="dimmed">
                    Use this area to judge active tab color, type scale, and
                    spacing between navigation and content.
                  </Text>
                </Tabs.Panel>
                <Tabs.Panel value="schedule" pt="md">
                  <Text size="sm" c="dimmed">
                    Prayer times, lesson blocks, and revision reminders would
                    live here.
                  </Text>
                </Tabs.Panel>
                <Tabs.Panel value="progress" pt="md">
                  <Text size="sm" c="dimmed">
                    Visual progress components should feel calm rather than
                    dashboard-heavy.
                  </Text>
                </Tabs.Panel>
              </Tabs>

              <Accordion defaultValue="panel-1" variant="separated" radius="lg">
                <Accordion.Item value="panel-1">
                  <Accordion.Control>How do surfaces separate?</Accordion.Control>
                  <Accordion.Panel>
                    Via tonal layering and background shifts, not hard divider
                    lines.
                  </Accordion.Panel>
                </Accordion.Item>
                <Accordion.Item value="panel-2">
                  <Accordion.Control>What should stand out?</Accordion.Control>
                  <Accordion.Panel>
                    Titles, active calls to action, sacred text snippets, and
                    progress markers.
                  </Accordion.Panel>
                </Accordion.Item>
              </Accordion>
            </Stack>
          </Card>

          <Card
            p="xl"
            style={{
              backgroundColor:
                themeTokens.semanticColors.surfaceContainerLowest,
            }}
          >
            <Stack gap="md">
              <Title order={3}>Data display</Title>
              <Table highlightOnHover withTableBorder={false}>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Surah</Table.Th>
                    <Table.Th>Length</Table.Th>
                    <Table.Th>Status</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {lessonRows.map((row) => (
                    <Table.Tr key={row.surah}>
                      <Table.Td>{row.surah}</Table.Td>
                      <Table.Td>{row.ayat}</Table.Td>
                      <Table.Td>{row.progress}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
              <Text size="sm" c="dimmed">
                Tables are included here mainly to inspect typography, hover
                treatment, and spacing density.
              </Text>
            </Stack>
          </Card>
        </SimpleGrid>
      </Stack>
    </div>
  )
}

const meta = {
  title: 'Mantine/Theme Showcase',
  component: MantineShowcase,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof MantineShowcase>

export default meta

type Story = StoryObj<typeof meta>

export const Overview: Story = {}
