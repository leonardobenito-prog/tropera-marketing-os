import { prisma } from "@/lib/prisma";
import { createTaskAction, updateTaskAction, deleteTaskAction } from "@/lib/actions/ops";
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

function formatMonthKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export default async function CalendarPage({ searchParams }: { searchParams: { month?: string } }) {
  const selectedMonth = searchParams.month ? new Date(`${searchParams.month}-01T00:00:00`) : new Date();
  const selectedYear = selectedMonth.getFullYear();
  const selectedMonthIndex = selectedMonth.getMonth();
  const monthStart = new Date(selectedYear, selectedMonthIndex, 1);
  const monthEnd = new Date(selectedYear, selectedMonthIndex + 1, 0, 23, 59, 59, 999);

  const prevMonth = new Date(selectedYear, selectedMonthIndex - 1, 1);
  const nextMonth = new Date(selectedYear, selectedMonthIndex + 1, 1);

  const [tasks, users] = await Promise.all([
    prisma.task.findMany({
      where: { dueDate: { gte: monthStart, lte: monthEnd } },
      include: { assignee: true, campaign: true, productionProject: true },
      orderBy: { dueDate: "asc" },
    }),
    prisma.user.findMany({ orderBy: { name: "asc" } }),
  ]);

  const tasksByDate = new Map<string, typeof tasks>();
  for (const task of tasks) {
    if (!task.dueDate) continue;
    const key = new Date(task.dueDate).toISOString().slice(0, 10);
    const current = tasksByDate.get(key) ?? [];
    current.push(task);
    tasksByDate.set(key, current);
  }

  const firstWeekday = monthStart.getDay();
  const daysInMonth = new Date(selectedYear, selectedMonthIndex + 1, 0).getDate();
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

  const redirectTo = searchParams.month ? `/calendar?month=${searchParams.month}` : "/calendar";

  return (
    <div className="p-6 space-y-8">
      <div>
        <div className="text-xs uppercase tracking-[0.18em]" style={{ color: "var(--muted)" }}>
          Calendario operativo
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl heading-title" style={{ color: "var(--ink)" }}>
            {new Intl.DateTimeFormat("es-CL", { month: "long", year: "numeric" }).format(monthStart)}
          </h1>
          <div className="flex items-center gap-2 text-xs">
            <a href={`?month=${formatMonthKey(prevMonth)}`} className="px-3 py-1.5 rounded-md" style={{ border: "1px solid var(--line)", background: "#fff", color: "var(--ink)" }}>← Mes anterior</a>
            <a href={`?month=${formatMonthKey(new Date())}`} className="px-3 py-1.5 rounded-md" style={{ border: "1px solid var(--line)", background: "#fff", color: "var(--ink)" }}>Hoy</a>
            <a href={`?month=${formatMonthKey(nextMonth)}`} className="px-3 py-1.5 rounded-md" style={{ border: "1px solid var(--line)", background: "#fff", color: "var(--ink)" }}>Mes siguiente →</a>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg p-4" style={{ border: "1px solid var(--line)" }}>
        <h2 className="text-lg heading-title mb-3" style={{ color: "var(--ink)" }}>Añadir tarea al calendario</h2>
        <form action={createTaskAction} className="grid gap-3 md:grid-cols-2">
          <input type="hidden" name="redirectTo" value={redirectTo} />
          <input type="date" name="dueDate" className="px-3 py-2 rounded-md" style={{ border: "1px solid var(--line)" }} defaultValue={new Date().toISOString().slice(0, 10)} required />
          <input name="title" placeholder="Título de la tarea" className="px-3 py-2 rounded-md" style={{ border: "1px solid var(--line)" }} required />
          <select name="assigneeId" className="px-3 py-2 rounded-md" style={{ border: "1px solid var(--line)" }}>
            <option value="">Sin asignar</option>
            {users.map((user) => (<option key={user.id} value={user.id}>{user.name}</option>))}
          </select>
          <select name="status" className="px-3 py-2 rounded-md" style={{ border: "1px solid var(--line)" }} defaultValue="TODO">
            <option value="TODO">Por hacer</option>
            <option value="IN_PROGRESS">En progreso</option>
            <option value="REVIEW">Revisión</option>
            <option value="DONE">Hecho</option>
          </select>
          <input name="type" placeholder="Tipo de tarea" className="px-3 py-2 rounded-md" style={{ border: "1px solid var(--line)" }} />
          <input type="number" name="cost" placeholder="Costo (opcional)" min={0} className="px-3 py-2 rounded-md" style={{ border: "1px solid var(--line)" }} />
          <button type="submit" className="px-4 py-2 rounded-md md:col-span-2" style={{ background: "var(--c-forest)", color: "#fff" }}>
            Guardar tarea en calendario
          </button>
        </form>
      </div>

      <div className="grid lg:grid-cols-[1.8fr_0.9fr] gap-8">
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

              const iso = `${selectedYear}-${String(selectedMonthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const dayTasks = tasksByDate.get(iso) ?? [];
              const isToday = iso === new Date().toISOString().slice(0, 10);

              return (
                <form key={day} action={createTaskAction} className="min-h-[120px] border-b border-r p-2" style={{ borderColor: "var(--line)", background: isToday ? "#F7F5F0" : "#fff" }}>
                  <input type="hidden" name="redirectTo" value={redirectTo} />
                  <input type="hidden" name="dueDate" value={iso} />
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
                    <input
                      type="text"
                      name="title"
                      placeholder="Título de la tarea"
                      required
                      className="text-[10px] px-2 py-1 rounded-md w-full"
                      style={{ border: "1px solid var(--line)" }}
                    />
                    <button type="submit" className="text-[10px] px-2 py-1 rounded-md w-full" style={{ border: "1px solid var(--line)", background: "#fff", color: "var(--ink)" }}>
                      + Tarea
                    </button>
                  </div>
                </form>
              );
            })}
          </div>
        </div>

        <aside className="space-y-4">
          <div className="bg-white rounded-lg p-4" style={{ border: "1px solid var(--line)" }}>
            <h2 className="text-lg heading-title mb-3" style={{ color: "var(--ink)" }}>Línea del tiempo</h2>
            {tasks.length === 0 ? (
              <div className="text-sm" style={{ color: "var(--muted)" }}>No hay tareas programadas en este mes.</div>
            ) : (
              <div className="space-y-3">
                {tasks.slice(0, 8).map((task) => (
                  <div key={task.id} className="rounded-lg p-2" style={{ background: "#F7F5F0" }}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm" style={{ color: "var(--ink)" }}>{task.title}</div>
                      <form action={deleteTaskAction} className="inline-block">
                        <input type="hidden" name="id" value={task.id} />
                        <input type="hidden" name="redirectTo" value={redirectTo} />
                        <button type="submit" className="text-[10px] px-2 py-1 rounded-md" style={{ border: "1px solid var(--line)", background: "#fff", color: "var(--c-danger)" }}>Borrar</button>
                      </form>
                    </div>
                    <div className="text-xs mt-1" style={{ color: "var(--muted)" }}>
                      {task.dueDate ? new Date(task.dueDate).toLocaleDateString("es-CL") : "Sin fecha"} · {task.assignee?.name ?? "Sin asignar"}
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <Badge tone={STATUS_TONE[task.status] ?? "neutral"}>{STATUS_LABEL[task.status] ?? task.status}</Badge>
                    </div>
                    <form action={updateTaskAction} className="mt-2 grid gap-2">
                      <input type="hidden" name="id" value={task.id} />
                      <input type="hidden" name="redirectTo" value={redirectTo} />
                      <input
                        type="date"
                        name="dueDate"
                        defaultValue={task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 10) : ""}
                        className="px-2 py-1 rounded-md text-xs"
                        style={{ border: "1px solid var(--line)" }}
                      />
                      <select name="status" defaultValue={task.status} className="px-2 py-1 rounded-md text-xs" style={{ border: "1px solid var(--line)" }}>
                        <option value="TODO">Por hacer</option>
                        <option value="IN_PROGRESS">En progreso</option>
                        <option value="REVIEW">Revisión</option>
                        <option value="DONE">Hecho</option>
                      </select>
                      <select name="assigneeId" defaultValue={task.assigneeId ?? ""} className="px-2 py-1 rounded-md text-xs" style={{ border: "1px solid var(--line)" }}>
                        <option value="">Sin asignar</option>
                        {users.map((user) => (<option key={user.id} value={user.id}>{user.name}</option>))}
                      </select>
                      <input type="number" name="cost" defaultValue={task.cost ?? ""} placeholder="Costo" min={0} className="px-2 py-1 rounded-md text-xs" style={{ border: "1px solid var(--line)" }} />
                      <button type="submit" className="px-3 py-1.5 rounded-md text-[10px]" style={{ background: "var(--c-forest)", color: "#fff" }}>Guardar</button>
                    </form>
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
