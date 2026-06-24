const express = require("express");
const multer = require("multer");
const XLSX = require("xlsx");
const { randomUUID } = require("crypto");
const { PrismaClient } = require("@prisma/client");

const router = express.Router();
const prisma = new PrismaClient();
const upload = multer({ storage: multer.memoryStorage() });

const EXPECTED_COLUMNS = [
  "Tipo", "Orden", "Documento origen",
  "Producto", "Ref donsson", "Producto clase", "Cantidad fabricada",
  "Insumo", "Costo mp",
  "Cant. x Ud. Planeado Standard", "Vr. x Ud. Planeado Standard",
  "Cant. x Ud. Planeado", "Vr. x Ud. Planeado",
  "Cant. x Ud. Ejecutado", "Vr. x Ud. Ejecutado",
  "Estado",
];

const MO_PROCESOS_STD = [
  "MANO DE OBRA CORTE",
  "MANO DE OBRA PLISADO",
  "MANO DE OBRA INYECCION",
  "MANO DE OBRA EMBALAJE",
];

const TARIFA_STD_MO = 3.80;
const TARIFA_STD_CF = 9.30;
const TARIFA_TOLERANCE = 0.05;

function isNullish(val) {
  if (val === null || val === undefined || val === "") return true;
  const s = String(val).trim().toLowerCase();
  return s === "" || s === "nan" || s === "null" || s === "undefined";
}

function parseNum(val) {
  if (isNullish(val)) return NaN;
  if (typeof val === "number") return isNaN(val) ? NaN : val;
  const s = String(val).trim();
  // Handle Colombian format: 1.234,56 → 1234.56
  const n = parseFloat(s.replace(/\./g, "").replace(/,/g, "."));
  return isNaN(n) ? NaN : n;
}

function num(val, fallback = 0) {
  const n = parseNum(val);
  return isNaN(n) ? fallback : n;
}


function extractCode(productoStr) {
  const match = String(productoStr || "").match(/\[([^\]]+)\]/);
  return match ? match[1].trim() : "";
}

function safeDiv(a, b) {
  if (!b || isNaN(b) || b === 0 || isNaN(a)) return null;
  return a / b;
}

function variacionPct(varVal, base) {
  if (!base || base === 0 || isNaN(base)) return 0;
  return (varVal / base) * 100;
}

