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
