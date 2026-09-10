"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/permissions";

const campaignSchema = z.object({
  name: z.string().min(2, "El nombre debe tener al menos 2 caracteres."),
  campaignCode: z.string().min(2, "El código es obligatorio."),
  businessUnitId: z.string().min(1, "Debes elegir una unidad."),
  objective: z.string().optional().or(z.literal("")),
  status: z.enum(["DRAFT", "ACTIVE", "PAUSED", "COMPLETED", "CANCELLED"]),
  startDate: z.string().min(1, "La fecha de inicio es obligatoria."),
  endDate: z.string().min(1, "La fecha de término es obligatoria."),
  ownerId: z.string().optional().or(z.literal("")),
});

const taskSchema = z.object({
  title: z.string().min(2, "El título es obligatorio."),
  type: z.string().optional().or(z.literal("")),
  assigneeId: z.string().optional().or(z.literal("")),
  campaignId: z.string().optional().or(z.literal("")),
  productionProjectId: z.string().optional().or(z.literal("")),
  dueDate: z.string().optional().or(z.literal("")),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).default("MEDIUM"),
  status: z.enum(["TODO", "IN_PROGRESS", "REVIEW", "DONE"]).default("TODO"),
  cost: z.string().optional().or(z.literal("")),
});

const projectSchema = z.object({
  name: z.string().min(2, "El nombre del proyecto es obligatorio."),
  campaignId: z.string().optional().or(z.literal("")),
  purpose: z.enum(["CAMPAIGN", "EVERGREEN", "BRAND"]).default("CAMPAIGN"),
  status: z.enum(["BACKLOG", "IN_PRODUCTION", "REVIEW", "APPROVED", "PUBLISHED", "IMPLEMENTED"]).default("BACKLOG"),
});

const budgetSchema = z.object({
  businessUnitId: z.string().min(1, "Debes elegir una unidad."),
  campaignId: z.string().optional().or(z.literal("")),
  periodYear: z.coerce.number().min(2024, "El año es obligatorio."),
  assignedAmount: z.coerce.number().min(0, "El presupuesto debe ser mayor o igual a 0."),
});

const expenseSchema = z.object({
  campaignId: z.string().optional().or(z.literal("")),
  businessUnitId: z.string().min(1, "Debes elegir una unidad."),
  budgetId: z.string().optional().or(z.literal("")),
  category: z.string().min(2, "La categoría es obligatoria."),
  amount: z.coerce.number().min(1, "El monto debe ser mayor a 0."),
  status: z.enum(["PLANNED", "COMMITTED", "PAID"]).default("PLANNED"),
  date: z.string().min(1, "La fecha es obligatoria."),
  vendorId: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
});

export async function createCampaignAction(formData: FormData) {
  await requireRole(["ADMIN", "MARKETING_MANAGER"]);

  const payload = campaignSchema.parse({
    name: formData.get("name"),
    campaignCode: formData.get("campaignCode"),
    businessUnitId: formData.get("businessUnitId"),
    objective: formData.get("objective") ?? "",
    status: formData.get("status") ?? "DRAFT",
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    ownerId: formData.get("ownerId") ?? "",
  });

  const campaign = await prisma.campaign.create({
    data: {
      name: payload.name,
      campaignCode: payload.campaignCode,
      businessUnitId: payload.businessUnitId,
      objective: payload.objective || null,
      status: payload.status,
      startDate: new Date(payload.startDate),
      endDate: new Date(payload.endDate),
      ownerId: payload.ownerId || null,
    },
  });

  revalidatePath("/campaigns");
  revalidatePath(`/campaigns/${campaign.campaignCode}`);
  redirect(`/campaigns/${campaign.campaignCode}?success=campaign-created`);
}

export async function updateCampaignAction(formData: FormData) {
  await requireRole(["ADMIN", "MARKETING_MANAGER"]);

  const payload = campaignSchema.parse({
    name: formData.get("name"),
    campaignCode: formData.get("campaignCode"),
    businessUnitId: formData.get("businessUnitId"),
    objective: formData.get("objective") ?? "",
    status: formData.get("status") ?? "DRAFT",
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    ownerId: formData.get("ownerId") ?? "",
  });

  const id = String(formData.get("id"));
  const current = await prisma.campaign.findUnique({ where: { id } });
  if (!current) redirect("/campaigns?error=campaign-not-found");

  const updated = await prisma.campaign.update({
    where: { id },
    data: {
      name: payload.name,
      businessUnitId: payload.businessUnitId,
      objective: payload.objective || null,
      status: payload.status,
      startDate: new Date(payload.startDate),
      endDate: new Date(payload.endDate),
      ownerId: payload.ownerId || null,
      campaignCode: payload.campaignCode,
    },
  });

  revalidatePath("/campaigns");
  revalidatePath(`/campaigns/${updated.campaignCode}`);
  redirect(`/campaigns/${updated.campaignCode}?success=campaign-updated`);
}

