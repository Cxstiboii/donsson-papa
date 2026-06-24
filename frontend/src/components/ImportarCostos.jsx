import { useState, useEffect, useCallback, useRef } from "react";
import {
  Upload, AlertCircle, CheckCircle, ChevronLeft, Trash2,
  Clock, Package, Wrench, TrendingUp, TrendingDown,
  AlertTriangle, FileText, CalendarDays,
} from "lucide-react";
import { getToken, costosApi } from "../api.js";
import { COP, fmt } from "../utils/costos.js";

// ── Helpers ───────────────────────────────────────────────────────────────────


function fmtSeg(v) {
  if (v == null || isNaN(v)) return "—";
  return `${fmt(v, 3)} seg`;
}

function fmtTarifa(v) {
  if (v == null || isNaN(v)) return "—";
  return `$${fmt(v, 4)}/seg`;
}

function fmtPct(v, { alwaysSign = true } = {}) {
  if (v == null || isNaN(v)) return "—";
  const sign = v > 0 && alwaysSign ? "+" : "";
  return `${sign}${Number(v).toFixed(1)}%`;
}

function PctBadge({ v, inverse = false }) {
  if (v == null || isNaN(v)) return <span style={{ color: "#9CA3AF" }}>—</span>;
  // For cost: positive (over-cost) = bad, negative (saving) = good
  // inverse = true: positive = good (e.g. eficiencia)
  const isBad = inverse ? v < -1 : v > 1;
  const isGood = inverse ? v > 1 : v < -1;
  const color = isBad ? "#991B1B" : isGood ? "#065F46" : "#374151";
  const bg = isBad ? "#FEE2E2" : isGood ? "#D1FAE5" : "#F1F5F9";
  const sign = v > 0 ? "+" : "";
  return (
    <span style={{ background: bg, color, borderRadius: 10, padding: "2px 8px", fontWeight: 700, fontSize: 12 }}>
      {sign}{Number(v).toFixed(1)}%
    </span>
  );
}

function AlertDot({ active }) {
  if (!active) return <span style={{ color: "#9CA3AF" }}>—</span>;
  return (
    <span style={{ background: "#FEE2E2", color: "#991B1B", borderRadius: 10, padding: "2px 8px", fontWeight: 700, fontSize: 12 }}>
      ⚠ Alerta
    </span>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionHeader({ children }) {
  return (
    <div style={{
      fontSize: 13, fontWeight: 700, color: "#1F3864",
      background: "#D6E4F0", padding: "6px 12px", borderRadius: 6,
      marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em",
    }}>
      {children}
    </div>
  );
}

function MetaRow({ label, value }) {
  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
      <span style={{ fontSize: 12, color: "#6B7280", minWidth: 130 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{value}</span>
    </div>
  );
}

function TotalesBar({ totalPlaneado, totalEjecutado, totalVariacion }) {
  const varPct = totalPlaneado > 0 ? (totalVariacion / totalPlaneado) * 100 : 0;
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
      gap: 12, margin: "16px 0",
    }}>
      {[
        { label: "Total Planeado", value: COP(totalPlaneado), color: "#2E75B6", bg: "#EFF6FF" },
        { label: "Total Ejecutado", value: COP(totalEjecutado), color: "#065F46", bg: "#F0FDF4" },
        {
          label: "Variación",
          value: `${COP(totalVariacion)} (${fmtPct(varPct)})`,
          color: totalVariacion > 0 ? "#991B1B" : "#065F46",
          bg: totalVariacion > 0 ? "#FEF2F2" : "#F0FDF4",
        },
      ].map(({ label, value, color, bg }) => (
        <div key={label} style={{ background: bg, border: `1px solid ${color}20`, borderRadius: 8, padding: "10px 14px" }}>
          <div style={{ fontSize: 11, color: "#6B7280", fontWeight: 600, marginBottom: 4 }}>{label}</div>
          <div style={{ fontSize: 15, fontWeight: 700, color }}>{value}</div>
        </div>
      ))}
    </div>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "7px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer",
        border: "none", borderRadius: 6,
        background: active ? "#1F3864" : "transparent",
        color: active ? "#fff" : "#374151",
        transition: "all 0.15s",
      }}
    >
      {children}
    </button>
  );
}

