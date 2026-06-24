const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const prisma = require("../prisma");

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Demasiados intentos. Intenta de nuevo en 15 minutos." },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post("/setup", authLimiter, async (req, res) => {
  try {
    const existing = await prisma.usuario.findUnique({ where: { id: 1 } });
    if (existing) {
      return res.status(400).json({ error: "El usuario ya fue configurado" });
    }

    const { password } = req.body;
    if (!password || password.length < 10) {
      return res.status(400).json({ error: "La contraseña debe tener al menos 10 caracteres" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.usuario.create({ data: { id: 1, passwordHash } });

    const token = jwt.sign({ uid: 1 }, process.env.JWT_SECRET, { expiresIn: "30d" });
    res.json({ token });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error al configurar usuario" });
  }
});

router.get("/status", async (req, res) => {
  try {
    const existing = await prisma.usuario.findUnique({ where: { id: 1 } });
    res.json({ configured: !!existing });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error al verificar estado" });
  }
});

router.post("/login", authLimiter, async (req, res) => {
  try {
    const { password } = req.body;
    const usuario = await prisma.usuario.findUnique({ where: { id: 1 } });

    if (!usuario) {
      return res.status(400).json({ error: "No hay usuario configurado" });
    }

    const valid = await bcrypt.compare(password || "", usuario.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: "Contraseña incorrecta" });
    }

    const token = jwt.sign({ uid: 1 }, process.env.JWT_SECRET, { expiresIn: "30d" });
    res.json({ token });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error al iniciar sesión" });
  }
});

module.exports = router;
