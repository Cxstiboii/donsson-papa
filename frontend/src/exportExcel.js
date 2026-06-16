import * as XLSX from "xlsx";
import { calcCostos } from "./api.js";

// ---------------------------------------------------------------------------
// Formatos numéricos
// ---------------------------------------------------------------------------
const FMT_COP = '"$"#,##0';
const FMT_PCT = '+0.0%;-0.0%;"-"';
const FMT_NUM2 = "0.00";
const FMT_INT = "#,##0";

const BORDER_THIN = {
  top: { style: "thin", color: { rgb: "D1D5DB" } },
  bottom: { style: "thin", color: { rgb: "D1D5DB" } },
  left: { style: "thin", color: { rgb: "D1D5DB" } },
  right: { style: "thin", color: { rgb: "D1D5DB" } },
};

const S = {
  titulo: {
    font: { bold: true, color: { rgb: "FFFFFF" }, sz: 28 },
    fill: { fgColor: { rgb: "1F3864" } },
    alignment: { horizontal: "center", vertical: "center" },
  },
  subtitulo: {
    font: { bold: false, color: { rgb: "FFFFFF" }, sz: 16 },
    fill: { fgColor: { rgb: "2E75B6" } },
    alignment: { horizontal: "center", vertical: "center" },
  },
  meta: {
    font: { color: { rgb: "1F3864" }, sz: 12 },
    fill: { fgColor: { rgb: "D6E4F0" } },
    alignment: { horizontal: "center", vertical: "center" },
  },
  kpiLabel: {
    font: { sz: 9, color: { rgb: "6B7280" } },
    alignment: { horizontal: "center", vertical: "center" },
  },
  headerPrimario: {
    font: { bold: true, color: { rgb: "FFFFFF" }, sz: 11 },
    fill: { fgColor: { rgb: "1F3864" } },
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
    border: BORDER_THIN,
  },
  headerSecundario: {
    font: { bold: true, color: { rgb: "FFFFFF" }, sz: 10 },
    fill: { fgColor: { rgb: "2E75B6" } },
    alignment: { horizontal: "center", vertical: "center" },
    border: BORDER_THIN,
  },
  filaPar: {
    fill: { fgColor: { rgb: "F1F5F9" } },
    alignment: { vertical: "center" },
    border: BORDER_THIN,
  },
  filaImpar: {
    fill: { fgColor: { rgb: "FFFFFF" } },
    alignment: { vertical: "center" },
    border: BORDER_THIN,
  },
  total: {
    font: { bold: true, color: { rgb: "FFFFFF" } },
    fill: { fgColor: { rgb: "1F3864" } },
    border: BORDER_THIN,
  },
  totalAmarillo: {
    font: { bold: true, color: { rgb: "1F3864" } },
    fill: { fgColor: { rgb: "FEF3C7" } },
    border: BORDER_THIN,
  },
  alerta: {
    font: { bold: true, color: { rgb: "991B1B" } },
    fill: { fgColor: { rgb: "FEE2E2" } },
    border: BORDER_THIN,
  },
  ok: {
    font: { color: { rgb: "065F46" } },
    fill: { fgColor: { rgb: "D1FAE5" } },
    border: BORDER_THIN,
  },
  revisar: {
    font: { color: { rgb: "92400E" } },
    fill: { fgColor: { rgb: "FEF3C7" } },
    border: BORDER_THIN,
  },
  sinDato: {
    font: { italic: true, color: { rgb: "9CA3AF" } },
    border: BORDER_THIN,
  },
  separadorFamilia: {
    font: { bold: true, color: { rgb: "1F3864" }, sz: 10 },
    fill: { fgColor: { rgb: "D6E4F0" } },
    border: BORDER_THIN,
  },
  tituloSeccion: {
    font: { bold: true, color: { rgb: "1F3864" }, sz: 13 },
    fill: { fgColor: { rgb: "D6E4F0" } },
    alignment: { horizontal: "center", vertical: "center" },
  },
  tituloAlerta: {
    font: { bold: true, color: { rgb: "991B1B" } },
    fill: { fgColor: { rgb: "FEE2E2" } },
    alignment: { horizontal: "center", vertical: "center" },
  },
};

