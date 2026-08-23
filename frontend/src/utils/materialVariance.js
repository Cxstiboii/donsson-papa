// Use case (frontend): derive the Materia Prima table's variance columns
// against the real Std (Cant./Vr. x Ud. Planeado Standard, imported from the
// Odoo Excel) — same convention as Mano de Obra/Carga Fabril:
// Var. Valor = Ejec Valor - Std Valor; Var. % = that / Std Valor x 100.

/**
 * @param {{cantStd: number|null, vrStd: number|null, cantEjecutado: number, vrEjecutado: number}} item
 */
export function computeMaterialViewModel(item) {
  const hasStd = item.cantStd != null && item.vrStd != null;
  const varCant = hasStd ? item.cantEjecutado - item.cantStd : null;
  const varValor = hasStd ? item.vrEjecutado - item.vrStd : null;
  const varPct = hasStd && item.vrStd ? (varValor / item.vrStd) * 100 : null;

  return { ...item, varCant, varValor, varPct };
}
