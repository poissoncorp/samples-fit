import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './Popover.css';

interface PopoverProps {
  trigger: (props: {
    ref: React.RefObject<HTMLElement>;
    onClick: () => void;
    onMouseEnter?: () => void;
    onMouseLeave?: () => void;
    onFocus?: () => void;
    onBlur?: () => void;
    'aria-haspopup': 'dialog';
    'aria-expanded': boolean;
    'aria-controls': string;
  }) => React.ReactNode;
  children: React.ReactNode;
  title?: string;
  align?: 'right' | 'center' | 'left';
  /** Open on hover/focus too. Click is always supported. */
  hoverable?: boolean;
}

const HOVER_OPEN_DELAY = 120;
const HOVER_CLOSE_DELAY = 180;

/**
 * Click-to-open popover with full keyboard a11y. With hoverable=true, also
 * opens on pointer hover and keyboard focus, with small open/close delays
 * to allow moving cursor into the panel without flicker.
 */
export const Popover: React.FC<PopoverProps> = ({
  trigger,
  children,
  title,
  align = 'right',
  hoverable = false,
}) => {
  const id = useId();
  const popoverId = `popover-${id}`;
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null);
  const triggerRef = useRef<HTMLElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const openTimer = useRef<number | null>(null);
  const closeTimer = useRef<number | null>(null);
  // Whether the open was driven by hover (no focus return on close) vs click/focus.
  const openedByHover = useRef(false);

  const cancelTimers = () => {
    if (openTimer.current !== null) {
      window.clearTimeout(openTimer.current);
      openTimer.current = null;
    }
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  const close = (returnFocus = true) => {
    cancelTimers();
    setOpen(false);
    if (returnFocus && !openedByHover.current) triggerRef.current?.focus();
    openedByHover.current = false;
  };

  const compute = () => {
    const t = triggerRef.current;
    if (!t) return;
    const rect = t.getBoundingClientRect();

    // If the trigger is fully outside the viewport, close — keeping the
    // popover floating mid-page after the user scrolls past its anchor is
    // disorienting.
    const offscreen =
      rect.bottom < 0 ||
      rect.top > window.innerHeight ||
      rect.right < 0 ||
      rect.left > window.innerWidth;
    if (offscreen) {
      setOpen(false);
      return;
    }

    // Viewport-relative coords (popover uses position: fixed) — no scrollY
    // math, so the popover tracks the trigger across any scroll context
    // (page scroll, internal panel scroll, etc.).
    setCoords({
      top: rect.bottom + 6,
      left: rect.left,
      width: rect.width,
    });
  };

  useEffect(() => {
    if (!open) return;
    compute();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      close(false);
    };
    const onScroll = () => compute();

    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);

    // The samples-ui-wrapper hosts a shadow DOM that scrolls internally;
    // capture-on-window misses those events. RAF-poll the trigger rect so
    // the popover tracks any scroll context (page, wrapper, internal panel).
    let raf = 0;
    let prevTop = -Infinity;
    let prevLeft = -Infinity;
    const tick = () => {
      const t = triggerRef.current;
      if (t) {
        const rect = t.getBoundingClientRect();
        if (rect.top !== prevTop || rect.left !== prevLeft) {
          prevTop = rect.top;
          prevLeft = rect.left;
          compute();
        }
      }
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);

    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
      window.cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line
  }, [open]);

  // ---- Hover/focus handlers (only meaningful when hoverable === true) ----
  const scheduleOpen = () => {
    cancelTimers();
    openTimer.current = window.setTimeout(() => {
      openedByHover.current = true;
      setOpen(true);
    }, HOVER_OPEN_DELAY);
  };

  const scheduleClose = () => {
    cancelTimers();
    closeTimer.current = window.setTimeout(() => close(false), HOVER_CLOSE_DELAY);
  };

  const handleClick = () => {
    cancelTimers();
    if (open) {
      // If the popover was opened passively (hover/focus, e.g. from
      // Playwright's mousedown→focus→click sequence), treat the click as
      // a "pin" gesture instead of toggling closed.
      if (openedByHover.current) {
        openedByHover.current = false;
        return;
      }
      close(false);
    } else {
      openedByHover.current = false;
      setOpen(true);
    }
  };

  const handleTriggerEnter = hoverable ? scheduleOpen : undefined;
  const handleTriggerLeave = hoverable ? scheduleClose : undefined;
  const handleTriggerFocus = hoverable
    ? () => {
        cancelTimers();
        // Focus is a passive open — click should pin, not toggle off.
        openedByHover.current = true;
        setOpen(true);
      }
    : undefined;
  const handleTriggerBlur = hoverable
    ? () => {
        // Only close on blur if focus didn't move into the panel.
        scheduleClose();
      }
    : undefined;

  const triggerNode = trigger({
    ref: triggerRef,
    onClick: handleClick,
    onMouseEnter: handleTriggerEnter,
    onMouseLeave: handleTriggerLeave,
    onFocus: handleTriggerFocus,
    onBlur: handleTriggerBlur,
    'aria-haspopup': 'dialog',
    'aria-expanded': open,
    'aria-controls': popoverId,
  });

  return (
    <>
      {triggerNode}
      {open && coords && typeof document !== 'undefined' &&
        createPortal(
          <div
            id={popoverId}
            ref={panelRef}
            role="dialog"
            aria-modal="false"
            aria-label={title ?? 'More info'}
            className={`popover popover--${align}`}
            style={{
              top: coords.top,
              left: align === 'right'
                ? coords.left + coords.width
                : align === 'center'
                ? coords.left + coords.width / 2
                : coords.left,
            }}
            onMouseEnter={hoverable ? cancelTimers : undefined}
            onMouseLeave={hoverable ? scheduleClose : undefined}
          >
            {title && <div className="popover__title">{title}</div>}
            <div className="popover__body">{children}</div>
          </div>,
          document.body
        )}
    </>
  );
};
