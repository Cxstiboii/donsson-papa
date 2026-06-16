import { ChevronLeft, ChevronRight } from "lucide-react";
import { mesLabel, COLORS } from "./api.js";

function shiftMes(ym, delta) {
  if (!ym) return ym;
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function FiltroFecha({ modo, setModo, mes, setMes, desde, setDesde, hasta, setHasta }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      <div
        style={{
          display: "flex",
          background: COLORS.azulClaro,
          borderRadius: 999,
          padding: 3,
          gap: 2,
        }}
      >
        {[
          { key: "mensual", label: "Mensual" },
          { key: "rango", label: "Rango" },
        ].map((o) => (
          <button
            key={o.key}
            onClick={() => setModo(o.key)}
            style={{
              border: "none",
              cursor: "pointer",
              padding: "6px 14px",
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 600,
              background: modo === o.key ? COLORS.azulOscuro : "transparent",
              color: modo === o.key ? "#fff" : COLORS.azulOscuro,
              transition: "background .15s",
            }}
          >
            {o.label}
          </button>
        ))}
      </div>

      {modo === "mensual" ? (
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button
            onClick={() => setMes(shiftMes(mes, -1))}
            className="btn btn-ghost"
            style={{ padding: 6 }}
            title="Mes anterior"
          >
            <ChevronLeft size={16} />
          </button>
          <input
            type="month"
            value={mes}
            onChange={(e) => setMes(e.target.value)}
            className="input"
            style={{ width: "auto", borderRadius: 8 }}
          />
          <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.azulOscuro, minWidth: 90 }}>
            {mesLabel(mes)}
          </span>
          <button
            onClick={() => setMes(shiftMes(mes, 1))}
            className="btn btn-ghost"
            style={{ padding: 6 }}
            title="Mes siguiente"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, color: "var(--color-muted)" }}>Desde</span>
          <input
            type="month"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
            className="input"
            style={{ width: "auto", borderRadius: 8 }}
          />
          <span style={{ fontSize: 12, color: "var(--color-muted)" }}>Hasta</span>
          <input
            type="month"
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
            className="input"
            style={{ width: "auto", borderRadius: 8 }}
          />
        </div>
      )}
    </div>
  );
}

export function dentroDeRango(mesRef, desde, hasta) {
  if (!mesRef) return false;
  if (desde && mesRef < desde) return false;
  if (hasta && mesRef > hasta) return false;
  return true;
}
