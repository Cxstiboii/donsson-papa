# AUDITORÍA TÉCNICA V2 — Donsoon Costos

> Fecha: Julio 2026 · Auditoría de regresión + preparación para recalibración de tarifa MOD y reimportación masiva
> Modo lectura, sin modificaciones de código (solo este archivo y, si aplica, DOCUMENTACION_SISTEMA.md)

---

## Resumen ejecutivo

Los 4 hallazgos críticos de la auditoría anterior (`AUDITORIA_2026-07.md`) están **correctamente corregidos y verificados en el código actual**, sin instancias residuales. Sin embargo, esta segunda pasada — enfocada en los dos eventos que se avecinan (recalibración de tarifa MOD 3,80→~5,20 y reimportación masiva de 50+ órdenes) — encontró **2 hallazgos CRÍTICOS nuevos** que no existían como tales en la auditoría anterior porque nadie había presionado todavía el flujo de "reimportar la misma orden con un archivo distinto" ni el de "cambiar la tarifa estándar":

1. **Filas huérfanas en `CostLabor`/`CostMaterial` nunca se borran al reimportar** — si un archivo nuevo tiene menos procesos o materiales que el anterior (algo típico en una reimportación masiva de 50+ órdenes), las filas viejas se quedan en la base de datos y se **siguen sumando** en MPD, MOD, CIF, el análisis de variación y el Excel exportado. Esto infla los totales en silencio.
2. **El análisis de variación (bridge MOD/CIF) usa una constante global hardcodeada (`3.80`/`9.30`) en vez de la tarifa estándar que ya se guarda por orden** (`CostLabor.tarifaStd`, `vrStd`). Esto significa que el día que se cambie la constante a `5.20`, **todas las órdenes históricas ya importadas cambiarán de desglose retroactivamente** la próxima vez que alguien abra el modal de variación — aunque el costo estándar total (que sí viene de un snapshot de Odoo) permanece intacto.

Ambos hallazgos son bloqueantes para los dos eventos anunciados y se detallan con evidencia en los bloques 2 y 3.

---

## BLOQUE 1 — Regresión sobre las correcciones anteriores

### ✅ [VERIFICADO-FIJO] CRÍTICO-1 original — Colores de variación invertidos

Búsqueda completa del patrón `variacion >` / `variacionClass` / colores verde-rojo en todo el repo. Único lugar donde se pinta variación en la tabla principal y el drawer:

- `frontend/src/components/Referencias.jsx:668-672` — tabla principal: `variacion > 0 ? "badge-error" : variacion < 0 ? "badge-success"`. Correcto: positivo (sobrecosto) = rojo.
- `frontend/src/components/Referencias.jsx:1122-1123` — drawer: `c.variacion > 0 ? "#991B1B" : c.variacion < 0 ? "#065F46"`. Correcto.
- `frontend/src/exportExcel.js:286` — hoja Excel: `v > 0 ? S.varAlerta : v < 0 ? S.varOk`, y `S.varAlerta` usa `C.rojo` (línea 15), `S.varOk` usa `C.verde` (línea 12). Correcto.
- No quedan instancias con la lógica invertida en `frontend/src/components/ImportarCostos.jsx` (usa `PctBadge` con semántica propia y correcta: positivo = malo, líneas 29-42).

**Veredicto: corregido sin instancias residuales.**

### ✅ [VERIFICADO-FIJO] CRÍTICO-2 original — Restricciones únicas ausentes

- `backend/prisma/migrations/0002_unique_constraints/migration.sql:26-27` crea `CREATE UNIQUE INDEX IF NOT EXISTS "CostLabor_orderId_proceso_key"` y `"CostMaterial_orderId_insumo_key"`, precedido de una deduplicación (líneas 9-23) que conserva el registro con mayor `id` por grupo.
- Es **idempotente** (`IF NOT EXISTS`), por lo que aplicarla en un entorno donde los índices ya existan (por ejemplo, si se creó manualmente antes) no falla.
- **Prueba de "fresh DB" (ver 1.2 abajo): el estado final coincide exactamente con `schema.prisma:106` y `:126`.**

**Veredicto: corregido correctamente, con protección contra reaplicación.**

### ✅ [VERIFICADO-FIJO, vía rediseño] CRÍTICO-3 original — `tarifaMOD` código muerto

`schema.prisma:51-53` ahora documenta explícitamente los tres campos de `Parametros` como `DEPRECATED` en el propio comentario del schema, y `DOCUMENTACION_SISTEMA.md:61,100` los describe igual. `frontend/src/utils/costos.js:5-6` sigue sin usar `tarifaMOD` en `calcCostos`, pero eso ya es la decisión documentada (el costo MOD es COP directo, no segundos × tarifa). El Excel (`exportExcel.js:472`) elimina la fila "Tarifa MOD hora" que antes generaba la falsa impresión de uso.

