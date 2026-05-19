import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { profileApi } from '@/api/profile';
import { useAuthStore } from '@/stores/authStore';
import { showError, showSuccess } from '@/lib/swal';

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
                <Input
                  id="currentPassword"
                  type="password"
                  autoComplete="current-password"
                  {...pwdForm.register('currentPassword')}
                />
                {pwdForm.formState.errors.currentPassword && (
                  <p className="text-sm text-destructive">{pwdForm.formState.errors.currentPassword.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword">新密碼</Label>
                <Input
                  id="newPassword"
                  type="password"
                  autoComplete="new-password"
                  {...pwdForm.register('newPassword')}
                />
                {pwdForm.formState.errors.newPassword && (
                  <p className="text-sm text-destructive">{pwdForm.formState.errors.newPassword.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">確認新密碼</Label>
                <Input
                  id="confirmPassword"
                  type="password"
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
    </div>
  );
}
