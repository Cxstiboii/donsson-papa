# Sistema de Costos Donsoon

Aplicación web para gestionar costos de producción estándar de Industrias Donsoon
y compararlos con los costos reales registrados en Odoo ERP.

## Stack

- Backend: Node.js + Express + Prisma ORM
- Base de datos: PostgreSQL
- Frontend: React (Vite), CSS inline
- Auth: contraseña única + sesión JWT (30 días)

## Estructura

```
donsoon-costos/
├── backend/    # API Express + Prisma
├── frontend/   # SPA React (Vite)
└── railway.json
```

## Desarrollo local

1. Levantar una base PostgreSQL local (o usar una de Railway).
2. Backend:
   ```bash
   cd backend
   cp .env.example .env   # completar DATABASE_URL y JWT_SECRET
   npm install
   npm run setup           # sincroniza el esquema y siembra datos iniciales
   npm run dev              # http://localhost:3001
   ```
3. Frontend:
   ```bash
   cd frontend
   npm install
   npm run dev               # http://localhost:5173 (proxy a /api)
   ```
4. Abrir `http://localhost:5173`, crear la contraseña en el primer uso.

## Deploy en Railway

1. Crear cuenta en railway.app
2. New Project → Deploy from GitHub repo (subir este proyecto a GitHub primero)
3. Add Plugin → PostgreSQL (Railway crea la DB automáticamente)
4. En Variables del servicio agregar:
   - `DATABASE_URL` → copiar de la DB de Railway (ya aparece automática)
   - `JWT_SECRET` → cualquier string largo aleatorio
5. El Build Command y Start Command ya están definidos en `railway.json`
   (build instala backend+frontend y compila el frontend; start corre
   `prisma db push` para crear las tablas y luego `npm start`).
7. Railway asigna URL pública automáticamente (ej: donsoon-costos.up.railway.app)
8. Abrir la URL → crear contraseña en primer uso
9. Compartir URL con el gerente general

## Notas

- El frontend compilado se sirve desde `backend/public/` (Express estático).
- Las 11 referencias de materiales y los 4 parámetros se siembran con `npm run db:seed`
  de forma idempotente (`upsert`).
- Si el token JWT expira, la sesión se cierra automáticamente y se vuelve al login.
