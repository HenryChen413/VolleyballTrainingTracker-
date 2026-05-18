import {
  Volleyball,
  Send,
  Hand,
  Target,
  Swords,
  Shield,
  Activity,
  Dumbbell,
  type LucideIcon,
} from "lucide-react";
import type { ChipProps } from "@/components/ui/chip";

export type Tone = NonNullable<ChipProps["tone"]>;

export interface CategoryMeta {
  value: string;
  label: string;
  icon: LucideIcon;
  tone: Tone;
  /** chip 啟用態的填色 class */
  activeClass: string;
  /** 列左側色條 class */
  barClass: string;
  /** 標題 icon 容器（淡底色 + 文字色） */
  iconBoxClass: string;
}

/** 訓練項目分類（清單頁與編輯頁共用，避免重複定義）。 */
export const CATEGORIES: CategoryMeta[] = [
  {
    value: "Basic",
    label: "基礎",
    icon: Volleyball,
    tone: "neutral",
    activeClass: "bg-foreground text-background",
    barClass: "bg-muted-foreground",
    iconBoxClass: "bg-muted text-muted-foreground",
  },
  {
    value: "Serve",
    label: "發球",
    icon: Send,
    tone: "info",
    activeClass: "bg-info text-info-foreground",
    barClass: "bg-info",
    iconBoxClass: "bg-info/10 text-info",
  },
  {
    value: "Pass",
    label: "接發球",
    icon: Hand,
    tone: "navy",
    activeClass: "bg-navy text-navy-foreground",
    barClass: "bg-navy",
    iconBoxClass: "bg-navy/10 text-navy",
  },
  {
    value: "Set",
    label: "舉球",
    icon: Target,
    tone: "primary",
    activeClass: "bg-primary text-primary-foreground",
    barClass: "bg-primary",
    iconBoxClass: "bg-primary/10 text-primary",
  },
  {
    value: "Attack",
    label: "攻擊",
    icon: Swords,
    tone: "destructive",
    activeClass: "bg-destructive text-destructive-foreground",
    barClass: "bg-destructive",
    iconBoxClass: "bg-destructive/10 text-destructive",
  },
  {
    value: "Block",
    label: "攔網",
    icon: Shield,
    tone: "warning",
    activeClass: "bg-warning text-warning-foreground",
    barClass: "bg-warning",
    iconBoxClass: "bg-warning/15 text-warning",
  },
  {
    value: "Dig",
    label: "防守",
    icon: Activity,
    tone: "success",
    activeClass: "bg-success text-success-foreground",
    barClass: "bg-success",
    iconBoxClass: "bg-success/10 text-success",
  },
  {
    value: "Fitness",
    label: "體能",
    icon: Dumbbell,
    tone: "outline",
    activeClass: "bg-foreground text-background",
    barClass: "bg-foreground/60",
    iconBoxClass: "border border-border text-foreground",
  },
];

export const CATEGORY_MAP = new Map(CATEGORIES.map((c) => [c.value, c]));
