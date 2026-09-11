import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  createExpenseAction,
  createBudgetMatrixEntryAction, updateBudgetMatrixEntryAction, deleteBudgetMatrixEntryAction,
} from "@/lib/actions/ops";
import { KPICard, money } from "@/components/ui";
import { requireSession, canSeeAmounts } from "@/lib/permissions";
import type { Prisma, BudgetAxis } from "@prisma/client";

export const dynamic = "force-dynamic";

const AXIS_LABEL: Record<string, string> = {
  RECOGNITION: "Reconocimiento", PROMOTIONS: "Promociones", EVENTS: "Eventos", DELIVERY: "Delivery",
};
const AXIS_OPTIONS = ["RECOGNITION", "PROMOTIONS", "EVENTS", "DELIVERY"] as const;

const MONTH_LABEL = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const PROJECT_STATUS_LABEL: Record<string, string> = {
  BACKLOG: "Backlog", IN_PRODUCTION: "En producción", REVIEW: "Revisión",
  APPROVED: "Aprobado", PUBLISHED: "Publicado", IMPLEMENTED: "Implementado",
};

function SectionHeader({ title, href }: { title: string; href: string }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-lg heading-title" style={{ color: "var(--ink)" }}>{title}</h2>
      <Link href={href} className="text-xs" style={{ color: "var(--c-copper)" }}>Ver detalle →</Link>
    </div>
  );
}

