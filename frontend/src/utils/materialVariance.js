// Use case (frontend): derive the Materia Prima table's variance columns
// against the real Std (Cant./Vr. x Ud. Planeado Standard, imported from the
// Odoo Excel) — same convention as Mano de Obra/Carga Fabril:
// Var. Valor = Ejec Valor - Std Valor; Var. % = that / Std Valor x 100.
// Órdenes importadas antes de que se capturara el Std real no tienen
// cantStd/vrStd: en ese caso se usa la variación vs. Plan ya calculada y
// guardada en el backend (variacionCantidad/Valor/Pct) en vez de dejar "—".

/**
 * @param {{cantStd: number|null, vrStd: number|null, cantEjecutado: number, vrEjecutado: number,
 *   variacionCantidad: number, variacionValor: number, variacionPct: number}} item
 */
export function computeMaterialViewModel(item) {
  const hasStd = item.cantStd != null && item.vrStd != null;
  const varCant = hasStd ? item.cantEjecutado - item.cantStd : item.variacionCantidad;
  const varValor = hasStd ? item.vrEjecutado - item.vrStd : item.variacionValor;
  let varPct = item.variacionPct;
  if (hasStd) varPct = item.vrStd ? (varValor / item.vrStd) * 100 : null;

  return { ...item, varCant, varValor, varPct, varVsPlan: !hasStd };
}
