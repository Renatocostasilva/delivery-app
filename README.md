# Delivery App

Aplicativo de delivery mobile-first (PWA) com backend REST, checkout integrado à Stone, catálogo, carrinho e área administrativa.

## Estrutura do monorepo (a preencher)

- `frontend/` — interface mobile-first (PWA/web responsiva para Android e iOS, Chrome/Safari)
- `backend/` — API REST modular por domínio:
  - `products`, `categories`, `clients`, `orders`, `stock`, `payments`, `integrations`

## Convenções

- Testes devem estar verdes antes de merge.
- Nunca commitar segredos.
- Não fazer deploy sem aprovação do dono.