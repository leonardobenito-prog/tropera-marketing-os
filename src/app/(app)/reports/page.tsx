import { prisma } from "@/lib/prisma";
import { KPICard } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const [campaigns, expenses, orders, learnings] = await Promise.all([
    prisma.campaign.findMany({
      include: { metrics: true, budgets: true, expenses: true, learnings: true },
      orderBy: { startDate: "desc" },
    }),
    prisma.expense.findMany({
      orderBy: { date: "desc" },
      take: 20,
    }),
    prisma.order.findMany({
      include: { customer: true, items: { include: { product: true } } },
      orderBy: { date: "desc" },
      take: 20,
    }),
    prisma.learning.findMany({
      include: { campaign: true },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
  ]);

  const totalCampaignBudget = campaigns.reduce((sum, campaign) => {
    return sum + campaign.budgets.reduce((sum2, budget) => sum2 + budget.assignedAmount, 0);
  }, 0);

  const totalCampaignSpend = campaigns.reduce((sum, campaign) => {
    return sum + campaign.expenses.filter((expense) => expense.status === "PAID").reduce((sum2, expense) => sum2 + expense.amount, 0);
  }, 0);

  const totalRevenue = orders.reduce((sum, order) => sum + order.revenue, 0);
  const totalOrders = orders.length;

  return (
    <div className="p-6 space-y-8">
      <div>
        <div className="text-xs uppercase tracking-[0.18em]" style={{ color: "var(--muted)" }}>
          Reportes
        </div>
        <h1 className="text-xl heading-title mt-1" style={{ color: "var(--ink)" }}>
          Resumen ejecutivo
        </h1>
      </div>

      <div className="flex gap-3 flex-wrap">
        <KPICard label="PRESUPUESTO" value={`$${totalCampaignBudget.toLocaleString("es-CL")}`} accent="var(--c-forest)" />
        <KPICard label="GASTO PAGADO" value={`$${totalCampaignSpend.toLocaleString("es-CL")}`} accent="var(--c-copper)" />
        <KPICard label="INGRESO" value={`$${totalRevenue.toLocaleString("es-CL")}`} accent="var(--c-success)" />
        <KPICard label="PEDIDOS" value={totalOrders} accent="var(--c-warning)" />
      </div>

      <div className="grid gap-8 xl:grid-cols-2">
        <section>
          <h2 className="text-lg heading-title mb-3" style={{ color: "var(--ink)" }}>Últimos gastos</h2>
          <div className="bg-white rounded-lg overflow-hidden" style={{ border: "1px solid var(--line)" }}>
            <div className="grid text-[11px] px-4 py-2" style={{ gridTemplateColumns: "0.8fr 1.2fr 0.8fr", color: "var(--muted)", borderBottom: "1px solid var(--line)" }}>
              <div>FECHA</div>
              <div>CATEGORÍA</div>
              <div>MONTO</div>
            </div>
            {expenses.map((expense) => (
              <div key={expense.id} className="grid items-center px-4 py-3 text-sm" style={{ gridTemplateColumns: "0.8fr 1.2fr 0.8fr", borderBottom: "1px solid var(--line)" }}>
                <div style={{ color: "var(--muted)" }}>{new Date(expense.date).toLocaleDateString("es-CL")}</div>
                <div style={{ color: "var(--ink)" }}>{expense.category}</div>
                <div style={{ color: "var(--ink)" }}>${expense.amount.toLocaleString("es-CL")}</div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-lg heading-title mb-3" style={{ color: "var(--ink)" }}>Aprendizajes recientes</h2>
          <div className="space-y-3">
            {learnings.map((learning) => (
              <div key={learning.id} className="bg-white rounded-lg p-4" style={{ border: "1px solid var(--line)" }}>
                <div className="text-xs mb-2" style={{ color: "var(--muted)" }}>{learning.campaign.name}</div>
                <div className="text-sm" style={{ color: "var(--ink)" }}>{learning.whatWorked ?? "Sin dato"}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
