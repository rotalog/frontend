const DEFAULT_API_URL = 'https://api.rotalog.madebyhermes.com/api/v1';

export const API_URL = (import.meta.env.VITE_API_URL ?? DEFAULT_API_URL).replace(/\/$/, '');

let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function clearAccessToken(): void {
  accessToken = null;
}

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

function getFriendlyErrorMessage(status: number, data: unknown): string {
  if (data && typeof data === 'object') {
    const payload = data as { message?: unknown; error?: unknown };

    if (typeof payload.message === 'string' && payload.message.trim()) {
      return payload.message;
    }

    if (typeof payload.error === 'string' && payload.error.trim()) {
      return payload.error;
    }
  }

  if (status === 401) {
    return 'Sua sessao expirou. Faca login novamente.';
  }

  if (status === 403) {
    return 'Voce nao tem permissao para executar esta acao.';
  }

  if (status >= 500) {
    return 'Erro interno no servidor. Tente novamente em instantes.';
  }

  return `Falha na comunicacao com o servidor (HTTP ${status}).`;
}

async function safeReadJson(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? '';
  const text = await response.text();

  if (!text) {
    return undefined;
  }

  if (contentType.includes('application/json')) {
    try {
      return JSON.parse(text);
    } catch {
      return undefined;
    }
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function api<T>(
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<T> {
  const headers = new Headers(options.headers ?? undefined);
  const body = options.body;

  if (accessToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  if (body !== undefined && !(body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const requestOptions: RequestInit = {
    ...options,
    headers,
    credentials: 'include',
  };

  const response = await fetch(`${API_URL}${path}`, requestOptions);

  if (response.status === 401 && retry) {
    try {
      const refreshResponse = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });

      const refreshData = await safeReadJson(refreshResponse);
      if (refreshResponse.ok) {
        if (refreshData && typeof refreshData === 'object') {
          const payload = refreshData as { accessToken?: unknown; token?: unknown };
          const nextToken = typeof payload.accessToken === 'string'
            ? payload.accessToken
            : typeof payload.token === 'string'
              ? payload.token
              : null;

          if (nextToken) {
            setAccessToken(nextToken);
          }
        }

        return api<T>(path, options, false);
      }
    } catch {
      clearAccessToken();
    }

    clearAccessToken();
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const data = await safeReadJson(response);

  if (!response.ok) {
    throw new ApiError(getFriendlyErrorMessage(response.status, data), response.status, data);
  }

  return data as T;
}
