import { useEffect, useState } from "react";
import { authApi, setToken, COLORS } from "../api.js";

export default function Login({ onLogin }) {
  const [configured, setConfigured] = useState(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    authApi
      .status()
      .then((d) => setConfigured(d.configured))
      .catch(() => setConfigured(true));
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!configured && password !== confirm) {
      setError("Las contraseñas no coinciden");
      return;
    }

    setLoading(true);
    try {
      const { token } = configured
        ? await authApi.login(password)
        : await authApi.setup(password);
      setToken(token);
      onLogin();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: COLORS.gris,
        fontFamily: "Segoe UI, Arial, sans-serif",
      }}
    >
      <div
        style={{
          background: COLORS.blanco,
          borderRadius: 12,
          padding: "40px 36px",
          width: 340,
          boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
          textAlign: "center",
        }}
      >
        <div style={{ color: COLORS.azulOscuro, fontSize: 22, fontWeight: 700, marginBottom: 4 }}>
          Industrias Donsoon
        </div>
        <div style={{ color: COLORS.azulMedio, fontSize: 14, marginBottom: 28 }}>
          Sistema de Costos
        </div>

        {configured === null ? (
          <div style={{ color: "#666" }}>Cargando…</div>
        ) : (
          <form onSubmit={handleSubmit}>
            {!configured && (
              <div style={{ ...alertStyle(COLORS.amberFondo, COLORS.amberTexto), marginBottom: 16 }}>
                Primer uso: crea una contraseña de acceso.
              </div>
            )}
            <input
              type="password"
              placeholder="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={inputStyle}
              autoFocus
            />
            {!configured && (
              <input
                type="password"
                placeholder="Confirmar contraseña"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                style={inputStyle}
              />
            )}
            {error && (
              <div style={{ ...alertStyle(COLORS.rojoFondo, COLORS.rojoTexto), marginBottom: 12 }}>
                {error}
              </div>
            )}
            <button type="submit" disabled={loading} style={buttonStyle}>
              {loading ? "Procesando…" : configured ? "Entrar" : "Crear contraseña"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  marginBottom: 12,
  borderRadius: 8,
  border: "1px solid #cbd5e1",
  fontSize: 14,
  boxSizing: "border-box",
};

const buttonStyle = {
  width: "100%",
  padding: "11px 0",
  background: "#1F3864",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  fontSize: 15,
  fontWeight: 600,
  cursor: "pointer",
};

function alertStyle(bg, color) {
  return {
    background: bg,
    color,
    borderRadius: 8,
    padding: "8px 10px",
    fontSize: 13,
    textAlign: "left",
  };
}
