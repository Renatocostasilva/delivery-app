import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { renderAdmin, mockFetchHandler, ok, noContent, seedSession } from './testUtils';

const categoriesFixture = {
  data: [
    {
      id: 1,
      nome: 'Pizzas',
      slug: 'pizzas',
      ordem: 1,
      ativa: true,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      _count: { produtos: 5 },
    },
  ],
  meta: { page: 1, pageSize: 200, total: 1, totalPages: 1 },
};

const productsFixture = {
  data: [
    {
      id: 1,
      nome: 'Pizza Margherita',
      sku: 'P001',
      categoriaId: 1,
      categoria: { id: 1, nome: 'Pizzas', slug: 'pizzas' },
      imagens: [{ id: 1, url: 'https://example.com/img.jpg', ordem: 0, principal: true }],
      precoVenda: '35.00',
      precoPromocional: null,
      ativo: true,
      emDestaque: false,
      maisVendido: false,
      ordemExibicao: 0,
      disponivel: true,
      controlarEstoque: true,
      vendaSemEstoque: false,
      avisoEstoqueBaixo: true,
      estoqueAtual: 20,
      estoqueMinimo: 5,
      pesoVolume: null,
      ingredientes: null,
      observacoesInfo: null,
      custo: null,
      margem: null,
      dataInicioPromocao: null,
      dataFimPromocao: null,
      subcategoria: null,
      descricaoCurta: null,
      descricaoCompleta: null,
      createdBy: null,
      updatedBy: null,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
  ],
  meta: { page: 1, pageSize: 12, total: 1, totalPages: 1 },
};

beforeEach(() => {
  sessionStorage.clear();
});

describe('ProductsPage', () => {
  it('lists products with name, sku, category, price, and stock', async () => {
    seedSession();
    mockFetchHandler((url) => {
      if (url.includes('/api/admin/categories')) return ok(categoriesFixture);
      if (url.includes('/api/admin/products')) return ok(productsFixture);
      return ok({});
    });
    renderAdmin('/admin/produtos');
    await waitFor(() => {
      expect(screen.getByText('Pizza Margherita')).toBeTruthy();
    });
    expect(screen.getByText('P001')).toBeTruthy();
    expect(screen.getAllByText('Pizzas').length).toBeGreaterThan(0);
    expect(screen.getByText('R$ 35,00')).toBeTruthy();
    expect(screen.getByText('20 (mín. 5)')).toBeTruthy();
  });

  it('inactivates a product after confirm', async () => {
    seedSession();
    const freshProducts = { ...productsFixture, data: [...productsFixture.data] };
    let deletionTriggered = false;
    mockFetchHandler((url, init) => {
      if (url.includes('/api/admin/categories')) return ok(categoriesFixture);
      if (init?.method === 'DELETE' && url.includes('/api/admin/products/')) {
        deletionTriggered = true;
        return noContent();
      }
      if (url.includes('/api/admin/products')) return ok(freshProducts);
      return ok({});
    });
    renderAdmin('/admin/produtos');
    await waitFor(() => {
      expect(screen.getByText('Pizza Margherita')).toBeTruthy();
    });
    fireEvent.click(screen.getByText('Inativar'));
    fireEvent.click(screen.getByText('Confirmar?'));
    await waitFor(() => {
      expect(deletionTriggered).toBe(true);
    });
  });
});