import type { MouseEvent } from 'react';

/**
 * Drop DOM focus when a control is activated by the *pointer*.
 *
 * Chromium focuses a clicked `button`, and nothing in the shell moves focus
 * afterwards — so the control we just clicked stays `document.activeElement`
 * and keeps answering keys. Space (the natural "scroll" key) or Enter then
 * re-runs its click handler: the Sky View overlay re-toggles, a sidebar item
 * re-navigates (and collapses the panel, because clicking the *active* item is
 * what toggles it).
 *
 * Keyboard activation dispatches its click with `detail === 0`, so that path is
 * left alone — keyboard users keep their place in the tab order and can keep
 * navigating with the arrow/Space keys as expected.
 */
export function blurAfterPointerActivation(
  event: MouseEvent<HTMLElement>,
): void {
  if (event.detail > 0) {
    event.currentTarget.blur();
  }
}