**Veredicto: el campo sigue sin usarse (por diseño), pero ya no hay ambigüedad ni información engañosa. Riesgo residual bajo — ver PREGUNTA-5.**

### ✅ [VERIFICADO-FIJO] CRÍTICO-4 original — Excel etiqueta `segMOD` como "Segundos MOD"

`frontend/src/exportExcel.js:401-406`:
```js
// FIX: segMOD almacena COP (no segundos); tarifaMOD no interviene en cálculos
setCell(ws, 1, r, "MOD-C", S.codigo)
setCell(ws, 2, r, "MOD (COP) por unidad producida ↓", styleDato(0))
```
Código de fila cambiado de `"MOD-S"` a `"MOD-C"`, etiqueta corregida a "MOD (COP)". `DOCUMENTACION_SISTEMA.md:231,338` documenta correctamente que `segMOD` almacena COP a pesar del nombre.

**Veredicto: corregido.**

### 1.2 Estado de las migraciones — ¿`prisma migrate deploy` en una DB vacía reproduce `schema.prisma`?

Revisé `migrations/0001_init/migration.sql` completo y `0002_unique_constraints/migration.sql` completo contra `schema.prisma`.

- `0001_init` crea las 8 tablas sin los índices únicos de `CostLabor`/`CostMaterial` (por diseño — ese es el bug que corrigió el hallazgo anterior).
- `0002_unique_constraints` primero deduplica (no-op en una DB vacía: los `DELETE ... WHERE id NOT IN (SELECT MAX(id) ...)` no borran nada porque no hay grupos con más de una fila) y luego crea los dos índices únicos que `schema.prisma:106,126` declara.
- Resultado en una DB vacía tras `migrate deploy`: **coincide exactamente con `schema.prisma`.** No hay drift.
- `migration_lock.toml` declara `provider = "postgresql"`, consistente con `schema.prisma:6`.

**Veredicto: estado de migraciones sano. Sin drift entre `migrations/` y `schema.prisma`.**

### 1.3 ¿Export y UI producen los mismos números?

- `frontend/src/exportExcel.js:2,499` importa y usa `calcCostosEstandar` de `utils/costos.js` — la **misma** función que usa la tabla principal (`Referencias.jsx:663`) y el drawer (`Referencias.jsx:1103`).
- `materialesDeReferencia()` en `exportExcel.js:202-229` replica la misma regla de "una fuente u otra, nunca mezcladas" que usa el drawer de `Referencias.jsx:954-1099` (bloque `costosImportados ? <TablaMateriasImportadas/> : <manual/>`), pero es una **implementación separada y duplicada**, no una función compartida importada de `utils/costos.js`. Ver hallazgo de arquitectura en Bloque 2.
- Redondeo: tanto la tabla (`c.variacion.toFixed(1)`, `Referencias.jsx:694`) como el Excel (`FMT.pct = '0.0%'`, `exportExcel.js:24`) usan un decimal — consistente.

**Veredicto: los números coinciden porque comparten `calcCostosEstandar`. La única duplicación real de lógica de cálculo (no solo de presentación) es `materialesDeReferencia`, presente tanto en `exportExcel.js` como, de forma equivalente pero no compartida, en el backend (`referencias.js:agregarCostosImportados`) y en el drawer de `Referencias.jsx`. Ver 2.3.**

---

## BLOQUE 2 — El modelo dual de materiales

### 2.1 Mapa de lectura de materiales (file:line)

| Sitio | Fuente Odoo (`CostMaterial`/`CostOrder`) | Fuente manual (`Consumo`/`Material`) | Lógica de selección |
|---|---|---|---|
| `backend/src/routes/referencias.js:17-53` (`agregarCostosImportados`) | `order.materials` (líneas 30,36) | — (no la toca; el `ref` base ya trae `consumos` vía `includeConsumos`, línea 6) | Si hay órdenes relacionadas (`related.length`), agrega `costosImportados`; si no, el objeto expuesto solo trae `consumos` crudos |
| `frontend/src/utils/costos.js:26-55` (`calcCostosEstandar`) | `ref.costosImportados.{mpd,mod,cif,costoOdoo}` (líneas 40-41) | `calcCostos(ref, params)` → `ref.consumos` (línea 2-4) | `if (!imp) { usar calcCostos }` — línea 28 |
| `frontend/src/exportExcel.js:202-229` (`materialesDeReferencia`) | `ref.costosImportados.materials` (línea 204) | `ref.consumos` (línea 216) | `if (ref.costosImportados) { ... } return (ref.consumos...)` — línea 203 |
| `frontend/src/components/Referencias.jsx:954-1099` (drawer) | `<TablaMateriasImportadas materials={drawerRef.costosImportados.materials}>` (línea 958) | tabla manual con `drawerRef.consumos` (líneas 976-1095) | `drawerRef.costosImportados ? <...Importado /> : <...Manual/>` — línea 954 |
| `backend/src/routes/referencias.js:135-277` (`GET /:id/variacion`) | Únicamente `CostOrder`/`CostLabor`/`CostMaterial` (líneas 143-195) | No aplica — este endpoint solo existe para referencias con órdenes importadas | Requiere `orders.length > 0` (línea 154) |
| `backend/src/routes/importarOP.js:87-112` | — | Escribe en `Consumo`/`Material` (reemplazo total: `deleteMany` + `createMany`, líneas 101-112) | Es el único punto de escritura del lado "manual" vía importación (además de la edición manual en el drawer) |

