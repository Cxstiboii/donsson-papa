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
  LineChart,
  CalendarDays,
  Upload,
  ClipboardList,
} from "lucide-react";
import Login from "./components/Login.jsx";
import Referencias from "./components/Referencias.jsx";
import Materiales from "./components/Materiales.jsx";
import Parametros from "./components/Parametros.jsx";
import Comparativo from "./components/Comparativo.jsx";
import TabGraficos from "./TabGraficos.jsx";
import ImportarOdoo from "./components/ImportarOdoo.jsx";
import ImportarOP from "./components/ImportarOP.jsx";
import ImportarCostos from "./components/ImportarCostos.jsx";
import {
  getToken,
  clearToken,
  materialesApi,
  referenciasApi,
  parametrosApi,
  calcCostosEstandar,
  mesLabel,
  costosApi,
} from "./api.js";

const TABS = [
  { key: "referencias", label: "Referencias", icon: FileBarChart },
  { key: "materiales", label: "Materiales", icon: Boxes },
  { key: "parametros", label: "Parámetros", icon: Sliders },
  { key: "comparativo", label: "Comparativo Odoo", icon: GitCompare },
  { key: "graficos", label: "Gráficos", icon: LineChart },
  // { key: "importar", label: "Importar Odoo", icon: Upload },
  { key: "importar-op", label: "Importar OP", icon: ClipboardList },
  { key: "costos-produccion", label: "Costos Producción", icon: Factory },
];

export default function App() {
  const [authed, setAuthed] = useState(!!getToken());
  const [tab, setTab] = useState("referencias");
  const [referencias, setReferencias] = useState([]);
  const [materiales, setMateriales] = useState([]);
  const [parametros, setParametros] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mesActivo, setMesActivo] = useState("");

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

  const mesesDisponibles = useMemo(() => {
    return [...new Set(referencias.map((r) => r.mes).filter(Boolean))].sort().reverse();
  }, [referencias]);

  const referenciasFiltradas = useMemo(() => {
    if (!mesActivo) return referencias;
    return referencias.filter((r) => r.mes === mesActivo);
  }, [referencias, mesActivo]);

  const kpis = useMemo(() => {
    if (!parametros) return null;
    const conOdoo = referenciasFiltradas.filter((r) => {
      const c = calcCostosEstandar(r, parametros);
      return c.costoOdoo > 0;
    });
    const alertas = conOdoo.filter((r) => {
      const { variacion } = calcCostosEstandar(r, parametros);
      return variacion != null && Math.abs(variacion) > 10;
    });
    return {
      totalReferencias: referenciasFiltradas.length,
      totalMateriales: materiales.length,
      conOdoo: conOdoo.length,
      alertas: alertas.length,
    };
  }, [referenciasFiltradas, materiales, parametros]);

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
        {/* Selector de mes global */}
        {!loading && mesesDisponibles.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
            <CalendarDays size={18} style={{ color: "#2E75B6", flexShrink: 0 }} />
            <select
              value={mesActivo}
              onChange={(e) => setMesActivo(e.target.value)}
              className="input"
              style={{ minWidth: 180, maxWidth: 240, flex: "1 1 180px" }}
            >
              <option value="">Todos los meses</option>
              {mesesDisponibles.map((m) => (
                <option key={m} value={m}>{mesLabel(m)}</option>
              ))}
            </select>
            <span style={{ fontSize: 13, background: "#D6E4F0", color: "#1F3864", borderRadius: 12, padding: "2px 10px", fontWeight: 600 }}>
              {referenciasFiltradas.length} referencia{referenciasFiltradas.length !== 1 ? "s" : ""}
            </span>
          </div>
        )}

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
                referencias={referenciasFiltradas}
                materiales={materiales}
                parametros={parametros}
                reload={loadAll}
                mesActivo={mesActivo}
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
              <Comparativo referencias={referenciasFiltradas} parametros={parametros} />
            )}
            {tab === "graficos" && (
              <TabGraficos referencias={referenciasFiltradas} parametros={parametros} />
            )}
            {tab === "importar" && (
              <ImportarOdoo referencias={referencias} onImportDone={loadAll} />
            )}
            {tab === "importar-op" && (
              <ImportarOP reload={loadAll} />
            )}
            {tab === "costos-produccion" && (
              <ImportarCostos />
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
