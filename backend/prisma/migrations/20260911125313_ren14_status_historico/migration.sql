-- CreateTable
CREATE TABLE "StatusHistorico" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "pedidoId" INTEGER NOT NULL,
    "de" TEXT,
    "para" TEXT NOT NULL,
    "adminId" INTEGER,
    "observacao" TEXT,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StatusHistorico_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "Pedido" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "StatusHistorico_pedidoId_idx" ON "StatusHistorico"("pedidoId");

-- CreateIndex
CREATE INDEX "StatusHistorico_criadoEm_idx" ON "StatusHistorico"("criadoEm");
