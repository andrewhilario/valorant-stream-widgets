"use client";

import { Check, Lock } from "lucide-react";
import { useRef, useState } from "react";
import { copyText } from "@/lib/clipboard";
import { SupportLink } from "../sections/SupportLink";
import { CopyButton } from "./CopyButton";
import { usePlayground } from "./usePlayground";

/** A number that copies itself: OBS asks for width and height in separate boxes. */
function SizeChip({ value, label }: { value: number; label: string }) {
  const [done, setDone] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  return (
    <button
      type="button"
      className="sizechip"
      aria-label={`Copy ${label} ${value}`}
      onClick={async () => {
        if (!(await copyText(String(value)))) return;
        setDone(true);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setDone(false), 1500);
      }}
    >
      <span className="mono">{value}</span>
      {done && <Check aria-hidden="true" />}
    </button>
  );
}

export function OutputBar() {
  const { url, maskedUrl, configured, needs, size, copied, preview, sample } = usePlayground();

  // The link can be copied, but while the service rejects the key or can't find the account it will show nothing in OBS either.
  const { status } = preview;
  const broken =
    configured && !sample && status.state === "error" && (status.code === "bad_key" || status.code === "not_found");

  return (
    <section className="output" aria-label="OBS link">
      <div className="output__row">
        <div className="output__field">
          <label className="output__label" htmlFor="obs-link">
            OBS link
          </label>
          {/* Shows the link with the key masked. Copying it, by button or by hand, still gives the whole link. */}
          <input
            id="obs-link"
            className="output__url"
            readOnly
            value={maskedUrl ?? ""}
            placeholder="Add your Riot ID and key to generate your link"
            onFocus={(event) => event.currentTarget.select()}
            onCopy={(event) => {
              if (!url) return;
              event.preventDefault();
              event.clipboardData.setData("text/plain", url);
            }}
            spellCheck={false}
          />
        </div>
        <CopyButton />
      </div>

      <div className="output__meta">
        <p className="output__size">
          <span>Source size</span>
          <SizeChip value={size.w} label="width" />
          <span aria-hidden="true">×</span>
          <SizeChip value={size.h} label="height" />
          <span>px</span>
        </p>

        {copied === "failed" ? (
          <p className="output__hint" data-tone="error" role="alert">
            Couldn’t copy. Select the link and press Ctrl+C.
          </p>
        ) : !configured ? (
          <p className="output__hint" id="copy-why">
            {needs?.message} to unlock your link.
          </p>
        ) : broken ? (
          <p className="output__hint" data-tone="error">
            This link won’t show anything until the problem above is fixed.
          </p>
        ) : (
          <div className="output__aside">
            <p className="output__hint output__hint--lock">
              <Lock aria-hidden="true" />
              <span>Keep this link private. It holds your key.</span>
            </p>
            <SupportLink variant="chip" />
          </div>
        )}
      </div>

      <span className="sr-only" role="status" aria-live="polite">
        {copied === "copied" ? "Link copied" : ""}
      </span>
    </section>
  );
}
