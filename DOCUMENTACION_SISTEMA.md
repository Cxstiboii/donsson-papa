# DOCUMENTACIÓN DEL SISTEMA — Donsoon Costos

> Versión: Julio 2026 · Generado por auditoría de código completa

---

## 1. ¿Qué hace este sistema?

Sistema web interno de Industrias Donsoon para calcular, importar y comparar costos de fabricación de filtros de aire. Permite:

- Mantener un catálogo de materiales con costos unitarios.
- Registrar referencias de producto (referencias = SKUs), los materiales que consumen y sus costos de mano de obra y CIF.
- Importar órdenes de producción reales desde los archivos Excel `Detalle_de_Costos.xls` que exporta Odoo.
- Comparar el **Costo Estándar** planificado vs. el **Costo de Producción** real ejecutado, y ver la variación porcentual.
- Descomponer esa variación en eficiencia de tiempo (MOD/CIF), variación de tarifa y variación de materiales.
- Exportar todo a un Excel con cuatro hojas.

---

## 2. Arquitectura técnica (simplificada)

```
Internet
    │
    ▼
Railway (único servidor)
    ├── Express/Node.js (backend API)   backend/src/
    │       ├── Sirve la app web (frontend compilado)
    │       └── Expone rutas /api/*
    └── React 18 + Vite (frontend)     frontend/src/
            └── Se compila a archivos estáticos servidos por el backend

Base de datos: PostgreSQL (Railway)
ORM:          Prisma
Autenticación: JWT (contraseña única, 30 días de validez)
```

---

## 3. Mapa completo del sistema

### 3.1 Rutas del API (backend)

| Método | Ruta | Qué hace |
|--------|------|----------|
| POST | `/api/auth/setup` | Configura la contraseña inicial |
| GET | `/api/auth/status` | Verifica si hay contraseña configurada |
| POST | `/api/auth/login` | Inicia sesión, devuelve JWT de 30 días |
| GET | `/api/materiales` | Lista todos los materiales del catálogo |
| POST | `/api/materiales` | Crea un nuevo material |
| PUT | `/api/materiales/:id` | Edita nombre, unidad y costo de un material |
| DELETE | `/api/materiales/:id` | Elimina material (solo si no está en uso) |
| PATCH | `/api/materiales/:id/rename` | Cambia el código ID de un material redirigiendo sus consumos |
| POST | `/api/materiales/importar-csv` | Importa catálogo de materiales desde CSV/Excel de Odoo |
| GET | `/api/referencias` | Lista referencias con costos importados agregados |
| POST | `/api/referencias` | Crea una referencia manualmente |
| PUT | `/api/referencias/:id` | Edita familia, mes, MOD, CIF, costoReal y consumos |
| DELETE | `/api/referencias/:id` | Elimina referencia y sus consumos |
| PATCH | `/api/referencias/:id/costoReal` | Actualiza solo el costo real Odoo (campo manual) |
| GET | `/api/referencias/:id/variacion` | Devuelve análisis de variación detallado |
| GET | `/api/parametros` | Lee pctGAV y pctMargen (y tarifaMOD no usada) |
| PUT | `/api/parametros` | Actualiza parámetros |
| GET | `/api/importar-costos` | Lista todas las órdenes importadas |
| POST | `/api/importar-costos` | **Importa un archivo Detalle_de_Costos.xls** |
| GET | `/api/importar-costos/:id` | Devuelve detalle completo de una orden importada |
| DELETE | `/api/importar-costos/:id` | Elimina una orden importada |
| POST | `/api/importar-op` | Importa lista de materiales desde Excel de OP de Odoo |

**Todas las rutas excepto `/api/auth/*` requieren el header `Authorization: Bearer <token>`.**

---

### 3.2 Componentes React (frontend)