// Filtro por ventana de tiempo y eje vía querystring — se usa para el desglose de gasto por local.
export default async function BudgetPage({ searchParams }: { searchParams: { from?: string; to?: string; axis?: string } }) {
  const session = await requireSession();
  const showAmounts = canSeeAmounts(session.user.role);

  const from = searchParams.from ? new Date(searchParams.from) : new Date("2026-06-01");
  const to = searchParams.to ? new Date(searchParams.to) : new Date("2026-10-15");
  const axisFilter = searchParams.axis && AXIS_OPTIONS.includes(searchParams.axis as (typeof AXIS_OPTIONS)[number]) ? searchParams.axis : "";

  const expenseAxisWhere: Prisma.ExpenseWhereInput = axisFilter
    ? { OR: [{ axis: axisFilter as BudgetAxis }, { axis: null, campaign: { axis: axisFilter as BudgetAxis } }] }
    : {};

  const [
    campaigns, businessUnits, vendors, locations, matrixEntries,
    campaignBudgets, directExpenses, filteredExpenses, tasksWithCost, projectsWithBudget,
  ] = await Promise.all([
    prisma.campaign.findMany({ orderBy: { name: "asc" } }),
    prisma.businessUnit.findMany({ orderBy: { name: "asc" } }),
    prisma.vendor.findMany({ orderBy: { name: "asc" } }),
    prisma.location.findMany({ orderBy: { name: "asc" } }),
    prisma.budgetMatrixEntry.findMany({ orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }] }),
    prisma.budget.findMany({ where: { campaignId: { not: null } }, include: { campaign: true } }),
    prisma.expense.findMany({ where: { campaignId: null } }),
    prisma.expense.findMany({
      where: { date: { gte: from, lte: to }, ...expenseAxisWhere },
      include: { location: true, campaign: true },
      orderBy: { date: "asc" },
    }),
    prisma.task.findMany({
      where: { cost: { not: null } },
      include: { assignee: true, campaign: true, productionProject: true },
      orderBy: { dueDate: "asc" },
    }),
    prisma.productionProject.findMany({
      where: { budgetAmount: { not: null } },
      include: { assignee: true, campaign: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  // Matriz presupuestaria — un solo pool general. Todo monto ingresado en Calendario/Tareas,
  // Producción o Campañas se descuenta de aquí, junto con los gastos directos (sin campaña).
  const matrixTotal = matrixEntries.reduce((s, m) => s + m.amount, 0);
  const tasksCost = tasksWithCost.reduce((s, t) => s + (t.cost ?? 0), 0);
  const productionCost = projectsWithBudget.reduce((s, p) => s + (p.budgetAmount ?? 0), 0);
  const campaignsCost = campaignBudgets.reduce((s, b) => s + b.assignedAmount, 0);
  const directActual = directExpenses.filter((e) => e.status === "PAID").reduce((s, e) => s + e.amount, 0);
  const directCommitted = directExpenses.filter((e) => e.status === "COMMITTED").reduce((s, e) => s + e.amount, 0);
  const matrixAvailable = matrixTotal - tasksCost - productionCost - campaignsCost - directActual - directCommitted;
  const fmt = (n: number) => (showAmounts ? money(n) : "•••••");

  // Campañas agrupadas — una campaña puede tener varias asignaciones (distintos años).
  const campaignBudgetMap = new Map<string, { name: string; code: string; total: number }>();
  for (const b of campaignBudgets) {
    if (!b.campaignId || !b.campaign) continue;
    const entry = campaignBudgetMap.get(b.campaignId) ?? { name: b.campaign.name, code: b.campaign.campaignCode, total: 0 };
    entry.total += b.assignedAmount;
    campaignBudgetMap.set(b.campaignId, entry);
  }
  const campaignBudgetList = Array.from(campaignBudgetMap.values()).sort((a, b) => b.total - a.total);

  // Gasto por local — a partir de los gastos ya filtrados por período + eje.
  const byLocation = new Map<string, { name: string; actual: number; committed: number }>();
  for (const e of filteredExpenses) {
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
          Hay un solo presupuesto: cada monto que ingreses en Calendario/Tareas, Producción o Campañas —o un gasto directo aquí mismo— se descuenta de este total.
        </p>
        <div className="flex gap-3 flex-wrap mb-4">
          <KPICard label="TOTAL MATRIZ" value={fmt(matrixTotal)} accent="var(--c-forest)" />
          <KPICard label="CALENDARIO" value={fmt(tasksCost)} accent="var(--c-copper)" />
          <KPICard label="PRODUCCIÓN" value={fmt(productionCost)} accent="var(--c-copper)" />
          <KPICard label="CAMPAÑAS" value={fmt(campaignsCost)} accent="var(--c-copper)" />
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

      <div>
        <SectionHeader title="Gastos asociados a Tareas del Calendario" href="/calendar" />
        <div className="flex gap-3 flex-wrap mb-3">
          <KPICard label="TOTAL" value={fmt(tasksCost)} accent="var(--c-copper)" />
          <KPICard label="TAREAS CON COSTO" value={tasksWithCost.length} accent="var(--c-forest)" />
        </div>
        <div className="bg-white rounded-lg overflow-hidden" style={{ border: "1px solid var(--line)" }}>
          {tasksWithCost.length === 0 && (
            <div className="px-4 py-3 text-sm" style={{ color: "var(--muted)" }}>Sin tareas con costo asignado.</div>
          )}
          {tasksWithCost.length > 0 && (
            <>
              <div className="grid text-[11px] px-4 py-2" style={{ gridTemplateColumns: "1.4fr 1fr 1fr 0.8fr", color: "var(--muted)", borderBottom: "1px solid var(--line)" }}>
                <div>TAREA</div><div>CONTEXTO</div><div>FECHA</div><div>COSTO</div>
              </div>
              {tasksWithCost.map((t) => (
                <div key={t.id} className="grid items-center px-4 py-3 text-sm" style={{ gridTemplateColumns: "1.4fr 1fr 1fr 0.8fr", borderBottom: "1px solid var(--line)" }}>
                  <div style={{ color: "var(--ink)" }}>{t.title}</div>
                  <div className="text-xs" style={{ color: "var(--muted)" }}>{t.campaign?.name ?? t.productionProject?.name ?? "Operativo"}</div>
                  <div className="text-xs" style={{ color: "var(--muted)" }}>{t.dueDate ? t.dueDate.toLocaleDateString("es-CL") : "Sin fecha"}</div>
                  <div style={{ color: "var(--ink)" }}>{fmt(t.cost ?? 0)}</div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      <div>
        <SectionHeader title="Gastos asociados a Producción" href="/production" />
        <div className="flex gap-3 flex-wrap mb-3">
          <KPICard label="TOTAL" value={fmt(productionCost)} accent="var(--c-copper)" />
          <KPICard label="PROYECTOS CON PRESUPUESTO" value={projectsWithBudget.length} accent="var(--c-forest)" />
        </div>
        <div className="bg-white rounded-lg overflow-hidden" style={{ border: "1px solid var(--line)" }}>
          {projectsWithBudget.length === 0 && (
            <div className="px-4 py-3 text-sm" style={{ color: "var(--muted)" }}>Sin proyectos con presupuesto asignado.</div>
          )}
          {projectsWithBudget.length > 0 && (
            <>
              <div className="grid text-[11px] px-4 py-2" style={{ gridTemplateColumns: "1.4fr 1fr 1fr 0.8fr", color: "var(--muted)", borderBottom: "1px solid var(--line)" }}>
                <div>PROYECTO</div><div>CAMPAÑA</div><div>ESTADO</div><div>PRESUPUESTO</div>
              </div>
              {projectsWithBudget.map((p) => (
                <div key={p.id} className="grid items-center px-4 py-3 text-sm" style={{ gridTemplateColumns: "1.4fr 1fr 1fr 0.8fr", borderBottom: "1px solid var(--line)" }}>
                  <div style={{ color: "var(--ink)" }}>{p.name}</div>
                  <div className="text-xs" style={{ color: "var(--muted)" }}>{p.campaign?.name ?? "Grilla RRSS"}</div>
                  <div className="text-xs" style={{ color: "var(--muted)" }}>{PROJECT_STATUS_LABEL[p.status] ?? p.status}</div>
                  <div style={{ color: "var(--ink)" }}>{fmt(p.budgetAmount ?? 0)}</div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      <div>
        <SectionHeader title="Gastos asociados a Campañas" href="/campaigns" />
        <div className="flex gap-3 flex-wrap mb-3">
          <KPICard label="TOTAL" value={fmt(campaignsCost)} accent="var(--c-copper)" />
          <KPICard label="CAMPAÑAS CON PRESUPUESTO" value={campaignBudgetList.length} accent="var(--c-forest)" />
        </div>
        <div className="bg-white rounded-lg overflow-hidden" style={{ border: "1px solid var(--line)" }}>
          {campaignBudgetList.length === 0 && (
            <div className="px-4 py-3 text-sm" style={{ color: "var(--muted)" }}>Sin campañas con presupuesto asignado.</div>
          )}
          {campaignBudgetList.length > 0 && (
            <>
              <div className="grid text-[11px] px-4 py-2" style={{ gridTemplateColumns: "1.6fr 1fr 0.8fr", color: "var(--muted)", borderBottom: "1px solid var(--line)" }}>
                <div>CAMPAÑA</div><div>ID</div><div>ASIGNADO</div>
              </div>
              {campaignBudgetList.map((c) => (
                <Link
                  key={c.code}
                  href={`/campaigns/${c.code}`}
                  className="grid items-center px-4 py-3 text-sm"
                  style={{ gridTemplateColumns: "1.6fr 1fr 0.8fr", borderBottom: "1px solid var(--line)" }}
                >
                  <div style={{ color: "var(--ink)" }}>{c.name}</div>
                  <div className="text-xs" style={{ color: "var(--muted)", fontFamily: "monospace" }}>{c.code}</div>
                  <div style={{ color: "var(--ink)" }}>{fmt(c.total)}</div>
                </Link>
              ))}
            </>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg p-4" style={{ border: "1px solid var(--line)" }}>
        <h2 className="text-lg heading-title mb-3" style={{ color: "var(--ink)" }}>Registrar gasto</h2>
        <form action={createExpenseAction} className="grid gap-3 md:grid-cols-2">
          <input type="hidden" name="redirectTo" value={redirectTo} />
          <select name="businessUnitId" className="px-3 py-2 rounded-md md:col-span-2" style={{ border: "1px solid var(--line)" }} required>
            <option value="">Unidad</option>
            {businessUnits.map((unit) => (<option key={unit.id} value={unit.id}>{unit.name}</option>))}
          </select>
          <select name="campaignId" className="px-3 py-2 rounded-md md:col-span-2" style={{ border: "1px solid var(--line)" }}>
            <option value="">Campaña (opcional — vacío = gasto directo de la matriz)</option>
            {campaigns.map((campaign) => (<option key={campaign.id} value={campaign.id}>{campaign.name}</option>))}
          </select>
          <select name="locationId" className="px-3 py-2 rounded-md" style={{ border: "1px solid var(--line)" }}>
            <option value="">Local (opcional)</option>
            {locations.map((loc) => (<option key={loc.id} value={loc.id}>{loc.name}</option>))}
          </select>
          <select name="axis" className="px-3 py-2 rounded-md" style={{ border: "1px solid var(--line)" }} defaultValue="">
            <option value="">Eje (opcional — hereda de la campaña)</option>
            {AXIS_OPTIONS.map((a) => (<option key={a} value={a}>{AXIS_LABEL[a]}</option>))}
          </select>
          <input name="category" placeholder="Categoría" className="px-3 py-2 rounded-md md:col-span-2" style={{ border: "1px solid var(--line)" }} required />
          <input type="number" name="amount" placeholder="Monto" min={1} className="px-3 py-2 rounded-md" style={{ border: "1px solid var(--line)" }} required />
          <input type="date" name="date" className="px-3 py-2 rounded-md" style={{ border: "1px solid var(--line)" }} required />
          <select name="status" className="px-3 py-2 rounded-md" style={{ border: "1px solid var(--line)" }} defaultValue="PLANNED">
            <option value="PLANNED">Planificado</option>
            <option value="COMMITTED">Comprometido</option>
            <option value="PAID">Pagado</option>
          </select>
          <select name="vendorId" className="px-3 py-2 rounded-md" style={{ border: "1px solid var(--line)" }}>
            <option value="">Proveedor (opcional)</option>
            {vendors.map((vendor) => (<option key={vendor.id} value={vendor.id}>{vendor.name}</option>))}
          </select>
          <textarea name="notes" placeholder="Notas" className="px-3 py-2 rounded-md md:col-span-2" style={{ border: "1px solid var(--line)" }} rows={2} />
          <button type="submit" className="px-4 py-2 rounded-md md:col-span-2" style={{ background: "var(--c-forest)", color: "#fff" }}>
            Guardar gasto
          </button>
        </form>
      </div>

      <div>
        <h2 className="text-lg heading-title mb-3" style={{ color: "var(--ink)" }}>Gasto por local</h2>
        <form className="flex items-center gap-2 text-xs flex-wrap mb-3" style={{ color: "var(--muted)" }}>
          Del <input type="date" name="from" defaultValue={searchParams.from ?? "2026-06-01"} className="px-2 py-1.5 rounded-md" style={{ border: "1px solid var(--line)" }} />
          al <input type="date" name="to" defaultValue={searchParams.to ?? "2026-10-15"} className="px-2 py-1.5 rounded-md" style={{ border: "1px solid var(--line)" }} />
          Eje
          <select name="axis" defaultValue={axisFilter} className="px-2 py-1.5 rounded-md" style={{ border: "1px solid var(--line)" }}>
            <option value="">Todos</option>
            {AXIS_OPTIONS.map((a) => (<option key={a} value={a}>{AXIS_LABEL[a]}</option>))}
          </select>
          <button type="submit" className="px-3 py-1.5 rounded-md" style={{ border: "1px solid var(--line)", background: "#fff", color: "var(--ink)" }}>Filtrar</button>
        </form>
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
    </div>
  );
}
