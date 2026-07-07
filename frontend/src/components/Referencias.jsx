import { useEffect, useMemo, useRef, useState } from "react";
import {
  Plus, Pencil, Trash2, Search, FileBarChart, AlertCircle, X,
  Download, ChevronDown, ChevronRight, Package, Wrench, BarChart2, Scale,
} from "lucide-react";
import { referenciasApi, materialesApi } from "../api.js";
import { calcCostos, calcCostosEstandar, COP, mesLabel, fmt } from "../utils/costos.js";
import { parseCOP, formatCOP } from "../utils/costos.js";
import FiltroFecha, { dentroDeRango } from "../FiltroFecha.jsx";
import CostoOptimo from "./CostoOptimo.jsx";

function VarianzaOptimoBadge({ costoOptimo, costoEstandar }) {
  if (costoOptimo == null) return <span style={{ color: "var(--color-muted)" }}>—</span>;
  const varOptimo = costoEstandar > 0 ? ((costoOptimo - costoEstandar) / costoEstandar) * 100 : null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span style={{ fontWeight: 600 }}>{COP(costoOptimo)}</span>
      {varOptimo != null && (
        <span
          className={`badge ${varOptimo < 0 ? "badge-success" : varOptimo > 0 ? "badge-error" : "badge-info"}`}
          style={{ fontSize: 10, padding: "1px 6px", alignSelf: "flex-start" }}
        >
          {varOptimo > 0 ? "+" : ""}{varOptimo.toFixed(1)}%
        </span>
      )}
    </div>
  );
}

function emptyForm() {
  return { id: "", familia: "", mes: "", hMOD: 0, hCIF: 0, costoReal: "", consumos: {} };
}

// Materiales que "pertenecen" a una referencia para priorizar su orden en el
// modal de Costo Óptimo: los de su consumo manual, o los que calzan por
// nombre con los insumos de sus órdenes importadas de Odoo (mismo criterio
// de coincidencia que usa el backend al importar el CSV de costos).
function materialesPrioritariosDe(refId, referencias, materiales) {
  if (!refId) return new Set();
  const ids = new Set();
  const nombres = new Set();
  for (const r of referencias) {
    if (r.id !== refId) continue;
    for (const c of r.consumos || []) ids.add(c.materialId);
    for (const m of r.costosImportados?.materials || []) {
      if (m.insumo) nombres.add(m.insumo.trim().toLowerCase());
    }
  }
  if (nombres.size) {
    for (const m of materiales) {
      if (nombres.has(m.nombre.trim().toLowerCase())) ids.add(m.id);
    }
  }
  return ids;
}


const TH = {
  padding: "8px 10px", textAlign: "left", fontWeight: 600,
  fontSize: 12, color: "var(--color-muted)", whiteSpace: "nowrap",
};
const TD = { padding: "8px 10px", verticalAlign: "middle" };

// ── Sección colapsable ────────────────────────────────────────────────────────
function Collapsible({ title, icon: Icon, defaultOpen = true, badge, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section style={{ marginBottom: 24 }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex", alignItems: "center", gap: 8, width: "100%",
          background: "#EEF2FF", border: "1px solid #C7D2FE", borderRadius: 8,
          padding: "8px 14px", cursor: "pointer", marginBottom: open ? 12 : 0,
        }}
      >
        {open ? <ChevronDown size={16} color="#4F46E5" /> : <ChevronRight size={16} color="#4F46E5" />}
        {Icon && <Icon size={15} color="#4F46E5" />}
        <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".6px", color: "#4338CA" }}>
          {title}
        </span>
        {badge != null && (
          <span style={{
            marginLeft: "auto", fontSize: 11, background: "#C7D2FE", color: "#3730A3",
            borderRadius: 10, padding: "1px 8px", fontWeight: 700,
          }}>
            {badge}
          </span>
        )}
      </button>
      {open && children}
    </section>
  );
}

