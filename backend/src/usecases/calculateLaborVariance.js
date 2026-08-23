// Use case: variance calculation for Mano de Obra / Carga Fabril rows.
// Pure functions — no DB, no HTTP, no XLSX.
require("../domain/costEntities");

const STANDARD_RATE_MO = 3.80;
const STANDARD_RATE_CF = 9.30;
const RATE_TOLERANCE = 0.05;

function safeDiv(a, b) {
  if (!b || isNaN(b) || b === 0 || isNaN(a)) return null;
  return a / b;
}

function pctOf(numerator, base) {
  if (!base || base === 0 || isNaN(base)) return null;
  return (numerator / base) * 100;
}

/**
 * @param {{tipo: "mano_obra"|"carga_fabril", proceso: string, cantStd: number, vrStd: number,
 *   cantPlan: number, vrPlan: number, cantEjec: number, vrEjec: number}} raw
 * @returns {LaborCostItem}
 */
function calculateLaborVarianceItem({ tipo, proceso, cantStd, vrStd, cantPlan, vrPlan, cantEjec, vrEjec }) {
  const tarifaStd = safeDiv(vrStd, cantStd);
  const tarifaPlaneada = safeDiv(vrPlan, cantPlan);
  const tarifaEjecutada = safeDiv(vrEjec, cantEjec);

  const hasStd = cantStd != null && !isNaN(cantStd) && vrStd != null && !isNaN(vrStd);

  return {
    tipo,
    proceso,
    cantStd: isNaN(cantStd) ? null : cantStd,
    vrStd: isNaN(vrStd) ? null : vrStd,
    tarifaStd,
    cantPlaneado: cantPlan,
    vrPlaneado: vrPlan,
    tarifaPlaneada,
    cantEjecutado: cantEjec,
    vrEjecutado: vrEjec,
    tarifaEjecutada,
    variacionCantidad: hasStd ? cantEjec - cantStd : null,
    variacionValor: hasStd ? vrEjec - vrStd : null,
    variacionPct: hasStd ? pctOf(vrEjec - vrStd, vrStd) : null,
  };
}

/**
 * Data-quality check: does the imported Std tarifa deviate from the expected
 * plant-wide standard rate? Independent of the (removed) eficiencia/alertaTarifa
 * logic — this only validates the Excel input.
 */
function checkStandardRateDeviation(tarifaStd, expectedRate, tolerance = RATE_TOLERANCE) {
  if (tarifaStd === null) return false;
  return Math.abs(tarifaStd - expectedRate) > tolerance;
}

module.exports = {
  STANDARD_RATE_MO,
  STANDARD_RATE_CF,
  RATE_TOLERANCE,
  safeDiv,
  calculateLaborVarianceItem,
  checkStandardRateDeviation,
};
