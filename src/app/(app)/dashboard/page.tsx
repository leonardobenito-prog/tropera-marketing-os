import { prisma } from "@/lib/prisma";
import { KPICard, money } from "@/components/ui";

export const dynamic = "force-dynamic"; // siempre datos frescos, sin caché — es un panel operativo

export default async function DashboardPage() {
  const campaigns = await prisma.campaign.findMany({
    include: { expenses: true, budgets: true },
  });

  const assigned = campaigns.reduce((a, c) => a + c.budgets.reduce((s, b) => s + b.assignedAmount, 0), 0);
  const actual = campaigns.reduce((a, c) => a + c.expenses.filter((e) => e.status === "PAID").reduce((s, e) => s + e.amount, 0), 0);
  const committed = campaigns.reduce((a, c) => a + c.expenses.filter((e) => e.status === "COMMITTED").reduce((s, e) => s + e.amount, 0), 0);
  const available = assigned - actual - committed;
  const pct = assigned > 0 ? Math.round(((actual + committed) / assigned) * 100) : 0;

  const active = campaigns.filter((c) => c.status === "ACTIVE").length;
  const overdueTasks = await prisma.task.count({ where: { dueDate: { lt: new Date() }, status: { not: "DONE" } } });
  const todayTasks = await prisma.task.count({
    where: {
      dueDate: { gte: new Date(new Date().setHours(0, 0, 0, 0)), lt: new Date(new Date().setHours(23, 59, 59, 999)) },
    },
  });

  return (
    <div className="p-6 space-y-8">
      <h1 className="text-xl heading-title" style={{ color: "var(--ink)" }}>Centro de Comando de Marketing</h1>

      <div>
        <h2 className="text-lg heading-title mb-3" style={{ color: "var(--ink)" }}>Presupuesto consolidado</h2>
        <div className="flex gap-3 flex-wrap">
          <KPICard label="ASIGNADO" value={money(assigned)} accent="var(--c-forest)" />
          <KPICard label="GASTADO" value={money(actual)} accent="var(--c-copper)" />
          <KPICard label="COMPROMETIDO" value={money(committed)} accent="var(--c-warning)" />
          <KPICard label="DISPONIBLE" value={money(available)} accent="var(--c-success)" />
          <KPICard label="% EJECUTADO" value={`${pct}%`} accent={pct > 100 ? "var(--c-danger)" : "var(--c-forest)"} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <h2 className="text-lg heading-title mb-3" style={{ color: "var(--ink)" }}>Campañas</h2>
          <div className="flex gap-3 flex-wrap">
            <KPICard label="ACTIVAS" value={active} accent="var(--c-success)" />
            <KPICard label="TOTAL" value={campaigns.length} accent="var(--c-forest)" />
          </div>
        </div>
        <div>
          <h2 className="text-lg heading-title mb-3" style={{ color: "var(--ink)" }}>Tareas</h2>
          <div className="flex gap-3 flex-wrap">
            <KPICard label="ATRASADAS" value={overdueTasks} accent="var(--c-danger)" />
            <KPICard label="HOY" value={todayTasks} accent="var(--c-copper)" />
          </div>
        </div>
      </div>
    </div>
  );
}
