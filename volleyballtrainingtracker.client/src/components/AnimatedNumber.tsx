import { useEffect, useRef, useState } from "react";
import { animate } from "framer-motion";

interface AnimatedNumberProps {
  /** 目標數值 */
  value: number;
  /** 動畫時長（秒） */
  duration?: number;
}

/**
 * 數字滾動進場：從上一個值平滑過渡到新值。
 * 尊重 prefers-reduced-motion，會直接顯示最終值。
 */
export function AnimatedNumber({ value, duration = 0.7 }: AnimatedNumberProps) {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduce || prev.current === value) {
      setDisplay(value);
      prev.current = value;
      return;
    }

    const controls = animate(prev.current, value, {
      duration,
      ease: "easeOut",
      onUpdate: (v) => setDisplay(v),
    });
    prev.current = value;
    return () => controls.stop();
  }, [value, duration]);

  return <>{Math.round(display)}</>;
}
