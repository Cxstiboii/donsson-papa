import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Search, FileBarChart, AlertCircle, X, Download } from "lucide-react";
import { referenciasApi, materialesApi, calcCostos, COP, mesLabel } from "../api.js";
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
  return { id: "", nombre: "", familia: "", mes: "", hMOD: 0, hCIF: 0, costoReal: "", consumos: {} };
}


const TH = { padding: "8px 10px", textAlign: "left", fontWeight: 600, fontSize: 12, color: "var(--color-muted)", whiteSpace: "nowrap" };
const TD = { padding: "8px 10px", verticalAlign: "middle" };

export default function Referencias({ referencias, materiales, parametros, reload, mesActivo }) {
  // --- filter state ---
  const [busqueda, setBusqueda] = useState("");
  const [familia, setFamilia] = useState("");
  const [modoFecha, setModoFecha] = useState("mensual");
  const [mesFiltro, setMesFiltro] = useState(mesActivo || "");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  // --- modal state ---
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [matSelectId, setMatSelectId] = useState("");
  const [matSelectQty, setMatSelectQty] = useState("");

  // --- drawer state ---
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

  // Sync drawer with fresh data after reload
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!drawerRef) return;
    const updated = referencias.find((r) => r.id === drawerRef.id);
    if (updated) setDrawerRef(updated);
  }, [referencias]);

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

  const matsDisponibles = useMemo(() => {
    const ids = new Set(Object.keys(form.consumos));
    return materiales.filter((m) => !ids.has(m.id));
  }, [materiales, form.consumos]);

  // ---- modal helpers ----
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
      hMOD: r.segMOD ?? 0,
      hCIF: r.cifUnitario ?? 0,
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
        segMOD: Number(form.hMOD),
        cifUnitario: Number(form.hCIF),
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

  // ---- drawer helpers ----
  function openDrawer(r) {
    setDrawerRef(r);
    setDrawerEditingInfo(false);
    setDrawerInfoForm({
      nombre: r.nombre,
      familia: r.familia,
      mes: r.mes,
      segMOD: r.segMOD,
      cifUnitario: r.cifUnitario,
      costoReal: r.costoReal || "",
    });
    setDrawerMatCostEdit(null);
    setDrawerMatQtyEdit(null);
    setDrawerAddMatId("");
    setDrawerAddMatQty("");
  }

  function buildRefPayload(ref, consumos) {
    return {
      nombre: ref.nombre,
      familia: ref.familia,
      mes: ref.mes,
      segMOD: ref.segMOD,
      cifUnitario: ref.cifUnitario,
      costoReal: ref.costoReal || 0,
      consumos: consumos ?? (ref.consumos || []).map((c) => ({ materialId: c.materialId, cantidad: c.cantidad })),
    };
  }

  async function saveDrawerInfo() {
    setDrawerSavingInfo(true);
    try {
      const consumos = (drawerRef.consumos || []).map((c) => ({ materialId: c.materialId, cantidad: c.cantidad }));
      await referenciasApi.update(drawerRef.id, {
        nombre: drawerInfoForm.nombre,
        familia: drawerInfoForm.familia,
        mes: drawerInfoForm.mes,
        segMOD: Number(drawerInfoForm.segMOD),
        cifUnitario: parseCOP(drawerInfoForm.cifUnitario) || 0,
        costoReal: parseCOP(drawerInfoForm.costoReal) || 0,
        consumos,
      });
      setDrawerEditingInfo(false);
      await reload();
    } catch (e) {
      alert(e.message);
    } finally {
      setDrawerSavingInfo(false);
    }
  }

  async function saveDrawerMatCost(mat) {
    setDrawerSaving(true);
    try {
      await materialesApi.update(mat.id, { nombre: mat.nombre, unidad: mat.unidad, costo: parseCOP(drawerMatCostVal) || 0 });
      setDrawerMatCostEdit(null);
      await reload();
    } catch (e) {
      alert(e.message);
    } finally {
      setDrawerSaving(false);
    }
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
    } catch (e) {
      alert(e.message);
    } finally {
      setDrawerSaving(false);
    }
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
    } catch (e) {
      alert(e.message);
    } finally {
      setDrawerSaving(false);
    }
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
      setDrawerAddMatId("");
      setDrawerAddMatQty("");
      await reload();
    } catch (e) {
      alert(e.message);
    } finally {
      setDrawerSaving(false);
    }
  }

  return (
    <div>
      {/* Filters + action buttons */}
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
        <button onClick={handleExport} className="btn" style={{ background: "#065F46", color: "#fff", border: "none" }}>
          <Download size={18} />
          Exportar Excel
        </button>
        <button onClick={openCreate} className="btn btn-primary">
          <Plus size={20} />
          Nueva referencia
        </button>
      </div>

      {/* Table */}
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
                c.variacion == null ? ""
                : Math.abs(c.variacion) > 10 ? "badge-error"
                : Math.abs(c.variacion) > 5 ? "badge-warning"
                : "badge-success";
              const rowBg = rowIdx % 2 === 1 ? "#F8FAFC" : undefined;
              return (
                <tr
                  key={r.id}
                  style={{ background: rowBg, cursor: "pointer" }}
                  onClick={() => openDrawer(r)}
                >
                  <td>{r.id}</td>
                  <td>{r.nombre}</td>
                  <td>{r.familia}</td>
                  <td>{mesLabel(r.mes)}</td>
                  <td>{COP(c.mpd)}</td>
                  <td>{COP(c.mod)}</td>
                  <td>{COP(c.cif)}</td>
                  <td style={{ fontWeight: 600 }}>{COP(c.costoProd)}</td>
                  <td>{r.costoReal > 0 ? COP(r.costoReal) : "—"}</td>
                  <td>
                    {c.variacion != null ? (
                      <span className={`badge ${variacionClass}`}>{c.variacion.toFixed(1)}%</span>
                    ) : "—"}
                  </td>
                  <td>
                    <button onClick={(e) => { e.stopPropagation(); openEdit(r); }} className="btn btn-ghost">
                      <Pencil size={16} />
                      Editar
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(r); }} className="btn btn-ghost-danger">
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
                    <div className="empty-state-icon"><FileBarChart size={28} /></div>
                    <div className="empty-state-title">No hay referencias que coincidan con el filtro</div>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Edit / Create modal */}
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
                  <label className="field-label">Costo mano de obra</label>
                  <input type="number" step="1" min="0" className="input" placeholder="$ 0" value={form.hMOD} onChange={(e) => setForm({ ...form, hMOD: e.target.value })} required />
                </div>
                <div>
                  <label className="field-label">Costo Carga Fabril en COP</label>
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
                        <input
                          type="number" step="0.0001" min="0" value={qty}
                          onChange={(e) => setForm((f) => ({ ...f, consumos: { ...f.consumos, [mid]: e.target.value } }))}
                          className="input" style={{ width: 90, height: 32 }}
                        />
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
                  <input
                    type="number" step="0.0001" min="0" placeholder="Cantidad"
                    value={matSelectQty} onChange={(e) => setMatSelectQty(e.target.value)}
                    className="input" style={{ width: 100, height: 36 }}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); agregarMaterial(); } }}
                  />
                  <button
                    type="button" onClick={agregarMaterial} className="btn btn-primary"
                    style={{ height: 36, padding: "0 12px", whiteSpace: "nowrap" }}
                    disabled={!matSelectId || !matSelectQty || Number(matSelectQty) <= 0}
                  >
                    <Plus size={16} /> Agregar
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

      {/* Detail Drawer */}
      {drawerRef && (
        <>
          {/* Overlay */}
          <div
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 200 }}
            onClick={() => setDrawerRef(null)}
          />

          {/* Panel */}
          <div style={{
            position: "fixed", top: 0, right: 0, bottom: 0,
            width: "min(520px, 100vw)",
            background: "#fff",
            zIndex: 201,
            display: "flex",
            flexDirection: "column",
            boxShadow: "-4px 0 32px rgba(0,0,0,0.18)",
          }}>
            {/* Header */}
            <div style={{
              display: "flex", alignItems: "flex-start", justifyContent: "space-between",
              padding: "20px 24px 16px",
              borderBottom: "1px solid var(--color-border)",
              background: "#fff",
              position: "sticky", top: 0, zIndex: 1,
              flexShrink: 0,
            }}>
              <div>
                <div style={{ fontSize: 11, color: "var(--color-muted)", marginBottom: 3, textTransform: "uppercase", letterSpacing: ".5px" }}>Referencia</div>
                <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "var(--color-text)", lineHeight: 1.3 }}>
                  <span style={{ color: "var(--color-primary)" }}>{drawerRef.id}</span>
                  <span style={{ color: "var(--color-muted)", margin: "0 8px" }}>—</span>
                  {drawerRef.nombre}
                </h2>
              </div>
              <button
                onClick={() => setDrawerRef(null)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-muted)", padding: 4, marginTop: 2, lineHeight: 1 }}
              >
                <X size={22} />
              </button>
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px 32px" }}>

              {/* ── Sección 1: Información general ── */}
              <section style={{ marginBottom: 24 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <h3 style={{ margin: 0, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".6px", color: "var(--color-muted)" }}>
                    Información general
                  </h3>
                  {!drawerEditingInfo && (
                    <button
                      className="btn btn-ghost"
                      style={{ height: 28, padding: "0 10px", fontSize: 12 }}
                      onClick={() => {
                        setDrawerEditingInfo(true);
                        setDrawerInfoForm({
                          nombre: drawerRef.nombre,
                          familia: drawerRef.familia,
                          mes: drawerRef.mes,
                          segMOD: drawerRef.segMOD,
                          cifUnitario: drawerRef.cifUnitario,
                          costoReal: drawerRef.costoReal || "",
                        });
                      }}
                    >
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
                        <input type="month" className="input" value={drawerInfoForm.mes} onChange={(e) => setDrawerInfoForm((f) => ({ ...f, mes: e.target.value }))} />
                      </div>
                    </div>
                    <div className="field-grid-2">
                      <div>
                        <label className="field-label">MOD (COP)</label>
                        <input type="number" step="1" min="0" className="input" placeholder="$ 0" value={drawerInfoForm.segMOD} onChange={(e) => setDrawerInfoForm((f) => ({ ...f, segMOD: e.target.value }))} />
                      </div>
                      <div>
                        <label className="field-label">CIF (COP)</label>
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
                      { label: "Costo MOD", value: COP(drawerRef.segMOD) },
                      { label: "Costo CIF", value: COP(drawerRef.cifUnitario) },
                      { label: "Costo Real Odoo", value: drawerRef.costoReal > 0 ? COP(drawerRef.costoReal) : "—" },
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

              {/* ── Sección 2: Materiales consumidos ── */}
              <section style={{ marginBottom: 24 }}>
                <h3 style={{ margin: "0 0 12px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".6px", color: "var(--color-muted)" }}>
                  Materiales consumidos
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
                              <code style={{ fontSize: 11, background: "#EEF2FF", color: "var(--color-primary)", padding: "2px 5px", borderRadius: 3 }}>
                                {mat.id}
                              </code>
                            </td>
                            <td style={TD}>{mat.nombre}</td>
                            <td style={TD}>{mat.unidad}</td>

                            {/* Costo unitario inline edit */}
                            <td style={{ ...TD, textAlign: "right" }}>
                              {editingCost ? (
                                <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                                  <input
                                    type="text" className="input"
                                    style={{ width: 88, height: 28, fontSize: 12, textAlign: "right" }}
                                    value={formatCOP(drawerMatCostVal)}
                                    onChange={(e) => setDrawerMatCostVal(parseCOP(e.target.value))}
                                    autoFocus
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") saveDrawerMatCost(mat);
                                      if (e.key === "Escape") setDrawerMatCostEdit(null);
                                    }}
                                  />
                                  <button className="btn btn-primary" style={{ height: 28, padding: "0 7px", fontSize: 12 }} onClick={() => saveDrawerMatCost(mat)}>✓</button>
                                  <button className="btn btn-secondary" style={{ height: 28, padding: "0 7px", fontSize: 12 }} onClick={() => setDrawerMatCostEdit(null)}>✕</button>
                                </div>
                              ) : (
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 5 }}>
                                  <span>{COP(mat.costo)}</span>
                                  <button
                                    title="⚠ Cambiar el costo afecta todas las referencias que usan este material"
                                    onClick={() => { setDrawerMatCostEdit(mat.id); setDrawerMatCostVal(mat.costo); }}
                                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-muted)", padding: 2, lineHeight: 1 }}
                                  >
                                    <Pencil size={12} />
                                  </button>
                                </div>
                              )}
                            </td>

                            {/* Cantidad inline edit */}
                            <td style={{ ...TD, textAlign: "right" }}>
                              {editingQty ? (
                                <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                                  <input
                                    type="number" step="0.0001" className="input"
                                    style={{ width: 68, height: 28, fontSize: 12, textAlign: "right" }}
                                    value={drawerMatQtyVal}
                                    onChange={(e) => setDrawerMatQtyVal(e.target.value)}
                                    autoFocus
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") saveDrawerMatQty(c);
                                      if (e.key === "Escape") setDrawerMatQtyEdit(null);
                                    }}
                                  />
                                  <button className="btn btn-primary" style={{ height: 28, padding: "0 7px", fontSize: 12 }} onClick={() => saveDrawerMatQty(c)}>✓</button>
                                  <button className="btn btn-secondary" style={{ height: 28, padding: "0 7px", fontSize: 12 }} onClick={() => setDrawerMatQtyEdit(null)}>✕</button>
                                </div>
                              ) : (
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 5 }}>
                                  <span>{c.cantidad}</span>
                                  <button
                                    onClick={() => { setDrawerMatQtyEdit(mat.id); setDrawerMatQtyVal(c.cantidad); }}
                                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-muted)", padding: 2, lineHeight: 1 }}
                                  >
                                    <Pencil size={12} />
                                  </button>
                                </div>
                              )}
                            </td>

                            <td style={{ ...TD, textAlign: "right", fontWeight: 600 }}>{COP(total)}</td>
                            <td style={TD}>
                              <button
                                title="Quitar este material de la referencia"
                                onClick={() => removeDrawerMat(mat.id)}
                                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-error)", padding: 4, lineHeight: 1 }}
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}

                      {/* Totals row */}
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

                {/* Agregar material */}
                {(() => {
                  const consumed = new Set((drawerRef.consumos || []).map((c) => c.materialId));
                  const available = materiales.filter((m) => !consumed.has(m.id));
                  if (available.length === 0) {
                    return <div style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 8 }}>Todos los materiales han sido agregados.</div>;
                  }
                  return (
                    <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
                      <select
                        className="select"
                        style={{ flex: "1 1 180px", height: 36 }}
                        value={drawerAddMatId}
                        onChange={(e) => setDrawerAddMatId(e.target.value)}
                      >
                        <option value="">+ Seleccionar material…</option>
                        {available.map((m) => (
                          <option key={m.id} value={m.id}>{m.id} — {m.nombre} ({m.unidad})</option>
                        ))}
                      </select>
                      <input
                        type="number" step="0.0001" min="0" placeholder="Cantidad"
                        className="input" style={{ width: 88, height: 36 }}
                        value={drawerAddMatQty}
                        onChange={(e) => setDrawerAddMatQty(e.target.value)}
                      />
                      <button
                        className="btn btn-primary"
                        style={{ height: 36, padding: "0 14px", whiteSpace: "nowrap" }}
                        onClick={addDrawerMat}
                        disabled={!drawerAddMatId || !drawerAddMatQty || Number(drawerAddMatQty) <= 0 || drawerSaving}
                      >
                        <Plus size={15} /> Agregar
                      </button>
                    </div>
                  );
                })()}
              </section>

              <hr style={{ border: "none", borderTop: "1px solid var(--color-border)", margin: "0 0 24px" }} />

              {/* ── Sección 3: Resumen de costos ── */}
              {(() => {
                const c = calcCostos(drawerRef, parametros);
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
                        { label: "Costo Producción", value: COP(c.costoProd), highlight: true },
                        { label: "Precio Venta sugerido", value: COP(c.precioVenta) },
                      ].map(({ label, value, highlight }) => (
                        <div
                          key={label}
                          style={{
                            background: highlight ? "#EEF2FF" : "#F8FAFC",
                            border: `1px solid ${highlight ? "#C7D2FE" : "var(--color-border)"}`,
                            borderRadius: "var(--radius-card)",
                            padding: "10px 14px",
                          }}
                        >
                          <div style={{ fontSize: 11, color: "var(--color-muted)", textTransform: "uppercase", letterSpacing: ".5px" }}>{label}</div>
                          <div style={{ fontSize: 15, fontWeight: 700, color: highlight ? "var(--color-primary)" : "var(--color-text)", marginTop: 3 }}>{value}</div>
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
