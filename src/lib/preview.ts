// The editor's preview is an iframe of the real widget page. These are the
// messages they exchange (same origin only).

import type { RankErrorCode } from "./rank-types";
import type { Config } from "./schema";

export type PreviewStatus =
  | { state: "sample" }
  /** Nothing to look up yet. */
  | { state: "idle" }
  | { state: "loading" }
  | { state: "live"; updatedAt: number; partial: boolean }
  | { state: "error"; code: RankErrorCode | "network"; message: string; retryAfter?: number };

/** editor → widget */
export type ConfigMessage = { t: "config"; config: Config; sample: boolean };

/**
 * editor → widget: play a game that never happened ("Try a game"). Always sent after the config message it belongs to, so
 * the widget is already showing sample data. `n` counts up, so the same kind twice in a row is two games.
 */
export type ReactMessage = { t: "react"; kind: string; n: number };

/** widget → editor */
export type WidgetMessage =
  | { t: "ready" }
  | { t: "size"; w: number; h: number }
  | { t: "status"; status: PreviewStatus; account: string | null; tier: string | null };