const KPI_FILLS = ["1F3864", "065F46", "2E75B6", "991B1B"];

// ---------------------------------------------------------------------------
// Helpers de hoja
// ---------------------------------------------------------------------------
function addr(r, c) {
  return XLSX.utils.encode_cell({ r, c });
}

function setCell(ws, r, c, v, { style, z, type } = {}) {
  const cell = { v };
  if (type) cell.t = type;
  else if (typeof v === "number") cell.t = "n";
  else if (typeof v === "boolean") cell.t = "b";
  else cell.t = "s";
  if (z) cell.z = z;
  if (style) cell.s = style;
  ws[addr(r, c)] = cell;
  return cell;
}

function merge(ws, r1, c1, r2, c2) {
  if (!ws["!merges"]) ws["!merges"] = [];
  ws["!merges"].push({ s: { r: r1, c: c1 }, e: { r: r2, c: c2 } });
}

function fillRangeStyle(ws, r1, c1, r2, c2, style) {
  for (let r = r1; r <= r2; r++) {
    for (let c = c1; c <= c2; c++) {
      const a = addr(r, c);
      if (!ws[a]) ws[a] = { t: "z" };
      ws[a].s = { ...(ws[a].s || {}), ...style };
    }
  }
}

function setColWidths(ws, widths) {
  ws["!cols"] = widths.map((w) => ({ wch: w }));
}

function setRowHeights(ws, heights) {
  ws["!rows"] = heights.map((h) => (h ? { hpx: h } : {}));
}

function setRange(ws, lastRow, lastCol) {
  ws["!ref"] = `A1:${addr(lastRow, lastCol)}`;
}

function variacionLabel(v) {
  if (v == null) return "Sin dato";
  const sign = v > 0 ? "+" : v < 0 ? "" : "";
  return `${sign}${v.toFixed(1)}%`;
}

function variacionStyle(v) {
  if (v == null) return S.sinDato;
  const abs = Math.abs(v);
  if (abs <= 5) return S.ok;
  if (abs <= 10) return S.revisar;
  return S.alerta;
}

