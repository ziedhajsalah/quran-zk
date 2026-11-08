export interface FollowUpReview {
  nextReviewDueAt?: number
}

// null disables follow-up; an empty string means enabled, awaiting a date.
export function followUpReviewInput(date: string | null): FollowUpReview {
  return date ? { nextReviewDueAt: Date.parse(`${date}T00:00:00.000Z`) } : {}
}
