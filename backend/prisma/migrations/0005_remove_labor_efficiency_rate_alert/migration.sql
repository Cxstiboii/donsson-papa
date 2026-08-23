-- Migración: quitar eficienciaTiempoPct y alertaTarifa de CostLabor. Estas
-- métricas (eficiencia de tiempo, alerta por tarifa ejecutada > planeada +10%)
-- salen del alcance del módulo Costos Producción: la variación de Mano de
-- Obra / Carga Fabril ahora solo compara Ejecutado vs. Estándar en valor
-- monetario (variacionValor / variacionPct).
--
-- variacionCantidad/variacionValor/variacionPct pasan a ser nullable porque
-- ahora se basan en Std (cantStd/vrStd), que puede venir vacío del Excel —
-- antes se basaban en Plan, que siempre viene poblado.
--
-- IF EXISTS por el mismo motivo que 0003/0004 (ver incidente P3009).

ALTER TABLE "CostLabor" DROP COLUMN IF EXISTS "eficienciaTiempoPct";
ALTER TABLE "CostLabor" DROP COLUMN IF EXISTS "alertaTarifa";

ALTER TABLE "CostLabor" ALTER COLUMN "variacionCantidad" DROP NOT NULL;
ALTER TABLE "CostLabor" ALTER COLUMN "variacionValor" DROP NOT NULL;
ALTER TABLE "CostLabor" ALTER COLUMN "variacionPct" DROP NOT NULL;
