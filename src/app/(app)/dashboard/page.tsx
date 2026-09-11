import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { KPICard, Badge, money } from "@/components/ui";

export const dynamic = "force-dynamic"; // siempre datos frescos, sin caché — es un panel operativo

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Activa", COMPLETED: "Finalizada", DRAFT: "Borrador", PAUSED: "Pausada", CANCELLED: "Cancelada",
};
const STATUS_TONE: Record<string, "success" | "warning" | "neutral"> = {
  ACTIVE: "success", COMPLETED: "success", DRAFT: "neutral", PAUSED: "warning", CANCELLED: "neutral",
};

function SectionHeader({ title, href }: { title: string; href: string }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-lg heading-title" style={{ color: "var(--ink)" }}>{title}</h2>
      <Link href={href} className="text-xs" style={{ color: "var(--c-copper)" }}>Ver detalle →</Link>
    </div>
  );
}

export default async function DashboardPage() {
  const [campaigns, metrics, overdueTasks, todayTasks] = await Promise.all([
    prisma.campaign.findMany({
      include: { expenses: true, budgets: true, businessUnit: true },
      orderBy: { startDate: "desc" },
    }),
    prisma.metric.findMany(),
    prisma.task.count({ where: { dueDate: { lt: new Date() }, status: { not: "DONE" } } }),
    prisma.task.count({
      where: {
        dueDate: { gte: new Date(new Date().setHours(0, 0, 0, 0)), lt: new Date(new Date().setHours(23, 59, 59, 999)) },
      },
    }),
  ]);

  const assigned = campaigns.reduce((a, c) => a + c.budgets.reduce((s, b) => s + b.assignedAmount, 0), 0);
  const actual = campaigns.reduce((a, c) => a + c.expenses.filter((e) => e.status === "PAID").reduce((s, e) => s + e.amount, 0), 0);
  const committed = campaigns.reduce((a, c) => a + c.expenses.filter((e) => e.status === "COMMITTED").reduce((s, e) => s + e.amount, 0), 0);
  const available = assigned - actual - committed;
  const pct = assigned > 0 ? Math.round(((actual + committed) / assigned) * 100) : 0;

  const active = campaigns.filter((c) => c.status === "ACTIVE").length;
  const recentCampaigns = campaigns.slice(0, 4);

  const metricTotals = metrics.reduce(
    (acc, m) => {
      acc.spend += m.spend;
      acc.impressions += m.impressions;
      acc.clicks += m.clicks;
      acc.conversions += m.conversions;
      acc.revenue += m.revenue;
      return acc;
    },
    { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 },
  );
  const ctr = metricTotals.impressions > 0 ? (metricTotals.clicks / metricTotals.impressions) * 100 : 0;
  const roas = metricTotals.spend > 0 ? metricTotals.revenue / metricTotals.spend : 0;

  return (
    <div className="p-6 space-y-8">
      <h1 className="text-xl heading-title" style={{ color: "var(--ink)" }}>Centro de Comando de Marketing</h1>

      <div>
        <SectionHeader title="Presupuesto consolidado" href="/budget" />
        <div className="flex gap-3 flex-wrap">
          <KPICard label="ASIGNADO" value={money(assigned)} accent="var(--c-forest)" />
          <KPICard label="GASTADO" value={money(actual)} accent="var(--c-copper)" />
          <KPICard label="COMPROMETIDO" value={money(committed)} accent="var(--c-warning)" />
          <KPICard label="DISPONIBLE" value={money(available)} accent="var(--c-success)" />
          <KPICard label="% EJECUTADO" value={`${pct}%`} accent={pct > 100 ? "var(--c-danger)" : "var(--c-forest)"} />
        </div>
      </div>

      <div>
        <SectionHeader title="Analítica digital" href="/analytics" />
        <div className="flex gap-3 flex-wrap">
          <KPICard label="GASTO" value={money(metricTotals.spend)} accent="var(--c-copper)" />
          <KPICard label="IMPRESIONES" value={metricTotals.impressions.toLocaleString("es-CL")} accent="var(--c-forest)" />
          <KPICard label="CLICKS" value={metricTotals.clicks.toLocaleString("es-CL")} accent="var(--c-warning)" />
          <KPICard label="CONVERSIONES" value={metricTotals.conversions.toLocaleString("es-CL")} accent="var(--c-success)" />
          <KPICard label="CTR" value={`${ctr.toFixed(2)}%`} accent="var(--c-forest)" />
          <KPICard label="ROAS" value={`${roas.toFixed(2)}x`} accent="var(--c-success)" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <SectionHeader title="Campañas" href="/campaigns" />
          <div className="flex gap-3 flex-wrap mb-4">
            <KPICard label="ACTIVAS" value={active} accent="var(--c-success)" />
            <KPICard label="TOTAL" value={campaigns.length} accent="var(--c-forest)" />
          </div>
          <div className="bg-white rounded-lg overflow-hidden" style={{ border: "1px solid var(--line)" }}>
            {recentCampaigns.length === 0 && (
              <div className="px-4 py-3 text-sm" style={{ color: "var(--muted)" }}>Sin campañas aún.</div>
            )}
            {recentCampaigns.map((c) => (
              <Link
                key={c.id}
                href={`/campaigns/${c.campaignCode}`}
                className="flex items-center justify-between px-4 py-3 text-sm"
                style={{ borderBottom: "1px solid var(--line)" }}
              >
                <div className="min-w-0">
                  <div style={{ color: "var(--ink)" }}>{c.name}</div>
                  <div className="text-xs truncate" style={{ color: "var(--muted)" }}>{c.businessUnit.name}</div>
                </div>
                <Badge tone={STATUS_TONE[c.status] || "neutral"}>{STATUS_LABEL[c.status] || c.status}</Badge>
              </Link>
            ))}
          </div>
        </div>
        <div>
          <SectionHeader title="Tareas" href="/today" />
          <div className="flex gap-3 flex-wrap">
            <KPICard label="ATRASADAS" value={overdueTasks} accent="var(--c-danger)" />
            <KPICard label="HOY" value={todayTasks} accent="var(--c-copper)" />
          </div>
        </div>
      </div>
    </div>
  );
}
