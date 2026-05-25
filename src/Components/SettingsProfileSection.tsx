import type { AuthenticatedUser } from '../services/auth';
import type { ApiSupplier } from '../types/suppliers';

type SupplierDraft = {
  companyName: string;
  companyEmail: string;
  address: string;
  phone: string;
  cnpj: string;
};

interface SettingsProfileSectionProps {
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  onLogout: () => void;
  currentUser: AuthenticatedUser | null;
  companyName: string;
  supplierId: string;
  supplierProfile: ApiSupplier | null;
  isLoadingSupplierProfile: boolean;
  supplierProfileError: string;
  supplierDraft: SupplierDraft;
  onSupplierDraftChange: (field: keyof SupplierDraft, value: string) => void;
  onSaveSupplier: () => void;
  isSavingSupplier: boolean;
  supplierSaveError: string;
  supplierSaveMessage: string;
  canEditSupplier: boolean;
}

function displayValue(value: unknown): string {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return 'Não informado';
}

function getRoleLabel(role: unknown): string {
  if (typeof role !== 'string' || !role.trim()) {
    return 'Fornecedor';
  }

  const normalized = role.trim().toLowerCase();
  const labels: Record<string, string> = {
    supplier: 'Fornecedor',
    admin: 'Administrador',
    user: 'Usuário',
  };

  return labels[normalized] ?? role;
}

function getSupplierStatusLabel(supplierProfile: ApiSupplier | null): string {
  if (!supplierProfile) {
    return 'Não informado';
  }

  const status = supplierProfile.status;
  if (typeof status === 'string' && status.trim()) {
    return status;
  }

  const active = supplierProfile.active;
  if (typeof active === 'boolean') {
    return active ? 'Ativa' : 'Inativa';
  }

  return 'Não informado';
}

function cardClassName() {
  return 'rounded-xl border border-[#222222] bg-[#141414] p-5 light:border-gray-200 light:bg-white';
}

function inputClassName() {
  return 'mt-2 w-full rounded-md border border-[#2a2a2a] bg-[#0d0d0d] px-3 py-2.5 text-sm text-white outline-none transition-colors focus:border-[#00ff66]/40 light:border-gray-200 light:bg-gray-50 light:text-gray-900';
}

function renderReadOnlyField(label: string, value: unknown, hint?: string) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-gray-500 light:text-gray-600">{label}</p>
      <p className="mt-2 text-sm font-medium text-white dark:text-white light:text-gray-900">{displayValue(value)}</p>
      {hint && (
        <p className="mt-1 text-[11px] text-gray-500 light:text-gray-600">{hint}</p>
      )}
    </div>
  );
}

