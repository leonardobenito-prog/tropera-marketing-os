import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Badge, ProgressBar, execState, money } from "@/components/ui";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Activa", IN_PRODUCTION: "En producción", COMPLETED: "Finalizada",
  DRAFT: "Borrador", PAUSED: "Pausada", CANCELLED: "Cancelada",
};
const STATUS_TONE: Record<string, "success" | "warning" | "neutral"> = {
  ACTIVE: "success", COMPLETED: "success", DRAFT: "neutral", PAUSED: "warning", CANCELLED: "neutral",
};

export default async function CampaignsPage() {
  const campaigns = await prisma.campaign.findMany({
    include: { businessUnit: true, budgets: true, expenses: true },
    orderBy: { startDate: "desc" },
  });

  return (
    <div className="p-6">
      <h1 className="text-xl heading-title mb-4" style={{ color: "var(--ink)" }}>Campañas</h1>

      <div className="bg-white rounded-lg overflow-hidden" style={{ border: "1px solid var(--line)" }}>
        <div className="grid text-[11px] px-4 py-2" style={{ gridTemplateColumns: "1.6fr 1fr 1fr 1.4fr 0.8fr", color: "var(--muted)", borderBottom: "1px solid var(--line)" }}>
          <div>CAMPAÑA</div><div>UNIDAD</div><div>ESTADO</div><div>EJECUCIÓN</div><div>ID</div>
        </div>
        {campaigns.map((c) => {
          const assigned = c.budgets.reduce((s, b) => s + b.assignedAmount, 0);
          const actual = c.expenses.filter((e) => e.status === "PAID").reduce((s, e) => s + e.amount, 0);
          const committed = c.expenses.filter((e) => e.status === "COMMITTED").reduce((s, e) => s + e.amount, 0);
          const ex = execState(assigned, actual, committed);
          return (
            <Link
              key={c.id}
              href={`/campaigns/${c.campaignCode}`}
              className="grid items-center px-4 py-3 text-sm"
              style={{ gridTemplateColumns: "1.6fr 1fr 1fr 1.4fr 0.8fr", borderBottom: "1px solid var(--line)" }}
            >
              <div>
                <div style={{ color: "var(--ink)" }}>{c.name}</div>
                <div className="text-xs" style={{ color: "var(--muted)" }}>
                  {c.startDate.toLocaleDateString("es-CL")} — {c.endDate.toLocaleDateString("es-CL")}
                </div>
              </div>
              <div style={{ color: "var(--ink)" }}>{c.businessUnit.name}</div>
              <div><Badge tone={STATUS_TONE[c.status] || "neutral"}>{STATUS_LABEL[c.status] || c.status}</Badge></div>
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span style={{ color: "var(--muted)" }}>{Math.round(ex.pct * 100)}%</span>
                  <span style={{ color: ex.color }}>{ex.label}</span>
                </div>
                <ProgressBar pct={ex.pct} color={ex.color} />
              </div>
              <div className="text-xs" style={{ color: "var(--muted)", fontFamily: "monospace" }}>{c.campaignCode}</div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