### 2.2 ¿Qué pasa si una referencia tiene AMBAS fuentes pobladas?

Es posible: una referencia se crea manualmente con `Consumo`s (o vía `POST /api/importar-op`), y **luego** se le importa una orden real por `POST /api/importar-costos`, lo que crea filas en `CostMaterial`/`CostLabor` para esa `refDonsson` sin tocar ni borrar los `Consumo`s existentes (`importarCostos.js:336-348` solo hace upsert de `Referencia.segMOD/cifUnitario/mes/nombre/familia`, nunca toca `Consumo`).

**Quién gana:** en los 4 sitios de lectura (tabla, drawer, export, backend `agregarCostosImportados`), el criterio es idéntico: **`costosImportados` (Odoo) gana siempre si existe**, y `Consumo` (manual) queda ignorado — pero **no eliminado**, sigue en la base de datos. Es consistente entre los 4 sitios (verificado línea por línea arriba), así que no hay riesgo de que la UI muestre un número y el Excel otro. El comentario en `exportExcel.js:199-201` documenta explícitamente esta regla ("Nunca se mezclan ambas fuentes").

**Riesgo real:** los `Consumo`s manuales quedan como datos huérfanos e invisibles — si más adelante se borran las órdenes importadas (`DELETE /api/importar-costos/:id`, `importarCostos.js:467-477`), la referencia "revive" mostrando de golpe los consumos manuales antiguos, que pueden estar desactualizados. No es un bug de cálculo (la lógica es consistente) pero sí una trampa de datos obsoletos silenciosos.

### 2.3 Recomendación de consolidación (no implementada)

- Crear en `frontend/src/utils/costos.js` una única función `materialesDeReferencia(ref)` (mover la que hoy vive solo en `exportExcel.js:202-229`) y hacer que `Referencias.jsx` la importe y la use en el drawer en lugar de reimplementar el branching (líneas 954-1099) con JSX propio.
- En el backend, `agregarCostosImportados` (`referencias.js:17-53`) no puede compartir código JS directamente con el frontend sin un paquete común, pero debería documentarse como el "contrato canónico" (mismo criterio: Odoo gana si existe) y, si se justifica el esfuerzo, extraerse a un módulo `backend/src/lib/costos.js` compartido conceptualmente (mismo nombre de función, mismos campos de salida) para reducir el riesgo de que diverja con el tiempo.
- **Radio de impacto estimado:** 4 archivos (`utils/costos.js`, `exportExcel.js`, `Referencias.jsx`, `referencias.js` backend), sin cambios de schema. Esfuerzo: **M** (medio) — el riesgo no es técnico sino de introducir una regresión sutil en un cálculo que hoy funciona correctamente en los 4 sitios.

---

## BLOQUE 3 — Preparación para los dos eventos anunciados

### 3.1 Recalibración de tarifa MOD (3,80 → ~5,20)

**Dónde aparecen las constantes 3,80 y 9,30 (búsqueda completa del repo):**

| Archivo:línea | Constante | Uso | ¿Afecta valores guardados o mostrados? |
|---|---|---|---|
| `backend/src/routes/importarCostos.js:29-30` | `TARIFA_STD_MO = 3.80`, `TARIFA_STD_CF = 9.30` | Solo genera `warnings` si la tarifa del Excel se desvía (líneas 176-178, 212-214) | No — informativo |
| `backend/src/routes/referencias.js:132-133` | `TARIFA_STD_MOD = 3.80`, `TARIFA_STD_CIF = 9.30` | **Sí afecta:** usado en la descomposición de varianza del endpoint `/variacion` (líneas 199-200, 204-205), que alimenta el `BridgeTable` que ve el operador (`Referencias.jsx:228-271`) | **Sí — visible en pantalla** |

No aparece en ningún seed, `.env.example` ni archivo de configuración — están hardcodeadas directamente en el código de ambas rutas.

**Veredicto: cambiar la tarifa hoy requiere editar 2 archivos como mínimo** (`importarCostos.js` y `referencias.js`), tal como ya señalaba `ALTO-1` de la auditoría anterior — **ese hallazgo NO fue corregido**, sigue exactamente igual.

**Hallazgo nuevo y más grave — [CRÍTICO] La descomposición de varianza usa la constante global en vez de la tarifa estándar ya guardada por orden:**

