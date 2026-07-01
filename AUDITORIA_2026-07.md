# AUDITORÍA TÉCNICA — Donsoon Costos

> Fecha: Julio 2026 · Auditoría de código completa (modo lectura, sin modificaciones)

---

## Resumen ejecutivo

El sistema funciona y las operaciones de importación, almacenamiento y cálculo básico son correctas. Sin embargo, se identificaron **4 hallazgos Críticos** y **4 Altos** que pueden producir información errónea visible al operador o datos corruptos en la base de datos.

El más urgente: **los colores de variación están invertidos en la tabla principal** — una referencia en rojo (problema) aparece en verde y viceversa. El segundo más urgente: **las restricciones de unicidad de `CostLabor` y `CostMaterial` probablemente no existen en la base de datos real**, lo que puede generar filas duplicadas al reimportar.

---

## BLOQUE 2 — Correctitud de cálculos

---

### [CRÍTICO-1] Variación % tiene los colores invertidos en la tabla principal

**Archivo/línea:** `frontend/src/components/Referencias.jsx:665–669` y `1115–1122`

**Fórmula usada:**
```js
// costos.js:43
variacion = ((costoOdoo - costoEstandar) / costoEstandar) * 100
```

Un resultado **positivo** significa `costoOdoo > costoEstandar` → la producción **costó más** de lo estándar → **DESFAVORABLE**.

**Bug:** El código colorea el positivo en verde (`badge-success`) y el negativo en rojo (`badge-error`):
```js
// Referencias.jsx:665-669
const variacionClass =
  variacion > 0 ? "badge-success"  // ← verde cuando debería ser rojo
  : variacion < 0 ? "badge-error"  // ← rojo cuando debería ser verde
  : "badge-success";
```

El mismo error se repite en el drawer (resumen de costos, línea 1119):
```js
c.variacion > 0 ? "#065F46"   // ← verde para variacion positiva (costó MÁS)
: c.variacion < 0 ? "#991B1B" // ← rojo para variacion negativa (costó MENOS)
```

**Impacto:** El operador ve **verde** cuando la producción se excedió del presupuesto y **rojo** cuando estuvo bajo presupuesto. El KPI "Alertas >10%" en el dashboard usa `Math.abs()`, por lo que sí alerta correctamente en ambos sentidos, pero el color en la tabla lleva a conclusiones opuestas a las reales.

**Arreglo sugerido (sin tocar el código todavía):**
```js
const variacionClass =
  variacion > 0 ? "badge-error"    // costó más → rojo
  : variacion < 0 ? "badge-success" // costó menos → verde
  : "badge-info";
// Y en el drawer: invertir los colores "#065F46" ↔ "#991B1B"
```

---

### [CRÍTICO-2] Las restricciones únicas de CostLabor y CostMaterial no están en la migración SQL

**Archivo/línea:** `backend/prisma/migrations/0001_init/migration.sql` — ausencia de `UNIQUE INDEX` para `CostLabor(orderId, proceso)` y `CostMaterial(orderId, insumo)`

**Contexto:** El esquema Prisma (`schema.prisma:106` y `126`) declara:
```prisma
model CostLabor {
  @@unique([orderId, proceso])
}
model CostMaterial {
  @@unique([orderId, insumo])
}
```

Pero el SQL de la única migración existente (`0001_init`) crea las tablas **sin** estos índices únicos. La lista completa de índices en la migración son:
```sql
CREATE UNIQUE INDEX "Consumo_referenciaId_materialId_key" ON "Consumo"(...);
CREATE UNIQUE INDEX "CostOrder_orden_key" ON "CostOrder"("orden");
```
→ No hay ningún `UNIQUE INDEX` para `CostLabor` ni `CostMaterial`.

**Evidencia adicional:** El código tiene este comentario dentro de `importarCostos.js:411`:
```js
// Para limpiar duplicados existentes si los hubiera antes de este fix:
// DELETE FROM "CostMaterial" WHERE id NOT IN (...)
```
Esto confirma que ya ocurrieron duplicados en el pasado.

