/** Shared phone-field handling. A party (or the shop itself) can have up to
 * two mobile numbers, typed into the one Phone box separated by a comma, e.g.
 * "7896857485, 9685471425". Stored as that single normalized string so the
 * backend column, search, invoice print and lists all keep working as-is. */

export const MAX_PHONES = 2;
export const PHONE_PLACEHOLDER = 'e.g. 7896857485, 9685471425';

/** Result of normalizePhones: `value` is the cleaned string to save (null
 * when empty), or `error` explains why the input can't be saved. */
export type PhoneParseResult = { value: string | null; error?: undefined } | { value?: undefined; error: string };

/** Splits on comma / slash / semicolon (not spaces - "98765 43210" is one
 * number), strips spaces, dashes and a leading +91 or 0 from each number, and
 * checks each is 10 digits. */
export function normalizePhones(raw: string | null | undefined): PhoneParseResult {
  const text = (raw ?? '').trim();
  if (!text) return { value: null };

  const numbers = text
    .split(/[,;/]+/)
    .map((part) => part.replace(/[\s\-()]/g, '').replace(/^(\+?91|0)(?=\d{10}$)/, ''))
    .filter((part) => part.length > 0);

  if (numbers.length > MAX_PHONES) {
    return { error: `Enter at most ${MAX_PHONES} phone numbers, separated by a comma.` };
  }
  const invalid = numbers.find((n) => !/^\d{10}$/.test(n));
  if (invalid) {
    return { error: `"${invalid}" is not a valid 10-digit phone number.` };
  }
  if (numbers.length === 2 && numbers[0] === numbers[1]) {
    return { value: numbers[0] };
  }
  return { value: numbers.join(', ') };
}
