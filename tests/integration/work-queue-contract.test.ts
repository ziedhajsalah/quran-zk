import { describe, expect, it } from 'vitest'
import {
  defaultWorkFilters,
  parseWorkFilters,
  workDeadlineOptions,
  workFilterSchema,
  workKindOptions,
} from '../../src/lib/work-queue'
import { workQueueInput } from '../../src/server/functions/validation'
import { mutationInvalidationKeys } from '../../src/lib/mutation-keys'

describe('work queue contracts', () => {
  it('shares defaults and options between URL parsing, UI and strict API validation', () => {
    expect(parseWorkFilters({})).toEqual(defaultWorkFilters)
    expect(workFilterSchema.parse({})).toEqual(defaultWorkFilters)
    expect(workQueueInput.parse({})).toEqual({
      ...defaultWorkFilters,
      cursor: null,
    })
    for (const { value: kind } of workKindOptions)
      for (const { value: deadline } of workDeadlineOptions) {
        const filters = { q: '  طالب  ', kind, deadline }
        expect(parseWorkFilters(filters)).toEqual(
          workFilterSchema.parse(filters),
        )
        expect(workQueueInput.parse(filters)).toEqual({
          ...parseWorkFilters(filters),
          cursor: null,
        })
      }
    expect(
      parseWorkFilters({ kind: 'invalid', deadline: 'invalid', q: 7 }),
    ).toEqual(defaultWorkFilters)
    expect(workQueueInput.safeParse({ kind: 'invalid' }).success).toBe(false)
  })
  it('skips unrelated invalidations but retains grade side effects and account changes', () => {
    expect(mutationInvalidationKeys(['students'])).not.toContain('work-queue')
    expect(mutationInvalidationKeys(['notes'])).not.toContain('work-queue')
    for (const key of ['reviews', 'memorization', 'users', 'grades'])
      expect(mutationInvalidationKeys([key])).toContain('work-queue')
    expect(mutationInvalidationKeys(['grades'])).toContain('memorization')
    const combined = mutationInvalidationKeys([
      'grades',
      'memorization',
      'reviews',
    ])
    expect(new Set(combined).size).toBe(combined.length)
  })
})
