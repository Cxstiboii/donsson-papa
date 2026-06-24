require("dotenv").config();

const REQUIRED_ENV = ["DATABASE_URL", "JWT_SECRET"];
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`❌ Error: variable de entorno requerida "${key}" no está definida.`);
    process.exit(1);
  }
}
if (process.env.JWT_SECRET.length < 32) {
  console.error("❌ Error: JWT_SECRET debe tener al menos 32 caracteres.");
  process.exit(1);
}

const path = require("path");
const express = require("express");

const authRoutes = require("./routes/auth");
const materialesRoutes = require("./routes/materiales");
const referenciasRoutes = require("./routes/referencias");
const parametrosRoutes = require("./routes/parametros");
const importarCostosRoutes = require("./routes/importarCostos");
const importarOPRoutes = require("./routes/importarOP");
const { requireAuth } = require("./middleware/auth");

const app = express();
const PORT = process.env.PORT || 3001;

if (process.env.NODE_ENV !== "production") {
  const cors = require("cors");
  app.use(cors({ origin: "http://localhost:5173" }));
} else if (process.env.CORS_ORIGIN) {
  const cors = require("cors");
  app.use(cors({ origin: process.env.CORS_ORIGIN }));
}

app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/materiales", requireAuth, materialesRoutes);
app.use("/api/referencias", requireAuth, referenciasRoutes);
app.use("/api/parametros", requireAuth, parametrosRoutes);
app.use("/api/importar-costos", requireAuth, importarCostosRoutes);
app.use("/api/importar-op", requireAuth, importarOPRoutes);

const publicDir = path.join(__dirname, "..", "public");
app.use(express.static(publicDir));
app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Error interno del servidor" });
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en puerto ${PORT}`);
});

const prismaInstance = require("./prisma");

async function shutdown(signal) {
  console.log(`Señal ${signal} recibida. Cerrando servidor...`);
  await prismaInstance.$disconnect();
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
