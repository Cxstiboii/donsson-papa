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

export function parseCOP(str) {
  return Number(String(str).replace(/\./g, "").replace(/,/g, "")) || 0;
}

export function formatCOP(num) {
  if (num === "" || num == null) return "";
  const n = Number(String(num).replace(/\./g, ""));
  if (isNaN(n)) return "";
  return n.toLocaleString("es-CO");
}
