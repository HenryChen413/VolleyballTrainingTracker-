import { beforeEach, describe, expect, it } from 'vitest';
import { MAX_SCORE, MAX_SET, useScoreboardStore } from './scoreboardStore';

describe('scoreboardStore', () => {
  beforeEach(() => {
    useScoreboardStore.getState().resetMatch();
  });

  it('adjustScore 各隊獨立加減分', () => {
    const s = useScoreboardStore.getState();
    s.adjustScore('A', 1);
    s.adjustScore('A', 1);
    s.adjustScore('B', 1);
    expect(useScoreboardStore.getState().scoreA).toBe(2);
    expect(useScoreboardStore.getState().scoreB).toBe(1);
    s.adjustScore('A', -1);
    expect(useScoreboardStore.getState().scoreA).toBe(1);
  });

  it('比分不會低於 0 或超過上限', () => {
    const s = useScoreboardStore.getState();
    s.adjustScore('A', -1);
    expect(useScoreboardStore.getState().scoreA).toBe(0);
    for (let i = 0; i < MAX_SCORE + 5; i++) s.adjustScore('B', 1);
    expect(useScoreboardStore.getState().scoreB).toBe(MAX_SCORE);
  });

  it('adjustSet 會同步重算 currentSetIndex（已分勝負局數 + 1）', () => {
    const s = useScoreboardStore.getState();
    s.adjustSet('A', 1);
    s.adjustSet('B', 1);
    s.adjustSet('B', 1);
    const st = useScoreboardStore.getState();
    expect(st.setA).toBe(1);
    expect(st.setB).toBe(2);
    expect(st.currentSetIndex).toBe(4);
    s.adjustSet('B', -1);
    expect(useScoreboardStore.getState().currentSetIndex).toBe(3);
  });

  it('局數不會低於 0 或超過上限', () => {
    const s = useScoreboardStore.getState();
    s.adjustSet('A', -1);
    expect(useScoreboardStore.getState().setA).toBe(0);
    expect(useScoreboardStore.getState().currentSetIndex).toBe(1);
    for (let i = 0; i < MAX_SET + 3; i++) s.adjustSet('A', 1);
    expect(useScoreboardStore.getState().setA).toBe(MAX_SET);
  });

  it('setTeamName 各隊獨立設定，整場重設不清除隊名', () => {
    const s = useScoreboardStore.getState();
    s.setTeamName('A', '高醫女排');
    s.setTeamName('B', '對手');
    expect(useScoreboardStore.getState().nameA).toBe('高醫女排');
    expect(useScoreboardStore.getState().nameB).toBe('對手');
    s.resetMatch();
    expect(useScoreboardStore.getState().nameA).toBe('高醫女排');
  });

  it('resetScores 只清比分、保留小局數;resetMatch 全部歸零', () => {
    const s = useScoreboardStore.getState();
    s.adjustScore('A', 1);
    s.adjustSet('B', 1);
    s.resetScores();
    let st = useScoreboardStore.getState();
    expect(st.scoreA).toBe(0);
    expect(st.setB).toBe(1);
    s.resetMatch();
    st = useScoreboardStore.getState();
    expect(st.setB).toBe(0);
    expect(st.currentSetIndex).toBe(1);
  });
});