| Archivo | Pestaña | Qué hace |
|---------|---------|----------|
| `App.jsx` | Shell | Autenticación, KPIs, selector de mes global, navegación por pestañas |
| `components/Login.jsx` | (pantalla login) | Formulario de contraseña |
| `components/Referencias.jsx` | **Referencias** | Tabla principal de referencias, drawer de detalle, modal de creación/edición, modal de análisis de variación |
| `components/Materiales.jsx` | **Materiales** | Catálogo de materiales, CRUD, importación CSV |
| `components/ImportarCostos.jsx` | **Costos Producción** | Formulario de importación de Detalle_de_Costos.xls, lista de órdenes importadas, detalle por orden |
| `components/Parametros.jsx` | *(sin pestaña)* | Formulario de parámetros — existe pero no está accesible en la UI actual |
| `components/Comparativo.jsx` | *(sin pestaña)* | Código muerto — no está montado en ningún tab |
| `components/ImportarOdoo.jsx` | *(sin pestaña)* | Código muerto — no está montado en ningún tab |
| `components/ImportarOP.jsx` | *(sin pestaña)* | Código muerto — no está montado (la ruta API sí existe) |
| `TabGraficos.jsx` | *(sin pestaña)* | Código muerto — no está montado |
| `FiltroFecha.jsx` | (componente) | Selector de mes / rango de fechas usado en la tabla de referencias |
| `exportExcel.js` | (util) | Genera el archivo Excel con 4 hojas |
| `api.js` | (util) | Cliente HTTP, gestión de token JWT en localStorage |
| `utils/costos.js` | (util) | Funciones de cálculo (`calcCostos`, `calcCostosEstandar`) y formateo colombiano (`COP`, `parseCOP`, `formatCOP`, `fmt`) |

---

### 3.3 Modelos de base de datos (Prisma / PostgreSQL)

| Tabla | Descripción |
|-------|-------------|
| `Material` | Catálogo de materiales: código, nombre, unidad, costo unitario (COP), proveedor |
| `Referencia` | SKU de producto: código, familia (AAA/A/B/C), mes de referencia, `segMOD` (COP de MOD estándar), `cifUnitario` (COP de CIF estándar), `costoReal` (costo Odoo ingresado manualmente) |
| `Consumo` | Relación muchos-a-muchos entre Referencia y Material: cantidad por unidad producida |
| `Parametros` | Fila única (id=1): `pctGAV` (% gastos de admin), `pctMargen` (% margen de venta), `tarifaMOD` (visible en exportación, no usado en cálculos) |
| `Usuario` | Fila única (id=1): hash bcrypt de la contraseña |
| `CostOrder` | Encabezado de una orden importada: número de orden, ref Donsson, producto, cantidad fabricada, totales planeado/ejecutado/variación |
| `CostLabor` | Líneas de mano de obra/CIF de una orden: proceso, cantStd, vrStd, cantEjecutado, vrEjecutado, etc. |
| `CostMaterial` | Líneas de materia prima de una orden: insumo, costoMp, cantPlaneado, vrPlaneado, cantEjecutado, vrEjecutado, etc. |

---

## 4. Ciclo de vida completo de una importación

### Paso a paso: desde el Excel hasta la pantalla

