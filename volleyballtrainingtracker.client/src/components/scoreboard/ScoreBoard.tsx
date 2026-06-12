import { useRef } from 'react';
import { Expand, RotateCcw, Trash2 } from 'lucide-react';
import { useScoreboardStore } from '@/stores/scoreboardStore';
import { confirmAction } from '@/lib/swal';
import ScoreDisplay from './ScoreDisplay';
import SetScoreDisplay from './SetScoreDisplay';

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

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void boardRef.current?.requestFullscreen();
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
      className="flex h-full min-h-[78vh] flex-col rounded-2xl bg-zinc-950 px-[3vmin] py-[2.5vmin] text-zinc-50"
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
          <Expand className="h-3.5 w-3.5" /> 全螢幕
        </button>
      </div>
    </div>
  );
}
