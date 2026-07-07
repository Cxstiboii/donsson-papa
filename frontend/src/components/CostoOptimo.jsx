import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, Plus, Pencil, Trash2, X, Check, Scale, AlertCircle } from "lucide-react";
import { referenciasApi } from "../api.js";
import { COP, fmt, parseCantidad } from "../utils/costos.js";

function VarBadge({ value }) {
  if (value == null || isNaN(value)) return <span style={{ color: "var(--color-muted)" }}>—</span>;
  const cls = value < 0 ? "badge-success" : value > 0 ? "badge-error" : "badge-info";
  return (
    <span className={`badge ${cls}`}>
      {value > 0 ? "+" : ""}{value.toFixed(1)}%
    </span>
  );
}

function ResumenOptimo({ data }) {
  const varEstandar = data.costoEstandar > 0
    ? ((data.costoOptimo - data.costoEstandar) / data.costoEstandar) * 100
    : null;
  const varProduccion = data.costoProduccion > 0
    ? ((data.costoOptimo - data.costoProduccion) / data.costoProduccion) * 100
    : null;

  return (
    <div className="optimo-summary">
      <div className="optimo-summary-grid">
        <div>
          <div className="optimo-summary-label">MPD Óptimo</div>
          <div className="optimo-summary-value">{COP(data.mpdOptimo)}</div>
        </div>
        <div>
          <div className="optimo-summary-label">MOD Estándar</div>
          <div className="optimo-summary-value">{COP(data.modEstandar)}</div>
        </div>
        <div>
          <div className="optimo-summary-label">CIF Estándar</div>
          <div className="optimo-summary-value">{COP(data.cifEstandar)}</div>
        </div>
        <div>
          <div className="optimo-summary-label">vs. Costo Estándar</div>
          <div className="optimo-summary-value"><VarBadge value={varEstandar} /></div>
        </div>
      </div>
      <div className="optimo-summary-total">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
          <span className="optimo-summary-label" style={{ fontSize: 13, fontWeight: 700, color: "var(--color-primary)" }}>
            COSTO ÓPTIMO
          </span>
          <span style={{ fontSize: 22, fontWeight: 800, color: "var(--color-primary)" }}>
            {COP(data.costoOptimo)}
          </span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6, fontSize: 12, color: "var(--color-muted)" }}>
          <span>Costo Producción (Odoo): {data.costoProduccion > 0 ? COP(data.costoProduccion) : "—"}</span>
          <VarBadge value={varProduccion} />
        </div>
      </div>
    </div>
  );
}

function BuscarMaterial({ materiales, lineasIds, onSeleccionar }) {
  const [busqueda, setBusqueda] = useState("");

  const resultados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return [];
    return materiales
      .filter((m) => !lineasIds.has(m.id))
      .filter((m) => m.id.toLowerCase().includes(q) || m.nombre.toLowerCase().includes(q))
      .slice(0, 15);
  }, [materiales, busqueda, lineasIds]);

  return (
    <div>
      <label className="field-label" style={{ marginTop: 0 }}>Buscar materia prima</label>
      <div style={{ position: "relative" }}>
        <Search size={18} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--color-muted)" }} />
        <input
          className="input"
          style={{ height: 48, paddingLeft: 40, fontSize: 16 }}
          placeholder="Código o nombre…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </div>
      {resultados.length > 0 && (
        <div className="optimo-search-results">
          {resultados.map((m) => (
            <button
              key={m.id}
              type="button"
              className="optimo-mat-btn"
              onClick={() => { onSeleccionar(m); setBusqueda(""); }}
            >
              <span style={{ fontWeight: 700, fontSize: 15 }}>{m.nombre}</span>
              <span style={{ fontSize: 12, color: "var(--color-muted)" }}>{m.id} · {m.unidad} · {COP(m.costo)}</span>
            </button>
          ))}
        </div>
      )}
      {busqueda.trim() !== "" && resultados.length === 0 && (
        <div style={{ fontSize: 13, color: "var(--color-muted)", padding: "10px 4px" }}>Sin resultados</div>
      )}
    </div>
  );
}

