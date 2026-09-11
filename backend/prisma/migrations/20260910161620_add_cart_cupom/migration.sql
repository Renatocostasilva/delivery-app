-- CreateTable
CREATE TABLE "Cart" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "cartKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ATIVO',
    "cupomId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Cart_cupomId_fkey" FOREIGN KEY ("cupomId") REFERENCES "Cupom" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CartItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "cartId" INTEGER NOT NULL,
    "produtoId" INTEGER NOT NULL,
    "variacaoId" INTEGER,
    "quantidade" INTEGER NOT NULL,
    "adicionaisSelecionados" JSONB NOT NULL DEFAULT [],
    "observacoes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CartItem_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "Cart" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Cupom" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "codigo" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "valor" DECIMAL NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "dataInicio" DATETIME,
    "dataFim" DATETIME,
    "usoMaximo" INTEGER,
    "usoAtual" INTEGER NOT NULL DEFAULT 0,
    "aplicavelFrete" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Cart_cartKey_key" ON "Cart"("cartKey");

-- CreateIndex
CREATE INDEX "Cart_status_idx" ON "Cart"("status");

-- CreateIndex
CREATE INDEX "CartItem_cartId_idx" ON "CartItem"("cartId");

-- CreateIndex
CREATE UNIQUE INDEX "Cupom_codigo_key" ON "Cupom"("codigo");

-- CreateIndex
CREATE INDEX "Cupom_ativo_idx" ON "Cupom"("ativo");

-- CreateIndex
CREATE INDEX "Cupom_codigo_idx" ON "Cupom"("codigo");
