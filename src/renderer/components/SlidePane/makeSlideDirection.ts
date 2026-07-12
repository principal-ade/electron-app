/**
 * makeSlideDirection
 *
 * Build a direction resolver from a left-to-right ordering of surfaces. A
 * transition to a later surface slides the new pane in from the right (returns
 * 1); going back reverses it (returns -1). Pass the result as
 * `resolveDirection` to `SlidePane`.
 */
export function makeSlideDirection(
  order: readonly string[],
): (from: string, to: string) => 1 | -1 {
  return (from, to) => {
    const a = order.indexOf(from);
    const b = order.indexOf(to);
    return b >= a ? 1 : -1;
  };
}
