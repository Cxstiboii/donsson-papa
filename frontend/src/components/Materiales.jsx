import { useState } from "react";
import { materialesApi, COP, UNIDADES, COLORS } from "../api.js";

const emptyForm = { id: "", nombre: "", unidad: UNIDADES[0], costo: "", proveedor: "" };

export default function Materiales({ materiales, reload }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setError("");
    setModalOpen(true);
  }

  function openEdit(m) {
    setEditing(m);
    setForm({ id: m.id, nombre: m.nombre, unidad: m.unidad, costo: m.costo, proveedor: m.proveedor || "" });
    setError("");
    setModalOpen(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = { ...form, costo: Number(form.costo) };
      if (editing) {
        await materialesApi.update(editing.id, payload);
      } else {
        await materialesApi.create(payload);
      }
      setModalOpen(false);
      await reload();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(m) {
    if (!confirm(`¿Eliminar el material ${m.id} - ${m.nombre}?`)) return;
    try {
      await materialesApi.remove(m.id);
      await reload();
    } catch (e) {
      alert(e.message);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <button onClick={openCreate} style={primaryBtn}>+ Nuevo material</button>
      </div>

      <div style={{ background: "#fff", borderRadius: 10, overflow: "auto", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ background: COLORS.azulClaro, textAlign: "left" }}>
              <th style={th}>Código</th>
              <th style={th}>Descripción</th>
              <th style={th}>Unidad</th>
              <th style={th}>Costo unit.</th>
              <th style={th}>Proveedor</th>
              <th style={th}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {materiales.map((m) => (
              <tr key={m.id} style={{ borderBottom: "1px solid #eee" }}>
                <td style={td}>{m.id}</td>
                <td style={td}>{m.nombre}</td>
                <td style={td}>{m.unidad}</td>
                <td style={td}>{COP(m.costo)}</td>
                <td style={td}>{m.proveedor}</td>
                <td style={td}>
                  <button onClick={() => openEdit(m)} style={linkBtn}>Editar</button>
                  <button onClick={() => handleDelete(m)} style={{ ...linkBtn, color: COLORS.rojoTexto }}>Eliminar</button>
                </td>
              </tr>
            ))}
            {materiales.length === 0 && (
              <tr><td style={td} colSpan={6}>Sin materiales registrados.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <div style={overlay}>
          <div style={modal}>
            <h3 style={{ marginTop: 0, color: COLORS.azulOscuro }}>
              {editing ? "Editar material" : "Nuevo material"}
            </h3>
            <form onSubmit={handleSave}>
              <label style={label}>Código</label>
              <input
                style={input}
                value={form.id}
                disabled={!!editing}
                onChange={(e) => setForm({ ...form, id: e.target.value })}
                required
              />
              <label style={label}>Descripción</label>
              <input
                style={input}
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                required
              />
              <label style={label}>Unidad</label>
              <select style={input} value={form.unidad} onChange={(e) => setForm({ ...form, unidad: e.target.value })}>
                {UNIDADES.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
              <label style={label}>Costo unitario</label>
              <input
                style={input}
                type="number"
                step="0.01"
                value={form.costo}
                onChange={(e) => setForm({ ...form, costo: e.target.value })}
                required
              />
              <label style={label}>Proveedor</label>
              <input
                style={input}
                value={form.proveedor}
                onChange={(e) => setForm({ ...form, proveedor: e.target.value })}
              />

              {error && <div style={{ color: COLORS.rojoTexto, marginBottom: 10 }}>{error}</div>}

              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
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

const th = { padding: "10px 14px", color: COLORS.azulOscuro, fontWeight: 600 };
const td = { padding: "10px 14px" };
const linkBtn = { background: "none", border: "none", color: COLORS.azulMedio, cursor: "pointer", marginRight: 10, fontSize: 13, padding: 0 };
const primaryBtn = { background: COLORS.azulOscuro, color: "#fff", border: "none", borderRadius: 8, padding: "10px 18px", cursor: "pointer", fontWeight: 600 };
const secondaryBtn = { background: "#e2e8f0", color: "#333", border: "none", borderRadius: 8, padding: "10px 18px", cursor: "pointer" };
const overlay = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 50 };
const modal = { background: "#fff", borderRadius: 12, padding: 24, width: 420, maxWidth: "100%", maxHeight: "90vh", overflow: "auto" };
const label = { display: "block", fontSize: 13, color: "#555", marginBottom: 4, marginTop: 10 };
const input = { width: "100%", padding: "9px 10px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 14, boxSizing: "border-box" };
