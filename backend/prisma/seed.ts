import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const categorias = [
  { nome: "Bolos", slug: "bolos", ordem: 1 },
  { nome: "Doces", slug: "doces", ordem: 2 },
  { nome: "Salgados", slug: "salgados", ordem: 3 },
  { nome: "Combos", slug: "combos", ordem: 4 },
  { nome: "Bebidas", slug: "bebidas", ordem: 5 },
  { nome: "Kits", slug: "kits", ordem: 6 },
  { nome: "Promocoes", slug: "promocoes", ordem: 7 },
];

type ProdutoSeed = {
  nome: string;
  sku: string;
  categoriaSlug: string;
  subcategoria?: string;
  descricaoCurta?: string;
  descricaoCompleta?: string;
  precoVenda: Prisma.Decimal;
  emDestaque?: boolean;
  maisVendido?: boolean;
  controlarEstoque?: boolean;
  estoqueAtual?: number;
  estoqueMinimo?: number;
  avisoEstoqueBaixo?: boolean;
  variacoes?: Array<{
    nome: string;
    precoAdicional: Prisma.Decimal;
    ordem: number;
  }>;
  adicionais?: Array<{
    nome: string;
    precoAdicional: Prisma.Decimal;
    obrigatorio: boolean;
    quantidadeMinima: number;
    quantidadeMaxima: number;
    ordem: number;
  }>;
};

const produtos: ProdutoSeed[] = [
  {
    nome: "Bolo de Chocolate",
    sku: "BOLO-CHOC",
    categoriaSlug: "bolos",
    subcategoria: "Bolos clássicos",
    descricaoCurta: "Massa úmida de chocolate com recheio cremoso.",
    descricaoCompleta:
      "Bolo de chocolate artesanal, massa úmida, recheio cremoso e cobertura de ganache.",
    precoVenda: new Prisma.Decimal("80.00"),
    emDestaque: true,
    maisVendido: true,
    controlarEstoque: true,
    estoqueAtual: 6,
    estoqueMinimo: 2,
    avisoEstoqueBaixo: true,
    variacoes: [
      { nome: "Pequeno (2kg)", precoAdicional: new Prisma.Decimal("0"), ordem: 1 },
      { nome: "Médio (3kg)", precoAdicional: new Prisma.Decimal("15.00"), ordem: 2 },
      { nome: "Grande (5kg)", precoAdicional: new Prisma.Decimal("30.00"), ordem: 3 },
    ],
    adicionais: [
      { nome: "Chocolate", precoAdicional: new Prisma.Decimal("5.00"), obrigatorio: false, quantidadeMinima: 0, quantidadeMaxima: 3, ordem: 1 },
      { nome: "Morango", precoAdicional: new Prisma.Decimal("7.00"), obrigatorio: false, quantidadeMinima: 0, quantidadeMaxima: 3, ordem: 2 },
      { nome: "Nutella", precoAdicional: new Prisma.Decimal("8.00"), obrigatorio: false, quantidadeMinima: 0, quantidadeMaxima: 3, ordem: 3 },
    ],
  },
  {
    nome: "Bolo de Morango",
    sku: "BOLO-MOR",
    categoriaSlug: "bolos",
    subcategoria: "Bolos de frutas",
    descricaoCurta: "Bolo branco com recheio e cobertura de morango.",
    descricaoCompleta:
      "Bolo branco fofinho recheado com creme e morangos frescos, coberto por chantilly.",
    precoVenda: new Prisma.Decimal("95.00"),
    emDestaque: true,
    controlarEstoque: true,
    estoqueAtual: 4,
    estoqueMinimo: 2,
    avisoEstoqueBaixo: true,
    variacoes: [
      { nome: "Pequeno (2kg)", precoAdicional: new Prisma.Decimal("0"), ordem: 1 },
      { nome: "Médio (3kg)", precoAdicional: new Prisma.Decimal("15.00"), ordem: 2 },
      { nome: "Grande (5kg)", precoAdicional: new Prisma.Decimal("30.00"), ordem: 3 },
    ],
    adicionais: [
      { nome: "Chocolate", precoAdicional: new Prisma.Decimal("5.00"), obrigatorio: false, quantidadeMinima: 0, quantidadeMaxima: 3, ordem: 1 },
      { nome: "Morango", precoAdicional: new Prisma.Decimal("7.00"), obrigatorio: false, quantidadeMinima: 0, quantidadeMaxima: 3, ordem: 2 },
      { nome: "Nutella", precoAdicional: new Prisma.Decimal("8.00"), obrigatorio: false, quantidadeMinima: 0, quantidadeMaxima: 3, ordem: 3 },
    ],
  },
  {
    nome: "Combo Aniversário",
    sku: "COMBO-ANIV",
    categoriaSlug: "combos",
    descricaoCurta: "Bolo + docinhos + salgadinhos para a sua festa.",
    descricaoCompleta:
      "Combo completo para festas: bolo, doces variados, salgadinhos e refrigerante. Ideal para comemorar em casa.",
    precoVenda: new Prisma.Decimal("150.00"),
    emDestaque: true,
    maisVendido: true,
    controlarEstoque: true,
    estoqueAtual: 3,
    estoqueMinimo: 1,
    avisoEstoqueBaixo: true,
    variacoes: [
      { nome: "10 pessoas", precoAdicional: new Prisma.Decimal("0"), ordem: 1 },
      { nome: "20 pessoas", precoAdicional: new Prisma.Decimal("40.00"), ordem: 2 },
      { nome: "30 pessoas", precoAdicional: new Prisma.Decimal("80.00"), ordem: 3 },
    ],
  },
  {
    nome: "Refrigerante de Lata 350ml",
    sku: "BEB-LATA-350",
    categoriaSlug: "bebidas",
    subcategoria: "Refrigerantes",
    descricaoCurta: "Lata gelada 350ml.",
    descricaoCompleta: "Refrigerante lata 350ml para acompanhar seu pedido.",
    precoVenda: new Prisma.Decimal("6.50"),
  },
];