`backend/src/routes/referencias.js:198-205`:
```js
const tarifaRealMOD = segEjecMOD > 0 ? vrEjecMOD / segEjecMOD : null;
const varTiempoMOD = (segStdMOD - segEjecMOD) * TARIFA_STD_MOD;              // ← constante global
const varTarifaMOD = tarifaRealMOD !== null ? (TARIFA_STD_MOD - tarifaRealMOD) * segEjecMOD : null;  // ← constante global
```

Sin embargo, **cada fila de `CostLabor` ya guarda su propia tarifa estándar** al momento de la importación: `importarCostos.js:172` (`cfTarifaStd = safeDiv(cfVrStd, cfCantStd)`) y `:206` (`tarifaStd = safeDiv(vrStd, cantStd)`), persistida en `CostLabor.tarifaStd` (`schema.prisma:93`). El endpoint de variación **lee** `l.cantStd` y `l.vrStd` (líneas 174-182) pero **nunca lee `l.tarifaStd`** — usa la constante `TARIFA_STD_MOD`/`TARIFA_STD_CIF` fija en el código en su lugar.

**Impacto concreto:** el `costoEstandar` total (`referencias.js:234`, suma de `vrStdMOD + vrStdCIF + mpdVrPlanTotal`) es un snapshot inmutable de lo que Odoo reportó en el momento de cada importación — ese número **no cambia** cuando se recalibre la tarifa. Pero el desglose "Eficiencia (tiempo)" vs "Tarifa" que ve el operador en el modal de Análisis de Variación (`BridgeTable`, `Referencias.jsx:228-271`) **sí se recalcula en cada petición** usando la constante del código. El día que `TARIFA_STD_MOD` pase de `3.80` a `5.20` en el código, **todas las órdenes ya importadas — incluidas las de meses anteriores — mostrarán un desglose distinto la próxima vez que alguien abra ese modal**, aunque el costo total no cambie. Esto viola directamente el requisito de que los costos estándar de meses pasados no se re-valoren retroactivamente.

**Diseño con vigencia por fecha — qué necesitaría:**
1. Dejar de usar la constante global en la descomposición; usar en su lugar la tarifa ya almacenada por fila (`l.tarifaStd`, o derivarla como `vrStdMOD / segStdMOD` si se prefiere una tarifa efectiva agregada del período). Esto es puramente correctivo, sin necesidad de nuevo schema.
2. Para la tarifa usada en `importarCostos.js` como umbral de alerta (no afecta datos guardados), sí tiene sentido que sea editable y única — ahí `Parametros.tarifaMOD` (ya existe en el schema, hoy `DEPRECATED`) podría reactivarse como el valor "actual" de referencia para las alertas de importación, sin tocar el cálculo de variación histórica.
3. Si en el futuro se necesita que la comparación de variación use "la tarifa vigente en la fecha de la orden" en vez de la tarifa estándar propia de cada orden (que ya cumple ese rol al venir de Odoo), se necesitaría una tabla `TarifaEstandar(concepto, valor, vigenteDesde)` — pero dado que `CostLabor.tarifaStd` ya captura el valor correcto por orden, probablemente **no hace falta** esa tabla nueva; alcanza con dejar de ignorar el dato que ya se guarda.

### 3.2 Reimportación masiva (50+ órdenes)

**[CRÍTICO] Filas huérfanas de `CostLabor`/`CostMaterial` nunca se eliminan al reimportar — inflan los totales silenciosamente**

`backend/src/routes/importarCostos.js:379-386` (materiales, dentro de la transacción):
```js
for (const item of mpItems) {
  await tx.costMaterial.upsert({
    where: { orderId_insumo: { orderId: savedOrder.id, insumo: item.insumo } },
    create: { orderId: savedOrder.id, ...item },
    update: item,
  });
}
```
y `:393-404` (mano de obra/CIF, fuera de la transacción) hacen exactamente lo mismo: **upsert por cada fila presente en el Excel actual**. Ninguno de los dos bloques borra filas de `CostLabor`/`CostMaterial` que pertenecían a esa `orderId` en una importación anterior pero que **ya no aparecen** en el archivo nuevo (por ejemplo, si Odoo dejó de reportar un proceso de MO, o un insumo se consolidó con otro).

Esas filas huérfanas **no son inertes**: se leen y sumsan en cada consulta posterior:
- `backend/src/routes/referencias.js:30-37` (`agregarCostosImportados`): `for (const m of order.materials) mpd += m.vrPlaneado`; `for (const l of order.laborItems) { if... mod += l.vrStd ... }` — **suma TODAS las filas de la orden**, huérfanas incluidas. Esto alimenta directamente la columna MPD/MOD/CIF de la tabla de Referencias y el Excel exportado.
- `backend/src/routes/referencias.js:169-194` (endpoint `/variacion`): mismo patrón, `for (const l of order.laborItems)` y `for (const m of order.materials)` sin filtrar por "vigencia" en la última importación.

