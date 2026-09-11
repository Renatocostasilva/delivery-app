import type {
  AdminCategoria,
  AdminCategoriaDetalhe,
  AdminImagemProduto,
  AdminProduto,
  AdminVariacao,
  AdminAdicional,
  AuthResponse,
  PaginaAdmin,
  PaginaPedidos,
  PedidoDetalhe,
  PedidoResumo,
  ReciboPedido,
  StatusHistorico,
  DashboardData,
  TipoEntrega,
  PagamentoAdmin,
  ClienteAdmin,
  ClienteEndereco,
  PaginaClientesAdmin,
} from './types';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

const SESSION_KEY = 'delivery-admin:session';

export interface AdminSession {
  token: string;
  admin: { id: number; email: string; nome: string };
}

export class AdminApiError extends Error {}

export function readSession(): AdminSession | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AdminSession;
    if (parsed && typeof parsed.token === 'string') return parsed;
    return null;
  } catch {
    return null;
  }
}

export function saveSession(session: AdminSession): void {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // sessão só em memória se o storage estiver indisponível
  }
}

export function clearSession(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // ignora
  }
}

async function adminFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const session = readSession();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
  };
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { ...headers, ...((init.headers as Record<string, string>) ?? {}) },
  });

  if (res.status === 401) {
    clearSession();
  }
  if (!res.ok) {
    let detail = `API ${res.status}: ${res.statusText}`;
    try {
      const body = (await res.json()) as { message?: string; erro?: string };
      detail = body.message ?? body.erro ?? detail;
    } catch {
      // corpo não-JSON: mantém mensagem padrão
    }
    throw new AdminApiError(detail);
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return res.json() as Promise<T>;
}

// ---- Auth ----

