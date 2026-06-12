import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * 翻牌記分板的集中 state。
 *
 * 所有比分／局數邏輯都在這裡，UI 元件只負責顯示與回報手勢（+1 / -1），
 * 不持有任何業務 state。persist 到 localStorage，現場誤觸重新整理不掉分。
 */

export type Team = 'A' | 'B';

/** 單隊得分上限（顯示兩位數） */
export const MAX_SCORE = 99;
/** 單隊局數上限（顯示一位數；排球五戰三勝實際最多 3） */
export const MAX_SET = 9;

const clamp = (v: number, max: number) => Math.min(max, Math.max(0, v));

interface ScoreboardState {
  scoreA: number;
  scoreB: number;
  setA: number;
  setB: number;
  /** 目前第幾局（1-based）＝已分出勝負局數 + 1 */
  currentSetIndex: number;
  /** 自訂隊名；空字串時 UI 顯示灰色預設字（TEAM A / TEAM B） */
  nameA: string;
  nameB: string;
  /** 設定隊名（整場重設不清除，換隊請直接改字） */
  setTeamName: (team: Team, name: string) => void;
  /** 調整目前比分（delta 通常為 +1 / -1） */
  adjustScore: (team: Team, delta: number) => void;
  /** 調整小局數（Set Score）；同步重算 currentSetIndex */
  adjustSet: (team: Team, delta: number) => void;
  /** 只歸零目前比分（換局時用），保留小局數 */
  resetScores: () => void;
  /** 整場重設：比分、小局數、局數全部歸零 */
  resetMatch: () => void;
}

export const useScoreboardStore = create<ScoreboardState>()(
  persist(
    (set) => ({
      scoreA: 0,
      scoreB: 0,
      setA: 0,
      setB: 0,
      currentSetIndex: 1,
      nameA: '',
      nameB: '',
      setTeamName: (team, name) => set(team === 'A' ? { nameA: name } : { nameB: name }),
      adjustScore: (team, delta) =>
        set((s) =>
          team === 'A'
            ? { scoreA: clamp(s.scoreA + delta, MAX_SCORE) }
            : { scoreB: clamp(s.scoreB + delta, MAX_SCORE) },
        ),
      adjustSet: (team, delta) =>
        set((s) => {
          const setA = team === 'A' ? clamp(s.setA + delta, MAX_SET) : s.setA;
          const setB = team === 'B' ? clamp(s.setB + delta, MAX_SET) : s.setB;
          return { setA, setB, currentSetIndex: setA + setB + 1 };
        }),
      resetScores: () => set({ scoreA: 0, scoreB: 0 }),
      resetMatch: () => set({ scoreA: 0, scoreB: 0, setA: 0, setB: 0, currentSetIndex: 1 }),
    }),
    { name: 'vbtt-scoreboard' },
  ),
);
