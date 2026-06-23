import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { Upload, AlertCircle } from "lucide-react";
import { referenciasApi, COP } from "../api.js";

const CANDIDATOS_CODIGO = ["referencia interna", "internal reference", "ref interna", "código", "codigo", "default_code", "ref."];
const CANDIDATOS_COSTO = ["precio de costo", "cost price", "costo", "precio costo", "standard_price", "coste"];
const CANDIDATOS_NOMBRE = ["nombre", "name", "producto", "product"];

function extraerCampo(row, candidatos) {
  for (const key of Object.keys(row)) {
    if (candidatos.some((c) => key.toLowerCase().includes(c.toLowerCase()))) {
      return row[key];
    }
  }
  return null;
}

async function parseExcelOdoo(file) {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
  return rows;
}

export default function ImportarOdoo({ referencias, onImportDone }) {
  const [preview, setPreview] = useState(null);
  const [formatError, setFormatError] = useState("");
  const [matchError, setMatchError] = useState("");
  const [applying, setApplying] = useState(false);
  const [progress, setProgress] = useState(null);
  const [result, setResult] = useState(null);
  const inputRef = useRef(null);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setFormatError("");
    setMatchError("");
    setResult(null);
    setPreview(null);

    let rows;
    try {
      rows = await parseExcelOdoo(file);
    } catch {
      setFormatError("No se pudo leer el archivo. Asegúrate de que sea un archivo .xlsx válido.");
      return;
    }

    if (rows.length === 0) {
      setFormatError("No se reconoció el formato del Excel. Asegúrate de exportar con las columnas 'Referencia interna' y 'Precio de costo'.");
      return;
    }

    // Validate that at least one row has recognizable columns
    const sampleRow = rows[0];
    const tieneCodigo = extraerCampo(sampleRow, CANDIDATOS_CODIGO) !== null;
    const tieneCosto = extraerCampo(sampleRow, CANDIDATOS_COSTO) !== null;

    if (!tieneCodigo || !tieneCosto) {
      setFormatError("No se reconoció el formato del Excel. Asegúrate de exportar con las columnas 'Referencia interna' y 'Precio de costo'.");
      return;
    }

    const parsed = rows
      .map((row) => {
        const codigo = String(extraerCampo(row, CANDIDATOS_CODIGO) ?? "").trim();
        const costoRaw = extraerCampo(row, CANDIDATOS_COSTO);
        const nombre = String(extraerCampo(row, CANDIDATOS_NOMBRE) ?? "").trim();
        const costo = Number(String(costoRaw).replace(/[^\d.,]/g, "").replace(",", ".")) || 0;
        return { codigo, nombre, costo };
      })
      .filter((r) => r.codigo && r.costo > 0);

    if (parsed.length === 0) {
      setFormatError("No se reconoció el formato del Excel. Asegúrate de exportar con las columnas 'Referencia interna' y 'Precio de costo'.");
      return;
    }

    const withMatch = parsed.map((row) => {
      const ref = referencias.find(
        (r) => r.id.trim().toLowerCase() === row.codigo.toLowerCase()
      );
      return { ...row, ref: ref || null };
    });

    const hasAnyMatch = withMatch.some((r) => r.ref !== null);
    if (!hasAnyMatch) {
      setMatchError("Ningún código del Excel coincide con las referencias del sistema. Verifica que los códigos sean iguales en Odoo y en este sistema.");
    }

    setPreview(withMatch);
    // Reset file input so the same file can be reloaded if needed
    e.target.value = "";
  }

  async function handleApply() {
    if (!preview) return;
    const matches = preview.filter((r) => r.ref !== null);
    if (matches.length === 0) return;

    setApplying(true);
    setProgress({ current: 0, total: matches.length });
    setResult(null);

    let updated = 0;
    for (const row of matches) {
      try {
        await referenciasApi.update(row.ref.id, { costoReal: Number(row.costo) });
        updated++;
      } catch {
        // continue with remaining
      }
      setProgress((p) => ({ ...p, current: p.current + 1 }));
    }

    setApplying(false);
    setProgress(null);
    setPreview(null);
    setResult(updated);
    await onImportDone();
  }

  function handleCancel() {
    setPreview(null);
    setFormatError("");
    setMatchError("");
    setResult(null);
    setProgress(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  const matches = preview ? preview.filter((r) => r.ref !== null) : [];

  return (
    <div style={{ maxWidth: 900 }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: "#1F3864", marginBottom: 6 }}>
        Importar costos desde Odoo
      </h2>

      <p style={{ fontSize: 13, color: "var(--color-muted)", marginBottom: 20, lineHeight: 1.6 }}>
        Exporta desde Odoo: <strong>Contabilidad → Informes → Valoración de inventario</strong> (o
        Productos → lista → exportar con columnas <em>Referencia interna</em> y <em>Precio de costo</em>).
        Guarda como .xlsx y súbelo aquí.
      </p>

      {!preview && !result && (
        <label
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            cursor: "pointer",
            background: "#1F3864",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            padding: "10px 20px",
            fontWeight: 600,
            fontSize: 14,
          }}
        >
          <Upload size={18} />
          Seleccionar archivo .xlsx
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx"
            style={{ display: "none" }}
            onChange={handleFile}
          />
        </label>
      )}

      {formatError && (
        <div className="alert alert-warning" style={{ marginTop: 16, display: "flex", gap: 8, alignItems: "flex-start" }}>
          <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>{formatError}</span>
        </div>
      )}

      {matchError && !formatError && (
        <div className="alert alert-warning" style={{ marginTop: 16, display: "flex", gap: 8, alignItems: "flex-start" }}>
          <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>{matchError}</span>
        </div>
      )}

      {result !== null && (
        <div
          style={{
            marginTop: 16,
            background: "#D1FAE5",
            color: "#065F46",
            border: "1px solid #6EE7B7",
            borderRadius: 8,
            padding: "12px 16px",
            fontWeight: 600,
            fontSize: 14,
          }}
        >
          {result} referencia{result !== 1 ? "s" : ""} actualizada{result !== 1 ? "s" : ""} correctamente.
        </div>
      )}

      {result !== null && (
        <div style={{ marginTop: 12 }}>
          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              cursor: "pointer",
              background: "#1F3864",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "10px 20px",
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            <Upload size={18} />
            Importar otro archivo
            <input
              type="file"
              accept=".xlsx"
              style={{ display: "none" }}
              onChange={(e) => { setResult(null); handleFile(e); }}
            />
          </label>
        </div>
      )}

      {applying && progress && (
        <div style={{ marginTop: 16, fontSize: 14, color: "#2E75B6", fontWeight: 600 }}>
          Actualizando {progress.current} de {progress.total}…
        </div>
      )}

      {preview && !applying && (
        <>
          <div style={{ marginTop: 20, marginBottom: 12, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, color: "var(--color-muted)" }}>
              {preview.length} fila{preview.length !== 1 ? "s" : ""} detectadas —{" "}
              <strong style={{ color: "#065F46" }}>{matches.length} con match</strong>
            </span>
            <div style={{ flex: 1 }} />
            <button
              className="btn"
              onClick={handleCancel}
              style={{ background: "#F1F5F9", color: "#374151", border: "1px solid #D1D5DB" }}
            >
              Cancelar
            </button>
            <button
              className="btn btn-primary"
              onClick={handleApply}
              disabled={matches.length === 0}
            >
              <Upload size={16} />
              Aplicar {matches.length} actualizacion{matches.length !== 1 ? "es" : ""}
            </button>
          </div>

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Código en Excel</th>
                  <th>Nombre en Excel</th>
                  <th>Costo en Excel</th>
                  <th>Referencia en sistema</th>
                  <th>Costo actual en sistema</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((row, i) => (
                  <tr key={i} style={i % 2 === 1 ? { background: "#F8FAFC" } : undefined}>
                    <td style={{ fontWeight: 600 }}>{row.codigo}</td>
                    <td style={{ color: "var(--color-muted)", fontSize: 13 }}>{row.nombre || "—"}</td>
                    <td>{COP(row.costo)}</td>
                    <td>
                      {row.ref ? (
                        <span style={{ color: "#10B981", fontWeight: 600 }}>
                          ✓ {row.ref.nombre}
                        </span>
                      ) : (
                        <span style={{ color: "#EF4444", fontWeight: 600 }}>✗</span>
                      )}
                    </td>
                    <td>
                      {row.ref ? COP(row.ref.costoReal || 0) : <span style={{ color: "#9CA3AF" }}>—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
