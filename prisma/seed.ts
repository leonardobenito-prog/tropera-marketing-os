import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Sembrando datos demo de Tropera Marketing OS...");

  // --- Regiones ---
  const losLagos = await prisma.region.create({ data: { name: "Los Lagos", code: "LOS_LAGOS" } });
  const rm = await prisma.region.create({ data: { name: "Metropolitana", code: "RM" } });
  const coyhaique = await prisma.region.create({ data: { name: "Coyhaique", code: "COYHAIQUE" } });

  // --- Business Units ---
  const mesa = await prisma.businessUnit.create({ data: { name: "Mesa Tropera", type: "RESTAURANT", regionId: losLagos.id } });
  await prisma.businessUnit.create({ data: { name: "La Independiente", type: "RESTAURANT", regionId: losLagos.id } });
  const nose = await prisma.businessUnit.create({ data: { name: "Taberna Nosé", type: "RESTAURANT", regionId: losLagos.id } });
  const aleman = await prisma.businessUnit.create({ data: { name: "Club Alemán", type: "RESTAURANT", regionId: losLagos.id } });
  const biergarten = await prisma.businessUnit.create({ data: { name: "Biergarten", type: "RESTAURANT", regionId: losLagos.id } });
  await prisma.businessUnit.create({ data: { name: "Estación Tropera", type: "RESTAURANT", regionId: rm.id } });
  await prisma.businessUnit.create({ data: { name: "Tropera Drugstore", type: "RESTAURANT", regionId: rm.id } });
  const gaucha = await prisma.businessUnit.create({ data: { name: "Mamma Gaucha", type: "RESTAURANT", regionId: coyhaique.id } });
  await prisma.businessUnit.create({ data: { name: "La Esquina Tropera", type: "RESTAURANT", regionId: coyhaique.id } });
  const cerveceria = await prisma.businessUnit.create({ data: { name: "Cervecería Tropera", type: "BREWERY", regionId: losLagos.id } });
  const ecommerce = await prisma.businessUnit.create({ data: { name: "Tienda Online", type: "ECOMMERCE" } });

  // --- Usuarios y roles funcionales ---
  const DEMO_PASSWORD = "tropera2026"; // ⚠️ cámbiala apenas tengas usuarios reales — ver README
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const rolePaidMedia = await prisma.functionalRole.create({ data: { name: "Paid Media" } });
  const roleVideo = await prisma.functionalRole.create({ data: { name: "Video" } });
  const roleFoto = await prisma.functionalRole.create({ data: { name: "Fotografía" } });
  const roleEdicion = await prisma.functionalRole.create({ data: { name: "Edición" } });
  const roleDiseno = await prisma.functionalRole.create({ data: { name: "Diseño" } });
  const roleAprobacion = await prisma.functionalRole.create({ data: { name: "Aprobación" } });
  const roleInstalacion = await prisma.functionalRole.create({ data: { name: "Instalación" } });

  await prisma.user.create({
    data: { name: "Admin Tropera", email: "admin@tropera.cl", systemRole: "ADMIN", passwordHash },
  });
  const leo = await prisma.user.create({
    data: {
      name: "Leo",
      email: "leo@tropera.cl",
      systemRole: "MARKETING_MANAGER",
      passwordHash,
      functionalRoles: { connect: [{ id: rolePaidMedia.id }] },
    },
  });
  const vale = await prisma.user.create({
    data: { name: "Vale", email: "vale@tropera.cl", systemRole: "TEAM_MEMBER", passwordHash, functionalRoles: { connect: [{ id: roleVideo.id }, { id: roleFoto.id }] } },
  });
  const fran = await prisma.user.create({
    data: { name: "Fran", email: "fran@tropera.cl", systemRole: "TEAM_MEMBER", passwordHash, functionalRoles: { connect: [{ id: roleEdicion.id }] } },
  });
  const cote = await prisma.user.create({
    data: { name: "Cote", email: "cote@tropera.cl", systemRole: "TEAM_MEMBER", passwordHash, functionalRoles: { connect: [{ id: roleDiseno.id }, { id: roleAprobacion.id }] } },
  });
  await prisma.user.create({
    data: { name: "Equipo Instalación", email: "instalacion@tropera.cl", systemRole: "TEAM_MEMBER", passwordHash, functionalRoles: { connect: [{ id: roleInstalacion.id }] } },
  });
  await prisma.user.create({
    data: { name: "Cliente Externo", email: "viewer@tropera.cl", systemRole: "VIEWER", passwordHash },
  });

  // --- Campañas (mismos TRP-2026-000N del prototipo) ---
  const camp1 = await prisma.campaign.create({
    data: {
      campaignCode: "TRP-2026-0001", name: "Lanzamiento IPA", businessUnitId: cerveceria.id,
      status: "ACTIVE", startDate: new Date("2026-09-01"), endDate: new Date("2026-09-30"), ownerId: leo.id,
    },
  });
  const camp2 = await prisma.campaign.create({
    data: {
      campaignCode: "TRP-2026-0002", name: "Fiestas Patrias — Grupo", businessUnitId: mesa.id,
      status: "ACTIVE", startDate: new Date("2026-09-05"), endDate: new Date("2026-09-20"), ownerId: leo.id,
    },
  });
  const camp3 = await prisma.campaign.create({
    data: {
      campaignCode: "TRP-2026-0003", name: "Reapertura Terraza", businessUnitId: biergarten.id,
      status: "ACTIVE", startDate: new Date("2026-09-15"), endDate: new Date("2026-10-10"), ownerId: leo.id,
    },
  });
  await prisma.campaign.create({
    data: {
      campaignCode: "TRP-2026-0004", name: "Menú de Invierno", businessUnitId: aleman.id,
      status: "COMPLETED", startDate: new Date("2026-06-01"), endDate: new Date("2026-08-31"), ownerId: leo.id,
    },
  });
  const camp5 = await prisma.campaign.create({
    data: {
      campaignCode: "TRP-2026-0005", name: "Envío Gratis Otoño", businessUnitId: ecommerce.id,
      status: "ACTIVE", startDate: new Date("2026-08-20"), endDate: new Date("2026-09-15"), ownerId: leo.id,
    },
  });
  await prisma.campaign.create({
    data: {
      campaignCode: "TRP-2026-0006", name: "Coyhaique Aniversario", businessUnitId: gaucha.id,
      status: "DRAFT", startDate: new Date("2026-10-01"), endDate: new Date("2026-10-15"), ownerId: leo.id,
    },
  });

  // --- Presupuestos y gastos (mismos montos del prototipo) ---
  const budget1 = await prisma.budget.create({ data: { businessUnitId: cerveceria.id, campaignId: camp1.id, periodYear: 2026, assignedAmount: 500000 } });
  await prisma.expense.createMany({
    data: [
      { campaignId: camp1.id, businessUnitId: cerveceria.id, budgetId: budget1.id, amount: 180000, category: "Producción audiovisual", status: "PAID", date: new Date("2026-09-01") },
      { campaignId: camp1.id, businessUnitId: cerveceria.id, budgetId: budget1.id, amount: 140000, category: "Pauta digital", status: "PAID", date: new Date("2026-09-03") },
    ],
  });

  const budget2 = await prisma.budget.create({ data: { businessUnitId: mesa.id, campaignId: camp2.id, periodYear: 2026, assignedAmount: 1200000 } });
  await prisma.expense.createMany({
    data: [
      { campaignId: camp2.id, businessUnitId: mesa.id, budgetId: budget2.id, amount: 60000, category: "Impresión POP", status: "PAID", date: new Date("2026-09-04") },
      { campaignId: camp2.id, businessUnitId: mesa.id, budgetId: budget2.id, amount: 90000, category: "Producción audiovisual", status: "PAID", date: new Date("2026-09-05") },
      { campaignId: camp2.id, businessUnitId: mesa.id, budgetId: budget2.id, amount: 130000, category: "Pauta digital", status: "COMMITTED", date: new Date("2026-09-06") },
    ],
  });

  const budget3 = await prisma.budget.create({ data: { businessUnitId: biergarten.id, campaignId: camp3.id, periodYear: 2026, assignedAmount: 300000 } });
  await prisma.expense.create({
    data: { campaignId: camp3.id, businessUnitId: biergarten.id, budgetId: budget3.id, amount: 40000, category: "Instalación física", status: "COMMITTED", date: new Date("2026-09-07") },
  });

  const budget5 = await prisma.budget.create({ data: { businessUnitId: ecommerce.id, campaignId: camp5.id, periodYear: 2026, assignedAmount: 400000 } });
  await prisma.expense.createMany({
    data: [
      { campaignId: camp5.id, businessUnitId: ecommerce.id, budgetId: budget5.id, amount: 20000, category: "Pauta digital", status: "COMMITTED", date: new Date("2026-09-08") },
      { campaignId: camp5.id, businessUnitId: ecommerce.id, budgetId: budget5.id, amount: 410000, category: "Pauta digital", status: "PAID", date: new Date("2026-09-08") },
    ],
  });

  // --- Producción ---
  const project1 = await prisma.productionProject.create({ data: { campaignId: camp1.id, name: "Producción Lanzamiento IPA", status: "IN_PRODUCTION" } });
  await prisma.task.createMany({
    data: [
      { productionProjectId: project1.id, campaignId: camp1.id, title: "Reel lanzamiento IPA", type: "Video", assigneeId: vale.id, dueDate: new Date("2026-09-10"), status: "IN_PROGRESS", priority: "HIGH", cost: 45000 },
      { productionProjectId: project1.id, campaignId: camp1.id, title: "Fotos de producto IPA", type: "Fotografía", assigneeId: fran.id, dueDate: new Date("2026-09-08"), status: "REVIEW", priority: "MEDIUM", cost: 30000 },
    ],
  });

  const project2 = await prisma.productionProject.create({ data: { campaignId: camp2.id, name: "Producción Fiestas Patrias", status: "IN_PRODUCTION" } });
  await prisma.task.createMany({
    data: [
      { productionProjectId: project2.id, campaignId: camp2.id, title: "Set de posavasos", type: "Diseño", assigneeId: cote.id, dueDate: new Date("2026-09-06"), status: "DONE", priority: "HIGH", cost: 60000 },
      { productionProjectId: project2.id, campaignId: camp2.id, title: "Video institucional", type: "Edición", assigneeId: fran.id, dueDate: new Date("2026-09-12"), status: "IN_PROGRESS", priority: "MEDIUM", cost: 90000 },
    ],
  });

  // --- Vendors ---
  await prisma.vendor.createMany({
    data: [
      { name: "Estudio Andino", type: "Productora" },
      { name: "Imprenta Sur", type: "Imprenta" },
      { name: "Instaladores Lagos", type: "Instaladores" },
    ],
  });

  // --- Ideas ---
  await prisma.idea.createMany({
    data: [
      { title: "Activación food truck Cervecería en playa Frutillar", businessUnitId: cerveceria.id, impact: "Alto", status: "EVALUATION" },
      { title: "Alianza con hostales para pack bienvenida", businessUnitId: mesa.id, impact: "Medio", status: "IDEA" },
    ],
  });

  // --- E-commerce ---
  const cliente = await prisma.customer.create({ data: { email: "cliente-demo@correo.cl", name: "Cliente Demo" } });
  const producto = await prisma.product.create({ data: { sku: "CERV-IPA-330", name: "IPA Patagonia 330ml", category: "Cerveza", price: 2990, stock: 480 } });
  const orden = await prisma.order.create({
    data: { customerId: cliente.id, date: new Date("2026-09-05"), revenue: 32900, campaignId: camp5.id, utmCampaign: camp5.campaignCode, utmSource: "meta", utmMedium: "social" },
  });
  await prisma.orderItem.create({ data: { orderId: orden.id, productId: producto.id, quantity: 1, unitPrice: 32900 } });

  // --- Data Health inicial ---
  await prisma.integrationLog.createMany({
    data: [
      { platform: "Meta Ads", status: "CONNECTED", recordsProcessed: 4820 },
      { platform: "Google Ads", status: "CONNECTED", recordsProcessed: 3110 },
      { platform: "GA4", status: "CONNECTED", recordsProcessed: 9840 },
      { platform: "Search Console", status: "PENDING" },
      { platform: "Tienda Online", status: "PENDING" },
      { platform: "Mailing", status: "PENDING" },
    ],
  });

  console.log("Listo. Datos demo cargados.");
  console.log("Usuarios de prueba (contraseña para todos: 'tropera2026'):");
  console.log("  admin@tropera.cl       (Admin)");
  console.log("  leo@tropera.cl         (Marketing Manager)");
  console.log("  vale@tropera.cl        (Team Member)");
  console.log("  fran@tropera.cl        (Team Member)");
  console.log("  cote@tropera.cl        (Team Member)");
  console.log("  viewer@tropera.cl      (Viewer)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
