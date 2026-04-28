import {
  Button,
  Card,
  Drawer,
  Group,
  Stack,
  Text,
  TextInput,
  UnstyledButton,
} from '@mantine/core'
import { DatePickerInput } from '@mantine/dates'
import { IconSearch } from '@tabler/icons-react'
import { useMemo, useState } from 'react'
import type { Surah } from '~/data/surahs'
import { formatArabicNumber } from '~/components/home/home-formatters'
import { SURAHS } from '~/data/surahs'

export interface AssignReviewDrawerProps {
  opened: boolean
  onClose: () => void
  memorizedSurahNumbers: ReadonlyArray<number>
  excludeSurahNumbers: ReadonlyArray<number>
  onSubmit: (input: { surahNumber: number; dueAt?: number }) => void
}

export function AssignReviewDrawer({
  opened,
  onClose,
  memorizedSurahNumbers,
  excludeSurahNumbers,
  onSubmit,
}: AssignReviewDrawerProps) {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Surah | null>(null)
  const [dueDate, setDueDate] = useState<Date | null>(null)

  const memorizedSet = useMemo(
    () => new Set(memorizedSurahNumbers),
    [memorizedSurahNumbers],
  )
  const excludeSet = useMemo(
    () => new Set(excludeSurahNumbers),
    [excludeSurahNumbers],
  )

  const candidates = useMemo(() => {
    const term = search.trim().toLowerCase()
    return SURAHS.filter(
      (s) => memorizedSet.has(s.number) && !excludeSet.has(s.number),
    ).filter((s) => {
      if (!term) return true
      return (
        s.nameAr.includes(term) ||
        s.nameEn.toLowerCase().includes(term) ||
        String(s.number) === term
      )
    })
  }, [search, memorizedSet, excludeSet])

  function handleClose() {
    setSearch('')
    setSelected(null)
    setDueDate(null)
    onClose()
  }

  function handleSubmit() {
    if (!selected) return
    const dueAt = dueDate !== null ? toUtcMidnightMs(dueDate) : undefined
    onSubmit({ surahNumber: selected.number, dueAt })
    handleClose()
  }

  return (
    <Drawer
      opened={opened}
      onClose={handleClose}
      position="bottom"
      size="80%"
      title="إسناد مراجعة"
      padding="lg"
    >
      <Stack gap="md">
        {!selected ? (
          <>
            <TextInput
              placeholder="ابحث في السور المحفوظة"
              leftSection={<IconSearch size={16} />}
              value={search}
              onChange={(e) => setSearch(e.currentTarget.value)}
            />

            <Stack gap="xs" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              {candidates.length === 0 ? (
                <Text c="dimmed" ta="center" py="lg">
                  لا توجد سور متاحة للإسناد.
                </Text>
              ) : (
                candidates.map((s) => (
                  <UnstyledButton
                    key={s.number}
                    onClick={() => setSelected(s)}
                    w="100%"
                  >
                    <Card
                      withBorder
                      radius="md"
                      p="sm"
                      styles={(theme) => ({
                        root: {
                          transition:
                            'border-color 120ms ease, background-color 120ms ease',
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

            <DatePickerInput
              label="تاريخ الاستحقاق (اختياري)"
              placeholder="اختر تاريخًا"
              value={dueDate}
              onChange={(value) => {
                setDueDate(value ? new Date(value) : null)
              }}
              minDate={new Date()}
              clearable
            />

            <Group justify="space-between">
              <Button variant="subtle" onClick={() => setSelected(null)}>
                اختيار سورة أخرى
              </Button>
              <Button onClick={handleSubmit}>إسناد</Button>
            </Group>
          </Stack>
        )}
      </Stack>
    </Drawer>
  )
}

function toUtcMidnightMs(date: Date) {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
}
