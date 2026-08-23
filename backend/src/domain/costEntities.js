// Domain layer: pure shape contracts for the Costos Producción module.
// No imports, no framework/DB dependencies — just typedefs consumed by
// usecases/*, routes/importarCostos.js, and (informally) the frontend.

/**
 * @typedef {Object} ProductionOrder
 * @property {string} orden
 * @property {string} documentoOrigen
 * @property {string} producto
 * @property {string} productoCodigo
 * @property {string} refDonsson
 * @property {string} productoClase
 * @property {number} cantidadFabricada
 * @property {Date} fechaInicial
 * @property {Date} fechaFinal
 * @property {string} estado
 * @property {number} totalPlaneado
 * @property {number} totalEjecutado
 * @property {number} totalVariacion
 */

/**
 * @typedef {Object} LaborCostItem
 * @property {"mano_obra"|"carga_fabril"} tipo
 * @property {string} proceso
 * @property {number|null} cantStd
 * @property {number|null} vrStd
 * @property {number|null} tarifaStd
 * @property {number} cantPlaneado
 * @property {number} vrPlaneado
 * @property {number|null} tarifaPlaneada
 * @property {number} cantEjecutado
 * @property {number} vrEjecutado
 * @property {number|null} tarifaEjecutada
 * @property {number|null} variacionCantidad
 * @property {number|null} variacionValor
 * @property {number|null} variacionPct
 */

/**
 * @typedef {Object} RawMaterialItem
 * @property {string} insumo
 * @property {number} costoMp
 * @property {number|null} cantStd
 * @property {number|null} vrStd
 * @property {number} cantPlaneado
 * @property {number} vrPlaneado
 * @property {number} cantEjecutado
 * @property {number} vrEjecutado
 * @property {number} variacionCantidad
 * @property {number} variacionValor
 * @property {number} variacionPct
 * @property {boolean} alertaCantidad
 */

/**
 * @typedef {Object} CostSummary
 * @property {number} totalPlaneado
 * @property {number} totalEjecutado
 * @property {number} totalVariacion
 */

module.exports = {};
