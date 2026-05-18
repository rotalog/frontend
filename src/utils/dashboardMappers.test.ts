import { describe, expect, it } from 'vitest'

import { mapApiInventoryToLegacyStock, mergeSupplierProductsWithInventory } from './dashboardMappers'
import type { ApiInventoryItem } from '../types/inventory'
import type { ApiProduct } from '../types/products'

describe('mapApiInventoryToLegacyStock', () => {
  it('preserves productId from the API response', () => {
    const stock = mapApiInventoryToLegacyStock({
      productId: 'prod-1',
      productName: 'Arroz 5kg',
      sku: 'ARR001',
      quantity: 25,
      reservedQuantity: 4,
    })

    expect(stock.productId).toBe('prod-1')
    expect(stock.codigo).toBe('ARR001')
    expect(stock.produto).toBe('Arroz 5kg')
    expect(stock.total).toBe(25)
    expect(stock.reservado).toBe(4)
  })
})

describe('mergeSupplierProductsWithInventory', () => {
  it('returns products with inventory quantities merged by productId', () => {
    const products: ApiProduct[] = [
      { id: 'prod-1', name: 'Arroz 5kg', sku: 'ARR001' },
      { id: 'prod-2', name: 'Feijao 1kg', sku: 'FEJ001' },
    ]
    const inventory: ApiInventoryItem[] = [
      { productId: 'prod-1', quantity: 18, reservedQuantity: 3 },
    ]

    const stock = mergeSupplierProductsWithInventory(products, inventory)

    expect(stock).toEqual([
      {
        productId: 'prod-1',
        codigo: 'ARR001',
        produto: 'Arroz 5kg',
        total: 18,
        reservado: 3,
      },
      {
        productId: 'prod-2',
        codigo: 'FEJ001',
        produto: 'Feijao 1kg',
        total: 0,
        reservado: 0,
      },
    ])
  })
})
