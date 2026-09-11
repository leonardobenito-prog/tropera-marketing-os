import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/permissions";
import { Badge, KPICard } from "@/components/ui";
import { AssigneeFilter } from "@/components/AssigneeFilter";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  TODO: "Por hacer",
  IN_PROGRESS: "En progreso",
  REVIEW: "Revisión",
  DONE: "Hecho",
};

const STATUS_TONE: Record<string, "neutral" | "warning" | "success" | "danger"> = {
  TODO: "neutral",
  IN_PROGRESS: "warning",
  REVIEW: "success",
  DONE: "success",
};

const PROJECT_STATUS_LABEL: Record<string, string> = {
  BACKLOG: "Backlog",
  IN_PRODUCTION: "En producción",
  REVIEW: "Revisión",
  APPROVED: "Aprobado",
  PUBLISHED: "Publicado",
  IMPLEMENTED: "Implementado",
};

const PROJECT_STATUS_TONE: Record<string, "neutral" | "warning" | "success" | "danger"> = {
  BACKLOG: "neutral",
  IN_PRODUCTION: "warning",
  REVIEW: "success",
  APPROVED: "success",
  PUBLISHED: "success",
  IMPLEMENTED: "success",
};

const PRIORITY_LABEL: Record<string, string> = {
  LOW: "Baja",
  MEDIUM: "Media",
  HIGH: "Alta",
};

const PRIORITY_TONE: Record<string, "neutral" | "warning" | "danger"> = {
  LOW: "neutral",
  MEDIUM: "warning",
  HIGH: "danger",
};

type PendingItem = {
  id: string;
  kind: "Tarea" | "Producción";
  title: string;
  context: string;
  statusLabel: string;
  statusTone: "neutral" | "warning" | "success" | "danger";
  dueDate: Date | null;
  assigneeName: string;
  meta: string;
  priorityLabel?: string;
  priorityTone?: "neutral" | "warning" | "danger";
  costLabel?: string;
  cost?: number | null;
  done: boolean;
  inProgress: boolean;
};

