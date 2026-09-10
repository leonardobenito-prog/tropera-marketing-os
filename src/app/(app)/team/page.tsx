import { prisma } from "@/lib/prisma";
import { Badge, KPICard } from "@/components/ui";

export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Admin",
  MARKETING_MANAGER: "Marketing Manager",
  TEAM_MEMBER: "Team Member",
  VIEWER: "Viewer",
};

const TASK_STATUS_LABEL: Record<string, string> = {
  TODO: "Por hacer",
  IN_PROGRESS: "En progreso",
  REVIEW: "Revisión",
  DONE: "Hecho",
};

const TASK_STATUS_TONE: Record<string, "neutral" | "warning" | "success"> = {
  TODO: "neutral",
  IN_PROGRESS: "warning",
  REVIEW: "success",
  DONE: "success",
};

export default async function TeamPage() {
  const users = await prisma.user.findMany({
    include: {
      functionalRoles: true,
      assignedTasks: true,
      ownedCampaigns: true,
    },
    orderBy: { name: "asc" },
  });

  const totalTasks = users.reduce((sum, user) => sum + user.assignedTasks.length, 0);
  const activeMembers = users.filter((user) => user.assignedTasks.length > 0 || user.ownedCampaigns.length > 0).length;

  return (
    <div className="p-6 space-y-8">
      <div>
        <div className="text-xs uppercase tracking-[0.18em]" style={{ color: "var(--muted)" }}>
          Equipo
        </div>
        <h1 className="text-xl heading-title mt-1" style={{ color: "var(--ink)" }}>
          Organización y carga de trabajo
        </h1>
      </div>

      <div className="flex gap-3 flex-wrap">
        <KPICard label="MIEMBROS" value={users.length} accent="var(--c-forest)" />
        <KPICard label="ACTIVOS" value={activeMembers} accent="var(--c-copper)" />
        <KPICard label="TAREAS ASIGNADAS" value={totalTasks} accent="var(--c-warning)" />
      </div>

      <div className="space-y-4">
        {users.map((user) => (
          <div key={user.id} className="bg-white rounded-lg p-4" style={{ border: "1px solid var(--line)" }}>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="text-sm font-medium" style={{ color: "var(--ink)" }}>{user.name}</div>
                <div className="text-xs mt-1" style={{ color: "var(--muted)" }}>{user.email}</div>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={user.systemRole === "ADMIN" ? "success" : "neutral"}>{ROLE_LABEL[user.systemRole] ?? user.systemRole}</Badge>
                <span className="text-xs" style={{ color: "var(--muted)" }}>{user.functionalRoles.map((role) => role.name).join(", ") || "Sin roles funcionales"}</span>
              </div>
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              <div>
                <div className="text-[11px] uppercase mb-2" style={{ color: "var(--muted)" }}>Campañas</div>
                {user.ownedCampaigns.length === 0 ? (
                  <div className="text-sm" style={{ color: "var(--muted)" }}>Sin campañas asignadas.</div>
                ) : (
                  <div className="space-y-2">
                    {user.ownedCampaigns.slice(0, 3).map((campaign) => (
                      <div key={campaign.id} className="rounded-lg p-2 text-sm" style={{ background: "#F7F5F0", color: "var(--ink)" }}>
                        {campaign.name}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <div className="text-[11px] uppercase mb-2" style={{ color: "var(--muted)" }}>Tareas</div>
                {user.assignedTasks.length === 0 ? (
                  <div className="text-sm" style={{ color: "var(--muted)" }}>Sin tareas asignadas.</div>
                ) : (
                  <div className="space-y-2">
                    {user.assignedTasks.slice(0, 3).map((task) => (
                      <div key={task.id} className="flex items-center justify-between gap-3 rounded-lg p-2" style={{ background: "#F7F5F0" }}>
                        <div>
                          <div className="text-sm" style={{ color: "var(--ink)" }}>{task.title}</div>
                          <div className="text-xs" style={{ color: "var(--muted)" }}>{task.dueDate ? new Date(task.dueDate).toLocaleDateString("es-CL") : "Sin fecha"}</div>
                        </div>
                        <Badge tone={TASK_STATUS_TONE[task.status] ?? "neutral"}>{TASK_STATUS_LABEL[task.status] ?? task.status}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