// ---------------------------------------------------------------------------
// Hoja 1: Portada
// ---------------------------------------------------------------------------
function buildPortada(wb, referencias, parametros, periodoLabel, datos) {
  const ws = {};

  setCell(ws, 2, 0, "INDUSTRIAS DONSOON", { style: S.titulo });
  merge(ws, 2, 0, 3, 7);
  fillRangeStyle(ws, 2, 0, 3, 7, S.titulo);

  setCell(ws, 4, 0, "Reporte de Costos de Producción", { style: S.subtitulo });
  merge(ws, 4, 0, 5, 7);
  fillRangeStyle(ws, 4, 0, 5, 7, S.subtitulo);

  setCell(ws, 6, 0, `Período: ${periodoLabel || "Todos"}`, { style: S.meta });
  merge(ws, 6, 0, 6, 7);

  const fecha = new Date();
  const fechaStr = `${String(fecha.getDate()).padStart(2, "0")}/${String(fecha.getMonth() + 1).padStart(2, "0")}/${fecha.getFullYear()} ${String(fecha.getHours()).padStart(2, "0")}:${String(fecha.getMinutes()).padStart(2, "0")}`;
  setCell(ws, 7, 0, `Generado el: ${fechaStr}`, { style: S.meta });
  merge(ws, 7, 0, 7, 7);

  // KPIs
  const kpis = [
    { label: "Total Referencias", value: datos.totalRefs, z: FMT_INT },
    { label: "Costo Prom. Producción", value: datos.costoProdProm, z: FMT_COP },
    { label: "Precio Venta Promedio", value: datos.precioVentaProm, z: FMT_COP },
    { label: "Alertas (>10% variación)", value: datos.totalAlertas, z: FMT_INT },
  ];

  kpis.forEach((kpi, i) => {
    const c1 = i * 2;
    const c2 = c1 + 1;
    setCell(ws, 9, c1, kpi.value, { style: { ...S.kpiLabel, font: { bold: true, color: { rgb: "FFFFFF" }, sz: 14 }, fill: { fgColor: { rgb: KPI_FILLS[i] } }, alignment: { horizontal: "center", vertical: "center" } }, z: kpi.z });
    merge(ws, 9, c1, 10, c2);
    fillRangeStyle(ws, 9, c1, 10, c2, { fill: { fgColor: { rgb: KPI_FILLS[i] } } });

    setCell(ws, 11, c1, kpi.label, { style: S.kpiLabel });
    merge(ws, 11, c1, 11, c2);
  });

  // Tabla de parámetros
  const paramHeaderRow = 13;
  ["Parámetro", "Valor", "Unidad"].forEach((h, c) => {
    setCell(ws, paramHeaderRow, c, h, { style: S.headerPrimario });
  });

  const paramRows = [
    ["Tarifa MOD", parametros.tarifaMOD, "COP/hora"],
    ["Tarifa CIF", parametros.tarifaCIF, "COP/hora-máq"],
    ["Gastos Adm. y Ventas", parametros.pctGAV, "%"],
    ["Margen de Utilidad", parametros.pctMargen, "%"],
  ];

  paramRows.forEach((row, i) => {
    const r = paramHeaderRow + 1 + i;
    const style = i % 2 === 0 ? S.filaImpar : S.filaPar;
    setCell(ws, r, 0, row[0], { style });
    setCell(ws, r, 1, row[1], { style, z: FMT_NUM2 });
    setCell(ws, r, 2, row[2], { style });
  });

  setColWidths(ws, [16, 16, 16, 16, 16, 16, 16, 16]);
  setRange(ws, paramHeaderRow + paramRows.length, 7);
  XLSX.utils.book_append_sheet(wb, ws, "Portada");
}

