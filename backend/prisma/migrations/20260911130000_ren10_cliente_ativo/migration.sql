-- REN-10: soft delete de clientes (inativação preserva pedidos/endereços)
-- AlterTable
ALTER TABLE "Cliente" ADD COLUMN "ativo" BOOLEAN NOT NULL DEFAULT true;