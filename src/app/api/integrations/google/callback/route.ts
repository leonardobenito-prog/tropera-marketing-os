import { NextRequest, NextResponse } from "next/server";
import { exchangeGoogleCode, listAccessibleGoogleAdsCustomers } from "@/lib/googleAds";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const stateRaw = req.nextUrl.searchParams.get("state");
  const error = req.nextUrl.searchParams.get("error");

  if (error || !code || !stateRaw) {
    return NextResponse.redirect(new URL("/settings?integration_error=google", req.url));
  }

  const { businessUnitId, userId } = JSON.parse(Buffer.from(stateRaw, "base64").toString());

  try {
    const { access_token, refresh_token, expires_in } = await exchangeGoogleCode(code);
    if (!refresh_token) {
      // Pasa si el usuario ya había autorizado antes sin "prompt=consent" —
      // hay que revocar el acceso previo en myaccount.google.com y reintentar.
      throw new Error("Google no devolvió refresh_token. Revoca el acceso previo e intenta de nuevo.");
    }

    const customerIds = await listAccessibleGoogleAdsCustomers(access_token);
    const customerId = customerIds[0];
    if (!customerId) throw new Error("La cuenta de Google no tiene clientes de Google Ads accesibles.");

    const platform = await prisma.advertisingPlatform.upsert({
      where: { name: "GOOGLE" },
      update: {},
      create: { name: "GOOGLE" },
    });

    await prisma.adAccount.upsert({
      where: { id: `google_${customerId}` },
      update: {
        accessToken: access_token,
        refreshToken: refresh_token,
        tokenExpiresAt: new Date(Date.now() + expires_in * 1000),
        connectedAt: new Date(),
        connectedByUserId: userId,
      },
      create: {
        id: `google_${customerId}`,
        platformId: platform.id,
        businessUnitId,
        externalAccountId: customerId,
        accessToken: access_token,
        refreshToken: refresh_token,
        tokenExpiresAt: new Date(Date.now() + expires_in * 1000),
        connectedAt: new Date(),
        connectedByUserId: userId,
      },
    });

    await prisma.integrationLog.create({
      data: { platform: "Google Ads", status: "CONNECTED", syncFinishedAt: new Date() },
    });

    return NextResponse.redirect(new URL("/settings?integration_success=google", req.url));
  } catch (err) {
    console.error("Google OAuth callback error:", err);
    await prisma.integrationLog.create({
      data: { platform: "Google Ads", status: "ERROR", errorMessage: String(err) },
    });
    return NextResponse.redirect(new URL("/settings?integration_error=google", req.url));
  }
}
