export interface LoginPayload {
  email: string;
  senha: string;
}

export interface RegisterPayload {
  empresaNome: string;
  cnpj: string;
  endereco: string;
  telefone: string;
  empresaEmail: string;
  adminNome: string;
  adminEmail: string;
  adminSenha: string;
  latitude: number;
  longitude: number;
}

export interface AuthResult {
  // ALTERACAO: mantendo compatibilidade com o fluxo antigo, mas agora via backend.
  token?: string;
  companyName: string;
  user: AuthenticatedUser;
}

export interface AuthenticatedUser {
  id?: string | number;
  name?: string;
  nome?: string;
  companyName?: string;
  empresaNome?: string;
  email?: string;
  [key: string]: unknown;
}

interface ApiErrorPayload {
  message?: string;
  error?: string;
}

interface SupplierAccountRecord {
  empresaNome: string;
  cnpj: string;
  endereco: string;
  telefone: string;
  empresaEmail: string;
  adminNome: string;
  adminEmail: string;
  adminSenha: string;
  latitude: number;
  longitude: number;
}

interface MockSession {
  companyName: string;
  user: AuthenticatedUser;
}

class NetworkConnectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkConnectionError';
  }
}

// ALTERACAO: base configuravel para suportar local, homologacao e producao.
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const AUTH_BASE_PATH = '/api/v1/auth';
const MOCK_STORAGE_KEY = 'rotalog-supplier-accounts';
const MOCK_SESSION_KEY = 'rotalog-auth-session';
// ALTERACAO: fallback temporario para desenvolvimento sem backend.
const MOCK_AUTH_ENABLED = (import.meta.env.VITE_ENABLE_AUTH_FALLBACK ?? (import.meta.env.DEV ? 'true' : 'false')) === 'true';

function buildAuthUrl(path: string) {
  return `${API_BASE_URL}${AUTH_BASE_PATH}${path}`;
}

function getAccounts() {
  const raw = localStorage.getItem(MOCK_STORAGE_KEY);
  if (!raw) {
    return [] as SupplierAccountRecord[];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SupplierAccountRecord[]) : [];
  } catch {
    return [] as SupplierAccountRecord[];
  }
}

function saveAccounts(accounts: SupplierAccountRecord[]) {
  localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(accounts));
}

function saveMockSession(session: MockSession) {
  localStorage.setItem(MOCK_SESSION_KEY, JSON.stringify(session));
}

function clearMockSession() {
  localStorage.removeItem(MOCK_SESSION_KEY);
}

function getMockSession(): MockSession | null {
  const raw = localStorage.getItem(MOCK_SESSION_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as MockSession;
    if (parsed && parsed.user && typeof parsed.user === 'object') {
      return parsed;
    }
  } catch {
    return null;
  }

  return null;
}

function buildMockUserFromAccount(account: SupplierAccountRecord): AuthenticatedUser {
  return {
    id: account.cnpj,
    name: account.adminNome,
    nome: account.adminNome,
    companyName: account.empresaNome,
    empresaNome: account.empresaNome,
    email: account.adminEmail,
  };
}

