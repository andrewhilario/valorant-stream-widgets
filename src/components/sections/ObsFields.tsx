"use client";

import { CANVAS } from "@/lib/canvas";
import { usePlayground } from "../playground/usePlayground";

/** What to type into OBS, with this widget's real numbers. */
export function ObsFields() {
  const { size, configured, format } = usePlayground();
  const canvas = CANVAS[format];

  return (
    <div className="spec" role="group" aria-labelledby="spec-title">
      <h3 className="spec__title" id="spec-title">
        What to enter in OBS
      </h3>
      <dl className="spec__rows">
        <div className="spec__row">
          <dt>URL</dt>
          <dd>{configured ? "The link you copied" : "Your link, once it’s ready"}</dd>
        </div>
        <div className="spec__row">
          <dt>Width</dt>
          <dd className="mono">{size.w}</dd>
        </div>
        <div className="spec__row">
          <dt>Height</dt>
          <dd className="mono">{size.h}</dd>
        </div>
        <div className="spec__row">
          <dt>Custom CSS</dt>
          <dd>Leave it as OBS fills it in</dd>
        </div>
        <div className="spec__row">
          <dt>Canvas</dt>
          <dd className="mono">
            {canvas.w}&nbsp;×&nbsp;{canvas.h}
          </dd>
        </div>
      </dl>
      <p className="spec__note">
        Width and height follow your layout and Size setting, so check them again if you change either. Canvas is what the
        preview assumes: match it under Settings, Video. For a vertical stream that means 1080 × 1920.
      </p>
    </div>
  );
}
