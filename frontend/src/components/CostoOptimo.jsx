import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Search, Trash2, X, Check, Scale, AlertCircle, CheckCircle2 } from "lucide-react";
import { referenciasApi } from "../api.js";
import { COP, parseCantidad } from "../utils/costos.js";

function VarBadge({ value }) {
  if (value == null || isNaN(value)) return <span style={{ color: "var(--color-muted)" }}>—</span>;
  const cls = value < 0 ? "badge-success" : value > 0 ? "badge-error" : "badge-info";
  return (
    <span className={`badge ${cls}`}>
      {value > 0 ? "+" : ""}{value.toFixed(1)}%
    </span>
  );
}

function ResumenOptimo({ data, compact }) {
  const varEstandar = data.costoEstandar > 0
    ? ((data.costoOptimo - data.costoEstandar) / data.costoEstandar) * 100
    : null;
  const varProduccion = data.costoProduccion > 0
    ? ((data.costoOptimo - data.costoProduccion) / data.costoProduccion) * 100
    : null;

  if (compact) {
    return (
      <div className="optimo-summary optimo-summary-compact">
        <span className="optimo-summary-label" style={{ fontWeight: 700, color: "var(--color-primary)" }}>
          COSTO ÓPTIMO
        </span>
        <span style={{ fontSize: 16, fontWeight: 800, color: "var(--color-primary)", marginLeft: "auto" }}>
          {COP(data.costoOptimo)}
        </span>
        <VarBadge value={varEstandar} />
      </div>
    );
  }

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

// Fila de material precargada: muestra info de solo lectura (nombre, código,
// unidad, precio) más un input de cantidad que guarda inline. Si ya existe
// una línea guardada, se muestra marcada y editable; si se vacía, se elimina.
function FilaMaterial({ fila, focused, guardando, eliminando, flash, onGuardar, onEliminar, onFocus, onBlur }) {
  const guardado = !!fila.linea;
  const [cantidad, setCantidad] = useState(fila.linea ? String(fila.linea.cantidad) : "");
  const inputRef = useRef(null);
  const suppressBlurSave = useRef(false);

  useEffect(() => {
    if (!focused) setCantidad(fila.linea ? String(fila.linea.cantidad) : "");
  }, [fila.linea, focused]);

  const num = parseCantidad(cantidad);
  const vacio = cantidad.trim() === "";
  const valido = !vacio && !isNaN(num) && num > 0;
  const invalido = !vacio && !valido;
  const disabled = guardando || eliminando;

  function guardar() {
    if (disabled || !valido) return;
    suppressBlurSave.current = true;
    onGuardar(fila.id, num);
    inputRef.current?.blur();
  }

  return (
    <div className={`optimo-row${guardado ? " is-saved" : ""}`}>
      <div className="optimo-row-info">
        <div className="optimo-row-name">
          {fila.nombre}
          {guardado && <CheckCircle2 size={14} className="optimo-row-check" />}
        </div>
        <div className="optimo-row-meta">{fila.id} · {fila.unidad} · {COP(fila.costo)}</div>
        {flash && <div className="optimo-saved-flash">Guardado ✓</div>}
        {invalido && <div className="optimo-row-error">Cantidad inválida</div>}
      </div>
      <div className="optimo-row-controls">
        <input
          ref={inputRef}
          type="text"
          inputMode="decimal"
          className="input optimo-row-input"
          placeholder={`0 ${fila.unidad}`}
          value={cantidad}
          disabled={disabled}
          onChange={(e) => setCantidad(e.target.value)}
          onFocus={onFocus}
          onBlur={() => {
            onBlur();
            if (suppressBlurSave.current) {
              suppressBlurSave.current = false;
              return;
            }
            if (valido) onGuardar(fila.id, num);
          }}
          onKeyDown={(e) => { if (e.key === "Enter") guardar(); }}
        />
        <button
          type="button"
          className="btn btn-primary optimo-row-btn"
          disabled={disabled || !valido}
          onMouseDown={(e) => e.preventDefault()}
          onClick={guardar}
          title="Guardar"
        >
          {guardando ? "…" : <Check size={18} />}
        </button>
        <button
          type="button"
          className="optimo-row-del"
          disabled={!guardado || disabled}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onEliminar(fila)}
          title="Quitar"
        >
          {eliminando ? "…" : <Trash2 size={16} />}
        </button>
      </div>
    </div>
  );
}

