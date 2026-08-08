import { create } from 'zustand';

export type ToastTone = 'success' | 'error' | 'warning' | 'info';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastItem {
  id: number;
  tone: ToastTone;
  title: string;
  description?: string;
  duration: number;
  /** 選用的動作鈕（如「復原」）；點下後由呼叫端負責關閉 */
  action?: ToastAction;
}

interface ToastState {
  items: ToastItem[];
  push: (t: Omit<ToastItem, 'id' | 'duration'> & { duration?: number }) => number;
  dismiss: (id: number) => void;
}

let nextId = 1;

export const useToastStore = create<ToastState>((set) => ({
  items: [],
  push: (t) => {
    const id = nextId++;
    const duration = t.duration ?? 3200;
    set((s) => ({ items: [...s.items, { id, duration, ...t }] }));
    return id;
  },
  dismiss: (id) => set((s) => ({ items: s.items.filter((x) => x.id !== id) })),
}));

export const toast = {
  success: (title: string, description?: string) =>
    useToastStore.getState().push({ tone: 'success', title, description }),
  error: (title: string, description?: string) =>
    useToastStore.getState().push({ tone: 'error', title, description, duration: 5000 }),
  warning: (title: string, description?: string) =>
    useToastStore.getState().push({ tone: 'warning', title, description }),
  info: (title: string, description?: string) =>
    useToastStore.getState().push({ tone: 'info', title, description }),
  /**
   * 推一則可復原的提示：點「復原」執行 onUndo 並立即關閉該則。
   * 用於「先動作、後補救」的流程，取代每次都要按確認的對話框。
   */
  undoable: (title: string, actionLabel: string, onUndo: () => void, description?: string) => {
    const store = useToastStore.getState();
    const id = store.push({
      tone: 'info',
      title,
      description,
      action: {
        label: actionLabel,
        onClick: () => {
          onUndo();
          useToastStore.getState().dismiss(id);
        },
      },
    });
    return id;
  },
  dismiss: (id: number) => useToastStore.getState().dismiss(id),
};
