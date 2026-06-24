import { useEffect, useState } from "react";
import { Lock, AlertTriangle, AlertCircle, LogIn, UserPlus } from "lucide-react";
import { authApi, setToken } from "../api.js";

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
    <div className="login-shell">
      <div className="login-card">
        <div className="login-icon">
          <Lock size={24} />
        </div>
        <div className="login-title">Industrias Donsoon</div>
        <div className="login-subtitle">Sistema de Costos</div>

        {configured === null ? (
          <div className="spinner-wrap">
            <div className="spinner" />
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {!configured && (
              <div className="alert alert-warning" style={{ marginBottom: 16, textAlign: "left" }}>
                <AlertTriangle size={16} />
                <span>Primer uso: crea una contraseña de acceso.</span>
              </div>
            )}
            <label htmlFor="login-password" style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>
              Contraseña
            </label>
            <input
              id="login-password"
              type="password"
              placeholder="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              style={{ marginBottom: 12 }}
              autoFocus
            />
            {!configured && (
              <>
                <label htmlFor="login-confirm" style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>
                  Confirmar contraseña
                </label>
                <input
                  id="login-confirm"
                  type="password"
                  placeholder="Confirmar contraseña"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="input"
                  style={{ marginBottom: 12 }}
                />
              </>
            )}
            {error && (
              <div className="alert alert-error" style={{ marginBottom: 12, textAlign: "left" }}>
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}
            <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: "100%" }}>
              {configured ? <LogIn size={20} /> : <UserPlus size={20} />}
              {loading ? "Procesando…" : configured ? "Entrar" : "Crear contraseña"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
