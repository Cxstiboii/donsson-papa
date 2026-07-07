const express = require("express");
const prisma = require("../prisma");

const router = express.Router();

const includeConsumos = { consumos: { include: { material: true } } };

function mesFromDate(d) {
  if (!d) return null;
  const date = d instanceof Date ? d : new Date(d);
  if (isNaN(date.getTime())) return null;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function calcCostosDeOrdenes(orders) {
  let mpd = 0, mod = 0, cif = 0, costoOdoo = 0;
  const materialsAll = [];
  const laborAll = [];

  for (const order of orders) {
    for (const m of order.materials) mpd += m.vrPlaneado ?? 0;
    for (const l of order.laborItems) {
      if (l.tipo === "mano_obra") mod += l.vrStd ?? 0;
      else if (l.tipo === "carga_fabril") cif += l.vrStd ?? 0;
    }
    costoOdoo += order.totalEjecutado ?? 0;
    materialsAll.push(...order.materials);
    laborAll.push(...order.laborItems);
  }

  return {
    mpd,
    mod,
    cif,
    costoEstandar: mpd + mod + cif,
    costoOdoo,
    ordenes: orders.length,
    materials: materialsAll,
    laborItems: laborAll,
  };
}

// Costo Óptimo de una referencia: MPD a partir del pesaje manual
// (OptimalMaterial, precio siempre resuelto en vivo contra Material.costo) +
// MOD/CIF estándar de la referencia completa (todas las órdenes, sin filtrar
// por mes — el pesaje no es mensual, es por referencia).
function calcCostoOptimo(ref, ordersRef, lineasOptimas) {
  const mpdOptimo = lineasOptimas.reduce((s, l) => s + l.cantidad * l.material.costo, 0);
  const { mod: modEstandar, cif: cifEstandar } = ordersRef.length
    ? calcCostosDeOrdenes(ordersRef)
    : { mod: ref.segMOD || 0, cif: ref.cifUnitario || 0 };
  return { mpdOptimo, modEstandar, cifEstandar, costoOptimo: mpdOptimo + modEstandar + cifEstandar };
}

// Costo Estándar / Producción de la referencia completa (todas las órdenes),
// para comparar contra el Costo Óptimo en la vista de pesaje.
function getCostosEstandarReferencia(ref, ordersRef) {
  if (ordersRef.length) {
    const t = calcCostosDeOrdenes(ordersRef);
    return { costoEstandar: t.costoEstandar, costoProduccion: t.costoOdoo };
  }
  const mpd = (ref.consumos || []).reduce((s, c) => s + (c.material?.costo || 0) * (c.cantidad || 0), 0);
  const costoEstandar = mpd + (ref.segMOD || 0) + (ref.cifUnitario || 0);
  return { costoEstandar, costoProduccion: ref.costoReal || 0 };
}

function serializeOptimalLine(linea) {
  return {
    materialId: linea.materialId,
    nombre: linea.material.nombre,
    unidad: linea.material.unidad,
    costo: linea.material.costo,
    cantidad: linea.cantidad,
    subtotal: linea.cantidad * linea.material.costo,
    updatedAt: linea.updatedAt,
  };
}

// Expande una referencia en una fila por cada mes con órdenes importadas
// (derivado de CostOrder.fechaFinal, más reciente primero), o en una única
// fila usando Referencia.mes si no tiene órdenes importadas (manual).
function expandirPorMes(ref, ordersByCode) {
  const orders = ordersByCode[ref.id] || [];
  if (!orders.length) return [{ ...ref, costosImportados: null }];

  const porMes = {};
  for (const o of orders) {
    const mes = mesFromDate(o.fechaFinal);
    if (!porMes[mes]) porMes[mes] = [];
    porMes[mes].push(o);
  }

  return Object.keys(porMes)
    .sort()
    .reverse()
    .map((mes) => ({
      ...ref,
      mes,
      costosImportados: calcCostosDeOrdenes(porMes[mes]),
    }));
}

router.get("/", async (req, res) => {
  try {
    const { mes } = req.query;
    const referencias = await prisma.referencia.findMany({
      include: includeConsumos,
      orderBy: { id: "asc" },
    });

    const ids = referencias.map((r) => r.id);
    const [orders, optimalLineas] = ids.length
      ? await Promise.all([
          prisma.costOrder.findMany({
            where: { refDonsson: { in: ids } },
            include: { laborItems: true, materials: true },
          }),
          prisma.optimalMaterial.findMany({
            where: { referenciaId: { in: ids } },
            include: { material: true },
          }),
        ])
      : [[], []];

    const ordersByCode = {};
    for (const o of orders) {
      if (!ordersByCode[o.refDonsson]) ordersByCode[o.refDonsson] = [];
      ordersByCode[o.refDonsson].push(o);
    }

    const optimalByRef = {};
    for (const l of optimalLineas) {
      if (!optimalByRef[l.referenciaId]) optimalByRef[l.referenciaId] = [];
      optimalByRef[l.referenciaId].push(l);
    }

    let filas = referencias.flatMap((ref) => {
      const lineasOptimas = optimalByRef[ref.id] || [];
      const costoOptimo = lineasOptimas.length
        ? calcCostoOptimo(ref, ordersByCode[ref.id] || [], lineasOptimas).costoOptimo
        : null;
      return expandirPorMes(ref, ordersByCode).map((f) => ({ ...f, costoOptimo }));
    });
    if (mes) filas = filas.filter((f) => f.mes === mes);

    res.json(filas);
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

const TARIFA_STD_MOD = 3.80;
const TARIFA_STD_CIF = 9.30;

router.get("/:id/variacion", async (req, res) => {
  try {
    const refId = req.params.id;
    const mes = req.query.mes;

    const ref = await prisma.referencia.findUnique({ where: { id: refId } });
    if (!ref) return res.status(404).json({ error: "Referencia no encontrada" });

    const allOrders = await prisma.costOrder.findMany({
      where: { refDonsson: refId },
      include: { laborItems: true, materials: true },
    });

    const mesToFilter = mes || ref.mes;
    const orders = allOrders.filter((o) => {
      if (!mesToFilter) return true;
      return mesFromDate(o.fechaFinal) === mesToFilter;
    });

    if (!orders.length) {
      return res.status(404).json({ error: "No hay órdenes importadas para esta referencia en el período seleccionado" });
    }

    // Guard: cantStd is nullable — orders imported before this feature may lack it
    const tieneStd = orders.some((o) => o.laborItems.some((l) => l.cantStd !== null));
    if (!tieneStd) {
      return res.json({ datosIncompletos: true });
    }

    let segStdMOD = 0, segEjecMOD = 0, vrEjecMOD = 0, vrStdMOD = 0;
    let segStdCIF = 0, segEjecCIF = 0, vrEjecCIF = 0, vrStdCIF = 0;
    const materialesMapa = {};
    let costoProduccion = 0;

    for (const order of orders) {
      costoProduccion += order.totalEjecutado;

      for (const l of order.laborItems) {
        if (l.tipo === "mano_obra") {
          segStdMOD += l.cantStd ?? 0;
          segEjecMOD += l.cantEjecutado;
          vrEjecMOD += l.vrEjecutado;
          vrStdMOD += l.vrStd ?? 0;
        } else if (l.tipo === "carga_fabril") {
          segStdCIF += l.cantStd ?? 0;
          segEjecCIF += l.cantEjecutado;
          vrEjecCIF += l.vrEjecutado;
          vrStdCIF += l.vrStd ?? 0;
        }
      }

      for (const m of order.materials) {
        if (!materialesMapa[m.insumo]) {
          materialesMapa[m.insumo] = { insumo: m.insumo, cantPlaneado: 0, vrPlaneado: 0, cantEjecutado: 0, vrEjecutado: 0 };
        }
        materialesMapa[m.insumo].cantPlaneado += m.cantPlaneado;
        materialesMapa[m.insumo].vrPlaneado += m.vrPlaneado;
        materialesMapa[m.insumo].cantEjecutado += m.cantEjecutado;
        materialesMapa[m.insumo].vrEjecutado += m.vrEjecutado;
      }
    }

    // MOD variance decomposition (positive = favorable = real cheaper than standard)
    const tarifaRealMOD = segEjecMOD > 0 ? vrEjecMOD / segEjecMOD : null;
    const varTiempoMOD = (segStdMOD - segEjecMOD) * TARIFA_STD_MOD;
    const varTarifaMOD = tarifaRealMOD !== null ? (TARIFA_STD_MOD - tarifaRealMOD) * segEjecMOD : null;

    // CIF variance decomposition
    const tarifaRealCIF = segEjecCIF > 0 ? vrEjecCIF / segEjecCIF : null;
    const varTiempoCIF = (segStdCIF - segEjecCIF) * TARIFA_STD_CIF;
    const varTarifaCIF = tarifaRealCIF !== null ? (TARIFA_STD_CIF - tarifaRealCIF) * segEjecCIF : null;

    // MPD variance decomposition per material
    const mpdDesglose = Object.values(materialesMapa).map((m) => {
      const precioPlan = m.cantPlaneado > 0 ? m.vrPlaneado / m.cantPlaneado : null;
      const precioEjec = m.cantEjecutado > 0 ? m.vrEjecutado / m.cantEjecutado : null;
      const varCantidad = precioPlan !== null ? (m.cantPlaneado - m.cantEjecutado) * precioPlan : null;
      const varPrecio = precioPlan !== null && precioEjec !== null ? (precioPlan - precioEjec) * m.cantEjecutado : null;
      const impactoTotal = m.vrPlaneado - m.vrEjecutado;
      return {
        insumo: m.insumo,
        cantPlaneado: m.cantPlaneado,
        cantEjecutado: m.cantEjecutado,
        precioPlan,
        precioEjec,
        varCantidad,
        varPrecio,
        impactoTotal,
      };
    });

    const mpdImpactoTotal = mpdDesglose.reduce((s, m) => s + m.impactoTotal, 0);
    const mpdVrPlanTotal = Object.values(materialesMapa).reduce((s, m) => s + m.vrPlaneado, 0);
    const mpdVrEjecTotal = Object.values(materialesMapa).reduce((s, m) => s + m.vrEjecutado, 0);

    // Known Odoo master-data issue: MOD and CIF standard seconds should match
    const inconsistenciaStd = segStdCIF > 0 && Math.abs(segStdMOD - segStdCIF) > 0.5;

    // Reconciliation — residual comes from Odoo rounding (vrStd ≠ cantStd × tarifa)
    const costoEstandar = vrStdMOD + vrStdCIF + mpdVrPlanTotal;
    const diffTotal = costoEstandar - costoProduccion;
    const sumVarianzas = varTiempoMOD + (varTarifaMOD ?? 0) + varTiempoCIF + (varTarifaCIF ?? 0) + mpdImpactoTotal;
    const residual = diffTotal - sumVarianzas;

    res.json({
      refId,
      mes: mesToFilter,
      ordenes: orders.length,
      datosIncompletos: false,
      mod: {
        segStd: segStdMOD,
        segEjec: segEjecMOD,
        tarifaRealMOD,
        varTiempoMOD,
        varTarifaMOD,
      },
      cif: {
        segStd: segStdCIF,
        segEjec: segEjecCIF,
        tarifaRealCIF,
        varTiempoCIF,
        varTarifaCIF,
      },
      mpd: {
        desglose: mpdDesglose,
        vrPlanTotal: mpdVrPlanTotal,
        vrEjecTotal: mpdVrEjecTotal,
        impactoTotal: mpdImpactoTotal,
      },
      inconsistenciaStd,
      reconciliacion: {
        costoEstandar,
        costoProduccion,
        diffTotal,
        sumVarianzas,
        residual,
      },
    });
  } catch (e) {
    console.error("Error en análisis de variación:", e);
    res.status(500).json({ error: "Error al calcular el análisis de variación" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const { familia, segMOD, cifUnitario, costoReal, mes, consumos } = req.body;

    if (!familia || !mes) {
      return res.status(400).json({ error: "Los campos familia y mes son obligatorios" });
    }

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

// Elimina únicamente las órdenes importadas de un mes específico, dejando
// intacta la Referencia y sus demás meses. CostLabor/CostMaterial se borran
// en cascada (onDelete: Cascade en schema.prisma).
router.delete("/:id/ordenes/:mes", async (req, res) => {
  try {
    const { id, mes } = req.params;
    const orders = await prisma.costOrder.findMany({
      where: { refDonsson: id },
      select: { id: true, fechaFinal: true },
    });
    const idsAEliminar = orders
      .filter((o) => mesFromDate(o.fechaFinal) === mes)
      .map((o) => o.id);

    if (!idsAEliminar.length) {
      return res.status(404).json({ error: "No hay órdenes importadas para esta referencia en ese mes" });
    }

    await prisma.costOrder.deleteMany({ where: { id: { in: idsAEliminar } } });
    res.json({ success: true, eliminadas: idsAEliminar.length });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error al eliminar las órdenes del mes seleccionado" });
  }
});

router.get("/:id/optimo", async (req, res) => {
  try {
    const ref = await prisma.referencia.findUnique({
      where: { id: req.params.id },
      include: {
        optimalMateriales: { include: { material: true } },
        consumos: { include: { material: true } },
      },
    });
    if (!ref) return res.status(404).json({ error: "Referencia no encontrada" });

    const ordersRef = await prisma.costOrder.findMany({
      where: { refDonsson: ref.id },
      include: { laborItems: true, materials: true },
    });

    const lineas = ref.optimalMateriales.map(serializeOptimalLine);
    const { mpdOptimo, modEstandar, cifEstandar, costoOptimo } =
      calcCostoOptimo(ref, ordersRef, ref.optimalMateriales);
    const { costoEstandar, costoProduccion } = getCostosEstandarReferencia(ref, ordersRef);

    res.json({
      refId: ref.id,
      lineas,
      mpdOptimo,
      modEstandar,
      cifEstandar,
      costoOptimo,
      costoEstandar,
      costoProduccion,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error al obtener el costo óptimo" });
  }
});

router.put("/:id/optimo/:materialId", async (req, res) => {
  try {
    const { cantidad } = req.body;
    if (typeof cantidad !== "number" || isNaN(cantidad) || cantidad <= 0) {
      return res.status(400).json({ error: "La cantidad debe ser un número mayor que 0" });
    }

    const ref = await prisma.referencia.findUnique({ where: { id: req.params.id } });
    if (!ref) return res.status(404).json({ error: "Referencia no encontrada" });

    const material = await prisma.material.findUnique({ where: { id: req.params.materialId } });
    if (!material) return res.status(404).json({ error: "Material no encontrado" });

    const linea = await prisma.optimalMaterial.upsert({
      where: { referenciaId_materialId: { referenciaId: ref.id, materialId: material.id } },
      update: { cantidad },
      create: { referenciaId: ref.id, materialId: material.id, cantidad },
      include: { material: true },
    });

    res.json(serializeOptimalLine(linea));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error al guardar la línea de costo óptimo" });
  }
});

router.delete("/:id/optimo/:materialId", async (req, res) => {
  try {
    await prisma.optimalMaterial.delete({
      where: { referenciaId_materialId: { referenciaId: req.params.id, materialId: req.params.materialId } },
    });
    res.status(204).end();
  } catch (e) {
    if (e.code === "P2025") {
      return res.status(404).json({ error: "Línea no encontrada" });
    }
    console.error(e);
    res.status(500).json({ error: "Error al eliminar la línea de costo óptimo" });
  }
});

router.patch("/:id/costoReal", async (req, res) => {
  try {
    const { costoReal } = req.body;
    if (costoReal == null || typeof costoReal !== "number") {
      return res.status(400).json({ error: "costoReal debe ser un número válido" });
    }
    const ref = await prisma.referencia.update({
      where: { id: req.params.id },
      data: { costoReal },
      include: { consumos: { include: { material: true } } },
    });
    res.json(ref);
  } catch (e) {
    if (e.code === "P2025") return res.status(404).json({ error: "Referencia no encontrada" });
    console.error("Error actualizando costoReal:", e);
    res.status(500).json({ error: "Error al actualizar costo real" });
  }
});

module.exports = router;
