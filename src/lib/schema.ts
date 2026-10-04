// A widget is described by a schema: sections of controls, each with a default
// and a short URL parameter. The schema drives the inspector UI, the command
// palette, validation, and the link format — so adding a widget means writing
// one schema, not another form.

export type ConfigValue = string | number | boolean;
export type Config = Record<string, ConfigValue>;

type Base = {
  /** Key in the config object. */
  key: string;
  /** Short URL parameter. */
  param: string;
  label: string;
  help?: string;
  /** Extra words the command palette should match. */
  keywords?: string[];
  /** Tucked into the section's Advanced drawer. */
  advanced?: boolean;
  /**
   * A secret (an API key). Kept out of the query string and the editor's address bar;
   * it travels in the link's #fragment, which browsers never send to a server.
   */
  secret?: boolean;
  /** Hide the control unless this returns true. */
  showWhen?: (config: Config) => boolean;
  default: ConfigValue;
};

export type TextControl = Base & {
  kind: "text";
  placeholder?: string;
  maxLength: number;
  default: string;
  /** Returns an instruction when the value is wrong, null when it's fine. Runs after the field has been touched. */
  validate?: (value: string) => string | null;
  /** Its helper text follows the live lookup: "account" for who to look up, "key" for the credential. */
  liveFor?: "account" | "key";
  /** A short how-to shown in a disclosure under the field. */
  learnMore?: { summary: string; steps: string[]; href: string; hrefLabel: string };
};
/** A miniature of what an option looks like: custom properties for its colours, data attributes for its shape. */
export type ChoiceSwatch = { vars: Record<string, string>; data: Record<string, string> };

export type ChoiceOption = {
  value: string;
  label: string;
  /** A line under the name in a gallery. */
  note?: string;
  /** What a gallery draws for this option. */
  swatch?: ChoiceSwatch;
};

export type ChoiceControl = Base & {
  kind: "choice";
  options: ChoiceOption[];
  default: string;
  /**
   * Draw the options as cards (gallery) or a native select dropdown instead of a segmented bar.
   */
  display?: "gallery" | "select";
  /** Extra keys to set when an option is chosen — lets a preset apply a bundle. */
  onSelect?: (value: string) => Config;
};
export type RangeControl = Base & {
  kind: "range";
  min: number;
  max: number;
  step: number;
  unit: string;
  default: number;
};
export type ToggleControl = Base & { kind: "toggle"; default: boolean };
export type ColorControl = Base & {
  kind: "color";
  swatches: Array<{ value: string; label: string }>;
  /** Label for the empty value ("use the theme's colour"). */
  emptyLabel: string;
  default: string;
};
export type FlagsControl = Base & {
  kind: "flags";
  options: Array<{ value: string; label: string; appliesTo?: (config: Config) => boolean; whyNot?: string }>;
  /** Comma-separated, canonical order. */
  default: string;
};

export type Control = TextControl | ChoiceControl | RangeControl | ToggleControl | ColorControl | FlagsControl;

export type Section = { id: string; label: string; controls: Control[] };

export type WidgetSchema = { sections: Section[] };

export function controlsOf(schema: WidgetSchema): Control[] {
  return schema.sections.flatMap((s) => s.controls);
}

export function defaultsOf(schema: WidgetSchema): Config {
  const out: Config = {};
  for (const c of controlsOf(schema)) out[c.key] = c.default;
  return out;
}

const HEX = /^[0-9a-f]{6}$/;

function snap(control: RangeControl, value: number): number {
  const stepped = Math.round((value - control.min) / control.step) * control.step + control.min;
  const clamped = Math.min(control.max, Math.max(control.min, stepped));
  // Kill floating-point dust from non-integer steps.
  return Math.round(clamped * 1e6) / 1e6;
}

function flagList(control: FlagsControl, raw: string): string {
  const wanted = new Set(raw.split(",").map((s) => s.trim()).filter(Boolean));
  return control.options
    .map((o) => o.value)
    .filter((v) => wanted.has(v))
    .join(",");
}

