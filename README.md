# 💈 NAVAL

**Gestão inteligente para barbearias.**

O NAVAL é uma plataforma SaaS para simplificar a gestão de barbearias, centralizando agendamentos, serviços, clientes, financeiro e estoque em um único lugar.

> 🚧 **Status:** Em desenvolvimento. Backend, frontend e testes automatizados já implementados; a aplicação depende de um projeto Supabase configurado e das migrations do repositório.

## 🎯 Objetivo do projeto

O NAVAL busca resolver problemas comuns na rotina de barbearias:

- Agendamentos controlados manualmente.
- Conflitos de horários.
- Dificuldade no gerenciamento de serviços e horários.
- Falta de organização dos clientes.
- Ausência de controle centralizado do financeiro e dos produtos.

O projeto tem foco inicial em barbearias de Parelhas/RN e região, buscando validar o produto com estabelecimentos reais antes de expandir.

## ✨ Funcionalidades

### Implementadas

#### Painel administrativo
- [x] Cadastro e autenticação de usuários (Supabase Auth).
- [x] Configuração inicial da barbearia (perfil, slug, nome do barbeiro e telefone).
- [x] Gerenciamento de serviços e preços.
- [x] Configuração de horários de funcionamento, com múltiplos períodos por dia.
- [x] Gerenciamento de agendamentos (criação e visualização da agenda).
- [x] Cadastro e histórico de clientes.
- [x] Indicadores básicos de faturamento (dashboard e financeiro: receitas, despesas, reembolsos e categorias).
- [x] Produtos, movimentações de estoque, vendas e respectivos indicadores (dependem das migrations 010–015; veja [Banco de dados](#-banco-de-dados)).

#### Agendamento online
- [x] Página pública por barbearia (`/book/:slug`).
- [x] Visualização de serviços e preços.
- [x] Consulta de horários disponíveis.
- [x] Agendamento online.
- [x] Status dos agendamentos (confirmado/cancelado).

#### Regras de negócio
- [x] Prevenção de agendamentos conflitantes.
- [x] Respeito à duração de cada serviço.
- [x] Controle de horários e períodos de funcionamento.
- [x] Isolamento de dados entre barbearias (`barbershop_id` + RLS).
- [x] Validação das operações no backend (`apps/backend/src/validation/`).
- [x] Testes automatizados de validações, serviços, rotas e regras de negócio.

### Ainda planejadas
- [ ] Agenda semanal com visualização de calendário.
- [ ] Seleção de múltiplos profissionais por unidade.
- [ ] Confirmação de agendamentos por e-mail/SMS.
- [ ] Cobrança recorrente e planos de assinatura.
- [ ] Deploy de produção e primeiros clientes.

## 🛠️ Tecnologias

### Frontend
- React 19 e Vite 8
- React Router 7
- Axios
- CSS próprio (tokens, variáveis e componentes; **sem Tailwind CSS**)
- ESLint 10 e Vitest 5 (com Testing Library e jsdom)

### Backend
- Node.js 22+ e Express 5
- API REST
- Autenticação via Supabase Auth
- Testes com `node:test`

### Banco de dados
- Supabase (PostgreSQL), Row Level Security (RLS) e migrations versionadas

### Infraestrutura
- Docker e Docker Compose (desenvolvimento e build de produção local, com nginx)
- Git e GitHub
- GitHub Actions para CI (Node 22)
- Supabase CLI para aplicar migrations

## 🏗️ Estrutura do projeto

```text
NAVAL/
├── apps/
│   ├── backend/                   # API REST (Express)
│   │   ├── src/
│   │   │   ├── config/            # cliente Supabase
│   │   │   ├── controllers/       # barbershop, scheduling, customers, finance, products, dashboard...
│   │   │   ├── middlewares/       # autenticação, cache e timing
│   │   │   ├── routes/            # rotas REST públicas e privadas
│   │   │   ├── services/          # regras de negócio e acesso ao Supabase
│   │   │   ├── validation/        # validações de payloads
│   │   │   ├── app.js
│   │   │   └── server.js
│   │   ├── test/                  # testes com node:test
│   │   ├── .env.example
│   │   ├── Dockerfile             # estágios dev (nodemon) e prod
│   │   ├── package.json
│   │   └── package-lock.json
│   └── frontend/                  # SPA (React + Vite)
│       ├── src/
│       │   ├── assets/            # artes e imagens do projeto
│       │   ├── components/        # componentes; layout/ tem DashboardLayout, Header e Sidebar
│       │   ├── contexts/          # autenticação, perfil e tema
│       │   ├── hooks/
│       │   ├── lib/               # cliente Supabase
│       │   ├── pages/             # Landing, Login, Register, Setup, Booking, Dashboard/*
│       │   ├── routes/            # rotas protegidas, de convidado e por perfil
│       │   ├── services/          # clientes HTTP da API
│       │   ├── styles/
│       │   ├── utils/
│       │   ├── App.jsx
│       │   └── main.jsx
│       ├── public/
│       ├── .env.example
│       ├── Dockerfile             # estágios dev (Vite), build e prod (nginx)
│       ├── eslint.config.js
│       ├── index.html
│       ├── nginx.conf             # SPA + proxy /api em produção
│       ├── package.json
│       ├── package-lock.json
│       └── vite.config.js         # plugin React, proxy /api e configuração do Vitest
├── docs/
│   └── docker.md                  # guia completo do Docker Compose e do ./naval
├── supabase/                      # banco de dados (Supabase CLI roda a partir da raiz)
│   ├── migrations/                # migrations SQL versionadas
│   ├── rls_local_shim.sql         # shim local de auth/roles para testar RLS
│   ├── rls_tests.sql              # suíte de RLS em transação descartável
│   ├── run_rls_tests.sh           # executa a suíte em PostgreSQL local (Docker)
│   └── verify_migrations.sql      # compara versões por impressão do schema (read-only)
├── .github/
│   └── workflows/
│       └── ci.yml                 # backend: testes; frontend: lint, testes e build
├── AGENTS.md                      # guia para agentes de IA
├── compose.yaml                   # Docker: ambiente de desenvolvimento (app :5173, API :3000)
├── compose.prod.yaml              # Docker: build de produção local (nginx :8080)
├── naval                          # comandos de inicialização (./naval help)
├── .gitignore
└── README.md
```

## 🚀 Começando

### Com Docker (caminho mais rápido)

Se você tem Docker e Docker Compose v2, não precisa instalar Node.js:

```bash
./naval setup   # cria apps/backend/.env e apps/frontend/.env a partir dos exemplos
# preencha os dois .env com a URL e a chave publicável do seu projeto Supabase
./naval dev     # app em http://localhost:5173 e API em http://localhost:3000, com hot reload
```

Outros comandos úteis: `./naval prod` (build de produção local em http://localhost:8080), `./naval test`, `./naval logs`, `./naval stop` e `./naval help`. O passo a passo completo, a arquitetura e a solução de problemas estão em **[docs/docker.md](docs/docker.md)**.

O banco continua sendo o projeto Supabase remoto, com as migrations aplicadas (veja [Banco de dados](#️-banco-de-dados)).

### Sem Docker

Instale o Node.js e rode a API e o app direto na sua máquina.

#### Pré-requisitos

- **Node.js 22 ou superior** (`node --version`) e npm.
- Um projeto no [Supabase](https://supabase.com/) com Auth habilitado.
- [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started) instalada para aplicar as migrations.

#### 1. Instale as dependências

```bash
cd apps/backend
npm install

cd ../apps/frontend
npm install
```

#### 2. Configure o ambiente

Copie os arquivos de exemplo e preencha com os valores do seu projeto:

```bash
cp apps/backend/.env.example apps/backend/.env
cp apps/frontend/.env.example apps/frontend/.env
```

| Arquivo | Variável | Descrição |
|---|---|---|
| `apps/backend/.env` | `PORT` | Porta do servidor Express (padrão: `3000`). |
| `apps/backend/.env` | `CORS_ORIGIN` | Origens do frontend permitidas pelo CORS (dev: `http://localhost:5173`; múltiplas separadas por vírgula; obrigatório em produção). |
| `apps/backend/.env` | `SUPABASE_URL` | Project URL do Supabase. |
| `apps/backend/.env` | `SUPABASE_PUBLISHABLE_KEY` | Chave publicável/anon do Supabase. |
| `apps/frontend/.env` | `VITE_API_URL` | Base URL da API REST. Em dev, `/api` usa o proxy do Vite; `http://localhost:3000` acessa o backend diretamente. |
| `apps/frontend/.env` | `VITE_SUPABASE_URL` | Project URL do Supabase (cliente do navegador). |
| `apps/frontend/.env` | `VITE_SUPABASE_PUBLISHABLE_KEY` | Chave publicável/anon do Supabase (cliente do navegador). |

Nunca commite os arquivos `.env`: apenas os `.env.example` versionados.

#### 3. Proxy de desenvolvimento `/api`

O `apps/frontend/vite.config.js` possui um proxy de `/api` para `http://localhost:3000` com `changeOrigin: true` e remoção do prefixo `/api`. Assim, uma chamada do frontend para `/api/services` chega ao backend como `/services`.

Com `VITE_API_URL=/api`, o navegador fala apenas com o Vite (sem problemas de CORS). Se usar `VITE_API_URL=http://localhost:3000`, as requisições vão direto ao backend e `CORS_ORIGIN` precisa corresponder à origem do frontend.

#### 4. Rode localmente

```bash
# Terminal 1 — API (http://localhost:3000)
cd apps/backend
npm run dev

# Terminal 2 — App (http://localhost:5173)
cd apps/frontend
npm run dev
```

## 🗄️ Banco de dados

As migrations ficam em `supabase/migrations/`. Para aplicá-las em um projeto remoto:

Rode a partir da **raiz** do repositório (onde fica a pasta `supabase/`):

```bash
supabase login
supabase link --project-ref SEU_PROJECT_REF
supabase db push
```

Para conferir o que já está aplicado, execute o arquivo somente leitura `supabase/verify_migrations.sql` no SQL Editor do Supabase (ou por um MCP de banco em modo somente leitura). Ele lista cada arquivo esperado e o status (`APLICADA`/`PENDENTE`) comparando colunas, constraints, funções, triggers, policies e índices. Não depende de `supabase_migrations.schema_migrations`, que não existe em todos os projetos; as consultas baseadas nessa tabela ficam comentadas no fim do arquivo para quem as tiver.

> ⚠️ **Atenção:** as migrations `010` a `013` (produtos/estoque/vendas, funções de venda, entradas de estoque/despesas e a flag `sells_products`) e as migrations `014`/`015` (idempotência e segurança financeira/de produtos, além dos RPCs de totais usados pelo backend) precisam estar aplicadas para o backend funcionar. No projeto conectado durante a validação deste trabalho, o schema já continha todas as 18 versões, inclusive `007`, `014` e `015`; a conferência foi feita por impressão do schema porque o projeto não registra histórico de migrations. Em outro projeto, rode o script acima antes de usar o módulo de produtos/financeiro. Nenhuma migration foi aplicada a um projeto remoto por este trabalho.

### Testes de RLS (local, sem tocar no remoto)

A suíte `supabase/rls_tests.sql` valida leitura, inserção, atualização e exclusão entre dois tenants fabricados, além das RPCs `security definer` e do acesso `anon`. Ela roda em um container PostgreSQL descartável com todas as migrations aplicadas e termina em `ROLLBACK`, sem gravar dados.

```bash
supabase/run_rls_tests.sh
```

O script usa Docker, cria o container `naval-rls-test-<pid>`, aplica o shim `auth.uid()` e remove o container ao final. Resultado esperado: `TODOS OS TESTES DE RLS PASSARAM` (72 verificações).

> ℹ️ Dois comportamentos são intencionais e estão cobertos pela suíte: horários de funcionamento são públicos para `anon` **e** `authenticated`; e um estorno cross-tenant é barrado primeiro pelo `BEFORE trigger`, que consulta `payments` sob RLS e não vê o pagamento do outro tenant.

## ✅ Testes e CI

Com Docker, `./naval test` roda tudo isso dentro dos containers (veja [docs/docker.md](docs/docker.md#-testes)). Sem Docker:

```bash
# Backend (node:test)
cd apps/backend
npm test

# Frontend
cd apps/frontend
npm run lint
npm run test
npm run build
npm run test:e2e   # Playwright: fluxo de agendamento público (API simulada, usa o Google Chrome instalado)
```

O workflow `.github/workflows/ci.yml` executa exatamente esses comandos com Node 22 em `push` e `pull_request`, usando `npm ci` e cache de dependências.

## 🏢 Arquitetura multi-tenant

O NAVAL utiliza uma arquitetura multi-tenant: diferentes barbearias compartilham a mesma aplicação, cada uma com seus próprios usuários autorizados, configurações, serviços, clientes, agendamentos, financeiro e produtos.

O isolamento é implementado com referências ao estabelecimento (`barbershop_id`) e políticas de Row Level Security (RLS) do PostgreSQL.

## 💰 Modelo de negócio

O NAVAL será comercializado no modelo SaaS, com assinatura mensal recorrente.

| Plano | Valor |
|---|---:|
| NAVAL Essencial | R$ 29,90/mês |

A estratégia inicial é oferecer um período de testes aos primeiros estabelecimentos parceiros, coletar feedback e validar a solução antes de implementar a cobrança recorrente.

## 🎨 Identidade visual

Direção visual **Dark Premium**:

- Preto e grafite como cores predominantes.
- Detalhes em dourado.
- Interface minimalista.
- Bordas arredondadas.
- Tipografia moderna.
- Design responsivo.

## 📌 Propósito

Mais do que um projeto de portfólio, o NAVAL é uma iniciativa com objetivo comercial: desenvolver um produto real, resolver problemas de negócios locais e construir uma fonte de renda recorrente.

**NAVAL — Gestão, estilo e praticidade para barbearias.** 💈
