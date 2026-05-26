import { api, clearAccessToken, refreshAccessTokenOnce, setAccessToken } from './api';

export interface LoginPayload {
  email: string;
  senha: string;
}

export interface SupplierRegisterPayload {
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

export type RegisterPayload = SupplierRegisterPayload;

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
  supplierId?: string;
  companyName?: string;
}

export type AuthenticatedUser = AuthUser & {
  nome?: string;
  empresaNome?: string;
  [key: string]: unknown;
};

export interface AuthResult {
  token?: string;
  companyName: string;
  user: AuthenticatedUser;
}

export interface ResetPasswordPayload {
  token: string;
  newPassword: string;
}

interface AuthResponse {
  accessToken?: string;
  token?: string;
  user?: AuthenticatedUser;
  [key: string]: unknown;
}

interface SupplierLookupResponse {
  name?: string;
  companyName?: string;
  [key: string]: unknown;
}

type MeResponse = AuthenticatedUser | { user: AuthenticatedUser };

function normalizeAuthUser(payload: MeResponse): AuthenticatedUser {
  if (payload && typeof payload === 'object' && 'user' in payload) {
    const userValue = payload.user;
    if (userValue && typeof userValue === 'object') {
      return userValue as AuthenticatedUser;
    }
  }

  return payload as AuthenticatedUser;
}

function ensureString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function extractCompanyName(user: AuthenticatedUser, fallback = 'Fornecedor') {
  const company = user.companyName ?? user.empresaNome;
  if (typeof company === 'string' && company.trim()) {
    return company.trim();
  }

  if (typeof user.name === 'string' && user.name.trim()) {
    return user.name.trim();
  }

  if (typeof user.nome === 'string' && user.nome.trim()) {
    return user.nome.trim();
  }

  return fallback;
}

async function resolveCompanyName(user: AuthenticatedUser, fallback = 'Fornecedor') {
  const directCompanyName = extractCompanyName(user, '').trim();
  if (directCompanyName) {
    return directCompanyName;
  }

  const supplierId = ensureString(user.supplierId).trim();
  if (supplierId) {
    try {
      const supplier = await api<SupplierLookupResponse>(`/suppliers/${supplierId}`, {
        method: 'GET',
      });

      const supplierName = ensureString(supplier.name, ensureString(supplier.companyName)).trim();
      if (supplierName) {
        return supplierName;
      }
    } catch {
      // Keep local fallback behavior if supplier lookup fails.
    }
  }

  return extractCompanyName(user, fallback);
}

function normalizeUserShape(user: AuthenticatedUser): AuthenticatedUser {
  return {
    ...user,
    id: ensureString(user.id),
    name: ensureString(user.name, ensureString(user.nome)),
    email: ensureString(user.email),
    role: ensureString(user.role, 'supplier'),
    companyName: ensureString(user.companyName, ensureString(user.empresaNome)),
  };
}

function clearLegacyAuthStorage() {
  const legacyKeys = [
    'rotalog-jwt',
    'rotalog-user',
    'rotalog-supplier-accounts',
    'rotalog-auth-session',
  ];

  for (const key of legacyKeys) {
    localStorage.removeItem(key);
  }
}

function getAuthToken(response: AuthResponse | null | undefined): string | null {
  if (!response || typeof response !== 'object') {
    return null;
  }

  if (typeof response.accessToken === 'string' && response.accessToken.trim()) {
    return response.accessToken;
  }

  if (typeof response.token === 'string' && response.token.trim()) {
    return response.token;
  }

  return null;
}

function resolveAuthUser(response: AuthResponse): AuthenticatedUser | null {
  if (response.user && typeof response.user === 'object') {
    return normalizeUserShape(response.user);
  }

  return null;
}

