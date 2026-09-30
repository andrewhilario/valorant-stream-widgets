"use client";

import { Check, Copy } from "lucide-react";
import { usePlayground } from "./usePlayground";

/**
 * Copies the OBS link. The label swaps in place (no toast) and the button keeps
 * its width, because all three labels share one grid cell.
 */
export function CopyButton({ className = "" }: { className?: string }) {
  const { url, copied, copy } = usePlayground();
  const disabled = !url;

  return (
    <button
      type="button"
      className={`btn btn--primary ${className}`}
      aria-disabled={disabled}
      aria-describedby={disabled ? "copy-why" : undefined}
      data-state={copied}
      onClick={() => {
        if (!disabled) void copy();
      }}
    >
      {copied === "copied" ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
      <span className="btn__labels">
        <span data-on={copied === "idle"}>Copy link</span>
        <span data-on={copied === "copied"}>Copied</span>
        <span data-on={copied === "failed"}>Copy failed</span>
      </span>
    </button>
  );
}