export async function updateCampaignStatusAction(formData: FormData) {
  await requireRole(["ADMIN", "MARKETING_MANAGER"]);

  const id = String(formData.get("id"));
  const status = String(formData.get("status")) as "DRAFT" | "ACTIVE" | "PAUSED" | "COMPLETED" | "CANCELLED";

  const campaign = await prisma.campaign.update({
    where: { id },
    data: { status },
  });

  revalidatePath("/campaigns");
  revalidatePath(`/campaigns/${campaign.campaignCode}`);
  redirect(`/campaigns?success=status-updated`);
}

export async function deleteCampaignAction(formData: FormData) {
  await requireRole(["ADMIN", "MARKETING_MANAGER"]);

  const id = String(formData.get("id"));
  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: { tasks: true, expenses: true, budgets: true, productionProjects: true, learnings: true, digitalAdCampaigns: true, physicalPlacements: true, metrics: true, orders: true },
  });

  if (!campaign) redirect("/campaigns?error=campaign-not-found");

  await prisma.$transaction([
    prisma.task.deleteMany({ where: { campaignId: id } }),
    prisma.expense.deleteMany({ where: { campaignId: id } }),
    prisma.budget.deleteMany({ where: { campaignId: id } }),
    prisma.metric.deleteMany({ where: { campaignId: id } }),
    prisma.learning.deleteMany({ where: { campaignId: id } }),
    prisma.order.deleteMany({ where: { campaignId: id } }),
    prisma.physicalAdPlacement.deleteMany({ where: { campaignId: id } }),
    prisma.digitalAdCampaign.deleteMany({ where: { campaignId: id } }),
    prisma.asset.deleteMany({ where: { productionProject: { campaignId: id } } }),
    prisma.task.deleteMany({ where: { productionProject: { campaignId: id } } }),
    prisma.productionProject.deleteMany({ where: { campaignId: id } }),
    prisma.campaign.delete({ where: { id } }),
  ]);

  revalidatePath("/campaigns");
  revalidatePath("/dashboard");
  redirect("/campaigns?success=campaign-deleted");
}

export async function createTaskAction(formData: FormData) {
  await requireRole(["ADMIN", "MARKETING_MANAGER", "TEAM_MEMBER"]);

  const payload = taskSchema.parse({
    title: formData.get("title"),
    type: formData.get("type") ?? "",
    assigneeId: formData.get("assigneeId") ?? "",
    campaignId: formData.get("campaignId") ?? "",
    productionProjectId: formData.get("productionProjectId") ?? "",
    dueDate: formData.get("dueDate") ?? "",
    priority: formData.get("priority") ?? "MEDIUM",
    status: formData.get("status") ?? "TODO",
    cost: formData.get("cost") ?? "",
  });

  const task = await prisma.task.create({
    data: {
      title: payload.title,
      type: payload.type || null,
      assigneeId: payload.assigneeId || null,
      campaignId: payload.campaignId || null,
      productionProjectId: payload.productionProjectId || null,
      dueDate: payload.dueDate ? new Date(payload.dueDate) : null,
      priority: payload.priority,
      status: payload.status,
      cost: payload.cost ? Number(payload.cost) : null,
    },
  });

  revalidatePath("/today");
  revalidatePath("/calendar");
  revalidatePath("/campaigns");
  revalidatePath(`/campaigns/${task.campaignId ? (await prisma.campaign.findUnique({ where: { id: task.campaignId } }))?.campaignCode : ""}`);
  redirect(`/campaigns/${(await prisma.campaign.findUnique({ where: { id: task.campaignId ?? "" } }))?.campaignCode ?? "campaigns"}?success=task-created`);
}

export async function deleteTaskAction(formData: FormData) {
  await requireRole(["ADMIN", "MARKETING_MANAGER", "TEAM_MEMBER"]);

  const id = String(formData.get("id"));
  const task = await prisma.task.findUnique({ where: { id } });
  if (!task) redirect("/campaigns?error=task-not-found");

  await prisma.task.delete({ where: { id } });
  revalidatePath("/today");
  revalidatePath("/calendar");
  revalidatePath("/campaigns");
  redirect(`/campaigns/${task.campaignId ? (await prisma.campaign.findUnique({ where: { id: task.campaignId } }))?.campaignCode ?? "campaigns" : "campaigns"}?success=task-deleted`);
}

