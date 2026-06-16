import { useMemo, useState } from "react";
import { calcCostos, COP, mesLabel, COLORS } from "../api.js";

export default function Comparativo({ referencias, parametros }) {
  const [mes, setMes] = useState("");

  const filas = useMemo(() => {
    return referencias
      .filter((r) => r.costoReal > 0)
      .filter((r) => !mes || r.mes === mes)
      .map((r) => ({ ref: r, calc: calcCostos(r, parametros) }));
  }, [referencias, parametros, mes]);

  function estado(variacion) {
    if (variacion == null) return null;
    if (Math.abs(variacion) <= 5) return { icon: "✅", bg: COLORS.verdeClaro, color: COLORS.verdeOscuro, label: "En línea" };
    if (Math.abs(variacion) <= 10) return { icon: "⚠️", bg: COLORS.amberFondo, color: COLORS.amberTexto, label: "Atención" };
    return { icon: "🔻", bg: COLORS.rojoFondo, color: COLORS.rojoTexto, label: "Desviado" };
  }

  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <input
          type="month"
          value={mes}
          onChange={(e) => setMes(e.target.value)}
          style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #cbd5e1" }}
        />
        {mes && (
          <button onClick={() => setMes("")} style={{ marginLeft: 8, background: "none", border: "none", color: COLORS.azulMedio, cursor: "pointer" }}>
            Limpiar
          </button>
        )}
      </div>

      <div style={{ background: "#fff", borderRadius: 10, overflow: "auto", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ background: COLORS.azulClaro, textAlign: "left" }}>
              <th style={th}>Código</th>
              <th style={th}>Nombre</th>
              <th style={th}>Mes</th>
              <th style={th}>Costo estándar</th>
              <th style={th}>Costo real Odoo</th>
              <th style={th}>Variación $</th>
              <th style={th}>Variación %</th>
              <th style={th}>Estado</th>
            </tr>
          </thead>
          <tbody>
            {filas.map(({ ref, calc }) => {
              const e = estado(calc.variacion);
              const diff = calc.costoProd - calc.costoReal;
              return (
                <tr key={ref.id} style={{ borderBottom: "1px solid #eee" }}>
                  <td style={td}>{ref.id}</td>
                  <td style={td}>{ref.nombre}</td>
                  <td style={td}>{mesLabel(ref.mes)}</td>
                  <td style={td}>{COP(calc.costoProd)}</td>
                  <td style={td}>{COP(calc.costoReal)}</td>
                  <td style={td}>{COP(diff)}</td>
                  <td style={td}>{calc.variacion?.toFixed(1)}%</td>
                  <td style={td}>
                    {e && (
                      <span style={{ background: e.bg, color: e.color, padding: "4px 10px", borderRadius: 16, fontSize: 12, fontWeight: 600 }}>
                        {e.icon} {e.label}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
            {filas.length === 0 && (
              <tr><td style={td} colSpan={8}>No hay referencias con costo Odoo registrado para este filtro.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const th = { padding: "10px 14px", color: COLORS.azulOscuro, fontWeight: 600 };
const td = { padding: "10px 14px" };
