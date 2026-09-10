import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { KPICard, money, execState, ProgressBar } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function CampaignDetailPage({ params }: { params: { code: string } }) {
  const campaign = await prisma.campaign.findUnique({
    where: { campaignCode: params.code },
    include: {
      businessUnit: true,
      budgets: true,
      expenses: true,
      tasks: { include: { assignee: true } },
      productionProjects: true,
      learnings: true,
    },
  });

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
      </div>

      <div>
        <h2 className="text-lg heading-title mb-3" style={{ color: "var(--ink)" }}>Tareas</h2>
        <div className="space-y-2">
          {campaign.tasks.map((t) => (
            <div key={t.id} className="flex items-center justify-between px-4 py-3 bg-white rounded-lg text-sm" style={{ border: "1px solid var(--line)" }}>
              <span>{t.title}</span>
              <span style={{ color: "var(--muted)" }}>{t.assignee?.name ?? "Sin asignar"}</span>
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
