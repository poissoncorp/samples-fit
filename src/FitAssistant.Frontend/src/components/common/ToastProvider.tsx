import React, { createContext, useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import './ToastProvider.css';

export type ToastTone = 'info' | 'success' | 'error';

/** Where the toast came from — surfaced as a small left-side chip so the
 *  audience can tell at a glance whether the event was something they did
 *  (user) or something the platform did in the background (system). */
export type ToastSource = 'user' | 'system';

export interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
  /** Optional emoji / glyph rendered at the leading edge. If omitted a
   *  default is picked from `tone` (success → ✓, info → ℹ, error → ⚠). */
  icon?: string;
  /** Optional source chip — "user" or "system". Defaults to "user". */
  source?: ToastSource;
  /** Optional event-kind chip — e.g. "goal", "feed", "trophy". Renders as
   *  a small coloured pill before the message. */
  kind?: string;
  action?: { label: string; onClick: () => void };
  ttlMs: number;
}

export interface ToastApi {
  show(toast: Omit<Toast, 'id' | 'ttlMs'> & { ttlMs?: number }): number;
  dismiss(id: number): void;
}

export const ToastContext = createContext<ToastApi | null>(null);

let nextId = 1;

function defaultIconFor(tone: ToastTone): string {
  switch (tone) {
    case 'success': return '✓';
    case 'error':   return '⚠';
    case 'info':    return 'ℹ';
  }
}

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback<ToastApi['show']>(
    (toast) => {
      const id = nextId++;
      const ttlMs = toast.ttlMs ?? 4000;
      setToasts((prev) => [...prev, { ...toast, id, ttlMs }]);
      if (ttlMs > 0) {
        window.setTimeout(() => dismiss(id), ttlMs);
      }
      return id;
    },
    [dismiss]
  );

  // Portal target: prefer the in-shell anchor (so toasts sit inside the
  // sample frame). Fall back to document.body for the loading / welcome
  // phases when the shell hasn't mounted yet. Re-evaluated on every render
  // — once AppShell is in the DOM the next state change picks it up.
  const portalNode =
    typeof document !== 'undefined'
      ? document.getElementById('app-shell-toast-root') ?? document.body
      : null;

  return (
    <ToastContext.Provider value={{ show, dismiss }}>
      {children}
      {portalNode &&
        createPortal(
          <div className="toast-stack" role="status" aria-live="polite" aria-atomic="false">
            {toasts.map((t) => (
              <div
                key={t.id}
                className={`toast toast--${t.tone} toast--src-${t.source ?? 'user'}`}
                data-kind={t.kind ?? undefined}
              >
                <span className="toast__icon" aria-hidden="true">
                  {t.icon ?? defaultIconFor(t.tone)}
                </span>
                {t.kind && (
                  <span className={`toast__kind toast__kind--${t.kind}`}>{t.kind}</span>
                )}
                <span className="toast__message">{t.message}</span>
                <span className={`toast__source toast__source--${t.source ?? 'user'}`}>
                  {t.source ?? 'user'}
                </span>
                {t.action && (
                  <button
                    type="button"
                    className="toast__action"
                    onClick={() => {
                      t.action!.onClick();
                      dismiss(t.id);
                    }}
                  >
                    {t.action.label}
                  </button>
                )}
                <button
                  type="button"
                  className="toast__close"
                  aria-label="Dismiss"
                  onClick={() => dismiss(t.id)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>,
          portalNode
        )}
    </ToastContext.Provider>
  );
};
