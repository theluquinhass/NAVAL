# 🐳 Rodando o NAVAL com Docker

Este guia explica como subir o NAVAL inteiro com Docker Compose, sem instalar Node.js na sua máquina.

- **Desenvolvimento** (`compose.yaml`): app com hot reload em `:5173` e API com nodemon em `:3000`.
- **Produção local** (`compose.prod.yaml`): o mesmo build que iria para um servidor, com o nginx servindo o app em `:8080`.

> O banco de dados **não** roda no Docker. O NAVAL usa um projeto Supabase (PostgreSQL + Auth) remoto, configurado nos arquivos `.env`. A única exceção é a suíte de testes de RLS, que sobe um PostgreSQL descartável (veja [Testes](#-testes)).

## Sumário

- [Pré-requisitos](#-pré-requisitos)
- [Primeira vez (3 comandos)](#-primeira-vez-3-comandos)
- [Configuração](#-configuração)
- [Comandos do `./naval`](#-comandos-do-naval)
- [Como funciona](#-como-funciona)
- [Desenvolvimento](#-desenvolvimento)
- [Produção local](#-produção-local)
- [Testes](#-testes)
- [Portas e variáveis](#-portas-e-variáveis)
- [Sem o script (docker compose puro)](#-sem-o-script-docker-compose-puro)
- [Problemas comuns](#-problemas-comuns)

## 📋 Pré-requisitos

| Ferramenta | Versão | Como conferir |
|---|---|---|
| Docker Engine ou Docker Desktop | 24+ | `docker --version` |
| Docker Compose v2 | 2.24+ | `docker compose version` |
| Bash | qualquer | já vem no Linux e no macOS; no Windows, use o WSL 2 |
| Projeto Supabase | com as migrations aplicadas | veja [Banco de dados](../README.md#️-banco-de-dados) |

No Linux, seu usuário precisa ter acesso ao Docker sem `sudo` (grupo `docker`).

## 🚀 Primeira vez (3 comandos)

```bash
./naval setup   # cria apps/backend/.env e apps/frontend/.env a partir dos exemplos
# edite os dois .env com a URL e a chave publicável do seu projeto Supabase
./naval dev     # sobe tudo; abra http://localhost:5173
```

Para parar: `Ctrl+C` no terminal do `./naval dev`, ou `./naval stop` se você subiu com `-d`.

## 🔧 Configuração

O compose lê os mesmos arquivos `.env` usados sem Docker. Nenhum segredo fica escrito no `compose.yaml` ou dentro das imagens.

| Arquivo | Variável | Obrigatória | Observação |
|---|---|---|---|
| `apps/backend/.env` | `SUPABASE_URL` | sim | Project URL do Supabase |
| `apps/backend/.env` | `SUPABASE_PUBLISHABLE_KEY` | sim | Chave publicável/anon |
| `apps/backend/.env` | `PORT` | não | Ignorada no Docker: a API sempre escuta na `3000` **dentro** do container. Para mudar a porta no seu computador, use `NAVAL_API_PORT`. |
| `apps/backend/.env` | `CORS_ORIGIN` | não | Ignorada no Docker: o compose define a origem certa para cada ambiente (veja [Portas e variáveis](#-portas-e-variáveis)). |
| `apps/frontend/.env` | `VITE_SUPABASE_URL` | sim | Igual a `SUPABASE_URL` |
| `apps/frontend/.env` | `VITE_SUPABASE_PUBLISHABLE_KEY` | sim | Igual a `SUPABASE_PUBLISHABLE_KEY` |
| `apps/frontend/.env` | `VITE_API_URL` | não | Deixe `/api`. Em produção ela é sempre forçada para `/api`. |

O `./naval dev` e o `./naval prod` conferem se as variáveis obrigatórias estão preenchidas antes de subir. Eles mostram apenas o **nome** da variável que falta, nunca o valor.

> ⚠️ Tudo que começa com `VITE_` vai para o JavaScript que o navegador baixa. Coloque ali apenas valores públicos, como a chave publicável. Nunca use a `service_role`.

## 🧰 Comandos do `./naval`

| Comando | O que faz |
|---|---|
| `./naval setup` | Cria os `.env` que faltam (nunca sobrescreve) e lista o que ainda precisa ser preenchido. |
| `./naval dev` | Sobe o desenvolvimento em primeiro plano, mostrando os logs. `Ctrl+C` para parar. |
| `./naval dev -d` | Mesmo que o anterior, mas em segundo plano. |
| `./naval prod` | Faz o build de produção e sobe em segundo plano. Espera os health checks antes de liberar o terminal. |
| `./naval stop [dev\|prod\|all]` | Para e remove os containers (padrão: `dev`). Não apaga nada do Supabase. |
| `./naval restart [dev\|prod] [api\|web]` | Reinicia um ou todos os serviços. |
| `./naval logs [dev\|prod] [api\|web]` | Acompanha os logs (últimas 100 linhas e as novas). |
| `./naval status` | Mostra os containers dos dois ambientes. |
| `./naval shell [api\|web]` | Abre um terminal `bash` dentro do container (padrão: `api`). |
| `./naval test` | Roda todos os testes dentro dos containers: backend (`npm test`) e frontend (lint, testes e build). |
| `./naval test backend` / `frontend` | Roda só uma das partes. |
| `./naval rls` (ou `./naval test rls`) | Roda a suíte de RLS em um PostgreSQL descartável. |
| `./naval clean` | Remove containers, volumes e imagens locais do NAVAL. Pede confirmação. |
| `./naval help` | Lista os comandos. |

## 🧭 Como funciona

```text
Desenvolvimento (compose.yaml)                    Produção local (compose.prod.yaml)

 navegador ──► :5173  web (Vite + HMR)             navegador ──► :8080  web (nginx)
                 │  /api/* ─► proxy                                 │  /           ─► build estático (SPA)
                 ▼                                                  │  /api/*      ─► proxy
               :3000  api (Express + nodemon)                       ▼
                 │                                                api (Express, sem porta no host)
                 ▼                                                  │
        Supabase remoto (Auth + PostgreSQL)                Supabase remoto (Auth + PostgreSQL)
```

- Nos dois ambientes, o navegador chama `/api/...` e o proxy remove o prefixo. Assim, `/api/services` chega na API como `/services`, o mesmo contrato do `vite.config.js`.
- O navegador também fala **direto** com o Supabase para login e sessão (`VITE_SUPABASE_URL`).
- A API expõe `GET /health`, que não exige autenticação e responde `{"status":"ok"}`. O compose usa essa rota para saber quando a API está pronta. O `web` só sobe depois que a API fica saudável.

### Arquivos

| Arquivo | Papel |
|---|---|
| `compose.yaml` | Ambiente de desenvolvimento (serviços `api` e `web`). |
| `compose.prod.yaml` | Build de produção rodando localmente. |
| `naval` | Script com os comandos acima. |
| `apps/backend/Dockerfile` | Imagem da API, com os estágios `dev` (nodemon) e `prod` (só dependências de produção). |
| `apps/frontend/Dockerfile` | Imagem do app, com os estágios `dev` (Vite), `build` e `prod` (nginx). |
| `apps/frontend/nginx.conf` | Serve o SPA, faz o proxy de `/api`, define cache, gzip e cabeçalhos de segurança. |
| `apps/backend/.dockerignore`, `apps/frontend/.dockerignore` | Mantêm `node_modules`, testes e segredos fora das imagens. |

## 💻 Desenvolvimento

```bash
./naval dev       # ou ./naval dev -d
```

- **App:** http://localhost:5173
- **API:** http://localhost:3000 (por exemplo, http://localhost:3000/health)

**Hot reload**
- `apps/frontend/` inteiro é montado no container. Ao salvar, o Vite atualiza o navegador na hora.
- `apps/backend/src` e `apps/backend/test` são montados no container. Ao salvar, o nodemon reinicia a API.

**Dependências**
- O `node_modules` do frontend vive **dentro** do container, não no seu disco. Isso evita misturar binários do seu sistema com os do Linux do container.
- Depois de mudar um `package.json` (ou rodar `npm install` no host), rode `./naval dev` de novo. Ele refaz a imagem e recria esse `node_modules`.
- Mudanças no `package.json` do backend também exigem rodar `./naval dev` de novo.

**Arquivos criados pelos containers**
- Os containers rodam com o usuário `node` (UID 1000). No Linux, se o seu UID também é 1000 (`id -u`), arquivos gerados no volume (como `apps/frontend/dist` do `./naval test`) ficam com você como dono.

## 🏭 Produção local

```bash
./naval prod
# abra http://localhost:8080
./naval logs prod
./naval stop prod
```

Para que serve:
- Testar o build final antes de um deploy: bundle minificado, nginx, cache e rotas do React Router.
- Reproduzir problemas que só aparecem em produção.

**Diferenças em relação ao dev**
- Não tem hot reload, nem código montado por volume. O código fica dentro das imagens.
- A API usa `NODE_ENV=production`, só dependências de produção e o usuário `node`.
- Os dois containers rodam com sistema de arquivos somente leitura e `no-new-privileges`.
- A API **não** é publicada no host. Só o nginx alcança a API, pela rede interna do compose.
- O `CORS_ORIGIN` da API vem de `NAVAL_PUBLIC_ORIGIN` (padrão `http://localhost:8080`) e precisa ser exatamente o endereço que aparece na barra do navegador.

**Acessando de outro aparelho**

Para abrir pelo celular na mesma rede, por exemplo, informe a origem real:

```bash
NAVAL_PUBLIC_ORIGIN=http://192.168.0.10:8080 ./naval prod
```

> Este ambiente é um ponto de partida para o deploy, não o deploy em si. Num servidor de verdade ainda faltam HTTPS (um proxy como Caddy ou Traefik, ou o load balancer do provedor), o domínio em `NAVAL_PUBLIC_ORIGIN` e o domínio liberado nas URLs de redirecionamento do Supabase Auth.

## ✅ Testes

```bash
./naval test            # backend + frontend, dentro dos containers
./naval test backend    # node:test
./naval test frontend   # eslint + vitest + vite build
./naval rls             # suíte de RLS (72 verificações)
```

- Os testes rodam nas mesmas imagens do ambiente de dev, com Node 22, igual ao CI (`.github/workflows/ci.yml`).
- O `./naval rls` usa o script `supabase/run_rls_tests.sh`. Ele cria um PostgreSQL descartável, aplica as migrations, roda os testes em uma transação que termina em `ROLLBACK` e remove o container. **Nunca conecta no Supabase remoto.**

Os testes continuam funcionando sem Docker (`npm test` em cada pasta), como descrito no [README](../README.md#-testes-e-ci).

## 🔌 Portas e variáveis

Essas variáveis são do **seu terminal**, não dos `.env`.

| Variável | Padrão | Usada em | Efeito |
|---|---|---|---|
| `NAVAL_WEB_PORT` | `5173` | dev | Porta do app no seu computador. A origem do CORS acompanha esse valor. |
| `NAVAL_API_PORT` | `3000` | dev | Porta da API no seu computador. |
| `NAVAL_HTTP_PORT` | `8080` | prod | Porta do nginx no seu computador. |
| `NAVAL_PUBLIC_ORIGIN` | `http://localhost:8080` | prod | Origem usada pelo navegador. Vira o `CORS_ORIGIN` da API. |

Exemplo, quando a porta 5173 já está ocupada:

```bash
NAVAL_WEB_PORT=5174 ./naval dev
```

## 🧱 Sem o script (docker compose puro)

O `./naval` é só um atalho. Os comandos equivalentes são:

```bash
# desenvolvimento
docker compose up --build -V          # -V recria o node_modules do frontend
docker compose up --build -V -d
docker compose logs -f api
docker compose down

# produção local
docker compose -f compose.prod.yaml up --build -d --wait
docker compose -f compose.prod.yaml logs -f
docker compose -f compose.prod.yaml down

# testes
docker compose run --rm --build --no-deps api npm test
docker compose run --rm --build --no-deps web sh -c "npm run lint && npm run test && npm run build"
```

## 🩺 Problemas comuns

**"env file … not found" ou "Configuração incompleta"**
Rode `./naval setup` e preencha as variáveis indicadas.

**"port is already allocated"**
Outro processo, ou o `npm run dev` fora do Docker, está usando a porta. Pare esse processo ou use outra porta, por exemplo `NAVAL_WEB_PORT=5174 ./naval dev`.

**O app abre, mas o login falha ou dá erro de rede**
Confira `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` no `apps/frontend/.env`. Em produção, rode `./naval prod` de novo depois de mudar esse arquivo: as variáveis `VITE_*` são embutidas no momento do build.

**As chamadas da API respondem 403 (`CORS_ORIGIN_NOT_ALLOWED`)**
O endereço na barra do navegador não bate com a origem permitida. Em produção, ajuste `NAVAL_PUBLIC_ORIGIN`. Em dev, acesse pelo `localhost` na porta do `NAVAL_WEB_PORT`.

**Todas as páginas mostram erro ao carregar dados**
A API sobe, mas o Supabase precisa ter as migrations aplicadas. Veja [Banco de dados](../README.md#️-banco-de-dados). Os logs da API ajudam: `./naval logs api`.

**Mudei o `package.json` e o pacote novo "não existe"**
Rode `./naval dev` de novo. Ele refaz a imagem e recria o `node_modules` do container.

**Erro de permissão ao gerar arquivos (Linux)**
Os containers usam o UID 1000. Se `id -u` mostra outro número, rode o build do frontend fora do Docker (`cd apps/frontend && npm run build`) ou ajuste as permissões da pasta `apps/frontend/dist`.

**Começar do zero**
`./naval clean` remove os containers, volumes e imagens do NAVAL. Depois é só rodar `./naval dev` de novo.
