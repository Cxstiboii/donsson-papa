import ExcelJS from 'exceljs'
import { calcCostos } from './utils/costos.js'

// Paleta — extraída visualmente del Excel original Donsoon
const C = {
  azulO:   "FF1F3864",  // headers principales
  azulM:   "FF2E75B6",  // headers secundarios, códigos
  azulC:   "FFD6E4F0",  // fondo filas % y separadores
  azulXC:  "FFEBF3FB",  // filas alternas pares
  azulB:   "FFBDD7EE",  // color de bordes
  verde:   "FF1A5C38",  // variación OK
  verdeF:  "FFD1FAE5",
  amber:   "FF92400E",
  amberF:  "FFFEF3C7",
  rojo:    "FF7B0000",  // variación crítica
  rojoF:   "FFFEE2E2",
  blanco:  "FFFFFFFF",
  grisT:   "FF595959",  // texto secundario
  gris:    "FFF2F2F2",
}

const FMT = {
  cop:  '"$"#,##0;[Red]-"$"#,##0;"-"',
  pct:  '0.0%',
  dec3: '0.000',
  int:  '#,##0',
  hrs:  '0.00" h"',
}

// Border estándar del Excel Donsoon
const bd = () => ({
  top:    { style: "thin", color: { argb: C.azulB } },
  bottom: { style: "thin", color: { argb: C.azulB } },
  left:   { style: "thin", color: { argb: C.azulB } },
  right:  { style: "thin", color: { argb: C.azulB } },
})
const bdM = () => ({  // borde medio para separadores
  top:    { style: "medium", color: { argb: C.azulO } },
  bottom: { style: "medium", color: { argb: C.azulO } },
  left:   { style: "medium", color: { argb: C.azulO } },
  right:  { style: "medium", color: { argb: C.azulO } },
})

const fill = (argb) => ({ type: "pattern", pattern: "solid", fgColor: { argb } })
const font = (opts) => ({ name: "Arial", ...opts })