**Impacto:** Si el entorno de producción en Railway nunca recibió las restricciones de unicidad (porque `migrate deploy` solo aplica las migraciones escritas, no el schema.prisma directamente), entonces:
1. Reimportar la misma orden puede crear **filas duplicadas** en `CostLabor` y `CostMaterial`.
2. El costo estándar, ejecutado y el análisis de variación **quedarían doblados o multiplicados**.
3. El `upsert` de Prisma usa estas restricciones como condición de conflicto — si no existen en la DB, el comportamiento es indefinido (puede crear duplicados en lugar de actualizar).

**Arreglo sugerido:** Crear una nueva migración que añada los índices faltantes:
```sql
CREATE UNIQUE INDEX "CostLabor_orderId_proceso_key" ON "CostLabor"("orderId", "proceso");
CREATE UNIQUE INDEX "CostMaterial_orderId_insumo_key" ON "CostMaterial"("orderId", "insumo");
```
Y antes de aplicarla, ejecutar las consultas de limpieza de duplicados del comentario.

---

### [CRÍTICO-3] `Parametros.tarifaMOD` es código muerto — nunca se usa en ningún cálculo

**Archivos:**
- `backend/prisma/schema.prisma:52` — campo `tarifaMOD Float @default(9500)`
- `backend/src/routes/parametros.js:22–36` — se acepta y guarda en DB
- `frontend/src/utils/costos.js:1–23` — `calcCostos` IGNORA `params.tarifaMOD` completamente
- `frontend/src/exportExcel.js:367–372` — se muestra en la hoja "Parámetros" como "Tarifa MOD hora" pero no se usa en ninguna fórmula del Excel

**El cálculo real de MOD en `calcCostos`:**
```js
// costos.js:5-6
const mod = ref.segMOD || 0;   // ← toma el COP directamente
const cif = ref.cifUnitario || 0;
```
`segMOD` almacena el valor COP (importado de `vrStd` de Odoo o ingresado manualmente). No se multiplica por tarifa alguna.

**Impacto:** Si el operador (o futuro desarrollador) accede a la API de parámetros y cambia `tarifaMOD` esperando que afecte los costos calculados, no habrá ningún efecto. El Excel exportado muestra "Tarifa MOD hora: $9.500" creando la falsa impresión de que esa tarifa interviene en los cálculos.

**Pregunta relacionada (ver sección PREGUNTAS):** ¿El diseño intencional era que `segMOD` almacenara segundos y que el costo se calculara como `segMOD × tarifaMOD / 3600`? Si es así, la implementación actual no cumple ese diseño.

---

### [CRÍTICO-4] El Excel exportado etiqueta `segMOD` como "Segundos MOD" pero el campo almacena COP

**Archivo/línea:** `frontend/src/exportExcel.js:375–379`

```js
setCell(ws, 1, r, "MOD-S", S.codigo)
setCell(ws, 2, r, "Segundos MOD por unidad producida ↓", styleDato(1))
// ...
referencias.forEach((ref, i) => setCell(ws, 5 + i, r, ref.segMOD || 0, styleNum(1), FMT.int))
```

El campo `Referencia.segMOD` en la base de datos **almacena el valor COP total de MOD estándar**, no segundos. Al importar una orden (`importarCostos.js:303`):
```js
const totalModVrStd = moItems.reduce((s, x) => s + (x.vrStd != null ? x.vrStd : ...), 0);
// ...
segMOD: totalModVrStd,   // ← es COP, no segundos
```

**Impacto:** Si el operador abre el Excel y ve la fila "Segundos MOD = 45.600", pensará que son 45.600 segundos de MOD. En realidad son $45.600 COP de costo de MOD estándar. Cualquier cálculo manual que haga fuera del sistema usando esa celda como "segundos" dará resultados incorrectos.

---

### [ALTO-1] Las constantes 3,80 y 9,30 están duplicadas en dos archivos distintos

**Archivos y líneas:**
- `backend/src/routes/importarCostos.js:29–30` — `TARIFA_STD_MO = 3.80`, `TARIFA_STD_CF = 9.30`
- `backend/src/routes/referencias.js:132–133` — `TARIFA_STD_MOD = 3.80`, `TARIFA_STD_CIF = 9.30`

**Usos:**
- En `importarCostos.js`: para generar advertencias si la tarifa del Excel difiere de la estándar (no afecta cálculos guardados).
- En `referencias.js`: para descomponer la variación en eficiencia de tiempo vs. tarifa (sí afecta la pantalla de análisis de variación).

