import { useEffect, useState } from "react";
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { motion } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Shield,
  Trophy,
  User as UserIcon,
  Users,
  Volleyball,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import ThemeToggle from "@/components/ThemeToggle";
import Breadcrumbs from "@/components/Breadcrumbs";
import BottomTabBar from "@/components/BottomTabBar";
import { PAGE, useAuthStore } from "@/stores/authStore";

/** 閒置自動登出時間（毫秒）*/
const IDLE_LOGOUT_MS = 5 * 60 * 1000;
import { cn } from "@/lib/utils";

interface NavItem {
  to: string;
  label: string;
  page: string;
  end?: boolean;
  icon: React.ComponentType<{ className?: string }>;
  group?: "main" | "admin";
}

export const ALL_NAV: NavItem[] = [
  {
    to: "/",
    label: "儀表板",
    page: PAGE.Dashboard,
    end: true,
    icon: LayoutDashboard,
    group: "main",
  },
  {
    to: "/players",
    label: "選手",
    page: PAGE.Players,
    icon: Users,
    group: "main",
  },
  {
    to: "/sessions",
    label: "訓練紀錄",
    page: PAGE.Sessions,
    icon: Volleyball,
    group: "main",
  },
  {
    to: "/match-logs",
    label: "比賽紀錄",
    page: PAGE.MatchLogs,
    icon: Trophy,
    group: "main",
  },
  {
    to: "/drills",
    label: "訓練項目",
    page: PAGE.Drills,
    icon: Settings,
    group: "main",
  },
  {
    to: "/admin/users",
    label: "使用者",
    page: PAGE.AdminUsers,
    icon: Shield,
    group: "admin",
  },
  {
    to: "/admin/roles",
    label: "角色",
    page: PAGE.AdminRoles,
    icon: Shield,
    group: "admin",
  },
];

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const clear = useAuthStore((s) => s.clear);
  const allowedPages = user?.allowedPages ?? [];

  const navItems = ALL_NAV.filter((n) => allowedPages.includes(n.page));
  const mainItems = navItems.filter((n) => n.group !== "admin");
  const adminItems = navItems.filter((n) => n.group === "admin");
  const canSeeProfile = allowedPages.includes(PAGE.Profile);

  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<boolean>(
    () => localStorage.getItem("vbtt-sidebar-collapsed") === "1",
  );

  useEffect(() => {
    localStorage.setItem("vbtt-sidebar-collapsed", collapsed ? "1" : "0");
  }, [collapsed]);

  // 切換頁面：關閉行動選單並捲回頂部
  useEffect(() => {
    setMobileOpen(false);
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const logout = () => {
    clear();
    navigate("/login", { replace: true });
  };

  // 閒置 5 分鐘自動登出
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        clear();
        navigate("/login", { replace: true });
      }, IDLE_LOGOUT_MS);
    };
    const events = [
      "mousemove",
      "mousedown",
      "keydown",
      "touchstart",
      "scroll",
    ];
    events.forEach((e) =>
      window.addEventListener(e, reset, { passive: true }),
    );
    reset();
    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [clear, navigate]);

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      {/* === 桌面 Sidebar (lg+) === */}
      <aside
        className={cn(
          "hidden lg:flex flex-col border-r bg-card/60 backdrop-blur-sm transition-all duration-200 sticky top-0 h-screen z-30",
          collapsed ? "w-[68px]" : "w-60",
        )}
      >
        <div
          className={cn(
            "flex items-center h-14 border-b px-3",
            collapsed ? "justify-center" : "justify-between",
          )}
        >
          {!collapsed && (
            <Link
              to="/"
              className="flex items-center gap-2 font-bold whitespace-nowrap"
            >
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <Volleyball className="h-5 w-5" />
              </span>
              <span className="text-base">高醫醫學女排</span>
            </Link>
          )}
          {collapsed && (
            <Link
              to="/"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground"
            >
              <Volleyball className="h-5 w-5" />
            </Link>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
          <SidebarGroup
            label="主功能"
            items={mainItems}
            collapsed={collapsed}
          />
          {adminItems.length > 0 && (
            <SidebarGroup
              label="管理"
              items={adminItems}
              collapsed={collapsed}
            />
          )}
        </nav>

        <div className="border-t p-2 space-y-1">
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "w-full",
              !collapsed && "flex justify-start gap-2 px-3",
            )}
            onClick={() => setCollapsed((v) => !v)}
            title={collapsed ? "展開" : "收合"}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
            {!collapsed && (
              <span className="text-sm font-normal text-muted-foreground">
                收合側欄
              </span>
            )}
          </Button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {/* === Top Bar === */}
        <header className="sticky top-0 z-20 h-14 border-b bg-background/80 backdrop-blur-md">
          <div className="h-full flex items-center justify-between gap-2 px-4 lg:px-6">
            {/* 行動裝置：漢堡 + Logo */}
            <div className="flex items-center gap-2 lg:hidden">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileOpen((v) => !v)}
                aria-expanded={mobileOpen}
                title={mobileOpen ? "關閉選單" : "開啟選單"}
              >
                {mobileOpen ? (
                  <X className="h-5 w-5" />
                ) : (
                  <Menu className="h-5 w-5" />
                )}
              </Button>
              <Link to="/" className="flex items-center gap-2 font-bold">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
                  <Volleyball className="h-4 w-4" />
                </span>
                <span>高醫醫學女排</span>
              </Link>
            </div>

            {/* 桌面：Breadcrumb */}
            <div className="hidden lg:block min-w-0 flex-1">
              <Breadcrumbs />
            </div>

            {/* Right: user + theme + logout */}
            <div className="flex items-center gap-1">
              <ThemeToggle />
              {user && (
                <span className="text-sm text-muted-foreground hidden xl:inline px-2">
                  {user.displayName ?? user.userName}
                  <span className="text-xs ml-1.5 text-muted-foreground/70">
                    ({user.role})
                  </span>
                </span>
              )}
              {canSeeProfile && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate("/profile")}
                  title="我的帳號"
                >
                  <UserIcon className="h-4 w-4" />
                </Button>
              )}
              <Button variant="ghost" size="icon" onClick={logout} title="登出">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </header>

        {/* === 行動裝置 - 抽屜選單 === */}
        {mobileOpen && (
          <>
            <div
              className="lg:hidden fixed inset-0 top-14 bg-foreground/40 backdrop-blur-sm z-30"
              onClick={() => setMobileOpen(false)}
              aria-hidden
            />
            <nav className="lg:hidden fixed left-0 right-0 top-14 bottom-0 bg-card border-b shadow-lift z-40 overflow-y-auto py-3 px-2 space-y-4 animate-slide-up">
              <SidebarGroup
                label="主功能"
                items={mainItems}
                collapsed={false}
                onItemClick={() => setMobileOpen(false)}
              />
              {adminItems.length > 0 && (
                <SidebarGroup
                  label="管理"
                  items={adminItems}
                  collapsed={false}
                  onItemClick={() => setMobileOpen(false)}
                />
              )}
            </nav>
          </>
        )}

        {/* === 主要內容區 === */}
        <main className="flex-1 px-4 lg:px-6 py-5 pb-24 md:pb-5 max-w-[1400px] w-full mx-auto">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, ease: "easeOut" }}
          >
            <Outlet />
          </motion.div>
        </main>

        {/* === 行動 Bottom Tab Bar === */}
        <BottomTabBar items={mainItems} />
      </div>

    </div>
  );
}

interface SidebarGroupProps {
  label: string;
  items: NavItem[];
  collapsed: boolean;
  onItemClick?: () => void;
}
function SidebarGroup({
  label,
  items,
  collapsed,
  onItemClick,
}: SidebarGroupProps) {
  if (items.length === 0) return null;
  return (
    <div>
      {!collapsed && (
        <p className="px-3 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
          {label}
        </p>
      )}
      <ul className="space-y-0.5">
        {items.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.end}
              onClick={onItemClick}
              className={({ isActive }) =>
                cn(
                  "relative flex items-center gap-3 rounded-md text-sm transition group",
                  collapsed ? "justify-center h-10 w-full" : "px-3 py-2",
                  isActive
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-foreground/80 hover:bg-accent hover:text-accent-foreground",
                )
              }
              title={collapsed ? item.label : undefined}
            >
              {({ isActive }) => (
                <>
                  {isActive && !collapsed && (
                    <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r bg-primary" />
                  )}
                  <item.icon
                    className={cn(
                      "h-4 w-4 shrink-0",
                      isActive && "text-primary",
                    )}
                  />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </div>
  );
}
