export function extractActionErrorMessage(
  error: unknown,
  fallback: string,
): string {
  if (!(error instanceof Error)) {
    return fallback
  }
  const cleaned = error.message
    .replace(/\[Request ID:\s*[^\]]+\]\s*/g, '')
    .replace(/\[CONVEX [^\]]+\]\s*/g, '')
    .replace(/^(?:Server Error\s+)?/i, '')
    .replace(/^Uncaught\s+Error:\s*/i, '')
    .split(/\s+at\s+\S+\s*\(/)[0]
    .split('Called by client')[0]
    .trim()
  return cleaned || fallback
}
