import * as XLSX from "xlsx";
import { calcCostos } from "./api.js";

const FMT_COP = '"$"#,##0';
const FMT_PCT = "0.0%";

function aoaToSheet(rows) {
  return XLSX.utils.aoa_to_sheet(rows);
}

function setColWidths(ws, widths) {
  ws["!cols"] = widths.map((w) => ({ wch: w }));
}

function applyCellStyle(ws, addr, style) {
  if (!ws[addr]) ws[addr] = { t: "z" };
  ws[addr].s = { ...(ws[addr].s || {}), ...style };
}

const HEADER_STYLE = {
  fill: { fgColor: { rgb: "1F3864" } },
  font: { color: { rgb: "FFFFFF" }, bold: true },
  alignment: { horizontal: "center", vertical: "center" },
};

const TOTAL_STYLE = {
  fill: { fgColor: { rgb: "FEF3C7" } },
  font: { bold: true },
};

const THIN_BORDER = {
  top: { style: "thin", color: { rgb: "CBD5E1" } },
  bottom: { style: "thin", color: { rgb: "CBD5E1" } },
  left: { style: "thin", color: { rgb: "CBD5E1" } },
  right: { style: "thin", color: { rgb: "CBD5E1" } },
};

function colLetter(n) {
  return XLSX.utils.encode_col(n);
}

export function exportarExcel(referencias, parametros, filtroLabel) {
  const wb = XLSX.utils.book_new();

  // ---------- Hoja 1: Resumen de Costos ----------
  const headers = [
    "Referencia",
    "Nombre",
    "MPD",
    "MOD",
    "CIF",
    "Costo Producción",
    "Costo Total",
    "Precio Venta",
    "Margen Bruto",
    "Variación %",
  ];

  const filas = referencias.map((r) => {
    const c = calcCostos(r, parametros);
    return [r.id, r.nombre, c.mpd, c.mod, c.cif, c.costoProd, c.costoTotal, c.precioVenta, c.margenBruto, c.variacion != null ? c.variacion / 100 : null];
  });

  const n = filas.length;
  const promedio = (idx) => (n === 0 ? 0 : filas.reduce((s, f) => s + (f[idx] || 0), 0) / n);

  const filaTotales = [
    "PROMEDIO",
    "",
    promedio(2),
    promedio(3),
    promedio(4),
    promedio(5),
    promedio(6),
    promedio(7),
    promedio(8),
    null,
  ];

  const aoa = [
    ["INDUSTRIAS DONSOON — Resumen de Costos", "", "", "", "", "", "", "", "", ""],
    [`Período: ${filtroLabel || "Todos"}`, "", "", "", "", "", "", "", "", ""],
    [],
    headers,
    ...filas,
    filaTotales,
  ];

  const ws1 = aoaToSheet(aoa);
  ws1["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 9 } }];

  const headerRow = 3; // 0-indexed row 4
  for (let c = 0; c < headers.length; c++) {
    applyCellStyle(ws1, `${colLetter(c)}${headerRow + 1}`, HEADER_STYLE);
  }

  const moneyCols = [2, 3, 4, 5, 6, 7, 8];
  const pctCol = 9;
  const dataStart = headerRow + 1; // row index after header (0-indexed)
  for (let r = 0; r < filas.length; r++) {
    const rowIdx = dataStart + r;
    const bg = r % 2 === 0 ? "FFFFFF" : "F1F5F9";
    for (let c = 0; c < headers.length; c++) {
      const addr = `${colLetter(c)}${rowIdx + 1}`;
      const style = { fill: { fgColor: { rgb: bg } }, border: THIN_BORDER };
      if (moneyCols.includes(c) && ws1[addr]) ws1[addr].z = FMT_COP;
      if (c === pctCol && ws1[addr]) ws1[addr].z = FMT_PCT;
      applyCellStyle(ws1, addr, style);
    }
  }

  const totalRowIdx = dataStart + filas.length;
  for (let c = 0; c < headers.length; c++) {
    const addr = `${colLetter(c)}${totalRowIdx + 1}`;
    if (moneyCols.includes(c) && ws1[addr]) ws1[addr].z = FMT_COP;
    applyCellStyle(ws1, addr, TOTAL_STYLE);
  }

  setColWidths(ws1, [12, 25, 18, 18, 18, 18, 18, 18, 18, 14]);
  XLSX.utils.book_append_sheet(wb, ws1, "Resumen de Costos");

  // ---------- Hoja 2: Materiales ----------
  const materialesMap = new Map();
  for (const r of referencias) {
    for (const c of r.consumos || []) {
      const m = c.material;
      if (m && !materialesMap.has(m.id)) materialesMap.set(m.id, m);
    }
  }
  const matHeaders = ["Código", "Material", "Unidad", "Costo Unit.", "Proveedor"];
  const matRows = [...materialesMap.values()].map((m) => [m.id, m.nombre, m.unidad, m.costo, m.proveedor || ""]);
  const ws2 = aoaToSheet([matHeaders, ...matRows]);
  for (let c = 0; c < matHeaders.length; c++) {
    applyCellStyle(ws2, `${colLetter(c)}1`, HEADER_STYLE);
  }
  for (let r = 0; r < matRows.length; r++) {
    const addr = `${colLetter(3)}${r + 2}`;
    if (ws2[addr]) ws2[addr].z = FMT_COP;
  }
  setColWidths(ws2, [12, 25, 12, 14, 18]);
  XLSX.utils.book_append_sheet(wb, ws2, "Materiales");

  // ---------- Hoja 3: Parámetros ----------
  const paramRows = [
    ["Parámetro", "Valor", "Unidad"],
    ["Tarifa MOD", parametros.tarifaMOD, "$/hora"],
    ["Tarifa CIF", parametros.tarifaCIF, "$/hora"],
    ["% GAV", parametros.pctGAV, "%"],
    ["% Margen", parametros.pctMargen, "%"],
  ];
  const ws3 = aoaToSheet(paramRows);
  for (let c = 0; c < 3; c++) {
    applyCellStyle(ws3, `${colLetter(c)}1`, HEADER_STYLE);
  }
  setColWidths(ws3, [18, 14, 12]);
  XLSX.utils.book_append_sheet(wb, ws3, "Parámetros");

  const fecha = new Date();
  const ym = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}`;
  XLSX.writeFile(wb, `Donsoon_Costos_${ym}.xlsx`);
}