export default function CostoOptimo({ refId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [guardandoIds, setGuardandoIds] = useState(() => new Set());
  const [eliminandoIds, setEliminandoIds] = useState(() => new Set());
  const [flashId, setFlashId] = useState(null);
  const [focusedId, setFocusedId] = useState(null);

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

  // Overlay real: bloquea el scroll del body mientras el modal está abierto.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, []);

  // Detecta el teclado móvil realmente abierto (no solo el foco) vía
  // visualViewport: este evento llega ya terminado el gesto de toque, así
  // que colapsar el resumen nunca puede desplazar el layout bajo el dedo del
  // usuario a mitad de un tap (lo que antes hacía que un tap sobre el input
  // terminara cerrando el modal completo).
  const [tecladoAbierto, setTecladoAbierto] = useState(false);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const alturaCompleta = window.innerHeight;
    function onResize() {
      setTecladoAbierto(vv.height < alturaCompleta - 120);
    }
    vv.addEventListener("resize", onResize);
    return () => vv.removeEventListener("resize", onResize);
  }, []);

  const filas = useMemo(() => {
    const list = (data?.materiales || []).map((m) => ({
      id: m.id,
      nombre: m.nombre,
      unidad: m.unidad,
      costo: m.costo,
      linea: m.cantidad != null ? { cantidad: m.cantidad } : null,
    }));
    list.sort((a, b) => {
      const aPri = !!a.linea;
      const bPri = !!b.linea;
      if (aPri !== bPri) return aPri ? -1 : 1;
      return a.nombre.localeCompare(b.nombre, "es");
    });
    return list;
  }, [data]);

  const filasFiltradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return filas;
    return filas.filter((f) => f.id.toLowerCase().includes(q) || f.nombre.toLowerCase().includes(q));
  }, [filas, busqueda]);

  function flashGuardado(materialId) {
    setFlashId(materialId);
    setTimeout(() => setFlashId((cur) => (cur === materialId ? null : cur)), 1500);
  }

  async function guardarLinea(materialId, cantidad) {
    if (guardandoIds.has(materialId)) return;
    setGuardandoIds((s) => new Set(s).add(materialId));
    try {
      await referenciasApi.guardarOptimoLinea(refId, materialId, cantidad);
      await cargar();
      flashGuardado(materialId);
    } catch (e) {
      alert(e.message);
    } finally {
      setGuardandoIds((s) => { const n = new Set(s); n.delete(materialId); return n; });
    }
  }

  async function eliminarLinea(fila) {
    if (eliminandoIds.has(fila.id)) return;
    if (!window.confirm(`¿Quitar "${fila.nombre}" del pesaje de esta referencia?`)) return;
    setEliminandoIds((s) => new Set(s).add(fila.id));
    try {
      await referenciasApi.eliminarOptimoLinea(refId, fila.id);
      await cargar();
    } catch (e) {
      alert(e.message);
    } finally {
      setEliminandoIds((s) => { const n = new Set(s); n.delete(fila.id); return n; });
    }
  }

  const modal = (
    <div className="optimo-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="optimo-modal" onClick={(e) => e.stopPropagation()}>
        <div className="optimo-modal-header">
          <h3 className="modal-title" style={{ marginBottom: 0 }}>
            <Scale size={20} />
            Costo Óptimo — {refId}
          </h3>
          <button onClick={onClose} className="optimo-close-btn">
            <X size={22} />
          </button>
        </div>

        <div className="optimo-modal-body">
          {loading && <div className="spinner-wrap"><div className="spinner" /></div>}

          {errorMsg && (
            <div className="alert alert-error">
              <AlertCircle size={16} /> <span>{errorMsg}</span>
            </div>
          )}

          {data && !loading && (
            <div className="optimo-shell">
              <ResumenOptimo data={data} compact={!!focusedId && tecladoAbierto} />

              <div className="optimo-search-wrap">
                <Search size={18} className="optimo-search-icon" />
                <input
                  className="input"
                  style={{ height: 48, paddingLeft: 40, paddingRight: 40, fontSize: 16 }}
                  placeholder="Filtrar por código o nombre…"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                />
                {busqueda !== "" && (
                  <button type="button" className="optimo-search-clear" onClick={() => setBusqueda("")}>
                    <X size={16} />
                  </button>
                )}
              </div>

              <div className="optimo-count">
                {data.lineas.length} de {data.materiales.length} materiales pesados
              </div>

              <div className="optimo-row-list">
                {filasFiltradas.length === 0 && (
                  <div style={{ fontSize: 13, color: "var(--color-muted)", padding: "16px 4px", textAlign: "center" }}>
                    Sin resultados
                  </div>
                )}
                {filasFiltradas.map((f) => (
                  <FilaMaterial
                    key={f.id}
                    fila={f}
                    focused={focusedId === f.id}
                    guardando={guardandoIds.has(f.id)}
                    eliminando={eliminandoIds.has(f.id)}
                    flash={flashId === f.id}
                    onGuardar={guardarLinea}
                    onEliminar={eliminarLinea}
                    onFocus={() => setFocusedId(f.id)}
                    onBlur={() => setFocusedId((cur) => (cur === f.id ? null : cur))}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
