import { useRef, useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Layers,
  Shuffle,
  RotateCcw,
  Volleyball,
  ListChecks,
  Wand2,
  Eye,
  Plus,
  Trash2,
  ChevronDown,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import EmptyState from "@/components/EmptyState";
import { confirmAction } from "@/lib/swal";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "vbtt-draw-cards";

/** 首次使用的範例牌組（排球情境），點「填入範例」可帶入 */
const SAMPLE_CARDS = [
  "主攻 A",
  "主攻 B",
  "攔中 A",
  "攔中 B",
  "舉球員",
  "自由",
];

/** 把多行字串拆成牌（一行一張，去空白行） */
function parseLines(raw: string): string[] {
  return raw
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** 讀取已存的牌組；相容舊版 {text} 多行格式 */
function loadCards(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const o = JSON.parse(raw) as { cards?: unknown; text?: unknown };
      if (Array.isArray(o.cards)) {
        return o.cards
          .filter((c): c is string => typeof c === "string")
          .map((c) => c.trim())
          .filter(Boolean);
      }
      if (typeof o.text === "string") return parseLines(o.text);
    }
  } catch {
    /* localStorage 不可用或格式損毀，落回預設 */
  }
  return [];
}

/** Fisher-Yates 洗牌（回傳新陣列，不變動原陣列） */
function shuffle<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function DrawCardsPage() {
  // 牌組（持久化於 localStorage；lazy initializer 讀取，避免在 effect 內 setState）
  const [cards, setCards] = useState<string[]>(() => loadCards());
  const [newCard, setNewCard] = useState("");
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchText, setBatchText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // 洗牌後固定順序的牌面內容（攤在桌上的每一格）；空陣列代表尚未開始
  const [slots, setSlots] = useState<string[]>([]);
  // 已翻開的格子索引，依翻開先後排序（用來顯示翻開順序）
  const [revealed, setRevealed] = useState<number[]>([]);
  // 每次洗牌遞增，作為攤牌容器的 key 以重播發牌進場動畫
  const [shuffleId, setShuffleId] = useState(0);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ cards }));
    } catch {
      /* 隱私模式等情境可能拒寫，靜默忽略 */
    }
  }, [cards]);

  const resetBoard = () => {
    setSlots([]);
    setRevealed([]);
  };

  // —— 牌組編輯（任何變更都會重置桌面，避免內容與已攤的牌不一致）——
  const addCard = () => {
    const t = newCard.trim();
    if (!t) return;
    setCards((c) => [...c, t]);
    setNewCard("");
    resetBoard();
    inputRef.current?.focus(); // 保持焦點，方便連續輸入
  };
  const removeCard = (idx: number) => {
    setCards((c) => c.filter((_, i) => i !== idx));
    resetBoard();
  };
  const clearAll = async () => {
    const res = await confirmAction(
      "清空整副牌？",
      `目前有 ${cards.length} 張，清空後無法復原。`,
      "清空",
      true,
    );
    if (res.isConfirmed) {
      setCards([]);
      resetBoard();
    }
  };
  const fillSample = () => {
    setCards(SAMPLE_CARDS);
    resetBoard();
  };
  const importBatch = () => {
    const lines = parseLines(batchText);
    if (lines.length === 0) return;
    setCards((c) => [...c, ...lines]);
    setBatchText("");
    setBatchOpen(false);
    resetBoard();
  };

  // —— 攤牌 ——
  const startShuffle = () => {
    if (cards.length === 0) return;
    setSlots(shuffle(cards));
    setRevealed([]);
    setShuffleId((n) => n + 1);
  };
  const revealOne = (i: number) => {
    if (slots.length === 0) return;
    setRevealed((r) => (r.includes(i) ? r : [...r, i]));
  };
  const revealAll = () => {
    setRevealed((r) => {
      const rest = slots.map((_, i) => i).filter((i) => !r.includes(i));
      return [...r, ...rest];
    });
  };

  const started = slots.length > 0;
  const revealedCount = revealed.length;
  const allRevealed = started && revealedCount === slots.length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Layers className="h-6 w-6 text-primary" />
          抽牌
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          自訂牌組內容，洗牌後攤開蓋牌，點選任一張翻開，翻開的牌會保持開著。資料只存在這台裝置的瀏覽器。
        </p>
      </div>

      <div className="xl:grid xl:grid-cols-[2fr_3fr] xl:gap-6 xl:items-start space-y-4 xl:space-y-0">
        {/* === 左：牌組編輯 === */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <ListChecks className="h-5 w-5 text-muted-foreground" />
                牌組內容
              </span>
              <span className="text-sm font-normal text-muted-foreground">
                {cards.length} 張
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* 新增單張 */}
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                value={newCard}
                onChange={(e) => setNewCard(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCard();
                  }
                }}
                placeholder="輸入牌的內容，按 Enter 新增"
                enterKeyHint="done"
                maxLength={100}
              />
              <Button onClick={addCard} disabled={!newCard.trim()}>
                <Plus className="h-4 w-4 mr-1" /> 新增
              </Button>
            </div>

            {/* 牌組清單 */}
            {cards.length === 0 ? (
              <div className="space-y-3">
                <EmptyState
                  compact
                  icon={ListChecks}
                  title="還沒有牌"
                  description="在上方輸入一張，或填入範例試試。"
                />
                <Button variant="outline" size="sm" onClick={fillSample}>
                  <Wand2 className="h-4 w-4 mr-1.5" /> 填入範例
                </Button>
              </div>
            ) : (
              <ul className="space-y-1.5">
                {cards.map((c, i) => (
                  <li
                    key={i}
                    className="group flex items-center gap-2 rounded-md border px-3 py-2"
                  >
                    <span className="w-6 shrink-0 text-xs tabular-nums text-muted-foreground">
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1 break-words text-sm">
                      {c}
                    </span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 shrink-0"
                      onClick={() => removeCard(i)}
                      title="刪除這張"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}

            {/* 批次輸入（折疊）＋ 清空 */}
            <div className="pt-1">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setBatchOpen((v) => !v)}
                  className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <FileText className="h-4 w-4" />
                  批次輸入
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 transition-transform",
                      batchOpen && "rotate-180",
                    )}
                  />
                </button>
                {cards.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearAll}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-1" /> 清空
                  </Button>
                )}
              </div>

              {batchOpen && (
                <div className="mt-2 space-y-2 rounded-md border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">
                    一行一張，貼上後按「匯入」會加到現有牌組後面。
                  </p>
                  <Textarea
                    value={batchText}
                    onChange={(e) => setBatchText(e.target.value)}
                    rows={6}
                    placeholder={"主攻 A\n攔中 B\n舉球員\n…"}
                    className="font-mono text-sm bg-background"
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={importBatch}
                      disabled={parseLines(batchText).length === 0}
                    >
                      <Plus className="h-4 w-4 mr-1" /> 匯入
                      {parseLines(batchText).length > 0 &&
                        `（${parseLines(batchText).length} 張）`}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setBatchOpen(false);
                        setBatchText("");
                      }}
                    >
                      取消
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* === 右：攤牌區 === */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <Layers className="h-5 w-5 text-primary" />
                攤牌區
              </span>
              {started && (
                <span className="text-sm font-normal text-muted-foreground tabular-nums">
                  已翻開 {revealedCount} / {slots.length}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 操作按鈕 */}
            <div className="flex flex-wrap gap-2">
              <Button onClick={startShuffle} disabled={cards.length === 0}>
                <Shuffle className="h-4 w-4 mr-1.5" />
                {started ? "重新洗牌" : "洗牌開始"}
              </Button>
              {started && !allRevealed && (
                <Button variant="outline" onClick={revealAll}>
                  <Eye className="h-4 w-4 mr-1.5" /> 全部翻開
                </Button>
              )}
              {started && (
                <Button variant="ghost" onClick={resetBoard}>
                  <RotateCcw className="h-4 w-4 mr-1.5" /> 收牌
                </Button>
              )}
            </div>

            {/* 桌面 */}
            {cards.length === 0 ? (
              <EmptyState
                compact
                icon={Layers}
                title="尚未建立牌組"
                description="先在左側新增牌的內容。"
              />
            ) : !started ? (
              <EmptyState
                compact
                icon={Shuffle}
                title="準備好了"
                description="點「洗牌開始」把牌攤到桌上，再點選想翻的那張。"
              />
            ) : (
              <motion.div
                key={shuffleId}
                initial="hidden"
                animate="visible"
                variants={{
                  visible: { transition: { staggerChildren: 0.045 } },
                }}
                className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2.5 sm:gap-3"
              >
                {slots.map((textValue, i) => {
                  const order = revealed.indexOf(i);
                  return (
                    <PickCard
                      key={i}
                      text={textValue}
                      revealed={order !== -1}
                      order={order === -1 ? null : order + 1}
                      onClick={() => revealOne(i)}
                    />
                  );
                })}
              </motion.div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/** 攤開在桌上的單張牌：點選後 3D 翻面並保持翻開 */
function PickCard({
  text,
  revealed,
  order,
  onClick,
}: {
  text: string;
  revealed: boolean;
  order: number | null;
  onClick: () => void;
}) {
  return (
    <motion.button
      type="button"
      variants={{
        hidden: { opacity: 0, y: 16 },
        visible: { opacity: 1, y: 0 },
      }}
      whileHover={revealed ? undefined : { scale: 1.04 }}
      whileTap={revealed ? undefined : { scale: 0.96 }}
      onClick={onClick}
      disabled={revealed}
      aria-label={revealed ? text : "蓋著的牌，點選翻開"}
      className={cn(
        "relative aspect-[3/4] [perspective:900px]",
        revealed ? "cursor-default" : "cursor-pointer",
      )}
    >
      <motion.div
        animate={{ rotateY: revealed ? 0 : 180 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative h-full w-full [transform-style:preserve-3d]"
      >
        {/* 正面：牌的內容 */}
        <div className="absolute inset-0 [backface-visibility:hidden] rounded-xl border-2 border-primary/30 bg-gradient-to-br from-card to-accent/40 shadow-md flex items-center justify-center p-2 text-center">
          {order != null && (
            <span className="absolute top-1 left-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold tabular-nums text-primary-foreground">
              {order}
            </span>
          )}
          <span className="text-sm sm:text-base font-bold break-words leading-tight">
            {text}
          </span>
        </div>
        {/* 背面 */}
        <div className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)] rounded-xl border-2 border-primary/40 bg-primary text-primary-foreground shadow-md flex items-center justify-center">
          <Volleyball className="h-7 w-7 sm:h-9 sm:w-9 opacity-90" />
        </div>
      </motion.div>
    </motion.button>
  );
}
