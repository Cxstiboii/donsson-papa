const express = require("express");
const multer = require("multer");
const XLSX = require("xlsx");
const { PrismaClient } = require("@prisma/client");

const router = express.Router();
const prisma = new PrismaClient();
const upload = multer({ storage: multer.memoryStorage() });

function parseColombianNumber(val) {
  if (val === null || val === undefined || val === "") return 0;
  if (typeof val === "number") return isNaN(val) ? 0 : val;
  const str = String(val).trim();
  const cleaned = str.replace(/\./g, "").replace(/,/g, ".");
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

// Formato esperado: [CODIGO] NOMBRE DEL PRODUCTO (COD FAB)
// También tolera corchete inicial faltante: CODIGO] NOMBRE...
function parsearProducto(productoStr) {
  const str = String(productoStr).trim();
  const codeMatch = str.match(/\[?([A-Za-z0-9_\-]+)\]/);
  if (!codeMatch) return null;
  const materialId = codeMatch[1].trim();
  if (!materialId) return null;
  const afterCode = str.replace(/\[?[A-Za-z0-9_\-]+\]\s*/, "");
  const lastParen = afterCode.lastIndexOf("(");
  const nombre = lastParen > 0 ? afterCode.slice(0, lastParen).trim() : afterCode.trim();
  return { materialId, nombre };
}

router.post("/", upload.single("file"), async (req, res) => {
  try {
    const { referenciaId, familia, mes } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: "Archivo requerido" });
    }
    if (!referenciaId || !familia || !mes) {
      return res.status(400).json({ error: "Faltan campos obligatorios: referenciaId, familia, mes" });
    }

    const wb = XLSX.read(req.file.buffer, { type: "buffer" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });

    const materialesData = [];
    const consumosAcumulados = [];

    for (const row of rows) {
      const productoRaw = row["Producto"];
      if (!productoRaw || String(productoRaw).trim() === "") continue;

      const parsed = parsearProducto(productoRaw);
      if (!parsed) continue;

      const cantidad = parseColombianNumber(row["Cantidad producto"]);
      if (cantidad === 0) continue;

      const costo = parseColombianNumber(row["Product Cost"]);
      const unidad = String(row["Unidad de medida del producto"] || "unidad").trim() || "unidad";

      materialesData.push({ id: parsed.materialId, nombre: parsed.nombre, unidad, costo, proveedor: "" });
      consumosAcumulados.push({ materialId: parsed.materialId, cantidad });
    }

    if (materialesData.length === 0) {
      return res.status(400).json({ error: "No se encontraron filas válidas en el Excel. Verifica que la columna 'Producto' contenga valores con formato [CODIGO] NOMBRE." });
    }

    const result = await prisma.$transaction(async (tx) => {
      for (const mat of materialesData) {
        await tx.material.upsert({
          where: { id: mat.id },
          create: mat,
          update: { nombre: mat.nombre, unidad: mat.unidad, costo: mat.costo },
        });
      }

      await tx.referencia.upsert({
        where: { id: referenciaId },
        create: {
          id: referenciaId,
          familia,
          mes,
          fechaCreacion: mes,
          segMOD: 60,
          cifUnitario: 0,
          costoReal: 0,
        },
        update: { familia, mes },
      });

      await tx.consumo.deleteMany({ where: { referenciaId } });

      const consumosValidos = consumosAcumulados.filter((c) => c.cantidad > 0);
      if (consumosValidos.length) {
        await tx.consumo.createMany({
          data: consumosValidos.map((c) => ({
            referenciaId,
            materialId: c.materialId,
            cantidad: c.cantidad,
          })),
        });
      }

      const referencia = await tx.referencia.findUnique({
        where: { id: referenciaId },
        include: { consumos: { include: { material: true } } },
      });

      return {
        referencia,
        materialesUpserted: materialesData.length,
        consumosCreados: consumosValidos.length,
      };
    });

    res.json(result);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error al importar OP: " + e.message });
  }
});

module.exports = router;
