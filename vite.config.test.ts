import { describe, expect, it, vi } from 'vitest'

import { applyApiProxyHeaders } from './vite.config'

describe('applyApiProxyHeaders', () => {
  it('removes the Origin header from proxied requests', () => {
    const listeners = new Map<string, (proxyReq: { removeHeader: (name: string) => void }) => void>()
    const proxy = {
      on: vi.fn((event: string, handler: (proxyReq: { removeHeader: (name: string) => void }) => void) => {
        listeners.set(event, handler)
      }),
    }

    applyApiProxyHeaders(proxy)

    const removeHeader = vi.fn()
    const handler = listeners.get('proxyReq')

    expect(handler).toBeTypeOf('function')
    handler?.({ removeHeader })

    expect(removeHeader).toHaveBeenCalledWith('origin')
  })
})