export default async function TodayPage({
  searchParams,
}: {
  searchParams?: { assignee?: string };
}) {
  const session = await requireSession();
  const currentUserId = String(session.user.id ?? "");
  const selectedAssigneeId = searchParams?.assignee || currentUserId;
  const assigneeWhere = selectedAssigneeId && selectedAssigneeId !== "all" ? { assigneeId: selectedAssigneeId } : undefined;

  const [users, tasks, projects] = await Promise.all([
    prisma.user.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true },
    }),
    prisma.task.findMany({
      where: assigneeWhere,
      include: { assignee: true, campaign: true, productionProject: true },
      orderBy: { dueDate: "asc" },
    }),
    prisma.productionProject.findMany({
      where: assigneeWhere,
      include: { assignee: true, campaign: true },
      orderBy: { dueDate: "asc" },
    }),
  ]);

  const taskItems: PendingItem[] = tasks.map((task) => ({
    id: `task-${task.id}`,
    kind: "Tarea",
    title: task.title,
    context: task.campaign?.name ?? task.productionProject?.name ?? "Operativo",
    statusLabel: STATUS_LABEL[task.status] ?? task.status,
    statusTone: STATUS_TONE[task.status] ?? "neutral",
    dueDate: task.dueDate,
    assigneeName: task.assignee?.name ?? "Sin asignar",
    meta: task.type ?? "Tarea",
    priorityLabel: PRIORITY_LABEL[task.priority] ?? task.priority,
    priorityTone: PRIORITY_TONE[task.priority] ?? "neutral",
    costLabel: "Costo",
    cost: task.cost,
    done: task.status === "DONE",
    inProgress: task.status === "IN_PROGRESS",
  }));

  const projectItems: PendingItem[] = projects.map((project) => ({
    id: `project-${project.id}`,
    kind: "Producción",
    title: project.name,
    context: project.campaign?.name ?? "Grilla RRSS",
    statusLabel: PROJECT_STATUS_LABEL[project.status] ?? project.status,
    statusTone: PROJECT_STATUS_TONE[project.status] ?? "neutral",
    dueDate: project.dueDate,
    assigneeName: project.assignee?.name ?? "Sin asignar",
    meta: project.format,
    costLabel: "Presupuesto",
    cost: project.budgetAmount,
    done: project.status === "IMPLEMENTED",
    inProgress: project.status === "IN_PRODUCTION",
  }));

  const items = [...taskItems, ...projectItems];

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  const overdueItems = items.filter((item) => item.dueDate && item.dueDate < todayStart && !item.done);
  const todayItems = items.filter((item) => item.dueDate && item.dueDate >= todayStart && item.dueDate <= todayEnd && !item.done);
  const upcomingItems = items.filter((item) => item.dueDate && item.dueDate > todayEnd && !item.done);
  const inProgressCount = items.filter((item) => item.inProgress).length;

  const selectedUser = users.find((user) => user.id === selectedAssigneeId) ?? null;

  return (
    <div className="p-6 space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.18em]" style={{ color: "var(--muted)" }}>
            Actividad por persona
          </div>
          <h1 className="text-xl heading-title mt-1" style={{ color: "var(--ink)" }}>
            Hoy
          </h1>
        </div>

        <div className="min-w-[220px]">
          <label className="block text-[11px] uppercase mb-2" style={{ color: "var(--muted)" }}>
            Filtrar por persona
          </label>
          <AssigneeFilter users={users} selectedAssigneeId={selectedAssigneeId} />
        </div>
      </div>

      <div className="flex gap-3 flex-wrap">
        <KPICard label="ATRASADAS" value={overdueItems.length} accent="var(--c-danger)" />
        <KPICard label="HOY" value={todayItems.length} accent="var(--c-warning)" />
        <KPICard label="EN PROGRESO" value={inProgressCount} accent="var(--c-copper)" />
        <KPICard label="PRÓXIMAS" value={upcomingItems.length} accent="var(--c-forest)" />
      </div>

      <div className="rounded-lg p-4" style={{ background: "#F7F5F0", border: "1px solid var(--line)" }}>
        <div className="text-[11px] uppercase" style={{ color: "var(--muted)" }}>
          Vista actual
        </div>
        <div className="text-base mt-1 font-medium" style={{ color: "var(--ink)" }}>
          {selectedAssigneeId === "all" ? "Todas las personas" : selectedUser?.name ?? "Sin asignación"}
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <section>
          <h2 className="text-lg heading-title mb-3" style={{ color: "var(--ink)" }}>
            Pendientes de hoy
          </h2>

          {todayItems.length === 0 ? (
            <div className="text-sm px-4 py-3 rounded-lg" style={{ color: "var(--muted)", border: "1px dashed var(--line)" }}>
              No hay pendientes para hoy en esta vista.
            </div>
          ) : (
            <div className="space-y-3">
              {todayItems.map((item) => (
                <div key={item.id} className="bg-white rounded-lg p-4" style={{ border: "1px solid var(--line)" }}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium" style={{ color: "var(--ink)" }}>{item.title}</div>
                      <div className="text-xs mt-1" style={{ color: "var(--muted)" }}>{item.context}</div>
                    </div>
                    <Badge tone={item.statusTone}>{item.statusLabel}</Badge>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2 text-xs" style={{ color: "var(--muted)" }}>
                    <span>{item.assigneeName}</span>
                    <span>•</span>
                    <span>{item.kind}</span>
                    <span>•</span>
                    <span>{item.meta}</span>
                    <span>•</span>
                    <span>{item.dueDate ? new Date(item.dueDate).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" }) : "Sin hora"}</span>
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    {item.priorityLabel ? <Badge tone={item.priorityTone ?? "neutral"}>{item.priorityLabel}</Badge> : <span />}
                    {item.cost ? <span className="text-xs" style={{ color: "var(--muted)" }}>{item.costLabel}: ${item.cost.toLocaleString("es-CL")}</span> : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="text-lg heading-title mb-3" style={{ color: "var(--ink)" }}>
            Vencidas
          </h2>

          {overdueItems.length === 0 ? (
            <div className="text-sm px-4 py-3 rounded-lg" style={{ color: "var(--muted)", border: "1px dashed var(--line)" }}>
              No hay pendientes vencidos en esta vista.
            </div>
          ) : (
            <div className="space-y-3">
              {overdueItems.map((item) => (
                <div key={item.id} className="bg-white rounded-lg p-4" style={{ border: "1px solid var(--line)" }}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium" style={{ color: "var(--ink)" }}>{item.title}</div>
                      <div className="text-xs mt-1" style={{ color: "var(--muted)" }}>{item.context} · {item.kind}</div>
                    </div>
                    <Badge tone="danger">Vencida</Badge>
                  </div>
                  <div className="mt-3 text-xs" style={{ color: "var(--muted)" }}>
                    {item.assigneeName} · Vence {item.dueDate ? new Date(item.dueDate).toLocaleDateString("es-CL") : "sin fecha"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section>
        <h2 className="text-lg heading-title mb-3" style={{ color: "var(--ink)" }}>
          Próximas entregas
        </h2>

        {upcomingItems.length === 0 ? (
          <div className="text-sm px-4 py-3 rounded-lg" style={{ color: "var(--muted)", border: "1px dashed var(--line)" }}>
            No hay entregas próximas para esta persona.
          </div>
        ) : (
          <div className="bg-white rounded-lg overflow-hidden" style={{ border: "1px solid var(--line)" }}>
            <div className="grid text-[11px] px-4 py-2" style={{ gridTemplateColumns: "1.4fr 0.7fr 1fr 1fr 0.8fr", color: "var(--muted)", borderBottom: "1px solid var(--line)" }}>
              <div>ÍTEM</div>
              <div>TIPO</div>
              <div>ASIGNADO</div>
              <div>FECHA</div>
              <div>ESTADO</div>
            </div>
            {upcomingItems.map((item) => (
              <div key={item.id} className="grid items-center px-4 py-3 text-sm" style={{ gridTemplateColumns: "1.4fr 0.7fr 1fr 1fr 0.8fr", borderBottom: "1px solid var(--line)" }}>
                <div>
                  <div style={{ color: "var(--ink)" }}>{item.title}</div>
                  <div className="text-xs" style={{ color: "var(--muted)" }}>{item.context}</div>
                </div>
                <div style={{ color: "var(--muted)" }}>{item.kind}</div>
                <div style={{ color: "var(--muted)" }}>{item.assigneeName}</div>
                <div style={{ color: "var(--muted)" }}>{item.dueDate ? new Date(item.dueDate).toLocaleDateString("es-CL") : "Sin fecha"}</div>
                <div><Badge tone={item.statusTone}>{item.statusLabel}</Badge></div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
