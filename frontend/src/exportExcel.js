import ExcelJS from 'exceljs'
import { calcCostosEstandar, mesLabel } from './utils/costos.js'

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
  cop:  '"$"#,##0;[Red]-"$"#,##0;"$"0',
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
  ratio: {
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
// Materiales de una referencia: si tiene órdenes importadas de Odoo, esos son
// la fuente real de MPD (igual que calcCostosEstandar); si no, se usan los
// consumos manuales. Nunca se mezclan ambas fuentes para una misma referencia.
function materialesDeReferencia(ref) {
  if (ref.costosImportados) {
    return (ref.costosImportados.materials || []).map((m) => ({
      origen: "Odoo",
      codigo: m.insumo,
      nombre: m.insumo,
      unidad: "",
      costoUnit: m.costoMp || 0,
      cantPlan: m.cantPlaneado || 0,
      vrPlan: m.vrPlaneado || 0,
      cantEjec: m.cantEjecutado ?? null,
      vrEjec: m.vrEjecutado ?? null,
    }))
  }
  return (ref.consumos || [])
    .filter((c) => c.material)
    .map((c) => ({
      origen: "Manual",
      codigo: c.material.id,
      nombre: c.material.nombre,
      unidad: c.material.unidad,
      costoUnit: c.material.costo || 0,
      cantPlan: c.cantidad || 0,
      vrPlan: (c.material.costo || 0) * (c.cantidad || 0),
      cantEjec: null,
      vrEjec: null,
    }))
}
function materialesUnicos(referencias) {
  const map = new Map()
  referencias.forEach((ref) => {
    materialesDeReferencia(ref).forEach((m) => {
      if (!map.has(m.codigo)) map.set(m.codigo, m)
    })
  })
  return [...map.values()].sort((a, b) => String(a.codigo).localeCompare(String(b.codigo)))
}
// Distingue referencias que aparecen más de una vez con meses distintos
// (una misma Referencia con órdenes importadas en varios meses).
function refLabel(ref) {
  return ref.mes ? `${ref.id} (${mesLabel(ref.mes)})` : ref.id
}
function landscapePage(ws) {
  ws.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
}

// ---------------------------------------------------------------------------
// Hoja: Resumen Costos
// ---------------------------------------------------------------------------
function buildResumenCostos(wb, referencias, calc, periodoLabel) {
  const ws = wb.addWorksheet("📊 Resumen Costos", { properties: { tabColor: { argb: C.azulO } } })
  const N = referencias.length
  const lastCol = N + 1

  mergeFill(ws, 1, 1, lastCol, S.hPri)
  setCell(ws, 1, 1, "RESUMEN DE COSTOS — TODAS LAS REFERENCIAS", S.hPri)
  ws.getRow(1).height = 28

  mergeFill(ws, 2, 1, lastCol, S.nota)
  setCell(ws, 1, 2, `Vista comparativa automática — ${periodoLabel || "Todos los meses"}. Los valores se calculan desde la Matriz de Consumos.`, S.nota)
  ws.getRow(2).height = 20

  setCell(ws, 1, 3, "Referencia →", S.hSec)
  calc.forEach((it, i) => setCell(ws, 2 + i, 3, refLabel(it.ref), S.hSec))
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
  filaDatos(8, "COSTO ESTÁNDAR (A+B+C)", (it) => it.costoEstandar, S.totalOscuro, S.totalOscuroL, FMT.cop)

  setCell(ws, 1, 9, "COSTO PRODUCCIÓN (ODOO)", S.totalOscuroL)
  calc.forEach((it, i) => {
    const v = it.costoOdoo > 0 ? it.costoOdoo : "—"
    setCell(ws, 2 + i, 9, v, S.totalOscuro, typeof v === "number" ? FMT.cop : undefined)
  })

  setCell(ws, 1, 10, "VARIACIÓN % (ODOO vs ESTÁNDAR)", S.pctFilaL)
  calc.forEach((it, i) => {
    const v = it.variacion
    const style = v == null ? S.muted : v > 0 ? S.varAlerta : v < 0 ? S.varOk : S.pctFila
    setCell(ws, 2 + i, 10, v == null ? "—" : v / 100, style, v == null ? undefined : FMT.pct)
  })

  const ratioStyle = { ...S.ratio, fill: fill(C.azulXC) }
  const ratioStyleL = { ...S.ratio, alignment: { horizontal: "left", vertical: "middle" }, fill: fill(C.azulXC) }
  filaDatos(11, "% Materiales / Costo Estándar", (it) => (it.costoEstandar > 0 ? it.mpd / it.costoEstandar : 0), ratioStyle, ratioStyleL, FMT.pct)

  for (let r = 5; r <= 11; r++) ws.getRow(r).height = 18

  autofitCols(ws, [32, ...Array(N).fill(18)])
  ws.views = [{ state: "frozen", ySplit: 4 }]
  landscapePage(ws)
  return ws
}

// ---------------------------------------------------------------------------
// Hoja: Materiales
// ---------------------------------------------------------------------------
function buildMateriales(wb, referencias) {
  const ws = wb.addWorksheet("🔩 Materiales", { properties: { tabColor: { argb: C.azulM } } })

  mergeFill(ws, 1, 1, 8, S.hPri)
  setCell(ws, 1, 1, "INDUSTRIAS DONSOON — MATERIALES POR REFERENCIA", S.hPri)
  ws.getRow(1).height = 26

  mergeFill(ws, 2, 1, 8, S.nota)
  setCell(ws, 1, 2, "Todos los materiales consumidos por cada referencia exportada (manual u Odoo importado).", S.nota)
  ws.getRow(2).height = 18

  ;["Referencia", "Origen", "Código / Insumo", "Nombre", "Cant. Planeado", "Vr. Planeado (COP)", "Cant. Ejecutado", "Vr. Ejecutado (COP)"].forEach((h, i) =>
    setCell(ws, i + 1, 3, h, S.hSec)
  )
  ws.getRow(3).height = 22

  let r = 4
  let idx = 0
  referencias.forEach((ref) => {
    const lineas = materialesDeReferencia(ref)
    lineas.forEach((m) => {
      setCell(ws, 1, r, refLabel(ref), S.codigo)
      setCell(ws, 2, r, m.origen, styleDato(idx))
      setCell(ws, 3, r, m.codigo, styleDato(idx))
      setCell(ws, 4, r, m.nombre, styleDato(idx))
      setCell(ws, 5, r, m.cantPlan, styleNum(idx), FMT.dec3)
      setCell(ws, 6, r, m.vrPlan, styleNum(idx), FMT.cop)
      setCell(ws, 7, r, m.cantEjec, styleNum(idx), m.cantEjec != null ? FMT.dec3 : undefined)
      setCell(ws, 8, r, m.vrEjec, styleNum(idx), m.vrEjec != null ? FMT.cop : undefined)
      r++
      idx++
    })
  })

  autofitCols(ws, [20, 10, 22, 26, 14, 16, 14, 16])
  ws.views = [{ state: "frozen", ySplit: 3 }]
  landscapePage(ws)
  return ws
}

// ---------------------------------------------------------------------------
// Hoja: Matriz Consumos
// ---------------------------------------------------------------------------
function buildMatrizConsumos(wb, referencias, calc) {
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
  calc.forEach((it, i) => setCell(ws, 5 + i, 3, refLabel(it.ref), S.hSec))
  ws.getRow(3).height = 22

  for (let c = 1; c <= 4; c++) setCell(ws, c, 4, "", { fill: fill(C.azulXC), border: bd() })
  calc.forEach((it, i) => setCell(ws, 5 + i, 4, it.ref.nombre, S.nombreCol))
  ws.getRow(4).height = 16

  for (let c = 1; c <= 4; c++) setCell(ws, c, 5, "", { fill: fill(C.azulC), border: bd() })
  calc.forEach((it, i) => setCell(ws, 5 + i, 5, "cant/unid", S.cantUnid))
  ws.getRow(5).height = 14

  let r = 6
  materiales.forEach((m, i) => {
    setCell(ws, 1, r, m.codigo, S.codigo)
    setCell(ws, 2, r, m.nombre, styleDato(i))
    setCell(ws, 3, r, m.unidad, { ...styleDato(i), alignment: { horizontal: "center", vertical: "middle" } })
    setCell(ws, 4, r, m.costoUnit || 0, styleNum(i), FMT.cop)
    calc.forEach((it, ci) => {
      const cons = materialesDeReferencia(it.ref).find((c) => c.codigo === m.codigo)
      setCell(ws, 5 + ci, r, cons ? cons.cantPlan || 0 : "", styleNum(i), cons ? FMT.dec3 : undefined)
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

  // FIX: segMOD almacena COP (no segundos); tarifaMOD no interviene en cálculos
  setCell(ws, 1, r, "MOD-C", S.codigo)
  setCell(ws, 2, r, "MOD (COP) por unidad producida ↓", styleDato(0))
  setCell(ws, 3, r, "", styleDato(0))
  setCell(ws, 4, r, "", styleNum(0))
  referencias.forEach((ref, i) => setCell(ws, 5 + i, r, ref.segMOD || 0, styleNum(0), FMT.int))
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

  autofitCols(ws, [10, 26, 10, 14, ...Array(N).fill(16)])
  ws.views = [{ state: "frozen", ySplit: 5 }]
  landscapePage(ws)
  return ws
}

// ---------------------------------------------------------------------------
// Hoja: Parámetros
// ---------------------------------------------------------------------------
function buildParametros(wb) {
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
  // DEPRECATED: tarifaMOD no se usa en ningún cálculo — fila eliminada del reporte

  for (let c = 1; c <= 4; c++) setCell(ws, c, 13, "", S.blank)
  sep(14, "CARGA FABRIL (CIF)")
  fila(15, "La CIF se ingresa directamente en cada referencia como valor unitario en COP.", "", { ...S.muted, alignment: { horizontal: "left", vertical: "middle" } })

  for (let c = 1; c <= 4; c++) setCell(ws, c, 16, "", S.blank)
  sep(17, "LEYENDA DE COLORES")

  mergeFill(ws, 18, 1, 4, S.pctFilaL)
  setCell(ws, 1, 18, "Celda azul (texto azul): ingresar dato", S.pctFilaL)

  mergeFill(ws, 19, 1, 4, { fill: fill(C.gris), border: bd(), font: font({ size: 10, color: { argb: "FF000000" } }), alignment: { horizontal: "left", vertical: "middle" } })
  setCell(ws, 1, 19, "Celda gris: calculada automáticamente", { fill: fill(C.gris), border: bd(), font: font({ size: 10, color: { argb: "FF000000" } }), alignment: { horizontal: "left", vertical: "middle" } })

  mergeFill(ws, 20, 1, 4, { ...S.varOk, alignment: { horizontal: "left", vertical: "middle" } })
  setCell(ws, 1, 20, "Celda verde: variación favorable / vinculada desde otra hoja", { ...S.varOk, alignment: { horizontal: "left", vertical: "middle" } })

  autofitCols(ws, [30, 20, 12, 12])
  landscapePage(ws)
  return ws
}

// ---------------------------------------------------------------------------
// Función principal
// ---------------------------------------------------------------------------
export async function exportarExcel(referencias, parametros, periodoLabel) {
  const calc = referencias.map((r) => ({ ref: r, ...calcCostosEstandar(r, parametros) }))
  const wb = new ExcelJS.Workbook()
  wb.creator = "Industrias Donsoon"
  wb.created = new Date()

  buildResumenCostos(wb, referencias, calc, periodoLabel)
  buildMateriales(wb, referencias)
  buildMatrizConsumos(wb, referencias, calc)
  buildParametros(wb)

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
