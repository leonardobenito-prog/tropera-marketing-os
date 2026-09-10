import { NextRequest, NextResponse } from "next/server";
import { exchangeMetaCode, fetchMetaAdAccounts } from "@/lib/meta";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const stateRaw = req.nextUrl.searchParams.get("state");
  const error = req.nextUrl.searchParams.get("error");

  if (error || !code || !stateRaw) {
    return NextResponse.redirect(new URL("/settings?integration_error=meta", req.url));
  }

  const { businessUnitId, userId } = JSON.parse(Buffer.from(stateRaw, "base64").toString());

  try {
    const { access_token, expires_in } = await exchangeMetaCode(code);
    const accounts = await fetchMetaAdAccounts(access_token);

    const platform = await prisma.advertisingPlatform.upsert({
      where: { name: "META" },
      update: {},
      create: { name: "META" },
    });

    // Si el Business Manager tiene varias cuentas, por ahora conectamos la
    // primera — una pantalla de selección es la mejora natural siguiente.
    const account = accounts[0];
    if (!account) throw new Error("La cuenta de Meta no tiene ad accounts disponibles.");

    await prisma.adAccount.upsert({
      where: { id: `meta_${account.account_id}` },
      update: {
        accessToken: access_token,
        tokenExpiresAt: expires_in ? new Date(Date.now() + expires_in * 1000) : null,
        connectedAt: new Date(),
        connectedByUserId: userId,
      },
      create: {
        id: `meta_${account.account_id}`,
        platformId: platform.id,
        businessUnitId,
        externalAccountId: account.account_id,
        accessToken: access_token,
        tokenExpiresAt: expires_in ? new Date(Date.now() + expires_in * 1000) : null,
        connectedAt: new Date(),
        connectedByUserId: userId,
      },
    });

    await prisma.integrationLog.create({
      data: { platform: "Meta Ads", status: "CONNECTED", syncFinishedAt: new Date() },
    });

    return NextResponse.redirect(new URL("/settings?integration_success=meta", req.url));
  } catch (err) {
    console.error("Meta OAuth callback error:", err);
    await prisma.integrationLog.create({
      data: { platform: "Meta Ads", status: "ERROR", errorMessage: String(err) },
    });
    return NextResponse.redirect(new URL("/settings?integration_error=meta", req.url));
  }
}
