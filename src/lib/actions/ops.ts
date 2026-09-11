"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole, requireSession } from "@/lib/permissions";

function withParam(path: string, key: string, value: string) {
  return `${path}${path.includes("?") ? "&" : "?"}${key}=${value}`;
}

const axisSchema = z.enum(["RECOGNITION", "PROMOTIONS", "EVENTS", "DELIVERY"]).optional().or(z.literal(""));

const campaignSchema = z.object({
  name: z.string().min(2, "El nombre debe tener al menos 2 caracteres."),
  campaignCode: z.string().min(2, "El código es obligatorio."),
  businessUnitId: z.string().min(1, "Debes elegir una unidad."),
  objective: z.string().optional().or(z.literal("")),
  axis: axisSchema,
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
  format: z.string().min(1, "El formato es obligatorio.").default("Post"),
  formatOther: z.string().optional().or(z.literal("")),
  status: z.enum(["BACKLOG", "IN_PRODUCTION", "REVIEW", "APPROVED", "PUBLISHED", "IMPLEMENTED"]).default("BACKLOG"),
  assigneeId: z.string().optional().or(z.literal("")),
  dueDate: z.string().optional().or(z.literal("")),
  budgetAmount: z.coerce.number().min(0).optional().or(z.literal("")),
  referenceUrl: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
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
  locationId: z.string().optional().or(z.literal("")),
  axis: axisSchema,
  category: z.string().min(2, "La categoría es obligatoria."),
  amount: z.coerce.number().min(1, "El monto debe ser mayor a 0."),
  status: z.enum(["PLANNED", "COMMITTED", "PAID"]).default("PLANNED"),
  date: z.string().min(1, "La fecha es obligatoria."),
  vendorId: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
});

const budgetMatrixSchema = z.object({
  periodYear: z.coerce.number().min(2024, "El año es obligatorio."),
  periodMonth: z.coerce.number().min(1).max(12),
  amount: z.coerce.number().min(0, "El monto debe ser mayor o igual a 0."),
  notes: z.string().optional().or(z.literal("")),
});

const teamMemberSchema = z.object({
  name: z.string().trim().min(2, "El nombre es obligatorio."),
  email: z.string().trim().email("Debes ingresar un correo válido."),
  systemRole: z.enum(["ADMIN", "MARKETING_MANAGER", "TEAM_MEMBER", "VIEWER"]).default("TEAM_MEMBER"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres."),
  functionalRoleIds: z.array(z.string()).default([]),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Debes ingresar tu contraseña actual."),
  newPassword: z.string().min(8, "La nueva contraseña debe tener al menos 8 caracteres."),
  confirmPassword: z.string().min(1, "Debes confirmar la nueva contraseña."),
});

const adAccountSchema = z.object({
  id: z.string().min(1),
  platformId: z.string().min(1),
  businessUnitId: z.string().min(1),
  externalAccountId: z.string().trim().min(1, "Debes indicar el ID externo."),
});

const advertisingSpaceSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(2, "El nombre es obligatorio."),
  locationId: z.string().min(1, "Debes elegir una ubicación."),
  typeId: z.string().min(1, "Debes elegir un tipo."),
  dimensions: z.string().optional().or(z.literal("")),
  status: z.enum(["AVAILABLE", "IN_USE", "RESERVED", "MAINTENANCE"]).default("AVAILABLE"),
  estimatedCost: z.coerce.number().min(0).optional().or(z.literal("")),
});

const physicalPlacementSchema = z.object({
  id: z.string().min(1),
  campaignId: z.string().min(1, "Debes elegir una campaña."),
  advertisingSpaceId: z.string().min(1, "Debes elegir un espacio."),
  installDate: z.string().optional().or(z.literal("")),
  removalDate: z.string().optional().or(z.literal("")),
  cost: z.coerce.number().min(0).optional().or(z.literal("")),
  status: z.string().default("PLANNED"),
  photoUrl: z.string().optional().or(z.literal("")),
});