// ── Tabla Mano de Obra / Carga Fabril ─────────────────────────────────────────

function TablaLabor({ items }) {
  const th = {
    padding: "8px 10px", background: "#1F3864", color: "#fff",
    fontSize: 11, fontWeight: 700, textAlign: "right", whiteSpace: "nowrap",
  };
  const thL = { ...th, textAlign: "left" };
  const td = { padding: "7px 10px", fontSize: 12, textAlign: "right", borderBottom: "1px solid #E5E7EB", whiteSpace: "nowrap" };
  const tdL = { ...td, textAlign: "left", fontWeight: 600 };

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
        <thead>
          <tr>
            <th style={thL}>Proceso</th>
            <th style={th}>Std Cant (seg)</th>
            <th style={th}>Std Valor</th>
            <th style={th}>Std Tarifa</th>
            <th style={th}>Plan Cant (seg)</th>
            <th style={th}>Plan Valor</th>
            <th style={th}>Plan Tarifa</th>
            <th style={th}>Ejec Cant (seg)</th>
            <th style={th}>Ejec Valor</th>
            <th style={th}>Ejec Tarifa</th>
            <th style={th}>Var. Valor</th>
            <th style={th}>Var. %</th>
            <th style={th}>Eficiencia</th>
            <th style={th}>Tarifa</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => {
            const rowBg = i % 2 === 0 ? "#fff" : "#F9FAFB";
            return (
              <tr key={i} style={{ background: rowBg }}>
                <td style={tdL}>{item.proceso}</td>
                <td style={td}>{fmt(item.cantStd, 3)}</td>
                <td style={td}>{COP(item.vrStd)}</td>
                <td style={td}>{fmtTarifa(item.tarifaStd)}</td>
                <td style={td}>{fmt(item.cantPlaneado, 3)}</td>
                <td style={td}>{COP(item.vrPlaneado)}</td>
                <td style={td}>{fmtTarifa(item.tarifaPlaneada)}</td>
                <td style={td}>{fmt(item.cantEjecutado, 3)}</td>
                <td style={td}>{COP(item.vrEjecutado)}</td>
                <td style={td}>{fmtTarifa(item.tarifaEjecutada)}</td>
                <td style={td}>{COP(item.variacionValor)}</td>
                <td style={td}><PctBadge v={item.variacionPct} /></td>
                <td style={td}><PctBadge v={item.eficienciaTiempoPct} inverse /></td>
                <td style={td}><AlertDot active={item.alertaTarifa} /></td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr style={{ background: "#EFF6FF", fontWeight: 700 }}>
            <td style={{ ...tdL, borderTop: "2px solid #2E75B6" }}>TOTAL</td>
            <td style={{ ...td, borderTop: "2px solid #2E75B6" }} />
            <td style={{ ...td, borderTop: "2px solid #2E75B6" }}>{COP(items.reduce((s, x) => s + (x.vrStd || 0), 0))}</td>
            <td style={{ ...td, borderTop: "2px solid #2E75B6" }} />
            <td style={{ ...td, borderTop: "2px solid #2E75B6" }} />
            <td style={{ ...td, borderTop: "2px solid #2E75B6" }}>{COP(items.reduce((s, x) => s + x.vrPlaneado, 0))}</td>
            <td style={{ ...td, borderTop: "2px solid #2E75B6" }} />
            <td style={{ ...td, borderTop: "2px solid #2E75B6" }} />
            <td style={{ ...td, borderTop: "2px solid #2E75B6" }}>{COP(items.reduce((s, x) => s + x.vrEjecutado, 0))}</td>
            <td style={{ ...td, borderTop: "2px solid #2E75B6" }} />
            <td style={{ ...td, borderTop: "2px solid #2E75B6" }} />
            <td style={{ ...td, borderTop: "2px solid #2E75B6" }} />
            <td style={{ ...td, borderTop: "2px solid #2E75B6" }} />
            <td style={{ ...td, borderTop: "2px solid #2E75B6" }} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ── Tabla Materia Prima ───────────────────────────────────────────────────────

function TablaMateriales({ items }) {
  const th = {
    padding: "8px 10px", background: "#1F3864", color: "#fff",
    fontSize: 11, fontWeight: 700, textAlign: "right", whiteSpace: "nowrap",
  };
  const thL = { ...th, textAlign: "left" };
  const td = { padding: "7px 10px", fontSize: 12, textAlign: "right", borderBottom: "1px solid #E5E7EB", whiteSpace: "nowrap" };
  const tdL = { ...td, textAlign: "left", fontWeight: 600 };

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 780 }}>
        <thead>
          <tr>
            <th style={thL}>Insumo</th>
            <th style={th}>Costo MP</th>
            <th style={th}>Plan Cant</th>
            <th style={th}>Plan Valor</th>
            <th style={th}>Ejec Cant</th>
            <th style={th}>Ejec Valor</th>
            <th style={th}>Var. Cant</th>
            <th style={th}>Var. Valor</th>
            <th style={th}>Var. %</th>
            <th style={th}>Cant.</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => {
            const rowBg = item.alertaCantidad ? "#FFF7ED" : i % 2 === 0 ? "#fff" : "#F9FAFB";
            const varCant = item.variacionCantidad;
            const varCantColor = varCant > 0 ? "#991B1B" : varCant < 0 ? "#065F46" : "#374151";
            return (
              <tr key={i} style={{ background: rowBg }}>
                <td style={tdL}>{item.insumo}</td>
                <td style={td}>{COP(item.costoMp)}</td>
                <td style={td}>{fmt(item.cantPlaneado, 4)}</td>
                <td style={td}>{COP(item.vrPlaneado)}</td>
                <td style={td}>{fmt(item.cantEjecutado, 4)}</td>
                <td style={td}>{COP(item.vrEjecutado)}</td>
                <td style={{ ...td, color: varCantColor, fontWeight: 600 }}>
                  {varCant > 0 ? "+" : ""}{fmt(varCant, 4)}
                </td>
                <td style={td}>{COP(item.variacionValor)}</td>
                <td style={td}><PctBadge v={item.variacionPct} /></td>
                <td style={td}><AlertDot active={item.alertaCantidad} /></td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr style={{ background: "#EFF6FF", fontWeight: 700 }}>
            <td style={{ ...tdL, borderTop: "2px solid #2E75B6" }}>TOTAL</td>
            <td style={{ ...td, borderTop: "2px solid #2E75B6" }} />
            <td style={{ ...td, borderTop: "2px solid #2E75B6" }} />
            <td style={{ ...td, borderTop: "2px solid #2E75B6" }}>{COP(items.reduce((s, x) => s + x.vrPlaneado, 0))}</td>
            <td style={{ ...td, borderTop: "2px solid #2E75B6" }} />
            <td style={{ ...td, borderTop: "2px solid #2E75B6" }}>{COP(items.reduce((s, x) => s + x.vrEjecutado, 0))}</td>
            <td style={{ ...td, borderTop: "2px solid #2E75B6" }} />
            <td style={{ ...td, borderTop: "2px solid #2E75B6" }} />
            <td style={{ ...td, borderTop: "2px solid #2E75B6" }} />
            <td style={{ ...td, borderTop: "2px solid #2E75B6" }} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ── Order Detail View ─────────────────────────────────────────────────────────

function OrderDetail({ order, onBack }) {
  const [activeTab, setActiveTab] = useState("mo");

  const cfItems = order.laborItems.filter((x) => x.tipo === "carga_fabril");
  const moItems = order.laborItems.filter((x) => x.tipo === "mano_obra");
  const mpItems = order.materials;

  const alertCount = [
    ...order.laborItems.filter((x) => x.alertaTarifa),
    ...order.materials.filter((x) => x.alertaCantidad),
  ].length;

  const formatDate = (d) => {
    if (!d) return "—";
    return new Date(d).toLocaleString("es-CO", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  };

  return (
    <div>
      <button
        onClick={onBack}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          fontSize: 13, color: "#2E75B6", background: "none", border: "none",
          cursor: "pointer", fontWeight: 600, marginBottom: 16, padding: 0,
        }}
      >
        <ChevronLeft size={16} />
        Volver al listado
      </button>

      {/* Header */}
      <div style={{
        background: "#1F3864", color: "#fff", borderRadius: 10,
        padding: "16px 20px", marginBottom: 16,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>Orden {order.orden}</div>
            <div style={{ fontSize: 13, color: "#93C5FD", marginTop: 2 }}>
              Doc. origen: {order.documentoOrigen} &nbsp;|&nbsp; Ref: {order.refDonsson} &nbsp;|&nbsp; Clase: {order.productoClase}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 13, color: "#93C5FD" }}>Cantidad fabricada</div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>
              {Number(order.cantidadFabricada).toLocaleString("es-CO")} uds
            </div>
          </div>
        </div>
        <div style={{ marginTop: 10, fontSize: 12, color: "#BFDBFE" }}>
          {order.producto}
        </div>
        <div style={{ marginTop: 6, fontSize: 11, color: "#93C5FD", display: "flex", gap: 16, flexWrap: "wrap" }}>
          <span><CalendarDays size={11} style={{ display: "inline", verticalAlign: "middle" }} /> Inicio: {formatDate(order.fechaInicial)}</span>
          <span>Cierre: {formatDate(order.fechaFinal)}</span>
          <span>Estado: {order.estado}</span>
          <span>Importado: {formatDate(order.fechaImportacion)}</span>
        </div>
      </div>

      {/* Alertas activas */}
      {alertCount > 0 && (
        <div style={{
          background: "#FEF3C7", border: "1px solid #F59E0B", borderRadius: 8,
          padding: "10px 14px", marginBottom: 12,
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <AlertTriangle size={16} style={{ color: "#92400E", flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: "#92400E", fontWeight: 600 }}>
            {alertCount} alerta{alertCount !== 1 ? "s" : ""} activa{alertCount !== 1 ? "s" : ""}
            {order.laborItems.filter((x) => x.alertaTarifa).length > 0 &&
              ` — tarifa MO elevada (${order.laborItems.filter((x) => x.alertaTarifa).map((x) => x.proceso).join(", ")})`}
            {order.materials.filter((x) => x.alertaCantidad).length > 0 &&
              ` — sobreconsumo MP (${order.materials.filter((x) => x.alertaCantidad).map((x) => x.insumo).join(", ")})`}
          </span>
        </div>
      )}

      {/* Totales */}
      <TotalesBar
        totalPlaneado={order.totalPlaneado}
        totalEjecutado={order.totalEjecutado}
        totalVariacion={order.totalVariacion}
      />

      {/* Tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 12, background: "#F3F4F6", borderRadius: 8, padding: 4 }}>
        <TabButton active={activeTab === "mo"} onClick={() => setActiveTab("mo")}>
          <Wrench size={13} style={{ display: "inline", marginRight: 5, verticalAlign: "middle" }} />
          Mano de Obra ({moItems.length})
        </TabButton>
        <TabButton active={activeTab === "cf"} onClick={() => setActiveTab("cf")}>
          <Clock size={13} style={{ display: "inline", marginRight: 5, verticalAlign: "middle" }} />
          Carga Fabril
        </TabButton>
        <TabButton active={activeTab === "mp"} onClick={() => setActiveTab("mp")}>
          <Package size={13} style={{ display: "inline", marginRight: 5, verticalAlign: "middle" }} />
          Mat. Prima ({mpItems.length})
        </TabButton>
      </div>

      {activeTab === "mo" && (
        <>
          <SectionHeader>Mano de Obra — detalle por proceso</SectionHeader>
          <TablaLabor items={moItems} />
        </>
      )}

      {activeTab === "cf" && (
        <>
          <SectionHeader>Carga Fabril</SectionHeader>
          <TablaLabor items={cfItems} />
        </>
      )}

      {activeTab === "mp" && (
        <>
          <SectionHeader>Materia Prima — {mpItems.length} insumo{mpItems.length !== 1 ? "s" : ""}</SectionHeader>
          <TablaMateriales items={mpItems} />
        </>
      )}
    </div>
  );
}

// ── Order List ────────────────────────────────────────────────────────────────

function OrderList({ orders, onSelect, onDelete }) {
  return (
    <div>
      {orders.length === 0 ? (
        <div style={{ textAlign: "center", color: "#9CA3AF", padding: "40px 0", fontSize: 14 }}>
          No hay órdenes importadas aún
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {orders.map((o) => {
            const varPct = o.totalPlaneado > 0
              ? ((o.totalVariacion / o.totalPlaneado) * 100)
              : 0;
            return (
              <div
                key={o.id}
                onClick={() => onSelect(o)}
                style={{
                  border: "1px solid #E5E7EB", borderRadius: 10, padding: "12px 16px",
                  cursor: "pointer", background: "#fff",
                  display: "flex", alignItems: "center", gap: 12,
                  transition: "box-shadow 0.15s",
                }}
                onMouseEnter={(e) => e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.1)"}
                onMouseLeave={(e) => e.currentTarget.style.boxShadow = "none"}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 700, color: "#1F3864", fontSize: 15 }}>{o.orden}</span>
                    <span style={{
                      background: "#D6E4F0", color: "#1F3864", borderRadius: 10,
                      padding: "1px 8px", fontSize: 11, fontWeight: 600,
                    }}>{o.refDonsson}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "#6B7280", marginTop: 3 }}>
                    {o.documentoOrigen} &nbsp;·&nbsp; Clase {o.productoClase} &nbsp;·&nbsp;
                    {Number(o.cantidadFabricada).toLocaleString("es-CO")} uds
                  </div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#1F3864" }}>
                    {COP(o.totalEjecutado)}
                  </div>
                  <PctBadge v={varPct} />
                </div>
                <div style={{ fontSize: 11, color: "#9CA3AF", flexShrink: 0, textAlign: "right" }}>
                  {new Date(o.fechaImportacion).toLocaleDateString("es-CO")}
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(o); }}
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    color: "#D1D5DB", padding: 4, borderRadius: 6,
                    display: "flex", alignItems: "center",
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = "#EF4444"}
                  onMouseLeave={(e) => e.currentTarget.style.color = "#D1D5DB"}
                  title="Eliminar orden"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function ImportarCostos() {
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [file, setFile] = useState(null);
  const [mes, setMes] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [importing, setImporting] = useState(false);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [importResult, setImportResult] = useState(null); // { warnings, order }
  const [importErrors, setImportErrors] = useState(null); // { errors, warnings }
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const fileInputRef = useRef(null);

  const loadOrders = useCallback(async () => {
    setLoadingOrders(true);
    try {
      const data = await costosApi.list();
      setOrders(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingOrders(false);
    }
  }, []);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  async function handleImport(e) {
    e.preventDefault();
    if (!file || !mes) return;

    setImporting(true);
    setImportResult(null);
    setImportErrors(null);

    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("mes", mes);

      const res = await fetch("/api/importar-costos", {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
        body: fd,
      });

      const data = await res.json().catch(() => ({}));

      if (res.status === 422) {
        setImportErrors(data);
        return;
      }
      if (!res.ok) {
        setImportErrors({ errors: [data.error || "Error desconocido"], warnings: [] });
        return;
      }

      setImportResult(data);
      setFile(null);
      // reset file input
      if (fileInputRef.current) fileInputRef.current.value = "";
      await loadOrders();
      // Auto-select the imported order
      if (data.order) setSelectedOrder(data.order);
    } catch (err) {
      setImportErrors({ errors: [err.message], warnings: [] });
    } finally {
      setImporting(false);
    }
  }

  async function handleDelete(order) {
    if (!window.confirm(`¿Eliminar la orden ${order.orden} (${order.refDonsson})? Esta acción no se puede deshacer.`)) return;
    try {
      await costosApi.remove(order.id);
      if (selectedOrder?.id === order.id) setSelectedOrder(null);
      await loadOrders();
    } catch (e) {
      alert("Error al eliminar: " + e.message);
    }
  }

  if (selectedOrder) {
    return (
      <OrderDetail
        order={selectedOrder}
        onBack={() => setSelectedOrder(null)}
      />
    );
  }

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: "#1F3864", marginBottom: 4 }}>
        Costos de Producción
      </h2>
      <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 20 }}>
        Importa el archivo Excel de Detalle de Costos exportado desde el ERP. Se analizan y almacenan los costos de Mano de Obra, Carga Fabril y Materia Prima por orden.
      </p>

      {/* Import form */}
      <div style={{
        border: "1px solid #E5E7EB", borderRadius: 10, padding: "16px 20px",
        background: "#FAFAFA", marginBottom: 24,
      }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#374151", marginBottom: 12 }}>
          <Upload size={14} style={{ display: "inline", marginRight: 6, verticalAlign: "middle" }} />
          Importar archivo Excel (.xls)
        </div>
        <form onSubmit={handleImport} style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>Mes</label>
            <input
              type="month"
              className="input"
              value={mes}
              required
              onChange={(e) => setMes(e.target.value)}
              style={{ minWidth: 160 }}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 280px" }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>Archivo Excel (.xls)</label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xls,.xlsx"
              className="input"
              style={{ width: "100%" }}
              onChange={(e) => {
                setFile(e.target.files?.[0] || null);
                setImportResult(null);
                setImportErrors(null);
              }}
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={!file || !mes || importing}
            style={{ display: "inline-flex", alignItems: "center", gap: 8, flexShrink: 0 }}
          >
            <Upload size={15} />
            {importing ? "Importando…" : "Importar"}
          </button>
        </form>

        {/* Errores de importación */}
        {importErrors && (
          <div style={{ marginTop: 12 }}>
            {importErrors.errors?.map((e, i) => (
              <div key={i} className="alert alert-error" style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                <span style={{ fontSize: 13 }}>{e}</span>
              </div>
            ))}
            {importErrors.warnings?.map((w, i) => (
              <div key={i} style={{
                display: "flex", gap: 8, marginBottom: 6,
                background: "#FEF3C7", border: "1px solid #F59E0B",
                borderRadius: 6, padding: "8px 12px",
              }}>
                <AlertTriangle size={15} style={{ flexShrink: 0, color: "#92400E", marginTop: 1 }} />
                <span style={{ fontSize: 13, color: "#92400E" }}>{w}</span>
              </div>
            ))}
          </div>
        )}

        {/* Resultado exitoso */}
        {importResult && (
          <div style={{ marginTop: 12 }}>
            <div style={{
              background: "#D1FAE5", border: "1px solid #6EE7B7",
              borderRadius: 6, padding: "10px 14px", marginBottom: 8,
              display: "flex", gap: 8, alignItems: "center",
            }}>
              <CheckCircle size={15} style={{ color: "#065F46", flexShrink: 0 }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: "#065F46" }}>
                Orden {importResult.order?.orden} importada correctamente
                {importResult.order && ` — ${COP(importResult.order.totalEjecutado)} ejecutado`}
              </span>
            </div>
            {importResult.warnings?.map((w, i) => (
              <div key={i} style={{
                display: "flex", gap: 8, marginBottom: 4,
                background: "#FEF3C7", border: "1px solid #F59E0B",
                borderRadius: 6, padding: "8px 12px",
              }}>
                <AlertTriangle size={15} style={{ flexShrink: 0, color: "#92400E", marginTop: 1 }} />
                <span style={{ fontSize: 13, color: "#92400E" }}>{w}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Orders list */}
      <div style={{ fontSize: 14, fontWeight: 700, color: "#374151", marginBottom: 10 }}>
        <FileText size={14} style={{ display: "inline", marginRight: 6, verticalAlign: "middle" }} />
        Órdenes importadas ({orders.length})
      </div>

      {loadingOrders ? (
        <div style={{ textAlign: "center", color: "#9CA3AF", padding: 24 }}>Cargando…</div>
      ) : (
        <OrderList
          orders={orders}
          onSelect={async (o) => {
            const full = await costosApi.get(o.id);
            setSelectedOrder(full);
          }}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}
