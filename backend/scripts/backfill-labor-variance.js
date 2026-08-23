// One-off backfill: recompute CostLabor.variacionCantidad/variacionValor/variacionPct
// for already-imported orders using the new Std-based formula
// (Var. Valor = Ejec Valor - Std Valor; Var. % = that / Std Valor * 100).
// Uses only data already stored per row (cantStd/vrStd/cantEjecutado/vrEjecutado) —
// no need to re-upload the original Excel files.
//
// Usage:
//   node scripts/backfill-labor-variance.js         (dry run, prints diffs only)
//   node scripts/backfill-labor-variance.js --apply  (writes changes)
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

function pctOf(numerator, base) {
  if (!base || base === 0 || isNaN(base)) return null;
  return (numerator / base) * 100;
}

(async () => {
  const apply = process.argv.includes("--apply");
  const rows = await prisma.costLabor.findMany({
    include: { order: { select: { orden: true } } },
  });

  let changed = 0;
  for (const row of rows) {
    const hasStd = row.cantStd != null && row.vrStd != null;
    const newVariacionCantidad = hasStd ? row.cantEjecutado - row.cantStd : null;
    const newVariacionValor = hasStd ? row.vrEjecutado - row.vrStd : null;
    const newVariacionPct = hasStd ? pctOf(row.vrEjecutado - row.vrStd, row.vrStd) : null;

    const isDifferent =
      newVariacionCantidad !== row.variacionCantidad ||
      newVariacionValor !== row.variacionValor ||
      newVariacionPct !== row.variacionPct;

    if (isDifferent) {
      changed++;
      console.log(
        `${row.order.orden} / ${row.proceso}: variacionValor ${row.variacionValor} -> ${newVariacionValor}, variacionPct ${row.variacionPct?.toFixed?.(1)} -> ${newVariacionPct?.toFixed?.(1)}`
      );
      if (apply) {
        await prisma.costLabor.update({
          where: { id: row.id },
          data: {
            variacionCantidad: newVariacionCantidad,
            variacionValor: newVariacionValor,
            variacionPct: newVariacionPct,
          },
        });
      }
    }
  }

  console.log(`\n${changed} de ${rows.length} filas de CostLabor ${apply ? "actualizadas" : "requieren actualización (dry run)"}.`);
  await prisma.$disconnect();
})();
