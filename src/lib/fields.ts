// Turns what someone typed into a number, or says what's wrong in words they can act on.

/**
 * "12,000" → 12000, "35.5" → 35.5, "0,5" → 0.5, "1 200" → 1200. A comma followed by exactly three digits is a
 * thousands separator; a single comma followed by one or two digits is a decimal comma. Anything else is not a number
 * (including negatives: nothing on these pages is below zero).
 */
export function parseNumeric(raw: string): number | null {
  const s = raw.replace(/[\s_ ]/g, "");
  if (s === "") return null;

  let normal: string | null = null;
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) normal = s.replace(/,/g, "");
  else if (/^\d+,\d{1,2}$/.test(s)) normal = s.replace(",", ".");
  else if (/^\d+(\.\d+)?$/.test(s)) normal = s;
  else if (/^\.\d+$/.test(s)) normal = `0${s}`;

  if (normal === null) return null;
  const n = Number(normal);
  return Number.isFinite(n) ? n : null;
}

export type FieldRule = {
  min: number;
  max: number;
  /** Whole numbers only. */
  integer?: boolean;
  /** An empty field is fine and means "not given". */
  optional?: boolean;
  /** Replaces the out-of-range sentence when a limit needs explaining. */
  rangeMessage?: string;
};

export type Parsed = { value: number | null; error: string | null };

const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });

export function parseField(raw: string, rule: FieldRule): Parsed {
  if (raw.trim() === "") return rule.optional ? { value: null, error: null } : { value: null, error: "Enter a number." };

  const n = parseNumeric(raw);
  if (n === null) return { value: null, error: "Use digits only, like 35." };
  if (rule.integer && !Number.isInteger(n)) return { value: null, error: "Use a whole number." };
  if (n < rule.min || n > rule.max) {
    return { value: null, error: rule.rangeMessage ?? `Enter a number from ${fmt(rule.min)} to ${fmt(rule.max)}.` };
  }
  return { value: n, error: null };
}
