import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import FormationCourt, { type CourtToken } from "./FormationCourt";

const tokens: CourtToken[] = [
  { key: "S", role: "S", primary: "舉球", point: { x: 0.5, y: 0.1 } },
  { key: "L", role: "L", primary: "7", secondary: "小美", point: { x: 0.2, y: 0.6 } },
];

describe("FormationCourt", () => {
  it("依正規化座標定位 token", () => {
    render(<FormationCourt tokens={tokens} editable={false} />);
    const s = screen.getByRole("button", { name: "舉球" });
    expect(s.style.left).toBe("50%");
    expect(screen.getByRole("button", { name: "7 小美" })).toBeInTheDocument();
  });

  it("檢視模式點 token 觸發 onTokenClick", () => {
    const onTokenClick = vi.fn();
    render(<FormationCourt tokens={tokens} editable={false} onTokenClick={onTokenClick} />);
    fireEvent.click(screen.getByRole("button", { name: "舉球" }));
    expect(onTokenClick).toHaveBeenCalledWith("S");
  });

  it("有起始位置且有移動時畫箭頭；沒移動不畫", () => {
    const { container } = render(
      <FormationCourt
        tokens={tokens}
        editable={false}
        ghosts={{ S: { x: 0.5, y: 0.1 }, L: { x: 0.8, y: 0.6 } }}
      />,
    );
    expect(container.querySelectorAll("[data-arrow]")).toHaveLength(1);
  });

  it("位置錯誤畫紅線", () => {
    const { container } = render(
      <FormationCourt tokens={tokens} editable={false} violations={[{ a: tokens[0].point, b: tokens[1].point }]} />,
    );
    expect(container.querySelectorAll("[data-violation]")).toHaveLength(1);
  });

  it("編輯模式拖曳觸發 onMove，且座標不為 NaN", () => {
    const onMove = vi.fn();
    render(<FormationCourt tokens={tokens} editable onMove={onMove} />);
    const btn = screen.getByRole("button", { name: "舉球" });
    fireEvent.pointerDown(btn, { pointerId: 1, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(btn, { pointerId: 1, clientX: 20, clientY: 20 });
    expect(onMove).toHaveBeenCalled();
    const [key, p] = onMove.mock.calls[0];
    expect(key).toBe("S");
    expect(Number.isNaN(p.x) || Number.isNaN(p.y)).toBe(false);
  });
});