function makeMockSessionFromEmail(email: string): MockSession {
  const companyName = (email.split('@')[0] || 'fornecedor')
    .replace(/[._-]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ') || 'Fornecedor';

  const user: AuthenticatedUser = {
    id: `mock-${Date.now()}`,
    name: companyName,
    nome: companyName,
    companyName,
    empresaNome: companyName,
    email,
  };

  return { companyName, user };
}

async function parseError(response: Response): Promise<string> {
  if (response.status === 404) {
    return 'Endpoint de autenticacao nao encontrado. Verifique a URL/base da API e o prefixo /api/v1/auth.';
  }

  if (response.status === 401) {
    return 'Credenciais invalidas.';
  }

  try {
    const payload = (await response.json()) as ApiErrorPayload;
    return payload.message || payload.error || 'Falha na comunicacao com o servidor.';
  } catch {
    return `Falha na comunicacao com o servidor (HTTP ${response.status}).`;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const url = buildAuthUrl(path);
  let response: Response;

  // ALTERACAO: credentials include para permitir cookie HttpOnly no frontend web.
  try {
    response = await fetch(url, {
      credentials: 'include',
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...init?.headers,
      },
    });
  } catch {
    throw new NetworkConnectionError(`Nao foi possivel conectar ao backend em ${API_BASE_URL}. Verifique se a API esta online e se o CORS permite o frontend.`);
  }

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

function extractCompanyName(user: AuthenticatedUser, fallback = 'Fornecedor') {
  const value = user.companyName || user.empresaNome || user.name || user.nome;
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }

  return fallback;
}

function normalizeUserPayload(payload: unknown): AuthenticatedUser {
  if (payload && typeof payload === 'object') {
    if ('user' in payload && payload.user && typeof payload.user === 'object') {
      return payload.user as AuthenticatedUser;
    }

    return payload as AuthenticatedUser;
  }

  return {};
}

export async function loginSupplier(payload: LoginPayload): Promise<AuthResult> {
  try {
    await request('/login', {
      method: 'POST',
      body: JSON.stringify({
        email: payload.email.trim(),
        senha: payload.senha,
      }),
    });

    const user = await getCurrentUser();
    return {
      companyName: extractCompanyName(user),
      user,
    };
  } catch (error) {
    if (!(error instanceof NetworkConnectionError) || !MOCK_AUTH_ENABLED) {
      throw error;
    }

    const accounts = getAccounts();
    const normalizedEmail = payload.email.trim().toLowerCase();
    const matched = accounts.find(account =>
      account.adminEmail.toLowerCase() === normalizedEmail ||
      account.empresaEmail.toLowerCase() === normalizedEmail,
    );

    if (matched && matched.adminSenha !== payload.senha) {
      throw new Error('Senha invalida. Verifique e tente novamente.');
    }

    if (!matched && payload.senha.trim().length < 6) {
      throw new Error('A senha deve ter no minimo 6 caracteres para acesso temporario.');
    }

    const session = matched
      ? {
        companyName: matched.empresaNome,
        user: buildMockUserFromAccount(matched),
      }
      : makeMockSessionFromEmail(normalizedEmail);

    saveMockSession(session);

    return {
      companyName: session.companyName,
      user: session.user,
    };
  }
}

export async function registerSupplier(payload: RegisterPayload): Promise<AuthResult> {
  try {
    await request('/register/supplier', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    const user = await getCurrentUser();
    return {
      companyName: extractCompanyName(user, payload.empresaNome),
      user,
    };
  } catch (error) {
    if (!(error instanceof NetworkConnectionError) || !MOCK_AUTH_ENABLED) {
      throw error;
    }

    const accounts = getAccounts();
    const cnpjDigits = payload.cnpj.replace(/\D/g, '');

    if (accounts.some(account => account.cnpj.replace(/\D/g, '') === cnpjDigits)) {
      throw new Error('Ja existe uma empresa cadastrada com este CNPJ.');
    }

    if (accounts.some(account => account.adminEmail.toLowerCase() === payload.adminEmail.toLowerCase())) {
      throw new Error('Ja existe um usuario admin com este e-mail.');
    }

    const account: SupplierAccountRecord = {
      empresaNome: payload.empresaNome,
      cnpj: payload.cnpj,
      endereco: payload.endereco,
      telefone: payload.telefone,
      empresaEmail: payload.empresaEmail,
      adminNome: payload.adminNome,
      adminEmail: payload.adminEmail,
      adminSenha: payload.adminSenha,
      latitude: payload.latitude,
      longitude: payload.longitude,
    };

    saveAccounts([...accounts, account]);

    const session: MockSession = {
      companyName: payload.empresaNome,
      user: buildMockUserFromAccount(account),
    };

    saveMockSession(session);

    return {
      companyName: session.companyName,
      user: session.user,
    };
  }
}

export async function refreshSession() {
  if (MOCK_AUTH_ENABLED) {
    return;
  }

  await request('/refresh', {
    method: 'POST',
  });
}

export async function requestPasswordRecovery(email: string) {
  if (MOCK_AUTH_ENABLED) {
    return;
  }

  await request('/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email: email.trim() }),
  });
}

export async function logoutSupplier() {
  if (MOCK_AUTH_ENABLED) {
    clearMockSession();
    return;
  }

  await request('/logout', {
    method: 'POST',
  });
}

export async function getCurrentUser(): Promise<AuthenticatedUser> {
  if (MOCK_AUTH_ENABLED) {
    const session = getMockSession();
    if (session) {
      return session.user;
    }
  }

  const payload = await request<unknown>('/me', {
    method: 'GET',
  });

  return normalizeUserPayload(payload);
}

export function getCompanyNameFromUser(user: AuthenticatedUser) {
  return extractCompanyName(user);
}

export async function registerUser(payload: Omit<RegisterPayload, 'latitude' | 'longitude'>) {
  // ALTERACAO: rota publica de registro padrao adicionada para compatibilidade da API.
  return request('/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function loginMobileWithBearer(payload: LoginPayload) {
  // ALTERACAO: helper para cenarios mobile descritos na documentacao (header Authorization).
  return request('/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function withAuthHeader<T>(path: string, token: string, init?: RequestInit) {
  return request<T>(path, {
    ...init,
    headers: {
      ...init?.headers,
      Authorization: `Bearer ${token}`,
    },
  });
}
