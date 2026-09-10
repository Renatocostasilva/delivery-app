export interface Categoria {
  id: number;
  nome: string;
  slug: string;
  ordem: number;
  _count?: { produtos: number };
}

export interface ImagemProduto {
  id: number;
  url: string;
  principal: boolean;
}

export interface ProdutoCard {
  id: number;
  nome: string;
  categoria: { id: number; nome: string; slug: string };
  imagens: ImagemProduto[];
  precoVenda: string;
  precoPromocional: string | null;
  temVariacoes?: boolean;
  disponivel: boolean;
  emDestaque: boolean;
  maisVendido: boolean;
  emPromocional?: boolean;
}

export interface PaginaMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface PaginaProdutos {
  data: ProdutoCard[];
  meta: PaginaMeta;
}

export interface HomeData {
  categorias: Categoria[];
  destaques: ProdutoCard[];
  maisVendidos: ProdutoCard[];
  promocoes: ProdutoCard[];
}

export interface Variacao {
  id: number;
  nome: string;
  precoAdicional: string;
  ativo: boolean;
  ordem: number;
}

export interface Adicional {
  id: number;
  nome: string;
  precoAdicional: string;
  obrigatorio: boolean;
  quantidadeMinima: number;
  quantidadeMaxima: number;
  ativo: boolean;
  ordem: number;
}

export interface ProdutoDetalhe {
  id: number;
  nome: string;
  sku: string;
  subcategoria: string | null;
  descricaoCurta: string | null;
  descricaoCompleta: string | null;
  ingredientes: string | null;
  observacoesInfo: string | null;
  disponivel: boolean;
  emDestaque: boolean;
  maisVendido: boolean;
  precoVenda: string;
  precoPromocional: string | null;
  emPromocao: boolean;
  emPromocional?: boolean;
  controlarEstoque: boolean;
  estoqueAtual: number;
  estoqueMinimo: number;
  pesoVolume: string | null;
  categoria: { id: number; nome: string; slug: string };
  imagens: ImagemProduto[];
  variacoes: Variacao[];
  adicionais: Adicional[];
}
