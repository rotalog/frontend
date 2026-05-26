import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { RotalogBrand } from './Components/RotalogBrand';
import { useTheme } from './hooks/useTheme';
import { DashboardPage } from './pages/DashboardPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage.tsx';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage.tsx';
import type { AuthResult, AuthenticatedUser } from './services/auth';
import { getCompanyNameFromUser, getCurrentUser, logoutSupplier, refreshSession } from './services/auth';

function App() {
  const { theme, toggleTheme } = useTheme();
  const [currentUser, setCurrentUser] = useState<AuthenticatedUser | null>(null);
  const [companyName, setCompanyName] = useState<string>('');
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  useEffect(() => {
    let active = true;

    const PUBLIC_PATHS = ['/login', '/cadastro', '/register', '/forgot-password', '/reset-password'];
    const isPublicRoute = PUBLIC_PATHS.some(
      p => window.location.pathname === p || window.location.pathname.startsWith(p + '/'),
    );

    const bootstrapSession = async () => {
      if (isPublicRoute) {
        if (active) {
          setCurrentUser(null);
          setCompanyName('');
          setIsLoadingAuth(false);
        }
        return;
      }

      try {
        await refreshSession().catch(() => undefined);
        const user = await getCurrentUser();
        if (!active) {
          return;
        }

        setCurrentUser(user);
        setCompanyName(getCompanyNameFromUser(user));
      } catch {
        if (!active) {
          return;
        }

        setCurrentUser(null);
        setCompanyName('');
      } finally {
        if (active) {
          setIsLoadingAuth(false);
        }
      }
    };

    void bootstrapSession();

    return () => {
      active = false;
    };
  }, []);

  const handleLogin = (result: AuthResult) => {
    setCurrentUser(result.user);
    setCompanyName(result.companyName);
  };

  const handleRegister = (result: AuthResult) => {
    const hasSessionUser = typeof result.user?.id === 'string'
      ? result.user.id.trim().length > 0
      : typeof result.user?.id === 'number';

    if (!hasSessionUser) {
      setCurrentUser(null);
      setCompanyName('');
      return;
    }

    setCurrentUser(result.user);
    setCompanyName(result.companyName);
  };

  const handleLogout = async () => {
    await logoutSupplier().catch(() => undefined);
    setCurrentUser(null);
    setCompanyName('');
  };

  const isAuthenticated = currentUser !== null;

  if (isLoadingAuth) {
    return (
      <div className="min-h-screen w-full bg-[#050505] dark:bg-[#050505] light:bg-gray-50 flex flex-col items-center justify-center gap-4 text-sm text-gray-300 light:text-gray-700">
        <RotalogBrand iconClassName="h-20 w-20" textClassName="text-5xl" />
        <span>Carregando sessao...</span>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route
          path="/login"
          element={<LoginPage theme={theme} toggleTheme={toggleTheme} onLogin={handleLogin} />}
        />
        <Route
          path="/cadastro"
          element={<RegisterPage theme={theme} toggleTheme={toggleTheme} onRegister={handleRegister} />}
        />
        <Route
          path="/register"
          element={<RegisterPage theme={theme} toggleTheme={toggleTheme} onRegister={handleRegister} />}
        />
        <Route
          path="/forgot-password"
          element={<ForgotPasswordPage theme={theme} toggleTheme={toggleTheme} />}
        />
        <Route
          path="/reset-password"
          element={<ResetPasswordPage theme={theme} toggleTheme={toggleTheme} />}
        />
        <Route
          path="/reset-password/:token"
          element={<ResetPasswordPage theme={theme} toggleTheme={toggleTheme} />}
        />
        <Route
          path="/dashboard"
          element={
            isAuthenticated
              ? <DashboardPage theme={theme} toggleTheme={toggleTheme} onLogout={handleLogout} companyName={companyName} />
              : <Navigate to="/login" replace />
          }
        />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;