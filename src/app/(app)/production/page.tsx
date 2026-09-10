import { prisma } from "@/lib/prisma";
import { createProductionProjectAction, updateProductionProjectAction, deleteProductionProjectAction } from "@/lib/actions/ops";
import { Badge, KPICard } from "@/components/ui";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  BACKLOG: "Backlog",
  IN_PRODUCTION: "En producción",
  REVIEW: "Revisión",
  APPROVED: "Aprobado",
  PUBLISHED: "Publicado",
  IMPLEMENTED: "Implementado",
};

const STATUS_TONE: Record<string, "neutral" | "warning" | "success" | "danger"> = {
  BACKLOG: "neutral",
  IN_PRODUCTION: "warning",
  REVIEW: "success",
  APPROVED: "success",
  PUBLISHED: "success",
  IMPLEMENTED: "success",
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

export default async function ProductionPage() {
  const [projects, tasksByProject, campaigns] = await Promise.all([
    prisma.productionProject.findMany({
      include: {
        campaign: true,
        tasks: { include: { assignee: true } },
        assets: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.task.groupBy({
      by: ["productionProjectId"],
      _count: { id: true },
      where: { productionProjectId: { not: null } },
    }),
    prisma.campaign.findMany({ orderBy: { name: "asc" } }),
  ]);

  const taskCounts = Object.fromEntries(tasksByProject.map((entry) => [entry.productionProjectId, entry._count.id]));

  const activeProjects = projects.filter((p) => p.status !== "IMPLEMENTED").length;
  const assetsReady = projects.reduce((sum, p) => sum + p.assets.filter((a) => a.status === "DRAFT").length, 0);
  const tasksInProgress = projects.reduce((sum, p) => sum + p.tasks.filter((t) => t.status === "IN_PROGRESS").length, 0);

  return (
    <div className="p-6 space-y-8">
      <div>
        <div className="text-xs uppercase tracking-[0.18em]" style={{ color: "var(--muted)" }}>
          Producción
        </div>
        <h1 className="text-xl heading-title mt-1" style={{ color: "var(--ink)" }}>
          Pipeline creativo
        </h1>
      </div>

      <div className="bg-white rounded-lg p-4" style={{ border: "1px solid var(--line)" }}>
        <h2 className="text-lg heading-title mb-3" style={{ color: "var(--ink)" }}>Crear proyecto</h2>
        <form action={createProductionProjectAction} className="grid gap-3 md:grid-cols-3">
          <input name="name" placeholder="Nombre del proyecto" className="px-3 py-2 rounded-md" style={{ border: "1px solid var(--line)" }} required />
          <select name="campaignId" className="px-3 py-2 rounded-md" style={{ border: "1px solid var(--line)" }}>
            <option value="">Sin campaña</option>
            {campaigns.map((campaign) => (<option key={campaign.id} value={campaign.id}>{campaign.name}</option>))}
          </select>
          <select name="purpose" className="px-3 py-2 rounded-md" style={{ border: "1px solid var(--line)" }} defaultValue="CAMPAIGN">
            <option value="CAMPAIGN">Campaña</option>
            <option value="EVERGREEN">Evergreen</option>
            <option value="BRAND">Marca</option>
          </select>
          <select name="status" className="px-3 py-2 rounded-md md:col-span-2" style={{ border: "1px solid var(--line)" }} defaultValue="BACKLOG">
            <option value="BACKLOG">Backlog</option>
            <option value="IN_PRODUCTION">En producción</option>
            <option value="REVIEW">Revisión</option>
            <option value="APPROVED">Aprobado</option>
            <option value="PUBLISHED">Publicado</option>
            <option value="IMPLEMENTED">Implementado</option>
          </select>
          <button type="submit" className="px-4 py-2 rounded-md" style={{ background: "var(--c-forest)", color: "#fff" }}>
            Guardar proyecto
          </button>
        </form>
      </div>

      <div className="flex gap-3 flex-wrap">
        <KPICard label="PROYECTOS ACTIVOS" value={activeProjects} accent="var(--c-forest)" />
        <KPICard label="TAREAS EN CURSO" value={tasksInProgress} accent="var(--c-copper)" />
        <KPICard label="ASSETS EN BORRADOR" value={assetsReady} accent="var(--c-warning)" />
        <KPICard label="TOTAL PROYECTOS" value={projects.length} accent="var(--c-success)" />
      </div>

      <div className="space-y-4">
        {projects.map((project) => (
          <div key={project.id} className="bg-white rounded-lg p-4" style={{ border: "1px solid var(--line)" }}>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="text-sm font-medium" style={{ color: "var(--ink)" }}>{project.name}</div>
                <div className="text-xs mt-1" style={{ color: "var(--muted)" }}>
                  {project.campaign?.name ?? "Proyecto independiente"} · {project.purpose}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={STATUS_TONE[project.status] ?? "neutral"}>{STATUS_LABEL[project.status] ?? project.status}</Badge>
                <span className="text-xs" style={{ color: "var(--muted)" }}>{taskCounts[project.id] ?? project.tasks.length} tareas</span>
              </div>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div>
                <div className="text-[11px] uppercase mb-2" style={{ color: "var(--muted)" }}>Tareas</div>
                {project.tasks.length === 0 ? (
                  <div className="text-sm" style={{ color: "var(--muted)" }}>Sin tareas asignadas.</div>
                ) : (
                  <div className="space-y-2">
                    {project.tasks.slice(0, 4).map((task) => (
                      <div key={task.id} className="flex items-center justify-between gap-3 rounded-lg p-2" style={{ background: "#F7F5F0" }}>
                        <div>
                          <div className="text-sm" style={{ color: "var(--ink)" }}>{task.title}</div>
                          <div className="text-xs" style={{ color: "var(--muted)" }}>{task.assignee?.name ?? "Sin asignar"}</div>
                        </div>
                        <Badge tone={TASK_STATUS_TONE[task.status] ?? "neutral"}>{TASK_STATUS_LABEL[task.status] ?? task.status}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <div className="text-[11px] uppercase mb-2" style={{ color: "var(--muted)" }}>Assets</div>
                {project.assets.length === 0 ? (
                  <div className="text-sm" style={{ color: "var(--muted)" }}>Sin assets cargados.</div>
                ) : (
                  <div className="space-y-2">
                    {project.assets.slice(0, 4).map((asset) => (
                      <div key={asset.id} className="flex items-center justify-between gap-3 rounded-lg p-2" style={{ background: "#F7F5F0" }}>
                        <div>
                          <div className="text-sm" style={{ color: "var(--ink)" }}>{asset.type}</div>
                          <div className="text-xs" style={{ color: "var(--muted)" }}>Versión {asset.version}</div>
                        </div>
                        <Badge tone={asset.status === "DRAFT" ? "warning" : "success"}>{asset.status}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--line)" }}>
              <div className="flex items-center justify-between gap-3">
                <div className="text-[11px] uppercase" style={{ color: "var(--muted)" }}>Editar proyecto</div>
                <form action={deleteProductionProjectAction} className="inline-block">
                  <input type="hidden" name="id" value={project.id} />
                  <button type="submit" className="text-[11px] px-2 py-1 rounded-md" style={{ border: "1px solid var(--line)", background: "#fff", color: "var(--c-danger)" }}>Eliminar</button>
                </form>
              </div>

              <form action={updateProductionProjectAction} className="mt-3 grid gap-2 md:grid-cols-4">
                <input type="hidden" name="id" value={project.id} />
                <input name="name" defaultValue={project.name} className="px-2 py-1.5 rounded-md text-xs" style={{ border: "1px solid var(--line)" }} />
                <select name="campaignId" defaultValue={project.campaignId ?? ""} className="px-2 py-1.5 rounded-md text-xs" style={{ border: "1px solid var(--line)" }}>
                  <option value="">Sin campaña</option>
                  {campaigns.map((campaign) => (<option key={campaign.id} value={campaign.id}>{campaign.name}</option>))}
                </select>
                <select name="purpose" defaultValue={project.purpose} className="px-2 py-1.5 rounded-md text-xs" style={{ border: "1px solid var(--line)" }}>
                  <option value="CAMPAIGN">Campaña</option>
                  <option value="EVERGREEN">Evergreen</option>
                  <option value="BRAND">Marca</option>
                </select>
                <select name="status" defaultValue={project.status} className="px-2 py-1.5 rounded-md text-xs" style={{ border: "1px solid var(--line)" }}>
                  <option value="BACKLOG">Backlog</option>
                  <option value="IN_PRODUCTION">En producción</option>
                  <option value="REVIEW">Revisión</option>
                  <option value="APPROVED">Aprobado</option>
                  <option value="PUBLISHED">Publicado</option>
                  <option value="IMPLEMENTED">Implementado</option>
                </select>
                <button type="submit" className="px-3 py-1.5 rounded-md md:col-span-4" style={{ background: "var(--c-forest)", color: "#fff" }}>Guardar proyecto</button>
              </form>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
