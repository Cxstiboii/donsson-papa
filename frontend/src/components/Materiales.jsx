import { useState, useRef } from "react";
import { Plus, Pencil, Trash2, Boxes, AlertCircle, X, Upload } from "lucide-react";
import { materialesApi, COP, UNIDADES } from "../api.js";

const OTRA_UNIDAD = "__otra__";

function parseCOP(str) {
  return Number(String(str).replace(/\./g, "").replace(/,/g, "")) || 0;
}

function formatCOP(num) {
  if (num === "" || num == null) return "";
  const n = Number(String(num).replace(/\./g, ""));
  if (isNaN(n)) return "";
  return n.toLocaleString("es-CO");
}

const emptyForm = { id: "", nombre: "", unidad: UNIDADES[0], unidadCustom: "", costo: "" };

export default function Materiales({ materiales, reload }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [importando, setImportando] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const csvInputRef = useRef(null);

  async function handleImportCSV(e) {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = "";
    setImportando(true);
    setImportResult(null);
    try {
      const result = await materialesApi.importarCSV(file);
      setImportResult({ ok: true, ...result });
      await reload();
    } catch (err) {
      setImportResult({ ok: false, error: err.message });
    } finally {
      setImportando(false);
    }
  }

  const materialesFiltrados = materiales.filter((m) =>
    m.nombre.toLowerCase().includes(busqueda.toLowerCase())
  );

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setError("");
    setModalOpen(true);
  }

  function openEdit(m) {
    setEditing(m);
    const esConocida = UNIDADES.includes(m.unidad);
    setForm({
      id: m.id,
      nombre: m.nombre,
      unidad: esConocida ? m.unidad : OTRA_UNIDAD,
      unidadCustom: esConocida ? "" : m.unidad,
      costo: m.costo,
    });
    setError("");
    setModalOpen(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const unidad = form.unidad === OTRA_UNIDAD ? form.unidadCustom.trim() : form.unidad;
      const payload = { id: form.id, nombre: form.nombre, unidad, costo: parseCOP(form.costo) || 0 };
      if (editing) {
        if (form.id !== editing.id) {
          const existe = materiales.some((m) => m.id === form.id);
          if (existe) {
            setError("Ya existe un material con ese código.");
            setSaving(false);
            return;
          }
          await materialesApi.create(payload);
          await materialesApi.remove(editing.id);
        } else {
          await materialesApi.update(editing.id, payload);
        }
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
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginBottom: 16 }}>
        <input
          ref={csvInputRef}
          type="file"
          accept=".csv"
          style={{ display: "none" }}
          onChange={handleImportCSV}
        />
        <button
          onClick={() => { setImportResult(null); csvInputRef.current.click(); }}
          className="btn btn-secondary"
          disabled={importando}
        >
          <Upload size={20} />
          {importando ? "Importando…" : "Importar CSV"}
        </button>
        <button onClick={openCreate} className="btn btn-primary">
          <Plus size={20} />
          Nuevo material
        </button>
      </div>

      {importResult && (
        <div
          className={`alert ${importResult.ok ? "alert-success" : "alert-error"}`}
          style={{ marginBottom: 12, display: "flex", alignItems: "flex-start", gap: 8 }}
        >
          <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            {importResult.ok ? (
              <span>
                Importación completada: <strong>{importResult.creados}</strong> creados,{" "}
                <strong>{importResult.actualizados}</strong> actualizados,{" "}
                <strong>{importResult.omitidos}</strong> omitidos.
                {importResult.errores?.length > 0 && (
                  <span> {importResult.errores.length} error(es): {importResult.errores.slice(0, 3).join(" | ")}</span>
                )}
              </span>
            ) : (
              <span>Error al importar: {importResult.error}</span>
            )}
          </div>
          <button
            onClick={() => setImportResult(null)}
            style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", padding: 0 }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      <input
        type="text"
        placeholder="Buscar por nombre…"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        className="input"
        style={{ marginBottom: 12, maxWidth: 320 }}
      />

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Unidad</th>
              <th>Costo unit.</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {materialesFiltrados.map((m) => (
              <tr key={m.id}>
                <td>{m.id} — {m.nombre}</td>
                <td>{m.unidad}</td>
                <td>{COP(m.costo)}</td>
                <td>
                  <button onClick={() => openEdit(m)} className="btn btn-ghost">
                    <Pencil size={16} />
                    Editar
                  </button>
                  <button onClick={() => handleDelete(m)} className="btn btn-ghost-danger">
                    <Trash2 size={16} />
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
            {materiales.length === 0 && (
              <tr>
                <td colSpan={4}>
                  <div className="empty-state">
                    <div className="empty-state-icon">
                      <Boxes size={28} />
                    </div>
                    <div className="empty-state-title">Sin materiales registrados</div>
                    <button onClick={openCreate} className="btn btn-primary" style={{ marginTop: 12 }}>
                      <Plus size={20} />
                      Nuevo material
                    </button>
                  </div>
                </td>
              </tr>
            )}
            {materiales.length > 0 && materialesFiltrados.length === 0 && (
              <tr>
                <td colSpan={4}>
                  <div className="empty-state">
                    <div className="empty-state-icon">
                      <Boxes size={28} />
                    </div>
                    <div className="empty-state-title">Sin resultados para esa búsqueda</div>
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
              <Boxes size={20} />
              {editing ? "Editar material" : "Nuevo material"}
            </h3>
            <form onSubmit={handleSave}>
              <label className="field-label">Código</label>
              <input
                className="input"
                value={form.id}
                onChange={(e) => setForm({ ...form, id: e.target.value })}
                required
              />
              <label className="field-label">Nombre</label>
              <input
                className="input"
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                required
              />
              <label className="field-label">Unidad</label>
              <select className="select" value={form.unidad} onChange={(e) => setForm({ ...form, unidad: e.target.value })}>
                {UNIDADES.map((u) => <option key={u} value={u}>{u}</option>)}
                <option value={OTRA_UNIDAD}>Otra (especificar)…</option>
              </select>
              {form.unidad === OTRA_UNIDAD && (
                <input
                  className="input"
                  style={{ marginTop: 8 }}
                  placeholder="Escribe la unidad personalizada"
                  value={form.unidadCustom}
                  onChange={(e) => setForm({ ...form, unidadCustom: e.target.value })}
                  required
                />
              )}
              <label className="field-label">Costo unitario</label>
              <input
                className="input"
                type="text"
                value={formatCOP(form.costo)}
                onChange={(e) => setForm({ ...form, costo: parseCOP(e.target.value) })}
                required
              />

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
