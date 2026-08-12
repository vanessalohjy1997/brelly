/**
 * Firestore's SDK throws "Unsupported field value: undefined" for any key
 * present with an explicit `undefined` value — a key that's simply absent is
 * fine. Local state assembled field-by-field (an older install's optional
 * field that was never set, a spread that copied one in) can carry these;
 * every full-document Firestore write needs them gone first, or the write
 * throws instead of landing.
 */
export function omitUndefinedFields<T extends Record<string, unknown>>(
  obj: T,
): Partial<T> {
  const result: Partial<T> = {};
  for (const key of Object.keys(obj) as (keyof T)[]) {
    if (obj[key] !== undefined) result[key] = obj[key];
  }
  return result;
}
