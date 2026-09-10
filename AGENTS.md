# Delivery App — Regras de Qualidade

Leia este arquivo **antes** de escrever qualquer código.

## Regras obrigatórias

1. **Leia o AGENTS.md** — sempre, antes de codar.
2. **Testes verdes** — nenhum merge com testes quebrados. Rode
   `pnpm test` antes de concluir qualquer tarefa.
3. **Nunca exponha segredos** — nada de chaves de API, senhas, tokens ou
   variáveis de ambiente reais em arquivos commitados. Use `.env.example`
   se precisar documentar variáveis.
4. **Não fazer deploy** — deploys só com aprovação explícita do dono.
5. **Lint limpo** — rode `pnpm lint` e mantenha o código coerente com a
   configuração do ESLint de cada pacote.

## Estrutura

- `frontend/` — PWA mobile-first (Vite + React + TypeScript).
- `backend/` — API REST (Node + Express + TypeScript).
  - Domínios isolados e independentes em `src/<dominio>/`:
    `products`, `categories`, `clients`, `orders`, `stock`, `payments`,
    `integrations` (vazio, reservado para provedores externos, ex.: Stone).
  - Cada domínio deve expor somente sua própria interface; não acoplar
    domínios entre si na camada de rotas.

## Comandos

- Instalar: `pnpm install`
- Lint: `pnpm lint`
- Testes: `pnpm test`
- Build: `pnpm build`

## Stack

- Monorepo: pnpm workspaces
- Backend: Node + Express 5 + TypeScript, tsx para dev, vitest para testes
- Frontend: Vite + React 19 + TypeScript, vite-plugin-pwa, vitest + testing-library