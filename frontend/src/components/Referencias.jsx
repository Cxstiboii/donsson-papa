import { useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Search, FileBarChart, AlertCircle, X } from "lucide-react";
import { referenciasApi, calcCostos, COP, mesLabel } from "../api.js";

function emptyForm() {
  return { id: "", nombre: "", familia: "", mes: "", hMOD: 1, hCIF: 0.5, costoReal: "", consumos: {} };
}

export default function Referencias({ referencias, materiales, parametros, reload }) {
  const [busqueda, setBusqueda] = useState("");
  const [familia, setFamilia] = useState("");
  const [mesFiltro, setMesFiltro] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const familias = useMemo(() => {
    return [...new Set(referencias.map((r) => r.familia).filter(Boolean))].sort();
  }, [referencias]);

  const filtradas = useMemo(() => {
    return referencias.filter((r) => {
      if (familia && r.familia !== familia) return false;
      if (mesFiltro && r.mes !== mesFiltro) return false;
      if (busqueda) {
        const q = busqueda.toLowerCase();
        if (!r.id.toLowerCase().includes(q) && !r.nombre.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [referencias, familia, mesFiltro, busqueda]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
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
      hMOD: r.hMOD,
      hCIF: r.hCIF,
      costoReal: r.costoReal || "",
      consumos,
    });
    setError("");
    setModalOpen(true);
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
        hMOD: Number(form.hMOD),
        hCIF: Number(form.hCIF),
        costoReal: form.costoReal === "" ? 0 : Number(form.costoReal),
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
        <input
          type="month"
          value={mesFiltro}
          onChange={(e) => setMesFiltro(e.target.value)}
          className="input"
          style={{ width: "auto" }}
        />
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button className={`pill ${!familia ? "active" : ""}`} onClick={() => setFamilia("")}>Todas</button>
          {familias.map((f) => (
            <button key={f} className={`pill ${familia === f ? "active" : ""}`} onClick={() => setFamilia(f)}>{f}</button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
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
              <th>Precio Venta</th>
              <th>Odoo</th>
              <th>Variación%</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtradas.map((r) => {
              const c = calcCostos(r, parametros);
              const variacionClass =
                c.variacion == null
                  ? ""
                  : Math.abs(c.variacion) > 10
                  ? "badge-error"
                  : Math.abs(c.variacion) > 5
                  ? "badge-warning"
                  : "badge-success";
              return (
                <tr key={r.id}>
                  <td>{r.id}</td>
                  <td>{r.nombre}</td>
                  <td>{r.familia}</td>
                  <td>{mesLabel(r.mes)}</td>
                  <td>{COP(c.mpd)}</td>
                  <td>{COP(c.mod)}</td>
                  <td>{COP(c.cif)}</td>
                  <td style={{ fontWeight: 600 }}>{COP(c.costoProd)}</td>
                  <td>{COP(c.precioVenta)}</td>
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
                <td colSpan={12}>
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
                  <input type="number" step="0.01" className="input" value={form.costoReal} onChange={(e) => setForm({ ...form, costoReal: e.target.value })} />
                </div>
              </div>

              <div className="field-grid-2">
                <div>
                  <label className="field-label">Horas MOD</label>
                  <input type="number" step="0.01" className="input" value={form.hMOD} onChange={(e) => setForm({ ...form, hMOD: e.target.value })} required />
                </div>
                <div>
                  <label className="field-label">Horas máquina (CIF)</label>
                  <input type="number" step="0.01" className="input" value={form.hCIF} onChange={(e) => setForm({ ...form, hCIF: e.target.value })} required />
                </div>
              </div>

              <label className="field-label" style={{ marginTop: 16 }}>Materiales consumidos</label>
              <div style={{ maxHeight: 220, overflow: "auto", border: "1px solid var(--color-border)", borderRadius: "var(--radius-card)", padding: 10 }}>
                {materiales.map((m) => (
                  <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <div style={{ flex: 1, fontSize: 13 }}>{m.id} — {m.nombre} ({m.unidad})</div>
                    <input
                      type="number"
                      step="0.0001"
                      placeholder="0"
                      value={form.consumos[m.id] ?? ""}
                      onChange={(e) =>
                        setForm({ ...form, consumos: { ...form.consumos, [m.id]: e.target.value } })
                      }
                      className="input"
                      style={{ width: 100, height: 36 }}
                    />
                  </div>
                ))}
                {materiales.length === 0 && <div style={{ fontSize: 13, color: "var(--color-muted)" }}>No hay materiales registrados.</div>}
              </div>

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
