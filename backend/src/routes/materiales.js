const express = require("express");
const { PrismaClient } = require("@prisma/client");

const router = express.Router();
const prisma = new PrismaClient();

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

module.exports = router;