Nótese que `CostOrder.totalPlaneado/totalEjecutado` (guardados en la misma fila de `CostOrder`, líneas 290-296 y 373-377) **sí** se calculan únicamente a partir de los ítems recién parseados del archivo actual — esos totales de cabecera están a salvo. El problema está específicamente en los agregados que se recalculan **en cada lectura** sumando las tablas hijas completas (`CostLabor`/`CostMaterial`), que sí incluyen huérfanos.

**Escenario concreto para el evento anunciado:** al reimportar 50+ órdenes con archivos más recientes de Odoo, cualquier orden cuyo nuevo archivo tenga **menos** filas de MO o de materia prima que la versión previamente importada quedará con MPD/MOD/CIF **inflados** en la tabla de Referencias, en el modal de variación y en el Excel exportado — de forma silenciosa, sin ningún warning.

**Arreglo sugerido (sin implementar):** dentro de la transacción principal, antes o después del loop de upsert, borrar las filas del `orderId` cuyo `insumo`/`proceso` no esté en el conjunto de la importación actual:
```js
await tx.costMaterial.deleteMany({
  where: { orderId: savedOrder.id, insumo: { notIn: mpItems.map(i => i.insumo) } },
});
// análogo para costLabor con proceso, moviendo ese loop dentro de la transacción (ver ALTO-3 heredado)
```

**Otros riesgos de la reimportación masiva evaluados:**

- **Reasignación de mes (`MEDIO-1` heredado, sigue presente):** `importarCostos.js:347` sobreescribe `Referencia.mes` con el mes del formulario en cada importación. Si el lote de 50+ archivos abarca varios meses para la misma referencia, `agregarCostosImportados` (`referencias.js:18-21`) solo agregará las órdenes cuyo `fechaFinal` caiga en el **último** mes importado — las órdenes de meses anteriores siguen en la base pero desaparecen del resumen por referencia. No corrompe datos, pero puede confundir al operador si el lote no se sube en orden cronológico. **No fijado desde la auditoría anterior.**
- **Colisión de materiales AUTO-###:** la numeración (`importarCostos.js:356-364`) se calcula dentro de la transacción vía `findMany` + `orderBy desc` + `parseInt` — segura para importaciones secuenciales (una por una, como permite la UI). Si algún día se paraleliza la subida de los 50+ archivos, hay una ventana de carrera real (dos transacciones podrían leer el mismo "último AUTO-XXX" antes de que la otra confirme), pero como el flujo actual es un upload por vez desde la UI, el riesgo práctico es bajo. **No requiere fix urgente, solo no paralelizar la subida.**
- **Rendimiento:** cada archivo hace 1 `findMany` de todo el catálogo de materiales (`importarCostos.js:129`) + N upserts de `CostMaterial` + M upserts de `CostLabor` (uno por fila, sin batch). Para 50+ archivos subidos secuencialmente vía UI (según documenta `DOCUMENTACION_SISTEMA.md:108-179`, un archivo por vez) esto es aceptable — cada archivo típico tiene decenas de filas, no miles. **No hay endpoint de importación batch**; si el operador quiere subir 50 archivos, debe hacerlo 50 veces por la UI. No es un bug, pero si el volumen crece más, valdría la pena un endpoint que acepte varios archivos en una sola petición.

---

## BLOQUE 4 — Hallazgos adicionales

### 4.1 Robustez del backend

- **Validación de entrada floja en escritura directa:** `backend/src/routes/referencias.js:87-92` (POST) y `:279-291` (PUT) solo validan que `familia` y `mes` existan; `segMOD`, `cifUnitario`, `costoReal` no se validan como números antes de pasarlos a Prisma. Si llegan como string o `NaN`, Prisma lanza un `PrismaClientValidationError` no capturado específicamente, cayendo en el catch genérico → 500 con mensaje Spanish genérico (no filtra internals, pero tampoco da un 400 claro al operador). `backend/src/routes/materiales.js:19-24` similar (`costo == null` es la única validación de tipo).
- **Fuga menor de detalles internos:** `backend/src/routes/materiales.js:149-151` — en el catch de la transacción de `importar-csv`, hace `errores.push(e.message)` y lo devuelve tal cual en la respuesta JSON (línea 153). Un error de Prisma (por ejemplo, de constraint) podría exponer nombres de columnas/constraints internos al cliente. Bajo impacto (herramienta interna de un solo operador), pero es una fuga de información técnica innecesaria.
- **Payload / tamaño de archivo:** `multer` limita a 20MB (`importarCostos.js:9`) y 10MB (`materiales.js:7`, `importarOP.js:9`) — razonable para archivos Excel. `express.json()` (`index.js:37`) no define `limit` explícito, por lo que usa el default de Express (100kb) — suficiente para los payloads JSON de este sistema (listas de consumos), sin riesgo de abuso relevante en una herramienta interna.
- **XLS malformado a mitad de transacción:** `XLSX.read`/`sheet_to_json` (`importarCostos.js:89-91`) corren **antes** de abrir la transacción Prisma (línea 324); si el archivo está corrupto, la excepción se captura en el try/catch externo (línea 430) y no se escribe nada en la base — seguro. La única escritura fuera de la transacción es el loop de `CostLabor` ya señalado (`ALTO-3` heredado, no corregido).