export async function createProductionProjectAction(formData: FormData) {
  await requireRole(["ADMIN", "MARKETING_MANAGER", "TEAM_MEMBER"]);

  const payload = projectSchema.parse({
    name: formData.get("name"),
    campaignId: formData.get("campaignId") ?? "",
    purpose: formData.get("purpose") ?? "CAMPAIGN",
    status: formData.get("status") ?? "BACKLOG",
  });

  const project = await prisma.productionProject.create({
    data: {
      name: payload.name,
      campaignId: payload.campaignId || null,
      purpose: payload.purpose,
      status: payload.status,
    },
  });

  revalidatePath("/production");
  revalidatePath("/campaigns");
  redirect(`/campaigns/${project.campaignId ? (await prisma.campaign.findUnique({ where: { id: project.campaignId } }))?.campaignCode ?? "campaigns" : "campaigns"}?success=project-created`);
}

export async function deleteProductionProjectAction(formData: FormData) {
  await requireRole(["ADMIN", "MARKETING_MANAGER"]);

  const id = String(formData.get("id"));
  const project = await prisma.productionProject.findUnique({ where: { id }, include: { tasks: true, assets: true } });
  if (!project) redirect("/production?error=project-not-found");

  await prisma.$transaction([
    prisma.asset.deleteMany({ where: { productionProjectId: id } }),
    prisma.task.deleteMany({ where: { productionProjectId: id } }),
    prisma.productionProject.delete({ where: { id } }),
  ]);

  revalidatePath("/production");
  redirect(`/campaigns/${project.campaignId ? (await prisma.campaign.findUnique({ where: { id: project.campaignId } }))?.campaignCode ?? "campaigns" : "campaigns"}?success=project-deleted`);
}

export async function createBudgetAction(formData: FormData) {
  await requireRole(["ADMIN", "MARKETING_MANAGER"]);

  const payload = budgetSchema.parse({
    businessUnitId: formData.get("businessUnitId"),
    campaignId: formData.get("campaignId") ?? "",
    periodYear: formData.get("periodYear"),
    assignedAmount: formData.get("assignedAmount"),
  });

  const budget = await prisma.budget.create({
    data: {
      businessUnitId: payload.businessUnitId,
      campaignId: payload.campaignId || null,
      periodYear: payload.periodYear,
      periodMonth: null,
      assignedAmount: payload.assignedAmount,
    },
  });

  revalidatePath("/budget");
  revalidatePath("/campaigns");
  revalidatePath(`/campaigns/${budget.campaignId ? (await prisma.campaign.findUnique({ where: { id: budget.campaignId } }))?.campaignCode ?? "campaigns" : "campaigns"}`);
  redirect(`/campaigns/${budget.campaignId ? (await prisma.campaign.findUnique({ where: { id: budget.campaignId } }))?.campaignCode ?? "campaigns" : "campaigns"}?success=budget-created`);
}

export async function createExpenseAction(formData: FormData) {
  await requireRole(["ADMIN", "MARKETING_MANAGER"]);

  const payload = expenseSchema.parse({
    campaignId: formData.get("campaignId") ?? "",
    businessUnitId: formData.get("businessUnitId"),
    budgetId: formData.get("budgetId") ?? "",
    category: formData.get("category"),
    amount: formData.get("amount"),
    status: formData.get("status") ?? "PLANNED",
    date: formData.get("date"),
    vendorId: formData.get("vendorId") ?? "",
    notes: formData.get("notes") ?? "",
  });

  const expense = await prisma.expense.create({
    data: {
      campaignId: payload.campaignId || null,
      businessUnitId: payload.businessUnitId,
      budgetId: payload.budgetId || null,
      category: payload.category,
      amount: payload.amount,
      status: payload.status,
      date: new Date(payload.date),
      vendorId: payload.vendorId || null,
      notes: payload.notes || null,
    },
  });

  revalidatePath("/budget");
  revalidatePath("/dashboard");
  revalidatePath(`/campaigns/${expense.campaignId ? (await prisma.campaign.findUnique({ where: { id: expense.campaignId } }))?.campaignCode ?? "campaigns" : "campaigns"}`);
  redirect(`/campaigns/${expense.campaignId ? (await prisma.campaign.findUnique({ where: { id: expense.campaignId } }))?.campaignCode ?? "campaigns" : "campaigns"}?success=expense-created`);
}

export async function deleteExpenseAction(formData: FormData) {
  await requireRole(["ADMIN", "MARKETING_MANAGER"]);

  const id = String(formData.get("id"));
  const expense = await prisma.expense.findUnique({ where: { id } });
  if (!expense) redirect("/budget?error=expense-not-found");

  await prisma.expense.delete({ where: { id } });
  revalidatePath("/budget");
  redirect(`/campaigns/${expense.campaignId ? (await prisma.campaign.findUnique({ where: { id: expense.campaignId } }))?.campaignCode ?? "campaigns" : "campaigns"}?success=expense-deleted`);
}
