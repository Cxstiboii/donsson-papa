-- CreateTable
CREATE TABLE "Material" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "unidad" TEXT NOT NULL,
    "costo" DOUBLE PRECISION NOT NULL,
    "proveedor" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Material_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Referencia" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL DEFAULT '',
    "familia" TEXT NOT NULL DEFAULT '',
    "segMOD" DOUBLE PRECISION NOT NULL DEFAULT 60,
    "cifUnitario" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "costoReal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "mes" TEXT NOT NULL,
    "fechaCreacion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Referencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Consumo" (
    "id" SERIAL NOT NULL,
    "referenciaId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "cantidad" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "Consumo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Parametros" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "tarifaMOD" DOUBLE PRECISION NOT NULL DEFAULT 9500,
    "pctGAV" DOUBLE PRECISION NOT NULL DEFAULT 18,
    "pctMargen" DOUBLE PRECISION NOT NULL DEFAULT 25,

    CONSTRAINT "Parametros_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Usuario" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "passwordHash" TEXT NOT NULL,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CostOrder" (
    "id" SERIAL NOT NULL,
    "orden" TEXT NOT NULL,
    "documentoOrigen" TEXT NOT NULL,
    "refDonsson" TEXT NOT NULL,
    "producto" TEXT NOT NULL,
    "productoCodigo" TEXT NOT NULL,
    "productoClase" TEXT NOT NULL,
    "cantidadFabricada" DOUBLE PRECISION NOT NULL,
    "fechaInicial" TIMESTAMP(3) NOT NULL,
    "fechaFinal" TIMESTAMP(3) NOT NULL,
    "estado" TEXT NOT NULL,
    "totalPlaneado" DOUBLE PRECISION NOT NULL,
    "totalEjecutado" DOUBLE PRECISION NOT NULL,
    "totalVariacion" DOUBLE PRECISION NOT NULL,
    "fechaImportacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivoFuente" TEXT NOT NULL,

    CONSTRAINT "CostOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CostLabor" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "proceso" TEXT NOT NULL,
    "cantStd" DOUBLE PRECISION,
    "vrStd" DOUBLE PRECISION,
    "tarifaStd" DOUBLE PRECISION,
    "cantPlaneado" DOUBLE PRECISION NOT NULL,
    "vrPlaneado" DOUBLE PRECISION NOT NULL,
    "tarifaPlaneada" DOUBLE PRECISION,
    "cantEjecutado" DOUBLE PRECISION NOT NULL,
    "vrEjecutado" DOUBLE PRECISION NOT NULL,
    "tarifaEjecutada" DOUBLE PRECISION,
    "variacionCantidad" DOUBLE PRECISION NOT NULL,
    "variacionValor" DOUBLE PRECISION NOT NULL,
    "variacionPct" DOUBLE PRECISION NOT NULL,
    "eficienciaTiempoPct" DOUBLE PRECISION,
    "alertaTarifa" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "CostLabor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CostMaterial" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "insumo" TEXT NOT NULL,
    "costoMp" DOUBLE PRECISION NOT NULL,
    "cantStd" DOUBLE PRECISION,
    "vrStd" DOUBLE PRECISION,
    "cantPlaneado" DOUBLE PRECISION NOT NULL,
    "vrPlaneado" DOUBLE PRECISION NOT NULL,
    "cantEjecutado" DOUBLE PRECISION NOT NULL,
    "vrEjecutado" DOUBLE PRECISION NOT NULL,
    "variacionCantidad" DOUBLE PRECISION NOT NULL,
    "variacionValor" DOUBLE PRECISION NOT NULL,
    "variacionPct" DOUBLE PRECISION NOT NULL,
    "alertaCantidad" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "CostMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Referencia_mes_idx" ON "Referencia"("mes");

-- CreateIndex
CREATE INDEX "Consumo_materialId_idx" ON "Consumo"("materialId");

-- CreateIndex
CREATE UNIQUE INDEX "Consumo_referenciaId_materialId_key" ON "Consumo"("referenciaId", "materialId");

-- CreateIndex
CREATE UNIQUE INDEX "CostOrder_orden_key" ON "CostOrder"("orden");

-- CreateIndex
CREATE INDEX "CostOrder_refDonsson_idx" ON "CostOrder"("refDonsson");

-- CreateIndex
CREATE INDEX "CostOrder_fechaFinal_idx" ON "CostOrder"("fechaFinal");

-- AddForeignKey
ALTER TABLE "Consumo" ADD CONSTRAINT "Consumo_referenciaId_fkey" FOREIGN KEY ("referenciaId") REFERENCES "Referencia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consumo" ADD CONSTRAINT "Consumo_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostLabor" ADD CONSTRAINT "CostLabor_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "CostOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostMaterial" ADD CONSTRAINT "CostMaterial_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "CostOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