function EntradaCantidad({ material, guardando, onConfirmar, onCancelar }) {
  const [cantidad, setCantidad] = useState("");
  const num = parseCantidad(cantidad);
  const valido = cantidad.trim() !== "" && !isNaN(num) && num > 0;

  return (
    <div style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-card)", padding: 14, background: "#F0F7FF" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10, gap: 8 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{material.nombre}</div>
          <div style={{ fontSize: 12, color: "var(--color-muted)" }}>
            {material.id} · Precio actual: {COP(material.costo)} / {material.unidad}
          </div>
        </div>
        <button
          type="button"
          onClick={onCancelar}
          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-muted)", padding: 4, flexShrink: 0 }}
        >
          <X size={20} />
        </button>
      </div>
      <label className="field-label" style={{ marginTop: 0 }}>Cantidad pesada ({material.unidad})</label>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          type="text"
          inputMode="decimal"
          className="input"
          style={{ height: 48, fontSize: 18 }}
          placeholder={`0 ${material.unidad}`}
          value={cantidad}
          autoFocus
          onChange={(e) => setCantidad(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && valido && !guardando) onConfirmar(num); }}
        />
        <button
          type="button"
          className="btn btn-primary"
          style={{ height: 48, minWidth: 116, fontSize: 15, flexShrink: 0 }}
          disabled={!valido || guardando}
          onClick={() => onConfirmar(num)}
        >
          {guardando ? "Guardando…" : (<><Plus size={18} /> Agregar</>)}
        </button>
      </div>
      {cantidad.trim() !== "" && !valido && (
        <div style={{ fontSize: 12, color: "var(--color-error-text)", marginTop: 6 }}>
          Ingresa una cantidad válida mayor que 0
        </div>
      )}
    </div>
  );
}

function LineaEditando({ linea, guardando, onGuardar, onCancelar }) {
  const [cantidad, setCantidad] = useState(String(linea.cantidad));
  const num = parseCantidad(cantidad);
  const valido = cantidad.trim() !== "" && !isNaN(num) && num > 0;

  return (
    <div className="optimo-line">
      <div className="optimo-line-body">
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>{linea.nombre}</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="text"
            inputMode="decimal"
            className="input"
            style={{ height: 44, fontSize: 16 }}
            value={cantidad}
            autoFocus
            onChange={(e) => setCantidad(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && valido && !guardando) onGuardar(num);
              if (e.key === "Escape") onCancelar();
            }}
          />
          <span style={{ fontSize: 13, color: "var(--color-muted)", whiteSpace: "nowrap" }}>{linea.unidad}</span>
        </div>
      </div>
      <button
        type="button"
        className="btn btn-primary"
        style={{ height: 44, minWidth: 44, padding: 0, flexShrink: 0 }}
        disabled={!valido || guardando}
        onClick={() => onGuardar(num)}
      >
        <Check size={18} />
      </button>
      <button
        type="button"
        className="btn btn-secondary"
        style={{ height: 44, minWidth: 44, padding: 0, flexShrink: 0 }}
        onClick={onCancelar}
      >
        <X size={18} />
      </button>
    </div>
  );
}

function LineaOptima({ linea, flash, disabled, onEditar, onEliminar }) {
  return (
    <div className="optimo-line">
      <div className="optimo-line-body">
        <div style={{ fontWeight: 700, fontSize: 14 }}>{linea.nombre}</div>
        <div style={{ fontSize: 12, color: "var(--color-muted)" }}>
          {fmt(linea.cantidad, 3)} {linea.unidad} × {COP(linea.costo)} ={" "}
          <b style={{ color: "var(--color-text)" }}>{COP(linea.subtotal)}</b>
        </div>
        {flash && <div className="optimo-saved-flash">Guardado ✓</div>}
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onEditar(linea)}
        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-primary)", padding: 8, minWidth: 44, minHeight: 44, flexShrink: 0 }}
      >
        <Pencil size={18} />
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onEliminar(linea)}
        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-error)", padding: 8, minWidth: 44, minHeight: 44, flexShrink: 0 }}
      >
        <Trash2 size={18} />
      </button>
    </div>
  );
}

