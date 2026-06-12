import FlipCounter from './FlipCounter';
import GestureHandler from './GestureHandler';

interface ScoreDisplayProps {
  /** 使用者自訂隊名（空字串 = 未輸入，顯示灰色預設字） */
  name: string;
  /** 未輸入時的預設隊名（TEAM A / TEAM B） */
  defaultLabel: string;
  onNameChange: (name: string) => void;
  score: number;
  onAdjust: (delta: 1 | -1) => void;
  /** 兩隊用不同強調色區分 */
  accentClassName: string;
}

/** 單隊比分區塊：可編輯隊名 + 兩位數翻牌，翻牌區整塊都是手勢操作範圍 */
export default function ScoreDisplay({
  name,
  defaultLabel,
  onNameChange,
  score,
  onAdjust,
  accentClassName,
}: ScoreDisplayProps) {
  const label = name.trim() || defaultLabel;
  return (
    <div className="flex flex-col items-center gap-[2vmin]">
      {/* 透明 input：點隊名即可輸入；未輸入時 placeholder 呈灰底預設字。
          字級下限 16px：iOS Safari 對小於 16px 的 input 聚焦會強制放大頁面 */}
      <input
        type="text"
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        placeholder={defaultLabel}
        maxLength={12}
        enterKeyHint="done"
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
        aria-label={`${defaultLabel} 隊名（可輸入自訂名稱）`}
        className={`w-[max(26vmin,9rem)] bg-transparent text-center text-[max(3.4vmin,16px)] font-bold tracking-[0.3em] outline-none placeholder:text-zinc-600 focus:rounded-md focus:bg-zinc-900 ${accentClassName}`}
      />
      <GestureHandler onAdjust={onAdjust} label={`${label} 得分`} className="px-[2vmin] py-[2.4vmin]">
        <FlipCounter value={score} digits={2} label={`${label} 得分`} className="text-[22vmin]" />
      </GestureHandler>
    </div>
  );
}
