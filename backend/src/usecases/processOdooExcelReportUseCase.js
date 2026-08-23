// Use case: parse and validate a raw Odoo "Detalle de Costos" Excel workbook
// into structured rows, ready for the variance use-cases to consume.
// No DB writes here — the material catalog lookup is read-only (needed to
// validate/price rows), persistence stays in the route.
const XLSX = require("xlsx");

const EXPECTED_COLUMNS = [
  "Tipo", "Orden", "Documento origen",
  "Producto", "Ref donsson", "Producto clase", "Cantidad fabricada",
  "Insumo", "Costo mp",
  "Cant. x Ud. Planeado Standard", "Vr. x Ud. Planeado Standard",
  "Cant. x Ud. Planeado", "Vr. x Ud. Planeado",
  "Cant. x Ud. Ejecutado", "Vr. x Ud. Ejecutado",
  "Estado",
];

// Un proceso de MO es válido si empieza con "MANO DE OBRA" (sin importar el sufijo)
// o si es "CARGA FABRIL". Esto permite procesos nuevos sin modificar código.
const esProcesoDeMO = (nombre) => {
  const n = String(nombre || "").trim().toUpperCase();
  return n.startsWith("MANO DE OBRA") || n.startsWith("CARGA FABRIL");
};

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

function inferirFamilia(refCode) {
  const c = String(refCode || "").trim().toUpperCase();
  if (/^AAA/.test(c)) return "AAA";
  if (/^A/.test(c)) return "A";
  if (/^B/.test(c)) return "B";
  if (/^C/.test(c)) return "C";
  return "SIN_CLASIFICAR";
}

/**
 * @param {Buffer} fileBuffer
 * @param {Map<string, {nombre: string, costo: number}>} materialMap lowercased-name → catalog material
 * @returns {{errors: string[], warnings: string[], orderMeta: object|null,
 *   rowsMO: object[], rowsCF: object[], rowsMP: object[]}}
 */
function processOdooExcelReportUseCase(fileBuffer, materialMap) {
  const errors = [];
  const warnings = [];

  const wb = XLSX.read(fileBuffer, { type: "buffer", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const allRows = XLSX.utils.sheet_to_json(ws, { defval: null });

  if (!allRows.length) {
    errors.push("El archivo está vacío");
    return { errors, warnings, orderMeta: null, rowsMO: [], rowsCF: [], rowsMP: [] };
  }

  const headers = Object.keys(allRows[0]);
  const missing = EXPECTED_COLUMNS.filter((c) => !headers.includes(c));
  if (missing.length > 0) {
    errors.push(`Columnas faltantes: ${missing.join(", ")}`);
    return { errors, warnings, orderMeta: null, rowsMO: [], rowsCF: [], rowsMP: [] };
  }

  // Strip totals row (last row where Tipo is null/NaN)
  let rows = [...allRows];
  if (rows.length && isNullish(rows[rows.length - 1]["Tipo"])) {
    rows = rows.slice(0, -1);
  }
  rows = rows.filter((r) => !isNullish(r["Tipo"]));

  if (!rows.length) {
    errors.push("No se encontraron filas de datos válidas");
    return { errors, warnings, orderMeta: null, rowsMO: [], rowsCF: [], rowsMP: [] };
  }

  const first = rows[0];
  const orden = String(first["Orden"] || "").trim();
  const orderMeta = {
    orden,
    documentoOrigen: String(first["Documento origen"] || "").trim(),
    productoRaw: String(first["Producto"] || "").trim(),
    productoCodigo: extractCode(first["Producto"]),
    refDonsson: String(first["Ref donsson"] || "").trim(),
    productoClase: String(first["Producto clase"] || "").trim(),
    cantidadFabricada: num(first["Cantidad fabricada"]),
    estado: String(first["Estado"] || "").trim(),
    familiaSugerida: inferirFamilia(String(first["Ref donsson"] || "").trim()),
  };

  if (!orden) {
    errors.push("La columna 'Orden' está vacía en la primera fila");
  }

  const rowsMO = rows.filter((r) => String(r["Tipo"]).trim() === "Mano de obra");
  const rowsCF = rows.filter((r) => String(r["Tipo"]).trim() === "Carga fabril");
  const rowsMP = rows.filter((r) => String(r["Tipo"]).trim() === "Materia prima");

  if (rowsCF.length !== 1) {
    errors.push(`Se esperaba exactamente 1 fila de Carga Fabril, se encontraron ${rowsCF.length}`);
  }

  const procesosEncontrados = new Set(rowsMO.map((r) => String(r["Insumo"] || "").trim().toUpperCase()));
  const procesosDesconocidos = [...procesosEncontrados].filter((p) => !esProcesoDeMO(p));
  if (procesosDesconocidos.length > 0) {
    warnings.push(`Procesos de MO no reconocidos (se omiten): ${procesosDesconocidos.join(", ")}`);
  }

  const mpInvalidas = rowsMP.filter((r) => {
    const key = String(r["Insumo"] || "").trim().toLowerCase();
    return !materialMap.has(key) && (isNullish(r["Costo mp"]) || num(r["Costo mp"]) === 0);
  });
  if (mpInvalidas.length > 0) {
    errors.push(`Materias primas sin costo en catálogo ni en Excel: ${mpInvalidas.map((r) => r["Insumo"]).join(", ")}`);
  }

  return {
    errors,
    warnings,
    orderMeta,
    rowsMO: rowsMO.filter((r) => esProcesoDeMO(String(r["Insumo"] || "").trim())),
    rowsCF,
    rowsMP,
  };
}

module.exports = {
  EXPECTED_COLUMNS,
  esProcesoDeMO,
  isNullish,
  parseNum,
  num,
  extractCode,
  inferirFamilia,
  processOdooExcelReportUseCase,
};
