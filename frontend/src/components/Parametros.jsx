import { useState } from "react";
import { DollarSign, Percent, TrendingUp, CheckCircle2, AlertCircle, Save } from "lucide-react";
import { parametrosApi } from "../api.js";

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

  const seccion = (label) => (
    <div style={{ marginTop: 24, marginBottom: 12, paddingBottom: 6, borderBottom: "2px solid #2E75B6" }}>
      <span style={{ fontWeight: 700, fontSize: 13, color: "#1F3864", textTransform: "uppercase", letterSpacing: 1 }}>{label}</span>
    </div>
  );

  const campo = (key, label, Icon, step = "0.01") => (
    <div className="card">
      <label htmlFor={`param-${key}`} className="field-label" style={{ marginTop: 0, display: "flex", alignItems: "center", gap: 6 }}>
        <Icon size={16} />
        {label}
      </label>
      <input
        id={`param-${key}`}
        type="number"
        step={step}
        value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        className="input"
        style={{ height: 48, fontSize: "var(--fs-20)", fontWeight: 700, color: "var(--color-bg)" }}
      />
    </div>
  );

  return (
    <div>
      {seccion("Mano de obra directa")}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 8 }}>
        {campo("tarifaMOD", "Tarifa MOD ($/hora)", DollarSign)}
      </div>

      {seccion("Gastos generales")}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 24 }}>
        {campo("pctGAV", "% GAV", Percent)}
        {campo("pctMargen", "% Margen", TrendingUp)}
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
