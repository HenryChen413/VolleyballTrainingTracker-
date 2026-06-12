/**
 * 球員 token 配色：沿用 lib/positions 的 POSITION_TONE 色系
 * （OH=primary / OPP=info / MB=navy / S=warning / L=success），未分類用 secondary。
 * 獨立成檔（非元件檔）以符合 react-refresh 對「元件檔只匯出元件」的要求。
 */
const ROLE_TOKEN_CLASS: Record<string, string> = {
  OH: "bg-primary text-primary-foreground",
  OPP: "bg-info text-info-foreground",
  MB: "bg-navy text-navy-foreground",
  S: "bg-warning text-warning-foreground",
  L: "bg-success text-success-foreground",
};

export function roleTokenClass(role: string | null | undefined): string {
  return (role && ROLE_TOKEN_CLASS[role]) || "bg-secondary text-secondary-foreground";
}
