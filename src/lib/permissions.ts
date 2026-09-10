import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";

export type SystemRole = "ADMIN" | "MARKETING_MANAGER" | "TEAM_MEMBER" | "VIEWER";

// Llamar al principio de cualquier Server Component que deba exigir sesión.
// El middleware ya bloquea el acceso sin sesión, pero esto además te da
// el objeto session tipado, listo para leer session.user.role.
export async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  return session;
}

// Para pantallas que solo ciertos roles pueden ver (ej. Settings = solo Admin).
export async function requireRole(allowed: SystemRole[]) {
  const session = await requireSession();
  if (!allowed.includes(session.user.role as SystemRole)) {
    redirect("/dashboard");
  }
  return session;
}

// Viewer no debería ver montos de presupuesto detallados (§6 de la
// arquitectura). Se usa así: {canSeeAmounts(role) ? money(x) : "•••••"}
export function canSeeAmounts(role: string) {
  return role !== "VIEWER";
}
