import * as XLSX from "xlsx";
import { calcCostos, mesLabel } from "./api.js";

// ---------------------------------------------------------------------------
// Colores y estilos
// ---------------------------------------------------------------------------
const COL = {
  azulO: "1F3864", azulM: "2E75B6", azulC: "D6E4F0", verdeO: "065F46",
  verdeC: "D1FAE5", amber: "92400E", amberF: "FEF3C7", rojo: "991B1B",
  rojoF: "FEE2E2", morado: "7C3AED", gris: "F1F5F9", blanco: "FFFFFF", muted: "9CA3AF",
};

const bd = (c = "D1D5DB") => ({
  top: { style: "thin", color: { rgb: c } },
  bottom: { style: "thin", color: { rgb: c } },
  left: { style: "thin", color: { rgb: c } },
  right: { style: "thin", color: { rgb: c } },
});

const S = {
  titulo: { font: { bold: true, color: { rgb: COL.blanco }, sz: 28 }, fill: { fgColor: { rgb: COL.azulO } }, alignment: { horizontal: "center", vertical: "center" } },
  subtitulo: { font: { color: { rgb: COL.blanco }, sz: 16 }, fill: { fgColor: { rgb: COL.azulM } }, alignment: { horizontal: "center", vertical: "center" } },
  meta: { font: { bold: true, color: { rgb: COL.azulO }, sz: 12 }, fill: { fgColor: { rgb: COL.azulC } }, alignment: { horizontal: "center", vertical: "center" } },
  metaSub: { font: { color: { rgb: "6B7280" }, sz: 10 }, fill: { fgColor: { rgb: COL.blanco } }, alignment: { horizontal: "center", vertical: "center" } },
  hPri: { font: { bold: true, color: { rgb: COL.blanco }, sz: 11 }, fill: { fgColor: { rgb: COL.azulO } }, alignment: { horizontal: "center", vertical: "center", wrapText: true }, border: bd() },
  hSec: { font: { bold: true, color: { rgb: COL.blanco }, sz: 10 }, fill: { fgColor: { rgb: COL.azulM } }, alignment: { horizontal: "center", vertical: "center", wrapText: true }, border: bd() },
  par: { fill: { fgColor: { rgb: COL.gris } }, alignment: { vertical: "center" }, border: bd() },
  impar: { fill: { fgColor: { rgb: COL.blanco } }, alignment: { vertical: "center" }, border: bd() },
  total: { font: { bold: true, color: { rgb: COL.blanco } }, fill: { fgColor: { rgb: COL.azulO } }, border: bd() },
  amberTot: { font: { bold: true, color: { rgb: COL.azulO } }, fill: { fgColor: { rgb: COL.amberF } }, border: bd() },
  alerta: { font: { bold: true, color: { rgb: COL.rojo } }, fill: { fgColor: { rgb: COL.rojoF } }, border: bd() },
  amber: { font: { color: { rgb: COL.amber } }, fill: { fgColor: { rgb: COL.amberF } }, border: bd() },
  ok: { font: { color: { rgb: COL.verdeO } }, fill: { fgColor: { rgb: COL.verdeC } }, border: bd() },
  muted: { font: { italic: true, color: { rgb: COL.muted } }, border: bd() },
  sep: { font: { bold: true, color: { rgb: COL.azulO }, sz: 10 }, fill: { fgColor: { rgb: COL.azulC } }, border: bd() },
  tituloSeccion: { font: { bold: true, color: { rgb: COL.blanco }, sz: 13 }, fill: { fgColor: { rgb: COL.azulO } }, alignment: { horizontal: "center", vertical: "center" } },
  kpiNum: (fill) => ({ font: { bold: true, color: { rgb: COL.blanco }, sz: 20 }, fill: { fgColor: { rgb: fill } }, alignment: { horizontal: "center", vertical: "center" } }),
  kpiLabel: (fill) => ({ font: { color: { rgb: COL.blanco }, sz: 9 }, fill: { fgColor: { rgb: fill } }, alignment: { horizontal: "center", vertical: "center" } }),
};

const FMT = { cop: '"$"#,##0', pct: "0.0%", hrs: '0.00" h"', int: "#,##0", num3: "0.000" };