export async function loginSupplier(payload: LoginPayload): Promise<AuthResult> {
  clearAccessToken();
  try {
    const loginResponse = await api<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: payload.email.trim(),
        password: payload.senha,
      }),
    });

    const token = getAuthToken(loginResponse);
    if (token) {
      setAccessToken(token);
    }

    const userFromResponse = resolveAuthUser(loginResponse);
    if (userFromResponse) {
      const companyName = await resolveCompanyName(userFromResponse);
      return {
        token: token ?? undefined,
        companyName,
        user: userFromResponse,
      };
    }

    const user = await getCurrentUser();
    const companyName = await resolveCompanyName(user);
    return {
      token: token ?? undefined,
      companyName,
      user,
    };
  } catch (error) {
    if (import.meta.env.DEV && import.meta.env.VITE_ENABLE_DEMO_AUTH === 'true') {
      const devUser = normalizeUserShape({
        id: 'dev-user',
        name: 'Fornecedor Demo',
        email: payload.email.trim(),
        role: 'supplier',
        supplierId: 'dev-supplier',
        companyName: 'Fornecedor Demo',
      });

      return {
        companyName: 'Fornecedor Demo',
        user: devUser,
      };
    }

    throw error;
  }
}

export async function registerSupplier(payload: SupplierRegisterPayload): Promise<AuthResult> {
  clearAccessToken();
  const registerResponse = await api<AuthResponse>('/auth/register/supplier', {
    method: 'POST',
    body: JSON.stringify({
      email: (payload.adminEmail || payload.empresaEmail).trim(),
      password: payload.adminSenha,
      name: payload.adminNome,
      supplierName: payload.empresaNome,
    }),
  });

  const token = getAuthToken(registerResponse);
  if (token) {
    setAccessToken(token);
  }

  const userFromResponse = resolveAuthUser(registerResponse);
  if (userFromResponse) {
    const companyName = await resolveCompanyName(userFromResponse, payload.empresaNome);
    return {
      token: token ?? undefined,
      companyName,
      user: userFromResponse,
    };
  }

  try {
    const user = await getCurrentUser();
    const companyName = await resolveCompanyName(user, payload.empresaNome);
    return {
      token: token ?? undefined,
      companyName,
      user,
    };
  } catch {
    const fallbackUser = normalizeUserShape({
      id: '',
      name: payload.adminNome,
      email: payload.adminEmail || payload.empresaEmail,
      role: 'supplier',
      supplierId: '',
      companyName: payload.empresaNome,
      empresaNome: payload.empresaNome,
    });

    return {
      token: token ?? undefined,
      companyName: extractCompanyName(fallbackUser, payload.empresaNome),
      user: fallbackUser,
    };
  }
}

export async function refreshSession() {
  await refreshAccessTokenOnce();
}

export async function forgotPassword(email: string) {
  await api<void>('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email: email.trim() }),
  });
}

export async function requestPasswordRecovery(email: string) {
  await forgotPassword(email);
}

export async function resetPassword(payload: ResetPasswordPayload) {
  await api<void>('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({
      token: payload.token,
      newPassword: payload.newPassword,
    }),
  });
}

export async function logoutSupplier() {
  try {
    await api<void>('/auth/logout', {
      method: 'POST',
    });
  } finally {
    clearAccessToken();
    // Transitional cleanup for older localStorage-based sessions.
    clearLegacyAuthStorage();
  }
}

export async function logout() {
  await logoutSupplier();
}

export async function getCurrentUser(): Promise<AuthenticatedUser> {
  const payload = await api<MeResponse>('/auth/me', {
    method: 'GET',
  });

  const user = normalizeAuthUser(payload);
  return normalizeUserShape(user);
}

export async function getMe(): Promise<AuthenticatedUser> {
  return getCurrentUser();
}

export function getCompanyNameFromUser(user: AuthenticatedUser) {
  return extractCompanyName(user);
}

export async function registerUser(payload: Omit<SupplierRegisterPayload, 'latitude' | 'longitude'>) {
  return api<unknown>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      companyName: payload.empresaNome,
      cnpj: payload.cnpj,
      address: payload.endereco,
      phone: payload.telefone,
      companyEmail: payload.empresaEmail,
      adminName: payload.adminNome,
      adminEmail: payload.adminEmail,
      password: payload.adminSenha,
    }),
  });
}

export async function loginMobileWithBearer(payload: LoginPayload) {
  return api<unknown>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: payload.email.trim(),
      password: payload.senha,
    }),
  });
}

export async function withAuthHeader<T>(path: string, token: string, init?: RequestInit) {
  return api<T>(path, {
    ...init,
    headers: {
      ...init?.headers,
      Authorization: `Bearer ${token}`,
    },
  });
}
