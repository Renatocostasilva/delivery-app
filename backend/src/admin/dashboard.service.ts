import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

// ─── Dashboard do admin (REN-14) ─────────────────────────────────────────────

export type DashboardParams = {
  dataInicio?: Date;
  dataFim?: Date;
};

export async function getDashboard(params: DashboardParams = {}) {
  const { dataInicio, dataFim } = params;

  const where: Prisma.PedidoWhereInput = {};
  if (dataInicio || dataFim) {
    where.createdAt = {};
    if (dataInicio) where.createdAt.gte = dataInicio;
    if (dataFim) {
      const fim = new Date(dataFim);
      fim.setHours(23, 59, 59, 999);
      where.createdAt.lte = fim;
    }
  }

  const [
    totalPedidos,
    pedidosPorStatus,
    resumoVendas,
    ticketMedio,
    topProdutos,
    pedidosRecentes,
  ] = await Promise.all([
    // Total de pedidos
    prisma.pedido.count({ where }),

    // Pedidos agrupados por status
    prisma.pedido.groupBy({
      by: ["statusPedido"],
      where,
      _count: { id: true },
    }),

    // Resumo de vendas (apenas pedidos não cancelados/estornados)
    prisma.pedido.aggregate({
      where: {
        ...where,
        statusPedido: { notIn: ["CANCELADO", "RECUSADO", "FALHA_PAGAMENTO", "ESTORNADO"] },
      },
      _sum: { total: true, taxasEntrega: true, desconto: true },
      _count: { id: true },
    }),

    // Ticket médio (pedidos não cancelados)
    prisma.pedido.aggregate({
      where: {
        ...where,
        statusPedido: { notIn: ["CANCELADO", "RECUSADO", "FALHA_PAGAMENTO", "ESTORNADO"] },
      },
      _avg: { total: true },
    }),

    // Top 10 produtos mais vendidos
    prisma.itemPedido.groupBy({
      by: ["produtoNome"],
      where: {
        pedido: {
          ...where,
          statusPedido: { notIn: ["CANCELADO", "RECUSADO", "FALHA_PAGAMENTO", "ESTORNADO"] },
        },
      },
      _sum: { total: true, quantidade: true },
      _count: { id: true },
      orderBy: { _sum: { total: "desc" } },
      take: 10,
    }),

    // Últimos 10 pedidos
    prisma.pedido.findMany({
      where,
      include: {
        cliente: { select: { nome: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const statusMap: Record<string, number> = {};
  for (const item of pedidosPorStatus) {
    statusMap[item.statusPedido] = item._count.id;
  }

  return {
    resumo: {
      totalPedidos,
      totalVendas: resumoVendas._sum.total ?? 0,
      totalFrete: resumoVendas._sum.taxasEntrega ?? 0,
      totalDescontos: resumoVendas._sum.desconto ?? 0,
      pedidosFinalizados: resumoVendas._count.id,
      ticketMedio: ticketMedio._avg.total ?? 0,
    },
    pedidosPorStatus: statusMap,
    topProdutos: topProdutos.map((p) => ({
      nome: p.produtoNome,
      quantidadeVendida: p._sum.quantidade ?? 0,
      totalVendido: p._sum.total ?? 0,
      vezesPedido: p._count.id,
    })),
    pedidosRecentes: pedidosRecentes.map((p) => ({
      id: p.id,
      numeroPedido: p.numeroPedido,
      status: p.statusPedido,
      total: p.total,
      cliente: p.cliente.nome,
      criadoEm: p.createdAt,
    })),
  };
}
