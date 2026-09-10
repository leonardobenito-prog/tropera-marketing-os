import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui";

export const dynamic = "force-dynamic";

const WEEK_DAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

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

export default async function CalendarPage() {
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);

  const tasks = await prisma.task.findMany({
    where: { dueDate: { gte: monthStart, lte: monthEnd } },
    include: { assignee: true, campaign: true, productionProject: true },
    orderBy: { dueDate: "asc" },
  });

  const tasksByDate = new Map<string, typeof tasks>();
  for (const task of tasks) {
    if (!task.dueDate) continue;
    const key = new Date(task.dueDate).toISOString().slice(0, 10);
    const current = tasksByDate.get(key) ?? [];
    current.push(task);
    tasksByDate.set(key, current);
  }

  const firstWeekday = monthStart.getDay();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const grid: Array<number | null> = [];

  for (let i = 0; i < firstWeekday; i += 1) {
    grid.push(null);
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    grid.push(day);
  }

  while (grid.length % 7 !== 0) {
    grid.push(null);
  }

  return (
    <div className="p-6 space-y-8">
      <div>
        <div className="text-xs uppercase tracking-[0.18em]" style={{ color: "var(--muted)" }}>
          Calendario operativo
        </div>
        <h1 className="text-xl heading-title mt-1" style={{ color: "var(--ink)" }}>
          {new Intl.DateTimeFormat("es-CL", { month: "long", year: "numeric" }).format(monthStart)}
        </h1>
      </div>

      <div className="grid lg:grid-cols-[1.6fr_0.8fr] gap-8">
        <div className="bg-white rounded-lg overflow-hidden" style={{ border: "1px solid var(--line)" }}>
          <div className="grid grid-cols-7 text-[11px] uppercase" style={{ color: "var(--muted)" }}>
            {WEEK_DAYS.map((day) => (
              <div key={day} className="px-3 py-2 text-center border-b" style={{ borderColor: "var(--line)" }}>{day}</div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {grid.map((day, index) => {
              if (day === null) {
                return <div key={`empty-${index}`} className="min-h-[120px] border-b border-r" style={{ borderColor: "var(--line)" }} />;
              }

              const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const dayTasks = tasksByDate.get(iso) ?? [];
              const isToday = day === today.getDate();

              return (
                <div key={day} className="min-h-[120px] border-b border-r p-2" style={{ borderColor: "var(--line)", background: isToday ? "#F7F5F0" : "#fff" }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs" style={{ color: isToday ? "var(--c-forest)" : "var(--muted)" }}>{day}</span>
                    {isToday && <span className="text-[10px] uppercase" style={{ color: "var(--c-forest)" }}>Hoy</span>}
                  </div>
                  <div className="space-y-1.5">
                    {dayTasks.slice(0, 3).map((task) => (
                      <div key={task.id} className="rounded px-1.5 py-1 text-[10px]" style={{ background: "#F4F2ED", color: "var(--ink)" }}>
                        <div className="font-medium truncate">{task.title}</div>
                        <div className="text-[9px]" style={{ color: "var(--muted)" }}>{task.assignee?.name ?? "Sin asignar"}</div>
                      </div>
                    ))}
                    {dayTasks.length > 3 && (
                      <div className="text-[10px]" style={{ color: "var(--muted)" }}>+{dayTasks.length - 3} más</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <aside className="space-y-4">
          <div className="bg-white rounded-lg p-4" style={{ border: "1px solid var(--line)" }}>
            <h2 className="text-lg heading-title mb-3" style={{ color: "var(--ink)" }}>Próximas fechas</h2>
            {tasks.length === 0 ? (
              <div className="text-sm" style={{ color: "var(--muted)" }}>No hay tareas programadas en este mes.</div>
            ) : (
              <div className="space-y-3">
                {tasks.slice(0, 8).map((task) => (
                  <div key={task.id} className="rounded-lg p-2" style={{ background: "#F7F5F0" }}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm" style={{ color: "var(--ink)" }}>{task.title}</div>
                      <Badge tone={STATUS_TONE[task.status] ?? "neutral"}>{STATUS_LABEL[task.status] ?? task.status}</Badge>
                    </div>
                    <div className="text-xs mt-1" style={{ color: "var(--muted)" }}>
                      {task.dueDate ? new Date(task.dueDate).toLocaleDateString("es-CL") : "Sin fecha"} · {task.assignee?.name ?? "Sin asignar"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
