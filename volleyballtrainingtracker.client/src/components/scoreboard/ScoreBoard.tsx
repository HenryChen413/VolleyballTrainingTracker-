import { useEffect, useRef, useState } from 'react';
import { Expand, RotateCcw, Shrink, Trash2 } from 'lucide-react';
import { useScoreboardStore } from '@/stores/scoreboardStore';
import { confirmAction } from '@/lib/swal';
import { cn } from '@/lib/utils';
import ScoreDisplay from './ScoreDisplay';
import SetScoreDisplay from './SetScoreDisplay';

/**
 * iOS Safari 的 Fullscreen API 支援度補丁型別：
 * - iPhone：完全不支援（requestFullscreen 為 undefined）
 * - 舊版 iPad：只認 webkit 前綴
 */
type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => void;
};
type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => void;
};

/**
 * 翻牌記分板主畫面：兩隊比分 + 小局數 + 目前局數。
 * 只負責組版與轉接 store action，所有 state 都在 useScoreboardStore。
 */
export default function ScoreBoard() {
  const {
    scoreA,
    scoreB,
    setA,
    setB,
    currentSetIndex,
    nameA,
    nameB,
    setTeamName,
    adjustScore,
    adjustSet,
    resetScores,
    resetMatch,
  } = useScoreboardStore();
  const labelA = nameA.trim() || 'TEAM A';
  const labelB = nameB.trim() || 'TEAM B';
  const boardRef = useRef<HTMLDivElement>(null);
  // CSS 假全螢幕：原生 Fullscreen API 不可用時（iPhone Safari）的退路
  const [cssFullscreen, setCssFullscreen] = useState(false);
  const [nativeFullscreen, setNativeFullscreen] = useState(false);
  const isFullscreen = nativeFullscreen || cssFullscreen;

  // 同步原生全螢幕狀態（含 ESC／系統手勢退出），webkit 前綴事件給舊 iPad
  useEffect(() => {
    const doc = document as FullscreenDocument;
    const sync = () =>
      setNativeFullscreen(Boolean(document.fullscreenElement ?? doc.webkitFullscreenElement));
    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('webkitfullscreenchange', sync);
    return () => {
      document.removeEventListener('fullscreenchange', sync);
      document.removeEventListener('webkitfullscreenchange', sync);
    };
  }, []);

  const toggleFullscreen = () => {
    const doc = document as FullscreenDocument;
    const el = boardRef.current as FullscreenElement | null;
    if (!el) return;
    if (document.fullscreenElement ?? doc.webkitFullscreenElement) {
      if (document.exitFullscreen) void document.exitFullscreen();
      else doc.webkitExitFullscreen?.();
      return;
    }
    if (cssFullscreen) {
      setCssFullscreen(false);
      return;
    }
    if (el.requestFullscreen) {
      // 原生請求可能被拒（權限／嵌入環境），失敗時退回 CSS 全螢幕
      el.requestFullscreen().catch(() => setCssFullscreen(true));
    } else if (el.webkitRequestFullscreen) {
      el.webkitRequestFullscreen();
    } else {
      setCssFullscreen(true);
    }
  };

  const onResetScores = async () => {
    const r = await confirmAction('歸零本局比分？', '只清除目前比分，小局數保留。', '歸零');
    if (r.isConfirmed) resetScores();
  };

  const onResetMatch = async () => {
    const r = await confirmAction('整場重設？', '比分與小局數全部歸零，回到第 1 局。', '重設', true);
    if (r.isConfirmed) resetMatch();
  };

  return (
    <div
      ref={boardRef}
      className={cn(
        'flex h-full min-h-[78vh] flex-col rounded-2xl bg-zinc-950 px-[3vmin] py-[2.5vmin] text-zinc-50',
        // CSS 假全螢幕：蓋滿視窗（含側欄/底部列之上），高度用 dvh 避開行動瀏覽器網址列
        cssFullscreen && 'fixed inset-0 z-[100] h-dvh min-h-0 w-screen overflow-auto rounded-none',
      )}
    >
      {/* Match Info：目前局數狀態 */}
      <div className="text-center text-[2.6vmin] tracking-[0.4em] text-zinc-400">
        第 {currentSetIndex} 局
      </div>

      {/* 兩隊比分：寬螢幕左右並排，中間冒號分隔 */}
      <div className="flex flex-1 items-center justify-center gap-[4vmin]">
        <ScoreDisplay
          name={nameA}
          defaultLabel="TEAM A"
          onNameChange={(n) => setTeamName('A', n)}
          score={scoreA}
          onAdjust={(d) => adjustScore('A', d)}
          accentClassName="text-sky-400"
        />
        <div className="pb-[2vmin] text-[12vmin] font-bold text-zinc-600">:</div>
        <ScoreDisplay
          name={nameB}
          defaultLabel="TEAM B"
          onNameChange={(n) => setTeamName('B', n)}
          score={scoreB}
          onAdjust={(d) => adjustScore('B', d)}
          accentClassName="text-rose-400"
        />
      </div>

      {/* 小局數：A、B 各自獨立的翻牌操作 */}
      <div className="flex items-center justify-center gap-[10vmin]">
        <SetScoreDisplay teamLabel={labelA} sets={setA} onAdjust={(d) => adjustSet('A', d)} />
        <div className="text-[2.2vmin] uppercase tracking-[0.45em] text-zinc-600">SET SCORE</div>
        <SetScoreDisplay teamLabel={labelB} sets={setB} onAdjust={(d) => adjustSet('B', d)} />
      </div>

      {/* 控制列：刻意低調，不干擾投影畫面 */}
      <div className="mt-[2.5vmin] flex justify-center gap-2">
        <button
          type="button"
          onClick={onResetScores}
          className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
        >
          <RotateCcw className="h-3.5 w-3.5" /> 歸零本局
        </button>
        <button
          type="button"
          onClick={onResetMatch}
          className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
        >
          <Trash2 className="h-3.5 w-3.5" /> 整場重設
        </button>
        <button
          type="button"
          onClick={toggleFullscreen}
          className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
        >
          {isFullscreen ? <Shrink className="h-3.5 w-3.5" /> : <Expand className="h-3.5 w-3.5" />}
          {isFullscreen ? '離開全螢幕' : '全螢幕'}
        </button>
      </div>
    </div>
  );
}
