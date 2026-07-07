-- Migración: agregar tabla OptimalMaterial (feature "Costo Óptimo" — pesaje
-- manual de materias primas). Puramente aditiva: solo crea tabla nueva,
-- índices y llaves foráneas; no toca ninguna tabla existente.
--
-- Envuelta con guardas (IF NOT EXISTS / captura de duplicate_object) para que
-- una aplicación parcial previa no vuelva a romper "prisma migrate deploy"
-- (ver incidente P3009).

-- ── Crear tabla ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "OptimalMaterial" (
    "id" SERIAL NOT NULL,
    "referenciaId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "cantidad" DOUBLE PRECISION NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OptimalMaterial_pkey" PRIMARY KEY ("id")
);

-- ── Crear índices ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "OptimalMaterial_materialId_idx" ON "OptimalMaterial"("materialId");

CREATE UNIQUE INDEX IF NOT EXISTS "OptimalMaterial_referenciaId_materialId_key" ON "OptimalMaterial"("referenciaId", "materialId");

-- ── Llaves foráneas (sin soporte nativo de IF NOT EXISTS en Postgres) ────────
DO $$
BEGIN
    ALTER TABLE "OptimalMaterial" ADD CONSTRAINT "OptimalMaterial_referenciaId_fkey"
        FOREIGN KEY ("referenciaId") REFERENCES "Referencia"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE "OptimalMaterial" ADD CONSTRAINT "OptimalMaterial_materialId_fkey"
        FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
