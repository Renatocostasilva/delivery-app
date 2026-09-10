import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getHome, getCategories, getProducts } from './catalog';

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
  vi.stubEnv('VITE_API_URL', 'http://localhost:3000');
});

describe('catalog API client', () => {
  it('getHome fetches /api/catalog/home', async () => {
    const mockData = {
      categorias: [],
      destaques: [],
      maisVendidos: [],
      promocoes: [],
    };
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => mockData,
    });

    const result = await getHome();
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/catalog/home',
      expect.objectContaining({ headers: { 'Content-Type': 'application/json' } }),
    );
    expect(result).toEqual(mockData);
  });

  it('getCategories fetches /api/catalog/categories', async () => {
    const mockData = [{ id: 1, nome: 'Pizzas', slug: 'pizzas', ordem: 1 }];
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => mockData,
    });

    const result = await getCategories();
    expect(result).toEqual(mockData);
  });

  it('getProducts builds query string correctly', async () => {
    const mockData = { data: [], meta: { page: 1, pageSize: 12, total: 0, totalPages: 0 } };
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => mockData,
    });

    await getProducts({ busca: 'pizza', page: 2, pageSize: 10 });
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/catalog/products?busca=pizza&page=2&pageSize=10',
      expect.anything(),
    );
  });

  it('throws on non-ok response', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    });

    await expect(getHome()).rejects.toThrow('API 500');
  });
});
