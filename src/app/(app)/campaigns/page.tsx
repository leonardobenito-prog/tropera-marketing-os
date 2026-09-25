import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { createCampaignAction, updateCampaignAction, deleteCampaignAction, createBudgetAction, deleteBudgetAction } from "@/lib/actions/ops";
import { Badge, ProgressBar, execState, money } from "@/components/ui";
import type { Prisma, CampaignMediaType, BudgetAxis } from "@prisma/client";

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
const AXIS_OPTIONS = ["RECOGNITION", "PROMOTIONS", "EVENTS", "DELIVERY"] as const;

const MEDIA_TYPE_LABEL: Record<string, string> = { DIGITAL: "Digital", ANALOG: "Análoga" };
const MEDIA_TYPE_TONE: Record<string, "forest" | "warning"> = { DIGITAL: "forest", ANALOG: "warning" };
const MEDIA_TYPE_OPTIONS = ["DIGITAL", "ANALOG"] as const;

const TASK_STATUS_LABEL: Record<string, string> = {
  TODO: "Por hacer", IN_PROGRESS: "En progreso", REVIEW: "Revisión", DONE: "Hecho",
};
const TASK_STATUS_TONE: Record<string, "neutral" | "warning" | "success"> = {
  TODO: "neutral", IN_PROGRESS: "warning", REVIEW: "success", DONE: "success",
};

const PRODUCTION_STATUS_LABEL: Record<string, string> = {
  BACKLOG: "Backlog", IN_PRODUCTION: "En producción", REVIEW: "Revisión",
  APPROVED: "Aprobado", PUBLISHED: "Publicado", IMPLEMENTED: "Implementado",
};
const PRODUCTION_STATUS_TONE: Record<string, "neutral" | "warning" | "success"> = {
  BACKLOG: "neutral", IN_PRODUCTION: "warning", REVIEW: "success",
  APPROVED: "success", PUBLISHED: "success", IMPLEMENTED: "success",
};

const NO_DATE_SORT_KEY = 8.64e15;

function dueSortKey(date: Date | null) {
  return date ? date.getTime() : NO_DATE_SORT_KEY;
}

function shortDate(date: Date | null) {
  return date ? new Date(date).toLocaleDateString("es-CL") : "Sin fecha";
}

