# PROJECT-CONTEXT

- **Projeto:** NAVAL — SaaS multi-tenant de gestão para barbearias (agenda, agendamento
  público por slug, clientes, serviços, horários, financeiro, produtos/estoque/vendas).
- **Stack:** monorepo sem package.json na raiz. `apps/backend` (Node 22, Express 5, ESM,
  node:test), `apps/frontend` (React 19, Vite 8, React Router 7, CSS próprio, Vitest),
  Supabase (Postgres + RLS + Auth, migrations versionadas), Docker Compose, CI no GitHub Actions.
- **Fase atual:** MVP funcional em desenvolvimento, ainda sem deploy de produção. A validação
  vai começar com barbearias reais de Parelhas/RN e região.
- **Restrições:** JavaScript puro (sem TypeScript); interface e mensagens em pt-BR; isolamento
  de tenants via `barbershop_id` + RLS; nunca usar service_role nem aplicar migrations
  no remoto; fuso America/Fortaleza; dinheiro calculado em centavos.
- **Definição de pronto:** testes do backend, lint, testes e build do frontend passando
  (mais a suíte de RLS quando o banco muda); comportamento coberto por testes de regressão;
  docs atualizadas quando mudam comandos ou setup.
