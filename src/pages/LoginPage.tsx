import { Moon, Sun } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import type { AuthResult } from '../services/auth';
import { loginSupplier } from '../services/auth';

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
      setFormError(error instanceof Error ? error.message : 'Nao foi possivel autenticar.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#050505] dark:bg-[#050505] light:bg-gray-50 transition-colors duration-300 flex items-center justify-center px-4">
      <button
        type="button"
        onClick={toggleTheme}
        className="absolute top-5 right-5 inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[#2a2a2a] light:border-gray-300 bg-[#141414] dark:bg-[#141414] light:bg-white text-gray-300 light:text-gray-700 hover:text-[#00ff66] transition-colors"
      >
        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        <span className="text-sm font-medium">{theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}</span>
      </button>

      <div className="w-full max-w-md bg-[#141414] dark:bg-[#141414] light:bg-white border border-[#222222] light:border-gray-200 rounded-2xl p-6 md:p-8 shadow-card">
        <div className="mb-6">
          <div className="w-10 h-10 bg-[#00ff66] rounded-lg flex items-center justify-center mb-3">
            <span className="text-black font-bold">R</span>
          </div>
          <h1 className="text-2xl font-bold !text-white dark:!text-white light:!text-gray-900">Entrar na Rotalog</h1>
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
