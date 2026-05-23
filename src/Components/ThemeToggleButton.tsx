import { Moon, Sun } from 'lucide-react';

interface ThemeToggleButtonProps {
  theme: 'dark' | 'light';
  onClick: () => void;
  className?: string;
}

export function ThemeToggleButton({ theme, onClick, className = '' }: ThemeToggleButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[#2a2a2a] light:border-gray-300 bg-[#141414] dark:bg-[#141414] light:bg-white text-gray-300 light:text-gray-700 hover:text-[#00ff66] transition-colors ${className}`}
    >
      {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
      <span className="text-sm font-medium">{theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}</span>
    </button>
  );
}
