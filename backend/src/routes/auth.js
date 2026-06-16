const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");

const router = express.Router();
const prisma = new PrismaClient();

router.post("/setup", async (req, res) => {
  try {
    const existing = await prisma.usuario.findUnique({ where: { id: 1 } });
    if (existing) {
      return res.status(400).json({ error: "El usuario ya fue configurado" });
    }

    const { password } = req.body;
    if (!password || password.length < 4) {
      return res.status(400).json({ error: "La contraseña debe tener al menos 4 caracteres" });
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

router.post("/login", async (req, res) => {
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
