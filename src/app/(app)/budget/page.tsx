import { prisma } from "@/lib/prisma";
import {
  createBudgetAction, createExpenseAction, updateBudgetAction, deleteBudgetAction, updateExpenseAction, deleteExpenseAction,
  createBudgetMatrixEntryAction, updateBudgetMatrixEntryAction, deleteBudgetMatrixEntryAction,
} from "@/lib/actions/ops";
import { KPICard, Badge, execState, ProgressBar, money } from "@/components/ui";
import { requireSession, canSeeAmounts } from "@/lib/permissions";
import type { Prisma, BudgetAxis } from "@prisma/client";

export const dynamic = "force-dynamic";

const EXPENSE_STATUS_LABEL: Record<string, string> = { PLANNED: "Planificado", COMMITTED: "Comprometido", PAID: "Pagado" };
const EXPENSE_STATUS_TONE: Record<string, "neutral" | "warning" | "success"> = { PLANNED: "neutral", COMMITTED: "warning", PAID: "success" };

const AXIS_LABEL: Record<string, string> = {
  RECOGNITION: "Reconocimiento", PROMOTIONS: "Promociones", EVENTS: "Eventos", DELIVERY: "Delivery",
};
const AXIS_OPTIONS = ["RECOGNITION", "PROMOTIONS", "EVENTS", "DELIVERY"] as const;

const MONTH_LABEL = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