// ---------------------------------------------------------------------------
// Helpers de hoja
// ---------------------------------------------------------------------------
function addr(c, r) {
  return XLSX.utils.encode_cell({ c, r });
}

function cell(ws, c, r, value, type, style, fmt) {
  const o = { v: value, t: type };
  if (style) o.s = style;
  if (fmt) o.z = fmt;
  ws[addr(c, r)] = o;
  return o;
}

function merge(ws, c1, r1, c2, r2) {
  if (!ws["!merges"]) ws["!merges"] = [];
  ws["!merges"].push({ s: { c: c1, r: r1 }, e: { c: c2, r: r2 } });
}

function fillRange(ws, c1, r1, c2, r2, style) {
  for (let r = r1; r <= r2; r++) {
    for (let c = c1; c <= c2; c++) {
      const a = addr(c, r);
      if (!ws[a]) ws[a] = { t: "z" };
      ws[a].s = { ...(ws[a].s || {}), ...style };
    }
  }
}

function setRow(ws, r, hpt) {
  if (!ws["!rows"]) ws["!rows"] = [];
  ws["!rows"][r] = { hpt };
}

function setCols(ws, widths) {
  ws["!cols"] = widths.map((w) => ({ wch: w }));
}

function setRange(ws, maxC, maxR) {
  ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: maxR, c: maxC } });
}

function avg(arr, fn) {
  if (!arr.length) return 0;
  return arr.reduce((s, it) => s + fn(it), 0) / arr.length;
}

function variacionStyle(variacion, costoReal) {
  if (!costoReal || costoReal <= 0 || variacion == null) return S.muted;
  const abs = Math.abs(variacion);
  if (abs <= 5) return S.ok;
  if (abs <= 10) return S.amber;
  return S.alerta;
}

function ordenFamilias(calc) {
  const orden = ["FA", "FM", "FE"];
  const presentes = [...new Set(calc.map((it) => it.ref.familia))];
  return [...orden.filter((f) => presentes.includes(f)), ...presentes.filter((f) => !orden.includes(f))];
}

const NOMBRE_FAMILIA = {
  FA: "Filtros Aire (FA)",
  FM: "Filtros Mula (FM)",
  FE: "Filtros Especiales (FE)",
};

// ---------------------------------------------------------------------------
// Hoja 1: Portada
// ---------------------------------------------------------------------------
function buildPortada(wb, refs, calc, params, periodo) {
  const ws = {};

  cell(ws, 0, 1, "INDUSTRIAS DONSOON", "s", S.titulo);
  merge(ws, 0, 1, 7, 2);
  fillRange(ws, 0, 1, 7, 2, S.titulo);
  setRow(ws, 1, 36);

  cell(ws, 0, 3, "Reporte de Costos de Producción", "s", S.subtitulo);
  merge(ws, 0, 3, 7, 4);
  fillRange(ws, 0, 3, 7, 4, S.subtitulo);
  setRow(ws, 3, 28);

  cell(ws, 0, 5, `Período: ${periodo || "Todos"}`, "s", S.meta);
  merge(ws, 0, 5, 7, 5);

  const f = new Date();
  const fechaStr = `${String(f.getDate()).padStart(2, "0")}/${String(f.getMonth() + 1).padStart(2, "0")}/${f.getFullYear()} ${String(f.getHours()).padStart(2, "0")}:${String(f.getMinutes()).padStart(2, "0")}`;
  cell(ws, 0, 6, `Generado: ${fechaStr}`, "s", S.metaSub);
  merge(ws, 0, 6, 7, 6);
  setRow(ws, 7, 16);

  const totalAlertas = calc.filter((it) => it.ref.costoReal > 0 && Math.abs(it.variacion) > 10).length;
  const kpis = [
    { valor: refs.length, label: "Total Referencias", fill: COL.azulO, fmt: FMT.int },
    { valor: avg(calc, (it) => it.costoProd), label: "Costo Prod. Promedio", fill: COL.verdeO, fmt: FMT.cop },
    { valor: avg(calc, (it) => it.precioVenta), label: "Precio Venta Promedio", fill: COL.azulM, fmt: FMT.cop },
    { valor: totalAlertas, label: "Alertas Críticas", fill: COL.rojo, fmt: FMT.int },
  ];

  kpis.forEach((k, i) => {
    const c1 = i * 2;
    const c2 = c1 + 1;
    cell(ws, c1, 8, k.valor, "n", S.kpiNum(k.fill), k.fmt);
    merge(ws, c1, 8, c2, 8);
    fillRange(ws, c1, 8, c2, 8, { fill: { fgColor: { rgb: k.fill } } });

    cell(ws, c1, 9, k.label, "s", S.kpiLabel(k.fill));
    merge(ws, c1, 9, c2, 9);
    fillRange(ws, c1, 9, c2, 9, { fill: { fgColor: { rgb: k.fill } } });
  });
  setRow(ws, 8, 40);
  setRow(ws, 9, 18);

  cell(ws, 0, 11, "PARÁMETROS DEL SISTEMA", "s", S.hPri);
  merge(ws, 0, 11, 3, 11);
  fillRange(ws, 0, 11, 3, 11, S.hPri);
  setRow(ws, 11, 20);

  ["Parámetro", "Valor", "Unidad"].forEach((h, c) => cell(ws, c, 12, h, "s", S.hSec));

  const paramRows = [
    ["Tarifa MOD", params.tarifaMOD, "COP / hora", FMT.cop],
    ["Tarifa CIF", params.tarifaCIF, "COP / hora-máq.", FMT.cop],
    ["Gastos Adm. y Ventas", params.pctGAV / 100, "% s/costo", FMT.pct],
    ["Margen de Utilidad", params.pctMargen / 100, "% s/total", FMT.pct],
  ];

  paramRows.forEach((row, i) => {
    const r = 13 + i;
    const style = i % 2 === 0 ? S.impar : S.par;
    cell(ws, 0, r, row[0], "s", style);
    cell(ws, 1, r, row[1], "n", style, row[3]);
    cell(ws, 2, r, row[2], "s", style);
  });

  setCols(ws, [32, 20, 20, 14, 14, 14, 14, 14]);
  setRange(ws, 7, 16);
  XLSX.utils.book_append_sheet(wb, ws, "🏢 Portada");
}

