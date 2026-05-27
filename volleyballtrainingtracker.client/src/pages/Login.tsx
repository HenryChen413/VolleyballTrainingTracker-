import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Navigate, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { Volleyball, AlertCircle, Clock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Chip } from "@/components/ui/chip";
import ThemeToggle from "@/components/ThemeToggle";
import ColdStartHint from "@/components/ColdStartHint";
import { authApi } from "@/api/auth";
import { getApiErrorMessage } from "@/api/client";
import { pingHealth } from "@/api/health";
import { useColdStartHint } from "@/lib/useColdStartHint";
import { useAuthStore } from "@/stores/authStore";

const schema = z.object({
  userName: z.string().min(1, "請輸入帳號"),
  password: z.string().min(1, "請輸入密碼"),
});

type FormValues = z.infer<typeof schema>;

const sanitizeUserName = (raw: string) =>
  raw.replace(/[^A-Za-z0-9]/g, "").toUpperCase();

export default function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const isAuthed = useAuthStore((s) => s.isAuthenticated());
  const [error, setError] = useState<string | null>(null);
  // 被動登出提示（如：閒置過久／登入逾期自動登出），由 AppLayout 透過 sessionStorage 帶入。
  const [notice, setNotice] = useState<string | null>(null);
  // IME（拼音／注音）組字進行中的旗標：組字期間先放手，避免即時過濾打斷組字。
  const composingRef = useRef(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const userName = watch("userName") ?? "";
  const password = watch("password") ?? "";

  const coldStart = useColdStartHint(isSubmitting);

  // 預先暖機：登入頁一載入就 fire-and-forget 打 /health，讓休眠的後端在使用者
  // 輸入帳密期間就開始喚醒，按下登入時通常已就緒。失敗靜默、不影響登入。
  useEffect(() => {
    void pingHealth();
  }, []);

  // 讀取被動登出原因（AppLayout 閒置／逾期登出時寫入），顯示提示後立即清除，
  // 避免下次正常進入登入頁仍殘留。
  useEffect(() => {
    if (sessionStorage.getItem("vbtt-logout-reason") === "idle") {
      sessionStorage.removeItem("vbtt-logout-reason");
      setNotice("因閒置過久或登入逾期，系統已自動登出，請重新登入。");
    }
  }, []);

  // 手機 bfcache：從瀏覽紀錄返回登入頁時，頁面可能直接還原舊快照而不重跑 React。
  // 若此時已登入，強制導回儀表板。
  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted && useAuthStore.getState().isAuthenticated()) {
        window.location.replace("/");
      }
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  if (isAuthed) {
    return <Navigate to="/" replace />;
  }

  const onSubmit = async (values: FormValues) => {
    setError(null);
    try {
      const res = await authApi.login(
        values.userName.toUpperCase(),
        values.password,
      );
      setAuth(res.accessToken, res.expiresAt, res.user);
      navigate("/", { replace: true });
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, "登入失敗"));
    }
  };

  const year = new Date().getFullYear();

  return (
    <div className="min-h-screen w-full relative bg-background text-foreground overflow-hidden">
      {/* 手機背景（桌面 split-screen 自帶背景） */}
      <div
        className="md:hidden absolute inset-0 overflow-hidden pointer-events-none"
        aria-hidden
      >
        <div className="absolute inset-0 login-dots opacity-60" />
        <div className="absolute -top-32 -right-24 w-[20rem] h-[20rem] rounded-full bg-primary/30 login-blob" />
        <div className="absolute -bottom-32 -left-24 w-[20rem] h-[20rem] rounded-full bg-navy/25 login-blob" />
      </div>

      {/* 主題切換（浮動 top-right） */}
      <div className="absolute top-4 right-4 z-30">
        <ThemeToggle />
      </div>

      {/* Split-screen layout：桌面左 hero + 右登入；手機只顯示登入 */}
      <div className="min-h-screen w-full md:grid md:grid-cols-[58fr_42fr]">
        {/* === 左側 Hero（桌面） === */}
        <HeroPanel year={year} />

        {/* === 右側 登入區 === */}
        <div className="relative flex items-center justify-center px-5 py-12 md:px-10 lg:px-14 min-h-screen">
          <div className="relative w-full max-w-[440px] animate-slide-up">
            {/* 卡片上方品牌區塊 */}
            <div className="flex flex-col items-center text-center md:items-start md:text-left gap-3 mb-6">
              <div className="h-14 w-14 rounded-2xl bg-primary text-primary-foreground grid place-items-center shadow-glow shrink-0">
                <Volleyball className="h-7 w-7" strokeWidth={2} />
              </div>
              <div>
                <h1 className="font-display text-[22px] md:text-[24px] leading-tight tracking-tight font-bold">
                  高醫醫學女排‧排球訓練紀錄
                </h1>
                <p className="mt-1.5 text-[13px] text-muted-foreground">
                  球隊管理 · 訓練追蹤 · 戰績統計
                </p>
              </div>
            </div>

            {/* 登入卡 */}
            <div className="rounded-xl border border-border/60 bg-card shadow-lift p-6 md:p-7">
              <div className="mb-5">
                <h2 className="text-[17px] font-semibold tracking-tight">
                  登入帳號
                </h2>
                <p className="mt-1 text-[12.5px] text-muted-foreground">
                  請輸入你的帳號與密碼
                </p>
              </div>

              {/* 被動登出提示 */}
              {notice && (
                <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
                  <Clock className="h-4 w-4 shrink-0 mt-0.5" />
                  <p className="text-[12.5px] leading-relaxed">{notice}</p>
                </div>
              )}

              <form
                onSubmit={handleSubmit(onSubmit)}
                className="flex flex-col gap-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="userName">帳號</Label>
                  <div className="relative">
                    <Input
                      id="userName"
                      autoComplete="username"
                      autoCapitalize="characters"
                      spellCheck={false}
                      disabled={isSubmitting}
                      className="font-mono uppercase tracking-wider pr-10"
                      {...register("userName")}
                      onChange={(e) => {
                        // 組字中（拼音／注音 IME）先放手，等 onCompositionEnd 再過濾。
                        if (composingRef.current) return;
                        setValue("userName", sanitizeUserName(e.target.value), {
                          shouldValidate: true,
                        });
                      }}
                      onCompositionStart={() => {
                        composingRef.current = true;
                      }}
                      onCompositionEnd={(e) => {
                        composingRef.current = false;
                        setValue(
                          "userName",
                          sanitizeUserName(e.currentTarget.value),
                          { shouldValidate: true },
                        );
                      }}
                    />
                    {userName && !isSubmitting && (
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={() =>
                          setValue("userName", "", { shouldValidate: true })
                        }
                        className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
                        aria-label="清除帳號"
                        title="清除帳號"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  {errors.userName && (
                    <p className="text-sm text-destructive">
                      {errors.userName.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">密碼</Label>
                  <PasswordInput
                    id="password"
                    autoComplete="current-password"
                    disabled={isSubmitting}
                    {...register("password")}
                    showClear={!!password && !isSubmitting}
                    onClear={() =>
                      setValue("password", "", { shouldValidate: true })
                    }
                  />
                  {errors.password && (
                    <p className="text-sm text-destructive">
                      {errors.password.message}
                    </p>
                  )}
                </div>

                {error && (
                  <div
                    role="alert"
                    className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
                  >
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <p className="text-[12.5px] leading-relaxed">{error}</p>
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-11 text-base shadow-soft hover:shadow-lift transition-all"
                >
                  {isSubmitting ? "登入中…" : "登入"}
                </Button>

                <ColdStartHint state={coldStart} />
              </form>
            </div>

            {/* 卡片下方版權頁尾（桌面 + 手機都有） */}
            <div className="text-center text-[11.5px] text-muted-foreground mt-6 space-y-1">
              <p>© {year} 高醫醫學女排‧排球訓練紀錄</p>
              <p>版權所有 — 本網站著作權屬 陳源和 所有，未經授權請勿使用</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============== 左側 Hero Panel（桌面 ≥md 才顯示） ============== */

function HeroPanel({ year }: { year: number }) {
  return (
    <aside className="relative hidden md:flex flex-col p-10 lg:p-14 overflow-hidden bg-gradient-to-br from-card via-card to-muted/30">
      <HeroDecor />

      {/* 左上小型 brand mark */}
      <div className="relative flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-primary text-primary-foreground grid place-items-center shadow-soft">
          <Volleyball className="h-[18px] w-[18px]" strokeWidth={2} />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-[12px] uppercase tracking-[0.16em] text-muted-foreground font-semibold">
            KMUMED · Volleyball
          </span>
          <span className="text-[12.5px] text-navy font-medium">
            高醫醫學女排
          </span>
        </div>
      </div>

      {/* 中央 slogan + 描述 */}
      <div className="relative flex-1 flex flex-col justify-center max-w-xl py-12">
        <Chip tone="primary" size="md" className="self-start mb-5">
          <span className="w-1.5 h-1.5 rounded-full bg-current mr-1" />
          球隊管理 · 訓練追蹤 · 戰績統計
        </Chip>

        <h2 className="font-display text-[40px] lg:text-[52px] leading-[1.05] tracking-tight font-bold">
          為彼此而戰，
          <br />
          <span className="text-primary">為自己而練。</span>
        </h2>

        <p className="mt-5 text-[15px] leading-relaxed text-muted-foreground max-w-md">
          一個專為高醫醫學系女子排球隊打造的訓練與戰績管理平台。
          記錄每一次練習動作、每一場比賽分數，讓努力被看見。
        </p>
      </div>

      {/* Hero 底部 */}
      <div className="relative flex items-center justify-between text-[12px] text-muted-foreground gap-4">
        <span>© {year} 陳源和 · 著作權所有</span>
        <span className="hidden lg:inline opacity-70">為球隊而生</span>
      </div>
    </aside>
  );
}

/* ============== Hero 背景：排球場線條 + 球體圓環 + blob ============== */

function HeroDecor() {
  return (
    <div
      className="absolute inset-0 overflow-hidden pointer-events-none"
      aria-hidden
    >
      {/* 暖色 blob */}
      <div className="absolute -bottom-40 -right-32 w-[36rem] h-[36rem] rounded-full bg-primary/40 login-blob" />
      <div className="absolute -top-32 -left-24 w-[28rem] h-[28rem] rounded-full bg-navy/35 login-blob" />

      {/* SVG：彈道弧 + 球體圓環 + 球場線 */}
      <svg
        className="absolute inset-0 w-full h-full text-primary"
        viewBox="0 0 800 1000"
        fill="none"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <linearGradient id="loginLineFade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.28" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.04" />
          </linearGradient>
          <linearGradient id="loginLineFade2" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.05" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.2" />
          </linearGradient>
        </defs>

        {/* 彈道弧（發球軌跡） */}
        <path
          d="M -40 720 Q 240 240, 720 380"
          stroke="url(#loginLineFade)"
          strokeWidth="1.25"
          strokeDasharray="3 7"
        />
        <path
          d="M -40 820 Q 280 360, 760 520"
          stroke="url(#loginLineFade)"
          strokeWidth="1.25"
          strokeDasharray="3 7"
        />
        <path
          d="M -40 920 Q 320 480, 800 680"
          stroke="url(#loginLineFade)"
          strokeWidth="1.25"
          strokeDasharray="3 7"
        />

        {/* 球體：同心圓 + 排球曲線 */}
        <g opacity="0.55">
          <circle
            cx="700"
            cy="900"
            r="180"
            stroke="url(#loginLineFade2)"
            strokeWidth="1"
          />
          <circle
            cx="700"
            cy="900"
            r="240"
            stroke="url(#loginLineFade2)"
            strokeWidth="1"
          />
          <circle
            cx="700"
            cy="900"
            r="320"
            stroke="url(#loginLineFade2)"
            strokeWidth="1"
          />
          <path
            d="M520 900 Q 700 760 880 900"
            stroke="currentColor"
            strokeOpacity="0.18"
            strokeWidth="1.25"
          />
          <path
            d="M700 720 Q 820 900 700 1080"
            stroke="currentColor"
            strokeOpacity="0.18"
            strokeWidth="1.25"
          />
          <path
            d="M700 720 Q 580 900 700 1080"
            stroke="currentColor"
            strokeOpacity="0.18"
            strokeWidth="1.25"
          />
        </g>

        {/* 球場橫線（中線 + 攻擊線） */}
        <g stroke="currentColor" strokeOpacity="0.12" strokeWidth="1">
          <line x1="0" y1="500" x2="800" y2="500" />
          <line x1="0" y1="380" x2="800" y2="380" strokeDasharray="2 6" />
          <line x1="0" y1="620" x2="800" y2="620" strokeDasharray="2 6" />
        </g>
      </svg>
    </div>
  );
}
