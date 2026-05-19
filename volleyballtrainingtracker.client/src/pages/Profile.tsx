import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';
import { Ruler, Scale, Hand, GraduationCap, CalendarDays, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { profileApi, type MyPlayerInfo } from '@/api/profile';
import { PLAYER_STATUS_LABEL, type PlayerStatus } from '@/api/players';
import { useAuthStore } from '@/stores/authStore';
import { showError, showSuccess } from '@/lib/swal';

const POSITION_LABELS: Record<string, string> = {
  OH: '主攻', OPP: '副攻', MB: '攔中', S: '舉球員', L: '自由',
};
const handLabel = (h: string | null) => (h === 'Right' ? '右手' : h === 'Left' ? '左手' : null);
const MATCH_TYPE_LABEL: Record<string, string> = { Official: '比賽', Friendly: '友誼賽' };

const profileSchema = z.object({
  email: z.string().email('Email 格式錯誤').max(256),
  displayName: z.string().max(64).optional().nullable(),
});
type ProfileForm = z.infer<typeof profileSchema>;

const pwdSchema = z
  .object({
    currentPassword: z.string().min(1, '請輸入目前密碼'),
    newPassword: z.string().min(8, '至少 8 個字').max(64),
    confirmPassword: z.string().min(1, '請再次輸入新密碼'),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ['confirmPassword'],
    message: '兩次輸入不一致',
  });
type PwdForm = z.infer<typeof pwdSchema>;

export default function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);

  // 綁定的選手檔案（未綁定時後端回 404，data 維持 undefined 不顯示此卡）
  const { data: player } = useQuery({
    queryKey: ['profile', 'player'],
    queryFn: () => profileApi.getPlayer(),
    retry: false,
  });

  const profileForm = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: { email: user?.email ?? '', displayName: user?.displayName ?? '' },
  });

  useEffect(() => {
    if (user) profileForm.reset({ email: user.email, displayName: user.displayName ?? '' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.email, user?.displayName]);

  const pwdForm = useForm<PwdForm>({
    resolver: zodResolver(pwdSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const onSaveProfile = async (v: ProfileForm) => {
    try {
      const updated = await profileApi.update({
        email: v.email,
        displayName: v.displayName ?? null,
      });
      updateUser({
        email: updated.email,
        displayName: updated.displayName,
      });
      showSuccess('已儲存');
    } catch (e: unknown) {
      const m = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      showError(m ?? '儲存失敗');
    }
  };

  const onChangePwd = async (v: PwdForm) => {
    try {
      await profileApi.changePassword({
        currentPassword: v.currentPassword,
        newPassword: v.newPassword,
      });
      showSuccess('密碼已更新');
      pwdForm.reset({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (e: unknown) {
      const m = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      showError(m ?? '密碼變更失敗');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">我的帳號</h1>
        <p className="text-sm text-muted-foreground">
          帳號：{user?.userName}（角色：{user?.role}）
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <Card>
          <CardHeader>
            <CardTitle>基本資料</CardTitle>
            <CardDescription>修改 Email 與顯示名稱</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={profileForm.handleSubmit(onSaveProfile)}>
              {/* 儲存進行中時鎖定整個表單 */}
              <fieldset
                disabled={profileForm.formState.isSubmitting}
                className="space-y-4 min-w-0 border-0 p-0 m-0"
              >
              <div className="space-y-2">
                <Label>帳號</Label>
                <Input value={user?.userName ?? ''} disabled />
                <p className="text-xs text-muted-foreground">帳號無法自行修改</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" {...profileForm.register('email')} />
                {profileForm.formState.errors.email && (
                  <p className="text-sm text-destructive">{profileForm.formState.errors.email.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="displayName">顯示名稱</Label>
                <Input id="displayName" {...profileForm.register('displayName')} />
              </div>
              <Button type="submit" disabled={profileForm.formState.isSubmitting}>
                {profileForm.formState.isSubmitting ? '儲存中…' : '儲存'}
              </Button>
              </fieldset>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>變更密碼</CardTitle>
            <CardDescription>需提供目前密碼以驗證身分</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={pwdForm.handleSubmit(onChangePwd)}>
              {/* 更新進行中時鎖定整個表單 */}
              <fieldset
                disabled={pwdForm.formState.isSubmitting}
                className="space-y-4 min-w-0 border-0 p-0 m-0"
              >
              <div className="space-y-2">
                <Label htmlFor="currentPassword">目前密碼</Label>
                <PasswordInput
                  id="currentPassword"
                  autoComplete="current-password"
                  {...pwdForm.register('currentPassword')}
                />
                {pwdForm.formState.errors.currentPassword && (
                  <p className="text-sm text-destructive">{pwdForm.formState.errors.currentPassword.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword">新密碼</Label>
                <PasswordInput
                  id="newPassword"
                  autoComplete="new-password"
                  {...pwdForm.register('newPassword')}
                />
                {pwdForm.formState.errors.newPassword && (
                  <p className="text-sm text-destructive">{pwdForm.formState.errors.newPassword.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">確認新密碼</Label>
                <PasswordInput
                  id="confirmPassword"
                  autoComplete="new-password"
                  {...pwdForm.register('confirmPassword')}
                />
                {pwdForm.formState.errors.confirmPassword && (
                  <p className="text-sm text-destructive">{pwdForm.formState.errors.confirmPassword.message}</p>
                )}
              </div>
              <Button type="submit" disabled={pwdForm.formState.isSubmitting}>
                {pwdForm.formState.isSubmitting ? '更新中…' : '更新密碼'}
              </Button>
              </fieldset>
            </form>
          </CardContent>
        </Card>
      </div>

      {player && <MyPlayerCard player={player} />}
    </div>
  );
}

// ── 我的選手檔案（唯讀；僅在帳號已綁定選手時顯示）────────────────────────
function MyPlayerCard({ player }: { player: MyPlayerInfo }) {
  const positions = player.position
    ? player.position.split(',').map((s) => s.trim()).filter(Boolean)
    : [];
  const hand = handLabel(player.dominantHand);
  const stats: { icon: typeof Ruler; label: string; value: string }[] = [];
  if (player.heightCm != null)
    stats.push({ icon: Ruler, label: '身高', value: `${player.heightCm} cm` });
  if (player.weightKg != null)
    stats.push({ icon: Scale, label: '體重', value: `${player.weightKg} kg` });
  if (hand) stats.push({ icon: Hand, label: '慣用手', value: hand });
  if (player.grade != null)
    stats.push({ icon: GraduationCap, label: '系級', value: String(player.grade) });
  stats.push({
    icon: CalendarDays,
    label: '入隊日期',
    value: player.joinedAt.slice(0, 10),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>我的選手檔案</CardTitle>
        <CardDescription>由教練維護，如需更正請與教練聯繫</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* 基本資訊 */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-primary/10 text-primary">
            <span className="font-numeric text-2xl font-bold leading-none">
              {player.jerseyNo ?? '—'}
            </span>
            <span className="text-[10px]">背號</span>
          </div>
          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-bold">{player.name}</span>
              {player.nickname && (
                <span className="text-sm text-muted-foreground">{player.nickname}</span>
              )}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {positions.map((c) => (
                <Chip key={c} tone="primary" size="sm">
                  {POSITION_LABELS[c] ?? c}
                </Chip>
              ))}
              <Chip tone="neutral" size="sm">
                {PLAYER_STATUS_LABEL[player.isActive as PlayerStatus] ?? '—'}
              </Chip>
            </div>
          </div>
        </div>

        {/* 量化資料 */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {stats.map((s) => (
            <div key={s.label} className="rounded-lg border bg-muted/30 p-3">
              <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <s.icon className="h-3 w-3" />
                {s.label}
              </p>
              <p className="mt-0.5 font-numeric font-semibold">{s.value}</p>
            </div>
          ))}
        </div>

        {/* 出賽紀錄 */}
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Trophy className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">出賽紀錄</h3>
            <Chip tone="navy" size="sm" className="font-numeric">
              {player.matchAppearanceCount} 場
            </Chip>
            {player.officialAppearanceCount > 0 && (
              <span className="text-xs text-muted-foreground">
                （正式賽 {player.officialAppearanceCount} 場）
              </span>
            )}
          </div>
          {player.appearances.length === 0 ? (
            <p className="text-sm text-muted-foreground">尚無出賽紀錄</p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {player.appearances.map((a) => (
                <li
                  key={a.matchEventId}
                  className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <span className="font-numeric text-muted-foreground">
                      {a.matchDate.slice(0, 10)}
                    </span>
                    <span className="ml-2 truncate">{a.matchName || '（未命名賽事）'}</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {a.ourSquad && (
                      <Chip tone="outline" size="sm">{a.ourSquad} 隊</Chip>
                    )}
                    {a.matchType && (
                      <Chip
                        tone={a.matchType === 'Official' ? 'info' : 'warning'}
                        size="sm"
                      >
                        {MATCH_TYPE_LABEL[a.matchType] ?? a.matchType}
                      </Chip>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
