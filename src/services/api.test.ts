import { afterEach, describe, expect, it, vi } from 'vitest';

import { api, ApiError } from './api';

describe('api', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('explains inventory 404 as an invalid or inactive product id', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      message: 'Product not found',
      path: '/api/v1/inventory/00000000-0000-0000-0000-000000000001',
    }), {
      status: 404,
      headers: { 'content-type': 'application/json' },
    })));

    await expect(api('/inventory/00000000-0000-0000-0000-000000000001', {
      method: 'PUT',
      body: JSON.stringify({ quantity: 1, reason: 'Entrada manual' }),
    })).rejects.toMatchObject({
      name: 'ApiError',
      status: 404,
      message: 'Produto nao encontrado. Atualize a lista de produtos e tente novamente com um produto ativo deste fornecedor.',
    } satisfies Partial<ApiError>);
  });
});
