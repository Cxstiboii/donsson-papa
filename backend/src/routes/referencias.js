const express = require("express");
const { PrismaClient } = require("@prisma/client");

const router = express.Router();
const prisma = new PrismaClient();

const includeConsumos = { consumos: { include: { material: true } } };

function mesFromDate(d) {
  if (!d) return null;
  const date = d instanceof Date ? d : new Date(d);
  if (isNaN(date.getTime())) return null;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function agregarCostosImportados(ref, ordersByCode) {
  const related = (ordersByCode[ref.id] || []).filter((o) => {
    if (!ref.mes) return true;
    return mesFromDate(o.fechaFinal) === ref.mes;
  });

  if (!related.length) return { ...ref, costosImportados: null };

  let mpd = 0, mod = 0, cif = 0, costoOdoo = 0;
  const materialsAll = [];
  const laborAll = [];

  for (const order of related) {
    for (const m of order.materials) mpd += m.vrStd ?? 0;
    for (const l of order.laborItems) {
      if (l.tipo === "mano_obra") mod += l.vrStd ?? 0;
      else if (l.tipo === "carga_fabril") cif += l.vrStd ?? 0;
    }
    costoOdoo += order.totalEjecutado ?? 0;
    materialsAll.push(...order.materials);
    laborAll.push(...order.laborItems);
  }

  return {
    ...ref,
    costosImportados: {
      mpd,
      mod,
      cif,
      costoEstandar: mpd + mod + cif,
      costoOdoo,
      ordenes: related.length,
      materials: materialsAll,
      laborItems: laborAll,
    },
  };
}

router.get("/", async (req, res) => {
  try {
    const { mes } = req.query;
    const where = mes ? { mes } : {};
    const referencias = await prisma.referencia.findMany({
      where,
      include: includeConsumos,
      orderBy: { id: "asc" },
    });

    const ids = referencias.map((r) => r.id);
    const orders = ids.length
      ? await prisma.costOrder.findMany({
          where: { productoCodigo: { in: ids } },
          include: { laborItems: true, materials: true },
        })
      : [];

    const ordersByCode = {};
    for (const o of orders) {
      if (!ordersByCode[o.productoCodigo]) ordersByCode[o.productoCodigo] = [];
      ordersByCode[o.productoCodigo].push(o);
    }

    const enriched = referencias.map((ref) => agregarCostosImportados(ref, ordersByCode));
    res.json(enriched);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error al obtener referencias" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { id, familia, segMOD, cifUnitario, costoReal, mes, consumos } = req.body;
    if (!id || !familia || !mes) {
      return res.status(400).json({ error: "Faltan campos obligatorios" });
    }

    const referencia = await prisma.$transaction(async (tx) => {
      const ref = await tx.referencia.create({
        data: {
          id,
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
    const { familia, segMOD, cifUnitario, costoReal, mes, consumos } = req.body;

    const referencia = await prisma.$transaction(async (tx) => {
      await tx.referencia.update({
        where: { id: req.params.id },
        data: { familia, segMOD, cifUnitario, costoReal, mes },
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