```
OPERADOR
  │
  ├─ 1. Va a la pestaña "Costos Producción"
  ├─ 2. Selecciona el mes (YYYY-MM) y el archivo Detalle_de_Costos.xls
  └─ 3. Hace clic en "Importar"
         │
         ▼  POST /api/importar-costos (importarCostos.js)
         │
         ├─ Validación del archivo:
         │    - ¿Tiene las 16 columnas esperadas? (Tipo, Orden, Producto, Ref donsson, etc.)
         │    - ¿Hay exactamente 1 fila de "Carga Fabril"?
         │    - ¿Hay materias primas sin costo ni en catálogo ni en columna Excel?
         │    → Si hay errores: rechaza con HTTP 422
         │
         ├─ Lectura de metadata de la primera fila:
         │    - orden, documentoOrigen, producto, refDonsson, cantidadFabricada, estado
         │
         ├─ Separación por tipo de fila:
         │    - rowsMO: Tipo = "Mano de obra"
         │    - rowsCF: Tipo = "Carga fabril" (debe ser exactamente 1)
         │    - rowsMP: Tipo = "Materia prima"
         │
         ├─ Proceso de Carga Fabril (rowsCF[0]):
         │    - Lee cantStd, vrStd, cantPlaneado, vrPlaneado, cantEjecutado, vrEjecutado
         │    - Calcula tarifas (= valor / segundos)
         │    - ALERTA si tarifa estándar difiere > $0,05 de $9,30/seg
         │
         ├─ Proceso de Mano de Obra (rowsMO):
         │    - Solo procesa filas cuyo nombre empieza con "MANO DE OBRA"
         │    - Los demás quedan en warnings y se omiten
         │    - ALERTA si tarifa ejecutada supera >10% la planeada
         │    - ALERTA si tarifa estándar difiere > $0,05 de $3,80/seg
         │
         ├─ Proceso de Materia Prima (rowsMP):
         │    - Por cada fila, busca el material en el catálogo (por nombre, case-insensitive)
         │    - Si lo encuentra: usa el costo del catálogo
         │    - Si no lo encuentra: usa columna "Costo mp" del Excel; crea material AUTO-###
         │    - vrPlaneado: usa columna "Vr. x Ud. Planeado" si > 0; si no, recalcula como cantPlan × costoMp
         │    - vrEjecutado: igual con "Vr. x Ud. Ejecutado"
         │    - ALERTA si cantidad ejecutada > 120% de la planeada
         │
         ├─ Cálculo de totales:
         │    - totalPlaneado = suma(vrPlaneado MO + CF + MP)
         │    - totalEjecutado = suma(vrEjecutado MO + CF + MP)
         │    - totalVariacion = totalEjecutado - totalPlaneado
         │    - ALERTA si la variación total supera el 15%
         │
         ├─ Transacción en DB (atómica):
         │    1. Upsert Referencia (por refDonsson):
         │       - Crea si no existe; actualiza mes, nombre, segMOD (= totalModVrStd), cifUnitario (= vrStd del CF)
         │       - Respeta la familia si ya estaba clasificada manualmente
         │    2. Crea materiales AUTO-### para los no encontrados
         │    3. Upsert CostOrder (clave única: número de orden)
         │    4. Upsert CostMaterial por cada materia prima (clave: orderId + nombre insumo)
         │
         ├─ Fuera de transacción (tolerancia a fallos):
         │    - Upsert CostLabor por cada proceso MO y CF (clave: orderId + nombre proceso)
         │    - Si uno falla, se loguea y continúa con el siguiente
         │
         └─ Respuesta al frontend:
              - success: true, warnings[], order{...}, materialesCreados[]

FRONTEND (después de importación exitosa):
  ├─ Actualiza la lista de órdenes importadas
  ├─ Llama a reload() que recarga referencias + materiales + parámetros
  └─ Muestra el detalle de la orden recién importada
```

---

### ¿Qué columnas del Excel se leen?

| Columna Excel | Para qué se usa |
|---------------|-----------------|
| `Tipo` | Clasifica la fila: "Mano de obra", "Carga fabril", "Materia prima" |
| `Orden` | **Clave única** del registro — previene duplicados al reimportar |
| `Documento origen` | Referencia del documento Odoo (informativo) |
| `Producto` | Nombre largo del producto (se extrae el código entre corchetes) |
| `Ref donsson` | **Código interno** — se vincula a `Referencia.id` |
| `Producto clase` | Informativo (AAA, A, B, C, etc.) |
| `Cantidad fabricada` | Unidades producidas en la orden |
| `Insumo` | Nombre del material / proceso de MO |
| `Costo mp` | Costo unitario de la materia prima (fallback si no está en catálogo) |
| `Cant. x Ud. Planeado Standard` | Segundos/cantidad estándar (cantStd) |
| `Vr. x Ud. Planeado Standard` | Valor COP estándar (vrStd) |
| `Cant. x Ud. Planeado` | Cantidad planeada real |
| `Vr. x Ud. Planeado` | Valor COP planeado |
| `Cant. x Ud. Ejecutado` | Cantidad ejecutada real |
| `Vr. x Ud. Ejecutado` | Valor COP ejecutado |
| `Estado` | Estado de la orden en Odoo |

