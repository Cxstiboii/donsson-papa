import { useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Search, FileBarChart, AlertCircle, X, Download } from "lucide-react";
import { referenciasApi, calcCostos, COP, mesLabel } from "../api.js";
import FiltroFecha, { dentroDeRango } from "../FiltroFecha.jsx";
import { exportarExcel } from "../exportExcel.js";

function parseCOP(str) {
  return Number(String(str).replace(/\./g, "").replace(/,/g, "")) || 0;
}

function formatCOP(num) {
  if (num === "" || num == null) return "";
  const n = Number(String(num).replace(/\./g, ""));
  if (isNaN(n)) return "";
  return n.toLocaleString("es-CO");
}

function emptyForm() {
  return { id: "", nombre: "", familia: "", mes: "", segMOD: 60, cifUnitario: 0, costoReal: "", consumos: {} };
}

function segToHMS(seg) {
  const s = Math.floor(Number(seg) || 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sc = s % 60;
  return `${h}h ${m}m ${sc}s`;
}

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

  // selector de materiales
  const [matSelectId, setMatSelectId] = useState("");
  const [matSelectQty, setMatSelectQty] = useState("");

  const familias = useMemo(() => {
    return [...new Set(referencias.map((r) => r.familia).filter(Boolean))].sort();
  }, [referencias]);

  const filtradas = useMemo(() => {
    return referencias.filter((r) => {
      if (familia && r.familia !== familia) return false;
      if (modoFecha === "mensual") {
        if (mesFiltro && r.mes !== mesFiltro) return false;
      } else {
        if ((desde || hasta) && !dentroDeRango(r.mes, desde, hasta)) return false;
      }
      if (busqueda) {
        const q = busqueda.toLowerCase();
        if (!r.id.toLowerCase().includes(q) && !r.nombre.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [referencias, familia, modoFecha, mesFiltro, desde, hasta, busqueda]);

  const filtroLabel = useMemo(() => {
    if (modoFecha === "mensual") return mesFiltro ? mesLabel(mesFiltro) : "Todos los meses";
    if (desde || hasta) return `${desde ? mesLabel(desde) : "…"} a ${hasta ? mesLabel(hasta) : "…"}`;
    return "Todos los meses";
  }, [modoFecha, mesFiltro, desde, hasta]);

  // materiales disponibles para agregar (los que no están ya en consumosForm)
  const matsDisponibles = useMemo(() => {
    const ids = new Set(Object.keys(form.consumos));
    return materiales.filter((m) => !ids.has(m.id));
  }, [materiales, form.consumos]);

  function handleExport() {
    exportarExcel(filtradas, parametros, filtroLabel).catch((err) => {
      console.error("Error exportando Excel:", err);
      setError("No se pudo generar el archivo Excel.");
    });
  }

  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setMatSelectId("");
    setMatSelectQty("");
    setError("");
    setModalOpen(true);
  }

  function openEdit(r) {
    setEditing(r);
    const consumos = {};
    for (const c of r.consumos) consumos[c.materialId] = c.cantidad;
    setForm({
      id: r.id,
      nombre: r.nombre,
      familia: r.familia,
      mes: r.mes,
      segMOD: r.segMOD ?? 60,
      cifUnitario: r.cifUnitario ?? 0,
      costoReal: r.costoReal || "",
      consumos,
    });
    setMatSelectId("");
    setMatSelectQty("");
    setError("");
    setModalOpen(true);
  }

  function agregarMaterial() {
    if (!matSelectId) return;
    const qty = Number(matSelectQty);
    if (qty <= 0) return;
    setForm((f) => ({ ...f, consumos: { ...f.consumos, [matSelectId]: qty } }));
    setMatSelectId("");
    setMatSelectQty("");
  }

  function quitarMaterial(mid) {
    setForm((f) => {
      const c = { ...f.consumos };
      delete c[mid];
      return { ...f, consumos: c };
    });
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const consumos = Object.entries(form.consumos)
        .filter(([, cantidad]) => Number(cantidad) > 0)
        .map(([materialId, cantidad]) => ({ materialId, cantidad: Number(cantidad) }));

      const payload = {
        id: form.id,
        nombre: form.nombre,
        familia: form.familia,
        mes: form.mes,
        segMOD: Number(form.segMOD),
        cifUnitario: parseCOP(form.cifUnitario) || 0,
        costoReal: parseCOP(form.costoReal) || 0,
        consumos,
      };

      if (editing) {
        await referenciasApi.update(editing.id, payload);
      } else {
        await referenciasApi.create(payload);
      }
      setModalOpen(false);
      await reload();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(r) {
    if (!confirm(`¿Eliminar la referencia ${r.id} - ${r.nombre}?`)) return;
    try {
      await referenciasApi.remove(r.id);
      await reload();
    } catch (e) {
      alert(e.message);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16, alignItems: "center" }}>
        <div style={{ position: "relative", minWidth: 220, flex: "1 1 220px" }}>
          <Search size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--color-muted)" }} />
          <input
            placeholder="Buscar por código o nombre…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="input"
            style={{ paddingLeft: 36 }}
          />
        </div>
        <FiltroFecha
          modo={modoFecha}
          setModo={setModoFecha}
          mes={mesFiltro}
          setMes={setMesFiltro}
          desde={desde}
          setDesde={setDesde}
          hasta={hasta}
          setHasta={setHasta}
        />
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button className={`pill ${!familia ? "active" : ""}`} onClick={() => setFamilia("")}>Todas</button>
          {familias.map((f) => (
            <button key={f} className={`pill ${familia === f ? "active" : ""}`} onClick={() => setFamilia(f)}>{f}</button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <button
          onClick={handleExport}
          className="btn"
          style={{ background: "#065F46", color: "#fff", border: "none" }}
        >
          <Download size={18} />
          Exportar Excel
        </button>
        <button onClick={openCreate} className="btn btn-primary">
          <Plus size={20} />
          Nueva referencia
        </button>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Código</th>
              <th>Nombre</th>
              <th>Familia</th>
              <th>Mes</th>
              <th>MPD</th>
              <th>MOD</th>
              <th>CIF</th>
              <th>Costo Prod.</th>
              <th>Odoo</th>
              <th>Variación%</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtradas.map((r, rowIdx) => {
              const c = calcCostos(r, parametros);
              const variacionClass =
                c.variacion == null
                  ? ""
                  : Math.abs(c.variacion) > 10
                  ? "badge-error"
                  : Math.abs(c.variacion) > 5
                  ? "badge-warning"
                  : "badge-success";
              const rowBg = rowIdx % 2 === 1 ? "#F8FAFC" : undefined;
              return (
                <tr key={r.id} style={rowBg ? { background: rowBg } : undefined}>
                  <td>{r.id}</td>
                  <td>{r.nombre}</td>
                  <td>{r.familia}</td>
                  <td>{mesLabel(r.mes)}</td>
                  <td>{COP(c.mpd)}</td>
                  <td title={segToHMS(r.segMOD)}>{COP(c.mod)}</td>
                  <td>{COP(c.cif)}</td>
                  <td style={{ fontWeight: 600 }}>{COP(c.costoProd)}</td>
                  <td>{r.costoReal > 0 ? COP(r.costoReal) : "—"}</td>
                  <td>
                    {c.variacion != null ? (
                      <span className={`badge ${variacionClass}`}>{c.variacion.toFixed(1)}%</span>
                    ) : "—"}
                  </td>
                  <td>
                    <button onClick={() => openEdit(r)} className="btn btn-ghost">
                      <Pencil size={16} />
                      Editar
                    </button>
                    <button onClick={() => handleDelete(r)} className="btn btn-ghost-danger">
                      <Trash2 size={16} />
                      Eliminar
                    </button>
                  </td>
                </tr>
              );
            })}
            {filtradas.length === 0 && (
              <tr>
                <td colSpan={11}>
                  <div className="empty-state">
                    <div className="empty-state-icon">
                      <FileBarChart size={28} />
                    </div>
                    <div className="empty-state-title">No hay referencias que coincidan con el filtro</div>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

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
                  <input className="input" value={form.familia} onChange={(e) => setForm({ ...form, familia: e.target.value })} required />
                </div>
              </div>

              <label className="field-label">Nombre</label>
              <input className="input" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required />

              <div className="field-grid-2">
                <div>
                  <label className="field-label">Mes</label>
                  <input type="month" className="input" value={form.mes} onChange={(e) => setForm({ ...form, mes: e.target.value })} required />
                </div>
                <div>
                  <label className="field-label">Costo real Odoo</label>
                  <input type="text" className="input" value={formatCOP(form.costoReal)} onChange={(e) => setForm({ ...form, costoReal: parseCOP(e.target.value) })} />
                </div>
              </div>

              <div className="field-grid-2">
                <div>
                  <label className="field-label">Tiempo MOD (segundos)</label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    className="input"
                    value={form.segMOD}
                    onChange={(e) => setForm({ ...form, segMOD: e.target.value })}
                    required
                  />
                  <div style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 4 }}>
                    {segToHMS(form.segMOD)}
                  </div>
                </div>
                <div>
                  <label className="field-label">Carga fabril unitaria (COP)</label>
                  <input
                    type="text"
                    className="input"
                    value={formatCOP(form.cifUnitario)}
                    onChange={(e) => setForm({ ...form, cifUnitario: parseCOP(e.target.value) })}
                    required
                  />
                </div>
              </div>

              <label className="field-label" style={{ marginTop: 16 }}>Materiales consumidos</label>

              {/* lista de consumos activos */}
              {Object.keys(form.consumos).length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  {Object.entries(form.consumos).map(([mid, qty]) => {
                    const mat = materiales.find((m) => m.id === mid);
                    return (
                      <div key={mid} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, padding: "6px 10px", background: "#F0F7FF", borderRadius: 6, border: "1px solid #BDD7EE" }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#2E75B6", minWidth: 64 }}>{mid}</span>
                        <span style={{ flex: 1, fontSize: 13 }}>{mat ? mat.nombre : mid} {mat ? `(${mat.unidad})` : ""}</span>
                        <input
                          type="number"
                          step="0.0001"
                          min="0"
                          value={qty}
                          onChange={(e) => setForm((f) => ({ ...f, consumos: { ...f.consumos, [mid]: e.target.value } }))}
                          className="input"
                          style={{ width: 90, height: 32 }}
                        />
                        <button type="button" onClick={() => quitarMaterial(mid)} style={{ background: "none", border: "none", cursor: "pointer", color: "#991B1B", padding: 4 }}>
                          <X size={16} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* selector para agregar */}
              {matsDisponibles.length > 0 && (
                <div style={{ display: "flex", gap: 6, alignItems: "flex-end", marginBottom: 6 }}>
                  <div style={{ flex: 1 }}>
                    <select
                      className="input"
                      value={matSelectId}
                      onChange={(e) => setMatSelectId(e.target.value)}
                      style={{ height: 36 }}
                    >
                      <option value="">— Seleccionar material —</option>
                      {matsDisponibles.map((m) => (
                        <option key={m.id} value={m.id}>{m.id} — {m.nombre} ({m.unidad})</option>
                      ))}
                    </select>
                  </div>
                  <input
                    type="number"
                    step="0.0001"
                    min="0"
                    placeholder="Cantidad"
                    value={matSelectQty}
                    onChange={(e) => setMatSelectQty(e.target.value)}
                    className="input"
                    style={{ width: 100, height: 36 }}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); agregarMaterial(); } }}
                  />
                  <button
                    type="button"
                    onClick={agregarMaterial}
                    className="btn btn-primary"
                    style={{ height: 36, padding: "0 12px", whiteSpace: "nowrap" }}
                    disabled={!matSelectId || !matSelectQty || Number(matSelectQty) <= 0}
                  >
                    <Plus size={16} />
                    Agregar
                  </button>
                </div>
              )}
              {matsDisponibles.length === 0 && Object.keys(form.consumos).length === 0 && (
                <div style={{ fontSize: 13, color: "var(--color-muted)" }}>No hay materiales registrados.</div>
              )}
              {matsDisponibles.length === 0 && Object.keys(form.consumos).length > 0 && (
                <div style={{ fontSize: 12, color: "var(--color-muted)" }}>Todos los materiales han sido agregados.</div>
              )}

              {error && (
                <div className="alert alert-error" style={{ marginTop: 12 }}>
                  <AlertCircle size={16} />
                  <span>{error}</span>
                </div>
              )}

              <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                <button type="button" onClick={() => setModalOpen(false)} className="btn btn-secondary">
                  <X size={20} />
                  Cancelar
                </button>
                <button type="submit" disabled={saving} className="btn btn-primary">
                  {saving ? "Guardando…" : "Guardar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
