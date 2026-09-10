import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { createCampaignAction } from "@/lib/actions/ops";
import { Badge, ProgressBar, execState } from "@/components/ui";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Activa", IN_PRODUCTION: "En producción", COMPLETED: "Finalizada",
  DRAFT: "Borrador", PAUSED: "Pausada", CANCELLED: "Cancelada",
};
const STATUS_TONE: Record<string, "success" | "warning" | "neutral"> = {
  ACTIVE: "success", COMPLETED: "success", DRAFT: "neutral", PAUSED: "warning", CANCELLED: "neutral",
};

export default async function CampaignsPage() {
  const [campaigns, businessUnits, users] = await Promise.all([
    prisma.campaign.findMany({
      include: { businessUnit: true, budgets: true, expenses: true },
      orderBy: { startDate: "desc" },
    }),
    prisma.businessUnit.findMany({ orderBy: { name: "asc" } }),
    prisma.user.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="p-6 space-y-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl heading-title" style={{ color: "var(--ink)" }}>Campañas</h1>
      </div>

      <div className="bg-white rounded-lg p-4" style={{ border: "1px solid var(--line)" }}>
        <h2 className="text-lg heading-title mb-3" style={{ color: "var(--ink)" }}>Crear campaña</h2>
        <form action={createCampaignAction} className="grid gap-3 md:grid-cols-2">
          <input name="name" placeholder="Nombre" className="px-3 py-2 rounded-md" style={{ border: "1px solid var(--line)" }} required />
          <input name="campaignCode" placeholder="Código (TRP-2026-0001)" className="px-3 py-2 rounded-md" style={{ border: "1px solid var(--line)" }} required />
          <select name="businessUnitId" className="px-3 py-2 rounded-md" style={{ border: "1px solid var(--line)" }} required>
            <option value="">Unidad de negocio</option>
            {businessUnits.map((unit) => (
              <option key={unit.id} value={unit.id}>{unit.name}</option>
            ))}
          </select>
          <select name="ownerId" className="px-3 py-2 rounded-md" style={{ border: "1px solid var(--line)" }}>
            <option value="">Responsable</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>{user.name}</option>
            ))}
          </select>
          <input type="date" name="startDate" className="px-3 py-2 rounded-md" style={{ border: "1px solid var(--line)" }} required />
          <input type="date" name="endDate" className="px-3 py-2 rounded-md" style={{ border: "1px solid var(--line)" }} required />
          <textarea name="objective" placeholder="Objetivo" className="px-3 py-2 rounded-md md:col-span-2" style={{ border: "1px solid var(--line)" }} rows={3} />
          <select name="status" className="px-3 py-2 rounded-md md:col-span-2" style={{ border: "1px solid var(--line)" }} defaultValue="DRAFT">
            <option value="DRAFT">Borrador</option>
            <option value="ACTIVE">Activa</option>
            <option value="PAUSED">Pausada</option>
            <option value="COMPLETED">Finalizada</option>
            <option value="CANCELLED">Cancelada</option>
          </select>
          <button type="submit" className="px-4 py-2 rounded-md md:col-span-2" style={{ background: "var(--c-forest)", color: "#fff" }}>
            Guardar campaña
          </button>
        </form>
      </div>

      <div className="bg-white rounded-lg overflow-hidden" style={{ border: "1px solid var(--line)" }}>
        <div className="grid text-[11px] px-4 py-2" style={{ gridTemplateColumns: "1.6fr 1fr 1fr 1.4fr 0.8fr", color: "var(--muted)", borderBottom: "1px solid var(--line)" }}>
          <div>CAMPAÑA</div><div>UNIDAD</div><div>ESTADO</div><div>EJECUCIÓN</div><div>ID</div>
        </div>
        {campaigns.map((c) => {
          const assigned = c.budgets.reduce((s, b) => s + b.assignedAmount, 0);
          const actual = c.expenses.filter((e) => e.status === "PAID").reduce((s, e) => s + e.amount, 0);
          const committed = c.expenses.filter((e) => e.status === "COMMITTED").reduce((s, e) => s + e.amount, 0);
          const ex = execState(assigned, actual, committed);
          return (
            <Link
              key={c.id}
              href={`/campaigns/${c.campaignCode}`}
              className="grid items-center px-4 py-3 text-sm"
              style={{ gridTemplateColumns: "1.6fr 1fr 1fr 1.4fr 0.8fr", borderBottom: "1px solid var(--line)" }}
            >
              <div>
                <div style={{ color: "var(--ink)" }}>{c.name}</div>
                <div className="text-xs" style={{ color: "var(--muted)" }}>
                  {c.startDate.toLocaleDateString("es-CL")} — {c.endDate.toLocaleDateString("es-CL")}
                </div>
              </div>
              <div style={{ color: "var(--ink)" }}>{c.businessUnit.name}</div>
              <div><Badge tone={STATUS_TONE[c.status] || "neutral"}>{STATUS_LABEL[c.status] || c.status}</Badge></div>
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span style={{ color: "var(--muted)" }}>{Math.round(ex.pct * 100)}%</span>
                  <span style={{ color: ex.color }}>{ex.label}</span>
                </div>
                <ProgressBar pct={ex.pct} color={ex.color} />
              </div>
              <div className="text-xs" style={{ color: "var(--muted)", fontFamily: "monospace" }}>{c.campaignCode}</div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
