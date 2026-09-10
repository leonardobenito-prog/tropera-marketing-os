import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getMetaAuthUrl } from "@/lib/meta";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/settings", req.url));
  }

  // El businessUnitId viaja en el `state` para saber, en el callback, a qué
  // unidad de negocio conectar la cuenta de Meta elegida.
  const businessUnitId = req.nextUrl.searchParams.get("businessUnitId") ?? "";
  const state = Buffer.from(JSON.stringify({ businessUnitId, userId: session.user.id })).toString("base64");

  return NextResponse.redirect(getMetaAuthUrl(state));
}