### 4.2 Estado del frontend tras mutaciones

Revisé los 3 componentes con mutaciones (`Referencias.jsx`, `Materiales.jsx`, `ImportarCostos.jsx`): **todas** las rutas de creación/edición/borrado/importación llaman a `reload()` (que dispara `App.jsx:41-58 loadAll()`, recargando referencias + materiales + parámetros) antes de cerrar el modal o mostrar el resultado. `ImportarCostos.jsx:535-537` además refresca la lista local de órdenes (`loadOrders()`) y actualiza `selectedOrder` con la respuesta fresca del servidor. **No se encontraron trampas de caché obsoleta.**

### 4.3 Ciclo de vida de los datos / backup

No existe ningún mecanismo de respaldo a nivel de aplicación (sin script de `pg_dump`, sin endpoint de exportación de base de datos cruda). El único respaldo disponible son los snapshots automáticos de Railway (fuera del control de este repo). **El Excel exportado NO sustituye un backup funcional completo**: la hoja "Materiales" solo lista los materiales de las referencias exportadas en el filtro activo (no todo el catálogo histórico), y ninguna hoja exporta el detalle línea a línea de `CostLabor` por orden individual (solo agregados por proceso). Si la base de datos se pierde hoy, se perdería el historial completo de órdenes importadas (`CostOrder`/`CostLabor`/`CostMaterial`) sin posibilidad de reconstrucción desde el Excel.

### 4.4 El archivo Excel exportado

`exportExcel.js` usa `ExcelJS` y escribe **valores calculados directamente** (`cell.value = ...`), no fórmulas — es decir, es un snapshot estático al momento de la exportación, no un libro vivo. Esto es coherente con su propósito de reporte. Formatos numéricos (`FMT.cop`, `FMT.pct`, etc., líneas 22-28) son códigos de formato Excel válidos. `safeValue()` (línea 179-182) evita escribir `Infinity`/`NaN` en celdas. No se detectaron problemas de apertura en Excel a nivel de código (headers, merges y estilos están bien formados). Dato re-importado o editado se refleja correctamente porque el export siempre parte de `referencias` frescas recién cargadas por `reload()` (ver 4.2).

### 4.5 Salud de dependencias

- `backend/package.json:15,27` — `@prisma/client`/`prisma` fijados en `^5.20.0`; la rama mayor vigente de Prisma ya avanzó más allá (6.x) al momento de esta auditoría. No hay urgencia (las migraciones son SQL crudo, compatibles), pero es deuda técnica a resolver en una ventana de mantenimiento.
- `backend/package.json:23` y `frontend/package.json:17` — `xlsx: ^0.18.5` (paquete "SheetJS Community Edition" en npm). Esta es la última versión publicada en el registro de npm; las correcciones de seguridad posteriores del proyecto SheetJS (prototype pollution / ReDoS conocidos) se distribuyen fuera de npm (CDN propio de SheetJS), por lo que `npm install` con este rango de versión **no** las recibe. El vector de explotación requiere que el atacante controle el archivo `.xls`/`.csv` que se sube — en este sistema lo sube un único operador interno de confianza, lo que reduce el riesgo real, pero conviene documentarlo y evaluar migrar a la distribución parcheada si en algún momento se abre la importación a más usuarios.
- `frontend/eslint.config.js` — confirmado (vía `git log`) que se removió `eslint-plugin-react` por conflicto de peer-deps, dejando solo `eslint-plugin-react-hooks`. Esto significa que reglas de React puro (props sin key, etc.) no se lintean, solo las de hooks. Riesgo bajo, cosmético.
- No se encontró configuración de lint en el backend (`backend/package.json` no tiene script `lint`). No es crítico para un backend Express simple, pero es una asimetría con el frontend.

---

## BLOQUE 5 — Puntuación

