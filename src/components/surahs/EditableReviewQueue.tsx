import { useState } from 'react'
import { AssignmentDeadlineDialog } from './AssignmentDeadlineDialog'
import { SurahReviewQueue } from './SurahReviewQueue'
import type { SurahReviewQueueItem } from './SurahReviewQueue/SurahReviewQueue'
import type { AssignmentDeadline } from '~/lib/assignment-deadline'
import { useAppMutation } from '~/lib/queries'
import * as reviews from '~/server/functions/reviews'

// The route keys this component by student so changing students resets the form.
export function EditableReviewQueue({
  rows,
  onClose,
  onCancel,
}: {
  rows: ReadonlyArray<SurahReviewQueueItem>
  onClose: (id: string) => void
  onCancel: (id: string) => void
}) {
  const [rescheduling, setRescheduling] = useState<AssignmentDeadline | null>(
    null,
  )
  const reschedule = useAppMutation(reviews.reschedule, ['reviews'])
  return (
    <>
      <SurahReviewQueue
        rows={rows}
        editable
        onClose={onClose}
        onCancel={onCancel}
        onReschedule={(assignmentId) => {
          const row = rows.find((item) => item.assignmentId === assignmentId)
          if (row) setRescheduling(row)
        }}
      />
      {rescheduling ? (
        <AssignmentDeadlineDialog
          key={rescheduling.assignmentId}
          assignment={rescheduling}
          onClose={() => setRescheduling(null)}
          onSubmit={(change) =>
            reschedule({ assignmentId: rescheduling.assignmentId, ...change })
          }
        />
      ) : null}
    </>
  )
}
