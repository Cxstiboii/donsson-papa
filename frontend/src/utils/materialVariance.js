// Use case (frontend): derive the Materia Prima table's Std Calc baseline and
// its variance columns. Lives client-side because it depends on the live,
// user-editable Parametros.pctStdMateriaPrima — it can't be precomputed by
// the backend at import time.

/**
 * @param {{cantPlaneado: number, costoMp: number, cantEjecutado: number, vrEjecutado: number}} item
 * @param {number} pctStd percentage subtracted from Plan Cant to get the Std Calc baseline
 */
export function computeMaterialViewModel(item, pctStd) {
  const cantStdCalc = item.cantPlaneado != null ? item.cantPlaneado * (1 - pctStd / 100) : null;
  const vrStdCalc = cantStdCalc != null ? cantStdCalc * (item.costoMp ?? 0) : null;
  const varCant = cantStdCalc != null ? item.cantEjecutado - cantStdCalc : null;
  const varValor = vrStdCalc != null ? item.vrEjecutado - vrStdCalc : null;
  const varPct = vrStdCalc ? (varValor / vrStdCalc) * 100 : null;

  return { ...item, cantStdCalc, vrStdCalc, varCant, varValor, varPct };
}
