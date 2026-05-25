import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { AuthResult } from '../services/auth';
import { registerSupplier } from '../services/auth';
import { ApiError } from '../services/api';
import { ThemeToggleButton } from '../Components/ThemeToggleButton';

interface RegisterPageProps {
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  onRegister: (result: AuthResult) => void;
}

interface RegisterFormState {
  empresaNome: string;
  cnpj: string;
  endereco: string;
  telefone: string;
  empresaEmail: string;
  adminNome: string;
  adminEmail: string;
  adminSenha: string;
}

function formatCnpj(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  return digits
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 11);

  if (digits.length <= 10) {
    return digits
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d{1,4})$/, '$1-$2');
  }

  return digits
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d{1,4})$/, '$1-$2');
}


export function RegisterPage({ theme, toggleTheme, onRegister }: RegisterPageProps) {
  const navigate = useNavigate();
  const [form, setForm] = useState<RegisterFormState>({
    empresaNome: '',
    cnpj: '',
    endereco: '',
    telefone: '',
    empresaEmail: '',
    adminNome: '',
    adminEmail: '',
    adminSenha: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateForm = () => {
    const nextErrors: Record<string, string> = {};
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const cnpjDigits = form.cnpj.replace(/\D/g, '');
    const phoneDigits = form.telefone.replace(/\D/g, '');

    if (form.empresaNome.trim().length < 2) {
      nextErrors.empresaNome = 'Informe o nome da empresa.';
    }
    if (cnpjDigits.length !== 14) {
      nextErrors.cnpj = 'CNPJ deve ter 14 digitos.';
    }
    if (form.endereco.trim().length < 5) {
      nextErrors.endereco = 'Informe um endereco valido.';
    }
    if (phoneDigits.length < 10) {
      nextErrors.telefone = 'Telefone invalido.';
    }
    if (!emailPattern.test(form.empresaEmail.trim())) {
      nextErrors.empresaEmail = 'E-mail da empresa invalido.';
    }
    if (form.adminNome.trim().length < 2) {
      nextErrors.adminNome = 'Informe o nome do admin.';
    }
    if (!emailPattern.test(form.adminEmail.trim())) {
      nextErrors.adminEmail = 'E-mail do admin invalido.';
    }
    if (form.adminSenha.length < 8) {
      nextErrors.adminSenha = 'A senha deve ter no minimo 8 caracteres.';
    }

    return nextErrors;
  };

  const handleRegister = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitError('');

    const validationErrors = validateForm();
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    try {
      setIsSubmitting(true);
      const auth = await registerSupplier({
        empresaNome: form.empresaNome.trim(),
        cnpj: form.cnpj.trim(),
        endereco: form.endereco.trim(),
        telefone: form.telefone.trim(),
        empresaEmail: form.empresaEmail.trim(),
        adminNome: form.adminNome.trim(),
        adminEmail: form.adminEmail.trim(),
        adminSenha: form.adminSenha,
        latitude: -23.5505,
        longitude: -46.6333,
      });

      const hasSessionUser = typeof auth.user?.id === 'string'
        ? auth.user.id.trim().length > 0
        : typeof auth.user?.id === 'number';

      onRegister(auth);

      if (hasSessionUser) {
        navigate('/dashboard');
        return;
      }

      navigate('/login', {
        replace: true,
        state: {
          infoMessage: 'Cadastro concluido. Entre com seu e-mail e senha para continuar.',
        },
      });
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 400) {
          setSubmitError('Verifique os dados informados.');
        } else if (error.status === 403) {
          setSubmitError('Você não tem permissão para realizar este cadastro.');
        } else if (error.status === 409) {
          setSubmitError('Este e-mail já está cadastrado.');
        } else if (error.status >= 500) {
          setSubmitError('Erro interno no servidor. Tente novamente em instantes.');
        } else {
          setSubmitError(error.message || 'Não foi possível concluir cadastro.');
        }
      } else if (error instanceof TypeError) {
        setSubmitError('Não foi possível conectar à API.');
      } else {
        setSubmitError(error instanceof Error ? error.message : 'Não foi possível concluir cadastro.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#050505] dark:bg-[#050505] light:bg-gray-50 transition-colors duration-300 flex flex-col items-center justify-start md:justify-center px-4 py-8 md:py-12">
      <ThemeToggleButton theme={theme} onClick={toggleTheme} className="fixed top-4 right-4 sm:top-5 sm:right-5 z-10" />

      <div className="w-full max-w-2xl bg-[#141414] dark:bg-[#141414] light:bg-white border border-[#222222] light:border-gray-200 rounded-2xl p-6 shadow-card">
        <div className="mb-6">
          <h1 className="text-2xl font-bold !text-white dark:!text-white light:!text-gray-900">Criar conta</h1>
          <p className="text-sm text-gray-400 light:text-gray-500 mt-1">Cadastre sua empresa e administrador.</p>
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label htmlFor="empresaNome" className="block text-sm font-medium text-gray-200 light:text-gray-700 mb-2">Nome da empresa</label>
              <input
                id="empresaNome"
                type="text"
                value={form.empresaNome}
                onChange={event => setForm(current => ({ ...current, empresaNome: event.target.value }))}
                className="w-full rounded-lg bg-[#0f0f0f] dark:bg-[#0f0f0f] light:bg-gray-50 border border-[#2a2a2a] light:border-gray-300 px-3 py-2 text-sm text-white dark:text-white light:text-gray-900"
                placeholder="Distribuidora Exemplo"
              />
              {errors.empresaNome && <p className="mt-1 text-xs text-red-400 light:text-red-700">{errors.empresaNome}</p>}
            </div>

            <div>
              <label htmlFor="cnpj" className="block text-sm font-medium text-gray-200 light:text-gray-700 mb-2">CNPJ</label>
              <input
                id="cnpj"
                type="text"
                value={form.cnpj}
                onChange={event => setForm(current => ({ ...current, cnpj: formatCnpj(event.target.value) }))}
                inputMode="numeric"
                maxLength={18}
                className="w-full rounded-lg bg-[#0f0f0f] dark:bg-[#0f0f0f] light:bg-gray-50 border border-[#2a2a2a] light:border-gray-300 px-4 py-2.5 text-sm text-white dark:text-white light:text-gray-900"
                placeholder="00.000.000/0001-00"
              />
              {errors.cnpj && <p className="mt-1 text-xs text-red-400 light:text-red-700">{errors.cnpj}</p>}
            </div>

            <div>
              <label htmlFor="telefone" className="block text-sm font-medium text-gray-200 light:text-gray-700 mb-2">Telefone</label>
              <input
                id="telefone"
                type="text"
                value={form.telefone}
                onChange={event => setForm(current => ({ ...current, telefone: formatPhone(event.target.value) }))}
                inputMode="numeric"
                maxLength={15}
                className="w-full rounded-lg bg-[#0f0f0f] dark:bg-[#0f0f0f] light:bg-gray-50 border border-[#2a2a2a] light:border-gray-300 px-4 py-2.5 text-sm text-white dark:text-white light:text-gray-900"
                placeholder="(11) 99999-9999"
              />
              {errors.telefone && <p className="mt-1 text-xs text-red-400 light:text-red-700">{errors.telefone}</p>}
            </div>

            <div className="md:col-span-2">
              <label htmlFor="endereco" className="block text-sm font-medium text-gray-200 light:text-gray-700 mb-2">Endereco</label>
              <input
                id="endereco"
                type="text"
                value={form.endereco}
                onChange={event => setForm(current => ({ ...current, endereco: event.target.value }))}
                className="w-full rounded-lg bg-[#0f0f0f] dark:bg-[#0f0f0f] light:bg-gray-50 border border-[#2a2a2a] light:border-gray-300 px-4 py-2.5 text-sm text-white dark:text-white light:text-gray-900"
                placeholder="Rua, numero, bairro, cidade"
              />
              {errors.endereco && <p className="mt-1 text-xs text-red-400 light:text-red-700">{errors.endereco}</p>}
            </div>

            <div>
              <label htmlFor="empresaEmail" className="block text-sm font-medium text-gray-200 light:text-gray-700 mb-2">E-mail da empresa</label>
              <input
                id="empresaEmail"
                type="email"
                value={form.empresaEmail}
                onChange={event => setForm(current => ({ ...current, empresaEmail: event.target.value }))}
                className="w-full rounded-lg bg-[#0f0f0f] dark:bg-[#0f0f0f] light:bg-gray-50 border border-[#2a2a2a] light:border-gray-300 px-4 py-2.5 text-sm text-white dark:text-white light:text-gray-900"
                placeholder="contato@empresa.com"
              />
              {errors.empresaEmail && <p className="mt-1 text-xs text-red-400 light:text-red-700">{errors.empresaEmail}</p>}
            </div>

            <div>
              <label htmlFor="adminNome" className="block text-sm font-medium text-gray-200 light:text-gray-700 mb-2">Nome do admin</label>
              <input
                id="adminNome"
                type="text"
                value={form.adminNome}
                onChange={event => setForm(current => ({ ...current, adminNome: event.target.value }))}
                className="w-full rounded-lg bg-[#0f0f0f] dark:bg-[#0f0f0f] light:bg-gray-50 border border-[#2a2a2a] light:border-gray-300 px-4 py-2.5 text-sm text-white dark:text-white light:text-gray-900"
                placeholder="Nome do responsavel"
              />
              {errors.adminNome && <p className="mt-1 text-xs text-red-400 light:text-red-700">{errors.adminNome}</p>}
            </div>

            <div>
              <label htmlFor="adminEmail" className="block text-sm font-medium text-gray-200 light:text-gray-700 mb-2">E-mail do admin</label>
              <input
                id="adminEmail"
                type="email"
                value={form.adminEmail}
                onChange={event => setForm(current => ({ ...current, adminEmail: event.target.value }))}
                className="w-full rounded-lg bg-[#0f0f0f] dark:bg-[#0f0f0f] light:bg-gray-50 border border-[#2a2a2a] light:border-gray-300 px-4 py-2.5 text-sm text-white dark:text-white light:text-gray-900"
                placeholder="admin@empresa.com"
              />
              {errors.adminEmail && <p className="mt-1 text-xs text-red-400 light:text-red-700">{errors.adminEmail}</p>}
            </div>

            <div className="md:col-span-2">
              <label htmlFor="adminSenha" className="block text-sm font-medium text-gray-200 light:text-gray-700 mb-2">Senha do admin</label>
              <input
                id="adminSenha"
                type="password"
                value={form.adminSenha}
                onChange={event => setForm(current => ({ ...current, adminSenha: event.target.value }))}
                className="w-full rounded-lg bg-[#0f0f0f] dark:bg-[#0f0f0f] light:bg-gray-50 border border-[#2a2a2a] light:border-gray-300 px-4 py-2.5 text-sm text-white dark:text-white light:text-gray-900"
                placeholder="Minimo 8 caracteres"
              />
              {errors.adminSenha && <p className="mt-1 text-xs text-red-400 light:text-red-700">{errors.adminSenha}</p>}
            </div>
          </div>


          {submitError && (
            <p className="text-sm text-red-400 light:text-red-700">{submitError}</p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-[#00ff66] text-black font-semibold py-2.5 text-base hover:brightness-95 transition mt-4"
          >
            {isSubmitting ? 'Finalizando...' : 'Finalizar cadastro'}
          </button>
        </form>

        <p className="text-sm text-gray-400 light:text-gray-600 mt-4 text-center">
          Ja possui conta?{' '}
          <Link to="/login" className="text-[#00ff66] font-medium hover:underline">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}