// ── POST / ─ Import Excel ─────────────────────────────────────────────────────
router.post("/", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Archivo requerido" });

    const mes = (req.body.mes || "").trim();
    if (!mes || !/^\d{4}-\d{2}$/.test(mes)) {
      return res.status(400).json({ error: "El campo 'mes' es requerido (formato YYYY-MM)" });
    }

    const wb = XLSX.read(req.file.buffer, { type: "buffer", cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const allRows = XLSX.utils.sheet_to_json(ws, { defval: null });

    if (!allRows.length) return res.status(400).json({ error: "El archivo está vacío" });

    // ── Validate columns ──────────────────────────────────────────────────────
    const headers = Object.keys(allRows[0]);
    const missing = EXPECTED_COLUMNS.filter((c) => !headers.includes(c));
    if (missing.length > 0) {
      return res.status(400).json({ error: `Columnas faltantes: ${missing.join(", ")}` });
    }

    // ── Strip totals row (last row where Tipo is null/NaN) ────────────────────
    let rows = [...allRows];
    if (rows.length && isNullish(rows[rows.length - 1]["Tipo"])) {
      rows = rows.slice(0, -1);
    }
    rows = rows.filter((r) => !isNullish(r["Tipo"]));

    if (!rows.length) return res.status(400).json({ error: "No se encontraron filas de datos válidas" });

    // ── Order metadata from first valid row ───────────────────────────────────
    const first = rows[0];
    const orden = String(first["Orden"] || "").trim();
    const documentoOrigen = String(first["Documento origen"] || "").trim();
    const productoRaw = String(first["Producto"] || "").trim();
    const refDonsson = String(first["Ref donsson"] || "").trim();
    const productoClase = String(first["Producto clase"] || "").trim();
    const cantidadFabricada = num(first["Cantidad fabricada"]);
    const estado = String(first["Estado"] || "").trim();

    if (!orden) return res.status(400).json({ error: "La columna 'Orden' está vacía en la primera fila" });

    // ── Split by Tipo ─────────────────────────────────────────────────────────
    const rowsMO = rows.filter((r) => String(r["Tipo"]).trim() === "Mano de obra");
    const rowsCF = rows.filter((r) => String(r["Tipo"]).trim() === "Carga fabril");
    const rowsMP = rows.filter((r) => String(r["Tipo"]).trim() === "Materia prima");

    // ── Load material catalog for price lookup ────────────────────────────────
    const allMaterials = await prisma.material.findMany();
    const materialMap = new Map(
      allMaterials.map((m) => [m.nombre.trim().toLowerCase(), m])
    );

    // ── Hard validations ──────────────────────────────────────────────────────
    const errors = [];
    const warnings = [];

    if (rowsCF.length !== 1) {
      errors.push(`Se esperaba exactamente 1 fila de Carga Fabril, se encontraron ${rowsCF.length}`);
    }

    const procesosEncontrados = new Set(rowsMO.map((r) => String(r["Insumo"] || "").trim().toUpperCase()));
    const procesosFaltantes = MO_PROCESOS_STD.filter((p) => !procesosEncontrados.has(p));
    if (procesosFaltantes.length > 0) {
      errors.push(`Procesos de MO faltantes: ${procesosFaltantes.join(", ")}`);
    }

    // Warn about extra (non-standard) MO processes
    const procesosExtra = [...procesosEncontrados].filter((p) => !MO_PROCESOS_STD.includes(p));
    if (procesosExtra.length > 0) {
      warnings.push(`Procesos de MO no estándar encontrados: ${procesosExtra.join(", ")}`);
    }

    // Only flag as invalid if material is also absent from catalog (no fallback at all)
    const mpInvalidas = rowsMP.filter((r) => {
      const key = String(r["Insumo"] || "").trim().toLowerCase();
      return !materialMap.has(key) && (isNullish(r["Costo mp"]) || num(r["Costo mp"]) === 0);
    });
    if (mpInvalidas.length > 0) {
      errors.push(`Materias primas sin costo en catálogo ni en Excel: ${mpInvalidas.map((r) => r["Insumo"]).join(", ")}`);
    }

    if (errors.length > 0) {
      return res.status(422).json({ errors, warnings, parsed: { orden, refDonsson } });
    }

    // ── Process Carga Fabril ──────────────────────────────────────────────────
    const cfRow = rowsCF[0];
    const cfCantStd = parseNum(cfRow["Cant. x Ud. Planeado Standard"]);
    const cfVrStd = parseNum(cfRow["Vr. x Ud. Planeado Standard"]);
    const cfCantPlan = num(cfRow["Cant. x Ud. Planeado"]);
    const cfVrPlan = num(cfRow["Vr. x Ud. Planeado"]);
    const cfCantEjec = num(cfRow["Cant. x Ud. Ejecutado"]);
    const cfVrEjec = num(cfRow["Vr. x Ud. Ejecutado"]);

    const cfTarifaStd = safeDiv(cfVrStd, cfCantStd);
    const cfTarifaPlan = safeDiv(cfVrPlan, cfCantPlan);
    const cfTarifaEjec = safeDiv(cfVrEjec, cfCantEjec);

    if (cfTarifaStd !== null && Math.abs(cfTarifaStd - TARIFA_STD_CF) > TARIFA_TOLERANCE) {
      warnings.push(`Tarifa estándar CF: $${cfTarifaStd.toFixed(4)}/seg (esperado $${TARIFA_STD_CF}/seg ±${TARIFA_TOLERANCE})`);
    }

    const cfItem = {
      tipo: "carga_fabril",
      proceso: String(cfRow["Insumo"] || "CARGA FABRIL").trim(),
      cantStd: isNaN(cfCantStd) ? null : cfCantStd,
      vrStd: isNaN(cfVrStd) ? null : cfVrStd,
      tarifaStd: cfTarifaStd,
      cantPlaneado: cfCantPlan, vrPlaneado: cfVrPlan, tarifaPlaneada: cfTarifaPlan,
      cantEjecutado: cfCantEjec, vrEjecutado: cfVrEjec, tarifaEjecutada: cfTarifaEjec,
      variacionCantidad: cfCantEjec - cfCantPlan,
      variacionValor: cfVrEjec - cfVrPlan,
      variacionPct: variacionPct(cfVrEjec - cfVrPlan, cfVrPlan),
      eficienciaTiempoPct: cfCantPlan > 0 ? ((cfCantPlan - cfCantEjec) / cfCantPlan) * 100 : 0,
      alertaTarifa: false,
    };

    // ── Process Mano de Obra ──────────────────────────────────────────────────
    const moItems = rowsMO.map((r) => {
      const cantStd = parseNum(r["Cant. x Ud. Planeado Standard"]);
      const vrStd = parseNum(r["Vr. x Ud. Planeado Standard"]);
      const cantPlan = num(r["Cant. x Ud. Planeado"]);
      const vrPlan = num(r["Vr. x Ud. Planeado"]);
      const cantEjec = num(r["Cant. x Ud. Ejecutado"]);
      const vrEjec = num(r["Vr. x Ud. Ejecutado"]);

      const tarifaStd = safeDiv(vrStd, cantStd);
      const tarifaPlan = safeDiv(vrPlan, cantPlan);
      const tarifaEjec = safeDiv(vrEjec, cantEjec);
      const varVal = vrEjec - vrPlan;
      const alertaTarifa = tarifaEjec !== null && tarifaPlan !== null && tarifaEjec > tarifaPlan * 1.10;

      if (tarifaStd !== null && Math.abs(tarifaStd - TARIFA_STD_MO) > TARIFA_TOLERANCE) {
        warnings.push(`Tarifa estándar MO "${r["Insumo"]}": $${tarifaStd.toFixed(4)}/seg (esperado $${TARIFA_STD_MO}/seg ±${TARIFA_TOLERANCE})`);
      }
      if (alertaTarifa) {
        warnings.push(`Tarifa ejecutada MO "${r["Insumo"]}" supera en >10% la tarifa planeada ($${tarifaEjec?.toFixed(4)} vs $${tarifaPlan?.toFixed(4)}/seg)`);
      }

      return {
        tipo: "mano_obra",
        proceso: String(r["Insumo"] || "").trim(),
        cantStd: isNaN(cantStd) ? null : cantStd,
        vrStd: isNaN(vrStd) ? null : vrStd,
        tarifaStd,
        cantPlaneado: cantPlan, vrPlaneado: vrPlan, tarifaPlaneada: tarifaPlan,
        cantEjecutado: cantEjec, vrEjecutado: vrEjec, tarifaEjecutada: tarifaEjec,
        variacionCantidad: cantEjec - cantPlan,
        variacionValor: varVal,
        variacionPct: variacionPct(varVal, vrPlan),
        eficienciaTiempoPct: cantPlan > 0 ? ((cantPlan - cantEjec) / cantPlan) * 100 : 0,
        alertaTarifa,
      };
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

      const cantStd = parseNum(r["Cant. x Ud. Planeado Standard"]);
      const vrStd = parseNum(r["Vr. x Ud. Planeado Standard"]);
      const cantPlan = num(r["Cant. x Ud. Planeado"]);
      const cantEjec = num(r["Cant. x Ud. Ejecutado"]);

      // Recalculate values using catalog price (or Excel fallback)
      const vrPlan = cantPlan * costoMp;
      const vrEjec = cantEjec * costoMp;
      const varVal = vrEjec - vrPlan;
      const alertaCantidad = cantPlan > 0 && cantEjec > cantPlan * 1.20;

      if (alertaCantidad) {
        warnings.push(`Sobreconsumo MP "${insumoNombre}": ${cantEjec.toFixed(4)} ejecutado vs ${cantPlan.toFixed(4)} planeado (>20%)`);
      }

      return {
        insumo: insumoNombre,
        costoMp,
        cantStd: isNaN(cantStd) ? null : cantStd,
        vrStd: isNaN(vrStd) ? null : vrStd,
        cantPlaneado: cantPlan, vrPlaneado: vrPlan,
        cantEjecutado: cantEjec, vrEjecutado: vrEjec,
        variacionCantidad: cantEjec - cantPlan,
        variacionValor: varVal,
        variacionPct: variacionPct(varVal, vrPlan),
        alertaCantidad,
      };
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

    // ── Persist ───────────────────────────────────────────────────────────────
    const [mesYear, mesMonth] = mes.split("-").map(Number);
    const fechaInicial = new Date(mesYear, mesMonth - 1, 1);
    const fechaFinal = new Date(mesYear, mesMonth, 0, 23, 59, 59);

    const order = await prisma.$transaction(async (tx) => {
      await tx.costOrder.deleteMany({ where: { orden } });

      // Auto-crear Referencia si no existe todavía
      if (refDonsson) {
        await tx.referencia.upsert({
          where: { id: refDonsson },
          create: {
            id: refDonsson,
            nombre: productoRaw,
            familia: "",
            mes,
            fechaCreacion: mes,
          },
          update: {},
        });
      }

      // Auto-crear materiales faltantes en el catálogo
      for (const [nombre, costo] of materialesParaCrear) {
        const existe = await tx.material.findFirst({ where: { nombre } });
        if (!existe) {
          await tx.material.create({
            data: { id: randomUUID(), nombre, unidad: "", costo, proveedor: "" },
          });
        }
      }

      return tx.costOrder.create({
        data: {
          orden, documentoOrigen, refDonsson,
          producto: productoRaw,
          productoCodigo: extractCode(productoRaw),
          productoClase, cantidadFabricada,
          fechaInicial,
          fechaFinal,
          estado, totalPlaneado, totalEjecutado, totalVariacion,
          archivoFuente: req.file.originalname || "Detalle de Costos.xls",
          laborItems: { create: [cfItem, ...moItems] },
          materials: { create: mpItems },
        },
        include: { laborItems: true, materials: true },
      });
    });

    res.json({
      success: true,
      warnings,
      catalogoLookup: {
        encontrados: materialesEncontrados,
        noEncontrados: materialesNoEncontrados,
      },
      order,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error al importar costos: " + e.message });
  }
});

// ── GET / ─ List all orders ───────────────────────────────────────────────────
router.get("/", async (_req, res) => {
  try {
    const orders = await prisma.costOrder.findMany({
      orderBy: { fechaImportacion: "desc" },
      include: { laborItems: true, materials: true },
    });
    res.json(orders);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /:id ─ Single order ───────────────────────────────────────────────────
router.get("/:id", async (req, res) => {
  try {
    const order = await prisma.costOrder.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { laborItems: true, materials: true },
    });
    if (!order) return res.status(404).json({ error: "Orden no encontrada" });
    res.json(order);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── DELETE /:id ───────────────────────────────────────────────────────────────
router.delete("/:id", async (req, res) => {
  try {
    await prisma.costOrder.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
