export interface AdminUser {
  id: number;
  email: string;
  nome: string;
}

export interface AuthResponse {
  token: string;
  admin: AdminUser;
}

export interface PaginaMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface PaginaAdmin<T> {
  data: T[];
  meta: PaginaMeta;
}

export type StatusPedido =
  | 'RECEBIDO'
  | 'AGUARDANDO_PAGAMENTO'
  | 'PAGAMENTO_APROVADO'
  | 'EM_PREPARACAO'
  | 'PRONTO'
  | 'SAIU_PARA_ENTREGA'
  | 'ENTREGUE'
  | 'CANCELADO'
  | 'RECUSADO'
  | 'FALHA_PAGAMENTO'
  | 'ESTORNADO';

export type StatusPagamento =
  | 'INICIADO'
  | 'PENDENTE'
  | 'APROVADO'
  | 'RECUSADO'
  | 'CANCELADO'
  | 'EXPIRADO'
  | 'ESTORNADO';

export type TipoEntrega = 'RETIRADA' | 'ENTREGA';

export interface AdminCategoria {
  id: number;
  nome: string;
  slug: string;
  ordem: number;
  ativa: boolean;
  createdAt: string;
  updatedAt: string;
  _count: { produtos: number };
}

export interface AdminCategoriaDetalhe {
  id: number;
  nome: string;
  slug: string;
  ordem: number;
  ativa: boolean;
  createdAt: string;
  updatedAt: string;
  produtos: AdminProduto[];
}

export interface AdminImagemProduto {
  id: number;
  url: string;
  ordem: number;
  principal: boolean;
}

export interface AdminVariacao {
  id: number;
  nome: string;
  precoAdicional: string;
  ativo: boolean;
  ordem: number;
}

export interface AdminAdicional {
  id: number;
  nome: string;
  precoAdicional: string;
  obrigatorio: boolean;
  quantidadeMinima: number;
  quantidadeMaxima: number;
  ativo: boolean;
  ordem: number;
}

export interface AdminProduto {
  id: number;
  nome: string;
  sku: string;
  categoriaId: number;
  subcategoria: string | null;
  descricaoCurta: string | null;
  descricaoCompleta: string | null;
  ingredientes: string | null;
  observacoesInfo: string | null;
  ativo: boolean;
  emDestaque: boolean;
  maisVendido: boolean;
  ordemExibicao: number;
  disponivel: boolean;
  controlarEstoque: boolean;
  vendaSemEstoque: boolean;
  avisoEstoqueBaixo: boolean;
  pesoVolume: string | null;
  precoVenda: string;
  precoPromocional: string | null;
  custo: string | null;
  margem: string | null;
  dataInicioPromocao: string | null;
  dataFimPromocao: string | null;
  estoqueAtual: number;
  estoqueMinimo: number;
  createdBy: number | null;
  updatedBy: number | null;
  createdAt: string;
  updatedAt: string;
  categoria: { id: number; nome: string; slug: string } | null;
  imagens: AdminImagemProduto[];
  variacoes?: AdminVariacao[];
  adicionais?: AdminAdicional[];
}

export interface ClienteResumo {
  id: number;
  nome: string;
  telefone: string;
  email?: string | null;
}

export interface ItemPedidoAdicional {
  nome: string;
  preco: string;
}

export interface ItemPedido {
  id: number;
  pedidoId: number;
  produtoId: number | null;
  produtoNome: string;
  variacaoNome: string | null;
  quantidade: number;
  precoUnitario: string;
  precoPromocionalUnitario: string | null;
  adicionais: ItemPedidoAdicional[];
  observacoes: string | null;
  total: string;
  createdAt: string;
}

export interface PagamentoAdmin {
  id: number;
  gateway: string;
  valor: string;
  meioPagamento: string | null;
  estadoPagamento: StatusPagamento;
  tentativas: number;
  idGateway: string | null;
  qrCodeBase64: string | null;
  expiraEm: string | null;
  ultimoErroGateway: string | null;
  sincronizadoEm: string | null;
  createdAt: string;
}

export interface StatusHistorico {
  id: number;
  pedidoId: number;
  de: StatusPedido | null;
  para: StatusPedido;
  adminId: number | null;
  observacao: string | null;
  criadoEm: string;
}

export interface PedidoResumo {
  id: number;
  numeroPedido: string;
  clienteId: number;
  statusPedido: StatusPedido;
  statusPagamento: StatusPagamento;
  tipoEntrega: TipoEntrega;
  taxasEntrega: string;
  desconto: string;
  totalProdutos: string;
  total: string;
  formaPagamento: string | null;
  observacoes: string | null;
  createdAt: string;
  updatedAt: string;
  cliente: ClienteResumo;
  itens: { produtoNome: string; quantidade: number }[];
}

export interface PedidoDetalhe extends PedidoResumo {
  enderecoSnapshot: unknown;
  cliente: ClienteResumo;
  itens: ItemPedido[];
  pagamentos: PagamentoAdmin[];
  historico: StatusHistorico[];
}

export interface PaginaPedidos {
  data: PedidoResumo[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ReciboPedido {
  numeroPedido: string;
  status: StatusPedido;
  cliente: { nome: string; telefone: string; email: string | null };
  itens: {
    nome: string;
    variacao: string | null;
    quantidade: number;
    precoUnitario: string;
    adicionais: ItemPedidoAdicional[];
    total: string;
  }[];
  subtotal: string;
  taxaEntrega: string;
  desconto: string;
  total: string;
  formaPagamento: string | null;
  observacoes: string | null;
  criadoEm: string;
}

export interface DashboardResumo {
  totalPedidos: number;
  totalVendas: number;
  totalFrete: number;
  totalDescontos: number;
  pedidosFinalizados: number;
  ticketMedio: number;
}

export interface TopProduto {
  nome: string;
  quantidadeVendida: number;
  totalVendido: number;
  vezesPedido: number;
}

export interface PedidoRecente {
  id: number;
  numeroPedido: string;
  status: StatusPedido;
  total: string;
  cliente: string;
  criadoEm: string;
}

export interface DashboardData {
  resumo: DashboardResumo;
  pedidosPorStatus: Partial<Record<StatusPedido, number>>;
  topProdutos: TopProduto[];
  pedidosRecentes: PedidoRecente[];
}