**Impacto:** Cuando se recalibre la tarifa MOD de $3,80 a $5,20 (tasa real observada mencionada en el contexto), hay que cambiarla en **2 lugares distintos**. Si se cambia solo en uno, los warnings de importación y el análisis de variación usarán valores distintos, generando inconsistencias que son difíciles de detectar.

**Arreglo sugerido:** Crear un archivo `backend/src/config/tarifas.js` con las constantes exportadas e importarlas en ambas rutas.

---

### [ALTO-2] Reimportar una orden sobreescribe ajustes manuales de `segMOD` y `cifUnitario`

**Archivo/línea:** `backend/src/routes/importarCostos.js:344–348`

```js
await tx.referencia.upsert({
  where: { id: refDonsson },
  update: { mes, nombre: productoRaw, segMOD: totalModVrStd, cifUnitario: cifVrStd, familia: familiaParaUsar },
});
```

Cada importación sobreescribe siempre `segMOD` y `cifUnitario` con los valores del Excel, sin preguntar. Si el operador ajustó manualmente el valor de MOD en el drawer de detalle y luego reimporta la misma orden (por ejemplo, para corregir otro dato), pierde su ajuste manual sin ningún aviso.

**Impacto:** Trabajo manual perdido en silencio. El operador no recibe ningún mensaje que diga "el valor de MOD fue actualizado por la importación".

**Arreglo sugerido (sin implementar):** Añadir un campo booleano `segMODManual` en Referencia; si es `true`, el upsert de importación no sobreescribe `segMOD`. O bien, mostrar en la respuesta de importación los valores anteriores y los nuevos.

---

### [ALTO-3] `CostLabor` se guarda fuera de la transacción principal — estado parcial posible

**Archivo/línea:** `backend/src/routes/importarCostos.js:391–404`

```js
// Upsert CostLabor fuera de la transacción — tolerancia a fallos por proceso:
for (const item of [cfItem, ...moItems]) {
  try {
    await prisma.costLabor.upsert({ ... });
  } catch (err) {
    console.error(...);
    advertencias.push(`No se pudo guardar el proceso "${item.proceso}": ${err.message}`);
  }
}
```

La transacción principal (materiales + `CostOrder` + `CostMaterial`) ya está confirmada cuando este loop empieza. Si un proceso de MO falla aquí, la orden queda guardada **sin ese proceso de MO en `CostLabor`**.

**Impacto:** El análisis de variación y los totales de MOD en el drawer de la orden mostrarán datos incompletos. La pantalla no avisa al operador de forma prominente (las `advertencias` van en un objeto JSON que la UI muestra solo como texto si las hay). Reimportar la misma orden soluciona el problema.

**Arreglo sugerido:** Mover el loop de `CostLabor` dentro de la transacción principal. Si se desea tolerancia parcial, capturar los errores individualmente pero seguir dentro de la transacción.

---

### [ALTO-4] `parseCOP` corrompe silenciosamente valores con punto decimal en inglés

**Archivo/línea:** `frontend/src/utils/costos.js:94–98`

```js
export function parseCOP(str) {
  const s = String(str).trim().replace(/\./g, "").replace(",", ".");
  // Elimina TODOS los puntos, luego reemplaza coma por punto
}
```

**Caso problemático:** Si el operador pega o escribe un valor con punto decimal al estilo inglés:
- Entrada: `"4200.50"` (cuatro mil doscientos con cincuenta centavos)
- `"4200.50".replace(/\./g, "")` → `"420050"` (se elimina el punto)
- `parseFloat("420050")` → **420050** (¡veinte veces el valor correcto!)

Esto ocurre silenciosamente. No hay error, no hay alerta. El valor se guarda en la DB incorrecto.

**Campos afectados:** `costoReal` en el formulario de referencia, `cifUnitario` en el drawer, costo en el editor de materiales del drawer.

**Escenario real:** El operador copia un precio de una hoja de Excel con configuración en inglés (punto como decimal), lo pega en el campo de costo, y el sistema guarda un valor 1.000 veces mayor.