| Dimensión | Score | Evidencia clave |
|---|---|---|
| (a) Corrección de cálculos | **6/10** | Los 4 críticos de colores/etiquetas/tarifaMOD están genuinamente corregidos (Bloque 1) y export/UI comparten `calcCostosEstandar` (1.3). Pero el descubrimiento de que el desglose de variación usa una constante global en vez de `CostLabor.tarifaStd` ya almacenado (3.1) es un defecto de cálculo real y activo, agravado por la recalibración inminente. |
| (b) Integridad de datos | **4/10** | Filas huérfanas de `CostLabor`/`CostMaterial` nunca se limpian al reimportar (3.2) e inflan MPD/MOD/CIF/variación en producción activa, no solo en un escenario hipotético — es el hallazgo más grave de esta auditoría. Reasignación de `mes` (MEDIO-1 heredado) añade confusión adicional. |
| (c) Robustez de importación | **6/10** | Validación de columnas/tipo de fila sólida (`importarCostos.js:95-161`), fallback de catálogo razonable, XLS malformado no corrompe datos (4.1). Pero `CostLabor` fuera de la transacción principal (ALTO-3 heredado, no corregido) y el bug de huérfanos (3.2) son fallas concretas de robustez, no solo teóricas. |
| (d) Arquitectura y deuda técnica | **5/10** | El modelo dual de materiales es consistente entre los 4 sitios de lectura (2.2), pero está duplicado en vez de compartido (2.3); constantes de tarifa duplicadas en 2 archivos (3.1); 4 componentes muertos siguen en el repo (`Comparativo.jsx`, `ImportarOdoo.jsx`, `ImportarOP.jsx`, `TabGraficos.jsx`) más una ruta backend huérfana (`/api/importar-op`). |
| (e) Seguridad | **7/10** | JWT_SECRET validado ≥32 chars al arrancar (`index.js:10-13`), rate limiting en auth (`auth.js:9-15`), bcrypt cost 10, CORS bien acotado, sin inyección SQL (Prisma parametrizado). Descuenta: JWT en `localStorage` (bajo riesgo, herramienta interna), fuga menor de `e.message` en `materiales.js:150`, dependencia `xlsx` con CVEs conocidos sin parche en npm (4.5). |
| (f) UX y claridad para el operador | **7/10** | Colores correctos, badge "OP"/etiquetas claras, reload consistente tras cada mutación (4.2), pestaña Parámetros retirada limpiamente de la navegación. Descuenta: `window.location.reload()` en 401 descarta formularios sin guardar (heredado), sin aviso visible cuando `mes` se reasigna al reimportar. |
| (g) Mantenibilidad y documentación | **7/10** | `DOCUMENTACION_SISTEMA.md` es preciso y se verificó contra el código sin encontrar desactualizaciones (no requirió corrección). Descuenta: lógica duplicada (2.3), constantes duplicadas (3.1), ausencia de lint en backend. |
| (h) Preparación para recalibración y re-importación | **3/10** | Es la dimensión más baja y la razón de ser de esta auditoría: tarifa hardcodeada en 2 archivos sin mecanismo de configuración (3.1), desglose de variación que se revaloriza retroactivamente al cambiar la constante (3.1), y filas huérfanas que corromperán totales en una reimportación de 50+ órdenes si algún archivo trae menos filas que el anterior (3.2). Ninguno de los dos eventos anunciados es seguro de ejecutar hoy sin los arreglos del roadmap "antes de". |

### Puntuación global ponderada: **5.5/10**

Ponderando integridad de datos y corrección de cálculos con el mayor peso (este sistema informa decisiones reales de precios), el sistema está en un punto intermedio: **la auditoría anterior sí se resolvió de forma genuina y verificable** (bloque 1 sin hallazgos residuales), pero esta segunda pasada — enfocada específicamente en los dos eventos operativos anunciados — descubrió que **ni la recalibración de tarifa ni la reimportación masiva son seguras de ejecutar en el estado actual del código**: la primera revaloriza retroactivamente el análisis histórico de variación, y la segunda puede inflar silenciosamente los costos estándar de cualquier orden cuyo archivo nuevo tenga menos líneas que el anterior. Ambos son arreglables con cambios acotados (ver Roadmap), pero deben resolverse **antes**, no después, de los dos eventos.

---

## ROADMAP

### Antes de la recalibración de tarifa (bloqueante)

1. **[S] Extraer `TARIFA_STD_MO/CF` y `TARIFA_STD_MOD/CIF` a un único archivo de configuración** (`backend/src/config/tarifas.js`) e importarlo en `importarCostos.js` y `referencias.js`. Riesgo: bajo. Sube: (a), (h).
2. **[M] Corregir el análisis de variación para usar la tarifa estándar ya almacenada por orden** (`CostLabor.tarifaStd`) en vez de la constante global, para que cambiar la tarifa en el código no revalorice retroactivamente órdenes de meses ya cerrados. Riesgo: medio — cambia una fórmula de negocio visible, requiere validar el nuevo desglose con el operador antes de desplegar. Sube: (a), (h).
3. **[S] Decidir dónde vive la tarifa "actual" editable** (reactivar `Parametros.tarifaMOD`, ya presente en el schema, para las alertas de importación) y documentarlo. Sube: (h).

### Antes de la reimportación masiva (bloqueante)

4. **[M] Eliminar filas huérfanas de `CostLabor`/`CostMaterial` al reimportar una orden** (`deleteMany` de procesos/insumos ausentes del archivo nuevo, dentro de la transacción). Riesgo: medio, cambia el comportamiento actual de "solo agregar/actualizar". Sube: (b), (c).
5. **[S] Mover el upsert de `CostLabor` dentro de la transacción principal** (ALTO-3 heredado, sigue sin corregir) — crítico en un lote de 50+ archivos donde un fallo silencioso en uno de ellos sería difícil de detectar entre tantos. Sube: (b).
6. **[S] Mostrar aviso visible en la UI si `Referencia.mes` se reasigna** al reimportar en un mes distinto al de órdenes previas de la misma referencia (MEDIO-1 heredado). Sube: (f).

