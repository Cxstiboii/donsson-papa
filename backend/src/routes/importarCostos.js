const express = require("express");
const multer = require("multer");
const prisma = require("../prisma");
const {
  parseNum,
  num,
  processOdooExcelReportUseCase,
} = require("../usecases/processOdooExcelReportUseCase");
const {
  STANDARD_RATE_MO,
  STANDARD_RATE_CF,
  RATE_TOLERANCE,
  calculateLaborVarianceItem,
  checkStandardRateDeviation,
} = require("../usecases/calculateLaborVariance");
const {
  calculateRawMaterialVarianceItem,
} = require("../usecases/calculateRawMaterialVariance");

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB máximo
});

// ── POST / ─ Import Excel ─────────────────────────────────────────────────────
router.post("/", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Archivo requerido" });

    const mes = (req.body.mes || "").trim();
    if (!mes || !/^\d{4}-\d{2}$/.test(mes)) {
      return res.status(400).json({ error: "El campo 'mes' es requerido (formato YYYY-MM)" });
    }

    // ── Load material catalog for price lookup ────────────────────────────────
    const allMaterials = await prisma.material.findMany();
    const materialMap = new Map(
      allMaterials.map((m) => [m.nombre.trim().toLowerCase(), m])
    );

    const { errors, warnings, orderMeta, rowsMO, rowsCF, rowsMP } =
      processOdooExcelReportUseCase(req.file.buffer, materialMap);

    if (errors.length > 0) {
      return res.status(422).json({
        error: errors[0],
        errors,
        warnings,
        parsed: orderMeta ? { orden: orderMeta.orden, refDonsson: orderMeta.refDonsson } : undefined,
      });
    }

    const { orden, documentoOrigen, productoRaw, productoCodigo, refDonsson, productoClase, cantidadFabricada, estado } = orderMeta;

    // ── Process Carga Fabril ──────────────────────────────────────────────────
    const cfRow = rowsCF[0];
    const cfItem = calculateLaborVarianceItem({
      tipo: "carga_fabril",
      proceso: String(cfRow["Insumo"] || "CARGA FABRIL").trim(),
      cantStd: parseNum(cfRow["Cant. x Ud. Planeado Standard"]),
      vrStd: parseNum(cfRow["Vr. x Ud. Planeado Standard"]),
      cantPlan: num(cfRow["Cant. x Ud. Planeado"]),
      vrPlan: num(cfRow["Vr. x Ud. Planeado"]),
      cantEjec: num(cfRow["Cant. x Ud. Ejecutado"]),
      vrEjec: num(cfRow["Vr. x Ud. Ejecutado"]),
    });

    if (checkStandardRateDeviation(cfItem.tarifaStd, STANDARD_RATE_CF, RATE_TOLERANCE)) {
      warnings.push(`Tarifa estándar CF: $${cfItem.tarifaStd.toFixed(4)}/seg (esperado $${STANDARD_RATE_CF}/seg ±${RATE_TOLERANCE})`);
    }

    // ── Process Mano de Obra ──────────────────────────────────────────────────
    const moItems = rowsMO.map((r) => {
      const item = calculateLaborVarianceItem({
        tipo: "mano_obra",
        proceso: String(r["Insumo"] || "").trim(),
        cantStd: parseNum(r["Cant. x Ud. Planeado Standard"]),
        vrStd: parseNum(r["Vr. x Ud. Planeado Standard"]),
        cantPlan: num(r["Cant. x Ud. Planeado"]),
        vrPlan: num(r["Vr. x Ud. Planeado"]),
        cantEjec: num(r["Cant. x Ud. Ejecutado"]),
        vrEjec: num(r["Vr. x Ud. Ejecutado"]),
      });

      if (checkStandardRateDeviation(item.tarifaStd, STANDARD_RATE_MO, RATE_TOLERANCE)) {
        warnings.push(`Tarifa estándar MO "${r["Insumo"]}": $${item.tarifaStd.toFixed(4)}/seg (esperado $${STANDARD_RATE_MO}/seg ±${RATE_TOLERANCE})`);
      }

      return item;
    });

    // ── Process Materia Prima ─────────────────────────────────────────────────
    const materialesEncontrados = [];
    const materialesNoEncontrados = [];
    const materialesParaCrear = new Map(); // nombre -> costoMp (únicos no encontrados)

    const mpItems = rowsMP.map((r) => {
      const insumoNombre = String(r["Insumo"] || "").trim();
      const key = insumoNombre.toLowerCase();
      const materialCatalogo = materialMap.get(key);

      let costoMp;
      if (materialCatalogo) {
        costoMp = materialCatalogo.costo;
        materialesEncontrados.push(insumoNombre);
      } else {
        costoMp = num(r["Costo mp"]);
        materialesNoEncontrados.push(insumoNombre);
        if (!materialesParaCrear.has(insumoNombre)) {
          materialesParaCrear.set(insumoNombre, costoMp);
        }
        warnings.push(`Material "${insumoNombre}" no encontrado en catálogo; se usó Costo mp del Excel ($${costoMp}) y se creará automáticamente`);
      }

      const item = calculateRawMaterialVarianceItem({
        insumo: insumoNombre,
        costoMp,
        cantStd: parseNum(r["Cant. x Ud. Planeado Standard"]),
        vrStd: parseNum(r["Vr. x Ud. Planeado Standard"]),
        cantPlan: num(r["Cant. x Ud. Planeado"]),
        vrPlanExcel: num(r["Vr. x Ud. Planeado"]),
        cantEjec: num(r["Cant. x Ud. Ejecutado"]),
        vrEjecExcel: num(r["Vr. x Ud. Ejecutado"]),
      });

      if (item.alertaCantidad) {
        warnings.push(`Sobreconsumo MP "${insumoNombre}": ${item.cantEjecutado.toFixed(4)} ejecutado vs ${item.cantPlaneado.toFixed(4)} planeado (>20%)`);
      }

      return item;
    });

    // ── Totals ────────────────────────────────────────────────────────────────
    const laborPlan = [cfItem, ...moItems].reduce((s, x) => s + x.vrPlaneado, 0);
    const laborEjec = [cfItem, ...moItems].reduce((s, x) => s + x.vrEjecutado, 0);
    const mpPlan = mpItems.reduce((s, x) => s + x.vrPlaneado, 0);
    const mpEjec = mpItems.reduce((s, x) => s + x.vrEjecutado, 0);
    const totalPlaneado = laborPlan + mpPlan;
    const totalEjecutado = laborEjec + mpEjec;
    const totalVariacion = totalEjecutado - totalPlaneado;

    if (totalPlaneado > 0 && Math.abs(totalVariacion / totalPlaneado) > 0.15) {
      warnings.push(`Total ejecutado supera en >15% al total planeado (${((totalVariacion / totalPlaneado) * 100).toFixed(1)}%)`);
    }

    // ── MOD y CIF estándar para poblar Referencia.segMOD / cifUnitario ────────
    const totalModVrStd = moItems.reduce((s, x) => s + (x.vrStd != null ? x.vrStd : (x.vrPlaneado ?? 0)), 0);
    const cifVrStd = cfItem.vrStd != null ? cfItem.vrStd : (cfItem.vrPlaneado ?? 0);

    // ── Persist ───────────────────────────────────────────────────────────────
    const [mesYear, mesMonth] = mes.split("-").map(Number);
    const fechaInicial = new Date(mesYear, mesMonth - 1, 1);
    const fechaFinal = new Date(mesYear, mesMonth, 0, 23, 59, 59);

    const orderData = {
      documentoOrigen, refDonsson,
      producto: productoRaw,
      productoCodigo,
      productoClase, cantidadFabricada,
      fechaInicial, fechaFinal,
      estado, totalPlaneado, totalEjecutado, totalVariacion,
      archivoFuente: req.file.originalname || "Detalle de Costos.xls",
    };

    const advertencias = [];

    // Transacción principal: materiales + CostOrder + CostMaterial (deben ser atómicos)
    const { savedOrderId, materialesCreados } = await prisma.$transaction(async (tx) => {
      // Crear o actualizar Referencia — respeta familia si ya fue clasificada manualmente
      if (refDonsson) {
        const existingRef = await tx.referencia.findUnique({
          where: { id: refDonsson },
          select: { familia: true },
        });
        const familiaParaUsar =
          existingRef?.familia && existingRef.familia !== "SIN_CLASIFICAR" && existingRef.familia !== ""
            ? existingRef.familia
            : orderMeta.familiaSugerida;

        await tx.referencia.upsert({
          where: { id: refDonsson },
          create: {
            id: refDonsson,
            nombre: productoRaw,
            familia: familiaParaUsar,
            mes,
            fechaCreacion: mes,
            segMOD: totalModVrStd,
            cifUnitario: cifVrStd,
          },
          update: { mes, nombre: productoRaw, segMOD: totalModVrStd, cifUnitario: cifVrStd, familia: familiaParaUsar },
        });
      }

      // Auto-crear materiales faltantes en el catálogo y registrarlos
      const creados = [];
      for (const [nombre, costo] of materialesParaCrear) {
        const existe = await tx.material.findFirst({ where: { nombre } });
        if (!existe) {
          const autoMaterials = await tx.material.findMany({
            where: { id: { startsWith: "AUTO-" } },
            select: { id: true },
            orderBy: { id: "desc" },
          });
          const lastNum = autoMaterials.length > 0
            ? parseInt(autoMaterials[0].id.replace("AUTO-", ""), 10)
            : 0;
          const newId = `AUTO-${String(lastNum + 1).padStart(3, "0")}`;
          await tx.material.create({
            data: { id: newId, nombre, unidad: "", costo, proveedor: "" },
          });
          creados.push({ id: newId, nombre, costo });
        }
      }

      // Upsert CostOrder por campo único `orden`
      const savedOrder = await tx.costOrder.upsert({
        where: { orden },
        create: { orden, ...orderData },
        update: orderData,
      });

      // Upsert CostMaterial por (orderId, insumo)
      for (const item of mpItems) {
        await tx.costMaterial.upsert({
          where: { orderId_insumo: { orderId: savedOrder.id, insumo: item.insumo } },
          create: { orderId: savedOrder.id, ...item },
          update: item,
        });
      }

      return { savedOrderId: savedOrder.id, materialesCreados: creados };
    });

    // Upsert CostLabor fuera de la transacción — tolerancia a fallos por proceso:
    // si uno falla (ej. campo nulo, nombre inesperado), se loguea y se continúa.
    for (const item of [cfItem, ...moItems]) {
      try {
        await prisma.costLabor.upsert({
          where: { orderId_proceso: { orderId: savedOrderId, proceso: item.proceso } },
          create: { orderId: savedOrderId, ...item },
          update: item,
        });
      } catch (err) {
        console.error(`Error guardando proceso "${item.proceso}":`, err);
        advertencias.push(`No se pudo guardar el proceso "${item.proceso}": ${err.message}`);
      }
    }

    const order = await prisma.costOrder.findUnique({
      where: { id: savedOrderId },
      include: { laborItems: true, materials: true },
    });

    res.json({
      success: true,
      warnings,
      advertencias,
      catalogoLookup: {
        encontrados: materialesEncontrados,
        noEncontrados: materialesNoEncontrados,
      },
      order,
      materialesCreados,
    });
  } catch (e) {
    console.error("Error al importar costos:", e);
    res.status(500).json({ error: "Error al importar costos. Revisa el archivo e intenta de nuevo." });
  }
});

// ── GET / ─ List all orders ───────────────────────────────────────────────────
router.get("/", async (_req, res) => {
  try {
    const orders = await prisma.costOrder.findMany({
      orderBy: { fechaImportacion: "desc" },
    });
    res.json(orders);
  } catch (e) {
    console.error("Error al listar órdenes:", e);
    res.status(500).json({ error: "Error al obtener las órdenes de costo." });
  }
});

// ── GET /:id ─ Single order ───────────────────────────────────────────────────
router.get("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "ID de orden inválido" });
    const order = await prisma.costOrder.findUnique({
      where: { id },
      include: { laborItems: true, materials: true },
    });
    if (!order) return res.status(404).json({ error: "Orden no encontrada" });
    res.json(order);
  } catch (e) {
    console.error("Error al obtener orden:", e);
    res.status(500).json({ error: "Error al obtener la orden de costo." });
  }
});

// ── DELETE /:id ───────────────────────────────────────────────────────────────
router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "ID de orden inválido" });
    await prisma.costOrder.delete({ where: { id } });
    res.json({ success: true });
  } catch (e) {
    console.error("Error al eliminar orden:", e);
    res.status(500).json({ error: "Error al eliminar la orden de costo." });
  }
});

module.exports = router;
