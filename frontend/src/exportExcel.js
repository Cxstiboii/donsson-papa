import * as XLSX from 'xlsx'
import { calcCostos } from './api.js'

// Paleta — extraída visualmente del Excel original Donsoon
const C = {
  azulO:   "1F3864",  // headers principales
  azulM:   "2E75B6",  // headers secundarios, códigos
  azulC:   "D6E4F0",  // fondo filas % y separadores
  azulXC:  "EBF3FB",  // filas alternas pares
  azulB:   "BDD7EE",  // color de bordes
  verde:   "1A5C38",  // variación OK
  verdeF:  "D1FAE5",
  amber:   "92400E",
  amberF:  "FEF3C7",
  rojo:    "7B0000",  // variación crítica
  rojoF:   "FEE2E2",
  blanco:  "FFFFFF",
  grisT:   "595959",  // texto secundario
}

const FMT = {
  cop:  '"$"#,##0',
  pct:  '0.0%',
  dec3: '0.000',
  int:  '#,##0',
  hrs:  '0.00" h"',
}

// Border estándar del Excel Donsoon
const bd = () => ({
  top:    { style: "thin", color: { rgb: "BDD7EE" } },
  bottom: { style: "thin", color: { rgb: "BDD7EE" } },
  left:   { style: "thin", color: { rgb: "BDD7EE" } },
  right:  { style: "thin", color: { rgb: "BDD7EE" } },
})
const bdM = () => ({  // borde medio para separadores
  top:    { style: "medium", color: { rgb: "1F3864" } },
  bottom: { style: "medium", color: { rgb: "1F3864" } },
  left:   { style: "medium", color: { rgb: "1F3864" } },
  right:  { style: "medium", color: { rgb: "1F3864" } },
})

