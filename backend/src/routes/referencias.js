const express = require("express");
const { PrismaClient } = require("@prisma/client");

const router = express.Router();
const prisma = new PrismaClient();

const includeConsumos = { consumos: { include: { material: true } } };

router.get("/", async (req, res) => {
  try {
    const { mes } = req.query;
    const where = mes ? { mes } : {};
    const referencias = await prisma.referencia.findMany({
      where,
      include: includeConsumos,
      orderBy: { id: "asc" },
    });
    res.json(referencias);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error al obtener referencias" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { id, nombre, familia, segMOD, cifUnitario, costoReal, mes, consumos } = req.body;
    if (!id || !nombre || !familia || !mes) {
      return res.status(400).json({ error: "Faltan campos obligatorios" });
    }

    const referencia = await prisma.$transaction(async (tx) => {
      const ref = await tx.referencia.create({
        data: {
          id,
          nombre,
          familia,
          segMOD: segMOD ?? 60,
          cifUnitario: cifUnitario ?? 0,
          costoReal: costoReal ?? 0,
          mes,
          fechaCreacion: mes,
        },
      });

      if (Array.isArray(consumos) && consumos.length) {
        await tx.consumo.createMany({
          data: consumos
            .filter((c) => c.materialId && c.cantidad > 0)
            .map((c) => ({
              referenciaId: id,
              materialId: c.materialId,
              cantidad: c.cantidad,
            })),
        });
      }

      return tx.referencia.findUnique({ where: { id }, include: includeConsumos });
    });

    res.status(201).json(referencia);
  } catch (e) {
    if (e.code === "P2002") {
      return res.status(400).json({ error: "Ya existe una referencia con ese código" });
    }
    console.error(e);
    res.status(500).json({ error: "Error al crear referencia" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const { nombre, familia, segMOD, cifUnitario, costoReal, mes, consumos } = req.body;

    const referencia = await prisma.$transaction(async (tx) => {
      await tx.referencia.update({
        where: { id: req.params.id },
        data: { nombre, familia, segMOD, cifUnitario, costoReal, mes },
      });

      await tx.consumo.deleteMany({ where: { referenciaId: req.params.id } });

      if (Array.isArray(consumos) && consumos.length) {
        await tx.consumo.createMany({
          data: consumos
            .filter((c) => c.materialId && c.cantidad > 0)
            .map((c) => ({
              referenciaId: req.params.id,
              materialId: c.materialId,
              cantidad: c.cantidad,
            })),
        });
      }

      return tx.referencia.findUnique({ where: { id: req.params.id }, include: includeConsumos });
    });

    res.json(referencia);
  } catch (e) {
    if (e.code === "P2025") {
      return res.status(404).json({ error: "Referencia no encontrada" });
    }
    console.error(e);
    res.status(500).json({ error: "Error al editar referencia" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await prisma.referencia.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (e) {
    if (e.code === "P2025") {
      return res.status(404).json({ error: "Referencia no encontrada" });
    }
    console.error(e);
    res.status(500).json({ error: "Error al eliminar referencia" });
  }
});

module.exports = router;
