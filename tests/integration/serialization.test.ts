import { describe, expect, it } from 'vitest'
import { crossSerializeStream, deserialize, serialize } from 'seroval'
import { serializeUser } from '../../src/server/accounts'

function serializeStream(value: unknown) {
  const chunks: Array<string> = []
  const errors: Array<unknown> = []
  const dispose = crossSerializeStream(value, {
    refs: new Map(),
    onSerialize: (chunk) => chunks.push(chunk),
    onError: (error) => errors.push(error),
  })
  dispose()
  expect(errors).toEqual([])
  expect(chunks.length).toBeGreaterThan(0)
  return chunks.join('')
}

describe.each([
  ['serialize', serialize],
  ['SSR crossSerializeStream', serializeStream],
] as const)('%s serialization safety', (_name, encode) => {
  it('uses the real typed-array type instead of an own constructor property', () => {
    const value = Object.assign(new Uint8Array([1, 2, 255]), {
      constructor: { name: 'UntrustedConstructor' },
    })
    const source = encode(value)
    expect(source).toContain('new Uint8Array(')
    expect(source).not.toContain('UntrustedConstructor')
  })

  it('escapes RegExp sources before embedding them in hydration scripts', () => {
    const value = new RegExp('(?<surah>سورة)<!--', 'u')
    const source = encode(value)
    expect(source).not.toContain('<')
    expect(source).toContain('RegExp')
    expect(deserialize<RegExp>(serialize(value))).toEqual(value)
  })
})

it('round-trips Arabic auth DTOs and query dates without changing their shape', () => {
  const user = serializeUser({
    id: 'serialization-student',
    name: 'طالب القرآن <اختبار>',
    username: 'serialization.student',
    email: 'serialization.student@auth.local.invalid',
    role: 'student',
    banned: false,
  })
  const data = { user, dueAt: new Date('2026-11-07T00:00:00.000Z') }
  const source = serialize(data)
  expect(source).not.toContain('<')
  expect(deserialize(source)).toEqual(data)
  expect(serializeStream(data)).not.toContain('<')
})
