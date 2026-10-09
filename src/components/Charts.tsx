import { useEffect, useRef, useState, type ReactNode } from 'react';

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(600);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(240, Math.round(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, width };
}

function niceMax(v: number): number {
  if (v <= 0) return 10;
  const pow = 10 ** Math.floor(Math.log10(v));
  const n = v / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * pow;
}

function ChartFrame({
  title,
  summary,
  table,
  children,
}: {
  title: string;
  summary: string;
  table: { head: string[]; rows: (string | number)[][] };
  children: ReactNode;
}) {
  const [showTable, setShowTable] = useState(false);
  return (
    <figure className="chart">
      <figcaption className="chart-head">
        <span className="chart-title">{title}</span>
        <button type="button" className="chart-toggle" aria-pressed={showTable} onClick={() => setShowTable((v) => !v)}>
          {showTable ? 'Ver gráfico' : 'Ver tabela'}
        </button>
      </figcaption>
      <p className="sr-only">{summary}</p>
      {showTable ? (
        <div className="chart-table-wrap">
          <table className="chart-table">
            <thead>
              <tr>
                {table.head.map((h) => (
                  <th key={h} scope="col">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((r, i) => (
                <tr key={i}>
                  {r.map((c, j) => (
                    <td key={j}>{c}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        children
      )}
    </figure>
  );
}

// ── Barras verticais (tempo de estudo por dia) ─────────────────────────
export function BarChart({
  title,
  data,
  format,
  goal,
  goalLabel,
  height = 220,
}: {
  title: string;
  data: { label: string; sub?: string; value: number }[];
  format: (v: number) => string;
  goal?: number;
  goalLabel?: string;
  height?: number;
}) {
  const { ref, width } = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const pad = { top: 16, right: 8, bottom: 40, left: 40 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const max = niceMax(Math.max(goal ?? 0, ...data.map((d) => d.value)));
  const band = innerW / data.length;
  const barW = Math.max(4, Math.min(34, band - 6));
  const y = (v: number) => pad.top + innerH - (v / max) * innerH;
  const ticks = [0, max / 2, max];
  const labelEvery = band < 30 ? 2 : 1;
  const total = data.reduce((a, d) => a + d.value, 0);

  return (
    <ChartFrame
      title={title}
      summary={`${title}: total de ${format(total)} no período.`}
      table={{ head: ['Dia', 'Valor'], rows: data.map((d) => [`${d.sub ?? ''} ${d.label}`.trim(), format(d.value)]) }}
    >
      <div ref={ref} className="chart-canvas" onMouseLeave={() => setHover(null)}>
        <svg width={width} height={height} role="img" aria-label={`${title}. Use "Ver tabela" para os valores.`}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} className="chart-grid" />
              <text x={pad.left - 8} y={y(t)} dy="0.35em" textAnchor="end" className="chart-axis">
                {Math.round(t)}
              </text>
            </g>
          ))}
          {data.map((d, i) => {
            const x = pad.left + i * band + (band - barW) / 2;
            const h = Math.max(d.value > 0 ? 3 : 0, (d.value / max) * innerH);
            const top = pad.top + innerH - h;
            const r = Math.min(4, barW / 2, h);
            return (
              <g key={i} onMouseEnter={() => setHover(i)}>
                <rect x={pad.left + i * band} y={pad.top} width={band} height={innerH} fill="transparent" />
                {h > 0 && (
                  <path
                    className={`chart-bar${hover === i ? ' is-hover' : ''}`}
                    d={`M${x},${pad.top + innerH} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${pad.top + innerH} Z`}
                  />
                )}
                {i % labelEvery === 0 && (
                  <>
                    <text x={x + barW / 2} y={height - 22} textAnchor="middle" className="chart-axis">
                      {d.label}
                    </text>
                    {d.sub && (
                      <text x={x + barW / 2} y={height - 8} textAnchor="middle" className="chart-axis faint">
                        {d.sub}
                      </text>
                    )}
                  </>
                )}
              </g>
            );
          })}
          {goal !== undefined && goal > 0 && (
            <g>
              <line x1={pad.left} x2={width - pad.right} y1={y(goal)} y2={y(goal)} className="chart-ref" />
              <text x={width - pad.right} y={y(goal) - 6} textAnchor="end" className="chart-axis strong">
                {goalLabel ?? 'Meta'}
              </text>
            </g>
          )}
          <line x1={pad.left} x2={width - pad.right} y1={pad.top + innerH} y2={pad.top + innerH} className="chart-baseline" />
        </svg>
        {hover !== null && (
          <div
            className="chart-tip"
            style={{
              left: Math.min(width - 140, Math.max(0, pad.left + hover * band + band / 2 - 70)),
              top: Math.max(0, y(data[hover].value) - 58),
            }}
          >
            <span>{`${data[hover].sub ?? ''} ${data[hover].label}`.trim()}</span>
            <strong>{format(data[hover].value)}</strong>
          </div>
        )}
      </div>
    </ChartFrame>
  );
}

// ── Linha (evolução do acerto semanal) ────────────────────────────────
export function LineChart({
  title,
  data,
  height = 220,
}: {
  title: string;
  data: { label: string; value: number | null; n: number }[];
  height?: number;
}) {
  const { ref, width } = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const pad = { top: 18, right: 16, bottom: 30, left: 44 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const x = (i: number) => pad.left + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
  const y = (v: number) => pad.top + innerH - v * innerH;
  const pct = (v: number) => `${Math.round(v * 100)}%`;

  // Segmentos contínuos (semanas sem respostas criam lacunas, sem interpolar dados inexistentes).
  const segments: { i: number; v: number }[][] = [];
  let cur: { i: number; v: number }[] = [];
  data.forEach((d, i) => {
    if (d.value === null) {
      if (cur.length) segments.push(cur);
      cur = [];
    } else cur.push({ i, v: d.value });
  });
  if (cur.length) segments.push(cur);

  const onMove = (e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const px = e.clientX - rect.left;
    let best = 0;
    data.forEach((_, i) => {
      if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i;
    });
    setHover(best);
  };

  return (
    <ChartFrame
      title={title}
      summary={`${title}: ${data.filter((d) => d.value !== null).map((d) => `${d.label} ${pct(d.value!)}`).join(', ') || 'sem dados'}.`}
      table={{ head: ['Semana', 'Acerto', 'Respostas'], rows: data.map((d) => [d.label, d.value === null ? '—' : pct(d.value), d.n]) }}
    >
      <div ref={ref} className="chart-canvas" onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        <svg width={width} height={height} role="img" aria-label={`${title}. Use "Ver tabela" para os valores.`}>
          {[0, 0.5, 1].map((t) => (
            <g key={t}>
              <line x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} className="chart-grid" />
              <text x={pad.left - 8} y={y(t)} dy="0.35em" textAnchor="end" className="chart-axis">
                {pct(t)}
              </text>
            </g>
          ))}
          {data.map((d, i) => (
            <text key={i} x={x(i)} y={height - 8} textAnchor="middle" className="chart-axis">
              {width < 420 && i % 2 ? '' : d.label}
            </text>
          ))}
          {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={pad.top} y2={pad.top + innerH} className="chart-cross" />}
          {segments.map((seg, k) => (
            <path key={k} className="chart-line" d={seg.map((p, j) => `${j ? 'L' : 'M'}${x(p.i)},${y(p.v)}`).join(' ')} />
          ))}
          {data.map((d, i) =>
            d.value === null ? null : (
              <circle key={i} cx={x(i)} cy={y(d.value)} r={hover === i ? 6 : 4} className="chart-dot" />
            ),
          )}
        </svg>
        {hover !== null && (
          <div className="chart-tip" style={{ left: Math.min(width - 150, Math.max(0, x(hover) - 75)), top: 0 }}>
            <span>Semana de {data[hover].label}</span>
            <strong>{data[hover].value === null ? 'Sem respostas' : `${pct(data[hover].value!)} de acerto`}</strong>
            {data[hover].n > 0 && <span>{data[hover].n} respostas</span>}
          </div>
        )}
      </div>
    </ChartFrame>
  );
}
