import { describe, expect, it } from 'vitest'
import { summarizeStudentDashboard } from '~/components/home/student-dashboard'

const today = Date.UTC(2026, 10, 6)
const review = (_id: string, dueAt: number | null, assignedAt = 1) => ({
  _id,
  dueAt,
  assignedAt,
  surahNumber: 1,
})
describe('student dashboard', () => {
  it('distinguishes recorded surahs from mastered surahs without inventing daily progress', () => {
    const result = summarizeStudentDashboard(
      [
        { surahNumber: 1, grade: 'good' },
        { surahNumber: 2, grade: 'medium' },
        { surahNumber: 3, grade: 'forgotten' },
      ],
      [],
      [],
      today,
    )
    expect(result.counts).toEqual({ good: 1, medium: 1, forgotten: 1 })
    expect(result.recorded).toBe(3)
    expect(result.totalSurahs).toBe(114)
    expect(result.masteryPercent).toBe(1)
  })
  it('counts calendar-day deadlines in UTC and keeps undated reviews last', () => {
    const rows = [
      review('undated', null),
      review('future', today + 86400000),
      review('today', today + 3600000),
      review('overdue', today - 86400000),
    ]
    const result = summarizeStudentDashboard([], rows, [], today + 86399999)
    expect(result.overdue).toBe(1)
    expect(result.dueToday).toBe(1)
    expect(result.reviews.map((r) => r._id)).toEqual([
      'overdue',
      'today',
      'future',
      'undated',
    ])
    expect(rows[0]._id).toBe('undated')
  })
  it('bounds previews while preserving the total review count', () => {
    const result = summarizeStudentDashboard(
      [],
      Array.from({ length: 9 }, (_, i) => review(String(i), today + i)),
      [],
      today,
    )
    expect(result.reviews).toHaveLength(5)
    expect(result.reviewCount).toBe(9)
  })
  it('shows the newest three notes by creation, including deleted authors and edits', () => {
    const notes = [1, 4, 2, 3].map((i) => ({
      _id: String(i),
      createdAt: i,
      editedAt: i === 1 ? 100 : null,
      authorDisplayName: 'مستخدم محذوف',
      body: '<script>plain text</script>',
    }))
    const result = summarizeStudentDashboard([], [], notes, today)
    expect(result.notes.map((n) => n._id)).toEqual(['4', '3', '2'])
    expect(notes[0]._id).toBe('1')
  })
  it('provides honest empty and fully mastered states', () => {
    const empty = summarizeStudentDashboard([], [], [], today)
    expect(empty.masteryPercent).toBe(0)
    expect(empty.reviewCount).toBe(0)
    expect(empty.notes).toEqual([])
    const full = summarizeStudentDashboard(
      Array.from({ length: 114 }, (_, i) => ({
        surahNumber: i + 1,
        grade: 'good' as const,
      })),
      [],
      [],
      today,
    )
    expect(full.masteryPercent).toBe(100)
  })
})
