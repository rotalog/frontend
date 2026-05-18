import { describe, expect, it } from 'vitest'

import { isDemoAuthEnabled, isSupplierSession } from './auth'

describe('isDemoAuthEnabled', () => {
  it('returns false in development when no explicit demo flag is enabled', () => {
    expect(isDemoAuthEnabled(undefined, true)).toBe(false)
  })

  it('returns true only when the explicit demo flag is enabled', () => {
    expect(isDemoAuthEnabled('true', true)).toBe(true)
  })
})

describe('isSupplierSession', () => {
  it('returns false when authenticated user has no supplierId', () => {
    expect(isSupplierSession({
      id: 'user-1',
      name: 'Comprador',
      email: 'comprador@example.com',
      role: 'BUYER',
      supplierId: '',
    })).toBe(false)
  })

  it('returns true when authenticated user has supplierId', () => {
    expect(isSupplierSession({
      id: 'user-2',
      name: 'Fornecedor',
      email: 'fornecedor@example.com',
      role: 'SUPPLIER',
      supplierId: 'supplier-123',
    })).toBe(true)
  })
})