// Filtro por ventana de tiempo y tipo de medio vía querystring: /campaigns?from=2026-09-01&to=2026-09-30&mediaType=DIGITAL
export default async function CampaignsPage({ searchParams }: { searchParams: { from?: string; to?: string; mediaType?: string; businessUnitId?: string; axis?: string; error?: string; success?: string } }) {
  const from = searchParams.from ? new Date(searchParams.from) : null;
  const to = searchParams.to ? new Date(searchParams.to) : null;
  const mediaTypeFilter = MEDIA_TYPE_OPTIONS.includes(searchParams.mediaType as (typeof MEDIA_TYPE_OPTIONS)[number]) ? searchParams.mediaType : "";
  const axisFilter = AXIS_OPTIONS.includes(searchParams.axis as (typeof AXIS_OPTIONS)[number]) ? searchParams.axis : "";
  const businessUnitFilter = searchParams.businessUnitId ?? "";

  const where: Prisma.CampaignWhereInput = {
    ...(from ? { endDate: { gte: from } } : {}),
    ...(to ? { startDate: { lte: to } } : {}),
    ...(mediaTypeFilter ? { mediaType: mediaTypeFilter as CampaignMediaType } : {}),
    ...(axisFilter ? { axis: axisFilter as BudgetAxis } : {}),
    ...(businessUnitFilter ? { businessUnitId: businessUnitFilter } : {}),
  };

  const [campaigns, businessUnits, users] = await Promise.all([
    prisma.campaign.findMany({
      where,
      include: {
        businessUnit: true,
        budgets: true,
        expenses: true,
        tasks: { include: { assignee: true } },
        productionProjects: {
          include: { assignee: true, tasks: { include: { assignee: true } } },
        },
      },
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

      {searchParams.error === "campaign-code-taken" && (
        <div className="text-xs px-4 py-2 rounded-lg" style={{ background: "#FAE7E4", color: "#A23B2E" }}>
          Ese código ya lo usa otra campaña. El código es único — elegí uno distinto y volvé a guardar.
        </div>
      )}
      {searchParams.error === "campaign-invalid" && (
        <div className="text-xs px-4 py-2 rounded-lg" style={{ background: "#FAE7E4", color: "#A23B2E" }}>
          Faltan datos o son inválidos. El nombre y el código necesitan al menos 2 caracteres, y la unidad de negocio
          y ambas fechas son obligatorias.
        </div>
      )}
      {searchParams.success === "campaign-created" && (
        <div className="text-xs px-4 py-2 rounded-lg" style={{ background: "#E7F1EA", color: "#2F6B45" }}>
          Campaña creada correctamente.
        </div>
      )}

      <form className="flex items-center gap-2 text-xs flex-wrap" style={{ color: "var(--muted)" }}>
        Del <input type="date" name="from" defaultValue={searchParams.from ?? ""} className="px-2 py-1.5 rounded-md" style={{ border: "1px solid var(--line)" }} />
        al <input type="date" name="to" defaultValue={searchParams.to ?? ""} className="px-2 py-1.5 rounded-md" style={{ border: "1px solid var(--line)" }} />
        Unidad
        <select name="businessUnitId" defaultValue={businessUnitFilter} className="px-2 py-1.5 rounded-md" style={{ border: "1px solid var(--line)" }}>
          <option value="">Todas</option>
          {businessUnits.map((unit) => (<option key={unit.id} value={unit.id}>{unit.name}</option>))}
        </select>
        Eje
        <select name="axis" defaultValue={axisFilter} className="px-2 py-1.5 rounded-md" style={{ border: "1px solid var(--line)" }}>
          <option value="">Todos</option>
          {AXIS_OPTIONS.map((a) => (<option key={a} value={a}>{AXIS_LABEL[a]}</option>))}
        </select>
        Tipo
        <select name="mediaType" defaultValue={mediaTypeFilter} className="px-2 py-1.5 rounded-md" style={{ border: "1px solid var(--line)" }}>
          <option value="">Todos</option>
          {MEDIA_TYPE_OPTIONS.map((m) => (<option key={m} value={m}>{MEDIA_TYPE_LABEL[m]}</option>))}
        </select>
        <button type="submit" className="px-3 py-1.5 rounded-md" style={{ border: "1px solid var(--line)", background: "#fff", color: "var(--ink)" }}>Filtrar</button>
        {(searchParams.from || searchParams.to || mediaTypeFilter || axisFilter || businessUnitFilter) && (
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
        <div className="text-[11px] px-4 py-2" style={{ color: "var(--muted)", borderBottom: "1px solid var(--line)" }}>
          CAMPAÑAS — TOCÁ UNA PARA VER SU DETALLE
        </div>
        {campaigns.length === 0 && (
          <div className="px-4 py-3 text-sm" style={{ color: "var(--muted)" }}>Sin campañas en este filtro.</div>
        )}
        {campaigns.map((c) => {
          const assigned = c.budgets.reduce((s, b) => s + b.assignedAmount, 0);
          const actual = c.expenses.filter((e) => e.status === "PAID").reduce((s, e) => s + e.amount, 0);
          const committed = c.expenses.filter((e) => e.status === "COMMITTED").reduce((s, e) => s + e.amount, 0);
          const ex = execState(assigned, actual, committed);

          // Toda tarea de la campaña: la creada desde calendario (vínculo directo)
          // más la de cada proyecto de producción asociado. Pendientes primero.
          const linkedTasks = [
            ...c.tasks.map((t) => ({ ...t, origin: "Calendario" })),
            ...c.productionProjects.flatMap((p) => p.tasks.map((t) => ({ ...t, origin: `Producción · ${p.name}` }))),
          ].sort((a, b) =>
            Number(a.status === "DONE") - Number(b.status === "DONE") || dueSortKey(a.dueDate) - dueSortKey(b.dueDate)
          );
          const pendingCount = linkedTasks.filter((t) => t.status !== "DONE").length;
          const projects = [...c.productionProjects].sort((a, b) => dueSortKey(a.dueDate) - dueSortKey(b.dueDate));

          return (
            <details key={c.id} className="text-sm" style={{ borderBottom: "1px solid var(--line)" }}>
              <summary className="px-4 py-3 flex items-center justify-between gap-3 cursor-pointer">
                <div>
                  <div className="text-lg heading-title" style={{ color: "var(--ink)" }}>{c.name}</div>
                  <div className="text-xs mt-1" style={{ color: "var(--muted)" }}>
                    {c.startDate.toLocaleDateString("es-CL")} — {c.endDate.toLocaleDateString("es-CL")}
                  </div>
                </div>
                <span className="chevron text-xs" style={{ color: "var(--muted)", transition: "transform 150ms" }}>▼</span>
              </summary>

              <div className="px-4 pb-4">
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pb-3">
                  <span className="text-xs" style={{ color: "var(--muted)" }}>
                    Unidad: <span style={{ color: "var(--ink)" }}>{c.businessUnit.name}</span>
                  </span>
                  <span className="text-xs" style={{ color: "var(--muted)" }}>
                    Eje: <span style={{ color: "var(--ink)" }}>{c.axis ? AXIS_LABEL[c.axis] : "—"}</span>
                  </span>
                  {c.mediaType && <Badge tone={MEDIA_TYPE_TONE[c.mediaType]}>{MEDIA_TYPE_LABEL[c.mediaType]}</Badge>}
                  <Badge tone={STATUS_TONE[c.status] || "neutral"}>{STATUS_LABEL[c.status] || c.status}</Badge>
                  <span className="text-xs" style={{ color: "var(--muted)", fontFamily: "monospace" }}>{c.campaignCode}</span>
                  <Link href={`/campaigns/${c.campaignCode}`} className="text-xs" style={{ color: "var(--c-copper)" }}>Ver ficha completa →</Link>
                  <form action={deleteCampaignAction} className="inline-block ml-auto">
                    <input type="hidden" name="id" value={c.id} />
                    <button type="submit" className="text-[11px] px-2 py-1 rounded-md" style={{ border: "1px solid var(--line)", background: "#fff", color: "var(--c-danger)" }}>Borrar</button>
                  </form>
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span style={{ color: "var(--muted)" }}>Ejecución {Math.round(ex.pct * 100)}%</span>
                    <span style={{ color: ex.color }}>{ex.label}</span>
                  </div>
                  <ProgressBar pct={ex.pct} color={ex.color} />
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

              <div className="mt-3 pt-3 grid gap-4 md:grid-cols-2" style={{ borderTop: "1px solid var(--line)" }}>
                <div>
                  <div className="text-[11px] uppercase mb-2" style={{ color: "var(--muted)" }}>
                    Tareas de la campaña — {pendingCount} pendientes de {linkedTasks.length}
                  </div>
                  {linkedTasks.length === 0 ? (
                    <div className="text-xs" style={{ color: "var(--muted)" }}>
                      Sin tareas vinculadas. Se agregan desde Calendario o Producción eligiendo esta campaña.
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {linkedTasks.map((t) => (
                        <div key={t.id} className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5" style={{ background: "#F7F5F0" }}>
                          <div className="min-w-0">
                            <div className="text-xs truncate" style={{ color: "var(--ink)" }}>{t.title}</div>
                            <div className="text-[10px] truncate" style={{ color: "var(--muted)" }}>
                              {t.origin} · {shortDate(t.dueDate)} · {t.assignee?.name ?? "Sin asignar"}
                            </div>
                          </div>
                          <Badge tone={TASK_STATUS_TONE[t.status] ?? "neutral"}>{TASK_STATUS_LABEL[t.status] ?? t.status}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <div className="text-[11px] uppercase mb-2" style={{ color: "var(--muted)" }}>
                    Proyectos de producción — {projects.length}
                  </div>
                  {projects.length === 0 ? (
                    <div className="text-xs" style={{ color: "var(--muted)" }}>
                      Sin proyectos vinculados. Se asocian desde Producción eligiendo esta campaña.
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {projects.map((p) => (
                        <div key={p.id} className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5" style={{ background: "#F7F5F0" }}>
                          <div className="min-w-0">
                            <div className="text-xs truncate" style={{ color: "var(--ink)" }}>{p.name}</div>
                            <div className="text-[10px] truncate" style={{ color: "var(--muted)" }}>
                              {p.format} · {shortDate(p.dueDate)} · {p.assignee?.name ?? "Sin asignar"} · {p.tasks.length} tareas
                            </div>
                          </div>
                          <Badge tone={PRODUCTION_STATUS_TONE[p.status] ?? "neutral"}>{PRODUCTION_STATUS_LABEL[p.status] ?? p.status}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                </div>
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
}
