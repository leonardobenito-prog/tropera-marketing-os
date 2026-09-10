import { prisma } from "@/lib/prisma";
import { KPICard } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const metrics = await prisma.metric.findMany({
    include: { campaign: true },
    orderBy: { date: "asc" },
  });

  const totals = metrics.reduce(
    (acc, item) => {
      acc.spend += item.spend;
      acc.impressions += item.impressions;
      acc.clicks += item.clicks;
      acc.conversions += item.conversions;
      acc.revenue += item.revenue;
      return acc;
    },
    { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 },
  );

  const campaigns = await prisma.campaign.findMany({
    include: { metrics: true, businessUnit: true },
    orderBy: { startDate: "desc" },
  });

  const campaignPerformance = campaigns
    .map((campaign) => {
      const spend = campaign.metrics.reduce((sum, item) => sum + item.spend, 0);
      const revenue = campaign.metrics.reduce((sum, item) => sum + item.revenue, 0);
      const conversions = campaign.metrics.reduce((sum, item) => sum + item.conversions, 0);
      return {
        ...campaign,
        spend,
        revenue,
        conversions,
        cpa: spend > 0 ? spend / Math.max(conversions, 1) : 0,
      };
    })
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 6);

  const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
  const roas = totals.spend > 0 ? totals.revenue / totals.spend : 0;

  return (
    <div className="p-6 space-y-8">
      <div>
        <div className="text-xs uppercase tracking-[0.18em]" style={{ color: "var(--muted)" }}>
          Analítica digital
        </div>
        <h1 className="text-xl heading-title mt-1" style={{ color: "var(--ink)" }}>
          Rendimiento de campañas
        </h1>
      </div>

      <div className="flex gap-3 flex-wrap">
        <KPICard label="GASTO" value={`$${totals.spend.toLocaleString("es-CL")}`} accent="var(--c-copper)" />
        <KPICard label="IMPRESIONES" value={totals.impressions.toLocaleString("es-CL")} accent="var(--c-forest)" />
        <KPICard label="CLICKS" value={totals.clicks.toLocaleString("es-CL")} accent="var(--c-warning)" />
        <KPICard label="CONVERSIONES" value={totals.conversions.toLocaleString("es-CL")} accent="var(--c-success)" />
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="bg-white rounded-lg p-4" style={{ border: "1px solid var(--line)" }}>
          <div className="text-[11px] uppercase" style={{ color: "var(--muted)" }}>CTR</div>
          <div className="text-2xl mt-2" style={{ color: "var(--ink)" }}>{ctr.toFixed(2)}%</div>
        </div>
        <div className="bg-white rounded-lg p-4" style={{ border: "1px solid var(--line)" }}>
          <div className="text-[11px] uppercase" style={{ color: "var(--muted)" }}>ROAS</div>
          <div className="text-2xl mt-2" style={{ color: "var(--ink)" }}>{roas.toFixed(2)}x</div>
        </div>
        <div className="bg-white rounded-lg p-4" style={{ border: "1px solid var(--line)" }}>
          <div className="text-[11px] uppercase" style={{ color: "var(--muted)" }}>INGRESO</div>
          <div className="text-2xl mt-2" style={{ color: "var(--ink)" }}>${totals.revenue.toLocaleString("es-CL")}</div>
        </div>
      </div>

      <section>
        <h2 className="text-lg heading-title mb-3" style={{ color: "var(--ink)" }}>Top campañas</h2>
        <div className="bg-white rounded-lg overflow-hidden" style={{ border: "1px solid var(--line)" }}>
          <div className="grid text-[11px] px-4 py-2" style={{ gridTemplateColumns: "1.5fr 1fr 1fr 1fr 1fr", color: "var(--muted)", borderBottom: "1px solid var(--line)" }}>
            <div>CAMPAÑA</div>
            <div>GASTO</div>
            <div>INGRESO</div>
            <div>CONV.</div>
            <div>CPA</div>
          </div>
          {campaignPerformance.map((campaign) => (
            <div key={campaign.id} className="grid items-center px-4 py-3 text-sm" style={{ gridTemplateColumns: "1.5fr 1fr 1fr 1fr 1fr", borderBottom: "1px solid var(--line)" }}>
              <div>
                <div style={{ color: "var(--ink)" }}>{campaign.name}</div>
                <div className="text-xs" style={{ color: "var(--muted)" }}>{campaign.businessUnit.name}</div>
              </div>
              <div style={{ color: "var(--ink)" }}>${campaign.spend.toLocaleString("es-CL")}</div>
              <div style={{ color: "var(--ink)" }}>${campaign.revenue.toLocaleString("es-CL")}</div>
              <div style={{ color: "var(--ink)" }}>{campaign.conversions}</div>
              <div style={{ color: "var(--muted)" }}>${campaign.cpa.toLocaleString("es-CL")}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
