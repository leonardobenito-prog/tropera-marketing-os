import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { createCampaignAction, updateCampaignAction, deleteCampaignAction, createBudgetAction, deleteBudgetAction } from "@/lib/actions/ops";
import { Badge, ProgressBar, execState, money } from "@/components/ui";
import type { Prisma, CampaignMediaType } from "@prisma/client";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Activa", IN_PRODUCTION: "En producción", COMPLETED: "Finalizada",
  DRAFT: "Borrador", PAUSED: "Pausada", CANCELLED: "Cancelada",
};
const STATUS_TONE: Record<string, "success" | "warning" | "neutral"> = {
  ACTIVE: "success", COMPLETED: "success", DRAFT: "neutral", PAUSED: "warning", CANCELLED: "neutral",
};

const AXIS_LABEL: Record<string, string> = {
  RECOGNITION: "Reconocimiento", PROMOTIONS: "Promociones", EVENTS: "Eventos", DELIVERY: "Delivery",
};

const MEDIA_TYPE_LABEL: Record<string, string> = { DIGITAL: "Digital", ANALOG: "Análoga" };
const MEDIA_TYPE_TONE: Record<string, "forest" | "warning"> = { DIGITAL: "forest", ANALOG: "warning" };
const MEDIA_TYPE_OPTIONS = ["DIGITAL", "ANALOG"] as const;

