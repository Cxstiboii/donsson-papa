const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const materiales = [
  { id: "MAT-01", nombre: "Papel filtro celulosa", unidad: "m²", costo: 4200, proveedor: "Papelera Andina" },
  { id: "MAT-02", nombre: "Malla metálica galvanizada", unidad: "m²", costo: 8900, proveedor: "Aceros del Valle" },
  { id: "MAT-03", nombre: "Carcasa metálica", unidad: "unidad", costo: 15500, proveedor: "Metalmecánica Suarez" },
  { id: "MAT-04", nombre: "Resina adhesiva", unidad: "litro", costo: 12800, proveedor: "Químicos Industriales SA" },
  { id: "MAT-05", nombre: "Sello de caucho", unidad: "unidad", costo: 3100, proveedor: "Cauchos Bogotá" },
  { id: "MAT-06", nombre: "Tubo central PVC", unidad: "tubo", costo: 2600, proveedor: "Plásticos del Norte" },
  { id: "MAT-07", nombre: "Lámina de acero inoxidable", unidad: "lámina", costo: 32000, proveedor: "Aceros del Valle" },
  { id: "MAT-08", nombre: "Empaque de espuma", unidad: "unidad", costo: 1800, proveedor: "Espumas Industriales" },
  { id: "MAT-09", nombre: "Pegamento epóxico", unidad: "kg", costo: 21000, proveedor: "Químicos Industriales SA" },
  { id: "MAT-10", nombre: "Varilla roscada", unidad: "varilla", costo: 4400, proveedor: "Metalmecánica Suarez" },
  { id: "MAT-11", nombre: "Caja de cartón corrugado", unidad: "unidad", costo: 2200, proveedor: "Cartones del Pacífico" },
];

async function main() {
  for (const m of materiales) {
    await prisma.material.upsert({
      where: { id: m.id },
      update: m,
      create: m,
    });
  }

  await prisma.parametros.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      tarifaMOD: 9500,
      tarifaCIF: 6200,
      pctGAV: 18,
      pctMargen: 25,
    },
  });

  console.log("Seed completado.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
