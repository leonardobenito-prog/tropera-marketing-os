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

export default async function TodayPage({
  searchParams,
}: {
  searchParams?: { assignee?: string };
}) {
  const session = await requireSession();
  const currentUserId = String(session.user.id ?? "");
  const selectedAssigneeId = searchParams?.assignee || currentUserId;

  const [users, tasks] = await Promise.all([
    prisma.user.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true },
    }),
    prisma.task.findMany({
      where: selectedAssigneeId && selectedAssigneeId !== "all" ? { assigneeId: selectedAssigneeId } : undefined,
      include: { assignee: true, campaign: true, productionProject: true },
      orderBy: { dueDate: "asc" },
    }),
  ]);

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  const overdueTasks = tasks.filter((task) => task.dueDate && task.dueDate < todayStart && task.status !== "DONE");
  const todayTasks = tasks.filter((task) => task.dueDate && task.dueDate >= todayStart && task.dueDate <= todayEnd && task.status !== "DONE");
  const upcomingTasks = tasks.filter((task) => task.dueDate && task.dueDate > todayEnd && task.status !== "DONE");
  const inProgressCount = tasks.filter((task) => task.status === "IN_PROGRESS").length;

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
        <KPICard label="ATRASADAS" value={overdueTasks.length} accent="var(--c-danger)" />
        <KPICard label="HOY" value={todayTasks.length} accent="var(--c-warning)" />
        <KPICard label="EN PROGRESO" value={inProgressCount} accent="var(--c-copper)" />
        <KPICard label="PRÓXIMAS" value={upcomingTasks.length} accent="var(--c-forest)" />
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
            Tareas de hoy
          </h2>

          {todayTasks.length === 0 ? (
            <div className="text-sm px-4 py-3 rounded-lg" style={{ color: "var(--muted)", border: "1px dashed var(--line)" }}>
              No hay tareas pendientes para hoy en esta vista.
            </div>
          ) : (
            <div className="space-y-3">
              {todayTasks.map((task) => {
                const context = task.campaign?.name ?? task.productionProject?.name ?? "Operativo";
                return (
                  <div key={task.id} className="bg-white rounded-lg p-4" style={{ border: "1px solid var(--line)" }}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium" style={{ color: "var(--ink)" }}>{task.title}</div>
                        <div className="text-xs mt-1" style={{ color: "var(--muted)" }}>{context}</div>
                      </div>
                      <Badge tone={STATUS_TONE[task.status] ?? "neutral"}>{STATUS_LABEL[task.status] ?? task.status}</Badge>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2 text-xs" style={{ color: "var(--muted)" }}>
                      <span>{task.assignee?.name ?? "Sin asignar"}</span>
                      <span>•</span>
                      <span>{task.type ?? "Tarea"}</span>
                      <span>•</span>
                      <span>{task.dueDate ? new Date(task.dueDate).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" }) : "Sin hora"}</span>
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                      <Badge tone={PRIORITY_TONE[task.priority] ?? "neutral"}>{PRIORITY_LABEL[task.priority] ?? task.priority}</Badge>
                      {task.cost ? <span className="text-xs" style={{ color: "var(--muted)" }}>Costo: ${task.cost.toLocaleString("es-CL")}</span> : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section>
          <h2 className="text-lg heading-title mb-3" style={{ color: "var(--ink)" }}>
            Vencidas
          </h2>

          {overdueTasks.length === 0 ? (
            <div className="text-sm px-4 py-3 rounded-lg" style={{ color: "var(--muted)", border: "1px dashed var(--line)" }}>
              No hay tareas vencidas en esta vista.
            </div>
          ) : (
            <div className="space-y-3">
              {overdueTasks.map((task) => {
                const context = task.campaign?.name ?? task.productionProject?.name ?? "Operativo";
                return (
                  <div key={task.id} className="bg-white rounded-lg p-4" style={{ border: "1px solid var(--line)" }}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium" style={{ color: "var(--ink)" }}>{task.title}</div>
                        <div className="text-xs mt-1" style={{ color: "var(--muted)" }}>{context}</div>
                      </div>
                      <Badge tone="danger">Vencida</Badge>
                    </div>
                    <div className="mt-3 text-xs" style={{ color: "var(--muted)" }}>
                      {task.assignee?.name ?? "Sin asignar"} · Vence {task.dueDate ? new Date(task.dueDate).toLocaleDateString("es-CL") : "sin fecha"}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <section>
        <h2 className="text-lg heading-title mb-3" style={{ color: "var(--ink)" }}>
          Próximas entregas
        </h2>

        {upcomingTasks.length === 0 ? (
          <div className="text-sm px-4 py-3 rounded-lg" style={{ color: "var(--muted)", border: "1px dashed var(--line)" }}>
            No hay entregas próximas para esta persona.
          </div>
        ) : (
          <div className="bg-white rounded-lg overflow-hidden" style={{ border: "1px solid var(--line)" }}>
            <div className="grid text-[11px] px-4 py-2" style={{ gridTemplateColumns: "1.6fr 1fr 1fr 0.8fr", color: "var(--muted)", borderBottom: "1px solid var(--line)" }}>
              <div>TAREA</div>
              <div>ASIGNADO</div>
              <div>FECHA</div>
              <div>ESTADO</div>
            </div>
            {upcomingTasks.map((task) => (
              <div key={task.id} className="grid items-center px-4 py-3 text-sm" style={{ gridTemplateColumns: "1.6fr 1fr 1fr 0.8fr", borderBottom: "1px solid var(--line)" }}>
                <div>
                  <div style={{ color: "var(--ink)" }}>{task.title}</div>
                  <div className="text-xs" style={{ color: "var(--muted)" }}>{task.campaign?.name ?? task.productionProject?.name ?? "Operativo"}</div>
                </div>
                <div style={{ color: "var(--muted)" }}>{task.assignee?.name ?? "Sin asignar"}</div>
                <div style={{ color: "var(--muted)" }}>{task.dueDate ? new Date(task.dueDate).toLocaleDateString("es-CL") : "Sin fecha"}</div>
                <div><Badge tone={STATUS_TONE[task.status] ?? "neutral"}>{STATUS_LABEL[task.status] ?? task.status}</Badge></div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
