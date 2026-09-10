import { prisma } from "@/lib/prisma";
import { Badge, KPICard } from "@/components/ui";
import { requireRole, requireSession } from "@/lib/permissions";
import { updateMyPasswordAction } from "@/lib/actions/ops";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, "success" | "warning" | "danger"> = {
  CONNECTED: "success", PENDING: "warning", ERROR: "danger",
};
const STATUS_LABEL: Record<string, string> = {
  CONNECTED: "Conectado", PENDING: "Pendiente", ERROR: "Error",
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: { integration_success?: string; integration_error?: string; success?: string; error?: string };
}) {
  const session = await requireSession();
  const isAdmin = session.user.role === "ADMIN";

  if (isAdmin) {
    await requireRole(["ADMIN"]);
  }

  const businessUnits = isAdmin ? await prisma.businessUnit.findMany({ orderBy: { name: "asc" } }) : [];
  const adAccounts = isAdmin ? await prisma.adAccount.findMany({ include: { platform: true, businessUnit: true } }) : [];

  const recentLogs = await prisma.integrationLog.findMany({
    orderBy: { syncFinishedAt: "desc" },
    take: 50,
  });
  const latestByPlatform = new Map<string, (typeof recentLogs)[number]>();
  for (const log of recentLogs) {
    if (!latestByPlatform.has(log.platform)) latestByPlatform.set(log.platform, log);
  }
  const platforms = ["Meta Ads", "Google Ads", "GA4", "Search Console", "Tienda Online", "Mailing"];

  return (
    <div className="p-6 space-y-8">
      <h1 className="text-xl heading-title" style={{ color: "var(--ink)" }}>Configuración</h1>

      {searchParams.integration_success && (
        <div className="text-xs px-4 py-2 rounded-lg" style={{ background: "#E7F1EA", color: "#2F6B45" }}>
          {searchParams.integration_success === "meta" ? "Meta Ads" : "Google Ads"} conectado correctamente.
        </div>
      )}
      {searchParams.integration_error && (
        <div className="text-xs px-4 py-2 rounded-lg" style={{ background: "#FAE7E4", color: "#A23B2E" }}>
          No se pudo conectar {searchParams.integration_error === "meta" ? "Meta Ads" : "Google Ads"}. Revisa las
          variables de entorno y que la app esté aprobada — ver README.
        </div>
      )}
      {searchParams.success === "password-updated" && (
        <div className="text-xs px-4 py-2 rounded-lg" style={{ background: "#E7F1EA", color: "#2F6B45" }}>
          Tu contraseña fue actualizada correctamente.
        </div>
      )}
      {searchParams.error === "password-invalid" && (
        <div className="text-xs px-4 py-2 rounded-lg" style={{ background: "#FAE7E4", color: "#A23B2E" }}>
          La contraseña actual no coincide.
        </div>
      )}
      {searchParams.error === "password-mismatch" && (
        <div className="text-xs px-4 py-2 rounded-lg" style={{ background: "#FAE7E4", color: "#A23B2E" }}>
          La nueva contraseña y su confirmación no coinciden.
        </div>
      )}

      <div className="bg-white rounded-lg p-4" style={{ border: "1px solid var(--line)" }}>
        <h2 className="text-lg heading-title mb-3" style={{ color: "var(--ink)" }}>Mi contraseña</h2>
        <form action={updateMyPasswordAction} className="grid gap-3 md:grid-cols-2">
          <input type="password" name="currentPassword" placeholder="Contraseña actual" className="px-3 py-2 rounded-md" style={{ border: "1px solid var(--line)" }} required />
          <div />
          <input type="password" name="newPassword" placeholder="Nueva contraseña" minLength={8} className="px-3 py-2 rounded-md" style={{ border: "1px solid var(--line)" }} required />
          <input type="password" name="confirmPassword" placeholder="Confirmar nueva contraseña" minLength={8} className="px-3 py-2 rounded-md" style={{ border: "1px solid var(--line)" }} required />
          <button type="submit" className="px-4 py-2 rounded-md md:col-span-2" style={{ background: "var(--c-forest)", color: "#fff" }}>
            Cambiar contraseña
          </button>
        </form>
      </div>

      {isAdmin && (
        <div>
          <h2 className="text-lg heading-title mb-3" style={{ color: "var(--ink)" }}>Conectar plataformas</h2>
          <p className="text-xs mb-3" style={{ color: "var(--muted)" }}>
            Elige la unidad de negocio a la que se asociará la cuenta antes de conectar.
          </p>
          <div className="flex gap-3 flex-wrap">
            <form action="/api/integrations/meta/connect" className="flex items-center gap-2">
              <select name="businessUnitId" className="text-xs px-2 py-1.5 rounded-md" style={{ border: "1px solid var(--line)" }}>
                {businessUnits.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
              <button className="text-xs px-3 py-1.5 rounded-md text-white" style={{ background: "var(--c-forest)" }}>
                Conectar Meta Ads
              </button>
            </form>
            <form action="/api/integrations/google/connect" className="flex items-center gap-2">
              <select name="businessUnitId" className="text-xs px-2 py-1.5 rounded-md" style={{ border: "1px solid var(--line)" }}>
                {businessUnits.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
              <button className="text-xs px-3 py-1.5 rounded-md text-white" style={{ background: "var(--c-forest)" }}>
                Conectar Google Ads
              </button>
            </form>
          </div>
        </div>
      )}

      {isAdmin && (
        <div>
          <h2 className="text-lg heading-title mb-3" style={{ color: "var(--ink)" }}>Cuentas conectadas</h2>
          {adAccounts.length === 0 ? (
            <div className="text-sm px-4 py-3 rounded-lg" style={{ color: "var(--muted)", border: "1px dashed var(--line)" }}>
              Ninguna cuenta conectada todavía.
            </div>
          ) : (
            <div className="bg-white rounded-lg overflow-hidden" style={{ border: "1px solid var(--line)" }}>
              <div className="grid text-[11px] px-4 py-2" style={{ gridTemplateColumns: "1fr 1fr 1fr 1fr", color: "var(--muted)", borderBottom: "1px solid var(--line)" }}>
                <div>PLATAFORMA</div><div>UNIDAD</div><div>ID EXTERNO</div><div>CONECTADA</div>
              </div>
              {adAccounts.map((a) => (
                <div key={a.id} className="grid items-center px-4 py-3 text-sm" style={{ gridTemplateColumns: "1fr 1fr 1fr 1fr", borderBottom: "1px solid var(--line)" }}>
                  <div style={{ color: "var(--ink)" }}>{a.platform.name}</div>
                  <div style={{ color: "var(--ink)" }}>{a.businessUnit.name}</div>
                  <div className="text-xs" style={{ color: "var(--muted)", fontFamily: "monospace" }}>{a.externalAccountId}</div>
                  <div style={{ color: "var(--muted)" }}>{a.connectedAt ? a.connectedAt.toLocaleDateString("es-CL") : "—"}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {isAdmin && (
        <div>
          <h2 className="text-lg heading-title mb-3" style={{ color: "var(--ink)" }}>Salud de integraciones</h2>
          <div className="bg-white rounded-lg overflow-hidden" style={{ border: "1px solid var(--line)" }}>
            <div className="grid text-[11px] px-4 py-2" style={{ gridTemplateColumns: "1.2fr 1fr 1fr 1fr 0.8fr", color: "var(--muted)", borderBottom: "1px solid var(--line)" }}>
              <div>PLATAFORMA</div><div>ESTADO</div><div>ÚLTIMA SINCRONIZACIÓN</div><div>REGISTROS</div><div>ERRORES</div>
            </div>
            {platforms.map((p) => {
              const log = latestByPlatform.get(p);
              const status = log?.status ?? "PENDING";
              return (
                <div key={p} className="grid items-center px-4 py-3 text-sm" style={{ gridTemplateColumns: "1.2fr 1fr 1fr 1fr 0.8fr", borderBottom: "1px solid var(--line)" }}>
                  <div style={{ color: "var(--ink)" }}>{p}</div>
                  <div><Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge></div>
                  <div style={{ color: "var(--muted)" }}>{log?.syncFinishedAt ? log.syncFinishedAt.toLocaleString("es-CL") : "—"}</div>
                  <div style={{ color: "var(--ink)" }}>{log?.recordsProcessed ?? 0}</div>
                  <div style={{ color: log?.errorMessage ? "var(--c-danger)" : "var(--muted)" }}>{log?.errorMessage ? "Sí" : "0"}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {isAdmin && (
        <div>
          <h2 className="text-lg heading-title mb-3" style={{ color: "var(--ink)" }}>Umbrales de presupuesto</h2>
          <div className="flex gap-3 flex-wrap">
            <KPICard label="ATENCIÓN DESDE" value="70%" accent="var(--c-warning)" />
            <KPICard label="CRÍTICO DESDE" value="90%" accent="var(--c-danger)" />
            <KPICard label="EXCEDIDO DESDE" value="100%" accent="var(--c-danger)" />
          </div>
          <p className="text-xs mt-2" style={{ color: "var(--muted)" }}>
            Hoy están fijos en el código (`execState` en `src/components/ui.tsx`). Para hacerlos editables desde aquí, falta una tabla `Settings` de una fila y un formulario que la actualice.
          </p>
        </div>
      )}
    </div>
  );
}
