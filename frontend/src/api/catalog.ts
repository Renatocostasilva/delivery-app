import type { Categoria, HomeData, PaginaProdutos, ProdutoDetalhe } from './types';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

async function fetchJSON<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export function getHome(): Promise<HomeData> {
  return fetchJSON<HomeData>('/api/catalog/home');
}

export function getCategories(): Promise<Categoria[]> {
  return fetchJSON<Categoria[]>('/api/catalog/categories');
}

export function getProductDetail(idOrSlug: number | string): Promise<ProdutoDetalhe> {
  return fetchJSON<ProdutoDetalhe>(`/api/catalog/products/${idOrSlug}`);
}

interface ProductsParams {
  categoriaId?: number;
  busca?: string;
  page?: number;
  pageSize?: number;
}

export function getProducts(params: ProductsParams = {}): Promise<PaginaProdutos> {
  const qs = new URLSearchParams();
  if (params.categoriaId) qs.set('categoriaId', String(params.categoriaId));
  if (params.busca) qs.set('busca', params.busca);
  if (params.page) qs.set('page', String(params.page));
  if (params.pageSize) qs.set('pageSize', String(params.pageSize));
  const query = qs.toString();
  return fetchJSON<PaginaProdutos>(`/api/catalog/products${query ? `?${query}` : ''}`);
}
