import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import type { AuthResult } from '../services/auth';
import { loginSupplier } from '../services/auth';
import { ApiError } from '../services/api';
import { RotalogBrand } from '../Components/RotalogBrand';
import { ThemeToggleButton } from '../Components/ThemeToggleButton';

interface LoginPageProps {
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  onLogin: (result: AuthResult) => void;
}

export function LoginPage({ theme, toggleTheme, onLogin }: LoginPageProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const infoMessage = (
    location.state &&
    typeof location.state === 'object' &&
    'infoMessage' in location.state &&
    typeof location.state.infoMessage === 'string'
  )
    ? location.state.infoMessage
    : '';
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateForm = () => {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email.trim())) {
      return 'Informe um e-mail valido.';
    }

    if (senha.trim().length < 6) {
      return 'A senha deve ter no minimo 6 caracteres.';
    }

    return '';
  };

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError('');

    const validationError = validateForm();
    if (validationError) {
      setFormError(validationError);
      return;
    }

    try {
      setIsSubmitting(true);
      const auth = await loginSupplier({ email: email.trim(), senha });
      onLogin(auth);
      navigate('/dashboard');
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 401 || error.status === 403) {
          setFormError('E-mail ou senha inválidos.');
        } else if (error.status >= 500) {
          setFormError('Erro interno no servidor. Tente novamente em instantes.');
        } else {
          setFormError(error.message || 'Não foi possível autenticar.');
        }
      } else if (error instanceof TypeError) {
        setFormError('Não foi possível conectar à API.');
      } else {
        setFormError(error instanceof Error ? error.message : 'Não foi possível autenticar.');
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
          <h1 className="text-2xl font-bold !text-white dark:!text-white light:!text-gray-900">Login</h1>
          <p className="text-sm text-gray-400 light:text-gray-500 mt-1">Use suas credenciais para acessar o painel.</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          {infoMessage && (
            <p className="text-sm text-emerald-400 light:text-emerald-700">{infoMessage}</p>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-200 light:text-gray-700 mb-1">E-mail</label>
            <input
              id="email"
              name="email"
              type="email"
              required
              value={email}
              onChange={event => setEmail(event.target.value)}
              className="w-full rounded-lg bg-[#0f0f0f] dark:bg-[#0f0f0f] light:bg-gray-50 border border-[#2a2a2a] light:border-gray-300 px-3 py-2.5 text-sm text-white dark:text-white light:text-gray-900 placeholder:text-gray-500 outline-none focus:border-[#00ff66] transition-colors"
              placeholder="seuemail@empresa.com"
            />
          </div>

          <div>
            <label htmlFor="senha" className="block text-sm font-medium text-gray-200 light:text-gray-700 mb-1">Senha</label>
            <input
              id="senha"
              name="senha"
              type="password"
              required
              value={senha}
              onChange={event => setSenha(event.target.value)}
              className="w-full rounded-lg bg-[#0f0f0f] dark:bg-[#0f0f0f] light:bg-gray-50 border border-[#2a2a2a] light:border-gray-300 px-3 py-2.5 text-sm text-white dark:text-white light:text-gray-900 placeholder:text-gray-500 outline-none focus:border-[#00ff66] transition-colors"
              placeholder="Digite sua senha"
            />
          </div>

          <div className="flex justify-end">
            <Link to="/forgot-password" className="text-xs text-[#00ff66] font-medium hover:underline">
              Esqueci minha senha
            </Link>
          </div>

          {formError && (
            <p className="text-sm text-red-400 light:text-red-700">{formError}</p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-[#00ff66] text-black font-semibold py-2.5 hover:brightness-95 transition"
          >
            {isSubmitting ? 'Validando...' : 'Acessar painel'}
          </button>
        </form>

        <p className="text-sm text-gray-400 light:text-gray-600 mt-5 text-center">
          Nao tem conta?{' '}
          <Link to="/cadastro" className="text-[#00ff66] font-medium hover:underline">
            Criar cadastro
          </Link>
        </p>
      </div>
    </div>
  );
}
