import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getGoogleAuthUrl } from "@/lib/googleAds";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/settings", req.url));
  }

  const businessUnitId = req.nextUrl.searchParams.get("businessUnitId") ?? "";
  const state = Buffer.from(JSON.stringify({ businessUnitId, userId: session.user.id })).toString("base64");

  return NextResponse.redirect(getGoogleAuthUrl(state));
}
