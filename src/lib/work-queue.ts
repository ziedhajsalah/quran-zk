import { z } from 'zod'
import type { SurahGrade } from '~/data/grades'

export const workKindSchema = z.enum(['review', 'memorization'])
export const workFilterSchema = z.object({
  q: z.string().trim().max(100).default(''),
  kind: z.enum(['all', ...workKindSchema.options]).default('all'),
  readiness: z.enum(['all', 'ready', 'not-ready']).default('all'),
  deadline: z
    .enum(['all', 'overdue', 'today', 'upcoming', 'undated'])
    .default('overdue'),
})
export const defaultWorkFilters = workFilterSchema.parse({})
export type WorkKind = z.output<typeof workKindSchema>
export type WorkFilters = z.output<typeof workFilterSchema>
export type WorkDeadline = WorkFilters['deadline']
const kindLabels: Record<WorkFilters['kind'], string> = {
  all: 'كل الواجبات',
  review: 'مراجعة',
  memorization: 'حفظ جديد',
}
const deadlineLabels: Record<WorkDeadline, string> = {
  all: 'كل المواعيد',
  overdue: 'متأخرة',
  today: 'اليوم',
  upcoming: 'قادمة',
  undated: 'دون موعد',
}
const readinessLabels: Record<WorkFilters['readiness'], string> = {
  all: 'كل الحالات',
  ready: 'جاهز للتقييم',
  'not-ready': 'لم يعلن الجاهزية',
}
export const workReadinessOptions = workFilterSchema.shape.readiness
  .unwrap()
  .options.map((value) => ({ value, label: readinessLabels[value] }))
export const workKindOptions = workFilterSchema.shape.kind
  .unwrap()
  .options.map((value) => ({ value, label: kindLabels[value] }))
export const workDeadlineOptions = workFilterSchema.shape.deadline
  .unwrap()
  .options.map((value) => ({ value, label: deadlineLabels[value] }))
// Invalid URL values fall back; the server input remains strict.
export function parseWorkFilters(
  search: Record<string, unknown>,
): WorkFilters {
  return {
    q: workFilterSchema.shape.q.catch(defaultWorkFilters.q).parse(search.q),
    kind: workFilterSchema.shape.kind
      .catch(defaultWorkFilters.kind)
      .parse(search.kind),
    readiness: workFilterSchema.shape.readiness
      .catch(defaultWorkFilters.readiness)
      .parse(search.readiness),
    deadline: workFilterSchema.shape.deadline
      .catch(defaultWorkFilters.deadline)
      .parse(search.deadline),
  }
}
export type WorkCursor = { dueAt: number | null; kind: WorkKind; id: string }
export type WorkRow = WorkCursor & {
  studentId: string
  displayName: string
  username: string
  surahNumber: number
  currentGrade: SurahGrade | null
  readyAt: number | null
}
export type WorkPage = { rows: Array<WorkRow>; nextCursor: WorkCursor | null }
