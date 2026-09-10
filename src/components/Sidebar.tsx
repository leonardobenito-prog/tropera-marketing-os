"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  LayoutDashboard, CalendarCheck, CalendarDays, Megaphone, Factory, Radio,
  Wallet, BarChart3, MapPin, Users, Lightbulb, FileText, Settings, LogOut,
} from "lucide-react";

const NAV = [
  { href: "/dashboard", label: "Panel", icon: LayoutDashboard },
  { href: "/today", label: "Hoy", icon: CalendarCheck },
  { href: "/calendar", label: "Calendario", icon: CalendarDays },
  { href: "/campaigns", label: "Campañas", icon: Megaphone },
  { href: "/production", label: "Producción", icon: Factory },
  { href: "/advertising", label: "Publicidad", icon: Radio },
  { href: "/budget", label: "Presupuesto", icon: Wallet },
  { href: "/analytics", label: "Analítica Digital", icon: BarChart3 },
  { href: "/locations", label: "Locales", icon: MapPin },
  { href: "/team", label: "Equipo", icon: Users },
  { href: "/ideas", label: "Ideas", icon: Lightbulb },
  { href: "/reports", label: "Reportes", icon: FileText },
  { href: "/settings", label: "Configuración", icon: Settings },
];

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Admin",
  MARKETING_MANAGER: "Marketing Manager",
  TEAM_MEMBER: "Team Member",
  VIEWER: "Viewer",
};

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  return (
    <div className="flex flex-col h-full w-[232px] flex-shrink-0" style={{ background: "var(--c-forest)" }}>
      <div className="flex items-center gap-2 px-4 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        {/* Reemplaza esto por <img src="/logo.png" /> cuando copies el isotipo a /public */}
        <div className="w-8 h-8 rounded-full bg-white/10" />
        <div>
          <div className="text-white text-sm heading-title">Tropera</div>
          <div className="text-[10px] text-white/55">Marketing OS</div>
        </div>
      </div>

      <nav className="flex-1 py-2 overflow-y-auto">
        {NAV.map((item) => {
          const Icon = item.icon;
          const isActive = pathname?.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className="w-full flex items-center gap-3 px-4 py-2 text-sm relative"
              style={{ color: isActive ? "#fff" : "rgba(255,255,255,0.65)", background: isActive ? "rgba(255,255,255,0.08)" : "transparent" }}
            >
              {isActive && (
                <span style={{ position: "absolute", left: 0, top: 6, bottom: 6, width: 3, background: "var(--c-copper)", borderRadius: 2 }} />
              )}
              <Icon size={16} strokeWidth={1.75} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {session?.user && (
        <div className="px-4 py-3 flex items-center justify-between" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="min-w-0">
            <div className="text-white text-xs truncate">{session.user.name}</div>
            <div className="text-[10px] truncate" style={{ color: "rgba(255,255,255,0.55)" }}>
              {ROLE_LABEL[session.user.role] ?? session.user.role}
            </div>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="p-1.5 rounded hover:bg-white/10 text-white/70 flex-shrink-0"
            title="Cerrar sesión"
          >
            <LogOut size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
