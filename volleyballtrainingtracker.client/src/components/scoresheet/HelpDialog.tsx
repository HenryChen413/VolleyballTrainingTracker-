import type { ReactNode } from 'react';
import { Dialog } from '@/components/ui/dialog';

interface HelpDialogProps {
  open: boolean;
  onClose: () => void;
}

/** 畫面上的按鈕名稱，以小框呈現方便對照 */
function K({ children }: { children: ReactNode }) {
  return (
    <span className="mx-0.5 inline-block whitespace-nowrap rounded border bg-muted px-1.5 text-xs font-medium text-foreground">
      {children}
    </span>
  );
}

function Section({ step, title, children }: { step: number; title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border p-3">
      <h3 className="mb-2 flex items-center gap-2 font-semibold">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
          {step}
        </span>
        {title}
      </h3>
      <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed">{children}</ul>
    </section>
  );
}

/** 記錄單操作說明：依實際填寫順序分段，用畫面上的按鈕名稱說明 */
export function HelpDialog({ open, onClose }: HelpDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} title="記錄單操作說明" size="xl">
      <div className="space-y-3">
        <p className="rounded-md bg-primary/10 px-3 py-2 text-sm">
          <strong>口訣：點一下 +1，按住 −1，按錯就撤銷。</strong>
          所有內容自動儲存，不用按存檔。
        </p>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <Section step={1} title="開賽前準備">
            <li>
              按右上 <K>＋隊員</K>，把這局要上場的球員加進表格。
            </li>
            <li>
              按 <K>站位</K> 選第一球 1～6 號位，以及接發／防守自由球員（螢幕夠寬時直接顯示在頁首）。
            </li>
            <li>
              「紀錄」欄填記錄人名字（預設是登入者）。
            </li>
            <li>請把手機／平板<strong>橫放</strong>使用。</li>
          </Section>

          <Section step={2} title="劃記球員表現（中間表格）">
            <li>
              找到球員那一列、對應項目那一格，<strong>點一下 = +1</strong>。
            </li>
            <li>
              <strong>按住約半秒 = −1</strong>（記多了用這個修正）。
            </li>
            <li>O 是成功；X、no、out、未、噴、犯規都算失誤。</li>
            <li>表格太寬時可左右滑動，滑動不會誤記。</li>
            <li>
              點球員右側的 <K>✕</K> 可移除該球員（已有劃記會先確認）。
            </li>
          </Section>

          <Section step={3} title="記分與暫停（底部）">
            <li>
              每球結束按 <K>我方 +1</K> 或 <K>對方 +1</K>，上方會自動畫出比分發展。
            </li>
            <li>
              喊暫停時按 <K>我方暫停</K> 或 <K>對方暫停</K>，比分發展會標上 Ⓣ。
            </li>
            <li>
              按錯分數或暫停：按 <K>撤銷比分</K>，一次撤回最後一筆。
            </li>
          </Section>

          <Section step={4} title="換人">
            <li>
              按 <K>換人</K> → 先點<strong>下場</strong>球員 → 再點<strong>上場</strong>球員，就完成了。
            </li>
            <li>上場球員若還不在表格裡，會自動加入，並標上「替」。</li>
            <li>記錯的換人：打開換人視窗，在「本局換人紀錄」按垃圾桶刪除。</li>
          </Section>

          <Section step={5} title="雙方失誤（表格下方）">
            <li>
              <strong>對方失誤</strong>：對方發球失誤、打出界等，點一下 +1、按住 −1。
            </li>
            <li>
              <strong>我方失誤</strong>：表格裡的失誤格會<strong>自動加總</strong>，不用重複記。
            </li>
            <li>只有無法算在某位球員身上的失誤，才點「我方失誤」手動補記。</li>
          </Section>

          <Section step={6} title="按錯了怎麼辦？">
            <li>
              表格或失誤記錯：按 <K>撤銷表格</K>，一步一步往回復原。
            </li>
            <li>
              比分或暫停記錯：按 <K>撤銷比分</K>。
            </li>
            <li>兩種撤銷各管各的，互不影響。</li>
          </Section>
        </div>

        <section className="rounded-lg border p-3">
          <h3 className="mb-2 font-semibold">儲存與網路（看頁首狀態）</h3>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            <dt className="font-medium text-success">已同步</dt>
            <dd>已存到伺服器。</dd>
            <dt className="font-medium text-muted-foreground">同步中</dt>
            <dd>正在上傳，繼續記錄即可。</dd>
            <dt className="font-medium text-warning">離線，稍後重送</dt>
            <dd>沒網路也能繼續記，資料先存在這台裝置，恢復連線會自動上傳。</dd>
            <dt className="font-medium text-destructive">無法同步</dt>
            <dd>
              按 <K>重試</K>；資料仍保留在這台裝置。
            </dd>
            <dt className="font-medium text-destructive">版本衝突</dt>
            <dd>別人也改了這局，依畫面選擇要保留哪一份。</dd>
          </dl>
          <p className="mt-2 text-xs text-muted-foreground">記錄期間螢幕會保持常亮。記完按左上返回鍵回到列表即可。</p>
        </section>
      </div>
    </Dialog>
  );
}