**Arreglo sugerido (sin implementar):**
```js
export function parseCOP(str) {
  const s = String(str).trim();
  // Si tiene coma como decimal (formato colombiano): eliminar puntos, convertir coma
  if (/,\d{1,2}$/.test(s)) return parseFloat(s.replace(/\./g, "").replace(",", "."));
  // Si tiene punto como decimal (formato inglés): parsear directamente
  if (/\.\d{1,2}$/.test(s)) return parseFloat(s.replace(/,/g, ""));
  // Sin decimal: eliminar separadores de miles
  return parseFloat(s.replace(/[.,]/g, "")) || 0;
}
```

---

## BLOQUE 3 — Robustez de la importación

---

### [MEDIO-1] Reimportar la misma referencia en diferente mes mezcla el campo `mes` de la referencia con los meses de sus órdenes

**Archivo/línea:** `backend/src/routes/importarCostos.js:344–348`

Cuando se importa, `mes` del formulario sobreescribe `Referencia.mes`. Pero las órdenes previamente importadas siguen teniendo sus fechas originales.

**Escenario:** La referencia AAA-100 se importó en enero (mes = "2025-01"). Luego se importa de nuevo en marzo (mes = "2025-03"). Ahora `Referencia.mes = "2025-03"`. Al ver "Todos los meses" en la tabla, la función `agregarCostosImportados` filtra las órdenes por `ref.mes = "2025-03"`, por lo que las órdenes de enero ya no aparecen en el resumen de la referencia (aunque siguen en la DB como `CostOrder`).

**Impacto:** Los datos históricos de órdenes siguen en la DB y son accesibles desde la pestaña "Costos Producción", pero la tabla de Referencias solo muestra el mes más reciente importado.

---

### [MEDIO-2] El umbral de `inconsistenciaStd` es absoluto (0,5 seg), no relativo

**Archivo/línea:** `backend/src/routes/referencias.js:231`

```js
const inconsistenciaStd = segStdCIF > 0 && Math.abs(segStdMOD - segStdCIF) > 0.5;
```

Si una referencia tiene 5 órdenes en el mes, cada una con 1 segundo de diferencia entre MOD std y CIF std, la diferencia acumulada sería 5 seg > 0.5, disparando la alerta aunque cada orden individual sea correcta.

**Impacto:** Posibles falsas alarmas en referencias con muchas órdenes.

---

### [MEDIO-3] Materiales AUTO-### no pueden actualizarse mediante importación del catálogo CSV

**Archivos:**
- `backend/src/routes/importarCostos.js:356–368` — crea `AUTO-001`, `AUTO-002`, etc.
- `backend/src/routes/materiales.js:101–154` — importar-csv hace upsert por ID (`product_variant_ids/default_code`)

El catálogo CSV de Odoo usa los códigos propios de Odoo (ej. `[MAT-ABC-123]`). Los materiales creados automáticamente tienen IDs `AUTO-###`, que Odoo no conoce. Por tanto, una importación del catálogo CSV nunca actualizará estos materiales — el operador debe actualizarlos a mano en la pestaña Materiales.

---

### [BAJO-1] Si un proceso MO cambia de nombre entre dos importaciones de la misma orden, el registro antiguo queda huérfano

**Archivo/línea:** `backend/src/routes/importarCostos.js:393–404`

El `upsert` de `CostLabor` usa `(orderId, proceso)` como clave. Si en Odoo el proceso se llamaba "MANO DE OBRA CORTE" y ahora se llama "MANO DE OBRA CORTE Y TROQUELADO", la segunda importación crea un nuevo registro sin eliminar el antiguo. Ambos coexisten para la misma orden.

**Impacto:** Los totales de MOD se suman contando el proceso renombrado dos veces.

---

## BLOQUE 4 — Seguridad, configuración, calidad de código

---

### [ALTO-5] `tarifaCIF` en `PUT /api/parametros` es validada pero se descarta silenciosamente

**Archivo/línea:** `backend/src/routes/parametros.js:22–36`

```js
const { tarifaMOD, tarifaCIF, pctGAV, pctMargen } = req.body;
if (... typeof tarifaCIF !== "number" || tarifaCIF < 0 ...) {
  return res.status(400).json({ error: "..." });
}
const parametros = await prisma.parametros.upsert({
  update: { tarifaMOD, pctGAV, pctMargen },   // ← tarifaCIF NO aparece aquí
  create: { id: 1, tarifaMOD, pctGAV, pctMargen },
});
```

