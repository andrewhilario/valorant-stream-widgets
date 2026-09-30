// The stream canvas the preview assumes. The widget itself doesn't depend on it:
// it is only the stage you place and size the widget on.

export type Format = "landscape" | "vertical";

export const CANVAS: Record<Format, { w: number; h: number; label: string }> = {
  landscape: { w: 1920, h: 1080, label: "Landscape" },
  vertical: { w: 1080, h: 1920, label: "Vertical" },
};

export function isFormat(value: unknown): value is Format {
  return value === "landscape" || value === "vertical";
}
