import type { CartItem } from '../context/CartContext';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function fetchJSON<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    let message = `API ${res.status}: ${res.statusText}`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body?.error) message = body.error;
    } catch {
      // corpo não-JSON: mantém a mensagem padrão
    }
    throw new ApiError(message, res.status);
  }
  return res.json() as Promise<T>;
}

// ─── Tipos do backend (REN-11/12/13) ─────────────────────────────────────────

export type TipoEntrega = 'RETIRADA' | 'ENTREGA';

export interface EnderecoInput {
  logradouro: string;
  numero: string;
  complemento?: string | null;
  bairro: string;
  cidade: string;
  cep: string;
  referencia?: string | null;
}

export interface EnderecoSnapshot {
  logradouro: string;
  numero: string;
  complemento: string | null;
  bairro: string;
  cidade: string;
  cep: string;
  referencia: string | null;
}

export interface Cliente {
  id: number;
  nome: string;
  telefone: string;
  email?: string | null;
}

export interface CupomResumo {
  codigo: string;
  tipo: string;
  valor: string;
  aplicavelFrete: boolean;
}

export interface AdicionalResumo {
  adicionalId: number;
  nome: string;
  precoUnitario: string;
  quantidade: number;
  subtotal: string;
}

export interface ItemCarrinhoResumo {
  id: number;
  produtoId: number;
  produtoNome: string;
  variacaoId: number | null;
  variacaoNome: string | null;
  precoBase: string;
  precoVariacao: string;
  adicionais: AdicionalResumo[];
  precoUnitario: string;
  quantidade: number;
  subtotal: string;
  observacoes: string | null;
  indisponivel: boolean;
  motivoIndisponibilidade: string | null;
}

export interface CartResponse {
  cartKey: string;
  status: string;
  itens: ItemCarrinhoResumo[];
  subtotalProdutos: string;
  taxaEntrega: string;
  desconto: string;
  total: string;
  cupom: CupomResumo | null;
  itensPendentes: boolean;
}

export interface ResumoEntrega {
  cartKey: string;
  tipoEntrega: TipoEntrega;
  endereco: EnderecoSnapshot | null;
  taxaEntrega: string;
}

export interface ResumoPedido {
  cartKey: string;
  itens: ItemCarrinhoResumo[];
  subtotalProdutos: string;
  taxaEntrega: string;
  desconto: string;
  total: string;
  cupom: CupomResumo | null;
  itensPendentes: boolean;
}

export type StatusPedido =
  | 'AGUARDANDO_PAGAMENTO'
  | 'PAGAMENTO_APROVADO'
  | 'RECUSADO'
  | 'CANCELADO'
  | 'ESTORNADO';

export type EstadoPagamento =
  | 'INICIADO'
  | 'PENDENTE'
  | 'APROVADO'
  | 'RECUSADO'
  | 'CANCELADO'
  | 'EXPIRADO'
  | 'ESTORNADO';

export type FormaPagamento = 'PIX' | 'DINHEIRO' | 'CARTAO_CREDITO' | 'CARTAO_DEBITO';

export interface ItemPedido {
  id: number;
  produtoId: number;
  produtoNome: string;
  variacaoNome: string | null;
  quantidade: number;
  precoUnitario: string;
  adicionais: { nome: string; preco: number; quantidade: number }[] | null;
  observacoes: string | null;
  total: string;
}