Si alguien llama al endpoint sin `tarifaCIF` (o con un valor no numérico), la validación rechaza la petición. Si lo envía correctamente, es aceptado pero nunca guardado. El campo no existe en el schema de Prisma.

**Impacto actual:** Ninguno funcional (el campo no existe en la DB y `tarifaCIF` tampoco se usa en cálculos). Pero es confuso y podría engañar a quien integre la API.

---

### [MEDIO-4] Pestaña de Parámetros eliminada — `pctGAV` y `pctMargen` no son editables desde la UI

**Archivo/línea:** `frontend/src/App.jsx:25–29`

```js
const TABS = [
  { key: "referencias", ... },
  { key: "materiales", ... },
  { key: "costos-produccion", ... },
  // No hay pestaña "parametros"
];
```

El componente `Parametros.jsx` existe y funcionaría, pero no está montado en ningún tab. Los valores de `pctGAV` (18%) y `pctMargen` (25%) cargados desde la DB afectan el precio de venta sugerido y el costo total del Excel exportado. Si estos porcentajes necesitan actualizarse, solo es posible mediante una llamada directa a `PUT /api/parametros` (con herramienta como Postman).

---

### [BAJO-2] JWT almacenado en `localStorage` — riesgo de XSS

**Archivo/línea:** `frontend/src/api.js:1–13`

```js
const TOKEN_KEY = "donsoon_token";
export function getToken() { return localStorage.getItem(TOKEN_KEY); }
```

Un script malicioso inyectado en la página podría leer el token. Para una herramienta interna de un solo usuario, el riesgo es bajo, pero la práctica más segura es usar cookies `httpOnly`.

---

### [BAJO-3] Componentes y archivos sin usar (código muerto)

Los siguientes archivos existen pero **no están montados en ningún tab ni importados desde App.jsx**:

| Archivo | Estado |
|---------|--------|
| `frontend/src/components/Parametros.jsx` | Existente, no montado |
| `frontend/src/components/Comparativo.jsx` | Código muerto |
| `frontend/src/components/ImportarOdoo.jsx` | Código muerto |
| `frontend/src/components/ImportarOP.jsx` | Código muerto (la ruta API `/api/importar-op` SÍ existe) |
| `frontend/src/TabGraficos.jsx` | Código muerto |

La ruta backend `POST /api/importar-op` está montada y es funcional, pero no hay forma de llamarla desde la UI.

---

### [BAJO-4] Materiales del seed son datos de ejemplo, no datos reales de Donsoon

**Archivo/línea:** `backend/prisma/seed.js:8–20`

Los 11 materiales iniciales (MAT-01 Papel filtro celulosa, MAT-02 Malla metálica, etc.) son datos de ejemplo genéricos. Si el seed se ejecutó en producción, estos materiales placeholder estarán en la base de datos mezclados con los reales importados de Odoo.

---

### [BAJO-5] `window.location.reload()` en respuesta a 401 borra estado no guardado

**Archivo/línea:** `frontend/src/api.js:22–26`

```js
if (res.status === 401) {
  clearToken();
  window.location.reload();  // ← recarga completa
  throw new Error("Sesión expirada");
}
```

Si el token expira mientras el operador tiene un formulario a medio completar, la recarga descarta todo sin preguntar.

---

### [BAJO-6] La verificación del estado de migraciones no es automática

**Archivo:** `railway.json`

El comando de inicio `prisma migrate deploy` es correcto para producción. Sin embargo, dado el hallazgo CRÍTICO-2 (restricciones únicas faltantes en la migración), el estado real de la DB puede diferir del schema.prisma sin que el sistema lo detecte automáticamente en el arranque.

---

## Top 5 recomendaciones (ordenadas por riesgo)

### 1. [URGENTE] Verificar y corregir las restricciones únicas en la DB (CRÍTICO-2)

Conectarse a la base de datos de Railway y ejecutar:
```sql
SELECT indexname, indexdef FROM pg_indexes
WHERE tablename IN ('CostLabor', 'CostMaterial');
```
Si no aparecen los índices únicos, buscar primero duplicados existentes:
```sql
SELECT "orderId", proceso, COUNT(*) FROM "CostLabor" GROUP BY "orderId", proceso HAVING COUNT(*) > 1;
SELECT "orderId", insumo, COUNT(*) FROM "CostMaterial" GROUP BY "orderId", insumo HAVING COUNT(*) > 1;
```
Limpiarlos, luego crear una migración Prisma que añada los índices.

