/**
 * check-duplicates.js
 * Script de solo lectura — no modifica ningún dato.
 *
 * Uso:
 *   DATABASE_URL="postgresql://..." node backend/scripts/check-duplicates.js
 *
 * Reporta:
 *   (a) Si los índices únicos de CostLabor y CostMaterial existen en la DB.
 *   (b) Cualquier grupo duplicado según la clave única prevista, con conteos.
 */

const prisma = require("../src/prisma");

async function main() {
  console.log("=== Verificación de integridad — CostLabor y CostMaterial ===\n");

  // ── (a) Verificar índices únicos en pg_indexes ──────────────────────────
  const indexes = await prisma.$queryRaw`
    SELECT indexname, tablename, indexdef
    FROM pg_indexes
    WHERE tablename IN ('CostLabor', 'CostMaterial')
    ORDER BY tablename, indexname
  `;

  const expectedIndexes = [
    "CostLabor_orderId_proceso_key",
    "CostMaterial_orderId_insumo_key",
  ];

  console.log("── Índices existentes en pg_indexes para CostLabor y CostMaterial:");
  if (indexes.length === 0) {
    console.log("  (ninguno encontrado)\n");
  } else {
    for (const idx of indexes) {
      const marker = expectedIndexes.includes(idx.indexname) ? "✓" : " ";
      console.log(`  [${marker}] ${idx.tablename}.${idx.indexname}`);
      console.log(`       ${idx.indexdef}`);
    }
    console.log();
  }

  for (const name of expectedIndexes) {
    const found = indexes.some((i) => i.indexname === name);
    if (found) {
      console.log(`  ✓ ${name} — EXISTE`);
    } else {
      console.log(`  ✗ ${name} — FALTA (la migración 0002 aún no se ha aplicado)`);
    }
  }
  console.log();

  // ── (b) Duplicados en CostLabor ─────────────────────────────────────────
  const dupLabor = await prisma.$queryRaw`
    SELECT "orderId", proceso, COUNT(*) AS cnt
    FROM "CostLabor"
    GROUP BY "orderId", proceso
    HAVING COUNT(*) > 1
    ORDER BY cnt DESC, "orderId", proceso
  `;

  console.log("── Duplicados en CostLabor (clave: orderId + proceso):");
  if (dupLabor.length === 0) {
    console.log("  Sin duplicados. ✓\n");
  } else {
    console.log(`  ⚠ Se encontraron ${dupLabor.length} grupo(s) duplicado(s):`);
    for (const row of dupLabor) {
      console.log(`    orderId=${row.orderId}  proceso="${row.proceso}"  → ${row.cnt} filas`);
    }
    console.log();
  }

  // ── (b) Duplicados en CostMaterial ──────────────────────────────────────
  const dupMaterial = await prisma.$queryRaw`
    SELECT "orderId", insumo, COUNT(*) AS cnt
    FROM "CostMaterial"
    GROUP BY "orderId", insumo
    HAVING COUNT(*) > 1
    ORDER BY cnt DESC, "orderId", insumo
  `;

  console.log("── Duplicados en CostMaterial (clave: orderId + insumo):");
  if (dupMaterial.length === 0) {
    console.log("  Sin duplicados. ✓\n");
  } else {
    console.log(`  ⚠ Se encontraron ${dupMaterial.length} grupo(s) duplicado(s):`);
    for (const row of dupMaterial) {
      console.log(`    orderId=${row.orderId}  insumo="${row.insumo}"  → ${row.cnt} filas`);
    }
    console.log();
  }

  // ── Resumen ──────────────────────────────────────────────────────────────
  const missingIndexes = expectedIndexes.filter((n) => !indexes.some((i) => i.indexname === n));
  const totalDups = dupLabor.length + dupMaterial.length;

  console.log("── Resumen:");
  if (missingIndexes.length === 0 && totalDups === 0) {
    console.log("  Todo OK. Los índices existen y no hay duplicados.");
  } else {
    if (missingIndexes.length > 0) {
      console.log(`  ✗ Índices faltantes: ${missingIndexes.join(", ")}`);
      console.log("    → Aplicar la migración: npx prisma migrate deploy (desde backend/)");
    }
    if (totalDups > 0) {
      console.log(`  ✗ ${totalDups} grupo(s) con duplicados encontrado(s).`);
      console.log("    → La migración 0002 deduplicará automáticamente antes de crear los índices.");
    }
  }
  console.log();
}

main()
  .catch((e) => {
    console.error("Error:", e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
