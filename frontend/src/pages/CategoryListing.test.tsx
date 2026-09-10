import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CategoryListing } from './CategoryListing';

const categorias = [
  { id: 1, nome: 'Pizzas', slug: 'pizzas', ordem: 1 },
  { id: 2, nome: 'Bebidas', slug: 'bebidas', ordem: 2 },
];

const produto = {
  id: 10,
  nome: 'Pizza Calabresa',
  categoria: { id: 1, nome: 'Pizzas', slug: 'pizzas' },
  imagens: [],
  precoVenda: '45.00',
  precoPromocional: null,
  disponivel: true,
  emDestaque: false,
  maisVendido: false,
};

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
  (fetch as ReturnType<typeof vi.fn>)
    .mockResolvedValueOnce({
      ok: true,
      json: async () => categorias,
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [produto],
        meta: { page: 1, pageSize: 12, total: 1, totalPages: 1 },
      }),
    });
});

describe('CategoryListing', () => {
  it('renders category title and its products', async () => {
    render(
      <MemoryRouter initialEntries={['/categoria/pizzas']}>
        <Routes>
          <Route path="/:categoria/:slug" element={<CategoryListing />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Pizza Calabresa')).toBeTruthy();
    });
    expect(screen.getByRole('heading', { name: 'Pizzas' })).toBeTruthy();
  });

  it('shows not-found message for unknown slug', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockReset();
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => categorias,
    });

    render(
      <MemoryRouter initialEntries={['/categoria/nao-existe']}>
        <Routes>
          <Route path="/:categoria/:slug" element={<CategoryListing />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText(/Categoria não encontrada/)).toBeTruthy();
  });
});