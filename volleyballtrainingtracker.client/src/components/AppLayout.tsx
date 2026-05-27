import { useEffect, useRef, useState } from "react";
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
  LogOut,
  Menu,
  User as UserIcon,
  Volleyball,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import ThemeToggle from "@/components/ThemeToggle";
import Breadcrumbs from "@/components/Breadcrumbs";
import BottomTabBar from "@/components/BottomTabBar";
import { PAGE, useAuthStore } from "@/stores/authStore";
import { pingHealth } from "@/api/health";
import { ALL_NAV, BOTTOM_TAB_PAGES, type NavItem } from "@/config/nav";
import { cn } from "@/lib/utils";

/** 閒置自動登出時間（毫秒）*/
const IDLE_LOGOUT_MS = 30 * 60 * 1000;
/** 最後活動時間的持久化 key（key 名稱需與 authStore.clear() 內的清除動作同步） */
const LAST_ACTIVITY_KEY = "vbtt-last-activity";
/** localStorage 寫入節流間隔（毫秒）— 高頻事件如 mousemove 不需每次都寫入 */
const PERSIST_THROTTLE_MS = 10_000;

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const clear = useAuthStore((s) => s.clear);
  const allowedPages = user?.allowedPages ?? [];

  const navItems = ALL_NAV.filter((n) => allowedPages.includes(n.page));
  const mainItems = navItems.filter((n) => n.group === "main" || !n.group);
  const accountItems = navItems.filter((n) => n.group === "account");
  const adminItems = navItems.filter((n) => n.group === "admin");
  const canSeeProfile = allowedPages.includes(PAGE.Profile);

  // 底部列：依固定順序取出對應項目，無權限的不顯示也不補位
  const bottomTabItems = BOTTOM_TAB_PAGES
    .map((page) => ALL_NAV.find((n) => n.page === page))
    .filter((n): n is NavItem => !!n && allowedPages.includes(n.page));

  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<boolean>(
    () => localStorage.getItem("vbtt-sidebar-collapsed") === "1",
  );

  useEffect(() => {
    localStorage.setItem("vbtt-sidebar-collapsed", collapsed ? "1" : "0");
  }, [collapsed]);

  // 切換頁面：捲回頂部（DOM 屬外部系統，於 effect 內處理）
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  // 切換頁面時關閉行動選單：於 render 階段比對前次路徑，
  // 避免在 effect 內 setState 造成連鎖渲染。
  const [prevPath, setPrevPath] = useState(location.pathname);
  if (location.pathname !== prevPath) {
    setPrevPath(location.pathname);
    setMobileOpen(false);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const logout = () => {
    // 主動登出：清掉可能殘留的被動登出標記，避免登入頁誤顯示「閒置自動登出」提示。
    sessionStorage.removeItem("vbtt-logout-reason");
    clear();
    navigate("/login", { replace: true });
  };

  // 閒置自動登出 ＋ 回前景後端喚醒。
  //
  // 改用「真實時間戳」判定，而非只依賴 setTimeout：頁面被切到背景或進入
  // 上一頁／下一頁快取（bfcache）時會被凍結，setTimeout 也隨之暫停，回來後
  // 不會如預期觸發。因此在回前景（pageshow persisted／visibilitychange）時，
  // 用 Date.now() 與最後活動時間比對，逾時或 token 失效就立即登出；
  // 仍在登入狀態則順手喚醒可能已休眠的後端。
  // 初始值留 0，避免在 render 期間呼叫不純的 Date.now()；
  // 下方 effect 掛載時會呼叫 reset() 寫入真實時間戳。
  const lastActivityRef = useRef<number>(0);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    // 上次寫入 localStorage 的時間戳；節流避免高頻事件每次都觸發磁碟寫入
    let lastPersistAt = 0;

    const readPersisted = (): number => {
      try {
        const raw = localStorage.getItem(LAST_ACTIVITY_KEY);
        const n = raw ? Number(raw) : 0;
        return Number.isFinite(n) ? n : 0;
      } catch {
        return 0;
      }
    };
    const writePersisted = (t: number) => {
      try {
        localStorage.setItem(LAST_ACTIVITY_KEY, String(t));
        lastPersistAt = t;
      } catch {
        /* 隱私模式等情境可能拒寫 localStorage，靜默忽略 */
      }
    };
    const persistThrottled = (t: number) => {
      if (t - lastPersistAt >= PERSIST_THROTTLE_MS) writePersisted(t);
    };

    const forceLogout = () => {
      // 標記登出原因，登入頁讀取後提示使用者；手動點登出按鈕（上方 logout）不標記。
      sessionStorage.setItem("vbtt-logout-reason", "idle");
      clear();
      navigate("/login", { replace: true });
    };

    // 閒置過久或 token 已失效都該登出
    const shouldLogout = () =>
      Date.now() - lastActivityRef.current >= IDLE_LOGOUT_MS ||
      !useAuthStore.getState().isAuthenticated();

    // 動態 arm：依「距離上次活動還剩多久」設定 setTimeout。掛載時若 ref 取自
    // localStorage 的舊值（非現在），remaining 會小於 IDLE_LOGOUT_MS，確保
    // timer 在正確時點 fire 而非延後到全長後才判定。
    const arm = () => {
      clearTimeout(timer);
      const remaining = Math.max(
        0,
        IDLE_LOGOUT_MS - (Date.now() - lastActivityRef.current),
      );
      timer = setTimeout(check, remaining);
    };

    const check = () => {
      if (shouldLogout()) forceLogout();
      else arm();
    };

    // 使用者活動：重置前先把關。離開過久後回前景的「第一個動作」（mousemove／
    // click）會搶在這裡發生；若不先判定就直接寫入現在時間，逾時狀態會被洗掉。
    // 在分頁始終 visible（電腦睡眠／離座／僅切換視窗）時沒有 visibilitychange，
    // 全靠這道把關才會如預期登出。
    const reset = () => {
      if (shouldLogout()) {
        forceLogout();
        return;
      }
      const now = Date.now();
      lastActivityRef.current = now;
      persistThrottled(now);
      arm();
    };

    // 從背景／bfcache 回到前景：先判定是否該登出，否則喚醒後端並重啟計時。
    const onResume = () => {
      if (shouldLogout()) {
        forceLogout();
      } else {
        void pingHealth();
        const now = Date.now();
        lastActivityRef.current = now;
        writePersisted(now); // 回前景一律即時寫入（非高頻事件）
        arm();
      }
    };
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) onResume();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") onResume();
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
    window.addEventListener("pageshow", onPageShow);
    // focus／online：涵蓋「分頁未切換但視窗失焦（切換應用程式、電腦睡眠喚醒、
    // 斷網重連）」的情境 —— 這些情況不會觸發 visibilitychange。
    window.addEventListener("focus", onResume);
    window.addEventListener("online", onResume);
    document.addEventListener("visibilitychange", onVisibility);

    // 掛載：讀取 localStorage 的最後活動時間，與當下比對：
    //  - 已超過閒置上限 → 視為前一個 session 已逾時（例如關閉網頁很久才回來），強制登出
    //  - 仍在有效範圍 → 沿用該值繼續計時（arm 會用剩餘時間設 timer）
    //  - 無紀錄（剛登入或剛被清除）→ 以現在時間作為新 session 起點並寫入
    const now = Date.now();
    const persisted = readPersisted();
    if (persisted > 0 && now - persisted >= IDLE_LOGOUT_MS) {
      forceLogout();
    } else if (persisted > 0) {
      lastActivityRef.current = persisted;
      lastPersistAt = persisted;
      arm();
    } else {
      lastActivityRef.current = now;
      writePersisted(now);
      arm();
    }
    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, reset));
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("focus", onResume);
      window.removeEventListener("online", onResume);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [clear, navigate]);

  return (
    <div className="min-h-screen bg-background text-foreground flex overflow-x-clip">
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
          {accountItems.length > 0 && (
            <SidebarGroup
              label="個人"
              items={accountItems}
              collapsed={collapsed}
            />
          )}
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
            <div className="flex items-center gap-2 lg:hidden min-w-0">
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0"
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
              <Link
                to="/"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-2 font-bold min-w-0"
              >
                <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
                  <Volleyball className="h-4 w-4" />
                </span>
                <span className="truncate">高醫醫學女排</span>
              </Link>
            </div>

            {/* 桌面：Breadcrumb */}
            <div className="hidden lg:block min-w-0 flex-1">
              <Breadcrumbs />
            </div>

            {/* Right: user + theme + logout */}
            <div className="flex items-center gap-1 shrink-0">
              <ThemeToggle />
              {user && (
                <span className="text-sm text-muted-foreground hidden xl:inline px-2">
                  {user.displayName ?? user.userName}
                  <span className="text-xs ml-1.5 text-muted-foreground/70">
                    ({user.roleDescription || user.role})
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
              {user && (
                <MobileUserCard
                  displayName={user.displayName ?? user.userName}
                  userName={user.userName}
                  role={user.roleDescription || user.role}
                  canSeeProfile={canSeeProfile}
                  onClick={() => setMobileOpen(false)}
                />
              )}
              <SidebarGroup
                label="主功能"
                items={mainItems}
                collapsed={false}
                onItemClick={() => setMobileOpen(false)}
              />
              {accountItems.length > 0 && (
                <SidebarGroup
                  label="個人"
                  items={accountItems}
                  collapsed={false}
                  onItemClick={() => setMobileOpen(false)}
                />
              )}
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
        <BottomTabBar items={bottomTabItems} />
      </div>

    </div>
  );
}

interface MobileUserCardProps {
  displayName: string;
  userName: string;
  role: string;
  canSeeProfile: boolean;
  onClick: () => void;
}
function MobileUserCard({
  displayName,
  userName,
  role,
  canSeeProfile,
  onClick,
}: MobileUserCardProps) {
  const initial = (displayName || userName || "?").slice(0, 1).toUpperCase();
  const showUserName = userName && userName !== displayName;
  const inner = (
    <>
      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-base font-semibold">
        {initial}
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="block truncate font-semibold text-sm">
          {displayName}
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {role}
          {showUserName && ` · ${userName}`}
        </span>
      </span>
    </>
  );
  const baseCls =
    "flex items-center gap-3 rounded-lg p-3 bg-accent/40 mx-1 mb-1";
  if (!canSeeProfile) {
    return <div className={baseCls}>{inner}</div>;
  }
  return (
    <Link
      to="/profile"
      onClick={onClick}
      className={cn(baseCls, "hover:bg-accent transition")}
    >
      {inner}
    </Link>
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
