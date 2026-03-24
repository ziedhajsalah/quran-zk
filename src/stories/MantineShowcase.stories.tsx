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
import {
  IconAlertCircle,
  IconBook2,
  IconBookmark,
  IconCheck,
  IconPlayerPlay,
} from '@tabler/icons-react'
import { themeTokens } from '../theme'
import type { Meta, StoryObj } from '@storybook/react-vite'

function MantineShowcase() {
  const lessonRows = [
    { surah: 'الفاتحة', ayat: '٧ آيات', progress: 'مكتمل' },
    { surah: 'البقرة', ayat: '٢٨٦ آية', progress: 'قيد التنفيذ' },
    { surah: 'يس', ayat: '٨٣ آية', progress: 'مخطط له' },
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
                  نظرة على السمة
                </Badge>
                <Title order={1}>معرض نظام التصميم</Title>
                <Text c="dimmed" maw={720} mt="xs">
                  قصة واحدة تعرض المكونات الشائعة معًا حتى تتمكن من تقييم
                  الألوان والطباعة والمسافات والأسطح وحالات التفاعل في مكان
                  واحد.
                </Text>
              </div>

              <Group gap="sm">
                <Badge variant="dot" color="primary">
                  أساسي
                </Badge>
                <Badge variant="dot" color="secondary">
                  ثانوي
                </Badge>
                <Badge variant="dot" color="tertiary">
                  ثالثي
                </Badge>
              </Group>
            </Group>

            <Group gap="sm">
              <Button variant="gradient" leftSection={<IconPlayerPlay size={18} />}>
                ابدأ الدرس
              </Button>
              <Button variant="default" leftSection={<IconBook2 size={18} />}>
                تابع القراءة
              </Button>
              <Button variant="light" color="secondary">
                راجع الملاحظات
              </Button>
              <Button
                variant="outline"
                color="tertiary"
                leftSection={<IconBookmark size={18} />}
              >
                احفظ الآية
              </Button>
              <ActionIcon variant="filled" color="primary" size="lg">
                <IconBookmark size={18} />
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
              <Title order={3}>الحقول</Title>
              <TextInput
                label="عنوان الدرس"
                description="مظهر حقل الإدخال الأساسي"
                placeholder="احفظ أول عشر آيات"
                defaultValue="مراجعة الصباح"
              />
              <PasswordInput
                label="ملاحظة خاصة"
                placeholder="أدخل ملاحظة دراسية خاصة"
                defaultValue="نور وطمأنينة"
              />
              <Select
                label="المعلّم"
                placeholder="اختر واحدًا"
                defaultValue="ustadhah-amal"
                data={[
                  { label: 'الأستاذة أمل', value: 'ustadhah-amal' },
                  { label: 'الأستاذ يوسف', value: 'ustadh-yusuf' },
                  { label: 'الشيخ إبراهيم', value: 'shaykh-ibrahim' },
                ]}
              />
              <Textarea
                label="تأمل"
                minRows={4}
                placeholder="اكتب ملاحظاتك حول قراءة اليوم"
                defaultValue="الطابع العام هادئ وواسع ومركّز."
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
              <Title order={3}>عناصر الاختيار</Title>
              <SegmentedControl
                fullWidth
                data={[
                  { label: 'قراءة', value: 'read' },
                  { label: 'حفظ', value: 'memorize' },
                  { label: 'مراجعة', value: 'review' },
                ]}
                defaultValue="memorize"
              />
              <Radio.Group
                label="نمط التلاوة"
                defaultValue="teacher"
                name="recitation-mode"
              >
                <Group mt="xs">
                  <Radio value="solo" label="فردي" />
                  <Radio value="teacher" label="مع المعلّم" />
                  <Radio value="group" label="جماعي" />
                </Group>
              </Radio.Group>
              <Checkbox.Group
                label="قائمة اليوم"
                defaultValue={['wird', 'tafseer']}
              >
                <Stack gap="xs" mt="xs">
                  <Checkbox value="wird" label="إتمام الورد" />
                  <Checkbox value="tafseer" label="قراءة ملاحظات التفسير" />
                  <Checkbox value="audio" label="الاستماع إلى التلاوة" />
                </Stack>
              </Checkbox.Group>
              <Group justify="space-between">
                <Switch label="تذكيرات الصلاة" defaultChecked />
                <Switch label="تخطيط مضغوط" />
              </Group>
              <Chip.Group multiple defaultValue={['arabic', 'translation']}>
                <Group gap="xs">
                  <Chip value="arabic">العربية</Chip>
                  <Chip value="translation">الترجمة</Chip>
                  <Chip value="tafsir">التفسير</Chip>
                </Group>
              </Chip.Group>
              <div>
                <Text size="sm" fw={500} mb="xs">
                  تركيز الجلسة
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
              <Title order={3}>التنبيهات</Title>
              <Alert
                color="primary"
                title="تم فتح الدرس"
                icon={<IconCheck size={18} />}
              >
                أكملت الوحدة السابقة وأصبح مسار الدراسة التالي متاحًا الآن.
              </Alert>
              <Notification
                color="tertiary"
                title="تذكير لطيف"
                icon={<IconAlertCircle size={18} />}
              >
                راجع الآيات المحفوظة قبل المغرب.
              </Notification>
              <Blockquote color="primary" cite="سورة العلق">
                اقرأ باسم ربك الذي خلق.
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
              <Title order={3}>المؤشرات</Title>
              <Group>
                <ThemeIcon color="primary" radius="xl" size="lg">
                  <IconBook2 size={18} />
                </ThemeIcon>
                <Badge color="primary">جاهز</Badge>
                <Badge color="secondary" variant="light">
                  قيد المراجعة
                </Badge>
                <Badge color="tertiary" variant="outline">
                  يحتاج تركيزًا
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
              <Title order={3}>الهوية</Title>
              <Group>
                <Avatar color="primary" radius="xl">
                  زأ
                </Avatar>
                <div>
                  <Text fw={600}>زيد أ.</Text>
                  <Text size="sm" c="dimmed">
                    مجموعة الحفظ
                  </Text>
                </div>
              </Group>
              <Divider />
              <Text size="sm">
                زوج الرموز الحالي:{' '}
                <Code>{themeTokens.semanticColors.background}</Code> على{' '}
                <Code>{themeTokens.semanticColors.onSurface}</Code>
              </Text>
              <Anchor href="https://mantine.dev" target="_blank">
                وثائق Mantine
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
              <Title order={3}>أنماط التنقل</Title>
              <Tabs defaultValue="overview">
                <Tabs.List>
                  <Tabs.Tab value="overview">نظرة عامة</Tabs.Tab>
                  <Tabs.Tab value="schedule">الجدول</Tabs.Tab>
                  <Tabs.Tab value="progress">التقدم</Tabs.Tab>
                </Tabs.List>
                <Tabs.Panel value="overview" pt="md">
                  <Text size="sm" c="dimmed">
                    استخدم هذه المنطقة لتقييم لون التبويب النشط ومقياس الخط
                    والمسافات بين التنقل والمحتوى.
                  </Text>
                </Tabs.Panel>
                <Tabs.Panel value="schedule" pt="md">
                  <Text size="sm" c="dimmed">
                    هنا يمكن عرض أوقات الصلاة وكتل الدروس وتذكيرات المراجعة.
                  </Text>
                </Tabs.Panel>
                <Tabs.Panel value="progress" pt="md">
                  <Text size="sm" c="dimmed">
                    يجب أن تبدو مؤشرات التقدم هادئة لا مزدحمة مثل لوحات التحكم.
                  </Text>
                </Tabs.Panel>
              </Tabs>

              <Accordion defaultValue="panel-1" variant="separated" radius="lg">
                <Accordion.Item value="panel-1">
                  <Accordion.Control>كيف تنفصل الأسطح؟</Accordion.Control>
                  <Accordion.Panel>
                    عبر التدرج اللوني وتغيّر الخلفيات، لا عبر خطوط فاصلة حادة.
                  </Accordion.Panel>
                </Accordion.Item>
                <Accordion.Item value="panel-2">
                  <Accordion.Control>ما الذي يجب أن يبرز؟</Accordion.Control>
                  <Accordion.Panel>
                    العناوين والدعوات إلى الإجراء والمقتطفات النصية المقدسة
                    ومؤشرات التقدم.
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
              <Title order={3}>عرض البيانات</Title>
              <Table highlightOnHover withTableBorder={false}>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>السورة</Table.Th>
                    <Table.Th>الطول</Table.Th>
                    <Table.Th>الحالة</Table.Th>
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
                أُدرجت الجداول هنا أساسًا لتقييم الطباعة ومعالجة التحويم وكثافة
                المسافات.
              </Text>
            </Stack>
          </Card>
        </SimpleGrid>
      </Stack>
    </div>
  )
}

const meta = {
  title: 'Mantine/معرض السمة',
  component: MantineShowcase,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof MantineShowcase>

export default meta

type Story = StoryObj<typeof meta>

export const Overview: Story = {
  name: 'نظرة عامة',
}
