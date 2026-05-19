import type { ComponentType } from "react";
import {
  CalendarDays,
  LayoutDashboard,
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
