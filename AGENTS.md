# AGENTS.md — Guia para agentes de IA no NAVAL

Este arquivo orienta agentes de código (Claude Code, Codex, Cursor etc.) que trabalham neste repositório. Ele descreve as convenções **reais** do código; em caso de dúvida, o código vence este arquivo. Detalhes de produto e setup: [README.md](README.md). Docker: [docs/docker.md](docs/docker.md).

## 1. Visão geral

NAVAL é um SaaS multi-tenant para barbearias (agenda, agendamento público, clientes, serviços, horários, financeiro, produtos/estoque/vendas). É um monorepo **sem `package.json` na raiz**: `apps/backend/` (API Express) e `apps/frontend/` (SPA React) são projetos npm independentes. Toda a interface, mensagens de erro e documentação estão em **português (pt-BR)**.

```
Navegador ──/api──▶ Vite dev (:5173) ou nginx (:8080, prod) ──▶ Express (:3000) ──▶ Supabase (Postgres + RLS)
    └──────────────── Supabase Auth (login/sessão direto do navegador) ─────────────────┘
```

- O navegador autentica direto no Supabase Auth (`apps/frontend/src/lib/supabase.js`) e envia o JWT ao backend.
- O backend valida o token (`middlewares/authMiddleware.js`) e cria **um cliente Supabase por requisição com o JWT do usuário** (`createUserClient` em `src/config/supabase.js`), de modo que o RLS do Postgres isola os tenants. Rotas públicas usam `createPublicClient` (papel `anon`).

## 2. Mapa do repositório

| Caminho | Conteúdo |
|---|---|
| `apps/backend/src/app.js` | Montagem do Express: CORS, `GET /health` (público), routers, 404 e handler de erros |
| `apps/backend/src/server.js` | Sobe o servidor (`PORT`, padrão 3000) |
| `apps/backend/src/routes/` | Definição de rotas (`publicBookingRoutes.js` é a única sem auth) |
| `apps/backend/src/controllers/` | Valida entrada, chama serviços e traduz erros para HTTP |
| `apps/backend/src/services/` | Acesso ao Supabase e regras de negócio (`money.js`, `workingHoursRules.js`) |
| `apps/backend/src/validation/` | Validação de payloads; utilitários em `shared.js` (`isUuid`, `validateMoney`, datas ISO estritas) |
| `apps/backend/src/middlewares/` | `authMiddleware`, `authCache`, `requireSellsProducts`, `timing` (Server-Timing) |
| `apps/backend/test/*.test.js` | Testes `node:test` |
| `supabase/migrations/` | Migrations SQL versionadas (`AAAAMMDDNNNN_nome.sql`) |
| `supabase/run_rls_tests.sh` | Suíte de RLS em Postgres descartável via Docker (nunca toca no remoto) |
| `supabase/verify_migrations.sql` | Conferência **somente leitura** do schema aplicado |
| `apps/frontend/src/services/` | `api.js` (axios + interceptors) e um módulo `*Api.js` por domínio |
| `apps/frontend/src/pages/` | Páginas; `Dashboard/<Feature>/index.jsx` + componentes irmãos (ex.: `Finance/PaymentForm.jsx`, `Agenda/AppointmentDialog.jsx`, `WorkingHours/*`) |
| `apps/frontend/src/utils/dashboard.js` | Fuso, datas, dinheiro, `getErrorMessage`, `newIdempotencyKey` |
| `apps/frontend/src/hooks/` | `useAuth`, `useProfile`, `useLatestRequest` |
| `apps/frontend/src/routes/` | Guards de rota (`ProtectedRoute`, `GuestRoute`, `SetupRoute`, `ProfileRoute`, `ProductsRoute`) |
| `apps/frontend/src/styles/` | CSS próprio (`tokens.css`, `global.css`); cada página tem seu `.css` |
| `naval`, `compose.yaml`, `compose.prod.yaml` | Script e Compose de dev/produção local |
| `.github/workflows/ci.yml` | CI (Node 22) |

## 3. Setup e execução

Arquivos de ambiente: copie `apps/backend/.env.example` → `apps/backend/.env` e `apps/frontend/.env.example` → `apps/frontend/.env` e preencha `SUPABASE_URL`/`SUPABASE_PUBLISHABLE_KEY` e `VITE_SUPABASE_URL`/`VITE_SUPABASE_PUBLISHABLE_KEY` (chave publicável/anon). **Nunca leia, imprima ou commite os `.env` reais.**

**Com Docker** (script `./naval`, detalhes em `docs/docker.md`):

