import { useRef, useState } from 'react';
import { CalendarDays } from 'lucide-react';

export function DateInput({
  value,
  onChange,
}: {
  value: string | null | undefined;
  onChange: (v: string | null) => void;
}) {
  const [y, setY] = useState('');
  const [m, setM] = useState('');
  const [d, setD] = useState('');
  const yearRef = useRef<HTMLInputElement>(null);
  const monthRef = useRef<HTMLInputElement>(null);
  const dayRef = useRef<HTMLInputElement>(null);
  const nativeRef = useRef<HTMLInputElement>(null);

  // 於 render 階段同步外部 value（取代 effect 內 setState，避免連鎖渲染）
  const [prevValue, setPrevValue] = useState<string | null | undefined>(undefined);
  if (value !== prevValue) {
    setPrevValue(value);
    if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [py, pm, pd] = value.split('-');
      setY(py); setM(pm); setD(pd);
    } else if (!value) {
      setY(''); setM(''); setD('');
    }
  }

  const emit = (ny: string, nm: string, nd: string) => {
    const mm = parseInt(nm, 10);
    const dd = parseInt(nd, 10);
    if (
      ny.length === 4 &&
      nm.length === 2 && mm >= 1 && mm <= 12 &&
      nd.length === 2 && dd >= 1 && dd <= 31
    ) {
      onChange(`${ny}-${nm}-${nd}`);
    } else if (!ny && !nm && !nd) {
      onChange(null);
    }
  };

  const onYear = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.replace(/\D/g, '').slice(0, 4);
    setY(v);
    if (v.length === 4) monthRef.current?.focus();
    emit(v, m, d);
  };

  const onMonth = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.replace(/\D/g, '').slice(0, 2);
    setM(v);
    if (v.length === 2) dayRef.current?.focus();
    emit(y, v, d);
  };

  const onDay = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.replace(/\D/g, '').slice(0, 2);
    setD(v);
    emit(y, m, v);
  };

  const onKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    prev: HTMLInputElement | null,
    cur: HTMLInputElement
  ) => {
    if (e.key === 'Backspace' && cur.value === '' && prev) {
      e.preventDefault();
      prev.focus();
    }
  };

  const onNativePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    if (v && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
      const [py, pm, pd] = v.split('-');
      setY(py); setM(pm); setD(pd);
      onChange(v);
    }
  };

  // 隱藏的原生 <input type="date"> 只接受完整、補零後的 yyyy-MM-dd；
  // 編輯途中（如月/日僅輸入 1 碼）給空字串，避免瀏覽器「不符合 yyyy-MM-dd」警告。
  const nativeValue =
    y.length === 4 && m.length === 2 && d.length === 2 ? `${y}-${m}-${d}` : '';

  const seg = 'bg-transparent outline-none text-center tabular-nums';

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center border rounded-md px-3 py-2 gap-1 text-sm focus-within:ring-1 focus-within:ring-ring">
        <input
          ref={yearRef}
          type="text"
          inputMode="numeric"
          placeholder="YYYY"
          maxLength={4}
          value={y}
          onChange={onYear}
          className={`${seg} w-12`}
        />
        <span className="text-muted-foreground">/</span>
        <input
          ref={monthRef}
          type="text"
          inputMode="numeric"
          placeholder="MM"
          maxLength={2}
          value={m}
          onChange={onMonth}
          onKeyDown={(e) => onKeyDown(e, yearRef.current, e.currentTarget)}
          className={`${seg} w-8`}
        />
        <span className="text-muted-foreground">/</span>
        <input
          ref={dayRef}
          type="text"
          inputMode="numeric"
          placeholder="DD"
          maxLength={2}
          value={d}
          onChange={onDay}
          onKeyDown={(e) => onKeyDown(e, monthRef.current, e.currentTarget)}
          className={`${seg} w-8`}
        />
      </div>
      <button
        type="button"
        onClick={() => nativeRef.current?.showPicker?.()}
        className="p-2 rounded-md border hover:bg-muted transition-colors"
        title="選擇日期"
      >
        <CalendarDays className="h-4 w-4 text-muted-foreground" />
      </button>
      <input
        ref={nativeRef}
        type="date"
        value={nativeValue}
        onChange={onNativePick}
        className="sr-only"
        tabIndex={-1}
      />
    </div>
  );
}
