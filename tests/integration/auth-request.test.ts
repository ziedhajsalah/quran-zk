import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { handler } from '../../src/lib/auth-server'

const calls = vi.hoisted(() => ({
  database: vi.fn(),
  limiter: vi.fn(),
  auth: vi.fn(),
}))
vi.mock('../../src/server/runtime.server', () => ({
  withRuntime: (run: (context: unknown) => unknown, request: Request) => {
    calls.database(request)
    return run({ db: {}, config: {}, auth: { handler: calls.auth } })
  },
}))
vi.mock('../../src/server/sign-in-limit.server', () => ({
  limitSignIn: calls.limiter,
}))

beforeEach(() => {
  vi.clearAllMocks()
  calls.limiter.mockResolvedValue(null)
  calls.auth.mockImplementation(async (request: Request) =>
    Response.json(await request.json()),
  )
})
afterEach(() => vi.useRealTimers())
function streamedRequest() {
  let controller!: ReadableStreamDefaultController<Uint8Array>
  const cancelled = vi.fn()
  const body = new ReadableStream<Uint8Array>({
    start(value) {
      controller = value
    },
    cancel: cancelled,
  })
  const request = new Request('https://example.com/api/auth/sign-in/username', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: 'https://example.com',
      'cf-connecting-ip': '192.0.2.1',
    },
    body,
    duplex: 'half',
  } as RequestInit)
  return { request, controller, cancelled }
}
describe('auth request buffering before database acquisition', () => {
  it('does not acquire a database client while the request body is incomplete', async () => {
    const { request, controller } = streamedRequest()
    const pending = handler(request)
    controller.enqueue(new TextEncoder().encode('{"username":'))
    await Promise.resolve()
    expect(calls.database).not.toHaveBeenCalled()
    controller.enqueue(new TextEncoder().encode('"student","password":"test"}'))
    controller.close()
    const response = await pending
    expect(await response.json()).toEqual({
      username: 'student',
      password: 'test',
    })
    expect(calls.database).toHaveBeenCalledOnce()
    expect(
      calls.database.mock.calls[0][0].headers.get('cf-connecting-ip'),
    ).toBe('192.0.2.1')
  })
  it('rejects an oversized stream before acquiring a database client', async () => {
    const { request, controller, cancelled } = streamedRequest()
    const pending = handler(request)
    controller.enqueue(new Uint8Array(8193))
    expect((await pending).status).toBe(413)
    expect(cancelled).toHaveBeenCalledOnce()
    expect(calls.database).not.toHaveBeenCalled()
  })
  it('uses an absolute deadline for a slowly arriving body without holding a database client', async () => {
    vi.useFakeTimers()
    const { request, controller, cancelled } = streamedRequest()
    const pending = handler(request)
    controller.enqueue(new TextEncoder().encode('{'))
    await vi.advanceTimersByTimeAsync(4000)
    expect(calls.database).not.toHaveBeenCalled()
    controller.enqueue(new TextEncoder().encode('"username":'))
    await vi.advanceTimersByTimeAsync(1000)
    expect((await pending).status).toBe(408)
    expect(cancelled).toHaveBeenCalledOnce()
    expect(calls.database).not.toHaveBeenCalled()
  })
})
