-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Pagamento" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "pedidoId" INTEGER NOT NULL,
    "gateway" TEXT NOT NULL DEFAULT 'mercadopago',
    "valor" DECIMAL NOT NULL,
    "meioPagamento" TEXT,
    "estadoPagamento" TEXT NOT NULL DEFAULT 'INICIADO',
    "idempotencyKey" TEXT NOT NULL,
    "idGateway" TEXT,
    "qrCode" TEXT,
    "qrCodeBase64" TEXT,
    "expiraEm" DATETIME,
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "sincronizadoEm" DATETIME,
    "ultimoErroGateway" TEXT,
    "dadosGateway" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Pagamento_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "Pedido" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Pagamento" ("createdAt", "dadosGateway", "estadoPagamento", "gateway", "id", "idempotencyKey", "meioPagamento", "pedidoId", "updatedAt", "valor") SELECT "createdAt", "dadosGateway", "estadoPagamento", "gateway", "id", "idempotencyKey", "meioPagamento", "pedidoId", "updatedAt", "valor" FROM "Pagamento";
DROP TABLE "Pagamento";
ALTER TABLE "new_Pagamento" RENAME TO "Pagamento";
CREATE UNIQUE INDEX "Pagamento_idempotencyKey_key" ON "Pagamento"("idempotencyKey");
CREATE INDEX "Pagamento_pedidoId_idx" ON "Pagamento"("pedidoId");
CREATE INDEX "Pagamento_idGateway_idx" ON "Pagamento"("idGateway");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
