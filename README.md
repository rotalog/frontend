# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

## Integracao com Backend (RotaLog API)

O frontend esta configurado para consumir autenticacao em `/api/v1/auth/*` com cookie HttpOnly.

1. Configure a URL base da API criando um arquivo `.env` na raiz do projeto:

```env
VITE_API_URL=http://localhost:3000/api/v1
```

1. Se frontend e backend estiverem no mesmo dominio, `VITE_API_URL` pode ficar vazio.
1. As chamadas enviam `credentials: include`, permitindo sessao por cookie.

Rotas de auth usadas no frontend:

1. `POST /api/v1/auth/login`
1. `POST /api/v1/auth/register/supplier`
1. `GET /api/v1/auth/me`
1. `POST /api/v1/auth/refresh` (helper disponivel no service)
1. `POST /api/v1/auth/forgot-password` (helper disponivel no service)
1. `POST /api/v1/auth/logout`

### Erro comum no login

Se aparecer a mensagem de falha de comunicacao:

1. Confirme que o backend esta rodando em `http://localhost:3000`.
1. Confirme que a API responde em `/api/v1/auth/login`.
1. Se usar outra porta/host, ajuste `VITE_API_URL`.
1. Reinicie o frontend apos alterar `.env`.
