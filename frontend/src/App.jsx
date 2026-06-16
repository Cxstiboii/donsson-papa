import { useEffect, useMemo, useState } from "react";
import {
  FileBarChart,
  Boxes,
  Sliders,
  GitCompare,
  LogOut,
  AlertCircle,
  Factory,
  PackageCheck,
  TriangleAlert,
} from "lucide-react";
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
} from "./api.js";

const TABS = [
  { key: "referencias", label: "Referencias", icon: FileBarChart },
  { key: "materiales", label: "Materiales", icon: Boxes },
  { key: "parametros", label: "Parámetros", icon: Sliders },
  { key: "comparativo", label: "Comparativo Odoo", icon: GitCompare },
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
    <div className="app-shell">
      <header className="app-hero">
        <div>
          <div className="app-hero-title">
            <Factory size={24} />
            Industrias Donsoon
          </div>
          <div className="app-hero-subtitle">Sistema de Costos</div>
        </div>
        <button onClick={handleLogout} className="btn btn-outline-light">
          <LogOut size={20} />
          Cerrar sesión
        </button>
      </header>

      {kpis && (
        <div className="kpi-grid">
          <Kpi icon={FileBarChart} label="Referencias" value={kpis.totalReferencias} variant="info" />
          <Kpi icon={Boxes} label="Materiales" value={kpis.totalMateriales} variant="info" />
          <Kpi icon={PackageCheck} label="Con costo Odoo" value={kpis.conOdoo} variant="success" />
          <Kpi icon={TriangleAlert} label="Alertas >10%" value={kpis.alertas} variant="error" />
        </div>
      )}

      <div className="app-main">
        <div className="tab-bar">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`tab-btn ${tab === t.key ? "active" : ""}`}
              >
                <Icon size={16} />
                {t.label}
              </button>
            );
          })}
        </div>

        {error && (
          <div className="alert alert-error" style={{ marginBottom: 16 }}>
            <AlertCircle size={16} />
            <span>{error}</span>
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

const KPI_VARIANTS = {
  info: { bg: "rgba(99,102,241,.12)", color: "#4F46E5" },
  success: { bg: "#D1FAE5", color: "#065F46" },
  error: { bg: "#FEE2E2", color: "#991B1B" },
};

function Kpi({ icon: Icon, label, value, variant }) {
  const v = KPI_VARIANTS[variant] || KPI_VARIANTS.info;
  return (
    <div className="kpi-card">
      <div className="kpi-icon" style={{ background: v.bg, color: v.color }}>
        <Icon size={20} />
      </div>
      <div>
        <div className="kpi-label">{label}</div>
        <div className="kpi-value">{value}</div>
      </div>
    </div>
  );
}

export function Spinner() {
  return (
    <div className="spinner-wrap">
      <div className="spinner" />
    </div>
  );
}
