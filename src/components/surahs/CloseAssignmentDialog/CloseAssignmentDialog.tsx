import { Badge, Button, Chip, Group, Modal, Stack, Text } from '@mantine/core'
import { useEffect, useState } from 'react'
import type { SurahGrade } from '~/data/grades'
import type { Surah } from '~/data/surahs'
import { GRADE_COLORS, GRADE_LABELS, GRADE_ORDER } from '~/data/grades'
import { formatArabicNumber } from '~/components/home/home-formatters'

export interface CloseAssignmentDialogProps {
  opened: boolean
  onClose: () => void
  surah: Surah | null
  currentGrade: SurahGrade | null
  onSubmit: (input: { newGrade?: SurahGrade }) => void
}

type Selection = { kind: 'keep' } | { kind: 'change'; grade: SurahGrade }

export function CloseAssignmentDialog({
  opened,
  onClose,
  surah,
  currentGrade,
  onSubmit,
}: CloseAssignmentDialogProps) {
  const [selection, setSelection] = useState<Selection>({ kind: 'keep' })

  useEffect(() => {
    if (opened) {
      setSelection({ kind: 'keep' })
    }
  }, [opened])

  function handleSubmit() {
    if (selection.kind === 'keep') {
      onSubmit({})
    } else {
      onSubmit({ newGrade: selection.grade })
    }
    onClose()
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="إغلاق المراجعة"
      centered
      radius="lg"
    >
      <Stack gap="md">
        {surah ? (
          <Stack gap={2}>
            <Text c="dimmed" size="sm">
              السورة
            </Text>
            <Text fw={700} size="lg">
              {`${surah.nameAr} • ${formatArabicNumber(surah.number)}`}
            </Text>
          </Stack>
        ) : null}

        <Stack gap={4}>
          <Text c="dimmed" size="sm">
            التقييم الحالي
          </Text>
          {currentGrade ? (
            <Badge
              color={GRADE_COLORS[currentGrade]}
              radius="xl"
              variant="light"
              w="fit-content"
            >
              {GRADE_LABELS[currentGrade]}
            </Badge>
          ) : (
            <Text c="dimmed" size="sm">
              لا يوجد تقييم بعد.
            </Text>
          )}
        </Stack>

        <Stack gap="xs">
          <Text c="dimmed" size="sm">
            عند الإغلاق
          </Text>
          <Chip
            checked={selection.kind === 'keep'}
            onChange={() => setSelection({ kind: 'keep' })}
            variant="light"
            color="primary"
          >
            إبقاء التقييم الحالي
          </Chip>
          <Chip.Group
            multiple={false}
            value={selection.kind === 'change' ? selection.grade : null}
            onChange={(value) => {
              if (
                value === 'good' ||
                value === 'medium' ||
                value === 'forgotten'
              ) {
                setSelection({ kind: 'change', grade: value })
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
          <Button variant="subtle" onClick={onClose}>
            إلغاء
          </Button>
          <Button onClick={handleSubmit}>تأكيد الإغلاق</Button>
        </Group>
      </Stack>
    </Modal>
  )
}
