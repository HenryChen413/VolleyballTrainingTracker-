import ScoreBoard from '@/components/scoreboard/ScoreBoard';

/**
 * 翻牌記分板：現場比賽用的極簡比分頁，適合 iPad 或投影全螢幕。
 * 純前端小工具（同抽牌頁），state 集中於 scoreboardStore 並 persist。
 */
export default function FlipScoreboardPage() {
  return <ScoreBoard />;
}
