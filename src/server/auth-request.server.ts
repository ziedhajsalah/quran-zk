const MAX_AUTH_BODY_BYTES = 8192
const AUTH_BODY_TIMEOUT_MS = 5000

// Complete body reads before entering withRuntime and acquiring a PostgreSQL client.
export async function prepareAuthRequest(
  request: Request,
  timeoutMs = AUTH_BODY_TIMEOUT_MS,
): Promise<Request | Response> {
  if (request.method !== 'POST' || !request.body) return request
  const reader = request.body.getReader()
  let timedOut = false
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeoutResponse = () =>
    Response.json(
      { message: 'انتهت مهلة إرسال الطلب. حاول مرة أخرى.' },
      { status: 408 },
    )
  const readBody = async (): Promise<Request | Response> => {
    const chunks: Array<Uint8Array> = []
    let size = 0
    for (;;) {
      const part = await reader.read()
      if (timedOut) return timeoutResponse()
      if (part.done) break
      size += part.value.byteLength
      if (size > MAX_AUTH_BODY_BYTES) {
        void reader.cancel().catch(() => {})
        return new Response('Request too large', { status: 413 })
      }
      chunks.push(part.value)
    }
    const bytes = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) {
      bytes.set(chunk, offset)
      offset += chunk.byteLength
    }
    return new Request(request, { body: bytes })
  }
  try {
    return await Promise.race([
      readBody(),
      new Promise<Response>((resolve) => {
        timer = setTimeout(() => {
          timedOut = true
          resolve(timeoutResponse())
          void reader.cancel().catch(() => {})
        }, timeoutMs)
      }),
    ])
  } catch {
    return Response.json({ message: 'تعذر قراءة الطلب.' }, { status: 400 })
  } finally {
    clearTimeout(timer)
    reader.releaseLock()
  }
}
