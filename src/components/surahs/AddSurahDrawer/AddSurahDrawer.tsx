import {
  Button,
  Card,
  Chip,
  Drawer,
  Group,
  Stack,
  Text,
  TextInput,
  UnstyledButton,
} from '@mantine/core'
import { IconSearch } from '@tabler/icons-react'
import { useMemo, useState } from 'react'
import type { SurahGrade } from '~/data/grades'
import type { Surah } from '~/data/surahs'
import { formatArabicNumber } from '~/components/home/home-formatters'
import { GRADE_COLORS, GRADE_LABELS, GRADE_ORDER } from '~/data/grades'
import { SURAHS } from '~/data/surahs'

export interface AddSurahDrawerProps {
  opened: boolean
  onClose: () => void
  excludeSurahNumbers: ReadonlyArray<number>
  onSubmit: (input: { surahNumber: number; grade: SurahGrade }) => void
}

export function AddSurahDrawer({
  opened,
  onClose,
  excludeSurahNumbers,
  onSubmit,
}: AddSurahDrawerProps) {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Surah | null>(null)
  const [grade, setGrade] = useState<SurahGrade>('good')

  const excludeSet = useMemo(
    () => new Set(excludeSurahNumbers),
    [excludeSurahNumbers],
  )

  const candidates = useMemo(() => {
    const term = search.trim().toLowerCase()
    return SURAHS.filter((s) => !excludeSet.has(s.number)).filter((s) => {
      if (!term) return true
      return (
        s.nameAr.includes(term) ||
        s.nameEn.toLowerCase().includes(term) ||
        String(s.number) === term
      )
    })
  }, [search, excludeSet])

  function handleClose() {
    setSearch('')
    setSelected(null)
    setGrade('good')
    onClose()
  }

  function handleSubmit() {
    if (!selected) return
    onSubmit({ surahNumber: selected.number, grade })
    handleClose()
  }

  return (
    <Drawer
      opened={opened}
      onClose={handleClose}
      position="bottom"
      size="80%"
      title="إضافة سورة"
      padding="lg"
    >
      <Stack gap="md">
        {!selected ? (
          <>
            <TextInput
              placeholder="ابحث باسم السورة أو رقمها"
              leftSection={<IconSearch size={16} />}
              value={search}
              onChange={(e) => setSearch(e.currentTarget.value)}
            />

            <Stack gap="xs" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              {candidates.length === 0 ? (
                <Text c="dimmed" ta="center" py="lg">
                  لا توجد نتائج.
                </Text>
              ) : (
                candidates.map((s) => (
                  <UnstyledButton key={s.number} onClick={() => setSelected(s)} w="100%">
                    <Card
                      withBorder
                      radius="md"
                      p="sm"
                      styles={(theme) => ({
                        root: {
                          transition: 'border-color 120ms ease, background-color 120ms ease',
                          '&:hover': {
                            borderColor: theme.colors.primary[4],
                            backgroundColor: theme.colors.primary[0],
                          },
                        },
                      })}
                    >
                      <Group justify="space-between">
                        <Text fw={600}>{s.nameAr}</Text>
                        <Text c="dimmed" size="sm">
                          {`${formatArabicNumber(s.number)} • ${s.nameEn}`}
                        </Text>
                      </Group>
                    </Card>
                  </UnstyledButton>
                ))
              )}
            </Stack>
          </>
        ) : (
          <Stack gap="md">
            <Stack gap={2}>
              <Text c="dimmed" size="sm">
                السورة المختارة
              </Text>
              <Text fw={700} size="lg">
                {selected.nameAr}
              </Text>
            </Stack>

            <Stack gap="xs">
              <Text c="dimmed" size="sm">
                اختر التقييم
              </Text>
              <Chip.Group
                multiple={false}
                value={grade}
                onChange={(value) => {
                  if (!value) return
                  if (
                    value === 'good' ||
                    value === 'medium' ||
                    value === 'forgotten'
                  ) {
                    setGrade(value)
                  }
                }}
              >
                <Group gap="xs">
                  {GRADE_ORDER.map((g) => (
                    <Chip key={g} value={g} color={GRADE_COLORS[g]} variant="light">
                      {GRADE_LABELS[g]}
                    </Chip>
                  ))}
                </Group>
              </Chip.Group>
            </Stack>

            <Group justify="space-between">
              <Button variant="subtle" onClick={() => setSelected(null)}>
                اختيار سورة أخرى
              </Button>
              <Button onClick={handleSubmit}>حفظ</Button>
            </Group>
          </Stack>
        )}
      </Stack>
    </Drawer>
  )
}