// Estilos — replicar exactamente el Excel original
const S = {
  hPri: {
    font: font({ bold: true, size: 11, color: { argb: C.blanco } }),
    fill: fill(C.azulO),
    alignment: { horizontal: "center", vertical: "middle", wrapText: true },
    border: bdM(),
  },
  hSec: {
    font: font({ bold: true, size: 10, color: { argb: C.blanco } }),
    fill: fill(C.azulM),
    alignment: { horizontal: "center", vertical: "middle" },
    border: bd(),
  },
  codigo: {
    font: font({ bold: true, size: 10, color: { argb: C.azulM } }),
    fill: fill(C.blanco),
    alignment: { horizontal: "left", vertical: "middle" },
    border: bd(),
  },
  dato: {
    font: font({ size: 10, color: { argb: "FF000000" } }),
    fill: fill(C.blanco),
    alignment: { vertical: "middle" },
    border: bd(),
  },
  datoAlt: {
    font: font({ size: 10, color: { argb: "FF000000" } }),
    fill: fill(C.azulXC),
    alignment: { vertical: "middle" },
    border: bd(),
  },
  num: {
    font: font({ size: 10, color: { argb: "FF000000" } }),
    fill: fill(C.blanco),
    alignment: { horizontal: "right", vertical: "middle" },
    border: bd(),
  },
  numAlt: {
    font: font({ size: 10, color: { argb: "FF000000" } }),
    fill: fill(C.azulXC),
    alignment: { horizontal: "right", vertical: "middle" },
    border: bd(),
  },
  totalOscuro: {
    font: font({ bold: true, size: 10, color: { argb: C.blanco } }),
    fill: fill(C.azulO),
    alignment: { horizontal: "right", vertical: "middle" },
    border: bd(),
  },
  totalOscuroL: {
    font: font({ bold: true, size: 10, color: { argb: C.blanco } }),
    fill: fill(C.azulO),
    alignment: { horizontal: "left", vertical: "middle" },
    border: bd(),
  },
  pctFila: {
    font: font({ bold: true, size: 10, color: { argb: C.azulM } }),
    fill: fill(C.azulC),
    alignment: { horizontal: "right", vertical: "middle" },
    border: bd(),
  },
  pctFilaL: {
    font: font({ bold: true, size: 10, color: { argb: C.azulM } }),
    fill: fill(C.azulC),
    alignment: { horizontal: "left", vertical: "middle" },
    border: bd(),
  },
  precioVenta: {
    font: font({ bold: true, size: 10, color: { argb: C.verde } }),
    fill: fill(C.verdeF),
    alignment: { horizontal: "right", vertical: "middle" },
    border: bd(),
  },
  precioVentaL: {
    font: font({ bold: true, size: 10, color: { argb: C.verde } }),
    fill: fill(C.verdeF),
    alignment: { horizontal: "left", vertical: "middle" },
    border: bd(),
  },
  margen: {
    font: font({ size: 10, color: { argb: C.grisT } }),
    fill: fill(C.blanco),
    alignment: { horizontal: "right", vertical: "middle" },
    border: bd(),
  },
  sep: {
    font: font({ bold: true, size: 10, color: { argb: C.blanco } }),
    fill: fill(C.azulM),
    alignment: { horizontal: "center", vertical: "middle" },
    border: bdM(),
  },
  muted: {
    font: font({ italic: true, size: 9, color: { argb: "FF9CA3AF" } }),
    fill: fill(C.blanco),
    alignment: { horizontal: "center", vertical: "middle" },
    border: bd(),
  },
  varOk: {
    font: font({ bold: true, size: 10, color: { argb: C.verde } }),
    fill: fill(C.verdeF),
    alignment: { horizontal: "right", vertical: "middle" },
    border: bd(),
  },
  varAmber: {
    font: font({ bold: true, size: 10, color: { argb: C.amber } }),
    fill: fill(C.amberF),
    alignment: { horizontal: "right", vertical: "middle" },
    border: bd(),
  },
  varAlerta: {
    font: font({ bold: true, size: 10, color: { argb: C.rojo } }),
    fill: fill(C.rojoF),
    alignment: { horizontal: "right", vertical: "middle" },
    border: bd(),
  },
  nota: {
    font: font({ italic: true, size: 9, color: { argb: C.grisT } }),
    fill: fill(C.azulXC),
    alignment: { horizontal: "center", vertical: "middle", wrapText: true },
    border: bd(),
  },
  nombreCol: {
    font: font({ italic: true, size: 9, color: { argb: C.azulM } }),
    fill: fill(C.blanco),
    alignment: { horizontal: "center", vertical: "middle", wrapText: true },
    border: bd(),
  },
  proveedor: {
    font: font({ italic: true, size: 10, color: { argb: "FF000000" } }),
    border: bd(),
  },
  cantUnid: {
    font: font({ italic: true, size: 9, color: { argb: C.grisT } }),
    fill: fill(C.azulC),
    alignment: { horizontal: "center", vertical: "middle" },
    border: bd(),
  },
  blank: { fill: fill(C.blanco) },
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function safeValue(value) {
  if (typeof value === "number" && !Number.isFinite(value)) return 0
  return value
}
function setCell(ws, col, row, value, style, fmt) {
  const cell = ws.getCell(row, col)
  cell.value = safeValue(value)
  if (style) Object.assign(cell, style)
  if (fmt) cell.numFmt = fmt
  return cell
}
function mergeFill(ws, r, c1, c2, style) {
  ws.mergeCells(r, c1, r, c2)
  for (let c = c1; c <= c2; c++) setCell(ws, c, r, c === c1 ? ws.getCell(r, c1).value : "", style)
}
function styleNum(idx) { return idx % 2 === 0 ? S.num : S.numAlt }
function styleDato(idx) { return idx % 2 === 0 ? S.dato : S.datoAlt }
function autofitCols(ws, widths) {
  ws.columns = widths.map((w) => ({ width: Math.min(50, Math.max(12, w)) }))
}
function materialesUnicos(referencias) {
  const map = new Map()
  referencias.forEach((ref) => {
    ;(ref.consumos || []).forEach((c) => {
      const m = c.material
      if (!m || map.has(m.id)) return
      map.set(m.id, m)
    })
  })
  return [...map.values()].sort((a, b) => String(a.id).localeCompare(String(b.id)))
}
function landscapePage(ws) {
  ws.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
}

// ---------------------------------------------------------------------------
// Hoja: Resumen Costos
// ---------------------------------------------------------------------------
function buildResumenCostos(wb, referencias, calc, parametros, periodoLabel) {
  const ws = wb.addWorksheet("📊 Resumen Costos", { properties: { tabColor: { argb: C.azulO } } })
  const N = referencias.length
  const lastCol = N + 1

  mergeFill(ws, 1, 1, lastCol, S.hPri)
  setCell(ws, 1, 1, "RESUMEN DE COSTOS Y PRECIOS — TODAS LAS REFERENCIAS", S.hPri)
  ws.getRow(1).height = 28

  mergeFill(ws, 2, 1, lastCol, S.nota)
  setCell(ws, 1, 2, `Vista comparativa automática — ${periodoLabel || "Todos los meses"}. Los valores se calculan desde la Matriz de Consumos.`, S.nota)
  ws.getRow(2).height = 20

  setCell(ws, 1, 3, "Referencia →", S.hSec)
  calc.forEach((it, i) => setCell(ws, 2 + i, 3, it.ref.id, S.hSec))
  ws.getRow(3).height = 22

  setCell(ws, 1, 4, "Nombre →", S.dato)
  calc.forEach((it, i) => setCell(ws, 2 + i, 4, it.ref.nombre, S.nombreCol))
  ws.getRow(4).height = 18

  const filaDatos = (r, label, getVal, styleNumS, styleLabelS, fmt) => {
    setCell(ws, 1, r, label, styleLabelS)
    calc.forEach((it, i) => setCell(ws, 2 + i, r, getVal(it), styleNumS, fmt))
  }

  filaDatos(5, "A. Materiales directos (MPD)", (it) => it.mpd, S.num, S.dato, FMT.cop)
  filaDatos(6, "B. Mano de obra directa (MOD)", (it) => it.mod, S.num, S.dato, FMT.cop)
  filaDatos(7, "C. Costos indirectos fab. (CIF)", (it) => it.cif, S.num, S.dato, FMT.cop)
  filaDatos(8, "COSTO DE PRODUCCIÓN (A+B+C)", (it) => it.costoProd, S.totalOscuro, S.totalOscuroL, FMT.cop)
  filaDatos(9, "D. Gastos adm. y ventas (%)", () => parametros.pctGAV / 100, S.pctFila, S.pctFilaL, FMT.pct)
  filaDatos(10, "COSTO TOTAL (A+B+C)×(1+D)", (it) => it.costoTotal, S.totalOscuro, S.totalOscuroL, FMT.cop)
  filaDatos(11, "E. Margen de utilidad (%)", () => parametros.pctMargen / 100, S.pctFila, S.pctFilaL, FMT.pct)
  filaDatos(12, "PRECIO DE VENTA SUGERIDO (COP)", (it) => it.precioVenta, S.precioVenta, S.precioVentaL, FMT.cop)

  const margenStyle = { ...S.margen, fill: fill(C.azulXC) }
  const margenStyleL = { ...S.margen, alignment: { horizontal: "left", vertical: "middle" }, fill: fill(C.azulXC) }
  filaDatos(13, "Margen bruto unitario (COP)", (it) => it.margenBruto, margenStyle, margenStyleL, FMT.cop)
  filaDatos(14, "% Materiales / costo producción", (it) => (it.costoProd > 0 ? it.mpd / it.costoProd : 0), margenStyle, margenStyleL, FMT.pct)

  for (let r = 5; r <= 14; r++) ws.getRow(r).height = 18

  autofitCols(ws, [32, ...Array(N).fill(14)])
  ws.views = [{ state: "frozen", ySplit: 4 }]
  landscapePage(ws)
  return ws
}

// ---------------------------------------------------------------------------
// Hoja: Materiales
// ---------------------------------------------------------------------------
function buildMateriales(wb, referencias) {
  const ws = wb.addWorksheet("🔩 Materiales", { properties: { tabColor: { argb: C.azulM } } })
  const materiales = materialesUnicos(referencias)

  mergeFill(ws, 1, 1, 4, S.hPri)
  setCell(ws, 1, 1, "INDUSTRIAS DONSOON — MAESTRO DE MATERIALES", S.hPri)
  ws.getRow(1).height = 26

  mergeFill(ws, 2, 1, 4, S.nota)
  setCell(ws, 1, 2, "Liste todos los materiales usados en producción con su costo unitario.", S.nota)
  ws.getRow(2).height = 18

  ;["Código", "Nombre del material", "Unidad", "Costo unit. (COP)"].forEach((h, i) =>
    setCell(ws, i + 1, 3, h, S.hSec)
  )
  ws.getRow(3).height = 22

  materiales.forEach((m, i) => {
    const r = 4 + i
    setCell(ws, 1, r, m.id, S.codigo)
    setCell(ws, 2, r, m.nombre, styleDato(i))
    setCell(ws, 3, r, m.unidad, { ...styleDato(i), alignment: { horizontal: "center", vertical: "middle" } })
    setCell(ws, 4, r, m.costo || 0, styleNum(i), FMT.cop)
  })

  autofitCols(ws, [12, 28, 12, 18])
  ws.views = [{ state: "frozen", ySplit: 3 }]
  landscapePage(ws)
  return ws
}

// ---------------------------------------------------------------------------
// Hoja: Matriz Consumos
// ---------------------------------------------------------------------------
function buildMatrizConsumos(wb, referencias, calc, parametros) {
  const ws = wb.addWorksheet("🔢 Matriz Consumos", { properties: { tabColor: { argb: "FF065F46" } } })
  const N = referencias.length
  const lastCol = N + 4
  const materiales = materialesUnicos(referencias)

  mergeFill(ws, 1, 1, lastCol, S.hPri)
  setCell(ws, 1, 1, "MATRIZ DE CONSUMOS POR REFERENCIA — INDUSTRIAS DONSOON", S.hPri)
  ws.getRow(1).height = 26

  mergeFill(ws, 2, 1, lastCol, S.nota)
  setCell(ws, 1, 2, "Cantidad de cada material por unidad producida, costo de mano de obra y CIF por referencia.", S.nota)
  ws.getRow(2).height = 18

  setCell(ws, 1, 3, "CÓDIGO", S.hSec)
  setCell(ws, 2, 3, "MATERIAL", S.hSec)
  setCell(ws, 3, 3, "UNIDAD", S.hSec)
  setCell(ws, 4, 3, "COSTO UNIT.", S.hSec)
  calc.forEach((it, i) => setCell(ws, 5 + i, 3, it.ref.id, S.hSec))
  ws.getRow(3).height = 22

  for (let c = 1; c <= 4; c++) setCell(ws, c, 4, "", { fill: fill(C.azulXC), border: bd() })
  calc.forEach((it, i) => setCell(ws, 5 + i, 4, it.ref.nombre, S.nombreCol))
  ws.getRow(4).height = 16

  for (let c = 1; c <= 4; c++) setCell(ws, c, 5, "", { fill: fill(C.azulC), border: bd() })
  calc.forEach((it, i) => setCell(ws, 5 + i, 5, "cant/unid", S.cantUnid))
  ws.getRow(5).height = 14

  let r = 6
  materiales.forEach((m, i) => {
    setCell(ws, 1, r, m.id, S.codigo)
    setCell(ws, 2, r, m.nombre, styleDato(i))
    setCell(ws, 3, r, m.unidad, { ...styleDato(i), alignment: { horizontal: "center", vertical: "middle" } })
    setCell(ws, 4, r, m.costo || 0, styleNum(i), FMT.cop)
    calc.forEach((it, ci) => {
      const cons = (it.ref.consumos || []).find((c) => c.material && c.material.id === m.id)
      setCell(ws, 5 + ci, r, cons ? cons.cantidad || 0 : "", styleNum(i), cons ? FMT.dec3 : undefined)
    })
    r++
  })

  mergeFill(ws, r, 1, 4, S.totalOscuroL)
  setCell(ws, 1, r, "COSTO MATERIALES / UNIDAD (COP)", S.totalOscuroL)
  calc.forEach((it, i) => setCell(ws, 5 + i, r, it.mpd, S.totalOscuro, FMT.cop))
  ws.getRow(r).height = 20
  r++

  mergeFill(ws, r, 1, lastCol, S.sep)
  setCell(ws, 1, r, "MANO DE OBRA DIRECTA", S.sep)
  ws.getRow(r).height = 18
  r++

  const tarifaMOD = parametros.tarifaMOD
  setCell(ws, 1, r, "MOD-T", S.codigo)
  setCell(ws, 2, r, "Tarifa MOD hora (COP) — ver hoja Parámetros", styleDato(0))
  setCell(ws, 3, r, "", styleDato(0))
  setCell(ws, 4, r, tarifaMOD, S.num, FMT.cop)
  for (let c = 5; c <= lastCol; c++) setCell(ws, c, r, "", styleNum(0))
  r++

  setCell(ws, 1, r, "MOD-S", S.codigo)
  setCell(ws, 2, r, "Segundos MOD por unidad producida ↓", styleDato(1))
  setCell(ws, 3, r, "", styleDato(1))
  setCell(ws, 4, r, "", styleNum(1))
  referencias.forEach((ref, i) => setCell(ws, 5 + i, r, ref.segMOD || 0, styleNum(1), FMT.int))
  r++

  mergeFill(ws, r, 1, 4, S.totalOscuroL)
  setCell(ws, 1, r, "COSTO MOD / UNIDAD (COP)", S.totalOscuroL)
  calc.forEach((it, i) => setCell(ws, 5 + i, r, it.mod, S.totalOscuro, FMT.cop))
  ws.getRow(r).height = 20
  r++

  mergeFill(ws, r, 1, lastCol, S.sep)
  setCell(ws, 1, r, "COSTOS INDIRECTOS DE FABRICACIÓN (CIF)", S.sep)
  ws.getRow(r).height = 18
  r++

  setCell(ws, 1, r, "CIF-U", S.codigo)
  setCell(ws, 2, r, "Carga fabril unitaria (COP) ↓", styleDato(0))
  setCell(ws, 3, r, "", styleDato(0))
  setCell(ws, 4, r, "", styleNum(0))
  referencias.forEach((ref, i) => setCell(ws, 5 + i, r, ref.cifUnitario || 0, styleNum(0), FMT.cop))
  r++

  mergeFill(ws, r, 1, 4, S.totalOscuroL)
  setCell(ws, 1, r, "COSTO CIF / UNIDAD (COP)", S.totalOscuroL)
  calc.forEach((it, i) => setCell(ws, 5 + i, r, it.cif, S.totalOscuro, FMT.cop))
  ws.getRow(r).height = 20

  autofitCols(ws, [10, 26, 10, 14, ...Array(N).fill(13)])
  ws.views = [{ state: "frozen", ySplit: 5 }]
  landscapePage(ws)
  return ws
}

// ---------------------------------------------------------------------------
// Hoja: Parámetros
// ---------------------------------------------------------------------------
function buildParametros(wb, parametros) {
  const ws = wb.addWorksheet("⚙️ Parámetros", { properties: { tabColor: { argb: "FF6B7280" } } })

  mergeFill(ws, 1, 1, 4, S.hPri)
  setCell(ws, 1, 1, "INDUSTRIAS DONSOON — PARÁMETROS GENERALES", S.hPri)
  ws.getRow(1).height = 26

  for (let c = 1; c <= 4; c++) setCell(ws, c, 2, "", S.blank)

  const sep = (r, label) => {
    mergeFill(ws, r, 1, 4, S.sep)
    setCell(ws, 1, r, label, S.sep)
    ws.getRow(r).height = 20
  }
  const fila = (r, label, valor, style, fmt) => {
    setCell(ws, 1, r, label, styleDato(r))
    setCell(ws, 2, r, valor, style, fmt)
    setCell(ws, 3, r, "", styleDato(r))
    setCell(ws, 4, r, "", styleDato(r))
  }

  sep(3, "EMPRESA")
  fila(4, "Nombre empresa", "Industrias Donsoon", styleDato(4))
  fila(5, "Responsable costos", "Gerente General", styleDato(5))
  fila(6, "Período de análisis", "Mensual", styleDato(6))
  fila(7, "Moneda", "COP — Pesos colombianos", styleDato(7))

  for (let c = 1; c <= 4; c++) setCell(ws, c, 8, "", S.blank)
  sep(9, "MANO DE OBRA DIRECTA")
  fila(10, "Total costo MOD mensual (COP)", 12300000, styleNum(10), FMT.cop)
  fila(11, "Total horas MOD disponibles/mes", 768, { ...styleNum(11), font: font({ bold: true, size: 10, color: { argb: C.azulM } }) }, FMT.int)
  fila(12, "Tarifa MOD por hora (COP) — automático", parametros.tarifaMOD, { ...styleNum(12), font: font({ bold: true, size: 10, color: { argb: "FF000000" } }) }, FMT.cop)

  for (let c = 1; c <= 4; c++) setCell(ws, c, 13, "", S.blank)
  sep(14, "GASTOS GENERALES")
  fila(15, "% GAV (gastos adm. y ventas)", parametros.pctGAV / 100, { ...styleNum(15), font: font({ bold: true, size: 10, color: { argb: "FF000000" } }) }, FMT.pct)
  fila(16, "% Margen de utilidad", parametros.pctMargen / 100, { ...styleNum(16), font: font({ bold: true, size: 10, color: { argb: "FF000000" } }) }, FMT.pct)

  for (let c = 1; c <= 4; c++) setCell(ws, c, 17, "", S.blank)
  sep(18, "CARGA FABRIL (CIF)")
  fila(19, "La CIF se ingresa directamente en cada referencia como valor unitario en COP.", "", { ...S.muted, alignment: { horizontal: "left", vertical: "middle" } })

  for (let c = 1; c <= 4; c++) setCell(ws, c, 20, "", S.blank)
  sep(21, "LEYENDA DE COLORES")

  mergeFill(ws, 22, 1, 4, S.pctFilaL)
  setCell(ws, 1, 22, "Celda azul (texto azul): ingresar dato", S.pctFilaL)

  mergeFill(ws, 23, 1, 4, { fill: fill(C.gris), border: bd(), font: font({ size: 10, color: { argb: "FF000000" } }), alignment: { horizontal: "left", vertical: "middle" } })
  setCell(ws, 1, 23, "Celda gris: calculada automáticamente", { fill: fill(C.gris), border: bd(), font: font({ size: 10, color: { argb: "FF000000" } }), alignment: { horizontal: "left", vertical: "middle" } })

  mergeFill(ws, 24, 1, 4, { ...S.varOk, alignment: { horizontal: "left", vertical: "middle" } })
  setCell(ws, 1, 24, "Celda verde: vinculada desde otra hoja", { ...S.varOk, alignment: { horizontal: "left", vertical: "middle" } })

  autofitCols(ws, [30, 20, 12, 12])
  landscapePage(ws)
  return ws
}

// ---------------------------------------------------------------------------
// Función principal
// ---------------------------------------------------------------------------
export async function exportarExcel(referencias, parametros, periodoLabel) {
  const calc = referencias.map((r) => ({ ref: r, ...calcCostos(r, parametros) }))
  const wb = new ExcelJS.Workbook()
  wb.creator = "Industrias Donsoon"
  wb.created = new Date()

  buildResumenCostos(wb, referencias, calc, parametros, periodoLabel)
  buildMateriales(wb, referencias)
  buildMatrizConsumos(wb, referencias, calc, parametros)
  buildParametros(wb, parametros)

  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: "application/octet-stream" })
  const nombre = `reporte_Donsoon_Costos_${(periodoLabel || "Todos").replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.xlsx`

  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
