import { prisma } from "@/lib/prisma";
import { KPICard, Badge, execState, ProgressBar, money } from "@/components/ui";
import { requireSession, canSeeAmounts } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const EXPENSE_STATUS_LABEL: Record<string, string> = { PLANNED: "Planificado", COMMITTED: "Comprometido", PAID: "Pagado" };
const EXPENSE_STATUS_TONE: Record<string, "neutral" | "warning" | "success"> = { PLANNED: "neutral", COMMITTED: "warning", PAID: "success" };

// Filtro por ventana de tiempo vía querystring: /budget?from=2026-09-01&to=2026-09-09
export default async function BudgetPage({ searchParams }: { searchParams: { from?: string; to?: string } }) {
  const session = await requireSession();
  const showAmounts = canSeeAmounts(session.user.role); // Viewer ve el resto de la pantalla, pero no los montos (§6)

  const from = searchParams.from ? new Date(searchParams.from) : new Date("2026-06-01");
  const to = searchParams.to ? new Date(searchParams.to) : new Date("2026-10-15");

  const campaigns = await prisma.campaign.findMany({
    where: { startDate: { lte: to }, endDate: { gte: from } },
    include: { budgets: true, businessUnit: true },
  });
  const expenses = await prisma.expense.findMany({
    where: { date: { gte: from, lte: to } },
    include: { businessUnit: true },
    orderBy: { date: "asc" },
  });

  const assigned = campaigns.reduce((a, c) => a + c.budgets.reduce((s, b) => s + b.assignedAmount, 0), 0);
  const actual = expenses.filter((e) => e.status === "PAID").reduce((s, e) => s + e.amount, 0);
  const committed = expenses.filter((e) => e.status === "COMMITTED").reduce((s, e) => s + e.amount, 0);
  const available = assigned - actual - committed;
  const ex = execState(assigned, actual, committed);
  const fmt = (n: number) => (showAmounts ? money(n) : "•••••");

  return (
    <div className="p-6 space-y-8">
      <h1 className="text-xl heading-title" style={{ color: "var(--ink)" }}>Centro de Presupuesto</h1>
      {!showAmounts && (
        <div className="text-xs px-4 py-2 rounded-lg" style={{ background: "#FBF0DE", color: "#96701F" }}>
          Tu rol (Viewer) no tiene acceso a montos detallados de presupuesto.
        </div>
      )}

      <form className="flex items-center gap-2 text-xs" style={{ color: "var(--muted)" }}>
        Del <input type="date" name="from" defaultValue={searchParams.from ?? "2026-06-01"} className="px-2 py-1.5 rounded-md" style={{ border: "1px solid var(--line)" }} />
        al <input type="date" name="to" defaultValue={searchParams.to ?? "2026-10-15"} className="px-2 py-1.5 rounded-md" style={{ border: "1px solid var(--line)" }} />
        <button type="submit" className="px-3 py-1.5 rounded-md" style={{ border: "1px solid var(--line)", background: "#fff", color: "var(--ink)" }}>Filtrar</button>
      </form>

      <div className="flex gap-3 flex-wrap">
        <KPICard label="ASIGNADO" value={fmt(assigned)} accent="var(--c-forest)" />
        <KPICard label="GASTADO" value={fmt(actual)} accent="var(--c-copper)" />
        <KPICard label="COMPROMETIDO" value={fmt(committed)} accent="var(--c-warning)" />
        <KPICard label="DISPONIBLE" value={fmt(available)} accent="var(--c-success)" />
      </div>
      <ProgressBar pct={ex.pct} color={ex.color} />

      <div>
        <h2 className="text-lg heading-title mb-3" style={{ color: "var(--ink)" }}>Gastos en el período</h2>
        <div className="bg-white rounded-lg overflow-hidden" style={{ border: "1px solid var(--line)" }}>
          <div className="grid text-[11px] px-4 py-2" style={{ gridTemplateColumns: "0.8fr 1.2fr 1fr 0.9fr", color: "var(--muted)", borderBottom: "1px solid var(--line)" }}>
            <div>FECHA</div><div>CATEGORÍA</div><div>MONTO</div><div>ESTADO</div>
          </div>
          {expenses.map((e) => (
            <div key={e.id} className="grid items-center px-4 py-3 text-sm" style={{ gridTemplateColumns: "0.8fr 1.2fr 1fr 0.9fr", borderBottom: "1px solid var(--line)" }}>
              <div style={{ color: "var(--muted)" }}>{e.date.toLocaleDateString("es-CL")}</div>
              <div style={{ color: "var(--ink)" }}>{e.category}</div>
              <div style={{ color: "var(--ink)" }}>{fmt(e.amount)}</div>
              <div><Badge tone={EXPENSE_STATUS_TONE[e.status]}>{EXPENSE_STATUS_LABEL[e.status]}</Badge></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
