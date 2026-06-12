import FlipCounter from './FlipCounter';
import GestureHandler from './GestureHandler';

interface SetScoreDisplayProps {
  teamLabel: string;
  sets: number;
  onAdjust: (delta: 1 | -1) => void;
}

/** 單隊小局數（Set Score）：一位數翻牌，與比分相同的上下翻牌手勢，各隊獨立 */
export default function SetScoreDisplay({ teamLabel, sets, onAdjust }: SetScoreDisplayProps) {
  return (
    <div className="flex flex-col items-center gap-[1vmin]">
      <GestureHandler onAdjust={onAdjust} label={`${teamLabel} 局數`} className="px-[1.6vmin] py-[1.8vmin]">
        <FlipCounter value={sets} digits={1} label={`${teamLabel} 局數`} className="text-[9vmin]" />
      </GestureHandler>
      <div className="text-[1.8vmin] uppercase tracking-[0.35em] text-zinc-500">SETS</div>
    </div>
  );
}
