const express = require("express");
const prisma = require("../prisma");
const multer = require("multer");
const XLSX = require("xlsx");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.get("/", async (req, res) => {
  try {
    const materiales = await prisma.material.findMany({ orderBy: { id: "asc" } });
    res.json(materiales);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error al obtener materiales" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { id, nombre, unidad, costo } = req.body;
    if (!id || !nombre || !unidad || costo == null) {
      return res.status(400).json({ error: "Faltan campos obligatorios" });
    }

    const material = await prisma.material.create({
      data: { id, nombre, unidad, costo },
    });
    res.status(201).json(material);
  } catch (e) {
    if (e.code === "P2002") {
      return res.status(400).json({ error: "Ya existe un material con ese código" });
    }
    console.error(e);
    res.status(500).json({ error: "Error al crear material" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const { nombre, unidad, costo } = req.body;
    const material = await prisma.material.update({
      where: { id: req.params.id },
      data: { nombre, unidad, costo },
    });
    res.json(material);
  } catch (e) {
    if (e.code === "P2025") {
      return res.status(404).json({ error: "Material no encontrado" });
    }
    console.error(e);
    res.status(500).json({ error: "Error al editar material" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const consumos = await prisma.consumo.count({ where: { materialId: req.params.id } });
    if (consumos > 0) {
      return res.status(400).json({ error: "No se puede eliminar: el material está en uso por referencias" });
    }
    await prisma.material.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (e) {
    if (e.code === "P2025") {
      return res.status(404).json({ error: "Material no encontrado" });
    }
    console.error(e);
    res.status(500).json({ error: "Error al eliminar material" });
  }
});

router.patch("/:id/rename", async (req, res) => {
  try {
    const { newId, nombre, unidad, costo, proveedor } = req.body;
    if (!newId || !nombre || !unidad || costo == null) {
      return res.status(400).json({ error: "Faltan campos obligatorios para el renombrado" });
    }
    await prisma.$transaction(async (tx) => {
      // Crear el material con el nuevo ID
      await tx.material.create({
        data: { id: newId, nombre, unidad, costo, proveedor: proveedor || "" },
      });
      // Redirigir todos los consumos al nuevo ID
      await tx.consumo.updateMany({
        where: { materialId: req.params.id },
        data: { materialId: newId },
      });
      // Eliminar el material con el ID antiguo
      await tx.material.delete({ where: { id: req.params.id } });
    });
    const updated = await prisma.material.findUnique({ where: { id: newId } });
    res.json(updated);
  } catch (e) {
    if (e.code === "P2002") return res.status(400).json({ error: "Ya existe un material con ese código" });
    console.error("Error al renombrar material:", e);
    res.status(500).json({ error: "Error al renombrar el material" });
  }
});

router.post("/importar-csv", upload.single("archivo"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No se recibió ningún archivo" });
  }

  let rows;
  try {
    const wb = XLSX.read(req.file.buffer, { type: "buffer" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json(ws, { defval: null });
  } catch (e) {
    return res.status(400).json({ error: "No se pudo leer el archivo CSV" });
  }

  const validRows = [];
  let omitidos = 0;
  const errores = [];

  for (const row of rows) {
    const nombre = row["name"] ? String(row["name"]).trim() : null;
    const id = row["product_variant_ids/default_code"] ? String(row["product_variant_ids/default_code"]).trim() : null;
    const precioRaw = row["standard_price"];
    const unidad = row["Unidad"] ? String(row["Unidad"]).trim() : null;

    const costo = (precioRaw == null || precioRaw === "") ? 0 : parseFloat(precioRaw);
    if (isNaN(costo)) {
      omitidos++;
      continue;
    }

    if (!id || !nombre || !unidad) {
      omitidos++;
      continue;
    }

    validRows.push({ id, nombre, unidad, costo });
  }

  try {
    await prisma.$transaction(async (tx) => {
      for (const { id, nombre, unidad, costo } of validRows) {
        await tx.material.upsert({
          where: { id },
          update: { nombre, costo },
          create: { id, nombre, unidad, costo },
        });
      }
    });
  } catch (e) {
    errores.push(e.message);
  }

  res.json({ upserted: validRows.length, omitidos, errores });
});

module.exports = router;