### 2. [URGENTE] Corregir los colores invertidos de Variación % (CRÍTICO-1)

Cambio de 2 líneas en `Referencias.jsx`. Sin esta corrección, el operador toma decisiones basado en una señal visual opuesta a la realidad.

### 3. Unificar las constantes 3,80 y 9,30 en un solo archivo de configuración (ALTO-1)

Antes de recalibrar la tarifa MOD (de 3,80 a ~5,20 real), crear `backend/src/config/tarifas.js` y actualizar las dos rutas que las usan. Si se cambia solo en un lugar, los warnings y el análisis de variación mostrarán valores contradictorios.

### 4. Aclarar el propósito de `segMOD` y `Parametros.tarifaMOD` (CRÍTICO-3 + CRÍTICO-4)

Decisión arquitectónica necesaria: ¿`segMOD` debe almacenar **segundos** (y multiplicarse por tarifa) o **COP** (valor directo)? La respuesta determina si `tarifaMOD` se activa o se elimina, y si el Excel exportado dice "segundos" o "COP".

### 5. Agregar validación robusta en `parseCOP` para entradas con punto decimal (ALTO-4)

El riesgo de corrupción silenciosa de datos es real cada vez que alguien pega valores copiados de aplicaciones con configuración de idioma inglés.

---

## PREGUNTAS — Requieren decisión del responsable del sistema

Estos puntos no son bugs definitivos pero requieren confirmación humana:

**PREGUNTA-1 (Diseño de `segMOD`):**
¿El campo `Referencia.segMOD` debería almacenar **segundos de MOD** (y el costo se calcularía como `segMOD × tarifaMOD / 3600`), o debería almacenar directamente el **costo COP** como hace actualmente? Si la intención es guardar segundos, `calcCostos` tiene un bug fundamental. Si la intención es COP, el campo necesita renombrarse y el Excel debe corregir la etiqueta.

**PREGUNTA-2 (segundos estándar MOD = CIF):**
¿En Odoo siempre se configura el mismo número de segundos estándar para MOD y para Carga Fabril en una orden? La alerta `inconsistenciaStd` asume que deberían ser iguales. Si hay casos legítimos donde difieren, esta alerta generará falsos positivos.

**PREGUNTA-3 (Restricciones únicas en producción):**
¿Se aplicaron alguna vez las restricciones únicas de `CostLabor(orderId, proceso)` y `CostMaterial(orderId, insumo)` en la base de datos de Railway? ¿Se usó `prisma db push` en algún momento? La respuesta determina si ya existen duplicados en producción.

**PREGUNTA-4 (Mapeo de AUTO-### al catálogo Odoo):**
¿Cuál es el flujo correcto cuando un material importado crea un `AUTO-001`? ¿El operador debe ir a Materiales, encontrar ese registro y renombrarlo con el código real? ¿O existe un proceso de reconciliación mediante el CSV del catálogo Odoo?

**PREGUNTA-5 (Edición de parámetros GAV y Margen):**
La pestaña de Parámetros fue eliminada del menú. Si `pctGAV` (18%) o `pctMargen` (25%) necesitan actualizarse, ¿cuál es el proceso actual? ¿Se hace vía API directa? ¿O la pestaña se va a restaurar?

**PREGUNTA-6 (Funcionalidades pendientes):**
Los componentes `ImportarOP.jsx`, `Comparativo.jsx`, `TabGraficos.jsx` e `ImportarOdoo.jsx` existen pero no están accesibles. ¿Son funcionalidades planeadas para reactivar, o se pueden eliminar definitivamente del repositorio?

**PREGUNTA-7 (Recalibración de tarifa MOD a ~5,20 /seg):**
El contexto indica que la tarifa real observada es ~5,20 COP/seg vs. los 3,80 del estándar. ¿Esta diferencia ya está siendo absorbida en los `vrEjecutado` de las órdenes Odoo? ¿O el estándar en Odoo ya fue actualizado y el sistema aún usa 3,80 como referencia para el análisis de variación?

---

*Nota: Esta auditoría es de solo lectura. Ningún archivo de código fue modificado.*
