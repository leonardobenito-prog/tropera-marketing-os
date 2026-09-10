import { prisma } from "@/lib/prisma";
import { Badge, KPICard } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AdvertisingPage() {
  const [accounts, campaigns, metrics] = await Promise.all([
    prisma.adAccount.findMany({
      include: {
        platform: true,
        businessUnit: true,
        digitalAdCampaigns: { include: { metricsRaw: true } },
      },
      orderBy: { connectedAt: "desc" },
    }),
    prisma.campaign.findMany({
      include: { metrics: true, businessUnit: true },
      orderBy: { startDate: "desc" },
    }),
    prisma.metric.findMany({
      orderBy: { date: "desc" },
      take: 40,
    }),
  ]);

  const totalSpend = metrics.reduce((sum, metric) => sum + metric.spend, 0);
  const totalClicks = metrics.reduce((sum, metric) => sum + metric.clicks, 0);
  const totalImpressions = metrics.reduce((sum, metric) => sum + metric.impressions, 0);
  const campaignWithSpend = campaigns.filter((campaign) => campaign.metrics.length > 0).length;

  return (
    <div className="p-6 space-y-8">
      <div>
        <div className="text-xs uppercase tracking-[0.18em]" style={{ color: "var(--muted)" }}>
          Publicidad
        </div>
        <h1 className="text-xl heading-title mt-1" style={{ color: "var(--ink)" }}>
          Campañas y cuentas conectadas
        </h1>
      </div>

      <div className="flex gap-3 flex-wrap">
        <KPICard label="CUENTAS" value={accounts.length} accent="var(--c-forest)" />
        <KPICard label="GASTO TOTAL" value={`$${totalSpend.toLocaleString("es-CL")}`} accent="var(--c-copper)" />
        <KPICard label="CLICKS" value={totalClicks.toLocaleString("es-CL")} accent="var(--c-warning)" />
        <KPICard label="IMPRESIONES" value={totalImpressions.toLocaleString("es-CL")} accent="var(--c-success)" />
      </div>

      <div className="grid gap-8 xl:grid-cols-2">
        <section>
          <h2 className="text-lg heading-title mb-3" style={{ color: "var(--ink)" }}>Cuentas conectadas</h2>
          <div className="space-y-3">
            {accounts.map((account) => (
              <div key={account.id} className="bg-white rounded-lg p-4" style={{ border: "1px solid var(--line)" }}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium" style={{ color: "var(--ink)" }}>{account.platform.name}</div>
                    <div className="text-xs mt-1" style={{ color: "var(--muted)" }}>{account.businessUnit.name}</div>
                  </div>
                  <Badge tone="success">Conectada</Badge>
                </div>
                <div className="mt-3 text-xs" style={{ color: "var(--muted)" }}>
                  ID externo: {account.externalAccountId}
                </div>
              </div>
            ))}
            {accounts.length === 0 && (
              <div className="text-sm px-4 py-3 rounded-lg" style={{ color: "var(--muted)", border: "1px dashed var(--line)" }}>
                No hay cuentas conectadas todavía.
              </div>
            )}
          </div>
        </section>

        <section>
          <h2 className="text-lg heading-title mb-3" style={{ color: "var(--ink)" }}>Campañas con métricas</h2>
          <div className="space-y-3">
            {campaigns.map((campaign) => {
              const spend = campaign.metrics.reduce((sum, metric) => sum + metric.spend, 0);
              const clicks = campaign.metrics.reduce((sum, metric) => sum + metric.clicks, 0);
              return (
                <div key={campaign.id} className="bg-white rounded-lg p-4" style={{ border: "1px solid var(--line)" }}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium" style={{ color: "var(--ink)" }}>{campaign.name}</div>
                      <div className="text-xs mt-1" style={{ color: "var(--muted)" }}>{campaign.businessUnit.name}</div>
                    </div>
                    <div className="text-xs" style={{ color: "var(--muted)", fontFamily: "monospace" }}>{campaign.campaignCode}</div>
                  </div>
                  <div className="mt-3 flex gap-3 text-xs" style={{ color: "var(--muted)" }}>
                    <span>Gasto: ${spend.toLocaleString("es-CL")}</span>
                    <span>Clicks: {clicks.toLocaleString("es-CL")}</span>
                  </div>
                </div>
              );
            })}
            {campaignWithSpend === 0 && (
              <div className="text-sm px-4 py-3 rounded-lg" style={{ color: "var(--muted)", border: "1px dashed var(--line)" }}>
                Aún no hay métricas de publicidad registradas para campañas activas.
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
