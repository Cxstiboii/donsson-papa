require("dotenv").config();
const path = require("path");
const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth");
const materialesRoutes = require("./routes/materiales");
const referenciasRoutes = require("./routes/referencias");
const parametrosRoutes = require("./routes/parametros");
const { requireAuth } = require("./middleware/auth");

const app = express();
const PORT = process.env.PORT || 3001;

if (process.env.NODE_ENV !== "production") {
  app.use(cors({ origin: "http://localhost:5173" }));
}

app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/materiales", requireAuth, materialesRoutes);
app.use("/api/referencias", requireAuth, referenciasRoutes);
app.use("/api/parametros", requireAuth, parametrosRoutes);

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