export interface Pagamento {
  id: number;
  gateway: string;
  estadoPagamento: EstadoPagamento;
  meioPagamento: string | null;
  idGateway: string | null;
  valor: string;
  qrCode: string | null;
  qrCodeBase64: string | null;
  expiraEm: string | null;
  tentativas: number;
  sincronizadoEm: string | null;
  ultimoErroGateway: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PedidoConfirmado {
  id: number;
  numeroPedido: string;
  statusPedido: StatusPedido;
  statusPagamento: EstadoPagamento;
  formaPagamento?: FormaPagamento | null;
  tipoEntrega: TipoEntrega;
  enderecoSnapshot: EnderecoSnapshot | null;
  taxasEntrega: string;
  desconto: string;
  totalProdutos: string;
  total: string;
  observacoes: string | null;
  cliente: Cliente;
  itens: ItemPedido[];
  pagamentos: Pagamento[];
}

export interface ResultadoCobranca {
  criada: boolean;
  pedido: {
    id: number;
    numeroPedido: string;
    statusPedido: StatusPedido;
    statusPagamento: EstadoPagamento;
    total: string;
  };
  pagamento: Pagamento;
}

export interface ResultadoConsulta {
  sincronizado: boolean;
  pedido: {
    id: number;
    numeroPedido: string;
    statusPedido: StatusPedido;
    statusPagamento: EstadoPagamento;
    total: string;
    createdAt: string;
  };
  pagamento: Pagamento;
}

// ─── Carrinho no servidor (REN-11) ───────────────────────────────────────────

export interface AdicionarItemServidorInput {
  produtoId: number;
  variacaoId?: number | null;
  quantidade: number;
  adicionaisSelecionados?: { adicionalId: number; quantidade: number }[];
  observacoes?: string | null;
}

export async function criarCarrinhoServidor(): Promise<{ cartKey: string }> {
  return fetchJSON<{ cartKey: string }>('/api/cart', { method: 'POST' });
}

export async function adicionarItemServidor(
  cartKey: string,
  input: AdicionarItemServidorInput,
): Promise<CartResponse> {
  return fetchJSON<CartResponse>(`/api/cart/${cartKey}/items`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function itemParaServidor(item: CartItem): AdicionarItemServidorInput {
  return {
    produtoId: item.produtoId,
    variacaoId: item.variacao?.id ?? null,
    quantidade: item.quantidade,
    adicionaisSelecionados: item.adicionais.map((a) => ({
      adicionalId: a.id,
      quantidade: a.quantidade,
    })),
    observacoes: item.observacoes ?? null,
  };
}

// ─── Checkout em etapas (REN-12) ─────────────────────────────────────────────

export async function identificarCliente(
  cartKey: string,
  nome: string,
  telefone: string,
): Promise<{ cliente: Cliente }> {
  return fetchJSON<{ cliente: Cliente }>('/api/checkout/identify', {
    method: 'POST',
    body: JSON.stringify({ cartKey, nome, telefone }),
  });
}

export async function definirEntrega(
  cartKey: string,
  tipoEntrega: TipoEntrega,
  endereco?: EnderecoInput | null,
): Promise<ResumoEntrega> {
  return fetchJSON<ResumoEntrega>('/api/checkout/delivery', {
    method: 'POST',
    body: JSON.stringify({
      cartKey,
      tipoEntrega,
      ...(endereco ? { endereco } : {}),
    }),
  });
}

export async function resumoPedido(
  cartKey: string,
  tipoEntrega: TipoEntrega,
): Promise<ResumoPedido> {
  return fetchJSON<ResumoPedido>('/api/checkout/summary', {
    method: 'POST',
    body: JSON.stringify({ cartKey, tipoEntrega }),
  });
}

export interface ConfirmarPedidoInput {
  cartKey: string;
  idempotencyKey: string;
  nome: string;
  telefone: string;
  tipoEntrega: TipoEntrega;
  endereco?: EnderecoInput | null;
  observacoes?: string | null;
  formaPagamento?: FormaPagamento;
}

export async function confirmarPedido(
  input: ConfirmarPedidoInput,
): Promise<PedidoConfirmado> {
  return fetchJSON<PedidoConfirmado>('/api/checkout/confirm', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

// ─── Pagamento (REN-13) ───────────────────────────────────────────────────────

export async function criarCobranca(
  pedidoId: number,
  input: {
    metodo: 'pix' | 'cartao';
    email?: string;
    token?: string;
    paymentMethodId?: string;
    installments?: number;
  },
): Promise<ResultadoCobranca> {
  return fetchJSON<ResultadoCobranca>(`/api/payments/${pedidoId}/cobrancas`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function consultarPagamento(
  pedidoId: number,
  sync = false,
): Promise<ResultadoConsulta> {
  const qs = sync ? '?sync=true' : '';
  return fetchJSON<ResultadoConsulta>(`/api/payments/${pedidoId}${qs}`);
}