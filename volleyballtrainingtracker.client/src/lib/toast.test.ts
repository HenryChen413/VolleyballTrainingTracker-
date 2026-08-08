import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast, useToastStore } from './toast';

describe('toast store', () => {
  beforeEach(() => {
    useToastStore.setState({ items: [] });
  });

  it('undoable 會推一則帶動作的提示', () => {
    const onUndo = vi.fn();
    toast.undoable('已清除 5 條', '復原', onUndo);

    const [item] = useToastStore.getState().items;
    expect(item.title).toBe('已清除 5 條');
    expect(item.action?.label).toBe('復原');
    expect(onUndo).not.toHaveBeenCalled();
  });

  it('觸發動作會執行 callback 並關閉該則提示', () => {
    const onUndo = vi.fn();
    toast.undoable('已清除 5 條', '復原', onUndo);

    const [item] = useToastStore.getState().items;
    item.action?.onClick();

    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(useToastStore.getState().items).toHaveLength(0);
  });

  it('一般的 toast 不帶動作', () => {
    toast.success('存檔完成');
    expect(useToastStore.getState().items[0].action).toBeUndefined();
  });
});
