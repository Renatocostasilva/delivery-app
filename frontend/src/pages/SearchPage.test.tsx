import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SearchPage } from './SearchPage';

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
  (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
    ok: true,
    json: async () => ({ data: [], meta: { page: 1, pageSize: 12, total: 0, totalPages: 0 } }),
  });
});

describe('SearchPage', () => {
  it('renders search input and button', () => {
    render(
      <MemoryRouter>
        <SearchPage />
      </MemoryRouter>,
    );
    expect(screen.getByPlaceholderText('Buscar produtos…')).toBeTruthy();
    expect(screen.getByText('Buscar')).toBeTruthy();
  });

  it('fetches products on search submit', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [{ id: 1, nome: 'Pizza', categoria: { id: 1, nome: 'Pizzas', slug: 'pizzas' }, imagens: [], precoVenda: '30.00', precoPromocional: null, disponivel: true, emDestaque: false, maisVendido: false }],
        meta: { page: 1, pageSize: 12, total: 1, totalPages: 1 },
      }),
    });

    render(
      <MemoryRouter initialEntries={['/busca']}>
        <SearchPage />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByPlaceholderText('Buscar produtos…'), {
      target: { value: 'pizza' },
    });
    fireEvent.click(screen.getByText('Buscar'));

    await waitFor(() => {
      expect(screen.getByText('Pizza')).toBeTruthy();
    });
  });
});