### Puede esperar

7. **[S] Corregir `parseCOP` para aceptar punto decimal en formato inglés** (ALTO-4 heredado, sin corregir). Sube: (a).
8. **[S] Eliminar el campo fantasma `tarifaCIF`** de `PUT /api/parametros` o retirar el endpoint si ya no se usa (ALTO-5 heredado, bajo impacto por ser deprecated). Sube: (d).
9. **[M] Consolidar `materialesDeReferencia` en un único accessor** en `utils/costos.js`, reutilizado por export y drawer; documentar el mismo contrato en el backend. Sube: (d).
10. **[S] Eliminar componentes muertos** (`Comparativo.jsx`, `ImportarOdoo.jsx`, `ImportarOP.jsx`, `TabGraficos.jsx`) y evaluar retirar la ruta backend `/api/importar-op` si no hay plan de reactivarlos. Sube: (d), (g).
11. **[S] Dejar de reenviar `e.message` crudo de Prisma** en la respuesta de `POST /api/materiales/importar-csv`. Sube: (e).
12. **[M] Evaluar migrar de `xlsx@0.18.5`** a una distribución parcheada o alternativa mantenida. Sube: (e).
13. **[M] Definir una política de respaldo explícita** (verificar snapshots de Railway o agregar `pg_dump` periódico) — el Excel exportado no sustituye un backup completo. Sube: (b).
14. **[L] Actualizar Prisma de 5.20 a la versión mayor vigente** en una ventana de mantenimiento planificada. Sube: (g).

---

## PREGUNTAS — Requieren decisión del responsable del sistema

**PREGUNTA-1 (heredada de la auditoría anterior, aún sin responder):** ¿Se aplicaron alguna vez `prisma db push` en producción antes de que existiera la migración `0002`? Esto ya no afecta la integridad del schema (la migración es idempotente), pero ayuda a confirmar si hubo duplicados históricos que la deduplicación de `0002` ya limpió.

**PREGUNTA-2 (nueva, bloqueante para el roadmap ítem 2):** Al recalibrar la tarifa MOD, ¿el desglose "Eficiencia (tiempo) vs. Tarifa" del análisis de variación debe usar la tarifa estándar propia de cada orden (`CostLabor.tarifaStd`, ya capturada de Odoo en el momento de la importación) o debe reflejar siempre la tarifa "oficial" vigente hoy? La respuesta determina si el arreglo del ítem 2 del roadmap es correcto o si se necesita algo más elaborado.

**PREGUNTA-3 (nueva, bloqueante para el roadmap ítem 4):** Cuando un archivo reimportado de Odoo tiene menos filas de MO/materia prima que la versión anterior, ¿la intención correcta es **borrar** las filas que ya no aparecen (reflejar el estado más reciente de Odoo) o **conservarlas** como historial de versiones de la orden? El fix propuesto asume lo primero.

**PREGUNTA-4 (nueva):** Los 50+ archivos de la reimportación masiva, ¿corresponden todos al mismo mes o a varios meses distintos para las mismas referencias? Esto determina qué tan urgente es el ítem 6 del roadmap (aviso de reasignación de mes).

**PREGUNTA-5 (heredada):** ¿Cuál es el plan final para `Parametros.tarifaMOD`/`pctGAV`/`pctMargen`? Hoy están documentados como `DEPRECATED` pero siguen en el schema y en `PUT /api/parametros`. ¿Se eliminan en una futura migración o se reactivan (por ejemplo, `tarifaMOD` como la tarifa "actual" para alertas de importación, ítem 3 del roadmap)?

**PREGUNTA-6 (heredada, sigue sin responder):** ¿Cuál es el flujo correcto cuando un material importado crea un `AUTO-###`? ¿El operador debe renombrarlo manualmente en Materiales o existe/existirá un proceso de reconciliación con el catálogo CSV de Odoo?

**PREGUNTA-7 (nueva):** ¿Existe algún respaldo de la base de datos fuera de los snapshots automáticos de Railway? Si no, ¿quién es responsable de verificar que esos snapshots estén habilitados y de definir la frecuencia, antes de una operación de alto riesgo como la reimportación masiva de 50+ órdenes?

**PREGUNTA-8 (heredada, componentes muertos):** ¿Los componentes `ImportarOP.jsx`, `Comparativo.jsx`, `TabGraficos.jsx` e `ImportarOdoo.jsx` (y la ruta backend `/api/importar-op`) son funcionalidad planeada para reactivar, o se pueden eliminar definitivamente?

---

*Nota: esta auditoría es de solo lectura. Ningún archivo de código de la aplicación fue modificado; solo se creó este documento.*
