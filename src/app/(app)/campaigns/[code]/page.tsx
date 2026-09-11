import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createTaskAction, createProductionProjectAction, updateTaskAction, deleteTaskAction, createBudgetAction } from "@/lib/actions/ops";
import { KPICard, money, execState, ProgressBar } from "@/components/ui";

const FORMAT_OPTIONS = ["Post", "Video", "Reel", "Historia", "Gráfica", "POP", "Mailing", "Otro"];

export const dynamic = "force-dynamic";

export default async function CampaignDetailPage({ params }: { params: { code: string } }) {
  const [campaign, users] = await Promise.all([
    prisma.campaign.findUnique({
      where: { campaignCode: params.code },
      include: {
        businessUnit: true,
        budgets: true,
        expenses: true,
        tasks: { include: { assignee: true } },
        productionProjects: true,
        learnings: true,
      },
    }),
    prisma.user.findMany({ orderBy: { name: "asc" } }),
  ]);

  if (!campaign) notFound();

  const assigned = campaign.budgets.reduce((s, b) => s + b.assignedAmount, 0);
  const actual = campaign.expenses.filter((e) => e.status === "PAID").reduce((s, e) => s + e.amount, 0);
  const committed = campaign.expenses.filter((e) => e.status === "COMMITTED").reduce((s, e) => s + e.amount, 0);
  const available = assigned - actual - committed;
  const ex = execState(assigned, actual, committed);

  return (
    <div className="p-6 space-y-8">
      <div>
        <div className="text-xs" style={{ color: "var(--muted)", fontFamily: "monospace" }}>{campaign.campaignCode}</div>
        <h1 className="text-xl heading-title" style={{ color: "var(--ink)" }}>{campaign.name}</h1>
        <div className="text-sm" style={{ color: "var(--muted)" }}>
          {campaign.businessUnit.name} · {campaign.startDate.toLocaleDateString("es-CL")} — {campaign.endDate.toLocaleDateString("es-CL")}
        </div>
      </div>

      <div>
        <h2 className="text-lg heading-title mb-3" style={{ color: "var(--ink)" }}>Presupuesto</h2>
        <div className="flex gap-3 flex-wrap mb-3">
          <KPICard label="ASIGNADO" value={money(assigned)} accent="var(--c-forest)" />
          <KPICard label="GASTADO" value={money(actual)} accent="var(--c-copper)" />
          <KPICard label="COMPROMETIDO" value={money(committed)} accent="var(--c-warning)" />
          <KPICard label="DISPONIBLE" value={money(available)} accent="var(--c-success)" />
        </div>
        <ProgressBar pct={ex.pct} color={ex.color} />

        <div className="bg-white rounded-lg p-4 mt-4 max-w-md" style={{ border: "1px solid var(--line)" }}>
          <h3 className="text-base heading-title mb-3" style={{ color: "var(--ink)" }}>Asignar presupuesto</h3>
          <form action={createBudgetAction} className="grid gap-3 md:grid-cols-2">
            <input type="hidden" name="campaignId" value={campaign.id} />
            <input type="hidden" name="businessUnitId" value={campaign.businessUnitId} />
            <input type="hidden" name="redirectTo" value={`/campaigns/${campaign.campaignCode}`} />
            <input type="number" name="periodYear" placeholder="Año" min={2024} defaultValue={new Date().getFullYear()} className="px-3 py-2 rounded-md" style={{ border: "1px solid var(--line)" }} required />
            <input type="number" name="assignedAmount" placeholder="Monto a asignar" min={0} className="px-3 py-2 rounded-md" style={{ border: "1px solid var(--line)" }} required />
            <button type="submit" className="px-4 py-2 rounded-md md:col-span-2" style={{ background: "var(--c-forest)", color: "#fff" }}>
              Guardar presupuesto
            </button>
          </form>
        </div>
      </div>

      <datalist id="format-options">
        {FORMAT_OPTIONS.map((f) => (<option key={f} value={f} />))}
      </datalist>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="bg-white rounded-lg p-4" style={{ border: "1px solid var(--line)" }}>
          <h3 className="text-base heading-title mb-3" style={{ color: "var(--ink)" }}>Agregar tarea</h3>
          <form action={createTaskAction} className="grid gap-3">
            <input type="hidden" name="campaignId" value={campaign.id} />
            <input name="title" placeholder="Título de la tarea" className="px-3 py-2 rounded-md" style={{ border: "1px solid var(--line)" }} required />
            <input name="type" placeholder="Tipo" className="px-3 py-2 rounded-md" style={{ border: "1px solid var(--line)" }} />
            <select name="assigneeId" className="px-3 py-2 rounded-md" style={{ border: "1px solid var(--line)" }}>
              <option value="">Sin asignar</option>
              {users.map((user) => (<option key={user.id} value={user.id}>{user.name}</option>))}
            </select>
            <div className="grid gap-3 md:grid-cols-2">
              <input type="date" name="dueDate" className="px-3 py-2 rounded-md" style={{ border: "1px solid var(--line)" }} />
              <input type="number" name="cost" placeholder="Costo" className="px-3 py-2 rounded-md" style={{ border: "1px solid var(--line)" }} />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <select name="priority" className="px-3 py-2 rounded-md" style={{ border: "1px solid var(--line)" }} defaultValue="MEDIUM">
                <option value="LOW">Baja</option>
                <option value="MEDIUM">Media</option>
                <option value="HIGH">Alta</option>
              </select>
              <select name="status" className="px-3 py-2 rounded-md" style={{ border: "1px solid var(--line)" }} defaultValue="TODO">
                <option value="TODO">Por hacer</option>
                <option value="IN_PROGRESS">En progreso</option>
                <option value="REVIEW">Revisión</option>
                <option value="DONE">Hecho</option>
              </select>
            </div>
            <button type="submit" className="px-4 py-2 rounded-md" style={{ background: "var(--c-forest)", color: "#fff" }}>
              Guardar tarea
            </button>
          </form>
        </div>

        <div className="bg-white rounded-lg p-4" style={{ border: "1px solid var(--line)" }}>
          <h3 className="text-base heading-title mb-3" style={{ color: "var(--ink)" }}>Nuevo proyecto de producción</h3>
          <form action={createProductionProjectAction} className="grid gap-3">
            <input type="hidden" name="campaignId" value={campaign.id} />
            <input name="name" placeholder="Nombre del proyecto" className="px-3 py-2 rounded-md" style={{ border: "1px solid var(--line)" }} required />
            <input name="format" list="format-options" placeholder="Formato (Post, Video, Reel...)" defaultValue="Post" className="px-3 py-2 rounded-md" style={{ border: "1px solid var(--line)" }} required />
            <select name="assigneeId" className="px-3 py-2 rounded-md" style={{ border: "1px solid var(--line)" }}>
              <option value="">Responsable (opcional)</option>
              {users.map((user) => (<option key={user.id} value={user.id}>{user.name}</option>))}
            </select>
            <div className="grid gap-3 md:grid-cols-2">
              <input type="date" name="dueDate" className="px-3 py-2 rounded-md" style={{ border: "1px solid var(--line)" }} />
              <input type="number" name="budgetAmount" placeholder="Presupuesto (opcional)" min={0} className="px-3 py-2 rounded-md" style={{ border: "1px solid var(--line)" }} />
            </div>
            <select name="status" className="px-3 py-2 rounded-md" style={{ border: "1px solid var(--line)" }} defaultValue="BACKLOG">
              <option value="BACKLOG">Backlog</option>
              <option value="IN_PRODUCTION">En producción</option>
              <option value="REVIEW">Revisión</option>
              <option value="APPROVED">Aprobado</option>
              <option value="PUBLISHED">Publicado</option>
              <option value="IMPLEMENTED">Implementado</option>
            </select>
            <input name="referenceUrl" placeholder="Link de referencia (opcional)" className="px-3 py-2 rounded-md" style={{ border: "1px solid var(--line)" }} />
            <textarea name="notes" placeholder="Observaciones" className="px-3 py-2 rounded-md" style={{ border: "1px solid var(--line)" }} rows={2} />
            <button type="submit" className="px-4 py-2 rounded-md" style={{ background: "var(--c-forest)", color: "#fff" }}>
              Crear proyecto
            </button>
          </form>
        </div>
      </div>

      <div>
        <h2 className="text-lg heading-title mb-3" style={{ color: "var(--ink)" }}>Tareas</h2>
        <div className="space-y-3">
          {campaign.tasks.map((t) => (
            <div key={t.id} className="px-4 py-3 bg-white rounded-lg text-sm" style={{ border: "1px solid var(--line)" }}>
              <div className="flex items-center justify-between gap-3">
                <span>{t.title}</span>
                <form action={deleteTaskAction} className="inline-block">
                  <input type="hidden" name="id" value={t.id} />
                  <button type="submit" className="text-[11px] px-2 py-1 rounded-md" style={{ border: "1px solid var(--line)", background: "#fff", color: "var(--c-danger)" }}>Borrar</button>
                </form>
              </div>
              <form action={updateTaskAction} className="mt-3 grid gap-2 md:grid-cols-5">
                <input type="hidden" name="id" value={t.id} />
                <input type="hidden" name="campaignId" value={campaign.id} />
                <input name="title" defaultValue={t.title} className="px-2 py-1.5 rounded-md text-xs" style={{ border: "1px solid var(--line)" }} />
                <select name="assigneeId" defaultValue={t.assigneeId ?? ""} className="px-2 py-1.5 rounded-md text-xs" style={{ border: "1px solid var(--line)" }}>
                  <option value="">Sin asignar</option>
                  {users.map((user) => (<option key={user.id} value={user.id}>{user.name}</option>))}
                </select>
                <input type="date" name="dueDate" defaultValue={t.dueDate ? new Date(t.dueDate).toISOString().slice(0, 10) : ""} className="px-2 py-1.5 rounded-md text-xs" style={{ border: "1px solid var(--line)" }} />
                <select name="status" defaultValue={t.status} className="px-2 py-1.5 rounded-md text-xs" style={{ border: "1px solid var(--line)" }}>
                  <option value="TODO">Por hacer</option>
                  <option value="IN_PROGRESS">En progreso</option>
                  <option value="REVIEW">Revisión</option>
                  <option value="DONE">Hecho</option>
                </select>
                <input type="number" name="cost" defaultValue={t.cost ?? ""} className="px-2 py-1.5 rounded-md text-xs md:col-span-2" style={{ border: "1px solid var(--line)" }} />
                <select name="priority" defaultValue={t.priority} className="px-2 py-1.5 rounded-md text-xs md:col-span-2" style={{ border: "1px solid var(--line)" }}>
                  <option value="LOW">Baja</option>
                  <option value="MEDIUM">Media</option>
                  <option value="HIGH">Alta</option>
                </select>
                <button type="submit" className="px-3 py-1.5 rounded-md md:col-span-1" style={{ background: "var(--c-forest)", color: "#fff" }}>Guardar</button>
              </form>
            </div>
          ))}
          {campaign.tasks.length === 0 && (
            <div className="text-sm px-4 py-3 rounded-lg" style={{ color: "var(--muted)", border: "1px dashed var(--line)" }}>
              Sin tareas registradas.
            </div>
          )}
        </div>
      </div>

      <div>
        <h2 className="text-lg heading-title mb-3" style={{ color: "var(--ink)" }}>Aprendizajes</h2>
        {campaign.learnings.length === 0 ? (
          <div className="text-sm px-4 py-3 rounded-lg" style={{ color: "var(--muted)", border: "1px dashed var(--line)" }}>
            Sin aprendizajes registrados todavía — se completan al cerrar la campaña.
          </div>
        ) : (
          campaign.learnings.map((l) => (
            <div key={l.id} className="px-4 py-3 bg-white rounded-lg text-sm mb-2" style={{ border: "1px solid var(--line)" }}>
              {l.whatWorked}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