// ---------------------------------------------------------------------------
// Hoja 2: Resumen Ejecutivo
// ---------------------------------------------------------------------------
function buildResumen(wb, refs, calc) {
  const ws = {};

  cell(ws, 0, 1, "ANÁLISIS POR FAMILIA DE PRODUCTO", "s", S.hPri);
  merge(ws, 0, 1, 9, 1);
  fillRange(ws, 0, 1, 9, 1, S.hPri);
  setRow(ws, 1, 22);

  const headers1 = ["Familia", "Refs", "MPD Prom.", "MOD Prom.", "CIF Prom.", "Costo Prod.", "Costo Total", "Precio Venta", "Margen Bruto", "% Materiales"];
  headers1.forEach((h, c) => cell(ws, c, 2, h, "s", S.hSec));
  setRow(ws, 2, 30);

  const fillFamilia = { FA: COL.azulC, FM: COL.verdeC, FE: COL.amberF };
  const familias = ordenFamilias(calc);

  familias.forEach((fam, i) => {
    const r = 3 + i;
    const items = calc.filter((it) => it.ref.familia === fam);
    const mpdProm = avg(items, (it) => it.mpd);
    const modProm = avg(items, (it) => it.mod);
    const cifProm = avg(items, (it) => it.cif);
    const costoProdProm = avg(items, (it) => it.costoProd);
    const costoTotalProm = avg(items, (it) => it.costoTotal);
    const precioVentaProm = avg(items, (it) => it.precioVenta);
    const margenProm = avg(items, (it) => it.margenBruto);
    const pctMateriales = costoProdProm > 0 ? mpdProm / costoProdProm : 0;
    const style = { fill: { fgColor: { rgb: fillFamilia[fam] || COL.gris } }, alignment: { vertical: "center" }, border: bd() };

    cell(ws, 0, r, NOMBRE_FAMILIA[fam] || fam, "s", style);
    cell(ws, 1, r, items.length, "n", style, FMT.int);
    cell(ws, 2, r, mpdProm, "n", style, FMT.cop);
    cell(ws, 3, r, modProm, "n", style, FMT.cop);
    cell(ws, 4, r, cifProm, "n", style, FMT.cop);
    cell(ws, 5, r, costoProdProm, "n", style, FMT.cop);
    cell(ws, 6, r, costoTotalProm, "n", style, FMT.cop);
    cell(ws, 7, r, precioVentaProm, "n", style, FMT.cop);
    cell(ws, 8, r, margenProm, "n", style, FMT.cop);
    cell(ws, 9, r, pctMateriales, "n", style, FMT.pct);
  });

  const totalRow = 3 + familias.length;
  const mpdTot = avg(calc, (it) => it.mpd);
  const costoProdTot = avg(calc, (it) => it.costoProd);
  cell(ws, 0, totalRow, "TOTALES / PROMEDIOS", "s", S.amberTot);
  cell(ws, 1, totalRow, calc.length, "n", S.amberTot, FMT.int);
  cell(ws, 2, totalRow, mpdTot, "n", S.amberTot, FMT.cop);
  cell(ws, 3, totalRow, avg(calc, (it) => it.mod), "n", S.amberTot, FMT.cop);
  cell(ws, 4, totalRow, avg(calc, (it) => it.cif), "n", S.amberTot, FMT.cop);
  cell(ws, 5, totalRow, costoProdTot, "n", S.amberTot, FMT.cop);
  cell(ws, 6, totalRow, avg(calc, (it) => it.costoTotal), "n", S.amberTot, FMT.cop);
  cell(ws, 7, totalRow, avg(calc, (it) => it.precioVenta), "n", S.amberTot, FMT.cop);
  cell(ws, 8, totalRow, avg(calc, (it) => it.margenBruto), "n", S.amberTot, FMT.cop);
  cell(ws, 9, totalRow, costoProdTot > 0 ? mpdTot / costoProdTot : 0, "n", S.amberTot, FMT.pct);

  // Top 5 mayor costo de producción
  const topTitleRow = totalRow + 2;
  cell(ws, 0, topTitleRow, "TOP 5 — MAYOR COSTO DE PRODUCCIÓN", "s", S.hPri);
  merge(ws, 0, topTitleRow, 5, topTitleRow);
  fillRange(ws, 0, topTitleRow, 5, topTitleRow, S.hPri);

  const topHeaderRow = topTitleRow + 1;
  ["Código", "Nombre", "Familia", "Costo Prod.", "Precio Venta", "Margen Bruto"].forEach((h, c) => cell(ws, c, topHeaderRow, h, "s", S.hSec));

  const top5 = [...calc].sort((a, b) => b.costoProd - a.costoProd).slice(0, 5);
  top5.forEach((it, i) => {
    const r = topHeaderRow + 1 + i;
    const style = i % 2 === 0 ? S.impar : S.par;
    cell(ws, 0, r, it.ref.id, "s", style);
    cell(ws, 1, r, it.ref.nombre, "s", style);
    cell(ws, 2, r, it.ref.familia, "s", style);
    cell(ws, 3, r, it.costoProd, "n", style, FMT.cop);
    cell(ws, 4, r, it.precioVenta, "n", style, FMT.cop);
    cell(ws, 5, r, it.margenBruto, "n", style, FMT.cop);
  });

  // Comparativo Odoo
  const cmpTitleRow = topHeaderRow + top5.length + 2;
  cell(ws, 0, cmpTitleRow, "COMPARATIVO ODOO", "s", S.hPri);
  merge(ws, 0, cmpTitleRow, 6, cmpTitleRow);
  fillRange(ws, 0, cmpTitleRow, 6, cmpTitleRow, S.hPri);

  const cmpHeaderRow = cmpTitleRow + 1;
  ["Código", "Nombre", "Familia", "Costo Estándar", "Costo Real", "Diferencia", "Variación %"].forEach((h, c) => cell(ws, c, cmpHeaderRow, h, "s", S.hSec));

  const cmpItems = calc
    .filter((it) => it.ref.costoReal > 0)
    .sort((a, b) => Math.abs(b.variacion) - Math.abs(a.variacion));

  cmpItems.forEach((it, i) => {
    const r = cmpHeaderRow + 1 + i;
    const baseStyle = i % 2 === 0 ? S.impar : S.par;
    const diferencia = it.costoProd - it.ref.costoReal;
    cell(ws, 0, r, it.ref.id, "s", baseStyle);
    cell(ws, 1, r, it.ref.nombre, "s", baseStyle);
    cell(ws, 2, r, it.ref.familia, "s", baseStyle);
    cell(ws, 3, r, it.costoProd, "n", baseStyle, FMT.cop);
    cell(ws, 4, r, it.ref.costoReal, "n", baseStyle, FMT.cop);
    cell(ws, 5, r, diferencia, "n", baseStyle, FMT.cop);
    cell(ws, 6, r, it.variacion / 100, "n", variacionStyle(it.variacion, it.ref.costoReal), FMT.pct);
  });

  const lastRow = cmpHeaderRow + cmpItems.length;
  setCols(ws, [12, 28, 10, 18, 18, 18, 18, 18, 18, 14]);
  setRange(ws, 9, lastRow);
  ws["!freeze"] = { xSplit: 0, ySplit: 3, topLeftCell: "A4", activePane: "bottomLeft", state: "frozen" };
  XLSX.utils.book_append_sheet(wb, ws, "📊 Resumen Ejecutivo");
}