// ── Tabla de materiales importados ────────────────────────────────────────────
function TablaMateriasImportadas({ materials }) {
  if (!materials || materials.length === 0) {
    return (
      <div style={{ fontSize: 13, color: "var(--color-muted)", padding: "16px 0" }}>
        Sin materias primas importadas.
      </div>
    );
  }
  return (
    <div style={{ overflowX: "auto", borderRadius: 8, border: "1px solid var(--color-border)" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr style={{ background: "#F8FAFC", borderBottom: "1px solid var(--color-border)" }}>
            <th style={TH}>Insumo</th>
            <th style={{ ...TH, textAlign: "right" }}>Costo MP</th>
            <th style={{ ...TH, textAlign: "right" }}>Cant. Std</th>
            <th style={{ ...TH, textAlign: "right" }}>Vr. Std</th>
            <th style={{ ...TH, textAlign: "right" }}>Cant. Plan</th>
            <th style={{ ...TH, textAlign: "right" }}>Vr. Plan</th>
            <th style={{ ...TH, textAlign: "right" }}>Cant. Ejec</th>
            <th style={{ ...TH, textAlign: "right" }}>Vr. Ejec</th>
            <th style={{ ...TH, textAlign: "right" }}>Var.%</th>
          </tr>
        </thead>
        <tbody>
          {materials.map((m, i) => {
            const rowBg = i % 2 === 1 ? "#F8FAFC" : undefined;
            const varPct = m.variacionPct;
            const varColor = varPct == null ? "#374151" : varPct > 5 ? "#991B1B" : varPct < -5 ? "#065F46" : "#374151";
            return (
              <tr key={m.id} style={{ background: rowBg, borderBottom: "1px solid var(--color-border)" }}>
                <td style={{ ...TD, fontWeight: 500 }}>{m.insumo}</td>
                <td style={{ ...TD, textAlign: "right" }}>{COP(m.costoMp)}</td>
                <td style={{ ...TD, textAlign: "right" }}>{fmt(m.cantStd, 4)}</td>
                <td style={{ ...TD, textAlign: "right", fontWeight: 600, color: "#1F3864" }}>{COP(m.vrStd)}</td>
                <td style={{ ...TD, textAlign: "right" }}>{fmt(m.cantPlaneado, 4)}</td>
                <td style={{ ...TD, textAlign: "right" }}>{COP(m.vrPlaneado)}</td>
                <td style={{ ...TD, textAlign: "right" }}>{fmt(m.cantEjecutado, 4)}</td>
                <td style={{ ...TD, textAlign: "right" }}>{COP(m.vrEjecutado)}</td>
                <td style={{ ...TD, textAlign: "right" }}>
                  {varPct != null ? (
                    <span style={{
                      background: varPct > 5 ? "#FEE2E2" : varPct < -5 ? "#D1FAE5" : "#F1F5F9",
                      color: varColor, borderRadius: 10, padding: "2px 7px", fontWeight: 700, fontSize: 11,
                    }}>
                      {varPct > 0 ? "+" : ""}{Number(varPct).toFixed(1)}%
                    </span>
                  ) : "—"}
                </td>
              </tr>
            );
          })}
          <tr style={{ background: "#EEF2FF", fontWeight: 700, borderTop: "2px solid var(--color-border)" }}>
            <td colSpan={3} style={{ ...TD, fontSize: 12, color: "var(--color-muted)" }}>Total</td>
            <td style={{ ...TD, textAlign: "right", color: "#1F3864" }}>
              {COP(materials.reduce((s, m) => s + (m.vrStd ?? 0), 0))}
            </td>
            <td style={TD} />
            <td style={{ ...TD, textAlign: "right", color: "#1F3864" }}>
              {COP(materials.reduce((s, m) => s + (m.vrPlaneado ?? 0), 0))}
            </td>
            <td style={TD} />
            <td style={{ ...TD, textAlign: "right" }}>
              {COP(materials.reduce((s, m) => s + (m.vrEjecutado ?? 0), 0))}
            </td>
            <td style={TD} />
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ── Tabla de MO y CIF importados ──────────────────────────────────────────────
const MO_ORDEN = [
  "MANO DE OBRA EMBALAJE",
  "MANO DE OBRA CORTE",
  "MANO DE OBRA PLISADO",
  "MANO DE OBRA INYECCION",
  "CARGA FABRIL",
];

function TablaMOCIF({ laborItems }) {
  if (!laborItems || laborItems.length === 0) {
    return (
      <div style={{ fontSize: 13, color: "var(--color-muted)", padding: "16px 0" }}>
        Sin datos de mano de obra o carga fabril.
      </div>
    );
  }

  // Agregar por proceso (puede haber múltiples órdenes)
  const byProceso = {};
  for (const l of laborItems) {
    const key = (l.proceso || "").toUpperCase().trim();
    if (!byProceso[key]) byProceso[key] = { proceso: l.proceso, vrStd: 0, vrPlaneado: 0, vrEjecutado: 0, tipo: l.tipo };
    byProceso[key].vrStd += l.vrStd ?? 0;
    byProceso[key].vrPlaneado += l.vrPlaneado ?? 0;
    byProceso[key].vrEjecutado += l.vrEjecutado ?? 0;
  }

  // Ordenar según el orden estándar, luego los extra
  const ordered = [];
  for (const name of MO_ORDEN) {
    if (byProceso[name]) ordered.push(byProceso[name]);
  }
  for (const [key, val] of Object.entries(byProceso)) {
    if (!MO_ORDEN.includes(key)) ordered.push(val);
  }

  return (
    <div style={{ overflowX: "auto", borderRadius: 8, border: "1px solid var(--color-border)" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr style={{ background: "#F8FAFC", borderBottom: "1px solid var(--color-border)" }}>
            <th style={TH}>Proceso</th>
            <th style={{ ...TH, textAlign: "right" }}>Vr. x Ud. Planeado Standard</th>
            <th style={{ ...TH, textAlign: "right" }}>Vr. Planeado</th>
            <th style={{ ...TH, textAlign: "right" }}>Vr. Ejecutado</th>
          </tr>
        </thead>
        <tbody>
          {ordered.map((row, i) => {
            const isCIF = row.tipo === "carga_fabril";
            const rowBg = isCIF ? "#FFF7ED" : i % 2 === 1 ? "#F8FAFC" : undefined;
            return (
              <tr key={row.proceso} style={{ background: rowBg, borderBottom: "1px solid var(--color-border)" }}>
                <td style={{ ...TD, fontWeight: isCIF ? 700 : 500 }}>
                  {isCIF ? (
                    <span style={{ background: "#FEF3C7", color: "#92400E", borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>
                      {row.proceso}
                    </span>
                  ) : row.proceso}
                </td>
                <td style={{ ...TD, textAlign: "right", fontWeight: 700, color: "#1F3864" }}>
                  {COP(row.vrStd)}
                </td>
                <td style={{ ...TD, textAlign: "right" }}>{COP(row.vrPlaneado)}</td>
                <td style={{ ...TD, textAlign: "right" }}>{COP(row.vrEjecutado)}</td>
              </tr>
            );
          })}
          <tr style={{ background: "#EEF2FF", fontWeight: 700, borderTop: "2px solid var(--color-border)" }}>
            <td style={{ ...TD, fontSize: 12, color: "var(--color-muted)" }}>Total</td>
            <td style={{ ...TD, textAlign: "right", color: "#1F3864" }}>
              {COP(ordered.reduce((s, r) => s + (r.vrStd ?? 0), 0))}
            </td>
            <td style={{ ...TD, textAlign: "right" }}>
              {COP(ordered.reduce((s, r) => s + (r.vrPlaneado ?? 0), 0))}
            </td>
            <td style={{ ...TD, textAlign: "right" }}>
              {COP(ordered.reduce((s, r) => s + (r.vrEjecutado ?? 0), 0))}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ── Análisis de Variación ─────────────────────────────────────────────────────

function VarianzaBadge({ value }) {
  if (value == null || isNaN(value)) return <span style={{ color: "var(--color-muted)" }}>—</span>;
  const favorable = value > 0;
  const cls = favorable ? "badge-success" : value < 0 ? "badge-error" : "badge-info";
  return (
    <span className={`badge ${cls}`} style={{ fontSize: 11, padding: "2px 8px" }}>
      {value > 0 ? "+" : ""}{COP(value)}
    </span>
  );
}

function BridgeTable({ data }) {
  const filas = [
    { label: "MOD — Eficiencia (tiempo)", value: data.mod.varTiempoMOD, indent: true },
    { label: "MOD — Tarifa", value: data.mod.varTarifaMOD, indent: true },
    { label: "CIF — Eficiencia (tiempo)", value: data.cif.varTiempoCIF, indent: true },
    { label: "CIF — Tarifa", value: data.cif.varTarifaCIF, indent: true },
    {
      label: "Materiales (subtotal)",
      value: data.mpd.impactoTotal,
      indent: false,
      bold: true,
    },
  ];

  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginBottom: 12, border: "1px solid var(--color-border)", borderRadius: 8, overflow: "hidden" }}>
      <tbody>
        <tr style={{ background: "#EEF2FF" }}>
          <td style={{ padding: "10px 14px", fontWeight: 700, color: "var(--color-primary)" }}>Costo Estándar</td>
          <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 700, color: "var(--color-primary)", whiteSpace: "nowrap" }}>{COP(data.reconciliacion.costoEstandar)}</td>
          <td style={{ width: 160, padding: "10px 14px" }} />
        </tr>
        {filas.map((f) => (
          <tr key={f.label} style={{ borderTop: "1px solid var(--color-border)" }}>
            <td style={{ padding: "8px 14px", paddingLeft: f.indent ? 32 : 14, fontWeight: f.bold ? 700 : undefined, color: "var(--color-text)" }}>
              {f.label}
            </td>
            <td style={{ padding: "8px 14px", textAlign: "right", color: "var(--color-text)", whiteSpace: "nowrap" }}>
              {f.value != null ? COP(f.value) : "—"}
            </td>
            <td style={{ padding: "8px 14px" }}>
              <VarianzaBadge value={f.value} />
            </td>
          </tr>
        ))}
        <tr style={{ background: "#FFF7ED", borderTop: "2px solid var(--color-border)" }}>
          <td style={{ padding: "10px 14px", fontWeight: 700, color: "#92400E" }}>Costo Producción (Odoo)</td>
          <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 700, color: "#92400E", whiteSpace: "nowrap" }}>{COP(data.reconciliacion.costoProduccion)}</td>
          <td style={{ padding: "10px 14px" }} />
        </tr>
      </tbody>
    </table>
  );
}

function TopMateriales({ desglose }) {
  const top5 = [...desglose]
    .sort((a, b) => Math.abs(b.impactoTotal) - Math.abs(a.impactoTotal))
    .slice(0, 5);

  if (!top5.length) return null;

  return (
    <>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".6px", color: "var(--color-muted)", margin: "16px 0 8px" }}>
        Principales desviaciones de materiales
      </div>
      <div style={{ overflowX: "auto", borderRadius: 8, border: "1px solid var(--color-border)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ background: "#F8FAFC", borderBottom: "1px solid var(--color-border)" }}>
              <th style={{ ...TH }}>Material</th>
              <th style={{ ...TH, textAlign: "right" }}>Cant. Plan</th>
              <th style={{ ...TH, textAlign: "right" }}>Cant. Ejec</th>
              <th style={{ ...TH, textAlign: "right" }}>Var. Cantidad</th>
              <th style={{ ...TH, textAlign: "right" }}>Var. Precio</th>
              <th style={{ ...TH, textAlign: "right" }}>Impacto</th>
            </tr>
          </thead>
          <tbody>
            {top5.map((m, i) => (
              <tr key={m.insumo} style={{ background: i % 2 === 1 ? "#F8FAFC" : undefined, borderBottom: "1px solid var(--color-border)" }}>
                <td style={{ ...TD, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis" }}>{m.insumo}</td>
                <td style={{ ...TD, textAlign: "right" }}>{fmt(m.cantPlaneado, 4)}</td>
                <td style={{ ...TD, textAlign: "right" }}>{fmt(m.cantEjecutado, 4)}</td>
                <td style={{ ...TD, textAlign: "right" }}><VarianzaBadge value={m.varCantidad} /></td>
                <td style={{ ...TD, textAlign: "right" }}><VarianzaBadge value={m.varPrecio} /></td>
                <td style={{ ...TD, textAlign: "right" }}><VarianzaBadge value={m.impactoTotal} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function InfoSegTarifa({ label, segStd, segEjec, tarifaReal }) {
  const fmtSeg = (v) => (v != null ? Number(v).toLocaleString("es-CO", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : "—");
  const fmtTarifa = (v) => (v != null ? `$ ${Number(v).toLocaleString("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/seg` : "—");
  return (
    <div style={{ display: "flex", gap: 20, flexWrap: "wrap", fontSize: 12, color: "var(--color-muted)", marginBottom: 4 }}>
      <span><b>{label}</b></span>
      <span>Std: {fmtSeg(segStd)} seg</span>
      <span>Ejec: {fmtSeg(segEjec)} seg</span>
      <span>Tarifa real: {fmtTarifa(tarifaReal)}</span>
    </div>
  );
}

function ModalVariacion({ refId, refMes, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    referenciasApi.variacion(refId, refMes)
      .then(setData)
      .catch((e) => setErrorMsg(e.message))
      .finally(() => setLoading(false));
  }, [refId, refMes]);

  return (
    <div className="overlay" onClick={onClose}>
      <div
        className="modal"
        style={{ width: 740, maxWidth: "96vw", maxHeight: "92vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="modal-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <BarChart2 size={20} />
          Análisis de Variación — {refId}
          <button
            onClick={onClose}
            style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "var(--color-muted)", padding: 4 }}
          >
            <X size={22} />
          </button>
        </h3>

        {loading && <div className="spinner-wrap"><div className="spinner" /></div>}

        {errorMsg && (
          <div className="alert alert-error">
            <AlertCircle size={16} /> {errorMsg}
          </div>
        )}

        {data && !loading && (
          <>
            {data.datosIncompletos ? (
              <div className="alert alert-warning" style={{ marginTop: 12 }}>
                <AlertCircle size={16} />
                Reimporta la orden para ver el análisis de variación
              </div>
            ) : (
              <>
                {data.inconsistenciaStd && (
                  <div className="alert alert-warning" style={{ marginBottom: 16 }}>
                    <AlertCircle size={16} />
                    Los segundos estándar de MOD no coinciden con los de Carga Fabril en Odoo. El estándar de MOD puede estar inflado.
                  </div>
                )}

                <BridgeTable data={data} />

                <div style={{ background: "#F8FAFC", border: "1px solid var(--color-border)", borderRadius: 8, padding: "10px 14px", marginBottom: 4 }}>
                  <InfoSegTarifa label="MOD" segStd={data.mod.segStd} segEjec={data.mod.segEjec} tarifaReal={data.mod.tarifaRealMOD} />
                  <InfoSegTarifa label="CIF" segStd={data.cif.segStd} segEjec={data.cif.segEjec} tarifaReal={data.cif.tarifaRealCIF} />
                </div>

                <TopMateriales desglose={data.mpd.desglose} />

                <div style={{ fontSize: 11, color: "var(--color-muted)", marginTop: 12, borderTop: "1px solid var(--color-border)", paddingTop: 8 }}>
                  Conciliación: diferencia {COP(data.reconciliacion.diffTotal)} — suma varianzas {COP(data.reconciliacion.sumVarianzas)} — residual {COP(Math.abs(data.reconciliacion.residual))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function Referencias({ referencias, materiales, parametros, reload, mesActivo }) {
  const [busqueda, setBusqueda] = useState("");
  const [familia, setFamilia] = useState("");
  const [modoFecha, setModoFecha] = useState("mensual");
  const [mesFiltro, setMesFiltro] = useState(mesActivo || "");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [matSelectId, setMatSelectId] = useState("");
  const [matSelectQty, setMatSelectQty] = useState("");

  const [modalVariacion, setModalVariacion] = useState(null);
  const [costoOptimoRef, setCostoOptimoRef] = useState(null);

  const [drawerRef, setDrawerRef] = useState(null);
  const [drawerEditingInfo, setDrawerEditingInfo] = useState(false);
  const [drawerInfoForm, setDrawerInfoForm] = useState({});
  const [drawerSavingInfo, setDrawerSavingInfo] = useState(false);
  const [drawerMatCostEdit, setDrawerMatCostEdit] = useState(null);
  const [drawerMatCostVal, setDrawerMatCostVal] = useState(0);
  const [drawerMatQtyEdit, setDrawerMatQtyEdit] = useState(null);
  const [drawerMatQtyVal, setDrawerMatQtyVal] = useState("");
  const [drawerAddMatId, setDrawerAddMatId] = useState("");
  const [drawerAddMatQty, setDrawerAddMatQty] = useState("");
  const [drawerSaving, setDrawerSaving] = useState(false);

  const drawerRefKeyRef = useRef(null);

  useEffect(() => {
    drawerRefKeyRef.current = drawerRef ? `${drawerRef.id}-${drawerRef.mes}` : null;
  }, [drawerRef]);

  useEffect(() => {
    if (!drawerRefKeyRef.current) return;
    const updated = referencias.find((r) => `${r.id}-${r.mes}` === drawerRefKeyRef.current);
    if (updated) setDrawerRef(updated);
  }, [referencias]);

  const familias = useMemo(
    () => [...new Set(referencias.map((r) => r.familia).filter(Boolean))].sort(),
    [referencias],
  );

  const filtradas = useMemo(() => {
    return referencias.filter((r) => {
      if (familia && r.familia !== familia) return false;
      if (modoFecha === "mensual") {
        if (mesFiltro && r.mes !== mesFiltro) return false;
      } else {
        if ((desde || hasta) && !dentroDeRango(r.mes, desde, hasta)) return false;
      }
      if (busqueda && !r.id.toLowerCase().includes(busqueda.toLowerCase())) return false;
      return true;
    });
  }, [referencias, familia, modoFecha, mesFiltro, desde, hasta, busqueda]);

  const filtroLabel = useMemo(() => {
    if (modoFecha === "mensual") return mesFiltro ? mesLabel(mesFiltro) : "Todos los meses";
    if (desde || hasta) return `${desde ? mesLabel(desde) : "…"} a ${hasta ? mesLabel(hasta) : "…"}`;
    return "Todos los meses";
  }, [modoFecha, mesFiltro, desde, hasta]);

  const matsDisponibles = useMemo(() => {
    const ids = new Set(Object.keys(form.consumos));
    return materiales.filter((m) => !ids.has(m.id));
  }, [materiales, form.consumos]);

  const materialesPrioritariosOptimo = useMemo(
    () => materialesPrioritariosDe(costoOptimoRef, referencias, materiales),
    [costoOptimoRef, referencias, materiales],
  );

  async function handleExport() {
    const { exportarExcel } = await import("../exportExcel.js");
    exportarExcel(filtradas, parametros, filtroLabel).catch((err) => {
      console.error("Error exportando Excel:", err);
      setError("No se pudo generar el archivo Excel.");
    });
  }

  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setMatSelectId(""); setMatSelectQty(""); setError("");
    setModalOpen(true);
  }

  function openEdit(r) {
    setEditing(r);
    const consumos = {};
    for (const c of r.consumos) consumos[c.materialId] = c.cantidad;
    setForm({ id: r.id, familia: r.familia, mes: r.mes, hMOD: r.segMOD ?? 0, hCIF: r.cifUnitario ?? 0, costoReal: r.costoReal || "", consumos });
    setMatSelectId(""); setMatSelectQty(""); setError("");
    setModalOpen(true);
  }

  function agregarMaterial() {
    if (!matSelectId || Number(matSelectQty) <= 0) return;
    setForm((f) => ({ ...f, consumos: { ...f.consumos, [matSelectId]: matSelectQty } }));
    setMatSelectId(""); setMatSelectQty("");
  }

  function quitarMaterial(mid) {
    setForm((f) => { const c = { ...f.consumos }; delete c[mid]; return { ...f, consumos: c }; });
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true); setError("");
    try {
      const consumos = Object.entries(form.consumos)
        .filter(([, qty]) => Number(qty) > 0)
        .map(([materialId, cantidad]) => ({ materialId, cantidad: Number(cantidad) }));
      const payload = {
        id: form.id, familia: form.familia, mes: form.mes,
        segMOD: Number(form.hMOD), cifUnitario: Number(form.hCIF),
        costoReal: parseCOP(form.costoReal) || 0, consumos,
      };
      if (editing) await referenciasApi.update(editing.id, payload);
      else await referenciasApi.create(payload);
      setModalOpen(false);
      await reload();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  async function handleDelete(r) {
    const filasRelacionadas = referencias.filter((x) => x.id === r.id);
    if (r.costosImportados && filasRelacionadas.length > 1) {
      const meses = filasRelacionadas.map((x) => mesLabel(x.mes)).join(", ");
      const ok = confirm(
        `La referencia ${r.id} tiene órdenes importadas en ${filasRelacionadas.length} meses distintos (${meses}).\n\n` +
        `Eliminar la referencia borrará TODOS esos meses, no solo ${mesLabel(r.mes)}.\n\n` +
        `Si solo quieres borrar las órdenes de ${mesLabel(r.mes)}, cancela y usa el botón "Eliminar mes".\n\n` +
        `¿Eliminar la referencia completa de todas formas?`
      );
      if (!ok) return;
    } else {
      if (!confirm(`¿Eliminar la referencia ${r.id}?`)) return;
    }
    try { await referenciasApi.remove(r.id); await reload(); }
    catch (e) { alert(e.message); }
  }

  async function handleDeleteMes(r) {
    if (!confirm(`¿Eliminar solo las órdenes de ${r.id} del mes ${mesLabel(r.mes)}?\n\nLa referencia y sus demás meses no se verán afectados.`)) return;
    try { await referenciasApi.eliminarOrdenesMes(r.id, r.mes); await reload(); }
    catch (e) { alert(e.message); }
  }

  function openDrawer(r) {
    setDrawerRef(r);
    setDrawerEditingInfo(false);
    setDrawerInfoForm({ familia: r.familia, mes: r.mes, segMOD: r.segMOD, cifUnitario: r.cifUnitario, costoReal: r.costoReal || "" });
    setDrawerMatCostEdit(null); setDrawerMatQtyEdit(null);
    setDrawerAddMatId(""); setDrawerAddMatQty("");
  }

  function buildRefPayload(ref, consumos) {
    return {
      familia: ref.familia, mes: ref.mes, segMOD: ref.segMOD, cifUnitario: ref.cifUnitario,
      costoReal: ref.costoReal || 0,
      consumos: consumos ?? (ref.consumos || []).map((c) => ({ materialId: c.materialId, cantidad: c.cantidad })),
    };
  }

  async function saveDrawerInfo() {
    setDrawerSavingInfo(true);
    try {
      const consumos = (drawerRef.consumos || []).map((c) => ({ materialId: c.materialId, cantidad: c.cantidad }));
      await referenciasApi.update(drawerRef.id, {
        familia: drawerInfoForm.familia, mes: drawerInfoForm.mes,
        segMOD: Number(drawerInfoForm.segMOD),
        cifUnitario: parseCOP(drawerInfoForm.cifUnitario) || 0,
        costoReal: parseCOP(drawerInfoForm.costoReal) || 0,
        consumos,
      });
      setDrawerEditingInfo(false);
      await reload();
    } catch (e) { alert(e.message); }
    finally { setDrawerSavingInfo(false); }
  }

  async function saveDrawerMatCost(mat) {
    setDrawerSaving(true);
    try {
      await materialesApi.update(mat.id, { nombre: mat.nombre, unidad: mat.unidad, costo: parseCOP(drawerMatCostVal) || 0 });
      setDrawerMatCostEdit(null);
      await reload();
    } catch (e) { alert(e.message); }
    finally { setDrawerSaving(false); }
  }

  async function saveDrawerMatQty(consumo) {
    setDrawerSaving(true);
    try {
      const newConsumos = (drawerRef.consumos || []).map((c) => ({
        materialId: c.materialId,
        cantidad: c.materialId === consumo.materialId ? Number(drawerMatQtyVal) : c.cantidad,
      }));
      await referenciasApi.update(drawerRef.id, buildRefPayload(drawerRef, newConsumos));
      setDrawerMatQtyEdit(null);
      await reload();
    } catch (e) { alert(e.message); }
    finally { setDrawerSaving(false); }
  }

  async function removeDrawerMat(materialId) {
    if (!confirm("¿Quitar este material de la referencia?")) return;
    setDrawerSaving(true);
    try {
      const newConsumos = (drawerRef.consumos || [])
        .filter((c) => c.materialId !== materialId)
        .map((c) => ({ materialId: c.materialId, cantidad: c.cantidad }));
      await referenciasApi.update(drawerRef.id, buildRefPayload(drawerRef, newConsumos));
      await reload();
    } catch (e) { alert(e.message); }
    finally { setDrawerSaving(false); }
  }

  async function addDrawerMat() {
    if (!drawerAddMatId || Number(drawerAddMatQty) <= 0) return;
    setDrawerSaving(true);
    try {
      const newConsumos = [
        ...(drawerRef.consumos || []).map((c) => ({ materialId: c.materialId, cantidad: c.cantidad })),
        { materialId: drawerAddMatId, cantidad: Number(drawerAddMatQty) },
      ];
      await referenciasApi.update(drawerRef.id, buildRefPayload(drawerRef, newConsumos));
      setDrawerAddMatId(""); setDrawerAddMatQty("");
      await reload();
    } catch (e) { alert(e.message); }
    finally { setDrawerSaving(false); }
  }

  return (
    <div>
      {/* Filtros y acciones */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16, alignItems: "center" }}>
        <div style={{ position: "relative", minWidth: 220, flex: "1 1 220px" }}>
          <Search size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--color-muted)" }} />
          <input placeholder="Buscar por código…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className="input" style={{ paddingLeft: 36 }} />
        </div>
        <FiltroFecha modo={modoFecha} setModo={setModoFecha} mes={mesFiltro} setMes={setMesFiltro} desde={desde} setDesde={setDesde} hasta={hasta} setHasta={setHasta} />
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button className={`pill ${!familia ? "active" : ""}`} onClick={() => setFamilia("")}>Todas</button>
          {familias.map((f) => (
            <button key={f} className={`pill ${familia === f ? "active" : ""}`} onClick={() => setFamilia(f)}>{f}</button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <button onClick={handleExport} className="btn" style={{ background: "#065F46", color: "#fff", border: "none" }}>
          <Download size={18} /> Exportar Excel
        </button>
        <button onClick={openCreate} className="btn btn-primary">
          <Plus size={20} /> Nueva referencia
        </button>
      </div>

      {/* Tabla Nivel 1 */}
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Código</th>
              <th>Familia</th>
              <th>Mes</th>
              <th>MPD</th>
              <th>MOD</th>
              <th>CIF</th>
              <th>Costo Estándar</th>
              <th>Costo Producción (Odoo)</th>
              <th>Costo Óptimo</th>
              <th>Variación %</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtradas.map((r, rowIdx) => {
              const c = calcCostosEstandar(r, parametros);
              const variacion = c.variacion;
              // Variación % = (costoOdoo − costoEstandar) / costoEstandar
              // Positivo = ejecutado más caro que estándar → DESFAVORABLE → rojo
              // Negativo = ejecutado más barato que estándar → FAVORABLE → verde
              const variacionClass =
                variacion == null ? ""
                : variacion > 0 ? "badge-error"
                : variacion < 0 ? "badge-success"
                : "badge-info";
              const rowBg = rowIdx % 2 === 1 ? "#F8FAFC" : undefined;
              return (
                <tr key={`${r.id}-${r.mes}`} style={{ background: rowBg, cursor: "pointer" }} onClick={() => openDrawer(r)}>
                  <td>
                    {r.id}
                    {c.fuenteImportada && (
                      <span title="Datos de importación" style={{ marginLeft: 6, fontSize: 10, background: "#D1FAE5", color: "#065F46", borderRadius: 6, padding: "1px 5px", fontWeight: 700, verticalAlign: "middle" }}>
                        OP
                      </span>
                    )}
                  </td>
                  <td>{r.familia}</td>
                  <td>{mesLabel(r.mes)}</td>
                  <td>{COP(c.mpd)}</td>
                  <td>{COP(c.mod)}</td>
                  <td>{COP(c.cif)}</td>
                  <td style={{ fontWeight: 600 }}>{COP(c.costoEstandar)}</td>
                  <td>{c.costoOdoo > 0 ? COP(c.costoOdoo) : "—"}</td>
                  <td><VarianzaOptimoBadge costoOptimo={r.costoOptimo} costoEstandar={c.costoEstandar} /></td>
                  <td>
                    {variacion != null ? (
                      <span className={`badge ${variacionClass}`}>
                        {variacion > 0 ? "+" : ""}{variacion.toFixed(1)}%
                      </span>
                    ) : "—"}
                  </td>
                  <td>
                    <button onClick={(e) => { e.stopPropagation(); openEdit(r); }} className="btn btn-ghost">
                      <Pencil size={16} /> Editar
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setModalVariacion({ refId: r.id, refMes: r.mes }); }} className="btn btn-ghost">
                      <BarChart2 size={16} /> Variación
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setCostoOptimoRef(r.id); }} className="btn btn-ghost">
                      <Scale size={16} /> Costo Óptimo
                    </button>
                    {r.costosImportados && (
                      <button onClick={(e) => { e.stopPropagation(); handleDeleteMes(r); }} className="btn btn-ghost-danger" title="Elimina solo las órdenes de este mes; la referencia y sus demás meses quedan intactos">
                        <Trash2 size={16} /> Eliminar mes
                      </button>
                    )}
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(r); }} className="btn btn-ghost-danger" title={r.costosImportados ? "Elimina la referencia completa, incluyendo todos sus meses" : "Elimina la referencia"}>
                      <Trash2 size={16} /> Eliminar
                    </button>
                  </td>
                </tr>
              );
            })}
            {filtradas.length === 0 && (
              <tr>
                <td colSpan={11}>
                  <div className="empty-state">
                    <div className="empty-state-icon"><FileBarChart size={28} /></div>
                    <div className="empty-state-title">No hay referencias que coincidan con el filtro</div>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal crear / editar */}
      {modalOpen && (
        <div className="overlay" onClick={() => setModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">
              <FileBarChart size={20} />
              {editing ? "Editar referencia" : "Nueva referencia"}
            </h3>
            <form onSubmit={handleSave}>
              <div className="field-grid-2">
                <div>
                  <label className="field-label">Código</label>
                  <input className="input" value={form.id} disabled={!!editing} onChange={(e) => setForm({ ...form, id: e.target.value })} required />
                </div>
                <div>
                  <label className="field-label">Familia</label>
                  <select className="input" value={form.familia} onChange={(e) => setForm({ ...form, familia: e.target.value })} required>
                    <option value="">Seleccionar familia…</option>
                    <option value="AAA">AAA</option>
                    <option value="A">A</option>
                    <option value="B">B</option>
                    <option value="C">C</option>
                  </select>
                </div>
              </div>
              <div className="field-grid-2">
                <div>
                  <label className="field-label">Mes</label>
                  <input type="month" className="input" value={form.mes} onChange={(e) => setForm({ ...form, mes: e.target.value })} required
                    disabled={!!editing?.costosImportados}
                    title={editing?.costosImportados ? "El mes proviene de las órdenes importadas de Odoo y no se puede editar aquí" : undefined} />
                  {editing?.costosImportados && (
                    <div style={{ fontSize: 11, color: "var(--color-muted)", marginTop: 4 }}>
                      Proviene de las órdenes importadas — no editable
                    </div>
                  )}
                </div>
                <div>
                  <label className="field-label">Costo real Odoo</label>
                  <input type="text" className="input" value={formatCOP(form.costoReal)} onChange={(e) => setForm({ ...form, costoReal: parseCOP(e.target.value) })} />
                </div>
              </div>
              <div className="field-grid-2">
                <div>
                  <label className="field-label">MOD manual (COP)</label>
                  <input type="number" step="1" min="0" className="input" placeholder="$ 0" value={form.hMOD} onChange={(e) => setForm({ ...form, hMOD: e.target.value })} required />
                </div>
                <div>
                  <label className="field-label">CIF manual (COP)</label>
                  <input type="number" step="1" min="0" className="input" placeholder="$ 0" value={form.hCIF} onChange={(e) => setForm({ ...form, hCIF: e.target.value })} required />
                </div>
              </div>

              <label className="field-label" style={{ marginTop: 16 }}>Materiales consumidos</label>
              {Object.keys(form.consumos).length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  {Object.entries(form.consumos).map(([mid, qty]) => {
                    const mat = materiales.find((m) => m.id === mid);
                    return (
                      <div key={mid} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, padding: "6px 10px", background: "#F0F7FF", borderRadius: 6, border: "1px solid #BDD7EE" }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#2E75B6", minWidth: 64 }}>{mid}</span>
                        <span style={{ flex: 1, fontSize: 13 }}>{mat ? mat.nombre : mid} {mat ? `(${mat.unidad})` : ""}</span>
                        <input type="number" step="0.0001" min="0" value={qty}
                          onChange={(e) => setForm((f) => ({ ...f, consumos: { ...f.consumos, [mid]: e.target.value } }))}
                          className="input" style={{ width: 90, height: 32 }} />
                        <button type="button" onClick={() => quitarMaterial(mid)} style={{ background: "none", border: "none", cursor: "pointer", color: "#991B1B", padding: 4 }}>
                          <X size={16} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
              {matsDisponibles.length > 0 && (
                <div style={{ display: "flex", gap: 6, alignItems: "flex-end", marginBottom: 6 }}>
                  <div style={{ flex: 1 }}>
                    <select className="input" value={matSelectId} onChange={(e) => setMatSelectId(e.target.value)} style={{ height: 36 }}>
                      <option value="">— Seleccionar material —</option>
                      {matsDisponibles.map((m) => (
                        <option key={m.id} value={m.id}>{m.id} — {m.nombre} ({m.unidad})</option>
                      ))}
                    </select>
                  </div>
                  <input type="number" step="0.0001" min="0" placeholder="Cantidad"
                    value={matSelectQty} onChange={(e) => setMatSelectQty(e.target.value)}
                    className="input" style={{ width: 100, height: 36 }}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); agregarMaterial(); } }} />
                  <button type="button" onClick={agregarMaterial} className="btn btn-primary"
                    style={{ height: 36, padding: "0 12px", whiteSpace: "nowrap" }}
                    disabled={!matSelectId || !matSelectQty || Number(matSelectQty) <= 0}>
                    <Plus size={16} /> Agregar
                  </button>
                </div>
              )}
              {matsDisponibles.length === 0 && Object.keys(form.consumos).length === 0 && (
                <div style={{ fontSize: 13, color: "var(--color-muted)" }}>No hay materiales registrados.</div>
              )}
              {error && (
                <div className="alert alert-error" style={{ marginTop: 12 }}>
                  <AlertCircle size={16} /> <span>{error}</span>
                </div>
              )}
              <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                <button type="button" onClick={() => setModalOpen(false)} className="btn btn-secondary">
                  <X size={20} /> Cancelar
                </button>
                <button type="submit" disabled={saving} className="btn btn-primary">
                  {saving ? "Guardando…" : "Guardar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Análisis de Variación */}
      {modalVariacion && (
        <ModalVariacion
          refId={modalVariacion.refId}
          refMes={modalVariacion.refMes}
          onClose={() => setModalVariacion(null)}
        />
      )}

      {/* Modal Costo Óptimo (pesaje manual) */}
      {costoOptimoRef && (
        <CostoOptimo
          refId={costoOptimoRef}
          materiales={materiales}
          materialesPrioritarios={materialesPrioritariosOptimo}
          onClose={() => { setCostoOptimoRef(null); reload(); }}
        />
      )}

      {/* Drawer detalle — Nivel 2 */}
      {drawerRef && (
        <>
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 200 }} onClick={() => setDrawerRef(null)} />
          <div style={{
            position: "fixed", top: 0, right: 0, bottom: 0,
            width: "min(620px, 100vw)",
            background: "#fff", zIndex: 201, display: "flex", flexDirection: "column",
            boxShadow: "-4px 0 32px rgba(0,0,0,0.18)",
          }}>
            {/* Header */}
            <div style={{
              display: "flex", alignItems: "flex-start", justifyContent: "space-between",
              padding: "20px 24px 16px", borderBottom: "1px solid var(--color-border)",
              background: "#fff", position: "sticky", top: 0, zIndex: 1, flexShrink: 0,
            }}>
              <div>
                <div style={{ fontSize: 11, color: "var(--color-muted)", marginBottom: 3, textTransform: "uppercase", letterSpacing: ".5px" }}>Referencia</div>
                <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "var(--color-text)", lineHeight: 1.3 }}>
                  <span style={{ color: "var(--color-primary)" }}>{drawerRef.id}</span>
                  {drawerRef.costosImportados && (
                    <span style={{ marginLeft: 10, fontSize: 11, background: "#D1FAE5", color: "#065F46", borderRadius: 8, padding: "2px 8px", fontWeight: 700, verticalAlign: "middle" }}>
                      {drawerRef.costosImportados.ordenes} OP importada{drawerRef.costosImportados.ordenes !== 1 ? "s" : ""}
                    </span>
                  )}
                </h2>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                <button className="btn btn-ghost" onClick={() => setCostoOptimoRef(drawerRef.id)}>
                  <Scale size={16} /> Costo Óptimo
                </button>
                <button onClick={() => setDrawerRef(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-muted)", padding: 4 }}>
                  <X size={22} />
                </button>
              </div>
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px 32px" }}>

              {/* ── Información general ── */}
              <section style={{ marginBottom: 24 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <h3 style={{ margin: 0, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".6px", color: "var(--color-muted)" }}>
                    Información general
                  </h3>
                  {!drawerEditingInfo && (
                    <button className="btn btn-ghost" style={{ height: 28, padding: "0 10px", fontSize: 12 }}
                      onClick={() => {
                        setDrawerEditingInfo(true);
                        setDrawerInfoForm({ familia: drawerRef.familia, mes: drawerRef.mes, segMOD: drawerRef.segMOD, cifUnitario: drawerRef.cifUnitario, costoReal: drawerRef.costoReal || "" });
                      }}>
                      <Pencil size={13} /> Editar
                    </button>
                  )}
                </div>

                {drawerEditingInfo ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div className="field-grid-2">
                      <div>
                        <label className="field-label">Familia</label>
                        <select className="select" value={drawerInfoForm.familia} onChange={(e) => setDrawerInfoForm((f) => ({ ...f, familia: e.target.value }))}>
                          <option value="AAA">AAA</option>
                          <option value="A">A</option>
                          <option value="B">B</option>
                          <option value="C">C</option>
                        </select>
                      </div>
                      <div>
                        <label className="field-label">Mes</label>
                        <input type="month" className="input" value={drawerInfoForm.mes} onChange={(e) => setDrawerInfoForm((f) => ({ ...f, mes: e.target.value }))}
                          disabled={!!drawerRef?.costosImportados}
                          title={drawerRef?.costosImportados ? "El mes proviene de las órdenes importadas de Odoo y no se puede editar aquí" : undefined} />
                        {drawerRef?.costosImportados && (
                          <div style={{ fontSize: 11, color: "var(--color-muted)", marginTop: 4 }}>
                            Proviene de las órdenes importadas — no editable
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="field-grid-2">
                      <div>
                        <label className="field-label">MOD manual (COP)</label>
                        <input type="number" step="1" min="0" className="input" value={drawerInfoForm.segMOD} onChange={(e) => setDrawerInfoForm((f) => ({ ...f, segMOD: e.target.value }))} />
                      </div>
                      <div>
                        <label className="field-label">CIF manual (COP)</label>
                        <input type="text" className="input" value={formatCOP(drawerInfoForm.cifUnitario)} onChange={(e) => setDrawerInfoForm((f) => ({ ...f, cifUnitario: parseCOP(e.target.value) }))} />
                      </div>
                    </div>
                    <div>
                      <label className="field-label">Costo Real Odoo</label>
                      <input type="text" className="input" value={formatCOP(drawerInfoForm.costoReal)} onChange={(e) => setDrawerInfoForm((f) => ({ ...f, costoReal: parseCOP(e.target.value) }))} />
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button className="btn btn-primary" onClick={saveDrawerInfo} disabled={drawerSavingInfo}>
                        {drawerSavingInfo ? "Guardando…" : "Guardar"}
                      </button>
                      <button className="btn btn-secondary" onClick={() => setDrawerEditingInfo(false)}>Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 20px", fontSize: 14 }}>
                    {[
                      { label: "Familia", value: drawerRef.familia },
                      { label: "Mes", value: mesLabel(drawerRef.mes) },
                      { label: "MOD manual", value: COP(drawerRef.segMOD) },
                      { label: "CIF manual", value: COP(drawerRef.cifUnitario) },
                      { label: "Costo Real Odoo (manual)", value: drawerRef.costoReal > 0 ? COP(drawerRef.costoReal) : "—" },
                    ].map(({ label, value }) => (
                      <div key={label}>
                        <div style={{ fontSize: 11, color: "var(--color-muted)", marginBottom: 2 }}>{label}</div>
                        <div style={{ fontWeight: 600 }}>{value}</div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <hr style={{ border: "none", borderTop: "1px solid var(--color-border)", margin: "0 0 24px" }} />

              {/* ── NIVEL 2: Datos importados ── */}
              {drawerRef.costosImportados ? (
                <>
                  {/* Sección A — Materiales */}
                  <Collapsible title="A — Materiales" icon={Package} badge={drawerRef.costosImportados.materials?.length}>
                    <TablaMateriasImportadas materials={drawerRef.costosImportados.materials} />
                  </Collapsible>

                  {/* Sección B — Mano de Obra y Carga Fabril */}
                  <Collapsible title="B — Mano de Obra y Carga Fabril" icon={Wrench} badge={[...new Set((drawerRef.costosImportados.laborItems || []).map((l) => l.proceso))].length}>
                    <TablaMOCIF laborItems={drawerRef.costosImportados.laborItems} />
                  </Collapsible>

                  <hr style={{ border: "none", borderTop: "1px solid var(--color-border)", margin: "0 0 24px" }} />
                </>
              ) : (
                <>
                  {/* Sin datos importados → mostrar sección manual */}
                  <div style={{ marginBottom: 16, padding: "10px 14px", background: "#FEF3C7", border: "1px solid #FCD34D", borderRadius: 8, fontSize: 13, color: "#92400E" }}>
                    No hay órdenes de producción importadas para esta referencia en el mes {mesLabel(drawerRef.mes)}.
                    Los valores provienen de la configuración manual.
                  </div>

                  <section style={{ marginBottom: 24 }}>
                    <h3 style={{ margin: "0 0 12px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".6px", color: "var(--color-muted)" }}>
                      Materiales consumidos (manual)
                    </h3>
                    <div style={{ overflowX: "auto", borderRadius: "var(--radius-card)", border: "1px solid var(--color-border)" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                        <thead>
                          <tr style={{ background: "#F8FAFC", borderBottom: "1px solid var(--color-border)" }}>
                            <th style={TH}>Código</th>
                            <th style={TH}>Nombre</th>
                            <th style={TH}>Ud.</th>
                            <th style={{ ...TH, textAlign: "right" }}>Costo unit.</th>
                            <th style={{ ...TH, textAlign: "right" }}>Cantidad</th>
                            <th style={{ ...TH, textAlign: "right" }}>Total</th>
                            <th style={TH} />
                          </tr>
                        </thead>
                        <tbody>
                          {(drawerRef.consumos || []).map((c) => {
                            const mat = c.material;
                            if (!mat) return null;
                            const total = (mat.costo || 0) * (c.cantidad || 0);
                            const editingCost = drawerMatCostEdit === mat.id;
                            const editingQty = drawerMatQtyEdit === mat.id;
                            return (
                              <tr key={mat.id} style={{ borderBottom: "1px solid var(--color-border)" }}>
                                <td style={TD}>
                                  <code style={{ fontSize: 11, background: "#EEF2FF", color: "var(--color-primary)", padding: "2px 5px", borderRadius: 3 }}>{mat.id}</code>
                                </td>
                                <td style={TD}>{mat.nombre}</td>
                                <td style={TD}>{mat.unidad}</td>
                                <td style={{ ...TD, textAlign: "right" }}>
                                  {editingCost ? (
                                    <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                                      <input type="text" className="input" style={{ width: 88, height: 28, fontSize: 12, textAlign: "right" }}
                                        value={formatCOP(drawerMatCostVal)} onChange={(e) => setDrawerMatCostVal(parseCOP(e.target.value))}
                                        autoFocus onKeyDown={(e) => { if (e.key === "Enter") saveDrawerMatCost(mat); if (e.key === "Escape") setDrawerMatCostEdit(null); }} />
                                      <button className="btn btn-primary" style={{ height: 28, padding: "0 7px", fontSize: 12 }} onClick={() => saveDrawerMatCost(mat)}>✓</button>
                                      <button className="btn btn-secondary" style={{ height: 28, padding: "0 7px", fontSize: 12 }} onClick={() => setDrawerMatCostEdit(null)}>✕</button>
                                    </div>
                                  ) : (
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 5 }}>
                                      <span>{COP(mat.costo)}</span>
                                      <button title="⚠ Cambiar el costo afecta todas las referencias" onClick={() => { setDrawerMatCostEdit(mat.id); setDrawerMatCostVal(mat.costo); }}
                                        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-muted)", padding: 2 }}>
                                        <Pencil size={12} />
                                      </button>
                                    </div>
                                  )}
                                </td>
                                <td style={{ ...TD, textAlign: "right" }}>
                                  {editingQty ? (
                                    <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                                      <input type="number" step="0.0001" className="input" style={{ width: 68, height: 28, fontSize: 12, textAlign: "right" }}
                                        value={drawerMatQtyVal} onChange={(e) => setDrawerMatQtyVal(e.target.value)}
                                        autoFocus onKeyDown={(e) => { if (e.key === "Enter") saveDrawerMatQty(c); if (e.key === "Escape") setDrawerMatQtyEdit(null); }} />
                                      <button className="btn btn-primary" style={{ height: 28, padding: "0 7px", fontSize: 12 }} onClick={() => saveDrawerMatQty(c)}>✓</button>
                                      <button className="btn btn-secondary" style={{ height: 28, padding: "0 7px", fontSize: 12 }} onClick={() => setDrawerMatQtyEdit(null)}>✕</button>
                                    </div>
                                  ) : (
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 5 }}>
                                      <span>{c.cantidad}</span>
                                      <button onClick={() => { setDrawerMatQtyEdit(mat.id); setDrawerMatQtyVal(c.cantidad); }}
                                        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-muted)", padding: 2 }}>
                                        <Pencil size={12} />
                                      </button>
                                    </div>
                                  )}
                                </td>
                                <td style={{ ...TD, textAlign: "right", fontWeight: 600 }}>{COP(total)}</td>
                                <td style={TD}>
                                  <button title="Quitar material" onClick={() => removeDrawerMat(mat.id)}
                                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-error)", padding: 4 }}>
                                    <Trash2 size={14} />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                          {(drawerRef.consumos || []).length > 0 && (
                            <tr style={{ background: "#F8FAFC", fontWeight: 700, borderTop: "2px solid var(--color-border)" }}>
                              <td colSpan={5} style={{ ...TD, textAlign: "right", fontSize: 12, color: "var(--color-muted)" }}>Total MPD</td>
                              <td style={{ ...TD, textAlign: "right" }}>
                                {COP((drawerRef.consumos || []).reduce((s, c) => s + (c.material?.costo || 0) * (c.cantidad || 0), 0))}
                              </td>
                              <td style={TD} />
                            </tr>
                          )}
                          {(drawerRef.consumos || []).length === 0 && (
                            <tr>
                              <td colSpan={7} style={{ ...TD, textAlign: "center", color: "var(--color-muted)", padding: "20px 10px" }}>
                                Sin materiales consumidos
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Agregar material manual */}
                    {(() => {
                      const consumed = new Set((drawerRef.consumos || []).map((c) => c.materialId));
                      const available = materiales.filter((m) => !consumed.has(m.id));
                      if (available.length === 0) return null;
                      return (
                        <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
                          <select className="select" style={{ flex: "1 1 180px", height: 36 }} value={drawerAddMatId} onChange={(e) => setDrawerAddMatId(e.target.value)}>
                            <option value="">+ Seleccionar material…</option>
                            {available.map((m) => <option key={m.id} value={m.id}>{m.id} — {m.nombre} ({m.unidad})</option>)}
                          </select>
                          <input type="number" step="0.0001" min="0" placeholder="Cantidad" className="input" style={{ width: 88, height: 36 }}
                            value={drawerAddMatQty} onChange={(e) => setDrawerAddMatQty(e.target.value)} />
                          <button className="btn btn-primary" style={{ height: 36, padding: "0 14px", whiteSpace: "nowrap" }}
                            onClick={addDrawerMat} disabled={!drawerAddMatId || !drawerAddMatQty || Number(drawerAddMatQty) <= 0 || drawerSaving}>
                            <Plus size={15} /> Agregar
                          </button>
                        </div>
                      );
                    })()}
                  </section>

                  <hr style={{ border: "none", borderTop: "1px solid var(--color-border)", margin: "0 0 24px" }} />
                </>
              )}

              {/* ── Resumen de costos ── */}
              {(() => {
                const c = calcCostosEstandar(drawerRef, parametros);
                return (
                  <section>
                    <h3 style={{ margin: "0 0 12px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".6px", color: "var(--color-muted)" }}>
                      Resumen de costos
                    </h3>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
                      {[
                        { label: "MPD", value: COP(c.mpd) },
                        { label: "MOD", value: COP(c.mod) },
                        { label: "CIF", value: COP(c.cif) },
                        { label: "Costo Estándar", value: COP(c.costoEstandar), highlight: true },
                        { label: "Costo Producción (Odoo)", value: c.costoOdoo > 0 ? COP(c.costoOdoo) : "—" },
                        { label: "Costo Óptimo", value: drawerRef.costoOptimo != null ? COP(drawerRef.costoOptimo) : "—" },
                        {
                          label: "Variación %",
                          value: c.variacion != null
                            ? `${c.variacion > 0 ? "+" : ""}${c.variacion.toFixed(2)}%`
                            : "—",
                          highlight: false,
                          // Positivo → desfavorable → rojo; negativo → favorable → verde
                          color: c.variacion == null ? undefined : c.variacion > 0 ? "#991B1B" : c.variacion < 0 ? "#065F46" : "#374151",
                        },
                      ].map(({ label, value, highlight, color }) => (
                        <div key={label} style={{
                          background: highlight ? "#EEF2FF" : "#F8FAFC",
                          border: `1px solid ${highlight ? "#C7D2FE" : "var(--color-border)"}`,
                          borderRadius: "var(--radius-card)", padding: "10px 14px",
                        }}>
                          <div style={{ fontSize: 11, color: "var(--color-muted)", textTransform: "uppercase", letterSpacing: ".5px" }}>{label}</div>
                          <div style={{ fontSize: 15, fontWeight: 700, color: color ?? (highlight ? "var(--color-primary)" : "var(--color-text)"), marginTop: 3 }}>
                            {value}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                );
              })()}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
