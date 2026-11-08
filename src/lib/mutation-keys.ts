export function mutationInvalidationKeys(keys: Array<string>) {
  const dashboard = keys.some((key) =>
    ['grades', 'reviews', 'memorization', 'students', 'users'].includes(key),
  )
  // Grade writes can complete memorization; grade removal can cancel reviews.
  const work = keys.some((key) =>
    ['grades', 'reviews', 'memorization', 'users'].includes(key),
  )
  return [
    ...new Set([
      ...keys,
      ...(dashboard ? ['teacher-dashboard'] : []),
      ...(work ? ['work-queue'] : []),
      ...(keys.includes('grades') ? ['memorization'] : []),
    ]),
  ]
}
