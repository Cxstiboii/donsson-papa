import { useEffect, useMemo, useState } from "react";
import Login from "./components/Login.jsx";
import Referencias from "./components/Referencias.jsx";
import Materiales from "./components/Materiales.jsx";
import Parametros from "./components/Parametros.jsx";
import Comparativo from "./components/Comparativo.jsx";
import {
  getToken,
  clearToken,
  materialesApi,
  referenciasApi,
  parametrosApi,
  calcCostos,
  COLORS,
} from "./api.js";

const TABS = [
  { key: "referencias", label: "Referencias" },
  { key: "materiales", label: "Materiales" },
  { key: "parametros", label: "Parámetros" },
  { key: "comparativo", label: "Comparativo Odoo" },
];

export default function App() {
  const [authed, setAuthed] = useState(!!getToken());
  const [tab, setTab] = useState("referencias");
  const [referencias, setReferencias] = useState([]);
  const [materiales, setMateriales] = useState([]);
  const [parametros, setParametros] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadAll() {
    setLoading(true);
    setError("");
    try {
      const [refs, mats, params] = await Promise.all([
        referenciasApi.list(),
        materialesApi.list(),
        parametrosApi.get(),
      ]);
      setReferencias(refs);
      setMateriales(mats);
      setParametros(params);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (authed) loadAll();
  }, [authed]);

  const kpis = useMemo(() => {
    if (!parametros) return null;
    const conOdoo = referencias.filter((r) => r.costoReal > 0);
    const alertas = conOdoo.filter((r) => {
      const { variacion } = calcCostos(r, parametros);
      return variacion != null && Math.abs(variacion) > 10;
    });
    return {
      totalReferencias: referencias.length,
      totalMateriales: materiales.length,
      conOdoo: conOdoo.length,
      alertas: alertas.length,
    };
  }, [referencias, materiales, parametros]);

  function handleLogout() {
    clearToken();
    setAuthed(false);
  }

  if (!authed) {
    return <Login onLogin={() => setAuthed(true)} />;
  }

  return (
    <div style={{ fontFamily: "Segoe UI, Arial, sans-serif", minHeight: "100vh", background: COLORS.gris }}>
      <header
        style={{
          background: COLORS.azulOscuro,
          color: "#fff",
          padding: "16px 24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Industrias Donsoon</div>
          <div style={{ fontSize: 13, opacity: 0.85 }}>Sistema de Costos</div>
        </div>
        <button onClick={handleLogout} style={logoutBtnStyle}>
          Cerrar sesión
        </button>
      </header>

      {kpis && (
        <div
          style={{
            display: "flex",
            gap: 12,
            padding: "16px 24px",
            flexWrap: "wrap",
          }}
        >
          <Kpi label="Referencias" value={kpis.totalReferencias} color={COLORS.azulMedio} />
          <Kpi label="Materiales" value={kpis.totalMateriales} color={COLORS.azulMedio} />
          <Kpi label="Con costo Odoo" value={kpis.conOdoo} color={COLORS.verdeOscuro} bg={COLORS.verdeClaro} />
          <Kpi label="Alertas >10%" value={kpis.alertas} color={COLORS.rojoTexto} bg={COLORS.rojoFondo} />
        </div>
      )}

      <div style={{ padding: "0 24px" }}>
        <div style={{ display: "flex", gap: 4, borderBottom: `1px solid ${COLORS.azulClaro}`, marginBottom: 20, flexWrap: "wrap" }}>
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                ...tabBtnStyle,
                borderBottom: tab === t.key ? `3px solid ${COLORS.azulMedio}` : "3px solid transparent",
                color: tab === t.key ? COLORS.azulOscuro : "#555",
                fontWeight: tab === t.key ? 700 : 500,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {error && (
          <div style={{ background: COLORS.rojoFondo, color: COLORS.rojoTexto, padding: 12, borderRadius: 8, marginBottom: 16 }}>
            {error}
          </div>
        )}

        {loading || !parametros ? (
          <Spinner />
        ) : (
          <>
            {tab === "referencias" && (
              <Referencias
                referencias={referencias}
                materiales={materiales}
                parametros={parametros}
                reload={loadAll}
              />
            )}
            {tab === "materiales" && <Materiales materiales={materiales} reload={loadAll} />}
            {tab === "parametros" && (
              <Parametros
                parametros={parametros}
                onSaved={(p) => setParametros(p)}
              />
            )}
            {tab === "comparativo" && (
              <Comparativo referencias={referencias} parametros={parametros} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Kpi({ label, value, color, bg }) {
  return (
    <div
      style={{
        background: bg || "#fff",
        borderRadius: 10,
        padding: "12px 18px",
        minWidth: 130,
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
      }}
    >
      <div style={{ fontSize: 12, color: "#64748b" }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: color || "#1F3864" }}>{value}</div>
    </div>
  );
}

export function Spinner() {
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
      <div
        style={{
          width: 32,
          height: 32,
          border: "4px solid #D6E4F0",
          borderTopColor: "#2E75B6",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const logoutBtnStyle = {
  background: "transparent",
  border: "1px solid rgba(255,255,255,0.5)",
  color: "#fff",
  padding: "8px 16px",
  borderRadius: 8,
  cursor: "pointer",
};

const tabBtnStyle = {
  background: "transparent",
  border: "none",
  padding: "10px 16px",
  cursor: "pointer",
  fontSize: 14,
};
