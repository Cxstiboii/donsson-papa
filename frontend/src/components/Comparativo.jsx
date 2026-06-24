import { useMemo, useState } from "react";
import { CheckCircle2, TriangleAlert, TrendingDown, GitCompare, X } from "lucide-react";
import { calcCostos, COP, mesLabel } from "../utils/costos.js";

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
    if (Math.abs(variacion) <= 5) return { Icon: CheckCircle2, className: "badge-success", label: "En línea" };
    if (Math.abs(variacion) <= 10) return { Icon: TriangleAlert, className: "badge-warning", label: "Atención" };
    return { Icon: TrendingDown, className: "badge-error", label: "Desviado" };
  }

  return (
    <div>
      <div style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
        <input
          type="month"
          value={mes}
          onChange={(e) => setMes(e.target.value)}
          className="input"
          style={{ width: "auto" }}
        />
        {mes && (
          <button onClick={() => setMes("")} className="btn btn-ghost">
            <X size={16} />
            Limpiar
          </button>
        )}
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Código</th>
              <th>Nombre</th>
              <th>Mes</th>
              <th>Costo estándar</th>
              <th>Costo real Odoo</th>
              <th>Variación $</th>
              <th>Variación %</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {filas.map(({ ref, calc }) => {
              const e = estado(calc.variacion);
              const diff = calc.costoProd - calc.costoReal;
              return (
                <tr key={ref.id}>
                  <td>{ref.id}</td>
                  <td>{ref.nombre}</td>
                  <td>{mesLabel(ref.mes)}</td>
                  <td>{COP(calc.costoProd)}</td>
                  <td>{COP(calc.costoReal)}</td>
                  <td>{COP(diff)}</td>
                  <td>{calc.variacion?.toFixed(1)}%</td>
                  <td>
                    {e && (
                      <span className={`badge ${e.className}`}>
                        <e.Icon size={16} />
                        {e.label}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
            {filas.length === 0 && (
              <tr>
                <td colSpan={8}>
                  <div className="empty-state">
                    <div className="empty-state-icon">
                      <GitCompare size={28} />
                    </div>
                    <div className="empty-state-title">No hay referencias con costo Odoo registrado para este filtro</div>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
