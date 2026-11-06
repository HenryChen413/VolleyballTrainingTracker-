import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Smartphone } from 'lucide-react';

const QUERY = '(orientation: portrait)';

const isPortrait = () =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(QUERY).matches;

/** 直向時全螢幕覆蓋提示，記錄單只支援橫放 */
export function RotateHint({ backTo }: { backTo?: string }) {
  const [portrait, setPortrait] = useState(isPortrait);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia(QUERY);
    const onChange = () => setPortrait(mql.matches);
    mql.addEventListener?.('change', onChange);
    return () => mql.removeEventListener?.('change', onChange);
  }, []);

  if (!portrait) return null;
  return (
    <div
      role="alert"
      className="fixed inset-0 z-[70] flex flex-col items-center justify-center gap-4 bg-background p-6 text-center"
    >
      <Smartphone className="h-12 w-12 rotate-90 text-primary" />
      <p className="text-lg font-semibold">請將裝置轉為橫向</p>
      {backTo && (
        <Link
          to={backTo}
          className="inline-flex h-11 items-center rounded-md border px-4 text-sm text-primary"
        >
          返回列表
        </Link>
      )}
    </div>
  );
}
