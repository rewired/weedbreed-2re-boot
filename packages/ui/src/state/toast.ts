import { create } from "zustand";

export type ToastVariant = "info" | "success" | "error";

export interface ToastMessage {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly variant: ToastVariant;
}

interface ToastStore {
  readonly toasts: readonly ToastMessage[];
  enqueueToast(toast: Omit<ToastMessage, "id"> & { readonly id?: string }): string;
  dismissToast(id: string): void;
  clearToasts(): void;
}

let nextToastId = 1;

function createToastId(): string {
  const id = `toast-${String(nextToastId)}`;
  nextToastId += 1;
  return id;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  enqueueToast: (toast) => {
    const id = toast.id ?? createToastId();
    const entry: ToastMessage = {
      id,
      title: toast.title,
      description: toast.description,
      variant: toast.variant
    };

    set((state) => ({ toasts: [...state.toasts, entry] }));
    return id;
  },
  dismissToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) }));
  },
  clearToasts: () => {
    set(() => ({ toasts: [] }));
  }
}));

export function publishToast(toast: Omit<ToastMessage, "id"> & { readonly id?: string }): string {
  return useToastStore.getState().enqueueToast(toast);
}

export function dismissToast(id: string): void {
  useToastStore.getState().dismissToast(id);
}

export function clearToasts(): void {
  useToastStore.getState().clearToasts();
}

export function getToasts(): readonly ToastMessage[] {
  return useToastStore.getState().toasts;
}