// ---------------------------------------------------------------------------
// Hoja 2: Resumen Ejecutivo
// ---------------------------------------------------------------------------
function buildResumenEjecutivo(wb, calculados) {
  const ws = {};

  setCell(ws, 1, 0, "ANÁLISIS POR FAMILIA DE PRODUCTO", { style: S.tituloSeccion });
  merge(ws, 1, 0, 1, 9);
  fillRangeStyle(ws, 1, 0, 1, 9, S.tituloSeccion);

  const headers1 = [
    "Familia", "Cant. Refs", "MPD Promedio", "MOD Promedio", "CIF Promedio",
    "Costo Prod. Prom", "Precio Venta Prom", "Margen Bruto Prom", "% Materiales", "Alertas",
  ];
  headers1.forEach((h, c) => setCell(ws, 2, c, h, { style: S.headerPrimario }));

  const familiasOrden = ["FA", "FM", "FE"];
  const presentes = [...new Set(calculados.map((c) => c.ref.familia))];
  const familias = [...familiasOrden.filter((f) => presentes.includes(f)), ...presentes.filter((f) => !familiasOrden.includes(f))];

  const statsPorFamilia = familias.map((fam) => {
    const items = calculados.filter((c) => c.ref.familia === fam);
    const n = items.length || 1;
    const sum = (fn) => items.reduce((s, it) => s + fn(it), 0);
    const mpdProm = sum((it) => it.c.mpd) / n;
    const modProm = sum((it) => it.c.mod) / n;
    const cifProm = sum((it) => it.c.cif) / n;
    const costoProdProm = sum((it) => it.c.costoProd) / n;
    const precioVentaProm = sum((it) => it.c.precioVenta) / n;
    const margenProm = sum((it) => it.c.margenBruto) / n;
    const pctMateriales = costoProdProm > 0 ? mpdProm / costoProdProm : 0;
    const alertas = items.filter((it) => it.c.variacion != null && Math.abs(it.c.variacion) > 10).length;
    return { fam, n: items.length, mpdProm, modProm, cifProm, costoProdProm, precioVentaProm, margenProm, pctMateriales, alertas };
  });

  statsPorFamilia.forEach((s, i) => {
    const r = 3 + i;
    const style = i % 2 === 0 ? S.filaImpar : S.filaPar;
    setCell(ws, r, 0, s.fam, { style });
    setCell(ws, r, 1, s.n, { style, z: FMT_INT });
    setCell(ws, r, 2, s.mpdProm, { style, z: FMT_COP });
    setCell(ws, r, 3, s.modProm, { style, z: FMT_COP });
    setCell(ws, r, 4, s.cifProm, { style, z: FMT_COP });
    setCell(ws, r, 5, s.costoProdProm, { style, z: FMT_COP });
    setCell(ws, r, 6, s.precioVentaProm, { style, z: FMT_COP });
    setCell(ws, r, 7, s.margenProm, { style, z: FMT_COP });
    setCell(ws, r, 8, s.pctMateriales, { style, z: "0.0%" });
    setCell(ws, r, 9, s.alertas, { style, z: FMT_INT });
  });

  const totalRow = 3 + statsPorFamilia.length;
  const totalN = calculados.length || 1;
  const tsum = (fn) => calculados.reduce((s, it) => s + fn(it), 0);
  const tMpd = tsum((it) => it.c.mpd) / totalN;
  const tMod = tsum((it) => it.c.mod) / totalN;
  const tCif = tsum((it) => it.c.cif) / totalN;
  const tCostoProd = tsum((it) => it.c.costoProd) / totalN;
  const tPrecio = tsum((it) => it.c.precioVenta) / totalN;
  const tMargen = tsum((it) => it.c.margenBruto) / totalN;
  const tPctMat = tCostoProd > 0 ? tMpd / tCostoProd : 0;
  const tAlertas = calculados.filter((it) => it.c.variacion != null && Math.abs(it.c.variacion) > 10).length;

  setCell(ws, totalRow, 0, "TOTAL / PROMEDIO GENERAL", { style: S.totalAmarillo });
  setCell(ws, totalRow, 1, calculados.length, { style: S.totalAmarillo, z: FMT_INT });
  setCell(ws, totalRow, 2, tMpd, { style: S.totalAmarillo, z: FMT_COP });
  setCell(ws, totalRow, 3, tMod, { style: S.totalAmarillo, z: FMT_COP });
  setCell(ws, totalRow, 4, tCif, { style: S.totalAmarillo, z: FMT_COP });
  setCell(ws, totalRow, 5, tCostoProd, { style: S.totalAmarillo, z: FMT_COP });
  setCell(ws, totalRow, 6, tPrecio, { style: S.totalAmarillo, z: FMT_COP });
  setCell(ws, totalRow, 7, tMargen, { style: S.totalAmarillo, z: FMT_COP });
  setCell(ws, totalRow, 8, tPctMat, { style: S.totalAmarillo, z: "0.0%" });
  setCell(ws, totalRow, 9, tAlertas, { style: S.totalAmarillo, z: FMT_INT });

  // Bloque de alertas
  const alertasRowTitulo = totalRow + 3;
  setCell(ws, alertasRowTitulo, 0, "REFERENCIAS CON VARIACIÓN CRÍTICA (>10%)", { style: S.tituloAlerta });
  merge(ws, alertasRowTitulo, 0, alertasRowTitulo, 6);
  fillRangeStyle(ws, alertasRowTitulo, 0, alertasRowTitulo, 6, S.tituloAlerta);

  const alertasHeaderRow = alertasRowTitulo + 1;
  const headers2 = ["Código", "Nombre", "Familia", "Costo Estándar", "Costo Real (Odoo)", "Diferencia COP", "Variación %"];
  headers2.forEach((h, c) => setCell(ws, alertasHeaderRow, c, h, { style: S.headerPrimario }));

  const alertas = calculados
    .filter((it) => it.ref.costoReal > 0 && it.c.variacion != null && Math.abs(it.c.variacion) > 10)
    .sort((a, b) => Math.abs(b.c.variacion) - Math.abs(a.c.variacion));

  alertas.forEach((it, i) => {
    const r = alertasHeaderRow + 1 + i;
    const baseStyle = i % 2 === 0 ? S.filaImpar : S.filaPar;
    const diferencia = it.c.costoProd - it.ref.costoReal;
    setCell(ws, r, 0, it.ref.id, { style: baseStyle });
    setCell(ws, r, 1, it.ref.nombre, { style: baseStyle });
    setCell(ws, r, 2, it.ref.familia, { style: baseStyle });
    setCell(ws, r, 3, it.c.costoProd, { style: baseStyle, z: FMT_COP });
    setCell(ws, r, 4, it.ref.costoReal, { style: baseStyle, z: FMT_COP });
    setCell(ws, r, 5, diferencia, { style: baseStyle, z: FMT_COP });
    const varStyle = it.c.variacion < 0 ? S.alerta : S.ok;
    setCell(ws, r, 6, it.c.variacion / 100, { style: varStyle, z: FMT_PCT });
  });

  setColWidths(ws, [12, 28, 10, 18, 18, 18, 14]);
  setRange(ws, alertasHeaderRow + alertas.length + 1, 9);
  XLSX.utils.book_append_sheet(wb, ws, "Resumen Ejecutivo");
}

