import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { RotalogBrand } from '../Components/RotalogBrand';
import { ThemeToggleButton } from '../Components/ThemeToggleButton';
import { resetPassword } from '../services/auth';
import { ApiError } from '../services/api';

interface ResetPasswordPageProps {
  theme: 'dark' | 'light';
  toggleTheme: () => void;
}

export function ResetPasswordPage({ theme, toggleTheme }: ResetPasswordPageProps) {
  const location = useLocation();
  const params = useParams<{ token?: string }>();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [formError, setFormError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const token = useMemo(() => {
    const searchParams = new URLSearchParams(location.search);
    const tokenFromQuery = searchParams.get('token');
    if (typeof tokenFromQuery === 'string' && tokenFromQuery.trim()) {
      return tokenFromQuery.trim();
    }

    if (typeof params.token === 'string' && params.token.trim()) {
      return params.token.trim();
    }

    return '';
  }, [location.search, params.token]);

  const validateForm = () => {
    if (!token) {
      return 'Token de redefinição obrigatório.';
    }

    if (!password) {
      return 'Senha obrigatória.';
    }

    if (password.length < 8) {
      return 'A senha deve ter pelo menos 8 caracteres.';
    }

    if (confirmPassword !== password) {
      return 'Confirmação precisa ser igual à senha.';
    }

    return '';
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError('');
    setSuccessMessage('');

    const validationError = validateForm();
    if (validationError) {
      setFormError(validationError);
      return;
    }

    try {
      setIsSubmitting(true);
      await resetPassword({ token, newPassword: password });
      setPassword('');
      setConfirmPassword('');
      setSuccessMessage('Senha alterada com sucesso. Faça login com sua nova senha.');
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 400) {
          setFormError('Link inválido ou dados incorretos.');
        } else if (error.status === 404) {
          setFormError('Token de redefinição não encontrado ou expirado.');
        } else if (error.status === 409) {
          setFormError('Não foi possível redefinir essa senha no momento.');
        } else if (error.status >= 500) {
          setFormError('Erro interno no servidor. Tente novamente em instantes.');
        } else {
          setFormError(error.message || 'Não foi possível redefinir a senha.');
        }
      } else if (error instanceof TypeError) {
        setFormError('Não foi possível conectar à API.');
      } else {
        setFormError(error instanceof Error ? error.message : 'Não foi possível redefinir a senha.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#050505] dark:bg-[#050505] light:bg-gray-50 transition-colors duration-300 flex items-center justify-center px-4">
      <ThemeToggleButton theme={theme} onClick={toggleTheme} className="absolute top-5 right-5" />

      <div className="w-full max-w-md bg-[#141414] dark:bg-[#141414] light:bg-white border border-[#222222] light:border-gray-200 rounded-2xl p-6 md:p-8 shadow-card">
        <div className="mb-6">
          <RotalogBrand className="mb-4" iconClassName="h-16 w-16" textClassName="text-[2.6rem]" />
          <h1 className="text-2xl font-bold !text-white dark:!text-white light:!text-gray-900">Redefinir senha</h1>
          <p className="text-sm text-gray-400 light:text-gray-500 mt-1">Informe sua nova senha para concluir a redefinição.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-200 light:text-gray-700 mb-1">Nova senha</label>
            <input
              id="password"
              name="password"
              type="password"
              required
              value={password}
              onChange={event => setPassword(event.target.value)}
              className="w-full rounded-lg bg-[#0f0f0f] dark:bg-[#0f0f0f] light:bg-gray-50 border border-[#2a2a2a] light:border-gray-300 px-3 py-2.5 text-sm text-white dark:text-white light:text-gray-900 placeholder:text-gray-500 outline-none focus:border-[#00ff66] transition-colors"
              placeholder="Mínimo 8 caracteres"
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-200 light:text-gray-700 mb-1">Confirmar nova senha</label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              required
              value={confirmPassword}
              onChange={event => setConfirmPassword(event.target.value)}
              className="w-full rounded-lg bg-[#0f0f0f] dark:bg-[#0f0f0f] light:bg-gray-50 border border-[#2a2a2a] light:border-gray-300 px-3 py-2.5 text-sm text-white dark:text-white light:text-gray-900 placeholder:text-gray-500 outline-none focus:border-[#00ff66] transition-colors"
              placeholder="Repita a nova senha"
            />
          </div>

          {successMessage && (
            <p className="text-sm text-emerald-400 light:text-emerald-700">{successMessage}</p>
          )}

          {formError && (
            <p className="text-sm text-red-400 light:text-red-700">{formError}</p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-[#00ff66] text-black font-semibold py-2.5 hover:brightness-95 transition disabled:opacity-70"
          >
            {isSubmitting ? 'Alterando...' : 'Alterar senha'}
          </button>
        </form>

        <p className="text-sm text-gray-400 light:text-gray-600 mt-5 text-center">
          <Link to="/login" className="text-[#00ff66] font-medium hover:underline">
            Voltar para o login
          </Link>
        </p>
      </div>
    </div>
  );
}
