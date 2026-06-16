import { useState } from "react";
import { parametrosApi, COLORS } from "../api.js";

const CARDS = [
  { key: "tarifaMOD", label: "Tarifa MOD ($/hora)" },
  { key: "tarifaCIF", label: "Tarifa CIF ($/hora)" },
  { key: "pctGAV", label: "% GAV" },
  { key: "pctMargen", label: "% Margen" },
];

export default function Parametros({ parametros, onSaved }) {
  const [form, setForm] = useState(parametros);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  async function handleSave() {
    setSaving(true);
    setMsg("");
    setError("");
    try {
      const payload = {
        tarifaMOD: Number(form.tarifaMOD),
        tarifaCIF: Number(form.tarifaCIF),
        pctGAV: Number(form.pctGAV),
        pctMargen: Number(form.pctMargen),
      };
      const updated = await parametrosApi.update(payload);
      onSaved(updated);
      setMsg("Parámetros guardados correctamente.");
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 20 }}>
        {CARDS.map((c) => (
          <div key={c.key} style={{ background: "#fff", borderRadius: 10, padding: 18, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
            <label style={{ fontSize: 13, color: "#555", display: "block", marginBottom: 8 }}>{c.label}</label>
            <input
              type="number"
              step="0.01"
              value={form[c.key]}
              onChange={(e) => setForm({ ...form, [c.key]: e.target.value })}
              style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 18, fontWeight: 700, color: COLORS.azulOscuro, boxSizing: "border-box" }}
            />
          </div>
        ))}
      </div>

      {msg && <div style={{ background: COLORS.verdeClaro, color: COLORS.verdeOscuro, padding: 10, borderRadius: 8, marginBottom: 12 }}>{msg}</div>}
      {error && <div style={{ background: COLORS.rojoFondo, color: COLORS.rojoTexto, padding: 10, borderRadius: 8, marginBottom: 12 }}>{error}</div>}

      <button
        onClick={handleSave}
        disabled={saving}
        style={{ background: COLORS.azulOscuro, color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", cursor: "pointer", fontWeight: 600 }}
      >
        {saving ? "Guardando…" : "Guardar parámetros"}
      </button>
    </div>
  );
}
