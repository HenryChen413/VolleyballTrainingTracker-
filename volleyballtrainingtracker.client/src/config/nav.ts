import type { ComponentType } from "react";
import {
  CalendarDays,
  ClipboardList,
  Droplets,
  HandCoins,
  Layers,
  LayoutDashboard,
  MessageSquare,
  Monitor,
  Settings,
  Shield,
  Trophy,
  UserCircle,
  Users,
  Volleyball,
} from "lucide-react";
import { PAGE } from "@/stores/authStore";

export interface NavItem {
  to: string;
  label: string;
  page: string;
  end?: boolean;
  icon: ComponentType<{ className?: string }>;
  group?: "main" | "admin" | "account";
  /**
   * 公開頁面：對所有登入者顯示，不受角色 AllowedPages 控管。
   * 用於純前端、不涉及敏感資料的小工具（如抽牌）。
   */
  public?: boolean;
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
    to: "/calendar",
    label: "行事曆",
    page: PAGE.Calendar,
    icon: CalendarDays,
    group: "main",
  },
  {
    to: "/players",
    label: "陣容",
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
    to: "/tactics",
    label: "戰術板",
    page: PAGE.Tactics,
    icon: ClipboardList,
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
    to: "/crying",
    label: "哭哭榜",
    page: PAGE.Crying,
    icon: Droplets,
    group: "main",
  },
  {
    to: "/board",
    label: "留言板",
    page: PAGE.Board,
    icon: MessageSquare,
    group: "main",
  },
  {
    to: "/sponsors",
    label: "隊費贊助榜",
    page: PAGE.Sponsors,
    icon: HandCoins,
    group: "main",
  },
  {
    to: "/draw-cards",
    label: "抽牌",
    page: PAGE.DrawCards,
    icon: Layers,
    group: "main",
    public: true,
  },
  {
    to: "/scoreboard",
    label: "記分板",
    page: PAGE.Scoreboard,
    icon: Monitor,
    group: "main",
    public: true,
  },
  {
    to: "/profile",
    label: "我的帳號",
    page: PAGE.Profile,
    icon: UserCircle,
    group: "account",
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

/**
 * 行動裝置底部列固定顯示的 5 個頁面（順序即顯示順序）。
 * 儀表板刻意放中央，符合行動 App「Home 在中間」的直覺。
 * 行事曆仍保留於側欄，僅底部快捷列改放哭哭榜。
 * 若使用者對某頁無權限，該格不顯示，不由其他頁面補位。
 */
export const BOTTOM_TAB_PAGES: readonly string[] = [
  PAGE.Crying,
  PAGE.Players,
  PAGE.Dashboard,
  PAGE.Sessions,
  PAGE.MatchLogs,
];
