/**
 * Recursively merge a source object onto a target, returning a new object.
 *
 * - Plain (non-array) objects are merged recursively.
 * - Arrays and primitive leaf values from `source` overwrite `target`.
 * - `undefined` values in `source` are skipped, so they never clobber an
 *   existing target value.
 * - Keys present only in `target` are preserved.
 *
 * This is intentionally a generic, lossless merge: unlike the theme library's
 * `mergeThemes`, it never drops top-level keys it doesn't know about (e.g. a
 * Theme's `modes` / `fontScale`). Shared between main and renderer.
 */
export function deepMerge<T extends object>(target: T, source: object): T {
  const output = { ...target } as Record<string, unknown>;

  for (const key of Object.keys(source)) {
    const sourceValue = (source as Record<string, unknown>)[key];
    const targetValue = (target as Record<string, unknown>)[key];

    if (sourceValue === undefined) {
      continue;
    }

    if (
      sourceValue &&
      typeof sourceValue === 'object' &&
      !Array.isArray(sourceValue) &&
      targetValue &&
      typeof targetValue === 'object' &&
      !Array.isArray(targetValue)
    ) {
      output[key] = deepMerge(targetValue as object, sourceValue as object);
    } else {
      output[key] = sourceValue;
    }
  }

  return output as T;
}
