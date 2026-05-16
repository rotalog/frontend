import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useTheme } from './hooks/useTheme';
import { DashboardPage } from './pages/DashboardPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import type { AuthResult } from './services/auth';
import { getCompanyNameFromUser, getCurrentUser, logoutSupplier } from './services/auth';

function App() {
  const { theme, toggleTheme } = useTheme();
  // ALTERACAO: sessao agora vem do backend (cookie HttpOnly), nao de localStorage.
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [companyName, setCompanyName] = useState('Fornecedor');
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const bootstrapSession = async () => {
      try {
        const user = await getCurrentUser();
        if (!active) {
          return;
        }

        setCompanyName(getCompanyNameFromUser(user));
        setIsAuthenticated(true);
      } catch {
        if (!active) {
          return;
        }

        setCompanyName('Fornecedor');
        setIsAuthenticated(false);
      } finally {
        if (active) {
          setIsAuthLoading(false);
        }
      }
    };

    void bootstrapSession();

    return () => {
      active = false;
    };
  }, []);

  const handleLogin = ({ companyName: loggedCompany }: AuthResult) => {
    setCompanyName(loggedCompany);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    // ALTERACAO: invalida sessao no backend e limpa estado local.
    void logoutSupplier().catch(() => undefined);
    setCompanyName('Fornecedor');
    setIsAuthenticated(false);
  };

  if (isAuthLoading) {
    return (
      <div className="min-h-screen w-full bg-[#050505] dark:bg-[#050505] light:bg-gray-50 flex items-center justify-center text-sm text-gray-300 light:text-gray-700">
        Validando sessao...
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route
          path="/login"
          element={
            isAuthenticated
              ? <Navigate to="/dashboard" replace />
              : <LoginPage theme={theme} toggleTheme={toggleTheme} onLogin={handleLogin} />
          }
        />
        <Route
          path="/cadastro"
          element={
            isAuthenticated
              ? <Navigate to="/dashboard" replace />
              : <RegisterPage theme={theme} toggleTheme={toggleTheme} onRegister={handleLogin} />
          }
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