// Estilos — replicar exactamente el Excel original
const S = {
  // Header principal: fondo azul oscuro, texto blanco bold, centrado
  hPri: {
    font: { name:"Arial", bold:true, sz:11, color:{rgb:"FFFFFF"} },
    fill: { fgColor:{rgb:"1F3864"} },
    alignment: { horizontal:"center", vertical:"center", wrapText:true },
    border: bdM(),
  },
  // Header secundario: azul medio, blanco bold
  hSec: {
    font: { name:"Arial", bold:true, sz:10, color:{rgb:"FFFFFF"} },
    fill: { fgColor:{rgb:"2E75B6"} },
    alignment: { horizontal:"center", vertical:"center" },
    border: bd(),
  },
  // Código de referencia/material: texto azul bold (como MAT-01, FA-001)
  codigo: {
    font: { name:"Arial", bold:true, sz:10, color:{rgb:"2E75B6"} },
    fill: { fgColor:{rgb:"FFFFFF"} },
    alignment: { horizontal:"left", vertical:"center" },
    border: bd(),
  },
  // Celda de dato normal fila impar (blanco)
  dato: {
    font: { name:"Arial", sz:10, color:{rgb:"000000"} },
    fill: { fgColor:{rgb:"FFFFFF"} },
    alignment: { vertical:"center" },
    border: bd(),
  },
  // Celda de dato fila par (azul muy claro)
  datoAlt: {
    font: { name:"Arial", sz:10, color:{rgb:"000000"} },
    fill: { fgColor:{rgb:"EBF3FB"} },
    alignment: { vertical:"center" },
    border: bd(),
  },
  // Número alineado a derecha fila impar
  num: {
    font: { name:"Arial", sz:10, color:{rgb:"000000"} },
    fill: { fgColor:{rgb:"FFFFFF"} },
    alignment: { horizontal:"right", vertical:"center" },
    border: bd(),
  },
  // Número alineado a derecha fila par
  numAlt: {
    font: { name:"Arial", sz:10, color:{rgb:"000000"} },
    fill: { fgColor:{rgb:"EBF3FB"} },
    alignment: { horizontal:"right", vertical:"center" },
    border: bd(),
  },
  // Fila de costo/total: fondo azul oscuro texto blanco bold (como "COSTO DE PRODUCCIÓN")
  totalOscuro: {
    font: { name:"Arial", bold:true, sz:10, color:{rgb:"FFFFFF"} },
    fill: { fgColor:{rgb:"1F3864"} },
    alignment: { horizontal:"right", vertical:"center" },
    border: bd(),
  },
  totalOscuroL: {  // mismo pero alineado izquierda (para label)
    font: { name:"Arial", bold:true, sz:10, color:{rgb:"FFFFFF"} },
    fill: { fgColor:{rgb:"1F3864"} },
    alignment: { horizontal:"left", vertical:"center" },
    border: bd(),
  },
  // Fila de % (GAV, margen): fondo azul claro, texto azul bold (como "D. Gastos adm.")
  pctFila: {
    font: { name:"Arial", bold:true, sz:10, color:{rgb:"2E75B6"} },
    fill: { fgColor:{rgb:"D6E4F0"} },
    alignment: { horizontal:"right", vertical:"center" },
    border: bd(),
  },
  pctFilaL: {
    font: { name:"Arial", bold:true, sz:10, color:{rgb:"2E75B6"} },
    fill: { fgColor:{rgb:"D6E4F0"} },
    alignment: { horizontal:"left", vertical:"center" },
    border: bd(),
  },
  // Precio venta: fondo verde claro, texto verde bold (como "PRECIO DE VENTA SUGERIDO")
  precioVenta: {
    font: { name:"Arial", bold:true, sz:10, color:{rgb:"1A5C38"} },
    fill: { fgColor:{rgb:"D1FAE5"} },
    alignment: { horizontal:"right", vertical:"center" },
    border: bd(),
  },
  precioVentaL: {
    font: { name:"Arial", bold:true, sz:10, color:{rgb:"1A5C38"} },
    fill: { fgColor:{rgb:"D1FAE5"} },
    alignment: { horizontal:"left", vertical:"center" },
    border: bd(),
  },
  // Margen bruto: texto gris oscuro normal
  margen: {
    font: { name:"Arial", sz:10, color:{rgb:"595959"} },
    fill: { fgColor:{rgb:"FFFFFF"} },
    alignment: { horizontal:"right", vertical:"center" },
    border: bd(),
  },
  // Separador de sección: azul claro, texto azul oscuro bold (como "MANO DE OBRA DIRECTA")
  sep: {
    font: { name:"Arial", bold:true, sz:10, color:{rgb:"FFFFFF"} },
    fill: { fgColor:{rgb:"2E75B6"} },
    alignment: { horizontal:"center", vertical:"center" },
    border: bdM(),
  },
  // Texto itálico muted (Sin dato, notas)
  muted: {
    font: { name:"Arial", italic:true, sz:9, color:{rgb:"9CA3AF"} },
    fill: { fgColor:{rgb:"FFFFFF"} },
    alignment: { horizontal:"center", vertical:"center" },
    border: bd(),
  },
  // Variación OK
  varOk: {
    font: { name:"Arial", bold:true, sz:10, color:{rgb:"1A5C38"} },
    fill: { fgColor:{rgb:"D1FAE5"} },
    alignment: { horizontal:"right", vertical:"center" },
    border: bd(),
  },
  varAmber: {
    font: { name:"Arial", bold:true, sz:10, color:{rgb:"92400E"} },
    fill: { fgColor:{rgb:"FEF3C7"} },
    alignment: { horizontal:"right", vertical:"center" },
    border: bd(),
  },
  varAlerta: {
    font: { name:"Arial", bold:true, sz:10, color:{rgb:"7B0000"} },
    fill: { fgColor:{rgb:"FEE2E2"} },
    alignment: { horizontal:"right", vertical:"center" },
    border: bd(),
  },
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function W(ws, col, row, v, type, style, fmt) {
  const addr = XLSX.utils.encode_cell({ c: col, r: row })
  ws[addr] = { v, t: type || "s", s: style, ...(fmt ? { z: fmt } : {}) }
}
function merge(ws, c1, r1, c2, r2) {
  if (!ws["!merges"]) ws["!merges"] = []
  ws["!merges"].push({ s: { r: r1, c: c1 }, e: { r: r2, c: c2 } })
}
function setH(ws, r, hpt) {
  if (!ws["!rows"]) ws["!rows"] = []
  while (ws["!rows"].length <= r) ws["!rows"].push({})
  ws["!rows"][r] = { hpt }
}
function setCols(ws, widths) {
  ws["!cols"] = widths.map((w) => ({ wch: w }))
}
function styleNum(idx) { return idx % 2 === 0 ? S.num : S.numAlt }
function styleDato(idx) { return idx % 2 === 0 ? S.dato : S.datoAlt }
function wsRef(ws, maxR, maxC) {
  ws["!ref"] = XLSX.utils.encode_range({ s:{r:0,c:0}, e:{r:maxR,c:maxC} })
}
function materialesUnicos(referencias) {
  const map = new Map()
  referencias.forEach((ref) => {
    (ref.consumos || []).forEach((c) => {
      const m = c.material
      if (!m || map.has(m.id)) return
      map.set(m.id, m)
    })
  })
  return [...map.values()].sort((a, b) => String(a.id).localeCompare(String(b.id)))
}

// ---------------------------------------------------------------------------
// Hoja: Resumen Costos
// ---------------------------------------------------------------------------
function buildResumenCostos(referencias, calc, parametros, periodoLabel) {
  const ws = {}
  const N = referencias.length
  const lastCol = N + 3

  W(ws, 0, 0, "RESUMEN DE COSTOS Y PRECIOS — TODAS LAS REFERENCIAS", "s", S.hPri)
  merge(ws, 0, 0, lastCol, 0)
  for (let c = 1; c <= lastCol; c++) W(ws, c, 0, "", "s", S.hPri)
  setH(ws, 0, 28)

  W(ws, 0, 1, "Vista comparativa automática. Los valores se calculan desde la Matriz de Consumos. Solo ajuste los % de margen.",
    "s", { font:{name:"Arial",italic:true,sz:9,color:{rgb:"595959"}}, fill:{fgColor:{rgb:"EBF3FB"}}, alignment:{horizontal:"center",vertical:"center",wrapText:true}, border: bd() })
  merge(ws, 0, 1, lastCol, 1)
  for (let c = 1; c <= lastCol; c++) {
    W(ws, c, 1, "", "s", { font:{name:"Arial",italic:true,sz:9,color:{rgb:"595959"}}, fill:{fgColor:{rgb:"EBF3FB"}}, alignment:{horizontal:"center",vertical:"center"}, border: bd() })
  }
  setH(ws, 1, 20)

  W(ws, 0, 2, "Referencia →", "s", S.hSec)
  calc.forEach((it, i) => W(ws, 1 + i, 2, it.ref.id, "s", S.hSec))
  setH(ws, 2, 22)

  W(ws, 0, 3, "Nombre →", "s", S.dato)
  calc.forEach((it, i) => {
    W(ws, 1 + i, 3, it.ref.nombre, "s", { font:{name:"Arial",italic:true,sz:9,color:{rgb:"2E75B6"}}, fill:{fgColor:{rgb:"FFFFFF"}}, alignment:{horizontal:"center",vertical:"center",wrapText:true}, border: bd() })
  })
  setH(ws, 3, 18)

  const filaDatos = (r, label, getVal, styleNumS, styleLabelS, fmt) => {
    W(ws, 0, r, label, "s", styleLabelS)
    calc.forEach((it, i) => W(ws, 1 + i, r, getVal(it), "n", styleNumS, fmt))
  }

  filaDatos(4, "A. Materiales directos (MPD)", (it) => it.mpd, S.num, S.dato, FMT.cop)
  setH(ws, 4, 18)
  filaDatos(5, "B. Mano de obra directa (MOD)", (it) => it.mod, S.num, S.dato, FMT.cop)
  setH(ws, 5, 18)
  filaDatos(6, "C. Costos indirectos fab. (CIF)", (it) => it.cif, S.num, S.dato, FMT.cop)
  setH(ws, 6, 18)

  filaDatos(7, "COSTO DE PRODUCCIÓN (A+B+C)", (it) => it.costoProd, S.totalOscuro, S.totalOscuroL, FMT.cop)
  setH(ws, 7, 20)

  filaDatos(8, "D. Gastos adm. y ventas (%)", () => parametros.pctGAV / 100, S.pctFila, S.pctFilaL, FMT.pct)
  setH(ws, 8, 18)

  filaDatos(9, "COSTO TOTAL (A+B+C)×(1+D)", (it) => it.costoTotal, S.totalOscuro, S.totalOscuroL, FMT.cop)
  setH(ws, 9, 20)

  filaDatos(10, "E. Margen de utilidad (%)", () => parametros.pctMargen / 100, S.pctFila, S.pctFilaL, FMT.pct)
  setH(ws, 10, 18)

  filaDatos(11, "PRECIO DE VENTA SUGERIDO (COP)", (it) => it.precioVenta, S.precioVenta, S.precioVentaL, FMT.cop)
  setH(ws, 11, 22)

  const margenStyle = { ...S.margen, fill: { fgColor: { rgb: "EBF3FB" } } }
  const margenStyleL = { ...S.margen, alignment: { horizontal: "left", vertical: "center" }, fill: { fgColor: { rgb: "EBF3FB" } } }
  filaDatos(12, "Margen bruto unitario (COP)", (it) => it.margenBruto, margenStyle, margenStyleL, FMT.cop)
  setH(ws, 12, 18)

  filaDatos(13, "% Materiales / costo producción", (it) => (it.costoProd > 0 ? it.mpd / it.costoProd : 0), margenStyle, margenStyleL, FMT.pct)
  setH(ws, 13, 18)

  setCols(ws, [32, ...Array(N).fill(14)])
  wsRef(ws, 13, lastCol)
  return ws
}

// ---------------------------------------------------------------------------
// Hoja: Materiales
// ---------------------------------------------------------------------------
function buildMateriales(referencias) {
  const ws = {}
  const materiales = materialesUnicos(referencias)

  W(ws, 0, 0, "INDUSTRIAS DONSOON — MAESTRO DE MATERIALES", "s", S.hPri)
  merge(ws, 0, 0, 4, 0)
  for (let c = 1; c <= 4; c++) W(ws, c, 0, "", "s", S.hPri)
  setH(ws, 0, 26)

  W(ws, 0, 1, "Liste todos los materiales usados en producción...",
    "s", { font:{name:"Arial",italic:true,sz:9,color:{rgb:"595959"}}, fill:{fgColor:{rgb:"EBF3FB"}}, alignment:{horizontal:"center",vertical:"center"}, border: bd() })
  merge(ws, 0, 1, 4, 1)
  for (let c = 1; c <= 4; c++) {
    W(ws, c, 1, "", "s", { font:{name:"Arial",italic:true,sz:9,color:{rgb:"595959"}}, fill:{fgColor:{rgb:"EBF3FB"}}, alignment:{horizontal:"center",vertical:"center"}, border: bd() })
  }
  setH(ws, 1, 18)

  setH(ws, 2, 8)
  for (let c = 0; c <= 4; c++) W(ws, c, 2, "", "s", { fill: { fgColor: { rgb: "FFFFFF" } } })

  ;["Código", "Descripción del material", "Unidad", "Costo unit. (COP)", "Proveedor"].forEach((h, c) => W(ws, c, 3, h, "s", S.hSec))
  setH(ws, 3, 22)

  materiales.forEach((m, i) => {
    const r = 4 + i
    W(ws, 0, r, m.id, "s", S.codigo)
    W(ws, 1, r, m.nombre, "s", styleDato(i))
    W(ws, 2, r, m.unidad, "s", { ...styleDato(i), alignment: { horizontal: "center", vertical: "center" } })
    W(ws, 3, r, m.costo || 0, "n", styleNum(i), FMT.cop)
    W(ws, 4, r, m.proveedor || "—", "s", { ...styleDato(i), font: { ...styleDato(i).font, italic: true } })
  })

  setCols(ws, [12, 28, 12, 18, 20])
  wsRef(ws, Math.max(3, 3 + materiales.length), 4)
  return ws
}

// ---------------------------------------------------------------------------
// Hoja: Matriz Consumos
// ---------------------------------------------------------------------------
function buildMatrizConsumos(referencias, calc, parametros) {
  const ws = {}
  const N = referencias.length
  const lastCol = N + 3
  const materiales = materialesUnicos(referencias)

  W(ws, 0, 0, "MATRIZ DE CONSUMOS POR REFERENCIA — INDUSTRIAS DONSOON", "s", S.hPri)
  merge(ws, 0, 0, lastCol, 0)
  for (let c = 1; c <= lastCol; c++) W(ws, c, 0, "", "s", S.hPri)
  setH(ws, 0, 26)

  W(ws, 0, 1, "Ingrese la CANTIDAD de cada material por unidad producida...",
    "s", { font:{name:"Arial",italic:true,sz:9,color:{rgb:"595959"}}, fill:{fgColor:{rgb:"EBF3FB"}}, alignment:{horizontal:"center",vertical:"center"}, border: bd() })
  merge(ws, 0, 1, lastCol, 1)
  for (let c = 1; c <= lastCol; c++) {
    W(ws, c, 1, "", "s", { font:{name:"Arial",italic:true,sz:9,color:{rgb:"595959"}}, fill:{fgColor:{rgb:"EBF3FB"}}, alignment:{horizontal:"center",vertical:"center"}, border: bd() })
  }
  setH(ws, 1, 18)

  W(ws, 0, 2, "CÓDIGO", "s", S.hSec)
  W(ws, 1, 2, "MATERIAL", "s", S.hSec)
  W(ws, 2, 2, "UNIDAD", "s", S.hSec)
  W(ws, 3, 2, "COSTO UNIT.", "s", S.hSec)
  calc.forEach((it, i) => W(ws, 4 + i, 2, it.ref.id, "s", S.hSec))
  setH(ws, 2, 22)

  const fillAlt = { fill: { fgColor: { rgb: "EBF3FB" } } }
  for (let c = 0; c <= 3; c++) W(ws, c, 3, "", "s", { ...fillAlt, border: bd() })
  calc.forEach((it, i) => {
    W(ws, 4 + i, 3, it.ref.nombre, "s", { font:{name:"Arial",italic:true,sz:9,color:{rgb:"2E75B6"}}, fill:{fgColor:{rgb:"EBF3FB"}}, alignment:{horizontal:"center",vertical:"center",wrapText:true}, border: bd() })
  })
  setH(ws, 3, 16)

  const fillC = { fill: { fgColor: { rgb: "D6E4F0" } } }
  for (let c = 0; c <= 3; c++) W(ws, c, 4, "", "s", { ...fillC, border: bd() })
  calc.forEach((it, i) => {
    W(ws, 4 + i, 4, "cant/unid", "s", { font:{name:"Arial",italic:true,sz:9,color:{rgb:"595959"}}, fill:{fgColor:{rgb:"D6E4F0"}}, alignment:{horizontal:"center",vertical:"center"}, border: bd() })
  })
  setH(ws, 4, 14)

  let r = 5
  materiales.forEach((m, i) => {
    W(ws, 0, r, m.id, "s", S.codigo)
    W(ws, 1, r, m.nombre, "s", styleDato(i))
    W(ws, 2, r, m.unidad, "s", { ...styleDato(i), alignment: { horizontal: "center", vertical: "center" } })
    W(ws, 3, r, m.costo || 0, "n", styleNum(i), FMT.cop)
    calc.forEach((it, ci) => {
      const cons = (it.ref.consumos || []).find((c) => c.material && c.material.id === m.id)
      if (cons) {
        W(ws, 4 + ci, r, cons.cantidad || 0, "n", styleNum(i), FMT.dec3)
      } else {
        W(ws, 4 + ci, r, "", "s", styleNum(i))
      }
    })
    r++
  })

  // Costo materiales / unidad
  W(ws, 0, r, "COSTO MATERIALES / UNIDAD (COP)", "s", S.totalOscuroL)
  merge(ws, 0, r, 3, r)
  for (let c = 1; c <= 3; c++) W(ws, c, r, "", "s", S.totalOscuroL)
  calc.forEach((it, i) => W(ws, 4 + i, r, it.mpd, "n", S.totalOscuro, FMT.cop))
  setH(ws, r, 20)
  r++

  // Separador MOD
  W(ws, 0, r, "MANO DE OBRA DIRECTA", "s", S.sep)
  merge(ws, 0, r, lastCol, r)
  for (let c = 1; c <= lastCol; c++) W(ws, c, r, "", "s", S.sep)
  setH(ws, r, 18)
  r++

  const tarifaMOD = parametros.tarifaMOD

  W(ws, 0, r, "MOD-T", "s", S.codigo)
  W(ws, 1, r, "Tarifa MOD hora (COP) — ver hoja Parámetros", "s", styleDato(0))
  W(ws, 2, r, "", "s", styleDato(0))
  W(ws, 3, r, tarifaMOD, "n", S.num, FMT.cop)
  for (let c = 4; c <= lastCol; c++) W(ws, c, r, "", "s", styleNum(0))
  r++

  W(ws, 0, r, "MOD-H", "s", S.codigo)
  W(ws, 1, r, "Horas MOD por unidad producida ↓", "s", styleDato(1))
  W(ws, 2, r, "", "s", styleDato(1))
  W(ws, 3, r, "", "s", styleNum(1))
  referencias.forEach((ref, i) => W(ws, 4 + i, r, ref.hMOD || 0, "n", styleNum(1), FMT.hrs))
  r++

  W(ws, 0, r, "COSTO MOD / UNIDAD (COP)", "s", S.totalOscuroL)
  merge(ws, 0, r, 3, r)
  for (let c = 1; c <= 3; c++) W(ws, c, r, "", "s", S.totalOscuroL)
  calc.forEach((it, i) => W(ws, 4 + i, r, it.mod, "n", S.totalOscuro, FMT.cop))
  setH(ws, r, 20)
  r++

  // Separador CIF
  W(ws, 0, r, "COSTOS INDIRECTOS DE FABRICACIÓN (CIF)", "s", S.sep)
  merge(ws, 0, r, lastCol, r)
  for (let c = 1; c <= lastCol; c++) W(ws, c, r, "", "s", S.sep)
  setH(ws, r, 18)
  r++

  const tarifaCIF = parametros.tarifaCIF

  W(ws, 0, r, "CIF-T", "s", S.codigo)
  W(ws, 1, r, "Tarifa CIF hora-máquina (COP) — ver hoja Parámetros", "s", styleDato(0))
  W(ws, 2, r, "", "s", styleDato(0))
  W(ws, 3, r, tarifaCIF, "n", S.num, FMT.cop)
  for (let c = 4; c <= lastCol; c++) W(ws, c, r, "", "s", styleNum(0))
  r++

  W(ws, 0, r, "CIF-H", "s", S.codigo)
  W(ws, 1, r, "Horas máquina por unidad producida ↓", "s", styleDato(1))
  W(ws, 2, r, "", "s", styleDato(1))
  W(ws, 3, r, "", "s", styleNum(1))
  referencias.forEach((ref, i) => W(ws, 4 + i, r, ref.hCIF || 0, "n", styleNum(1), FMT.hrs))
  r++

  W(ws, 0, r, "COSTO CIF / UNIDAD (COP)", "s", S.totalOscuroL)
  merge(ws, 0, r, 3, r)
  for (let c = 1; c <= 3; c++) W(ws, c, r, "", "s", S.totalOscuroL)
  calc.forEach((it, i) => W(ws, 4 + i, r, it.cif, "n", S.totalOscuro, FMT.cop))
  setH(ws, r, 20)

  setCols(ws, [10, 26, 10, 14, ...Array(N).fill(13)])
  wsRef(ws, r, lastCol)
  return ws
}

// ---------------------------------------------------------------------------
// Hoja: Parámetros
// ---------------------------------------------------------------------------
function buildParametros(parametros) {
  const ws = {}

  W(ws, 0, 0, "INDUSTRIAS DONSOON — PARÁMETROS GENERALES", "s", S.hPri)
  merge(ws, 0, 0, 3, 0)
  for (let c = 1; c <= 3; c++) W(ws, c, 0, "", "s", S.hPri)
  setH(ws, 0, 26)

  setH(ws, 1, 8)
  for (let c = 0; c <= 3; c++) W(ws, c, 1, "", "s", { fill: { fgColor: { rgb: "FFFFFF" } } })

  const sep = (r, label) => {
    W(ws, 0, r, label, "s", S.sep)
    merge(ws, 0, r, 3, r)
    for (let c = 1; c <= 3; c++) W(ws, c, r, "", "s", S.sep)
    setH(ws, r, 20)
  }
  const fila = (r, label, valor, type, style, fmt) => {
    W(ws, 0, r, label, "s", styleDato(r))
    W(ws, 1, r, valor, type, style, fmt)
    W(ws, 2, r, "", "s", styleDato(r))
    W(ws, 3, r, "", "s", styleDato(r))
  }

  // EMPRESA
  sep(2, "EMPRESA")
  fila(3, "Nombre empresa", "Industrias Donsoon", "s", styleDato(3))
  fila(4, "Responsable costos", "Gerente General", "s", styleDato(4))
  fila(5, "Período de análisis", "Mensual", "s", styleDato(5))
  fila(6, "Moneda", "COP — Pesos colombianos", "s", styleDato(6))

  // MANO DE OBRA DIRECTA
  setH(ws, 7, 8)
  for (let c = 0; c <= 3; c++) W(ws, c, 7, "", "s", { fill: { fgColor: { rgb: "FFFFFF" } } })
  sep(8, "MANO DE OBRA DIRECTA")
  fila(9, "Total costo MOD mensual (COP)", 12300000, "n", styleNum(9), FMT.cop)
  fila(10, "Total horas MOD disponibles/mes", 768, "n", { ...styleNum(10), font: { name:"Arial", bold:true, sz:10, color:{rgb:"2E75B6"} } }, FMT.int)
  fila(11, "Tarifa MOD por hora (COP) — automático", parametros.tarifaMOD, "n", { ...styleNum(11), font: { name:"Arial", bold:true, sz:10, color:{rgb:"000000"} } }, FMT.cop)

  // CIF
  setH(ws, 12, 8)
  for (let c = 0; c <= 3; c++) W(ws, c, 12, "", "s", { fill: { fgColor: { rgb: "FFFFFF" } } })
  sep(13, "COSTOS INDIRECTOS (CIF)")
  fila(14, "Arriendo planta (COP/mes)", 3500000, "n", styleNum(14), FMT.cop)
  fila(15, "Energía eléctrica (COP/mes)", 1200000, "n", styleNum(15), FMT.cop)
  fila(16, "Agua y gas (COP/mes)", 400000, "n", styleNum(16), FMT.cop)
  fila(17, "Mantenimiento maquinaria (COP/mes)", 600000, "n", styleNum(17), FMT.cop)
  fila(18, "Depreciación equipos (COP/mes)", 800000, "n", styleNum(18), FMT.cop)
  fila(19, "Seguros planta (COP/mes)", 250000, "n", styleNum(19), FMT.cop)
  fila(20, "Otros CIF (COP/mes)", 300000, "n", styleNum(20), FMT.cop)

  W(ws, 0, 21, "TOTAL CIF MENSUAL — automático", "s", S.totalOscuroL)
  W(ws, 1, 21, 7050000, "n", S.totalOscuro, FMT.cop)
  W(ws, 2, 21, "", "s", S.totalOscuroL)
  W(ws, 3, 21, "", "s", S.totalOscuroL)

  fila(22, "Horas máquina disponibles/mes", 640, "n", styleNum(22), FMT.int)
  fila(23, "Tarifa CIF hora-máquina — automático", parametros.tarifaCIF, "n", { ...styleNum(23), font: { name:"Arial", bold:true, sz:10, color:{rgb:"000000"} } }, FMT.cop)

  // LEYENDA
  setH(ws, 24, 8)
  for (let c = 0; c <= 3; c++) W(ws, c, 24, "", "s", { fill: { fgColor: { rgb: "FFFFFF" } } })
  sep(25, "LEYENDA DE COLORES")

  W(ws, 0, 26, "Celda amarilla (texto azul): ingresar dato", "s", S.pctFilaL)
  merge(ws, 0, 26, 3, 26)
  for (let c = 1; c <= 3; c++) W(ws, c, 26, "", "s", S.pctFilaL)

  W(ws, 0, 27, "Celda gris: calculada automáticamente", "s", { font:{name:"Arial",sz:10,color:{rgb:"000000"}}, fill:{fgColor:{rgb:"F2F2F2"}}, alignment:{horizontal:"left",vertical:"center"}, border: bd() })
  merge(ws, 0, 27, 3, 27)
  for (let c = 1; c <= 3; c++) W(ws, c, 27, "", "s", { fill: { fgColor: { rgb: "F2F2F2" } }, border: bd() })

  W(ws, 0, 28, "Celda verde: vinculada desde otra hoja", "s", { ...S.varOk, alignment: { horizontal: "left", vertical: "center" } })
  merge(ws, 0, 28, 3, 28)
  for (let c = 1; c <= 3; c++) W(ws, c, 28, "", "s", S.varOk)

  setCols(ws, [30, 20, 12, 12])
  wsRef(ws, 28, 3)
  return ws
}

// ---------------------------------------------------------------------------
// Función principal
// ---------------------------------------------------------------------------
export function exportarExcel(referencias, parametros, periodoLabel) {
  const calc = referencias.map(r => ({ ref: r, ...calcCostos(r, parametros) }))
  const wb = XLSX.utils.book_new()
  wb.Workbook = { Sheets: [{},{},{},{}] }

  XLSX.utils.book_append_sheet(wb, buildResumenCostos(referencias, calc, parametros, periodoLabel), "📊 Resumen Costos")
  XLSX.utils.book_append_sheet(wb, buildMateriales(referencias), "🔩 Materiales")
  XLSX.utils.book_append_sheet(wb, buildMatrizConsumos(referencias, calc, parametros), "🔢 Matriz Consumos")
  XLSX.utils.book_append_sheet(wb, buildParametros(parametros), "⚙️ Parámetros")

  wb.Workbook.Sheets[0].TabColor = { rgb: "1F3864" }
  wb.Workbook.Sheets[1].TabColor = { rgb: "2E75B6" }
  wb.Workbook.Sheets[2].TabColor = { rgb: "065F46" }
  wb.Workbook.Sheets[3].TabColor = { rgb: "6B7280" }

  const nombre = `Donsoon_Costos_${(periodoLabel || "Todos").replace(/\s+/g,"_")}_${new Date().toISOString().slice(0,10)}.xlsx`
  XLSX.writeFile(wb, nombre)
}