// ---------------------------------------------------------------------------
// Hoja 3: Detalle de Referencias
// ---------------------------------------------------------------------------
function buildDetalle(wb, refs, calc, periodo) {
  const ws = {};

  cell(ws, 0, 0, "DETALLE DE COSTOS — TODAS LAS REFERENCIAS", "s", S.hPri);
  merge(ws, 0, 0, 11, 0);
  fillRange(ws, 0, 0, 11, 0, S.hPri);
  setRow(ws, 0, 24);

  cell(ws, 0, 1, `Período: ${periodo || "Todos"} | ${refs.length} referencias`, "s", S.meta);
  merge(ws, 0, 1, 11, 1);

  const grupos = [
    { label: "IDENTIFICACIÓN", c1: 0, c2: 3, fill: COL.azulO },
    { label: "ESTRUCTURA DE COSTO (COP)", c1: 4, c2: 6, fill: COL.azulM },
    { label: "PRECIO Y RENTABILIDAD", c1: 7, c2: 9, fill: COL.verdeO },
    { label: "COMPARATIVO ODOO", c1: 10, c2: 11, fill: COL.morado },
  ];
  grupos.forEach((g) => {
    const style = { font: { bold: true, color: { rgb: COL.blanco }, sz: 11 }, fill: { fgColor: { rgb: g.fill } }, alignment: { horizontal: "center", vertical: "center" }, border: bd() };
    cell(ws, g.c1, 2, g.label, "s", style);
    merge(ws, g.c1, 2, g.c2, 2);
    fillRange(ws, g.c1, 2, g.c2, 2, style);
  });

  const headers2 = ["Código", "Nombre", "Familia", "Mes", "MPD", "MOD", "CIF", "Costo Prod.", "Costo Total", "Precio Venta", "Costo Real", "Variación %"];
  headers2.forEach((h, c) => cell(ws, c, 3, h, "s", S.hSec));
  setRow(ws, 3, 28);

  const familias = ordenFamilias(calc);
  let r = 4;

  familias.forEach((fam) => {
    cell(ws, 0, r, `── FAMILIA: ${NOMBRE_FAMILIA[fam] || fam} ──`, "s", S.sep);
    merge(ws, 0, r, 11, r);
    fillRange(ws, 0, r, 11, r, S.sep);
    setRow(ws, r, 16);
    r++;

    const items = calc.filter((it) => it.ref.familia === fam);
    items.forEach((it, i) => {
      const style = i % 2 === 0 ? S.impar : S.par;
      cell(ws, 0, r, it.ref.id, "s", style);
      cell(ws, 1, r, it.ref.nombre, "s", style);
      cell(ws, 2, r, it.ref.familia, "s", style);
      cell(ws, 3, r, mesLabel(it.ref.mes), "s", style);
      cell(ws, 4, r, it.mpd, "n", style, FMT.cop);
      cell(ws, 5, r, it.mod, "n", style, FMT.cop);
      cell(ws, 6, r, it.cif, "n", style, FMT.cop);
      cell(ws, 7, r, it.costoProd, "n", style, FMT.cop);
      cell(ws, 8, r, it.costoTotal, "n", style, FMT.cop);
      cell(ws, 9, r, it.precioVenta, "n", style, FMT.cop);

      if (it.ref.costoReal > 0) {
        cell(ws, 10, r, it.ref.costoReal, "n", style, FMT.cop);
        cell(ws, 11, r, it.variacion / 100, "n", variacionStyle(it.variacion, it.ref.costoReal), FMT.pct);
      } else {
        cell(ws, 10, r, "-", "s", S.muted);
        cell(ws, 11, r, "Sin dato", "s", S.muted);
      }
      r++;
    });
  });

  const totalRow = r;
  cell(ws, 0, totalRow, `PROMEDIOS GENERALES (${calc.length} refs)`, "s", S.total);
  merge(ws, 0, totalRow, 3, totalRow);
  fillRange(ws, 0, totalRow, 3, totalRow, S.total);
  cell(ws, 4, totalRow, avg(calc, (it) => it.mpd), "n", S.total, FMT.cop);
  cell(ws, 5, totalRow, avg(calc, (it) => it.mod), "n", S.total, FMT.cop);
  cell(ws, 6, totalRow, avg(calc, (it) => it.cif), "n", S.total, FMT.cop);
  cell(ws, 7, totalRow, avg(calc, (it) => it.costoProd), "n", S.total, FMT.cop);
  cell(ws, 8, totalRow, avg(calc, (it) => it.costoTotal), "n", S.total, FMT.cop);
  cell(ws, 9, totalRow, avg(calc, (it) => it.precioVenta), "n", S.total, FMT.cop);

  const conReal = calc.filter((it) => it.ref.costoReal > 0);
  cell(ws, 10, totalRow, "", "s", S.total);
  if (conReal.length) {
    cell(ws, 11, totalRow, avg(conReal, (it) => it.variacion) / 100, "n", S.total, FMT.pct);
  } else {
    cell(ws, 11, totalRow, "Sin dato", "s", S.total);
  }

  setCols(ws, [12, 26, 10, 10, 18, 16, 16, 18, 18, 18, 18, 14]);
  setRange(ws, 11, totalRow);
  ws["!freeze"] = { xSplit: 2, ySplit: 4, topLeftCell: "C5", activePane: "bottomRight", state: "frozen" };
  XLSX.utils.book_append_sheet(wb, ws, "📋 Detalle de Referencias");
}