export default function CostoOptimo({ refId, materiales, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [matSeleccionado, setMatSeleccionado] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [flashId, setFlashId] = useState(null);
  const [editId, setEditId] = useState(null);
  const [eliminandoId, setEliminandoId] = useState(null);

  const cargar = useCallback(async () => {
    try {
      const d = await referenciasApi.optimo(refId);
      setData(d);
    } catch (e) {
      setErrorMsg(e.message);
    } finally {
      setLoading(false);
    }
  }, [refId]);

  useEffect(() => { cargar(); }, [cargar]);

  const lineasIds = useMemo(() => new Set((data?.lineas || []).map((l) => l.materialId)), [data]);

  function flashGuardado(materialId) {
    setFlashId(materialId);
    setTimeout(() => setFlashId((cur) => (cur === materialId ? null : cur)), 1500);
  }

  async function confirmarAgregar(cantidad) {
    if (!matSeleccionado || guardando) return;
    setGuardando(true);
    try {
      const idGuardado = matSeleccionado.id;
      await referenciasApi.guardarOptimoLinea(refId, idGuardado, cantidad);
      setMatSeleccionado(null);
      await cargar();
      flashGuardado(idGuardado);
    } catch (e) {
      alert(e.message);
    } finally {
      setGuardando(false);
    }
  }

  async function guardarEdicion(materialId, cantidad) {
    if (guardando) return;
    setGuardando(true);
    try {
      await referenciasApi.guardarOptimoLinea(refId, materialId, cantidad);
      setEditId(null);
      await cargar();
      flashGuardado(materialId);
    } catch (e) {
      alert(e.message);
    } finally {
      setGuardando(false);
    }
  }

  async function eliminarLinea(linea) {
    if (eliminandoId) return;
    if (!window.confirm(`¿Quitar "${linea.nombre}" del pesaje de esta referencia?`)) return;
    setEliminandoId(linea.materialId);
    try {
      await referenciasApi.eliminarOptimoLinea(refId, linea.materialId);
      await cargar();
    } catch (e) {
      alert(e.message);
    } finally {
      setEliminandoId(null);
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div
        className="modal"
        style={{ width: 480, maxWidth: "96vw", maxHeight: "92vh", padding: 0, display: "flex", flexDirection: "column" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: "18px 18px 0" }}>
          <h3 className="modal-title" style={{ marginBottom: 14 }}>
            <Scale size={20} />
            Costo Óptimo — {refId}
            <button
              onClick={onClose}
              style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "var(--color-muted)", padding: 4 }}
            >
              <X size={22} />
            </button>
          </h3>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "0 18px 18px" }}>
          {loading && <div className="spinner-wrap"><div className="spinner" /></div>}

          {errorMsg && (
            <div className="alert alert-error">
              <AlertCircle size={16} /> <span>{errorMsg}</span>
            </div>
          )}

          {data && !loading && (
            <div className="optimo-shell">
              <ResumenOptimo data={data} />

              {matSeleccionado ? (
                <EntradaCantidad
                  material={matSeleccionado}
                  guardando={guardando}
                  onConfirmar={confirmarAgregar}
                  onCancelar={() => setMatSeleccionado(null)}
                />
              ) : (
                <BuscarMaterial materiales={materiales} lineasIds={lineasIds} onSeleccionar={setMatSeleccionado} />
              )}

              <div>
                <div className="field-label" style={{ marginTop: 0 }}>
                  Materiales pesados ({data.lineas.length})
                </div>
                {data.lineas.length === 0 ? (
                  <div style={{ fontSize: 13, color: "var(--color-muted)", padding: "10px 0" }}>
                    Aún no se ha pesado ningún material.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {data.lineas.map((l) => (
                      editId === l.materialId ? (
                        <LineaEditando
                          key={l.materialId}
                          linea={l}
                          guardando={guardando}
                          onGuardar={(num) => guardarEdicion(l.materialId, num)}
                          onCancelar={() => setEditId(null)}
                        />
                      ) : (
                        <LineaOptima
                          key={l.materialId}
                          linea={l}
                          flash={flashId === l.materialId}
                          disabled={eliminandoId === l.materialId}
                          onEditar={() => setEditId(l.materialId)}
                          onEliminar={eliminarLinea}
                        />
                      )
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