export async function createTeamMemberAction(formData: FormData) {
  await requireRole(["ADMIN"]);

  const payload = teamMemberSchema.parse({
    name: formData.get("name"),
    email: formData.get("email"),
    systemRole: formData.get("systemRole") ?? "TEAM_MEMBER",
    password: formData.get("password"),
    functionalRoleIds: formData.getAll("functionalRoleIds").map(String),
  });

  const existingUser = await prisma.user.findUnique({ where: { email: payload.email.toLowerCase() } });
  if (existingUser) {
    redirect("/team?error=member-exists");
  }

  await prisma.user.create({
    data: {
      name: payload.name,
      email: payload.email.toLowerCase(),
      systemRole: payload.systemRole,
      passwordHash: await bcrypt.hash(payload.password, 10),
      functionalRoles: payload.functionalRoleIds.length
        ? { connect: payload.functionalRoleIds.map((id) => ({ id })) }
        : undefined,
    },
  });

  revalidatePath("/team");
  redirect("/team?success=member-created");
}

export async function deleteTeamMemberAction(formData: FormData) {
  await requireRole(["ADMIN", "MARKETING_MANAGER"]);

  const id = String(formData.get("id") ?? "");
  if (!id) {
    redirect("/team?error=member-not-found");
  }

  const member = await prisma.user.findUnique({
    where: { id },
    include: { functionalRoles: true, assignedTasks: true, ownedCampaigns: true, ideas: true },
  });

  if (!member) {
    redirect("/team?error=member-not-found");
  }

  const adminCount = await prisma.user.count({ where: { systemRole: "ADMIN" } });
  if (member.systemRole === "ADMIN" && adminCount <= 1) {
    redirect("/team?error=admin-protected");
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id },
      data: {
        functionalRoles: { set: [] },
      },
    }),
    prisma.task.updateMany({ where: { assigneeId: id }, data: { assigneeId: null } }),
    prisma.campaign.updateMany({ where: { ownerId: id }, data: { ownerId: null } }),
    prisma.idea.updateMany({ where: { ownerId: id }, data: { ownerId: null } }),
    prisma.user.delete({ where: { id } }),
  ]);

  revalidatePath("/team");
  redirect("/team?success=member-deleted");
}

export async function updateMyPasswordAction(formData: FormData) {
  const session = await requireSession();

  const payload = changePasswordSchema.parse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (payload.newPassword !== payload.confirmPassword) {
    redirect("/settings?error=password-mismatch");
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user || !user.passwordHash) {
    redirect("/settings?error=user-not-found");
  }

  const validCurrentPassword = await bcrypt.compare(payload.currentPassword, user.passwordHash);
  if (!validCurrentPassword) {
    redirect("/settings?error=password-invalid");
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { passwordHash: await bcrypt.hash(payload.newPassword, 10) },
  });

  revalidatePath("/settings");
  redirect("/settings?success=password-updated");
}

export async function updateAdAccountAction(formData: FormData) {
  await requireRole(["ADMIN", "MARKETING_MANAGER"]);

  const payload = adAccountSchema.parse({
    id: formData.get("id"),
    platformId: formData.get("platformId"),
    businessUnitId: formData.get("businessUnitId"),
    externalAccountId: formData.get("externalAccountId"),
  });

  await prisma.adAccount.update({
    where: { id: payload.id },
    data: {
      platformId: payload.platformId,
      businessUnitId: payload.businessUnitId,
      externalAccountId: payload.externalAccountId,
    },
  });

  revalidatePath("/advertising");
  redirect("/advertising?success=ad-account-updated");
}

export async function deleteAdAccountAction(formData: FormData) {
  await requireRole(["ADMIN", "MARKETING_MANAGER"]);

  const id = String(formData.get("id"));
  await prisma.adAccount.delete({ where: { id } });
  revalidatePath("/advertising");
  redirect("/advertising?success=ad-account-deleted");
}