| Comando | O que faz |
|---|---|
| `./naval setup` | Cria os `.env` a partir dos exemplos e aponta o que falta |
| `./naval dev [-d]` | Dev com hot reload: app :5173 (Vite, proxy via `API_PROXY_TARGET`), API :3000 (nodemon) |
| `./naval prod` | Build de produção local: nginx :8080 servindo o SPA e fazendo proxy de `/api` |
| `./naval stop [dev\|prod\|all]`, `restart`, `logs`, `status`, `shell [api\|web]` | Operação dos containers |
| `./naval test [all\|backend\|frontend\|rls]` | Testes dentro dos containers |
| `./naval rls` | Suíte de RLS em Postgres descartável |
| `./naval clean` | Remove containers, volumes e imagens locais (pede confirmação) |

**Sem Docker** (Node ≥ 22):

```bash
cd apps/backend && npm install && npm run dev    # API em http://localhost:3000
cd apps/frontend && npm install && npm run dev   # App em http://localhost:5173 (/api → :3000)
```

## 4. Checklist de verificação antes de concluir

Rode o que corresponde ao que você mudou (são os mesmos comandos do CI):

```bash
cd apps/backend && npm test                                       # node --experimental-test-module-mocks --test
cd apps/frontend && npm run lint && npm run test && npm run build # ESLint, Vitest, build Vite
cd apps/frontend && npm run test:e2e                              # Playwright (e2e/, API mockada via page.route, Chrome instalado)
supabase/run_rls_tests.sh                            # ao mexer em migrations, policies, RPCs ou triggers (requer Docker)
```

- Resultado esperado do RLS: `TODOS OS TESTES DE RLS PASSARAM`.
- O build do frontend no CI usa valores *placeholder* para `VITE_*`; não dependa de Supabase real em testes.
- Não deixe `console.log` de depuração, testes `.only` ou arquivos temporários.

## 5. Convenções de código

**Gerais**
- JavaScript puro com **ESM** (`"type": "module"`); **não há TypeScript**. As regras genéricas em `.claude/rules/ecc/typescript/` que falam de tipos, `interface`, `zod` etc. não se aplicam; use JSDoc pontual quando ajudar.
- Código em `src/`: **4 espaços**, aspas simples, **sem ponto e vírgula**. Arquivos de configuração do frontend (`vite.config.js`, `eslint.config.js`) usam 2 espaços — siga o estilo do arquivo que estiver editando.
- Imports relativos com extensão `.js`/`.jsx` (predominante; alguns imports antigos omitem). Nomes: `camelCase` para funções/variáveis, `PascalCase` para componentes, `UPPER_SNAKE_CASE` para constantes e códigos de erro.
- Textos para o usuário em português; comentários de código podem ser em inglês ou português.
- Prefira imutabilidade e funções pequenas; não faça refatorações não pedidas.

**Backend**
- Camadas: `routes` → `controllers` → `validation` + `services`. Rotas só mapeiam caminho → controller.
- Validadores retornam `{ error: 'mensagem pt-BR' }` na falha e, no sucesso, o valor normalizado (o formato varia: `{ payload }`, `{ key }`, `{ date }`, `{ period }`); confira `error` antes de usar. O controller responde `400` com `{ error, code: 'VALIDATION_ERROR' }`. IDs de rota são checados com `isUuid` (`400 INVALID_ID`).
- Serviços lançam `Error('CODIGO')` (ex.: `BARBERSHOP_NOT_FOUND`); o controller traduz em um `handle*Error` para status + `{ error: 'mensagem pt-BR', code: 'CODIGO' }`. Respostas de sucesso embrulham o recurso: `{ service }`, `{ services }`, `{ profile }`; `204` em deleções.
- Serviços recebem `req.accessToken` e `req.user.id` e usam `createUserClient(token)`. Nunca use o cliente global `supabase` para ler/escrever dados de tenant (ele só serve para `auth.getUser`).
- Dinheiro: entra como string/número com até 2 casas (`validateMoney`), cálculos em centavos (`toCents`/`fromCents`/`sumCents` em `services/money.js`).
- Novas rotas autenticadas: registre em `app.js` com `authMiddleware` antes do handler 404.

**Frontend**
- React 19 com componentes de função e hooks; react-router-dom 7; CSS próprio por página (sem Tailwind, sem biblioteca de UI).
- Chamadas HTTP só via `services/*Api.js` usando a instância `api` (o interceptor injeta o token; `skipAuth` para rotas públicas; 401 com token faz `signOut` local).
- Mensagens de erro: `getErrorMessage(error, 'fallback em pt-BR', { status: 'mensagem' })` de `utils/dashboard.js`.
- Recarregamentos assíncronos: use `useLatestRequest()` (`const isCurrent = beginRequest()`; só atualize estado se `isCurrent()`), como em `Customers`, `Services` e `Products`.
- Fuso de negócio **`America/Fortaleza`**: use `TIME_ZONE`, `fortalezaToday`, `fortalezaInputValue`, `toFortalezaIso`, `periodBounds` em vez de `new Date()` local.
- Dinheiro no cliente: mantenha valores como string no formulário e compare/some com `moneyToCents`; exiba com `formatMoney` (BRL).
- Chaves de idempotência (vendas; o backend também aceita `idempotencyKey` em pagamentos): gere uma vez com `useState(() => newIdempotencyKey())` para que **retentativas reenviem a mesma chave** (ver `Products/Finance/SaleForm.jsx`).
- Páginas grandes devem ser divididas em componentes irmãos na pasta da feature.
- Acessibilidade: o lint inclui `eslint-plugin-jsx-a11y` (instalado com `overrides` no `package.json`, pois o peer range dele vai só até ESLint 9 — não remova o override). Labels associadas, botões com texto, sem `div` clicável.

