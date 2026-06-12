import { useState } from 'react';
import './flip.css';

export type FlipDirection = 'inc' | 'dec';

interface FlipDigitProps {
  /** 要顯示的單一字元（0-9） */
  char: string;
  /** 翻轉方向：inc 由上往下闔、dec 由下往上掀 */
  direction: FlipDirection;
}

/**
 * 單一翻牌數字。純顯示元件：收到新的 char 時播放 split-flap 3D 動畫。
 *
 * 動畫期間同時存在四個半片：
 * - 靜態上半片／下半片：顯示動畫結束後該露出的數字
 * - 兩個翻動半片（out → in 接力）：以 key 重建，連點時動畫直接重播
 */
export default function FlipDigit({ char, direction }: FlipDigitProps) {
  const [shown, setShown] = useState(char);
  // incoming 直接由 props 衍生：char 與已落定的 shown 不同即代表正在翻牌
  const incoming = char !== shown ? char : null;

  const animating = incoming !== null;
  // +1：上半片先露出新值（舊上半片闔下去之後看到的就是它）；-1 相反
  const topChar = animating && direction === 'inc' ? incoming : shown;
  const bottomChar = animating && direction === 'dec' ? incoming : shown;

  return (
    <span className="flip-digit" aria-hidden="true">
      <span className="flip-half top">
        <span>{topChar}</span>
      </span>
      <span className="flip-half bottom">
        <span>{bottomChar}</span>
      </span>
      {animating && direction === 'inc' && (
        <span key={`out-${incoming}`} className="flip-flap top out-down">
          <span>{shown}</span>
        </span>
      )}
      {animating && direction === 'inc' && (
        <span
          key={`in-${incoming}`}
          className="flip-flap bottom in-down"
          onAnimationEnd={() => setShown(incoming)}
        >
          <span>{incoming}</span>
        </span>
      )}
      {animating && direction === 'dec' && (
        <span key={`out-${incoming}`} className="flip-flap bottom out-up">
          <span>{shown}</span>
        </span>
      )}
      {animating && direction === 'dec' && (
        <span
          key={`in-${incoming}`}
          className="flip-flap top in-up"
          onAnimationEnd={() => setShown(incoming)}
        >
          <span>{incoming}</span>
        </span>
      )}
    </span>
  );
}