/** Coerce one raw value into something the control accepts, else its default. */
export function sanitizeValue(control: Control, raw: unknown): ConfigValue {
  switch (control.kind) {
    case "text": {
      if (typeof raw !== "string") return control.default;
      // Not trimmed: this runs on every keystroke, and "a b" passes through "a " on its way.
      // eslint-disable-next-line no-control-regex
      return raw.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, control.maxLength);
    }
    case "choice": {
      return typeof raw === "string" && control.options.some((o) => o.value === raw) ? raw : control.default;
    }
    case "range": {
      const n = typeof raw === "number" ? raw : typeof raw === "string" && raw.trim() !== "" ? Number(raw) : NaN;
      return Number.isFinite(n) ? snap(control, n) : control.default;
    }
    case "toggle": {
      if (typeof raw === "boolean") return raw;
      if (raw === "1" || raw === "true" || raw === 1) return true;
      if (raw === "0" || raw === "false" || raw === 0) return false;
      return control.default;
    }
    case "color": {
      if (typeof raw !== "string") return control.default;
      const hex = raw.trim().replace(/^#/, "").toLowerCase();
      return hex === "" || HEX.test(hex) ? hex : control.default;
    }
    case "flags": {
      return typeof raw === "string" ? flagList(control, raw) : control.default;
    }
  }
}

/** Validate a whole config: unknown keys dropped, bad values replaced by defaults. */
export function sanitize(schema: WidgetSchema, input: Record<string, unknown>): Config {
  const out: Config = {};
  for (const c of controlsOf(schema)) {
    out[c.key] = c.key in input ? sanitizeValue(c, input[c.key]) : c.default;
  }
  return out;
}

/** Reads the query string. Secret controls are never read from here; see fromLocation. */
export function fromParams(schema: WidgetSchema, params: URLSearchParams): Config {
  const out: Config = {};
  for (const c of controlsOf(schema)) {
    out[c.key] = !c.secret && params.has(c.param) ? sanitizeValue(c, params.get(c.param)) : c.default;
  }
  return out;
}

/** Reads a widget link: settings from the query string, secrets from the #fragment only. */
export function fromLocation(schema: WidgetSchema, search: string, hash: string): Config {
  const config = fromParams(schema, new URLSearchParams(search));
  const secrets = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
  for (const c of controlsOf(schema)) {
    if (c.secret && secrets.has(c.param)) config[c.key] = sanitizeValue(c, secrets.get(c.param));
  }
  return config;
}

function encode(control: Control, value: ConfigValue): string {
  if (control.kind === "toggle") return value ? "1" : "0";
  return String(value);
}

/** Only values that differ from their default, so links stay short and readable. Secrets never appear. */
export function toParams(schema: WidgetSchema, config: Config): URLSearchParams {
  const params = new URLSearchParams();
  for (const c of controlsOf(schema)) {
    if (c.secret) continue;
    const value = config[c.key];
    if (value === undefined || value === c.default) continue;
    params.set(c.param, encode(c, value));
  }
  return params;
}

const MASK = "••••••••";

/**
 * The #fragment part of a widget link: secrets only, no leading "#".
 * With `mask`, values are replaced by dots so the link can be shown on screen.
 */
export function secretHash(schema: WidgetSchema, config: Config, mask = false): string {
  const parts: string[] = [];
  for (const c of controlsOf(schema)) {
    if (!c.secret) continue;
    const value = String(config[c.key] ?? "").trim();
    if (!value || value === c.default) continue;
    parts.push(`${c.param}=${mask ? MASK : encodeURIComponent(value)}`);
  }
  return parts.join("&");
}

export function hasFlag(list: ConfigValue, flag: string): boolean {
  return typeof list === "string" && list.split(",").includes(flag);
}

/** The config with `value` picked for a choice: the value itself, then whatever its `onSelect` sets alongside. */
export function applyChoice(control: ChoiceControl, config: Config, value: string): Config {
  return { ...config, [control.key]: value, ...(control.onSelect?.(value) ?? {}) };
}

/**
 * The config as it would be if `value` were picked for the choice `key`, for previewing it without choosing it.
 * Anything that isn't a valid pick of a choice leaves the config as it was.
 */
export function withChoice(controls: Control[], config: Config, key: string, value: string): Config {
  const control = controls.find((c) => c.key === key);
  if (!control || control.kind !== "choice" || !control.options.some((o) => o.value === value)) return config;
  return applyChoice(control, config, value);
}
