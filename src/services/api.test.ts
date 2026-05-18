import { describe, expect, it } from 'vitest'

import { resolveApiUrl } from './api'

describe('resolveApiUrl', () => {
  it('uses same-origin api path during local development when no env override is provided', () => {
    expect(resolveApiUrl(undefined, true)).toBe('/api/v1')
  })

  it('uses explicit env url when provided', () => {
    expect(resolveApiUrl('https://example.com/api/v1/', false)).toBe('https://example.com/api/v1')
  })

  it('falls back to hosted api url outside local development', () => {
    expect(resolveApiUrl(undefined, false)).toBe('https://api.rotalog.madebyhermes.com/api/v1')
  })
})
