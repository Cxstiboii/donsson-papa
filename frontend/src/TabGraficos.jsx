import { useMemo, useState } from "react";
import { calcCostos, COP, COLORS } from "./api.js";

const FAMILIA_COLOR = { FA: COLORS.azulMedio, FM: COLORS.verdeOscuro, FE: COLORS.amberTexto };
const familiaColor = (f) => FAMILIA_COLOR[f] || COLORS.azulMedio;

function abreviarCOP(v) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${Math.round(v / 1000)}k`;
  return `$${Math.round(v)}`;
}

function ChartCard({ title, subtitle, accent, children }) {
  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 12,
        boxShadow: "0 2px 10px rgba(0,0,0,.08)",
        borderTop: `3px solid ${accent}`,
        padding: 16,
        display: "flex",
        flexDirection: "column",
        minHeight: 320,
      }}
    >
      <div style={{ fontWeight: 700, color: COLORS.azulOscuro, fontSize: 15 }}>{title}</div>
      <div style={{ fontSize: 12, color: "#94A3B8", marginBottom: 10 }}>{subtitle}</div>
      <div style={{ flex: 1, minHeight: 0 }}>{children}</div>
    </div>
  );
}

export default function TabGraficos({ referencias, parametros }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, 1fr)",
        gap: 16,
      }}
    >
      <ChartCard title="Costo de producción por referencia" subtitle="Agrupado por familia" accent={COLORS.azulMedio}>
        <G1Barras referencias={referencias} parametros={parametros} />
      </ChartCard>
      <ChartCard title="Composición del costo promedio" subtitle="MPD / MOD / CIF" accent={COLORS.verdeOscuro}>
        <G2Dona referencias={referencias} parametros={parametros} />
      </ChartCard>
      <ChartCard title="Variación % estándar vs real" subtitle="Solo referencias con costo Odoo" accent={COLORS.rojoTexto}>
        <G3Lineas referencias={referencias} parametros={parametros} />
      </ChartCard>
      <ChartCard title="Top 10 referencias por margen bruto" subtitle="Mayor a menor" accent={COLORS.amberTexto}>
        <G4Horizontal referencias={referencias} parametros={parametros} />
      </ChartCard>
    </div>
  );
}

// ---------- G1: Barras verticales ----------
function G1Barras({ referencias, parametros }) {
  const [hover, setHover] = useState(null);
  const datos = useMemo(
    () => referencias.map((r) => ({ r, costoProd: calcCostos(r, parametros).costoProd })),
    [referencias, parametros]
  );
  if (datos.length === 0) return <Vacio />;

  const W = 480, H = 260, padL = 50, padB = 30, padT = 10, padR = 10;
  const max = Math.max(...datos.map((d) => d.costoProd), 1);
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const bw = innerW / datos.length;

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((p) => p * max);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ width: "100%", height: "100%" }}>
      {ticks.map((t, i) => {
        const y = padT + innerH - (t / max) * innerH;
        return (
          <g key={i}>
            <line x1={padL} x2={W - padR} y1={y} y2={y} stroke="#E2E8F0" strokeWidth="1" />
            <text x={padL - 6} y={y + 3} fontSize="9" textAnchor="end" fill="#64748B">
              {abreviarCOP(t)}
            </text>
          </g>
        );
      })}
      {datos.map((d, i) => {
        const h = (d.costoProd / max) * innerH;
        const x = padL + i * bw + bw * 0.15;
        const y = padT + innerH - h;
        const w = bw * 0.7;
        return (
          <g key={d.r.id} onMouseEnter={() => setHover(d)} onMouseLeave={() => setHover(null)}>
            <rect x={x} y={y} width={w} height={h} fill={familiaColor(d.r.familia)} rx={2} />
            <text x={x + w / 2} y={H - padB + 12} fontSize="8" textAnchor="middle" fill="#475569">
              {d.r.id}
            </text>
          </g>
        );
      })}
      {hover && (
        <g>
          <rect
            x={Math.min(Math.max(padL, (datos.indexOf(hover) + 0.5) * bw + padL - 60), W - 120)}
            y={padT}
            width={120}
            height={32}
            fill="#1F3864"
            rx={4}
          />
          <text
            x={Math.min(Math.max(padL, (datos.indexOf(hover) + 0.5) * bw + padL - 60), W - 120) + 6}
            y={padT + 13}
            fontSize="9"
            fill="#fff"
          >
            {hover.r.nombre.slice(0, 20)}
          </text>
          <text
            x={Math.min(Math.max(padL, (datos.indexOf(hover) + 0.5) * bw + padL - 60), W - 120) + 6}
            y={padT + 25}
            fontSize="9"
            fill="#fff"
            fontWeight="bold"
          >
            {COP(hover.costoProd)}
          </text>
        </g>
      )}
    </svg>
  );
}

// ---------- G2: Dona ----------
function G2Dona({ referencias, parametros }) {
  const agg = useMemo(() => {
    if (referencias.length === 0) return null;
    let mpd = 0, mod = 0, cif = 0;
    for (const r of referencias) {
      const c = calcCostos(r, parametros);
      mpd += c.mpd;
      mod += c.mod;
      cif += c.cif;
    }
    const n = referencias.length;
    return { mpd: mpd / n, mod: mod / n, cif: cif / n };
  }, [referencias, parametros]);

  if (!agg) return <Vacio />;

  const total = agg.mpd + agg.mod + agg.cif || 1;
  const segments = [
    { label: "MPD", value: agg.mpd, color: COLORS.azulMedio },
    { label: "MOD", value: agg.mod, color: COLORS.verdeOscuro },
    { label: "CIF", value: agg.cif, color: COLORS.amberTexto },
  ];

  const cx = 100, cy = 100, rOuter = 70, rInner = 42;
  let acumAngle = -90;

  function arcPath(startAngle, endAngle, r) {
    const toXY = (ang, radius) => {
      const rad = (ang * Math.PI) / 180;
      return [cx + radius * Math.cos(rad), cy + radius * Math.sin(rad)];
    };
    const [x1, y1] = toXY(startAngle, r);
    const [x2, y2] = toXY(endAngle, r);
    const large = endAngle - startAngle > 180 ? 1 : 0;
    return { x1, y1, x2, y2, large };
  }

  const paths = segments.map((s) => {
    const angle = (s.value / total) * 360;
    const start = acumAngle;
    const end = acumAngle + angle;
    acumAngle = end;
    const outer = arcPath(start, end, rOuter);
    const inner = arcPath(end, start, rInner);
    const d = [
      `M ${outer.x1} ${outer.y1}`,
      `A ${rOuter} ${rOuter} 0 ${outer.large} 1 ${outer.x2} ${outer.y2}`,
      `L ${inner.x1} ${inner.y1}`,
      `A ${rInner} ${rInner} 0 ${inner.large} 0 ${inner.x2} ${inner.y2}`,
      "Z",
    ].join(" ");
    return { ...s, d, pct: (s.value / total) * 100 };
  });

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16, height: "100%" }}>
      <svg viewBox="0 0 200 200" preserveAspectRatio="xMidYMid meet" style={{ width: 200, height: 200, flexShrink: 0 }}>
        {paths.map((p) => (
          <path key={p.label} d={p.d} fill={p.color} />
        ))}
        <text x={cx} y={cy - 4} fontSize="13" textAnchor="middle" fill={COLORS.azulOscuro} fontWeight="bold">
          {COP(total)}
        </text>
        <text x={cx} y={cy + 12} fontSize="9" textAnchor="middle" fill="#64748B">
          Costo promedio
        </text>
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {paths.map((p) => (
          <div key={p.label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: p.color, display: "inline-block" }} />
            <span style={{ fontWeight: 600, color: "#334155" }}>{p.label}</span>
            <span style={{ color: "#64748B" }}>
              {p.pct.toFixed(1)}% · {COP(p.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- G3: Líneas variación % ----------
function G3Lineas({ referencias, parametros }) {
  const datos = useMemo(() => {
    return referencias
      .filter((r) => r.costoReal > 0)
      .map((r) => ({ r, variacion: calcCostos(r, parametros).variacion }));
  }, [referencias, parametros]);

  if (datos.length === 0) return <Vacio mensaje="Sin referencias con costo real Odoo" />;

  const W = 480, H = 260, padL = 40, padB = 30, padT = 10, padR = 10;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const maxAbs = Math.max(...datos.map((d) => Math.abs(d.variacion)), 10);
  const yFor = (v) => padT + innerH / 2 - (v / maxAbs) * (innerH / 2);
  const xFor = (i) => padL + (datos.length === 1 ? innerW / 2 : (i / (datos.length - 1)) * innerW);

  const pathD = datos.map((d, i) => `${i === 0 ? "M" : "L"} ${xFor(i)} ${yFor(d.variacion)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ width: "100%", height: "100%" }}>
      <line x1={padL} x2={W - padR} y1={yFor(0)} y2={yFor(0)} stroke="#94A3B8" strokeWidth="1" strokeDasharray="4,3" />
      <text x={padL - 4} y={yFor(0) + 3} fontSize="9" textAnchor="end" fill="#64748B">0%</text>
      <text x={padL - 4} y={yFor(maxAbs) + 3} fontSize="9" textAnchor="end" fill="#64748B">{maxAbs.toFixed(0)}%</text>
      <text x={padL - 4} y={yFor(-maxAbs) + 3} fontSize="9" textAnchor="end" fill="#64748B">-{maxAbs.toFixed(0)}%</text>
      <path d={pathD} fill="none" stroke={COLORS.rojoTexto} strokeWidth="2" />
      {datos.map((d, i) => {
        const destacado = Math.abs(d.variacion) > 10;
        return (
          <g key={d.r.id}>
            <circle cx={xFor(i)} cy={yFor(d.variacion)} r={destacado ? 5 : 3} fill={destacado ? COLORS.rojoTexto : "#fff"} stroke={COLORS.rojoTexto} strokeWidth="1.5" />
            <text x={xFor(i)} y={H - padB + 12} fontSize="8" textAnchor="middle" fill="#475569">
              {d.r.id}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ---------- G4: Barras horizontales top 10 margen ----------
function G4Horizontal({ referencias, parametros }) {
  const datos = useMemo(() => {
    return referencias
      .map((r) => {
        const c = calcCostos(r, parametros);
        const pctMargen = c.precioVenta > 0 ? (c.margenBruto / c.precioVenta) * 100 : 0;
        return { r, margenBruto: c.margenBruto, pctMargen };
      })
      .sort((a, b) => b.margenBruto - a.margenBruto)
      .slice(0, 10);
  }, [referencias, parametros]);

  if (datos.length === 0) return <Vacio />;

  const W = 480, H = 280, padL = 70, padR = 90, padT = 6;
  const rowH = (H - padT) / datos.length;
  const innerW = W - padL - padR;
  const max = Math.max(...datos.map((d) => d.margenBruto), 1);

  function colorFor(pct) {
    if (pct > 30) return COLORS.verdeOscuro;
    if (pct > 15) return COLORS.azulMedio;
    return COLORS.amberTexto;
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ width: "100%", height: "100%" }}>
      {datos.map((d, i) => {
        const y = padT + i * rowH + rowH * 0.2;
        const h = rowH * 0.6;
        const w = (d.margenBruto / max) * innerW;
        return (
          <g key={d.r.id}>
            <text x={padL - 6} y={y + h / 2 + 3} fontSize="9" textAnchor="end" fill="#334155">
              {d.r.id}
            </text>
            <rect x={padL} y={y} width={w} height={h} fill={colorFor(d.pctMargen)} rx={2} />
            <text x={padL + w + 6} y={y + h / 2 + 3} fontSize="9" fill="#334155">
              {COP(d.margenBruto)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function Vacio({ mensaje = "Sin datos para mostrar" }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#94A3B8", fontSize: 13 }}>
      {mensaje}
    </div>
  );
}
