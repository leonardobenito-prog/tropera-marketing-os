export function money(n: number) {
  return "$" + n.toLocaleString("es-CL");
}

export function KPICard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div className="flex-1 min-w-[180px] bg-white rounded-lg p-4" style={{ border: "1px solid var(--line)", borderLeft: `3px solid ${accent || "var(--c-forest)"}` }}>
      <div className="text-[11px] tracking-wide" style={{ color: "var(--muted)" }}>{label}</div>
      <div className="text-2xl mt-1" style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}>{value}</div>
      {sub && <div className="text-xs mt-1" style={{ color: "var(--muted)" }}>{sub}</div>}
    </div>
  );
}

const TONES: Record<string, { bg: string; fg: string }> = {
  neutral: { bg: "#EEEFEA", fg: "#4B4E45" },
  success: { bg: "#E7F1EA", fg: "#2F6B45" },
  warning: { bg: "#FBF0DE", fg: "#96701F" },
  danger: { bg: "#FAE7E4", fg: "#A23B2E" },
  forest: { bg: "#E3F1EC", fg: "#2E7059" },
};

export function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: keyof typeof TONES }) {
  const t = TONES[tone] || TONES.neutral;
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium" style={{ background: t.bg, color: t.fg }}>
      {children}
    </span>
  );
}

export function ProgressBar({ pct, color }: { pct: number; color: string }) {
  const width = Math.min(pct, 1) * 100;
  return (
    <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: "#E7E5DD" }}>
      <div className="h-full rounded-full" style={{ width: `${width}%`, background: color }} />
    </div>
  );
}

// Línea de tiempo de avance — usada por Producción para mostrar en qué etapa
// del pipeline (BACKLOG -> ... -> IMPLEMENTED) está cada proyecto.
export function StatusTimeline({ stages, currentIndex }: { stages: { key: string; label: string }[]; currentIndex: number }) {
  return (
    <div className="flex items-center w-full">
      {stages.map((stage, i) => {
        const done = i < currentIndex;
        const active = i === currentIndex;
        return (
          <div key={stage.key} className="flex items-center" style={{ flex: i < stages.length - 1 ? 1 : "0 0 auto" }}>
            <div className="flex flex-col items-center" style={{ minWidth: 56 }}>
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{
                  background: done || active ? "var(--c-forest)" : "#D8D5CC",
                  boxShadow: active ? "0 0 0 3px rgba(46,112,89,0.2)" : "none",
                }}
              />
              <div className="text-[10px] mt-1 text-center leading-tight" style={{ color: active ? "var(--ink)" : "var(--muted)", fontWeight: active ? 600 : 400 }}>
                {stage.label}
              </div>
            </div>
            {i < stages.length - 1 && (
              <div className="flex-1 h-[2px] mx-1" style={{ background: done ? "var(--c-forest)" : "#D8D5CC" }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function execState(assigned: number, actual: number, committed: number) {
  const pct = assigned > 0 ? (actual + committed) / assigned : 0;
  if (pct > 1) return { pct, color: "var(--c-danger)", label: "Excedido" };
  if (pct >= 0.9) return { pct, color: "var(--c-danger)", label: "Crítico" };
  if (pct >= 0.7) return { pct, color: "var(--c-warning)", label: "Atención" };
  return { pct, color: "var(--c-success)", label: "Normal" };
}
