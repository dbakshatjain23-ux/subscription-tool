"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

type ToastKind = "success" | "error" | "info";

type Toast = {
  id: string;
  kind: ToastKind;
  title: string;
  message?: string;
};

type ConfirmOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "default";
};

type PendingConfirm = ConfirmOptions & {
  resolve: (value: boolean) => void;
};

type ToastContextValue = {
  toast: (toast: Omit<Toast, "id">) => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);

  const removeToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const toast = useCallback(
    ({ kind, title, message }: Omit<Toast, "id">) => {
      const id = crypto.randomUUID();
      setToasts((current) => [...current, { id, kind, title, message }].slice(-4));
      window.setTimeout(() => removeToast(id), 3600);
    },
    [removeToast]
  );

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setPendingConfirm({ ...options, resolve });
    });
  }, []);

  const value = useMemo(() => ({ toast, confirm }), [confirm, toast]);

  function closeConfirm(result: boolean) {
    pendingConfirm?.resolve(result);
    setPendingConfirm(null);
  }

  return (
    <ToastContext.Provider value={value}>
      {children}

      <div className="fixed right-4 top-4 z-[70] grid w-[min(380px,calc(100vw-2rem))] gap-2">
        {toasts.map((item) => (
          <div
            key={item.id}
            className={`rounded-lg border bg-white px-4 py-3 text-sm shadow-lg ${
              item.kind === "success"
                ? "border-emerald-200"
                : item.kind === "error"
                  ? "border-rose-200"
                  : "border-slate-200"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p
                  className={`font-semibold ${
                    item.kind === "success"
                      ? "text-emerald-800"
                      : item.kind === "error"
                        ? "text-rose-800"
                        : "text-slate-900"
                  }`}
                >
                  {item.title}
                </p>
                {item.message ? <p className="mt-1 leading-5 text-slate-600">{item.message}</p> : null}
              </div>
              <button type="button" onClick={() => removeToast(item.id)} className="text-slate-400 hover:text-slate-700">
                Close
              </button>
            </div>
          </div>
        ))}
      </div>

      {pendingConfirm ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
            <h3 className="text-base font-semibold text-slate-900">{pendingConfirm.title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">{pendingConfirm.message}</p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => closeConfirm(false)}
                className="inline-flex h-10 items-center justify-center rounded-md border border-slate-200 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                {pendingConfirm.cancelLabel ?? "Cancel"}
              </button>
              <button
                type="button"
                onClick={() => closeConfirm(true)}
                className={`inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-medium text-white ${
                  pendingConfirm.tone === "danger" ? "bg-rose-700 hover:bg-rose-800" : "bg-slate-900 hover:bg-slate-800"
                }`}
              >
                {pendingConfirm.confirmLabel ?? "Confirm"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used inside ToastProvider.");
  }
  return context;
}