// Filtro por ventana de tiempo y tipo de medio vía querystring: /campaigns?from=2026-09-01&to=2026-09-30&mediaType=DIGITAL
export default async function CampaignsPage({ searchParams }: { searchParams: { from?: string; to?: string; mediaType?: string } }) {
  const from = searchParams.from ? new Date(searchParams.from) : null;
  const to = searchParams.to ? new Date(searchParams.to) : null;
  const mediaTypeFilter = MEDIA_TYPE_OPTIONS.includes(searchParams.mediaType as (typeof MEDIA_TYPE_OPTIONS)[number]) ? searchParams.mediaType : "";

  const where: Prisma.CampaignWhereInput = {
    ...(from ? { endDate: { gte: from } } : {}),
    ...(to ? { startDate: { lte: to } } : {}),
    ...(mediaTypeFilter ? { mediaType: mediaTypeFilter as CampaignMediaType } : {}),
  };

  const [campaigns, businessUnits, users] = await Promise.all([
    prisma.campaign.findMany({
      where,
      include: { businessUnit: true, budgets: true, expenses: true },
      orderBy: { startDate: "desc" },
    }),
    prisma.businessUnit.findMany({ orderBy: { name: "asc" } }),
    prisma.user.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="p-6 space-y-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl heading-title" style={{ color: "var(--ink)" }}>Campañas</h1>
      </div>

      <form className="flex items-center gap-2 text-xs flex-wrap" style={{ color: "var(--muted)" }}>
        Del <input type="date" name="from" defaultValue={searchParams.from ?? ""} className="px-2 py-1.5 rounded-md" style={{ border: "1px solid var(--line)" }} />
        al <input type="date" name="to" defaultValue={searchParams.to ?? ""} className="px-2 py-1.5 rounded-md" style={{ border: "1px solid var(--line)" }} />
        Tipo
        <select name="mediaType" defaultValue={mediaTypeFilter} className="px-2 py-1.5 rounded-md" style={{ border: "1px solid var(--line)" }}>
          <option value="">Todos</option>
          {MEDIA_TYPE_OPTIONS.map((m) => (<option key={m} value={m}>{MEDIA_TYPE_LABEL[m]}</option>))}
        </select>
        <button type="submit" className="px-3 py-1.5 rounded-md" style={{ border: "1px solid var(--line)", background: "#fff", color: "var(--ink)" }}>Filtrar</button>
        {(searchParams.from || searchParams.to || mediaTypeFilter) && (
          <Link href="/campaigns" className="px-3 py-1.5 rounded-md" style={{ border: "1px solid var(--line)", background: "#fff", color: "var(--muted)" }}>Limpiar</Link>
        )}
      </form>

      <div className="bg-white rounded-lg p-4" style={{ border: "1px solid var(--line)" }}>
        <h2 className="text-lg heading-title mb-3" style={{ color: "var(--ink)" }}>Crear campaña</h2>
        <form action={createCampaignAction} className="grid gap-3 md:grid-cols-2">
          <input type="hidden" name="redirectTo" value="/campaigns" />
          <input name="name" placeholder="Nombre" className="px-3 py-2 rounded-md" style={{ border: "1px solid var(--line)" }} required />
          <input name="campaignCode" placeholder="Código (TRP-2026-0001)" className="px-3 py-2 rounded-md" style={{ border: "1px solid var(--line)" }} required />
          <select name="businessUnitId" className="px-3 py-2 rounded-md" style={{ border: "1px solid var(--line)" }} required>
            <option value="">Unidad de negocio</option>
            {businessUnits.map((unit) => (
              <option key={unit.id} value={unit.id}>{unit.name}</option>
            ))}
          </select>
          <select name="ownerId" className="px-3 py-2 rounded-md" style={{ border: "1px solid var(--line)" }}>
            <option value="">Responsable</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>{user.name}</option>
            ))}
          </select>
          <input type="date" name="startDate" className="px-3 py-2 rounded-md" style={{ border: "1px solid var(--line)" }} required />
          <input type="date" name="endDate" className="px-3 py-2 rounded-md" style={{ border: "1px solid var(--line)" }} required />
          <select name="axis" className="px-3 py-2 rounded-md" style={{ border: "1px solid var(--line)" }} defaultValue="">
            <option value="">Eje (opcional)</option>
            <option value="RECOGNITION">Reconocimiento</option>
            <option value="PROMOTIONS">Promociones</option>
            <option value="EVENTS">Eventos</option>
            <option value="DELIVERY">Delivery</option>
          </select>
          <select name="mediaType" className="px-3 py-2 rounded-md" style={{ border: "1px solid var(--line)" }} defaultValue="">
            <option value="">Digital o Análoga (opcional)</option>
            {MEDIA_TYPE_OPTIONS.map((m) => (<option key={m} value={m}>{MEDIA_TYPE_LABEL[m]}</option>))}
          </select>
          <input type="number" name="periodYear" placeholder="Año del presupuesto" min={2024} defaultValue={new Date().getFullYear()} className="px-3 py-2 rounded-md" style={{ border: "1px solid var(--line)" }} />
          <input type="number" name="assignedAmount" placeholder="Presupuesto a asignar (opcional)" min={0} className="px-3 py-2 rounded-md" style={{ border: "1px solid var(--line)" }} />
          <textarea name="objective" placeholder="Objetivo" className="px-3 py-2 rounded-md md:col-span-2" style={{ border: "1px solid var(--line)" }} rows={3} />
          <select name="status" className="px-3 py-2 rounded-md md:col-span-2" style={{ border: "1px solid var(--line)" }} defaultValue="DRAFT">
            <option value="DRAFT">Borrador</option>
            <option value="ACTIVE">Activa</option>
            <option value="PAUSED">Pausada</option>
            <option value="COMPLETED">Finalizada</option>
            <option value="CANCELLED">Cancelada</option>
          </select>
          <button type="submit" className="px-4 py-2 rounded-md md:col-span-2" style={{ background: "var(--c-forest)", color: "#fff" }}>
            Guardar campaña
          </button>
        </form>
      </div>

      <div className="bg-white rounded-lg overflow-hidden" style={{ border: "1px solid var(--line)" }}>
        <div className="grid text-[11px] px-4 py-2" style={{ gridTemplateColumns: "1.3fr 1fr 0.8fr 0.8fr 1fr 1.3fr 0.8fr", color: "var(--muted)", borderBottom: "1px solid var(--line)" }}>
          <div>CAMPAÑA</div><div>UNIDAD</div><div>EJE</div><div>MEDIO</div><div>ESTADO</div><div>EJECUCIÓN</div><div>ID</div>
        </div>
        {campaigns.length === 0 && (
          <div className="px-4 py-3 text-sm" style={{ color: "var(--muted)" }}>Sin campañas en este filtro.</div>
        )}
        {campaigns.map((c) => {
          const assigned = c.budgets.reduce((s, b) => s + b.assignedAmount, 0);
          const actual = c.expenses.filter((e) => e.status === "PAID").reduce((s, e) => s + e.amount, 0);
          const committed = c.expenses.filter((e) => e.status === "COMMITTED").reduce((s, e) => s + e.amount, 0);
          const ex = execState(assigned, actual, committed);
          return (
            <div key={c.id} className="px-4 py-3 text-sm" style={{ borderBottom: "1px solid var(--line)" }}>
              <div className="grid items-center gap-3" style={{ gridTemplateColumns: "1.3fr 1fr 0.8fr 0.8fr 1fr 1.3fr 0.8fr auto" }}>
                <Link href={`/campaigns/${c.campaignCode}`} className="contents">
                  <div>
                    <div style={{ color: "var(--ink)" }}>{c.name}</div>
                    <div className="text-xs" style={{ color: "var(--muted)" }}>
                      {c.startDate.toLocaleDateString("es-CL")} — {c.endDate.toLocaleDateString("es-CL")}
                    </div>
                  </div>
                  <div style={{ color: "var(--ink)" }}>{c.businessUnit.name}</div>
                  <div className="text-xs" style={{ color: "var(--muted)" }}>{c.axis ? AXIS_LABEL[c.axis] : "—"}</div>
                  <div>{c.mediaType ? <Badge tone={MEDIA_TYPE_TONE[c.mediaType]}>{MEDIA_TYPE_LABEL[c.mediaType]}</Badge> : <span className="text-xs" style={{ color: "var(--muted)" }}>—</span>}</div>
                  <div><Badge tone={STATUS_TONE[c.status] || "neutral"}>{STATUS_LABEL[c.status] || c.status}</Badge></div>
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span style={{ color: "var(--muted)" }}>{Math.round(ex.pct * 100)}%</span>
                      <span style={{ color: ex.color }}>{ex.label}</span>
                    </div>
                    <ProgressBar pct={ex.pct} color={ex.color} />
                  </div>
                  <div className="text-xs" style={{ color: "var(--muted)", fontFamily: "monospace" }}>{c.campaignCode}</div>
                </Link>
                <div className="flex gap-2 justify-end">
                  <form action={deleteCampaignAction} className="inline-block">
                    <input type="hidden" name="id" value={c.id} />
                    <button type="submit" className="text-[11px] px-2 py-1 rounded-md" style={{ border: "1px solid var(--line)", background: "#fff", color: "var(--c-danger)" }}>Borrar</button>
                  </form>
                </div>
              </div>

              <form action={updateCampaignAction} className="mt-3 grid gap-2 md:grid-cols-4" style={{ borderTop: "1px solid var(--line)", paddingTop: "0.75rem" }}>
                <input type="hidden" name="id" value={c.id} />
                <input type="hidden" name="campaignCode" value={c.campaignCode} />
                <input type="hidden" name="redirectTo" value="/campaigns" />
                <input name="name" defaultValue={c.name} className="px-2 py-1.5 rounded-md text-xs" style={{ border: "1px solid var(--line)" }} />
                <select name="businessUnitId" defaultValue={c.businessUnitId} className="px-2 py-1.5 rounded-md text-xs" style={{ border: "1px solid var(--line)" }}>
                  {businessUnits.map((unit) => (<option key={unit.id} value={unit.id}>{unit.name}</option>))}
                </select>
                <select name="status" defaultValue={c.status} className="px-2 py-1.5 rounded-md text-xs" style={{ border: "1px solid var(--line)" }}>
                  <option value="DRAFT">Borrador</option>
                  <option value="ACTIVE">Activa</option>
                  <option value="PAUSED">Pausada</option>
                  <option value="COMPLETED">Finalizada</option>
                  <option value="CANCELLED">Cancelada</option>
                </select>
                <input type="date" name="startDate" defaultValue={new Date(c.startDate).toISOString().slice(0, 10)} className="px-2 py-1.5 rounded-md text-xs" style={{ border: "1px solid var(--line)" }} />
                <input type="date" name="endDate" defaultValue={new Date(c.endDate).toISOString().slice(0, 10)} className="px-2 py-1.5 rounded-md text-xs" style={{ border: "1px solid var(--line)" }} />
                <select name="ownerId" defaultValue={c.ownerId ?? ""} className="px-2 py-1.5 rounded-md text-xs" style={{ border: "1px solid var(--line)" }}>
                  <option value="">Sin responsable</option>
                  {users.map((user) => (<option key={user.id} value={user.id}>{user.name}</option>))}
                </select>
                <select name="axis" defaultValue={c.axis ?? ""} className="px-2 py-1.5 rounded-md text-xs" style={{ border: "1px solid var(--line)" }}>
                  <option value="">Eje (opcional)</option>
                  <option value="RECOGNITION">Reconocimiento</option>
                  <option value="PROMOTIONS">Promociones</option>
                  <option value="EVENTS">Eventos</option>
                  <option value="DELIVERY">Delivery</option>
                </select>
                <select name="mediaType" defaultValue={c.mediaType ?? ""} className="px-2 py-1.5 rounded-md text-xs" style={{ border: "1px solid var(--line)" }}>
                  <option value="">Digital o Análoga (opcional)</option>
                  {MEDIA_TYPE_OPTIONS.map((m) => (<option key={m} value={m}>{MEDIA_TYPE_LABEL[m]}</option>))}
                </select>
                <textarea name="objective" defaultValue={c.objective ?? ""} className="px-2 py-1.5 rounded-md text-xs md:col-span-4" style={{ border: "1px solid var(--line)" }} rows={2} />
                <button type="submit" className="px-3 py-1.5 rounded-md md:col-span-4" style={{ background: "var(--c-forest)", color: "#fff" }}>
                  Guardar cambios
                </button>
              </form>

              <div className="mt-3 pt-3 grid gap-3 md:grid-cols-2" style={{ borderTop: "1px solid var(--line)" }}>
                <div>
                  <div className="text-[11px] uppercase mb-2" style={{ color: "var(--muted)" }}>Presupuesto asignado: {money(assigned)}</div>
                  {c.budgets.length > 0 && (
                    <div className="space-y-1">
                      {c.budgets.map((b) => (
                        <div key={b.id} className="flex items-center justify-between text-xs rounded-md px-2 py-1" style={{ background: "#F7F5F0" }}>
                          <span style={{ color: "var(--ink)" }}>{b.periodYear} — {money(b.assignedAmount)}</span>
                          <form action={deleteBudgetAction} className="inline-block">
                            <input type="hidden" name="id" value={b.id} />
                            <input type="hidden" name="redirectTo" value="/campaigns" />
                            <button type="submit" style={{ color: "var(--c-danger)" }}>Borrar</button>
                          </form>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <form action={createBudgetAction} className="grid grid-cols-3 gap-2 h-fit">
                  <input type="hidden" name="campaignId" value={c.id} />
                  <input type="hidden" name="businessUnitId" value={c.businessUnitId} />
                  <input type="hidden" name="redirectTo" value="/campaigns" />
                  <input type="number" name="periodYear" placeholder="Año" min={2024} defaultValue={new Date().getFullYear()} className="px-2 py-1.5 rounded-md text-xs" style={{ border: "1px solid var(--line)" }} required />
                  <input type="number" name="assignedAmount" placeholder="Monto" min={0} className="px-2 py-1.5 rounded-md text-xs" style={{ border: "1px solid var(--line)" }} required />
                  <button type="submit" className="px-2 py-1.5 rounded-md text-xs" style={{ background: "var(--c-forest)", color: "#fff" }}>+ Presupuesto</button>
                </form>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
