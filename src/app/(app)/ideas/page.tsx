import { prisma } from "@/lib/prisma";
import { Badge, KPICard } from "@/components/ui";

export const dynamic = "force-dynamic";

const IDEA_STATUS_LABEL: Record<string, string> = {
  IDEA: "Idea",
  EVALUATION: "Evaluación",
  BUDGETING: "Presupuesto",
  APPROVED: "Aprobada",
  PRODUCTION: "Producción",
  IMPLEMENTED: "Implementada",
  REJECTED: "Rechazada",
  ARCHIVED: "Archivada",
};

const IDEA_STATUS_TONE: Record<string, "neutral" | "warning" | "success" | "danger"> = {
  IDEA: "neutral",
  EVALUATION: "warning",
  BUDGETING: "warning",
  APPROVED: "success",
  PRODUCTION: "success",
  IMPLEMENTED: "success",
  REJECTED: "danger",
  ARCHIVED: "neutral",
};

export default async function IdeasPage() {
  const ideas = await prisma.idea.findMany({
    include: { businessUnit: true, owner: true },
    orderBy: { createdAt: "desc" },
  });

  const totalsByStatus = {
    IDEA: ideas.filter((idea) => idea.status === "IDEA").length,
    EVALUATION: ideas.filter((idea) => idea.status === "EVALUATION").length,
    BUDGETING: ideas.filter((idea) => idea.status === "BUDGETING").length,
    APPROVED: ideas.filter((idea) => idea.status === "APPROVED").length,
    PRODUCTION: ideas.filter((idea) => idea.status === "PRODUCTION").length,
    IMPLEMENTED: ideas.filter((idea) => idea.status === "IMPLEMENTED").length,
  };

  return (
    <div className="p-6 space-y-8">
      <div>
        <div className="text-xs uppercase tracking-[0.18em]" style={{ color: "var(--muted)" }}>
          Ideas
        </div>
        <h1 className="text-xl heading-title mt-1" style={{ color: "var(--ink)" }}>
          Pipeline de innovación
        </h1>
      </div>

      <div className="flex gap-3 flex-wrap">
        <KPICard label="IDEAS" value={ideas.length} accent="var(--c-forest)" />
        <KPICard label="EVALUACIÓN" value={totalsByStatus.EVALUATION} accent="var(--c-warning)" />
        <KPICard label="PRESUPUESTO" value={totalsByStatus.BUDGETING} accent="var(--c-copper)" />
        <KPICard label="APROBADAS" value={totalsByStatus.APPROVED} accent="var(--c-success)" />
      </div>

      <div className="space-y-4">
        {ideas.map((idea) => (
          <div key={idea.id} className="bg-white rounded-lg p-4" style={{ border: "1px solid var(--line)" }}>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="text-sm font-medium" style={{ color: "var(--ink)" }}>{idea.title}</div>
                <div className="text-xs mt-1" style={{ color: "var(--muted)" }}>{idea.businessUnit.name}</div>
              </div>
              <Badge tone={IDEA_STATUS_TONE[idea.status] ?? "neutral"}>{IDEA_STATUS_LABEL[idea.status] ?? idea.status}</Badge>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-4 text-sm">
              <div>
                <div className="text-[11px] uppercase" style={{ color: "var(--muted)" }}>Objetivo</div>
                <div className="mt-1" style={{ color: "var(--ink)" }}>{idea.objective ?? "—"}</div>
              </div>
              <div>
                <div className="text-[11px] uppercase" style={{ color: "var(--muted)" }}>Impacto</div>
                <div className="mt-1" style={{ color: "var(--ink)" }}>{idea.impact ?? "—"}</div>
              </div>
              <div>
                <div className="text-[11px] uppercase" style={{ color: "var(--muted)" }}>Costo estimado</div>
                <div className="mt-1" style={{ color: "var(--ink)" }}>{idea.estimatedCost ? `$${idea.estimatedCost.toLocaleString("es-CL")}` : "—"}</div>
              </div>
              <div>
                <div className="text-[11px] uppercase" style={{ color: "var(--muted)" }}>Responsable</div>
                <div className="mt-1" style={{ color: "var(--ink)" }}>{idea.owner?.name ?? "Sin responsable"}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
