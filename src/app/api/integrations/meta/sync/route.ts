import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { fetchMetaInsights } from "@/lib/meta";
import { prisma } from "@/lib/prisma";

// POST /api/integrations/meta/sync  { adAccountId, since, until }
// Pensado para llamarse desde un botón "Sincronizar ahora" en Settings, o
// desde un cron job (Vercel Cron, por ejemplo) una vez en producción.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { adAccountId, since, until } = await req.json();

  const account = await prisma.adAccount.findUnique({
    where: { id: adAccountId },
    include: { digitalAdCampaigns: { include: { campaign: true } } },
  });
  if (!account?.accessToken) {
    return NextResponse.json({ error: "Cuenta no conectada" }, { status: 400 });
  }

  const startedAt = new Date();
  try {
    const insights = await fetchMetaInsights(account.externalAccountId, account.accessToken, since, until);

    let processed = 0;
    for (const row of insights) {
      const externalCampaignId = row.campaign_id as string;

      // Encuentra o crea el vínculo DigitalAdCampaign <-> Campaign interna.
      // El match real usa el campaignCode en el nombre de la campaña de Meta
      // (convención §7) — aquí se deja el fallback más simple para el scaffold.
      let digitalCampaign = account.digitalAdCampaigns.find((d) => d.externalCampaignId === externalCampaignId);
      if (!digitalCampaign) {
        const matchingCampaign = await prisma.campaign.findFirst({
          where: { name: { contains: (row.campaign_name as string) ?? "" } },
        });
        if (!matchingCampaign) continue; // sin campaña interna que enlazar, se omite por ahora

        digitalCampaign = await prisma.digitalAdCampaign.create({
          data: {
            campaignId: matchingCampaign.id,
            adAccountId: account.id,
            externalCampaignId,
            externalCampaignName: row.campaign_name as string,
          },
          include: { campaign: true },
        });
      }

      // RAW — payload crudo, nunca se edita.
      await prisma.adMetricRaw.create({
        data: {
          digitalAdCampaignId: digitalCampaign.id,
          date: new Date(row.date_start as string ?? since),
          payload: row as object,
        },
      });

      // PROCESSED — normalizado para consultas rápidas en dashboards.
      const conversions = Array.isArray(row.actions)
        ? (row.actions as { action_type: string; value: string }[]).find((a) => a.action_type === "purchase")
        : undefined;
      const revenue = Array.isArray(row.action_values)
        ? (row.action_values as { action_type: string; value: string }[]).find((a) => a.action_type === "purchase")
        : undefined;

      await prisma.metric.create({
        data: {
          campaignId: digitalCampaign.campaignId,
          platform: "META",
          date: new Date(row.date_start as string ?? since),
          spend: Math.round(parseFloat((row.spend as string) ?? "0") * 100),
          impressions: parseInt((row.impressions as string) ?? "0", 10),
          clicks: parseInt((row.clicks as string) ?? "0", 10),
          conversions: conversions ? parseInt(conversions.value, 10) : 0,
          revenue: revenue ? Math.round(parseFloat(revenue.value) * 100) : 0,
        },
      });

      processed++;
    }

    await prisma.integrationLog.create({
      data: {
        platform: "Meta Ads", status: "CONNECTED", syncStartedAt: startedAt,
        syncFinishedAt: new Date(), recordsProcessed: processed,
      },
    });

    return NextResponse.json({ ok: true, recordsProcessed: processed });
  } catch (err) {
    await prisma.integrationLog.create({
      data: { platform: "Meta Ads", status: "ERROR", syncStartedAt: startedAt, errorMessage: String(err) },
    });
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
