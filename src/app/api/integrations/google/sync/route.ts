import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { fetchGoogleAdsReport, refreshGoogleToken } from "@/lib/googleAds";
import { prisma } from "@/lib/prisma";

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
  if (!account?.refreshToken) {
    return NextResponse.json({ error: "Cuenta no conectada" }, { status: 400 });
  }

  const startedAt = new Date();
  try {
    // El access_token de Google expira rápido (~1h) — se refresca en cada sync.
    const { access_token } = await refreshGoogleToken(account.refreshToken);

    const rows = await fetchGoogleAdsReport(account.externalAccountId, access_token, since, until);

    let processed = 0;
    for (const row of rows as any[]) {
      const externalCampaignId = String(row.campaign?.id ?? "");

      let digitalCampaign = account.digitalAdCampaigns.find((d) => d.externalCampaignId === externalCampaignId);
      if (!digitalCampaign) {
        const matchingCampaign = await prisma.campaign.findFirst({
          where: { name: { contains: row.campaign?.name ?? "" } },
        });
        if (!matchingCampaign) continue;

        digitalCampaign = await prisma.digitalAdCampaign.create({
          data: {
            campaignId: matchingCampaign.id,
            adAccountId: account.id,
            externalCampaignId,
            externalCampaignName: row.campaign?.name,
          },
          include: { campaign: true },
        });
      }

      await prisma.adMetricRaw.create({
        data: {
          digitalAdCampaignId: digitalCampaign.id,
          date: new Date(row.segments?.date ?? since),
          payload: row,
        },
      });

      await prisma.metric.create({
        data: {
          campaignId: digitalCampaign.campaignId,
          platform: "GOOGLE",
          date: new Date(row.segments?.date ?? since),
          spend: Math.round((row.metrics?.costMicros ?? 0) / 10000), // micros → centavos
          impressions: parseInt(row.metrics?.impressions ?? "0", 10),
          clicks: parseInt(row.metrics?.clicks ?? "0", 10),
          conversions: Math.round(row.metrics?.conversions ?? 0),
          revenue: Math.round((row.metrics?.conversionsValue ?? 0) * 100),
        },
      });

      processed++;
    }

    await prisma.integrationLog.create({
      data: {
        platform: "Google Ads", status: "CONNECTED", syncStartedAt: startedAt,
        syncFinishedAt: new Date(), recordsProcessed: processed,
      },
    });

    return NextResponse.json({ ok: true, recordsProcessed: processed });
  } catch (err) {
    await prisma.integrationLog.create({
      data: { platform: "Google Ads", status: "ERROR", syncStartedAt: startedAt, errorMessage: String(err) },
    });
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
