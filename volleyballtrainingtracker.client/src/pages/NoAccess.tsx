import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function NoAccessPage() {
  return (
    <div className="flex items-center justify-center py-16">
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>沒有存取權限</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            你目前的角色未開放此頁面。如需存取，請聯絡管理員調整角色設定。
          </p>
          <Link to="/" className="text-primary underline text-sm">回儀表板</Link>
        </CardContent>
      </Card>
    </div>
  );
}
