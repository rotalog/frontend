# Frontend Backend Integration Checklist

## Status geral da integração

Status atual: preparado para integração real com backend, com estratégia API-first e fallback controlado para manter a operação local durante instabilidade do backend.

Resumo executivo:
- Cliente HTTP centralizado com token em memória, refresh e tratamento de erros implementado.
- Fluxo de autenticação adaptado ao contrato real atual do backend.
- Dashboard, pedidos e estoque funcionando em modo API-first com fallback local.
- Camada de serviços REST ampla já criada para os domínios principais.
- Serviço de tempo real STOMP preparado, ainda não integrado às telas.

## O que já está pronto

- Cliente de API central em src/services/api.ts:
  - credentials include em todas as chamadas.
  - Authorization Bearer automático com token em memória.
  - Não sobrescreve Authorization se já vier nos headers da chamada.
  - Retry único em 401 com refresh.
  - Atualização e limpeza de token em memória.
  - Suporte a FormData sem Content-Type manual.
  - Suporte a 204 No Content.
  - Parse seguro de JSON e erro padronizado ApiError.

- Autenticação em src/services/auth.ts:
  - login e cadastro com contrato real atual (token no body).
  - token mantido em memória, sem persistência em storage.
  - getCurrentUser dependente de Authorization Bearer.
  - refreshSession atualiza token em memória.
  - logout limpa token em memória no finally.
  - fallback DEV restrito à ação de login.

- Sessão no aplicativo:
  - App usa getCurrentUser para bootstrap de sessão.
  - Sem critério de autenticação por token no localStorage.

- Serviços REST já preparados:
  - orders, inventory, products, reports, suppliers, routes, deliveryPoints, payments.

- Dashboard API-first com fallback:
  - tenta relatório, pedidos, inventário e rota do dia.
  - usa fallback de mock quando necessário.
  - feedback de loading e erro parcial.

- OrderTable API-first com fallback local:
  - ações de pedido tentam API antes de simulação local.
  - timeline pode consumir tracking por API.
  - mantém simulação temporária de novo pedido para demo.

- StockManagementSection API-first com fallback local:
  - update de estoque tenta API e cai para local se necessário.
  - importação CSV tenta API e cai para parser local se necessário.
  - CRUD de produto tenta API e cai para local se necessário.

- Realtime STOMP preparado:
  - createRealtimeClient e helpers de subscribe/publish.
  - uso de token em memória no CONNECT quando disponível.
  - falhas de WebSocket apenas com log em DEV.

## O que ainda depende do backend real

- Estabilização dos endpoints para eliminar fallback local e mensagens de modo demonstrativo.
- Garantia de formatos definitivos de DTOs (orders, inventory, reports, auth).
- Disponibilidade consistente de /auth/refresh com retorno de novo token.
- Disponibilidade consistente de /auth/me com user normalizado.
- Validação do handshake e autorização STOMP no backend.
- Integração das assinaturas STOMP nas telas (ordens, tracking, rota).

## Telas já API-first

- DashboardPage: API-first com fallback para mockOrders/mockStock.
- OrderTable: API-first para ações de pedido, fallback local.
- StockManagementSection: API-first para estoque/produto/import, fallback local.

## Telas/componentes ainda com fallback/mock

- DashboardPage: fallback para mockOrders e mockStock em indisponibilidade total/parcial.
- OrderTable: fallback local para ações e simulação temporária de novo pedido com setTimeout.
- StockManagementSection: fallback local para update/import/CRUD quando API falha.

## Como rodar o frontend

1. Instalar dependências:
   npm install
2. Criar arquivo .env a partir de .env.example.
3. Rodar em desenvolvimento:
   npm run dev
4. Build de validação:
   npx tsc -b

## Como configurar .env

Valores esperados:
- VITE_API_URL=/api/v1
- VITE_WS_URL=wss://api.rotalog.madebyhermes.com/ws

Observacao:
- Os valores anteriores com localhost:8080 ficam apenas como referencia legada para backend local e nao devem ser tratados como padrao atual do projeto.

## Observações sobre autenticação e token

- accessToken é armazenado apenas em memória de módulo no serviço de API.
- Não há persistência em localStorage ou sessionStorage para autenticação.
- logout limpa token em memória sempre.
- refresh tenta renovar token via /auth/refresh e atualizar memória.
- fallback DEV existe apenas no loginSupplier e apenas em import.meta.env.DEV.
- getCurrentUser não faz login automático fake.

## Observações sobre WebSocket

