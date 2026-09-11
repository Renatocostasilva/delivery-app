import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { renderAdmin, mockFetchHandler, ok, noContent, seedSession } from './testUtils';

const categoriesFixture = {
  data: [
    {
      id: 1,
      nome: 'Bebidas',
      slug: 'bebidas',
      ordem: 2,
      ativa: true,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      _count: { produtos: 3 },
    },
  ],
  meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
};

beforeEach(() => {
  sessionStorage.clear();
});

describe('CategoriesPage', () => {
  it('lists categories with name, slug, status, and product count', async () => {
    seedSession();
    mockFetchHandler((url) => {
      if (url.includes('/api/admin/categories')) return ok(categoriesFixture);
      return ok({});
    });
    renderAdmin('/admin/categorias');
    await waitFor(() => {
      expect(screen.getByText('Bebidas')).toBeTruthy();
    });
    expect(screen.getByText('bebidas')).toBeTruthy();
    expect(screen.getAllByText('Ativa')).toHaveLength(2);
    expect(screen.getByText('3')).toBeTruthy();
  });

  it('creates a new category', async () => {
    seedSession();
    let created = false;
    mockFetchHandler((url, init) => {
      if (url.includes('/api/admin/categories') && init?.method === 'POST') {
        created = true;
        return ok({ id: 2, nome: 'Sobremesas', slug: 'sobremesas', ordem: 1, ativa: true, createdAt: '', updatedAt: '', _count: { produtos: 0 } });
      }
      if (url.includes('/api/admin/categories')) return ok(categoriesFixture);
      return ok({});
    });
    renderAdmin('/admin/categorias');
    await waitFor(() => {
      expect(screen.getByText('Bebidas')).toBeTruthy();
    });
    fireEvent.change(screen.getByLabelText('Nome da categoria'), { target: { value: 'Sobremesas' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar' }));
    await waitFor(() => {
      expect(created).toBe(true);
    });
  });

  it('deletes a category after confirm', async () => {
    seedSession();
    let deleted = false;
    mockFetchHandler((url, init) => {
      if (init?.method === 'DELETE' && url.includes('/api/admin/categories/')) {
        deleted = true;
        return noContent();
      }
      if (url.includes('/api/admin/categories')) return ok(categoriesFixture);
      return ok({});
    });
    renderAdmin('/admin/categorias');
    await waitFor(() => {
      expect(screen.getByText('Bebidas')).toBeTruthy();
    });
    fireEvent.click(screen.getByText('Excluir'));
    fireEvent.click(screen.getByText('Confirmar?'));
    await waitFor(() => {
      expect(deleted).toBe(true);
    });
  });
});