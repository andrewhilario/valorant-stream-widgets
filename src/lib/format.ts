// Number and duration wording for the calculators. The locale is fixed so the server and the browser
// print the same text (no hydration mismatch), and negatives use a real minus sign, like the widget.

const EN = "en-US";

/** 98900 → "98,900". */
export const int = (n: number): string => Math.round(n).toLocaleString(EN);

/** 47.222 → "47.2". Trailing zeros are dropped. */
export const dec = (n: number, digits = 1): string => n.toLocaleString(EN, { maximumFractionDigits: digits });

/** 2.44 → "+2.44", -1.5 → "−1.5", 0 → "0". */
export function signed(n: number, digits = 2): string {
  const body = Math.abs(n).toLocaleString(EN, { maximumFractionDigits: digits });
  if (Number(body.replace(/,/g, "")) === 0) return "0";
  return `${n > 0 ? "+" : "−"}${body}`;
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/** 0.5 → "30 minutes", 1 → "1 hour", 18.08 → "18.1 hours". */
export function hoursText(hours: number): string {
  if (hours < 1) {
    const minutes = Math.max(1, Math.round(hours * 60));
    return `${minutes} ${plural(minutes, "minute", "minutes")}`;
  }
  const rounded = Math.round(hours * 10) / 10;
  return `${dec(rounded)} ${plural(rounded, "hour", "hours")}`;
}

/** 0.4 → "under a day", 1 → "1 day", 9.04 → "9 days". */
export function daysText(days: number): string {
  if (days < 1) return "under a day";
  const rounded = days < 10 ? Math.round(days * 10) / 10 : Math.round(days);
  return `${dec(rounded)} ${plural(rounded, "day", "days")}`;
}

/** "Jett", "Jett and Sage", "Jett, Sage and Omen". */
export function list(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}
