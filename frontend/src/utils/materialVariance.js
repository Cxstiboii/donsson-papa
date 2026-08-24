// Use case (frontend): derive the Materia Prima table's Std columns and
// variance columns.
//
// Std Cant/Valor: preferimos el Std real importado (Cant./Vr. x Ud. Planeado
// Standard del Excel). Las órdenes importadas antes de que ese dato se
// capturara no lo tienen — para esas usamos el "Std Calc" (Plan Cant menos
// un % editable, Parametros.pctStdMateriaPrima) en vez de dejar la columna
// vacía.
//
// Var. Cant/Valor/%: SIEMPRE Ejecutado vs. Std (real o, si no hay, Std Calc)
// — nunca vs. Plan — igual que Mano de Obra/Carga Fabril.

/**
 * @param {{cantStd: number|null, vrStd: number|null, cantPlaneado: number, costoMp: number,
 *   cantEjecutado: number, vrEjecutado: number}} item
 * @param {number} [pctStd] % que se resta de Plan Cant para el Std Calc cuando no hay Std real
 */
export function computeMaterialViewModel(item, pctStd = 6) {
  const hasStd = item.cantStd != null && item.vrStd != null;

  const cantStdCalc = item.cantPlaneado != null ? item.cantPlaneado * (1 - pctStd / 100) : null;
  const vrStdCalc = cantStdCalc != null ? cantStdCalc * (item.costoMp ?? 0) : null;
  const cantStd = hasStd ? item.cantStd : cantStdCalc;
  const vrStd = hasStd ? item.vrStd : vrStdCalc;

  const varCant = cantStd != null ? item.cantEjecutado - cantStd : null;
  const varValor = vrStd != null ? item.vrEjecutado - vrStd : null;
  const varPct = vrStd ? (varValor / vrStd) * 100 : null;

  return { ...item, cantStd, vrStd, varCant, varValor, varPct, stdEsCalc: !hasStd };
}
