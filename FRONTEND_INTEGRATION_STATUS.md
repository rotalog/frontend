# Status da Integracao Frontend/Backend - RotaLog

## Modulos integrados
- Auth
- Dashboard
- Produtos
- Estoque parcial
- Pedidos
- Rotas e entregas
- Relatorios
- Pagamentos
- Reviews
- Realtime opcional
- Perfil e configuracoes

## Pendencias de backend
- Inventory PUT retornando 404 para produto existente.
- WebSocket /ws falhando conexao.

## Como configurar ambiente local
.env:
VITE_API_URL=/api/v1
VITE_WS_URL=wss://api.rotalog.madebyhermes.com/ws
VITE_USE_API=true

## Como testar localmente
npm install
npm run dev

## Checklist antes do push
- npx tsc -b sem erros
- .env nao versionado
- Sem token hardcoded
- Login/cadastro funcionando
- Produtos funcionando
- Pedidos vazios sem pedido fantasma
- Exportacao Excel funcionando