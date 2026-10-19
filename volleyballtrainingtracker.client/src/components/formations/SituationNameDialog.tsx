import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { SITUATION_NAME_MAX } from "@/lib/formations/layout";

interface Props {
  open: boolean;
  title: string;
  initial: string;
  /** 回傳錯誤訊息（顯示在欄位下方）或 null 表示成功、由呼叫端關閉 */
  onSubmit: (name: string) => string | null;
  onClose: () => void;
}

export default function SituationNameDialog({ open, title, initial, onSubmit, onClose }: Props) {
  // 以 key 重新掛載重置欄位（見呼叫端），此處只保存輸入中的值
  const [name, setName] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const submit = () => setError(onSubmit(name));
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>取消</Button>
          <Button onClick={submit}>確定</Button>
        </>
      }
    >
      <div className="space-y-2 p-5">
        <Input
          autoFocus
          value={name}
          maxLength={SITUATION_NAME_MAX + 5}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          aria-label="情況名稱"
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    </Dialog>
  );
}
