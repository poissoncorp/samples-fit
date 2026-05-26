import { useEffect, type RefObject } from 'react';

/**
 * Closes a popover when the user clicks outside any of the given refs or
 * presses Escape. No-op while <c>open</c> is false. On Escape, focus is
 * restored to the first ref if it is a focusable trigger; on click-outside
 * the focus stays wherever the click landed.
 *
 * Used by the simple popovers (UserPill, TrophyShelf). The richer
 * <Popover> in components/common inlines its own listeners because its
 * positioning loop is intertwined with them.
 */
export function useClickOutside(
  open: boolean,
  refs: ReadonlyArray<RefObject<HTMLElement | null>>,
  onClose: () => void,
) {
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (refs.every((r) => r.current && !r.current.contains(t))) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        refs[0]?.current?.focus();
      }
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
    // refs array identity is stable across renders (caller passes useRef
    // tuples); intentionally excluded from deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, onClose]);
}
