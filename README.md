# 💈 NAVAL

**Gestão inteligente para barbearias.**

O NAVAL é uma plataforma SaaS desenvolvida para simplificar a gestão de barbearias, centralizando agendamentos, profissionais, serviços e clientes em um único lugar.

O objetivo é oferecer uma solução moderna, intuitiva e acessível para pequenas e médias barbearias, permitindo que seus clientes realizem agendamentos online enquanto os proprietários gerenciam seus estabelecimentos com mais organização e eficiência.

> 🚧 **Status:** Em desenvolvimento.

---

## 🎯 Objetivo do projeto

O NAVAL nasce com a proposta de resolver problemas comuns na rotina de barbearias, como:

- Agendamentos controlados manualmente.
- Conflitos de horários.
- Dificuldade no gerenciamento de profissionais.
- Falta de organização dos clientes.
- Ausência de controle centralizado dos serviços.

O projeto terá inicialmente foco em barbearias de Parelhas/RN e região, buscando validar o produto com estabelecimentos reais antes de expandir.

## ✨ Funcionalidades planejadas

### Painel administrativo
- [ ] Cadastro e autenticação de usuários.
- [ ] Gerenciamento de barbearias.
- [ ] Cadastro e gerenciamento de profissionais.
- [ ] Gerenciamento de serviços e preços.
- [ ] Configuração de horários de funcionamento.
- [ ] Gerenciamento de agendamentos.
- [ ] Visualização de agenda diária e semanal.
- [ ] Cadastro e histórico de clientes.
- [ ] Indicadores básicos de faturamento.

### Agendamento online
- [ ] Página pública personalizada para cada barbearia.
- [ ] Visualização de serviços e preços.
- [ ] Seleção de profissionais.
- [ ] Consulta de horários disponíveis.
- [ ] Agendamento online.
- [ ] Confirmação de agendamentos.

### Regras de negócio
- [ ] Prevenção de agendamentos conflitantes.
- [ ] Respeito à duração de cada serviço.
- [ ] Controle de horários e folgas.
- [ ] Isolamento de dados entre barbearias.
- [ ] Validação das operações no backend.

## 🛠️ Tecnologias

### Frontend
- React
- Vite
- JavaScript
- React Router
- Axios
- CSS / Tailwind CSS

### Backend
- Node.js
- Express
- API REST
- Mongoose
- JWT (autenticação)

### Banco de dados
- MongoDB Atlas

### Ferramentas e infraestrutura
- Git e GitHub
- Docker
- Docker Compose

## 🏗️ Arquitetura

O projeto será desenvolvido em um único repositório, separado em frontend e backend.

```text
NAVAL/
│
├── backend/
│   └── src/
│       ├── config/
│       ├── controllers/
│       ├── middlewares/
│       ├── models/
│       ├── routes/
│       ├── services/
│       └── server.js
│
├── frontend/
│   └── src/
│       ├── components/
│       ├── pages/
│       ├── services/
│       ├── contexts/
│       ├── hooks/
│       └── App.jsx
│
├── docker-compose.yml
├── .gitignore
└── README.md
```

## 🏢 Arquitetura Multi-tenant

O NAVAL utilizará uma arquitetura multi-tenant, permitindo que diferentes barbearias utilizem a mesma aplicação.

Cada estabelecimento terá seus próprios dados, incluindo:

- Usuários.
- Profissionais.
- Serviços.
- Clientes.
- Agendamentos.
- Configurações.

O isolamento será garantido por meio de referências aos estabelecimentos (`barbershopId`) e validações de autorização no backend.

## 💰 Modelo de negócio

O NAVAL será comercializado no modelo SaaS, com assinatura mensal recorrente.

**Plano inicial proposto:**

| Plano | Valor |
|---|---:|
| NAVAL Essencial | R$ 29,90/mês |

A estratégia inicial será oferecer um período de testes para os primeiros estabelecimentos parceiros, coletar feedback e validar a solução antes de implementar a cobrança recorrente.

## 🎨 Identidade visual

A identidade visual seguirá o conceito **Dark Premium**:

- Preto e grafite como cores predominantes.
- Detalhes em dourado.
- Interface minimalista.
- Bordas arredondadas.
- Tipografia moderna.
- Design responsivo.

## 🚀 Etapas de desenvolvimento

1. **Fundação:** estruturação do projeto, configuração do backend, frontend e banco de dados.
2. **Autenticação:** cadastro, login, JWT e autorização.
3. **Gestão:** profissionais, serviços e horários.
4. **Agendamentos:** página pública e sistema de reservas.
5. **Painel administrativo:** dashboard, calendário e clientes.
6. **Monetização:** planos e assinaturas recorrentes.
7. **Lançamento:** testes, deploy e primeiros clientes.

## 🔒 Segurança

O desenvolvimento seguirá boas práticas de segurança:

- Variáveis de ambiente para credenciais.
- Senhas armazenadas com hash.
- Autenticação e autorização.
- Validação de dados no backend.
- Tratamento adequado de erros.
- Isolamento dos dados de cada estabelecimento.

## 📌 Propósito

Mais do que um projeto de portfólio, o NAVAL é uma iniciativa com objetivo comercial: desenvolver um produto real, resolver problemas de negócios locais e construir uma fonte de renda recorrente.

**NAVAL — Gestão, estilo e praticidade para barbearias.** 💈
