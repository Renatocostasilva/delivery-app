# Delivery App

Aplicativo de delivery mobile-first (PWA) com backend REST, checkout integrado à Stone, catálogo, carrinho e área administrativa.

## Estrutura do monorepo

| Diretório    | Descrição                                                        |
| ------------ | ---------------------------------------------------------------- |
| `frontend/`  | PWA mobile-first (Vite + React 19 + TypeScript, vite-plugin-pwa) |
| `backend/`   | API REST (Node + Express 5 + TypeScript)                         |

## Backend — domínios isolados

Cada domínio vive em `backend/src/<dominio>/` e expõe somente sua própria
interface, sem acoplamento na camada de rotas:

- `products` — catálogo de produtos
- `categories` — categorias
- `clients` — clientes
- `orders` — pedidos
- `stock` — estoque
- `payments` — pagamentos
- `integrations` — (vazio) reservado para provedores externos, ex.: Stone

> Nenhuma lógica de negócio implementada ainda — apenas o esqueleto.

## Requisitos

- Node.js 22+
- pnpm 10+

## Setup

```bash
pnpm install
```

## Comandos

```bash
pnpm dev:backend    # backend em http://localhost:3000 (dev, tsx watch)
pnpm dev:frontend   # frontend PWA (dev server Vite)
pnpm lint           # lint de todos os pacotes
pnpm test           # testes de todos os pacotes
pnpm build          # build de todos os pacotes
```

## Qualidade

Regras de qualidade e convenções do projeto estão em [AGENTS.md](AGENTS.md).
Leia antes de codar.

- Testes devem estar verdes antes de merge.
- Nunca commitar segredos — variáveis de ambiente em `.env` (ignorado), nunca no commit.
- Não fazer deploy sem aprovação do dono.

## CI

GitHub Actions em `.github/workflows/ci.yml`: instala dependências (pnpm),
roda lint, testes e build.