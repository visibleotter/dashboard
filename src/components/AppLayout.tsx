import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  FolderKanban,
  CalendarDays,
  ListChecks,
  BookOpen,
  LogOut,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { LanguageToggle } from "@/components/LanguageToggle";
import { cn } from "@/lib/utils";

interface NavItem {
  to: string;
  end?: boolean;
  icon: LucideIcon;
  key: string;
}

const NAV: NavItem[] = [
  { to: "/", end: true, icon: LayoutDashboard, key: "nav.dashboard" },
  { to: "/cases", icon: FolderKanban, key: "nav.cases" },
  { to: "/calendar", icon: CalendarDays, key: "nav.calendar" },
  { to: "/tasks", icon: ListChecks, key: "nav.tasks" },
  { to: "/kb", icon: BookOpen, key: "nav.kb" },
];

/* Vision-UI style shell: fixed glass sidebar + top bar + routed content. */
export function AppLayout() {
  const { user, signOut } = useAuth();
  const { t } = useI18n();
  const location = useLocation();

  const current =
    NAV.find((n) => (n.end ? location.pathname === n.to : location.pathname.startsWith(n.to))) ??
    NAV[0];

  return (
    <div className="min-h-screen">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 start-0 z-20 hidden w-64 flex-col p-4 lg:flex">
        <div className="flex h-full flex-col rounded-2xl border border-white/10 bg-card p-4 shadow-xl shadow-black/20">
          <Link to="/" className="px-2 py-3 text-center">
            <span className="text-base font-bold tracking-[0.2em]">VISION</span>
            <span className="ms-1 text-base font-light tracking-[0.2em] text-muted-foreground">UI</span>
          </Link>
          <div className="my-3 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />

          <nav className="flex flex-1 flex-col gap-1.5">
            {NAV.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end}>
                {({ isActive }) => (
                  <span
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                      isActive
                        ? "bg-white/10 font-medium text-white"
                        : "text-muted-foreground hover:bg-white/5 hover:text-white",
                    )}
                  >
                    <span
                      className={cn(
                        "grid size-8 shrink-0 place-items-center rounded-lg",
                        isActive ? "bg-brand-gradient text-white shadow-glow" : "bg-white/10 text-sky-300",
                      )}
                    >
                      <item.icon className="size-4" />
                    </span>
                    {t(item.key)}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>
        </div>
      </aside>

      {/* Content area (offset for the sidebar on large screens) */}
      <div className="lg:ms-64">
        <header className="sticky top-0 z-10 px-4 pt-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-card px-4 py-3 shadow-lg shadow-black/10">
            <div className="leading-tight">
              <div className="text-xs text-muted-foreground">
                {t("common.appName")} / {t(current.key)}
              </div>
              <div className="font-bold">{t(current.key)}</div>
            </div>
            <div className="flex items-center gap-2">
              <LanguageToggle />
              <span className="hidden text-sm text-muted-foreground sm:inline" dir="ltr">
                {user?.email}
              </span>
              <Button variant="outline" size="sm" onClick={() => signOut()}>
                <LogOut className="size-4" />
                <span className="hidden sm:inline">{t("nav.signOut")}</span>
              </Button>
            </div>
          </div>

          {/* compact nav for small screens */}
          <nav className="mt-3 flex gap-1.5 overflow-x-auto lg:hidden">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2 whitespace-nowrap rounded-xl border border-white/10 px-3 py-1.5 text-sm",
                    isActive ? "bg-brand-gradient text-white" : "bg-card text-muted-foreground",
                  )
                }
              >
                <item.icon className="size-4" />
                {t(item.key)}
              </NavLink>
            ))}
          </nav>
        </header>

        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
