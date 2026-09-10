import { prisma } from "@/lib/prisma";
import { createBudgetAction, createExpenseAction, updateBudgetAction, deleteBudgetAction, updateExpenseAction, deleteExpenseAction } from "@/lib/actions/ops";
import { KPICard, Badge, execState, ProgressBar, money } from "@/components/ui";
import { requireSession, canSeeAmounts } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const EXPENSE_STATUS_LABEL: Record<string, string> = { PLANNED: "Planificado", COMMITTED: "Comprometido", PAID: "Pagado" };
const EXPENSE_STATUS_TONE: Record<string, "neutral" | "warning" | "success"> = { PLANNED: "neutral", COMMITTED: "warning", PAID: "success" };

// Filtro por ventana de tiempo vía querystring: /budget?from=2026-09-01&to=2026-09-09
export default async function BudgetPage({ searchParams }: { searchParams: { from?: string; to?: string } }) {
  const session = await requireSession();
  const showAmounts = canSeeAmounts(session.user.role);

  const from = searchParams.from ? new Date(searchParams.from) : new Date("2026-06-01");
  const to = searchParams.to ? new Date(searchParams.to) : new Date("2026-10-15");

  const [campaigns, budgets, expenses, businessUnits, vendors] = await Promise.all([
    prisma.campaign.findMany({
      where: { startDate: { lte: to }, endDate: { gte: from } },
      include: { budgets: true, businessUnit: true },
    }),
    prisma.budget.findMany({
      include: { businessUnit: true, campaign: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.expense.findMany({
      where: { date: { gte: from, lte: to } },
      include: { businessUnit: true },
      orderBy: { date: "asc" },
    }),
    prisma.businessUnit.findMany({ orderBy: { name: "asc" } }),
    prisma.vendor.findMany({ orderBy: { name: "asc" } }),
  ]);

  const assigned = campaigns.reduce((a, c) => a + c.budgets.reduce((s, b) => s + b.assignedAmount, 0), 0);
  const actual = expenses.filter((e) => e.status === "PAID").reduce((s, e) => s + e.amount, 0);
  const committed = expenses.filter((e) => e.status === "COMMITTED").reduce((s, e) => s + e.amount, 0);
  const available = assigned - actual - committed;
  const ex = execState(assigned, actual, committed);
  const fmt = (n: number) => (showAmounts ? money(n) : "•••••");

  const redirectTo = searchParams.from || searchParams.to
    ? `/budget?${searchParams.from ? `from=${searchParams.from}` : ""}${searchParams.from && searchParams.to ? "&" : ""}${searchParams.to ? `to=${searchParams.to}` : ""}`
    : "/budget";

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

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="bg-white rounded-lg p-4" style={{ border: "1px solid var(--line)" }}>
          <h2 className="text-lg heading-title mb-3" style={{ color: "var(--ink)" }}>Crear presupuesto</h2>
          <form action={createBudgetAction} className="grid gap-3">
            <input type="hidden" name="redirectTo" value={redirectTo} />
            <select name="businessUnitId" className="px-3 py-2 rounded-md" style={{ border: "1px solid var(--line)" }} required>
              <option value="">Unidad</option>
              {businessUnits.map((unit) => (<option key={unit.id} value={unit.id}>{unit.name}</option>))}
            </select>
            <select name="campaignId" className="px-3 py-2 rounded-md" style={{ border: "1px solid var(--line)" }}>
              <option value="">Campaña (opcional)</option>
              {campaigns.map((campaign) => (<option key={campaign.id} value={campaign.id}>{campaign.name}</option>))}
            </select>
            <input type="number" name="periodYear" placeholder="Año" min={2024} className="px-3 py-2 rounded-md" style={{ border: "1px solid var(--line)" }} required />
            <input type="number" name="assignedAmount" placeholder="Monto asignado" min={0} className="px-3 py-2 rounded-md" style={{ border: "1px solid var(--line)" }} required />
            <button type="submit" className="px-4 py-2 rounded-md" style={{ background: "var(--c-forest)", color: "#fff" }}>
              Guardar presupuesto
            </button>
          </form>
        </div>

        <div className="bg-white rounded-lg p-4" style={{ border: "1px solid var(--line)" }}>
          <h2 className="text-lg heading-title mb-3" style={{ color: "var(--ink)" }}>Registrar gasto</h2>
          <form action={createExpenseAction} className="grid gap-3">
            <input type="hidden" name="redirectTo" value={redirectTo} />
            <select name="businessUnitId" className="px-3 py-2 rounded-md" style={{ border: "1px solid var(--line)" }} required>
              <option value="">Unidad</option>
              {businessUnits.map((unit) => (<option key={unit.id} value={unit.id}>{unit.name}</option>))}
            </select>
            <select name="campaignId" className="px-3 py-2 rounded-md" style={{ border: "1px solid var(--line)" }}>
              <option value="">Campaña (opcional)</option>
              {campaigns.map((campaign) => (<option key={campaign.id} value={campaign.id}>{campaign.name}</option>))}
            </select>
            <input name="category" placeholder="Categoría" className="px-3 py-2 rounded-md" style={{ border: "1px solid var(--line)" }} required />
            <div className="grid gap-3 md:grid-cols-2">
              <input type="number" name="amount" placeholder="Monto" min={1} className="px-3 py-2 rounded-md" style={{ border: "1px solid var(--line)" }} required />
              <input type="date" name="date" className="px-3 py-2 rounded-md" style={{ border: "1px solid var(--line)" }} required />
            </div>
            <select name="status" className="px-3 py-2 rounded-md" style={{ border: "1px solid var(--line)" }} defaultValue="PLANNED">
              <option value="PLANNED">Planificado</option>
              <option value="COMMITTED">Comprometido</option>
              <option value="PAID">Pagado</option>
            </select>
            <select name="vendorId" className="px-3 py-2 rounded-md" style={{ border: "1px solid var(--line)" }}>
              <option value="">Proveedor (opcional)</option>
              {vendors.map((vendor) => (<option key={vendor.id} value={vendor.id}>{vendor.name}</option>))}
            </select>
            <textarea name="notes" placeholder="Notas" className="px-3 py-2 rounded-md" style={{ border: "1px solid var(--line)" }} rows={2} />
            <button type="submit" className="px-4 py-2 rounded-md" style={{ background: "var(--c-forest)", color: "#fff" }}>
              Guardar gasto
            </button>
          </form>
        </div>
      </div>

      <div className="flex gap-3 flex-wrap">
        <KPICard label="ASIGNADO" value={fmt(assigned)} accent="var(--c-forest)" />
        <KPICard label="GASTADO" value={fmt(actual)} accent="var(--c-copper)" />
        <KPICard label="COMPROMETIDO" value={fmt(committed)} accent="var(--c-warning)" />
        <KPICard label="DISPONIBLE" value={fmt(available)} accent="var(--c-success)" />
      </div>
      <ProgressBar pct={ex.pct} color={ex.color} />

      <div className="bg-white rounded-lg p-4" style={{ border: "1px solid var(--line)" }}>
        <h2 className="text-lg heading-title mb-3" style={{ color: "var(--ink)" }}>Presupuestos en el período</h2>
        <div className="space-y-3">
          {budgets.map((budget) => (
            <div key={budget.id} className="rounded-lg p-3" style={{ background: "#F7F5F0" }}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm" style={{ color: "var(--ink)" }}>{budget.businessUnit.name}</div>
                  <div className="text-xs" style={{ color: "var(--muted)" }}>{budget.campaign?.name ?? "Sin campaña"}</div>
                </div>
                <form action={deleteBudgetAction} className="inline-block">
                  <input type="hidden" name="id" value={budget.id} />
                  <input type="hidden" name="redirectTo" value={redirectTo} />
                  <button type="submit" className="text-[11px] px-2 py-1 rounded-md" style={{ border: "1px solid var(--line)", background: "#fff", color: "var(--c-danger)" }}>Borrar</button>
                </form>
              </div>
              <form action={updateBudgetAction} className="mt-3 grid gap-2 md:grid-cols-4">
                <input type="hidden" name="id" value={budget.id} />
                <input type="hidden" name="redirectTo" value={redirectTo} />
                <select name="businessUnitId" defaultValue={budget.businessUnitId} className="px-2 py-1.5 rounded-md text-xs" style={{ border: "1px solid var(--line)" }}>
                  {businessUnits.map((unit) => (<option key={unit.id} value={unit.id}>{unit.name}</option>))}
                </select>
                <select name="campaignId" defaultValue={budget.campaignId ?? ""} className="px-2 py-1.5 rounded-md text-xs" style={{ border: "1px solid var(--line)" }}>
                  <option value="">Sin campaña</option>
                  {campaigns.map((campaign) => (<option key={campaign.id} value={campaign.id}>{campaign.name}</option>))}
                </select>
                <input type="number" name="periodYear" defaultValue={budget.periodYear} className="px-2 py-1.5 rounded-md text-xs" style={{ border: "1px solid var(--line)" }} />
                <input type="number" name="assignedAmount" defaultValue={budget.assignedAmount} className="px-2 py-1.5 rounded-md text-xs" style={{ border: "1px solid var(--line)" }} />
                <button type="submit" className="px-3 py-1.5 rounded-md md:col-span-4" style={{ background: "var(--c-forest)", color: "#fff" }}>Guardar presupuesto</button>
              </form>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-lg heading-title mb-3" style={{ color: "var(--ink)" }}>Gastos en el período</h2>
        <div className="bg-white rounded-lg overflow-hidden" style={{ border: "1px solid var(--line)" }}>
          <div className="grid text-[11px] px-4 py-2" style={{ gridTemplateColumns: "0.8fr 1.2fr 1fr 0.9fr", color: "var(--muted)", borderBottom: "1px solid var(--line)" }}>
            <div>FECHA</div><div>CATEGORÍA</div><div>MONTO</div><div>ESTADO</div>
          </div>
          {expenses.map((e) => (
            <div key={e.id} className="px-4 py-3 text-sm" style={{ borderBottom: "1px solid var(--line)" }}>
              <div className="grid items-center gap-2" style={{ gridTemplateColumns: "0.8fr 1.2fr 1fr 0.9fr auto" }}>
                <div style={{ color: "var(--muted)" }}>{e.date.toLocaleDateString("es-CL")}</div>
                <div style={{ color: "var(--ink)" }}>{e.category}</div>
                <div style={{ color: "var(--ink)" }}>{fmt(e.amount)}</div>
                <div><Badge tone={EXPENSE_STATUS_TONE[e.status]}>{EXPENSE_STATUS_LABEL[e.status]}</Badge></div>
                <form action={deleteExpenseAction}>
                  <input type="hidden" name="id" value={e.id} />
                  <input type="hidden" name="redirectTo" value={redirectTo} />
                  <button type="submit" className="text-[11px] px-2 py-1 rounded-md" style={{ border: "1px solid var(--line)", background: "#fff", color: "var(--c-danger)" }}>Borrar</button>
                </form>
              </div>

              <form action={updateExpenseAction} className="mt-3 grid gap-2 md:grid-cols-5" style={{ borderTop: "1px solid var(--line)", paddingTop: "0.75rem" }}>
                <input type="hidden" name="id" value={e.id} />
                <input type="hidden" name="redirectTo" value={redirectTo} />
                <input type="date" name="date" defaultValue={new Date(e.date).toISOString().slice(0, 10)} className="px-2 py-1.5 rounded-md text-xs" style={{ border: "1px solid var(--line)" }} />
                <input name="category" defaultValue={e.category} className="px-2 py-1.5 rounded-md text-xs" style={{ border: "1px solid var(--line)" }} />
                <input type="number" name="amount" defaultValue={e.amount} className="px-2 py-1.5 rounded-md text-xs" style={{ border: "1px solid var(--line)" }} />
                <select name="status" defaultValue={e.status} className="px-2 py-1.5 rounded-md text-xs" style={{ border: "1px solid var(--line)" }}>
                  <option value="PLANNED">Planificado</option>
                  <option value="COMMITTED">Comprometido</option>
                  <option value="PAID">Pagado</option>
                </select>
                <input type="hidden" name="businessUnitId" value={e.businessUnitId} />
                <input type="hidden" name="campaignId" value={e.campaignId ?? ""} />
                <input type="hidden" name="budgetId" value={e.budgetId ?? ""} />
                <input type="hidden" name="vendorId" value={e.vendorId ?? ""} />
                <textarea name="notes" defaultValue={e.notes ?? ""} className="px-2 py-1.5 rounded-md text-xs md:col-span-5" style={{ border: "1px solid var(--line)" }} rows={2} />
                <button type="submit" className="px-3 py-1.5 rounded-md md:col-span-5" style={{ background: "var(--c-forest)", color: "#fff" }}>
                  Guardar gasto
                </button>
              </form>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
