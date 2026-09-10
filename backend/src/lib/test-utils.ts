import { prisma } from "./prisma.js";

export async function resetDatabase() {
  await prisma.produtoImagem.deleteMany();
  await prisma.variacao.deleteMany();
  await prisma.adicional.deleteMany();
  await prisma.produto.deleteMany();
  await prisma.categoria.deleteMany();
  await prisma.adminUser.deleteMany();
}