async function main() {
  console.log("Iniciando seed...");

  for (const categoria of categorias) {
    const { id } = await prisma.categoria.upsert({
      where: { slug: categoria.slug },
      update: { nome: categoria.nome, ordem: categoria.ordem, ativa: true },
      create: categoria,
    });
    console.log(`Categoria pronta: ${categoria.nome} (${id})`);
  }

  for (const produto of produtos) {
    await prisma.variacao.deleteMany({
      where: { produto: { sku: produto.sku } },
    });
    await prisma.adicional.deleteMany({
      where: { produto: { sku: produto.sku } },
    });

    await prisma.produto.upsert({
      where: { sku: produto.sku },
      update: {
        nome: produto.nome,
        categoria: { connect: { slug: produto.categoriaSlug } },
        subcategoria: produto.subcategoria,
        descricaoCurta: produto.descricaoCurta,
        descricaoCompleta: produto.descricaoCompleta,
        precoVenda: produto.precoVenda,
        emDestaque: produto.emDestaque ?? false,
        maisVendido: produto.maisVendido ?? false,
        controlarEstoque: produto.controlarEstoque ?? false,
        estoqueAtual: produto.estoqueAtual ?? 0,
        estoqueMinimo: produto.estoqueMinimo ?? 0,
        avisoEstoqueBaixo: produto.avisoEstoqueBaixo ?? false,
        disponivel: true,
        ativo: true,
        variacoes: { create: produto.variacoes ?? [] },
        adicionais: { create: produto.adicionais ?? [] },
      },
      create: {
        nome: produto.nome,
        sku: produto.sku,
        subcategoria: produto.subcategoria,
        descricaoCurta: produto.descricaoCurta,
        descricaoCompleta: produto.descricaoCompleta,
        precoVenda: produto.precoVenda,
        emDestaque: produto.emDestaque ?? false,
        maisVendido: produto.maisVendido ?? false,
        controlarEstoque: produto.controlarEstoque ?? false,
        estoqueAtual: produto.estoqueAtual ?? 0,
        estoqueMinimo: produto.estoqueMinimo ?? 0,
        avisoEstoqueBaixo: produto.avisoEstoqueBaixo ?? false,
        disponivel: true,
        ativo: true,
        categoria: { connect: { slug: produto.categoriaSlug } },
        variacoes: { create: produto.variacoes ?? [] },
        adicionais: { create: produto.adicionais ?? [] },
      },
    });

    const criado = await prisma.produto.findUniqueOrThrow({
      where: { sku: produto.sku },
      select: { id: true, nome: true },
    });
    console.log(`Produto pronto: ${criado.nome} (${criado.id})`);
  }

  const [totalCategorias, totalProdutos, totalVariacoes, totalAdicionais] =
    await Promise.all([
      prisma.categoria.count(),
      prisma.produto.count(),
      prisma.variacao.count(),
      prisma.adicional.count(),
    ]);

  console.log(
    `Seed concluído: ${totalCategorias} categorias, ${totalProdutos} produtos, ${totalVariacoes} variações, ${totalAdicionais} adicionais.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());