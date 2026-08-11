-- Migración: agregar Parametros.pctStdMateriaPrima (% que se resta de la
-- Cant. Plan de cada materia prima para obtener la columna "Cant. Std Calc" /
-- "Vr. Std Calc" en la tabla de materiales de una orden). Puramente aditiva,
-- con valor por defecto para que las filas existentes queden en 6%.
--
-- IF NOT EXISTS por el mismo motivo que 0003 (ver incidente P3009).

ALTER TABLE "Parametros" ADD COLUMN IF NOT EXISTS "pctStdMateriaPrima" DOUBLE PRECISION NOT NULL DEFAULT 6;
