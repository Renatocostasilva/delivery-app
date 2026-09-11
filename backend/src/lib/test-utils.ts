import { prisma } from "./prisma.js";

export async function resetDatabase() {
  // Checkout (REN-12) — dependências financeiras primeiro
  await prisma.pagamento.deleteMany();
  await prisma.itemPedido.deleteMany();
  await prisma.pedido.deleteMany();
  await prisma.endereco.deleteMany();
  await prisma.cliente.deleteMany();
  // Carrinho (REN-11) — limpa antes das dependências de produto
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.cupom.deleteMany();
  // Catálogo
  await prisma.produtoImagem.deleteMany();
  await prisma.variacao.deleteMany();
  await prisma.adicional.deleteMany();
  await prisma.produto.deleteMany();
  await prisma.categoria.deleteMany();
  await prisma.adminUser.deleteMany();
}