**Columnas ignoradas**: cualquier otra columna extra que tenga el Excel es ignorada silenciosamente.

---

## 5. ¿De dónde sale cada número? (columnas de la tabla principal)

La tabla principal en la pestaña **Referencias** muestra una fila por referencia. Cada valor se obtiene así:

### Columna **Código**
- Fuente: `Referencia.id` — texto libre asignado al crear la referencia, o extraído de `[Ref donsson]` al importar.

### Columna **Familia**
- Fuente: `Referencia.familia` — AAA, A, B o C.
- Al importar, si no tenía familia, se infiere: código empieza con "AAA" → AAA, empieza con "A" → A, etc.
- El operador puede cambiarla manualmente en el drawer.

### Columna **Mes**
- Fuente: `Referencia.mes` — en formato YYYY-MM, mostrado como "Ene 2025".
- Al importar una orden, el mes del formulario de importación sobreescribe este campo.

### Columna **MPD** (Materiales directos planeados)
- **Fuente cuando hay datos importados**: suma de `CostMaterial.vrPlaneado` de todas las órdenes del mes de la referencia.
- **Fuente cuando no hay importación**: suma de `consumo.cantidad × material.costo` para cada material consumido registrado manualmente.

### Columna **MOD** (Mano de obra directa estándar)
- **Fuente cuando hay datos importados**: suma de `CostLabor.vrStd` de filas tipo `mano_obra` de todas las órdenes del mes.
- **Fuente sin importación**: `Referencia.segMOD` — valor ingresado manualmente en el campo "MOD manual (COP)".
- ⚠️ **El campo se llama `segMOD` en la DB pero almacena COP, no segundos.**

### Columna **CIF** (Carga fabril estándar)
- **Fuente cuando hay datos importados**: `CostLabor.vrStd` de la fila tipo `carga_fabril`.
- **Fuente sin importación**: `Referencia.cifUnitario` — valor manual.

### Columna **Costo Estándar**
```
Costo Estándar = MPD + MOD + CIF
```
(suma directa de los tres valores COP descritos arriba)

### Columna **Costo Producción (Odoo)**
- **Fuente cuando hay datos importados**: suma de `CostOrder.totalEjecutado` de todas las órdenes del mes.
- **Fuente sin importación**: `Referencia.costoReal` — valor ingresado manualmente.

### Columna **Variación %**
```
Variación % = (Costo Producción − Costo Estándar) / Costo Estándar × 100
```
- Resultado **positivo** = Odoo ejecutó MÁS que el estándar (DESFAVORABLE, mayor costo real).
- Resultado **negativo** = Odoo ejecutó MENOS que el estándar (FAVORABLE, menor costo real).
- ⚠️ **Hay un bug de color: el sistema actualmente pinta verde (+) y rojo (−), invertido respecto a lo esperado.**

---

## 6. Análisis de Variación (botón "Variación" en la tabla)

Al hacer clic en el botón "Variación" de cualquier referencia, se abre `ModalVariacion` que llama a `GET /api/referencias/:id/variacion`.

### Qué calcula

Se suman todos los datos de las órdenes del mes correspondiente, luego se descompone la diferencia entre Costo Estándar y Costo Producción en componentes:

```
Costo Estándar (suma vrStd MOD + vrStd CIF + vrPlaneado MP)
    ± Variación Eficiencia MOD  = (segStdMOD − segEjecMOD) × $3,80/seg
    ± Variación Tarifa MOD      = ($3,80 − tarifaRealMOD) × segEjecMOD
    ± Variación Eficiencia CIF  = (segStdCIF − segEjecCIF) × $9,30/seg
    ± Variación Tarifa CIF      = ($9,30 − tarifaRealCIF) × segEjecCIF
    ± Variación Materiales      = suma(vrPlaneado − vrEjecutado) por insumo
    ± Residual                  = redondeo Odoo (vrStd ≠ cantStd × tarifa)
─────────────────────────────────────────────────────
= Costo Producción (Odoo)
```

