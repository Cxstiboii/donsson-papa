export function calcCostos(ref, params) {
  const mpd = (ref.consumos || []).reduce((s, c) => {
    return s + (c.material?.costo || 0) * (c.cantidad || 0);
  }, 0);
  const mod = ref.segMOD || 0;
  const cif = ref.cifUnitario || 0;
  const costoProd = mpd + mod + cif;
  const costoTotal = costoProd * (1 + (params.pctGAV || 0) / 100);
  const divisorMargen = 1 - (params.pctMargen || 0) / 100;
  const precioVenta = divisorMargen > 0 ? costoTotal / divisorMargen : costoTotal;
  const costoReal = ref.costoReal || 0;
  const variacion = costoReal > 0 ? ((costoProd - costoReal) / costoReal) * 100 : null;
  return {
    mpd,
    mod,
    cif,
    costoProd,
    costoTotal,
    precioVenta,
    margenBruto: precioVenta - costoProd,
    costoReal,
    variacion,
  };
}

export function calcCostosEstandar(ref, params) {
  const imp = ref.costosImportados;
  if (!imp) {
    const c = calcCostos(ref, params);
    return {
      mpd: c.mpd,
      mod: c.mod,
      cif: c.cif,
      costoEstandar: c.costoProd,
      costoOdoo: c.costoReal || 0,
      variacion: c.variacion,
      fuenteImportada: false,
    };
  }
  const costoEstandar = imp.costoEstandar ?? (imp.mpd + imp.mod + imp.cif);
  const costoOdoo = imp.costoOdoo ?? 0;
  const variacion =
    costoEstandar > 0 && costoOdoo > 0
      ? ((costoOdoo - costoEstandar) / costoEstandar) * 100
      : null;
  return {
    mpd: imp.mpd,
    mod: imp.mod,
    cif: imp.cif,
    costoEstandar,
    costoOdoo,
    variacion,
    fuenteImportada: true,
  };
}

export function COP(v) {
  if (v == null || isNaN(v)) return "$ 0,00";
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v);
}

export const mesLabel = (ym) => {
  if (!ym) return "—";
  const [y, m] = ym.split("-");
  const n = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  return `${n[+m - 1]} ${y}`;
};

export const UNIDADES = [
  "unidad", "m²", "kg", "litro", "juego", "metro", "rollo",
  "cm", "mm", "gramo", "par", "set", "lámina", "tubo", "varilla",
];

export const COLORS = {
  azulOscuro: "#1F3864",
  azulMedio: "#2E75B6",
  azulClaro: "#D6E4F0",
  verdeOscuro: "#065F46",
  verdeClaro: "#D1FAE5",
  amberTexto: "#92400E",
  amberFondo: "#FEF3C7",
  rojoTexto: "#991B1B",
  rojoFondo: "#FEE2E2",
  gris: "#F1F5F9",
  blanco: "#FFFFFF",
};

// Convierte string en formato colombiano ("1.234,56" o "1234.56") a número
export function parseCOP(str) {
  const s = String(str).trim().replace(/\./g, "").replace(",", ".");
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

// Convierte una cantidad tecleada con coma decimal ("12,5") a número.
// A diferencia de parseCOP, no asume separador de miles (las cantidades
// pesadas no llegan a esos órdenes de magnitud).
export function parseCantidad(str) {
  const s = String(str).trim().replace(",", ".");
  const n = parseFloat(s);
  return n;
}

// Formatea número a string en formato colombiano para inputs de tipo text
export function formatCOP(num) {
  const n = Number(num);
  if (isNaN(n)) return "";
  return n.toLocaleString("es-CO", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export function fmt(v, dec = 0) {
  if (v == null || isNaN(Number(v))) return "—";
  return Number(v).toLocaleString("es-CO", {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  });
}
