import { useState } from "react";
import { Upload, AlertCircle } from "lucide-react";
import { getToken } from "../api.js";

const FAMILIAS = ["AAA", "A", "B", "C"];

const labelStyle = {
  display: "block",
  fontSize: 13,
  fontWeight: 600,
  color: "#374151",
  marginBottom: 4,
};

export default function ImportarOP({ reload }) {
  const [file, setFile] = useState(null);
  const [referenciaId, setReferenciaId] = useState("");
  const [referenciaNombre, setReferenciaNombre] = useState("");
  const [familia, setFamilia] = useState("AAA");
  const [mes, setMes] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    if (!file) return setError("Selecciona un archivo .xlsx");
    if (!referenciaId.trim()) return setError("Ingresa el código de referencia");
    if (!referenciaNombre.trim()) return setError("Ingresa el nombre de la referencia");
    if (!mes) return setError("Selecciona el mes");

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("referenciaId", referenciaId.trim());
      fd.append("referenciaNombre", referenciaNombre.trim());
      fd.append("familia", familia);
      fd.append("mes", mes);

      const res = await fetch("/api/importar-op", {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
        body: fd,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Error al importar");

      setResult(data);
      await reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: "#1F3864", marginBottom: 6 }}>
        Importar Orden de Producción desde Odoo
      </h2>
      <p style={{ fontSize: 13, color: "var(--color-muted)", marginBottom: 20, lineHeight: 1.6 }}>
        Sube el Excel de Odoo con las columnas de materiales de la OP. Se crearán o actualizarán los
        materiales y la referencia destino con los consumos importados.
      </p>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <label style={labelStyle}>Archivo Excel de Odoo</label>
          <input
            type="file"
            accept=".xlsx"
            className="input"
            onChange={(e) => {
              setFile(e.target.files?.[0] || null);
              setResult(null);
              setError("");
            }}
          />
        </div>

        <div>
          <label style={labelStyle}>Código de referencia</label>
          <input
            className="input"
            placeholder="ej: REF-001"
            value={referenciaId}
            onChange={(e) => setReferenciaId(e.target.value)}
          />
        </div>

        <div>
          <label style={labelStyle}>Nombre de la referencia</label>
          <input
            className="input"
            placeholder="ej: Filtro de aceite"
            value={referenciaNombre}
            onChange={(e) => setReferenciaNombre(e.target.value)}
          />
        </div>

        <div>
          <label style={labelStyle}>Familia</label>
          <select
            className="input"
            value={familia}
            onChange={(e) => setFamilia(e.target.value)}
          >
            {FAMILIAS.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </div>

        <div>
          <label style={labelStyle}>Mes</label>
          <input
            type="month"
            className="input"
            value={mes}
            onChange={(e) => setMes(e.target.value)}
          />
        </div>

        {error && (
          <div className="alert alert-error" style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>{error}</span>
          </div>
        )}

        {result && (
          <div
            style={{
              background: "#D1FAE5",
              color: "#065F46",
              border: "1px solid #6EE7B7",
              borderRadius: 8,
              padding: "12px 16px",
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            ✓ {result.materialesUpserted} material{result.materialesUpserted !== 1 ? "es" : ""} actualizado{result.materialesUpserted !== 1 ? "s" : ""},{" "}
            {result.consumosCreados} consumo{result.consumosCreados !== 1 ? "s" : ""} importado{result.consumosCreados !== 1 ? "s" : ""}
          </div>
        )}

        <div>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
          >
            <Upload size={16} />
            {loading ? "Importando…" : "Importar OP"}
          </button>
        </div>
      </form>
    </div>
  );
}
