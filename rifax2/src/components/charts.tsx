// Gráficas SVG server-side (sin librerías de cliente).

export function BarChart({
  data,
  format = (n) => String(n),
  color = "#4f46e5",
}: {
  data: { label: string; value: number }[];
  format?: (n: number) => string;
  color?: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="space-y-2.5">
      {data.map((d) => (
        <div key={d.label} className="text-sm">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-slate-600 dark:text-slate-300">{d.label}</span>
            <span className="font-medium tabular-nums text-slate-900 dark:text-slate-100">{format(d.value)}</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div className="h-full rounded-full" style={{ width: `${(d.value / max) * 100}%`, backgroundColor: color }} />
          </div>
        </div>
      ))}
      {data.length === 0 ? <p className="text-sm text-slate-400">Sin datos.</p> : null}
    </div>
  );
}

export function Donut({ data, size = 160 }: { data: { label: string; value: number; color: string }[]; size?: number }) {
  const total = data.reduce((a, d) => a + d.value, 0);
  const r = size / 2 - 14;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="flex items-center gap-5">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth="14" className="text-slate-100 dark:text-slate-800" />
        {total > 0
          ? data.map((d) => {
              const frac = d.value / total;
              const seg = (
                <circle
                  key={d.label}
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  fill="none"
                  stroke={d.color}
                  strokeWidth="14"
                  strokeDasharray={`${frac * c} ${c}`}
                  strokeDashoffset={-offset}
                />
              );
              offset += frac * c;
              return seg;
            })
          : null}
      </svg>
      <ul className="space-y-1.5 text-sm">
        {data.map((d) => (
          <li key={d.label} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: d.color }} />
            <span className="text-slate-600 dark:text-slate-300">{d.label}</span>
            <span className="ml-auto font-medium tabular-nums text-slate-900 dark:text-slate-100">{d.value.toLocaleString("es-CO")}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