// ---------------------------------------------------------------------------
// Hoja 3: Detalle de Referencias
// ---------------------------------------------------------------------------
function buildDetalle(wb, calculados, periodoLabel) {
  const ws = {};
  const heights = [];

  setCell(ws, 0, 0, "INDUSTRIAS DONSOON", { style: S.titulo });
  merge(ws, 0, 0, 0, 11);
  fillRangeStyle(ws, 0, 0, 0, 11, S.titulo);
  setCell(ws, 1, 0, `Detalle de Referencias — Período: ${periodoLabel || "Todos"}`, { style: S.subtitulo });
  merge(ws, 1, 0, 1, 11);
  fillRangeStyle(ws, 1, 0, 1, 11, S.subtitulo);
  heights[0] = 30;
  heights[1] = 22;

  // Headers nivel 1 (fila 3 -> índice 3, con fila 4 -> índice 4 de nivel 2)
  const lvl1Row = 3;
  const lvl2Row = 4;

  setCell(ws, lvl1Row, 0, "Identificación", { style: S.headerPrimario });
  merge(ws, lvl1Row, 0, lvl1Row, 3);
  setCell(ws, lvl1Row, 4, "Estructura de Costos Unitarios (COP)", { style: S.headerPrimario });
  merge(ws, lvl1Row, 4, lvl1Row, 8);
  setCell(ws, lvl1Row, 9, "Precio", { style: S.headerPrimario });
  setCell(ws, lvl1Row, 10, "Comparativo Odoo", { style: S.headerPrimario });
  merge(ws, lvl1Row, 10, lvl1Row, 11);
  fillRangeStyle(ws, lvl1Row, 0, lvl1Row, 11, S.headerPrimario);

  const headers2 = [
    "Código", "Nombre", "Familia", "Mes", "MPD", "MOD", "CIF",
    "Costo Prod", "Costo Total", "Precio Venta", "Costo Real", "Variación %",
  ];
  headers2.forEach((h, c) => setCell(ws, lvl2Row, c, h, { style: S.headerSecundario }));

  const familiasOrden = ["FA", "FM", "FE"];
  const presentes = [...new Set(calculados.map((c) => c.ref.familia))];
  const familias = [...familiasOrden.filter((f) => presentes.includes(f)), ...presentes.filter((f) => !familiasOrden.includes(f))];

  let r = lvl2Row + 1;
  const moneyCols = [4, 5, 6, 7, 8, 9, 10];

  familias.forEach((fam) => {
    setCell(ws, r, 0, fam, { style: S.separadorFamilia });
    merge(ws, r, 0, r, 11);
    fillRangeStyle(ws, r, 0, r, 11, S.separadorFamilia);
    heights[r] = 14;
    r++;

    const items = calculados.filter((it) => it.ref.familia === fam);
    items.forEach((it, i) => {
      const style = i % 2 === 0 ? S.filaImpar : S.filaPar;
      setCell(ws, r, 0, it.ref.id, { style });
      setCell(ws, r, 1, it.ref.nombre, { style });
      setCell(ws, r, 2, it.ref.familia, { style });
      setCell(ws, r, 3, it.ref.mes, { style });
      setCell(ws, r, 4, it.c.mpd, { style, z: FMT_COP });
      setCell(ws, r, 5, it.c.mod, { style, z: FMT_COP });
      setCell(ws, r, 6, it.c.cif, { style, z: FMT_COP });
      setCell(ws, r, 7, it.c.costoProd, { style, z: FMT_COP });
      setCell(ws, r, 8, it.c.costoTotal, { style, z: FMT_COP });
      setCell(ws, r, 9, it.c.precioVenta, { style, z: FMT_COP });
      setCell(ws, r, 10, it.ref.costoReal || null, { style, z: FMT_COP });

      const vStyle = variacionStyle(it.c.variacion);
      if (it.c.variacion == null) {
        setCell(ws, r, 11, "Sin dato", { style: vStyle });
      } else {
        setCell(ws, r, 11, variacionLabel(it.c.variacion), { style: vStyle });
      }
      heights[r] = 18;
      r++;
    });
  });

  const totalRow = r;
  const n = calculados.length || 1;
  const prom = (fn) => calculados.reduce((s, it) => s + fn(it), 0) / n;

  setCell(ws, totalRow, 0, "TOTALES / PROMEDIOS", { style: S.total });
  merge(ws, totalRow, 0, totalRow, 3);
  fillRangeStyle(ws, totalRow, 0, totalRow, 3, S.total);
  setCell(ws, totalRow, 4, prom((it) => it.c.mpd), { style: S.total, z: FMT_COP });
  setCell(ws, totalRow, 5, prom((it) => it.c.mod), { style: S.total, z: FMT_COP });
  setCell(ws, totalRow, 6, prom((it) => it.c.cif), { style: S.total, z: FMT_COP });
  setCell(ws, totalRow, 7, prom((it) => it.c.costoProd), { style: S.total, z: FMT_COP });
  setCell(ws, totalRow, 8, prom((it) => it.c.costoTotal), { style: S.total, z: FMT_COP });
  setCell(ws, totalRow, 9, prom((it) => it.c.precioVenta), { style: S.total, z: FMT_COP });
  setCell(ws, totalRow, 10, `${calculados.length} refs`, { style: S.total });
  setCell(ws, totalRow, 11, "", { style: S.total });

  setColWidths(ws, [12, 28, 10, 10, 18, 16, 16, 18, 18, 18, 18, 14]);
  setRowHeights(ws, heights);
  setRange(ws, totalRow, 11);
  ws["!freeze"] = { xSplit: 0, ySplit: 5, topLeftCell: "A6", activePane: "bottomLeft", state: "frozen" };
  XLSX.utils.book_append_sheet(wb, ws, "Detalle de Referencias");
}

