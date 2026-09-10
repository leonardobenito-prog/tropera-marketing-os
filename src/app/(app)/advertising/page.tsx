import { prisma } from "@/lib/prisma";
import { Badge, KPICard } from "@/components/ui";
import { updateAdAccountAction, deleteAdAccountAction, updateAdvertisingSpaceAction, deleteAdvertisingSpaceAction, updatePhysicalPlacementAction, deletePhysicalPlacementAction } from "@/lib/actions/ops";

export const dynamic = "force-dynamic";

export default async function AdvertisingPage() {
  const [accounts, campaigns, metrics, spaces, placements, platforms, locations, spaceTypes] = await Promise.all([
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
    prisma.advertisingSpace.findMany({
      include: { location: true, type: true, placements: { include: { campaign: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.physicalAdPlacement.findMany({
      include: { campaign: true, advertisingSpace: { include: { location: true } } },
      orderBy: { installDate: "desc" },
    }),
    prisma.advertisingPlatform.findMany({ orderBy: { name: "asc" } }),
    prisma.location.findMany({ orderBy: { name: "asc" } }),
    prisma.advertisingSpaceType.findMany({ orderBy: { name: "asc" } }),
  ]);

  const businessUnits = Array.from(new Map(campaigns.map((campaign) => [campaign.businessUnit.id, campaign.businessUnit])).values());

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
        <section className="space-y-4">
          <h2 className="text-lg heading-title mb-3" style={{ color: "var(--ink)" }}>Publicidad digital</h2>

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

                <div className="mt-3" style={{ borderTop: "1px solid var(--line)", paddingTop: "0.75rem" }}>
                  <form action={updateAdAccountAction} className="grid gap-2 md:grid-cols-4">
                    <input type="hidden" name="id" value={account.id} />
                    <select name="platformId" defaultValue={account.platformId} className="px-2 py-1.5 rounded-md text-xs" style={{ border: "1px solid var(--line)" }}>
                      {platforms.map((platform) => (
                        <option key={platform.id} value={platform.id}>{platform.name}</option>
                      ))}
                    </select>
                    <select name="businessUnitId" defaultValue={account.businessUnitId} className="px-2 py-1.5 rounded-md text-xs" style={{ border: "1px solid var(--line)" }}>
                      {businessUnits.map((businessUnit) => (
                        <option key={businessUnit.id} value={businessUnit.id}>{businessUnit.name}</option>
                      ))}
                    </select>
                    <input name="externalAccountId" defaultValue={account.externalAccountId} className="px-2 py-1.5 rounded-md text-xs" style={{ border: "1px solid var(--line)" }} />
                    <button type="submit" className="px-3 py-1.5 rounded-md" style={{ background: "var(--c-forest)", color: "#fff" }}>Guardar</button>
                  </form>
                  <form action={deleteAdAccountAction} className="mt-2">
                    <input type="hidden" name="id" value={account.id} />
                    <button type="submit" className="px-3 py-1.5 rounded-md" style={{ background: "#fff", border: "1px solid var(--line)", color: "var(--c-danger)" }}>Borrar</button>
                  </form>
                </div>
              </div>
            ))}
            {accounts.length === 0 && (
              <div className="text-sm px-4 py-3 rounded-lg" style={{ color: "var(--muted)", border: "1px dashed var(--line)" }}>
                No hay cuentas conectadas todavía.
              </div>
            )}
          </div>

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

        <section className="space-y-4">
          <h2 className="text-lg heading-title mb-3" style={{ color: "var(--ink)" }}>Publicidad análoga</h2>

          <div className="space-y-3">
            {placements.length === 0 && spaces.length === 0 ? (
              <div className="text-sm px-4 py-3 rounded-lg" style={{ color: "var(--muted)", border: "1px dashed var(--line)" }}>
                No hay ubicaciones ni placements análogos registrados todavía.
              </div>
            ) : null}

            {spaces.map((space) => (
              <div key={space.id} className="bg-white rounded-lg p-4" style={{ border: "1px solid var(--line)" }}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium" style={{ color: "var(--ink)" }}>{space.name}</div>
                    <div className="text-xs mt-1" style={{ color: "var(--muted)" }}>{space.location.name} · {space.type.name}</div>
                  </div>
                  <Badge tone={space.status === "AVAILABLE" ? "success" : "neutral"}>{space.status}</Badge>
                </div>
                <div className="mt-3 text-xs" style={{ color: "var(--muted)" }}>
                  {space.placements.length > 0 ? `${space.placements.length} placement(s) asociado(s)` : "Sin campañas activas en este espacio"}
                </div>

                <div className="mt-3" style={{ borderTop: "1px solid var(--line)", paddingTop: "0.75rem" }}>
                  <form action={updateAdvertisingSpaceAction} className="grid gap-2 md:grid-cols-5">
                    <input type="hidden" name="id" value={space.id} />
                    <input name="name" defaultValue={space.name} className="px-2 py-1.5 rounded-md text-xs" style={{ border: "1px solid var(--line)" }} />
                    <select name="locationId" defaultValue={space.locationId} className="px-2 py-1.5 rounded-md text-xs" style={{ border: "1px solid var(--line)" }}>
                      {locations.map((location) => (
                        <option key={location.id} value={location.id}>{location.name}</option>
                      ))}
                    </select>
                    <select name="typeId" defaultValue={space.typeId} className="px-2 py-1.5 rounded-md text-xs" style={{ border: "1px solid var(--line)" }}>
                      {spaceTypes.map((type) => (
                        <option key={type.id} value={type.id}>{type.name}</option>
                      ))}
                    </select>
                    <select name="status" defaultValue={space.status} className="px-2 py-1.5 rounded-md text-xs" style={{ border: "1px solid var(--line)" }}>
                      <option value="AVAILABLE">AVAILABLE</option>
                      <option value="IN_USE">IN_USE</option>
                      <option value="RESERVED">RESERVED</option>
                      <option value="MAINTENANCE">MAINTENANCE</option>
                    </select>
                    <input name="dimensions" defaultValue={space.dimensions ?? ""} className="px-2 py-1.5 rounded-md text-xs md:col-span-2" style={{ border: "1px solid var(--line)" }} />
                    <input type="number" name="estimatedCost" defaultValue={space.estimatedCost ?? ""} className="px-2 py-1.5 rounded-md text-xs md:col-span-2" style={{ border: "1px solid var(--line)" }} />
                    <button type="submit" className="px-3 py-1.5 rounded-md md:col-span-1" style={{ background: "var(--c-forest)", color: "#fff" }}>Guardar</button>
                  </form>
                  <form action={deleteAdvertisingSpaceAction} className="mt-2">
                    <input type="hidden" name="id" value={space.id} />
                    <button type="submit" className="px-3 py-1.5 rounded-md" style={{ background: "#fff", border: "1px solid var(--line)", color: "var(--c-danger)" }}>Borrar</button>
                  </form>
                </div>
              </div>
            ))}

            {placements.map((placement) => (
              <div key={placement.id} className="bg-white rounded-lg p-4" style={{ border: "1px solid var(--line)" }}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium" style={{ color: "var(--ink)" }}>{placement.campaign?.name ?? "Campaña sin nombre"}</div>
                    <div className="text-xs mt-1" style={{ color: "var(--muted)" }}>{placement.advertisingSpace.location.name} · {placement.advertisingSpace.name}</div>
                  </div>
                  <Badge tone="neutral">{placement.status}</Badge>
                </div>
                <div className="mt-3 text-xs" style={{ color: "var(--muted)" }}>
                  {placement.installDate ? `Instalación: ${new Date(placement.installDate).toLocaleDateString("es-CL")}` : "Sin fecha de instalación"}
                </div>

                <div className="mt-3" style={{ borderTop: "1px solid var(--line)", paddingTop: "0.75rem" }}>
                  <form action={updatePhysicalPlacementAction} className="grid gap-2 md:grid-cols-5">
                    <input type="hidden" name="id" value={placement.id} />
                    <input type="hidden" name="advertisingSpaceId" value={placement.advertisingSpaceId} />
                    <select name="campaignId" defaultValue={placement.campaignId} className="px-2 py-1.5 rounded-md text-xs" style={{ border: "1px solid var(--line)" }}>
                      {campaigns.map((campaign) => (
                        <option key={campaign.id} value={campaign.id}>{campaign.name}</option>
                      ))}
                    </select>
                    <input type="date" name="installDate" defaultValue={placement.installDate ? new Date(placement.installDate).toISOString().slice(0, 10) : ""} className="px-2 py-1.5 rounded-md text-xs" style={{ border: "1px solid var(--line)" }} />
                    <input type="date" name="removalDate" defaultValue={placement.removalDate ? new Date(placement.removalDate).toISOString().slice(0, 10) : ""} className="px-2 py-1.5 rounded-md text-xs" style={{ border: "1px solid var(--line)" }} />
                    <select name="status" defaultValue={placement.status} className="px-2 py-1.5 rounded-md text-xs" style={{ border: "1px solid var(--line)" }}>
                      <option value="PLANNED">PLANNED</option>
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="REMOVED">REMOVED</option>
                    </select>
                    <input type="number" name="cost" defaultValue={placement.cost ?? ""} className="px-2 py-1.5 rounded-md text-xs md:col-span-2" style={{ border: "1px solid var(--line)" }} />
                    <input name="photoUrl" defaultValue={placement.photoUrl ?? ""} className="px-2 py-1.5 rounded-md text-xs md:col-span-2" style={{ border: "1px solid var(--line)" }} />
                    <button type="submit" className="px-3 py-1.5 rounded-md" style={{ background: "var(--c-forest)", color: "#fff" }}>Guardar</button>
                  </form>
                  <form action={deletePhysicalPlacementAction} className="mt-2">
                    <input type="hidden" name="id" value={placement.id} />
                    <button type="submit" className="px-3 py-1.5 rounded-md" style={{ background: "#fff", border: "1px solid var(--line)", color: "var(--c-danger)" }}>Borrar</button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
