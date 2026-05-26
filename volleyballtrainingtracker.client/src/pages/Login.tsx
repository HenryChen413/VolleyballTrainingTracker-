import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Navigate, useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { Volleyball, AlertCircle, Clock, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import ThemeToggle from '@/components/ThemeToggle';
import ColdStartHint from '@/components/ColdStartHint';
import { authApi } from '@/api/auth';
import { getApiErrorMessage } from '@/api/client';
import { pingHealth } from '@/api/health';
import { useColdStartHint } from '@/lib/useColdStartHint';
import { useAuthStore } from '@/stores/authStore';

const schema = z.object({
  userName: z.string().min(1, '請輸入帳號'),
  password: z.string().min(1, '請輸入密碼'),
});

type FormValues = z.infer<typeof schema>;

// 帳號只允許英數字並一律大寫；用於過濾貼上／IME 組字後的內容。
const sanitizeUserName = (raw: string) => raw.replace(/[^A-Za-z0-9]/g, '').toUpperCase();

export default function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const isAuthed = useAuthStore((s) => s.isAuthenticated());
  const [error, setError] = useState<string | null>(null);
  // 被動登出提示（如：閒置過久／登入逾期自動登出），由 AppLayout 透過 sessionStorage 帶入。
  const [notice, setNotice] = useState<string | null>(null);
  // IME（拼音／注音）組字進行中的旗標：組字期間先放手，避免即時過濾打斷組字。
  const composingRef = useRef(false);

  const { register, handleSubmit, setValue, watch, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const userName = watch('userName') ?? '';
  const password = watch('password') ?? '';

  // 後端喚醒提示：登入請求送出後若遲遲未回應，顯示漸進式「伺服器喚醒中」提示。
  const coldStart = useColdStartHint(isSubmitting);

  // 預先暖機：登入頁一載入就 fire-and-forget 打 /health，讓休眠的後端在使用者
  // 輸入帳密期間就開始喚醒，按下登入時通常已就緒。失敗靜默、不影響登入。
  useEffect(() => {
    void pingHealth();
  }, []);

  // 讀取被動登出原因（AppLayout 閒置／逾期登出時寫入），顯示提示後立即清除，
  // 避免下次正常進入登入頁仍殘留。
  useEffect(() => {
    if (sessionStorage.getItem('vbtt-logout-reason') === 'idle') {
      sessionStorage.removeItem('vbtt-logout-reason');
      setNotice('因閒置過久或登入逾期，系統已自動登出，請重新登入。');
    }
  }, []);

  // 手機 bfcache（上一頁／下一頁快取）：從瀏覽紀錄返回登入頁時，
  // 頁面可能直接還原舊快照而不重跑 React。若此時已登入，強制導回儀表板。
  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted && useAuthStore.getState().isAuthenticated()) {
        window.location.replace('/');
      }
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, []);

  // 已登入就不該停在登入頁 —— 自動導回儀表板，登出後才會再看到登入畫面。
  if (isAuthed) {
    return <Navigate to="/" replace />;
  }

  const onSubmit = async (values: FormValues) => {
    setError(null);
    try {
      const res = await authApi.login(values.userName.toUpperCase(), values.password);
      setAuth(res.accessToken, res.expiresAt, res.user);
      // 登入後一律導向儀表板
      navigate('/', { replace: true });
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, '登入失敗'));
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 bg-background overflow-hidden">
      {/* 裝飾性背景 */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
        <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-navy/20 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, hsl(var(--foreground)) 1px, transparent 0)',
            backgroundSize: '24px 24px',
          }}
        />
      </div>

      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="relative w-full max-w-md animate-slide-up">
        <div className="flex flex-col items-center mb-6">
          <div className="h-14 w-14 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shadow-lift mb-3">
            <Volleyball className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">高醫醫學女排‧排球訓練紀錄</h1>
          <p className="text-sm text-muted-foreground mt-1">球隊管理 · 訓練追蹤 · 戰績統計</p>
        </div>

        <Card className="shadow-lift border-border/60 backdrop-blur-md bg-card/95">
          <CardHeader>
            <CardTitle className="text-lg">登入帳號</CardTitle>
            <CardDescription>請輸入你的帳號與密碼</CardDescription>
          </CardHeader>
          <CardContent>
            {notice && (
              <div className="mb-4 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
                <Clock className="h-4 w-4 shrink-0 mt-0.5" />
                <p>{notice}</p>
              </div>
            )}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
                    {...register('userName')}
                    onChange={(e) => {
                      // 組字中（拼音／注音 IME）先放手，等 onCompositionEnd 再過濾，避免打斷組字。
                      if (composingRef.current) return;
                      setValue('userName', sanitizeUserName(e.target.value), { shouldValidate: true });
                    }}
                    onCompositionStart={() => {
                      composingRef.current = true;
                    }}
                    onCompositionEnd={(e) => {
                      composingRef.current = false;
                      setValue('userName', sanitizeUserName(e.currentTarget.value), { shouldValidate: true });
                    }}
                  />
                  {userName && !isSubmitting && (
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setValue('userName', '', { shouldValidate: true })}
                      className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
                      aria-label="清除帳號"
                      title="清除帳號"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                {errors.userName && (
                  <p className="text-sm text-destructive">{errors.userName.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">密碼</Label>
                <PasswordInput
                  id="password"
                  autoComplete="current-password"
                  disabled={isSubmitting}
                  {...register('password')}
                  showClear={!!password && !isSubmitting}
                  onClear={() => setValue('password', '', { shouldValidate: true })}
                />
                {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
              </div>
              {error && (
                <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <p>{error}</p>
                </div>
              )}
              <Button type="submit" disabled={isSubmitting} className="w-full h-11 text-base shadow-soft">
                {isSubmitting ? '登入中…' : '登入'}
              </Button>
              <ColdStartHint state={coldStart} />
            </form>
          </CardContent>
        </Card>

        <div className="text-center text-xs text-muted-foreground mt-6 space-y-1">
          <p>© {new Date().getFullYear()} 高醫醫學女排‧排球訓練紀錄</p>
          <p>版權所有 — 本網站著作權屬陳源和所有，未經授權請勿使用</p>
        </div>
      </div>
    </div>
  );
}
