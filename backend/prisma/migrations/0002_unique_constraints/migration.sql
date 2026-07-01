-- Migración: Agregar restricciones únicas a CostLabor y CostMaterial
--
-- El upsert de Prisma en importarCostos.js usa estas claves como condición de conflicto.
-- Sin los índices en la DB, Prisma crea duplicados en lugar de actualizar.
--
-- La deduplicación elimina las filas con id menor por grupo (conserva la más reciente).
-- El bloque funciona correctamente cuando no existen duplicados (no borra nada).

-- ── Deduplicar CostLabor (conservar MAX(id) por grupo orderId + proceso) ──
DELETE FROM "CostLabor"
WHERE id NOT IN (
  SELECT MAX(id)
  FROM "CostLabor"
  GROUP BY "orderId", proceso
);

-- ── Deduplicar CostMaterial (conservar MAX(id) por grupo orderId + insumo) ──
DELETE FROM "CostMaterial"
WHERE id NOT IN (
  SELECT MAX(id)
  FROM "CostMaterial"
  GROUP BY "orderId", insumo
);

-- ── Crear índices únicos ────────────────────────────────────────────────────
CREATE UNIQUE INDEX "CostLabor_orderId_proceso_key" ON "CostLabor"("orderId", "proceso");
CREATE UNIQUE INDEX "CostMaterial_orderId_insumo_key" ON "CostMaterial"("orderId", "insumo");
