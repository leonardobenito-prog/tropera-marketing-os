import { prisma } from "@/lib/prisma";
import { Badge, KPICard } from "@/components/ui";

export const dynamic = "force-dynamic";

const LOCATION_TYPE_LABEL: Record<string, string> = {
  FLAGSHIP: "Flagship",
  PRODUCTION_PLANT: "Planta",
  TAPROOM: "Taproom",
  WAREHOUSE: "Bodega",
};

const SPACE_STATUS_LABEL: Record<string, string> = {
  AVAILABLE: "Disponible",
  IN_USE: "En uso",
  RESERVED: "Reservado",
  MAINTENANCE: "Mantenimiento",
};

const SPACE_STATUS_TONE: Record<string, "neutral" | "warning" | "success" | "danger"> = {
  AVAILABLE: "success",
  IN_USE: "warning",
  RESERVED: "neutral",
  MAINTENANCE: "danger",
};

export default async function LocationsPage() {
  const locations = await prisma.location.findMany({
    include: {
      businessUnit: true,
      spaces: {
        include: {
          type: true,
          placements: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });

  const totalSpaces = locations.reduce((sum, location) => sum + location.spaces.length, 0);
  const activeSpaces = locations.reduce(
    (sum, location) => sum + location.spaces.filter((space) => space.status === "IN_USE").length,
    0,
  );
  const reservedSpaces = locations.reduce(
    (sum, location) => sum + location.spaces.filter((space) => space.status === "RESERVED").length,
    0,
  );

  return (
    <div className="p-6 space-y-8">
      <div>
        <div className="text-xs uppercase tracking-[0.18em]" style={{ color: "var(--muted)" }}>
          Locales
        </div>
        <h1 className="text-xl heading-title mt-1" style={{ color: "var(--ink)" }}>
          Red de locales y espacios
        </h1>
      </div>

      <div className="flex gap-3 flex-wrap">
        <KPICard label="LOCALES" value={locations.length} accent="var(--c-forest)" />
        <KPICard label="ESPACIOS" value={totalSpaces} accent="var(--c-copper)" />
        <KPICard label="EN USO" value={activeSpaces} accent="var(--c-warning)" />
        <KPICard label="RESERVADOS" value={reservedSpaces} accent="var(--c-success)" />
      </div>

      <div className="space-y-4">
        {locations.map((location) => (
          <div key={location.id} className="bg-white rounded-lg p-4" style={{ border: "1px solid var(--line)" }}>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="text-sm font-medium" style={{ color: "var(--ink)" }}>{location.name}</div>
                <div className="text-xs mt-1" style={{ color: "var(--muted)" }}>
                  {location.businessUnit?.name ?? "Unidad sin asignar"} · {LOCATION_TYPE_LABEL[location.type] ?? location.type}
                </div>
              </div>
              <div className="text-xs" style={{ color: "var(--muted)" }}>{location.address ?? "Sin dirección registrada"}</div>
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {location.spaces.map((space) => (
                <div key={space.id} className="rounded-lg p-3" style={{ background: "#F7F5F0" }}>
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-sm" style={{ color: "var(--ink)" }}>{space.name}</div>
                      <div className="text-xs mt-1" style={{ color: "var(--muted)" }}>{space.type.name}</div>
                    </div>
                    <Badge tone={SPACE_STATUS_TONE[space.status] ?? "neutral"}>{SPACE_STATUS_LABEL[space.status] ?? space.status}</Badge>
                  </div>
                  <div className="mt-2 text-xs" style={{ color: "var(--muted)" }}>
                    {space.dimensions ?? "Dimensiones no registradas"} · {space.placements.length} ubicaciones
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