// ---------------------------------------------------------------------------
// Hoja 4: Consumos por Referencia
// ---------------------------------------------------------------------------
function buildConsumos(wb, calculados) {
  const ws = {};

  setCell(ws, 0, 0, "INDUSTRIAS DONSOON — Consumos de Materiales por Referencia", { style: S.titulo });
  merge(ws, 0, 0, 0, 9);
  fillRangeStyle(ws, 0, 0, 0, 9, S.titulo);

  const headerRow = 2;
  const headers = [
    "Ref. Código", "Ref. Nombre", "Familia", "Material Código", "Material Nombre",
    "Unidad", "Cantidad/Unid", "Costo Unit. (COP)", "Costo Material (COP)", "% del MPD Total",
  ];
  headers.forEach((h, c) => setCell(ws, headerRow, c, h, { style: S.headerPrimario }));

  const ordenados = [...calculados].sort((a, b) => {
    if (a.ref.familia !== b.ref.familia) return a.ref.familia.localeCompare(b.ref.familia);
    return String(a.ref.id).localeCompare(String(b.ref.id));
  });

  let r = headerRow + 1;
  ordenados.forEach((it, idx) => {
    const consumos = [...(it.ref.consumos || [])].sort((a, b) => {
      const nA = a.material?.nombre || "";
      const nB = b.material?.nombre || "";
      return nA.localeCompare(nB);
    });

    const baseFill = idx % 2 === 0 ? "FFFFFF" : "F8FAFC";
    const rowStyle = { fill: { fgColor: { rgb: baseFill } }, alignment: { vertical: "center" }, border: BORDER_THIN };

    consumos.forEach((cons) => {
      const m = cons.material || {};
      const costoMaterial = (m.costo || 0) * (cons.cantidad || 0);
      const pctMpd = it.c.mpd > 0 ? costoMaterial / it.c.mpd : 0;

      setCell(ws, r, 0, it.ref.id, { style: rowStyle });
      setCell(ws, r, 1, it.ref.nombre, { style: rowStyle });
      setCell(ws, r, 2, it.ref.familia, { style: rowStyle });
      setCell(ws, r, 3, m.id, { style: rowStyle });
      setCell(ws, r, 4, m.nombre, { style: rowStyle });
      setCell(ws, r, 5, m.unidad, { style: rowStyle });
      setCell(ws, r, 6, cons.cantidad || 0, { style: rowStyle, z: FMT_NUM2 });
      setCell(ws, r, 7, m.costo || 0, { style: rowStyle, z: FMT_COP });
      setCell(ws, r, 8, costoMaterial, { style: rowStyle, z: FMT_COP });
      setCell(ws, r, 9, pctMpd, { style: rowStyle, z: "0.0%" });
      r++;
    });

    setCell(ws, r, 0, `TOTAL MPD — ${it.ref.id}`, { style: S.separadorFamilia });
    merge(ws, r, 0, r, 4);
    fillRangeStyle(ws, r, 0, r, 4, S.separadorFamilia);
    setCell(ws, r, 8, it.c.mpd, { style: S.separadorFamilia, z: FMT_COP });
    r++;
  });

  setColWidths(ws, [12, 28, 10, 14, 28, 12, 14, 18, 18, 16]);
  setRange(ws, r - 1, 9);
  XLSX.utils.book_append_sheet(wb, ws, "Consumos por Referencia");
}

// ---------------------------------------------------------------------------
// Función principal
// ---------------------------------------------------------------------------
export function exportarExcel(referencias, parametros, periodoLabel) {
  const calculados = referencias.map((ref) => ({ ref, c: calcCostos(ref, parametros) }));

  const totalRefs = calculados.length || 1;
  const costoProdProm = calculados.reduce((s, it) => s + it.c.costoProd, 0) / totalRefs;
  const precioVentaProm = calculados.reduce((s, it) => s + it.c.precioVenta, 0) / totalRefs;
  const totalAlertas = calculados.filter((it) => it.c.variacion != null && Math.abs(it.c.variacion) > 10).length;

  const wb = XLSX.utils.book_new();

  buildPortada(wb, referencias, parametros, periodoLabel, {
    totalRefs: calculados.length,
    costoProdProm,
    precioVentaProm,
    totalAlertas,
  });
  buildResumenEjecutivo(wb, calculados);
  buildDetalle(wb, calculados, periodoLabel);
  buildConsumos(wb, calculados);

  const safeLabel = (periodoLabel || "Todos").replace(/\s+/g, "_");
  const fecha = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `Donsoon_Costos_${safeLabel}_${fecha}.xlsx`);
}
