export interface BatchReviewInput {
  surahNumbers: Array<number>
  dueAt?: number
}

export interface BatchReviewResult {
  assignedSurahNumbers: Array<number>
  skippedSurahNumbers: Array<number>
}