export async function updateAdvertisingSpaceAction(formData: FormData) {
  await requireRole(["ADMIN", "MARKETING_MANAGER"]);

  const payload = advertisingSpaceSchema.parse({
    id: formData.get("id"),
    name: formData.get("name"),
    locationId: formData.get("locationId"),
    typeId: formData.get("typeId"),
    dimensions: formData.get("dimensions") ?? "",
    status: formData.get("status") ?? "AVAILABLE",
    estimatedCost: formData.get("estimatedCost") ?? "",
  });

  await prisma.advertisingSpace.update({
    where: { id: payload.id },
    data: {
      name: payload.name,
      locationId: payload.locationId,
      typeId: payload.typeId,
      dimensions: payload.dimensions || null,
      status: payload.status,
      estimatedCost: payload.estimatedCost ? Number(payload.estimatedCost) : null,
    },
  });

  revalidatePath("/advertising");
  redirect("/advertising?success=space-updated");
}

export async function deleteAdvertisingSpaceAction(formData: FormData) {
  await requireRole(["ADMIN", "MARKETING_MANAGER"]);

  const id = String(formData.get("id"));
  await prisma.$transaction([
    prisma.physicalAdPlacement.deleteMany({ where: { advertisingSpaceId: id } }),
    prisma.advertisingSpace.delete({ where: { id } }),
  ]);
  revalidatePath("/advertising");
  redirect("/advertising?success=space-deleted");
}

export async function updatePhysicalPlacementAction(formData: FormData) {
  await requireRole(["ADMIN", "MARKETING_MANAGER"]);

  const payload = physicalPlacementSchema.parse({
    id: formData.get("id"),
    campaignId: formData.get("campaignId") ?? "",
    advertisingSpaceId: formData.get("advertisingSpaceId"),
    installDate: formData.get("installDate") ?? "",
    removalDate: formData.get("removalDate") ?? "",
    cost: formData.get("cost") ?? "",
    status: formData.get("status") ?? "PLANNED",
    photoUrl: formData.get("photoUrl") ?? "",
  });

  await prisma.physicalAdPlacement.update({
    where: { id: payload.id },
    data: {
      campaignId: payload.campaignId,
      advertisingSpaceId: payload.advertisingSpaceId,
      installDate: payload.installDate ? new Date(payload.installDate) : null,
      removalDate: payload.removalDate ? new Date(payload.removalDate) : null,
      cost: payload.cost ? Number(payload.cost) : null,
      status: payload.status,
      photoUrl: payload.photoUrl || null,
    },
  });

  revalidatePath("/advertising");
  redirect("/advertising?success=placement-updated");
}

export async function deletePhysicalPlacementAction(formData: FormData) {
  await requireRole(["ADMIN", "MARKETING_MANAGER"]);

  const id = String(formData.get("id"));
  await prisma.physicalAdPlacement.delete({ where: { id } });
  revalidatePath("/advertising");
  redirect("/advertising?success=placement-deleted");
}

export async function createCampaignAction(formData: FormData) {
  await requireRole(["ADMIN", "MARKETING_MANAGER"]);

  const redirectTo = String(formData.get("redirectTo") ?? "").trim();

  const payload = campaignSchema.parse({
    name: formData.get("name"),
    campaignCode: formData.get("campaignCode"),
    businessUnitId: formData.get("businessUnitId"),
    objective: formData.get("objective") ?? "",
    axis: formData.get("axis") ?? "",
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
      axis: payload.axis || null,
      status: payload.status,
      startDate: new Date(payload.startDate),
      endDate: new Date(payload.endDate),
      ownerId: payload.ownerId || null,
    },
  });

  revalidatePath("/campaigns");
  revalidatePath(`/campaigns/${campaign.campaignCode}`);
  redirect(withParam(redirectTo || `/campaigns/${campaign.campaignCode}`, "success", "campaign-created"));
}

