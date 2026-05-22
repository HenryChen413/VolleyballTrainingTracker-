import type { ComponentType } from "react";
import {
  CalendarDays,
  Droplets,
  HandCoins,
  LayoutDashboard,
  MessageSquare,
  Settings,
  Shield,
  Trophy,
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
 * 若使用者對某頁無權限，該格不顯示，不由其他頁面補位。
 */
export const BOTTOM_TAB_PAGES: readonly string[] = [
  PAGE.Calendar,
  PAGE.Players,
  PAGE.Dashboard,
  PAGE.Sessions,
  PAGE.MatchLogs,
];
