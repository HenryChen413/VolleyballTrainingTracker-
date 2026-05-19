// 通用 CSV 匯出工具：把二維陣列轉成 CSV 並觸發瀏覽器下載。
// 第一列通常為標題列。內容含逗號／引號／換行時自動加引號跳脫，
// 並加上 UTF-8 BOM 讓 Excel 正確判讀中文。

export type CsvCell = string | number | null | undefined;

function escapeCell(value: CsvCell): string {
  const s = String(value ?? "");
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** 將 rows 轉為 CSV 字串並以 filename 下載。filename 可省略副檔名。 */
export function exportCsv(filename: string, rows: CsvCell[][]): void {
  const csv = rows.map((r) => r.map(escapeCell).join(",")).join("\r\n");
  const name = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

/** 產生帶當日日期的檔名，如 `players_2026-05-19`。 */
export function datedFilename(prefix: string): string {
  return `${prefix}_${new Date().toISOString().slice(0, 10)}`;
}