- Serviço STOMP já criado em src/services/realtime.ts.
- URL base configurável por VITE_WS_URL.
- Usa Authorization Bearer no CONNECT se token em memória existir.
- onStompError e onWebSocketError não quebram UI; apenas log em DEV.
- Ainda não integrado nas telas por decisão de etapa.

## Endpoints REST já preparados no frontend

### Auth
- POST /auth/login
- POST /auth/register/supplier
- POST /auth/register
- POST /auth/refresh
- POST /auth/forgot-password
- POST /auth/logout
- GET /auth/me

### Orders
- POST /orders
- GET /orders
- GET /orders/{id}
- PUT /orders/{id}/accept
- PUT /orders/{id}/reject
- PUT /orders/{id}/cancel
- PUT /orders/{id}/prepare
- PUT /orders/{id}/dispatch
- GET /orders/{id}/tracking

### Inventory
- GET /inventory
- PUT /inventory/{productId}
- GET /inventory/movements
- POST /inventory/import

### Products
- GET /suppliers/{id}/products
- POST /products
- PUT /products/{id}
- DELETE /products/{id}

### Suppliers
- GET /suppliers
- GET /suppliers/{id}
- PUT /suppliers/{id}
- GET /suppliers/nearby

### Routes and Delivery
- POST /routes/generate
- GET /routes/today
- GET /routes
- PUT /routes/{id}/start
- PUT /routes/{id}/complete
- GET /routes/{id}/points
- PUT /delivery-points/{id}/arrive
- POST /delivery-points/{id}/proof
- PUT /delivery-points/{id}/fail

### Payments
- POST /payments/create
- GET /payments/{orderId}

### Reports
- GET /reports/dashboard
- GET /reports/sales
- GET /reports/products/top
- GET /reports/acceptance-rate
- GET /reports/orders/export
- GET /reports/inventory/export
- GET /reports/deliveries/export

## Classificação das ocorrências pesquisadas

### rotalog-jwt
- src/services/auth.ts:98
  - Classificação: OK temporário
  - Motivo: somente chave legada para cleanup em logout, não usada como autenticação.

### localStorage
- src/hooks/useTheme.ts:5, src/hooks/useTheme.ts:19
  - Classificação: OK temporário
  - Motivo: uso para preferência de tema, sem relação com autenticação.
- src/services/auth.ts:105 e comentário em src/services/auth.ts:264
  - Classificação: OK temporário
  - Motivo: cleanup legado, não é critério de login.

### sessionStorage
- Sem ocorrências.
  - Classificação: OK

### mockOrders
- src/pages/DashboardPage.tsx (import, estado inicial e fallback)
  - Classificação: OK temporário
  - Motivo: fallback explícito durante indisponibilidade da API.
- src/Components/OrderTable.tsx (fallback quando props não vierem)
  - Classificação: OK temporário
  - Motivo: fallback de demonstração controlado.
- src/data/mockData.ts
  - Classificação: OK temporário
  - Motivo: base mock mantida por decisão de etapa.

### mockStock
- src/pages/DashboardPage.tsx (import, estado inicial e fallback)
  - Classificação: OK temporário
- src/data/mockData.ts
  - Classificação: OK temporário

### setTimeout
- src/pages/DashboardPage.tsx:206
  - Classificação: precisa remover depois
  - Motivo: simulação de evento em tempo real para demo.
- src/Components/OrderTable.tsx:147
  - Classificação: precisa remover depois
  - Motivo: simulação temporária de novo pedido até integração realtime completa.

### TODO
- Sem ocorrências.
  - Classificação: OK

### FIXME
- Sem ocorrências.
  - Classificação: OK

## Pontos que precisam de alinhamento com o backend

- Nomes reais de campos nos DTOs de orders, inventory, products e reports.
- Formato real final de Order (status, items, tracking events e campos de cliente).
- Formato real final de Inventory (identificador de produto, quantidade total e reservada).
- Retorno final de /auth/login (token e formato do user).
- Retorno final de /auth/me (payload direto ou envolto em user).
- Regras finais de autenticação do WebSocket STOMP (header, destino e permissões).

## Checklist de próximos passos quando backend estiver estável

- Remover simulações temporárias por setTimeout e usar apenas eventos reais.
- Integrar src/services/realtime.ts nas telas de pedidos, tracking e rotas.
- Reduzir fallback mock gradualmente e medir taxa de erro real da API.
- Alinhar mappers para contratos definitivos e eliminar heurísticas de múltiplas chaves.
- Adicionar testes de integração para auth refresh, pedidos e estoque.
- Revisar tratamento de erro com códigos reais do backend para mensagens mais precisas.
- Revisar uso de chaves legadas de localStorage e remover quando migração finalizar.