// ---------------------------------------------------------------------------
// Hoja 4: Materiales
// ---------------------------------------------------------------------------
function buildMateriales(wb, refs, calc) {
  const ws = {};

  cell(ws, 0, 0, "MAESTRO DE MATERIALES Y CONSUMOS", "s", S.hPri);
  merge(ws, 0, 0, 9, 0);
  fillRange(ws, 0, 0, 9, 0, S.hPri);
  setRow(ws, 0, 22);

  // Sección A: materiales únicos
  const matMap = new Map();
  calc.forEach((it) => {
    (it.ref.consumos || []).forEach((cons) => {
      const m = cons.material;
      if (!m) return;
      if (!matMap.has(m.id)) {
        matMap.set(m.id, { id: m.id, nombre: m.nombre, unidad: m.unidad, costo: m.costo, refs: new Set(), cantidades: [] });
      }
      const entry = matMap.get(m.id);
      entry.refs.add(it.ref.id);
      entry.cantidades.push(cons.cantidad || 0);
    });
  });
  const materiales = [...matMap.values()].sort((a, b) => String(a.id).localeCompare(String(b.id)));

  ["Código", "Nombre", "Unidad", "Costo Unit.", "En N Refs", "Consumo Prom/Unid"].forEach((h, c) => cell(ws, c, 2, h, "s", S.hSec));

  materiales.forEach((m, i) => {
    const r = 3 + i;
    const style = i % 2 === 0 ? S.impar : S.par;
    const cantProm = m.cantidades.length ? m.cantidades.reduce((s, v) => s + v, 0) / m.cantidades.length : 0;
    cell(ws, 0, r, m.id, "s", style);
    cell(ws, 1, r, m.nombre, "s", style);
    cell(ws, 2, r, m.unidad, "s", style);
    cell(ws, 3, r, m.costo, "n", style, FMT.cop);
    cell(ws, 4, r, m.refs.size, "n", style, FMT.int);
    cell(ws, 5, r, cantProm, "n", style, FMT.num3);
  });

  // Sección B: consumos detallados
  const nMatRow = 3 + materiales.length;
  const titleRow = nMatRow + 2;
  cell(ws, 0, titleRow, "CONSUMOS DETALLADOS POR REFERENCIA", "s", S.hPri);
  merge(ws, 0, titleRow, 9, titleRow);
  fillRange(ws, 0, titleRow, 9, titleRow, S.hPri);

  const headerRow = titleRow + 1;
  ["Ref.Código", "Ref.Nombre", "Familia", "Mat.Código", "Material", "Unidad", "Cant./Unid", "Costo Unit.", "Costo Material", "% del MPD"].forEach((h, c) => cell(ws, c, headerRow, h, "s", S.hSec));
  setRow(ws, headerRow, 28);

  const ordenadas = [...calc].sort((a, b) => {
    if (a.ref.familia !== b.ref.familia) return a.ref.familia.localeCompare(b.ref.familia);
    return String(a.ref.id).localeCompare(String(b.ref.id));
  });

  let r = headerRow + 1;
  ordenadas.forEach((it, idx) => {
    const consumos = [...(it.ref.consumos || [])].sort((a, b) => {
      const idA = a.material?.id ?? "";
      const idB = b.material?.id ?? "";
      return String(idA).localeCompare(String(idB));
    });
    const fillColor = idx % 2 === 0 ? COL.blanco : "F8FAFC";
    const rowStyle = { fill: { fgColor: { rgb: fillColor } }, alignment: { vertical: "center" }, border: bd() };

    consumos.forEach((cons) => {
      const m = cons.material || {};
      const costoMaterial = (m.costo || 0) * (cons.cantidad || 0);
      const pctMpd = it.mpd > 0 ? costoMaterial / it.mpd : 0;

      cell(ws, 0, r, it.ref.id, "s", rowStyle);
      cell(ws, 1, r, it.ref.nombre, "s", rowStyle);
      cell(ws, 2, r, it.ref.familia, "s", rowStyle);
      cell(ws, 3, r, m.id, "s", rowStyle);
      cell(ws, 4, r, m.nombre, "s", rowStyle);
      cell(ws, 5, r, m.unidad, "s", rowStyle);
      cell(ws, 6, r, cons.cantidad || 0, "n", rowStyle, FMT.num3);
      cell(ws, 7, r, m.costo || 0, "n", rowStyle, FMT.cop);
      cell(ws, 8, r, costoMaterial, "n", rowStyle, FMT.cop);
      cell(ws, 9, r, pctMpd, "n", rowStyle, FMT.pct);
      r++;
    });

    cell(ws, 0, r, `Subtotal MPD — ${it.ref.id}`, "s", S.sep);
    merge(ws, 0, r, 5, r);
    fillRange(ws, 0, r, 5, r, S.sep);
    cell(ws, 8, r, it.mpd, "n", S.sep, FMT.cop);
    cell(ws, 9, r, 1, "n", S.sep, FMT.pct);
    r++;
  });

  setCols(ws, [12, 26, 10, 12, 24, 10, 12, 16, 18, 12]);
  setRange(ws, 9, r - 1);
  XLSX.utils.book_append_sheet(wb, ws, "🔩 Materiales");
}

// ---------------------------------------------------------------------------
// Función principal
// ---------------------------------------------------------------------------
export function exportarExcel(referencias, parametros, periodoLabel) {
  const calc = referencias.map((r) => ({ ref: r, ...calcCostos(r, parametros) }));
  const wb = XLSX.utils.book_new();
  wb.Workbook = { Sheets: [{}, {}, {}, {}] };

  buildPortada(wb, referencias, calc, parametros, periodoLabel);
  buildResumen(wb, referencias, calc);
  buildDetalle(wb, referencias, calc, periodoLabel);
  buildMateriales(wb, referencias, calc);

  wb.Workbook.Sheets[0].TabColor = { rgb: "1F3864" };
  wb.Workbook.Sheets[1].TabColor = { rgb: "2E75B6" };
  wb.Workbook.Sheets[2].TabColor = { rgb: "065F46" };
  wb.Workbook.Sheets[3].TabColor = { rgb: "7C3AED" };

  const nombre = `Donsoon_Costos_${(periodoLabel || "Todos").replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, nombre);
}