**Signo positivo = FAVORABLE** (el real salió más barato que el estándar).

### Condición `datosIncompletos`
Si las órdenes importadas no tienen `cantStd` (se importaron antes de que esta función existiera), el modal muestra una alerta: "Reimporta la orden para ver el análisis de variación".

### Alerta `inconsistenciaStd`
Si los segundos estándar MOD y los segundos estándar CIF difieren en más de 0,5 segundos acumulados, se muestra una advertencia: el estándar de MOD en Odoo puede estar desactualizado.

---

## 7. Flujo de la exportación a Excel

Al hacer clic en "Exportar Excel" en la pestaña Referencias, se genera en memoria un archivo `.xlsx` con 4 hojas:

| Hoja | Contenido |
|------|-----------|
| 📊 Resumen Costos | MPD, MOD, CIF, Costo de Producción, % GAV, Costo Total, % Margen, Precio de Venta para cada referencia visible |
| 🔩 Materiales | Lista de todos los materiales únicos usados, con código, nombre, unidad y costo |
| 🔢 Matriz Consumos | Cantidades por material y referencia, más filas de MOD (con `segMOD` como número) y CIF |
| ⚙️ Parámetros | Información de la empresa, tarifa MOD, % GAV, % Margen |

**El archivo se descarga directamente al navegador del operador.**

---

## 8. Despliegue (Railway)

```
nixpacks.toml          → instala Node 20, hace npm ci en backend y frontend
                         builds el frontend (npm run build)

railway.json           → al arrancar:
                         cd backend && npx prisma migrate deploy && npm start
                         (aplica migraciones pendientes, luego inicia Express)
```

El frontend compilado queda en `backend/public/` y Express lo sirve como archivos estáticos. Todas las peticiones que no empiecen con `/api` se redirigen a `index.html` para que React Router funcione.

---

## 9. Autenticación

- Contraseña única (un solo usuario interno).
- Al primer inicio: `GET /api/auth/status` → si no hay usuario, muestra pantalla de configuración.
- Login: `POST /api/auth/login` con `{ password }` → devuelve JWT de 30 días.
- El token se guarda en `localStorage`. Cada petición lo envía en el header `Authorization: Bearer <token>`.
- Si el servidor responde 401 (token expirado o inválido), el frontend borra el token y recarga la página (aparece el login).
- Rate limit: máximo 10 intentos de login en 15 minutos.

---

## 10. Glosario de términos clave

| Término | Significado en el sistema |
|---------|--------------------------|
| **Referencia** | SKU / código de producto de Donsoon (ej. AAA-100) |
| **Familia** | Categoría de la referencia: AAA, A, B o C |
| **segMOD** | Campo de la DB — almacena el costo COP de MOD estándar (a pesar del nombre, no son segundos) |
| **cifUnitario** | Costo COP de Carga Fabril estándar por unidad |
| **costoReal** | Costo total ejecutado en Odoo (campo manual o calculado desde órdenes) |
| **vrStd** | Valor COP estándar (lo que Odoo dice que debería costar a la tarifa estándar) |
| **vrPlaneado** | Valor COP planeado para esa orden específica |
| **vrEjecutado** | Valor COP real ejecutado |
| **cantStd** | Segundos (o cantidad) estándar según Odoo |
| **MPD** | Materiales directos planeados |
| **MOD** | Mano de obra directa |
| **CIF** | Carga fabril (costos indirectos de fabricación) |
| **GAV** | Gastos de administración y ventas (%) |
| **AUTO-001** | Material creado automáticamente al importar un insumo no registrado en el catálogo |
| **Orden** | Número de orden de producción de Odoo (campo único en la DB) |
