import { useMemo, useState } from "react";
import { referenciasApi, calcCostos, COP, mesLabel, COLORS } from "../api.js";

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
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14, alignItems: "center" }}>
        <input
          placeholder="Buscar por código o nombre…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1", minWidth: 220 }}
        />
        <input
          type="month"
          value={mesFiltro}
          onChange={(e) => setMesFiltro(e.target.value)}
          style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #cbd5e1" }}
        />
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <Pill active={!familia} onClick={() => setFamilia("")} label="Todas" />
          {familias.map((f) => (
            <Pill key={f} active={familia === f} onClick={() => setFamilia(f)} label={f} />
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <button onClick={openCreate} style={primaryBtn}>+ Nueva referencia</button>
      </div>

      <div style={{ background: "#fff", borderRadius: 10, overflow: "auto", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
          <thead>
            <tr style={{ background: COLORS.azulClaro, textAlign: "left" }}>
              <th style={th}>Código</th>
              <th style={th}>Nombre</th>
              <th style={th}>Familia</th>
              <th style={th}>Mes</th>
              <th style={th}>MPD</th>
              <th style={th}>MOD</th>
              <th style={th}>CIF</th>
              <th style={th}>Costo Prod.</th>
              <th style={th}>Precio Venta</th>
              <th style={th}>Odoo</th>
              <th style={th}>Variación%</th>
              <th style={th}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtradas.map((r) => {
              const c = calcCostos(r, parametros);
              const variacionColor =
                c.variacion == null ? "#555" : Math.abs(c.variacion) > 10 ? COLORS.rojoTexto : Math.abs(c.variacion) > 5 ? COLORS.amberTexto : COLORS.verdeOscuro;
              return (
                <tr key={r.id} style={{ borderBottom: "1px solid #eee" }}>
                  <td style={td}>{r.id}</td>
                  <td style={td}>{r.nombre}</td>
                  <td style={td}>{r.familia}</td>
                  <td style={td}>{mesLabel(r.mes)}</td>
                  <td style={td}>{COP(c.mpd)}</td>
                  <td style={td}>{COP(c.mod)}</td>
                  <td style={td}>{COP(c.cif)}</td>
                  <td style={{ ...td, fontWeight: 600 }}>{COP(c.costoProd)}</td>
                  <td style={td}>{COP(c.precioVenta)}</td>
                  <td style={td}>{r.costoReal > 0 ? COP(r.costoReal) : "—"}</td>
                  <td style={{ ...td, color: variacionColor, fontWeight: 600 }}>
                    {c.variacion != null ? `${c.variacion.toFixed(1)}%` : "—"}
                  </td>
                  <td style={td}>
                    <button onClick={() => openEdit(r)} style={linkBtn}>Editar</button>
                    <button onClick={() => handleDelete(r)} style={{ ...linkBtn, color: COLORS.rojoTexto }}>Eliminar</button>
                  </td>
                </tr>
              );
            })}
            {filtradas.length === 0 && (
              <tr><td style={td} colSpan={12}>No hay referencias que coincidan con el filtro.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <div style={overlay}>
          <div style={modal}>
            <h3 style={{ marginTop: 0, color: COLORS.azulOscuro }}>
              {editing ? "Editar referencia" : "Nueva referencia"}
            </h3>
            <form onSubmit={handleSave}>
              <div style={grid2}>
                <div>
                  <label style={label}>Código</label>
                  <input style={input} value={form.id} disabled={!!editing} onChange={(e) => setForm({ ...form, id: e.target.value })} required />
                </div>
                <div>
                  <label style={label}>Familia</label>
                  <input style={input} value={form.familia} onChange={(e) => setForm({ ...form, familia: e.target.value })} required />
                </div>
              </div>

              <label style={label}>Nombre</label>
              <input style={input} value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required />

              <div style={grid2}>
                <div>
                  <label style={label}>Mes</label>
                  <input type="month" style={input} value={form.mes} onChange={(e) => setForm({ ...form, mes: e.target.value })} required />
                </div>
                <div>
                  <label style={label}>Costo real Odoo</label>
                  <input type="number" step="0.01" style={input} value={form.costoReal} onChange={(e) => setForm({ ...form, costoReal: e.target.value })} />
                </div>
              </div>

              <div style={grid2}>
                <div>
                  <label style={label}>Horas MOD</label>
                  <input type="number" step="0.01" style={input} value={form.hMOD} onChange={(e) => setForm({ ...form, hMOD: e.target.value })} required />
                </div>
                <div>
                  <label style={label}>Horas máquina (CIF)</label>
                  <input type="number" step="0.01" style={input} value={form.hCIF} onChange={(e) => setForm({ ...form, hCIF: e.target.value })} required />
                </div>
              </div>

              <label style={{ ...label, marginTop: 16, fontWeight: 600 }}>Materiales consumidos</label>
              <div style={{ maxHeight: 220, overflow: "auto", border: "1px solid #e2e8f0", borderRadius: 8, padding: 10 }}>
                {materiales.map((m) => (
                  <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <div style={{ flex: 1, fontSize: 13 }}>{m.id} — {m.nombre} ({m.unidad})</div>
                    <input
                      type="number"
                      step="0.0001"
                      placeholder="0"
                      value={form.consumos[m.id] ?? ""}
                      onChange={(e) =>
                        setForm({ ...form, consumos: { ...form.consumos, [m.id]: e.target.value } })
                      }
                      style={{ width: 100, padding: "6px 8px", borderRadius: 6, border: "1px solid #cbd5e1" }}
                    />
                  </div>
                ))}
                {materiales.length === 0 && <div style={{ fontSize: 13, color: "#777" }}>No hay materiales registrados.</div>}
              </div>

              {error && <div style={{ color: COLORS.rojoTexto, marginTop: 10 }}>{error}</div>}

              <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                <button type="button" onClick={() => setModalOpen(false)} style={secondaryBtn}>Cancelar</button>
                <button type="submit" disabled={saving} style={primaryBtn}>{saving ? "Guardando…" : "Guardar"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function Pill({ active, onClick, label }) {
  return (
    <button
      onClick={onClick}
      style={{
        border: "none",
        borderRadius: 16,
        padding: "6px 14px",
        fontSize: 13,
        cursor: "pointer",
        background: active ? COLORS.azulOscuro : COLORS.azulClaro,
        color: active ? "#fff" : COLORS.azulOscuro,
      }}
    >
      {label}
    </button>
  );
}

const th = { padding: "10px 12px", color: COLORS.azulOscuro, fontWeight: 600, whiteSpace: "nowrap" };
const td = { padding: "10px 12px", whiteSpace: "nowrap" };
const linkBtn = { background: "none", border: "none", color: COLORS.azulMedio, cursor: "pointer", marginRight: 10, fontSize: 13, padding: 0 };
const primaryBtn = { background: COLORS.azulOscuro, color: "#fff", border: "none", borderRadius: 8, padding: "10px 18px", cursor: "pointer", fontWeight: 600 };
const secondaryBtn = { background: "#e2e8f0", color: "#333", border: "none", borderRadius: 8, padding: "10px 18px", cursor: "pointer" };
const overlay = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 50, overflow: "auto" };
const modal = { background: "#fff", borderRadius: 12, padding: 24, width: 520, maxWidth: "100%", maxHeight: "90vh", overflow: "auto" };
const label = { display: "block", fontSize: 13, color: "#555", marginBottom: 4, marginTop: 10 };
const input = { width: "100%", padding: "9px 10px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 14, boxSizing: "border-box" };
const grid2 = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 };
