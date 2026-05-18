import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Volleyball, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import ThemeToggle from '@/components/ThemeToggle';
import { authApi } from '@/api/auth';
import { useAuthStore } from '@/stores/authStore';

const schema = z.object({
  userName: z.string().min(1, '請輸入帳號'),
  password: z.string().min(1, '請輸入密碼'),
});

type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (values: FormValues) => {
    setError(null);
    try {
      const res = await authApi.login(values.userName.toUpperCase(), values.password);
      setAuth(res.accessToken, res.expiresAt, res.user);
      // 登入後一律導向儀表板
      navigate('/', { replace: true });
    } catch (e: unknown) {
      const message =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '登入失敗';
      setError(message);
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
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="userName">帳號</Label>
                <Input
                  id="userName"
                  autoComplete="username"
                  className="font-mono uppercase tracking-wider"
                  {...register('userName')}
                  onChange={(e) => {
                    const upper = e.target.value.replace(/[^A-Z0-9]/gi, (c) =>
                      /[a-z]/.test(c) ? c.toUpperCase() : ''
                    );
                    setValue('userName', upper, { shouldValidate: true });
                  }}
                />
                {errors.userName && (
                  <p className="text-sm text-destructive">{errors.userName.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">密碼</Label>
                <Input id="password" type="password" autoComplete="current-password" {...register('password')} />
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
