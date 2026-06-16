import { useState } from "react";
import { DollarSign, Cog, Percent, TrendingUp, CheckCircle2, AlertCircle, Save } from "lucide-react";
import { parametrosApi } from "../api.js";

const CARDS = [
  { key: "tarifaMOD", label: "Tarifa MOD ($/hora)", icon: DollarSign },
  { key: "tarifaCIF", label: "Tarifa CIF ($/hora)", icon: Cog },
  { key: "pctGAV", label: "% GAV", icon: Percent },
  { key: "pctMargen", label: "% Margen", icon: TrendingUp },
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
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 24 }}>
        {CARDS.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.key} className="card">
              <label className="field-label" style={{ marginTop: 0, display: "flex", alignItems: "center", gap: 6 }}>
                <Icon size={16} />
                {c.label}
              </label>
              <input
                type="number"
                step="0.01"
                value={form[c.key]}
                onChange={(e) => setForm({ ...form, [c.key]: e.target.value })}
                className="input"
                style={{ height: 48, fontSize: "var(--fs-20)", fontWeight: 700, color: "var(--color-bg)" }}
              />
            </div>
          );
        })}
      </div>

      {msg && (
        <div className="alert alert-success" style={{ marginBottom: 16 }}>
          <CheckCircle2 size={16} />
          <span>{msg}</span>
        </div>
      )}
      {error && (
        <div className="alert alert-error" style={{ marginBottom: 16 }}>
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      <button onClick={handleSave} disabled={saving} className="btn btn-primary">
        <Save size={20} />
        {saving ? "Guardando…" : "Guardar parámetros"}
      </button>
    </div>
  );
}