export async function updateCampaignAction(formData: FormData) {
  await requireRole(["ADMIN", "MARKETING_MANAGER"]);

  const redirectTo = String(formData.get("redirectTo") ?? "").trim();

  const payload = campaignSchema.parse({
    name: formData.get("name"),
    campaignCode: formData.get("campaignCode"),
    businessUnitId: formData.get("businessUnitId"),
    objective: formData.get("objective") ?? "",
    axis: formData.get("axis") ?? "",
    status: formData.get("status") ?? "DRAFT",
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    ownerId: formData.get("ownerId") ?? "",
  });

  const id = String(formData.get("id"));
  const current = await prisma.campaign.findUnique({ where: { id } });
  if (!current) redirect(withParam(redirectTo || "/campaigns", "error", "campaign-not-found"));

  const updated = await prisma.campaign.update({
    where: { id },
    data: {
      name: payload.name,
      businessUnitId: payload.businessUnitId,
      objective: payload.objective || null,
      axis: payload.axis || null,
      status: payload.status,
      startDate: new Date(payload.startDate),
      endDate: new Date(payload.endDate),
      ownerId: payload.ownerId || null,
      campaignCode: payload.campaignCode,
    },
  });

  revalidatePath("/campaigns");
  revalidatePath(`/campaigns/${updated.campaignCode}`);
  redirect(withParam(redirectTo || `/campaigns/${updated.campaignCode}`, "success", "campaign-updated"));
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

  const redirectTo = String(formData.get("redirectTo") ?? "").trim();

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

  let fallback = "/calendar";
  if (task.campaignId) {
    const campaign = await prisma.campaign.findUnique({ where: { id: task.campaignId } });
    revalidatePath(`/campaigns/${campaign?.campaignCode ?? ""}`);
    fallback = `/campaigns/${campaign?.campaignCode ?? "campaigns"}`;
  }

  redirect(withParam(redirectTo || fallback, "success", "task-created"));
}

