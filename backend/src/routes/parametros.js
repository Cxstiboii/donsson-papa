const express = require("express");
const { PrismaClient } = require("@prisma/client");

const router = express.Router();
const prisma = new PrismaClient();

router.get("/", async (req, res) => {
  try {
    const parametros = await prisma.parametros.upsert({
      where: { id: 1 },
      update: {},
      create: { id: 1 },
    });
    res.json(parametros);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error al obtener parámetros" });
  }
});

router.put("/", async (req, res) => {
  try {
    const { tarifaMOD, tarifaCIF, pctGAV, pctMargen } = req.body;
    const parametros = await prisma.parametros.upsert({
      where: { id: 1 },
      update: { tarifaMOD, tarifaCIF, pctGAV, pctMargen },
      create: { id: 1, tarifaMOD, tarifaCIF, pctGAV, pctMargen },
    });
    res.json(parametros);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error al actualizar parámetros" });
  }
});

module.exports = router;
