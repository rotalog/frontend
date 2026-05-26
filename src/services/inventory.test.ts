import { beforeEach, describe, expect, it, vi } from 'vitest';

import { updateInventory } from './inventory';
import { api } from './api';

vi.mock('./api', () => ({
  ApiError: class ApiError extends Error {
    status: number;
    data: unknown;

    constructor(message: string, status: number, data: unknown) {
      super(message);
      this.name = 'ApiError';
      this.status = status;
      this.data = data;
    }
  },
  api: vi.fn(),
}));

const mockedApi = vi.mocked(api);

describe('inventory service', () => {
  beforeEach(() => {
    mockedApi.mockReset();
  });

  it('does not send stock updates for local fallback product ids', async () => {
    await expect(updateInventory('mock-arr001', {
      quantity: 1,
      reason: 'Entrada manual',
    })).rejects.toThrow('ID de produto invalido para sincronizar estoque.');

    expect(mockedApi).not.toHaveBeenCalled();
  });

  it('does not send stock updates for product codes used as ids', async () => {
    await expect(updateInventory('ARR001', {
      quantity: 1,
      reason: 'Entrada manual',
    })).rejects.toThrow('ID de produto invalido para sincronizar estoque.');

    expect(mockedApi).not.toHaveBeenCalled();
  });
});