export async function updateTaskAction(formData: FormData) {
  await requireRole(["ADMIN", "MARKETING_MANAGER", "TEAM_MEMBER"]);

  const redirectTo = String(formData.get("redirectTo") ?? "").trim();

  const id = String(formData.get("id"));
  const task = await prisma.task.findUnique({ where: { id } });
  if (!task) redirect(withParam(redirectTo || "/calendar", "error", "task-not-found"));

  const payload = taskSchema.parse({
    title: formData.get("title") ?? task.title,
    type: formData.get("type") ?? task.type ?? "",
    assigneeId: formData.get("assigneeId") ?? task.assigneeId ?? "",
    campaignId: formData.get("campaignId") ?? task.campaignId ?? "",
    productionProjectId: formData.get("productionProjectId") ?? task.productionProjectId ?? "",
    dueDate: formData.get("dueDate") ?? (task.dueDate ? task.dueDate.toISOString().slice(0, 10) : ""),
    priority: formData.get("priority") ?? task.priority,
    status: formData.get("status") ?? task.status,
    cost: formData.get("cost") ?? String(task.cost ?? ""),
  });

  const updated = await prisma.task.update({
    where: { id },
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

  let fallback = "/calendar";
  if (updated.campaignId) {
    const campaign = await prisma.campaign.findUnique({ where: { id: updated.campaignId } });
    revalidatePath(`/campaigns/${campaign?.campaignCode ?? ""}`);
    fallback = `/campaigns/${campaign?.campaignCode ?? "campaigns"}`;
  }

  redirect(withParam(redirectTo || fallback, "success", "task-updated"));
}

export async function deleteTaskAction(formData: FormData) {
  await requireRole(["ADMIN", "MARKETING_MANAGER", "TEAM_MEMBER"]);

  const redirectTo = String(formData.get("redirectTo") ?? "").trim();

  const id = String(formData.get("id"));
  const task = await prisma.task.findUnique({ where: { id } });
  if (!task) redirect(withParam(redirectTo || "/calendar", "error", "task-not-found"));

  await prisma.task.delete({ where: { id } });
  revalidatePath("/today");
  revalidatePath("/calendar");
  revalidatePath("/campaigns");

  let fallback = "/calendar";
  if (task.campaignId) {
    const campaign = await prisma.campaign.findUnique({ where: { id: task.campaignId } });
    fallback = `/campaigns/${campaign?.campaignCode ?? "campaigns"}`;
  }

  redirect(withParam(redirectTo || fallback, "success", "task-deleted"));
}

// El <select> de formato ofrece presets + "Otro"; si se elige "Otro" se usa
// el texto libre de formatOther como formato real guardado.
function resolveFormat(format: string, formatOther?: string) {
  if (format === "Otro" && formatOther?.trim()) return formatOther.trim();
  return format;
}

export async function createProductionProjectAction(formData: FormData) {
  await requireRole(["ADMIN", "MARKETING_MANAGER", "TEAM_MEMBER"]);

  const redirectTo = String(formData.get("redirectTo") ?? "").trim();

  const payload = projectSchema.parse({
    name: formData.get("name"),
    campaignId: formData.get("campaignId") ?? "",
    format: formData.get("format") || "Post",
    formatOther: formData.get("formatOther") ?? "",
    status: formData.get("status") ?? "BACKLOG",
    assigneeId: formData.get("assigneeId") ?? "",
    dueDate: formData.get("dueDate") ?? "",
    budgetAmount: formData.get("budgetAmount") ?? "",
    referenceUrl: formData.get("referenceUrl") ?? "",
    notes: formData.get("notes") ?? "",
  });

  const project = await prisma.productionProject.create({
    data: {
      name: payload.name,
      campaignId: payload.campaignId || null,
      format: resolveFormat(payload.format, payload.formatOther),
      status: payload.status,
      assigneeId: payload.assigneeId || null,
      dueDate: payload.dueDate ? new Date(payload.dueDate) : null,
      budgetAmount: payload.budgetAmount === "" || payload.budgetAmount === undefined ? null : payload.budgetAmount,
      referenceUrl: payload.referenceUrl || null,
      notes: payload.notes || null,
    },
  });

  revalidatePath("/production");
  revalidatePath("/campaigns");
  revalidatePath("/today");

  let fallback = "/production";
  if (project.campaignId) {
    const campaign = await prisma.campaign.findUnique({ where: { id: project.campaignId } });
    fallback = `/campaigns/${campaign?.campaignCode ?? "campaigns"}`;
  }

  redirect(withParam(redirectTo || fallback, "success", "project-created"));
}

export async function updateProductionProjectAction(formData: FormData) {
  await requireRole(["ADMIN", "MARKETING_MANAGER", "TEAM_MEMBER"]);

  const redirectTo = String(formData.get("redirectTo") ?? "").trim();

  const id = String(formData.get("id"));
  const current = await prisma.productionProject.findUnique({ where: { id } });
  if (!current) redirect(withParam(redirectTo || "/production", "error", "project-not-found"));

  const payload = projectSchema.parse({
    name: formData.get("name"),
    campaignId: formData.get("campaignId") ?? current.campaignId ?? "",
    format: formData.get("format") || current.format,
    formatOther: formData.get("formatOther") ?? "",
    status: formData.get("status") ?? current.status,
    assigneeId: formData.get("assigneeId") ?? current.assigneeId ?? "",
    dueDate: formData.get("dueDate") ?? (current.dueDate ? current.dueDate.toISOString().slice(0, 10) : ""),
    budgetAmount: formData.get("budgetAmount") ?? current.budgetAmount ?? "",
    referenceUrl: formData.get("referenceUrl") ?? current.referenceUrl ?? "",
    notes: formData.get("notes") ?? current.notes ?? "",
  });

  const updated = await prisma.productionProject.update({
    where: { id },
    data: {
      name: payload.name,
      campaignId: payload.campaignId || null,
      format: resolveFormat(payload.format, payload.formatOther),
      status: payload.status,
      assigneeId: payload.assigneeId || null,
      dueDate: payload.dueDate ? new Date(payload.dueDate) : null,
      budgetAmount: payload.budgetAmount === "" || payload.budgetAmount === undefined ? null : payload.budgetAmount,
      referenceUrl: payload.referenceUrl || null,
      notes: payload.notes || null,
    },
  });

  revalidatePath("/production");
  revalidatePath("/campaigns");
  revalidatePath("/today");

  let fallback = "/production";
  if (updated.campaignId) {
    const campaign = await prisma.campaign.findUnique({ where: { id: updated.campaignId } });
    fallback = `/campaigns/${campaign?.campaignCode ?? "campaigns"}`;
  }

  redirect(withParam(redirectTo || fallback, "success", "project-updated"));
}

export async function deleteProductionProjectAction(formData: FormData) {
  await requireRole(["ADMIN", "MARKETING_MANAGER"]);

  const redirectTo = String(formData.get("redirectTo") ?? "").trim();

  const id = String(formData.get("id"));
  const project = await prisma.productionProject.findUnique({ where: { id }, include: { tasks: true, assets: true } });
  if (!project) redirect(withParam(redirectTo || "/production", "error", "project-not-found"));

  await prisma.$transaction([
    prisma.asset.deleteMany({ where: { productionProjectId: id } }),
    prisma.task.deleteMany({ where: { productionProjectId: id } }),
    prisma.productionProject.delete({ where: { id } }),
  ]);

  revalidatePath("/production");
  revalidatePath("/today");

  let fallback = "/production";
  if (project.campaignId) {
    const campaign = await prisma.campaign.findUnique({ where: { id: project.campaignId } });
    fallback = `/campaigns/${campaign?.campaignCode ?? "campaigns"}`;
  }

  redirect(withParam(redirectTo || fallback, "success", "project-deleted"));
}

export async function createBudgetAction(formData: FormData) {
  await requireRole(["ADMIN", "MARKETING_MANAGER"]);

  const redirectTo = String(formData.get("redirectTo") ?? "").trim();

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

  let fallback = "/budget";
  if (budget.campaignId) {
    const campaign = await prisma.campaign.findUnique({ where: { id: budget.campaignId } });
    revalidatePath(`/campaigns/${campaign?.campaignCode ?? ""}`);
    fallback = `/campaigns/${campaign?.campaignCode ?? "campaigns"}`;
  }

  redirect(withParam(redirectTo || fallback, "success", "budget-created"));
}

export async function updateBudgetAction(formData: FormData) {
  await requireRole(["ADMIN", "MARKETING_MANAGER"]);

  const redirectTo = String(formData.get("redirectTo") ?? "").trim();

  const id = String(formData.get("id"));
  const current = await prisma.budget.findUnique({ where: { id } });
  if (!current) redirect(withParam(redirectTo || "/budget", "error", "budget-not-found"));

  const payload = budgetSchema.parse({
    businessUnitId: formData.get("businessUnitId") ?? current.businessUnitId,
    campaignId: formData.get("campaignId") ?? current.campaignId ?? "",
    periodYear: formData.get("periodYear") ?? current.periodYear,
    assignedAmount: formData.get("assignedAmount") ?? current.assignedAmount,
  });

  const updated = await prisma.budget.update({
    where: { id },
    data: {
      businessUnitId: payload.businessUnitId,
      campaignId: payload.campaignId || null,
      periodYear: payload.periodYear,
      assignedAmount: payload.assignedAmount,
    },
  });

  revalidatePath("/budget");
  revalidatePath("/campaigns");

  let fallback = "/budget";
  if (updated.campaignId) {
    const campaign = await prisma.campaign.findUnique({ where: { id: updated.campaignId } });
    fallback = `/campaigns/${campaign?.campaignCode ?? "campaigns"}`;
  }

  redirect(withParam(redirectTo || fallback, "success", "budget-updated"));
}

export async function deleteBudgetAction(formData: FormData) {
  await requireRole(["ADMIN", "MARKETING_MANAGER"]);

  const redirectTo = String(formData.get("redirectTo") ?? "").trim();

  const id = String(formData.get("id"));
  const budget = await prisma.budget.findUnique({ where: { id } });
  if (!budget) redirect(withParam(redirectTo || "/budget", "error", "budget-not-found"));

  await prisma.budget.delete({ where: { id } });
  revalidatePath("/budget");
  revalidatePath("/campaigns");

  let fallback = "/budget";
  if (budget.campaignId) {
    const campaign = await prisma.campaign.findUnique({ where: { id: budget.campaignId } });
    fallback = `/campaigns/${campaign?.campaignCode ?? "campaigns"}`;
  }

  redirect(withParam(redirectTo || fallback, "success", "budget-deleted"));
}

export async function createExpenseAction(formData: FormData) {
  await requireRole(["ADMIN", "MARKETING_MANAGER"]);

  const redirectTo = String(formData.get("redirectTo") ?? "").trim();

  const payload = expenseSchema.parse({
    campaignId: formData.get("campaignId") ?? "",
    businessUnitId: formData.get("businessUnitId"),
    budgetId: formData.get("budgetId") ?? "",
    locationId: formData.get("locationId") ?? "",
    axis: formData.get("axis") ?? "",
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
      locationId: payload.locationId || null,
      axis: payload.axis || null,
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

  let fallback = "/budget";
  if (expense.campaignId) {
    const campaign = await prisma.campaign.findUnique({ where: { id: expense.campaignId } });
    revalidatePath(`/campaigns/${campaign?.campaignCode ?? ""}`);
    fallback = `/campaigns/${campaign?.campaignCode ?? "campaigns"}`;
  }

  redirect(withParam(redirectTo || fallback, "success", "expense-created"));
}

export async function updateExpenseAction(formData: FormData) {
  await requireRole(["ADMIN", "MARKETING_MANAGER"]);

  const redirectTo = String(formData.get("redirectTo") ?? "").trim();

  const id = String(formData.get("id"));
  const current = await prisma.expense.findUnique({ where: { id } });
  if (!current) redirect(withParam(redirectTo || "/budget", "error", "expense-not-found"));

  const payload = expenseSchema.parse({
    campaignId: formData.get("campaignId") ?? current.campaignId ?? "",
    businessUnitId: formData.get("businessUnitId") ?? current.businessUnitId,
    budgetId: formData.get("budgetId") ?? current.budgetId ?? "",
    locationId: formData.get("locationId") ?? current.locationId ?? "",
    axis: formData.get("axis") ?? current.axis ?? "",
    category: formData.get("category") ?? current.category,
    amount: formData.get("amount") ?? current.amount,
    status: formData.get("status") ?? current.status,
    date: formData.get("date") ?? current.date.toISOString().slice(0, 10),
    vendorId: formData.get("vendorId") ?? current.vendorId ?? "",
    notes: formData.get("notes") ?? current.notes ?? "",
  });

  const updated = await prisma.expense.update({
    where: { id },
    data: {
      campaignId: payload.campaignId || null,
      businessUnitId: payload.businessUnitId,
      budgetId: payload.budgetId || null,
      locationId: payload.locationId || null,
      axis: payload.axis || null,
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

  let fallback = "/budget";
  if (updated.campaignId) {
    const campaign = await prisma.campaign.findUnique({ where: { id: updated.campaignId } });
    fallback = `/campaigns/${campaign?.campaignCode ?? "campaigns"}`;
  }

  redirect(withParam(redirectTo || fallback, "success", "expense-updated"));
}

export async function deleteExpenseAction(formData: FormData) {
  await requireRole(["ADMIN", "MARKETING_MANAGER"]);

  const redirectTo = String(formData.get("redirectTo") ?? "").trim();

  const id = String(formData.get("id"));
  const expense = await prisma.expense.findUnique({ where: { id } });
  if (!expense) redirect(withParam(redirectTo || "/budget", "error", "expense-not-found"));

  await prisma.expense.delete({ where: { id } });
  revalidatePath("/budget");

  let fallback = "/budget";
  if (expense.campaignId) {
    const campaign = await prisma.campaign.findUnique({ where: { id: expense.campaignId } });
    fallback = `/campaigns/${campaign?.campaignCode ?? "campaigns"}`;
  }

  redirect(withParam(redirectTo || fallback, "success", "expense-deleted"));
}

// Matriz presupuestaria — pool general mes a mes (§ ver schema.prisma BudgetMatrixEntry).
// Upsert por [periodYear, periodMonth]: reingresar el mismo mes actualiza el monto
// en vez de duplicar la fila, ya que el flujo es "ir ingresando mes a mes".
export async function createBudgetMatrixEntryAction(formData: FormData) {
  await requireRole(["ADMIN", "MARKETING_MANAGER"]);

  const redirectTo = String(formData.get("redirectTo") ?? "").trim();

  const payload = budgetMatrixSchema.parse({
    periodYear: formData.get("periodYear"),
    periodMonth: formData.get("periodMonth"),
    amount: formData.get("amount"),
    notes: formData.get("notes") ?? "",
  });

  await prisma.budgetMatrixEntry.upsert({
    where: { periodYear_periodMonth: { periodYear: payload.periodYear, periodMonth: payload.periodMonth } },
    create: {
      periodYear: payload.periodYear,
      periodMonth: payload.periodMonth,
      amount: payload.amount,
      notes: payload.notes || null,
    },
    update: {
      amount: payload.amount,
      notes: payload.notes || null,
    },
  });

  revalidatePath("/budget");
  revalidatePath("/dashboard");
  redirect(withParam(redirectTo || "/budget", "success", "matrix-entry-saved"));
}

export async function updateBudgetMatrixEntryAction(formData: FormData) {
  await requireRole(["ADMIN", "MARKETING_MANAGER"]);

  const redirectTo = String(formData.get("redirectTo") ?? "").trim();

  const id = String(formData.get("id"));
  const current = await prisma.budgetMatrixEntry.findUnique({ where: { id } });
  if (!current) redirect(withParam(redirectTo || "/budget", "error", "matrix-entry-not-found"));

  const payload = budgetMatrixSchema.parse({
    periodYear: formData.get("periodYear") ?? current.periodYear,
    periodMonth: formData.get("periodMonth") ?? current.periodMonth,
    amount: formData.get("amount") ?? current.amount,
    notes: formData.get("notes") ?? current.notes ?? "",
  });

  await prisma.budgetMatrixEntry.update({
    where: { id },
    data: {
      periodYear: payload.periodYear,
      periodMonth: payload.periodMonth,
      amount: payload.amount,
      notes: payload.notes || null,
    },
  });

  revalidatePath("/budget");
  revalidatePath("/dashboard");
  redirect(withParam(redirectTo || "/budget", "success", "matrix-entry-updated"));
}

export async function deleteBudgetMatrixEntryAction(formData: FormData) {
  await requireRole(["ADMIN", "MARKETING_MANAGER"]);

  const redirectTo = String(formData.get("redirectTo") ?? "").trim();

  const id = String(formData.get("id"));
  await prisma.budgetMatrixEntry.delete({ where: { id } });

  revalidatePath("/budget");
  revalidatePath("/dashboard");
  redirect(withParam(redirectTo || "/budget", "success", "matrix-entry-deleted"));
}