export function SettingsProfileSection({
  theme,
  toggleTheme,
  onLogout,
  currentUser,
  companyName,
  supplierId,
  supplierProfile,
  isLoadingSupplierProfile,
  supplierProfileError,
  supplierDraft,
  onSupplierDraftChange,
  onSaveSupplier,
  isSavingSupplier,
  supplierSaveError,
  supplierSaveMessage,
  canEditSupplier,
}: SettingsProfileSectionProps) {
  return (
    <div className="mt-8 space-y-6">
      <div className={cardClassName()}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white dark:text-white light:text-gray-900">Configurações</h2>
            <p className="mt-1 text-sm text-gray-400 light:text-gray-600">
              Visualize sua conta, ajuste preferências locais do painel e acompanhe o status das integrações.
            </p>
          </div>
          <span className="w-fit rounded-full border border-[#00ff66]/30 bg-[#00ff66]/10 px-3 py-1 text-xs font-semibold text-[#00ff66] light:bg-green-100 light:text-green-700">
            Painel do fornecedor
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section className={cardClassName()}>
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-white dark:text-white light:text-gray-900">Perfil do usuário</h3>
              <p className="mt-1 text-xs text-gray-500 light:text-gray-600">Dados da sessão autenticada carregados pelo auth atual.</p>
            </div>
            <span className="rounded-full bg-[#1a1a1a] px-3 py-1 text-xs font-medium text-gray-400 light:bg-gray-100 light:text-gray-700">
              Somente leitura
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {renderReadOnlyField('Nome', currentUser?.name ?? currentUser?.nome)}
            {renderReadOnlyField('E-mail', currentUser?.email)}
            {renderReadOnlyField('Perfil / Função', getRoleLabel(currentUser?.role))}
            {renderReadOnlyField('Empresa em sessão', companyName || currentUser?.companyName || currentUser?.empresaNome)}
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {renderReadOnlyField('ID do usuário', currentUser?.id, 'Exibido apenas para referência.')}
            {renderReadOnlyField('Supplier ID', supplierId, 'Exibido apenas para referência.')}
          </div>

          <div className="mt-5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300 light:bg-amber-100 light:text-amber-700">
            A edição de perfil do usuário ainda não está disponível no backend.
          </div>
        </section>

        <section className={cardClassName()}>
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-white dark:text-white light:text-gray-900">Dados do fornecedor</h3>
              <p className="mt-1 text-xs text-gray-500 light:text-gray-600">Campos atualizáveis via endpoint real do fornecedor quando disponíveis.</p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
              canEditSupplier
                ? 'bg-[#00ff66]/10 text-[#00ff66] light:bg-green-100 light:text-green-700'
                : 'bg-[#1a1a1a] text-gray-400 light:bg-gray-100 light:text-gray-700'
            }`}>
              {canEditSupplier ? 'Edição disponível' : 'Edição indisponível'}
            </span>
          </div>

          {isLoadingSupplierProfile && (
            <p className="mb-4 text-sm text-gray-500 light:text-gray-600">Carregando dados do fornecedor...</p>
          )}

          {!isLoadingSupplierProfile && supplierProfileError && (
            <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300 light:bg-amber-100 light:text-amber-700">
              {supplierProfileError}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs uppercase tracking-wide text-gray-500 light:text-gray-600">Nome da empresa</span>
              <input
                type="text"
                value={supplierDraft.companyName}
                onChange={event => onSupplierDraftChange('companyName', event.target.value)}
                disabled={!canEditSupplier || isLoadingSupplierProfile}
                className={inputClassName()}
              />
            </label>

            <label className="block">
              <span className="text-xs uppercase tracking-wide text-gray-500 light:text-gray-600">E-mail da conta</span>
              <input
                type="email"
                value={supplierDraft.companyEmail}
                onChange={event => onSupplierDraftChange('companyEmail', event.target.value)}
                disabled={!canEditSupplier || isLoadingSupplierProfile}
                className={inputClassName()}
              />
            </label>

            <label className="block">
              <span className="text-xs uppercase tracking-wide text-gray-500 light:text-gray-600">Telefone</span>
              <input
                type="text"
                value={supplierDraft.phone}
                onChange={event => onSupplierDraftChange('phone', event.target.value)}
                disabled={!canEditSupplier || isLoadingSupplierProfile}
                className={inputClassName()}
              />
            </label>

            <label className="block">
              <span className="text-xs uppercase tracking-wide text-gray-500 light:text-gray-600">CNPJ</span>
              <input
                type="text"
                value={supplierDraft.cnpj}
                onChange={event => onSupplierDraftChange('cnpj', event.target.value)}
                disabled={!canEditSupplier || isLoadingSupplierProfile}
                className={inputClassName()}
              />
            </label>

            <label className="block sm:col-span-2">
              <span className="text-xs uppercase tracking-wide text-gray-500 light:text-gray-600">Endereço</span>
              <input
                type="text"
                value={supplierDraft.address}
                onChange={event => onSupplierDraftChange('address', event.target.value)}
                disabled={!canEditSupplier || isLoadingSupplierProfile}
                className={inputClassName()}
              />
            </label>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {renderReadOnlyField('Supplier ID', supplierProfile?.id ?? supplierId)}
            {renderReadOnlyField('Status da conta', getSupplierStatusLabel(supplierProfile))}
          </div>

          {supplierSaveMessage && (
            <p className="mt-4 text-sm text-[#00ff66] light:text-green-700">{supplierSaveMessage}</p>
          )}

          {supplierSaveError && (
            <p className="mt-4 text-sm text-amber-300 light:text-amber-700">{supplierSaveError}</p>
          )}

          {canEditSupplier ? (
            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-gray-500 light:text-gray-600">As alterações são enviadas ao backend pelo endpoint real do fornecedor.</p>
              <button
                type="button"
                onClick={onSaveSupplier}
                disabled={isSavingSupplier || isLoadingSupplierProfile}
                className="rounded-md bg-[#00ff66] px-4 py-2.5 text-sm font-bold text-black transition-colors hover:bg-[#22ff7a] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSavingSupplier ? 'Salvando...' : 'Salvar alterações'}
              </button>
            </div>
          ) : (
            <p className="mt-5 text-sm text-gray-500 light:text-gray-600">Edição indisponível no momento.</p>
          )}
        </section>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section className={cardClassName()}>
          <h3 className="text-base font-semibold text-white dark:text-white light:text-gray-900">Preferências do painel</h3>
          <p className="mt-1 text-xs text-gray-500 light:text-gray-600">O tema é salvo localmente no navegador para esta interface.</p>

          <div className="mt-5 rounded-lg border border-[#222222] bg-[#0d0d0d] p-4 light:border-gray-200 light:bg-gray-50">
            <p className="text-xs uppercase tracking-wide text-gray-500 light:text-gray-600">Tema atual</p>
            <p className="mt-2 text-sm font-semibold text-white dark:text-white light:text-gray-900">
              {theme === 'dark' ? 'Escuro' : 'Claro'}
            </p>
            <button
              type="button"
              onClick={toggleTheme}
              className="mt-4 rounded-md border border-[#2a2a2a] px-4 py-2 text-sm font-semibold text-gray-200 transition-colors hover:bg-[#1a1a1a] light:border-gray-200 light:text-gray-800 light:hover:bg-gray-100"
            >
              Alternar para modo {theme === 'dark' ? 'claro' : 'escuro'}
            </button>
          </div>
        </section>

        <section className={cardClassName()}>
          <h3 className="text-base font-semibold text-white dark:text-white light:text-gray-900">Sessão e segurança</h3>
          <p className="mt-1 text-xs text-gray-500 light:text-gray-600">Seu token continua em memória. Nenhum dado sensível é salvo em localStorage.</p>

          <div className="mt-5 rounded-lg border border-[#222222] bg-[#0d0d0d] p-4 light:border-gray-200 light:bg-gray-50">
            <p className="text-sm text-white dark:text-white light:text-gray-900">Você está conectado como fornecedor.</p>
            <p className="mt-2 text-xs text-gray-500 light:text-gray-600">Use o logout já existente para encerrar a sessão atual.</p>
            <button
              type="button"
              onClick={onLogout}
              className="mt-4 rounded-md border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-300 transition-colors hover:bg-red-500/20 light:bg-red-50 light:text-red-700"
            >
              Sair da conta
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}