## 6. Convenções de testes

- **Backend**: `apps/backend/test/<nome>.test.js`, `node:test` + `node:assert/strict`. Mocke dependências com `mock.module('../src/...', { namedExports: {...} })` **antes** de importar o módulo testado via `await import(...)`, e `after(() => mock.restoreAll())`. Controllers são testados com objetos `req`/`res` falsos.
- **Frontend**: testes ao lado do código (`*.test.js`/`*.test.jsx`), Vitest + jsdom (`globals: true`). Padrão: `vi.mock('../../../services/xApi.js', () => ({ fn: vi.fn() }))` seguido de `await import(...)` do mock e do componente. Use `@testing-library/react` (`render`, `screen`, `fireEvent`, `act`) — alguns testes antigos usam `createRoot` direto.
- **Datas**: testes não podem depender do fuso da máquina. Use instantes UTC absolutos (`'2026-11-25T13:00:00.000Z'`) e funções de Fortaleza. Para datas que passam por validação de período (`MAX_PAST_YEARS`, `MAX_FUTURE_DAYS`), gere-as **relativas a agora** em vez de datas fixas no passado, ou use `vi.useFakeTimers()`/`vi.setSystemTime`.
- Teste comportamento observável (status, corpo `{ error, code }`, texto na tela), inclusive caminhos de erro e respostas fora de ordem.
- Bug corrigido = teste de regressão junto.

## 7. Segurança e dados

- **Multi-tenant via RLS**: isolamento por `barbershop_id` + policies. Toda tabela nova precisa de RLS habilitado, policies por tenant e casos na suíte `rls_tests.sql`.
- **Nunca** use `service_role` nem chaves administrativas, nem as adicione ao código ou `.env.example`.
- **Nunca** aplique migrations em um projeto Supabase remoto (`supabase db push`, SQL Editor etc.). Crie a migration em `supabase/migrations/` com o próximo prefixo e valide localmente com `run_rls_tests.sh`; a aplicação remota é decisão humana. `verify_migrations.sql` é somente leitura.
- Migrations já existentes não devem ser editadas; corrija com uma nova migration.
- **Nunca** leia, imprima ou commite `apps/backend/.env` / `apps/frontend/.env` (o `.gitignore` já os exclui; só `.env.example` é versionado).
- Variáveis `VITE_*` são embutidas no bundle e **públicas**: só URL e chave publicável, jamais segredos.
- Autorização é garantida no backend (`authMiddleware` + RLS); guards de rota no frontend são só UX. Valide toda entrada no backend, mesmo que o frontend já valide.
- Não vaze detalhes internos em respostas de erro (o handler global responde `INTERNAL_ERROR`). `CORS_ORIGIN` é obrigatório em produção.

## 8. Git e fluxo de trabalho

- Commits no estilo **Conventional Commits, em inglês**, minúsculos e no imperativo: `feat: add product finance, stock expenses and setup opt-in`, `fix: restore ...`, `refactor: ...`; escopo opcional (`feat(frontend): ...`).
- Não faça commit, push, stash, checkout ou reset sem pedido explícito; o working tree pode conter trabalho não commitado de outras pessoas/agentes.
- Mudanças pequenas e focadas; atualize `README.md`/`docs/docker.md` quando alterar comandos, variáveis ou setup.

## 9. Regras do Claude Code e referências

- `.claude/rules/ecc/` contém regras genéricas (common, typescript, react, web) carregadas pelo Claude Code. Quando divergirem deste arquivo (ex.: TypeScript, Tailwind, ferramentas não usadas aqui), **siga este AGENTS.md e o código existente**.
- [README.md](README.md): funcionalidades, stack, estrutura, banco e arquitetura multi-tenant.
- [docs/docker.md](docs/docker.md): Docker, portas (`NAVAL_WEB_PORT`, `NAVAL_API_PORT`, `NAVAL_HTTP_PORT`, `NAVAL_PUBLIC_ORIGIN`) e problemas comuns.