export function adminLogin(body: { email: string; senha: string }): Promise<AuthResponse> {
  return adminFetch<AuthResponse>('/api/admin/auth/login', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function adminLogout(): Promise<void> {
  return adminFetch<void>('/api/admin/auth/logout', { method: 'POST' });
}

// ---- Dashboard ----

export interface DashboardParams {
  dataInicio?: string;
  dataFim?: string;
}

export function getDashboard(params: DashboardParams = {}): Promise<DashboardData> {
  const qs = new URLSearchParams();
  if (params.dataInicio) qs.set('dataInicio', params.dataInicio);
  if (params.dataFim) qs.set('dataFim', params.dataFim);
  const query = qs.toString();
  return adminFetch<DashboardData>(`/api/admin/dashboard${query ? `?${query}` : ''}`);
}

// ---- Categorias ----

export interface CategoryListParams {
  busca?: string;
  ativa?: boolean;
  page?: number;
  pageSize?: number;
}

export interface CategoryInput {
  nome?: string;
  slug?: string;
  ordem?: number;
  ativa?: boolean;
}

export interface DeleteCategoryResult {
  message: string;
  deleted: boolean;
  inativada: boolean;
}

export function getCategories(params: CategoryListParams = {}): Promise<PaginaAdmin<AdminCategoria>> {
  const qs = new URLSearchParams();
  if (params.busca) qs.set('busca', params.busca);
  if (params.ativa !== undefined) qs.set('ativa', String(params.ativa));
  if (params.page) qs.set('page', String(params.page));
  if (params.pageSize) qs.set('pageSize', String(params.pageSize));
  const query = qs.toString();
  return adminFetch<PaginaAdmin<AdminCategoria>>(`/api/admin/categories${query ? `?${query}` : ''}`);
}

export function getCategory(id: number): Promise<AdminCategoriaDetalhe> {
  return adminFetch<AdminCategoriaDetalhe>(`/api/admin/categories/${id}`);
}

export function createCategory(body: CategoryInput): Promise<AdminCategoria> {
  return adminFetch<AdminCategoria>('/api/admin/categories', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function updateCategory(id: number, body: CategoryInput): Promise<AdminCategoria> {
  return adminFetch<AdminCategoria>(`/api/admin/categories/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function deleteCategory(id: number): Promise<void | DeleteCategoryResult> {
  return adminFetch<void | DeleteCategoryResult>(`/api/admin/categories/${id}`, {
    method: 'DELETE',
  });
}

// ---- Produtos ----

export interface ProductListParams {
  busca?: string;
  categoriaId?: number;
  ativo?: boolean;
  emDestaque?: boolean;
  maisVendido?: boolean;
  comEstoque?: boolean;
  page?: number;
  pageSize?: number;
}

export interface ProductInput {
  nome?: string;
  sku?: string;
  categoriaId?: number;
  subcategoria?: string | null;
  descricaoCurta?: string | null;
  descricaoCompleta?: string | null;
  ingredientes?: string | null;
  observacoesInfo?: string | null;
  ativo?: boolean;
  emDestaque?: boolean;
  maisVendido?: boolean;
  disponivel?: boolean;
  controlarEstoque?: boolean;
  vendaSemEstoque?: boolean;
  avisoEstoqueBaixo?: boolean;
  ordemExibicao?: number;
  estoqueAtual?: number;
  estoqueMinimo?: number;
  precoVenda?: string;
  precoPromocional?: string | null;
  custo?: string | null;
  margem?: string | null;
  pesoVolume?: string | null;
  dataInicioPromocao?: string | null;
  dataFimPromocao?: string | null;
}

export function getProducts(params: ProductListParams = {}): Promise<PaginaAdmin<AdminProduto>> {
  const qs = new URLSearchParams();
  if (params.busca) qs.set('busca', params.busca);
  if (params.categoriaId) qs.set('categoriaId', String(params.categoriaId));
  if (params.ativo !== undefined) qs.set('ativo', String(params.ativo));
  if (params.emDestaque !== undefined) qs.set('emDestaque', String(params.emDestaque));
  if (params.maisVendido !== undefined) qs.set('maisVendido', String(params.maisVendido));
  if (params.comEstoque !== undefined) qs.set('comEstoque', String(params.comEstoque));
  if (params.page) qs.set('page', String(params.page));
  if (params.pageSize) qs.set('pageSize', String(params.pageSize));
  const query = qs.toString();
  return adminFetch<PaginaAdmin<AdminProduto>>(`/api/admin/products${query ? `?${query}` : ''}`);
}

export function getProduct(id: number): Promise<AdminProduto> {
  return adminFetch<AdminProduto>(`/api/admin/products/${id}`);
}

export function createProduct(body: ProductInput): Promise<AdminProduto> {
  return adminFetch<AdminProduto>('/api/admin/products', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function updateProduct(id: number, body: ProductInput): Promise<AdminProduto> {
  return adminFetch<AdminProduto>(`/api/admin/products/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function deleteProduct(id: number): Promise<void> {
  return adminFetch<void>(`/api/admin/products/${id}`, { method: 'DELETE' });
}

// ---- Produto: imagens ----

export interface ImageInput {
  url: string;
  ordem?: number;
  principal?: boolean;
}

export interface ImageUpdateInput {
  ordem?: number;
  principal?: boolean;
}

export function addProductImage(productId: number, body: ImageInput): Promise<AdminImagemProduto> {
  return adminFetch<AdminImagemProduto>(`/api/admin/products/${productId}/images`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function updateProductImage(
  productId: number,
  imageId: number,
  body: ImageUpdateInput,
): Promise<AdminImagemProduto> {
  return adminFetch<AdminImagemProduto>(`/api/admin/products/${productId}/images/${imageId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function deleteProductImage(productId: number, imageId: number): Promise<void> {
  return adminFetch<void>(`/api/admin/products/${productId}/images/${imageId}`, {
    method: 'DELETE',
  });
}

// ---- Produto: variações ----

export interface VariacaoInput {
  nome: string;
  precoAdicional?: string;
  ativo?: boolean;
  ordem?: number;
}

export function addProductVariacao(
  productId: number,
  body: VariacaoInput,
): Promise<AdminVariacao> {
  return adminFetch<AdminVariacao>(`/api/admin/products/${productId}/variacoes`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function updateProductVariacao(
  productId: number,
  variacaoId: number,
  body: Partial<VariacaoInput>,
): Promise<AdminVariacao> {
  return adminFetch<AdminVariacao>(`/api/admin/products/${productId}/variacoes/${variacaoId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function deleteProductVariacao(productId: number, variacaoId: number): Promise<void> {
  return adminFetch<void>(`/api/admin/products/${productId}/variacoes/${variacaoId}`, {
    method: 'DELETE',
  });
}

// ---- Produto: adicionais ----

export interface AdicionalInput {
  nome: string;
  precoAdicional?: string;
  obrigatorio?: boolean;
  quantidadeMinima?: number;
  quantidadeMaxima?: number;
  ativo?: boolean;
  ordem?: number;
}

export function addProductAdicional(
  productId: number,
  body: AdicionalInput,
): Promise<AdminAdicional> {
  return adminFetch<AdminAdicional>(`/api/admin/products/${productId}/adicionais`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function updateProductAdicional(
  productId: number,
  adicionalId: number,
  body: Partial<AdicionalInput>,
): Promise<AdminAdicional> {
  return adminFetch<AdminAdicional>(`/api/admin/products/${productId}/adicionais/${adicionalId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function deleteProductAdicional(productId: number, adicionalId: number): Promise<void> {
  return adminFetch<void>(`/api/admin/products/${productId}/adicionais/${adicionalId}`, {
    method: 'DELETE',
  });
}

// ---- Pedidos ----

export interface OrderListParams {
  status?: string;
  busca?: string;
  dataInicio?: string;
  dataFim?: string;
  page?: number;
  pageSize?: number;
}

export function getOrders(params: OrderListParams = {}): Promise<PaginaPedidos> {
  const qs = new URLSearchParams();
  if (params.status) qs.set('status', params.status);
  if (params.busca) qs.set('busca', params.busca);
  if (params.dataInicio) qs.set('dataInicio', params.dataInicio);
  if (params.dataFim) qs.set('dataFim', params.dataFim);
  if (params.page) qs.set('page', String(params.page));
  if (params.pageSize) qs.set('pageSize', String(params.pageSize));
  const query = qs.toString();
  return adminFetch<PaginaPedidos>(`/api/admin/orders${query ? `?${query}` : ''}`);
}

export function getOrder(id: number): Promise<PedidoDetalhe> {
  return adminFetch<PedidoDetalhe>(`/api/admin/orders/${id}`);
}

export function updateOrderStatus(
  id: number,
  body: { status: string; observacao?: string },
): Promise<PedidoResumo> {
  return adminFetch<PedidoResumo>(`/api/admin/orders/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function cancelOrder(id: number, body: { motivo: string }): Promise<void> {
  return adminFetch<void>(`/api/admin/orders/${id}/cancel`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function refundOrder(id: number, body: { motivo: string }): Promise<void> {
  return adminFetch<void>(`/api/admin/orders/${id}/refund`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function getOrderReceipt(id: number): Promise<ReciboPedido> {
  return adminFetch<ReciboPedido>(`/api/admin/orders/${id}/receipt`);
}

export function getOrderHistory(id: number): Promise<StatusHistorico[]> {
  return adminFetch<StatusHistorico[]>(`/api/admin/orders/${id}/history`);
}

export function getOrderPayments(id: number): Promise<PagamentoAdmin[]> {
  return adminFetch<PagamentoAdmin[]>(`/api/admin/orders/${id}/payments`);
}

export interface ClientListParams {
  busca?: string;
  page?: number;
  pageSize?: number;
}

export interface PaginaClientes {
  data: { id: number; nome: string; telefone: string; _count: { pedidos: number } }[];
  total: number;
  page: number;
  pageSize: number;
}

export function getOrderClients(params: ClientListParams = {}): Promise<PaginaClientes> {
  const qs = new URLSearchParams();
  if (params.busca) qs.set('busca', params.busca);
  if (params.page) qs.set('page', String(params.page));
  if (params.pageSize) qs.set('pageSize', String(params.pageSize));
  const query = qs.toString();
  return adminFetch<PaginaClientes>(`/api/admin/orders/clients/list${query ? `?${query}` : ''}`);
}

export function tipoEntregaLabel(tipo: TipoEntrega): string {
  return tipo === 'ENTREGA' ? 'Entrega' : 'Retirada';
}

// ---- Clientes (admin) — CRUD via /api/admin/clients (REN-10) ----

export interface ClientEnderecoInput {
  logradouro: string;
  numero: string;
  bairro: string;
  cidade: string;
  cep: string;
  complemento?: string | null;
  referencia?: string | null;
  principal?: boolean;
}

export interface ClientEnderecoUpdateInput {
  id?: number;
  remover?: boolean;
  logradouro?: string;
  numero?: string;
  bairro?: string;
  cidade?: string;
  cep?: string;
  complemento?: string | null;
  referencia?: string | null;
  principal?: boolean;
}

export interface ClientUpdateInput {
  nome?: string;
  email?: string | null;
  ativo?: boolean;
  enderecos?: ClientEnderecoUpdateInput[];
}

export interface ClientInput {
  nome?: string;
  telefone?: string;
  email?: string | null;
  ativo?: boolean;
  enderecos?: ClientEnderecoInput[];
}

export interface ClientListParams {
  busca?: string;
  ativo?: boolean;
  page?: number;
  pageSize?: number;
}

export function getClients(params: ClientListParams = {}): Promise<PaginaClientesAdmin> {
  const qs = new URLSearchParams();
  if (params.busca) qs.set('busca', params.busca);
  if (params.ativo !== undefined) qs.set('ativo', String(params.ativo));
  if (params.page) qs.set('page', String(params.page));
  if (params.pageSize) qs.set('pageSize', String(params.pageSize));
  const query = qs.toString();
  return adminFetch<PaginaClientesAdmin>(`/api/admin/clients${query ? `?${query}` : ''}`);
}

export function getClient(id: number): Promise<ClienteAdmin & { enderecos: ClienteEndereco[] }> {
  return adminFetch(`/api/admin/clients/${id}`);
}

export function createClient(body: ClientInput): Promise<ClienteAdmin> {
  return adminFetch<ClienteAdmin>('/api/admin/clients', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function updateClient(id: number, body: ClientUpdateInput): Promise<ClienteAdmin> {
  return adminFetch<ClienteAdmin>(`/api/admin/clients/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function deleteClient(id: number): Promise<void> {
  return adminFetch<void>(`/api/admin/clients/${id}`, { method: 'DELETE' });
}