import {
  Alert,
  Button,
  Group,
  Loader,
  Modal,
  Stack,
  Text,
  Title,
} from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { AssignMemorizationDrawer } from './AssignMemorizationDrawer'
import { AssessMemorizationDialog } from './AssessMemorizationDialog'
import { MemorizationHistoryPanel } from './MemorizationHistoryPanel'
import { MemorizationQueue } from './MemorizationQueue'
import type { MemorizationRow } from '~/lib/memorization'
import { memorizationQuery, useAppMutation } from '~/lib/queries'
import * as functions from '~/server/functions/memorization'
import { extractActionErrorMessage } from '~/lib/action-errors'
import { getSurah } from '~/data/surahs'

export function MemorizationPanel({
  studentId,
  recordedSurahNumbers,
  editable = false,
}: {
  studentId: string
  recordedSurahNumbers: ReadonlyArray<number>
  editable?: boolean
}) {
  const query = useQuery(memorizationQuery(studentId))
  const assign = useAppMutation(functions.assign, ['memorization'])
  const assess = useAppMutation(functions.assess, ['memorization', 'grades'])
  const cancel = useAppMutation(functions.cancel, ['memorization'])
  const [showHistory, setShowHistory] = useState(false)
  const [assigning, setAssigning] = useState(false)
  const [assessing, setAssessing] = useState<MemorizationRow | null>(null)
  const [cancelling, setCancelling] = useState<MemorizationRow | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function cancelWork() {
    if (!cancelling || pending) return
    setPending(true)
    setError(null)
    try {
      await cancel({ assignmentId: cancelling._id })
      setCancelling(null)
    } catch (cause) {
      setError(
        extractActionErrorMessage(
          cause,
          'تعذر إلغاء واجب الحفظ. حاول مرة أخرى.',
        ),
      )
    } finally {
      setPending(false)
    }
  }
  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Title order={2}>واجبات الحفظ الجديد</Title>
        {editable ? (
          <Button
            variant="light"
            disabled={!query.isSuccess || query.isFetching}
            onClick={() => setAssigning(true)}
          >
            إسناد حفظ جديد
          </Button>
        ) : null}
      </Group>
      <Text size="sm" c="gray.7">
        سور جديدة للحفظ، منفصلة عن مراجعة السور المسجّلة. لا تُحتسب ضمن تقدّم
        الحفظ قبل تسجيل تقييم المعلم.
      </Text>
      {query.isPending ? (
        <Group role="status">
          <Loader size="sm" />
          <Text>جارٍ تحميل واجبات الحفظ…</Text>
        </Group>
      ) : query.isError ? (
        <Alert color="red" title="تعذر تحميل واجبات الحفظ">
          <Stack gap="sm">
            <Text>حاول تحميل واجبات الحفظ مرة أخرى.</Text>
            <Button variant="light" onClick={() => void query.refetch()}>
              إعادة المحاولة
            </Button>
          </Stack>
        </Alert>
      ) : (
        <MemorizationQueue
          rows={query.data}
          editable={editable}
          busy={pending}
          onAssess={setAssessing}
          onCancel={(row) => {
            setError(null)
            setCancelling(row)
          }}
        />
      )}
      <Button
        variant="subtle"
        aria-expanded={showHistory}
        aria-controls="memorization-history"
        onClick={() => setShowHistory((previous) => !previous)}
      >
        {showHistory ? 'إخفاء سجل الحفظ' : 'عرض سجل الحفظ'}
      </Button>
      {showHistory ? (
        <section id="memorization-history" aria-label="سجل الحفظ الجديد">
          <MemorizationHistoryPanel key={studentId} studentId={studentId} />
        </section>
      ) : null}
      {editable ? (
        <>
          <AssignMemorizationDrawer
            opened={assigning}
            onClose={() => setAssigning(false)}
            excludeSurahNumbers={[
              ...recordedSurahNumbers,
              ...(query.data ?? []).map((row) => row.surahNumber),
            ]}
            onSubmit={(input) => assign({ studentId, ...input })}
          />
          {assessing ? (
            <AssessMemorizationDialog
              key={assessing._id}
              assignment={assessing}
              onClose={() => setAssessing(null)}
              onSubmit={(grade) =>
                assess({ assignmentId: assessing._id, grade })
              }
            />
          ) : null}
          <Modal
            opened={cancelling !== null}
            onClose={() => {
              if (!pending) setCancelling(null)
            }}
            title="إلغاء واجب الحفظ"
            centered
            withCloseButton={!pending}
            closeOnEscape={!pending}
            closeOnClickOutside={!pending}
          >
            <Stack gap="md">
              <Text>
                هل تريد إلغاء واجب حفظ{' '}
                {cancelling ? getSurah(cancelling.surahNumber).nameAr : ''}؟ لن
                يُسجّل تقييم لهذه العملية.
              </Text>
              {error ? <Alert color="red">{error}</Alert> : null}
              <Group justify="space-between">
                <Button
                  variant="subtle"
                  disabled={pending}
                  onClick={() => setCancelling(null)}
                >
                  رجوع
                </Button>
                <Button
                  color="red"
                  loading={pending}
                  onClick={() => void cancelWork()}
                >
                  تأكيد إلغاء الواجب
                </Button>
              </Group>
            </Stack>
          </Modal>
        </>
      ) : null}
    </Stack>
  )
}
