// Use case: variance calculation for Materia Prima rows (persisted/backend view,
// Plan-based — used for the >20% overconsumption alert and import warnings.
// The table's displayed Var. Cant/Valor/% use the real Std instead, computed
// client-side in frontend/src/utils/materialVariance.js from cantStd/vrStd.
require("../domain/costEntities");

const OVERCONSUMPTION_THRESHOLD = 1.20; // Ejecutado > Planeado * 120%

function pctOf(numerator, base) {
  if (!base || base === 0 || isNaN(base)) return 0;
  return (numerator / base) * 100;
}

/**
 * @param {{insumo: string, costoMp: number, cantStd: number, vrStd: number,
 *   cantPlan: number, vrPlanExcel: number, cantEjec: number, vrEjecExcel: number}} raw
 * @returns {RawMaterialItem}
 */
function calculateRawMaterialVarianceItem({ insumo, costoMp, cantStd, vrStd, cantPlan, vrPlanExcel, cantEjec, vrEjecExcel }) {
  const vrPlan = vrPlanExcel > 0 ? vrPlanExcel : cantPlan * costoMp;
  const vrEjec = vrEjecExcel > 0 ? vrEjecExcel : cantEjec * costoMp;
  const variacionValor = vrEjec - vrPlan;
  const alertaCantidad = cantPlan > 0 && cantEjec > cantPlan * OVERCONSUMPTION_THRESHOLD;

  return {
    insumo,
    costoMp,
    cantStd: isNaN(cantStd) ? null : cantStd,
    vrStd: isNaN(vrStd) ? null : vrStd,
    cantPlaneado: cantPlan,
    vrPlaneado: vrPlan,
    cantEjecutado: cantEjec,
    vrEjecutado: vrEjec,
    variacionCantidad: cantEjec - cantPlan,
    variacionValor,
    variacionPct: pctOf(variacionValor, vrPlan),
    alertaCantidad,
  };
}

module.exports = {
  OVERCONSUMPTION_THRESHOLD,
  calculateRawMaterialVarianceItem,
};
