const express = require("express");
const prisma = require("../prisma");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    let parametros = await prisma.parametros.findUnique({ where: { id: 1 } });
    if (!parametros) {
      parametros = await prisma.parametros.create({ data: { id: 1 } });
    }
    res.json(parametros);
  } catch (e) {
    console.error("Error al obtener parámetros:", e);
    res.status(500).json({ error: "Error al obtener parámetros" });
  }
});

router.put("/", async (req, res) => {
  try {
    const { tarifaMOD, tarifaCIF, pctGAV, pctMargen } = req.body;
    if (
      typeof tarifaMOD !== "number" || tarifaMOD < 0 ||
      typeof tarifaCIF !== "number" || tarifaCIF < 0 ||
      typeof pctGAV !== "number" || pctGAV < 0 || pctGAV > 100 ||
      typeof pctMargen !== "number" || pctMargen < 0 || pctMargen >= 100
    ) {
      return res.status(400).json({
        error: "Valores inválidos. pctMargen debe ser entre 0 y 99. Los demás valores deben ser positivos.",
      });
    }
    const parametros = await prisma.parametros.upsert({
      where: { id: 1 },
      update: { tarifaMOD, pctGAV, pctMargen },
      create: { id: 1, tarifaMOD, pctGAV, pctMargen },
    });
    res.json(parametros);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error al actualizar parámetros" });
  }
});

module.exports = router;