// Filtro por ventana de tiempo y eje vía querystring: /budget?from=2026-09-01&to=2026-09-09&axis=EVENTS
export default async function BudgetPage({ searchParams }: { searchParams: { from?: string; to?: string; axis?: string } }) {
  const session = await requireSession();
  const showAmounts = canSeeAmounts(session.user.role);

  const from = searchParams.from ? new Date(searchParams.from) : new Date("2026-06-01");
  const to = searchParams.to ? new Date(searchParams.to) : new Date("2026-10-15");
  const axisFilter = searchParams.axis && AXIS_OPTIONS.includes(searchParams.axis as (typeof AXIS_OPTIONS)[number]) ? searchParams.axis : "";

  const expenseAxisWhere: Prisma.ExpenseWhereInput = axisFilter
    ? { OR: [{ axis: axisFilter as BudgetAxis }, { axis: null, campaign: { axis: axisFilter as BudgetAxis } }] }
    : {};

  const [campaigns, budgets, expenses, businessUnits, vendors, locations, matrixEntries, allCampaignBudgets, directExpenses] = await Promise.all([
    prisma.campaign.findMany({
      where: {
        startDate: { lte: to },
        endDate: { gte: from },
        ...(axisFilter ? { axis: axisFilter as BudgetAxis } : {}),
      },
      include: { budgets: true, businessUnit: true },
    }),
    prisma.budget.findMany({
      include: { businessUnit: true, campaign: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.expense.findMany({
      where: { date: { gte: from, lte: to }, ...expenseAxisWhere },
      include: { businessUnit: true, location: true, campaign: true },
      orderBy: { date: "asc" },
    }),
    prisma.businessUnit.findMany({ orderBy: { name: "asc" } }),
    prisma.vendor.findMany({ orderBy: { name: "asc" } }),
    prisma.location.findMany({ orderBy: { name: "asc" } }),
    prisma.budgetMatrixEntry.findMany({ orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }] }),
    prisma.budget.findMany({ where: { campaignId: { not: null } } }),
    prisma.expense.findMany({ where: { campaignId: null } }),
  ]);

  // Matriz presupuestaria — pool general, no acotado por el rango de fechas del filtro.
  const matrixTotal = matrixEntries.reduce((s, m) => s + m.amount, 0);
  const assignedToCampaigns = allCampaignBudgets.reduce((s, b) => s + b.assignedAmount, 0);
  const directActual = directExpenses.filter((e) => e.status === "PAID").reduce((s, e) => s + e.amount, 0);
  const directCommitted = directExpenses.filter((e) => e.status === "COMMITTED").reduce((s, e) => s + e.amount, 0);
  const matrixAvailable = matrixTotal - assignedToCampaigns - directActual - directCommitted;
  const fmt = (n: number) => (showAmounts ? money(n) : "•••••");

  const assigned = campaigns.reduce((a, c) => a + c.budgets.reduce((s, b) => s + b.assignedAmount, 0), 0);
  const actual = expenses.filter((e) => e.status === "PAID").reduce((s, e) => s + e.amount, 0);
  const committed = expenses.filter((e) => e.status === "COMMITTED").reduce((s, e) => s + e.amount, 0);
  const available = assigned - actual - committed;
  const ex = execState(assigned, actual, committed);

  // Gasto por local — a partir de los gastos ya filtrados por período + eje.
  const byLocation = new Map<string, { name: string; actual: number; committed: number }>();
  for (const e of expenses) {
    const key = e.locationId ?? "__none__";
    const name = e.location?.name ?? "Sin local";
    const entry = byLocation.get(key) ?? { name, actual: 0, committed: 0 };
    if (e.status === "PAID") entry.actual += e.amount;
    if (e.status === "COMMITTED") entry.committed += e.amount;
    byLocation.set(key, entry);
  }
  const locationBreakdown = Array.from(byLocation.values())
    .filter((l) => l.actual > 0 || l.committed > 0)
    .sort((a, b) => (b.actual + b.committed) - (a.actual + a.committed));

  const qs = (overrides: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const merged = { from: searchParams.from, to: searchParams.to, axis: searchParams.axis, ...overrides };
    for (const [key, value] of Object.entries(merged)) {
      if (value) params.set(key, value);
    }
    const s = params.toString();
    return s ? `/budget?${s}` : "/budget";
  };
  const redirectTo = qs({});

  return (
    <div className="p-6 space-y-8">
      <h1 className="text-xl heading-title" style={{ color: "var(--ink)" }}>Centro de Presupuesto</h1>
      {!showAmounts && (
        <div className="text-xs px-4 py-2 rounded-lg" style={{ background: "#FBF0DE", color: "#96701F" }}>
          Tu rol (Viewer) no tiene acceso a montos detallados de presupuesto.
        </div>
      )}

      <div>
        <h2 className="text-lg heading-title mb-1" style={{ color: "var(--ink)" }}>Matriz presupuestaria</h2>
        <p className="text-xs mb-3" style={{ color: "var(--muted)" }}>
          Vista general del presupuesto total, sin dividir por unidad ni local. Cada gasto directo y cada presupuesto asignado a una campaña se descuenta de este total.
        </p>
        <div className="flex gap-3 flex-wrap mb-4">
          <KPICard label="TOTAL MATRIZ" value={fmt(matrixTotal)} accent="var(--c-forest)" />
          <KPICard label="ASIGNADO A CAMPAÑAS" value={fmt(assignedToCampaigns)} accent="var(--c-copper)" />
          <KPICard label="GASTADO DIRECTO" value={fmt(directActual)} accent="var(--c-warning)" />
          <KPICard label="COMPROMETIDO DIRECTO" value={fmt(directCommitted)} accent="var(--c-warning)" />
          <KPICard label="DISPONIBLE" value={fmt(matrixAvailable)} accent={matrixAvailable < 0 ? "var(--c-danger)" : "var(--c-success)"} />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="bg-white rounded-lg p-4" style={{ border: "1px solid var(--line)" }}>
            <h3 className="text-base heading-title mb-3" style={{ color: "var(--ink)" }}>Ingresar mes</h3>
            <form action={createBudgetMatrixEntryAction} className="grid gap-3 md:grid-cols-2">
              <input type="hidden" name="redirectTo" value={redirectTo} />
              <input type="number" name="periodYear" placeholder="Año" min={2024} defaultValue={new Date().getFullYear()} className="px-3 py-2 rounded-md" style={{ border: "1px solid var(--line)" }} required />
              <select name="periodMonth" className="px-3 py-2 rounded-md" style={{ border: "1px solid var(--line)" }} required defaultValue="">
                <option value="" disabled>Mes</option>
                {MONTH_LABEL.map((label, i) => (<option key={label} value={i + 1}>{label}</option>))}
              </select>
              <input type="number" name="amount" placeholder="Monto disponible del mes" min={0} className="px-3 py-2 rounded-md md:col-span-2" style={{ border: "1px solid var(--line)" }} required />
              <input name="notes" placeholder="Notas (opcional)" className="px-3 py-2 rounded-md md:col-span-2" style={{ border: "1px solid var(--line)" }} />
              <button type="submit" className="px-4 py-2 rounded-md md:col-span-2" style={{ background: "var(--c-forest)", color: "#fff" }}>
                Guardar mes
              </button>
            </form>
          </div>

          <div className="bg-white rounded-lg overflow-hidden" style={{ border: "1px solid var(--line)" }}>
            <div className="grid text-[11px] px-4 py-2" style={{ gridTemplateColumns: "1fr 1fr 1fr", color: "var(--muted)", borderBottom: "1px solid var(--line)" }}>
              <div>PERÍODO</div><div>MONTO</div><div></div>
            </div>
            <div className="max-h-[260px] overflow-y-auto">
              {matrixEntries.length === 0 && (
                <div className="px-4 py-3 text-sm" style={{ color: "var(--muted)" }}>Sin meses cargados aún.</div>
              )}
              {matrixEntries.map((m) => (
                <details key={m.id} className="px-4 py-2 text-sm" style={{ borderBottom: "1px solid var(--line)" }}>
                  <summary className="grid items-center cursor-pointer" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
                    <span style={{ color: "var(--ink)" }}>{MONTH_LABEL[m.periodMonth - 1]} {m.periodYear}</span>
                    <span style={{ color: "var(--ink)" }}>{fmt(m.amount)}</span>
                    <span />
                  </summary>
                  <form action={updateBudgetMatrixEntryAction} className="mt-2 grid gap-2 md:grid-cols-4">
                    <input type="hidden" name="id" value={m.id} />
                    <input type="hidden" name="redirectTo" value={redirectTo} />
                    <input type="number" name="periodYear" defaultValue={m.periodYear} className="px-2 py-1.5 rounded-md text-xs" style={{ border: "1px solid var(--line)" }} />
                    <select name="periodMonth" defaultValue={m.periodMonth} className="px-2 py-1.5 rounded-md text-xs" style={{ border: "1px solid var(--line)" }}>
                      {MONTH_LABEL.map((label, i) => (<option key={label} value={i + 1}>{label}</option>))}
                    </select>
                    <input type="number" name="amount" defaultValue={m.amount} className="px-2 py-1.5 rounded-md text-xs" style={{ border: "1px solid var(--line)" }} />
                    <button type="submit" className="px-2 py-1.5 rounded-md text-xs" style={{ background: "var(--c-forest)", color: "#fff" }}>Guardar</button>
                    <input name="notes" defaultValue={m.notes ?? ""} placeholder="Notas" className="px-2 py-1.5 rounded-md text-xs md:col-span-3" style={{ border: "1px solid var(--line)" }} />
                    <button
                      type="submit"
                      formAction={deleteBudgetMatrixEntryAction}
                      className="text-[11px] px-2 py-1.5 rounded-md"
                      style={{ border: "1px solid var(--line)", background: "#fff", color: "var(--c-danger)" }}
                    >
                      Borrar
                    </button>
                  </form>
                </details>
              ))}
            </div>
          </div>
        </div>
      </div>

      <form className="flex items-center gap-2 text-xs flex-wrap" style={{ color: "var(--muted)" }}>
        Del <input type="date" name="from" defaultValue={searchParams.from ?? "2026-06-01"} className="px-2 py-1.5 rounded-md" style={{ border: "1px solid var(--line)" }} />
        al <input type="date" name="to" defaultValue={searchParams.to ?? "2026-10-15"} className="px-2 py-1.5 rounded-md" style={{ border: "1px solid var(--line)" }} />
        Eje
        <select name="axis" defaultValue={axisFilter} className="px-2 py-1.5 rounded-md" style={{ border: "1px solid var(--line)" }}>
          <option value="">Todos</option>
          {AXIS_OPTIONS.map((a) => (<option key={a} value={a}>{AXIS_LABEL[a]}</option>))}
        </select>
        <button type="submit" className="px-3 py-1.5 rounded-md" style={{ border: "1px solid var(--line)", background: "#fff", color: "var(--ink)" }}>Filtrar</button>
      </form>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="bg-white rounded-lg p-4" style={{ border: "1px solid var(--line)" }}>
          <h2 className="text-lg heading-title mb-3" style={{ color: "var(--ink)" }}>Asignar presupuesto a campaña</h2>
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
            <p className="text-xs" style={{ color: "var(--muted)" }}>El eje de la campaña se define al crearla o editarla en el módulo de Campañas.</p>
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
              <option value="">Campaña (opcional — vacío = gasto directo de la matriz)</option>
              {campaigns.map((campaign) => (<option key={campaign.id} value={campaign.id}>{campaign.name}</option>))}
            </select>
            <div className="grid gap-3 md:grid-cols-2">
              <select name="locationId" className="px-3 py-2 rounded-md" style={{ border: "1px solid var(--line)" }}>
                <option value="">Local (opcional)</option>
                {locations.map((loc) => (<option key={loc.id} value={loc.id}>{loc.name}</option>))}
              </select>
              <select name="axis" className="px-3 py-2 rounded-md" style={{ border: "1px solid var(--line)" }} defaultValue="">
                <option value="">Eje (opcional — hereda de la campaña)</option>
                {AXIS_OPTIONS.map((a) => (<option key={a} value={a}>{AXIS_LABEL[a]}</option>))}
              </select>
            </div>
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

      <div>
        <h2 className="text-lg heading-title mb-3" style={{ color: "var(--ink)" }}>Ejecución de campañas en el período</h2>
        <div className="flex gap-3 flex-wrap">
          <KPICard label="ASIGNADO" value={fmt(assigned)} accent="var(--c-forest)" />
          <KPICard label="GASTADO" value={fmt(actual)} accent="var(--c-copper)" />
          <KPICard label="COMPROMETIDO" value={fmt(committed)} accent="var(--c-warning)" />
          <KPICard label="DISPONIBLE" value={fmt(available)} accent="var(--c-success)" />
        </div>
        <div className="mt-3">
          <ProgressBar pct={ex.pct} color={ex.color} />
        </div>
      </div>

      <div>
        <h2 className="text-lg heading-title mb-3" style={{ color: "var(--ink)" }}>Gasto por local</h2>
        <div className="bg-white rounded-lg overflow-hidden" style={{ border: "1px solid var(--line)" }}>
          <div className="grid text-[11px] px-4 py-2" style={{ gridTemplateColumns: "1.5fr 1fr 1fr 1fr", color: "var(--muted)", borderBottom: "1px solid var(--line)" }}>
            <div>LOCAL</div><div>GASTADO</div><div>COMPROMETIDO</div><div>TOTAL</div>
          </div>
          {locationBreakdown.length === 0 && (
            <div className="px-4 py-3 text-sm" style={{ color: "var(--muted)" }}>Sin gastos en el período/eje seleccionado.</div>
          )}
          {locationBreakdown.map((l) => (
            <div key={l.name} className="grid items-center px-4 py-3 text-sm" style={{ gridTemplateColumns: "1.5fr 1fr 1fr 1fr", borderBottom: "1px solid var(--line)" }}>
              <div style={{ color: "var(--ink)" }}>{l.name}</div>
              <div style={{ color: "var(--ink)" }}>{fmt(l.actual)}</div>
              <div style={{ color: "var(--muted)" }}>{fmt(l.committed)}</div>
              <div style={{ color: "var(--ink)" }}>{fmt(l.actual + l.committed)}</div>
            </div>
          ))}
        </div>
      </div>

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
          <div className="grid text-[11px] px-4 py-2" style={{ gridTemplateColumns: "0.7fr 1fr 0.9fr 0.9fr 0.8fr 0.8fr", color: "var(--muted)", borderBottom: "1px solid var(--line)" }}>
            <div>FECHA</div><div>CATEGORÍA</div><div>LOCAL</div><div>EJE</div><div>MONTO</div><div>ESTADO</div>
          </div>
          {expenses.map((e) => (
            <div key={e.id} className="px-4 py-3 text-sm" style={{ borderBottom: "1px solid var(--line)" }}>
              <div className="grid items-center gap-2" style={{ gridTemplateColumns: "0.7fr 1fr 0.9fr 0.9fr 0.8fr 0.8fr auto" }}>
                <div style={{ color: "var(--muted)" }}>{e.date.toLocaleDateString("es-CL")}</div>
                <div style={{ color: "var(--ink)" }}>{e.category}</div>
                <div className="text-xs" style={{ color: "var(--muted)" }}>{e.location?.name ?? "—"}</div>
                <div className="text-xs" style={{ color: "var(--muted)" }}>{AXIS_LABEL[e.axis ?? e.campaign?.axis ?? ""] ?? "—"}</div>
                <div style={{ color: "var(--ink)" }}>{fmt(e.amount)}</div>
                <div><Badge tone={EXPENSE_STATUS_TONE[e.status]}>{EXPENSE_STATUS_LABEL[e.status]}</Badge></div>
                <form action={deleteExpenseAction}>
                  <input type="hidden" name="id" value={e.id} />
                  <input type="hidden" name="redirectTo" value={redirectTo} />
                  <button type="submit" className="text-[11px] px-2 py-1 rounded-md" style={{ border: "1px solid var(--line)", background: "#fff", color: "var(--c-danger)" }}>Borrar</button>
                </form>
              </div>

              <form action={updateExpenseAction} className="mt-3 grid gap-2 md:grid-cols-6" style={{ borderTop: "1px solid var(--line)", paddingTop: "0.75rem" }}>
                <input type="hidden" name="id" value={e.id} />
                <input type="hidden" name="redirectTo" value={redirectTo} />
                <input type="date" name="date" defaultValue={new Date(e.date).toISOString().slice(0, 10)} className="px-2 py-1.5 rounded-md text-xs" style={{ border: "1px solid var(--line)" }} />
                <input name="category" defaultValue={e.category} className="px-2 py-1.5 rounded-md text-xs" style={{ border: "1px solid var(--line)" }} />
                <select name="locationId" defaultValue={e.locationId ?? ""} className="px-2 py-1.5 rounded-md text-xs" style={{ border: "1px solid var(--line)" }}>
                  <option value="">Sin local</option>
                  {locations.map((loc) => (<option key={loc.id} value={loc.id}>{loc.name}</option>))}
                </select>
                <select name="axis" defaultValue={e.axis ?? ""} className="px-2 py-1.5 rounded-md text-xs" style={{ border: "1px solid var(--line)" }}>
                  <option value="">Sin eje / hereda</option>
                  {AXIS_OPTIONS.map((a) => (<option key={a} value={a}>{AXIS_LABEL[a]}</option>))}
                </select>
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
                <textarea name="notes" defaultValue={e.notes ?? ""} className="px-2 py-1.5 rounded-md text-xs md:col-span-6" style={{ border: "1px solid var(--line)" }} rows={2} />
                <button type="submit" className="px-3 py-1.5 rounded-md md:col-span-6" style={{ background: "var(--c-forest)", color: "#fff" }}>
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
